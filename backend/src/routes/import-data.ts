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
  const extractValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (val instanceof Date) return val.toISOString();
    
    if (typeof val === 'object') {
      // Handle ExcelJS Formula result
      if (val.result !== undefined) {
        if (val.result && typeof val.result === 'object' && (val.result as any).error) {
           if (val.formula) {
              const matches = String(val.formula).match(/"([^"]*)"/g);
              if (matches && matches.length > 0) {
                 return matches.map(m => m.replace(/"/g, '')).join('');
              }
           }
           return '';
        }
        return extractValue(val.result);
      }
      
      // Handle ExcelJS Rich Text
      if (val.richText && Array.isArray(val.richText)) {
        return val.richText.map((t: any) => t.text || '').join('');
      }
      
      // Handle other common objects
      if (val.text !== undefined) return extractValue(val.text);
      if (val.formula && !val.result) {
         // If formula but no result, try to extract strings from formula as last resort
         const matches = String(val.formula).match(/"([^"]*)"/g);
         if (matches && matches.length > 0) {
            return matches.map(m => m.replace(/"/g, '')).join('');
         }
      }
      
      return ''; // Avoid [object Object]
    }
    
    const str = String(val);
    return str === '[object Object]' ? '' : str;
  };

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
    
    let s = String(val).trim();
    // Remove currency symbols and non-numeric except , and .
    s = s.replace(/[^0-9.,-]/g, '');
    
    if (!s) return undefined;

    // Handle Argentine/European format: 1.234,56
    // If it has both . and , and , comes after .
    if (s.includes('.') && s.includes(',') && s.indexOf('.') < s.indexOf(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } 
    // If it has only , and it looks like a decimal separator (e.g. 10,50)
    else if (s.includes(',') && !s.includes('.')) {
      // If it has multiple commas, it's likely a thousands separator (wrongly used)
      if ((s.match(/,/g) || []).length === 1) {
        s = s.replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    }
    // If it has only . and it looks like a thousands separator (e.g. 1.234)
    else if (s.includes('.') && !s.includes(',')) {
      // If the dot is followed by 3 digits at the end, or there are multiple dots
      if ((s.match(/\./g) || []).length > 1 || (s.indexOf('.') === s.length - 4)) {
        s = s.replace(/\./g, '');
      }
    }

    const parsed = parseFloat(s);
    return isNaN(parsed) ? undefined : parsed;
  };

  const findHeaderIndex = (headersRow: any[], keywords: string[]) => {
    return headersRow.findIndex(val => {
      if (!val) return false;
      const s = String(val).toLowerCase();
      return keywords.some(k => s.includes(k.toLowerCase()));
    });
  };

  const findAllHeaderIndexes = (headersRow: any[], keywords: string[]) => {
    const indexes: number[] = [];
    headersRow.forEach((val, idx) => {
      if (!val) return;
      const s = String(val).toLowerCase();
      if (keywords.some(k => s.includes(k.toLowerCase()))) {
        indexes.push(idx);
      }
    });
    return indexes;
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
          subcategory_name: z.string().optional(),
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
            .select(['id', 'code', 'barcode', 'cost', 'price', 'stock_quantity', 'category_id', 'brand_id'])
            .where('code', 'in', codes)
            .where('business_id', '=', businessId)
            .where('deleted_at', 'is', null)
            .execute()
          : [];

        const existingMap = new Map(existingProducts.map(p => [p.code, p]));

        const categoryNames = [...new Set(body.data.map(r => r.category_name).filter(Boolean) as string[])];
        const brandNames = [...new Set(body.data.map(r => r.brand_name).filter(Boolean) as string[])];

        const parentCategoryNames = [...new Set(body.data.map(r => r.category_name).filter(Boolean) as string[])];
        
        // Resolve or create parent categories
        const categoryMap = new Map<string, string>(); // name -> id
        
        // Fetch ALL active categories for this business to check for global uniqueness
        const allCategories = await trx.selectFrom('categories')
          .where('business_id', '=', businessId)
          .where('is_active', '=', true)
          .select(['id', 'name', 'parent_id'])
          .execute();
          
        const categoryById = new Map<string, any>(allCategories.map(c => [c.id, c]));
        const buildPath = (cat: any): string => {
            if (!cat.parent_id) return cat.name.toLowerCase().trim();
            const parent = categoryById.get(cat.parent_id);
            if (!parent) return cat.name.toLowerCase().trim();
            return `${buildPath(parent)} > ${cat.name.toLowerCase().trim()}`;
        };

        const globalCategoryPathMap = new Map<string, any>(); // full_path_lower -> category
        for (const cat of allCategories) {
          const path = buildPath(cat);
          globalCategoryPathMap.set(path, cat);
        }

        // Resolve or create Parents
        for (const name of parentCategoryNames) {
          const lower = name.toLowerCase().trim();
          let catId = '';
          
          if (globalCategoryPathMap.has(lower)) {
            catId = globalCategoryPathMap.get(lower).id;
          } else {
            const newId = randomUUID();
            await trx.insertInto('categories').values({
              id: newId,
              business_id: businessId,
              name: name.trim(),
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            } as any).execute();
            
            catId = newId;
            const newCat = { id: newId, name: name.trim(), parent_id: null };
            categoryById.set(newId, newCat);
            globalCategoryPathMap.set(lower, newCat);
          }
          categoryMap.set(lower, catId);
        }

        // Resolve or create Subcategories
        const subcategoryMap = new Map<string, string>(); // full path "parent > sub1 > sub2" -> id
        
        for (const row of body.data) {
          if (row.category_name && row.subcategory_name) {
            const parentLower = row.category_name.toLowerCase().trim();
            let currentParentId = categoryMap.get(parentLower);
            if (!currentParentId) continue;
            
            let currentPathLower = parentLower;
            const subNames = row.subcategory_name.split(' > ').map((s: string) => s.trim()).filter(Boolean);
            
            for (const subName of subNames) {
                const subLower = subName.toLowerCase();
                currentPathLower += ` > ${subLower}`;
                
                if (subcategoryMap.has(currentPathLower)) {
                    currentParentId = subcategoryMap.get(currentPathLower)!;
                    continue;
                }
                
                let subId = '';
                if (globalCategoryPathMap.has(currentPathLower)) {
                    const existingCat = globalCategoryPathMap.get(currentPathLower);
                    subId = existingCat.id;
                } else {
                    const newId = randomUUID();
                    await trx.insertInto('categories').values({
                        id: newId,
                        business_id: businessId,
                        name: subName,
                        parent_id: currentParentId,
                        is_active: true,
                        created_at: new Date(),
                        updated_at: new Date()
                    } as any).execute();
                    subId = newId;
                    const newCat = { id: newId, name: subName, parent_id: currentParentId };
                    categoryById.set(newId, newCat);
                    globalCategoryPathMap.set(currentPathLower, newCat);
                }
                
                subcategoryMap.set(currentPathLower, subId);
                currentParentId = subId;
            }
          }
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

        const internalCodes = new Set<string>();
        const internalDuplicates = new Set<string>();

        for (const row of body.data) {
          if (!row.code) continue;
          const cleanCode = String(row.code).trim();
          if (internalCodes.has(cleanCode)) {
              internalDuplicates.add(cleanCode);
          }
          internalCodes.add(cleanCode);
        }

        if (internalDuplicates.size > 0) {
            return reply.status(400).send({
                error: 'El archivo contiene códigos duplicados internos',
                duplicates: Array.from(internalDuplicates)
            });
        }

        for (const row of body.data) {
          try {
            if (!row.code) continue;

            const product = existingMap.get(row.code);
            
            // Resolve IDs
            let categoryId = row.category_id || null;
            if (!categoryId && row.category_name) {
              const parentLower = row.category_name.toLowerCase().trim();
              if (row.subcategory_name) {
                const subNames = String(row.subcategory_name).split(' > ').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
                if (subNames.length > 0) {
                   const fullPath = [parentLower, ...subNames].join(' > ');
                   categoryId = subcategoryMap.get(fullPath) || (globalCategoryPathMap.get(fullPath)?.id || null);
                } else {
                   categoryId = categoryMap.get(parentLower) || null;
                }
              } else {
                categoryId = categoryMap.get(parentLower) || null;
              }
            }
            const brandId = row.brand_id || (row.brand_name ? brandMap.get(row.brand_name.toLowerCase().trim()) : null) || null;

            if (product) {
              const updateData: any = { updated_at: new Date() };
              let hasChanges = false;

              if (body.update_costs && row.cost !== undefined && row.cost !== null && Number(row.cost) !== Number(product.cost)) {
                updateData.cost = row.cost;
                hasChanges = true;
              }

              if (body.update_prices) {
                if (row.price !== undefined && row.price !== null && Number(row.price) !== Number(product.price)) {
                  updateData.price = row.price;
                  hasChanges = true;
                } else if (body.auto_margin && row.cost !== undefined && row.cost !== null) {
                  const newPrice = Math.round(row.cost * (1 + body.margin_percent / 100));
                  if (newPrice !== Number(product.price)) {
                    updateData.price = newPrice;
                    hasChanges = true;
                  }
                }
              }

              if (body.update_stock && row.stock !== undefined && row.stock !== null) {
                const newStock = body.stock_action === 'add'
                  ? (Number(product.stock_quantity) || 0) + Number(row.stock)
                  : Number(row.stock);

                if (newStock !== Number(product.stock_quantity)) {
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

              if (!product.barcode && row.code) {
                updateData.barcode = row.code;
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
                barcode: row.code,
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
          } catch (e: any) { 
            console.error(`[BULK-IMPORT] Error processing row ${row.code}:`, e.message);
            stats.errors.push({ code: row.code, name: row.name, error: e.message }); 
          }
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
        
        // Find first worksheet with data
        let worksheet = workbook.getWorksheet(1);
        for (let i = 1; i <= workbook.worksheets.length; i++) {
            const ws = workbook.getWorksheet(i);
            if (ws && ws.rowCount > 0) {
                worksheet = ws;
                break;
            }
        }

        if (worksheet) {
          let headers: any = { code: -1, name: -1, price: -1, cost: -1, stock: -1, category: -1, subcategories: [], brand: -1 };
          let headerRowNumber = -1;

          // Search for headers in first 10 rows
          for (let i = 1; i <= Math.min(worksheet.rowCount, 10); i++) {
              const row = worksheet.getRow(i);
              const values = Array.isArray(row.values) ? row.values : [];
              
              const h_code = findHeaderIndex(values, ['cod', 'sku', 'ref', 'código', 'codigo']);
              const h_name = findHeaderIndex(values, ['nom', 'prod', 'art', 'desc', 'nombre', 'producto', 'articulo', 'artículo']);
              
              if (h_code !== -1 || h_name !== -1) {
                  headers.code = h_code;
                  headers.name = h_name;
                  headers.price = findHeaderIndex(values, ['pre', 'venta', 'p.v', 'pvp', 'precio', '($)']);
                  headers.cost = findHeaderIndex(values, ['cost', 'compra', 'p.c', 'costo', '($$)']);
                  headers.stock = findHeaderIndex(values, ['stoc', 'cant', 'qty', 'units', 'stock', '(+)']);
                  headers.category = findHeaderIndex(values, ['cate', 'rubro', 'carpe', 'grupo', 'seccion', 'categoría', 'categoria', 'carpeta']);
                  headers.subcategories = findAllHeaderIndexes(values, ['subcate', 'subcarpeta', 'subcategoría', 'sub-categoria']);
                  headers.brand = findHeaderIndex(values, ['marca', 'brand', 'fabr']);
                  headerRowNumber = i;
                  break;
              }
          }

          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber <= headerRowNumber) return;
            
            // Use cell.text for text-based fields to get the evaluated result of formulas
            const codeCell = row.getCell(headers.code !== -1 ? headers.code : 1);
            const code = (codeCell.text || '').trim();
            if (!code || code === 'undefined' || code === 'null') return;

            const nameCell = row.getCell(headers.name !== -1 ? headers.name : 2);
            const name = nameCell.text || 'Producto sin nombre';

            // For numbers, we prefer the raw value for cleaner parsing
            const priceVal = headers.price !== -1 ? row.getCell(headers.price).value : undefined;
            const costVal = headers.cost !== -1 ? row.getCell(headers.cost).value : undefined;
            const stockVal = headers.stock !== -1 ? row.getCell(headers.stock).value : undefined;

            const subcats = headers.subcategories && headers.subcategories.length > 0 
              ? headers.subcategories.map((idx: number) => row.getCell(idx).text).filter(Boolean).join(' > ')
              : '';

            parsedData.push({
              code,
              name,
              price: priceVal !== undefined ? cleanPrice(priceVal) : undefined,
              cost: costVal !== undefined ? cleanPrice(costVal) : undefined,
              stock: stockVal !== undefined ? cleanPrice(stockVal) : undefined,
              category: headers.category !== -1 ? row.getCell(headers.category).text : '',
              subcategory: subcats,
              brand: headers.brand !== -1 ? row.getCell(headers.brand).text : ''
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
