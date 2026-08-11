// intersections — genuary 2022 day 4
// port of smrghsh/genuary2022/"4 - Intersections": the day-1 helix
// backbones as pure THREE.Points, cloned dozens of times along a sweep
// with randomized rotations into a dense tangle on black.
// CCapture harness and pinned 1080×1920 output removed; OrbitControls added.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {
  clones: 47, // original: for (i = -6; i < 8; i += 0.3)
  speed: 1.0,
  amplitude: 1.0,
};

const backboneVertexShader = /* glsl */ `
#define PI     3.14159265
#define TWO_PI 6.28318530

uniform float uTime;
uniform float offset;
uniform float speed;
uniform float amplitude;
varying vec3 vP;
varying vec3 vP2;

void main() {
    vec3 p = vec3(position);
    float o = PI * offset;
    o += uTime;

    p.y += amplitude * sin(p.z * speed + o);
    p.x += amplitude * cos(p.z * speed + o);
    vec4 modelPosition = modelMatrix * vec4(p, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    vP = p;
    vP2 = p.xyz;
    gl_PointSize = 1.0 + 1.2 * sin(p.z * speed + o);
    gl_Position = projectedPosition;
}
`;

const backboneFragmentShader = /* glsl */ `
varying vec3 vP;
varying vec3 vP2;

vec3 pal( float t, vec3 a, vec3 b, vec3 c, vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

void main() {
    vec3 color = pal(vP.x + vP2.y/10., vec3(0.5,0.5,0.5), vec3(0.5,0.5,0.5), vec3(1.0,1.0,1.0), vec3(0.0,0.33,0.67));
    gl_FragColor = vec4(color, 1.0);
}
`;

// ---- scene ----

const scene = new THREE.Scene();
scene.background = new THREE.Color('black');

const uniformsFor = (offset) => ({
  uTime: { value: 0.0 },
  offset: { value: offset },
  speed: { value: 1.0 },
  amplitude: { value: params.amplitude },
});

const material = new THREE.ShaderMaterial({
  vertexShader: backboneVertexShader,
  fragmentShader: backboneFragmentShader,
  uniforms: uniformsFor(0.0),
  side: THREE.DoubleSide,
});
const material2 = new THREE.ShaderMaterial({
  vertexShader: backboneVertexShader,
  fragmentShader: backboneFragmentShader,
  uniforms: uniformsFor(1.0),
  side: THREE.DoubleSide,
});
const materials = [material, material2];

// one jittered point strand, shared by every clone
const lineLength = 17;
const thickness = 0.2;
const points = [];
for (let i = -lineLength; i < lineLength; i += 0.02 * Math.random()) {
  points.push(
    new THREE.Vector3(Math.random() * thickness, Math.random() * thickness, i)
  );
}
const geometry = new THREE.BufferGeometry().setFromPoints(points);

const DNA = new THREE.Group();
DNA.add(new THREE.Points(geometry, material));
DNA.add(new THREE.Points(geometry, material2));
DNA.rotation.x += 1.111111;

let clones = [];
function buildTangle() {
  for (const c of clones) scene.remove(c); // geometry is shared — no dispose
  clones = [];
  // sweep the original -6..8 range with randomized rotations
  const n = Math.max(1, Math.round(params.clones));
  for (let k = 0; k < n; k++) {
    const i = -6 + (14 * k) / n;
    const c = DNA.clone();
    c.rotation.x += 1.0 * Math.random() + i / 3;
    scene.add(c);
    clones.push(c);
  }
}
buildTangle();

// ---- camera / renderer / controls ----

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(-6, -2.3, 0);
camera.lookAt(new THREE.Vector3(0, 0, 0));
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- controls chrome ----

const controlsEl = document.getElementById('controls');
Standard.param(controlsEl, params, {
  id: 'clones',
  label: 'clones',
  min: 1,
  max: 120,
  step: 1,
  value: params.clones,
  fmt: (v) => String(Math.round(v)),
  apply: (v) => {
    params.clones = v;
    buildTangle();
  },
});
Standard.param(controlsEl, params, {
  id: 'speed',
  label: 'speed',
  min: 0,
  max: 3,
  step: 0.05,
  value: params.speed,
  fmt: (v) => v.toFixed(2),
});
Standard.param(controlsEl, params, {
  id: 'amplitude',
  label: 'amplitude',
  min: 0.2,
  max: 3,
  step: 0.05,
  value: params.amplitude,
  fmt: (v) => v.toFixed(2),
  apply: (v) => {
    params.amplitude = v;
    for (const m of materials) m.uniforms.amplitude.value = v;
  },
});
const reroll = document.createElement('button');
reroll.className = 'ctrl';
reroll.textContent = 'retangle ✦';
reroll.addEventListener('click', buildTangle);
controlsEl.appendChild(reroll);

// ---- animate ----

const clock = new THREE.Clock();
let phase = 0;

renderer.setAnimationLoop(() => {
  phase += clock.getDelta() * params.speed;
  for (const m of materials) m.uniforms.uTime.value = phase;
  controls.update();
  renderer.render(scene, camera);
});
