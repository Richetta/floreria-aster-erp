import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { sql } from 'kysely';

export const auditLogsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET LAST 20 AUDIT LOGS FOR WORKSPACE
  fastify.get('/', {
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
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const logs = await db
        .selectFrom('audit_logs')
        .leftJoin('users', 'users.id', 'audit_logs.user_id')
        .select([
          'audit_logs.id',
          'audit_logs.business_id',
          'audit_logs.user_id',
          'audit_logs.action',
          'audit_logs.entity_type',
          'audit_logs.entity_id',
          'audit_logs.details',
          'audit_logs.ip_address',
          'audit_logs.user_agent',
          'audit_logs.created_at',
          'users.name as user_name',
          'users.email as user_email'
        ])
        .where('audit_logs.business_id', '=', user.business_id)
        .where('audit_logs.entity_type', 'in', ['products', 'categories', 'customers', 'suppliers'])
        .orderBy('audit_logs.created_at', 'desc')
        .limit(20)
        .execute();

      return reply.send(logs);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al obtener el historial de cambios' });
    }
  });

  // ROLLBACK AUDIT LOG ENTRY
  fastify.post('/:id/rollback', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin' && user.role !== 'owner') {
          reply.code(403).send({ error: 'Forbidden: Requiere rol Administrador o Dueño' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    try {
      const result = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        // Fetch the audit log entry
        const log = await trx
          .selectFrom('audit_logs')
          .selectAll()
          .where('id', '=', id)
          .where('business_id', '=', user.business_id)
          .executeTakeFirst();

        if (!log) {
          throw new Error('Registro de auditoría no encontrado');
        }

        const details = log.details as any;
        const entityId = log.entity_id;
        const entityType = log.entity_type;
        const action = log.action;

        if (!entityId || !entityType) {
          throw new Error('Faltan detalles de la entidad para realizar la reversión');
        }

        console.log(`[ROLLBACK] Reversing log ${id}: ${action} on ${entityType} (${entityId})`);

        if (action.startsWith('update_')) {
          const oldValues = details.old_values;
          if (!oldValues || Object.keys(oldValues).length === 0) {
            throw new Error('No hay valores anteriores registrados para revertir');
          }

          // Clean values (remove metadata/timestamps that shouldn't be overridden if they are null or not columns)
          const fieldsToSet: Record<string, any> = {};
          for (const [key, val] of Object.entries(oldValues)) {
            if (key !== 'id' && key !== 'business_id' && key !== 'created_at' && key !== 'updated_at') {
              fieldsToSet[key] = val;
            }
          }

          if (entityType === 'products') {
            await trx.updateTable('products').set({ ...fieldsToSet, updated_at: new Date() } as any).where('id', '=', entityId).execute();
          } else if (entityType === 'categories') {
            await trx.updateTable('categories').set({ ...fieldsToSet, updated_at: new Date() } as any).where('id', '=', entityId).execute();
          } else if (entityType === 'customers') {
            await trx.updateTable('customers').set({ ...fieldsToSet, updated_at: new Date() } as any).where('id', '=', entityId).execute();
          } else if (entityType === 'suppliers') {
            await trx.updateTable('suppliers').set({ ...fieldsToSet, updated_at: new Date() } as any).where('id', '=', entityId).execute();
          } else {
            throw new Error(`Reversión no soportada para la entidad ${entityType}`);
          }
        } 
        else if (action.startsWith('create_')) {
          // Reverting creation = deleting the item (soft delete if available, hard delete if not)
          if (entityType === 'products') {
            await trx.updateTable('products').set({ deleted_at: new Date(), is_active: false } as any).where('id', '=', entityId).execute();
          } else if (entityType === 'categories') {
            await trx.updateTable('categories').set({ is_active: false } as any).where('id', '=', entityId).execute();
          } else if (entityType === 'customers') {
            await trx.updateTable('customers').set({ deleted_at: new Date(), is_active: false } as any).where('id', '=', entityId).execute();
          } else if (entityType === 'suppliers') {
            await trx.updateTable('suppliers').set({ deleted_at: new Date(), is_active: false } as any).where('id', '=', entityId).execute();
          } else {
            throw new Error(`Reversión de creación no soportada para la entidad ${entityType}`);
          }
        } 
        else if (action.startsWith('delete_')) {
          // Reverting deletion = restoring the item
          if (entityType === 'products') {
            await trx.updateTable('products').set({ deleted_at: null, is_active: true } as any).where('id', '=', entityId).execute();
          } else if (entityType === 'categories') {
            await trx.updateTable('categories').set({ is_active: true } as any).where('id', '=', entityId).execute();
          } else if (entityType === 'customers') {
            await trx.updateTable('customers').set({ deleted_at: null, is_active: true } as any).where('id', '=', entityId).execute();
          } else if (entityType === 'suppliers') {
            await trx.updateTable('suppliers').set({ deleted_at: null, is_active: true } as any).where('id', '=', entityId).execute();
          } else {
            throw new Error(`Reversión de eliminación no soportada para la entidad ${entityType}`);
          }
        }

        // Delete the audit log entry or log the rollback?
        // It is better to delete this log entry so that it disappears from the history and doesn't pollute it
        await trx.deleteFrom('audit_logs').where('id', '=', id).execute();

        return { success: true };
      });

      return reply.send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message || 'Error al revertir el cambio' });
    }
  });
};

export default auditLogsRoutes;
