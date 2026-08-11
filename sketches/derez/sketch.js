// derez — vertical-strip variable pixelation
// canvas2d, zero deps. each vertical strip of the source image is
// downsampled to its own random resolution (seeded PRNG) and blown back
// up with smoothing off. drop any image on the page to derez it; the
// default subject is a procedural sunset drawn at startup.

const params = {}; // filled by Standard.param

const canvas = document.createElement('canvas');
document.body.prepend(canvas);
const ctx = canvas.getContext('2d');

let source = null; // canvas or img currently being derezzed
let seed = 42;
let usingDefault = true;

// mulberry32 — deterministic per seed
function rng(s) {
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---- procedural default image: a gradient sunset with rings and bands ----

function makeDefaultSource() {
  const w = Math.max(640, Math.min(window.innerWidth, 2048));
  const h = Math.max(480, Math.min(window.innerHeight, 2048));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');

  // sky: violet dusk down to hot orange
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1a1040');
  sky.addColorStop(0.35, '#5a2a7a');
  sky.addColorStop(0.6, '#d84a8a');
  sky.addColorStop(0.8, '#ff8a4a');
  sky.addColorStop(1, '#ffd25a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  // sun: banded disc low on the horizon
  const sx = w * 0.5;
  const sy = h * 0.62;
  const sr = Math.min(w, h) * 0.28;
  const glow = g.createRadialGradient(sx, sy, sr * 0.1, sx, sy, sr * 2.2);
  glow.addColorStop(0, 'rgba(255,235,170,0.9)');
  glow.addColorStop(1, 'rgba(255,235,170,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  const sun = g.createLinearGradient(0, sy - sr, 0, sy + sr);
  sun.addColorStop(0, '#fff3b0');
  sun.addColorStop(1, '#ff5a3a');
  g.fillStyle = sun;
  g.beginPath();
  g.arc(sx, sy, sr, 0, Math.PI * 2);
  g.fill();
  // retro scan gaps across the sun
  g.fillStyle = sky;
  for (let i = 0; i < 6; i++) {
    const yy = sy + sr * (0.05 + i * 0.16);
    g.fillRect(sx - sr, yy, sr * 2, sr * (0.02 + i * 0.012));
  }

  // drifting translucent orbs
  const orb = rng(7);
  for (let i = 0; i < 14; i++) {
    const ox = orb() * w;
    const oy = orb() * h * 0.55;
    const orr = (0.02 + orb() * 0.05) * Math.min(w, h);
    const hue = Math.floor(orb() * 360);
    g.fillStyle = `hsla(${hue}, 90%, 70%, 0.5)`;
    g.beginPath();
    g.arc(ox, oy, orr, 0, Math.PI * 2);
    g.fill();
  }

  // foreground: dark wireframe ground
  const horizon = h * 0.72;
  g.fillStyle = '#140a24';
  g.fillRect(0, horizon, w, h - horizon);
  g.strokeStyle = 'rgba(255,110,200,0.75)';
  g.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const yy = horizon + Math.pow(i / 11, 1.8) * (h - horizon);
    g.beginPath();
    g.moveTo(0, yy);
    g.lineTo(w, yy);
    g.stroke();
  }
  for (let i = -10; i <= 20; i++) {
    const xx = (i / 10) * w - w * 0.5;
    g.beginPath();
    g.moveTo(w * 0.5 + xx * 0.08, horizon);
    g.lineTo(w * 0.5 + xx, h);
    g.stroke();
  }
  return c;
}

// ---- the derez ----

function srcW(s) { return s.naturalWidth || s.width; }
function srcH(s) { return s.naturalHeight || s.height; }

function render() {
  if (!source) return;
  const w = srcW(source);
  const h = srcH(source);
  canvas.width = w;
  canvas.height = h;
  const rand = rng(seed);
  const strips = params.strips;
  const intensity = params.intensity;
  const stripW = w / strips;

  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');

  for (let i = 0; i < strips; i++) {
    const sx = Math.floor(i * stripW);
    const sw = Math.ceil(stripW);
    // each strip gets its own pixel size: 2..28 * intensity
    const px = Math.max(1, Math.round((2 + rand() * 26) * intensity));
    const dw = Math.max(1, Math.round(sw / px));
    const dh = Math.max(1, Math.round(h / px));

    off.width = dw;
    off.height = dh;
    offCtx.imageSmoothingEnabled = true;
    offCtx.drawImage(source, sx, 0, sw, h, 0, 0, dw, dh);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, dw, dh, sx, 0, sw, h);
  }
}

// ---- UI ----

const paramsBox = document.getElementById('params');
Standard.param(paramsBox, params, {
  id: 'strips',
  label: 'strips',
  min: 2,
  max: 200,
  step: 1,
  value: 20,
  fmt: (v) => v.toFixed(0),
  apply: (v) => {
    params.strips = v;
    render();
  },
});
Standard.param(paramsBox, params, {
  id: 'intensity',
  label: 'intensity',
  min: 0.1,
  max: 12,
  step: 0.1,
  value: 1,
  fmt: (v) => '×' + v.toFixed(1),
  apply: (v) => {
    params.intensity = v;
    render();
  },
});

document.getElementById('reroll').onclick = () => {
  seed = (Math.random() * 1e9) | 0;
  render();
};

const img = new Image();
img.onload = () => {
  source = img;
  usingDefault = false;
  render();
};

const filePick = document.getElementById('filePick');
document.getElementById('load').onclick = () => filePick.click();
filePick.onchange = () => {
  const f = filePick.files[0];
  if (f) img.src = URL.createObjectURL(f);
};

// drag & drop anywhere
document.body.addEventListener('dragover', (e) => e.preventDefault());
document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) img.src = URL.createObjectURL(f);
});

document.getElementById('save').onclick = () => {
  const a = document.createElement('a');
  a.download = `derez-${seed}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
};

// keep the default subject full-bleed as the window changes
window.addEventListener('resize', () => {
  if (usingDefault) {
    source = makeDefaultSource();
    render();
  }
});

// ---- go ----

source = makeDefaultSource();
render();
