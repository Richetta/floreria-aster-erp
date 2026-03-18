import fs from 'fs';
import path from 'path';

const routesDir = 'c:/Users/Juan/Documents/Floreria/floreria-aster-erp/backend/src/routes';
const files = fs.readdirSync(routesDir);

const target = /await sql`SET LOCAL app\.current_business_id = \${user\.business_id}`\.execute\((db|trx)\);/g;
const replacement = "await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute($1);";

files.forEach(file => {
    if (file.endsWith('.ts')) {
        const filePath = path.join(routesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        if (target.test(content)) {
            console.log(`Fixing ${file}...`);
            const newContent = content.replace(target, replacement);
            fs.writeFileSync(filePath, newContent);
        }
    }
});
