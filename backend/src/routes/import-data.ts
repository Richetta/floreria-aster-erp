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
  // Multipart is already registered globally in server.ts

  // Debug endpoint to verify routes are registered
  fastify.get('/debug', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    console.log('[IMPORT DEBUG] User:', user?.email, 'Role:', user?.role);
    return reply.send({
      status: 'ok',
      routes: [
        'POST /parse-file',
        'POST /parse-text',
        'POST /import-prices',
        'GET /export-template'
      ],
      user: {
        email: user?.email,
        role: user?.role,
        business_id: user?.business_id
      }
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

  // ============================================
  // SMART PARSE ENGINE
  // ============================================

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

      let name = line
        .replace(priceMatch[0], '')
        .replace(codeMatch ? codeMatch[0] : '', '')
        .replace(/[-|]/g, ' ')
        .trim();

      if (name.length < 2) name = "Producto sin nombre";

      results.push({ code, name, price });
    }
    return results;
  };

  // ============================================
  // ENDPOINTS
  // ============================================

  fastify.post('/parse-file', async (request, reply) => {
    try {
      const fileRequest = await request.file();
      if (!fileRequest) {
        console.error('[IMPORT] No file uploaded');
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const filename = fileRequest.filename.toLowerCase();
      console.log(`[IMPORT] Parsing file: ${filename}`);
      
      const buffer = await fileRequest.toBuffer();
      if (!buffer || buffer.length === 0) {
        console.error('[IMPORT] Empty buffer received');
        throw new Error('El archivo está vacío');
      }

      let parsedData: any[] = [];
      let method = '';

      if (filename.endsWith('.xlsx')) {
        method = 'Excel (XLSX)';
        console.log('[IMPORT] Using ExcelJS for XLSX');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.getWorksheet(1);
        if (worksheet) {
          let headers: Record<string, number> = {};
          
          worksheet.eachRow((row, rowNumber) => {
            const values = Array.isArray(row.values) ? row.values : [];
            
            if (rowNumber === 1) {
              // Find column indices from headers
              values.forEach((val, idx) => {
                const s = String(val).toLowerCase();
                if (s.includes('cod') || s.includes('art')) headers.code = idx;
                if (s.includes('nom') || s.includes('desc') || s.includes('prod')) headers.name = idx;
                if (s.includes('cos')) headers.cost = idx;
                if (s.includes('pre') || s.includes('vent')) headers.price = idx;
                if (s.includes('stoc') || s.includes('cant')) headers.stock = idx;
              });
              console.log('[IMPORT] Detected headers:', headers);
              return;
            }

            const code = headers.code ? String(values[headers.code]).trim() : undefined;
            if (code) {
              parsedData.push({
                code,
                name: headers.name ? String(values[headers.name] || '').trim() : undefined,
                cost: headers.cost ? cleanPrice(values[headers.cost]) : undefined,
                price: headers.price ? cleanPrice(values[headers.price]) : 0,
                stock: headers.stock ? cleanPrice(values[headers.stock]) : 0,
              });
            } else if (values[1]) {
              // Fallback to old positional parsing if no headers found or first column has data
              parsedData.push({
                code: String(values[1]).trim(),
                name: values[2] ? String(values[2]).trim() : undefined,
                cost: cleanPrice(values[3]),
                price: cleanPrice(values[4]),
                stock: cleanPrice(values[5])
              });
            }
          });
        }
      } 
      else if (filename.endsWith('.pdf')) {
        method = 'PDF (OCR/Text)';
        // Handle PDFParse as any to avoid callable signature issues
        const data = await (PDFParse as any)(buffer);
        parsedData = smartParseText(data.text);
      }
      else if (filename.endsWith('.docx')) {
        method = 'Word (DOCX)';
        const data = await mammoth.extractRawText({ buffer: buffer as any });
        parsedData = smartParseText(data.value);
      }
      else {
        method = 'CSV / Text';
        const content = buffer.toString('utf-8');
        try {
          const records = csvParse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true
          });
          
          parsedData = records.map((r: any) => ({
            code: r.codigo || r.code || r.cod || Object.values(r)[0],
            name: r.nombre || r.name || r.producto || r.description,
            cost: cleanPrice(r.costo || r.cost),
            price: cleanPrice(r.precio || r.price || r.venta),
            stock: r.stock || r.cantidad ? parseInt(String(r.stock || r.cantidad)) : undefined
          }));
        } catch (e) {
          parsedData = smartParseText(content);
        }
      }

      return reply.send({
        method,
        filename,
        total_rows: parsedData.length,
        data: parsedData.slice(0, 100),
        raw_rows: parsedData
      });
    } catch (error: any) {
      console.error('Error parsing file:', error);
      return reply.status(500).send({ error: 'Error processing file: ' + error.message });
    }
  });

  fastify.post('/parse-text', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    try {
      const { text } = request.body as { text: string };
      if (!text) return reply.status(400).send({ error: 'No text provided' });

      const parsedData = smartParseText(text);

      return reply.send({
        method: 'Texto pegado',
        filename: 'texto_pegado.txt',
        total_rows: parsedData.length,
        data: parsedData.slice(0, 100),
        raw_rows: parsedData
      });
    } catch (error: any) {
      console.error('Error parsing text:', error);
      return reply.status(500).send({ error: 'Error processing text: ' + error.message });
    }
  });

  // Import prices endpoint - uses global auth hook, only checks admin role here
  // Import prices endpoint
  fastify.post('/import-prices', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    console.log(`[IMPORT-PRICES] Request: ${request.method} ${request.url} User: ${user?.email}`);

    // Check admin role
    if (user.role !== 'admin') {
      console.log('[IMPORT-PRICES] Forbidden: Not admin');
      return reply.code(403).send({ error: 'Only admins can import prices' });
    }

    try {
      const body = z.object({
        data: importDataSchema,
        update_costs: z.boolean().default(true),
        update_prices: z.boolean().default(true),
        update_stock: z.boolean().default(false),
        auto_margin: z.boolean().default(false),
        margin_percent: z.number().default(50)
      }).parse(request.body);

      console.log('[IMPORT-PRICES] Validation passed, importing', body.data.length, 'products');

      const results = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

        const stats = {
          updated: 0,
          created: 0,
          errors: [] as any[]
        };

        for (const row of body.data) {
          try {
            const product = await trx
              .selectFrom('products')
              .select(['id', 'cost', 'price', 'stock_quantity'])
              .where('code', '=', row.code)
              .where('deleted_at', 'is', null)
              .executeTakeFirst();

            if (product) {
              const updateData: any = { updated_at: new Date() };

              if (body.update_costs && row.cost !== undefined) {
                updateData.cost = row.cost;
              }

              if (body.update_prices && row.price !== undefined) {
                updateData.price = row.price;
              } else if (body.auto_margin && row.cost !== undefined) {
                updateData.price = row.cost * (1 + body.margin_percent / 100);
              }

              if (body.update_stock && row.stock !== undefined) {
                updateData.stock_quantity = row.stock;
              }

              if (row.category_id !== undefined) {
                updateData.category_id = row.category_id;
              }

              await trx
                .updateTable('products')
                .set(updateData)
                .where('id', '=', product.id)
                .execute();

              if ((body.update_costs && row.cost !== undefined) || (body.update_prices && row.price !== undefined)) {
                await trx
                  .insertInto('price_history')
                  .values({
                    id: randomUUID(),
                    business_id: user.business_id,
                    product_id: product.id,
                    old_cost: product.cost,
                    old_price: product.price,
                    new_cost: body.update_costs && row.cost !== undefined ? row.cost : typeof product.cost === 'string' ? parseFloat(product.cost) : product.cost,
                    new_price: body.update_prices && row.price !== undefined ? row.price : 
                              body.auto_margin && row.cost !== undefined ? row.cost * (1 + body.margin_percent / 100) : typeof product.price === 'string' ? parseFloat(product.price) : product.price,
                    changed_by: user.sub,
                    reason: 'Smart Import',
                    created_at: new Date(),
                    metadata: {}
                  } as any)
                  .execute();
              }

              stats.updated++;
            } else if (row.name) {
                await trx
                    .insertInto('products')
                    .values({
                        id: randomUUID(),
                        business_id: user.business_id,
                        code: row.code,
                        name: row.name,
                        category_id: row.category_id || null,
                        cost: row.cost || 0,
                        price: row.price || (body.auto_margin && row.cost ? row.cost * (1 + body.margin_percent / 100) : 0),
                        stock_quantity: row.stock || 0,
                        min_stock: 5,
                        is_active: true,
                        is_barcode: false,
                        tags: [],
                        images: [],
                        created_at: new Date(),
                        updated_at: new Date()
                    } as any)
                    .execute();
                stats.created++;
            } else {
              stats.errors.push({ code: row.code, error: 'Product not found and no name provided' });
            }
          } catch (error: any) {
            stats.errors.push({ code: row.code, error: error.message });
          }
        }
        return stats;
      });

      return reply.send(results);
    } catch (error: any) {
      console.error('[IMPORT-PRICES] Error:', error);
      console.error('[IMPORT-PRICES] Stack:', error.stack);
      if (error instanceof z.ZodError) {
        console.log('[IMPORT-PRICES] Validation errors:', JSON.stringify(error.errors));
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({
        error: 'Error importing prices: ' + error.message,
        debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  fastify.get('/export-template', async (request, reply) => {
    const user = request.user as any;
    console.log('[EXPORT-TEMPLATE] User:', user?.email);

    const csv = await db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(trx);

      const products = await trx
        .selectFrom('products')
        .select(['code', 'name', 'cost', 'price', 'stock_quantity'])
        .where('deleted_at', 'is', null)
        .orderBy('name', 'asc')
        .execute();

      return [
        ['codigo', 'nombre', 'costo', 'precio', 'stock'].join(','),
        ...products.map(p => [
          p.code,
          `"${p.name}"`,
          p.cost,
          p.price,
          p.stock_quantity
        ].join(','))
      ].join('\n');
    });

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="productos_aster.csv"');
    
    return reply.send(csv);
  });
};

export default importRoutes;

