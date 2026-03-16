
import { db } from './src/db';

async function checkUsers() {
    try {
        const users = await db.selectFrom('users').selectAll().execute();
        console.log('Users in database:', users.length);
        users.forEach(u => console.log(`- ${u.name} (${u.email}) role: ${u.role}`));
        
        const businesses = await db.selectFrom('businesses').selectAll().execute();
        console.log('Businesses in database:', businesses.length);
        businesses.forEach(b => console.log(`- ${b.name} (${b.id})`));
    } catch (error) {
        console.error('Error checking database:', error.message);
    } finally {
        process.exit();
    }
}

checkUsers();
