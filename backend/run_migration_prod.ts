import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, './.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const argFile = process.argv[2];
  const sqlFile = argFile ? path.join(process.cwd(), argFile) : path.join(__dirname, './migration_fix_users.sql');
  
  if (!fs.existsSync(sqlFile)) {
    console.error(`Migration file not found: ${sqlFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log('Running migration on Supabase...');
  
  const client = await pool.connect();
  try {
    const res = await client.query(sql);
    console.log('Migration completed successfully!');
    // console.log('Sample users after migration:', (res as any)[res.length - 1].rows);
  } catch (err) {
    console.error('Error running migration:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
