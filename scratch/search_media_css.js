const fs = require('fs');
const content = fs.readFileSync('public/index.css', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('media-') || line.includes('category-') || line.includes('categories-')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
