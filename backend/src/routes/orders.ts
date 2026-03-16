import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db';

export const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  // Create order schema
  const createOrderSchema = z.object({
    customer_id: z.string().uuid(),
    delivery_date: z.string(),
    delivery_address: z.object({
      street: z.string().optional(),
      number: z.string().optional(),
      floor: z.string().optional(),
      city: z.string().optional(),
      reference: z.string().optional()
    }).optional(),
    delivery_time_slot: z.enum(['morning', 'afternoon', 'evening', 'allday']).default('allday'),
    delivery_method: z.enum(['pickup', 'delivery']).default('pickup'),
    contact_phone: z.string().optional(),
    card_message: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
    items: z.array(z.object({
      product_id: z.string().uuid().optional(),
      package_id: z.string().uuid().optional(),
      quantity: z.number().int().positive(),
      unit_price: z.number().positive()
    })).min(1, 'El pedido debe tener al menos 1 item'),
    advance_payment: z.number().default(0)
  });

  // Update order schema (partial - mainly for status)
  const updateOrderSchema = z.object({
    status: z.enum(['pending', 'assembling', 'ready', 'out_for_delivery', 'delivered', 'cancelled']).optional(),
    delivery_date: z.string().optional(),
    notes: z.string().optional().or(z.literal('')),
    delivery_address: z.object({
      street: z.string().optional(),
      number: z.string().optional(),
      floor: z.string().optional(),
      city: z.string().optional(),
      reference: z.string().optional()
    }).optional(),
    contact_phone: z.string().optional(),
    delivery_time_slot: z.enum(['morning', 'afternoon', 'evening', 'allday']).optional(),
    delivery_method: z.enum(['pickup', 'delivery']).optional()
  });

  // LIST ORDERS
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
      status, 
      customer_id, 
      from_date, 
      to_date, 
      delivery_method,
      limit = '100' 
    } = request.query as any;

    let query = db
      .selectFrom('orders')
      .selectAll()
      .where('deleted_at', 'is', null);

    // Filters
    if (status) {
      query = query.where('status', '=', status);
    }

    if (customer_id) {
      query = query.where('customer_id', '=', customer_id);
    }

    if (from_date) {
      query = query.where('delivery_date', '>=', from_date);
    }

    if (to_date) {
      query = query.where('delivery_date', '<=', to_date);
    }

    if (delivery_method) {
      query = query.where('delivery_method', '=', delivery_method);
    }

    const orders = await query
      .orderBy('delivery_date', 'asc')
      .limit(parseInt(limit))
      .execute();

    return reply.send(orders);
  });

  // GET SINGLE ORDER WITH ITEMS
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

    const order = await db
      .selectFrom('orders')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    // Get order items
    const items = await db
      .selectFrom('order_items')
      .selectAll()
      .where('order_id', '=', id)
      .execute();

    return reply.send({ ...order, items });
  });

  // CREATE ORDER
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
      const body = createOrderSchema.parse(request.body);

      await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

      const result = await db.transaction().execute(async (trx) => {
        // Calculate total
        const totalAmount = body.items.reduce(
          (sum, item) => sum + (item.unit_price * item.quantity), 
          0
        );

        // Create order
        const order = await trx
          .insertInto('orders')
          .values({
            business_id: user.business_id,
            customer_id: body.customer_id,
            status: 'pending',
            delivery_date: body.delivery_date,
            delivery_address: body.delivery_address ? JSON.stringify(body.delivery_address) : null,
            delivery_time_slot: body.delivery_time_slot,
            delivery_method: body.delivery_method,
            contact_phone: body.contact_phone,
            card_message: body.card_message,
            notes: body.notes,
            total_amount: totalAmount,
            advance_payment: body.advance_payment,
            created_by: user.sub
          })
          .returningAll()
          .executeTakeFirst();

        // Create order items
        for (const item of body.items) {
          await trx
            .insertInto('order_items')
            .values({
              business_id: user.business_id,
              order_id: order!.id,
              product_id: item.product_id,
              package_id: item.package_id,
              quantity: item.quantity,
              unit_price: item.unit_price
            })
            .execute();
        }

        // If there's advance payment, create transaction
        if (body.advance_payment > 0) {
          await trx
            .insertInto('transactions')
            .values({
              business_id: user.business_id,
              type: 'payment_received',
              amount: body.advance_payment,
              payment_method: 'cash', // Default, could be parameterized
              reference_id: order!.id,
              reference_type: 'order_advance',
              user_id: user.sub,
              notes: `Seña para pedido #${order!.id}`,
              created_by: user.sub
            })
            .execute();
        }

        // Update customer debt if there's remaining balance
        const remainingBalance = totalAmount - body.advance_payment;
        if (remainingBalance > 0) {
          await trx
            .updateTable('customers')
            .set({ 
              debt_balance: trx
                .selectFrom('customers')
                .select('debt_balance')
                .where('id', '=', body.customer_id)
                .$narrowType<{ debt_balance: number }>()
                .executeTakeFirst()
                .then(c => (c?.debt_balance || 0) + remainingBalance),
              updated_at: new Date()
            })
            .where('id', '=', body.customer_id)
            .execute();
        }

        return order;
      });

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // UPDATE ORDER
  fastify.put('/:id', {
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
      const body = updateOrderSchema.parse(request.body);

      await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

      // Check if status changed to delivered
      const currentOrder = await db
        .selectFrom('orders')
        .select(['status', 'customer_id', 'total_amount', 'advance_payment'])
        .where('id', '=', id)
        .executeTakeFirst();

      const result = await db
        .updateTable('orders')
        .set({
          ...body,
          delivery_address: body.delivery_address ? JSON.stringify(body.delivery_address) : undefined,
          updated_at: new Date()
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      if (!result) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      // If status changed to delivered and there was pending debt, record it
      if (body.status === 'delivered' && currentOrder?.status !== 'delivered') {
        const remainingBalance = Number(currentOrder.total_amount) - Number(currentOrder.advance_payment);
        if (remainingBalance > 0 && currentOrder.customer_id) {
          // Debt was already recorded when order was created
          // Just mark that the order is complete
        }
      }

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // UPDATE ORDER STATUS (Quick endpoint)
  fastify.patch('/:id/status', {
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
    const { status } = request.body as { status: 'pending' | 'assembling' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled' };

    if (!status) {
      return reply.status(400).send({ error: 'Status is required' });
    }

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    const result = await db
      .updateTable('orders')
      .set({ 
        status,
        updated_at: new Date()
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!result) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    return reply.send(result);
  });

  // DELETE ORDER (Soft delete)
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
      .updateTable('orders')
      .set({
        deleted_at: new Date()
      })
      .where('id', '=', id)
      .execute();

    return reply.send({ success: true });
  });

  // GET ORDERS BY DELIVERY DATE (For logistics)
  fastify.get('/delivery/scheduled', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { date } = request.query as { date?: string };

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    let query = db
      .selectFrom('orders')
      .selectAll()
      .where('deleted_at', 'is', null)
      .where('delivery_method', '=', 'delivery')
      .where('status', 'in', ['ready', 'out_for_delivery']);

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query = query
        .where('delivery_date', '>=', startDate)
        .where('delivery_date', '<=', endDate);
    }

    const orders = await query
      .orderBy('delivery_date', 'asc')
      .execute();

    return reply.send(orders);
  });
};

export default ordersRoutes;
