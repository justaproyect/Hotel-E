const fs = require('fs');
const path = require('path');

function cleanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanDir(fullPath);
    } else if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.d.ts.map') || entry.name.endsWith('.js.map')) {
      fs.rmSync(fullPath);
      console.log(`[Removed] ${fullPath}`);
    }
  }
}

console.log('Cleaning source maps and declarations...');
cleanDir(path.join(__dirname, '..', 'dist'));
console.log('Clean complete.');
