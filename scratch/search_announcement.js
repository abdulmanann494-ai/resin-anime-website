const fs = require('fs');
const content = fs.readFileSync('public/index.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.toLowerCase().includes('announcement') && !line.includes('admin-form-announcement') && !line.includes('announcement-title') && !line.includes('announcement-body') && !line.includes('announcement-pin')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
