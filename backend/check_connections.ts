import { db } from './src/db/index.js';
import { sql } from 'kysely';

async function checkConnections() {
    try {
        const res = await sql`
            SELECT count(*) as count
            FROM pg_stat_activity;
        `.execute(db);
        
        console.log('ACTIVE CONNECTIONS:', res.rows[0].count);

        const details = await sql`
            SELECT usename, application_name, client_addr, state, query
            FROM pg_stat_activity
            WHERE state != 'idle' OR query IS NOT NULL
            LIMIT 20;
        `.execute(db);
        console.log('DETAILS:', JSON.stringify(details.rows, null, 2));

    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
}

checkConnections();
