import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';

export const brandsRoutes: FastifyPluginAsync = async (fastify) => {

  // ============================================
  // LIST BRANDS
  // ============================================
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
      const brands = await db
        .selectFrom('brands')
        .select([
          'brands.id',
          'brands.business_id',
          'brands.name',
          'brands.created_at',
          'brands.updated_at'
        ])
        .where('brands.business_id', '=', user.business_id)
        .orderBy('brands.name', 'asc')
        .execute();

      return reply.send(brands);
    } catch (error: any) {
      console.error('Error fetching brands:', error);
      return reply.status(500).send({
        error: 'Error al obtener marcas',
        message: error.message
      });
    }
  });

  // ============================================
  // GET SINGLE BRAND
  // ============================================
  fastify.get('/:id', {
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

    try {
      const brand = await db
        .selectFrom('brands')
        .selectAll()
        .where('id', '=', id)
        .where('business_id', '=', user.business_id)
        .executeTakeFirst();

      if (!brand) {
        return reply.status(404).send({ error: 'Marca no encontrada' });
      }

      return reply.send(brand);
    } catch (error: any) {
      console.error('Error fetching brand:', error);
      return reply.status(500).send({
        error: 'Error al obtener marca',
        message: error.message
      });
    }
  });

  // ============================================
  // CREATE BRAND
  // ============================================
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

    const createBrandSchema = z.object({
      name: z.string().min(1, 'El nombre es obligatorio').trim()
    });

    try {
      const body = createBrandSchema.parse(request.body);

      // Check if brand already exists (case-insensitive)
      const existing = await db
        .selectFrom('brands')
        .select('id')
        .where('business_id', '=', user.business_id)
        .where('name', 'ilike', body.name)
        .executeTakeFirst();

      if (existing) {
        return reply.status(409).send({
          error: 'Marca duplicada',
          message: `Ya existe una marca con el nombre "${body.name}"`
        });
      }

      const brand = await db
        .insertInto('brands')
        .values({
          id: randomUUID(),
          business_id: user.business_id,
          name: body.name,
          created_at: new Date(),
          updated_at: new Date()
        } as any)
        .returning([
          'id',
          'business_id',
          'name',
          'created_at',
          'updated_at'
        ])
        .executeTakeFirst();

      return reply.status(201).send(brand);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Error de validación',
          details: error.errors
        });
      }

      // Handle unique constraint violation
      if (error.code === '23505') {
        return reply.status(409).send({
          error: 'Marca duplicada',
          message: `Ya existe una marca con ese nombre`
        });
      }

      console.error('Error creating brand:', error);
      return reply.status(500).send({
        error: 'Error al crear marca',
        message: error.message
      });
    }
  });

  // ============================================
  // UPDATE BRAND
  // ============================================
  fastify.put('/:id', {
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

    const updateBrandSchema = z.object({
      name: z.string().min(1, 'El nombre es obligatorio').trim()
    });

    try {
      const body = updateBrandSchema.parse(request.body);

      const brand = await db
        .updateTable('brands')
        .set({
          name: body.name,
          updated_at: new Date()
        })
        .where('id', '=', id)
        .where('business_id', '=', user.business_id)
        .returning([
          'id',
          'business_id',
          'name',
          'created_at',
          'updated_at'
        ])
        .executeTakeFirst();

      if (!brand) {
        return reply.status(404).send({ error: 'Marca no encontrada' });
      }

      return reply.send(brand);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Error de validación',
          details: error.errors
        });
      }

      if (error.code === '23505') {
        return reply.status(409).send({
          error: 'Marca duplicada',
          message: `Ya existe una marca con ese nombre`
        });
      }

      console.error('Error updating brand:', error);
      return reply.status(500).send({
        error: 'Error al actualizar marca',
        message: error.message
      });
    }
  });

  // ============================================
  // DELETE BRAND
  // ============================================
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

    try {
      // Check if brand has products associated
      const productCount = await db
        .selectFrom('products')
        .select(db.fn.count('id').as('count'))
        .where('brand_id', '=', id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

      if (productCount && Number(productCount.count) > 0) {
        return reply.status(409).send({
          error: 'No se puede eliminar',
          message: `Esta marca tiene ${productCount.count} producto(s) asociado(s). Reasigna los productos a otra marca antes de eliminar.`,
          productCount: Number(productCount.count)
        });
      }

      const brand = await db
        .deleteFrom('brands')
        .where('id', '=', id)
        .where('business_id', '=', user.business_id)
        .returning('id')
        .executeTakeFirst();

      if (!brand) {
        return reply.status(404).send({ error: 'Marca no encontrada' });
      }

      return reply.send({ success: true, message: 'Marca eliminada correctamente' });
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      return reply.status(500).send({
        error: 'Error al eliminar marca',
        message: error.message
      });
    }
  });

  // ============================================
  // GET BRAND WITH PRODUCT COUNT
  // ============================================
  fastify.get('/:id/stats', {
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

    try {
      const brand = await db
        .selectFrom('brands')
        .select([
          'brands.id',
          'brands.name',
          'brands.created_at',
          'brands.updated_at'
        ])
        .where('brands.id', '=', id)
        .where('brands.business_id', '=', user.business_id)
        .executeTakeFirst();

      if (!brand) {
        return reply.status(404).send({ error: 'Marca no encontrada' });
      }

      const productCount = await db
        .selectFrom('products')
        .select(db.fn.count('id').as('count'))
        .where('brand_id', '=', id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

      return reply.send({
        ...brand,
        product_count: Number(productCount?.count || 0)
      });
    } catch (error: any) {
      console.error('Error fetching brand stats:', error);
      return reply.status(500).send({
        error: 'Error al obtener estadísticas de marca',
        message: error.message
      });
    }
  });
};

export default brandsRoutes;
