const http = require('http');

async function testOptions(urlStr) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'User-Agent': 'OptionsBleedTester/1.0'
      }
    }, (res) => {
      resolve({
        url: urlStr,
        statusCode: res.statusCode,
        headers: res.headers,
        allow: res.headers['allow'] || null,
        corsMethods: res.headers['access-control-allow-methods'] || null,
        server: res.headers['server'] || null
      });
    });
    
    req.on('error', (err) => {
      resolve({
        url: urlStr,
        statusCode: 'ERROR',
        error: err.message
      });
    });
    
    req.end();
  });
}

async function run() {
  console.log('Testing OPTIONS response for potential OPTIONSbleed / leak...');
  
  // Test both backend health check endpoint and auth login endpoint
  const targets = [
    'http://localhost:5000/api/health',
    'http://localhost:5000/api/auth/login'
  ];
  
  const results = [];
  for (const t of targets) {
    const res = await testOptions(t);
    results.push(res);
  }
  
  console.log('=== OPTIONS RESPONSE ANALYSIS ===');
  console.log(JSON.stringify(results, null, 2));
}

run();
