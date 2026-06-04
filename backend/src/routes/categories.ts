import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';
import { logAudit } from '../utils/audit.js';


export const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  // Create category schema
  const createCategorySchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    parent_id: z.string().uuid().optional().nullable()
  });

  // Helper function to build category tree from flat list
  function buildCategoryTree(categories: any[]): any[] {
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    // First pass: create map with empty children arrays
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build parent-child relationships
    categories.forEach(cat => {
      const category = categoryMap.get(cat.id);
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        // Add to parent's children
        const parent = categoryMap.get(cat.parent_id);
        parent.children.push(category);
      } else {
        // Root category (no parent)
        rootCategories.push(category);
      }
    });

    // Sort each level by name
    const sortTree = (nodes: any[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortTree(node.children);
        }
      });
    };
    sortTree(rootCategories);

    return rootCategories;
  }

  // LIST CATEGORIES (with hierarchical tree structure)
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
    const { flat } = request.query as any; // flat=true returns flat list

    try {
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const categories = await db
        .selectFrom('categories')
        .selectAll()
        .where('business_id', '=', user.business_id)
        .where('is_active', '=', true)
        .orderBy('name', 'asc')
        .execute();

      // If flat requested, return as-is
      if (flat === 'true') {
        return reply.send(categories);
      }

      // Build hierarchical tree
      const tree = buildCategoryTree(categories);
      return reply.send(tree);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al obtener categorías' });
    }
  });

  // CREATE CATEGORY
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
      const body = createCategorySchema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        const existing = await trx
          .selectFrom('categories')
          .where('business_id', '=', user.business_id)
          .where('name', 'ilike', body.name.trim())
          .where('is_active', '=', true)
          .select(['id'])
          .executeTakeFirst();

        if (existing) {
          const errorInstance = new Error(`Ya existe una carpeta o subcarpeta con el nombre "${body.name}"`);
          (errorInstance as any).statusCode = 400;
          throw errorInstance;
        }

        const catId = randomUUID();
        const category = await trx
          .insertInto('categories')
          .values({
            id: catId,
            business_id: user.business_id,
            name: body.name,
            parent_id: body.parent_id || null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .returningAll()
          .executeTakeFirst();

        await logAudit(trx, {
          business_id: user.business_id,
          user_id: user.sub,
          action: 'create_category',
          entity_type: 'categories',
          entity_id: catId,
          details: {
            new_values: {
              name: body.name,
              parent_id: body.parent_id || null
            }
          },
          ip_address: request.ip,
          user_agent: request.headers['user-agent']
        });

        return category;
      });

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Error de validación', details: error.errors });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al crear la categoría' });
    }
  });

  // DELETE CATEGORY
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
    const { delete_products } = request.query as { delete_products?: string };
    const shouldDeleteProducts = delete_products === 'true';

    try {
      await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        const category = await trx
          .selectFrom('categories')
          .select(['name', 'parent_id'])
          .where('id', '=', id)
          .where('business_id', '=', user.business_id)
          .executeTakeFirst();

        if (!category) {
          throw new Error('Categoría no encontrada');
        }

        if (shouldDeleteProducts) {
          // Soft delete products in this category
          await trx
            .updateTable('products')
            .set({ deleted_at: new Date(), updated_at: new Date() })
            .where('category_id', '=', id)
            .where('business_id', '=', user.business_id)
            .execute();
        } else {
          // Unbind products from this category
          await trx
            .updateTable('products')
            .set({ category_id: null, updated_at: new Date() })
            .where('category_id', '=', id)
            .where('business_id', '=', user.business_id)
            .execute();
        }

        // Soft delete the category
        await trx
          .updateTable('categories')
          .set({ is_active: false, updated_at: new Date() })
          .where('id', '=', id)
          .where('business_id', '=', user.business_id)
          .execute();

        await logAudit(trx, {
          business_id: user.business_id,
          user_id: user.sub,
          action: 'delete_category',
          entity_type: 'categories',
          entity_id: id,
          details: {
            name: category.name,
            old_values: {
              name: category.name,
              parent_id: category.parent_id
            }
          },
          ip_address: request.ip,
          user_agent: request.headers['user-agent']
        });
      });

      return reply.send({ success: true });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al eliminar la categoría' });
    }
  });

  // RENAME/UPDATE CATEGORY
  fastify.patch('/:id', {
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
    const schema = z.object({
      name: z.string().min(1, 'El nombre es obligatorio'),
      parent_id: z.string().uuid().optional().nullable()
    });

    try {
      const body = schema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        const currentCategory = await trx
          .selectFrom('categories')
          .select(['name', 'parent_id'])
          .where('id', '=', id)
          .where('business_id', '=', user.business_id)
          .executeTakeFirst();

        if (!currentCategory) {
          const errorInstance = new Error('Categoría no encontrada');
          (errorInstance as any).statusCode = 404;
          throw errorInstance;
        }

        const existing = await trx
          .selectFrom('categories')
          .where('business_id', '=', user.business_id)
          .where('name', 'ilike', body.name.trim())
          .where('id', '!=', id)
          .where('is_active', '=', true)
          .select(['id'])
          .executeTakeFirst();

        if (existing) {
          const errorInstance = new Error(`Ya existe una carpeta o subcarpeta con el nombre "${body.name}"`);
          (errorInstance as any).statusCode = 400;
          throw errorInstance;
        }

        const updated = await trx
          .updateTable('categories')
          .set({
            name: body.name,
            parent_id: body.parent_id !== undefined ? body.parent_id : undefined,
            updated_at: new Date()
          })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirst();

        if (updated) {
          const oldValues: Record<string, any> = {};
          const newValues: Record<string, any> = {};

          if (currentCategory.name !== body.name) {
            oldValues.name = currentCategory.name;
            newValues.name = body.name;
          }
          if (body.parent_id !== undefined && currentCategory.parent_id !== body.parent_id) {
            oldValues.parent_id = currentCategory.parent_id;
            newValues.parent_id = body.parent_id;
          }

          if (Object.keys(oldValues).length > 0) {
            await logAudit(trx, {
              business_id: user.business_id,
              user_id: user.sub,
              action: 'update_category',
              entity_type: 'categories',
              entity_id: id,
              details: {
                name: currentCategory.name,
                old_values: oldValues,
                new_values: newValues
              },
              ip_address: request.ip,
              user_agent: request.headers['user-agent']
            });
          }
        }

        return updated;
      });

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Error de validación', details: error.errors });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al actualizar la categoría' });
    }
  });
};

export default categoriesRoutes;
