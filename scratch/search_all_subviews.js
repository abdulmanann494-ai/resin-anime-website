const fs = require('fs');
const content = fs.readFileSync('public/index.js', 'utf8');
const lines = content.split('\n');

const functions = [
  'loadAdminCMS',
  'loadAdminRankings',
  'loadAdminLegal',
  'loadAdminCommunity',
  'loadAdminReports',
  'loadAdminCollections',
  'loadAdminSettings',
  'loadAdminMedia',
  'loadAdminCategories'
];

functions.forEach(fn => {
  console.log(`\n--- Looking for ${fn} ---`);
  let found = false;
  let linesCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`function ${fn}`) || lines[i].includes(`${fn} =`)) {
      found = true;
      // print 20 lines starting from i
      for (let j = i; j < Math.min(lines.length, i + 25); j++) {
        console.log(`${j + 1}: ${lines[j].trim()}`);
      }
      break;
    }
  }
  if (!found) {
    console.log(`Not found definition for ${fn}`);
  }
});
