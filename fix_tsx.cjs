const fs = require('fs');
let content = fs.readFileSync('src/pages/Orders/Orders.tsx', 'utf8');
content = content.replace('// removed trailing tags', '    );\n};');
content = content.replace('col, idx', 'col');
fs.writeFileSync('src/pages/Orders/Orders.tsx', content);
console.log('Fixed syntax in Orders.tsx');
