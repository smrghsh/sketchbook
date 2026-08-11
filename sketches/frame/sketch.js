// frame — rectangles adrift in space
// p5.js 2.0: shader materials via p5.strands (JS shader hooks)
// + a chromatic aberration filter shader.

const params = {
  count: 180,
  drift: 1,
  wobble: 1,
  aberration: 0.6,
  boids: 48,
};

const PALETTE = [
  [96, 140, 255],
  [255, 110, 180],
  [140, 245, 255],
  [255, 205, 130],
  [190, 130, 255],
  [235, 240, 255],
];

let simTime = 0;

// URL overrides for any param, e.g. ?drift=0&aberration=0.8
const RQ = new URLSearchParams(window.location.search);
for (const key of Object.keys(params)) {
  if (RQ.has(key)) params[key] = parseFloat(RQ.get(key));
}

const VOLUME_RADIUS = 900;

let rects = [];
let stars = [];
let boids = [];
let materialShader;
let aberrationShader;
let shimmerShader;

let cam;
let groupAxis;

// ---- scene population ----

function makeRect() {
  const dir = p5.Vector.random3D();
  const r = VOLUME_RADIUS * pow(random(), 0.6);
  return {
    pos: dir.mult(r),
    vel: p5.Vector.random3D().mult(random(6, 26)),
    axis: p5.Vector.random3D(),
    angle: random(TWO_PI),
    spin: random(-0.5, 0.5),
    w: random(40, 220),
    h: random(30, 160),
    d: random(2, 7),
    border: random(0.08, 0.2),
    col: random(PALETTE),
  };
}

function syncRects() {
  while (rects.length < params.count) rects.push(makeRect());
  rects.length = params.count;
}

function makeStars() {
  stars = [];
  for (let i = 0; i < 350; i++) {
    stars.push(p5.Vector.random3D().mult(random(1600, 2800)));
  }
}

// ---- boids ----

const BOID = {
  neighborR: 150,
  sepR: 45,
  avoidR: 75,
  vMin: 80,
  vMax: 200,
};

function makeBoid() {
  return {
    pos: p5.Vector.random3D().mult(random(100, VOLUME_RADIUS)),
    vel: p5.Vector.random3D().mult(random(120, 180)),
    phase: random(),
    size: random(6, 10),
    wanderPhase: random(TWO_PI),
    col: random(PALETTE),
  };
}

function syncBoids() {
  while (boids.length < params.boids) boids.push(makeBoid());
  boids.length = params.boids;
}

// rotate v around a (unit) axis by angle — Rodrigues' formula
function rotVec(v, axis, angle) {
  const c = cos(angle);
  const s = sin(angle);
  const cr = p5.Vector.cross(axis, v);
  const d = axis.dot(v) * (1 - c);
  return createVector(
    v.x * c + cr.x * s + axis.x * d,
    v.y * c + cr.y * s + axis.y * d,
    v.z * c + cr.z * s + axis.z * d
  );
}

// steering push away from the border bars of one frame, in world space.
// works from the nearest point on the frame's ring centerline, so the
// hollow middle of a large frame is fair game to fly through.
function frameAvoidance(b, r) {
  // cheap bounding-sphere cull first
  const dx = b.pos.x - r.pos.x;
  const dy = b.pos.y - r.pos.y;
  const dz = b.pos.z - r.pos.z;
  const boundR = max(r.w, r.h) * 0.75 + BOID.avoidR;
  if (dx * dx + dy * dy + dz * dz > boundR * boundR) return null;

  const local = rotVec(createVector(dx, dy, dz), r.axis, -r.angle);
  const bw = r.border * min(r.w, r.h);
  const hx = (r.w - bw) / 2;
  const hy = (r.h - bw) / 2;

  // nearest point on the rectangular ring centerline (z = 0 plane)
  let qx, qy;
  if (abs(local.x) < hx && abs(local.y) < hy) {
    // inside the ring: snap to whichever bar is closest
    if (hx - abs(local.x) < hy - abs(local.y)) {
      qx = hx * Math.sign(local.x || 1);
      qy = local.y;
    } else {
      qx = local.x;
      qy = hy * Math.sign(local.y || 1);
    }
  } else {
    qx = constrain(local.x, -hx, hx);
    qy = constrain(local.y, -hy, hy);
  }

  const away = createVector(local.x - qx, local.y - qy, local.z);
  const d = away.mag();
  if (d > BOID.avoidR || d < 1e-4) return null;
  away.div(d).mult(1 - d / BOID.avoidR);
  return rotVec(away, r.axis, r.angle);
}

