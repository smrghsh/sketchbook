// ✨💎 diamonds and sapphires — p5 1.9 WEBGL, global mode

let particlesPerRing = 120;

let rings = [];
let densityMult = 1.0;
let speedMult = 1.0;
let autoRotate = false;
let autoRotateAngle = 0;
let flickTime = 0;
let gemType = 'sapphire';

const GEM = {
  sapphire: () => ({
    hue: random(210, 240),
    sat: random(70, 95),
    bri: random(75, 100),
  }),
  ruby: () => ({
    hue: random(345, 360),
    sat: random(80, 95),
    bri: random(75, 100),
  }),
  emerald: () => ({
    hue: random(130, 155),
    sat: random(70, 90),
    bri: random(70, 95),
  }),
  topaz: () => ({
    hue: random(35, 50),
    sat: random(75, 92),
    bri: random(80, 100),
  }),
  opal: (j) => ({
    hue: (j / particlesPerRing) * 360,
    sat: random(60, 90),
    bri: random(80, 100),
    isOpal: true,
  }),
};

function ringCount() {
  return floor(map(windowWidth, 320, 2560, 60, 240, true) * densityMult);
}

function makeGemParticles() {
  return Array.from({ length: particlesPerRing }, (_, j) => {
    let g = GEM[gemType](j);
    return {
      angle: (j / particlesPerRing) * TWO_PI,
      size: random(1.4, 3.2),
      hue: g.hue,
      sat: g.sat,
      bri: g.bri,
      isOpal: !!g.isOpal,
      flickerSpeed: random(0.02, 0.09),
      flickerPhase: random(TWO_PI),
    };
  });
}

function makeRings() {
  rings = [];
  for (let i = 0; i < ringCount(); i++) {
    let r = {
      radius: random(40, 380),
      tiltX: random(TWO_PI),
      tiltY: random(TWO_PI),
      tiltZ: random(TWO_PI),
      cx: random(-500, 500),
      cy: random(-500, 500),
      cz: random(-600, 200),
      speed: random(0.001, 0.004) * (random() > 0.5 ? 1 : -1),
      phase: random(TWO_PI),
      spin: 0,
      gem: false,
      particles: Array.from({ length: particlesPerRing }, (_, j) => ({
        angle: (j / particlesPerRing) * TWO_PI,
        size: random(1.2, 3.8),
        hue: random() > 0.7 ? random(195, 230) : random(40, 60),
        sat: random(0, 30),
        bri: random(80, 100),
        isOpal: false,
        flickerSpeed: random(0.02, 0.09),
        flickerPhase: random(TWO_PI),
      })),
    };
    rings.push(r);

    if (i % 3 === 0) {
      rings.push({
        ...r,
        cx: r.cx + random(-18, 18),
        cy: r.cy + random(-18, 18),
        cz: r.cz + random(-18, 18),
        radius: r.radius + random(-8, 8),
        gem: true,
        phase: r.phase + random(0.05, 0.2),
        spin: 0,
        particles: makeGemParticles(),
      });
    }
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  colorMode(HSB, 360, 100, 100, 100);
  frameRate(60);
  noStroke();
  makeRings();
}

function draw() {
  orbitControl();
  background(0, 0, 3, 18);

  if (autoRotate) {
    autoRotateAngle += 0.003 * speedMult;
    rotateY(autoRotateAngle);
  }

  flickTime += speedMult;

  for (let r of rings) {
    push();
    translate(r.cx, r.cy, r.cz);
    // spin accumulates per-frame so the speed param acts live without jumps
    r.spin += 0.001 * r.speed * speedMult;
    rotateX(r.tiltX);
    rotateY(r.tiltY + r.spin * 60);
    rotateZ(r.tiltZ);
    r.phase += r.speed * speedMult;

    for (let p of r.particles) {
      let flicker = 0.5 + 0.5 * sin(flickTime * p.flickerSpeed + p.flickerPhase);
      let alpha = flicker * flicker * 92 + 8;
      let bri = p.bri * (0.6 + 0.4 * flicker);
      let hue = p.hue;

      // opal: cycle hue over time per particle, like shifting fire in the stone
      if (p.isOpal) {
        hue = (p.hue + flickTime * 0.4 + p.angle * 40) % 360;
      }

      let x = cos(p.angle + r.phase) * r.radius;
      let y = sin(p.angle + r.phase) * r.radius;

      fill(hue, p.sat, bri, alpha);
      push();
      translate(x, y, 0);
      sphere(p.size * (0.5 + 0.5 * flicker), 3, 3);
      pop();
    }
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ── the-standard chrome ──
(function wireChrome() {
  const params = {};
  const paramsEl = document.getElementById('params');

  Standard.param(paramsEl, params, {
    id: 'density', label: 'density',
    min: 0.25, max: 4, step: 0.25, value: 1,
    fmt: (v) => v.toFixed(2) + '×',
    apply: (v) => { densityMult = v; makeRings(); },
  });

  Standard.param(paramsEl, params, {
    id: 'perRing', label: 'gems / ring',
    min: 30, max: 240, step: 10, value: 120,
    fmt: (v) => v.toFixed(0),
    apply: (v) => { particlesPerRing = v; makeRings(); },
  });

  Standard.param(paramsEl, params, {
    id: 'speed', label: 'speed',
    min: 0.2, max: 3, step: 0.1, value: 1,
    fmt: (v) => v.toFixed(1) + '×',
    apply: (v) => { speedMult = v; },
  });

  document.getElementById('randomize').addEventListener('click', () => makeRings());

  document.getElementById('gem').addEventListener('change', (e) => {
    gemType = e.target.value;
    makeRings();
  });

  document.getElementById('autorotate').addEventListener('click', (e) => {
    autoRotate = !autoRotate;
    e.currentTarget.classList.toggle('active', autoRotate);
  });
})();
