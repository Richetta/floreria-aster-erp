import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(file));
    } else if (file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = findFiles(path.join(__dirname, 'src', 'pages'));
const arrays = ['packages', 'products', 'customers', 'transactions', 'orders', 'suppliers', 'rawWasteHistory', 'dateFilteredHistory', 'birthdayReminders', 'debtReminders'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  arrays.forEach(arr => {
    // replace `arr.filter(` with `(arr || []).filter(`
    // using regex with negative lookbehind to avoid `((arr || []).filter(`
    const regexFilter = new RegExp('(?<!\\()\\b' + arr + '\\.filter\\(', 'g');
    content = content.replace(regexFilter, '(' + arr + ' || []).filter(');
    
    // only apply .some and .map and .reduce safely (avoiding redefining existing ones if possible)
    const regexSome = new RegExp('(?<!\\()\\b' + arr + '\\.some\\(', 'g');
    content = content.replace(regexSome, '(' + arr + ' || []).some(');
    
    const regexMap = new RegExp('(?<!\\()\\b' + arr + '\\.map\\(', 'g');
    content = content.replace(regexMap, '(' + arr + ' || []).map(');
    
    const regexReduce = new RegExp('(?<!\\()\\b' + arr + '\\.reduce\\(', 'g');
    content = content.replace(regexReduce, '(' + arr + ' || []).reduce(');
  });
  
  // Protect spread arrays: ...categories -> ...(categories || [])
  content = content.replace(/\.\.\.categories\b/g, '...(categories || [])');
  content = content.replace(/\.\.\.transactions\b/g, '...(transactions || [])');
  
  // Extra specific for POS.tsx: 
  content = content.replace(/\(products \|\| \[\]\).some/g, '(products || []).some');
  content = content.replace(/\.\.\.\(categories \|\| \[\]\)/g, '...(categories || [])'); // idempotency

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
