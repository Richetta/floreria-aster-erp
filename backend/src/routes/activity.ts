import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';

export const activityRoutes: FastifyPluginAsync = async (fastify) => {
  // Activity schema
  const activitySchema = z.object({
    action: z.string(),
    resource_type: z.string().optional(),
    resource_id: z.string().uuid().optional(),
    details: z.record(z.any()).optional()
  });

  // ============================================
  // LOG USER ACTIVITY
  // ============================================
  fastify.post('/log', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    try {
      const body = activitySchema.parse(request.body);
      const user = request.user as any;

      // Get client info
      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];

      // Log activity
      await db
        .insertInto('user_activity')
        .values({
          user_id: user.sub,
          business_id: user.business_id,
          action: body.action,
          resource_type: body.resource_type || null,
          resource_id: body.resource_id || null,
          details: body.details ? JSON.stringify(body.details) : null,
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: new Date()
        } as any)
        .execute();

      return reply.send({ success: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // ============================================
  // GET USER ACTIVITY HISTORY
  // ============================================
  fastify.get('/history', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { limit = 50, action, resource_type, from_date, to_date } = request.query as any;

      let query = db
        .selectFrom('user_activity')
        .selectAll()
        .where('user_id', '=', user.sub)
        .orderBy('created_at desc')
        .limit(parseInt(limit, 10));

      // Filters
      if (action) {
        query = query.where('action', '=', action);
      }

      if (resource_type) {
        query = query.where('resource_type', '=', resource_type);
      }

      if (from_date) {
        query = query.where('created_at', '>=', new Date(from_date));
      }

      if (to_date) {
        query = query.where('created_at', '<=', new Date(to_date));
      }

      const activities = await query.execute();

      return reply.send({
        total: activities.length,
        activities: activities.map((a: any) => ({
          id: a.id,
          action: a.action,
          resource_type: a.resource_type,
          resource_id: a.resource_id,
          details: typeof a.details === 'string' ? JSON.parse(a.details) : a.details,
          ip_address: a.ip_address,
          created_at: a.created_at
        }))
      });
    } catch (error: any) {
      fastify.log.error({ error }, 'Get activity history error');
      throw error;
    }
  });

  // ============================================
  // GET BUSINESS ACTIVITY (ADMIN ONLY)
  // ============================================
  fastify.get('/business', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin') {
          reply.code(403).send({ error: 'Forbidden' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { limit = 100, user_id, action, from_date, to_date } = request.query as any;

      let query = db
        .selectFrom('user_activity')
        .select([
          'user_activity.id',
          'user_activity.action',
          'user_activity.resource_type',
          'user_activity.resource_id',
          'user_activity.details',
          'user_activity.ip_address',
          'user_activity.created_at',
          'users.name as user_name',
          'users.email as user_email'
        ])
        .leftJoin('users', 'users.id', 'user_activity.user_id')
        .where('user_activity.business_id', '=', user.business_id)
        .orderBy('user_activity.created_at desc')
        .limit(parseInt(limit, 10));

      // Filters
      if (user_id) {
        query = query.where('user_activity.user_id', '=', user_id);
      }

      if (action) {
        query = query.where('user_activity.action', '=', action);
      }

      if (from_date) {
        query = query.where('user_activity.created_at', '>=', new Date(from_date));
      }

      if (to_date) {
        query = query.where('user_activity.created_at', '<=', new Date(to_date));
      }

      const activities = await query.execute();

      return reply.send({
        total: activities.length,
        activities: activities.map((a: any) => ({
          id: a.id,
          action: a.action,
          resource_type: a.resource_type,
          resource_id: a.resource_id,
          details: typeof a.details === 'string' ? JSON.parse(a.details) : a.details,
          ip_address: a.ip_address,
          user_name: a.user_name,
          user_email: a.user_email,
          created_at: a.created_at
        }))
      });
    } catch (error: any) {
      fastify.log.error({ error }, 'Get business activity error');
      throw error;
    }
  });
};

export default activityRoutes;
