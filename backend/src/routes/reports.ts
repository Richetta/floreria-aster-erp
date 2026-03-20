import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';

export const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  // Date range schema
  const dateRangeSchema = z.object({
    from_date: z.string().optional(),
    to_date: z.string().optional()
  });

  // ============================================
  // SALES REPORTS
  // ============================================

  // GET SALES SUMMARY
  fastify.get('/sales/summary', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { from_date, to_date } = dateRangeSchema.parse(request.query);

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    // Build query with date filters
    let query = db
      .selectFrom('transactions')
      .select([
        db.fn.sum('amount').as('total_amount'),
        db.fn.count('id').as('total_transactions')
      ])
      .where('type', '=', 'sale')
      .where('deleted_at', 'is', null);

    if (from_date) {
      query = query.where('created_at', '>=', new Date(from_date));
    }
    if (to_date) {
      query = query.where('created_at', '<=', new Date(to_date));
    }

    const result = await query.executeTakeFirst();

    // Get sales by payment method
    let methodQuery = db
      .selectFrom('transactions')
      .select(['payment_method'])
      .select(db.fn.sum('amount').as('total_amount'))
      .select(db.fn.count('id').as('count'))
      .where('type', '=', 'sale')
      .where('deleted_at', 'is', null)
      .groupBy('payment_method');

    if (from_date) {
      methodQuery = methodQuery.where('created_at', '>=', new Date(from_date));
    }
    if (to_date) {
      methodQuery = methodQuery.where('created_at', '<=', new Date(to_date));
    }

    const byMethod = await methodQuery.execute();

    return reply.send({
      total_sales: Number(result?.total_amount) || 0,
      total_transactions: Number(result?.total_transactions) || 0,
      by_payment_method: byMethod.map(m => ({
        method: m.payment_method,
        total: Number(m.total_amount),
        count: Number(m.count)
      }))
    });
  });

  // GET SALES BY PERIOD (Daily/Monthly)
  fastify.get('/sales/by-period', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { from_date, to_date, group_by = 'day' } = request.query as any;

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    // Group by day or month
    const dateFormat = group_by === 'month' 
      ? 'YYYY-MM' 
      : 'YYYY-MM-DD';

    const result = await sql<{ period: string, total_amount: number, total_transactions: number }>`
      SELECT 
        TO_CHAR(created_at, ${dateFormat}) as period,
        SUM(amount) as total_amount,
        COUNT(*) as total_transactions
      FROM transactions
      WHERE business_id = ${user.business_id}
        AND type = 'sale'
        AND deleted_at IS NULL
        ${from_date ? sql`AND created_at >= ${new Date(from_date)}` : sql``}
        ${to_date ? sql`AND created_at <= ${new Date(to_date)}` : sql``}
      GROUP BY period
      ORDER BY period ASC
    `.execute(db);

    return reply.send(result.rows);
  });

  // ============================================
  // TOP PRODUCTS REPORT
  // ============================================

  fastify.get('/products/top', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { from_date, to_date, limit = '10' } = request.query as any;

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    // NEW: Combined query using CTEs for Order Items + POS Items
    const result = await sql<any>`
      WITH all_item_sales AS (
        -- 1. Traditional order items
        SELECT 
          oi.product_id,
          oi.quantity,
          oi.total as revenue,
          o.created_at
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.deleted_at IS NULL
          AND o.business_id = ${user.business_id}
          ${from_date ? sql`AND o.created_at >= ${new Date(from_date)}` : sql``}
          ${to_date ? sql`AND o.created_at <= ${new Date(to_date)}` : sql``}

        UNION ALL

        -- 2. POS sales items (extracted from metadata)
        SELECT 
          (item->>'product_id')::uuid as product_id,
          (item->>'quantity')::numeric as quantity,
          ((item->>'quantity')::numeric * (item->>'unit_price')::numeric) as revenue,
          t.created_at
        FROM transactions t,
             jsonb_array_elements(COALESCE(t.metadata->'items', '[]'::jsonb)) as item
        WHERE t.type = 'sale'
          AND t.deleted_at IS NULL
          AND t.business_id = ${user.business_id}
          AND item->>'product_id' IS NOT NULL
          ${from_date ? sql`AND t.created_at >= ${new Date(from_date)}` : sql``}
          ${to_date ? sql`AND t.created_at <= ${new Date(to_date)}` : sql``}
      )
      SELECT 
        ais.product_id,
        p.name as product_name,
        p.code as product_code,
        SUM(ais.quantity) as total_quantity,
        SUM(ais.revenue) as total_revenue,
        AVG(ais.revenue / ais.quantity) as avg_price
      FROM all_item_sales ais
      JOIN products p ON p.id = ais.product_id
      GROUP BY ais.product_id, p.name, p.code
      ORDER BY total_quantity DESC
      LIMIT ${parseInt(limit)}
    `.execute(db);

    return reply.send(result.rows.map((r: any) => ({
      product_id: r.product_id,
      product_name: r.product_name,
      product_code: r.product_code,
      total_quantity: Number(r.total_quantity),
      total_revenue: Number(r.total_revenue),
      avg_price: Number(r.avg_price)
    })));
  });

  // ============================================
  // TOP CUSTOMERS REPORT
  // ============================================

  fastify.get('/customers/top', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { from_date, to_date, limit = '10' } = request.query as any;

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    // NEW: Combined customer volume from Orders + POS Transactions
    const result = await sql<any>`
      WITH all_customer_sales AS (
        -- 1. Sales from Orders
        SELECT 
          customer_id,
          id as sale_id,
          total_amount
        FROM orders
        WHERE deleted_at IS NULL
          AND business_id = ${user.business_id}
          AND customer_id IS NOT NULL
          ${from_date ? sql`AND created_at >= ${new Date(from_date)}` : sql``}
          ${to_date ? sql`AND created_at <= ${new Date(to_date)}` : sql``}

        UNION ALL

        -- 2. Sales from POS Transactions
        SELECT 
          (metadata->>'customer_id')::uuid as customer_id,
          id as sale_id,
          amount as total_amount
        FROM transactions
        WHERE type = 'sale'
          AND deleted_at IS NULL
          AND business_id = ${user.business_id}
          AND metadata->>'customer_id' IS NOT NULL
          ${from_date ? sql`AND created_at >= ${new Date(from_date)}` : sql``}
          ${to_date ? sql`AND created_at <= ${new Date(to_date)}` : sql``}
      )
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.email,
        c.debt_balance,
        COUNT(acs.sale_id) as total_orders,
        SUM(acs.total_amount) as total_spent
      FROM customers c
      JOIN all_customer_sales acs ON acs.customer_id = c.id
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.phone, c.email, c.debt_balance
      ORDER BY total_spent DESC
      LIMIT ${parseInt(limit)}
    `.execute(db);

    return reply.send(result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      debt_balance: Number(r.debt_balance),
      total_orders: Number(r.total_orders),
      total_spent: Number(r.total_spent)
    })));
  });

  // ============================================
  // PROFITS REPORT
  // ============================================

  fastify.get('/profits', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { from_date, to_date } = request.query as any;

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    // Get total revenue from sales
    let revenueQuery = db
      .selectFrom('transactions')
      .select(db.fn.sum('amount').as('total_revenue'))
      .where('type', '=', 'sale')
      .where('deleted_at', 'is', null);

    if (from_date) {
      revenueQuery = revenueQuery.where('created_at', '>=', new Date(from_date));
    }
    if (to_date) {
      revenueQuery = revenueQuery.where('created_at', '<=', new Date(to_date));
    }

    const revenue = await revenueQuery.executeTakeFirst();

    // Get total expenses
    let expenseQuery = db
      .selectFrom('transactions')
      .select(db.fn.sum('amount').as('total_expenses'))
      .where('type', 'in', ['expense', 'supplier_payment'])
      .where('deleted_at', 'is', null);

    if (from_date) {
      expenseQuery = expenseQuery.where('created_at', '>=', new Date(from_date));
    }
    if (to_date) {
      expenseQuery = expenseQuery.where('created_at', '<=', new Date(to_date));
    }

    const expenses = await expenseQuery.executeTakeFirst();

    // NEW: Unified Profit calculation extracted from Order Items + POS Metadata
    const productsResult = await sql<any>`
      WITH all_item_details AS (
        -- 1. Items from traditional orders
        SELECT 
          oi.product_id,
          oi.quantity,
          oi.total as revenue,
          (oi.quantity * p.cost) as cost
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.deleted_at IS NULL
          AND o.business_id = ${user.business_id}
          ${from_date ? sql`AND o.created_at >= ${new Date(from_date)}` : sql``}
          ${to_date ? sql`AND o.created_at <= ${new Date(to_date)}` : sql``}

        UNION ALL

        -- 2. Items from POS transactions
        SELECT 
          (item->>'product_id')::uuid as product_id,
          (item->>'quantity')::numeric as quantity,
          ((item->>'quantity')::numeric * (item->>'unit_price')::numeric) as revenue,
          ((item->>'quantity')::numeric * p.cost) as cost
        FROM transactions t,
             jsonb_array_elements(COALESCE(t.metadata->'items', '[]'::jsonb)) as item
        JOIN products p ON p.id = (item->>'product_id')::uuid
        WHERE t.type = 'sale'
          AND t.deleted_at IS NULL
          AND t.business_id = ${user.business_id}
          AND item->>'product_id' IS NOT NULL
          ${from_date ? sql`AND t.created_at >= ${new Date(from_date)}` : sql``}
          ${to_date ? sql`AND t.created_at <= ${new Date(to_date)}` : sql``}
      )
      SELECT 
        aid.product_id,
        p.name as product_name,
        SUM(aid.quantity) as quantity_sold,
        SUM(aid.revenue) as total_revenue,
        SUM(aid.cost) as total_cost
      FROM all_item_details aid
      JOIN products p ON p.id = aid.product_id
      GROUP BY aid.product_id, p.name
      ORDER BY (SUM(aid.revenue) - SUM(aid.cost)) DESC
    `.execute(db);

    const productProfits = productsResult.rows.map((p: any) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      quantity_sold: Number(p.quantity_sold),
      total_revenue: Number(p.total_revenue),
      total_cost: Number(p.total_cost),
      profit: Number(p.total_revenue) - Number(p.total_cost)
    })).sort((a: any, b: any) => b.profit - a.profit);

    const totalRevenue = Number(revenue?.total_revenue) || 0;
    const totalExpenses = Number(expenses?.total_expenses) || 0;
    const totalProfit = totalRevenue - totalExpenses;

    return reply.send({
      period: {
        from: from_date || 'N/A',
        to: to_date || 'N/A'
      },
      summary: {
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        total_profit: totalProfit,
        profit_margin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0
      },
      by_product: productProfits.slice(0, 20) // Top 20 profitable products
    });
  });

  // ============================================
  // EXPORT DATA
  // ============================================

  fastify.get('/export/sales', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { from_date, to_date } = request.query as any;

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    let query = db
      .selectFrom('transactions')
      .select([
        'id',
        'type',
        'category',
        'amount',
        'payment_method',
        'description',
        'created_at'
      ])
      .where('type', '=', 'sale')
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc');

    if (from_date) {
      query = query.where('created_at', '>=', new Date(from_date));
    }
    if (to_date) {
      query = query.where('created_at', '<=', new Date(to_date));
    }

    const sales = await query.limit(1000).execute();

    // Convert to CSV
    const csv = [
      ['ID', 'Fecha', 'Tipo', 'Categoría', 'Monto', 'Método', 'Descripción'].join(','),
      ...sales.map(s => [
        s.id,
        new Date(s.created_at).toISOString().split('T')[0],
        s.type,
        s.category,
        s.amount,
        s.payment_method,
        `"${s.description || ''}"`
      ].join(','))
    ].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="ventas_${from_date || 'todo'}_${to_date || 'todo'}.csv"`);
    
    return reply.send(csv);
  });
};

export default reportsRoutes;

