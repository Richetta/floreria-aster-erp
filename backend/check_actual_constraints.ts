import { db } from './src/db/index.js';
import { sql } from 'kysely';

async function checkConstraints() {
    try {
        const res = await sql`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'products';
        `.execute(db);
        
        console.log('CONSTRAINTS ON PRODUCTS:');
        console.log(JSON.stringify(res.rows, null, 2));

    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
}

checkConstraints();
