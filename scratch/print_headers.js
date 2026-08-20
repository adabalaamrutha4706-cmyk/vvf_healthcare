const http = require('http');

async function getHeaders(urlStr) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'HeaderViewer/1.0'
      }
    }, (res) => {
      resolve(res.headers);
    });
    req.on('error', (err) => {
      resolve({ error: err.message });
    });
    req.end();
  });
}

async function run() {
  console.log('=== FRONTEND HEADERS (/dashboard) ===');
  console.log(await getHeaders('http://localhost:3000/dashboard'));
  console.log('\n=== BACKEND HEADERS (/api/health) ===');
  console.log(await getHeaders('http://localhost:5000/api/health'));
}

run();
