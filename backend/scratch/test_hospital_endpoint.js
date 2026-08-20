const { getHospitals } = require('../dist/controllers/hospitalController');

// Mock Request & Response
const mockReq = {
  user: {
    id: 6,
    name: 'Rohan Verma',
    email: 'executive@vvf.org',
    role: 'Executive'
  }
};

const mockRes = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    console.log("Status Code:", this.statusCode);
    console.log("Response Data:", data);
  }
};

// Set environment variables for DB connection
require('dotenv').config();
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:lms_password@localhost:5432/vvf_healthcare";
}

async function runTest() {
  try {
    await getHospitals(mockReq, mockRes);
  } catch (err) {
    console.error("Test threw error:", err);
  }
}

runTest();
