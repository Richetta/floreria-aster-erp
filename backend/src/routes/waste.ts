import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';

export const wasteRoutes: FastifyPluginAsync = async (fastify) => {
  // Create waste report schema
  const createWasteSchema = z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    reason: z.enum([
      'Deterioro natural',
      'Rotura de proveedor',
      'Rotura en local',
      'Vencimiento',
      'Robo/Extravío',
      'Otro'
    ]),
    notes: z.string().optional()
  });

  // LIST WASTE REPORTS
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

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const { 
      from_date, 
      to_date, 
      reason,
      product_id,
      limit = '100' 
    } = request.query as any;

    let query = db
      .selectFrom('waste_logs')
      .selectAll()
      .where('deleted_at', 'is', null);

    // Filters
    if (from_date) {
      query = query.where('created_at', '>=', new Date(from_date));
    }

    if (to_date) {
      query = query.where('created_at', '<=', new Date(to_date));
    }

    if (reason) {
      query = query.where('reason', '=', reason);
    }

    if (product_id) {
      query = query.where('product_id', '=', product_id);
    }

    const wasteLogs = await query
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .execute();

    return reply.send(wasteLogs);
  });

  // GET WASTE SUMMARY (For analytics)
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
    const { from_date, to_date } = request.query as { from_date?: string, to_date?: string };

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    // Get waste logs with product info
    let query = db
      .selectFrom('waste_logs')
      .innerJoin('products', 'products.id', 'waste_logs.product_id')
      .select([
        'waste_logs.id',
        'waste_logs.product_id',
        'waste_logs.quantity',
        'waste_logs.reason',
        'waste_logs.created_at',
        'products.name as product_name',
        'products.price as unit_price',
        'products.category_id'
      ])
      .where('waste_logs.deleted_at', 'is', null);

    if (from_date) {
      query = query.where('waste_logs.created_at', '>=', new Date(from_date));
    }

    if (to_date) {
      query = query.where('waste_logs.created_at', '<=', new Date(to_date));
    }

    const wasteLogs = await query
      .orderBy('waste_logs.created_at', 'desc')
      .limit(200)
      .execute();

    // Calculate totals
    const totalLoss = wasteLogs.reduce((sum, log) => {
      return sum + (Number(log.unit_price) * log.quantity);
    }, 0);

    // Group by reason
    const byReason = wasteLogs.reduce((acc, log) => {
      const loss = Number(log.unit_price) * log.quantity;
      acc[log.reason] = (acc[log.reason] || 0) + loss;
      return acc;
    }, {} as Record<string, number>);

    // Group by product (top losers)
    const byProduct = wasteLogs.reduce((acc, log) => {
      const loss = Number(log.unit_price) * log.quantity;
      if (!acc[log.product_id]) {
        acc[log.product_id] = {
          product_id: log.product_id,
          product_name: log.product_name,
          total_amount: 0,
          count: 0
        };
      }
      acc[log.product_id].total_amount += loss;
      acc[log.product_id].count += 1;
      return acc;
    }, {} as Record<string, { product_id: string, product_name: string, total_amount: number, count: number }>);

    // Sort and get top 5
    const topProducts = Object.values(byProduct)
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 5);

    // Group by date (for chart)
    const byDate = wasteLogs.reduce((acc, log) => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      const loss = Number(log.unit_price) * log.quantity;
      acc[date] = (acc[date] || 0) + loss;
      return acc;
    }, {} as Record<string, number>);

    return reply.send({
      total_loss: totalLoss,
      by_reason: byReason,
      top_products: topProducts,
      by_date: byDate,
      logs: wasteLogs
    });
  });

  // CREATE WASTE REPORT
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
      const body = createWasteSchema.parse(request.body);

      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const result = await db.transaction().execute(async (trx) => {
        // Get current product
        const product = await trx
          .selectFrom('products')
          .select(['stock_quantity', 'name', 'price', 'cost'])
          .where('id', '=', body.product_id)
          .forUpdate()
          .executeTakeFirst();

        if (!product) {
          throw new Error('Producto no encontrado');
        }

        if (Number(product.stock_quantity) < body.quantity) {
          throw new Error(`Stock insuficiente: hay ${product.stock_quantity}, se quieren dar de baja ${body.quantity}`);
        }

        // Update stock
        const newStock = Number(product.stock_quantity) - body.quantity;
        await trx
          .updateTable('products')
          .set({
            stock_quantity: newStock,
            updated_at: new Date()
          })
          .where('id', '=', body.product_id)
          .execute();

        // Calculate loss value (use cost, not price)
        const lossValue = Number(product.cost) * body.quantity;

        // Create waste log
        const wasteLog = await trx
          .insertInto('waste_logs')
          .values({
            id: randomUUID(),
            business_id: user.business_id,
            product_id: body.product_id,
            quantity: body.quantity,
            reason: body.reason,
            reported_by: user.sub,
            notes: body.notes || null,
            created_at: new Date()
          })
          .returningAll()
          .executeTakeFirst();

        // Record stock movement
        await trx
          .insertInto('stock_movements')
          .values({
            id: randomUUID(),
            business_id: user.business_id,
            product_id: body.product_id,
            movement_type: 'waste',
            quantity: -body.quantity,
            balance_after: newStock,
            reference_type: 'waste',
            reference_id: wasteLog!.id,
            user_id: user.sub,
            notes: `Merma: ${body.reason} - ${body.quantity} unid.`,
            created_at: new Date(),
            metadata: {}
          })
          .execute();

        // Create transaction for the loss
        await trx
          .insertInto('transactions')
          .values({
            id: randomUUID(),
            business_id: user.business_id,
            type: 'expense',
            amount: lossValue,
            payment_method: null,
            category: 'Merma',
            description: `Merma: ${body.quantity}x ${product.name} (${body.reason})`,
            reference_id: wasteLog!.id,
            reference_type: 'waste',
            notes: body.notes || null,
            created_by: user.sub,
            created_at: new Date()
          })
          .execute();

        return wasteLog;
      });

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // DELETE WASTE REPORT (Soft delete - for corrections)
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

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    // Get the waste log to restore stock
    const wasteLog = await db
      .selectFrom('waste_logs')
      .select(['product_id', 'quantity'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!wasteLog) {
      return reply.status(404).send({ error: 'Waste log not found' });
    }

    await db.transaction().execute(async (trx) => {
      // Restore stock
      const product = await trx
        .selectFrom('products')
        .select('stock_quantity')
        .where('id', '=', wasteLog.product_id)
        .forUpdate()
        .executeTakeFirst();

      await trx
        .updateTable('products')
        .set({
          stock_quantity: (Number(product?.stock_quantity) || 0) + wasteLog.quantity,
          updated_at: new Date()
        })
        .where('id', '=', wasteLog.product_id)
        .execute();

      // Soft delete the waste log
      await trx
        .updateTable('waste_logs')
        .set({ deleted_at: new Date() })
        .where('id', '=', id)
        .execute();
    });

    return reply.send({ success: true });
  });
};

export default wasteRoutes;

