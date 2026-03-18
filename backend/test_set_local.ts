import pg from 'pg';
const { Pool } = pg;

const url = 'postgresql://postgres.lddrseslgkdaetsidyrv:floreria-aster123@54.232.77.43:5432/postgres';

async function testSetLocal() {
    const pool = new Pool({ 
        connectionString: url,
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    try {
        const client = await pool.connect();
        
        console.log('Testing SET LOCAL...');
        await client.query("SET LOCAL app.current_business_id = '00000000-0000-0000-0000-000000000001'");
        
        console.log('Testing GET LOCAL...');
        const res = await client.query("SELECT current_setting('app.current_business_id') as val");
        console.log('Value:', res.rows[0].val);
        
        client.release();
    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

testSetLocal();
