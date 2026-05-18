import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';
import { emailService } from '../services/EmailService.js';
import { config } from '../config/index.js';

// Helper: Check subscription user limit
async function checkUserLimit(businessId: string, reply: any) {
  try {
    // Get subscription limits
    const subResult = await db.selectFrom('subscriptions')
        .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
        .select([
          'subscription_plans.max_users',
          'subscription_plans.name_short',
          'subscription_plans.slug'
        ])
        .where('subscriptions.business_id', '=', businessId)
        .where('subscriptions.status', 'in', ['active', 'trial'])
        .limit(1)
        .executeTakeFirst();

    // No subscription - apply free tier limit
    let maxUsers = 1; // Free tier
    let planName = 'Semilla';
    let planSlug = 'semilla';

    if (subResult) {
      const subscriptionInfo = subResult;
      maxUsers = subscriptionInfo.max_users || 999999; // NULL = unlimited
      planName = subscriptionInfo.name_short || 'Semilla';
      planSlug = subscriptionInfo.slug;
    }

    // Count current users using a separate connection but with RLS set
    const currentCount = await db.connection().execute(async (conn) => {
      await sql`SELECT set_config('app.current_business_id', ${String(businessId)}::TEXT, true)`.execute(conn);
      const res = await conn
        .selectFrom('users')
        .select(db.fn.count('id').as('count'))
        .where('business_id', '=', businessId)
        .where('is_active', '=', true)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
      return Number(res?.count || 0);
    });

    if (currentCount >= maxUsers) {
      reply.code(429).send({
        error: 'Limit Reached',
        message: `Has alcanzado el límite de ${maxUsers} usuarios en tu plan ${planName}`,
        limitReached: true,
        limit: maxUsers,
        current: currentCount,
        resourceType: 'users',
        suggestedPlan: planSlug === 'semilla' ? 'florecer' : planSlug === 'florecer' ? 'crecimiento' : 'jardin',
        upgradeUrl: '/subscription/upgrade'
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking user limit:', error);
    return true; // Fail open
  }
}

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // Create user schema
  const createUserSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    username: z.preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').optional()
    ),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    role: z.enum(['owner', 'admin', 'employee', 'finance', 'delivery', 'viewer']).default('viewer'),
    phone: z.preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z.string().optional()
    )
  });

  // Update user schema (partial)
  const updateUserSchema = createUserSchema.partial().extend({
    password: z.preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional()
    ),
    is_active: z.boolean().optional()
  });

  // LIST USERS (Admin only)
  fastify.get('/', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin' && user.role !== 'owner') {
          const role = user.role;
          console.error(`[AUTH] 403 Forbidden: User ${user.email} has role '${role}'`);
          return reply.code(403).send({ error: 'Only admins or owners can list users', yourRole: role });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const currentUser = request.user as any;

    try {
      const businessId = String(currentUser.business_id);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(businessId)) {
        throw new Error('Invalid business ID format');
      }

      const users = await db.transaction().execute(async (trx) => {
        // Set RLS context for THIS transaction with raw SQL literal to avoid PgBouncer/placeholder issues
        await sql`SELECT set_config('app.current_business_id', ${sql.raw(`'${businessId}'`)}, true)`.execute(trx);

        return await trx
          .selectFrom('users')
          .select(['id', 'name', 'username', 'email', 'role', 'phone', 'is_active', 'last_login', 'created_at'])
          .where('deleted_at', 'is', null)
          .orderBy('name', 'asc')
          .execute();
      });

      return reply.send(users);
    } catch (error: any) {
      console.error('[USERS LIST ERROR]:', error);
      throw error;
    }
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

    const targetUser = await db.connection().execute(async (conn) => {
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(conn);

      return await conn
        .selectFrom('users')
        .select(['id', 'name', 'username', 'email', 'role', 'phone', 'is_active', 'last_login', 'created_at'])
        .where('id', '=', id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    });

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
        if (user.role !== 'admin' && user.role !== 'owner') {
          return reply.code(403).send({ error: 'Only admins or owners can create users' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const currentUser = request.user as any;

    // Check subscription user limit
    const canCreate = await checkUserLimit(currentUser.business_id, reply);
    if (!canCreate) return;

    try {
      const body = createUserSchema.parse(request.body);

      const result = await db.connection().execute(async (conn) => {
        await sql`SELECT set_config('app.current_business_id', ${currentUser.business_id}, true)`.execute(conn);

        // Check if email already exists
        const existing = await conn
          .selectFrom('users')
          .select('id')
          .where('email', '=', body.email)
          .where('deleted_at', 'is', null)
          .executeTakeFirst();

        if (existing) {
          return null; // Handle outside to send 409
        }

        // Check if username already exists for this business
        if (body.username) {
          const existingUsername = await conn
            .selectFrom('users')
            .select('id')
            .where('business_id', '=', currentUser.business_id)
            .where('username', '=', body.username)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

          if (existingUsername) {
            return { errorType: 'username_taken' };
          }
        }

        // Hash password
        const passwordHash = await bcrypt.hash(body.password, 10);

        // Create user
        return await conn
          .insertInto('users')
          .values({
            id: randomUUID(),
            business_id: currentUser.business_id,
            name: body.name,
            username: body.username || null,
            email: body.email,
            password_hash: passwordHash,
            role: body.role,
            phone: body.phone || null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null
          })
          .returning(['id', 'name', 'username', 'email', 'role', 'phone', 'is_active', 'created_at'])
          .executeTakeFirst();
      });

      if (result === null) {
        return reply.status(409).send({ error: 'Este correo electrónico ya está registrado' });
      }

      if (result && 'errorType' in result && result.errorType === 'username_taken') {
        return reply.status(409).send({ error: 'El nombre de usuario ya está registrado en tu empresa' });
      }

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
        if (user.role !== 'admin' && user.role !== 'owner') {
          return reply.code(403).send({ error: 'Only admins or owners can update users' });
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

      const result = await db.connection().execute(async (conn) => {
        await sql`SELECT set_config('app.current_business_id', ${currentUser.business_id}, true)`.execute(conn);

        if (id === currentUser.sub && body.role && body.role !== currentUser.role) {
          throw new Error('Cannot change your own role');
        }

        // Check if username already exists for another user in this business
        if (body.username) {
          const existingUsername = await conn
            .selectFrom('users')
            .select('id')
            .where('business_id', '=', currentUser.business_id)
            .where('username', '=', body.username)
            .where('id', '!=', id)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

          if (existingUsername) {
            return { errorType: 'username_taken' };
          }
        }

        // Build update object
        const updateData: any = {
          updated_at: new Date()
        };

        if (body.name !== undefined) updateData.name = body.name;
        if (body.username !== undefined) updateData.username = body.username || null;
        if (body.email !== undefined) updateData.email = body.email;
        if (body.role !== undefined) updateData.role = body.role;
        if (body.phone !== undefined) updateData.phone = body.phone || null;
        if (body.is_active !== undefined) updateData.is_active = body.is_active;

        // Hash password if provided
        if (body.password !== undefined && body.password !== '') {
          updateData.password_hash = await bcrypt.hash(body.password, 10);
        }

        return await conn
          .updateTable('users')
          .set(updateData)
          .where('id', '=', id)
          .returning(['id', 'name', 'username', 'email', 'role', 'phone', 'is_active', 'updated_at'])
          .executeTakeFirst();
      });

      if (result && 'errorType' in result && result.errorType === 'username_taken') {
        return reply.status(409).send({ error: 'El nombre de usuario ya está registrado en tu empresa' });
      }

      if (!result) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send(result);
    } catch (error: any) {
      if (error.message === 'Cannot change your own role') {
        return reply.status(400).send({ error: error.message });
      }
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
        if (user.role !== 'admin' && user.role !== 'owner') {
          return reply.code(403).send({ error: 'Only admins or owners can delete users' });
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

    await db.connection().execute(async (conn) => {
      await sql`SELECT set_config('app.current_business_id', ${currentUser.business_id}, true)`.execute(conn);

      await conn
        .updateTable('users')
        .set({
          deleted_at: new Date(),
          is_active: false
        })
        .where('id', '=', id)
        .execute();
    });

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

      const result = await db.connection().execute(async (conn) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(conn);

        // Get current user
        const currentUserData = await conn
          .selectFrom('users')
          .select(['password_hash'])
          .where('id', '=', user.sub)
          .executeTakeFirst();

        if (!currentUserData) {
          throw new Error('User not found');
        }

        // Verify current password
        if (!currentUserData.password_hash) {
          throw new Error('This user does not have a local password set');
        }
        const validPassword = await bcrypt.compare(body.current_password, currentUserData.password_hash);
        if (!validPassword) {
          throw new Error('Current password is incorrect');
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(body.new_password, 10);

        // Update password
        await conn
          .updateTable('users')
          .set({
            password_hash: newPasswordHash,
            updated_at: new Date()
          })
          .where('id', '=', user.sub)
          .execute();
        
        return { success: true };
      });

      return reply.send({ success: true, message: 'Password changed successfully' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      if (error.message === 'User not found') return reply.status(404).send({ error: error.message });
      if (error.message === 'Current password is incorrect') return reply.status(401).send({ error: error.message });
      if (error.message === 'This user does not have a local password set') return reply.status(400).send({ error: error.message });
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

    const profile = await db.connection().execute(async (conn) => {
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(conn);

      return await conn
        .selectFrom('users')
        .select(['id', 'name', 'username', 'email', 'role', 'phone', 'is_active', 'created_at'])
        .where('id', '=', user.sub)
        .executeTakeFirst();
    });

    return reply.send(profile);
  });

  // --- INVITATIONS SYSTEM ---

  // LIST INVITATIONS
  fastify.get('/invitations', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin' && user.role !== 'owner') {
          return reply.code(403).send({ error: 'Only admins or owners can list invitations' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    
    const invitations = await db.connection().execute(async (conn) => {
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(conn);

      return await conn
        .selectFrom('user_invitations')
        .selectAll()
        .where('accepted_at', 'is', null)
        .where('expires_at', '>', new Date())
        .orderBy('created_at', 'desc')
        .execute();
    });

    return reply.send(invitations);
  });

  // CREATE INVITATION
  fastify.post('/invitations', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin' && user.role !== 'owner') {
          return reply.code(403).send({ error: 'Only admins or owners can invite users' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const schema = z.object({
      email: z.string().email(),
      role: z.enum(['admin', 'employee', 'finance', 'delivery', 'viewer'])
    });

    try {
      const body = schema.parse(request.body);
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      // Check user limit
      const canInvite = await checkUserLimit(user.business_id, reply);
      if (!canInvite) return;

      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const result = await db
        .insertInto('user_invitations')
        .values({
          id: randomUUID(),
          business_id: user.business_id,
          email: body.email,
          role: body.role,
          token,
          invited_by: user.sub,
          expires_at: expiresAt,
          created_at: new Date()
        })
        .returningAll()
        .executeTakeFirst();

      // Send email
      const inviteLink = `${config.frontendUrl}/accept-invitation?token=${token}`;
      
      // Get business name for the email
      const business = await db.selectFrom('businesses').select('name').where('id', '=', user.business_id).executeTakeFirst();
      
      await emailService.sendInvitationEmail(body.email, business?.name || 'Tu Florería', inviteLink);

      return reply.status(201).send({
        ...result,
        invite_link: inviteLink
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // REVOKE INVITATION
  fastify.delete('/invitations/:id', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin' && user.role !== 'owner') {
          return reply.code(403).send({ error: 'Only admins or owners can revoke invitations' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    await db
      .deleteFrom('user_invitations')
      .where('id', '=', id)
      .execute();

    return reply.send({ success: true });
  });

  // ACCEPT INVITATION (Public)
  fastify.post('/invitations/accept', async (request, reply) => {
    const schema = z.object({
      token: z.string(),
      name: z.string().min(2),
      username: z.string().min(3).optional(),
      password: z.string().min(6)
    });

    try {
      const body = schema.parse(request.body);

      // Find invitation
      const invitation = await db
        .selectFrom('user_invitations')
        .selectAll()
        .where('token', '=', body.token)
        .where('accepted_at', 'is', null)
        .where('expires_at', '>', new Date())
        .executeTakeFirst();

      if (!invitation) {
        return reply.status(404).send({ error: 'Invitation not found or expired' });
      }

      // check if username exists
      if (body.username) {
        const existingUsername = await db
          .selectFrom('users')
          .select('id')
          .where('username', '=', body.username)
          .where('deleted_at', 'is', null)
          .executeTakeFirst();
        
        if (existingUsername) {
          return reply.status(409).send({ error: 'Username already taken' });
        }
      }

      const passwordHash = await bcrypt.hash(body.password, 10);
      const userId = randomUUID();

      // Create user
      await db
        .insertInto('users')
        .values({
          id: userId,
          business_id: invitation.business_id,
          name: body.name,
          username: body.username || null,
          email: invitation.email,
          password_hash: passwordHash,
          role: invitation.role as any,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        })
        .execute();

      // Mark invitation as accepted
      await db
        .updateTable('user_invitations')
        .set({ accepted_at: new Date() })
        .where('id', '=', invitation.id)
        .execute();

      return reply.send({ success: true, message: 'Invitation accepted successfully' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // GET INVITATION DETAILS (Public)
  fastify.get('/invitations/accept', async (request, reply) => {
    const { token } = request.query as { token: string };

    if (!token) {
      return reply.status(400).send({ error: 'Token is required' });
    }

    const invitation = await db
      .selectFrom('user_invitations as i')
      .innerJoin('businesses as b', 'i.business_id', 'b.id')
      .select([
        'i.id',
        'i.email',
        'i.role',
        'i.expires_at',
        'i.accepted_at',
        'b.name as business_name'
      ])
      .where('i.token', '=', token)
      .executeTakeFirst();

    if (!invitation) {
      return reply.status(404).send({ error: 'Invitation not found' });
    }

    if (invitation.accepted_at) {
      return reply.status(400).send({ error: 'Invitation already accepted' });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return reply.status(400).send({ error: 'Invitation expired' });
    }

    return reply.send(invitation);
  });
};

export default usersRoutes;

