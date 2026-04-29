import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';

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

      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const existing = await db
        .selectFrom('categories')
        .where('business_id', '=', user.business_id)
        .where('name', 'ilike', body.name.trim())
        .where('is_active', '=', true)
        .select(['id'])
        .executeTakeFirst();

      if (existing) {
        return reply.status(400).send({ error: `Ya existe una carpeta o subcarpeta con el nombre "${body.name}"` });
      }

      const result = await db
        .insertInto('categories')
        .values({
          id: randomUUID(),
          business_id: user.business_id,
          name: body.name,
          parent_id: body.parent_id || null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        } as any)
        .returningAll()
        .executeTakeFirst();

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

      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const existing = await db
        .selectFrom('categories')
        .where('business_id', '=', user.business_id)
        .where('name', 'ilike', body.name.trim())
        .where('id', '!=', id)
        .where('is_active', '=', true)
        .select(['id'])
        .executeTakeFirst();

      if (existing) {
        return reply.status(400).send({ error: `Ya existe una carpeta o subcarpeta con el nombre "${body.name}"` });
      }

      const result = await db
        .updateTable('categories')
        .set({
          name: body.name,
          parent_id: body.parent_id !== undefined ? body.parent_id : undefined,
          updated_at: new Date()
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      if (!result) {
        return reply.status(404).send({ error: 'Categoría no encontrada' });
      }

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
