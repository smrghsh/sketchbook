// planet variations — fragment shaders on spheres.
// Ported from the 2021 webpack project (three 0.126) to three 0.174.
// An fbm ocean sphere inside a transparent cloud shell (the cloud's
// alpha IS the fbm), moons orbiting at r 1.3, and a starfield.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {
  moons: 12,
  drift: 1,
  orbit: 1,
  stars: 3500,
};

// shared noise header for all three shaders
const noiseGLSL = /* glsl */ `
// book of shaders random from fbm chapter
float random (in vec2 st) {
    return fract(sin(dot(st.xy,
    vec2(12.9898,78.233)))*
    43758.5453123);
}
// Quilez's 2D simplex noise https://www.shadertoy.com/view/Msf3WH
// originally had issue with tiling, but Mike Bostock's sketch and the book of shaders chapter on noise helped me figure it out
// https://observablehq.com/@mbostock/domain-warping
vec2 hash( vec2 p ) // replace this by something better
{
    p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
    return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}
float noise( in vec2 p )
{
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;

    vec2  i = floor( p + (p.x+p.y)*K1 );
    vec2  a = p - i + (i.x+i.y)*K2;
    float m = step(a.y,a.x);
    vec2  o = vec2(m,1.0-m);
    vec2  b = a - o + K2;
    vec2  c = a - 1.0 + 2.0*K2;
    vec3  h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
    vec3  n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
    return dot( n, vec3(70.0) );
}
#define OCTAVES 6
float fbm (in vec2 st) {
    // Initial values
    float value = 0.0;
    float amplitude = .5;
    float frequency = 0.;
    //
    // Loop of octaves
    for (int i = 0; i < OCTAVES; i++) {
        value += amplitude * noise(st);
        st *= 2.;
        amplitude *= .5;
    }
    return value;
}
`;

const sphereVertexShader = /* glsl */ `
uniform float uTime;
varying vec2 vUv;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    vUv = uv;
    gl_Position = projectedPosition;
}
`;

const moonVertexShader = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec4 vProjectedPosition;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    vUv = uv;
    gl_Position = projectedPosition;
    vProjectedPosition = projectedPosition;
}
`;

const cloudFragmentShader = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
${noiseGLSL}
void main(){
    vec3 color = vec3(0.0);
    vec2 st = vUv;
    vec2 p = st*5.0;
    // quilez does fbm( p + fbm(p)), which he notates as fbm(q + r), using q and r to modulate color
        // fully expanded, I'm doing fbm(p + fbm(p + fbm(p))), so additional nesting r = fbm(p + s)
        // I add terms to set the d/dt of q,r,s
        // The undercurrent is s, it has the greatest effect on the whole simulation at the core
        // its d/dt, t3, is set to be opposite t1, which affects the pollution.
        // these are nested functions so the order magnitude needs to be different
        // t2 modulates the rivers velocity, here it's slightly against the river flow strength, almost 0
        // originally t values had an additional trig term, but alas performance

        // undercurrent relative velocity
        float t1 = 10.0 + uTime * -0.05;
        // river relative velocity
        float t2 = 10.0 + uTime * 0.02;
        // pollution relative velocity
        float t3 = 10.0 + uTime * 0.1;
        vec2 q = p + t1;
        float s = fbm(p + t3);
        float r = fbm(p + t2 + s);
        // so this is where is ressembles the canonical quilez technique
        color += fbm(q + r);
        // bump up brightness a smidgen
        color += 1.0;
        // the cloud's alpha is the fbm itself
        gl_FragColor = vec4(color,fbm(q + r));
}
`;

const oceanFragmentShader = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
${noiseGLSL}
void main(){
    vec3 color = vec3(0.0);
    vec2 st = vUv;
    vec2 p = st*5.0;
    // undercurrent relative velocity
    float t1 = uTime * -0.05;
    // river relative velocity
    float t2 = uTime * 0.01;
    // pollution relative velocity
    float t3 = uTime * 0.1;
    vec2 q = p + t1;
    float s = fbm(p + t3);
    float r = fbm(p + t2 + s);
    // so this is where is ressembles the canonical quilez technique
    color += fbm(q + r);
    // bump up brightness a smidgen
    color += 0.21;
    // note that r here isn't red, it's river as modulated by undercurrent
    color.b += r + 0.6;
    // pollution as opposite of undercurrent color (couldnt use q without more operations)
    color.g += s/5.5;
    gl_FragColor = vec4(color,1.0);
}
`;

const moonFragmentShader = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec4 vProjectedPosition;
${noiseGLSL}
void main(){
    vec3 color = vec3(0.0);
    vec2 st = vUv + vProjectedPosition.xy / 10.0;
    vec2 p = st*5.0;
    // undercurrent relative velocity
    float t1 = uTime * -0.05;
    // river relative velocity
    float t2 = uTime * 0.01;
    // pollution relative velocity
    float t3 = uTime * 0.1;
    vec2 q = p + t1;
    float s = fbm(p + t3);
    float r = fbm(p + t2 + s);
    // so this is where is ressembles the canonical quilez technique
    color += fbm(q + r);
    // bump up brightness a smidgen
    color += 0.21;
    color.r +=   0.5;
    // note that r here isn't red, it's river as modulated by undercurrent
    color.b += r/2.0;
    // pollution as opposite of undercurrent color (couldnt use q without more operations)
    color.g += s/10.5;
    gl_FragColor = vec4(color,1.0);
}
`;

