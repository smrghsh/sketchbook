// butterflies — ~100 GPU-flapped butterfly quads drifting in a boundary
// volume, plus one "sentient" butterfly: when the cursor goes still it flies
// to the cursor's world position and lands, wings closing as it settles.
// Ported standalone from the butterfly repo (WebXR hand-landing adapted to
// the mouse); sprite + flap technique after Miziziziz.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---- shaders (inlined from src/shaders/Butterfly/) ------------------------

const butterflyVertexShader = /* glsl */ `
#define PI     3.14159265
#define TWO_PI 6.28318530

uniform float uTime;
varying vec3 vP;
varying vec2 vUv;
attribute float displacement;
varying float d;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
    vUv = uv;
    d = displacement;
    vec3 p = vec3(position);
    // flap: fold the wing halves up and down around the body axis
    p.z += 1.4 * abs(p.x) * sin((uTime)*100.*(1.0 + 0.5*rand(vec2(d,0.))) - displacement);
    vec4 modelPosition = modelMatrix * vec4(p, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    vP = position;
    gl_Position = projectedPosition;
}
`;

const sentientVertexShader = /* glsl */ `
#define PI     3.14159265
#define TWO_PI 6.28318530

uniform float uTime;
varying vec3 vP;
varying vec2 vUv;
attribute float displacement;
uniform float stillness;
varying float d;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
    vUv = uv;
    d = displacement;
    vec3 p = vec3(position);
    float flutterPosition = p.y;
    flutterPosition += 1.4 * abs(p.x) * sin((uTime)*100.*(1.0 + 0.5*rand(vec2(d,0.))) - displacement);
    // as stillness rises the flutter freezes into folded-up wings
    p.y = mix(flutterPosition, 1.4*abs(p.x), stillness);
    vec4 modelPosition = modelMatrix * vec4(p, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    vP = position;
    gl_Position = projectedPosition;
}
`;

const butterflyFragmentShader = /* glsl */ `
varying vec3 vP;
varying vec2 vUv;
uniform sampler2D texture1;
uniform float uTime;
varying float d;

void main() {
    vec4 texColor = texture2D(texture1, vUv);
    if ( texColor.a < 0.5 ) discard;
    gl_FragColor = vec4(texColor.rgb, texColor.a );
}
`;

// ---- js-side hash matching the shader's rand() ----------------------------

function fract(x) {
  return x - Math.floor(x);
}
function rand2(co) {
  return fract(Math.sin(co[0] * 12.9898 + co[1] * 78.233) * 43758.5453);
}

// ---- scene ----------------------------------------------------------------

const BG = 0x060907;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(BG);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(BG, 5, 14);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0.4, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxDistance = 12;

const params = {
  quantity: 100,
  boundary: 3,
  flapSpeed: 1,
};

const butterflyTexture = new THREE.TextureLoader().load('butterfly.png');
butterflyTexture.colorSpace = THREE.SRGBColorSpace;

// ---- the flock ------------------------------------------------------------

const baseGeometry = new THREE.PlaneGeometry(1, 1, 2, 1);

const flockMaterial = new THREE.ShaderMaterial({
  vertexShader: butterflyVertexShader,
  fragmentShader: butterflyFragmentShader,
  transparent: true,
  side: THREE.DoubleSide,
  uniforms: {
    uTime: { value: 0.0 },
    texture1: { value: butterflyTexture },
  },
});

const butterflies = new THREE.Group();
scene.add(butterflies);

function populate() {
  for (let i = 0; i < params.quantity; i++) {
    const geometry = baseGeometry.clone();
    const displacement = new Float32Array(geometry.attributes.position.count);
    displacement.fill(i);
    geometry.setAttribute(
      'displacement',
      new THREE.BufferAttribute(displacement, 1)
    );

    const butterfly = new THREE.Mesh(geometry, flockMaterial);
    butterfly.scale.set(0.2, 0.2, 0.2);
    butterfly.rotation.x = -Math.PI * 0.5;
    butterfly.rotation.y = Math.random() * Math.PI * 0.1;
    butterfly.rotation.z = Math.random() * Math.PI;
    butterfly.position.set(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5
    );
    butterflies.add(butterfly);
  }
}

function depopulate() {
  while (butterflies.children.length) {
    const child = butterflies.children[butterflies.children.length - 1];
    if (child.geometry) child.geometry.dispose();
    butterflies.remove(child); // material is shared; keep it
  }
}
populate();

// ---- the sentient butterfly ----------------------------------------------

const sentientGeometry = baseGeometry.clone();
sentientGeometry.rotateX(-Math.PI * 0.5);
{
  const displacement = new Float32Array(
    sentientGeometry.attributes.position.count
  );
  displacement.fill(0);
  sentientGeometry.setAttribute(
    'displacement',
    new THREE.BufferAttribute(displacement, 1)
  );
}

const sentientMaterial = new THREE.ShaderMaterial({
  vertexShader: sentientVertexShader,
  fragmentShader: butterflyFragmentShader,
  transparent: true,
  side: THREE.DoubleSide,
  uniforms: {
    uTime: { value: 0.0 },
    texture1: { value: butterflyTexture },
    stillness: { value: 1.0 },
  },
});

