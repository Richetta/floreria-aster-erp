import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';

export const productsRoutes: FastifyPluginAsync = async (fastify) => {
  // Create product schema
  const createProductSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(2),
    description: z.string().optional(),
    category_id: z.string().uuid().optional(),
    cost: z.number().nonnegative(),
    price: z.number().nonnegative(),
    barcode: z.string().optional(),
    stock_quantity: z.number().int().default(0), // Added this
    min_stock: z.number().int().positive().default(5),
    max_stock: z.number().int().positive().optional(),
    is_barcode: z.boolean().default(false),
    tags: z.array(z.string()).default([])
  });

  // Update product schema (partial)
  const updateProductSchema = createProductSchema.partial();

  // LIST PRODUCTS
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
    const { search, category, low_stock, active, exact_barcode } = request.query as any;

    const products = await db.transaction().execute(async (trx) => {
        // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        let query = trx
            .selectFrom('products')
            .leftJoin('categories', 'categories.id', 'products.category_id')
            .select([
                'products.id',
                'products.code',
                'products.barcode',
                'products.name',
                'products.description',
                'products.cost',
                'products.price',
                'products.stock_quantity',
                'products.min_stock',
                'products.is_active',
                'products.is_barcode',
                'products.tags',
                'products.category_id',
                'categories.name as category_name'
            ])
            .where('products.deleted_at', 'is', null);

        if (exact_barcode) {
            query = query.where('products.barcode', '=', exact_barcode);
        } else if (search) {
            query = query.where((eb) => eb.or([
                eb('products.name', 'ilike', `%${search}%`),
                eb('products.code', 'ilike', `%${search}%`),
                eb('products.barcode', 'ilike', `%${search}%`)
            ]));
        }

        if (category && category !== 'Todos') {
            query = query.where('products.category_id', '=', category);
        }

        if (active !== undefined) {
            query = query.where('is_active', '=', active === 'true');
        }

        const results = await query
          .orderBy('name', 'asc')
          .limit(1000)
          .execute();

        if (low_stock === 'true') {
            return results.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 5));
        }

        return results;
    });

    return reply.send(products);
  });

  // GET SINGLE PRODUCT
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

    const product = await db.transaction().execute(async (trx) => {
        // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);
        return await trx
            .selectFrom('products')
            .selectAll()
            .where('id', '=', id)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();
    });

    if (!product) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    return reply.send(product);
  });
  // CREATE PRODUCT
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
      const body = createProductSchema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        const margin = body.cost > 0 
          ? ((body.price - body.cost) / body.cost * 100) 
          : null;

        const productId = randomUUID();
        const initialStock = body.stock_quantity || 0;

        const product = await trx
          .insertInto('products')
          .values({
            id: productId,
            business_id: user.business_id,
            code: body.code,
            barcode: body.barcode || null,
            name: body.name,
            description: body.description || null,
            category_id: body.category_id || null,
            cost: body.cost,
            price: body.price,
            margin_percent: margin,
            stock_quantity: initialStock, // Now using body value
            min_stock: body.min_stock,
            max_stock: body.max_stock || null,
            is_active: true,
            is_barcode: body.is_barcode,
            tags: body.tags,
            images: [],
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null
          } as any)
          .returningAll()
          .executeTakeFirst();

        // Create initial stock movement if stock > 0
        if (initialStock > 0) {
          await trx
            .insertInto('stock_movements')
            .values({
              id: randomUUID(),
              business_id: user.business_id,
              product_id: productId,
              movement_type: 'adjustment',
              quantity: initialStock,
              balance_after: initialStock,
              reference_type: 'manual_adjustment',
              reference_id: '00000000-0000-0000-0000-000000000000',
              user_id: user.sub,
              notes: 'Stock inicial en creación de producto',
              metadata: {},
              created_at: new Date()
            } as any)
            .execute();
        }

        return product;
      });

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating product:', error);
      return reply.status(500).send({ 
        error: 'Database error while creating product', 
        message: error.message,
        hint: 'Check if the database connection is active and business_id is correct'
      });
    }
  });

  // UPDATE PRODUCT
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
      const body = updateProductSchema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        const currentProduct = await trx
          .selectFrom('products')
          .select(['cost', 'price', 'stock_quantity'])
          .where('id', '=', id)
          .executeTakeFirst();

        if (!currentProduct) throw new Error('Product not found');

        // Handle Price/Cost history...
        if (body.cost !== undefined || body.price !== undefined) {
          const newCost = body.cost ?? currentProduct.cost;
          const newPrice = body.price ?? currentProduct.price;
          
          if (currentProduct.cost !== newCost || currentProduct.price !== newPrice) {
            await trx
              .insertInto('price_history')
              .values({
                id: randomUUID(),
                business_id: user.business_id,
                product_id: id,
                old_cost: currentProduct.cost,
                old_price: currentProduct.price,
                new_cost: newCost,
                new_price: newPrice,
                changed_by: user.sub,
                reason: body.price ? 'Manual update' : 'Cost update',
                metadata: {},
                created_at: new Date()
              } as any)
              .execute();
          }
        }

        // Handle Stock movement on manual update
        if (body.stock_quantity !== undefined && body.stock_quantity !== Number(currentProduct.stock_quantity)) {
          const diff = body.stock_quantity - Number(currentProduct.stock_quantity);
          await trx
            .insertInto('stock_movements')
            .values({
              id: randomUUID(),
              business_id: user.business_id,
              product_id: id,
              movement_type: 'adjustment',
              quantity: diff,
              balance_after: body.stock_quantity,
              reference_type: 'manual_adjustment',
              reference_id: '00000000-0000-0000-0000-000000000000',
              user_id: user.sub,
              notes: 'Actualización manual desde edición de producto',
              metadata: {
                old_stock: currentProduct.stock_quantity,
                new_stock: body.stock_quantity
              },
              created_at: new Date()
            } as any)
            .execute();
        }

        const margin = body.cost 
          ? ((body.price ?? currentProduct.price) - body.cost) / body.cost * 100 
          : body.price 
            ? ((body.price - (currentProduct.cost)) / currentProduct.cost * 100)
            : null;

        return await trx
          .updateTable('products')
          .set({
            ...body,
            margin_percent: margin,
            updated_at: new Date()
          } as any)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirst();
      });

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // DELETE PRODUCT
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
        // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);
        await trx
            .updateTable('products')
            .set({ 
                deleted_at: new Date(),
                is_active: false
            })
            .where('id', '=', id)
            .execute();
    });

    return reply.send({ success: true });
  });

  // UPDATE STOCK
  fastify.post('/:id/stock', {
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
    const { quantity, reason, type } = request.body as { 
      quantity: number; 
      reason?: string;
      type: 'adjustment' | 'purchase' | 'waste'
    };

    const result = await db.transaction().execute(async (trx) => {
        // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        const product = await trx
            .selectFrom('products')
            .select(['stock_quantity', 'name'])
            .where('id', '=', id)
            .forUpdate()
            .executeTakeFirst();

        if (!product) throw new Error('Product not found');

        const newStock = Number(product.stock_quantity) + quantity;
        if (newStock < 0) throw new Error('Insufficient stock');

        await trx
            .updateTable('products')
            .set({ stock_quantity: newStock })
            .where('id', '=', id)
            .execute();

        return await trx
            .insertInto('stock_movements')
            .values({
                id: randomUUID(),
                business_id: user.business_id,
                product_id: id,
                movement_type: type as any,
                quantity: quantity,
                balance_after: newStock,
                reference_type: 'manual_adjustment',
                reference_id: 'manual',
                user_id: user.sub,
                notes: reason || null,
                metadata: {},
                created_at: new Date()
            } as any)
            .returningAll()
            .executeTakeFirst();
    });

    return reply.send(result);
  });

  // GET PRODUCT PRICE HISTORY
  fastify.get('/:id/price-history', {
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

    const history = await db.transaction().execute(async (trx) => {
        // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);
        return await trx
            .selectFrom('price_history')
            .selectAll()
            .where('product_id', '=', id)
            .orderBy('created_at', 'desc')
            .limit(100)
            .execute();
    });

    return reply.send(history);
  });

  // BULK UPDATE SUPPLIER
  fastify.put('/bulk-supplier', {
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
      const body = z.object({
        productIds: z.array(z.string().uuid()).min(1),
        supplierId: z.string().uuid()
      }).parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        return await trx
          .updateTable('products')
          .set({
            supplier_id: body.supplierId,
            updated_at: new Date()
          })
          .where('id', 'in', body.productIds)
          .returningAll()
          .execute();
      });

      return reply.send({ success: true, updated: result.length });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });
};

export default productsRoutes;

