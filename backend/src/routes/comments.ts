import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';

export const commentsRoutes: FastifyPluginAsync = async (fastify) => {
  // Common schema for comments
  const commentSchema = z.object({
    entity_type: z.string(),
    entity_id: z.string().uuid(),
    content: z.string().min(1)
  });

  // GET COMMENTS FOR AN ENTITY
  fastify.get('/:entityType/:entityId', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { entityType, entityId } = request.params as { entityType: string, entityId: string };

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const comments = await db
      .selectFrom('internal_comments as c')
      .innerJoin('users as u', 'c.user_id', 'u.id')
      .select([
        'c.id',
        'c.content',
        'c.created_at',
        'u.name as user_name',
        'c.user_id'
      ])
      .where('c.entity_type', '=', entityType)
      .where('c.entity_id', '=', entityId)
      .orderBy('c.created_at', 'asc')
      .execute();

    return reply.send(comments);
  });

  // CREATE COMMENT
  fastify.post('/', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    try {
      const body = commentSchema.parse(request.body);
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const result = await db
        .insertInto('internal_comments')
        .values({
          id: randomUUID(),
          business_id: user.business_id,
          entity_type: body.entity_type,
          entity_id: body.entity_id,
          user_id: user.sub,
          content: body.content,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returningAll()
        .executeTakeFirst();

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // DELETE COMMENT
  fastify.delete('/:id', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    // Only creator or admin/owner can delete
    const comment = await db
      .selectFrom('internal_comments')
      .select(['user_id'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!comment) {
      return reply.status(404).send({ error: 'Comment not found' });
    }

    if (comment.user_id !== user.sub && user.role !== 'admin' && user.role !== 'owner') {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    await db
      .deleteFrom('internal_comments')
      .where('id', '=', id)
      .execute();

    return reply.send({ success: true });
  });
};

export default commentsRoutes;
