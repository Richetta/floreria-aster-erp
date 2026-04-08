import { db } from './index.js';
import { sql } from 'kysely';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runRlsMigration() {
  console.log('--- RUNNING RLS POLICIES MIGRATION ---');
  
  const sqlPath = path.join(__dirname, 'rls_migration.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  
  try {
    await sql.raw(sqlContent).execute(db);
    console.log(`Successfully executed all RLS policies.`);
  } catch (err: any) {
    console.error(`Error executing RLS migration:`, err);
  }
  
  console.log('--- RLS MIGRATION COMPLETED ---');
}

runRlsMigration().catch(console.error);
