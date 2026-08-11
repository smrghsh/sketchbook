// color bop — ported from color-bop (webpack / three 0.126 / WebXR)
// Two sine-offset rows of randomly rotated cubes share one ShaderMaterial
// colored by the IQ cosine palette a + b·cos(2π(c·t + d)) over vP.x + vP.y/2.
// Clicking re-randomizes all four palette vectors — the grid "bops".

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {
  rowWidth: 5,
  spacing: 0.1,
  bob: 0.6,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color('black');

const camera = new THREE.PerspectiveCamera(
  35,
  innerWidth / innerHeight,
  0.1,
  100
);
camera.position.set(3, 3, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.8, -0.35);

// ---------------------------------------------------------------- palette
// shared shader material — IQ cosine palette over world position
const colorSamplerVertex = /* glsl */ `
varying vec3 vP;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    vP = modelPosition.xyz;
}
`;

const colorSamplerFragment = /* glsl */ `
varying vec3 vP;
uniform vec3 ua;
uniform vec3 ub;
uniform vec3 uc;
uniform vec3 ud;

vec3 pal( float t, vec3 a, vec3 b, vec3 c, vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

void main() {
    vec3 color = pal(vP.x + vP.y/2.0, ua, ub, uc, ud);
    gl_FragColor = vec4(color.rgb, 1.0);
}
`;

const material = new THREE.ShaderMaterial({
  vertexShader: colorSamplerVertex,
  fragmentShader: colorSamplerFragment,
  uniforms: {
    ua: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    ub: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    uc: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
    ud: { value: new THREE.Vector3(0.0, 0.33, 0.67) },
  },
});

function bop() {
  for (const k of ['ua', 'ub', 'uc', 'ud']) {
    material.uniforms[k].value.set(Math.random(), Math.random(), Math.random());
  }
}

// ---------------------------------------------------------------- cubes
const CUBE_SIZE = 0.25;
const cubeGeometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);
let cubes = [];

function buildRows() {
  cubeGroup.clear();
  cubes = [];
  const rows = [
    { baseY: 0.5, z: 0 },
    { baseY: 1.1, z: -0.7 },
  ];
  for (const row of rows) {
    for (
      let x = -params.rowWidth;
      x < params.rowWidth;
      x += CUBE_SIZE + params.spacing
    ) {
      const cube = new THREE.Mesh(cubeGeometry, material);
      cube.position.set(x, row.baseY + Math.sin(x) * 0.5, row.z);
      cube.rotation.x = Math.random() * Math.PI;
      cube.rotation.y = Math.random() * Math.PI;
      cube.userData = { x, baseY: row.baseY };
      cubeGroup.add(cube);
      cubes.push(cube);
    }
  }
}
buildRows();

// ---------------------------------------------------------------- floor
const floorVertex = /* glsl */ `
varying vec3 vPosition;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    vPosition = position;
}
`;

const floorFragment = /* glsl */ `
varying vec3 vPosition;

void main() {
    vec3 color = vec3(1.0);
    float thickness = 0.01;
    float opacity = smoothstep(1.0-thickness ,1.0,(vPosition.x - thickness/2.0) - floor(vPosition.x-thickness/2.0));
    opacity += smoothstep(1.0-thickness ,1.0,(vPosition.y - thickness/2.0) - floor(vPosition.y-thickness/2.0));
    opacity = opacity/2.0;
    opacity = step(0.01,opacity);
    opacity = opacity/4.0;
    gl_FragColor = vec4(color,opacity);
}
`;

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.ShaderMaterial({
    vertexShader: floorVertex,
    fragmentShader: floorFragment,
    transparent: true,
  })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// ---------------------------------------------------------------- stars
// soft round sprite drawn on a canvas — stands in for the star alphaMap
function makeStarTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

{
  const count = 700;
  const positions = new Float32Array(count * 3);
  const color = new Float32Array(count * 3).fill(1);
  for (let i = 0; i < count * 3; i += 3) {
    const distance = Math.random() * 5 + 20;
    const rot1 = Math.acos(2 * Math.random() - 1.0);
    const rot2 = Math.random() * 2 * Math.PI;
    positions[i] = Math.sin(rot1) * Math.cos(rot2) * distance;
    positions[i + 1] = Math.sin(rot1) * Math.sin(rot2) * distance;
    positions[i + 2] = Math.cos(rot1) * distance;
  }
  const starsGeometry = new THREE.BufferGeometry();
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starsGeometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  const starsMaterial = new THREE.PointsMaterial({
    size: 0.22,
    sizeAttenuation: true,
    color: 'white',
    vertexColors: true,
    transparent: true,
    alphaMap: makeStarTexture(),
    alphaTest: 0.001,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(starsGeometry, starsMaterial));
}

// ---------------------------------------------------------------- chrome
const controlsEl = document.getElementById('controls');
Standard.param(controlsEl, params, {
  id: 'rowWidth',
  label: 'row width',
  min: 2,
  max: 8,
  step: 0.5,
  value: params.rowWidth,
  fmt: (v) => v.toFixed(1),
  apply: (v) => {
    params.rowWidth = v;
    buildRows();
  },
});
Standard.param(controlsEl, params, {
  id: 'spacing',
  label: 'spacing',
  min: 0.02,
  max: 0.5,
  step: 0.01,
  value: params.spacing,
  fmt: (v) => v.toFixed(2),
  apply: (v) => {
    params.spacing = v;
    buildRows();
  },
});
Standard.param(controlsEl, params, {
  id: 'bob',
  label: 'bob speed',
  min: 0,
  max: 3,
  step: 0.05,
  value: params.bob,
  fmt: (v) => v.toFixed(2),
});
document.getElementById('bop').addEventListener('click', bop);

// click anywhere to bop (original re-randomized on any click) —
// but not when the pointer travelled, so orbiting doesn't bop
let downX = 0;
let downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
});
renderer.domElement.addEventListener('click', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) < 6) bop();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let bobPhase = 0;
renderer.setAnimationLoop(() => {
  bobPhase += clock.getDelta() * params.bob;
  for (const cube of cubes) {
    cube.position.y =
      cube.userData.baseY + Math.sin(cube.userData.x + bobPhase) * 0.5;
  }
  controls.update();
  renderer.render(scene, camera);
});
