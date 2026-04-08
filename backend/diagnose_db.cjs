const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function diagnose() {
    try {
        console.log("--- Checking Active Locks ---");
        const locks = await pool.query(`
            SELECT a.pid, locktype, mode, granted, query 
            FROM pg_locks l 
            JOIN pg_stat_activity a ON l.pid = a.pid 
            WHERE NOT l.pid = pg_backend_pid();
        `);
        console.table(locks.rows);

        console.log("\n--- Checking All Tables ---");
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
        `);
        const tables = tablesResult.rows.map(r => r.table_name);
        console.log("Found tables:", tables.join(', '));
        for (const table of tables) {
            const schema = await pool.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = $1;
            `, [table]);
            console.log(`\nTable: ${table}`);
            console.table(schema.rows);
        }

        console.log("\n--- Checking Last Transactions ---");
        const lastTrans = await pool.query(`SELECT id, type, amount, created_at FROM transactions ORDER BY created_at DESC LIMIT 5`);
        console.table(lastTrans.rows);

    } catch (err) {
        console.error("Diagnostic failed:", err);
    } finally {
        await pool.end();
    }
}

diagnose();