const sentient = new THREE.Mesh(sentientGeometry, sentientMaterial);
sentient.scale.set(0.085, 0.085, 0.085);
sentient.visible = false;
scene.add(sentient);

// ---- mouse + stillness timer ---------------------------------------------
// when the cursor holds still for a few seconds the sentient butterfly
// appears just off-target and glides in to land on the cursor ray point

const mouse = new THREE.Vector2(0, 0);
const lastMouse = new THREE.Vector2(0, 0);
let lastMoveTime = performance.now();
let isStill = false;
let skittish = true;
const raycaster = new THREE.Raycaster();

window.addEventListener('mousemove', (event) => {
  const newX = (event.clientX / window.innerWidth) * 2 - 1;
  const newY = -(event.clientY / window.innerHeight) * 2 + 1;
  if (
    Math.abs(newX - lastMouse.x) > 0.01 ||
    Math.abs(newY - lastMouse.y) > 0.01
  ) {
    mouse.set(newX, newY);
    lastMouse.set(newX, newY);
    lastMoveTime = performance.now();
    if (isStill) {
      isStill = false;
      // startled: the sentient butterfly takes off
      sentient.visible = false;
      skittish = true;
    }
  }
});

setInterval(() => {
  if (performance.now() - lastMoveTime > 3000 && !isStill) {
    isStill = true;
    sentient.visible = true;
    skittish = false;
    // appear a little above and beside where it will land
    raycaster.setFromCamera(mouse, camera);
    const departure = new THREE.Vector3();
    raycaster.ray.at(4, departure);
    departure.y += 0.5;
    departure.x += 0.5;
    sentient.position.copy(departure);
  }
}, 100);

function updateSentient() {
  raycaster.setFromCamera(mouse, camera);
  if (skittish) return;

  const landingTarget = new THREE.Vector3();
  raycaster.ray.at(4, landingTarget);

  const butterflyDirection = new THREE.Vector3();
  butterflyDirection.subVectors(landingTarget, camera.position);
  butterflyDirection.normalize();
  butterflyDirection.crossVectors(butterflyDirection, camera.up);
  butterflyDirection.normalize();

  sentient.lookAt(
    landingTarget.x + butterflyDirection.x,
    landingTarget.y + butterflyDirection.y,
    landingTarget.z + butterflyDirection.z
  );

  // glide a hundredth of the way there each frame
  const step = new THREE.Vector3();
  step.subVectors(landingTarget, sentient.position);
  step.multiplyScalar(0.01);
  sentient.position.add(step);

  // stillness eases in as it approaches: 1 landed, 0 a unit away
  const distance = sentient.position.distanceTo(landingTarget);
  if (distance >= 1.0) {
    sentientMaterial.uniforms.stillness.value = 0.0;
  } else if (distance <= 0.01) {
    sentientMaterial.uniforms.stillness.value = 1.0;
  } else {
    const t = (distance - 0.01) / (1.0 - 0.01);
    sentientMaterial.uniforms.stillness.value = 1.0 - t;
  }
}

// ---- chrome ---------------------------------------------------------------

const ui = {};
const paramsContainer = document.getElementById('params');

Standard.param(paramsContainer, ui, {
  id: 'quantity',
  label: 'quantity',
  min: 0,
  max: 2000,
  step: 10,
  value: params.quantity,
  fmt: (v) => String(v),
  apply: (v) => {
    params.quantity = Math.round(v);
    depopulate();
    populate();
  },
});

Standard.param(paramsContainer, ui, {
  id: 'boundary',
  label: 'boundary',
  min: 1,
  max: 8,
  step: 0.1,
  value: params.boundary,
  fmt: (v) => v.toFixed(1),
  apply: (v) => (params.boundary = v),
});

Standard.param(paramsContainer, ui, {
  id: 'flap-speed',
  label: 'flap speed',
  min: 0.1,
  max: 3,
  step: 0.05,
  value: params.flapSpeed,
  fmt: (v) => v.toFixed(2),
  apply: (v) => (params.flapSpeed = v),
});

// ---- loop -----------------------------------------------------------------

const clock = new THREE.Clock();
let flapTime = 0;
const driftAxis = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  flapTime += dt * 0.2 * params.flapSpeed;
  flockMaterial.uniforms.uTime.value = flapTime;
  sentientMaterial.uniforms.uTime.value = flapTime;

  // drift each butterfly along its own facing, wrapping at the boundary
  const b = params.boundary;
  for (const butterfly of butterflies.children) {
    driftAxis.set(0, 1, 0);
    driftAxis.applyQuaternion(butterfly.quaternion);
    driftAxis.normalize();
    const speed =
      0.001 *
      (0.5 +
        1.0 * rand2([butterfly.geometry.attributes.displacement.array[0], 0]));
    butterfly.position.add(driftAxis.multiplyScalar(speed));

    if (butterfly.position.x > b) butterfly.position.x = -b;
    if (butterfly.position.x < -b) butterfly.position.x = b;
    if (butterfly.position.y > b) butterfly.position.y = -b;
    if (butterfly.position.y < -b) butterfly.position.y = b;
    if (butterfly.position.z > b) butterfly.position.z = -b;
    if (butterfly.position.z < -b) butterfly.position.z = b;
  }

  updateSentient();

  controls.update();
  renderer.render(scene, camera);
});

// ---- resize ---------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
