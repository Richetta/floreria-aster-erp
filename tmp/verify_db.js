import pkg from 'pg';
const { Client } = pkg;

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
    
    // Check tables
    const resTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables found:', resTables.rows.map(r => r.table_name).join(', '));
    
    // Check users table columns
    const resColumns = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
    console.log('Columns in users table:');
    resColumns.rows.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));
    
    // Check if there are any users
    const resUsers = await client.query("SELECT count(*) FROM users");
    console.log(`Total users: ${resUsers.rows[0].count}`);
    
    await client.end();
  } catch (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
}

verifyConnection();
