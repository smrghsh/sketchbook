// chromatic — rgb channel split via per-pixel manipulation
// an offscreen buffer holds the scene (interference rings, a rotating
// lissajous figure, a central bloom); each frame it is recomposited with
// the red channel shifted left and the blue channel shifted right.
// mouse x drives the aberration toward its slider maximum.

const params = {}; // filled by Standard.param

let pg;       // offscreen buffer we draw the scene into
let t = 0;
let aberrationScale = 0;
let mouseSeen = false; // until the mouse moves, idle at half the max split

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  pg = createGraphics(width, height);
  pg.pixelDensity(1);
  colorMode(RGB, 255);
  noStroke();
  wireUI();
}

function drawScene(g, time) {
  g.background(0);
  g.noStroke();
  g.colorMode(g.RGB, 255);

  const cx = g.width / 2;
  const cy = g.height / 2;
  const baseR = min(g.width, g.height) * 0.28;

  // concentric interference rings
  for (let r = baseR * 2.2; r > 4; r *= params.decay) {
    const phase = time * 0.4 + r * 0.018;
    const brightness = 180 + 60 * sin(phase);
    const hshift = map(r, 0, baseR * 2.2, 240, 20);
    g.fill(hshift, 80, brightness, 120);
    g.ellipse(cx, cy, r * 2, r * 2);
  }

  // rotating lissajous figure
  g.push();
  g.translate(cx, cy);
  g.noFill();
  g.strokeWeight(1.5);
  const A = params.lissA;
  const B = params.lissB;
  const steps = 800;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TWO_PI * 3;
    const x1 = baseR * 0.7 * sin(A * a + time * 0.3);
    const y1 = baseR * 0.7 * sin(B * a + time * 0.2 + PI / 4);
    const x2 = baseR * 0.7 * sin(A * (a + 0.05) + time * 0.3);
    const y2 = baseR * 0.7 * sin(B * (a + 0.05) + time * 0.2 + PI / 4);
    const alpha = map(sin(a * 2 + time), -1, 1, 40, 200);
    g.stroke(255, 255, 255, alpha);
    g.line(x1, y1, x2, y2);
  }
  g.pop();

  // central bloom
  for (let i = 8; i > 0; i--) {
    const r2 = baseR * 0.18 * (i / 8);
    const a2 = map(i, 0, 8, 30, 180);
    g.fill(255, 255, 255, a2);
    g.ellipse(cx, cy, r2 * 2, r2 * 2);
  }
}

function applyAberration(sourceGraphic, shiftX, shiftY) {
  // read source pixels
  sourceGraphic.loadPixels();
  loadPixels();

  const src = sourceGraphic.pixels;
  const dst = pixels;
  const w = width;
  const h = height;

  const sx = round(shiftX);
  const sy = round(shiftY);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;

      // RED channel: shift left
      const rx = x - sx;
      const ry = y - sy;
      const ri = (constrain(ry, 0, h - 1) * w + constrain(rx, 0, w - 1)) * 4;

      // GREEN channel: no shift
      const gi = di;

      // BLUE channel: shift right
      const bx = x + sx;
      const by = y + sy;
      const bi = (constrain(by, 0, h - 1) * w + constrain(bx, 0, w - 1)) * 4;

      dst[di]     = src[ri];       // R
      dst[di + 1] = src[gi + 1];   // G
      dst[di + 2] = src[bi + 2];   // B
      dst[di + 3] = 255;           // A
    }
  }

  updatePixels();
}

function draw() {
  t += 0.016 * params.speed;

  // lerp aberration toward the mouse-driven target (slider = max px)
  const targetAberration = mouseSeen
    ? map(mouseX, 0, width, 0, params.aberration, true)
    : params.aberration * 0.5;
  aberrationScale = lerp(aberrationScale, targetAberration, 0.06);

  // draw scene into offscreen buffer
  drawScene(pg, t);

  // apply per-pixel rgb channel split
  applyAberration(pg, aberrationScale, 0);
}

function wireUI() {
  const box = document.getElementById('controls');
  Standard.param(box, params, {
    id: 'aberration',
    label: 'aberration',
    min: 0,
    max: 24,
    step: 1,
    value: 24,
    fmt: (v) => v.toFixed(0) + 'px',
  });
  Standard.param(box, params, {
    id: 'decay',
    label: 'ring decay',
    min: 0.85,
    max: 0.975,
    step: 0.005,
    value: 0.92,
    fmt: (v) => v.toFixed(3),
  });
  Standard.param(box, params, {
    id: 'lissA',
    label: 'lissajous a',
    min: 1,
    max: 7,
    step: 1,
    value: 3,
    fmt: (v) => v.toFixed(0),
  });
  Standard.param(box, params, {
    id: 'lissB',
    label: 'lissajous b',
    min: 1,
    max: 7,
    step: 1,
    value: 2,
    fmt: (v) => v.toFixed(0),
  });
  Standard.param(box, params, {
    id: 'speed',
    label: 'speed',
    min: 0,
    max: 3,
    step: 0.05,
    value: 1,
    fmt: (v) => v.toFixed(2),
  });
}

function mouseMoved() {
  mouseSeen = true;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  pg = createGraphics(width, height);
  pg.pixelDensity(1);
}
