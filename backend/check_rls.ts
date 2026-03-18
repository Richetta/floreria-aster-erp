import { db } from './src/db/index.js';
import { sql } from 'kysely';

async function checkRls() {
    try {
        const policies = await sql`
            SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
            FROM pg_policies
            WHERE tablename IN ('products', 'users', 'businesses', 'categories');
        `.execute(db);
        
        console.log('RLS POLICIES:');
        console.log(JSON.stringify(policies.rows, null, 2));

        const rlsEnabled = await sql`
            SELECT tablename, rowsecurity
            FROM pg_tables
            WHERE tablename IN ('products', 'users', 'businesses', 'categories');
        `.execute(db);
        
        console.log('RLS ENABLED STATUS:');
        console.log(JSON.stringify(rlsEnabled.rows, null, 2));
    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
}

checkRls();
