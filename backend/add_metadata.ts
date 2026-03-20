import { db } from './src/db/index';
import { sql } from 'kysely';

async function run() {
  try {
    console.log('Adding metadata column to transactions table...');
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS metadata JSONB`.execute(db);
    console.log('Successfully added metadata column.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to add metadata column:', err);
    process.exit(1);
  }
}

run();
