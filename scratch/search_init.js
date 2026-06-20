const fs = require('fs');
const content = fs.readFileSync('public/index.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('initApp') || line.includes('DOMContentLoaded') || line.includes('window.onload')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
