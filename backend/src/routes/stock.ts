import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';

export const stockRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================
  // GET STOCK MOVEMENTS
  // ============================================

  fastify.get('/movements', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { product_id, from_date, to_date, type, limit = '100' } = request.query as any;

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    let query: any = db
      .selectFrom('stock_movements')
      .innerJoin('products', 'products.id', 'stock_movements.product_id')
      .select([
        'stock_movements.id',
        'stock_movements.product_id',
        'stock_movements.movement_type',
        'stock_movements.quantity',
        'stock_movements.balance_after',
        'stock_movements.reference_type',
        'stock_movements.reference_id',
        'stock_movements.notes',
        'stock_movements.created_at',
        'products.name as product_name',
        'products.code as product_code'
      ])
      .where('stock_movements.deleted_at' as any, 'is', null)
      .orderBy('stock_movements.created_at', 'desc');

    if (product_id) {
      query = query.where('stock_movements.product_id', '=', product_id);
    }

    if (from_date) {
      query = query.where('stock_movements.created_at', '>=', new Date(from_date));
    }

    if (to_date) {
      query = query.where('stock_movements.created_at', '<=', new Date(to_date));
    }

    if (type) {
      query = query.where('stock_movements.movement_type', '=', type);
    }

    const movements = await query.limit(parseInt(limit)).execute();

    return reply.send(movements.map((m: any) => ({
      id: m.id,
      product_id: m.product_id,
      product_name: m.product_name,
      product_code: m.product_code,
      movement_type: m.movement_type,
      quantity: Number(m.quantity),
      balance_after: Number(m.balance_after),
      reference_type: m.reference_type,
      reference_id: m.reference_id,
      notes: m.notes,
      created_at: m.created_at
    })));
  });

  // ============================================
  // GET PRODUCT STOCK HISTORY
  // ============================================

  fastify.get('/product/:id/history', {
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
    const { limit = '50' } = request.query as any;

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const product = await db
      .selectFrom('products')
      .select(['id', 'name', 'code', 'stock_quantity', 'min_stock'])
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!product) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    const movements = await db
      .selectFrom('stock_movements')
      .select([
        'movement_type',
        'quantity',
        'balance_after',
        'reference_type',
        'reference_id',
        'notes',
        'created_at'
      ])
      .where('product_id', '=', id)
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .execute();

    const summary = {
      current_stock: Number(product.stock_quantity),
      min_stock: Number(product.min_stock),
      total_movements: movements.length,
      last_movement: movements.length > 0 ? movements[0].created_at : null,
      by_type: {} as { [key: string]: number }
    };

    movements.forEach(m => {
      const type = m.movement_type;
      summary.by_type[type] = (summary.by_type[type] || 0) + 1;
    });

    return reply.send({
      product: {
        id: product.id,
        name: product.name,
        code: product.code,
        current_stock: summary.current_stock,
        min_stock: summary.min_stock
      },
      summary,
      movements: movements.map(m => ({
        movement_type: m.movement_type,
        quantity: Number(m.quantity),
        balance_after: Number(m.balance_after),
        reference_type: m.reference_type,
        notes: m.notes,
        created_at: m.created_at
      }))
    });
  });

  // ============================================
  // GET LOW STOCK PRODUCTS
  // ============================================

  fastify.get('/low-stock', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const products = await db
      .selectFrom('products')
      .select([
        'id',
        'name',
        'code',
        'stock_quantity',
        'min_stock',
        'category_id',
        'price'
      ])
      .where('deleted_at', 'is', null)
      .whereRef('stock_quantity' as any, '<=', 'min_stock' as any)
      .orderBy('stock_quantity', 'asc')
      .execute();

    return reply.send(products.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      stock_quantity: Number(p.stock_quantity),
      min_stock: Number(p.min_stock),
      shortage: Number(p.min_stock) - Number(p.stock_quantity),
      category_id: p.category_id,
      price: Number(p.price)
    })));
  });

  // ============================================
  // CREATE STOCK ADJUSTMENT
  // ============================================

  fastify.post('/adjustment', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin') {
          return reply.code(403).send({ error: 'Only admins can create adjustments' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    const schema = z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int(),
      reason: z.string(),
      notes: z.string().optional()
    });

    try {
      const body = schema.parse(request.body);

      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const product = await db
        .selectFrom('products')
        .select(['stock_quantity', 'name'])
        .where('id', '=', body.product_id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      const newStock = Number(product.stock_quantity) + body.quantity;

      if (newStock < 0) {
        return reply.status(400).send({ error: 'Invalid adjustment: would result in negative stock' });
      }

      const result = await db.transaction().execute(async (trx) => {
        await trx
          .updateTable('products')
          .set({
            stock_quantity: newStock,
            updated_at: new Date()
          })
          .where('id', '=', body.product_id)
          .execute();

        const movement = await trx
          .insertInto('stock_movements')
          .values({
            id: crypto.randomUUID(),
            business_id: user.business_id,
            product_id: body.product_id,
            movement_type: 'adjustment',
            quantity: body.quantity,
            balance_after: newStock,
            reference_type: 'manual',
            reference_id: '00000000-0000-0000-0000-000000000000',
            user_id: user.sub,
            notes: body.reason + (body.notes ? ` - ${body.notes}` : ''),
            created_at: new Date(),
            metadata: {}
          } as any)
          .returningAll()
          .executeTakeFirst();

        return movement;
      });

      return reply.send({
        success: true,
        movement: result,
        new_stock: newStock
      });
    } catch (error: any) {
      console.error('Error creating adjustment:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Error creating adjustment' });
    }
  });

  // ============================================
  // GET STOCK SUMMARY
  // ============================================

  fastify.get('/summary', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const totals = await db
      .selectFrom('products')
      .select([
        db.fn.count('id').as('total_products'),
        db.fn.sum('stock_quantity').as('total_stock'),
        db.fn.sum(sql`stock_quantity * cost`).as('total_value_cost'),
        db.fn.sum(sql`stock_quantity * price`).as('total_value_price')
      ])
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    const lowStockCount = await db
      .selectFrom('products')
      .select(db.fn.count('id').as('count'))
      .where('deleted_at', 'is', null)
      .whereRef('stock_quantity' as any, '<=', 'min_stock' as any)
      .executeTakeFirst();

    const outOfStockCount = await db
      .selectFrom('products')
      .select(db.fn.count('id').as('count'))
      .where('deleted_at', 'is', null)
      .where('stock_quantity', '=', 0)
      .executeTakeFirst();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const movementsToday = await db
      .selectFrom('stock_movements')
      .select(db.fn.count('id').as('count'))
      .where('created_at', '>=', today)
      .executeTakeFirst();

    return reply.send({
      total_products: Number(totals?.total_products) || 0,
      total_stock: Number(totals?.total_stock) || 0,
      total_value_at_cost: Number(totals?.total_value_cost) || 0,
      total_value_at_price: Number(totals?.total_value_price) || 0,
      low_stock_count: Number(lowStockCount?.count) || 0,
      out_of_stock_count: Number(outOfStockCount?.count) || 0,
      movements_today: Number(movementsToday?.count) || 0
    });
  });
};

export default stockRoutes;

