import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';

export const packagesRoutes: FastifyPluginAsync = async (fastify) => {
  // Create package schema
  const createPackageSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    section: z.string().min(1, 'La sección es obligatoria'),
    description: z.string().optional().or(z.literal('')),
    price: z.number().positive(),
    is_active: z.boolean().default(true),
    components: z.array(z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().positive()
    })).min(1, 'El paquete debe tener al menos 1 componente')
  });

  // Update package schema (partial)
  const updatePackageSchema = createPackageSchema.partial();

  // LIST PACKAGES
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
    const { section, is_active, search, limit = '100' } = request.query as any;

    const packagesWithComponents = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

        let query = trx
            .selectFrom('packages')
            .selectAll()
            .where('deleted_at', 'is', null);

        if (section) {
            query = query.where('section', '=', section);
        }

        if (is_active !== undefined) {
            query = query.where('is_active', '=', is_active === 'true');
        }

        if (search) {
            query = query.where((eb) => eb.or([
                eb('name', 'ilike', `%${search}%`),
                eb('description', 'ilike', `%${search}%`)
            ]));
        }

        const packages = await query
            .orderBy('name', 'asc')
            .limit(parseInt(limit))
            .execute();

        return await Promise.all(
            packages.map(async (pkg) => {
                const components = await trx
                    .selectFrom('package_components')
                    .selectAll()
                    .where('package_id', '=', pkg.id)
                    .execute();

                return {
                    ...pkg,
                    components,
                    items: components
                };
            })
        );
    });

    return reply.send(packagesWithComponents);
  });

  // GET SINGLE PACKAGE
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

    const result = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

        const pkg = await trx
            .selectFrom('packages')
            .selectAll()
            .where('id', '=', id)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

        if (!pkg) return null;

        const components = await trx
            .selectFrom('package_components')
            .selectAll()
            .where('package_id', '=', id)
            .execute();

        return { ...pkg, components, items: components };
    });

    if (!result) {
      return reply.status(404).send({ error: 'Package not found' });
    }

    return reply.send(result);
  });

  // CHECK PACKAGE AVAILABILITY
  fastify.get('/:id/availability', {
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

    const result = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

        const components = await trx
            .selectFrom('package_components')
            .innerJoin('products', 'products.id', 'package_components.product_id')
            .select([
                'package_components.product_id',
                'products.name as product_name',
                'products.stock_quantity',
                'package_components.quantity as required_quantity'
            ])
            .where('package_components.package_id', '=', id)
            .execute();

        const missingComponents = components
            .filter(c => Number(c.stock_quantity) < Number(c.required_quantity))
            .map(c => ({
                product_id: c.product_id,
                product_name: c.product_name,
                required: Number(c.required_quantity),
                available: Number(c.stock_quantity),
                shortage: Number(c.required_quantity) - Number(c.stock_quantity)
            }));

        return {
            available: missingComponents.length === 0,
            missing_components: missingComponents,
            missingComponents
        };
    });

    return reply.send(result);
  });

  // CREATE PACKAGE
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
      const body = createPackageSchema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

        const pkg = await trx
          .insertInto('packages')
          .values({
            id: randomUUID(),
            business_id: user.business_id,
            name: body.name,
            section: body.section,
            description: body.description || '',
            suggested_price: body.price,
            is_active: body.is_active,
            created_by: user.sub,
            images: [],
            tags: [],
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .returningAll()
          .executeTakeFirst();

        for (const component of body.components) {
          await trx
            .insertInto('package_components')
            .values({
              id: randomUUID(),
              business_id: user.business_id,
              package_id: pkg!.id,
              product_id: component.product_id,
              quantity: component.quantity,
              display_order: 0,
              created_at: new Date()
            })
            .execute();
        }

        return pkg;
      });

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // UPDATE PACKAGE
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

    try {
      const body = updatePackageSchema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

        const pkg = await trx
          .updateTable('packages')
          .set({
            ...body,
            components: undefined,
            updated_at: new Date()
          } as any)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirst();

        if (!pkg) throw new Error('Package not found');

        if (body.components && Array.isArray(body.components)) {
          await trx
            .deleteFrom('package_components')
            .where('package_id', '=', id)
            .execute();

          for (const component of body.components) {
            await trx
              .insertInto('package_components')
              .values({
                id: randomUUID(),
                business_id: user.business_id,
                package_id: id,
                product_id: component.product_id,
                quantity: component.quantity,
                display_order: 0,
                created_at: new Date()
              })
              .execute();
          }
        }

        return pkg;
      });

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // DELETE PACKAGE
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

    await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);
        await trx
            .updateTable('packages')
            .set({
                deleted_at: new Date(),
                is_active: false
            })
            .where('id', '=', id)
            .execute();
    });

    return reply.send({ success: true });
  });
};

export default packagesRoutes;

