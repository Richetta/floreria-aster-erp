import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db';
import { randomUUID } from 'crypto';

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // Create user schema
  const createUserSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    role: z.enum(['admin', 'seller', 'driver', 'viewer']).default('viewer'),
    phone: z.string().optional().or(z.literal(''))
  });

  // Update user schema (partial)
  const updateUserSchema = createUserSchema.partial().extend({
    is_active: z.boolean().optional()
  });

  // LIST USERS (Admin only)
  fastify.get('/', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin') {
          return reply.code(403).send({ error: 'Only admins can list users' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const currentUser = request.user as any;

    await sql`SET LOCAL app.current_business_id = ${currentUser.business_id}`.execute(db);

    const users = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'role', 'phone', 'is_active', 'last_login', 'created_at'])
      .where('deleted_at', 'is', null)
      .orderBy('name', 'asc')
      .execute();

    return reply.send(users);
  });

  // GET SINGLE USER
  fastify.get('/:id', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

    const targetUser = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'role', 'phone', 'is_active', 'last_login', 'created_at'])
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(targetUser);
  });

  // CREATE USER (Admin only)
  fastify.post('/', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin') {
          return reply.code(403).send({ error: 'Only admins can create users' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const currentUser = request.user as any;

    try {
      const body = createUserSchema.parse(request.body);

      await sql`SET LOCAL app.current_business_id = ${currentUser.business_id}`.execute(db);

      // Check if email already exists
      const existing = await db
        .selectFrom('users')
        .select('id')
        .where('email', '=', body.email)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

      if (existing) {
        return reply.status(409).send({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(body.password, 10);

      // Create user
      const result = await db
        .insertInto('users')
        .values({
          id: crypto.randomUUID(),
          business_id: currentUser.business_id,
          name: body.name,
          email: body.email,
          password_hash: passwordHash,
          role: body.role,
          phone: body.phone || null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null
        })
        .returning(['id', 'name', 'email', 'role', 'phone', 'is_active', 'created_at'])
        .executeTakeFirst();

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // UPDATE USER (Admin only, can't update own role)
  fastify.put('/:id', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin') {
          return reply.code(403).send({ error: 'Only admins can update users' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const currentUser = request.user as any;
    const { id } = request.params as { id: string };

    try {
      const body = updateUserSchema.parse(request.body);

      await sql`SET LOCAL app.current_business_id = ${currentUser.business_id}`.execute(db);

      // Admins can't demote themselves
      if (id === currentUser.sub && body.role && body.role !== 'admin') {
        return reply.status(400).send({ error: 'Cannot change your own role' });
      }

      // Build update object
      const updateData: any = {
        updated_at: new Date()
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.email !== undefined) updateData.email = body.email;
      if (body.role !== undefined) updateData.role = body.role;
      if (body.phone !== undefined) updateData.phone = body.phone || null;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      // Hash password if provided
      if (body.password !== undefined && body.password !== '') {
        updateData.password_hash = await bcrypt.hash(body.password, 10);
      }

      const result = await db
        .updateTable('users')
        .set(updateData)
        .where('id', '=', id)
        .returning(['id', 'name', 'email', 'role', 'phone', 'is_active', 'updated_at'])
        .executeTakeFirst();

      if (!result) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // DELETE USER (Soft delete - Admin only)
  fastify.delete('/:id', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin') {
          return reply.code(403).send({ error: 'Only admins can delete users' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const currentUser = request.user as any;
    const { id } = request.params as { id: string };

    // Can't delete yourself
    if (id === currentUser.sub) {
      return reply.status(400).send({ error: 'Cannot delete your own account' });
    }

    await sql`SET LOCAL app.current_business_id = ${currentUser.business_id}`.execute(db);

    await db
      .updateTable('users')
      .set({
        deleted_at: new Date(),
        is_active: false
      })
      .where('id', '=', id)
      .execute();

    return reply.send({ success: true });
  });

  // CHANGE OWN PASSWORD
  fastify.post('/change-password', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    const schema = z.object({
      current_password: z.string().min(6),
      new_password: z.string().min(6)
    });

    try {
      const body = schema.parse(request.body);

      await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

      // Get current user
      const currentUserData = await db
        .selectFrom('users')
        .select(['password_hash'])
        .where('id', '=', user.sub)
        .executeTakeFirst();

      if (!currentUserData) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Verify current password
      if (!currentUserData.password_hash) {
        return reply.status(400).send({ error: 'This user does not have a local password set' });
      }
      const validPassword = await bcrypt.compare(body.current_password, currentUserData.password_hash);
      if (!validPassword) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(body.new_password, 10);

      // Update password
      await db
        .updateTable('users')
        .set({
          password_hash: newPasswordHash,
          updated_at: new Date()
        })
        .where('id', '=', user.sub)
        .execute();

      return reply.send({ success: true, message: 'Password changed successfully' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // GET CURRENT USER PROFILE
  fastify.get('/profile/me', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

    const profile = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'role', 'phone', 'is_active', 'created_at'])
      .where('id', '=', user.sub)
      .executeTakeFirst();

    return reply.send(profile);
  });
};

export default usersRoutes;
