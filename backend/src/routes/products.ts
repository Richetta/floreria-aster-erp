import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';

// Helper: Check subscription product limit
async function checkProductLimit(businessId: string, reply: any) {
  try {
    // Get subscription limits
    const subResult = await db.selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
      .select([
        'subscription_plans.max_products',
        'subscription_plans.name_short',
        'subscription_plans.slug',
        'subscriptions.status'
      ])
      .where('subscriptions.business_id', '=', businessId)
      .where('subscriptions.status', 'in', ['active', 'trial'])
      .limit(1)
      .executeTakeFirst();

    // No subscription - apply free tier limit
    let maxProducts = 50; // Free tier
    let planName = 'Semilla';
    let planSlug = 'semilla';

    if (subResult) {
      const subscriptionInfo = subResult;
      maxProducts = subscriptionInfo.max_products || 999999; // NULL = unlimited
      planName = subscriptionInfo.name_short || 'Semilla';
      planSlug = subscriptionInfo.slug;
    }

    // Count current products
    const countResult = await db.executeQuery(
      db.selectFrom('products')
        .select(db.fn.count('id').as('count'))
        .where('business_id', '=', businessId)
        .where('is_active', '=', true)
    );

    const currentCount = Number(countResult.rows[0].count);

    if (currentCount >= maxProducts) {
      reply.code(429).send({
        error: 'Limit Reached',
        message: `Has alcanzado el límite de ${maxProducts} productos en tu plan ${planName}`,
        limitReached: true,
        limit: maxProducts,
        current: currentCount,
        resourceType: 'products',
        suggestedPlan: planSlug === 'semilla' ? 'florecer' : planSlug === 'florecer' ? 'crecimiento' : 'jardin',
        upgradeUrl: '/subscription/upgrade'
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking product limit:', error);
    return true; // Fail open
  }
}

export const productsRoutes: FastifyPluginAsync = async (fastify) => {
  // Create product schema
  // Create product schema
  const createProductSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(2),
    description: z.string().optional().nullable(),
    category_id: z.string().uuid().or(z.literal('')).transform(v => v === '' ? null : v).optional().nullable(),
    brand_id: z.string().uuid().or(z.literal('')).transform(v => v === '' ? null : v).optional().nullable(),
    cost: z.number().nonnegative(),
    price: z.number().nonnegative(),
    barcode: z.string().optional().nullable(),
    stock_quantity: z.number().int().default(0),
    min_stock: z.number().int().positive().default(5),
    max_stock: z.number().int().positive().optional().nullable(),
    is_barcode: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    custom_filter_options: z.array(z.string().uuid()).optional()
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
    const { search, category, brand, low_stock, active, exact_barcode } = request.query as any;

    const products = await db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

      let query = trx
        .selectFrom('products')
        .leftJoin('categories', 'categories.id', 'products.category_id')
        .leftJoin('brands', 'brands.id', 'products.brand_id')
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
          'products.brand_id',
          'products.sales_count',
          'products.last_sale_date',
          'categories.name as category_name',
          'brands.name as brand_name'
        ])
        .where('products.business_id', '=', user.business_id)
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

      if (brand) {
        query = query.where('products.brand_id', '=', brand);
      }

      if (active !== undefined) {
        query = query.where('is_active', '=', active === 'true');
      }

      const results = await query
        .orderBy('name', 'asc')
        .limit(1000)
        .execute();

      const filterValues = await trx
        .selectFrom('product_custom_filter_values')
        .selectAll()
        .where('business_id', '=', user.business_id)
        .execute();

      const mappedProducts = results.map(p => ({
        ...p,
        custom_filter_options: filterValues
          .filter(fv => fv.product_id === p.id)
          .map(fv => fv.option_id)
      }));

      if (low_stock === 'true') {
        return mappedProducts.filter(p => (Number(p.stock_quantity) || 0) <= (Number(p.min_stock) || 5));
      }

      return mappedProducts;
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
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);
      return await trx
        .selectFrom('products')
        .selectAll()
        .where('id', '=', id)
        .where('business_id', '=', user.business_id)
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

    // Check subscription product limit
    const canCreate = await checkProductLimit(user.business_id, reply);
    if (!canCreate) return;

    try {
      const body = createProductSchema.parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

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
            brand_id: body.brand_id || null,
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

        // Insert custom filter options if present
        if (body.custom_filter_options && body.custom_filter_options.length > 0) {
          const filterValuesToInsert = body.custom_filter_options.map(optionId => ({
            business_id: user.business_id,
            product_id: productId,
            option_id: optionId
          }));
          await trx.insertInto('product_custom_filter_values').values(filterValuesToInsert).execute();
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
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

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

        const margin = (body.cost !== undefined ? body.cost : Number(currentProduct.cost)) > 0
          ? (((body.price !== undefined ? body.price : Number(currentProduct.price)) - (body.cost !== undefined ? body.cost : Number(currentProduct.cost))) / (body.cost !== undefined ? body.cost : Number(currentProduct.cost)) * 100)
          : null;

        // Handle custom filter options
        if (body.custom_filter_options !== undefined) {
          // Delete old
          await trx
            .deleteFrom('product_custom_filter_values')
            .where('business_id', '=', user.business_id)
            .where('product_id', '=', id)
            .execute();

          // Insert new
          if (body.custom_filter_options.length > 0) {
            const filterValuesToInsert = body.custom_filter_options.map(optionId => ({
              business_id: user.business_id,
              product_id: id,
              option_id: optionId
            }));
            await trx.insertInto('product_custom_filter_values').values(filterValuesToInsert).execute();
          }
        }

        // Remove custom_filter_options from body to avoid DB error on products table
        const { custom_filter_options, ...productData } = body;

        return await trx
          .updateTable('products')
          .set({
            ...productData,
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
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);
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

  // BULK DELETE PRODUCTS
  fastify.post('/bulk-delete', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { ids } = request.body as { ids: string[] };

    if (!ids || ids.length === 0) {
      return reply.status(400).send({ error: 'No product IDs provided' });
    }

    const result = await db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

      const res = await trx
        .updateTable('products')
        .set({
          deleted_at: new Date(),
          is_active: false
        })
        .where('id', 'in', ids)
        .where('business_id', '=', user.business_id)
        .executeTakeFirst();

      return { deleted: Number(res.numChangedRows || 0) };
    });

    return reply.send({ success: true, ...result });
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
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

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
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);
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
          .where('business_id', '=', user.business_id)
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

  // BULK UPDATE BRAND
  fastify.put('/bulk-brand', {
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
        brandId: z.string().uuid().nullable()
      }).parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        return await trx
          .updateTable('products')
          .set({
            brand_id: body.brandId,
            updated_at: new Date()
          })
          .where('id', 'in', body.productIds)
          .where('business_id', '=', user.business_id)
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

  // BULK UPDATE PRICES BY PERCENTAGE
  fastify.put('/bulk-prices', {
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
        mode: z.enum(['percentage', 'margin', 'fixed']),
        value: z.number(),
        roundTo: z.enum(['none', 'up', 'down', 'nearest']).optional().default('none')
      }).parse(request.body);

      const result = await db.transaction().execute(async (trx) => {
        const products = await trx
          .selectFrom('products')
          .select(['id', 'cost', 'price'])
          .where('id', 'in', body.productIds)
          .where('business_id', '=', user.business_id)
          .execute();

        const updates = products.map(product => {
          let newPrice: number;

          if (body.mode === 'percentage') {
            // Increase/decrease by percentage
            newPrice = Number(product.price) * (1 + body.value / 100);
          } else if (body.mode === 'margin') {
            // Calculate price based on desired margin: price = cost * (1 + margin%)
            newPrice = Number(product.cost) * (1 + body.value / 100);
          } else {
            // Fixed amount added to current price
            newPrice = Number(product.price) + body.value;
          }

          // Apply rounding if requested
          if (body.roundTo === 'up') {
            newPrice = Math.ceil(newPrice);
          } else if (body.roundTo === 'down') {
            newPrice = Math.floor(newPrice);
          } else if (body.roundTo === 'nearest') {
            newPrice = Math.round(newPrice);
          } else {
            newPrice = Math.round(newPrice * 100) / 100; // Round to 2 decimals
          }

          // Calculate new margin
          const newMargin = Number(product.cost) > 0
            ? ((newPrice - Number(product.cost)) / Number(product.cost) * 100)
            : null;

          return { productId: product.id, newPrice, newMargin, oldPrice: Number(product.price) };
        });

        // Execute updates
        for (const update of updates) {
          await trx
            .updateTable('products')
            .set({
              price: update.newPrice,
              margin_percent: update.newMargin,
              updated_at: new Date()
            } as any)
            .where('id', '=', update.productId)
            .execute();

          // Record price history
          await trx
            .insertInto('price_history')
            .values({
              id: randomUUID(),
              business_id: user.business_id,
              product_id: update.productId,
              old_cost: null,
              old_price: update.oldPrice,
              new_cost: null,
              new_price: update.newPrice,
              changed_by: user.sub,
              reason: 'bulk_price_update',
              metadata: { mode: body.mode, value: body.value },
              created_at: new Date()
            } as any)
            .execute();
        }

        return updates;
      });

      return reply.send({
        success: true,
        updated: result.length,
        details: result
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Error in bulk price update:', error);
      return reply.status(500).send({
        error: 'Error al actualizar precios masivamente',
        message: error.message
      });
    }
  });
};

export default productsRoutes;

