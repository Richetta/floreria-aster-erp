// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';

// ============================================
// SUBSCRIPTION MIDDLEWARE
// ============================================
// Feature gating and limit checking for
// subscription-based access control
// ============================================

// Helper: Get active subscription for a business
async function getActiveSubscription(businessId: string) {
  const query = `
    SELECT 
      s.*,
      p.slug as plan_slug,
      p.name_short as plan_name,
      p.features,
      p.max_users,
      p.max_products,
      p.max_orders_per_month,
      p.max_categories,
      p.max_afip_invoices,
      p.max_branches
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.business_id = $1
    AND s.status IN ('active', 'trial')
    LIMIT 1
  `;

  // @ts-ignore - Fastify instance type
  const result = await this?.query?.(query, [businessId]) ||
    // Fallback if this is not bound correctly
    await (global as any).db?.query(query, [businessId]);

  return result?.rows?.[0] || null;
}

// Helper: Get current count for a resource
async function getCurrentCount(businessId: string, resourceType: string) {
  let query = '';
  const params: any[] = [businessId];

  switch (resourceType) {
    case 'users':
      query = 'SELECT COUNT(*)::int FROM users WHERE business_id = $1 AND is_active = true';
      break;
    case 'products':
      query = 'SELECT COUNT(*)::int FROM products WHERE business_id = $1 AND is_active = true';
      break;
    case 'orders':
      // Orders this month
      query = `
        SELECT COUNT(*)::int 
        FROM orders 
        WHERE business_id = $1 
        AND created_at >= date_trunc('month', CURRENT_DATE)
        AND status NOT IN ('cancelled')
      `;
      break;
    case 'categories':
      query = 'SELECT COUNT(*)::int FROM categories WHERE business_id = $1 AND is_active = true';
      break;
    default:
      return 0;
  }

  const result = await (global as any).db?.query(query, params);
  return result?.rows?.[0]?.count || 0;
}

// Helper: Map feature to suggested plan
function getSuggestedPlanForFeature(feature: string): string {
  const featurePlanMap: Record<string, string> = {
    'reports': 'florecer',
    'cash_register': 'florecer',
    'waste_management': 'florecer',
    'barcode': 'florecer',
    'calendar_view': 'florecer',
    'export_csv': 'florecer',
    'import_csv': 'florecer',
    'reminders': 'florecer',
    'logistics': 'florecer',
    'ocr_pricing': 'crecimiento',
    'packages': 'crecimiento',
    'supplier_purchases': 'crecimiento',
    'auto_restock': 'crecimiento',
    'crm_full': 'crecimiento',
    'stock_movements': 'crecimiento',
    'afip_integration': 'crecimiento',
    'mercadopago_integration': 'crecimiento',
    'multi_branch': 'jardin',
    'api_access': 'jardin',
    'white_label': 'jardin'
  };

  return featurePlanMap[feature] || 'florecer';
}

// Helper: Suggest upgrade plan when limit reached
function getSuggestedPlanForLimit(limitType: string, currentLimit: number): string {
  const limitPlanMap: Record<string, { current: number, suggest: string }[]> = {
    'users': [
      { current: 1, suggest: 'florecer' },
      { current: 5, suggest: 'crecimiento' },
      { current: 15, suggest: 'jardin' }
    ],
    'products': [
      { current: 50, suggest: 'florecer' },
      { current: 500, suggest: 'crecimiento' },
      { current: 2000, suggest: 'jardin' }
    ],
    'orders': [
      { current: 30, suggest: 'florecer' },
      { current: 200, suggest: 'crecimiento' }
    ],
    'categories': [
      { current: 1, suggest: 'florecer' },
      { current: 10, suggest: 'crecimiento' }
    ]
  };

  const limits = limitPlanMap[limitType];
  if (!limits) return 'florecer';

  // Find the next tier up
  for (const limit of limits) {
    if (currentLimit <= limit.current) {
      return limit.suggest;
    }
  }

  return 'jardin'; // Default to highest
}

// ============================================
// MIDDLEWARE: REQUIRE FEATURE
// ============================================

/**
 * Check if the business has access to a specific feature.
 * 
 * Usage:
 *   preHandler: [authenticate, requireFeature('reports')]
 * 
 * Returns 403 if feature not available
 */
