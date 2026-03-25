const fs = require('fs');
const path = require('path');

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

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
