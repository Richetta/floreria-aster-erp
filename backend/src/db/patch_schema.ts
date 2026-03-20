import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function patch() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  try {
    console.log('Patching transactions table...');
    await client.query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS metadata JSONB,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    `);

    console.log('Patching stock_movements table...');
    await client.query(`
      ALTER TABLE stock_movements 
      ADD COLUMN IF NOT EXISTS metadata JSONB,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log('Success!');
  } catch (err) {
    console.error('Error patching database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

patch();
