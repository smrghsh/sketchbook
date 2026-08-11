// sphere wub — a wubbing sphere.
// Extracted from the WebXR Experience harness (Wubsphere.js, three
// 0.126-era) into a clean desktop scene on three 0.174. 2000 shell
// points each independently breathe radius = a + (b-a)·sin(phase + t);
// color mixes red→blue by radius.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {
  points: 2000,
  inner: 1.0, // a
  outer: 1.5, // b
  speed: 1,
};

const vertexShader = /* glsl */ `
varying vec3 vPosition;
varying float edge;
varying float vRot1;
varying float vRot2;

attribute float rot1;
attribute float rot2;
attribute float p;
uniform float uTime;
uniform float uInner;
uniform float uOuter;

void main() {

    vPosition = position;
    // let rot1 = Math.acos((2*Math.random())-1.0)
    //         let rot2 = Math.random()*(2*Math.PI)
    //         positions[i] = Math.sin(rot1)*Math.cos(rot2)*distance
    //         positions[i+1] = Math.sin(rot1)*Math.sin(rot2)*distance
    //         positions[i+2] = Math.cos(rot1)*distance
    // edge = 10.0 * p * sin(p+uTime/1000.0);
    edge = sin(p + uTime); // uTime arrives in seconds (was ms/1000)

    float d = uInner + (uOuter - uInner) * edge;

    vPosition.x = sin(rot1) * cos(rot2) * d;
    vPosition.y = sin(rot1) * sin(rot2) * d;
    vPosition.z = cos(rot1) * d;

    vec4 modelPosition = modelMatrix * vec4(vPosition, 1.0);

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;
    gl_PointSize = 4.0;
    vRot1 = rot1;
    vRot2 = rot2;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vPosition;
varying float edge;
uniform float uTime;
void main() {
    vec3 color1 = vec3(1.0,0.0,0.0);
    vec3 color2 = vec3(0.0,0.0,1.0);
    vec3 color = mix(color1, color2,(edge+1.0)/2.0);

    gl_FragColor = vec4(color,1.0);
}
`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b10);

const wubMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0.0 },
    uInner: { value: params.inner },
    uOuter: { value: params.outer },
  },
});

/**
 * Wubsphere — regenerated when the points slider changes
 */
let particles = null;
function buildWubsphere(count) {
  if (particles) {
    scene.remove(particles);
    particles.geometry.dispose();
  }
  const particlesGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const rot1 = new Float32Array(count);
  const rot2 = new Float32Array(count);
  const p = new Float32Array(count);

  for (let i = 0; i < count * 3; i += 3) {
    const a = 1;
    const b = 1.1;
    const distance = Math.random() * (b - a) + a;
    // acos(2r-1) gives an even distribution over the sphere
    const r1 = Math.acos(2 * Math.random() - 1.0);
    const r2 = Math.random() * (2 * Math.PI);
    positions[i] = Math.sin(r1) * Math.cos(r2) * distance;
    positions[i + 1] = Math.sin(r1) * Math.sin(r2) * distance;
    positions[i + 2] = Math.cos(r1) * distance;
  }
  for (let i = 0; i < count; i++) {
    rot1[i] = Math.acos(2 * Math.random() - 1.0);
    rot2[i] = Math.random() * (2 * Math.PI);
    p[i] = Math.random() * Math.PI;
  }
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeometry.setAttribute('rot1', new THREE.BufferAttribute(rot1, 1));
  particlesGeometry.setAttribute('rot2', new THREE.BufferAttribute(rot2, 1));
  particlesGeometry.setAttribute('p', new THREE.BufferAttribute(p, 1));

  particles = new THREE.Points(particlesGeometry, wubMaterial);
  scene.add(particles);
}
buildWubsphere(params.points);

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 1.2, 5);
scene.add(camera);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/**
 * Params
 */
Standard.bind(params, 'points', (v) => v.toFixed(0), (v) =>
  buildWubsphere(Math.round(v))
);
Standard.bind(params, 'inner', (v) => v.toFixed(2), (v) => {
  wubMaterial.uniforms.uInner.value = v;
});
Standard.bind(params, 'outer', (v) => v.toFixed(2), (v) => {
  wubMaterial.uniforms.uOuter.value = v;
});
Standard.bind(params, 'speed', (v) => v.toFixed(2), (v) => (params.speed = v));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

/**
 * Animate
 */
const clock = new THREE.Clock();
let wubTime = 0; // accumulated so speed changes don't jump

const tick = () => {
  wubTime += clock.getDelta() * params.speed;
  wubMaterial.uniforms.uTime.value = wubTime;
  controls.update();
  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
};

tick();
