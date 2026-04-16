// @ts-nocheck
import { FastifyInstance, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { db } from '../db/index.js';

// ============================================
// SUBSCRIPTION ROUTES
// ============================================
// Handles subscription management, upgrades,
// downgrades, cancellations, and MercadoPago webhook
// ============================================

export default async function subscriptionRoutes(server: FastifyInstance) {

  // ============================================
  // GET /api/subscription/plans
  // List all available plans with features
  // ============================================
  server.get('/plans', {
    preHandler: [authenticate]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const query = `
        SELECT 
          id, slug, name, name_short, description,
          price_monthly, price_annually,
          max_users, max_products, max_orders_per_month, 
          max_categories, max_afip_invoices, max_branches,
          features, badge_text, badge_color, sort_order
        FROM subscription_plans
        WHERE is_active = true
        ORDER BY sort_order ASC
      `;

      const result = await server.db.query(query);

      reply.send({
        success: true,
        data: result.rows
      });
    } catch (error: any) {
      server.log.error('Error fetching plans:', error);
      reply.code(500).send({ error: 'Failed to fetch subscription plans' });
    }
  });

  // ============================================
  // GET /api/subscription/current
  // Get current subscription info for business
  // ============================================
  server.get('/current', {
    preHandler: [authenticate]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const user = request.user;
      const businessId = user.business_id;

      const query = `
        SELECT 
          s.id,
          s.status,
          s.billing_cycle,
          s.current_period_start,
          s.current_period_end,
          s.trial_ends_at,
          s.cancel_at_period_end,
          s.locked_price_monthly,
          s.locked_price_annually,
          s.orders_this_month,
          s.last_order_count_reset,
          p.slug as plan_slug,
          p.name_short as plan_name,
          p.name as plan_full_name,
          p.description as plan_description,
          p.price_monthly,
          p.price_annually,
          p.max_users,
          p.max_products,
          p.max_orders_per_month,
          p.max_categories,
          p.features,
          p.badge_text,
          -- Current usage
          (SELECT COUNT(*)::int FROM users WHERE business_id = $1 AND is_active = true) as current_users,
          (SELECT COUNT(*)::int FROM products WHERE business_id = $1 AND is_active = true) as current_products,
          (SELECT COUNT(*)::int FROM categories WHERE business_id = $1 AND is_active = true) as current_categories,
          (SELECT COUNT(*)::int FROM orders WHERE business_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE) AND status != 'cancelled') as current_orders
        FROM subscriptions s
        JOIN subscription_plans p ON s.plan_id = p.id
        WHERE s.business_id = $1
        AND s.status IN ('active', 'trial')
        LIMIT 1
      `;

      const result = await server.db.query(query, [businessId]);
      const subscription = result.rows[0];

      if (!subscription) {
        // No subscription, return free plan info
        const freePlanQuery = `
          SELECT 
            id, slug, name, name_short, description,
            price_monthly, price_annually,
            max_users, max_products, max_orders_per_month, max_categories,
            features
          FROM subscription_plans
          WHERE slug = 'semilla'
          LIMIT 1
        `;

        const freePlanResult = await server.db.query(freePlanQuery);
        const freePlan = freePlanResult.rows[0];

        reply.send({
          success: true,
          data: {
            ...freePlan,
            status: 'free',
            current_users: 0,
            current_products: 0,
            current_categories: 0,
            current_orders: 0
          }
        });
        return;
      }

      reply.send({
        success: true,
        data: subscription
      });
    } catch (error: any) {
      server.log.error('Error fetching current subscription:', error);
      reply.code(500).send({ error: 'Failed to fetch subscription info' });
    }
  });

  // ============================================
  // POST /api/subscription/upgrade
  // Upgrade to a higher plan
  // ============================================
  server.post('/upgrade', {
    preHandler: [authenticate]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const user = request.user;
      const businessId = user.business_id;
      const { plan_slug, billing_cycle = 'monthly', locked_price = null } = request.body as any;

      if (!plan_slug) {
        return reply.code(400).send({ error: 'plan_slug is required' });
      }

      // Get target plan
      const planQuery = `
        SELECT id, slug, price_monthly, price_annually, name_short
        FROM subscription_plans
        WHERE slug = $1 AND is_active = true
        LIMIT 1
      `;

      const planResult = await server.db.query(planQuery, [plan_slug]);
      const targetPlan = planResult.rows[0];

      if (!targetPlan) {
        return reply.code(404).send({ error: 'Plan not found' });
      }

      // Check if upgrading or creating first subscription
      const currentSubQuery = `
        SELECT id, plan_id, status, billing_cycle
        FROM subscriptions
        WHERE business_id = $1
        LIMIT 1
      `;

      const currentSubResult = await server.db.query(currentSubQuery, [businessId]);
      const currentSub = currentSubResult.rows[0];

      const now = new Date();
      const periodEnd = new Date(now);

      if (billing_cycle === 'annually') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      let subscriptionId;

      if (currentSub) {
        // Update existing subscription
        const updateQuery = `
          UPDATE subscriptions
          SET 
            plan_id = $1,
            status = 'active',
            billing_cycle = $2,
            current_period_start = $3,
            current_period_end = $4,
            locked_price_monthly = $5,
            locked_price_annually = $6,
            updated_at = NOW()
          WHERE business_id = $7
          RETURNING id
        `;

        const updateResult = await server.db.query(updateQuery, [
          targetPlan.id,
          billing_cycle,
          now,
          periodEnd,
          locked_price ? (billing_cycle === 'monthly' ? locked_price : null) : null,
          locked_price ? (billing_cycle === 'annually' ? locked_price : null) : null,
          businessId
        ]);

        subscriptionId = updateResult.rows[0]?.id;

        // Log event
        await server.db.query(
          `INSERT INTO subscription_events (subscription_id, event_type, old_plan_id, new_plan_id, metadata)
           VALUES ($1, 'upgraded', $2, $3, $4)`,
          [subscriptionId, currentSub.plan_id, targetPlan.id, JSON.stringify({ billing_cycle, locked_price })]
        );
      } else {
        // Create new subscription (first time)
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + 14); // 14 day trial

        const insertQuery = `
          INSERT INTO subscriptions (
            business_id, plan_id, status, billing_cycle,
            current_period_start, current_period_end,
            trial_ends_at, locked_price_monthly, locked_price_annually
          ) VALUES ($1, $2, 'trial', $3, $4, $5, $6, $7, $8)
          RETURNING id
        `;

        const insertResult = await server.db.query(insertQuery, [
          businessId,
          targetPlan.id,
          billing_cycle,
          now,
          periodEnd,
          trialEnd,
          locked_price ? (billing_cycle === 'monthly' ? locked_price : null) : null,
          locked_price ? (billing_cycle === 'annually' ? locked_price : null) : null
        ]);

        subscriptionId = insertResult.rows[0].id;

        // Log event
        await server.db.query(
          `INSERT INTO subscription_events (subscription_id, event_type, new_plan_id, metadata)
           VALUES ($1, 'created', $2, $3)`,
          [subscriptionId, targetPlan.id, JSON.stringify({ billing_cycle, locked_price })]
        );
      }

      reply.send({
        success: true,
        data: {
          subscription_id: subscriptionId,
          plan: targetPlan,
          billing_cycle,
          period_end: periodEnd,
          message: `Successfully upgraded to ${targetPlan.name_short} plan`
        }
      });
    } catch (error: any) {
      server.log.error('Error upgrading subscription:', error);
      reply.code(500).send({ error: 'Failed to upgrade subscription' });
    }
  });

  // ============================================
  // POST /api/subscription/cancel
  // Cancel subscription (effective at period end)
  // ============================================
  server.post('/cancel', {
    preHandler: [authenticate]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const user = request.user;
      const businessId = user.business_id;
      const { reason = '' } = request.body as any;

      const updateQuery = `
        UPDATE subscriptions
        SET 
          cancel_at_period_end = true,
          cancelled_at = NOW(),
          cancellation_reason = $1,
          updated_at = NOW()
        WHERE business_id = $2
        AND status IN ('active', 'trial')
        RETURNING id, current_period_end
      `;

      const result = await server.db.query(updateQuery, [reason, businessId]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Active subscription not found' });
      }

      // Log event
      await server.db.query(
        `INSERT INTO subscription_events (subscription_id, event_type, metadata)
         VALUES ($1, 'cancelled', $2)`,
        [result.rows[0].id, JSON.stringify({ reason })]
      );

      reply.send({
        success: true,
        data: {
          cancelled: true,
          access_until: result.rows[0].current_period_end,
          message: 'Subscription cancelled. You\'ll retain access until the end of your billing period.'
        }
      });
    } catch (error: any) {
      server.log.error('Error cancelling subscription:', error);
      reply.code(500).send({ error: 'Failed to cancel subscription' });
    }
  });

  // ============================================
  // POST /api/subscription/reactivate
  // Reactivate a cancelled subscription
  // ============================================
  server.post('/reactivate', {
    preHandler: [authenticate]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const user = request.user;
      const businessId = user.business_id;

      const updateQuery = `
        UPDATE subscriptions
        SET 
          cancel_at_period_end = false,
          cancelled_at = NULL,
          cancellation_reason = NULL,
          updated_at = NOW()
        WHERE business_id = $1
        AND cancel_at_period_end = true
        RETURNING id
      `;

      const result = await server.db.query(updateQuery, [businessId]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'No pending cancellation found' });
      }

      // Log event
      await server.db.query(
        `INSERT INTO subscription_events (subscription_id, event_type)
         VALUES ($1, 'reactivated')`,
        [result.rows[0].id]
      );

      reply.send({
        success: true,
        message: 'Subscription reactivated successfully'
      });
    } catch (error: any) {
      server.log.error('Error reactivating subscription:', error);
      reply.code(500).send({ error: 'Failed to reactivate subscription' });
    }
  });

  // ============================================
  // POST /api/subscription/downgrade
  // Downgrade to a lower plan
  // ============================================
  server.post('/downgrade', {
    preHandler: [authenticate]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const user = request.user;
      const businessId = user.business_id;
      const { plan_slug } = request.body as any;

      if (!plan_slug) {
        return reply.code(400).send({ error: 'plan_slug is required' });
      }

      // Get target plan
      const planQuery = `
        SELECT id, slug, name_short
        FROM subscription_plans
        WHERE slug = $1 AND is_active = true
        LIMIT 1
      `;

      const planResult = await server.db.query(planQuery, [plan_slug]);
      const targetPlan = planResult.rows[0];

      if (!targetPlan) {
        return reply.code(404).send({ error: 'Plan not found' });
      }

      // Get current subscription
      const currentSubQuery = `
        SELECT id, plan_id
        FROM subscriptions
        WHERE business_id = $1
        AND status IN ('active', 'trial')
        LIMIT 1
      `;

      const currentSubResult = await server.db.query(currentSubQuery, [businessId]);
      const currentSub = currentSubResult.rows[0];

      if (!currentSub) {
        return reply.code(404).send({ error: 'Active subscription not found' });
      }

      // Downgrade effective at next period
      // For simplicity, we'll do it immediately
      // In production, you'd queue this for period end
      const updateQuery = `
        UPDATE subscriptions
        SET 
          plan_id = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `;

      const result = await server.db.query(updateQuery, [targetPlan.id, currentSub.id]);

      // Log event
      await server.db.query(
        `INSERT INTO subscription_events (subscription_id, event_type, old_plan_id, new_plan_id)
         VALUES ($1, 'downgraded', $2, $3)`,
        [currentSub.id, currentSub.plan_id, targetPlan.id]
      );

      reply.send({
        success: true,
        data: {
          message: `Downgraded to ${targetPlan.name_short} plan`
        }
      });
    } catch (error: any) {
      server.log.error('Error downgrading subscription:', error);
      reply.code(500).send({ error: 'Failed to downgrade subscription' });
    }
  });

  // ============================================
  // GET /api/subscription/usage
  // Get current usage vs limits
  // ============================================
  server.get('/usage', {
    preHandler: [authenticate]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const user = request.user;
      const businessId = user.business_id;

      const query = `
        SELECT 
          s.orders_this_month,
          p.max_users,
          p.max_products,
          p.max_orders_per_month,
          p.max_categories,
          -- Current counts
          (SELECT COUNT(*)::int FROM users WHERE business_id = $1 AND is_active = true) as current_users,
          (SELECT COUNT(*)::int FROM products WHERE business_id = $1 AND is_active = true) as current_products,
          (SELECT COUNT(*)::int FROM categories WHERE business_id = $1 AND is_active = true) as current_categories,
          (SELECT COUNT(*)::int FROM orders WHERE business_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE) AND status != 'cancelled') as current_orders
        FROM subscriptions s
        JOIN subscription_plans p ON s.plan_id = p.id
        WHERE s.business_id = $1
        AND s.status IN ('active', 'trial')
        LIMIT 1
      `;

      const result = await server.db.query(query, [businessId]);

      if (result.rows.length === 0) {
        // Free plan limits
        reply.send({
          success: true,
          data: {
            plan: 'semilla',
            limits: {
              users: { current: 0, max: 1 },
              products: { current: 0, max: 50 },
              orders: { current: 0, max: 30 },
              categories: { current: 0, max: 1 }
            }
          }
        });
        return;
      }

      const row = result.rows[0];

      reply.send({
        success: true,
        data: {
          limits: {
            users: { current: row.current_users, max: row.max_users },
            products: { current: row.current_products, max: row.max_products },
            orders: { current: row.current_orders || row.orders_this_month, max: row.max_orders_per_month },
            categories: { current: row.current_categories, max: row.max_categories }
          }
        }
      });
    } catch (error: any) {
      server.log.error('Error fetching usage:', error);
      reply.code(500).send({ error: 'Failed to fetch usage data' });
    }
  });

  // ============================================
  // POST /api/subscription/webhook/mercadopago
  // MercadoPago payment webhook
  // ============================================
  server.post('/webhook/mercadopago', async (request: any, reply: FastifyReply) => {
    try {
      const { type, data } = request.body as any;

      server.log.info('MercadoPago webhook received:', { type, data });

      if (type === 'payment') {
        const paymentId = data.id;

        // Verify payment with MercadoPago API
        // In production, use the MercadoPago SDK
        const payment = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}?access_token=${process.env.MP_ACCESS_TOKEN}`
        ).then(res => res.json());

        if (payment.status === 'approved') {
          // Update subscription
          await server.db.query(
            `UPDATE subscriptions 
             SET last_mp_payment_id = $1,
                 status = 'active'
             WHERE mp_subscription_id = $2`,
            [paymentId, payment.subscription_id || payment.metadata?.subscription_id]
          );

          // Log event
          await server.db.query(
            `INSERT INTO subscription_events (subscription_id, event_type, metadata)
             SELECT id, 'payment_success', $1
             FROM subscriptions
             WHERE mp_subscription_id = $2
             LIMIT 1`,
            [JSON.stringify({ payment_id: paymentId, amount: payment.transaction_amount }),
            payment.subscription_id || payment.metadata?.subscription_id]
          );
        } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
          // Mark as past_due
          await server.db.query(
            `UPDATE subscriptions 
             SET status = 'past_due'
             WHERE mp_subscription_id = $1`,
            [payment.subscription_id || payment.metadata?.subscription_id]
          );
        }
      }

      if (type === 'subscription_preapproval') {
        // Subscription created/updated
        const preapprovalId = data.id;
        server.log.info('Subscription pre-approval:', preapprovalId);
      }

      reply.send({ success: true });
    } catch (error: any) {
      server.log.error('Error processing MercadoPago webhook:', error);
      reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  // ============================================
  // POST /api/subscription/create-mercadopago
  // Create MercadoPago subscription/preapproval
  // ============================================
  server.post('/create-mercadopago', {
    preHandler: [authenticate]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const user = request.user;
      const businessId = user.business_id;
      const { plan_slug, billing_cycle = 'monthly' } = request.body as any;

      // Get plan
      const planQuery = `
        SELECT id, slug, price_monthly, price_annually, name_short
        FROM subscription_plans
        WHERE slug = $1 AND is_active = true
        LIMIT 1
      `;

      const planResult = await server.db.query(planQuery, [plan_slug]);
      const plan = planResult.rows[0];

      if (!plan) {
        return reply.code(404).send({ error: 'Plan not found' });
      }

      // Calculate amount
      const amount = billing_cycle === 'annually' ? plan.price_annually : plan.price_monthly;

      // Create MercadoPago preapproval
      // In production, use the MercadoPago SDK
      const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: `Mi Jardín ERP - ${plan.name_short} Plan`,
          payer_email: user.email,
          auto_recurring: {
            frequency: billing_cycle === 'annually' ? 12 : 1,
            frequency_type: billing_cycle === 'annually' ? 'months' : 'months',
            transaction_amount: Number(amount),
            currency_id: 'ARS'
          },
          back_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription/success`,
          status: 'pending'
        })
      });

      const mpData = await mpResponse.json();

      if (!mpData.init_point) {
        return reply.code(500).send({
          error: 'Failed to create MercadoPago subscription',
          details: mpData
        });
      }

      reply.send({
        success: true,
        data: {
          init_point: mpData.init_point, // Redirect URL for payment
          preapproval_id: mpData.id,
          plan: plan
        }
      });
    } catch (error: any) {
      server.log.error('Error creating MercadoPago subscription:', error);
      reply.code(500).send({ error: 'Failed to create payment link' });
    }
  });
}