/**
 * Base
 */
const scene = new THREE.Scene();

const planetGeometry = new THREE.SphereGeometry(1, 32, 32);

const cloudMaterial = new THREE.ShaderMaterial({
  vertexShader: sphereVertexShader,
  fragmentShader: cloudFragmentShader,
  uniforms: { uTime: { value: 0.0 } },
  transparent: true,
});
const oceanMaterial = new THREE.ShaderMaterial({
  vertexShader: sphereVertexShader,
  fragmentShader: oceanFragmentShader,
  uniforms: { uTime: { value: 0.0 } },
  transparent: true,
});
const moonMaterial = new THREE.ShaderMaterial({
  vertexShader: moonVertexShader,
  fragmentShader: moonFragmentShader,
  uniforms: { uTime: { value: 0.0 } },
  transparent: true,
});

const ocean = new THREE.Mesh(planetGeometry, oceanMaterial);
const clouds = new THREE.Mesh(planetGeometry, cloudMaterial);
clouds.scale.multiplyScalar(1.02);
scene.add(ocean);
scene.add(clouds);

/**
 * Moons — rebuilt when the slider changes
 */
let moons = [];
function buildMoons(amt) {
  moons.forEach((moon) => scene.remove(moon));
  moons = [];
  for (let i = 0; i < amt; i++) {
    const moon = new THREE.Mesh(planetGeometry, moonMaterial);
    moon.scale.multiplyScalar(0.07);
    moon.position.x = 1;
    moons.push(moon);
    scene.add(moon);
  }
}
buildMoons(params.moons);

/**
 * Starfield — regenerated when the slider changes
 */
const particlesMaterial = new THREE.PointsMaterial({
  size: 0.008,
  sizeAttenuation: true,
});
particlesMaterial.color = new THREE.Color('white');
particlesMaterial.vertexColors = true;
particlesMaterial.transparent = true;
particlesMaterial.alphaTest = 0.001;
particlesMaterial.depthWrite = false;
// this one is a bigger performance impact
particlesMaterial.blending = THREE.AdditiveBlending;

let particles = null;
function buildStars(count) {
  const rotation = particles ? particles.rotation.clone() : null;
  if (particles) {
    scene.remove(particles);
    particles.geometry.dispose();
  }
  const particlesGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    color[i] = 1;
  }
  for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 15;
    positions[i + 1] = (Math.random() - 0.5) * 15;
    positions[i + 2] = (Math.random() - 0.5) * 15;
  }
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  particles = new THREE.Points(particlesGeometry, particlesMaterial);
  if (rotation) particles.rotation.copy(rotation);
  scene.add(particles);
}
buildStars(params.stars);

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 100);
camera.position.set(1, 0.1, 3);
scene.add(camera);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/**
 * Params
 */
Standard.bind(params, 'moons', (v) => v.toFixed(0), (v) => buildMoons(Math.round(v)));
Standard.bind(params, 'drift', (v) => v.toFixed(2), (v) => (params.drift = v));
Standard.bind(params, 'orbit', (v) => v.toFixed(2), (v) => (params.orbit = v));
Standard.bind(params, 'stars', (v) => v.toFixed(0), (v) => buildStars(Math.round(v)));

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
let cloudTime = 0; // accumulated so drift changes don't jump
let orbitPhase = 0;

const tick = () => {
  const delta = clock.getDelta();
  const elapsedTime = clock.elapsedTime;

  cloudTime += delta * params.drift;
  orbitPhase += delta * 0.25 * params.orbit;

  oceanMaterial.uniforms.uTime.value = elapsedTime;
  cloudMaterial.uniforms.uTime.value = cloudTime;

  moons.forEach((moon, i) => {
    const angle = orbitPhase + (i / moons.length) * Math.PI * 2;
    moon.position.x = 1.3 * Math.sin(angle);
    moon.position.z = 1.3 * Math.cos(angle);
  });

  particles.rotation.x += 0.001;
  particles.rotation.y += 0.001;

  controls.update();
  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
};

tick();
