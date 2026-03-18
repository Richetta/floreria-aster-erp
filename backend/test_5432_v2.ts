import pg from 'pg';
const { Pool } = pg;

const url = 'postgresql://postgres.lddrseslgkdaetsidyrv:floreria-aster123@54.232.77.43:5432/postgres';

async function testConnection() {
    const pool = new Pool({ 
        connectionString: url,
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    try {
        console.log('Connecting to 5432...');
        const client = await pool.connect();
        console.log('Connected!');
        const res = await client.query('SELECT 1 as result');
        console.log('Query result:', res.rows);
        client.release();
    } catch (error: any) {
        console.error('Error:', error.message);
        if (error.stack) console.error(error.stack);
    } finally {
        await pool.end();
    }
}

testConnection();
