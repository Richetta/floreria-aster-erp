import { db } from './src/db/index.js';

async function inspectDb() {
    try {
        const businesses = await db.selectFrom('businesses').selectAll().execute();
        console.log('BUSINESSES:');
        console.log(JSON.stringify(businesses, null, 2));
        
        const users = await db.selectFrom('users').selectAll().execute();
        console.log('USERS:');
        console.log(JSON.stringify(users, null, 2));
    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
}

inspectDb();
