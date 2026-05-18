import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  await client.connect();
  const res = await client.query(`SELECT id, email, username, business_id, created_at FROM users WHERE business_id = '00000000-0000-0000-0000-000000000001' ORDER BY created_at ASC`);
  console.log(res.rows);
  await client.end();
}
check();
