import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';
import axios from 'axios';

export const storefrontRoutes: FastifyPluginAsync = async (fastify) => {
  
  // ============================================
  // GET STOREFRONT CONFIG (PUBLIC)
  // ============================================
  fastify.get('/config/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    try {
      // 1. Resolve business by slug
      const business = await db
        .selectFrom('businesses')
        .select(['id', 'name', 'phone', 'email', 'logo_url', 'currency', 'address'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!business) {
        return reply.status(404).send({ error: 'Store not found' });
      }

      // 2. Fetch storefront settings & catalog in a thread-safe connection block
      const result = await db.connection().execute(async (trx) => {
        // Force session business_id for RLS
        await sql`SELECT set_config('app.current_business_id', ${business.id}, true)`.execute(trx);

        // Fetch storefront settings from app_settings
        const settingsRow = await trx
          .selectFrom('app_settings')
          .select(['value'])
          .where('business_id', '=', business.id)
          .where('key', '=', 'storefront')
          .executeTakeFirst();

        const storefrontSettings = settingsRow ? (settingsRow.value as any) : {
          active: true,
          banner_title: business.name,
          banner_subtitle: 'Bienvenidos a nuestra tienda online',
          whatsapp_number: business.phone || '',
          theme_color: '#1e3f20', // Default forest green
          payment_methods: ['whatsapp']
        };

        // If the store is explicitly set to inactive, block public view
        if (storefrontSettings.active === false) {
          return {
            business: { name: business.name, logo_url: business.logo_url },
            settings: { active: false, banner_title: business.name },
            products: [],
            combos: [],
            categories: []
          };
        }

        // Fetch active products that are published on storefront
        const products = await trx
          .selectFrom('products')
          .select([
            'id', 'code', 'barcode', 'name', 'description', 
            'category_id', 'brand_id', 'price', 'stock_quantity', 
            'is_active', 'tags', 'images', 'storefront_published'
          ])
          .where('business_id', '=', business.id)
          .where('is_active', '=', true)
          .where('storefront_published', '=', true)
          .where('deleted_at', 'is', null)
          .orderBy('name', 'asc')
          .execute();

        // Fetch active combos (packages) that are published on storefront
        const combos = await trx
          .selectFrom('packages')
          .select([
            'id', 'name', 'description', 'suggested_price', 
            'is_active', 'images', 'tags', 'storefront_published'
          ])
          .where('business_id', '=', business.id)
          .where('is_active', '=', true)
          .where('storefront_published', '=', true)
          .where('deleted_at', 'is', null)
          .orderBy('name', 'asc')
          .execute();

        // Fetch active categories
        const categories = await trx
          .selectFrom('categories')
          .select(['id', 'name', 'parent_id', 'is_active'])
          .where('business_id', '=', business.id)
          .where('is_active', '=', true)
          .orderBy('name', 'asc')
          .execute();

        // Apply price markup percentage dynamically
        const markupPercent = Number(storefrontSettings.price_markup || 0);
        
        const productsWithMarkup = products.map(p => {
          if (markupPercent > 0) {
            const basePrice = Number(p.price || 0);
            const markedUpPrice = basePrice * (1 + markupPercent / 100);
            return {
              ...p,
              price: Math.round(markedUpPrice * 100) / 100
            };
          }
          return p;
        });

        const combosWithMarkup = combos.map(c => {
          if (markupPercent > 0) {
            const basePrice = Number(c.suggested_price || 0);
            const markedUpPrice = basePrice * (1 + markupPercent / 100);
            return {
              ...c,
              suggested_price: Math.round(markedUpPrice * 100) / 100
            };
          }
          return c;
        });

        return {
          business,
          settings: storefrontSettings,
          products: productsWithMarkup,
          combos: combosWithMarkup,
          categories
        };
      });

      return reply.send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al cargar la configuración de la tienda' });
    }
  });

  // ============================================
  // CREATE GUEST ORDER FROM STOREFRONT (PUBLIC)
  // ============================================
  fastify.post('/order', async (request, reply) => {
    const schema = z.object({
      slug: z.string(),
      guest_name: z.string(),
      guest_phone: z.string(),
      delivery_date: z.string(),
      delivery_method: z.enum(['pickup', 'delivery']).default('pickup'),
      delivery_address: z.object({
        street: z.string().optional(),
        number: z.string().optional(),
        floor: z.string().optional(),
        city: z.string().optional(),
        reference: z.string().optional()
      }).optional(),
      delivery_time_slot: z.enum(['morning', 'afternoon', 'evening', 'allday']).default('allday'),
      contact_phone: z.string().optional(),
      card_message: z.string().optional(),
      notes: z.string().optional(),
      payment_method: z.enum(['whatsapp', 'mercadopago']).default('whatsapp'),
      items: z.array(z.object({
        product_id: z.string().uuid(),
        product_name: z.string(),
        quantity: z.number().int().positive(),
        unit_price: z.number().nonnegative()
      })).min(1)
    });

    try {
      const body = schema.parse(request.body);

      // 1. Resolve business
      const business = await db
        .selectFrom('businesses')
        .select(['id', 'name'])
        .where('slug', '=', body.slug)
        .executeTakeFirst();

      if (!business) {
        return reply.status(404).send({ error: 'Negocio no encontrado' });
      }

      // 2. Create order inside a connection block
      const result = await db.connection().execute(async (trx) => {
        // Set PostgreSQL RLS variable
        await sql`SELECT set_config('app.current_business_id', ${business.id}, true)`.execute(trx);

        // Find or create default "Consumidor Final" customer for this business
        let genericCustomer = await trx
          .selectFrom('customers')
          .select(['id', 'name'])
          .where('business_id', '=', business.id)
          .where('name', '=', 'Consumidor Final')
          .executeTakeFirst();

        if (!genericCustomer) {
          genericCustomer = await trx
            .insertInto('customers')
            .values({
              id: randomUUID(),
              business_id: business.id,
              name: 'Consumidor Final',
              phone: '0000',
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            } as any)
            .returning(['id', 'name'])
            .executeTakeFirst();
        }

        // Calculate total
        const totalAmount = body.items.reduce(
          (sum, item) => sum + (item.unit_price * item.quantity),
          0
        );

        // Get next order number
        const lastOrder = await trx
          .selectFrom('orders')
          .select(['order_number'])
          .where('business_id', '=', business.id)
          .orderBy('order_number', 'desc')
          .executeTakeFirst();

        const nextOrderNumber = (lastOrder?.order_number || 0) + 1;

        const orderId = randomUUID();

        // Create the order as pending
        const order = await trx
          .insertInto('orders')
          .values({
            id: orderId,
            business_id: business.id,
            order_number: nextOrderNumber,
            customer_id: genericCustomer!.id,
            customer_name: body.guest_name,
            customer_phone: body.guest_phone,
            status: 'pending',
            delivery_date: new Date(body.delivery_date),
            delivery_address: body.delivery_address || null,
            delivery_time_slot: body.delivery_time_slot,
            delivery_method: body.delivery_method,
            contact_phone: body.contact_phone || body.guest_phone,
            card_message: body.card_message || null,
            internal_notes: body.notes || null,
            total_amount: totalAmount,
            subtotal: totalAmount,
            discount: 0,
            advance_payment: 0,
            payment_method: body.payment_method,
            payment_status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .returningAll()
          .executeTakeFirst();

        // Create order items
        for (const item of body.items) {
          await trx
            .insertInto('order_items')
            .values({
              id: randomUUID(),
              business_id: business.id,
              order_id: orderId,
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount: 0,
              total: item.unit_price * item.quantity,
              created_at: new Date()
            } as any)
            .execute();
        }

        // Update generic customer count
        await trx
          .updateTable('customers')
          .set({
            total_orders: sql`total_orders + 1`,
            debt_balance: sql`debt_balance + ${body.payment_method === 'whatsapp' ? totalAmount : 0}`, // WhatsApp registers debt until paid, MP paid online does not
            last_order_date: new Date(),
            updated_at: new Date()
          } as any)
          .where('id', '=', genericCustomer!.id)
          .execute();

        return order;
      });

      return reply.status(201).send(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Error de validación', details: error.errors });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al registrar el pedido' });
    }
  });

  // ============================================
  // GENERATE MERCADOPAGO PREFERENCE (PUBLIC)
  // ============================================
  fastify.post('/mercadopago/preference', async (request, reply) => {
    const schema = z.object({
      slug: z.string(),
      order_id: z.string().uuid(),
      items: z.array(z.object({
        title: z.string(),
        quantity: z.number().int().positive(),
        unit_price: z.number().positive()
      })).min(1)
    });

    try {
      const body = schema.parse(request.body);

      // 1. Resolve business
      const business = await db
        .selectFrom('businesses')
        .select(['id', 'name'])
        .where('slug', '=', body.slug)
        .executeTakeFirst();

      if (!business) {
        return reply.status(404).send({ error: 'Negocio no encontrado' });
      }

      // 2. Load MercadoPago credentials from app_settings
      const settingsRow = await db
        .selectFrom('app_settings')
        .select(['value'])
        .where('business_id', '=', business.id)
        .where('key', '=', 'storefront')
        .executeTakeFirst();

      const storefrontSettings = settingsRow ? (settingsRow.value as any) : null;
      const mpAccessToken = storefrontSettings?.mercadopago_access_token;

      if (!mpAccessToken) {
        return reply.status(400).send({ error: 'El comercio no tiene configurados cobros por MercadoPago' });
      }

      // 3. Make HTTP request to MercadoPago Checkout Preference API
      // Standardize the host name (dynamically resolve or fallback to production)
      const host = request.headers.host || 'mijardin-erp.vercel.app';
      const protocol = request.headers['x-forwarded-proto'] || 'https';
      const backendUrl = `${protocol}://${host}`;

      console.log(`[MP Preference] Creating preference for order ${body.order_id} using token ${mpAccessToken.substring(0, 15)}...`);

      const response = await axios.post(
        'https://api.mercadopago.com/checkout/preferences',
        {
          items: body.items.map(item => ({
            title: item.title,
            quantity: item.quantity,
            unit_price: item.unit_price,
            currency_id: 'ARS'
          })),
          external_reference: body.order_id,
          // MP hits our webhook, passing the slug so we know whose token to load!
          notification_url: `https://mijardin-erp-backend.onrender.com/api/storefront/webhook/mercadopago?slug=${body.slug}`,
          back_urls: {
            success: `${protocol}://${host}/${body.slug}?mp_status=success&order_id=${body.order_id}`,
            failure: `${protocol}://${host}/${body.slug}?mp_status=failure&order_id=${body.order_id}`,
            pending: `${protocol}://${host}/${body.slug}?mp_status=pending&order_id=${body.order_id}`
          },
          auto_return: 'approved'
        },
        {
          headers: {
            'Authorization': `Bearer ${mpAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return reply.send({
        preference_id: response.data.id,
        init_point: response.data.init_point
      });
    } catch (error: any) {
      console.error('[MP Preference ERROR]:', error.response?.data || error.message);
      return reply.status(500).send({ 
        error: 'Error al generar la preferencia de MercadoPago', 
        details: error.response?.data || error.message 
      });
    }
  });

  // ============================================
  // WEBHOOK MERCADOPAGO (PUBLIC)
  // ============================================
  fastify.post('/webhook/mercadopago', async (request, reply) => {
    const { slug } = request.query as { slug?: string };
    const body = request.body as any;

    console.log(`[MP Webhook] Received notification for slug: ${slug}, Body:`, JSON.stringify(body));

    if (!slug) {
      return reply.status(400).send({ error: 'Missing slug query parameter' });
    }

    // MP sends notifications of different types. We only process 'payment'
    // It can come as body.type === 'payment' or body.action === 'payment.created'
    const isPaymentNotification = body.type === 'payment' || body.action?.startsWith('payment.');
    const paymentId = body.data?.id || (body.type === 'payment' ? body.resource?.split('/').pop() : null);

    if (!isPaymentNotification || !paymentId) {
      console.log('[MP Webhook] Skipping non-payment notification');
      return reply.status(200).send({ success: true, message: 'Notification skipped' });
    }

    try {
      // 1. Resolve business
      const business = await db
        .selectFrom('businesses')
        .select(['id', 'name'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!business) {
        console.error(`[MP Webhook ERROR] Business not found for slug: ${slug}`);
        return reply.status(404).send({ error: 'Negocio no encontrado' });
      }

      // 2. Load MercadoPago credentials from app_settings
      const settingsRow = await db
        .selectFrom('app_settings')
        .select(['value'])
        .where('business_id', '=', business.id)
        .where('key', '=', 'storefront')
        .executeTakeFirst();

      const storefrontSettings = settingsRow ? (settingsRow.value as any) : null;
      const mpAccessToken = storefrontSettings?.mercadopago_access_token;

      if (!mpAccessToken) {
        console.error(`[MP Webhook ERROR] Access token missing for business: ${business.name}`);
        return reply.status(400).send({ error: 'Credenciales de MercadoPago no configuradas' });
      }

      // 3. Fetch payment details from MercadoPago to verify approval
      console.log(`[MP Webhook] Verifying payment ${paymentId} with MercadoPago...`);
      const mpResponse = await axios.get(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${mpAccessToken}`
          }
        }
      );

      const payment = mpResponse.data;
      console.log(`[MP Webhook] Payment ${paymentId} status: ${payment.status}, Order reference: ${payment.external_reference}`);

      if (payment.status === 'approved') {
        const orderId = payment.external_reference;

        if (!orderId) {
          console.error(`[MP Webhook ERROR] Payment ${paymentId} approved but missing external_reference (orderId)`);
          return reply.status(400).send({ error: 'Falta external_reference' });
        }

        // 4. Update order inside thread-safe transaction
        await db.connection().execute(async (trx) => {
          // Set PostgreSQL RLS variable
          await sql`SELECT set_config('app.current_business_id', ${business.id}, true)`.execute(trx);

          // Get the order
          const order = await trx
            .selectFrom('orders')
            .selectAll()
            .where('id', '=', orderId)
            .where('business_id', '=', business.id)
            .executeTakeFirst();

          if (!order) {
            console.error(`[MP Webhook ERROR] Order ${orderId} not found in database`);
            return;
          }

          // If the order has already been processed/confirmed/paid, don't double process
          if (order.payment_status === 'paid' || order.status === 'confirmed') {
            console.log(`[MP Webhook] Order ${orderId} was already paid/confirmed, skipping update`);
            return;
          }

          console.log(`[MP Webhook] Processing approved order ${orderId}, order number #${order.order_number}`);

          // Update order status
          await trx
            .updateTable('orders')
            .set({
              status: 'confirmed',
              payment_status: 'paid',
              payment_method: 'mercadopago',
              advance_payment: order.total_amount,
              updated_at: new Date()
            } as any)
            .where('id', '=', orderId)
            .execute();

          // Get order items to deduct stock
          const items = await trx
            .selectFrom('order_items')
            .selectAll()
            .where('order_id', '=', orderId)
            .execute();

          console.log(`[MP Webhook] Deducting stock for ${items.length} items of order #${order.order_number}`);

          // Deduct stock atom-safely
          for (const item of items) {
            if (item.product_id) {
              const product = await trx
                .selectFrom('products')
                .select(['id', 'name', 'stock_quantity', 'cost'])
                .where('id', '=', item.product_id)
                .forUpdate()
                .executeTakeFirst();

              if (product) {
                // atomic stock reduction
                await trx
                  .updateTable('products')
                  .set({
                    stock_quantity: sql`stock_quantity - ${item.quantity}`,
                    sales_count: sql`COALESCE(sales_count, 0) + ${item.quantity}`,
                    last_sale_date: new Date(),
                    updated_at: new Date()
                  } as any)
                  .where('id', '=', product.id)
                  .execute();

                // Fetch new stock level
                const updatedProduct = await trx
                  .selectFrom('products')
                  .select('stock_quantity')
                  .where('id', '=', product.id)
                  .executeTakeFirst();

                const newStock = Number(updatedProduct?.stock_quantity || 0);

                // Record stock movement
                await trx
                  .insertInto('stock_movements')
                  .values({
                    id: randomUUID(),
                    business_id: business.id,
                    product_id: product.id,
                    movement_type: 'sale',
                    quantity: -item.quantity,
                    balance_after: newStock,
                    reference_type: 'storefront_sale',
                    reference_id: orderId,
                    notes: `Venta Online - ${product.name} (Pedido #${order.order_number})`,
                    created_at: new Date(),
                    metadata: {
                      payment_id: paymentId,
                      unit_price: item.unit_price,
                      unit_cost: product.cost
                    }
                  })
                  .execute();
              }
            }
          }

          // Create financial transaction
          await trx
            .insertInto('transactions')
            .values({
              id: randomUUID(),
              business_id: business.id,
              type: 'sale',
              amount: order.total_amount,
              payment_method: 'mercadopago',
              category: 'Venta Online',
              description: `Venta Online MercadoPago - Pedido #${order.order_number}`,
              reference_id: orderId,
              reference_type: 'storefront_order',
              metadata: {
                order_id: orderId,
                payment_id: paymentId,
                is_revenue: true
              },
              created_at: new Date()
            } as any)
            .execute();

          // Deduct customer debt (since they paid online, debt should be 0)
          if (order.customer_id) {
            const customer = await trx
              .selectFrom('customers')
              .select(['debt_balance'])
              .where('id', '=', order.customer_id)
              .executeTakeFirst();

            if (customer) {
              const newDebt = Math.max(0, Number(customer.debt_balance || 0) - order.total_amount);
              await trx
                .updateTable('customers')
                .set({ debt_balance: newDebt, updated_at: new Date() })
                .where('id', '=', order.customer_id)
                .execute();
            }
          }

          console.log(`[MP Webhook] Order #${order.order_number} fully processed! Stock deducted and transaction recorded.`);
        });
      }

      return reply.status(200).send({ success: true });
    } catch (error: any) {
      console.error('[MP Webhook ERROR]:', error.message, error.stack);
      return reply.status(500).send({ error: 'Webhook processing failed', details: error.message });
    }
  });

  // ============================================
  // GET REVIEWS (PUBLIC)
  // ============================================
  fastify.get('/reviews/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { product_id, package_id, type } = request.query as { product_id?: string; package_id?: string; type?: string };

    try {
      // 1. Resolve business by slug
      const business = await db
        .selectFrom('businesses')
        .select(['id'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!business) {
        return reply.status(404).send({ error: 'Negocio no encontrado' });
      }

      const reviews = await db.connection().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${business.id}, true)`.execute(trx);

        let query = trx
          .selectFrom('storefront_reviews')
          .selectAll()
          .where('business_id', '=', business.id)
          .where('is_approved', '=', true);

        if (product_id) {
          query = query.where('product_id', '=', product_id);
        } else if (package_id) {
          query = query.where('package_id', '=', package_id);
        } else if (type === 'general') {
          query = query.where('product_id', 'is', null).where('package_id', 'is', null);
        }

        return await query.orderBy('created_at', 'desc').execute();
      });

      return reply.send(reviews);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al obtener las reseñas' });
    }
  });

  // ============================================
  // POST REVIEW (PUBLIC)
  // ============================================
  fastify.post('/reviews/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const schema = z.object({
      author_name: z.string().min(1, 'El nombre es obligatorio').max(100),
      rating: z.number().int().min(1).max(5),
      comment: z.string().optional().nullable(),
      product_id: z.string().uuid().optional().nullable(),
      package_id: z.string().uuid().optional().nullable()
    });

    try {
      const body = schema.parse(request.body);

      // 1. Resolve business by slug
      const business = await db
        .selectFrom('businesses')
        .select(['id'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!business) {
        return reply.status(404).send({ error: 'Negocio no encontrado' });
      }

      const newReview = await db.connection().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${business.id}, true)`.execute(trx);

        return await trx
          .insertInto('storefront_reviews')
          .values({
            id: randomUUID(),
            business_id: business.id,
            product_id: body.product_id || null,
            package_id: body.package_id || null,
            author_name: body.author_name,
            rating: body.rating,
            comment: body.comment || null,
            is_approved: true,
            created_at: new Date()
          } as any)
          .returningAll()
          .executeTakeFirst();
      });

      return reply.status(201).send(newReview);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Error de validación', details: error.errors });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Error al enviar la reseña' });
    }
  });

};

export default storefrontRoutes;
