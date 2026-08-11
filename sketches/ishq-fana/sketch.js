// ∿ ishq-fana ∿
// Two luminous attractors orbit each other in void:
//   Ishq — Rumi's consuming fire-love (warm gold, hue ~35)
//   Para Bhakti — Vivekananda's ocean-dissolution (cool violet, hue ~255)
// Particles of longing spiral between them. When they dissolve into an attractor,
// they undergo fana — annihilation — and are reborn from the other source, transformed.
// The convergence of two names for one undivided love.
//
// Sources: Rumi's Masnavi (reed-bed longing), Divine Love (ishq/para bhakti),
//          Kama Sutra (kama as conscious pleasure, the nagaraka's cultivation)

const BOUNDARY = 580; // soft outer boundary

// live params (wired to the-standard sliders below)
// particles regenerates the field; the radii act live
const params = {};
let pendingParticles = null;

let particles = [];
let mode = "balanced"; // 'ishq', 'bhakti', 'balanced'
let fanaActive = false;
let fanaTimer = 0;
let autoRotate = false;
let autoAngle = 0;

// Attractor orbit angle (they orbit each other)
let attOrbitAngle = 0;

// Attractor positions — recomputed each frame
let posA, posB;

// ─────────────────────────────────────────────
//  Particle factory
// ─────────────────────────────────────────────
function makeParticle(type) {
  let r = random(40, 340);
  let theta = random(TWO_PI);
  let phi = random(-HALF_PI, HALF_PI);
  let speed = random(0.2, 1.2);
  // Give particles a tangential kick so they orbit rather than just fall
  let kickDir = random() > 0.5 ? 1 : -1;
  return {
    x: r * cos(phi) * cos(theta),
    y: r * cos(phi) * sin(theta),
    z: r * sin(phi),
    vx: (-sin(theta) * kickDir + random(-0.2, 0.2)) * speed * 0.6,
    vy: (cos(theta) * kickDir + random(-0.2, 0.2)) * speed * 0.6,
    vz: random(-0.3, 0.3) * speed,
    type: type,          // 0 = ishq (warm), 1 = bhakti (cool)
    size: random(1.4, 3.8),
    flickerSpeed: random(0.015, 0.08),
    flickerPhase: random(TWO_PI),
    alpha: random(30, 85),
    spin: kickDir,        // orbital spin direction
    dissolving: false,    // fana in progress
  };
}

function initParticles() {
  particles = [];
  let n = Math.round(params.particles);
  for (let i = 0; i < n; i++) {
    particles.push(makeParticle(i < n / 2 ? 0 : 1));
  }
}

// ─────────────────────────────────────────────
//  p5 setup
// ─────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  colorMode(HSB, 360, 100, 100, 100);
  frameRate(60);
  noStroke();
  initParticles();
}

// ─────────────────────────────────────────────
//  Main draw loop
// ─────────────────────────────────────────────
function draw() {
  if (pendingParticles !== null) {
    pendingParticles = null;
    initParticles();
  }

  // Semi-transparent background for trailing afterglow
  background(0, 0, 2, 22);

  orbitControl();

  let t = frameCount * 0.001;

  // Auto-rotate world
  if (autoRotate) {
    autoAngle += 0.0025;
    rotateY(autoAngle);
  }

  // ── Orbit the two attractors around each other
  // Slightly tilted orbital plane for 3D interest
  attOrbitAngle += 0.0035;
  let ax = cos(attOrbitAngle) * params.orbitRadius;
  let ay = sin(attOrbitAngle * 0.55) * 55; // gentle vertical bob
  let az = sin(attOrbitAngle) * params.orbitRadius * 0.38;
  posA = { x: ax, y: ay, z: az };
  posB = { x: -ax, y: -ay, z: -az };

  // ── Fana decay
  if (fanaActive) {
    fanaTimer++;
    if (fanaTimer > 150) {
      fanaActive = false;
      fanaTimer = 0;
    }
  }

  // ── Draw attractors
  drawAttractorSphere(posA, 0, t); // Ishq
  drawAttractorSphere(posB, 1, t); // Para Bhakti

  // ── Update + draw particles
  for (let p of particles) {
    updateParticle(p, t);
    drawParticle(p, t);
  }
}

