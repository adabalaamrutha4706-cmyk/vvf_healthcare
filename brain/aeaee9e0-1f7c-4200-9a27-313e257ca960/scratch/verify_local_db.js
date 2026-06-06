const fs = require('fs');
const path = require('path');

const localDbPath = 'C:\\Users\\AMRUTHA\\OneDrive\\Desktop\\vvf-healthcare\\backend\\data\\local_db.json';

if (!fs.existsSync(localDbPath)) {
  console.log('No local_db.json file found.');
  process.exit(0);
}

try {
  const content = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
  const hospitals = content.hospitals || [];
  console.log('Hospitals in local_db.json:');
  console.log(JSON.stringify(hospitals.map(h => ({
    id: h.id,
    name: h.name,
    hospital_uid: h.hospital_uid,
    legacy_hospital_id: h.legacy_hospital_id
  })), null, 2));
} catch (e) {
  console.error('Error:', e.message);
}
