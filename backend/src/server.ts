import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import { checkDatabaseConnection } from './db/index.js';
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
await fastify.register(cors, {
  origin: config.nodeEnv === 'development' ? true : config.frontendUrl,
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
  '/health',
];

fastify.addHook('onRequest', (request, reply, done) => {
  const url = request.url.split('?')[0]; // strip query params

  // Skip public routes
  if (PUBLIC_ROUTES.includes(url) || url === '/health') {
    return done();
  }

  // Skip non-API routes
  if (!url.startsWith('/api/')) {
    return done();
  }

  // Authenticate all other API routes
  authenticate(request, reply)
    .then(() => done())
    .catch((err) => {
      console.error('[GLOBAL AUTH] Error:', err);
      done(err);
    });
});

// Global Request Logger for Troubleshooting
fastify.addHook('onRequest', (request, reply, done) => {
  console.log(`[REQUEST] ${request.method} ${request.url}`);
  done();
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
const importDataModule = await import('./routes/import-data.js');
await fastify.register(importDataModule.default || importDataModule.importRoutes, { prefix: '/api/import-data' });

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
console.log('Loading business.js...');
await fastify.register(import('./routes/business.js'), { prefix: '/api/business' });
console.log('Loading inventory.js...');
await fastify.register(import('./routes/inventory.js'), { prefix: '/api/inventory' });
console.log('Loading diagnostic.js...');
await fastify.register(import('./routes/diagnostic.js'), { prefix: '/api/admin' });

// Diagnostic Route — removed for security (was exposing config without auth)

// Global 404 Handler for Troubleshooting
fastify.setNotFoundHandler((request, reply) => {
  const version = 'vFINAL-ROBUST';
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
