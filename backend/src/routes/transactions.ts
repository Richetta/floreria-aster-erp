import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { config } from '../config/index.js';
import { randomUUID } from 'crypto';

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

    // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

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
      query = query.where('created_at', '>=', new Date(from_date));
    }

    if (to_date) {
      query = query.where('created_at', '<=', new Date(to_date));
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

    // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

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

    // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    let query = db
      .selectFrom('transactions')
      .select(['type', 'payment_method'])
      .select(db.fn.sum('amount').as('total_amount'))
      .where('deleted_at', 'is', null);

    if (from_date) {
      query = query.where('created_at', '>=', new Date(from_date));
    }

    if (to_date) {
      query = query.where('created_at', '<=', new Date(to_date));
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

      // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const result = await db
        .insertInto('transactions')
        .values({
          id: randomUUID(),
          business_id: user.business_id,
          type: body.type,
          amount: body.amount,
          payment_method: body.payment_method || null,
          category: body.category,
          description: body.description || null,
          reference_id: body.reference_id || null,
          reference_type: body.reference_type || null,
          notes: body.notes || null,
          created_by: user.sub,
          created_at: new Date()
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
        product_id: z.string().uuid().optional(),
        package_id: z.string().uuid().optional(),
        quantity: z.coerce.number().int().positive(),
        unit_price: z.coerce.number().positive()
      })).min(1).refine(items => items.every(i => i.product_id || i.package_id), {
        message: "Cada item debe tener product_id o package_id"
      }),
      notes: z.string().optional()
    }).parse(request.body);

    console.log('========================================');
    console.log('[SALE] Starting sale process');
    console.log('[SALE] Body:', JSON.stringify(body, null, 2));
    console.log('[SALE] User ID:', user.sub);
    console.log('[SALE] Business ID:', user.business_id);
    console.log('========================================');

    try {
      const result = await db.transaction().execute(async (trx) => {
        const saleTransactionId = randomUUID();
        console.log('[SALE] Generated saleTransactionId:', saleTransactionId);

        // 1. Verify and deduct stock
        console.log('[SALE] Processing', body.items.length, 'items');
        for (const item of body.items) {
          if (item.product_id) {
            console.log('[SALE] Processing product:', item.product_id, 'qty:', item.quantity);

            const product = await trx
              .selectFrom('products')
              .select(['id', 'stock_quantity', 'name', 'cost'])
              .where('id', '=', item.product_id)
              .forUpdate()
              .executeTakeFirst();

            if (!product) {
              console.error('[SALE] Product not found:', item.product_id);
              throw new Error(`Producto no encontrado: ${item.product_id}`);
            }

            // const newStock = ... (moved below and reused)
            console.log('[SALE] Product:', product.name, 'Old stock:', product.stock_quantity);

            // Deduct stock using relative update for atomic integrity
            await trx
              .updateTable('products')
              .set({
                stock_quantity: sql`stock_quantity - ${item.quantity}`,
                updated_at: new Date()
              })
              .where('id', '=', product.id)
              .execute();

            // Fetch new balance for movement record (optional, but good for reporting)
            const updatedProduct = await trx
              .selectFrom('products')
              .select('stock_quantity')
              .where('id', '=', product.id)
              .executeTakeFirst();

            const newStock = Number(updatedProduct?.stock_quantity || 0);

            // Record stock movement
            await trx
              .insertInto('stock_movements')
              .values({
                id: randomUUID(),
                business_id: user.business_id,
                product_id: product.id,
                movement_type: 'sale',
                quantity: -item.quantity,
                balance_after: newStock,
                reference_type: 'sale',
                reference_id: saleTransactionId,
                user_id: user.sub,
                notes: `Venta POS - ${product.name}`,
                created_at: new Date(),
                metadata: {
                  client_ip: request.ip,
                  unit_price: item.unit_price,
                  unit_cost: product.cost
                }
              })
              .execute();

            console.log('[SALE] Stock deducted for product:', product.name);
          } else if (item.package_id) {
            console.log('[SALE] Processing package:', item.package_id, 'qty:', item.quantity);

            // Handle Package: decompose into components
            const components = await trx
              .selectFrom('package_components')
              .innerJoin('products', 'products.id', 'package_components.product_id')
              .select(['products.id', 'products.stock_quantity', 'products.name', 'package_components.quantity as comp_quantity', 'products.cost'])
              .where('package_id', '=', item.package_id)
              .execute();

            if (components.length === 0) {
              console.error('[SALE] Package has no components:', item.package_id);
              throw new Error(`Combo/Ramo no encontrado o sin componentes: ${item.package_id}`);
            }

            console.log('[SALE] Package has', components.length, 'components');

            for (const comp of components) {
              const totalDeduction = Number(comp.comp_quantity) * item.quantity;
              console.log('[SALE] Component:', comp.name, 'Qty needed:', totalDeduction, 'Old stock:', comp.stock_quantity);

              // Deduct stock using relative update
              await trx
                .updateTable('products')
                .set({
                  stock_quantity: sql`stock_quantity - ${totalDeduction}`,
                  updated_at: new Date()
                })
                .where('id', '=', comp.id)
                .execute();

              // Fetch new balance
              const updatedComp = await trx
                .selectFrom('products')
                .select('stock_quantity')
                .where('id', '=', comp.id)
                .executeTakeFirst();

              const newStock = Number(updatedComp?.stock_quantity || 0);

              // Record stock movement for component
              await trx
                .insertInto('stock_movements')
                .values({
                  id: randomUUID(),
                  business_id: user.business_id,
                  product_id: comp.id,
                  movement_type: 'sale',
                  quantity: -totalDeduction,
                  balance_after: newStock,
                  reference_type: 'sale_package',
                  reference_id: saleTransactionId,
                  user_id: user.sub,
                  notes: `Venta Ramo - Componente: ${comp.name}`,
                  created_at: new Date(),
                  metadata: { 
                    package_id: item.package_id,
                    client_ip: request.ip,
                    unit_cost: comp.cost
                  }
                })
                .execute();
            }

            console.log('[SALE] All components deducted for package');
          }
        }

        console.log('[SALE] Stock processing complete, creating transaction');

        // 2. Create transaction for the sale
        const transaction = await trx
          .insertInto('transactions')
          .values({
            id: saleTransactionId,
            business_id: user.business_id,
            type: 'sale',
            amount: body.total,
            payment_method: body.payment_method,
            category: 'Venta POS',
            description: `Venta de mostrador - ${body.items.length} productos`,
            notes: body.notes || null,
            metadata: {
              items: body.items,
              customer_id: body.customer_id || null,
              is_revenue: true,
              impacts_cash: body.payment_method === 'cash',
              client_ip: request.ip
            },
            created_by: user.sub,
            created_at: new Date()
          })
          .returningAll()
          .executeTakeFirst();

        if (!transaction) {
          throw new Error('Failed to create transaction');
        }

        console.log('[SALE] Transaction created:', transaction.id);

        // 3. If customer provided, update their stats
        if (body.customer_id) {
          console.log('[SALE] Updating customer stats:', body.customer_id);

          const customer = await trx
            .selectFrom('customers')
            .select(['total_orders', 'total_spent'])
            .where('id', '=', body.customer_id)
            .executeTakeFirst();

          await trx
            .updateTable('customers')
            .set({
              total_orders: (customer?.total_orders || 0) + 1,
              total_spent: Number(customer?.total_spent || 0) + body.total,
              last_order_date: new Date(),
              updated_at: new Date()
            })
            .where('id', '=', body.customer_id)
            .execute();

          console.log('[SALE] Customer stats updated');
        }

        console.log('[SALE] Sale completed successfully!');
        return transaction;
      });

      console.log('[SALE] Transaction committed to database');
      console.log('========================================');
      return reply.status(201).send(result);
    } catch (error: any) {
      console.error('========================================');
      console.error('[SALE] ERROR:', error.message);
      console.error('[SALE] Stack:', error.stack);
      console.error('[SALE] Body was:', JSON.stringify(body, null, 2));
      console.error('========================================');
      return reply.status(500).send({
        error: 'Error processing sale',
        details: error.message,
        stack: config.nodeEnv === 'development' ? error.stack : undefined
      });
    }
  });

  // CREATE PURCHASE (Stock increase)
  fastify.post('/purchase', {
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
      console.log('[PURCHASE] Raw body received:', JSON.stringify(request.body, null, 2));
      const body = z.object({
        supplier_id: z.string().uuid(),
        payment_method: z.enum(['cash', 'transfer']),
        items: z.array(z.object({
          product_id: z.string().uuid(),
          quantity: z.coerce.number().int().positive(),
          cost: z.coerce.number().nonnegative()
        })).min(1),
        notes: z.string().optional()
      }).parse(request.body);

      console.log('[PURCHASE] Parsed body:', JSON.stringify(body, null, 2));

      const result = await db.transaction().execute(async (trx) => {
        const purchaseTransactionId = randomUUID();
        let totalAmount = 0;
        
        // 1. Update stock and record movements
        for (const item of body.items) {
          const product = await trx
            .selectFrom('products')
            .select(['id', 'stock_quantity', 'name'])
            .where('id', '=', item.product_id)
            .forUpdate()
            .executeTakeFirst();

          if (!product) {
            throw new Error(`Producto no encontrado: ${item.product_id}`);
          }

          const itemTotal = item.cost * item.quantity;
          totalAmount += itemTotal;

          // Update stock and cost using relative updates
          await trx
            .updateTable('products')
            .set({ 
              stock_quantity: sql`stock_quantity + ${item.quantity}`,
              cost: item.cost,
              updated_at: new Date()
            })
            .where('id', '=', product.id)
            .execute();

          // Fetch new balance
          const updatedProduct = await trx
            .selectFrom('products')
            .select('stock_quantity')
            .where('id', '=', product.id)
            .executeTakeFirst();

          const newStock = Number(updatedProduct?.stock_quantity || 0);

          // Record stock movement
          await trx
            .insertInto('stock_movements')
            .values({
              id: randomUUID(),
              business_id: user.business_id,
              product_id: product.id,
              movement_type: 'purchase' as any,
              quantity: item.quantity,
              balance_after: newStock,
              reference_type: 'purchase',
              reference_id: purchaseTransactionId, 
              user_id: user.sub,
              notes: `Compra a proveedor - ${product.name}`,
              created_at: new Date(),
              metadata: { 
                supplier_id: body.supplier_id,
                client_ip: request.ip
              }
            } as any)
            .execute();
        }

        // 2. Create transaction for the purchase
        const transaction = await trx
          .insertInto('transactions')
          .values({
            id: purchaseTransactionId,
            business_id: user.business_id,
            type: 'expense',
            amount: totalAmount,
            payment_method: body.payment_method,
            category: 'Compra a Proveedor',
            description: `Compra de mercadería - ${body.items.length} productos`,
            notes: body.notes || null,
            metadata: {
              items: body.items,
              supplier_id: body.supplier_id,
              is_expense: true,
              impacts_cash: body.payment_method === 'cash',
              client_ip: request.ip
            },
            created_by: user.sub,
            created_at: new Date()
          })
          .returningAll()
          .executeTakeFirst();

        return transaction;
      });

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const readableDetails = error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join('; ');
        console.error('[PURCHASE VALIDATION ERROR]:', JSON.stringify(error.errors, null, 2));
        return reply.status(400).send({ 
          error: 'Validation error', 
          message: `Error de validación: ${readableDetails}`,
          details: error.errors 
        });
      }
      console.error('[PURCHASE ERROR]:', error);
      return reply.status(500).send({ 
        error: 'Internal server error', 
        message: error.message 
      });
    }
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

    // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const result = await db
      .insertInto('transactions')
      .values({
        id: randomUUID(),
        business_id: user.business_id,
        type: 'expense',
        amount: body.amount,
        payment_method: body.payment_method,
        category: body.category,
        description: body.description,
        notes: body.notes || null,
        created_by: user.sub,
        created_at: new Date()
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

    // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

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

