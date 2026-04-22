import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';

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

  // Google token schema - supports both legacy id_token flow and new auth-code flow
  const googleTokenSchema = z.object({
    credential: z.string().optional(),  // legacy: id_token direct
    code: z.string().optional(),        // new: authorization code flow
  }).refine(data => data.credential || data.code, {
    message: 'Either credential (id_token) or code (auth-code) is required'
  });

  // ============================================
  // TRADITIONAL EMAIL/PASSWORD LOGIN
  // ============================================
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);

      // Find user by email OR name
      const result = await db
        .selectFrom('users')
        .selectAll()
        .where((eb) => eb.or([
          eb('email', '=', body.email),
          eb('name', '=', body.email)
        ]))
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

      let googleId: string;
      let email: string;
      let name: string | undefined;
      let picture: string | undefined;
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let tokenExpiry: number | null = null;

      if (body.code) {
        // ── NEW FLOW: Authorization Code → exchange for tokens ──
        const { tokens } = await googleClient.getToken({
          code: body.code,
          redirect_uri: 'postmessage', // For auth-code flow from React
        });

        if (!tokens.id_token) {
          return reply.status(401).send({ error: 'Invalid Google token response' });
        }

        accessToken  = tokens.access_token || null;
        refreshToken = tokens.refresh_token || null;
        tokenExpiry  = tokens.expiry_date   || null;

        const ticket = await googleClient.verifyIdToken({
          idToken: tokens.id_token,
          audience: config.googleClientId,
        });

        const payload = ticket.getPayload();
        if (!payload) return reply.status(401).send({ error: 'Invalid Google payload' });

        googleId = payload.sub;
        email    = payload.email || '';
        name     = payload.name;
        picture  = payload.picture;

      } else {
        // ── LEGACY FLOW: id_token only (for users already logged in) ──
        const ticket = await googleClient.verifyIdToken({
          idToken: body.credential!,
          audience: config.googleClientId,
        });

        const payload = ticket.getPayload();
        if (!payload) return reply.status(401).send({ error: 'Invalid Google token' });

        googleId = payload.sub;
        email    = payload.email || '';
        name     = payload.name;
        picture  = payload.picture;
      }

      // STRICT: Only look up by Google ID
      let user: any = await db
        .selectFrom('users')
        .selectAll()
        .where('google_id' as any, '=', googleId)
        .executeTakeFirst();

      if (!user) {
        const existingByEmail = await db
          .selectFrom('users')
          .selectAll()
          .where('email', '=', email)
          .where('is_active', '=', true)
          .executeTakeFirst();

        if (existingByEmail && !(existingByEmail as any).google_id) {
          await db.updateTable('users')
            .set({ google_id: googleId, updated_at: new Date() } as any)
            .where('id', '=', existingByEmail.id)
            .execute();
          user = { ...existingByEmail, google_id: googleId };
        }
      }

      if (!user) {
        const newBusinessId = randomUUID();
        const businessName = name || email.split('@')[0];

        await db.insertInto('businesses')
          .values({
            id: newBusinessId,
            name: businessName,
            currency: 'ARS',
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .execute();

        const DEFAULT_CATEGORIES = ['Ramos', 'Flores', 'Macetas', 'Regalería', 'Plantas Interior', 'Plantas Exterior', 'Tierra', 'Insumos'];
        for (const catName of DEFAULT_CATEGORIES) {
          await db.insertInto('categories')
            .values({
              id: randomUUID(),
              business_id: newBusinessId,
              name: catName,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            } as any)
            .execute();
        }

        user = await db
          .insertInto('users')
          .values({
            id: randomUUID(),
            business_id: newBusinessId,
            name: name || email.split('@')[0],
            email: email,
            google_id: googleId,
            role: 'admin',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .returningAll()
          .executeTakeFirst();
      }

      // Update last login and save Google tokens if we have them (auth-code flow)
      const updateData: any = { last_login: new Date() };
      if (refreshToken) {
        updateData.google_access_token  = accessToken;
        updateData.google_refresh_token = refreshToken;
        updateData.google_token_expiry  = tokenExpiry;
        // Auto-enable Calendar if user connected with Calendar scope
        updateData.google_calendar_enabled = true;
      }

      await db.updateTable('users')
        .set(updateData)
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
          picture,
          google_calendar_connected: !!refreshToken,
        }
      });
    } catch (error: any) {
      fastify.log.error({ error }, 'Google OAuth error');

      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }

      const isDev = config.nodeEnv === 'development';
      return reply.status(500).send({ 
        error: 'Google authentication failed',
        message: isDev ? error.message : undefined,
        stack: isDev ? error.stack : undefined
      });
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
        const existingByEmail = await db
          .selectFrom('users')
          .selectAll()
          .where('email', '=', email)
          .where('is_active', '=', true)
          .executeTakeFirst();

        if (existingByEmail && !(existingByEmail as any).google_id) {
          // Link existing email/password user to this Google account
          await db.updateTable('users')
            .set({ google_id: googleId, updated_at: new Date() } as any)
            .where('id', '=', existingByEmail.id)
            .execute();
          user = { ...existingByEmail, google_id: googleId };
        }
        // Different google_id on same email → create new isolated business (fall through)
      }

      if (!user) {
        // 1. Create a new unique business for this user
        const newBusinessId = randomUUID();
        const businessName = name || email.split('@')[0];
        
        await db.insertInto('businesses')
          .values({
            id: newBusinessId,
            name: businessName,
            currency: 'ARS',
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .execute();

        // 2. Seed default categories for the new business
        const DEFAULT_CATEGORIES = ['Ramos', 'Flores', 'Macetas', 'Regalería', 'Plantas Interior', 'Plantas Exterior', 'Tierra', 'Insumos'];
        for (const catName of DEFAULT_CATEGORIES) {
          await db.insertInto('categories')
            .values({
              id: randomUUID(),
              business_id: newBusinessId,
              name: catName,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            } as any)
            .execute();
        }

        // 3. Create the user assigned to the new business
        user = await db
          .insertInto('users')
          .values({
            id: randomUUID(),
            business_id: newBusinessId,
            name: name || email.split('@')[0],
            email: email,
            google_id: googleId,
            role: 'admin', // First user of a business is admin
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
      const isDev = config.nodeEnv === 'development';
      const errorMessage = isDev ? encodeURIComponent(error.message) : 'Authentication%20failed';
      return reply.redirect(`/login?error=${errorMessage}`);
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

    reply.send({
      id: result.id,
      name: result.name,
      email: result.email,
      role: result.role,
      business_id: result.business_id,
      phone: result.phone
    });
  });
};

export default authRoutes;
