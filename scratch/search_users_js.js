const fs = require('fs');
const content = fs.readFileSync('public/index.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.toLowerCase().includes('user') && (line.includes('load') || line.includes('fetch') || line.includes('table'))) {
    if (line.includes('admin') || line.includes('Users') || line.includes('Identity')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  }
});
