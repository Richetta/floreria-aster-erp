import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';

export const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  // Create order schema
  const createOrderSchema = z.object({
    customer_id: z.string().or(z.literal('guest')),
    guest_name: z.string().optional(),
    guest_phone: z.string().optional(),
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
      product_id: z.string().optional(),
      package_id: z.string().optional(),
      quantity: z.number().int().positive(),
      unit_price: z.number().positive(),
      product_name: z.string().optional()
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
    delivery_method: z.enum(['pickup', 'delivery']).optional(),
    advance_payment: z.number().optional()
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

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

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
      query = query.where('delivery_date', '>=', new Date(from_date));
    }

    if (to_date) {
      query = query.where('delivery_date', '<=', new Date(to_date));
    }

    if (delivery_method) {
      query = query.where('delivery_method', '=', delivery_method);
    }

    const orders = await query
      .orderBy('delivery_date', 'asc')
      .limit(parseInt(limit))
      .execute();

    // Fetch items for all these orders to avoid "No hay productos registrados" in Kanban/Modal
    const orderIds = orders.map(o => o.id);
    if (orderIds.length > 0) {
      const allItems = await db
        .selectFrom('order_items')
        .selectAll()
        .where('order_id', 'in', orderIds)
        .execute();
      
      const ordersWithItems = orders.map(o => ({
        ...o,
        items: allItems.filter(item => item.order_id === o.id)
      }));
      return reply.send(ordersWithItems);
    }

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

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

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

      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const result = await db.transaction().execute(async (trx) => {
        // Calculate total
        const totalAmount = body.items.reduce(
          (sum, item) => sum + (item.unit_price * item.quantity), 
          0
        );

        // Get next order number for this business
        const lastOrder = await trx
          .selectFrom('orders')
          .select(['order_number'])
          .where('business_id', '=', user.business_id)
          .orderBy('order_number', 'desc')
          .executeTakeFirst();
        
        const nextOrderNumber = (lastOrder?.order_number || 0) + 1;

        let finalCustomerId = body.customer_id;
        let finalCustomerName = 'Unknown';
        let finalCustomerPhone = body.contact_phone || null;

        if (body.customer_id === 'guest') {
            // Find or create "Consumidor Final"
            let genericCustomer = await trx
                .selectFrom('customers')
                .select(['id', 'name'])
                .where('business_id', '=', user.business_id)
                .where('name', '=', 'Consumidor Final')
                .executeTakeFirst();
            
            if (!genericCustomer) {
                genericCustomer = await trx
                    .insertInto('customers')
                    .values({
                        id: randomUUID(),
                        business_id: user.business_id,
                        name: 'Consumidor Final',
                        phone: '0000',
                        is_active: true,
                        created_at: new Date(),
                        updated_at: new Date()
                    } as any)
                    .returning(['id', 'name'])
                    .executeTakeFirst();
            }
            
            finalCustomerId = genericCustomer!.id;
            finalCustomerName = body.guest_name || 'Consumidor Final';
            finalCustomerPhone = body.guest_phone || null;
        } else {
            // Get customer name for denormalization
            const customerData = await trx
                .selectFrom('customers')
                .select(['name', 'phone'])
                .where('id', '=', body.customer_id)
                .executeTakeFirst();
            
            finalCustomerName = customerData?.name || 'Unknown';
            finalCustomerPhone = body.contact_phone || customerData?.phone || null;
        }

        // Create order
        const orderId = randomUUID();
        const order = await trx
          .insertInto('orders')
          .values({
            id: orderId,
            business_id: user.business_id,
            order_number: nextOrderNumber,
            customer_id: finalCustomerId,
            customer_name: finalCustomerName,
            customer_phone: finalCustomerPhone,
            status: 'pending',
            delivery_date: new Date(body.delivery_date),
            delivery_address: body.delivery_address || null, // Kysely handles Record<string, any>
            delivery_time_slot: body.delivery_time_slot,
            delivery_method: body.delivery_method,
            contact_phone: finalCustomerPhone,
            card_message: body.card_message || null,
            total_amount: totalAmount,
            subtotal: totalAmount,
            discount: 0,
            advance_payment: body.advance_payment,
            created_by: user.sub,
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .returningAll()
          .executeTakeFirst();

        // Create order items
        for (const item of body.items) {
          await trx
            .insertInto('order_items')
            .values({
              id: randomUUID(),
              business_id: user.business_id,
              order_id: orderId,
              product_id: item.product_id || null,
              package_id: item.package_id || null,
              product_name: item.product_name || 'Producto',
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount: 0,
              total: item.unit_price * item.quantity,
              created_at: new Date()
            } as any)
            .execute();
        }

        // If there's advance payment, create transaction
        if (body.advance_payment > 0) {
          await trx
            .insertInto('transactions')
            .values({
              id: randomUUID(),
              business_id: user.business_id,
              type: 'payment_received',
              category: 'Seña',
              amount: body.advance_payment,
              payment_method: 'cash',
              reference_id: orderId,
              reference_type: 'order_advance',
              description: `Seña para pedido #${orderId.substring(0,8)}`,
              created_by: user.sub,
              created_at: new Date()
            } as any)
            .execute();
        }

        // Update customer statistics
        const customer = await trx
            .selectFrom('customers')
            .select(['total_orders', 'debt_balance'])
            .where('id', '=', finalCustomerId)
            .executeTakeFirst();

        const remainingBalance = totalAmount - body.advance_payment;
        
        await trx
          .updateTable('customers')
          .set({ 
            total_orders: (customer?.total_orders || 0) + 1,
            debt_balance: Number(customer?.debt_balance || 0) + remainingBalance,
            last_order_date: new Date(),
            updated_at: new Date()
          })
          .where('id', '=', finalCustomerId)
          .execute();

        // Fetch newly created items
        const items = await trx
          .selectFrom('order_items')
          .selectAll()
          .where('order_id', '=', orderId)
          .execute();

        return { ...order, items };
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

      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const result = await db
        .updateTable('orders')
        .set({
          ...body,
          delivery_date: body.delivery_date ? new Date(body.delivery_date) : undefined,
          delivery_address: body.delivery_address || undefined,
          updated_at: new Date()
        } as any)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      if (!result) {
        return reply.status(404).send({ error: 'Order not found' });
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

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const result = await db
      .updateTable('orders')
      .set({ 
        status,
        updated_at: new Date()
      } as any)
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

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    await db
      .updateTable('orders')
      .set({
        deleted_at: new Date()
      })
      .where('id', '=', id)
      .execute();

    return reply.send({ success: true });
  });

  // REGISTER PAYMENT ON ORDER
  fastify.post('/:id/payment', {
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
    const { amount, payment_method = 'cash', notes } = request.body as { amount: number; payment_method?: string; notes?: string };

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Monto inválido' });
    }

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const order = await db
      .selectFrom('orders')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!order) {
      return reply.status(404).send({ error: 'Pedido no encontrado' });
    }

    const currentAdvance = Number(order.advance_payment || 0);
    const newAdvance = currentAdvance + amount;
    const totalAmount = Number(order.total_amount || 0);

    if (newAdvance > totalAmount) {
      return reply.status(400).send({ error: 'El pago supera el total del pedido' });
    }

    // Update order advance_payment
    const updatedOrder = await db
      .updateTable('orders')
      .set({
        advance_payment: newAdvance,
        updated_at: new Date()
      } as any)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    // Log transaction
    await db
      .insertInto('transactions')
      .values({
        id: randomUUID(),
        business_id: user.business_id,
        type: 'payment_received',
        category: 'Cobro Pedido',
        amount: amount,
        payment_method: payment_method,
        reference_id: id,
        reference_type: 'order_payment',
        description: notes || `Pago parcial del pedido #${id.substring(0, 8)}`,
        created_by: user.sub,
        created_at: new Date()
      } as any)
      .execute();

    // Update customer debt balance
    if (order.customer_id) {
      const customer = await db
        .selectFrom('customers')
        .select(['debt_balance'])
        .where('id', '=', order.customer_id)
        .executeTakeFirst();

      if (customer) {
        const newDebt = Math.max(0, Number(customer.debt_balance || 0) - amount);
        await db
          .updateTable('customers')
          .set({ debt_balance: newDebt, updated_at: new Date() })
          .where('id', '=', order.customer_id)
          .execute();
      }
    }

    return reply.send({ ...updatedOrder, message: 'Pago registrado correctamente' });
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

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

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

