import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================
// Configuration (σ, ρ, β, steps, fade are live via the chrome)
// ============================================================
const MAX_PARTICLES = 20000;
let particleCount = 6000;
let SIGMA = 10.0;
let RHO = 28.0;
let BETA = 8.0 / 3.0;
const DT = 0.005;          // RK4 timestep per substep
let stepsPerFrame = 2;     // controls perceived flow speed
const TRAIL_FADE = 0.935;  // per-frame persistence (closer to 1 = longer trails)
const WARMUP_STEPS = 800;  // pre-evolve so particles fill the attractor at t=0

// ============================================================
// Renderer
// ============================================================
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false
});
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ============================================================
// Scene + camera
// ============================================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1000);
// start face-on to the twin lobes so the butterfly reads immediately
// (same orbit radius as the original's start, rotated in azimuth)
camera.position.set(18, 28, 87);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.7;
controls.minDistance = 25;
controls.maxDistance = 240;
controls.autoRotateSpeed = 0.35;
controls.update();

// Idle detection for auto-rotate
let lastInteractionMs = performance.now();
let userDragging = false;
controls.addEventListener('start', () => { userDragging = true; lastInteractionMs = performance.now(); });
controls.addEventListener('end',   () => { userDragging = false; lastInteractionMs = performance.now(); });
controls.addEventListener('change',() => { if (userDragging) lastInteractionMs = performance.now(); });

// ============================================================
// Particle state — separate sim arrays so we can map dynamical
// (x, y, z) into Three.js (x_three=x, y_three=z-zMid, z_three=y)
// ============================================================
const Z_OFFSET = 25.0;

const simX = new Float32Array(MAX_PARTICLES);
const simY = new Float32Array(MAX_PARTICLES);
const simZ = new Float32Array(MAX_PARTICLES);

const positions  = new Float32Array(MAX_PARTICLES * 3);
const velocities = new Float32Array(MAX_PARTICLES);
const sizes      = new Float32Array(MAX_PARTICLES);

// Seed particles spread through the attractor's basin so that after the
// warm-up they are decorrelated and cover the whole butterfly at t=0
// (seeding them all at (0.1, 0, 0) leaves a single filament for the
// first many seconds — the shape never reads in a first impression).
function seedParticle(i) {
  simX[i] = (Math.random() - 0.5) * 36.0;
  simY[i] = (Math.random() - 0.5) * 48.0;
  simZ[i] = 2.0 + Math.random() * 44.0;
  velocities[i] = 0.0;
}

// Initialize spread across the basin; WARMUP pulls them onto the attractor
for (let i = 0; i < MAX_PARTICLES; i++) {
  seedParticle(i);
  // 1px – 4px size range, biased so most are small with a few big ones
  sizes[i] = 1.0 + Math.pow(Math.random(), 1.8) * 3.0;
}

// ============================================================
// Particle geometry + shader material
// ============================================================
const geometry = new THREE.BufferGeometry();
const posAttr = new THREE.BufferAttribute(positions, 3);
posAttr.setUsage(THREE.DynamicDrawUsage);
const velAttr = new THREE.BufferAttribute(velocities, 1);
velAttr.setUsage(THREE.DynamicDrawUsage);
const sizeAttr = new THREE.BufferAttribute(sizes, 1);

geometry.setAttribute('position',  posAttr);
geometry.setAttribute('aVelocity', velAttr);
geometry.setAttribute('aSize',     sizeAttr);
geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 80);
geometry.setDrawRange(0, particleCount);

const particleMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uPixelRatio: { value: pixelRatio },
    uTime:       { value: 0 }
  },
  vertexShader: /* glsl */`
    attribute float aSize;
    attribute float aVelocity;
    uniform float uPixelRatio;
    uniform float uTime;

    varying float vVelocity;
    varying float vDepth;

    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      float perspective = clamp(140.0 / -mvPosition.z, 0.4, 1.6);
      gl_PointSize = aSize * uPixelRatio * perspective;

      vVelocity = aVelocity;
      vDepth = -mvPosition.z;
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;

    varying float vVelocity;
    varying float vDepth;

    const vec3 COLD   = vec3(0.176, 0.000, 0.341); // #2d0057  deep indigo
    const vec3 VIOLET = vec3(0.420, 0.090, 0.780); // mid violet
    const vec3 CYAN   = vec3(0.000, 1.000, 1.000); // #00ffff  electric cyan
    const vec3 HOT    = vec3(1.000, 1.000, 1.000); // white-hot core

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;

      // Soft glowing sprite: tight bright core + wider halo.
      float core = smoothstep(0.50, 0.00, d);
      float halo = smoothstep(0.50, 0.18, d);
      float glow = pow(core, 1.6) + halo * 0.32;

      // Velocity → color ramp.
      float v = clamp(vVelocity / 55.0, 0.0, 1.0);
      vec3 col = mix(COLD,   VIOLET, smoothstep(0.00, 0.35, v));
      col      = mix(col,    CYAN,   smoothstep(0.30, 0.78, v));
      col      = mix(col,    HOT,    smoothstep(0.82, 1.00, v));

      col *= (0.85 + 0.6 * pow(core, 2.0));

      // Distance-based atmospheric falloff so far particles read cooler/dimmer
      float fog = clamp(1.0 - vDepth * 0.0035, 0.55, 1.0);

      vec3 outColor = col * glow * fog;
      gl_FragColor = vec4(outColor, glow);
    }
  `
});

const points = new THREE.Points(geometry, particleMat);
points.frustumCulled = false;
scene.add(points);

// ============================================================
// Render targets (ping-pong) for screen-space motion trails
// ============================================================
function makeRT(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false
  });
}

let rtA = makeRT(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio);
let rtB = makeRT(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio);

const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadGeo = new THREE.PlaneGeometry(2, 2);

// Pass 1: take previous frame, draw it back slightly darkened
const fadeMat = new THREE.ShaderMaterial({
  depthTest: false,
  depthWrite: false,
  uniforms: {
    tPrev: { value: null },
    uFade: { value: TRAIL_FADE }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tPrev;
    uniform float uFade;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tPrev, vUv);
      gl_FragColor = vec4(c.rgb * uFade, 1.0);
    }
  `
});
const fadeScene = new THREE.Scene();
fadeScene.add(new THREE.Mesh(quadGeo, fadeMat));

// Pass 3: present the accumulated trail buffer with bloom + vignette
const displayMat = new THREE.ShaderMaterial({
  depthTest: false,
  depthWrite: false,
  uniforms: { tInput: { value: null } },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
  `,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tInput;
    varying vec2 vUv;

    // Cheap radial bloom: a few taps of the main buffer, summed.
    vec3 bloomTap(sampler2D t, vec2 uv) {
      vec3 acc = vec3(0.0);
      const float r = 0.0035;
      acc += texture2D(t, uv + vec2( r,  0.0)).rgb;
      acc += texture2D(t, uv + vec2(-r,  0.0)).rgb;
      acc += texture2D(t, uv + vec2( 0.0,  r)).rgb;
      acc += texture2D(t, uv + vec2( 0.0, -r)).rgb;
      acc += texture2D(t, uv + vec2( r,    r) * 0.7).rgb;
      acc += texture2D(t, uv + vec2(-r,    r) * 0.7).rgb;
      acc += texture2D(t, uv + vec2( r,   -r) * 0.7).rgb;
      acc += texture2D(t, uv + vec2(-r,   -r) * 0.7).rgb;
      return acc / 8.0;
    }

    void main() {
      vec3 base = texture2D(tInput, vUv).rgb;
      vec3 bloom = bloomTap(tInput, vUv);

      float bb = max(max(bloom.r, bloom.g), bloom.b);
      vec3 bloomBright = bloom * smoothstep(0.25, 0.9, bb) * 0.8;

      vec3 col = base + bloomBright;

      // Vignette
      vec2 q = vUv - 0.5;
      float vig = smoothstep(0.95, 0.25, length(q));
      col *= mix(0.78, 1.0, vig);

      // Mild gamma-style lift for richer blacks
      col = pow(max(col, 0.0), vec3(0.92));

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
const displayScene = new THREE.Scene();
displayScene.add(new THREE.Mesh(quadGeo, displayMat));

// ============================================================
// Resize handling
// ============================================================
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  rtA.setSize(w * pixelRatio, h * pixelRatio);
  rtB.setSize(w * pixelRatio, h * pixelRatio);
});

