// Local admin panel for the sketchbook: reorder, edit title/description,
// toggle visibility. Zero dependencies.
//
// Usage: node tools/admin.js          → http://localhost:4747
//
// Saving writes each sketch's meta.json, syncs <title> / #description-title /
// #description in the sketch's index.html, rewrites tools/order.txt, and
// regenerates sketches.js via manifest.js. Hidden sketches (meta.json
// `hidden: true`) stay in order.txt but are dropped from the manifest.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SKETCH_DIR = path.join(ROOT, 'sketches');
const ORDER_TXT = path.join(__dirname, 'order.txt');
const PORT = process.env.PORT || 4747;

function readOrder() {
  if (!fs.existsSync(ORDER_TXT)) return [];
  return fs
    .readFileSync(ORDER_TXT, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function readSketches() {
  const metas = [];
  for (const slug of fs.readdirSync(SKETCH_DIR)) {
    const p = path.join(SKETCH_DIR, slug, 'meta.json');
    if (!fs.existsSync(p)) continue;
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    metas.push({
      slug,
      title: m.title || slug,
      description: m.description || '',
      library: m.library || '',
      hidden: !!m.hidden,
    });
  }
  const order = readOrder();
  metas.sort((a, b) => {
    const ia = order.indexOf(a.slug);
    const ib = order.indexOf(b.slug);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.slug.localeCompare(b.slug);
  });
  return metas;
}

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Replace the inner content of the element with the given id, if the file
// contains exactly one such element. Returns true if a replacement happened.
function setElementText(html, id, text) {
  const re = new RegExp(
    '(<(div|span|h1)\\s+id="' + id + '"[^>]*>)[\\s\\S]*?(</\\2>)',
    'g'
  );
  const matches = html.match(re);
  if (!matches || matches.length !== 1) return null;
  return html.replace(re, (_, open, _tag, close) => open + esc(text) + close);
}

function save(payload, log) {
  const known = new Set(readSketches().map((s) => s.slug));
  const slugs = [];

  for (const s of payload.sketches) {
    if (!known.has(s.slug)) throw new Error('unknown slug: ' + s.slug);
    slugs.push(s.slug);
    const dir = path.join(SKETCH_DIR, s.slug);
    const metaPath = path.join(dir, 'meta.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    const changedTitle = s.title !== (meta.title || s.slug);
    const changedDesc = s.description !== (meta.description || '');
    const changedHidden = !!s.hidden !== !!meta.hidden;
    if (!changedTitle && !changedDesc && !changedHidden) continue;

    meta.title = s.title;
    meta.description = s.description;
    if (s.hidden) meta.hidden = true;
    else delete meta.hidden;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
    log.push(
      s.slug +
        ': meta.json' +
        (changedHidden ? (s.hidden ? ' (hidden)' : ' (visible)') : '')
    );

    // keep the sketch page's corner text in sync
    if (changedTitle || changedDesc) {
      const htmlPath = path.join(dir, 'index.html');
      let html = fs.readFileSync(htmlPath, 'utf8');
      let touched = false;
      if (changedDesc) {
        const r = setElementText(html, 'description', s.description);
        if (r) (html = r), (touched = true);
        else log.push(s.slug + ': #description not synced (no unique match)');
      }
      if (changedTitle) {
        const r = setElementText(html, 'description-title', s.title);
        if (r) (html = r), (touched = true);
        else
          log.push(s.slug + ': #description-title not synced (no unique match)');
        const t = html.replace(
          /<title>[\s\S]*?<\/title>/,
          '<title>' + esc(s.title) + '</title>'
        );
        if (t !== html) (html = t), (touched = true);
      }
      if (touched) {
        fs.writeFileSync(htmlPath, html);
        log.push(s.slug + ': index.html synced');
      }
    }
  }

  fs.writeFileSync(ORDER_TXT, slugs.join('\n') + '\n');
  log.push('order.txt: ' + slugs.length + ' slugs');

  const r = spawnSync(
    process.execPath,
    [path.join(__dirname, 'manifest.js'), '--order', ORDER_TXT],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) throw new Error('manifest.js failed: ' + r.stderr);
  log.push(r.stdout.split('\n')[0]); // "N sketches → sketches.js"
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/api/sketches') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(readSketches()));
    }

    if (req.method === 'POST' && url.pathname === '/api/save') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const log = [];
        try {
          save(JSON.parse(body), log);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, log }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message, log }));
        }
      });
      return;
    }

    // static: admin UI at /, everything else from repo root (thumbs, gallery)
    let file =
      url.pathname === '/'
        ? path.join(__dirname, 'admin.html')
        : path.join(ROOT, path.normalize(url.pathname).replace(/^\/+/, ''));
    if (!file.startsWith(ROOT) && !file.startsWith(__dirname)) {
      res.writeHead(403);
      return res.end('forbidden');
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('not found');
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      });
      res.end(data);
    });
  })
  .listen(PORT, '127.0.0.1', () =>
    console.log('sketchbook admin → http://localhost:' + PORT)
  );
