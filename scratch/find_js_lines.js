const fs = require('fs');
const content = fs.readFileSync('public/index.js', 'utf8');
const lines = content.split('\n');

const queries = ['admin-form-announcement', 'admin-form-cache', 'inbox-reply-composer', 'supportTickets', 'create announcement', 'flush system cache'];

lines.forEach((line, index) => {
  queries.forEach(q => {
    if (line.toLowerCase().includes(q.toLowerCase())) {
      console.log(`Line ${index + 1} (${q}): ${line.trim()}`);
    }
  });
});
