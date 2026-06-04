import { db } from '../db/index.js';
import { sql } from 'kysely';

async function testUpdate() {
  const businessId = 'da2168de-831d-4420-99ae-6244ac65ff58'; // Floreria Aster
  console.log('Using business_id:', businessId);

  // Set business ID context
  await sql`SELECT set_config('app.current_business_id', ${businessId}, true)`.execute(db);

  // Get first product
  const product = await db
    .selectFrom('products')
    .selectAll()
    .where('business_id', '=', businessId)
    .where('deleted_at', 'is', null)
    .limit(1)
    .executeTakeFirst();

  if (!product) {
    console.log('No products found for this business.');
    process.exit(0);
  }

  console.log('Found product:', {
    id: product.id,
    name: product.name,
    code: product.code,
    price: product.price,
    cost: product.cost,
  });

  const originalName = product.name;
  const newName = originalName + ' (TEST-UPDATE)';

  console.log(`Updating product name to: ${newName}...`);

  // Run update transaction
  const result = await db.transaction().execute(async (trx) => {
    await sql`SELECT set_config('app.current_business_id', ${businessId}, true)`.execute(trx);

    return await trx
      .updateTable('products')
      .set({
        name: newName,
        updated_at: new Date()
      } as any)
      .where('id', '=', product.id)
      .returningAll()
      .executeTakeFirst();
  });

  console.log('Update query returned:', result ? { id: result.id, name: result.name } : 'undefined');

  // Verify fetch
  await sql`SELECT set_config('app.current_business_id', ${businessId}, true)`.execute(db);
  const updatedProduct = await db
    .selectFrom('products')
    .selectAll()
    .where('id', '=', product.id)
    .executeTakeFirst();

  console.log('Fresh fetch returned name:', updatedProduct?.name);

  // Revert back
  console.log('Reverting change...');
  await db.transaction().execute(async (trx) => {
    await sql`SELECT set_config('app.current_business_id', ${businessId}, true)`.execute(trx);
    await trx
      .updateTable('products')
      .set({ name: originalName, updated_at: new Date() } as any)
      .where('id', '=', product.id)
      .execute();
  });
  console.log('Reverted successfully.');
  process.exit(0);
}

testUpdate().catch(err => {
  console.error('Error in test:', err);
  process.exit(1);
});
