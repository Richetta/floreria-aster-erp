import { FastifyRequest, FastifyReply } from 'fastify';

// ============================================
// SUBSCRIPTION MIDDLEWARE
// ============================================
// Feature gating and limit checking for
// subscription-based access control
// ============================================

// Helper: Get current count for a resource
async function getCurrentCount(businessId: string, resourceType: string, db: any) {
  let query = '';
  
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

  const result = await db.executeQuery(query, [businessId]);
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

  for (const limit of limits) {
    if (currentLimit <= limit.current) {
      return limit.suggest;
    }
  }

  return 'jardin'; 
}

// ============================================
// MIDDLEWARE: REQUIRE FEATURE
// ============================================

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

      const db = (request.server as any).db;
      if (!db) return;

      const subscription = await db.selectFrom('subscriptions')
        .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
        .select(['subscription_plans.features', 'subscription_plans.name_short', 'subscription_plans.slug'])
        .where('subscriptions.business_id', '=', businessId)
        .where('subscriptions.status', 'in', ['active', 'trial'])
        .executeTakeFirst();

      if (!subscription) {
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
        return;
      }

      const features = subscription.features as Record<string, any>;
      const hasFeature = features[feature] === true || (typeof features[feature] === 'string' && features[feature] !== 'false');

      if (!hasFeature) {
        const suggestedPlan = getSuggestedPlanForFeature(feature);

        return reply.code(403).send({
          error: 'Feature Not Available',
          message: `The feature "${feature}" is not available in your current plan (${subscription.name_short})`,
          requiresUpgrade: true,
          currentPlan: subscription.slug,
          currentPlanName: subscription.name_short,
          requestedFeature: feature,
          suggestedPlan,
          upgradeUrl: '/subscription/upgrade'
        });
      }
    } catch (error) {
      console.error('Error in requireFeature middleware:', error);
      return;
    }
  };
}

// ============================================
// MIDDLEWARE: CHECK LIMIT
// ============================================

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

      const db = (request.server as any).db;
      if (!db) return;

      const subscription = await db.selectFrom('subscriptions')
        .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
        .select([
          'subscription_plans.max_users', 
          'subscription_plans.max_products', 
          'subscription_plans.max_orders_per_month', 
          'subscription_plans.max_categories',
          'subscription_plans.slug',
          'subscription_plans.name_short'
        ])
        .where('subscriptions.business_id', '=', businessId)
        .where('subscriptions.status', 'in', ['active', 'trial'])
        .executeTakeFirst();

      if (!subscription) {
        const freeLimits: Record<string, number> = {
          'users': 1,
          'products': 50,
          'orders': 30,
          'categories': 1
        };

        const limit = freeLimits[limitType] || 0;
        const current = await getCurrentCount(businessId, limitType, db);

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

      const limitField = `max_${limitType}` as keyof typeof subscription;
      const limit = subscription[limitField] as number | null;

      if (limit === null || limit === undefined) {
        return;
      }

      const current = await getCurrentCount(businessId, limitType, db);

      if (current >= limit) {
        const suggestedPlan = getSuggestedPlanForLimit(limitType, limit);

        return reply.code(429).send({
          error: 'Limit Reached',
          message: `You've reached your plan limit: ${current}/${limit} ${limitType}`,
          limitReached: true,
          limit,
          current,
          resourceType: limitType,
          currentPlan: subscription.slug,
          currentPlanName: subscription.name_short,
          suggestedPlan,
          upgradeUrl: '/subscription/upgrade'
        });
      }
    } catch (error) {
      console.error('Error in checkLimit middleware:', error);
      return;
    }
  };
}

// ============================================
// MIDDLEWARE: REQUIRE ACTIVE SUBSCRIPTION
// ============================================

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

      const db = (request.server as any).db;
      if (!db) return;

      const subscription = await db.selectFrom('subscriptions')
        .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
        .select(['subscriptions.id', 'subscription_plans.slug', 'subscription_plans.name_short', 'subscriptions.current_period_end', 'subscriptions.trial_ends_at'])
        .where('subscriptions.business_id', '=', businessId)
        .where('subscriptions.status', 'in', ['active', 'trial'])
        .executeTakeFirst();

      if (!subscription) {
        return reply.code(402).send({
          error: 'Subscription Required',
          message: 'This feature requires an active subscription',
          requiresSubscription: true,
          suggestedPlan: 'florecer',
          upgradeUrl: '/subscription/upgrade'
        });
      }

      const now = new Date();
      if (subscription.current_period_end && new Date(subscription.current_period_end) < now) {
        return reply.code(402).send({
          error: 'Subscription Expired',
          message: 'Your subscription has expired. Please renew to continue.',
          subscriptionExpired: true,
          currentPlan: subscription.slug,
          expiredAt: subscription.current_period_end,
          renewUrl: '/subscription/renew'
        });
      }

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

export function incrementOrderCount() {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    reply.raw.on('finish', async () => {
      try {
        if (reply.statusCode >= 200 && reply.statusCode < 300) {
          const user = request.user as any;
          const businessId = user.business_id;

          if (!businessId) return;

          const db = (request.server as any).db;
          if (db) {
            await db.updateTable('subscriptions')
              .set({ orders_this_month: (eb: any) => eb('orders_this_month', '+', 1) })
              .where('business_id', '=', businessId)
              .execute();
          }
        }
      } catch (error) {
        console.error('Error incrementing order count:', error);
      }
    });

    return;
  };
}

// ============================================
// HELPER: GET SUBSCRIPTION INFO
// ============================================

export async function getSubscriptionInfo(businessId: string, db: any) {
  try {
    const subscription = await db.selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
      .selectAll('subscriptions')
      .select([
        'subscription_plans.slug as plan_slug',
        'subscription_plans.name_short as plan_name',
        'subscription_plans.name as plan_full_name',
        'subscription_plans.price_monthly',
        'subscription_plans.price_annually',
        'subscription_plans.max_users',
        'subscription_plans.max_products',
        'subscription_plans.max_orders_per_month',
        'subscription_plans.max_categories',
        'subscription_plans.features',
        'subscription_plans.badge_text'
      ])
      .where('subscriptions.business_id', '=', businessId)
      .where('subscriptions.status', 'in', ['active', 'trial'])
      .executeTakeFirst();

    if (!subscription) return null;

    const current_users = await getCurrentCount(businessId, 'users', db);
    const current_products = await getCurrentCount(businessId, 'products', db);
    const current_categories = await getCurrentCount(businessId, 'categories', db);

    return {
      ...subscription,
      current_users,
      current_products,
      current_categories
    };
  } catch (error) {
    console.error('Error getting subscription info:', error);
    return null;
  }
}
