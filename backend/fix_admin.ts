import { db } from './src/db/index.js';
import bcrypt from 'bcrypt';

async function fixAdmin() {
    try {
        const passwordHash = await bcrypt.hash('admin', 10);
        
        console.log('Upserting admin user...');
        
        const result = await db.insertInto('users')
            .values({
                id: '00000000-0000-0000-0000-000000000001',
                business_id: '00000000-0000-0000-0000-000000000001',
                name: 'Administrador',
                email: 'admin',
                password_hash: passwordHash,
                role: 'admin',
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            } as any)
            .onConflict((oc) => oc
                .column('id')
                .doUpdateSet({
                    email: 'admin',
                    password_hash: passwordHash,
                    name: 'Administrador',
                    updated_at: new Date()
                })
            )
            .executeTakeFirst();
            
        console.log('Admin user fixed successfully!');
        
    } catch (error) {
        console.error('Error fixing admin:', error);
    } finally {
        process.exit();
    }
}

fixAdmin();
