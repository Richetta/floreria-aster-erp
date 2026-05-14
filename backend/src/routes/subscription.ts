import { FastifyInstance, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { sql } from 'kysely';
import { config } from '../config/index.js';

const MP_ACCESS_TOKEN = config.mpAccessToken || '';
const FRONTEND_URL = config.frontendUrl || 'https://mijardin-erp.vercel.app';
const BACKEND_URL = process.env.BACKEND_URL || 'https://mijardin-erp-backend.onrender.com';

// Helper: raw SQL query via pg pool
async function rawQuery(text: string, params: any[] = []) {
  const { pool } = await import('../db/index.js') as any;
  if (pool) return pool.query(text, params);
  // Fallback: use Kysely raw
  const result = await sql.raw(text).execute(db);
  return { rows: result.rows };
}

export default async function subscriptionRoutes(server: FastifyInstance) {

  // ============================================
  // GET /api/subscription/plans
  // ============================================
  server.get('/plans', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const result = await db
        .selectFrom('subscription_plans' as any)
        .selectAll()
        .where('is_active' as any, '=', true)
        .orderBy('sort_order' as any, 'asc')
        .execute();
      reply.send({ success: true, data: result });
    } catch (error: any) {
      server.log.error('Error fetching plans:', error);
      reply.code(500).send({ error: 'Failed to fetch subscription plans' });
    }
  });

  // ============================================
  // GET /api/subscription/current
  // ============================================
  server.get('/current', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const businessId = request.user.business_id;

      const subResult = await sql`
        SELECT
          s.id, s.status, s.billing_cycle,
          s.current_period_start, s.current_period_end,
          s.trial_ends_at, s.cancel_at_period_end,
          s.locked_price_monthly, s.locked_price_annually,
          s.orders_this_month, s.mp_preapproval_id,
          p.slug as plan_slug, p.name_short as plan_name,
          p.name as plan_full_name, p.description as plan_description,
          p.price_monthly, p.price_annually,
          p.max_users, p.max_products, p.max_orders_per_month,
          p.max_categories, p.features, p.badge_text
        FROM subscriptions s
        JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.business_id = ${businessId}
          AND s.status IN ('active','trial','past_due')
        LIMIT 1
      `.execute(db);
      const sub = subResult.rows[0] as any;

      // Count current usage
      const usageResult = await sql`
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE business_id = ${businessId} AND is_active = true) as current_users,
          (SELECT COUNT(*)::int FROM products WHERE business_id = ${businessId} AND is_active = true AND deleted_at IS NULL) as current_products,
          (SELECT COUNT(*)::int FROM categories WHERE business_id = ${businessId} AND is_active = true) as current_categories,
          (SELECT COUNT(*)::int FROM orders WHERE business_id = ${businessId}
            AND created_at >= date_trunc('month', CURRENT_DATE)
            AND status != 'cancelled') as current_orders
      `.execute(db);

      const usage = usageResult.rows[0] as any;

      if (!sub) {
        // Return free plan data
        const freePlan = await db
          .selectFrom('subscription_plans' as any)
          .selectAll()
          .where('slug' as any, '=', 'semilla')
          .limit(1)
          .executeTakeFirst() as any;

        reply.send({
          success: true,
          data: {
            ...(freePlan || { slug: 'semilla', name_short: 'Gratis', max_users: 1, max_products: 50, max_orders_per_month: 30, max_categories: 1 }),
            plan_slug: freePlan?.slug || 'semilla',
            plan_name: freePlan?.name_short || 'Gratis',
            status: 'free',
            ...usage
          }
        });
        return;
      }

      reply.send({ success: true, data: { ...sub, ...usage } });
    } catch (error: any) {
      server.log.error('Error fetching current subscription:', error);
      reply.code(500).send({ error: 'Failed to fetch subscription info' });
    }
  });

  // ============================================
  // GET /api/subscription/usage
  // ============================================
  server.get('/usage', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const businessId = request.user.business_id;

      const subResult2 = await sql`
        SELECT p.max_users, p.max_products, p.max_orders_per_month, p.max_categories
        FROM subscriptions s
        JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.business_id = ${businessId}
          AND s.status IN ('active','trial')
        LIMIT 1
      `.execute(db);
      const sub = subResult2.rows[0] as any;

      const usageResult = await sql`
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE business_id = ${businessId} AND is_active = true) as current_users,
          (SELECT COUNT(*)::int FROM products WHERE business_id = ${businessId} AND is_active = true AND deleted_at IS NULL) as current_products,
          (SELECT COUNT(*)::int FROM categories WHERE business_id = ${businessId} AND is_active = true) as current_categories,
          (SELECT COUNT(*)::int FROM orders WHERE business_id = ${businessId}
            AND created_at >= date_trunc('month', CURRENT_DATE)
            AND status != 'cancelled') as current_orders
      `.execute(db);

      const u = usageResult.rows[0] as any;
      const limits = sub || { max_users: 1, max_products: 50, max_orders_per_month: 30, max_categories: 1 };

      reply.send({ success: true, data: { limits: {
        users: { current: u.current_users, max: limits.max_users },
        products: { current: u.current_products, max: limits.max_products },
        orders: { current: u.current_orders, max: limits.max_orders_per_month },
        categories: { current: u.current_categories, max: limits.max_categories }
      }}});
    } catch (error: any) {
      reply.code(500).send({ error: 'Failed to fetch usage data' });
    }
  });

  // ============================================
  // POST /api/subscription/create-checkout
  // Creates MP preapproval for paid plan (with optional trial)
  // ============================================
  server.post('/create-checkout', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = request.user;
      const businessId = user.business_id;
      const { plan_slug, billing_cycle = 'monthly', include_trial = true } = request.body as any;

      if (!MP_ACCESS_TOKEN) {
        return reply.code(503).send({
          error: 'payment_not_configured',
          message: 'El sistema de pagos no está configurado aún. Contactá al administrador.'
        });
      }

      const plan = await db
        .selectFrom('subscription_plans' as any)
        .selectAll()
        .where('slug' as any, '=', plan_slug)
        .where('is_active' as any, '=', true)
        .limit(1)
        .executeTakeFirst() as any;

      if (!plan) return reply.code(404).send({ error: 'Plan not found' });

      const amount = billing_cycle === 'annually'
        ? Number(plan.price_annually)
        : Number(plan.price_monthly);
      const frequency = billing_cycle === 'annually' ? 12 : 1;

      const mpBody: any = {
        reason: `Mi Jardín ERP - Plan ${plan.name_short}`,
        payer_email: user.email,
        auto_recurring: {
          frequency,
          frequency_type: 'months',
          transaction_amount: amount,
          currency_id: 'ARS'
        },
        back_url: `${FRONTEND_URL}/suscripcion/exito`,
        notification_url: `${BACKEND_URL}/api/subscription/webhook/mercadopago`
      };

      if (include_trial && billing_cycle === 'monthly') {
        mpBody.auto_recurring.free_trial = {
          frequency: 15,
          frequency_type: 'days'
        };
      }

      const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `${businessId}-${plan_slug}-${Date.now()}`
        },
        body: JSON.stringify(mpBody)
      });

      const mpData = await mpResponse.json() as any;
      server.log.info({ mpData }, 'MP preapproval response');

      if (!mpData.init_point) {
        server.log.error({ mpData }, 'MP error');
        return reply.code(500).send({
          error: 'mp_error',
          message: 'No se pudo crear el enlace de pago',
          details: mpData
        });
      }

      // Upsert subscription record with pending preapproval
      const existing = await db
        .selectFrom('subscriptions' as any)
        .select(['id', 'plan_id'] as any)
        .where('business_id' as any, '=', businessId)
        .limit(1)
        .executeTakeFirst() as any;

      const now = new Date();
      const periodEnd = new Date(now);
      if (billing_cycle === 'annually') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 15);

      if (existing) {
        await db.updateTable('subscriptions' as any)
          .set({ mp_preapproval_id: mpData.id, updated_at: now } as any)
          .where('business_id' as any, '=', businessId)
          .execute();
      } else {
        await db.insertInto('subscriptions' as any)
          .values({
            business_id: businessId,
            plan_id: plan.id,
            status: 'trial',
            billing_cycle,
            current_period_start: now,
            current_period_end: periodEnd,
            trial_ends_at: trialEnd,
            mp_preapproval_id: mpData.id,
            created_at: now,
            updated_at: now
          } as any)
          .execute();
      }

      reply.send({
        success: true,
        data: {
          init_point: mpData.init_point,
          sandbox_init_point: mpData.sandbox_init_point,
          preapproval_id: mpData.id,
          plan: { slug: plan.slug, name: plan.name_short, amount, billing_cycle },
          trial_days: include_trial ? 15 : 0
        }
      });
    } catch (error: any) {
      server.log.error(error, 'Error creating MP checkout');
      reply.code(500).send({ error: 'Failed to create payment link' });
    }
  });

  // ============================================
  // POST /api/subscription/create-free
  // ============================================
  server.post('/create-free', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const businessId = request.user.business_id;

      const freePlan = await db
        .selectFrom('subscription_plans' as any)
        .select(['id'] as any)
        .where('slug' as any, '=', 'semilla')
        .limit(1)
        .executeTakeFirst() as any;

      if (!freePlan) return reply.code(404).send({ error: 'Free plan not found' });

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 10);

      const existing = await db
        .selectFrom('subscriptions' as any)
        .select(['id'] as any)
        .where('business_id' as any, '=', businessId)
        .limit(1)
        .executeTakeFirst();

      if (existing) {
        await db.updateTable('subscriptions' as any)
          .set({ plan_id: freePlan.id, status: 'active', billing_cycle: 'monthly', current_period_start: now, current_period_end: periodEnd, trial_ends_at: null, cancel_at_period_end: false, updated_at: now } as any)
          .where('business_id' as any, '=', businessId)
          .execute();
      } else {
        await db.insertInto('subscriptions' as any)
          .values({ business_id: businessId, plan_id: freePlan.id, status: 'active', billing_cycle: 'monthly', current_period_start: now, current_period_end: periodEnd, created_at: now, updated_at: now } as any)
          .execute();
      }

      reply.send({ success: true, data: { plan: 'semilla', status: 'active' } });
    } catch (error: any) {
      server.log.error(error, 'Error activating free plan');
      reply.code(500).send({ error: 'Failed to activate free plan' });
    }
  });

  // ============================================
  // POST /api/subscription/cancel
  // ============================================
  server.post('/cancel', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const businessId = request.user.business_id;
      const { reason = '' } = request.body as any;

      const sub = await db
        .selectFrom('subscriptions' as any)
        .selectAll()
        .where('business_id' as any, '=', businessId)
        .where('status' as any, 'in', ['active', 'trial'])
        .limit(1)
        .executeTakeFirst() as any;

      if (!sub) return reply.code(404).send({ error: 'Active subscription not found' });

      // Cancel in MercadoPago if configured
      if (sub.mp_preapproval_id && MP_ACCESS_TOKEN) {
        try {
          await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
          });
        } catch (e) {
          server.log.warn({ e }, 'Could not cancel MP subscription');
        }
      }

      await db.updateTable('subscriptions' as any)
        .set({ cancel_at_period_end: true, cancelled_at: new Date(), cancellation_reason: reason, updated_at: new Date() } as any)
        .where('business_id' as any, '=', businessId)
        .execute();

      reply.send({
        success: true,
        data: { cancelled: true, access_until: sub.current_period_end }
      });
    } catch (error: any) {
      reply.code(500).send({ error: 'Failed to cancel subscription' });
    }
  });

  // ============================================
  // POST /api/subscription/reactivate
  // ============================================
  server.post('/reactivate', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const businessId = request.user.business_id;

      const sub = await db
        .selectFrom('subscriptions' as any)
        .selectAll()
        .where('business_id' as any, '=', businessId)
        .where('cancel_at_period_end' as any, '=', true)
        .limit(1)
        .executeTakeFirst() as any;

      if (!sub) return reply.code(404).send({ error: 'No pending cancellation found' });

      if (sub.mp_preapproval_id && MP_ACCESS_TOKEN) {
        try {
          await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'authorized' })
          });
        } catch (e) {
          server.log.warn({ e }, 'Could not reactivate MP subscription');
        }
      }

      await db.updateTable('subscriptions' as any)
        .set({ cancel_at_period_end: false, cancelled_at: null, cancellation_reason: null, updated_at: new Date() } as any)
        .where('business_id' as any, '=', businessId)
        .execute();

      reply.send({ success: true, message: 'Suscripción reactivada' });
    } catch (error: any) {
      reply.code(500).send({ error: 'Failed to reactivate subscription' });
    }
  });

  // ============================================
  // GET /api/subscription/mp-status
  // ============================================
  server.get('/mp-status', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const businessId = request.user.business_id;
      const sub = await db
        .selectFrom('subscriptions' as any)
        .select(['mp_preapproval_id'] as any)
        .where('business_id' as any, '=', businessId)
        .limit(1)
        .executeTakeFirst() as any;

      if (!sub?.mp_preapproval_id || !MP_ACCESS_TOKEN) {
        return reply.send({ success: true, data: null });
      }

      const mpRes = await fetch(
        `https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`,
        { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
      );
      const mpData = await mpRes.json() as any;

      reply.send({ success: true, data: {
        mp_status: mpData.status,
        next_payment_date: mpData.next_payment_date,
        last_modified: mpData.last_modified,
        payer_email: mpData.payer_email
      }});
    } catch (error: any) {
      reply.code(500).send({ error: 'Failed to fetch MP status' });
    }
  });

  // ============================================
  // POST /api/subscription/webhook/mercadopago
  // PUBLIC — no auth
  // ============================================
  server.post('/webhook/mercadopago', async (request: any, reply: FastifyReply) => {
    try {
      const { type, data } = request.body as any;
      server.log.info({ type, data }, 'MP Webhook received');

      if (type === 'payment' && data?.id) {
        const paymentRes = await fetch(
          `https://api.mercadopago.com/v1/payments/${data.id}`,
          { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
        );
        const payment = await paymentRes.json() as any;
        const preapprovalId = payment.preapproval_id;

        if (payment.status === 'approved' && preapprovalId) {
          const sub = await db
            .selectFrom('subscriptions' as any)
            .selectAll()
            .where('mp_preapproval_id' as any, '=', preapprovalId)
            .limit(1)
            .executeTakeFirst() as any;

          if (sub) {
            const now = new Date();
            const periodEnd = new Date(now);
            if (sub.billing_cycle === 'annually') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            else periodEnd.setMonth(periodEnd.getMonth() + 1);

            await db.updateTable('subscriptions' as any)
              .set({ status: 'active', last_mp_payment_id: String(data.id), current_period_start: now, current_period_end: periodEnd, updated_at: now } as any)
              .where('id' as any, '=', sub.id)
              .execute();

            await db.insertInto('subscription_events' as any)
              .values({ subscription_id: sub.id, event_type: 'payment_success', metadata: { payment_id: data.id, amount: payment.transaction_amount } } as any)
              .execute();
          }
        } else if (['rejected', 'cancelled'].includes(payment.status) && preapprovalId) {
          await db.updateTable('subscriptions' as any)
            .set({ status: 'past_due', updated_at: new Date() } as any)
            .where('mp_preapproval_id' as any, '=', preapprovalId)
            .execute();
        }
      }

      if (type === 'subscription_preapproval' && data?.id) {
        const paRes = await fetch(
          `https://api.mercadopago.com/preapproval/${data.id}`,
          { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
        );
        const pa = await paRes.json() as any;

        if (pa.status === 'authorized') {
          await db.updateTable('subscriptions' as any)
            .set({ status: 'trial', mp_subscription_id: data.id, updated_at: new Date() } as any)
            .where('mp_preapproval_id' as any, '=', data.id)
            .execute();
        } else if (pa.status === 'cancelled') {
          await db.updateTable('subscriptions' as any)
            .set({ status: 'cancelled', cancel_at_period_end: true, updated_at: new Date() } as any)
            .where('mp_preapproval_id' as any, '=', data.id)
            .execute();
        }
      }

      reply.send({ success: true });
    } catch (error: any) {
      server.log.error(error, 'Webhook processing error');
      reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  // ============================================
  // POST /api/subscription/upgrade (direct/admin)
  // ============================================
  server.post('/upgrade', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const businessId = request.user.business_id;
      const { plan_slug, billing_cycle = 'monthly' } = request.body as any;

      if (!plan_slug) return reply.code(400).send({ error: 'plan_slug is required' });

      const plan = await db
        .selectFrom('subscription_plans' as any)
        .selectAll()
        .where('slug' as any, '=', plan_slug)
        .where('is_active' as any, '=', true)
        .limit(1)
        .executeTakeFirst() as any;

      if (!plan) return reply.code(404).send({ error: 'Plan not found' });

      const now = new Date();
      const periodEnd = new Date(now);
      if (billing_cycle === 'annually') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 15);

      const existing = await db
        .selectFrom('subscriptions' as any)
        .selectAll()
        .where('business_id' as any, '=', businessId)
        .limit(1)
        .executeTakeFirst() as any;

      if (existing) {
        await db.updateTable('subscriptions' as any)
          .set({ plan_id: plan.id, status: 'trial', billing_cycle, current_period_start: now, current_period_end: periodEnd, trial_ends_at: trialEnd, updated_at: now } as any)
          .where('business_id' as any, '=', businessId)
          .execute();
      } else {
        await db.insertInto('subscriptions' as any)
          .values({ business_id: businessId, plan_id: plan.id, status: 'trial', billing_cycle, current_period_start: now, current_period_end: periodEnd, trial_ends_at: trialEnd, created_at: now, updated_at: now } as any)
          .execute();
      }

      reply.send({ success: true, data: { plan, billing_cycle, period_end: periodEnd } });
    } catch (error: any) {
      server.log.error(error, 'Error upgrading subscription');
      reply.code(500).send({ error: 'Failed to upgrade subscription' });
    }
  });
}
