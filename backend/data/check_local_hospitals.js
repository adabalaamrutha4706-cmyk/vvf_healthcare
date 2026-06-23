const fs = require('fs');
const path = require('path');

const localDbPath = 'C:/Users/AMRUTHA/OneDrive/Desktop/vvf-healthcare/backend/data/local_db.json';

if (fs.existsSync(localDbPath)) {
  const db = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
  console.log('Tables present:', Object.keys(db));
  if (db.hospitals) {
    console.log('Number of hospitals:', db.hospitals.length);
    const h5 = db.hospitals.find(h => h.id === 5);
    console.log('Hospital ID 5:', h5);
  }
} else {
  console.log('local_db.json does not exist.');
}
