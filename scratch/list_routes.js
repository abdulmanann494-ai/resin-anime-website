const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');
const lines = content.split('\n');

console.log('Routes in server.js:');
lines.forEach((line, index) => {
  if (line.match(/app\.(get|post|put|delete|patch|use)\(/)) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
