import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { db } from '../db/index.js';
import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PDFParse = require('pdf-parse');
import { parse as csvParse } from 'csv-parse/sync';
import { sql } from 'kysely';
import { randomUUID } from 'crypto';

export const importRoutes: FastifyPluginAsync = async (fastify) => {
  // Debug endpoint
  fastify.get('/debug', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.code(401).send({ error: 'Unauthorized', version: 'vFINAL-B' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    return reply.send({
      status: 'ok',
      version: 'vFINAL-B',
      user: { email: user?.email, role: user?.role }
    });
  });

  const importDataSchema = z.array(z.object({
    code: z.string(),
    name: z.string().optional(),
    cost: z.number().nonnegative().optional(),
    price: z.number().nonnegative().optional(),
    stock: z.number().int().nonnegative().optional(),
    category_id: z.string().uuid().optional()
  }));

  const cleanPrice = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/[^0-9.,]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  };

  const smartParseText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    const results: any[] = [];
    for (const line of lines) {
      if (line.toLowerCase().includes('total') || line.toLowerCase().includes('fecha')) continue;
      const priceMatch = line.match(/(\$?\s?(\d+[.,]\d{2})|\$?\s?(\d{2,}))/);
      if (!priceMatch) continue;
      const price = cleanPrice(priceMatch[1]);
      if (price === undefined) continue;
      const codeMatch = line.match(/([A-Z0-9]{2,10}[-.]?[A-Z0-9]{1,10})/i);
      const code = codeMatch ? codeMatch[1].toUpperCase() : `AUTO-${Math.random().toString(36).substring(7).toUpperCase()}`;
      let name = line.replace(priceMatch[0], '').replace(codeMatch ? codeMatch[0] : '', '').replace(/[-|]/g, ' ').trim();
      if (name.length < 2) name = "Producto sin nombre";
      results.push({ code, name, price });
    }
    return results;
  };

  // Bulk import endpoint
  fastify.post('/bulk-import', async (request, reply) => {
    const user = request.user as any;
    console.log(`[BULK-IMPORT] Request received from ${user?.email}`);

    try {
      const body = z.object({
        data: importDataSchema,
        update_costs: z.boolean().default(true),
        update_prices: z.boolean().default(true),
        update_stock: z.boolean().default(false),
        stock_action: z.enum(['set', 'add']).default('set'),
        auto_margin: z.boolean().default(false),
        margin_percent: z.number().default(50)
      }).parse(request.body);

      const results = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);
        const stats = { updated: 0, created: 0, errors: [] as any[] };

        // Optimization: Fetch all existing products in this batch at once
        const codes = body.data.map(r => r.code).filter(Boolean);
        const existingProducts = codes.length > 0 
          ? await trx.selectFrom('products')
              .select(['id', 'code', 'cost', 'price', 'stock_quantity'])
              .where('code', 'in', codes)
              .where('deleted_at', 'is', null)
              .execute()
          : [];
        
        const existingMap = new Map(existingProducts.map(p => [p.code, p]));

        for (const row of body.data) {
          try {
            const product = existingMap.get(row.code);

            if (product) {
              const updateData: any = { updated_at: new Date() };
              let hasChanges = false;

              if (body.update_costs && row.cost !== undefined && row.cost !== product.cost) {
                updateData.cost = row.cost;
                hasChanges = true;
              }
              
              if (body.update_prices) {
                if (row.price !== undefined && row.price !== product.price) {
                  updateData.price = row.price;
                  hasChanges = true;
                } else if (body.auto_margin && row.cost !== undefined) {
                  const newPrice = row.cost * (1 + body.margin_percent / 100);
                  if (newPrice !== product.price) {
                    updateData.price = newPrice;
                    hasChanges = true;
                  }
                }
              }

              if (body.update_stock && row.stock !== undefined) {
                const newStock = body.stock_action === 'add' 
                  ? (product.stock_quantity || 0) + row.stock
                  : row.stock;
                
                if (newStock !== product.stock_quantity) {
                  updateData.stock_quantity = newStock;
                  hasChanges = true;
                }
              }

              if (row.category_id !== undefined) updateData.category_id = row.category_id;

              if (hasChanges || row.category_id !== undefined) {
                await trx.updateTable('products').set(updateData).where('id', '=', product.id).execute();

                if (body.update_costs || body.update_prices) {
                  await trx.insertInto('price_history').values({
                    id: randomUUID(), 
                    business_id: user.business_id, 
                    product_id: product.id,
                    old_cost: product.cost, 
                    old_price: product.price,
                    new_cost: updateData.cost !== undefined ? updateData.cost : typeof product.cost === 'string' ? parseFloat(product.cost) : product.cost,
                    new_price: updateData.price !== undefined ? updateData.price : typeof product.price === 'string' ? parseFloat(product.price) : product.price,
                    changed_by: user.sub, 
                    reason: 'Bulk Import', 
                    created_at: new Date(), 
                    metadata: {}
                  } as any).execute();
                }
                stats.updated++;
              }
            } else if (row.name) {
              await trx.insertInto('products').values({
                id: randomUUID(), business_id: user.business_id, code: row.code, name: row.name,
                category_id: row.category_id || null, cost: row.cost || 0,
                price: row.price || (body.auto_margin && row.cost ? row.cost * (1 + body.margin_percent / 100) : 0),
                stock_quantity: row.stock || 0, min_stock: 5, is_active: true, is_barcode: false, tags: [], images: [], created_at: new Date(), updated_at: new Date()
              } as any).execute();
              stats.created++;
            }
          } catch (e: any) { stats.errors.push({ code: row.code, error: e.message }); }
        }
        return stats;
      });
      return reply.send(results);
    } catch (error: any) {
      console.error('[BULK-IMPORT] Error:', error);
      return reply.status(error instanceof z.ZodError ? 400 : 500).send({ error: error.message });
    }
  });

  fastify.post('/parse-file', async (request, reply) => {
    try {
      const fileRequest = await request.file();
      if (!fileRequest) return reply.status(400).send({ error: 'No file' });
      const buffer = await fileRequest.toBuffer();
      const filename = fileRequest.filename.toLowerCase();
      let parsedData: any[] = [];
      if (filename.endsWith('.xlsx')) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.getWorksheet(1);
        if (worksheet) {
          let headers: any = {};
          worksheet.eachRow((row, rowNumber) => {
            const values = Array.isArray(row.values) ? row.values : [];
            if (rowNumber === 1) {
              values.forEach((val, idx) => {
                if (!val) return;
                const s = String(val).toLowerCase();
                if (s.includes('cod')) headers.code = idx;
                if (s.includes('nom') || s.includes('prod') || s.includes('desc')) headers.name = idx;
                if (s.includes('pre') || s.includes('venta')) headers.price = idx;
                if (s.includes('cost')) headers.cost = idx;
                if (s.includes('stoc') || s.includes('cant')) headers.stock = idx;
              });
              return;
            }
            const code = String(values[headers.code || 1] || '').trim();
            if (!code || code === 'undefined' || code === 'null') return;

            parsedData.push({ 
              code, 
              name: values[headers.name || 2] || 'Producto sin nombre', 
              price: cleanPrice(values[headers.price || 4]),
              cost: cleanPrice(values[headers.cost]),
              stock: cleanPrice(values[headers.stock])
            });
          });
        }
      } else {
        parsedData = smartParseText(buffer.toString());
      }
      return reply.send({ data: parsedData });
    } catch (e: any) { return reply.status(500).send({ error: e.message }); }
  });

  fastify.post('/parse-text', async (request, reply) => {
    const { text } = request.body as { text: string };
    return reply.send({ data: smartParseText(text) });
  });

  fastify.get('/export-template', async (request, reply) => {
    const user = request.user as any;
    const products = await db.selectFrom('products').select(['code', 'name', 'cost', 'price', 'stock_quantity']).where('deleted_at', 'is', null).execute();
    const csv = [['codigo', 'nombre', 'costo', 'precio', 'stock'].join(','), ...products.map(p => [p.code, `"${p.name}"`, p.cost, p.price, p.stock_quantity].join(','))].join('\n');
    reply.header('Content-Type', 'text/csv').header('Content-Disposition', 'attachment; filename="productos.csv"');
    return reply.send(csv);
  });
};

export default importRoutes;
