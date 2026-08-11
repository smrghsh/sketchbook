/* Capture a thumbnail PNG for each sketch in the manifest.
   Usage: node tools/thumbs.js [slug ...]   (no args = all)
   Serves the repo root itself, lets each sketch animate, screenshots
   the canvas region without the corner chrome (chrome hidden via CSS). */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.glsl': 'text/plain',
  '.frag': 'text/plain',
  '.vert': 'text/plain',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.csv': 'text/csv',
  '.ply': 'application/octet-stream',
};

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, () => resolve(srv));
  });
}

(async () => {
  const manifestSrc = fs.readFileSync(path.join(ROOT, 'sketches.js'), 'utf8');
  const all = new Function('window', manifestSrc + '; return window.SKETCHES;')({});
  const only = process.argv.slice(2);
  const targets = only.length ? all.filter((s) => only.includes(s.slug)) : all;

  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({
    args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  for (const s of targets) {
    const page = await browser.newPage({ viewport: { width: 960, height: 570 } });
    page.on('pageerror', (e) => console.log(`  [${s.slug}] pageerror: ${e.message}`));
    try {
      await page.goto(`http://localhost:${port}/sketches/${s.slug}/`, {
        waitUntil: 'load',
        timeout: 30000,
      });
      // hide the standard chrome so the thumb is pure canvas
      await page.addStyleTag({
        content:
          '#controls,#bottom-left,#attribution,.overlay{display:none !important}',
      });
      await page.waitForTimeout(s.thumbDelay || 4000);
      await page.screenshot({
        path: path.join(ROOT, 'thumbs', `${s.slug}.png`),
        type: 'png',
      });
      console.log(`✓ ${s.slug}`);
    } catch (e) {
      console.log(`✗ ${s.slug}: ${e.message.split('\n')[0]}`);
    }
    await page.close();
  }

  await browser.close();
  srv.close();
})();
