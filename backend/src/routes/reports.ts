import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db';

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

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

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
      query = query.where('created_at', '>=', from_date);
    }
    if (to_date) {
      query = query.where('created_at', '<=', to_date);
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
      methodQuery = methodQuery.where('created_at', '>=', from_date);
    }
    if (to_date) {
      methodQuery = methodQuery.where('created_at', '<=', to_date);
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

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    // Group by day or month
    const dateFormat = group_by === 'month' 
      ? 'YYYY-MM' 
      : 'YYYY-MM-DD';

    const query = `
      SELECT 
        TO_CHAR(created_at, '${dateFormat}') as period,
        SUM(amount) as total_amount,
        COUNT(*) as total_transactions
      FROM transactions
      WHERE business_id = '${user.business_id}'
        AND type = 'sale'
        AND deleted_at IS NULL
        ${from_date ? `AND created_at >= '${from_date}'` : ''}
        ${to_date ? `AND created_at <= '${to_date}'` : ''}
      GROUP BY period
      ORDER BY period ASC
    `;

    const result = await db.executeQuery(query);

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

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    // Get top selling products from order_items
    let query = db
      .selectFrom('order_items')
      .innerJoin('products', 'products.id', 'order_items.product_id')
      .select([
        'product_id',
        'products.name as product_name',
        'products.code as product_code',
        db.fn.sum('order_items.quantity').as('total_quantity'),
        db.fn.sum('order_items.total').as('total_revenue'),
        db.fn.avg('order_items.unit_price').as('avg_price')
      ])
      .where('order_items.deleted_at', 'is', null)
      .groupBy(['product_id', 'products.name', 'products.code'])
      .orderBy('total_quantity', 'desc')
      .limit(parseInt(limit));

    if (from_date) {
      query = query
        .innerJoin('orders', 'orders.id', 'order_items.order_id')
        .where('orders.created_at', '>=', from_date);
      
      if (to_date) {
        query = query.where('orders.created_at', '<=', to_date);
      }
    }

    const result = await query.execute();

    return reply.send(result.map(r => ({
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

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    let query = db
      .selectFrom('customers')
      .select([
        'id',
        'name',
        'phone',
        'email',
        'debt_balance',
        db.fn.count('orders.id').as('total_orders'),
        db.fn.sum('orders.total_amount').as('total_spent')
      ])
      .leftJoin('orders', 'orders.customer_id', 'customers.id')
      .where('customers.deleted_at', 'is', null)
      .groupBy(['customers.id', 'customers.name', 'customers.phone', 'customers.email', 'customers.debt_balance'])
      .orderBy('total_spent', 'desc')
      .limit(parseInt(limit));

    if (from_date) {
      query = query.where('orders.created_at', '>=', from_date);
    }
    if (to_date) {
      query = query.where('orders.created_at', '<=', to_date);
    }

    const result = await query.execute();

    return reply.send(result.map(r => ({
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

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

    // Get total revenue from sales
    let revenueQuery = db
      .selectFrom('transactions')
      .select(db.fn.sum('amount').as('total_revenue'))
      .where('type', '=', 'sale')
      .where('deleted_at', 'is', null);

    if (from_date) {
      revenueQuery = revenueQuery.where('created_at', '>=', from_date);
    }
    if (to_date) {
      revenueQuery = revenueQuery.where('created_at', '<=', to_date);
    }

    const revenue = await revenueQuery.executeTakeFirst();

    // Get total expenses
    let expenseQuery = db
      .selectFrom('transactions')
      .select(db.fn.sum('amount').as('total_expenses'))
      .where('type', 'in', ['expense', 'supplier_payment'])
      .where('deleted_at', 'is', null);

    if (from_date) {
      expenseQuery = expenseQuery.where('created_at', '>=', from_date);
    }
    if (to_date) {
      expenseQuery = expenseQuery.where('created_at', '<=', to_date);
    }

    const expenses = await expenseQuery.executeTakeFirst();

    // Get product profits (revenue - cost)
    let productsQuery = db
      .selectFrom('order_items')
      .innerJoin('products', 'products.id', 'order_items.product_id')
      .select([
        'product_id',
        'products.name as product_name',
        db.fn.sum('order_items.quantity').as('quantity_sold'),
        db.fn.sum('order_items.total').as('total_revenue'),
        db.fn.sum(db`order_items.quantity * products.cost`).as('total_cost')
      ])
      .where('order_items.deleted_at', 'is', null)
      .groupBy(['product_id', 'products.name']);

    if (from_date) {
      productsQuery = productsQuery
        .innerJoin('orders', 'orders.id', 'order_items.order_id')
        .where('orders.created_at', '>=', from_date);
      
      if (to_date) {
        productsQuery = productsQuery.where('orders.created_at', '<=', to_date);
      }
    }

    const products = await productsQuery.execute();

    const productProfits = products.map(p => ({
      product_id: p.product_id,
      product_name: p.product_name,
      quantity_sold: Number(p.quantity_sold),
      total_revenue: Number(p.total_revenue),
      total_cost: Number(p.total_cost),
      profit: Number(p.total_revenue) - Number(p.total_cost)
    })).sort((a, b) => b.profit - a.profit);

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

    await db.executeQuery(`SET LOCAL app.current_business_id = '${user.business_id}'`);

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
      query = query.where('created_at', '>=', from_date);
    }
    if (to_date) {
      query = query.where('created_at', '<=', to_date);
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
