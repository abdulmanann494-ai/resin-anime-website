const fs = require('fs');
const content = fs.readFileSync('public/index.js', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function loadAdminCMS') || lines[i].includes('loadAdminCMS =')) {
    for (let j = i; j < Math.min(lines.length, i + 35); j++) {
      console.log(`${j + 1}: ${lines[j].trim()}`);
    }
    break;
  }
}
