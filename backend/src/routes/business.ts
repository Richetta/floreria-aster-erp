import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';

export const businessRoutes: FastifyPluginAsync = async (fastify) => {
  // GET BUSINESS INFO
  fastify.get('/', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    try {
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const business = await db
        .selectFrom('businesses')
        .selectAll()
        .where('id', '=', user.business_id)
        .executeTakeFirst();

      if (!business) {
        return reply.status(404).send({ error: 'Business not found' });
      }

      // Also fetch extra settings from app_settings
      const settings = await db
        .selectFrom('app_settings')
        .selectAll()
        .where('business_id', '=', user.business_id)
        .execute();

      const settingsMap = settings.reduce((acc: any, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {});

      return reply.send({
        ...business,
        settings: settingsMap
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al obtener información del negocio' });
    }
  });

  // UPDATE BUSINESS INFO
  fastify.put('/', {
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
      name: z.string().min(1).optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      logo_url: z.string().url().optional().nullable(),
      currency: z.string().optional(),
      settings: z.record(z.any()).optional()
    });

    try {
      const body = schema.parse(request.body);

      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      // Update basic info
      const updateData: any = {
        updated_at: new Date()
      };
      if (body.name) updateData.name = body.name;
      if (body.address) updateData.address = body.address;
      if (body.phone) updateData.phone = body.phone;
      if (body.email) updateData.email = body.email;
      if (body.logo_url !== undefined) updateData.logo_url = body.logo_url;
      if (body.currency) updateData.currency = body.currency;

      const result = await db
        .updateTable('businesses')
        .set(updateData)
        .where('id', '=', user.business_id)
        .returningAll()
        .executeTakeFirst();

      // Update extra settings if provided
      if (body.settings) {
        for (const [key, value] of Object.entries(body.settings)) {
          // Upsert setting
          await sql`
            INSERT INTO app_settings (id, business_id, key, value, updated_at)
            VALUES (${randomUUID()}, ${user.business_id}, ${key}, ${JSON.stringify(value)}::jsonb, now())
            ON CONFLICT (business_id, key) DO UPDATE
            SET value = EXCLUDED.value, updated_at = now()
          `.execute(db);
        }
      }

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Error de validación', details: error.errors });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al actualizar información del negocio' });
    }
  });
};

export default businessRoutes;