// ─────────────────────────────────────────────
//  Attractor visual — layered glowing spheres
// ─────────────────────────────────────────────
function drawAttractorSphere(pos, type, t) {
  let hue = type === 0 ? 36 : 256;
  // Slow heartbeat pulse — the two attractors breathe opposite phases
  let pulse = 0.55 + 0.45 * sin(t * 140 + (type === 0 ? 0 : PI));
  let pulseB = 0.7 + 0.3 * sin(t * 220 + (type === 0 ? 0.8 : PI + 0.8));

  push();
  translate(pos.x, pos.y, pos.z);

  // Outermost halo — very transparent
  fill(hue, 55, 100, 5 + pulse * 7);
  sphere(55 + pulse * 18, 8, 8);

  // Mid glow
  fill(hue, 65, 100, 12 + pulse * 10);
  sphere(34 + pulseB * 10, 8, 8);

  // Inner glow
  fill(hue, 72, 100, 28 + pulse * 18);
  sphere(19 + pulseB * 5, 10, 10);

  // Core — brightest, smallest, most saturated
  fill(hue, 45, 100, 88);
  sphere(10, 12, 12);

  // White-hot center
  fill(hue, 10, 100, 96);
  sphere(4.5, 8, 8);

  pop();
}

// ─────────────────────────────────────────────
//  Particle physics
// ─────────────────────────────────────────────
function d3(x1, y1, z1, x2, y2, z2) {
  let dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function updateParticle(p, t) {
  // ── Compute distances to each attractor
  let dax = posA.x - p.x, day = posA.y - p.y, daz = posA.z - p.z;
  let distA = Math.sqrt(dax * dax + day * day + daz * daz) || 0.001;

  let dbx = posB.x - p.x, dby = posB.y - p.y, dbz = posB.z - p.z;
  let distB = Math.sqrt(dbx * dbx + dby * dby + dbz * dbz) || 0.001;

  // ── Gravity strength: softened inverse-square-ish
  // F ∝ dist / (dist² + soft²)   → peaks near soft, tails off both ways
  let soft = 85;
  let baseG = 0.062;
  let fanaBoost = fanaActive ? 4.2 : 1.0;

  let modeA = 1.0, modeB = 1.0;
  if (mode === "ishq") {
    modeA = p.type === 0 ? 1.9 : 1.1;
    modeB = p.type === 1 ? 0.5 : 0.7;
  } else if (mode === "bhakti") {
    modeB = p.type === 1 ? 1.9 : 1.1;
    modeA = p.type === 0 ? 0.5 : 0.7;
  }

  let fA = baseG * fanaBoost * modeA * (distA / (distA * distA + soft * soft));
  let fB = baseG * fanaBoost * modeB * (distB / (distB * distB + soft * soft));

  // Apply gravitational acceleration
  p.vx += (dax / distA) * fA + (dbx / distB) * fB;
  p.vy += (day / distA) * fA + (dby / distB) * fB;
  p.vz += (daz / distA) * fA + (dbz / distB) * fB;

  // ── Tangential "orbit" force — cross product trick for circulation
  // For attractor A: tangential to (dA × ẑ) rotated by spin
  let txA = -day * p.spin, tyA = dax * p.spin;
  let tLenA = Math.sqrt(txA * txA + tyA * tyA) || 1;
  let tangStrA = 0.0009 * (1 - distA / 400) * modeA;
  if (distA < 400 && tangStrA > 0) {
    p.vx += (txA / tLenA) * tangStrA;
    p.vy += (tyA / tLenA) * tangStrA;
  }

  // ── Damping — gentle air resistance
  let damp = 0.991;
  p.vx *= damp;
  p.vy *= damp;
  p.vz *= damp;

  // ── Tiny random longing drift
  p.vx += random(-0.03, 0.03);
  p.vy += random(-0.03, 0.03);
  p.vz += random(-0.03, 0.03);

  // ── Integrate position
  p.x += p.vx;
  p.y += p.vy;
  p.z += p.vz;

  // ── FANA: dissolution and rebirth
  let fanaThresh = fanaActive ? params.fanaRadius * 2 : params.fanaRadius;
  if (distA < fanaThresh || distB < fanaThresh) {
    p.dissolving = true;
    // Accelerate toward the closer attractor — the final surrender
    let rushTarget = distA < distB ? posA : posB;
    p.vx += (rushTarget.x - p.x) * 0.015;
    p.vy += (rushTarget.y - p.y) * 0.015;
    p.vz += (rushTarget.z - p.z) * 0.015;
    p.alpha -= fanaActive ? 8 : 4;

    if (p.alpha <= 0) {
      // ── Rebirth from the OTHER attractor — transformed
      let rebornAt = distA < distB ? posB : posA;
      p.x = rebornAt.x + random(-22, 22);
      p.y = rebornAt.y + random(-22, 22);
      p.z = rebornAt.z + random(-22, 22);
      // Explosive reemergence — like a cry from the reed
      let burst = random(0.6, 2.2);
      p.vx = random(-burst, burst);
      p.vy = random(-burst, burst);
      p.vz = random(-burst, burst);
      p.alpha = random(15, 55);
      p.type = 1 - p.type;  // fana: the particle is transformed, type flips
      p.spin = random() > 0.5 ? 1 : -1; // new orbital orientation
      p.dissolving = false;
    }
  } else {
    p.dissolving = false;
    // Breathing alpha restore — the longing pulse
    let breathTarget =
      40 + 45 * sin(frameCount * p.flickerSpeed + p.flickerPhase);
    p.alpha += (breathTarget - p.alpha) * 0.04;
  }

  // ── Soft boundary — gently nudge escaped particles back
  let r0 = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  if (r0 > BOUNDARY) {
    p.vx -= p.x * 0.0004;
    p.vy -= p.y * 0.0004;
    p.vz -= p.z * 0.0004;
  }
}

// ─────────────────────────────────────────────
//  Particle visual
// ─────────────────────────────────────────────
function drawParticle(p, t) {
  // Ishq: warm gold-amber (~28–52), Para Bhakti: deep violet-blue (~242–272)
  let flickerVal = sin(frameCount * p.flickerSpeed + p.flickerPhase);
  let hue =
    p.type === 0
      ? map(flickerVal, -1, 1, 30, 54)
      : map(flickerVal, -1, 1, 244, 270);

  // Proximity brightness boost — particles near an attractor glow hotter
  let distA = d3(p.x, p.y, p.z, posA.x, posA.y, posA.z);
  let distB = d3(p.x, p.y, p.z, posB.x, posB.y, posB.z);
  let prox = 1 - Math.min(distA, distB) / 280;
  prox = Math.max(0, Math.min(1, prox));

  let sat = 62 + prox * 32;
  let bri = 76 + prox * 22;

  // Breathing size
  let flicker = 0.5 + 0.5 * flickerVal;
  let sz = p.size * (0.45 + 0.55 * flicker);

  // When dissolving, particles become briefly brighter before vanishing
  if (p.dissolving) {
    sat = Math.min(100, sat + 20);
    bri = Math.min(100, bri + 12);
  }

  fill(hue, sat, bri, p.alpha);
  push();
  translate(p.x, p.y, p.z);
  sphere(sz, 4, 4);
  pop();
}

// ─────────────────────────────────────────────
//  Utility
// ─────────────────────────────────────────────
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ─────────────────────────────────────────────
//  Controls — the-standard chrome
// ─────────────────────────────────────────────
(function wireChrome() {
  const container = document.getElementById("controls");

  Standard.param(container, params, {
    id: "particles", label: "particles",
    min: 200, max: 4000, step: 100, value: 1600,
    fmt: (v) => String(Math.round(v)),
    apply: (v) => { params.particles = v; pendingParticles = Math.round(v); },
  });
  Standard.param(container, params, {
    id: "orbitRadius", label: "orbit radius",
    min: 60, max: 400, step: 5, value: 210,
    fmt: (v) => String(Math.round(v)),
  });
  Standard.param(container, params, {
    id: "fanaRadius", label: "fana radius",
    min: 8, max: 120, step: 1, value: 28,
    fmt: (v) => String(Math.round(v)),
  });

  // keep the mode chips below the sliders
  ["btn-ishq", "btn-bhakti", "btn-fana", "btn-autorotate"].forEach((id) =>
    container.appendChild(document.getElementById(id))
  );

  document.getElementById("btn-ishq").addEventListener("click", () => {
    mode = mode === "ishq" ? "balanced" : "ishq";
    document
      .getElementById("btn-ishq")
      .classList.toggle("active", mode === "ishq");
    document.getElementById("btn-bhakti").classList.toggle("active", false);
  });

  document.getElementById("btn-bhakti").addEventListener("click", () => {
    mode = mode === "bhakti" ? "balanced" : "bhakti";
    document
      .getElementById("btn-bhakti")
      .classList.toggle("active", mode === "bhakti");
    document.getElementById("btn-ishq").classList.toggle("active", false);
  });

  document.getElementById("btn-fana").addEventListener("click", () => {
    fanaActive = true;
    fanaTimer = 0;
  });

  document.getElementById("btn-autorotate").addEventListener("click", () => {
    autoRotate = !autoRotate;
    document
      .getElementById("btn-autorotate")
      .classList.toggle("active", autoRotate);
  });
})();
