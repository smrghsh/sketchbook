// glass — stained glass adrift over santa cruz
// three.js: equirect environment (Santa Cruz boardwalk, photo: Diliff,
// CC BY-SA 3.0), MeshPhysicalMaterial transmission glass with dispersion,
// thin round gold rims.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {
  pieces: 80,
  orbit: 1,
  spin: 1,
  exposure: 1.15,
  blur: 0.3,
  autoPalette: true,
  palIndex: 0,
};

// URL overrides for any param, e.g. ?orbit=0&exposure=1.5
const RQ = new URLSearchParams(window.location.search);
for (const key of Object.keys(params)) {
  if (RQ.has(key)) params[key] = parseFloat(RQ.get(key));
}

// rotating glass palettes — pieces keep their slot and glide to the slot's
// new color when the active palette advances (every PALETTE_SECS). The
// backdrop stays the light santa cruz sky throughout.
const PALETTE_SECS = 2.5;
const PALETTES = [
  // pastel garden — the original
  [0xa9d4ff, 0xffc2dd, 0x8fe3d9, 0xd4c2f7, 0xffd4b8, 0xb8f0e4, 0x9fb8f0, 0xf6aecf],
  // teal & orange — complementary punch
  [0x0fa8a0, 0xff7f2a, 0x5fe0d4, 0xffb35c, 0x0f7f8f, 0xffd08f, 0x2fd4c4, 0xff9548],
  // byzantine — mosaic gold, tyrian purple, emerald, lapis
  [0xffd45f, 0x5c2f8f, 0x1f8f5f, 0x24408f, 0xa8202f, 0xf7ecd4, 0x3fa8b8, 0xc98f2f],
  // neon — electric
  [0xff2fd4, 0x2fffe8, 0xbfff2f, 0xfff02f, 0x8f2fff, 0xff5f2f, 0x2f8fff, 0xff2f6f],
  // sunset & indigo — warm/cool contrast
  [0xff8f5c, 0x3f3f8f, 0xffc42f, 0x7f5cd4, 0xff5c8f, 0x2f6fa8, 0xffe0a8, 0xd44f2f],
];

const VOLUME_RADIUS = 16;
const MARGIN = 0.2; // slack beyond each piece's motion envelope

// field rotation axis: tilted so pieces at the front sweep from the
// bottom-left up to the top-right, over the top, and back around
const ORBIT_AXIS = new THREE.Vector3(-0.55, 1, 0.12).normalize();
const ORBIT_RATE = 0.055; // rad/s at orbit = 1

let simTime = 0;
let orbitAngle = 0;
let activePal = 0;
let pieces = [];

// ---- renderer / scene / camera ----

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = params.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 0.5, 30);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 6;
controls.maxDistance = 60;

// ---- environment: santa cruz boardwalk equirect ----

const envTex = await new THREE.TextureLoader().loadAsync('santa-cruz-env.jpg');
envTex.mapping = THREE.EquirectangularReflectionMapping;
envTex.colorSpace = THREE.SRGBColorSpace;
scene.background = envTex;
scene.environment = envTex;
scene.backgroundBlurriness = params.blur;

// warm sun for specular sparkle on the rims
const sunLight = new THREE.DirectionalLight(0xfff1de, 1.2);
sunLight.position.set(5, 9, 4);
scene.add(sunLight);

// ---- materials ----

const goldMat = new THREE.MeshPhysicalMaterial({
  color: 0xf0bd54,
  metalness: 1,
  roughness: 0.12,
  envMapIntensity: 1.8,
});

const glassMats = new Set();

function glassMat() {
  const slot = Math.floor(Math.random() * 8);
  const hex = PALETTES[0][slot];
  const mat = new THREE.MeshPhysicalMaterial({
    color: hex,
    metalness: 0,
    roughness: THREE.MathUtils.randFloat(0.03, 0.1),
    transmission: 1,
    // transmission's refraction buffer only holds opaque objects, so glass
    // can't see glass through it — partial alpha lets sorted farther panes
    // blend through nearer ones and layered colors mix again
    transparent: true,
    opacity: 0.6,
    // thin real panes: keep refraction thickness at true pane depth so the
    // rim and neighbors don't ghost into a displaced double image
    thickness: THREE.MathUtils.randFloat(0.1, 0.22),
    ior: 1.45,
    dispersion: 0.12,
    attenuationColor: new THREE.Color(hex),
    attenuationDistance: 4,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    iridescence: 0.25,
    iridescenceIOR: 1.3,
    envMapIntensity: 1.25,
  });
  mat.userData.slot = slot;
  glassMats.add(mat);
  return mat;
}

