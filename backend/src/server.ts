import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';

const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'debug' : 'info'
  }
});

// Register plugins
await fastify.register(cors, {
  origin: config.nodeEnv === 'development' ? true : config.frontendUrl,
  credentials: true
});

await fastify.register(jwt, {
  secret: config.jwtSecret,
  sign: {
    expiresIn: '15m' // Access token expires in 15 minutes
  }
});

// Rate Limiting - Protection against brute force and DDoS
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
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// API Routes
await fastify.register(import('./routes/auth.js'), { prefix: '/api/auth' });
await fastify.register(import('./routes/users.js'), { prefix: '/api/users' });
await fastify.register(import('./routes/products.js'), { prefix: '/api/products' });
await fastify.register(import('./routes/customers.js'), { prefix: '/api/customers' });
await fastify.register(import('./routes/orders.js'), { prefix: '/api/orders' });
await fastify.register(import('./routes/transactions.js'), { prefix: '/api/transactions' });
await fastify.register(import('./routes/packages.js'), { prefix: '/api/packages' });
await fastify.register(import('./routes/suppliers.js'), { prefix: '/api/suppliers' });
await fastify.register(import('./routes/waste.js'), { prefix: '/api/waste' });
await fastify.register(import('./routes/reports.js'), { prefix: '/api/reports' });
await fastify.register(import('./routes/import.js'), { prefix: '/api/import' });
await fastify.register(import('./routes/cash-register.js'), { prefix: '/api/cash-register' });
await fastify.register(import('./routes/stock.js'), { prefix: '/api/stock' });
await fastify.register(import('./routes/reminders.js'), { prefix: '/api/reminders' });

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 Server running at http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
