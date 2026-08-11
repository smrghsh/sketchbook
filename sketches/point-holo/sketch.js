// point holo — a human brain, downloading. The visbrain point cloud
// rains down into shape as uDownload ramps; falling points stretch
// into vertical streaks against a champagne ground.
// Ported from a 2021 webpack/three@0.126 project ("got it to download").
// visbrain.js is loaded as a classic script before this module, exactly
// like the original; `brainpoints` is its global. Original GLSL
// comments preserved; gl_PointSize gained a uSize uniform.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Original vertex shader (src/shaders/hologram/vertex.glsl).
const hologramVertexShader = /* glsl */ `

attribute float center;

uniform float uDownload;
uniform float uSize;

varying vec4 vTest;
varying float vDepth;
varying float vCD;
varying vec2 vUv;
varying float vDistFromTargetY;


float random (in vec2 st) {
    return fract(sin(dot(st.xy,
    vec2(12.9898,78.233)))*
    43758.5453123);
}


void main() {

    vec3 alteredPosition = vec3(position);
    float initPosition = random(position.xz) * 20.0;
    alteredPosition.y += (1.0 *initPosition - clamp(uDownload,0.0,1.0 *initPosition ));
    // TODO make download motion

    vec4 modelPosition = modelMatrix * vec4(alteredPosition, 1.0);

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_PointSize = uSize;
    gl_Position = projectedPosition;
    vUv = uv;
    vCD = center/2.0;
    // vCD = 1.0;
    vTest =  vec4(position,1.0) ;
    vDepth = 1.0 -  (viewPosition.z - alteredPosition.z);
    vDistFromTargetY = abs(alteredPosition.y - position.y);
    //varying
    // vFog = distance(vec2(0.0,0.0),modelPosition.xz);
    // vFog = 1.0 - vFog;
    // vElevation = elevation / uBigWavesElevation;

}
`;

// Original fragment shader (src/shaders/hologram/fragment.glsl).
const hologramFragmentShader = /* glsl */ `

uniform float uDownload;

varying vec4 vTest;
varying float vDepth;
varying float vCD;
varying float vDistFromTargetY;

float circle(in vec2 _st, in float _radius){
    vec2 dist = _st-vec2(0.5);
	return 1.-smoothstep(_radius-(_radius*0.01),
                         _radius+(_radius*0.01),
                         dot(dist,dist)*4.0);
}
float vertLine(in vec2 _st, in float _width){
    float l = 0.5 - _width/2.0;
    float r = 0.5 + _width/2.0;
    return step(_st.x,l) - (1.0 - step(_st.x, r));
}


void main(){
    vec2 st = gl_PointCoord.xy;
    // vec3 color = clamp(vTest.xyz, vec3(0.2), vec3(1));
    //
    vec3 color = mix(vec3(1.0),vTest.xyz,(1.0-vDistFromTargetY));
    color.b += 1.0 - ((vTest.x + vTest.y + vTest.z)/3.0);
    // color *= ( circle(st,0.9));
    color *= mix(circle(st,0.8),vertLine(st,0.01),1.0-vDistFromTargetY);
    // vec3 color = vec3( circle(st,0.9));
    // color += .25;


    // gl_FragColor = vec4(color,(1.0 - vDepth / 2.5));
    gl_FragColor = vec4(color,vCD*(1.0-vDistFromTargetY)+0.55);
    // gl_FragColor = vec4(color, 1.0);

}
`;

const params = {
  speed: 2,
  size: 3,
};

// make brainpoints 1/80 the size — `brainpoints` comes from visbrain.js
let shrunkBrainpoints = new Float32Array(brainpoints.length);
for (var i = 0; i < shrunkBrainpoints.length; i++) {
  shrunkBrainpoints[i] = brainpoints[i] / 80;
}
let slicedbp = [];
for (var i = 0; i < shrunkBrainpoints.length; i += 3) {
  slicedbp.push([
    shrunkBrainpoints[i],
    shrunkBrainpoints[i + 1],
    shrunkBrainpoints[i + 2],
  ]);
}

function dist(arr) {
  return Math.sqrt(arr[0] * arr[0] + arr[1] * arr[1] + arr[2] * arr[2]);
}

// sorts by distance from center
slicedbp.sort((a, b) => {
  return dist(a) - dist(b);
});

let centerDist = new Float32Array(brainpoints.length / 3);
for (var i = 0; i < centerDist.length; i++) {
  centerDist[i] = dist(slicedbp[i]);
}

slicedbp = slicedbp.flat();
shrunkBrainpoints = new Float32Array(slicedbp);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7e7ce);

const hologramGeometry = new THREE.BufferGeometry();
hologramGeometry.setAttribute('center', new THREE.BufferAttribute(centerDist, 1));
hologramGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(shrunkBrainpoints, 3)
);

const hologramMaterial = new THREE.ShaderMaterial({
  vertexShader: hologramVertexShader,
  fragmentShader: hologramFragmentShader,
  uniforms: {
    uDownload: { value: 0.0 },
    uSize: { value: params.size },
  },
  depthWrite: false,
  transparent: true,
  alphaTest: 0.5,
});

hologramGeometry.rotateX((Math.PI * 3) / 2);
hologramGeometry.rotateY(Math.PI);
hologramGeometry.translate(0, 0, 0.2);
hologramGeometry.rotateY(-1.3);

const hologram = new THREE.Points(hologramGeometry, hologramMaterial);
scene.add(hologram);

// Base camera
const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.1,
  100
);
camera.position.set(0, 0.15, -2.5);
camera.lookAt(0, 0.15, 0);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Controls (commented out in the original — enabled here)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.15, 0);

// Chrome
Standard.bind(params, 'speed', (v) => v.toFixed(1), (v) => (params.speed = v));
Standard.bind(params, 'size', (v) => v.toFixed(1), (v) => {
  hologramMaterial.uniforms.uSize.value = v;
});
document.getElementById('redownload').addEventListener('click', () => {
  downloadTime = 0;
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Original tick drove uDownload = elapsedTime * 2 — the ramp rate is
// the download speed param, and re-download resets the ramp.
const clock = new THREE.Clock();
let downloadTime = 0;
renderer.setAnimationLoop(() => {
  downloadTime += clock.getDelta() * params.speed;
  hologramMaterial.uniforms.uDownload.value = downloadTime;
  controls.update();
  renderer.render(scene, camera);
});
