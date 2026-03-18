import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';

export const cashRegisterRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================
  // OPEN CASH REGISTER (APERTURA DE CAJA)
  // ============================================

  fastify.post('/open', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    const schema = z.object({
      date: z.string(),
      opening_balance: z.number().default(0),
      notes: z.string().optional()
    });

    try {
      const body = schema.parse(request.body);

      await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

      // Check if already opened today
      const existingOpening = await db
        .selectFrom('app_settings')
        .select('key')
        .where('business_id', '=', user.business_id)
        .where('key', 'like', `opening_${body.date}%`)
        .executeTakeFirst();

      if (existingOpening) {
        return reply.status(400).send({ error: 'Caja ya abierta para esta fecha' });
      }

      // Create opening record
      const opening = {
        date: body.date,
        opening_balance: body.opening_balance,
        opened_by: user.sub,
        opened_by_name: user.name,
        notes: body.notes,
        created_at: new Date()
      };

      await db
        .insertInto('app_settings')
        .values({
          id: crypto.randomUUID(),
          business_id: user.business_id,
          key: `opening_${body.date}`,
          value: JSON.stringify(opening),
          updated_at: new Date()
        } as any)
        .execute();

      return reply.send({
        success: true,
        opening
      });
    } catch (error: any) {
      console.error('Error opening cash register:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Error opening cash register' });
    }
  });

  // ============================================
  // GET CASH REGISTER STATUS
  // ============================================

  fastify.get('/status', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { date = new Date().toISOString().split('T')[0] } = request.query as any;

    await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

    // Check if opened
    const opening = await db
      .selectFrom('app_settings')
      .select('value')
      .where('business_id', '=', user.business_id)
      .where('key', 'like', `opening_${date}%`)
      .executeTakeFirst();

    // Check if closed
    const closing = await db
      .selectFrom('app_settings')
      .select('value')
      .where('business_id', '=', user.business_id)
      .where('key', '=', `closing_${date}`)
      .executeTakeFirst();

    const parseValue = (val: any) => {
        if (typeof val === 'string') return JSON.parse(val);
        return val;
    };

    return reply.send({
      date,
      is_open: !!opening,
      is_closed: !!closing,
      opening: opening ? parseValue(opening.value) : null,
      closing: closing ? parseValue(closing.value) : null
    });
  });

  // ============================================
  // GET DAILY SUMMARY
  // ============================================

  fastify.get('/daily-summary', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { date = new Date().toISOString().split('T')[0] } = request.query as any;

    await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Get all transactions for the day
    const transactions = await db
      .selectFrom('transactions')
      .selectAll()
      .where('deleted_at', 'is', null)
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', endDate)
      .orderBy('created_at', 'asc')
      .execute();

    // Calculate totals
    const summary = {
      date,
      sales: {
        total: 0,
        cash: 0,
        card: 0,
        transfer: 0,
        count: 0
      },
      payments_received: {
        total: 0,
        cash: 0,
        card: 0,
        transfer: 0,
        count: 0
      },
      expenses: {
        total: 0,
        cash: 0,
        transfer: 0,
        count: 0,
        by_category: {} as { [key: string]: number }
      },
      supplier_payments: {
        total: 0,
        transfer: 0,
        count: 0
      },
      balance: 0,
      opening_balance: 0,
      closing_balance: 0
    };

    transactions.forEach(t => {
      const amount = Number(t.amount);

      if (t.type === 'sale') {
        summary.sales.total += amount;
        summary.sales.count++;
        if (t.payment_method === 'cash') summary.sales.cash += amount;
        if (t.payment_method === 'card') summary.sales.card += amount;
        if (t.payment_method === 'transfer') summary.sales.transfer += amount;
      } else if (t.type === 'payment_received') {
        summary.payments_received.total += amount;
        summary.payments_received.count++;
        if (t.payment_method === 'cash') summary.payments_received.cash += amount;
        if (t.payment_method === 'card') summary.payments_received.card += amount;
        if (t.payment_method === 'transfer') summary.payments_received.transfer += amount;
      } else if (t.type === 'expense') {
        summary.expenses.total += amount;
        summary.expenses.count++;
        if (t.payment_method === 'cash') summary.expenses.cash += amount;
        if (t.payment_method === 'transfer') summary.expenses.transfer += amount;
        
        // Group by category
        const category = t.category || 'Otros';
        summary.expenses.by_category[category] = (summary.expenses.by_category[category] || 0) + amount;
      } else if (t.type === 'supplier_payment') {
        summary.supplier_payments.total += amount;
        summary.supplier_payments.count++;
        if (t.payment_method === 'transfer') summary.supplier_payments.transfer += amount;
      }
    });

    // Calculate balance
    const total_income = summary.sales.total + summary.payments_received.total;
    const total_expenses = summary.expenses.total + summary.supplier_payments.total;
    summary.balance = total_income - total_expenses;
    summary.closing_balance = summary.opening_balance + summary.balance;

    return reply.send({
      ...summary,
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        category: t.category,
        amount: Number(t.amount),
        payment_method: t.payment_method,
        description: t.description,
        created_at: t.created_at
      }))
    });
  });

  // ============================================
  // CREATE CLOSING
  // ============================================

  fastify.post('/closing', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin') {
          return reply.code(403).send({ error: 'Only admins can create closings' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    const schema = z.object({
      date: z.string(),
      opening_balance: z.number().default(0),
      observed_cash: z.number().optional(),
      notes: z.string().optional()
    });

    try {
      const body = schema.parse(request.body);

      await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

      const startDate = new Date(body.date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(body.date);
      endDate.setHours(23, 59, 59, 999);

      // Get transactions for the day
      const transactions = await db
        .selectFrom('transactions')
        .select(['type', 'amount', 'payment_method'])
        .where('deleted_at', 'is', null)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .execute();

      // Calculate expected cash
      let expected_cash = body.opening_balance;

      transactions.forEach(t => {
        const amount = Number(t.amount);
        if (t.payment_method === 'cash') {
          if (t.type === 'sale' || t.type === 'payment_received') {
            expected_cash += amount;
          } else if (t.type === 'expense') {
            expected_cash -= amount;
          }
        }
      });

      // Check for discrepancies
      const observed_cash = body.observed_cash ?? expected_cash;
      const discrepancy = observed_cash - expected_cash;

      // Create closing record
      const closing = {
        date: body.date,
        opening_balance: body.opening_balance,
        expected_cash,
        observed_cash,
        discrepancy,
        notes: body.notes,
        created_by: user.sub,
        created_at: new Date()
      };

      // Store in app_settings
      await db
        .insertInto('app_settings')
        .values({
          id: crypto.randomUUID(),
          business_id: user.business_id,
          key: `closing_${body.date}`,
          value: JSON.stringify(closing),
          updated_at: new Date()
        } as any)
        .onConflict(oc => oc
          .column('key')
          .doUpdateSet({
            value: closing as any,
            updated_at: new Date()
          })
        )
        .execute();

      // If there's a discrepancy, create an adjustment transaction
      if (discrepancy !== 0) {
        await db
          .insertInto('transactions')
          .values({
            id: crypto.randomUUID(),
            business_id: user.business_id,
            type: discrepancy > 0 ? 'income' : 'expense',
            category: 'Ajuste de Caja',
            amount: Math.abs(discrepancy),
            payment_method: 'cash',
            description: `Ajuste por cierre del ${body.date}: ${discrepancy > 0 ? 'Sobrante' : 'Faltante'}`,
            notes: body.notes || null,
            created_by: user.sub,
            created_at: new Date()
          } as any)
          .execute();
      }

      return reply.send({
        success: true,
        closing: {
          ...closing,
          discrepancy
        }
      });
    } catch (error: any) {
      console.error('Error creating closing:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Error creating closing' });
    }
  });

  // ============================================
  // GET CLOSING HISTORY
  // ============================================

  fastify.get('/closing-history', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { from_date, to_date, limit = '30' } = request.query as any;

    await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

    const settings = await db
      .selectFrom('app_settings')
      .select(['key', 'value', 'updated_at'])
      .where('business_id', '=', user.business_id)
      .where('key', 'like', 'closing_%')
      .orderBy('key', 'desc')
      .limit(parseInt(limit))
      .execute();

    const closings = settings
      .map(s => {
        const date = s.key.replace('closing_', '');
        const val = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
        return {
          date,
          ...val,
          updated_at: s.updated_at
        };
      })
      .filter(c => {
        if (from_date && c.date < from_date) return false;
        if (to_date && c.date > to_date) return false;
        return true;
      });

    return reply.send(closings);
  });

  // ============================================
  // GET CASH IN DRAWER
  // ============================================

  fastify.get('/cash-in-drawer', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

    const todayDay = new Date().toISOString().split('T')[0];

    // Get today's opening
    const openingSetting = await db
      .selectFrom('app_settings')
      .select('value')
      .where('business_id', '=', user.business_id)
      .where('key', '=', `opening_${todayDay}`)
      .executeTakeFirst();

    let opening_balance = 0;
    if (openingSetting) {
        const val = typeof openingSetting.value === 'string' ? JSON.parse(openingSetting.value) : openingSetting.value;
        opening_balance = val.opening_balance || 0;
    }

    // Get today's cash transactions
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const transactions = await db
      .selectFrom('transactions')
      .select(['type', 'amount', 'payment_method'])
      .where('deleted_at', 'is', null)
      .where('created_at', '>=', startDate)
      .execute();

    let cash_in_drawer = opening_balance;

    transactions.forEach(t => {
      if (t.payment_method === 'cash') {
        const amount = Number(t.amount);
        if (t.type === 'sale' || t.type === 'payment_received' || t.type === 'income') {
          cash_in_drawer += amount;
        } else if (t.type === 'expense' || t.type === 'supplier_payment') {
          cash_in_drawer -= amount;
        }
      }
    });

    return reply.send({
      opening_balance,
      cash_in_drawer,
      transactions_count: transactions.filter(t => t.payment_method === 'cash').length,
      last_updated: new Date()
    });
  });
};

export default cashRegisterRoutes;