export function requireFeature(feature: string) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as any;
      const businessId = user.business_id;

      if (!businessId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'business_id not found in token'
        });
      }

      // Get subscription
      const subQuery = `
        SELECT s.*, p.slug as plan_slug, p.features
        FROM subscriptions s
        JOIN subscription_plans p ON s.plan_id = p.id
        WHERE s.business_id = $1
        AND s.status IN ('active', 'trial')
        LIMIT 1
      `;

      const result = await (request.server as any).db?.query(subQuery, [businessId]);
      const subscription = result?.rows?.[0];

      // No subscription? Only basic features
      if (!subscription) {
        // Check if feature is basic (available in free plan)
        const basicFeatures = ['pos', 'kanban'];
        if (!basicFeatures.includes(feature)) {
          return reply.code(402).send({
            error: 'Subscription Required',
            message: 'This feature requires an active subscription',
            requiresSubscription: true,
            suggestedPlan: 'florecer',
            upgradeUrl: '/subscription/upgrade'
          });
        }
        return; // Basic feature, allow
      }

      // Check if feature is enabled
      const features = subscription.features as Record<string, any>;
      const hasFeature = features[feature] === true ||
        (typeof features[feature] === 'string' && features[feature] !== 'false');

      if (!hasFeature) {
        const suggestedPlan = getSuggestedPlanForFeature(feature);

        return reply.code(403).send({
          error: 'Feature Not Available',
          message: `The feature "${feature}" is not available in your current plan (${subscription.plan_name})`,
          requiresUpgrade: true,
          currentPlan: subscription.plan_slug,
          currentPlanName: subscription.plan_name,
          requestedFeature: feature,
          suggestedPlan,
          upgradeUrl: '/subscription/upgrade',
          plans: {
            semilla: 'Plan Gratuito',
            florecer: 'Plan Profesional',
            crecimiento: 'Plan Business',
            jardin: 'Plan Enterprise'
          }
        });
      }

      // Feature available, continue
    } catch (error) {
      console.error('Error in requireFeature middleware:', error);
      // On error, allow request (fail open) but log
      return;
    }
  };
}

// ============================================
// MIDDLEWARE: CHECK LIMIT
// ============================================

/**
 * Check if the business has reached a resource limit.
 * 
 * Usage:
 *   preHandler: [authenticate, checkLimit('products')]
 * 
 * Returns 429 if limit reached
 */
export function checkLimit(limitType: 'users' | 'products' | 'orders' | 'categories') {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as any;
      const businessId = user.business_id;

      if (!businessId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'business_id not found in token'
        });
      }

      // Get subscription limits
      const subQuery = `
        SELECT s.*, p.slug as plan_slug, p.name_short as plan_name,
               p.max_users, p.max_products, p.max_orders_per_month, p.max_categories
        FROM subscriptions s
        JOIN subscription_plans p ON s.plan_id = p.id
        WHERE s.business_id = $1
        AND s.status IN ('active', 'trial')
        LIMIT 1
      `;

      const result = await (request.server as any).db?.query(subQuery, [businessId]);
      const subscription = result?.rows?.[0];

      // No subscription? Apply free tier limits
      if (!subscription) {
        const freeLimits: Record<string, number> = {
          'users': 1,
          'products': 50,
          'orders': 30,
          'categories': 1
        };

        const limit = freeLimits[limitType] || 0;
        const current = await getCurrentCount(businessId, limitType);

        if (current >= limit) {
          return reply.code(429).send({
            error: 'Limit Reached',
            message: `You've reached the limit of ${limit} ${limitType} on the Free plan`,
            limitReached: true,
            limit,
            current,
            resourceType: limitType,
            suggestedPlan: 'florecer',
            upgradeUrl: '/subscription/upgrade'
          });
        }
        return;
      }

      // Check limit
      const limitField = `max_${limitType}` as keyof typeof subscription;
      const limit = subscription[limitField] as number | null;

      // NULL = unlimited
      if (limit === null || limit === undefined) {
        return;
      }

      // Get current count
      const current = await getCurrentCount(businessId, limitType);

      if (current >= limit) {
        const suggestedPlan = getSuggestedPlanForLimit(limitType, limit);

        return reply.code(429).send({
          error: 'Limit Reached',
          message: `You've reached your plan limit: ${current}/${limit} ${limitType}`,
          limitReached: true,
          limit,
          current,
          resourceType: limitType,
          currentPlan: subscription.plan_slug,
          currentPlanName: subscription.plan_name,
          suggestedPlan,
          upgradeUrl: '/subscription/upgrade'
        });
      }

      // Within limit, continue
    } catch (error) {
      console.error('Error in checkLimit middleware:', error);
      // On error, allow request (fail open)
      return;
    }
  };
}

