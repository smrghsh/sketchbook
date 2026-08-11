// eye of god — port of smrghsh/spectra-experiment ("eye of god visualization")
// the viewer sits inside a radius-90 sphere painted by a 4D simplex
// fragment shader: five chained snoise evaluations, per-channel phase
// offsets (0.99 / 1.00 / 1.01 by default) → slow iridescent marbled plasma.
// VRButton, axes helper, and the commented mic-spectrogram code dropped;
// OrbitControls kept for a slow look-around.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {
  scale: 0.005, // noise scale (original: const float scale = 0.005)
  drift: 1.0, // time rate multiplier
  spread: 0.01, // per-channel phase offset (r: 1−s, g: 1, b: 1+s)
};

const vertexShader = /* glsl */ `
varying vec3 vPosition;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;
    vPosition = position;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uSpread;
varying vec3 vPosition;

vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }

float mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }

vec4 permute(vec4 x) { return mod289(((x*34.0)+10.0)*x); }

float permute(float x) { return mod289(((x*34.0)+10.0)*x); }

vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }

vec4 grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p,s;

  p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;

  return p;
}

#define F4 0.309016994374947451

float snoise(vec4 v) {
  const vec4  C = vec4( 0.138196601125011,  // (5 - sqrt(5))/20  G4
                        0.276393202250021,  // 2 * G4
                        0.414589803375032,  // 3 * G4
                       -0.447213595499958); // -1 + 4 * G4

  vec4 i  = floor(v + dot(v, vec4(F4)) );
  vec4 x0 = v -   i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step( x0.yzw, x0.xxx );
  vec3 isYZ = step( x0.zww, x0.yyz );
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp( i0, 0.0, 1.0 );
  vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
  vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;
  i = mod289(i);
  float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute( permute( permute( permute (
             i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
           + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
           + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
           + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));
  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;
  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));
  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
               + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;
}

void main()
{
  float nTime = uTime;
  float V1 = snoise(1.2+(cos(0.25*nTime))*0.05* vec4(vPosition * uScale * 20.0, sin(nTime)));
  float V2 = snoise(sin(0.05*nTime)*0.77*vec4(vec3(V1*round(V1)), 1.0));
  float V3 = snoise(sin(0.1*nTime)*20.*vec4(vec3(V2), 1.0));
  float V4 = snoise(sin(0.5*nTime)*2.2*vec4(V3, V2, V2, V3));
  V4 = max(0.1, min(1.0, (V4*V4)*0.1+0.3));
  float V5 = snoise(vec4(V4, V3, V2, V1));
  float r = snoise(vec4(V5, V5, V5, sin((1.0 - uSpread)*nTime)));
  float g = snoise(vec4(V5, V5, V5, sin(nTime)));
  float b = snoise(vec4(V5, V5, V5, sin((1.0 + uSpread)*nTime)));
  vec4 color4 = vec4(V5, V5, V5, 1.0);
  vec4 color5 = vec4(r, g, b, 1.0);
  vec4 color = color5*0.5 + color4*0.5;
  gl_FragColor = color;
}
`;

// ---- scene ----

const scene = new THREE.Scene();

const skyMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0.0 },
    uScale: { value: params.scale },
    uSpread: { value: params.spread },
  },
  side: THREE.DoubleSide,
});
const skydome = new THREE.Mesh(new THREE.SphereGeometry(90, 64, 32), skyMaterial);
scene.add(skydome);

// ---- camera / renderer / controls ----

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(-5, 3, 3);
camera.lookAt(0, 0, 0);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.15;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- controls chrome ----

const controlsEl = document.getElementById('controls');
Standard.param(controlsEl, params, {
  id: 'scale',
  label: 'noise scale',
  min: 0.001,
  max: 0.02,
  step: 0.0005,
  value: params.scale,
  fmt: (v) => v.toFixed(4),
  apply: (v) => {
    params.scale = v;
    skyMaterial.uniforms.uScale.value = v;
  },
});
Standard.param(controlsEl, params, {
  id: 'drift',
  label: 'drift speed',
  min: 0,
  max: 4,
  step: 0.05,
  value: params.drift,
  fmt: (v) => v.toFixed(2),
});
Standard.param(controlsEl, params, {
  id: 'spread',
  label: 'phase spread',
  min: 0,
  max: 0.1,
  step: 0.001,
  value: params.spread,
  fmt: (v) => v.toFixed(3),
  apply: (v) => {
    params.spread = v;
    skyMaterial.uniforms.uSpread.value = v;
  },
});

// ---- animate ----
// time accumulates so the drift slider never pops the phase
// (original: nTime = uTime * 0.5)

const clock = new THREE.Clock();
let nTime = 0;

renderer.setAnimationLoop(() => {
  nTime += clock.getDelta() * 0.5 * params.drift;
  skyMaterial.uniforms.uTime.value = nTime;
  controls.update();
  renderer.render(scene, camera);
});
