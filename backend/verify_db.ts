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
    
    const res = await client.query('SELECT id, name, email FROM users');
    console.log('Users found:', res.rows.length);
    console.log(JSON.stringify(res.rows, null, 2));

    const resBus = await client.query('SELECT id, name FROM businesses');
    console.log('Businesses found:', resBus.rows.length);
    console.log(JSON.stringify(resBus.rows, null, 2));
    
    await client.end();
  } catch (err: any) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
}

verifyConnection();