function updateBoids(dt) {
  for (let i = 0; i < boids.length; i++) {
    const b = boids[i];
    const acc = createVector();
    const coh = createVector();
    const ali = createVector();
    const sep = createVector();
    let n = 0;

    for (let j = 0; j < boids.length; j++) {
      if (j === i) continue;
      const o = boids[j];
      const d = p5.Vector.dist(b.pos, o.pos);
      if (d < BOID.neighborR) {
        coh.add(o.pos);
        ali.add(o.vel);
        n++;
        if (d < BOID.sepR && d > 1e-4) {
          sep.add(p5.Vector.sub(b.pos, o.pos).div(d * d));
        }
      }
    }
    if (n > 0) {
      coh.div(n).sub(b.pos).mult(0.8);
      ali.div(n).sub(b.vel).mult(1.2);
      acc.add(coh).add(ali).add(sep.mult(8000));
    }

    // meander: slow per-boid wander so paths curve even without neighbors
    acc.add(
      40 * sin(simTime * 0.7 + b.wanderPhase),
      40 * sin(simTime * 0.9 + b.wanderPhase * 2.1),
      40 * sin(simTime * 0.8 + b.wanderPhase * 3.3)
    );

    // stay near the cluster
    const rMag = b.pos.mag();
    if (rMag > VOLUME_RADIUS) {
      acc.add(b.pos.copy().mult(-2.5 * (rMag - VOLUME_RADIUS) / rMag));
    }

    // dodge the frame borders
    for (const r of rects) {
      const f = frameAvoidance(b, r);
      if (f) acc.add(f.mult(2600));
    }

    b.vel.add(acc.mult(dt));
    const v = b.vel.mag();
    if (v > BOID.vMax) b.vel.mult(BOID.vMax / v);
    if (v < BOID.vMin && v > 1e-4) b.vel.mult(BOID.vMin / v);
    b.pos.add(b.vel.x * dt, b.vel.y * dt, b.vel.z * dt);
  }
}

function drawBoids() {
  shader(shimmerShader);
  noStroke();
  const yUnit = createVector(0, 1, 0);
  for (const b of boids) {
    const dir = b.vel.copy().normalize();
    let axis = p5.Vector.cross(yUnit, dir);
    if (axis.mag() < 1e-4) axis = createVector(1, 0, 0);
    axis.normalize();
    const angle = acos(constrain(yUnit.dot(dir), -1, 1));

    shimmerShader.setUniform('phase', b.phase);
    push();
    translate(b.pos.x, b.pos.y, b.pos.z);
    rotate(angle, axis);
    fill(b.col[0], b.col[1], b.col[2]);
    // square pyramid, nose along the velocity
    cone(b.size, b.size * 2.4, 4, 1);
    pop();
  }
}

// ---- setup ----

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  cam = createCamera();
  cam.camera(0, -80, 1250, 0, 0, 0, 0, 1, 0);
  // group rotation axis: tilted off vertical, leaning left and toward the
  // camera, so the field whooshes diagonally instead of spinning flat
  // (y points down in p5's WEBGL coords, so the axis's visual top end is
  // its negative end: leaning screen-left and toward the camera; front
  // objects sweep from bottom-left up to top-right)
  groupAxis = createVector(0.35, 1, -0.3).normalize();
  describe(
    'Iridescent rectangles floating and tumbling in dark space, ' +
      'with a chromatic aberration lens effect.'
  );

  // Material shader: baseMaterialShader().modify() with hooks written in
  // plain JavaScript (p5.strands, new in p5.js 2.0).
  materialShader = baseMaterialShader().modify(() => {
    const time = uniformFloat(() => simTime);
    const wobbleAmt = uniformFloat('wobbleAmt');

    // Vertex stage: make each surface breathe in world space.
    getWorldInputs((inputs) => {
      const p = inputs.position;
      inputs.position.y += wobbleAmt * 14 * sin(time * 0.8 + p.x * 0.012 + p.z * 0.009);
      inputs.position.x += wobbleAmt * 9 * sin(time * 0.6 + p.y * 0.011 + p.z * 0.013);
      inputs.position.z += wobbleAmt * 7 * sin(time * 0.5 + p.x * 0.01 + p.y * 0.012);
      return inputs;
    });

    // Fragment stage: iridescent shimmer over the base fill color.
    getPixelInputs((inputs) => {
      const n = normalize(inputs.normal);
      const shimmer =
        0.5 +
        0.5 *
          sin(
            time * 0.7 +
              inputs.texCoord.x * 6 +
              inputs.texCoord.y * 4 +
              n.x * 3 +
              n.y * 2
          );
      const sheenA = vec3(0.35, 0.62, 1.0);
      const sheenB = vec3(1.0, 0.42, 0.75);
      const sheen = mix(sheenA, sheenB, shimmer);
      const facing = abs(n.z);
      const rim = pow(1.0 - facing, 2.0);
      let base = mix(inputs.color.rgb, sheen, 0.45);
      base = base + rim * sheen * 0.8;
      inputs.color = vec4(base, inputs.color.a);
      inputs.shininess = 90.0;
      inputs.metalness = 0.35;
      return inputs;
    });
  });

  // Shimmer shader for the boids — iq cosine palette over the base fill,
  // rendered unlit via a combineColors override so they glow from any angle.
  shimmerShader = baseMaterialShader().modify(() => {
    const time = uniformFloat(() => simTime);
    const phase = uniformFloat('phase');

    getPixelInputs((inputs) => {
      const t = inputs.texCoord.x * 0.6 + phase + time * 0.25;
      const sheen = vec3(0.55, 0.55, 0.7) +
        vec3(0.45, 0.4, 0.35) *
          cos(6.28318 * (vec3(1.2, 1.0, 0.8) * t + vec3(0.0, 0.25, 0.55)));
      inputs.color = vec4(mix(inputs.color.rgb, sheen, 0.55), inputs.color.a);
      return inputs;
    });

    combineColors((components) => {
      return vec4(components.baseColor + components.emissive, components.opacity);
    });
  });

  // Post-processing: chromatic aberration as a p5.strands filter shader.
  aberrationShader = baseFilterShader().modify(() => {
    const aberr = uniformFloat('aberr');
    const time = uniformFloat(() => simTime);

    getColor((inputs, canvasContent) => {
      const uv = inputs.texCoord;
      const off = uv - vec2(0.5, 0.5);
      const d = length(off);
      const pulse = 1.0 + 0.15 * sin(time * 0.9);
      const shift = off * (aberr * 0.036 * pulse) * (0.25 + d * 2.2);
      const r = getTexture(canvasContent, uv + shift).r;
      const g = getTexture(canvasContent, uv).g;
      const b = getTexture(canvasContent, uv - shift).b;
      const vignette = 1.0 - d * d * 0.6;
      return vec4(r * vignette, g * vignette, b * vignette, 1.0);
    });
  });

  syncRects();
  makeStars();
  syncBoids();
  wireUI();
}

