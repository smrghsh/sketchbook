/* breath garden — 2021 WebXR meditation scene, ported from the
   breath-garden webpack project (three 0.126, src/script.js + glsl).
   A shader-displaced desert ground (solid + wireframe overlay), a
   30,000-point particle river breathing on a 4-4-8 inhale/hold/exhale
   cycle, and a generative accretion tree of toon spheres.
   Desktop port: VRButton dropped, OrbitControls kept, GLSL inlined. */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ------------------------------------------------------------------ */
/* shaders                                                             */
/* ------------------------------------------------------------------ */

const perlin3 = /* glsl */ `
// Classic Perlin 3D Noise by Stefan Gustavson
vec4 permute(vec4 x)
{
    return mod(((x*34.0)+1.0)*x, 289.0);
}
vec4 taylorInvSqrt(vec4 r)
{
    return 1.79284291400159 - 0.85373472095314 * r;
}
vec3 fade(vec3 t)
{
    return t*t*t*(t*(t*6.0-15.0)+10.0);
}

float cnoise(vec3 P)
{
    vec3 Pi0 = floor(P);
    vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
}
`;

const desertGroundVertexShader = /* glsl */ `
uniform float uTime;
uniform float uBigWavesElevation;
uniform vec2 uBigWavesFrequency;
uniform float uSmallWavesElevation;
uniform float uSmallWavesFrequency;
uniform float uSmallWavesSpeed;
uniform float uSmallIterations;
uniform float uFogRadius;
uniform float uFogDropoff;
uniform float uRiverOffset;
uniform float uRiverWidth;
varying float vElevation;
varying float vFog;

${perlin3}

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    float elevation = 0.0;
    vec3 artifactEradicator = clamp(modelPosition.xyz,vec3(0.3),vec3(999999.9));
    elevation += clamp(cnoise(artifactEradicator.xyz / (0.2 + artifactEradicator.xyz)),0.48,1.0);

    // carve the river bed
    float center = cnoise(modelPosition.xyz/7.0) + uRiverOffset;
    float width = uRiverWidth;
    float falloff = 2.0;
    float leftBank = center - (width/2.0);
    float rightBank = center +(width/2.0);
    float river = smoothstep(leftBank - (0.3 * cnoise(modelPosition.xyz)),leftBank+falloff,modelPosition.x);
    river -= smoothstep(rightBank-falloff, rightBank + (0.3 * cnoise(modelPosition.xyz)),modelPosition.x);

    elevation -= river;
    for(float i = 1.0; i <= uSmallIterations; i++)
    {
        elevation -= abs(cnoise(vec3(modelPosition.xz * uSmallWavesFrequency * i, uTime * uSmallWavesSpeed)) * uSmallWavesElevation / i);
    }

    modelPosition.y += elevation;
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;

    vFog = uFogRadius - distance(vec2(0.0,0.0),modelPosition.xz);
    vElevation = elevation / uBigWavesElevation;
}
`;

const desertGroundFragmentShader = /* glsl */ `
uniform vec3 uDepthColor;
uniform vec3 uSurfaceColor;
uniform float uColorOffset;
uniform float uColorMultiplier;

varying float vElevation;
varying float vFog;
void main(){
    float mixStrength = vElevation * uColorMultiplier + uColorOffset;
    vec3 color = mix(uDepthColor,uSurfaceColor,mixStrength);
    gl_FragColor = vec4(color,vFog * clamp(vElevation,0.0,1.0));
}
`;

const riverVertexShader = /* glsl */ `
attribute float mass;

uniform float uTime;
uniform float uInhale;
uniform float uInhaleMax;
uniform float uExhale;
uniform float uExhaleMax;
uniform float uHold;
uniform float uHoldMax;

varying float vMass;
varying vec2 vCircleSpace;
varying float vDepth;

void main() {
    vMass = mass;

    // breath: points swell on the inhale, keep through the hold,
    // and settle back down over the exhale
    float inhaleT = clamp(uInhale,0.0,uInhaleMax)/uInhaleMax;
    float exhaleT = clamp(uExhale,0.0,uExhaleMax)/uExhaleMax;
    float breath = 0.75 + 0.5 * inhaleT * (1.0 - exhaleT);

    float speed = 0.2;
    vec3 modifiedPosition = position;
    modifiedPosition.x = (modifiedPosition.x + uTime * mass * speed) - (floor(modifiedPosition.x + uTime * mass * speed));
    vec4 modelPosition = modelMatrix * vec4(modifiedPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_PointSize = 15.0 * (1.0 - mass) * breath;
    gl_Position = projectedPosition;
    vCircleSpace = position.xy;
    vDepth = position.z;
}
`;

