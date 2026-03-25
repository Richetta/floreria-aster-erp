import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  // GET LOW STOCK GROUPED BY SUPPLIER
  fastify.get('/restock', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    try {
      // Get all products where stock_quantity <= min_stock
      // Left join with supplier_products and suppliers to get the supplier info
      const lowStockItems = await db
        .selectFrom('products as p')
        .leftJoin('supplier_products as sp', 'sp.product_id', 'p.id')
        .leftJoin('suppliers as s', 's.id', 'sp.supplier_id')
        .select([
          'p.id',
          'p.code',
          'p.name',
          'p.stock_quantity',
          'p.min_stock',
          'p.cost',
          's.id as supplier_id',
          's.name as supplier_name',
          's.phone as supplier_phone',
        ])
        .whereRef('p.stock_quantity', '<=', 'p.min_stock')
        .where('p.deleted_at', 'is', null)
        .where('p.is_active', '=', true)
        .orderBy('p.name', 'asc')
        .execute();

      // Group by supplier
      const grouped = lowStockItems.reduce((acc, item) => {
        const supplierId = item.supplier_id || 'unassigned';
        
        if (!acc[supplierId]) {
          acc[supplierId] = {
            supplierId: item.supplier_id || null,
            supplierName: item.supplier_name || 'Sin Proveedor Asignado',
            supplierPhone: item.supplier_phone || null,
            items: []
          };
        }
        
        acc[supplierId].items.push({
          id: item.id,
          code: item.code,
          name: item.name,
          stock: item.stock_quantity,
          minStock: item.min_stock,
          cost: item.cost
        });
        
        return acc;
      }, {} as Record<string, any>);

      return reply.send(Object.values(grouped));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch restock data' });
    }
  });
};

export default inventoryRoutes;