// ---- draw ----

function draw() {
  const dt = deltaTime / 1000;
  simTime += dt;
  background(4, 6, 14);
  orbitControl(1, 1, 0.15);
  // group rotation only applies to the rect field, stars and boids
  push();
  rotate(simTime * 0.065, groupAxis);

  drawStars();

  ambientLight(40, 44, 70);
  directionalLight(255, 240, 230, -0.5, 0.4, -1);
  pointLight(120, 160, 255, 0, 0, 400);
  pointLight(255, 120, 180, -400, 200, -200);

  materialShader.setUniform('wobbleAmt', params.wobble);
  shader(materialShader);
  noStroke();

  for (const r of rects) {
    r.pos.add(
      r.vel.x * params.drift * dt,
      r.vel.y * params.drift * dt,
      r.vel.z * params.drift * dt
    );
    // wrap around the volume so the field never empties
    if (r.pos.mag() > VOLUME_RADIUS * 1.4) {
      r.pos.mult(-0.95);
    }
    r.angle += r.spin * params.drift * dt;

    push();
    translate(r.pos.x, r.pos.y, r.pos.z);
    rotate(r.angle, r.axis);
    fill(r.col[0], r.col[1], r.col[2]);
    // hollow center: four bars forming a picture frame
    const bw = r.border * min(r.w, r.h);
    const inner = r.h - 2 * bw;
    push();
    translate(0, -(r.h - bw) / 2, 0);
    box(r.w, bw, r.d);
    pop();
    push();
    translate(0, (r.h - bw) / 2, 0);
    box(r.w, bw, r.d);
    pop();
    push();
    translate(-(r.w - bw) / 2, 0, 0);
    box(bw, inner, r.d);
    pop();
    push();
    translate((r.w - bw) / 2, 0, 0);
    box(bw, inner, r.d);
    pop();
    pop();
  }

  // boids live in the same rotated space as the rect field, so their
  // frame-avoidance matches what you see
  updateBoids(dt);
  drawBoids();

  pop();

  resetShader();

  aberrationShader.setUniform('aberr', params.aberration);
  filter(aberrationShader);
}

function drawStars() {
  push();
  resetShader();
  strokeWeight(3);
  stroke(255, 255, 255);
  beginShape(POINTS);
  for (const s of stars) {
    vertex(s.x, s.y, s.z);
  }
  endShape();
  pop();
}

// ---- UI ----

function wireUI() {
  Standard.bind(params, 'count', (v) => v.toFixed(0), (v) => {
    params.count = v;
    syncRects();
  });
  Standard.bind(params, 'drift', (v) => v.toFixed(1), (v) => (params.drift = v));
  Standard.bind(params, 'wobble', (v) => v.toFixed(1), (v) => (params.wobble = v));
  Standard.bind(params, 'aberration', (v) => v.toFixed(2), (v) => (params.aberration = v));
  Standard.bind(params, 'boids', (v) => v.toFixed(0), (v) => {
    params.boids = v;
    syncBoids();
  });

  document.getElementById('reshuffle').addEventListener('click', () => {
    rects = [];
    boids = [];
    syncRects();
    makeStars();
    syncBoids();
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
