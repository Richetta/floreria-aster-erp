import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';

export const liveCartRoutes: FastifyPluginAsync = async (fastify) => {
  // Schema for updating cart
  const updateCartSchema = z.object({
    cart_data: z.array(z.any())
  });

  // GET LIVE CART
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
    const userId = user.sub || user.id;

    try {
      const liveCart = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        return await trx
          .selectFrom('live_cart')
          .select(['cart_data', 'updated_at'])
          .where('business_id', '=', user.business_id)
          .where('user_id', '=', userId)
          .executeTakeFirst();
      });

      if (!liveCart) {
        return reply.send({ cart_data: [], updated_at: null });
      }

      // cart_data might be stored as string or JSON depending on driver
      const cartData = typeof liveCart.cart_data === 'string' 
        ? JSON.parse(liveCart.cart_data) 
        : liveCart.cart_data;

      return reply.send({ cart_data: cartData, updated_at: liveCart.updated_at });
    } catch (error: any) {
      console.error('Error fetching live cart:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: error.message });
    }
  });

  // UPDATE LIVE CART
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
    const userId = user.sub || user.id;

    try {
      const body = updateCartSchema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        const existing = await trx
          .selectFrom('live_cart')
          .select('id')
          .where('business_id', '=', user.business_id)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (existing) {
          await trx
            .updateTable('live_cart')
            .set({
              cart_data: JSON.stringify(body.cart_data) as any,
              updated_at: new Date()
            })
            .where('id', '=', existing.id)
            .execute();
        } else {
          await trx
            .insertInto('live_cart')
            .values({
              id: randomUUID(),
              business_id: user.business_id,
              user_id: userId,
              cart_data: JSON.stringify(body.cart_data) as any,
              updated_at: new Date()
            } as any)
            .execute();
        }

        return { success: true };
      });

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Error updating live cart:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: error.message });
    }
  });
};

export default liveCartRoutes;
