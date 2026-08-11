// tessellation — genuary 2022 day 12
// port of smrghsh/genuary2022/"12 - Tesselation": p5 WEBGL, a sheared
// isometric lattice of goldenrod boxes on purple; each box's edge pulses
// sizeB·sin(phase − distFromCenter) so a radial wave rolls outward and the
// boxes invert through zero. Original was pinned 1080×1920; here the
// lattice stays centered and scales to the window.

const params = {};
let phase = 0;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);

  const controlsEl = document.getElementById('controls');
  Standard.param(controlsEl, params, {
    id: 'speed',
    label: 'wave speed',
    min: 0,
    max: 3,
    step: 0.05,
    value: 1,
    fmt: (v) => v.toFixed(2),
  });
  Standard.param(controlsEl, params, {
    id: 'tile',
    label: 'tile size',
    min: 20,
    max: 90,
    step: 1,
    value: 50,
    fmt: (v) => String(Math.round(v)),
  });
  Standard.param(controlsEl, params, {
    id: 'extent',
    label: 'grid extent',
    min: 5,
    max: 28,
    step: 1,
    value: 20,
    fmt: (v) => String(Math.round(v)),
  });
}

function draw() {
  background('purple');
  // phase accumulates so the speed slider never jumps the wave
  phase += 0.05 * params.speed;

  // keep the original 1080-wide framing relative to the short dimension
  scale(min(width, height) / 1080);

  const sizeB = params.tile;
  const qty = params.extent;
  for (let j = -qty; j < qty; j++) {
    for (let i = -qty; i < qty; i++) {
      push();
      const x = 0.5 * i * sizeB + j * sizeB;
      const y = i * sizeB - 0.5 * j * sizeB;
      translate(x, y, 0);
      fill('goldenrod');
      stroke(0);
      const c = map(dist(x, y, 0, 0), 0, 300, 0, 1);
      const s = sizeB * sin(phase - c);
      box(s, s, s);
      pop();
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
