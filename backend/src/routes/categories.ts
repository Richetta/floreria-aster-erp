import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';

export const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  // Create category schema
  const createCategorySchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    parent_id: z.string().uuid().optional().nullable()
  });

  // LIST CATEGORIES
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

      const categories = await db
        .selectFrom('categories')
        .selectAll()
        .where('is_active', '=', true)
        .orderBy('name', 'asc')
        .execute();

      return reply.send(categories);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al obtener categorías' });
    }
  });

  // CREATE CATEGORY
  fastify.post('/', {
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
      const body = createCategorySchema.parse(request.body);

      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const result = await db
        .insertInto('categories')
        .values({
          id: randomUUID(),
          business_id: user.business_id,
          name: body.name,
          parent_id: body.parent_id || null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        } as any)
        .returningAll()
        .executeTakeFirst();

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Error de validación', details: error.errors });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al crear la categoría' });
    }
  });

  // DELETE CATEGORY (Soft delete or just de-activate)
  fastify.delete('/:id', {
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

    try {
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      await db
        .updateTable('categories')
        .set({ is_active: false, updated_at: new Date() })
        .where('id', '=', id)
        .execute();

      return reply.send({ success: true });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al eliminar la categoría' });
    }
  });

  // RENAME/UPDATE CATEGORY
  fastify.patch('/:id', {
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
    const schema = z.object({
      name: z.string().min(1, 'El nombre es obligatorio'),
      parent_id: z.string().uuid().optional().nullable()
    });

    try {
      const body = schema.parse(request.body);

      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const result = await db
        .updateTable('categories')
        .set({ 
          name: body.name,
          parent_id: body.parent_id !== undefined ? body.parent_id : undefined,
          updated_at: new Date() 
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      if (!result) {
        return reply.status(404).send({ error: 'Categoría no encontrada' });
      }

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Error de validación', details: error.errors });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al actualizar la categoría' });
    }
  });
};

export default categoriesRoutes;
