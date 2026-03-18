import { Client } from 'pg';

const connectionString = 'postgresql://postgres.lddrseslgkdaetsidyrv:floreria-aster123@aws-1-sa-east-1.pooler.supabase.com:6543/postgres';

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
    console.log('Tables found:', res.rows.length);
    if (res.rows.length > 0) {
        console.log('Tables:', res.rows.map(r => r.table_name).join(', '));
    } else {
        console.log('No tables found in public schema.');
    }
    
    await client.end();
  } catch (err: any) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
}

verifyConnection();
