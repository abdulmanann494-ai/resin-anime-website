const fs = require('fs');
const content = fs.readFileSync('public/index.html', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('user-matrix-tbody') || line.includes('user-matrix-count') || line.includes('user-matrix-row') || line.includes('user-identity-cell')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