const riverFragmentShader = /* glsl */ `
varying float vMass;
varying vec2 vCircleSpace;
varying float vDepth;
uniform float uTime;
float uColorChange; //between 0 and 1

float map(float value, float min1, float max1, float min2, float max2) {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

float circle(in vec2 _st, in float _radius){
    vec2 dist = _st-vec2(0.5);
    return 1.-smoothstep(_radius-(_radius*0.01),
                         _radius+(_radius*0.01),
                         dot(dist,dist)*4.0);
}

float slashA(in vec2 _st, in float _y, in float _bump){
    return step(_st.y,map(_st.x,0.0,1.0,_y,_y+_bump) );
}

// Quilez's 2D simplex noise https://www.shadertoy.com/view/Msf3WH
// tiling fixed with help from Mike Bostock's domain-warping sketch
// and the book of shaders chapter on noise
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

void main(){
    vec2 st = vCircleSpace/9.0;
    vec3 color = vec3(0.0);
    vec2 p = st*3.;

    float circleRadius = 0.40;

    // river flow strength
    p.x += uTime * 0.001;
    // undercurrent relative velocity
    float t1 = uTime * -0.05;
    // river relative velocity
    float t2 = uTime * 0.001;
    // pollution relative velocity
    float t3 = uTime * 0.1;
    vec2 q = p + t1;
    float s = fbm(p + t3);
    float r = fbm(p + t2 + s);
    color += fbm(q + r);
    color += 0.25;
    color.r +=  s + 0.08;
    // note that r here isn't red, it's river as modulated by undercurrent
    color.b += r + 0.2;
    color.b = clamp(color.b,0.1,0.5);
    // pollution as opposite of undercurrent color
    color.g += s/1.5;
    color.r += 1.0;
    color.g += 0.2 * slashA(st, 0.8,0.2);
    color += circle(vCircleSpace, 0.8) - circle(vCircleSpace, 0.77);
    color *= circle(vCircleSpace, 0.8) * step(st.y,0.75);

    uColorChange = sin(uTime*0.5);
    vec3 color2 = vec3(0.3);
    color2 += fbm(q + r);
    color2 += 0.25;
    color2.r +=  s + 0.18;
    color2.b += r + 0.5;
    color2.g += s/2.5;
    gl_FragColor = vec4(mix(color,color2,uColorChange),vMass *  2.1 + .05 );
}
`;

/* ------------------------------------------------------------------ */
/* scene                                                               */
/* ------------------------------------------------------------------ */

const params = {
  inhale: 4,
  hold: 4,
  exhale: 8,
  riverWidth: 4,
  points: 30000,
};

const scene = new THREE.Scene();

scene.add(new THREE.AmbientLight(0xffffff));
scene.add(new THREE.HemisphereLight(0xff0000, 0x0000ff, 0.8));

// terrain parameters
const terrainFog = 10;
const riverOffset = 4.0;

function groundUniforms(surfaceColor) {
  return {
    uTime: { value: 0.0 },
    uBigWavesSpeed: { value: 0.5 },
    uBigWavesElevation: { value: 0.12 },
    uBigWavesFrequency: { value: new THREE.Vector2(2, 2) },
    uDepthColor: { value: new THREE.Color('#000000') },
    uSurfaceColor: { value: new THREE.Color(surfaceColor) },
    uColorOffset: { value: 0.2 },
    uColorMultiplier: { value: 0.25 },
    uSmallWavesElevation: { value: 0.05 },
    uSmallWavesFrequency: { value: 3 },
    uSmallWavesSpeed: { value: 0.2 },
    uSmallIterations: { value: 4 },
    uFogRadius: { value: terrainFog },
    uFogDropoff: { value: 10.0 },
    uRiverOffset: { value: riverOffset },
    uRiverWidth: { value: params.riverWidth },
  };
}

