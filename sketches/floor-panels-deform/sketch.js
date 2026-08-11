// floor panels deform — ported from the 2021 webpack/three@0.126 original
// ("joshdream": a landscape from a dream). A grid of planes and spheres share
// one shader: a sine/cos wave vertex displacement plus an fbm fragment washed
// warm — a desert/sunset swell on white. VRButton dropped for the port;
// uAmplitude is a port addition so the wave can be dialed.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = { rows: 20, spacing: 0.2, amplitude: 1, spheres: 0.4 };

const joshdreamVertexShader = /* glsl */ `
uniform float uTime;
uniform float uXRows;
uniform float uYRows;
uniform float uSpacing;
uniform float uAmplitude;

varying vec3 vPosition;

#define PI 3.1415926538

float map(float value, float min1, float max1, float min2, float max2) {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

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

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    //new code
    vec4 p = modelPosition;
    float t = uTime;
    p.y += uAmplitude * 2.0 * sin(t + p.x * 2.0 * PI/ uXRows);
    p.y += uAmplitude * 0.5 * cos(t + p.z * 2.0 * PI/ uYRows);
    vec3 center = vec3(uXRows/2.0,p.y,uYRows/2.0);
    p.z -= uAmplitude * 0.5 * sin(-0.5 * t + p.x * 2.0 * PI/ uXRows);
    p.x += uAmplitude * 0.5 * cos(0.5 * t + p.z * 2.0 * PI/ uYRows);


    vec4 viewPosition = viewMatrix * p;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;
    gl_PointSize = 3.0;
    vPosition = p.xyz;
}
`;

const joshdreamFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uXRows;
uniform float uYRows;
varying vec3 vPosition;

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

void main() {
    vec2 st = vPosition.xz/50.0;
    vec3 color = vec3(0.0);
    // determines size

    vec2 p = st*3.;

    float circleRadius = 0.40;
    float circleWidth = 0.01;
    float rbDiff = 0.40;
    float circleBrightnessBump = 0.05;


    // // river flow strength
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
    // so this is where is ressembles the canonical quilez technique
    color += fbm(q + r);
    // bump up brightness a smidgen
    color += 0.25;
    color.r +=  s + 0.08;
    // note that r here isn't red, it's river as modulated by undercurrent
    color.b += r + 0.2;
    color.b = clamp(color.b,0.1,0.5);
    // pollution as opposite of undercurrent color (couldnt use q without more operations)
    color.g += s/1.5;
    color.r += 1.0;
    color.g += 0.2 * 1.0;

    gl_FragColor = vec4(color,1.0);
}
`;

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('white');

const planeGeometry = new THREE.PlaneGeometry();
const sphereGeometry = new THREE.SphereGeometry();
const joshdreamMaterial = new THREE.ShaderMaterial({
  vertexShader: joshdreamVertexShader,
  fragmentShader: joshdreamFragmentShader,
  uniforms: {
    uTime: { value: 0.0 },
    uXRows: { value: params.rows },
    uYRows: { value: params.rows },
    uSpacing: { value: params.spacing },
    uAmplitude: { value: params.amplitude },
  },
  depthWrite: false,
  transparent: true,
  alphaTest: 0.5,
  side: THREE.DoubleSide,
});

let panels = [];

function place(p) {
  p.position.set(
    p.userData.xRow * (1 + params.spacing),
    0,
    p.userData.zRow * (1 + params.spacing)
  );
}

function gridCenter() {
  return ((params.rows - 1) * (1 + params.spacing)) / 2;
}

function build() {
  for (const p of panels) scene.remove(p);
  panels = [];
  joshdreamMaterial.uniforms.uXRows.value = params.rows;
  joshdreamMaterial.uniforms.uYRows.value = params.rows;
  for (let xRow = 0; xRow < params.rows; xRow++) {
    for (let zRow = 0; zRow < params.rows; zRow++) {
      const p = new THREE.Mesh(
        Math.random() < params.spheres ? sphereGeometry : planeGeometry,
        joshdreamMaterial
      );
      p.rotation.x -= Math.PI / 2;
      p.userData = { xRow, zRow };
      place(p);
      panels.push(p);
      scene.add(p);
    }
  }
  const c = gridCenter();
  controls.target.set(c, 0, c);
}

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 800);
camera.position.set(30, 20, 0);
scene.add(camera);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

build();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

// UI
Standard.bind(params, 'rows', (v) => v.toFixed(0), (v) => {
  params.rows = v;
  build();
});
Standard.bind(params, 'spacing', (v) => v.toFixed(2), (v) => {
  params.spacing = v;
  joshdreamMaterial.uniforms.uSpacing.value = v;
  for (const p of panels) place(p);
  const c = gridCenter();
  controls.target.set(c, 0, c);
});
Standard.bind(params, 'amplitude', (v) => v.toFixed(1), (v) => {
  params.amplitude = v;
  joshdreamMaterial.uniforms.uAmplitude.value = v;
});
Standard.bind(params, 'spheres', (v) => v.toFixed(2), (v) => {
  params.spheres = v;
  build();
});

/**
 * Animate
 */
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  controls.update();
  joshdreamMaterial.uniforms.uTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
});
