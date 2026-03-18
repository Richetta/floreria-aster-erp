import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres.lddrseslgkdaetsidyrv:floreria-aster123@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

async function verifyConnection() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to Supabase...');
    await client.connect();
    console.log('Connected successfully!');
    
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables found:', res.rows.map(r => r.table_name).join(', '));
    
    await client.end();
  } catch (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
}

verifyConnection();
