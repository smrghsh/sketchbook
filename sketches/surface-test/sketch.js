// surface test — a million points trade places between two random clouds,
// and two photographs reconstitute out of the noise ("it became a meme").
// Ported from a 2021 webpack/three@0.126 project (the 1M-point morph
// version of src/script.js). Original GLSL comments preserved; the
// unused rainbow-palette path in the fragment shader is exposed as a
// mode select via uMode.
import * as THREE from 'three';

// Original vertex shader (src/shaders/invisisphere/vertex.glsl).
// gl_PointSize gained a uSize multiplier.
const invisisphereVertexShader = /* glsl */ `

attribute float mass;
attribute vec3 newPosition;

uniform float uTime;
uniform float uSize;
varying float vMass;
varying float vMorph;
varying float vD;
varying float vC;
varying vec3 vP;
uniform sampler2D uImage;
uniform sampler2D uImage2;

float speed = 0.2;

void main() {
    // position.x += uTime;
    vMass = mass;

    vMorph = 0.5 + sin(uTime)/2.0;
    vec3 modifiedPosition = mix(position,newPosition,vMorph);
    // modifiedPosition.x = (modifiedPosition.x - uTime * mass * speed) - (floor(modifiedPosition.x - uTime * mass * speed));
        // modifiedPosition.x = (modifiedPosition.x - uTime * mass * speed);
    // modifiedPosition.x += uTime;
    vec4 modelPosition = modelMatrix * vec4(modifiedPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_PointSize = uSize * 10.0 * (1.0 - mass);
    vP = modifiedPosition.xyz;
    vP.x = 1.0 - vP.x;
    // gl_PointSize = sin(uTime) * vMass * 10.0;
    vD = distance(newPosition,position);
    vC = distance(modifiedPosition,vec3(0.5));
    gl_Position = projectedPosition;

}
`;

// Original fragment shader (src/shaders/invisisphere/fragment.glsl).
// The commented-out palette mix is now reachable through uMode.
const invisisphereFragmentShader = /* glsl */ `
varying float vMass;
varying float vMorph;
varying float vD;
varying float vC;
varying vec3 vP;
uniform float uTime;
uniform float uMode;
uniform sampler2D uImage;
uniform sampler2D uImage2;



//  Function from Iñigo Quiles
//  www.iquilezles.org/www/articles/functions/functions.htm



float cubicPulse( float c, float w, float x ){
    x = abs(x - c);
    if( x>w ) return 0.0;
    x /= w;
    return 1.0 - x*x*(3.0-2.0*x);
}

// cosine based palette, 4 vec3 params
vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

void main(){

    // gl_FragColor = vec4(color,0.5 + 2.0 * vMass - vDepth * 0.5);
    float spritz = clamp(cubicPulse(0.8,0.9,vMorph) +  cubicPulse(0.1,0.2,vMorph), 0.0,1.0);
    spritz = vC;
    float px = vMorph + vD + + vC + vMass;
    vec3 rainbow = palette(px,vec3(0.5,0.5,0.5),vec3(0.4,0.4,0.4),vec3(1.0,1.0,1.0),vec3(0.10,0.3,0.5));
    vec3 other = palette(px,vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.10,0.20) );

    vec3 imgA = texture(uImage,vP.xy).rgb;
     vec3 imgB = texture(uImage2,vP.xy).rgb;

    vec3 paletteColor = mix(other,rainbow,vMorph);
        vec3 imageColor = mix(imgA,imgB,vMorph);
        // color = imgA;
    vec3 color = mix(imageColor,paletteColor,uMode);

    gl_FragColor = vec4(color,vC);

}
`;

const params = {
  points: 1000000,
  speed: 1,
  size: 1,
};

const backgroundColor = new THREE.Color('white');

const loader = new THREE.TextureLoader();
const texture = loader.load('one.png');
const texture2 = loader.load('two.png');

const scene = new THREE.Scene();
scene.background = backgroundColor;

const invisisphereMaterial = new THREE.ShaderMaterial({
  vertexShader: invisisphereVertexShader,
  fragmentShader: invisisphereFragmentShader,
  uniforms: {
    uTime: { value: 0.0 },
    uSize: { value: params.size },
    uMode: { value: 0.0 },
    uImage: { value: texture },
    uImage2: { value: texture2 },
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
  const quantityPoints = params.points;
  const particlesGeometry = new THREE.BufferGeometry();
  const position = new Float32Array(quantityPoints * 3);
  const newPosition = new Float32Array(quantityPoints * 3);
  for (let i = 0; i < position.length; i++) {
    position[i] = Math.random();
    newPosition[i] = Math.random();
  }
  const mass = new Float32Array(quantityPoints);
  for (let i = 0; i < mass.length; i++) mass[i] = Math.random();
  particlesGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(position, 3)
  );
  particlesGeometry.setAttribute(
    'newPosition',
    new THREE.BufferAttribute(newPosition, 3)
  );
  particlesGeometry.setAttribute('mass', new THREE.BufferAttribute(mass, 1));
  particles = new THREE.Points(particlesGeometry, invisisphereMaterial);
  scene.add(particles);
}
buildPoints();

// Base camera — inside the unit cube of points, looking through it.
const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.1,
  10.0
);
camera.position.x = 0.5;
camera.position.y = 0.5;
camera.position.z = 0.05;
camera.lookAt(0.5, 0.5, 1);
scene.add(camera);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Controls
document.getElementById('mode').addEventListener('change', (e) => {
  invisisphereMaterial.uniforms.uMode.value =
    e.target.value === 'rainbow' ? 1.0 : 0.0;
});
Standard.bind(params, 'points', (v) => Math.round(v / 1000) + 'k', (v) => {
  params.points = Math.round(v);
  buildPoints();
});
Standard.bind(params, 'speed', (v) => v.toFixed(2), (v) => (params.speed = v));
Standard.bind(params, 'size', (v) => v.toFixed(1), (v) => {
  invisisphereMaterial.uniforms.uSize.value = v;
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let morphTime = 0;
renderer.setAnimationLoop(() => {
  morphTime += clock.getDelta() * params.speed;
  invisisphereMaterial.uniforms.uTime.value = morphTime;
  renderer.render(scene, camera);
});
