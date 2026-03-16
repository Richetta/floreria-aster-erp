import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db';
import { randomUUID } from 'crypto';
import { config } from '../config';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize Google OAuth client
  const googleClient = new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );

  // Login schema
  const loginSchema = z.object({
    email: z.string(),
    password: z.string().min(1)
  });

  // Google token schema
  const googleTokenSchema = z.object({
    credential: z.string()
  });

  // ============================================
  // TRADITIONAL EMAIL/PASSWORD LOGIN
  // ============================================
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);

      // Find user by email
      const result = await db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', body.email)
        .where('is_active', '=', true)
        .executeTakeFirst();

      if (!result) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Check if this is a Google user trying password login
      if (result.google_id && !result.password_hash) {
        return reply.status(401).send({
          error: 'This account is linked to Google. Please use Google Sign-In.'
        });
      }

      // Verify password
      const validPassword = result.password_hash
        ? await bcrypt.compare(body.password, result.password_hash)
        : false;

      if (!validPassword) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Generate JWT
      const token = fastify.jwt.sign({
        sub: result.id,
        business_id: result.business_id,
        role: result.role,
        email: result.email
      });

      // Update last login
      await db.updateTable('users')
        .set({ last_login: new Date() })
        .where('id', '=', result.id)
        .execute();

      return reply.send({
        token,
        user: {
          id: result.id,
          name: result.name,
          email: result.email,
          role: result.role,
          business_id: result.business_id
        }
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // ============================================
  // GOOGLE OAuth LOGIN
  // ============================================
  fastify.post('/google', async (request, reply) => {
    try {
      const body = googleTokenSchema.parse(request.body);

      // Verify Google token
      const ticket = await googleClient.verifyIdToken({
        idToken: body.credential,
        audience: config.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        return reply.status(401).send({ error: 'Invalid Google token' });
      }

      const googleId = payload.sub;
      const email = payload.email || '';
      const name = payload.name;
      const picture = payload.picture;

      // Check if user exists by Google ID
      let user: any = await db
        .selectFrom('users')
        .selectAll()
        .where('google_id' as any, '=', googleId)
        .executeTakeFirst();

      // If not found by Google ID, check by email
      if (!user) {
        user = await db
          .selectFrom('users')
          .selectAll()
          .where('email', '=', email)
          .where('is_active', '=', true)
          .executeTakeFirst();
      }

      // Create user if doesn't exist
      if (!user) {
        user = await db
          .insertInto('users')
          .values({
            id: crypto.randomUUID(),
            business_id: config.defaultBusinessId,
            name: name || email.split('@')[0],
            email: email,
            google_id: googleId,
            role: 'viewer',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .returningAll()
          .executeTakeFirst();
      }

      // Update last login
      await db.updateTable('users')
        .set({ last_login: new Date() })
        .where('id', '=', user.id)
        .execute();

      // Generate JWT
      const token = fastify.jwt.sign({
        sub: user.id,
        business_id: user.business_id,
        role: user.role,
        email: user.email,
        google_id: user.google_id
      });

      return reply.send({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          business_id: user.business_id,
          google_id: user.google_id,
          picture
        }
      });
    } catch (error: any) {
      fastify.log.error({ error }, 'Google OAuth error');

      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }

      return reply.status(500).send({ error: 'Google authentication failed' });
    }
  });

  // ============================================
  // GOOGLE OAuth CALLBACK
  // ============================================
  fastify.get('/google/callback', async (request, reply) => {
    try {
      const { code } = request.query as { code: string };

      if (!code) {
        return reply.redirect('/login?error=No%20authorization%20code');
      }

      const { tokens } = await googleClient.getToken(code);

      if (!tokens.id_token) {
        return reply.redirect('/login?error=Invalid%20token');
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        return reply.redirect('/login?error=Invalid%20payload');
      }

      const googleId = payload.sub;
      const email = payload.email || '';
      const name = payload.name;

      let user: any = await db
        .selectFrom('users')
        .selectAll()
        .where('google_id' as any, '=', googleId)
        .executeTakeFirst();

      if (!user) {
        user = await db
          .selectFrom('users')
          .selectAll()
          .where('email', '=', email)
          .where('is_active', '=', true)
          .executeTakeFirst();
      }

      if (!user) {
        user = await db
          .insertInto('users')
          .values({
            id: crypto.randomUUID(),
            business_id: config.defaultBusinessId,
            name: name || email.split('@')[0],
            email: email,
            google_id: googleId,
            role: 'viewer',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .returningAll()
          .executeTakeFirst();
      }

      const token = fastify.jwt.sign({
        sub: user.id,
        business_id: user.business_id,
        role: user.role,
        email: user.email
      });

      const frontendUrl = config.frontendUrl;
      return reply.redirect(`${frontendUrl}/login?token=${token}`);
    } catch (error: any) {
      fastify.log.error({ error }, 'Google callback error');
      return reply.redirect('/login?error=Authentication%20failed');
    }
  });

  // ============================================
  // GET CURRENT USER
  // ============================================
  fastify.get('/me', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    const result: any = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'role', 'business_id', 'phone', 'google_id' as any])
      .where('id', '=', user.sub)
      .executeTakeFirst();

    if (!result) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(result);
  });
};

export default authRoutes;
