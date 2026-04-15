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

  const findHeaderIndex = (headersRow: any[], keywords: string[]) => {
    return headersRow.findIndex(val => {
      if (!val) return false;
      const s = String(val).toLowerCase();
      return keywords.some(k => s.includes(k.toLowerCase()));
    });
  };

  const smartParseText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    const results: any[] = [];
    
    // Header detection from text if available
    let headerIdx = -1;
    const commonKeywords = ['cod', 'nom', 'pre', 'cost', 'cant'];
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const lineLower = lines[i].toLowerCase();
        if (commonKeywords.filter(k => lineLower.includes(k)).length >= 2) {
            headerIdx = i;
            break;
        }
    }

    const dataLines = headerIdx !== -1 ? lines.slice(headerIdx + 1) : lines;

    for (const line of dataLines) {
      if (line.toLowerCase().includes('total') || line.toLowerCase().includes('fecha')) continue;
      
      // Try Price detection
      const priceMatch = line.match(/(\$?\s?(\d+([.,]\d{2})?)|\$?\s?(\d{2,}))/g);
      let price: number | undefined;
      let cost: number | undefined;
      
      if (priceMatch && priceMatch.length >= 1) {
        price = cleanPrice(priceMatch[priceMatch.length - 1]);
        if (priceMatch.length >= 2) {
            cost = cleanPrice(priceMatch[0]);
        }
      }

      if (price === undefined) continue;

      // Try Code detection
      const codeMatch = line.match(/([A-Z0-9]{3,10}[-.]?[A-Z0-9]{1,10})/i);
      const code = codeMatch ? codeMatch[1].toUpperCase() : `AUTO-${Math.random().toString(36).substring(7).toUpperCase()}`;
      
      // Clean name
      let name = line;
      if (priceMatch) priceMatch.forEach(p => name = name.replace(p, ''));
      if (codeMatch) name = name.replace(codeMatch[0], '');
      name = name.replace(/[-|]/g, ' ').replace(/\s+/g, ' ').trim();
      
      if (name.length < 2) name = "Producto sin nombre";
      
      results.push({ code, name, price, cost });
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

        // Fetch all potential existing data to reduce queries
        const codes = body.data.map(r => r.code).filter(Boolean);
        const existingProducts = codes.length > 0
          ? await trx.selectFrom('products')
            .select(['id', 'code', 'cost', 'price', 'stock_quantity', 'category_id', 'brand_id'])
            .where('code', 'in', codes)
            .where('business_id', '=', businessId)
            .where('deleted_at', 'is', null)
            .execute()
          : [];

        const existingMap = new Map(existingProducts.map(p => [p.code, p]));

        const categoryNames = [...new Set(body.data.map(r => r.category_name).filter(Boolean) as string[])];
        const brandNames = [...new Set(body.data.map(r => r.brand_name).filter(Boolean) as string[])];

        // Resolve or create categories
        const categoryMap = new Map<string, string>();
        for (const name of categoryNames) {
           const lower = name.toLowerCase().trim();
           let cat = await trx.selectFrom('categories')
             .where('business_id', '=', businessId)
             .where('name', 'ilike', name.trim())
             .select(['id'])
             .executeTakeFirst();
           
           if (!cat) {
             const newId = randomUUID();
             await trx.insertInto('categories').values({
               id: newId,
               business_id: businessId,
               name: name.trim(),
               is_active: true
             } as any).execute();
             cat = { id: newId };
           }
           categoryMap.set(lower, cat.id as string);
        }

        // Resolve or create brands
        const brandMap = new Map<string, string>();
        for (const name of brandNames) {
           const lower = name.toLowerCase().trim();
           let brand = await trx.selectFrom('brands')
             .where('business_id', '=', businessId)
             .where('name', 'ilike', name.trim())
             .select(['id'])
             .executeTakeFirst();
           
           if (!brand) {
             const newId = randomUUID();
             await trx.insertInto('brands').values({
               id: newId,
               business_id: businessId,
               name: name.trim()
             } as any).execute();
             brand = { id: newId };
           }
           brandMap.set(lower, brand.id as string);
        }

        for (const row of body.data) {
          try {
            const product = existingMap.get(row.code);
            
            // Resolve IDs
            const categoryId = row.category_id || (row.category_name ? categoryMap.get(row.category_name.toLowerCase().trim()) : null) || null;
            const brandId = row.brand_id || (row.brand_name ? brandMap.get(row.brand_name.toLowerCase().trim()) : null) || null;

            if (product) {
              const updateData: any = { updated_at: new Date() };
              let hasChanges = false;

              if (body.update_costs && row.cost !== undefined && Number(row.cost) !== Number(product.cost)) {
                updateData.cost = row.cost;
                hasChanges = true;
              }

              if (body.update_prices) {
                if (row.price !== undefined && Number(row.price) !== Number(product.price)) {
                  updateData.price = row.price;
                  hasChanges = true;
                } else if (body.auto_margin && row.cost !== undefined) {
                  const newPrice = Math.round(row.cost * (1 + body.margin_percent / 100));
                  if (newPrice !== Number(product.price)) {
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
                stats.updated++;
              }
            } else {
              await trx.insertInto('products').values({
                id: randomUUID(),
                business_id: businessId,
                code: row.code,
                name: row.name || "Producto sin nombre",
                category_id: categoryId,
                brand_id: brandId,
                cost: row.cost || 0,
                price: row.price || (body.auto_margin && row.cost ? row.cost * (1 + body.margin_percent / 100) : (row.cost ? Math.round(row.cost * 1.5) : 0)),
                stock_quantity: row.stock || 0,
                margin_percent: row.margin_percent || null,
                min_stock: 5,
                is_active: true,
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

      if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.getWorksheet(1);
        if (worksheet) {
          let headers: any = {};
          worksheet.eachRow((row, rowNumber) => {
            const values = Array.isArray(row.values) ? row.values : [];
            if (rowNumber === 1) {
              headers.code = findHeaderIndex(values, ['cod', 'sku', 'ref', 'código', 'codigo']);
              headers.name = findHeaderIndex(values, ['nom', 'prod', 'art', 'desc', 'nombre', 'producto', 'articulo', 'artículo']);
              headers.price = findHeaderIndex(values, ['pre', 'venta', 'p.v', 'pvp', 'precio', '($)']);
              headers.cost = findHeaderIndex(values, ['cost', 'compra', 'p.c', 'costo', '($$)']);
              headers.stock = findHeaderIndex(values, ['stoc', 'cant', 'qty', 'units', 'stock', '(+)']);
              headers.category = findHeaderIndex(values, ['cate', 'rubro', 'carpe', 'grupo', 'seccion', 'categoría', 'categoria', 'carpeta']);
              headers.brand = findHeaderIndex(values, ['marca', 'brand', 'fabr']);
              return;
            }
            const code = String(values[headers.code] || values[1] || '').trim();
            if (!code || code === 'undefined' || code === 'null') return;

            parsedData.push({
              code,
              name: values[headers.name] || values[2] || 'Producto sin nombre',
              price: cleanPrice(values[headers.price]),
              cost: cleanPrice(values[headers.cost]),
              stock: cleanPrice(values[headers.stock]),
              category: values[headers.category] || '',
              brand: values[headers.brand] || ''
            });
          });
        }
      } else if (filename.endsWith('.pdf')) {
        if (PDFParse) {
           const data = await PDFParse(buffer);
           parsedData = smartParseText(data.text);
        } else {
           throw new Error("Librería de PDFs no disponible en el servidor.");
        }
      } else if (filename.endsWith('.docx') || filename.endsWith('.doc')) {
        const result = await mammoth.extractRawText({ buffer });
        parsedData = smartParseText(result.value);
      } else {
        parsedData = smartParseText(buffer.toString());
      }
      return reply.send({ data: parsedData });
    } catch (e: any) { 
        console.error('[PARSE-FILE] Error:', e);
        return reply.status(500).send({ error: e.message }); 
    }
  });

  fastify.post('/parse-text', async (request, reply) => {
    const { text } = request.body as { text: string };
    return reply.send({ data: smartParseText(text) });
  });

  fastify.get('/export-template', async (request, reply) => {
    const products = await db.selectFrom('products').select(['code', 'name', 'cost', 'price', 'stock_quantity']).where('deleted_at', 'is', null).execute();
    const csv = [['codigo', 'nombre', 'costo', 'precio', 'stock'].join(','), ...products.map(p => [p.code, `"${p.name}"`, p.cost, p.price, p.stock_quantity].join(','))].join('\n');
    reply.header('Content-Type', 'text/csv').header('Content-Disposition', 'attachment; filename="productos.csv"');
    return reply.send(csv);
  });
};

export default importRoutes;
