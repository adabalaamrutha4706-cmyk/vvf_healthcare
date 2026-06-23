const https = require('https');

const url = 'https://maps.app.goo.gl/w7CKXvigtYd34aJc7';

function getRedirect(urlStr) {
  return new Promise((resolve) => {
    https.get(urlStr, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(res.headers.location);
      } else {
        resolve(null);
      }
    }).on('error', (e) => {
      console.error(e);
      resolve(null);
    });
  });
}

async function run() {
  let currentUrl = url;
  console.log(`Tracing redirects for: ${currentUrl}`);
  for (let i = 0; i < 5; i++) {
    const nextUrl = await getRedirect(currentUrl);
    if (!nextUrl) {
      console.log(`Final URL: ${currentUrl}`);
      break;
    }
    console.log(`Redirected to: ${nextUrl}`);
    currentUrl = nextUrl;
  }
}

run();
