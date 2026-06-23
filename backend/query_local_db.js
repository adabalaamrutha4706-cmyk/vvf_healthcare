const fs = require('fs');
const path = require('path');

const localDbPath = path.join(__dirname, 'data/local_db.json');

if (fs.existsSync(localDbPath)) {
  const data = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
  console.log('Local DB has hospitals:', data.hospitals ? data.hospitals.length : 0);
  if (data.hospitals) {
    data.hospitals.forEach(h => {
      console.log(`ID: ${h.id} | UID: ${h.hospital_uid} | Name: ${h.name} | City: ${h.city} | Lat: ${h.latitude} | Lng: ${h.longitude}`);
    });
  }
} else {
  console.log('local_db.json not found.');
}
