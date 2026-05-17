import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { sql } from 'kysely';
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

  /**
   * Asegura que una cuenta tenga el usuario administrador por defecto "Jefe"
   */
  async function ensureDefaultAdmin(businessId: string) {
    try {
      console.log(`[AUTH] Ensuring 'Jefe' exists for business: ${businessId}`);
      await db.connection().execute(async (conn) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(businessId)) {
          throw new Error('Invalid business ID format');
        }
        // Establecer el contexto de RLS para esta conexión con raw SQL para evitar PgBouncer $1 errors
        await sql`SELECT set_config('app.current_business_id', ${sql.raw(`'${businessId}'`)}, true)`.execute(conn);

        // Buscar si ya existe un usuario administrador (por username o nombre)
        const adminUser = await conn
          .selectFrom('users')
          .selectAll()
          .where('business_id', '=', businessId)
          .where((eb) => eb.or([
            eb('username', '=', 'admin'),
            eb('name', '=', 'Jefe'),
            eb('name', '=', 'Administrador'),
            eb('name', '=', '01 (Administrador)')
          ]))
          .executeTakeFirst() as any;

        if (adminUser) {
          // Si existe pero tiene el nombre viejo, lo actualizamos a "Jefe"
          if (adminUser.name !== 'Jefe') {
            console.log(`[AUTH] Renaming existing admin to 'Jefe' for business: ${businessId}`);
            await conn.updateTable('users')
              .set({ name: 'Jefe', updated_at: new Date() })
              .where('id', '=', adminUser.id)
              .execute();
          }
        } else {
          // No existe ningún admin, lo creamos
          console.log(`[AUTH] Creating NEW 'Jefe' for business: ${businessId}`);
          const passwordHash = await bcrypt.hash('admin', 10);
          await conn.insertInto('users')
            .values({
              id: randomUUID(),
              business_id: businessId,
              name: 'Jefe',
              username: 'admin',
              email: `admin@${businessId.substring(0, 8)}.local`,
              password_hash: passwordHash,
              role: 'admin',
              is_active: true,
              deleted_at: null,
              created_at: new Date(),
              updated_at: new Date()
            } as any)
            .execute();
        }
      });
      console.log(`[AUTH] 'Jefe' check completed for business: ${businessId}`);
    } catch (err) {
      console.error(`[AUTH] Failed to ensure default admin for ${businessId}:`, err);
    }
  }

  // Login schema
  const loginSchema = z.object({
    email: z.string(),
    password: z.string().min(1)
  });

  // Google token schema removed to simplify debugging

  // ============================================
  // TRADITIONAL EMAIL/PASSWORD LOGIN
  // ============================================
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);

      // Find user by email OR name
      const users: any[] = await db
        .selectFrom('users')
        .selectAll()
        .where((eb) => eb.or([
          eb('email', '=', body.email),
          eb('username', '=', body.email)
        ]))
        .execute();

      if (users.length === 0) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      let authenticatedUser = null;

      for (const result of users) {
        // Verify password
        let validPassword = result.password_hash
          ? await bcrypt.compare(body.password, result.password_hash)
          : false;

        // EMERGENCY FALLBACK: If user is typing 'amdin' (with M) instead of 'admin'
        if (!validPassword && result.username === 'admin' && body.password === 'amdin') {
            validPassword = await bcrypt.compare('admin', result.password_hash);
        }

        if (validPassword) {
          if (!result.is_active) {
            return reply.status(403).send({ error: 'Account is inactive' });
          }
          authenticatedUser = result;
          break;
        }
      }

      if (!authenticatedUser) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const result = authenticatedUser;

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
  fastify.post('/google', async (request: any, reply) => {
    try {
      let requestBody = request.body;

      // Handle cases where body might be a string due to proxy issues
      if (typeof requestBody === 'string') {
        try {
          requestBody = JSON.parse(requestBody);
        } catch (e) {
          fastify.log.warn('Failed to parse string body as JSON in /google');
        }
      }

      console.log('[DEBUG AUTH] Body received:', requestBody);

      if (!requestBody || typeof requestBody !== 'object') {
        console.log('[DEBUG AUTH] Error: Invalid body type');
        return reply.status(400).send({ 
          error: 'Validation error', 
          message: 'El cuerpo de la petición no es válido o está vacío',
          received: typeof requestBody
        });
      }

      // Manual validation instead of Zod to avoid "Required" issues
      const body = requestBody as any;
      const code = body.code;
      const credential = body.credential;

      if (!code && !credential) {
        console.log('[DEBUG AUTH] Error: Missing both code and credential');
        return reply.status(400).send({ 
          error: 'Validation error', 
          message: 'Se requiere code o credential para iniciar sesión',
          receivedBody: requestBody 
        });
      }

      let googleId: string;
      let email: string;
      let name: string | undefined;
      let picture: string | undefined;
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let tokenExpiry: number | null = null;

      if (body.code) {
        // ── NEW FLOW: Authorization Code → exchange for tokens ──
        // Use a SEPARATE client with redirect_uri='postmessage' (popup flow)
        // The main googleClient uses the server callback URI — can't share
        const popupClient = new OAuth2Client(
          config.googleClientId,
          config.googleClientSecret,
          'postmessage'  // special value for SPA popup flow
        );
        const { tokens } = await popupClient.getToken(body.code);

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
        .where('google_id', '=', googleId)
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
            .set({ google_id: googleId, updated_at: new Date() })
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
            role: 'owner',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .returningAll()
          .executeTakeFirst();
      }

      if (user && user.business_id) {
        console.log(`[AUTH] Google login successful for ${email}, business: ${user.business_id}`);
        await ensureDefaultAdmin(user.business_id);
      }


      // EMERGENCY: Ensure every user logging in with Google is an OWNER
      // This satisfies the requirement that Google logins are admins by default.
      if (user && user.role !== 'owner') {
        await db.updateTable('users')
          .set({ role: 'owner', updated_at: new Date() })
          .where('id', '=', user.id)
          .execute();
        user.role = 'owner';
      }

      // Update last login and save Google tokens if we have them (auth-code flow)
      const updateData: any = { last_login: new Date() };
      if (refreshToken) {
        updateData.google_access_token  = accessToken;
        updateData.google_refresh_token = refreshToken;
        updateData.google_token_expiry  = tokenExpiry;
        // Auto-enable Calendar if user connected with Calendar scope
        updateData.google_calendar_enabled = true;
        console.log('[GCal Auth] ✅ refresh_token received and saved for user:', user.email);
      } else {
        console.log('[GCal Auth] ⚠ NO refresh_token received for user:', user.email, '— Calendar sync will NOT work');
        console.log('[GCal Auth]   tokens received:', { 
          has_access_token: !!accessToken, 
          has_refresh_token: !!refreshToken,
          has_id_token: true 
        });
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
        return reply.status(400).send({ 
          error: 'Validation error', 
          message: 'Error de validación de datos de Google',
          details: error.errors 
        });
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
        .where('google_id', '=', googleId)
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
            .set({ google_id: googleId, updated_at: new Date() })
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
            role: 'owner', // First user of a business is owner
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .returningAll()
          .executeTakeFirst();
      }

      if (user && user.business_id) {
        await ensureDefaultAdmin(user.business_id);
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
    console.log('[AUTH DEBUG] /me request from token:', { sub: user.sub, business_id: user.business_id, role: user.role });

    if (user.business_id) {
      await ensureDefaultAdmin(user.business_id);
    }

    const result = await db.transaction().execute(async (trx) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(user.business_id)) {
        throw new Error('Invalid business ID format');
      }
      // CRITICAL: Set RLS context before querying /me using raw SQL to avoid PgBouncer $1 errors
      console.log(`[AUTH DEBUG] /me: Setting RLS context to ${user.business_id} for user ${user.sub}`);
      await sql`SELECT set_config('app.current_business_id', ${sql.raw(`'${user.business_id}'`)}, true)`.execute(trx);

      return await trx
        .selectFrom('users')
        .select(['id', 'name', 'email', 'role', 'business_id', 'phone', 'google_id' as any])
        .where('id', '=', user.sub)
        .executeTakeFirst();
    });

    if (!result) {
      console.error('[AUTH DEBUG] /me ❌ User not found in database for ID:', user.sub);
      return reply.status(404).send({ error: 'User not found' });
    }

    console.log('[AUTH DEBUG] /me ✅ Found user:', result.email, 'Role:', result.role);

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
