const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const tables = ['transactions', 'stock_movements'];
    for (const table of tables) {
      console.log(`Patching ${table}...`);
      try {
        await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS metadata JSONB`);
        console.log(`Added metadata to ${table}`);
      } catch (e) { console.log(`Metadata skip on ${table}: ${e.message}`); }
      
      try {
        await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE`);
        console.log(`Added deleted_at to ${table}`);
      } catch (e) { console.log(`Deleted_at skip on ${table}: ${e.message}`); }
    }
    console.log('DONE');
  } catch (err) {
    console.error('CRITICAL ERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