// ============================================================
// Cursor → 3D ray for gentle particle attraction
// ============================================================
const mouseNDC = new THREE.Vector2(0, 0);
let mouseActive = false;
const raycaster = new THREE.Raycaster();
const cursorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const cursorPoint = new THREE.Vector3();
let cursorValid = false;

window.addEventListener('pointermove', (e) => {
  mouseNDC.x =  (e.clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  mouseActive = true;
  lastInteractionMs = performance.now();
});
window.addEventListener('pointerleave', () => { mouseActive = false; });

function updateCursorPoint() {
  cursorValid = false;
  if (!mouseActive) return;
  raycaster.setFromCamera(mouseNDC, camera);
  const hit = raycaster.ray.intersectPlane(cursorPlane, cursorPoint);
  cursorValid = hit !== null;
}

// ============================================================
// RK4 step — fully inlined for the inner loop (hot path)
// ============================================================
function rk4Step(dt, count) {
  const s = SIGMA, r = RHO, b = BETA;

  let cX = 0, cY = 0, cZ = 0, cStrength = 0;
  if (cursorValid) {
    cX = cursorPoint.x;
    cY = cursorPoint.z;
    cZ = cursorPoint.y + Z_OFFSET;
    cStrength = 0.9;
  }

  for (let i = 0; i < count; i++) {
    const x = simX[i], y = simY[i], z = simZ[i];

    // k1
    const k1x = s * (y - x);
    const k1y = x * (r - z) - y;
    const k1z = x * y - b * z;

    // k2
    const x2 = x + 0.5 * dt * k1x;
    const y2 = y + 0.5 * dt * k1y;
    const z2 = z + 0.5 * dt * k1z;
    const k2x = s * (y2 - x2);
    const k2y = x2 * (r - z2) - y2;
    const k2z = x2 * y2 - b * z2;

    // k3
    const x3 = x + 0.5 * dt * k2x;
    const y3 = y + 0.5 * dt * k2y;
    const z3 = z + 0.5 * dt * k2z;
    const k3x = s * (y3 - x3);
    const k3y = x3 * (r - z3) - y3;
    const k3z = x3 * y3 - b * z3;

    // k4
    const x4 = x + dt * k3x;
    const y4 = y + dt * k3y;
    const z4 = z + dt * k3z;
    const k4x = s * (y4 - x4);
    const k4y = x4 * (r - z4) - y4;
    const k4z = x4 * y4 - b * z4;

    const dx = dt * (k1x + 2.0 * k2x + 2.0 * k3x + k4x) / 6.0;
    const dy = dt * (k1y + 2.0 * k2y + 2.0 * k3y + k4y) / 6.0;
    const dz = dt * (k1z + 2.0 * k2z + 2.0 * k3z + k4z) / 6.0;

    let nx = x + dx;
    let ny = y + dy;
    let nz = z + dz;

    // Cursor attraction (inverse-square-ish falloff, capped)
    if (cStrength > 0.0) {
      const ddx = cX - nx, ddy = cY - ny, ddz = cZ - nz;
      const dist2 = ddx * ddx + ddy * ddy + ddz * ddz;
      if (dist2 < 400.0) {
        const f = (1.0 - dist2 / 400.0);
        const k = f * f * cStrength * dt;
        nx += ddx * k;
        ny += ddy * k;
        nz += ddz * k;
      }
    }

    simX[i] = nx;
    simY[i] = ny;
    simZ[i] = nz;

    velocities[i] = Math.sqrt(dx * dx + dy * dy + dz * dz) / dt;
  }
}

function uploadPositions(count) {
  // Map dynamical (x, y, z) → Three.js (x, z - Z_OFFSET, y)
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3]     = simX[i];
    positions[i3 + 1] = simZ[i] - Z_OFFSET;
    positions[i3 + 2] = simY[i];
  }
  posAttr.needsUpdate = true;
  velAttr.needsUpdate = true;
}

