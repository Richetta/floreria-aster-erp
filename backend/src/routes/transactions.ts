import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db';

export const transactionsRoutes: FastifyPluginAsync = async (fastify) => {
  // Create transaction schema
  const createTransactionSchema = z.object({
    type: z.enum(['sale', 'payment_received', 'expense', 'supplier_payment', 'adjustment']),
    amount: z.number().positive(),
    payment_method: z.enum(['cash', 'card', 'transfer']).optional(),
    category: z.string(),
    description: z.string().optional(),
    reference_id: z.string().uuid().optional(),
    reference_type: z.string().optional(),
    notes: z.string().optional()
  });

  // LIST TRANSACTIONS
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

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    const { 
      type, 
      category,
      from_date, 
      to_date, 
      payment_method,
      limit = '200' 
    } = request.query as any;

    let query = db
      .selectFrom('transactions')
      .selectAll()
      .where('deleted_at', 'is', null);

    // Filters
    if (type) {
      query = query.where('type', '=', type);
    }

    if (category) {
      query = query.where('category', '=', category);
    }

    if (from_date) {
      query = query.where('created_at', '>=', from_date);
    }

    if (to_date) {
      query = query.where('created_at', '<=', to_date);
    }

    if (payment_method) {
      query = query.where('payment_method', '=', payment_method);
    }

    const transactions = await query
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .execute();

    return reply.send(transactions);
  });

  // GET SINGLE TRANSACTION
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

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    const transaction = await db
      .selectFrom('transactions')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!transaction) {
      return reply.status(404).send({ error: 'Transaction not found' });
    }

    return reply.send(transaction);
  });

  // GET FINANCIAL SUMMARY
  fastify.get('/summary/period', {
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

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    let query = db
      .selectFrom('transactions')
      .select(['type', 'payment_method'])
      .select(db.fn.sum('amount').as('total_amount'))
      .where('deleted_at', 'is', null);

    if (from_date) {
      query = query.where('created_at', '>=', from_date);
    }

    if (to_date) {
      query = query.where('created_at', '<=', to_date);
    }

    const result = await query
      .groupBy(['type', 'payment_method'])
      .execute();

    // Calculate totals
    const summary = {
      income: {
        total: 0,
        cash: 0,
        card: 0,
        transfer: 0
      },
      expense: {
        total: 0,
        cash: 0,
        transfer: 0
      },
      balance: 0
    };

    result.forEach(row => {
      const amount = Number(row.total_amount);
      const method = row.payment_method as string;

      if (row.type === 'sale' || row.type === 'payment_received') {
        summary.income.total += amount;
        if (method === 'cash') summary.income.cash += amount;
        if (method === 'card') summary.income.card += amount;
        if (method === 'transfer') summary.income.transfer += amount;
      } else if (row.type === 'expense' || row.type === 'supplier_payment') {
        summary.expense.total += amount;
        if (method === 'cash') summary.expense.cash += amount;
        if (method === 'transfer') summary.expense.transfer += amount;
      }
    });

    summary.balance = summary.income.total - summary.expense.total;

    return reply.send(summary);
  });

  // CREATE TRANSACTION
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
      const body = createTransactionSchema.parse(request.body);

      await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

      const result = await db
        .insertInto('transactions')
        .values({
          business_id: user.business_id,
          type: body.type,
          amount: body.amount,
          payment_method: body.payment_method,
          category: body.category,
          description: body.description,
          reference_id: body.reference_id,
          reference_type: body.reference_type,
          notes: body.notes,
          created_by: user.sub
        })
        .returningAll()
        .executeTakeFirst();

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // CREATE SALE (POS Sale with stock deduction)
  fastify.post('/sale', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    const body = z.object({
      total: z.number().positive(),
      payment_method: z.enum(['cash', 'card', 'transfer']),
      customer_id: z.string().uuid().optional(),
      items: z.array(z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().positive(),
        unit_price: z.number().positive()
      })).min(1),
      notes: z.string().optional()
    }).parse(request.body);

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    const result = await db.transaction().execute(async (trx) => {
      // 1. Verify and deduct stock
      for (const item of body.items) {
        const product = await trx
          .selectFrom('products')
          .select(['stock_quantity', 'name'])
          .where('id', '=', item.product_id)
          .forUpdate()
          .executeTakeFirst();

        if (!product) {
          throw new Error(`Producto no encontrado: ${item.product_id}`);
        }

        if (Number(product.stock_quantity) < item.quantity) {
          throw new Error(`Stock insuficiente para ${product.name}: hay ${product.stock_quantity}, se necesitan ${item.quantity}`);
        }

        // Deduct stock
        await trx
          .updateTable('products')
          .set({ 
            stock_quantity: Number(product.stock_quantity) - item.quantity,
            updated_at: new Date()
          })
          .where('id', '=', item.product_id)
          .execute();

        // Record stock movement
        await trx
          .insertInto('stock_movements')
          .values({
            business_id: user.business_id,
            product_id: item.product_id,
            movement_type: 'sale',
            quantity: -item.quantity,
            balance_after: Number(product.stock_quantity) - item.quantity,
            reference_type: 'sale',
            reference_id: '00000000-0000-0000-0000-000000000000', // Will update with sale ID
            user_id: user.sub,
            notes: `Venta POS - ${product.name}`
          })
          .execute();
      }

      // 2. Create transaction for the sale
      const transaction = await trx
        .insertInto('transactions')
        .values({
          business_id: user.business_id,
          type: 'sale',
          amount: body.total,
          payment_method: body.payment_method,
          category: 'Venta POS',
          description: `Venta de mostrador - ${body.items.length} productos`,
          notes: body.notes,
          created_by: user.sub
        })
        .returningAll()
        .executeTakeFirst();

      // 3. If customer provided, update their stats
      if (body.customer_id) {
        await trx
          .updateTable('customers')
          .set({
            total_orders: trx
              .selectFrom('customers')
              .select('total_orders')
              .where('id', '=', body.customer_id)
              .$narrowType<{ total_orders: number }>()
              .executeTakeFirst()
              .then(c => (c?.total_orders || 0) + 1),
            last_order_date: new Date(),
            updated_at: new Date()
          })
          .where('id', '=', body.customer_id)
          .execute();
      }

      return transaction;
    });

    return reply.status(201).send(result);
  });

  // CREATE EXPENSE
  fastify.post('/expense', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    const body = z.object({
      amount: z.number().positive(),
      category: z.string(),
      payment_method: z.enum(['cash', 'transfer']),
      description: z.string(),
      notes: z.string().optional()
    }).parse(request.body);

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    const result = await db
      .insertInto('transactions')
      .values({
        business_id: user.business_id,
        type: 'expense',
        amount: body.amount,
        payment_method: body.payment_method,
        category: body.category,
        description: body.description,
        notes: body.notes,
        created_by: user.sub
      })
      .returningAll()
      .executeTakeFirst();

    return reply.status(201).send(result);
  });

  // DELETE TRANSACTION (Soft delete)
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

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    await db
      .updateTable('transactions')
      .set({
        deleted_at: new Date()
      })
      .where('id', '=', id)
      .execute();

    return reply.send({ success: true });
  });
};

export default transactionsRoutes;