// terrain (two meshes: solid + wireframe overlay)
const desertGroundGeometry = new THREE.PlaneGeometry(50, 50, 256, 256);
const desertGroundMaterial = new THREE.ShaderMaterial({
  vertexShader: desertGroundVertexShader,
  fragmentShader: desertGroundFragmentShader,
  uniforms: groundUniforms('#111111'),
  side: THREE.DoubleSide,
  transparent: true,
});
const desertOverlayMaterial = new THREE.ShaderMaterial({
  vertexShader: desertGroundVertexShader,
  fragmentShader: desertGroundFragmentShader,
  uniforms: groundUniforms('grey'),
  transparent: true,
  wireframe: true,
});
const desertGround = new THREE.Mesh(desertGroundGeometry, desertGroundMaterial);
desertGround.rotation.x += Math.PI * 1.5;
const desertOverlay = new THREE.Mesh(desertGroundGeometry, desertOverlayMaterial);
desertOverlay.rotation.x += Math.PI * 1.5;
desertOverlay.position.y += 0.1;
scene.add(desertOverlay);
scene.add(desertGround);

// river
function buildRiverGeometry(quantityPoints) {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(quantityPoints * 3);
  for (let i = 0; i < position.length; i++) position[i] = Math.random();
  const mass = new Float32Array(quantityPoints);
  for (let i = 0; i < mass.length; i++) mass[i] = Math.random();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('mass', new THREE.BufferAttribute(mass, 1));
  return geometry;
}

const invisisphereMaterial = new THREE.ShaderMaterial({
  vertexShader: riverVertexShader,
  fragmentShader: riverFragmentShader,
  uniforms: {
    uTime: { value: 0.0 },
    uInhale: { value: 0.0 },
    uInhaleMax: { value: params.inhale },
    uExhale: { value: 0.0 },
    uExhaleMax: { value: params.exhale },
    uHold: { value: 0.0 },
    uHoldMax: { value: params.hold },
  },
  depthWrite: true,
  depthTest: true,
  transparent: true,
  alphaTest: 0.5,
});
const river = new THREE.Points(buildRiverGeometry(params.points), invisisphereMaterial);
river.rotation.y += Math.PI / 2;
river.position.y -= 1;
river.position.z += terrainFog;
river.scale.x += terrainFog * 2;

function applyRiverWidth(w) {
  desertGroundMaterial.uniforms.uRiverWidth.value = w;
  desertOverlayMaterial.uniforms.uRiverWidth.value = w;
  river.position.x = riverOffset - w / 2;
  river.scale.z = 1 + w;
}
applyRiverWidth(params.riverWidth);
scene.add(river);

/* accretion tree of toon spheres ----------------------------------- */

const maxSize = 0.1;
const segments = 8;
let spheres = [];
function brand() {
  return 2 * (Math.random() - 0.5);
}
// growth parameters
const stages = [
  { name: 'trunk', sizeDistribution: [0.9, 1.3], minHeight: 0, maxHeight: 11, maxRadius: 0.8, count: 10 },
  { name: 'stageA', sizeDistribution: [0.4, 0.8], minHeight: 10, maxHeight: 15, maxRadius: 8, count: 400 },
  { name: 'stageB', sizeDistribution: [0.3, 0.7], minHeight: 12, maxHeight: 20, maxRadius: 9, count: 600 },
  { name: 'stageC', sizeDistribution: [0.1, 0.4], minHeight: 13, maxHeight: 20, maxRadius: 10, count: 1500 },
];

function mapRange(value, low1, high1, low2, high2) {
  return low2 + ((high2 - low2) * (value - low1)) / (high1 - low1);
}

const treeGroup = new THREE.Group();
const initialSphereGeometry = new THREE.SphereGeometry(maxSize, segments, segments);
const woodMaterial = new THREE.MeshToonMaterial({ color: 0xbf784e });
const initialSphere = new THREE.Mesh(initialSphereGeometry, woodMaterial);
spheres.push(initialSphere);
treeGroup.add(initialSphere);

const funMaterials = [];
for (let i = 0; i < 1000; i++) {
  funMaterials.push(new THREE.MeshToonMaterial({ color: Math.random() * 0xffffff }));
}

