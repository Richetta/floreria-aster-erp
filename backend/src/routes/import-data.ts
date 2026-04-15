import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { db } from '../db/index.js';
import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let PDFParse: any = null;
try {
  PDFParse = require('pdf-parse');
} catch (err: any) {
  console.warn('[IMPORT-DATA] PDFParse could not be loaded:', err.message);
}
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
        data: z.array(z.object({
          code: z.string(),
          name: z.string().optional(),
          cost: z.number().nonnegative().optional(),
          price: z.number().nonnegative().optional(),
          stock: z.number().int().nonnegative().optional(),
          category_id: z.string().uuid().optional(),
          category_name: z.string().optional(),
          brand_id: z.string().uuid().optional(),
          brand_name: z.string().optional(),
          margin_percent: z.number().nonnegative().optional()
        })),
        update_costs: z.boolean().default(true),
        update_prices: z.boolean().default(true),
        update_stock: z.boolean().default(false),
        stock_action: z.enum(['set', 'add']).default('set'),
        auto_margin: z.boolean().default(false),
        margin_percent: z.number().default(50)
      }).parse(request.body);

      const businessId = user.business_id;

      const results = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${businessId}, true)`.execute(trx);
        const stats = { updated: 0, created: 0, errors: [] as any[] };

        // Optimization: Fetch all existing products, categories, and brands in this batch at once
        const codes = body.data.map(r => r.code).filter(Boolean);
        const existingProducts = codes.length > 0
          ? await trx.selectFrom('products')
            .select(['id', 'code', 'cost', 'price', 'stock_quantity', 'category_id', 'brand_id'])
            .where('code', 'in', codes)
            .where('deleted_at', 'is', null)
            .execute()
          : [];

        const existingMap = new Map(existingProducts.map(p => [p.code, p]));

        // Collect unique category and brand names from the import data
        const categoryNames = [...new Set(body.data.map(r => r.category_name).filter(Boolean) as string[])];
        const brandNames = [...new Set(body.data.map(r => r.brand_name).filter(Boolean) as string[])];

        // Fetch existing categories by name for this business
        const existingCategoriesByName = categoryNames.length > 0
          ? await trx.selectFrom('categories')
            .select(['id', 'name'])
            .where('business_id', '=', businessId)
            .where('name', 'in', categoryNames)
            .execute()
          : [];

        const categoryMapByName = new Map(existingCategoriesByName.map(c => [c.name.toLowerCase(), c.id as string]));

        // Fetch existing brands by name for this business
        const existingBrandsByName = brandNames.length > 0
          ? await trx.selectFrom('brands')
            .select(['id', 'name'])
            .where('business_id', '=', businessId)
            .where('name', 'in', brandNames)
            .execute()
          : [];

        const brandMapByName = new Map(existingBrandsByName.map(b => [b.name.toLowerCase(), b.id as string]));

        // Cache for newly created categories/brands during this import
        const createdCategoryCache = new Map<string, string>();
        const createdBrandCache = new Map<string, string>();

        // Helper: resolve category name to ID (create if doesn't exist)
        const resolveCategoryId = async (name: string): Promise<string | null> => {
          if (!name) return null;
          const lower = name.toLowerCase();
          if (categoryMapByName.has(lower)) return categoryMapByName.get(lower)!;
          if (createdCategoryCache.has(lower)) return createdCategoryCache.get(lower)!;

          const newId = randomUUID();
          await trx.insertInto('categories').values({
            id: newId,
            business_id: businessId,
            name: name,
            is_active: true,
            created_at: new Date()
          } as any).execute();
          createdCategoryCache.set(lower, newId);
          categoryMapByName.set(lower, newId);
          return newId;
        };

        // Helper: resolve brand name to ID (create if doesn't exist)
        const resolveBrandId = async (name: string): Promise<string | null> => {
          if (!name) return null;
          const lower = name.toLowerCase();
          if (brandMapByName.has(lower)) return brandMapByName.get(lower)!;
          if (createdBrandCache.has(lower)) return createdBrandCache.get(lower)!;

          const newId = randomUUID();
          await trx.insertInto('brands').values({
            id: newId,
            business_id: businessId,
            name: name,
            created_at: new Date()
          } as any).execute();
          createdBrandCache.set(lower, newId);
          brandMapByName.set(lower, newId);
          return newId;
        };

        // Pre-resolve all category and brand IDs
        const resolvedCategoryIds = new Map<string, string | null>();
        const resolvedBrandIds = new Map<string, string | null>();

        for (const catName of categoryNames) {
          const id = await resolveCategoryId(catName);
          resolvedCategoryIds.set(catName, id);
        }
        for (const brandName of brandNames) {
          const id = await resolveBrandId(brandName);
          resolvedBrandIds.set(brandName, id);
        }

        for (const row of body.data) {
          try {
            const product = existingMap.get(row.code);

            // Resolve category and brand IDs from names
            const categoryId = row.category_id || (row.category_name ? (resolvedCategoryIds.get(row.category_name) ?? null) : null);
            const brandId = row.brand_id || (row.brand_name ? (resolvedBrandIds.get(row.brand_name) ?? null) : null);

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

              if (categoryId !== null && categoryId !== product.category_id) {
                updateData.category_id = categoryId;
                hasChanges = true;
              }

              if (brandId !== null && brandId !== product.brand_id) {
                updateData.brand_id = brandId;
                hasChanges = true;
              }

              if (hasChanges) {
                await trx.updateTable('products').set(updateData).where('id', '=', product.id).execute();

                if (body.update_costs || body.update_prices) {
                  await trx.insertInto('price_history').values({
                    id: randomUUID(),
                    business_id: businessId,
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
                id: randomUUID(),
                business_id: businessId,
                code: row.code,
                name: row.name,
                category_id: categoryId || null,
                brand_id: brandId || null,
                cost: row.cost || 0,
                price: row.price || (body.auto_margin && row.cost ? row.cost * (1 + body.margin_percent / 100) : (row.cost ? Math.round(row.cost * 1.5) : 0)),
                stock_quantity: row.stock || 0,
                margin_percent: row.margin_percent || null,
                min_stock: 5,
                is_active: true,
                is_barcode: false,
                tags: [],
                images: [],
                created_at: new Date(),
                updated_at: new Date()
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
                if (s.includes('cate') || s.includes('rubro') || s.includes('carpe')) headers.category = idx;
                if (s.includes('marca') || s.includes('brand')) headers.brand = idx;
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
              stock: cleanPrice(values[headers.stock]),
              category: values[headers.category] || '',
              brand: values[headers.brand] || ''
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
