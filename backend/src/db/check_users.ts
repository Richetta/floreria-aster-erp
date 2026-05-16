import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkDb() {
  await client.connect();
  const res = await client.query('SELECT id, email, username, name, role, password_hash FROM users LIMIT 5');
  console.log('USERS:', res.rows);
  await client.end();
}

checkDb().catch(console.error);
