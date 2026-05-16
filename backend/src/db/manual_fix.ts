import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function runFix() {
  await client.connect();
  
  console.log('Running manual database fix...');
  
  try {
    // 1. Add columns if missing (should be there but just in case)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255)`);

    // 2. Promote everyone to owner who isn't already
    const res1 = await client.query(`UPDATE users SET role = 'owner' WHERE role != 'owner' OR role IS NULL`);
    console.log(`Promoted ${res1.rowCount} users to owner.`);

    // 3. Set 'admin' username and password
    const res2 = await client.query(`
      UPDATE users 
      SET name = 'Administrador', 
          username = 'admin',
          password_hash = COALESCE(password_hash, '$2b$10$rD/vMwS0y4DJiXKfabu1.ezLYHzWvE85.FEMlIuItE8XTh5tYBDAi')
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER(PARTITION BY business_id ORDER BY created_at ASC) as rn
          FROM users
        ) t WHERE rn = 1
      ) AND (username IS NULL OR username = '' OR username = 'admin')
    `);
    console.log(`Normalized ${res2.rowCount} primary users to 'admin'.`);

  } catch (err) {
    console.error('Error running fix:', err);
  } finally {
    await client.end();
  }
}

runFix().catch(console.error);
