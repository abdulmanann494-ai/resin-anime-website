const fs = require('fs');
const content = fs.readFileSync('public/index.html', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('cmd-val-users') || line.includes('ACTIVE SESSIONS') || line.includes('MODERATION FLAGS') || line.includes('SERVER LOAD')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
