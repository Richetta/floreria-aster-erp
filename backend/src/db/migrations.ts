import { sql } from 'kysely';
import { db } from './index.js';

/**
 * Emergency Migrations - Runs on server startup to ensure critical tables exist.
 * This is used to fix production issues where manual SQL migration might be missed.
 */
export async function runEmergencyMigrations() {
  console.log('--- STARTING EMERGENCY MIGRATIONS ---');
  
  try {
    // 1. Ensure supplier_products table exists
    await sql`
      CREATE TABLE IF NOT EXISTS supplier_products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id),
        supplier_product_name VARCHAR(255),
        supplier_product_code VARCHAR(100),
        cost DECIMAL(10,2) NOT NULL,
        min_order_quantity INTEGER DEFAULT 1,
        last_purchase_date TIMESTAMP WITH TIME ZONE,
        last_purchase_cost DECIMAL(10,2),
        UNIQUE(supplier_id, supplier_product_code)
      )
    `.execute(db);
    console.log('✔ Table supplier_products verified/created');

    // 2. Ensure supplier_id exists in products table
    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id)`.execute(db);
      console.log('✔ Column supplier_id added to products table');
    } catch (err) {
      // Column might already exist, which is fine
      console.log('ℹ Column supplier_id in products table (already exists or error handled)');
    }

    console.log('--- EMERGENCY MIGRATIONS COMPLETED ---');
  } catch (error) {
    console.error('❌ EMERGENCY MIGRATIONS FAILED:', error);
  }
}
