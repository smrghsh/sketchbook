// noise dunes — Samir's first vertex-shader study (learn-vertex-shaders,
// 2021), ported to plain three.js modules with the GLSL inlined.
// A grid of points is displaced by fbm into rolling dunes; each point is
// colored by a second, domain-warped fbm over world XZ.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {};

const noiseGLSL = /* glsl */ `
float random (in vec2 st) {
    return fract(sin(dot(st.xy,
    vec2(12.9898,78.233)))*
    43758.5453123);
}
// Quilez's 2D simplex noise https://www.shadertoy.com/view/Msf3WH
// originally had issue with tiling, but Mike Bostock's sketch and the
// book of shaders chapter on noise helped figure it out
// https://observablehq.com/@mbostock/domain-warping
vec2 hash( vec2 p )
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
    float value = 0.0;
    float amplitude = .5;
    for (int i = 0; i < OCTAVES; i++) {
        value += amplitude * noise(st);
        st *= 2.;
        amplitude *= .5;
    }
    return value;
}
`;

const dunesVertexShader = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uSize;
varying vec3 vPosition;
${noiseGLSL}
void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 newModelPosition = modelPosition;

    newModelPosition.y += abs(uAmp * fbm(position.xz + uTime/20.0));

    vec4 viewPosition = viewMatrix * newModelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;
    gl_PointSize = uSize;
    vPosition = newModelPosition.xyz;
}
`;

const dunesFragmentShader = /* glsl */ `
uniform float uTime;
varying vec3 vPosition;
${noiseGLSL}
void main() {
    vec2 p = vPosition.xz / 4.0;
    float s = fbm(p + uTime * -0.03);
    float r = fbm(s + p + uTime * 0.1);
    vec3 color = vec3(0.0);
    color += fbm(p + r + uTime/10.0);
    color.r += s;
    color.g += r;
    color += 0.1;

    gl_FragColor = vec4(color,1.0);
}
`;

const gridVertexShader = /* glsl */ `
varying vec3 vPosition;
void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    vPosition = position;
}
`;

const gridFragmentShader = /* glsl */ `
varying vec3 vPosition;
void main() {
    vec3 color = vec3(0.0);
    float thickness = 0.01;
    float opacity = smoothstep(1.0-thickness ,1.0,(vPosition.x - thickness/2.0) - floor(vPosition.x-thickness/2.0));
    opacity += smoothstep(1.0-thickness ,1.0,(vPosition.y - thickness/2.0) - floor(vPosition.y-thickness/2.0));
    opacity = opacity/2.0;
    opacity = step(0.01,opacity);
    opacity = opacity/4.0;
    gl_FragColor = vec4(color,opacity);
}
`;

const scene = new THREE.Scene();
scene.background = new THREE.Color('white');

// translucent grid floor
const floorPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.ShaderMaterial({
    vertexShader: gridVertexShader,
    fragmentShader: gridFragmentShader,
    transparent: true,
  })
);
floorPlane.rotation.x -= Math.PI / 2;
scene.add(floorPlane);

// dune points
const SPAN = 7; // original grid span, scaled 0.5 => 3.5 world units
const dunesMaterial = new THREE.ShaderMaterial({
  vertexShader: dunesVertexShader,
  fragmentShader: dunesFragmentShader,
  uniforms: {
    uTime: { value: 0.0 },
    uAmp: { value: 0.3 },
    uSize: { value: 5.0 * Math.min(devicePixelRatio, 2) },
  },
  depthWrite: false,
  transparent: true,
  alphaTest: 0.5,
});

let particles = null;

function buildPoints() {
  if (particles) {
    scene.remove(particles);
    particles.geometry.dispose();
  }
  const res = params.resolution;
  const step = SPAN / res;
  const positions = new Float32Array(res * res * 3);
  let k = 0;
  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      positions[k++] = i * step;
      positions[k++] = 0;
      positions[k++] = j * step;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles = new THREE.Points(geometry, dunesMaterial);
  particles.scale.setScalar(0.5);
  scene.add(particles);
}

const camera = new THREE.PerspectiveCamera(
  60,
  innerWidth / innerHeight,
  0.1,
  100
);
camera.position.set(-1.4, 2.4, 5.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(SPAN / 4, 0.2, SPAN / 4);

const controlsEl = document.getElementById('controls');
Standard.param(controlsEl, params, {
  id: 'amplitude',
  label: 'amplitude',
  min: 0,
  max: 2,
  step: 0.05,
  value: 0.3,
  fmt: (v) => v.toFixed(2),
  apply: (v) => {
    dunesMaterial.uniforms.uAmp.value = v;
  },
});
Standard.param(controlsEl, params, {
  id: 'drift',
  label: 'drift speed',
  min: 0,
  max: 5,
  step: 0.05,
  value: 1,
  fmt: (v) => v.toFixed(2),
});
Standard.param(controlsEl, params, {
  id: 'pointSize',
  label: 'point size',
  min: 1,
  max: 15,
  step: 0.5,
  value: 5,
  fmt: (v) => v.toFixed(1),
  apply: (v) => {
    dunesMaterial.uniforms.uSize.value = v * Math.min(devicePixelRatio, 2);
  },
});
Standard.param(controlsEl, params, {
  id: 'resolution',
  label: 'resolution',
  min: 40,
  max: 220,
  step: 10,
  value: 140,
  fmt: (v) => `${v}×${v}`,
  apply: (v) => {
    params.resolution = v;
    buildPoints();
  },
});

buildPoints();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let shaderTime = 0;

renderer.setAnimationLoop(() => {
  shaderTime += clock.getDelta() * params.drift;
  dunesMaterial.uniforms.uTime.value = shaderTime;
  controls.update();
  renderer.render(scene, camera);
});
