// dna perfect loop — genuary 2022 day 1 ("a perfect loop")
// port of smrghsh/genuary2022/1: two sin/cos-displaced backbones (Line),
// ACTG rungs displaced in the vertex shader, three cloned helices,
// tumbling extruded nucleobase names. Loops every 4π seconds.
// CCapture harness and pinned 1080×1920 output removed; full-bleed.

import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const params = {
  speed: 1.0, // time rate — the loop just plays faster/slower
  amplitude: 1.0, // helix radius
  thickness: 0.2, // jitter of the backbone strokes
};

const backboneVertexShader = /* glsl */ `
#define PI     3.14159265
#define TWO_PI 6.28318530

uniform float uTime;
uniform float offset;
uniform float speed;
uniform float amplitude;

void main() {
    vec3 p = vec3(position);
    float o = PI * offset;
    o += uTime;

    p.y += amplitude * sin(p.z * speed + o);
    p.x += amplitude * cos(p.z * speed + o);
    vec4 modelPosition = modelMatrix * vec4(p, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_PointSize = 1.0;
    gl_Position = projectedPosition;
}
`;

const backboneFragmentShader = /* glsl */ `
void main() {
    vec3 color = vec3(0.0);
    gl_FragColor = vec4(color, 1.0);
}
`;

const actgVertexShader = /* glsl */ `
#define PI     3.14159265
#define TWO_PI 6.28318530

uniform float uTime;
uniform float offset;
uniform float speed;
uniform float amplitude;

void main() {
    vec3 p = vec3(position);
    float o = PI * offset;
    o += uTime;

    p.y = position.y * sin(p.z * speed + o);
    p.x += position.y * cos(p.z * speed + o);
    vec4 modelPosition = modelMatrix * vec4(p, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_PointSize = 1.0;
    gl_Position = projectedPosition;
}
`;

const actgFragmentShader = backboneFragmentShader;

// ---- scene ----

const scene = new THREE.Scene();
scene.background = new THREE.Color('white');

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
const barMaterial = new THREE.ShaderMaterial({
  vertexShader: actgVertexShader,
  fragmentShader: actgFragmentShader,
  uniforms: uniformsFor(1.0),
  side: THREE.DoubleSide,
});
const materials = [material, material2, barMaterial];

const lineLength = 17;
let helixGroups = [];

function buildHelices() {
  for (const g of helixGroups) {
    scene.remove(g);
    g.traverse((o) => o.geometry && o.geometry.dispose());
  }
  helixGroups = [];

  const DNA = new THREE.Group();

  // backbones — one jittered polyline, drawn twice half a turn apart
  const points = [];
  for (let i = -lineLength; i < lineLength; i += 0.01 * Math.random()) {
    points.push(
      new THREE.Vector3(
        Math.random() * params.thickness,
        Math.random() * params.thickness,
        i
      )
    );
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  DNA.add(new THREE.Line(geometry, material));
  DNA.add(new THREE.Line(geometry, material2));

  // rungs — the ACTG shader folds them between the backbones
  const barThickness = 0.1;
  const step = 0.5;
  for (let j = -lineLength; j < lineLength; j += step) {
    const barPoints = [];
    for (let i = -params.amplitude; i < params.amplitude; i += 0.01 * Math.random()) {
      barPoints.push(
        new THREE.Vector3(
          Math.random() * barThickness,
          i,
          Math.random() * barThickness + j
        )
      );
    }
    const barGeometry = new THREE.BufferGeometry().setFromPoints(barPoints);
    DNA.add(new THREE.Line(barGeometry, barMaterial));
  }

  DNA.rotation.x += 1.111111;
  const DNA2 = DNA.clone();
  DNA2.position.y += 9;
  DNA2.position.z += 1.0;
  DNA2.position.x -= 1.1;
  const DNA3 = DNA2.clone();
  DNA3.position.y -= 19;
  scene.add(DNA, DNA2, DNA3);
  helixGroups = [DNA, DNA2, DNA3];
}
buildHelices();

// ---- tumbling nucleobase names ----

let text = null;
const fontLoader = new FontLoader();
fontLoader.load('./helvetiker_regular.typeface.json', (font) => {
  const textGeometry = new TextGeometry('adenine\ncytosine\nguanine\nthymine', {
    font: font,
    size: 0.45,
    depth: 0.2,
    curveSegments: 4,
    bevelEnabled: false,
  });
  textGeometry.center();
  const textMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
  text = new THREE.Mesh(textGeometry, textMaterial);
  text.scale.z *= 0.2;
  text.position.y += 3.4;
  text.position.z += 1.4;
  scene.add(text);
});

// ---- camera / renderer ----

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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- controls chrome ----

const controlsEl = document.getElementById('controls');
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
  max: 2.5,
  step: 0.05,
  value: params.amplitude,
  fmt: (v) => v.toFixed(2),
  apply: (v) => {
    params.amplitude = v;
    for (const m of materials) m.uniforms.amplitude.value = v;
    buildHelices(); // rung extent is baked into geometry
  },
});
Standard.param(controlsEl, params, {
  id: 'thickness',
  label: 'thickness',
  min: 0.0,
  max: 1.0,
  step: 0.02,
  value: params.thickness,
  fmt: (v) => v.toFixed(2),
  apply: (v) => {
    params.thickness = v;
    buildHelices();
  },
});

// ---- animate ----
// phase accumulates so the speed slider never pops the loop;
// the pattern repeats every 2π of phase, the text every 4π.

const clock = new THREE.Clock();
let phase = 0;

renderer.setAnimationLoop(() => {
  phase += clock.getDelta() * params.speed;
  for (const m of materials) m.uniforms.uTime.value = phase;
  if (text) {
    text.rotation.set(0.5, -Math.PI / 2 + phase * 0.5, 0.1);
  }
  renderer.render(scene, camera);
});
