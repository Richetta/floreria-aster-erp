import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'backend/.env' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Patching transactions...');
    await client.query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS metadata JSONB,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    `);
    
    console.log('Patching stock_movements...');
    await client.query(`
      ALTER TABLE stock_movements 
      ADD COLUMN IF NOT EXISTS metadata JSONB,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    `);
    
    console.log('DONE');
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
