import http from 'http';

function checkUrl(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryReq() {
      http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      }).on('error', (err) => {
        if (Date.now() - start < timeoutMs) {
          setTimeout(tryReq, 1000);
        } else {
          reject(err);
        }
      });
    }
    tryReq();
  });
}

async function run() {
  console.log('Testing direct backend: http://localhost:3000/api/health');
  const direct = await checkUrl('http://localhost:3000/api/health');
  console.log('DIRECT_RESULT:', JSON.stringify(direct));

  console.log('Testing proxied backend through Vite: http://localhost:5173/api/health');
  const proxied = await checkUrl('http://localhost:5173/api/health');
  console.log('PROXIED_RESULT:', JSON.stringify(proxied));

  process.exit(0);
}

run().catch(err => {
  console.error('PROBE_FAILED:', err);
  process.exit(1);
});
