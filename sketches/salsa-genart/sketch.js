'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  salsa genart — flow field · glitch/ascii · skeleton trails
//  Ported from vertex/salsa-genart. The PoseNet-on-video path is gone (no
//  video ships with the piece); the Perlin synthetic-joint driver that was
//  its fallback IS the piece here, so ml5 is dropped entirely.
//  Keys:  1/2/3 → mode   S → save PNG   SPACE → pause   R → reset
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────────────────────────
const CANVAS_SIZE   = 1080;
const FPS           = 30;
const TRAIL_HISTORY = 60;       // frames of keypoint position history (mode 3)
const ASCII_CHARS   = '@#S%?*+;:,. '; // bright → dim luminance ramp
const ASCII_CELL    = 12;       // px per character cell (mode 2)

// PoseNet skeleton bone definitions
const SKELETON_PAIRS = [
  ['nose',          'leftEye'],  ['nose',          'rightEye'],
  ['leftEye',       'leftEar'], ['rightEye',      'rightEar'],
  ['leftShoulder',  'rightShoulder'],
  ['leftShoulder',  'leftElbow'],  ['leftElbow',  'leftWrist'],
  ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
  ['leftShoulder',  'leftHip'],  ['rightShoulder', 'rightHip'],
  ['leftHip',       'rightHip'],
  ['leftHip',       'leftKnee'],  ['leftKnee',   'leftAnkle'],
  ['rightHip',      'rightKnee'], ['rightKnee',  'rightAnkle'],
];

const JOINT_NAMES = [
  'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar',
  'leftShoulder', 'rightShoulder',
  'leftElbow',    'rightElbow',
  'leftWrist',    'rightWrist',
  'leftHip',      'rightHip',
  'leftKnee',     'rightKnee',
  'leftAnkle',    'rightAnkle',
];

// ── Global state ──────────────────────────────────────────────────────────────
const params = { particles: 350 };

let currentMode = 1;   // 1 | 2 | 3
let paused      = false;

// Mode 1 – Flow Field
let particles  = [];
let flowCanvas;            // off-screen p5.Graphics used for persistent ghost trails

// Mode 3 – Skeleton Trails
let keypointHistory = {};  // { keypointName: [{x, y}, …] }  ring buffer
let trailHues       = {};  // { keypointName: hue }  slowly rotating

// Synthetic driver – independent per-joint Perlin seed offsets
let noiseOffsets = [];

let cnv;

// ── Setup ─────────────────────────────────────────────────────────────────────
function setup() {
  cnv = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  pixelDensity(1);   // consistent pixel ops on all displays
  frameRate(FPS);
  colorMode(RGB, 255);
  fitCanvas();

  // Off-screen buffer
  flowCanvas = createGraphics(CANVAS_SIZE, CANVAS_SIZE);
  flowCanvas.pixelDensity(1);
  flowCanvas.background(0);

  // Initialise subsystems
  initParticles();
  initNoiseOffsets();
  initKeypointHistory();

  wireControls();
}

// square canvas, scaled to fit the viewport, centered
function fitCanvas() {
  const s = Math.min(windowWidth, windowHeight);
  const el = cnv.elt;
  el.style.width = s + 'px';
  el.style.height = s + 'px';
  el.style.position = 'fixed';
  el.style.left = '50%';
  el.style.top = '50%';
  el.style.transform = 'translate(-50%, -50%)';
}

function windowResized() {
  fitCanvas();
}

// ── Init helpers ──────────────────────────────────────────────────────────────
function initParticles() {
  particles = [];
  for (let i = 0; i < params.particles; i++) {
    particles.push(new Particle());
  }
}

function initNoiseOffsets() {
  noiseOffsets = JOINT_NAMES.map(() => ({
    x: random(0, 1000),
    y: random(0, 1000),
  }));
}

function initKeypointHistory() {
  keypointHistory = {};
  trailHues       = {};
  for (const name of JOINT_NAMES) {
    keypointHistory[name] = [];
    trailHues[name]       = random(360);
  }
}

