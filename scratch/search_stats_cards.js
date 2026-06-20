const fs = require('fs');
const content = fs.readFileSync('public/index.js', 'utf8');
const lines = content.split('\n');

const queries = ['cmd-val-users', 'active-sessions', 'moderation-flags', 'server-load', 'uptime', 'api-req-min'];

lines.forEach((line, index) => {
  queries.forEach(q => {
    if (line.includes(q)) {
      console.log(`Line ${index + 1} (${q}): ${line.trim()}`);
    }
  });
});
