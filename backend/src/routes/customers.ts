import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';

export const customersRoutes: FastifyPluginAsync = async (fastify) => {
  // Create customer schema
  const createCustomerSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    phone: z.string().min(1, 'El teléfono es obligatorio'),
    email: z.string().email().optional().or(z.literal('')),
    address_street: z.string().optional().or(z.literal('')),
    address_number: z.string().optional().or(z.literal('')),
    address_floor: z.string().optional().or(z.literal('')),
    address_city: z.string().optional().or(z.literal('')),
    debt_balance: z.number().default(0),
    credit_limit: z.number().optional().default(0),
    birthday: z.string().optional().or(z.literal('')),
    anniversary: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
    important_date_name: z.string().optional().or(z.literal('')),
    important_date: z.string().optional().or(z.literal(''))
  });

  // Update customer schema (partial)
  const updateCustomerSchema = createCustomerSchema.partial();

  // LIST CUSTOMERS
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
    const { search, has_debt, limit = '100' } = request.query as any;

    const customers = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

        let query = trx
            .selectFrom('customers')
            .selectAll()
            .where('deleted_at', 'is', null);

        if (search) {
            query = query.where((eb) => eb.or([
                eb('name', 'ilike', `%${search}%`),
                eb('phone', 'ilike', `%${search}%`),
                eb('email', 'ilike', `%${search}%`)
            ]));
        }

        if (has_debt === 'true') {
            query = query.where('debt_balance', '>', 0);
        }

        return await query
            .orderBy('name', 'asc')
            .limit(parseInt(limit))
            .execute();
    });

    return reply.send(customers);
  });

  // GET SINGLE CUSTOMER
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

    const customer = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);
        return await trx
            .selectFrom('customers')
            .selectAll()
            .where('id', '=', id)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();
    });

    if (!customer) {
      return reply.status(404).send({ error: 'Customer not found' });
    }

    return reply.send(customer);
  });

  // GET CUSTOMER WITH ORDERS HISTORY
  fastify.get('/:id/history', {
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

    const result = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

        const customer = await trx
            .selectFrom('customers')
            .selectAll()
            .where('id', '=', id)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

        if (!customer) return null;

        const orders = await trx
            .selectFrom('orders')
            .selectAll()
            .where('customer_id', '=', id)
            .orderBy('created_at', 'desc')
            .limit(50)
            .execute();

        const totalSpent = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);

        return {
            ...customer,
            orders,
            total_orders: orders.length,
            total_spent: totalSpent
        };
    });

    if (!result) {
      return reply.status(404).send({ error: 'Customer not found' });
    }

    return reply.send(result);
  });

  // CREATE CUSTOMER
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
      const body = createCustomerSchema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

        return await trx
          .insertInto('customers')
          .values({
            id: randomUUID(),
            business_id: user.business_id,
            name: body.name,
            phone: body.phone,
            email: body.email || null,
            debt_balance: body.debt_balance || 0,
            credit_limit: body.credit_limit || 0,
            birthday: body.birthday ? new Date(body.birthday) : null,
            anniversary: body.anniversary ? new Date(body.anniversary) : null,
            notes: body.notes || null,
            important_date_name: body.important_date_name || null,
            important_date: body.important_date ? new Date(body.important_date) : null,
            address_street: body.address_street || null,
            address_number: body.address_number || null,
            address_floor: body.address_floor || null,
            address_city: body.address_city || null,
            is_active: true,
            total_orders: 0,
            total_spent: 0,
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .returningAll()
          .executeTakeFirst();
      });

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // UPDATE CUSTOMER
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
      const body = updateCustomerSchema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

        return await trx
          .updateTable('customers')
          .set({
            ...body,
            birthday: body.birthday ? new Date(body.birthday) : undefined,
            anniversary: body.anniversary ? new Date(body.anniversary) : undefined,
            important_date: body.important_date ? new Date(body.important_date) : undefined,
            updated_at: new Date()
          } as any)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirst();
      });

      if (!result) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // DELETE CUSTOMER
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

    await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);
        await trx
            .updateTable('customers')
            .set({
                deleted_at: new Date(),
                is_active: false
            })
            .where('id', '=', id)
            .execute();
    });

    return reply.send({ success: true });
  });

  // REGISTER PAYMENT
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
    const { amount, payment_method = 'cash', notes } = request.body as {
      amount: number;
      payment_method?: 'cash' | 'card' | 'transfer';
      notes?: string;
    };

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Invalid amount' });
    }

    const result = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

        const customer = await trx
            .selectFrom('customers')
            .select(['debt_balance', 'name'])
            .where('id', '=', id)
            .forUpdate()
            .executeTakeFirst();

        if (!customer) throw new Error('Customer not found');

        const newDebt = Math.max(0, Number(customer.debt_balance) - amount);

        await trx
            .updateTable('customers')
            .set({ 
                debt_balance: newDebt,
                updated_at: new Date()
            })
            .where('id', '=', id)
            .execute();

        const transaction = await trx
            .insertInto('transactions')
            .values({
                id: randomUUID(),
                business_id: user.business_id,
                type: 'payment_received',
                category: 'income',
                amount: amount,
                payment_method: payment_method,
                reference_id: id,
                reference_type: 'customer_payment',
                description: `Pago de deuda - ${customer.name}`,
                notes: notes || null,
                created_by: user.sub,
                created_at: new Date()
            } as any)
            .returningAll()
            .executeTakeFirst();

        return { customer: { ...customer, debt_balance: newDebt }, transaction };
    });

    return reply.send(result);
  });

  // ADD DEBT
  fastify.post('/:id/debt', {
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
    const { amount, notes } = request.body as {
      amount: number;
      notes?: string;
    };

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Invalid amount' });
    }

    const result = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

        const customer = await trx
            .selectFrom('customers')
            .select(['debt_balance', 'name'])
            .where('id', '=', id)
            .forUpdate()
            .executeTakeFirst();

        if (!customer) throw new Error('Customer not found');

        const newDebt = Number(customer.debt_balance) + amount;

        await trx
            .updateTable('customers')
            .set({ 
                debt_balance: newDebt,
                updated_at: new Date()
            })
            .where('id', '=', id)
            .execute();

        return { customer: { ...customer, debt_balance: newDebt } };
    });

    return reply.send(result);
  });
};

export default customersRoutes;