// ============================================================
// Pre-warm: evolve the full pool so any particle-count setting
// starts spread along the attractor.
// ============================================================
for (let w = 0; w < WARMUP_STEPS; w++) {
  rk4Step(DT, MAX_PARTICLES);
}
uploadPositions(MAX_PARTICLES);

// ============================================================
// the-standard chrome
// ============================================================
const params = {};
const paramsEl = document.getElementById('params');
const hintEl = document.getElementById('hint');

function updateHint() {
  hintEl.textContent =
    'σ=' + SIGMA.toFixed(1) + ' · ρ=' + RHO.toFixed(1) + ' · β=' + BETA.toFixed(2) +
    ' · drag to orbit · scroll to zoom · hover to stir';
}

Standard.param(paramsEl, params, {
  id: 'particles', label: 'particles',
  min: 500, max: MAX_PARTICLES, step: 500, value: particleCount,
  fmt: (v) => v.toLocaleString(),
  apply: (v) => {
    particleCount = v;
    geometry.setDrawRange(0, particleCount);
  },
});

Standard.param(paramsEl, params, {
  id: 'trail', label: 'trail persistence',
  min: 0.8, max: 0.99, step: 0.005, value: TRAIL_FADE,
  fmt: (v) => v.toFixed(3),
  apply: (v) => { fadeMat.uniforms.uFade.value = v; },
});

Standard.param(paramsEl, params, {
  id: 'steps', label: 'steps / frame',
  min: 1, max: 6, step: 1, value: stepsPerFrame,
  fmt: (v) => v.toFixed(0),
  apply: (v) => { stepsPerFrame = v; },
});

Standard.param(paramsEl, params, {
  id: 'sigma', label: 'sigma σ',
  min: 1, max: 20, step: 0.1, value: SIGMA,
  fmt: (v) => v.toFixed(1),
  apply: (v) => { SIGMA = v; updateHint(); },
});

Standard.param(paramsEl, params, {
  id: 'rho', label: 'rho ρ',
  min: 5, max: 60, step: 0.5, value: RHO,
  fmt: (v) => v.toFixed(1),
  apply: (v) => { RHO = v; updateHint(); },
});

Standard.param(paramsEl, params, {
  id: 'beta', label: 'beta β',
  min: 0.5, max: 5, step: 0.01, value: 2.67,
  fmt: (v) => v.toFixed(2),
  apply: (v) => { BETA = v; updateHint(); },
});

// ============================================================
// Animation loop
// ============================================================
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const t = clock.getElapsedTime();
  particleMat.uniforms.uTime.value = t;

  // Auto-rotate after 2.5s of no interaction
  const idleMs = performance.now() - lastInteractionMs;
  controls.autoRotate = !userDragging && idleMs > 2500;
  controls.update();

  updateCursorPoint();

  // Advance simulation
  for (let s = 0; s < stepsPerFrame; s++) {
    rk4Step(DT, particleCount);
  }
  uploadPositions(particleCount);

  // Pass 1: render previous accumulated frame back into rtB, slightly darkened.
  fadeMat.uniforms.tPrev.value = rtA.texture;
  renderer.setRenderTarget(rtB);
  renderer.render(fadeScene, quadCam);

  // Pass 2: additively render new particles on top, into the same rtB.
  renderer.autoClear = false;
  renderer.render(scene, camera);
  renderer.autoClear = true;

  // Pass 3: present rtB to the screen with bloom + vignette.
  displayMat.uniforms.tInput.value = rtB.texture;
  renderer.setRenderTarget(null);
  renderer.render(displayScene, quadCam);

  // Ping-pong swap.
  const tmp = rtA; rtA = rtB; rtB = tmp;
}

frame();
