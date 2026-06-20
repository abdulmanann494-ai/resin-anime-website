const fs = require('fs');
const content = fs.readFileSync('public/index.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.toLowerCase().includes('ingestion') && (line.includes('fetch') || line.includes('submit') || line.includes('click') || line.includes('upload'))) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
