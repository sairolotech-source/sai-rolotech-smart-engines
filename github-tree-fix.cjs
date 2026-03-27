const https = require('https');
const fs = require('fs');

const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const OWNER = 'adminsairolotech-bit';
const REPO = 'sai-rolotech-smart-engines';

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${urlPath}`,
      method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'User-Agent': 'sai-uploader',
        'Accept': 'application/vnd.github.v3+json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(b), h: res.headers }); } catch { resolve({ s: res.statusCode, d: b, h: res.headers }); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // Test with tiny tree first
  console.log('Test: Create a simple tree with README...');
  const blobR = await api('POST', '/git/blobs', { content: Buffer.from('# SAI Rolotech v2.2.0\n').toString('base64'), encoding: 'base64' });
  console.log('Blob:', blobR.s, blobR.d?.sha?.substring(0,12));

  const treeR = await api('POST', '/git/trees', { tree: [{ path: 'test.md', mode: '100644', type: 'blob', sha: blobR.d.sha }] });
  console.log('Tree:', treeR.s, treeR.d?.sha?.substring(0,12) || JSON.stringify(treeR.d).substring(0,200));
  console.log('Headers:', treeR.h?.['x-ratelimit-remaining']);
})();
