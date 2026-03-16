const fs = require('fs');
const path = require('path');

const posFile = path.resolve('src/pages/POS/POS.tsx');
let content = fs.readFileSync(posFile, 'utf8');

// I accidentally declared it on line 41 from the first multi_replace, AND also added it on line 88 with fix_pos 
content = content.replace("const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');\n", "");

fs.writeFileSync(posFile, content);
console.log('Cleaned duplicate definition.');
