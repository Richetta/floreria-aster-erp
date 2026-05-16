import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import { checkDatabaseConnection, setBusinessId } from './db/index.js';
import { authenticate } from './middleware/auth.js';

console.log('--- SERVER INITIALIZING ---');
const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'debug' : 'info'
  },
  bodyLimit: 50 * 1024 * 1024 // 50MB limit for large bulk-imports
});

// Register plugins
console.log('Registering CORS...');
const allowedOrigins = config.frontendUrl.split(',').map(o => o.trim());
await fastify.register(cors, {
  origin: config.nodeEnv === 'development' ? true : allowedOrigins,
  credentials: true
});

console.log('Registering JWT...');
await fastify.register(jwt, {
  secret: config.jwtSecret,
  sign: {
    expiresIn: '7d' // Token valid for 7 days
  }
});

console.log('Registering Multipart...');
await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Rate Limiting - Protection against brute force and DDoS
console.log('Registering Rate Limit...');
await fastify.register(rateLimit, {
  max: 100, // 100 requests
  timeWindow: '1 minute', // per minute
  allowList: ['127.0.0.1', 'localhost'], // Whitelist localhost for development
  errorResponseBuilder: (req, context) => ({
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${Math.ceil((context as any).afterMs / 1000)} seconds.`,
    statusCode: 429
  }),
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true
  }
});

// Health check
fastify.get('/health', async (request, reply) => {
  try {
    const dbStatus = await checkDatabaseConnection();
    const dbUrl = config.databaseUrl || '';
    const maskedDbUrl = dbUrl.replace(/:[^:@]+@/, ':***@').replace(/\/[^/]+$/, '/***');

    return {
      status: dbStatus ? 'ok' : 'error',
      database: dbStatus ? 'connected' : 'disconnected',
      dbHost: dbUrl.split('@')[1]?.split(':')[0],
      timestamp: new Date().toISOString(),
      env: config.nodeEnv
    };
  } catch (error: any) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
});

// ============================================
// GLOBAL AUTH — applies to all /api/* routes
// Skips public routes that don't need authentication.
// ============================================

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/subscription/webhook/mercadopago', // MercadoPago webhook needs to receive callbacks
  '/api/users/invitations/accept', // Allow users to accept invitations without login
  '/api/health',
  '/health', // Support both paths
];

fastify.addHook('onRequest', async (request, reply) => {
  const url = request.url.split('?')[0]; // strip query params

  // Skip public routes
  if (PUBLIC_ROUTES.includes(url)) {
    return;
  }

  // Skip non-API routes
  if (!url.startsWith('/api/')) {
    return;
  }

  // Skip auth routes (they handle their own logic)
  if (url.startsWith('/api/auth') || url.startsWith('/api/subscription/webhook')) {
    return;
  }

  try {
    await request.jwtVerify();
    const user = request.user as any;
    
    if (!user || !user.business_id) {
      console.error('[AUTH DEBUG] ❌ Token valid but missing business_id:', user);
      return reply.code(401).send({ error: 'Invalid session context' });
    }

    // NOTE: We DO NOT set RLS context here using db.execute() because it's unreliable 
    // across different connections in the pool. 
    // RLS context must be set inside each route's db.connection() or db.transaction() block.
    console.log('[AUTH DEBUG] ✅ Authorized:', user.email, 'Business:', user.business_id);
    
  } catch (err: any) {
    console.error('[AUTH DEBUG] ❌ JWT Verification failed for:', request.url, 'Error:', err.message);
    return reply.code(401).send({ error: 'Unauthorized', details: err.message });
  }
});

  // Simple request logger
  fastify.addHook('onRequest', async (request, _reply) => {
    console.log(`[REQUEST] ${request.method} ${request.url}`);
  });

// API Routes
console.log('Registering Routes...');
console.log('Loading auth.js...');
await fastify.register(import('./routes/auth.js'), { prefix: '/api/auth' });
console.log('Loading users.js...');
await fastify.register(import('./routes/users.js'), { prefix: '/api/users' });
console.log('Loading products.js...');
await fastify.register(import('./routes/products.js'), { prefix: '/api/products' });
console.log('Loading customers.js...');
await fastify.register(import('./routes/customers.js'), { prefix: '/api/customers' });
console.log('Loading orders.js...');
await fastify.register(import('./routes/orders.js'), { prefix: '/api/orders' });
console.log('Loading transactions.js...');
await fastify.register(import('./routes/transactions.js'), { prefix: '/api/transactions' });
console.log('Loading packages.js...');
await fastify.register(import('./routes/packages.js'), { prefix: '/api/packages' });
console.log('Loading suppliers.js...');
await fastify.register(import('./routes/suppliers.js'), { prefix: '/api/suppliers' });
console.log('Loading waste.js...');
await fastify.register(import('./routes/waste.js'), { prefix: '/api/waste' });
console.log('Loading reports.js...');
await fastify.register(import('./routes/reports.js'), { prefix: '/api/reports' });
console.log('Loading import-data.js...');
await fastify.register(import('./routes/import-data.js'), { prefix: '/api/import-data' });

console.log('Loading live-cart.js...');
await fastify.register(import('./routes/live-cart.js'), { prefix: '/api/live-cart' });

console.log('Loading custom-filters.js...');
await fastify.register(import('./routes/custom-filters.js'), { prefix: '/api/custom-filters' });

// EMERGENCY TEST ROUTE
fastify.post('/api/import-data/direct-test', async () => ({ status: 'direct-ok' }));
console.log('Loading cash-register.js...');
await fastify.register(import('./routes/cash-register.js'), { prefix: '/api/cash-register' });
console.log('Loading stock.js...');
await fastify.register(import('./routes/stock.js'), { prefix: '/api/stock' });
console.log('Loading reminders.js...');
await fastify.register(import('./routes/reminders.js'), { prefix: '/api/reminders' });
console.log('Loading activity.js...');
await fastify.register(import('./routes/activity.js'), { prefix: '/api/activity' });
console.log('Loading categories.js...');
await fastify.register(import('./routes/categories.js'), { prefix: '/api/categories' });
console.log('Loading brands.js...');
await fastify.register(import('./routes/brands.js'), { prefix: '/api/brands' });
console.log('Loading business.js...');
await fastify.register(import('./routes/business.js'), { prefix: '/api/business' });
console.log('Loading inventory.js...');
await fastify.register(import('./routes/inventory.js'), { prefix: '/api/inventory' });
console.log('Loading comments.js...');
await fastify.register(import('./routes/comments.js'), { prefix: '/api/comments' });
console.log('Loading diagnostic.js...');
await fastify.register(import('./routes/diagnostic.js'), { prefix: '/api/admin' });
console.log('Loading subscription.js...');
await fastify.register(import('./routes/subscription.js'), { prefix: '/api/subscription' });
console.log('Loading calendar.js...');
await fastify.register(import('./routes/calendar.js'), { prefix: '/api/calendar' });

// Diagnostic Route — removed for security (was exposing config without auth)

fastify.setNotFoundHandler((request, reply) => {
  const version = 'vFINAL-DEPLOYED';
  console.log(`[404] Route not found: ${request.method} ${request.url} (Version: ${version})`);
  reply.code(404).send({
    error: 'Not Found',
    message: `Route ${request.method}:${request.url} not found (${version})`,
    statusCode: 404
  });
});

// Global Error Handler
fastify.setErrorHandler((error: any, request, reply) => {
  console.error('[SERVER ERROR]:', error);
  fastify.log.error(error);

  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: error.message,
      details: error.validation
    });
  }

  const isDev = config.nodeEnv === 'development';
  return reply.status(500).send({
    error: 'Internal Server Error',
    message: isDev ? error.message : 'Ocurrió un error interno. Intenta de nuevo.',
    stack: isDev ? error.stack : undefined,
    hint: isDev ? 'Check the backend terminal for [SERVER ERROR] logs' : undefined
  });
});

// Start server
const start = async () => {
  try {
    console.log('--- STARTING SERVER ---');

    // Run emergency migrations
    const { runEmergencyMigrations, runGoogleCalendarMigrations, runSubscriptionMigrations } = await import('./db/migrations.js');
    await runEmergencyMigrations();
    await runGoogleCalendarMigrations();
    await runSubscriptionMigrations();

    console.log(`Starting Fastify on port ${config.port}...`);
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 Server running at http://localhost:${config.port}`);
  } catch (err) {
    console.error('FAILED TO START SERVER:', err);
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
