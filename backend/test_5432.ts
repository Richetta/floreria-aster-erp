const url = 'postgresql://postgres.lddrseslgkdaetsidyrv:floreria-aster123@54.232.77.43:5432/postgres?sslmode=require';
import pg from 'pg';
const { Pool } = pg;

async function testConnection() {
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
        const client = await pool.connect();
        console.log('Connected to 5432!');
        const res = await client.query('SELECT 1');
        console.log('Query result:', res.rows);
        client.release();
    } catch (error: any) {
        console.error('Error on 5432:', error.message);
    } finally {
        await pool.end();
    }
}

testConnection();
