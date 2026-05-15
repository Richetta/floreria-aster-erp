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

async function promote(email: string) {
  if (!email) {
    console.error('Usage: node promote_user.js <email>');
    return;
  }

  console.log(`Connecting to database to promote ${email}...`);
  const client = await pool.connect();
  try {
    const res = await client.query(
      "UPDATE users SET role = 'owner', is_active = true WHERE email = $1 RETURNING id, name, role",
      [email]
    );

    if (res.rowCount === 0) {
      console.log('No user found with that email.');
    } else {
      console.log('User promoted successfully:', res.rows[0]);
    }
  } catch (err) {
    console.error('Error promoting user:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

// Get email from command line or use a default if you want to hardcode it for the user
const targetEmail = process.argv[2];
promote(targetEmail);
