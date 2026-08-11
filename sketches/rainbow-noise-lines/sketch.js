// rainbow noise lines — staggered sin waves practice.
// Ported from a 2021 webpack/three@0.126 project. Fifty 100-unit lines
// stacked in depth, each progressively z-rotated and randomly drawn as
// a Line or as Points; the vertex shader ripples them with layered sin
// and value noise. Original GLSL comments preserved. The 2.0 amplitude
// became uAmplitude so it can be played with.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Original vertex shader (src/shaders/staggeredLines/vertex.glsl).
const staggeredLinesVertexShader = /* glsl */ `
uniform float uTime;
uniform float uAmplitude;

varying float vPigmentX;
varying float vPigmentY;
varying vec3 vModifiedPosition;
varying float vBump;
float rand(float n){return fract(sin(n) * 43758.5453123);}

float noise(float p){
	float fl = floor(p);
  float fc = fract(p);
	return mix(rand(fl), rand(fl + 1.0), fc);
}

float rand(vec2 n) {
	return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 p){
	vec2 ip = floor(p);
	vec2 u = fract(p);
	u = u*u*(3.0-2.0*u);

	float res = mix(
		mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
		mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
	return res*res;
}

void main() {
    vec3 modifiedPosition = vec3(position);
    float bump = noise( 0.5 * position.z);
    modifiedPosition.y += bump + uAmplitude * sin((0.2 * position.x + uTime + sin(position.z/9.0) + noise(position.z)));

    vPigmentX = noise(position.z/10.0);
    vPigmentY = modifiedPosition.y - bump;
    vModifiedPosition = modifiedPosition;
    vBump = bump;

    vec4 modelPosition = modelMatrix * vec4(modifiedPosition, 1.0);

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
  gl_PointSize = bump + vPigmentY + 1.0;
    gl_Position = projectedPosition;
}
`;

// Original fragment shader (src/shaders/staggeredLines/fragment.glsl).
const staggeredLinesFragmentShader = /* glsl */ `
varying float vPigmentX;
varying float vPigmentY;
varying float vBump;
varying vec3 vModifiedPosition;


void main(){


    gl_FragColor = vec4(sin(vModifiedPosition.z),sin(vModifiedPosition.y),1.0,1.0);
}
`;

const params = {
  lines: 50,
  twist: 0.5,
  amplitude: 2,
  speed: 1,
};

const scene = new THREE.Scene();

const material = new THREE.ShaderMaterial({
  vertexShader: staggeredLinesVertexShader,
  fragmentShader: staggeredLinesFragmentShader,
  uniforms: {
    uTime: { value: 0.0 },
    uAmplitude: { value: params.amplitude },
  },
  side: THREE.DoubleSide,
});

// Original layout: i runs 0..10 in steps of 0.2 → 50 lines at z = i,
// each rotated by i * 0.5 / 10.
const qtyLines = 10;
const linesLength = 100;
const quantityPoints = 100;
let lines = [];

function buildLines() {
  lines.forEach((line) => {
    scene.remove(line);
    line.geometry.dispose();
  });
  lines = [];
  const step = qtyLines / params.lines;
  for (let i = 0; i < qtyLines; i += step) {
    const points = [];
    for (
      let j = (-1 * linesLength) / 2;
      j < linesLength / 2;
      j += linesLength / quantityPoints
    ) {
      points.push(new THREE.Vector3(j, 0, i));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line =
      Math.random() > 0.5
        ? new THREE.Points(geometry, material)
        : new THREE.Line(geometry, material);
    line.userData.i = i;
    line.rotateZ((i * params.twist) / qtyLines);
    scene.add(line);
    lines.push(line);
  }
}
buildLines();

function applyTwist() {
  lines.forEach((line) => {
    line.rotation.z = (line.userData.i * params.twist) / qtyLines;
  });
}

const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.1,
  100
);
camera.position.z = -2 * qtyLines;
camera.position.x = 0;
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Controls
Standard.bind(params, 'lines', (v) => String(v), (v) => {
  params.lines = Math.round(v);
  buildLines();
});
Standard.bind(params, 'twist', (v) => v.toFixed(2), (v) => {
  params.twist = v;
  applyTwist();
});
Standard.bind(params, 'amplitude', (v) => v.toFixed(1), (v) => {
  material.uniforms.uAmplitude.value = v;
});
Standard.bind(params, 'speed', (v) => v.toFixed(2), (v) => (params.speed = v));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let waveTime = 0;
renderer.setAnimationLoop(() => {
  waveTime += clock.getDelta() * params.speed;
  controls.update();
  material.uniforms.uTime.value = waveTime;
  renderer.render(scene, camera);
});
