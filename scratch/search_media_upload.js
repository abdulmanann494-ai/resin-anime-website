const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('media/upload')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
