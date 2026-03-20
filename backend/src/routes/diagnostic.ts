import { FastifyPluginAsync } from 'fastify';
import { sql } from 'kysely';
import { db } from '../db/index.js';

export const diagnosticRoutes: FastifyPluginAsync = async (fastify) => {
  // DB HEALTH CHECK (Detect Locks)
  fastify.get('/db-health', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin') {
          return reply.status(403).send({ error: 'Only admins can access diagnostics' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    try {
      // 1. Check active locks
      const locks = await sql`
        SELECT 
          a.pid,
          a.usename,
          a.query,
          a.state,
          a.query_start,
          age(now(), a.query_start) as duration,
          l.locktype,
          l.mode,
          l.granted
        FROM pg_stat_activity a
        JOIN pg_locks l ON a.pid = l.pid
        WHERE a.query != '<IDLE>' 
          AND a.pid != pg_backend_pid()
          AND age(now(), a.query_start) > interval '5 seconds'
        ORDER BY a.query_start ASC
      `.execute(db);

      // 2. Check total connections
      const connections = await sql`
        SELECT count(*) as total_connections FROM pg_stat_activity;
      `.execute(db);

      // 3. Simple ping
      const ping = await sql`SELECT 1 as ok`.execute(db);

      return reply.send({
        status: ping.rows.length > 0 ? 'connected' : 'error',
        timestamp: new Date().toISOString(),
        total_connections: Number((connections.rows[0] as any)?.total_connections || 0),
        active_long_queries: locks.rows,
        summary: locks.rows.length > 0 
          ? `Detected ${locks.rows.length} queries running for more than 5 seconds.` 
          : 'Database is healthy. No long-running locks detected.'
      });
    } catch (error: any) {
      console.error('[DIAGNOSTIC] Error checking DB health:', error);
      return reply.status(500).send({ 
        error: 'Error checking database health', 
        details: error.message 
      });
    }
  });

  // PING
  fastify.get('/ping', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
};

export default diagnosticRoutes;
