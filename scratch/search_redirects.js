const fs = require('fs');
const content = fs.readFileSync('public/index.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('location.href') || line.includes('location.replace') || line.includes('location.reload') || line.includes('redirect')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
