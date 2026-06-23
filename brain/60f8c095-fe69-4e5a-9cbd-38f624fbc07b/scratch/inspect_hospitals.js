const fs = require('fs');
const dbPath = 'c:/Users/AMRUTHA/OneDrive/Desktop/vvf-healthcare/backend/data/local_db.json';

if (fs.existsSync(dbPath)) {
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const hospitals = data.hospitals;
  console.log(`Total hospitals: ${hospitals.length}`);
  
  // Group by ID
  const groupById = {};
  for (const h of hospitals) {
    if (!groupById[h.id]) {
      groupById[h.id] = [];
    }
    groupById[h.id].push(h);
  }
  
  console.log('Hospitals grouped by ID:');
  for (const id of Object.keys(groupById)) {
    console.log(`ID ${id}: ${groupById[id].length} times`);
    if (groupById[id].length > 1) {
      console.log(`  Names:`, groupById[id].map(h => `${h.name} (UID: ${h.hospital_uid}, is_deleted: ${h.is_deleted})`));
    }
  }
} else {
  console.log('local_db.json not found');
}