// ---- piece construction ----
// plain panes only: circle = disc in a thin round torus rim,
// square = pane in a thin round tube frame (cylinders + corner spheres)

const rand = THREE.MathUtils.randFloat;

const GLASS_T = 0.05; // pane half-depth

const field = new THREE.Group();
scene.add(field);

function rimRadius(size) {
  return THREE.MathUtils.clamp(size * 0.03, 0.025, 0.07);
}

function buildCircle(group, R) {
  const rimT = rimRadius(R);
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, GLASS_T * 2, 64).rotateX(Math.PI / 2),
    glassMat()
  );
  group.add(disc);
  group.add(new THREE.Mesh(new THREE.TorusGeometry(R, rimT, 16, 96), goldMat));
}

function buildSquare(group, half) {
  const rimT = rimRadius(half);
  const pane = new THREE.Mesh(
    new THREE.BoxGeometry(half * 2, half * 2, GLASS_T * 2),
    glassMat()
  );
  group.add(pane);

  const edge = new THREE.CylinderGeometry(rimT, rimT, half * 2, 12);
  for (const [x, y, rotZ] of [
    [half, 0, 0],
    [-half, 0, 0],
    [0, half, Math.PI / 2],
    [0, -half, Math.PI / 2],
  ]) {
    const bar = new THREE.Mesh(edge, goldMat);
    bar.position.set(x, y, 0);
    bar.rotation.z = rotZ;
    group.add(bar);
  }
  const corner = new THREE.SphereGeometry(rimT, 12, 12);
  for (const [x, y] of [[half, half], [half, -half], [-half, half], [-half, -half]]) {
    const s = new THREE.Mesh(corner, goldMat);
    s.position.set(x, y, 0);
    group.add(s);
  }
}

// find a spot whose clearance from every existing piece fits the desired
// bounding sphere; shrink gradually if the field is crowded
function samplePlacement(desiredBound) {
  let bound = desiredBound;
  for (let tries = 0; tries < 500; tries++) {
    if (tries > 0 && tries % 40 === 0) bound *= 0.9;
    if (bound < 0.5) return null;
    const pos = new THREE.Vector3()
      .randomDirection()
      .multiplyScalar(VOLUME_RADIUS * Math.pow(Math.random(), 0.4));
    let ok = true;
    for (const p of pieces) {
      if (pos.distanceTo(p.basePos) < bound + p.boundR + MARGIN) {
        ok = false;
        break;
      }
    }
    if (ok) return { pos, bound };
  }
  return null;
}

function makePiece() {
  const isCircle = Math.random() < 0.55;
  // steep power-law sizes: swarms of tiny chips, rare grand medallions
  let size = 0.25 + 4.2 * Math.pow(Math.random(), 3);
  const boundFor = (s) => (isCircle ? s : s * Math.SQRT2) + rimRadius(s);

  // per-axis lissajous wander; its envelope is baked into the bounding
  // sphere so the placement guarantee still holds while pieces roam
  const wanderAmp = new THREE.Vector3(
    rand(0.1, 0.5), rand(0.1, 0.5), rand(0.1, 0.5)
  );

  const desired = boundFor(size) + wanderAmp.length();
  const spot = samplePlacement(desired);
  if (!spot) return null;
  const f = Math.min(1, spot.bound / desired);
  size *= f;
  wanderAmp.multiplyScalar(f);

  const group = new THREE.Group();
  if (isCircle) buildCircle(group, size);
  else buildSquare(group, size);

  const piece = {
    group,
    basePos: spot.pos,
    boundR: boundFor(size) + wanderAmp.length(),
    baseQuat: new THREE.Quaternion().random(),
    spinAxis: new THREE.Vector3().randomDirection(),
    angle: 0,
    // small chips flit, big medallions turn statelier
    spinSpeed: (rand(0.15, 0.6) / Math.sqrt(size)) * (Math.random() < 0.5 ? -1 : 1),
    precAxis: new THREE.Vector3().randomDirection(),
    precAngle: 0,
    precRate: rand(0.05, 0.3) * (Math.random() < 0.5 ? -1 : 1),
    wanderAmp,
    wanderFreq: new THREE.Vector3(
      rand(0.13, 0.5), rand(0.13, 0.5), rand(0.13, 0.5)
    ),
    wanderPhase: new THREE.Vector3(
      rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2)
    ),
  };
  field.add(group);
  return piece;
}

