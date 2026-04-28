import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';

export const customFiltersRoutes: FastifyPluginAsync = async (fastify) => {
  
  // Schemas
  const createFilterSchema = z.object({
    name: z.string().min(1).max(255)
  });

  const createOptionSchema = z.object({
    value: z.string().min(1).max(255)
  });

  // GET ALL FILTERS AND OPTIONS
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
      const result = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        // Fetch filters
        const filters = await trx
          .selectFrom('custom_filters')
          .selectAll()
          .where('business_id', '=', user.business_id)
          .orderBy('created_at', 'asc')
          .execute();

        // Fetch options
        const options = await trx
          .selectFrom('custom_filter_options')
          .selectAll()
          .where('business_id', '=', user.business_id)
          .orderBy('created_at', 'asc')
          .execute();

        // Group options by filter_id
        return filters.map(f => ({
          ...f,
          options: options.filter(o => o.custom_filter_id === f.id)
        }));
      });

      return reply.send(result);
    } catch (error: any) {
      console.error('Error fetching custom filters:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: error.message });
    }
  });

  // CREATE A FILTER
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
      const body = createFilterSchema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        // Count existing filters
        const countResult = await trx
          .selectFrom('custom_filters')
          .select(trx.fn.count('id').as('count'))
          .where('business_id', '=', user.business_id)
          .executeTakeFirst();

        const currentCount = Number(countResult?.count || 0);

        if (currentCount >= 10) {
          throw new Error('Has alcanzado el límite máximo de 10 filtros personalizados.');
        }

        const newFilter = {
          id: randomUUID(),
          business_id: user.business_id,
          name: body.name,
          created_at: new Date(),
          updated_at: new Date()
        };

        await trx.insertInto('custom_filters').values(newFilter).execute();
        return newFilter;
      });

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      if (error.message.includes('límite máximo')) {
        return reply.status(400).send({ error: 'Limit reached', message: error.message });
      }
      console.error('Error creating custom filter:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: error.message });
    }
  });

  // ADD OPTION TO FILTER
  fastify.post('/:id/options', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { id: filterId } = request.params as any;

    try {
      const body = createOptionSchema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        // Verify filter belongs to tenant
        const filter = await trx
          .selectFrom('custom_filters')
          .select('id')
          .where('id', '=', filterId)
          .where('business_id', '=', user.business_id)
          .executeTakeFirst();

        if (!filter) {
          throw new Error('Filtro no encontrado.');
        }

        const newOption = {
          id: randomUUID(),
          business_id: user.business_id,
          custom_filter_id: filterId,
          value: body.value,
          created_at: new Date()
        };

        await trx.insertInto('custom_filter_options').values(newOption).execute();
        return newOption;
      });

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      if (error.message.includes('no encontrado')) {
        return reply.status(404).send({ error: 'Not found', message: error.message });
      }
      console.error('Error creating filter option:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: error.message });
    }
  });
};

export default customFiltersRoutes;
