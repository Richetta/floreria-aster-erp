import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { db } from '../db';
import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import PDFParse from 'pdf-parse';
import { parse as csvParse } from 'csv-parse/sync';
import { sql } from 'kysely';

export const importRoutes: FastifyPluginAsync = async (fastify) => {
  // Register multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  // Validate import data schema
  const importDataSchema = z.array(z.object({
    code: z.string(),
    name: z.string().optional(),
    cost: z.number().nonnegative().optional(),
    price: z.number().nonnegative().optional(),
    stock: z.number().int().nonnegative().optional()
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

  fastify.post('/parse-file', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    try {
      const fileRequest = await request.file();
      if (!fileRequest) return reply.status(400).send({ error: 'No file uploaded' });

      const buffer = await fileRequest.toBuffer();
      const filename = fileRequest.filename.toLowerCase();
      let parsedData: any[] = [];
      let method = '';

      if (filename.endsWith('.xlsx')) {
        method = 'Excel (XLSX)';
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.getWorksheet(1);
        if (worksheet) {
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const values: any = Array.isArray(row.values) ? row.values : [];
            if (values[1]) {
              parsedData.push({
                code: String(values[1]).trim(),
                name: values[2] ? String(values[2]).trim() : undefined,
                cost: cleanPrice(values[3]),
                price: cleanPrice(values[4]),
                stock: values[5] ? parseInt(String(values[5])) : undefined
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

  fastify.post('/import-prices', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin') {
          return reply.code(403).send({ error: 'Only admins can import prices' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    try {
      const body = z.object({
        data: importDataSchema,
        update_costs: z.boolean().default(true),
        update_prices: z.boolean().default(true),
        update_stock: z.boolean().default(false),
        auto_margin: z.boolean().default(false),
        margin_percent: z.number().default(50)
      }).parse(request.body);

      const results = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

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

              await trx
                .updateTable('products')
                .set(updateData)
                .where('id', '=', product.id)
                .execute();

              if ((body.update_costs && row.cost !== undefined) || (body.update_prices && row.price !== undefined)) {
                await trx
                  .insertInto('price_history')
                  .values({
                    id: crypto.randomUUID(),
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
                        id: crypto.randomUUID(),
                        business_id: user.business_id,
                        code: row.code,
                        name: row.name,
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
      console.error('Error importing prices:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Error importing prices: ' + error.message });
    }
  });

  fastify.get('/export-template', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    const csv = await db.transaction().execute(async (trx) => {
      await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(trx);

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
