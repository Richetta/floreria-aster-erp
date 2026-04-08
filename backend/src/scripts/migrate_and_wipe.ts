import { db } from '../db/index.js';
import { randomUUID } from 'crypto';
import { sql } from 'kysely';

const DEFAULT_CATEGORIES = [
  'Ramos', 'Flores', 'Macetas', 'Regalería', 
  'Plantas Interior', 'Plantas Exterior', 'Tierra', 'Insumos'
];

async function migrateAndWipe() {
  console.log('--- STARTING MIGRATION AND WIPE ---');

  // 1. Get all users
  const users = await db.selectFrom('users').selectAll().execute();
  console.log(`Found ${users.length} users.`);

  // 2. Create a new business for each user and update user
  for (const user of users) {
    if (user.email === 'admin') continue; // Optional: skip internal admin or handle separately

    const newBusinessId = randomUUID();
    const businessName = user.name || user.email.split('@')[0];
    
    console.log(`Creating business "${businessName}" for user ${user.email}...`);
    
    await db.insertInto('businesses')
      .values({
        id: newBusinessId,
        name: businessName,
        currency: 'ARS',
        created_at: new Date(),
        updated_at: new Date()
      } as any)
      .execute();

    await db.updateTable('users')
      .set({ business_id: newBusinessId, updated_at: new Date() })
      .where('id', '=', user.id)
      .execute();

    // Seed default categories
    console.log(`Seeding categories for "${businessName}"...`);
    for (const catName of DEFAULT_CATEGORIES) {
      await db.insertInto('categories')
        .values({
          id: randomUUID(),
          business_id: newBusinessId,
          name: catName,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        } as any)
        .execute();
    }
  }

  // 3. Wipe all operational data
  const tablesToWipe = [
    'categories', 'customers', 'price_history', 'stock_movements', 
    'stock_reservations', 'orders', 'packages', 'suppliers', 
    'package_components', 'waste_logs', 'app_settings', 'transactions', 
    'user_activity', 'order_items', 'products', 'supplier_products',
    'subscriptions', 'subscription_usage_logs', 'subscription_events'
  ];

  console.log('\n--- WIPING OPERATIONAL DATA ---');
  for (const table of tablesToWipe) {
    console.log(`Truncating ${table}...`);
    // Using TRUNCATE with CASCADE to handle foreign keys
    await sql`TRUNCATE TABLE ${sql.table(table)} CASCADE`.execute(db);
  }

  console.log('\n--- SUCCESS: Database migrated and wiped ---');
}

migrateAndWipe().catch(console.error);
