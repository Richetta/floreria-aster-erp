import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';

export const suppliersRoutes: FastifyPluginAsync = async (fastify) => {
  // Create supplier schema
  const createSupplierSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    contact_name: z.string().optional().or(z.literal('')),
    phone: z.string().min(1, 'El teléfono es obligatorio'),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    category: z.string().optional(),
    notes: z.string().optional().or(z.literal('')),
    next_visit_date: z.string().optional().or(z.literal(''))
  });

  // Update supplier schema (partial)
  const updateSupplierSchema = createSupplierSchema.partial();

  // LIST SUPPLIERS
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

    // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const { category, search, limit = '100' } = request.query as any;

    let query = db
      .selectFrom('suppliers')
      .selectAll()
      .where('deleted_at', 'is', null);

    // Filters
    if (category) {
      query = query.where('category', '=', category);
    }

    if (search) {
      query = query.where((eb) => eb.or([
        eb('name', 'ilike', `%${search}%`),
        eb('contact_name', 'ilike', `%${search}%`),
        eb('phone', 'ilike', `%${search}%`)
      ]));
    }

    const suppliers = await query
      .orderBy('name', 'asc')
      .limit(parseInt(limit))
      .execute();

    return reply.send(suppliers);
  });

  // GET SINGLE SUPPLIER
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

    // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const supplier = await db
      .selectFrom('suppliers')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!supplier) {
      return reply.status(404).send({ error: 'Supplier not found' });
    }

    // Get purchase history
    const purchases = await db
      .selectFrom('supplier_purchases')
      .selectAll()
      .where('supplier_id', '=', id)
      .orderBy('created_at', 'desc')
      .limit(20)
      .execute();

    return reply.send({ ...supplier, purchases });
  });

  // CREATE SUPPLIER
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
      const body = createSupplierSchema.parse(request.body);

      // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const result = await db
        .insertInto('suppliers')
        .values({
          id: randomUUID(),
          business_id: user.business_id,
          name: body.name,
          contact_name: body.contact_name || null,
          phone: body.phone,
          email: body.email || null,
          address: body.address || null,
          category: body.category || null,
          notes: body.notes || null,
          next_visit_date: body.next_visit_date ? new Date(body.next_visit_date) : null,
          is_active: true,
          created_by: user.sub,
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

  // UPDATE SUPPLIER
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
      const body = updateSupplierSchema.parse(request.body);

      // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

      const result = await db
        .updateTable('suppliers')
        .set({
          ...body,
          next_visit_date: body.next_visit_date ? new Date(body.next_visit_date) : undefined,
          updated_at: new Date()
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      if (!result) {
        return reply.status(404).send({ error: 'Supplier not found' });
      }

      return reply.send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });

  // DELETE SUPPLIER (Soft delete)
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

    // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    await db
      .updateTable('suppliers')
      .set({
        deleted_at: new Date()
      })
      .where('id', '=', id)
      .execute();

    return reply.send({ success: true });
  });

  // CREATE PURCHASE (Register incoming stock from supplier)
  fastify.post('/:id/purchase', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { id: supplierId } = request.params as { id: string };

    const body = z.object({
      items: z.array(z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().positive(),
        unit_cost: z.number().positive(),
        update_price: z.boolean().optional().default(false)
      })).min(1, 'La compra debe tener al menos 1 producto'),
      notes: z.string().optional(),
      invoice_document_url: z.string().optional()
    }).parse(request.body);

    // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const result = await db.transaction().execute(async (trx) => {
      // Calculate total
      const totalAmount = body.items.reduce(
        (sum, item) => sum + (item.unit_cost * item.quantity),
        0
      );

      // Create purchase record
      const purchase = await trx
        .insertInto('supplier_purchases')
        .values({
          id: randomUUID(),
          business_id: user.business_id,
          supplier_id: supplierId,
          total_amount: totalAmount,
          invoice_document_url: body.invoice_document_url || null,
          created_by: user.sub,
          created_at: new Date()
        })
        .returningAll()
        .executeTakeFirst();

      // Process each item
      for (const item of body.items) {
        // Get current product
        const product = await trx
          .selectFrom('products')
          .select(['stock_quantity', 'cost', 'price', 'margin_percent'])
          .where('id', '=', item.product_id)
          .forUpdate()
          .executeTakeFirst();

        if (!product) {
          throw new Error(`Producto no encontrado: ${item.product_id}`);
        }

        // Update stock
        const newStock = Number(product.stock_quantity) + item.quantity;
        await trx
          .updateTable('products')
          .set({
            stock_quantity: newStock,
            cost: item.unit_cost,
            updated_at: new Date()
          })
          .where('id', '=', item.product_id)
          .execute();

        // Optionally update price based on margin
        if (item.update_price && product.margin_percent) {
          const newPrice = item.unit_cost * (1 + Number(product.margin_percent) / 100);
          await trx
            .updateTable('products')
            .set({ price: newPrice })
            .where('id', '=', item.product_id)
            .execute();
        }

        // Record stock movement
        await trx
          .insertInto('stock_movements')
          .values({
            id: randomUUID(),
            business_id: user.business_id,
            product_id: item.product_id,
            movement_type: 'purchase',
            quantity: item.quantity,
            balance_after: newStock,
            reference_type: 'supplier_purchase',
            reference_id: purchase!.id,
            user_id: user.sub,
            notes: `Compra a proveedor - ${item.quantity} unid. a $${item.unit_cost}`,
            created_at: new Date(),
            metadata: {}
          })
          .execute();
      }

      // Create transaction for the purchase
      await trx
        .insertInto('transactions')
        .values({
          id: randomUUID(),
          business_id: user.business_id,
          type: 'supplier_payment',
          amount: totalAmount,
          payment_method: 'transfer', // Default, could be parameterized
          category: 'Compra a Proveedor',
          description: `Compra a proveedor ID: ${supplierId}`,
          reference_id: purchase!.id,
          reference_type: 'supplier_purchase',
          created_by: user.sub,
          created_at: new Date()
        })
        .execute();

      return purchase;
    });

    return reply.status(201).send(result);
  });

  // GET SUPPLIERS BY CATEGORY
  fastify.get('/categories/list', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    // await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const categories = await db
      .selectFrom('suppliers')
      .select('category')
      .where('deleted_at', 'is', null)
      .where('category', 'is not', null)
      .groupBy('category')
      .orderBy('category', 'asc')
      .execute();

    return reply.send(categories.map(c => c.category));
  });
};

export default suppliersRoutes;