function disposePiece(p) {
  p.group.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.dispose();
      if (obj.material !== goldMat) {
        glassMats.delete(obj.material);
        obj.material.dispose();
      }
    }
  });
  field.remove(p.group);
}

function syncPieces() {
  while (pieces.length < params.pieces) {
    const p = makePiece();
    if (!p) break; // field full
    pieces.push(p);
  }
  while (pieces.length > params.pieces) disposePiece(pieces.pop());
}

function reshuffle() {
  while (pieces.length) disposePiece(pieces.pop());
  syncPieces();
}

// ---- simulation step ----

const _q = new THREE.Quaternion();
const _nutQ = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _c = new THREE.Color();
const NUT_AXIS = new THREE.Vector3(1, 0.2, 0).normalize();

function step(dt) {
  simTime += dt;

  // active palette: cycles every PALETTE_SECS when auto-switch is on,
  // otherwise pinned to the dropdown choice; colors glide via crossfade
  const idx = params.autoPalette
    ? Math.floor(simTime / PALETTE_SECS) % PALETTES.length
    : Math.min(params.palIndex, PALETTES.length - 1);
  if (idx !== activePal) {
    activePal = idx;
    const sel = document.getElementById('palette');
    if (sel) sel.value = String(idx);
  }
  const pal = PALETTES[idx];
  const fade = 1 - Math.exp(-3.5 * dt);
  for (const m of glassMats) {
    _c.setHex(pal[m.userData.slot]);
    m.color.lerp(_c, fade);
    m.attenuationColor.lerp(_c, fade);
  }

  orbitAngle += ORBIT_RATE * params.orbit * dt;
  // orbital sweep plus a slow nutation sway of the whole field
  field.quaternion.setFromAxisAngle(ORBIT_AXIS, orbitAngle);
  _nutQ.setFromAxisAngle(NUT_AXIS, 0.06 * Math.sin(simTime * 0.11));
  field.quaternion.premultiply(_nutQ);

  for (const p of pieces) {
    p.angle += p.spinSpeed * params.spin * dt;
    p.precAngle += p.precRate * params.spin * dt;

    // lissajous wander inside the piece's reserved envelope
    p.group.position.set(
      p.basePos.x +
        p.wanderAmp.x * Math.sin(simTime * p.wanderFreq.x + p.wanderPhase.x),
      p.basePos.y +
        p.wanderAmp.y * Math.sin(simTime * p.wanderFreq.y + p.wanderPhase.y),
      p.basePos.z +
        p.wanderAmp.z * Math.sin(simTime * p.wanderFreq.z + p.wanderPhase.z)
    );

    // spin about a slowly precessing axis
    _axis.copy(p.spinAxis).applyAxisAngle(p.precAxis, p.precAngle);
    _q.setFromAxisAngle(_axis, p.angle);
    p.group.quaternion.copy(_q).multiply(p.baseQuat);
  }
}

// ---- realtime loop ----

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  step(dt);
  controls.update();
  renderer.render(scene, camera);
}

// ---- UI ----

function wireUI() {
  Standard.bind(params, 'pieces', (v) => v.toFixed(0), (v) => {
    params.pieces = v;
    syncPieces();
  });
  Standard.bind(params, 'orbit', (v) => v.toFixed(1), (v) => (params.orbit = v));
  Standard.bind(params, 'spin', (v) => v.toFixed(1), (v) => (params.spin = v));
  Standard.bind(params, 'exposure', (v) => v.toFixed(2), (v) => {
    params.exposure = v;
    renderer.toneMappingExposure = v;
  });
  Standard.bind(params, 'blur', (v) => v.toFixed(2), (v) => {
    params.blur = v;
    scene.backgroundBlurriness = v;
  });

  const palSel = document.getElementById('palette');
  const autoChk = document.getElementById('auto');
  autoChk.checked = params.autoPalette;
  palSel.value = String(params.palIndex);
  palSel.addEventListener('input', () => {
    params.palIndex = parseInt(palSel.value, 10);
    params.autoPalette = false;
    autoChk.checked = false;
  });
  autoChk.addEventListener('change', () => {
    params.autoPalette = autoChk.checked;
  });

  document.getElementById('reshuffle').addEventListener('click', reshuffle);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// ---- go ----

syncPieces();
wireUI();
renderer.setAnimationLoop(animate);