// ── Main draw loop ────────────────────────────────────────────────────────────
function draw() {
  if (paused) return;

  const joints = getJoints();

  if      (currentMode === 1) drawFlowField(joints);
  else if (currentMode === 2) drawGlitchASCII();
  else if (currentMode === 3) drawSkeletonTrails(joints);
}

// ── Joint driver ──────────────────────────────────────────────────────────────
/**
 * Returns { keypointName: {x, y} } in canvas-space (0..CANVAS_SIZE).
 * Synthetic: each joint drifts on its own Perlin noise lane.
 */
function getJoints() {
  const joints = {};
  const t = frameCount * 0.007;
  for (let i = 0; i < JOINT_NAMES.length; i++) {
    const o = noiseOffsets[i];
    joints[JOINT_NAMES[i]] = {
      x: noise(o.x + t) * CANVAS_SIZE,
      y: noise(o.y + t) * CANVAS_SIZE,
    };
  }
  return joints;
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODE 1 — Flow Field
//  Perlin-noise vector field, warm-palette particles, persistent ghost trails.
// ══════════════════════════════════════════════════════════════════════════════
function drawFlowField(joints) {
  colorMode(RGB, 255);

  // Dim the off-screen buffer a little each frame → ghosting / fade
  flowCanvas.noStroke();
  flowCanvas.fill(0, 0, 0, 18);
  flowCanvas.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const jointList = Object.values(joints);

  for (const p of particles) {
    // Occasionally snap a particle close to a synthetic joint
    if (random() < 0.005 && jointList.length > 0) {
      const j = random(jointList);
      p.warpTo(j.x + randomGaussian(0, 28), j.y + randomGaussian(0, 28));
    }
    p.step();
    p.paint(flowCanvas);
  }

  // Blit the persistent buffer onto the main canvas
  image(flowCanvas, 0, 0);
}

// ── Particle ──────────────────────────────────────────────────────────────────
class Particle {
  constructor() {
    this._spawn(random(CANVAS_SIZE), random(CANVAS_SIZE));
    this.age = random(this.maxAge); // stagger so they don't all reset at once
  }

  _spawn(x, y) {
    this.x      = x;
    this.y      = y;
    this.px     = x;  // previous position for line segment
    this.py     = y;
    this.age    = 0;
    this.maxAge = int(random(80, 220));
    this.speed  = random(1.5, 3.5);
    this.col    = this._pickWarmColor();
  }

  // Warm palette: deep red → orange-red → orange → gold → bright gold
  _pickWarmColor() {
    const palette = [
      [255,  40,  10],
      [255,  90,  20],
      [255, 140,   0],
      [255, 195,   0],
      [255, 220,  30],
    ];
    return palette[int(random(palette.length))];
  }

  // Teleport to a new position (e.g. near a joint) without drawing a gap line
  warpTo(x, y) {
    this.x = this.px = x;
    this.y = this.py = y;
  }

  step() {
    // 3-D noise scroll: x, y coords + slow time axis
    const t     = frameCount * 0.003;
    const angle = noise(this.x * 0.003, this.y * 0.003, t) * TWO_PI * 2;

    this.px = this.x;
    this.py = this.y;
    this.x += cos(angle) * this.speed;
    this.y += sin(angle) * this.speed;
    this.age++;

    // Respawn when off-canvas or age exceeded
    if (this.x < 0 || this.x > CANVAS_SIZE ||
        this.y < 0 || this.y > CANVAS_SIZE ||
        this.age > this.maxAge) {
      this._spawn(random(CANVAS_SIZE), random(CANVAS_SIZE));
    }
  }

  paint(g) {
    const [r, gr, b] = this.col;
    const alpha      = map(this.age, 0, this.maxAge, 210, 0);
    g.stroke(r, gr, b, alpha);
    g.strokeWeight(random(0.8, 1.8));
    g.line(this.px, this.py, this.x, this.y);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODE 2 — Glitch / ASCII
//  Noise-driven neon luma + cycling hue through an ASCII ramp, scanline tears,
//  pixel sorting.
// ══════════════════════════════════════════════════════════════════════════════
function drawGlitchASCII() {
  colorMode(RGB, 255);
  background(0);

  const cols = floor(CANVAS_SIZE / ASCII_CELL);
  const rows = floor(CANVAS_SIZE / ASCII_CELL);

  // ── ASCII render ──────────────────────────────────────────────────────────
  textFont('monospace');
  textSize(ASCII_CELL - 1);
  textAlign(LEFT, TOP);
  noStroke();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * ASCII_CELL;
      const cy = row * ASCII_CELL;

      // Noise-driven neon: smooth luma + cycling hue
      const t   = frameCount * 0.018;
      const lum = noise(col * 0.12, row * 0.12, t) * 255;
      const hue = (noise(col * 0.09, row * 0.09, t + 50) * 360 + frameCount * 0.5) % 360;
      const [r, g, b] = hsvToRgb(hue, 1.0, lum / 255);

      // Map luminance to ASCII ramp (bright → '@', dim → ' ')
      const charIdx = constrain(floor(map(lum, 0, 255, 0, ASCII_CHARS.length - 1)), 0, ASCII_CHARS.length - 1);
      fill(r, g, b);
      text(ASCII_CHARS[charIdx], cx, cy);
    }
  }

  // ── Pixel sort (every 3rd frame to ease GPU round-trips) ─────────────────
  if (frameCount % 3 === 0) {
    applyPixelSort();
  }
}

/**
 * Pixel-sort: grab random horizontal bands from the main canvas and sort
 * each scanline by luminance descending → bright streaks on dark backgrounds.
 */
function applyPixelSort() {
  loadPixels();
  const numBands = int(random(4, 14));

  for (let b = 0; b < numBands; b++) {
    const y0  = int(random(CANVAS_SIZE));
    const h   = int(random(2, 10));
    const x0  = int(random(CANVAS_SIZE * 0.2));
    const x1  = int(random(x0 + 80, CANVAS_SIZE));

    for (let row = y0; row < min(y0 + h, CANVAS_SIZE); row++) {
      // Collect pixel data for the band segment
      const band = [];
      for (let x = x0; x < x1; x++) {
        const i = (row * CANVAS_SIZE + x) * 4;
        band.push({ r: pixels[i], g: pixels[i+1], b: pixels[i+2], a: pixels[i+3] });
      }
      // Sort brightest first
      band.sort((a, bv) =>
        (0.299*bv.r + 0.587*bv.g + 0.114*bv.b) - (0.299*a.r + 0.587*a.g + 0.114*a.b)
      );
      // Write sorted pixels back
      for (let i = 0; i < band.length; i++) {
        const pi = (row * CANVAS_SIZE + x0 + i) * 4;
        pixels[pi]   = band[i].r;
        pixels[pi+1] = band[i].g;
        pixels[pi+2] = band[i].b;
        pixels[pi+3] = band[i].a;
      }
    }
  }
  updatePixels();
}

/** HSV (h: 0-360, s: 0-1, v: 0-1) → [r, g, b] (0-255). */
function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h <  60) { r = c; g = x;        }
  else if (h < 120) { r = x; g = c;        }
  else if (h < 180) {        g = c; b = x; }
  else if (h < 240) {        g = x; b = c; }
  else if (h < 300) { r = x;        b = c; }
  else              { r = c;         b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODE 3 — Skeleton Trails
//  60-frame keypoint history rendered as Catmull-Rom bezier curves in HSB,
//  with a white skeleton overlay and glowing joint dots.
// ══════════════════════════════════════════════════════════════════════════════
function drawSkeletonTrails(joints) {
  // Semi-transparent black rect over the main canvas → ghost trail fade
  colorMode(RGB, 255);
  noStroke();
  fill(0, 0, 0, 20);
  rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // ── Update ring buffers ───────────────────────────────────────────────────
  for (const name of JOINT_NAMES) {
    if (!joints[name]) continue;
    keypointHistory[name].push({ ...joints[name] });
    if (keypointHistory[name].length > TRAIL_HISTORY) {
      keypointHistory[name].shift();
    }
  }

  // ── Draw bezier trails in HSB ─────────────────────────────────────────────
  colorMode(HSB, 360, 100, 100, 100);
  noFill();

  for (const name of JOINT_NAMES) {
    const hist = keypointHistory[name];
    if (hist.length < 4) continue;

    const hue = trailHues[name];

    // Step through history 1 segment at a time using Catmull-Rom → Bezier
    for (let i = 3; i < hist.length; i++) {
      const alpha  = map(i, 3, hist.length - 1, 5,  85);
      const bright = map(i, 3, hist.length - 1, 30, 100);
      const weight = map(i, 3, hist.length - 1, 0.4, 2.8);

      stroke(hue, 85, bright, alpha);
      strokeWeight(weight);

      const p0 = hist[i - 3];
      const p1 = hist[i - 2];
      const p2 = hist[i - 1];
      const p3 = hist[i];

      // Catmull-Rom control-point formula converted to cubic Bezier handles
      beginShape();
      vertex(p1.x, p1.y);
      bezierVertex(
        p1.x + (p2.x - p0.x) / 6,  p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6,  p2.y - (p3.y - p1.y) / 6,
        p2.x, p2.y
      );
      endShape();
    }

    // Slowly cycle each joint's hue
    trailHues[name] = (hue + 0.25) % 360;
  }

  // ── White skeleton overlay ────────────────────────────────────────────────
  stroke(0, 0, 100, 75);  // HSB white, semi-transparent
  strokeWeight(1.5);
  noFill();

  for (const [nameA, nameB] of SKELETON_PAIRS) {
    if (joints[nameA] && joints[nameB]) {
      line(joints[nameA].x, joints[nameA].y, joints[nameB].x, joints[nameB].y);
    }
  }

  // ── Joint dots ────────────────────────────────────────────────────────────
  noStroke();
  fill(0, 0, 100, 90); // white
  for (const pos of Object.values(joints)) {
    ellipse(pos.x, pos.y, 6, 6);
  }

  colorMode(RGB, 255);
}

// ── Chrome wiring ─────────────────────────────────────────────────────────────
function wireControls() {
  const controls = document.getElementById('controls');
  const saveBtn  = document.getElementById('save');
  const modeBtns = {
    1: document.getElementById('mode-1'),
    2: document.getElementById('mode-2'),
    3: document.getElementById('mode-3'),
  };

  for (const [m, btn] of Object.entries(modeBtns)) {
    btn.addEventListener('click', () => setMode(parseInt(m, 10)));
  }
  saveBtn.addEventListener('click', () => saveCanvas('salsa-genart', 'png'));

  Standard.param(controls, params, {
    id: 'particles', label: 'particles', min: 50, max: 1000, step: 10, value: params.particles,
    apply: (v) => { params.particles = v; initParticles(); },
  });
  // keep the save button below the slider
  controls.appendChild(saveBtn);

  window._modeBtns = modeBtns;
  markActiveMode();
}

function markActiveMode() {
  for (const [m, btn] of Object.entries(window._modeBtns)) {
    btn.classList.toggle('active', parseInt(m, 10) === currentMode);
  }
}

function setMode(m) {
  currentMode = m;
  resetAll();
  markActiveMode();
}

// ── Key handling ──────────────────────────────────────────────────────────────
function keyPressed() {
  if (key === '1') setMode(1);
  if (key === '2') setMode(2);
  if (key === '3') setMode(3);
  if (key === 'S' || key === 's') saveCanvas('salsa-genart', 'png');
  if (key === 'R' || key === 'r') resetAll();
  if (key === ' ') {
    paused = !paused;
    return false; // prevent page scroll on spacebar
  }
}

function resetAll() {
  flowCanvas.background(0);
  background(0);
  initParticles();
  initNoiseOffsets();
  initKeypointHistory();
}
