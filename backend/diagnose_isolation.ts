import { db } from './src/db/index.js';

/**
 * Script de diagnóstico para detectar problemas de aislamiento de usuarios.
 * Ejecutar con: npx ts-node diagnose_isolation.ts
 */

async function diagnoseIsolation() {
  console.log('=== DIAGNÓSTICO DE AISLAMIENTO DE USUARIOS ===\n');

  // 1. Todos los usuarios y sus negocios
  const users = await db
    .selectFrom('users')
    .innerJoin('businesses', 'businesses.id', 'users.business_id')
    .select([
      'users.id',
      'users.email',
      'users.google_id' as any,
      'users.role',
      'users.is_active',
      'users.created_at',
      'businesses.id as business_id',
      'businesses.name as business_name'
    ])
    .orderBy('businesses.id')
    .orderBy('users.created_at')
    .execute();

  console.log(`Total usuarios: ${users.length}\n`);
  
  // 2. Agrupar por business_id
  const byBusiness: Record<string, typeof users> = {};
  for (const user of users) {
    const bid = (user as any).business_id;
    if (!byBusiness[bid]) byBusiness[bid] = [];
    byBusiness[bid].push(user);
  }

  let problemCount = 0;
  for (const [businessId, businessUsers] of Object.entries(byBusiness)) {
    const hasMultiple = businessUsers.length > 1;
    const googleUsers = businessUsers.filter(u => (u as any).google_id);
    const hasMultipleGoogleUsers = googleUsers.length > 1;
    
    if (hasMultipleGoogleUsers) {
      problemCount++;
      console.log(`⚠️  PROBLEMA DETECTADO en Business ${businessId}:`);
      for (const u of businessUsers) {
        console.log(`   - ${u.email} | google_id: ${(u as any).google_id || 'NINGUNO'} | role: ${u.role}`);
      }
      console.log('');
    } else if (hasMultiple) {
      console.log(`ℹ️  Business con múltiples usuarios (normal - equipo): ${businessId}`);
      for (const u of businessUsers) {
        console.log(`   - ${u.email} | google_id: ${(u as any).google_id || 'NINGUNO'} | role: ${u.role}`);
      }
      console.log('');
    }
  }

  if (problemCount === 0) {
    console.log('✅ No se detectaron mezclas de cuentas de Google diferentes\n');
  } else {
    console.log(`\n❌ Se detectaron ${problemCount} negocio(s) con múltiples cuentas Google mezcladas`);
    console.log('Para separar cuentas mezcladas, ejecutar fix_user_isolation.sql en la base de datos\n');
  }

  // 3. Emails duplicados
  const allEmails = users.map(u => u.email);
  const dupeEmails = allEmails.filter((email, i) => allEmails.indexOf(email) !== i);
  if (dupeEmails.length > 0) {
    console.log('\n⚠️  Emails duplicados (mismo email en distintos negocios):');
    for (const email of [...new Set(dupeEmails)]) {
      const dupeUsers = users.filter(u => u.email === email);
      for (const u of dupeUsers) {
        console.log(`   - ${email} → business: ${(u as any).business_id}, google_id: ${(u as any).google_id || 'NINGUNO'}`);
      }
    }
  }

  process.exit(0);
}

diagnoseIsolation().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
