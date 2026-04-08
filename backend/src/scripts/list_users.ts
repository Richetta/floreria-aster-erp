import { db } from '../db/index.js';

async function listUsers() {
  const users = await db.selectFrom('users').selectAll().execute();
  const businesses = await db.selectFrom('businesses').selectAll().execute();
  const categories = await db.selectFrom('categories').selectAll().execute();
  
  console.log('--- USERS ---');
  console.table(users.map(u => ({ id: u.id, name: u.name, email: u.email, business_id: u.business_id })));
  
  console.log('\n--- BUSINESSES ---');
  console.table(businesses.map(b => ({ id: b.id, name: b.name })));

  console.log('\n--- CATEGORIES COUNT ---');
  console.log(`Total categories: ${categories.length}`);
}

listUsers().catch(console.error);