function addASphere(sizeDistribution, minHeight, maxHeight, maxRadius) {
  const y = mapRange(Math.random(), 0, 1, minHeight, maxHeight);
  const nInitPos = new THREE.Vector3(brand() * maxRadius, y, brand() * maxRadius);
  const nScale = mapRange(Math.random(), 0, 1, sizeDistribution[0], sizeDistribution[1]);

  // accrete onto the nearest existing sphere
  let nearestSphere = spheres[0];
  for (let i = 0; i < spheres.length; i++) {
    if (nInitPos.distanceTo(spheres[i].position) < nInitPos.distanceTo(nearestSphere.position)) {
      nearestSphere = spheres[i];
    }
  }
  const nPos = nInitPos
    .sub(nearestSphere.position)
    .normalize()
    .multiplyScalar(maxSize * nScale + maxSize * nearestSphere.scale.x);
  const funMaterial = funMaterials[Math.floor(Math.random() * funMaterials.length)];
  const nSphere = new THREE.Mesh(initialSphereGeometry, funMaterial);
  nSphere.scale.set(nScale, nScale, nScale);
  const temp = new THREE.Vector3().copy(nearestSphere.position);
  temp.add(nPos);
  nSphere.position.add(temp);
  spheres.push(nSphere);
  treeGroup.add(nSphere);
}

for (const stage of stages) {
  let sphereCounter = 0;
  while (sphereCounter <= stage.count) {
    for (let i = 0; i < 30; i++) {
      addASphere(stage.sizeDistribution, stage.minHeight, stage.maxHeight, stage.maxRadius);
      sphereCounter++;
    }
  }
}
scene.add(treeGroup);

/* ------------------------------------------------------------------ */
/* camera / renderer                                                   */
/* ------------------------------------------------------------------ */

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 100);
camera.position.x = -5;
camera.position.y = 3.0;
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ------------------------------------------------------------------ */
/* controls                                                            */
/* ------------------------------------------------------------------ */

const seconds = (v) => v.toFixed(v % 1 ? 1 : 0) + 's';
Standard.bind(params, 'inhale', seconds, (v) => {
  params.inhale = v;
  invisisphereMaterial.uniforms.uInhaleMax.value = v;
});
Standard.bind(params, 'hold', seconds, (v) => {
  params.hold = v;
  invisisphereMaterial.uniforms.uHoldMax.value = v;
});
Standard.bind(params, 'exhale', seconds, (v) => {
  params.exhale = v;
  invisisphereMaterial.uniforms.uExhaleMax.value = v;
});
Standard.bind(params, 'riverWidth', (v) => v.toFixed(1), (v) => {
  params.riverWidth = v;
  applyRiverWidth(v);
});
Standard.bind(params, 'points', (v) => v.toFixed(0), (v) => {
  params.points = Math.round(v);
  river.geometry.dispose();
  river.geometry = buildRiverGeometry(params.points);
});

/* ------------------------------------------------------------------ */
/* breath cycle + loop                                                 */
/* ------------------------------------------------------------------ */

const hintEl = document.getElementById('hint');
let breathPhase = 'inhale';
let phaseT = 0;
let shownPhase = '';

function updateBreath(dt) {
  const u = invisisphereMaterial.uniforms;
  phaseT += dt;
  if (breathPhase === 'inhale') {
    u.uInhale.value = phaseT;
    if (phaseT >= params.inhale) {
      u.uInhale.value = params.inhale;
      phaseT = 0;
      breathPhase = 'hold';
    }
  } else if (breathPhase === 'hold') {
    u.uHold.value = phaseT;
    if (phaseT >= params.hold) {
      phaseT = 0;
      breathPhase = 'exhale';
    }
  } else {
    u.uExhale.value = phaseT;
    if (phaseT >= params.exhale) {
      u.uInhale.value = 0;
      u.uHold.value = 0;
      u.uExhale.value = 0;
      phaseT = 0;
      breathPhase = 'inhale';
    }
  }
  if (breathPhase !== shownPhase) {
    shownPhase = breathPhase;
    hintEl.innerHTML = breathPhase + '&hellip; &middot; drag to orbit';
  }
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  invisisphereMaterial.uniforms.uTime.value += dt;
  updateBreath(dt);
  controls.update();
  renderer.render(scene, camera);
});
