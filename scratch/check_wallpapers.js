const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'resin.db');

try {
  const db = new DatabaseSync(dbPath);
  const rows = db.prepare("SELECT id, title, image, anime, editorial, rank FROM wallpapers").all();
  console.log(`TOTAL WALLPAPERS IN SQLITE: ${rows.length}`);
  console.log("LAST 5 WALLPAPERS:");
  console.log(rows.slice(-5));
} catch (err) {
  console.error("Error reading sqlite database:", err);
}