// ============================================
// MIDDLEWARE: REQUIRE ACTIVE SUBSCRIPTION
// ============================================

/**
 * Require ANY active subscription (not just a feature).
 * 
 * Usage:
 *   preHandler: [authenticate, requireActiveSubscription()]
 */
export function requireActiveSubscription() {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as any;
      const businessId = user.business_id;

      if (!businessId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'business_id not found in token'
        });
      }

      const query = `
        SELECT s.id, p.slug as plan_slug, p.name_short as plan_name, 
               s.current_period_end, s.trial_ends_at
        FROM subscriptions s
        JOIN subscription_plans p ON s.plan_id = p.id
        WHERE s.business_id = $1
        AND s.status IN ('active', 'trial')
        LIMIT 1
      `;

      const result = await (request.server as any).db?.query(query, [businessId]);
      const subscription = result?.rows?.[0];

      if (!subscription) {
        return reply.code(402).send({
          error: 'Subscription Required',
          message: 'This feature requires an active subscription',
          requiresSubscription: true,
          suggestedPlan: 'florecer',
          upgradeUrl: '/subscription/upgrade'
        });
      }

      // Check if expired
      const now = new Date();
      if (subscription.current_period_end && new Date(subscription.current_period_end) < now) {
        return reply.code(402).send({
          error: 'Subscription Expired',
          message: 'Your subscription has expired. Please renew to continue.',
          subscriptionExpired: true,
          currentPlan: subscription.plan_slug,
          expiredAt: subscription.current_period_end,
          renewUrl: '/subscription/renew'
        });
      }

      // Check if trial expired
      if (subscription.trial_ends_at && new Date(subscription.trial_ends_at) < now) {
        return reply.code(402).send({
          error: 'Trial Expired',
          message: 'Your free trial has ended. Choose a plan to continue.',
          trialExpired: true,
          trialEndedAt: subscription.trial_ends_at,
          plansUrl: '/subscription/plans'
        });
      }

    } catch (error) {
      console.error('Error in requireActiveSubscription middleware:', error);
      return;
    }
  };
}

// ============================================
// MIDDLEWARE: INCREMENT ORDER COUNT
// ============================================

/**
 * Increment the order count for the business (call after order creation).
 * 
 * Usage:
 *   preHandler: [authenticate, incrementOrderCount()]
 */
export function incrementOrderCount() {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    // This runs AFTER the route handler via onRequest vs onSend
    // We'll use a hook on the response
    reply.hook('onSend', async () => {
      try {
        const user = request.user as any;
        const businessId = user.business_id;

        if (!businessId) return;

        await (request.server as any).db?.query(
          'UPDATE subscriptions SET orders_this_month = orders_this_month + 1 WHERE business_id = $1',
          [businessId]
        );
      } catch (error) {
        console.error('Error incrementing order count:', error);
      }
    });
  };
}

// ============================================
// HELPER: GET SUBSCRIPTION INFO
// ============================================

/**
 * Get full subscription info for a business.
 * Use this in route handlers, not as middleware.
 */
export async function getSubscriptionInfo(businessId: string, db: any) {
  try {
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
        p.slug as plan_slug,
        p.name_short as plan_name,
        p.name as plan_full_name,
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
        (SELECT COUNT(*)::int FROM categories WHERE business_id = $1 AND is_active = true) as current_categories
      FROM subscriptions s
      JOIN subscription_plans p ON s.plan_id = p.id
      WHERE s.business_id = $1
      AND s.status IN ('active', 'trial')
      LIMIT 1
    `;

    const result = await db.query(query, [businessId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting subscription info:', error);
    return null;
  }
}
