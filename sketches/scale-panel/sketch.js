// scale panel — a wall of cubes breathing in and out of existence.
// Ported from a 2021 webpack/three@0.126 project ("v1 finished, so is v2,
// this is a good generator"). One instanced draw replaces the original's
// 9,800 per-cube ShaderMaterials; the per-cube uW/uH/uD uniforms became
// the instanced attribute aCell. Original GLSL comments preserved.
import * as THREE from 'three';

// Original vertex shader (src/shaders/panel/vertex.glsl). v2 used
// cos(uTime + uW/4.0), v1 used sin — unified as sin(... + uPhase),
// with uPhase = PI/2 recovering the cosine.
const panelVertexShader = /* glsl */ `
uniform float uTime;
uniform float uPhase;
uniform float uDepthQuantity;
uniform float uHeightQuantity;
attribute vec3 aCell; // (w, h, d) grid cell — was per-cube uW/uH/uD uniforms
varying vec2 vUv;
varying vec3 vVariance;
void main() {
    vec3 modifiedPos = vec3(position);
    float uW = aCell.x;
    float uH = aCell.y;
    float uD = aCell.z;
    float scalar = 1.0;
    scalar *= smoothstep(uDepthQuantity/2.0,0.0,abs(uDepthQuantity/2.0 -uD));
    scalar *= smoothstep(uHeightQuantity/2.0,0.0,abs(uHeightQuantity/2.0 -uH));
    scalar *= sin(uTime + uW/4.0 + uPhase);

    // modifiedPos *= smoothstep(uDepthQuantity/2.0,0.0,abs(uDepthQuantity/2.0 -uD));
    // modifiedPos *= smoothstep(uHeightQuantity/2.0,0.0,abs(uHeightQuantity/2.0 -uH));
    // modifiedPos *= sin(uTime + uW/4.0);
    modifiedPos *= scalar;
    // gl_PointSize = 3.;
    modifiedPos *= 1.0 - scalar;
    // modifiedPos *= 1.0 -  sin(dist());
    // cube sits at its grid cell (was cube.position via modelMatrix)
    vec4 modelPosition = modelMatrix * vec4(modifiedPos + aCell, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    vUv = uv;
    vVariance = vec3(scalar);
    // vVariance = vec3(scalar);
    gl_Position = projectedPosition;
    // gl_Position = vec4(position,1.0);
}
`;

// Original fragment shader (src/shaders/panel/fragment.glsl) — verbatim.
const panelFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 color4;
varying vec2 vUv;
varying vec3 vVariance;
// uniform vec3 color1;


vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}




void main() {
    vec2 st = vUv;

    // vec3 color = palette(uTime+vVariance.x*10.0,color1,color2,color3,color4);
        vec3 color = palette(15.0+ 2.0 * sin(vVariance.x*10.0),color1,color2,color3,color4);
    // color = color1;

    gl_FragColor = vec4(color,(1.0 - vVariance.x / 2.0));
}
`;

// Palettes — v2 ("breathe", white ground) and v1 ("pinch", black ground),
// straight from script.js / v1.js.
const variants = {
  breathe: {
    background: new THREE.Color(0xffffff),
    colors: [0x000000, 0x00ff00, 0x00f0f0, 0x591202],
    phase: Math.PI / 2, // v2's cos wave
    light: true,
  },
  pinch: {
    background: new THREE.Color(0x000000),
    colors: [0xd95f69, 0x89c2d9, 0x04d9c4, 0x88e8f2],
    phase: 0, // v1's sin wave
    light: false,
  },
};

const params = {
  variant: 'breathe',
  speed: 1,
  depth: 35,
  height: 35,
};
const widthQuantity = 8;

const scene = new THREE.Scene();

// Base camera — the absurd FOV is the piece's signature perspective.
const camera = new THREE.PerspectiveCamera(
  100000,
  innerWidth / innerHeight,
  0.1,
  1000
);
const trackPosition = -20;
function placeCamera() {
  camera.position.set(trackPosition, params.height / 2, params.depth / 2);
  camera.lookAt(trackPosition + 1, params.height / 2, params.depth / 2);
}
placeCamera();
scene.add(camera);

const material = new THREE.ShaderMaterial({
  vertexShader: panelVertexShader,
  fragmentShader: panelFragmentShader,
  uniforms: {
    uTime: { value: 0.0 },
    uPhase: { value: variants.breathe.phase },
    uDepthQuantity: { value: params.depth },
    uHeightQuantity: { value: params.height },
    color1: { value: new THREE.Color() },
    color2: { value: new THREE.Color() },
    color3: { value: new THREE.Color() },
    color4: { value: new THREE.Color() },
  },
  transparent: true,
});

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
let wall = null;

function buildWall() {
  if (wall) {
    scene.remove(wall);
    wall.geometry.dispose();
  }
  const depthQuantity = params.depth;
  const heightQuantity = params.height;
  const count = depthQuantity * heightQuantity * widthQuantity;
  const cells = new Float32Array(count * 3);
  let p = 0;
  for (let d = 0; d < depthQuantity; d++) {
    for (let h = 0; h < heightQuantity; h++) {
      for (let w = 0; w < widthQuantity; w++) {
        cells[p++] = w;
        cells[p++] = h;
        cells[p++] = d;
      }
    }
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = cubeGeometry.index;
  geometry.attributes.position = cubeGeometry.attributes.position;
  geometry.attributes.uv = cubeGeometry.attributes.uv;
  geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 3));
  geometry.instanceCount = count;
  material.uniforms.uDepthQuantity.value = depthQuantity;
  material.uniforms.uHeightQuantity.value = heightQuantity;
  wall = new THREE.Mesh(geometry, material);
  wall.frustumCulled = false; // extreme FOV defeats bounding-sphere culling
  scene.add(wall);
  placeCamera();
}

function applyVariant() {
  const v = variants[params.variant];
  scene.background = v.background;
  material.uniforms.uPhase.value = v.phase;
  material.uniforms.color1.value.setHex(v.colors[0]);
  material.uniforms.color2.value.setHex(v.colors[1]);
  material.uniforms.color3.value.setHex(v.colors[2]);
  material.uniforms.color4.value.setHex(v.colors[3]);
  document.body.classList.toggle('standard-light', v.light);
}

buildWall();
applyVariant();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Controls
document.getElementById('variant').addEventListener('change', (e) => {
  params.variant = e.target.value;
  applyVariant();
});
Standard.bind(params, 'speed', (v) => v.toFixed(1), (v) => (params.speed = v));
Standard.bind(params, 'depth', (v) => String(v), (v) => {
  params.depth = Math.round(v);
  buildWall();
});
Standard.bind(params, 'height', (v) => String(v), (v) => {
  params.height = Math.round(v);
  buildWall();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Original tick: uTime = (elapsed + 55)/10 + 15 — start mid-breath.
const clock = new THREE.Clock();
let waveTime = 55;
renderer.setAnimationLoop(() => {
  waveTime += clock.getDelta() * params.speed;
  material.uniforms.uTime.value = waveTime / 10.0 + 15.0;
  renderer.render(scene, camera);
});
