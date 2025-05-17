const fs = require('fs');
const path = require('path');

const chunksDir = path.join(__dirname, 'public/wordlists/chunks');

let totalItems = 0;

fs.readdir(chunksDir, (err, files) => {
  if (err) {
    console.error('Error reading chunks directory:', err);
    return;
  }

  files.filter(file => file.endsWith('.json')).forEach(file => {
    const filePath = path.join(chunksDir, file);
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const items = JSON.parse(data);
      const itemCount = items.length;
      console.log(`${file}: ${itemCount} items`);
      totalItems += itemCount;
    } catch (readErr) {
      console.error(`Error reading or parsing file ${file}:`, readErr);
    }
  });

  console.log(`\nTotal items across all chunks: ${totalItems}`);
});