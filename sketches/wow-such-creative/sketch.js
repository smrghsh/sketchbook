// wow such creative — ported from the 2021 webpack/three@0.126 original
// (once the landing page at samir.tech). A 4 x 24 x 24 lattice of shader
// cubes seen through an extreme-FOV camera (FOV 10000 from x = -20) becomes
// a warped tunnel; cubes bloom/collapse via smoothstep x sin, colored by an
// IQ cosine palette with alpha inverse to scale. The impossible lens IS the
// piece — do not "fix" the FOV.
import * as THREE from 'three';

const params = { speed: 1, depth: 24 };

// Palette — colors passed raw (NoColorSpace) so the shader sees the same
// sRGB values the 0.126 original fed it.
function rawColor(hex) {
  return new THREE.Color().setHex(hex, THREE.NoColorSpace);
}
const palettes = {
  // the shipped palette
  tide: [0xd95f69, 0x89c2d9, 0x04d9c4, 0x88e8f2],
  // the warm alternate that was commented out in the source
  dusk: [0xf3feb0, 0xfea443, 0x705e78, 0x812f33],
};
let paletteName = 'tide';

const panelVertexShader = /* glsl */ `
uniform float uTime;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 color4;
uniform float uW;
uniform float uD;
uniform float uH;
uniform float uDepthQuantity;
uniform float uHeightQuantity;
varying vec2 vUv;
varying vec3 vVariance;
void main() {
    vec3 modifiedPos = vec3(position);
    float scalar = 1.0;
    scalar *= smoothstep(uDepthQuantity/2.0,0.0,abs(uDepthQuantity/2.0 -uD));
    scalar *= smoothstep(uHeightQuantity/2.0,0.0,abs(uHeightQuantity/2.0 -uH));
    scalar *= sin(uTime + uW/4.0);

    modifiedPos *= scalar;
    modifiedPos *= 1.0 - scalar;
    vec4 modelPosition = modelMatrix * vec4(modifiedPos, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    vUv = uv;
    vVariance = vec3(scalar);
    gl_Position = projectedPosition;
}
`;

const panelFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 color4;
varying vec2 vUv;
varying vec3 vVariance;


vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}




void main() {
    vec2 st = vUv;

    vec3 color = palette(15.0+ 2.0 * sin(vVariance.x*10.0),color1,color2,color3,color4);

    gl_FragColor = vec4(color,(1.0 - vVariance.x / 2.0));
}
`;

// Scene
const scene = new THREE.Scene();
scene.background = rawColor(0x000000);

const heightQuantity = 24;
const widthQuantity = 4;

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
let cubes = [];

function build() {
  for (const cube of cubes) {
    scene.remove(cube);
    cube.material.dispose();
  }
  cubes = [];
  const depthQuantity = params.depth;
  const colors = palettes[paletteName];
  for (let d = 0; d < depthQuantity; d++) {
    for (let h = 0; h < heightQuantity; h++) {
      for (let w = 0; w < widthQuantity; w++) {
        const m = new THREE.ShaderMaterial({
          vertexShader: panelVertexShader,
          fragmentShader: panelFragmentShader,
          uniforms: {
            uTime: { value: 0.0 },
            uD: { value: d },
            uH: { value: h },
            uW: { value: w },
            uDepthQuantity: { value: depthQuantity },
            uHeightQuantity: { value: heightQuantity },
            uWidthQuantity: { value: widthQuantity },
            color1: { value: rawColor(colors[0]) },
            color2: { value: rawColor(colors[1]) },
            color3: { value: rawColor(colors[2]) },
            color4: { value: rawColor(colors[3]) },
          },
          transparent: true,
        });

        const cube = new THREE.Mesh(cubeGeometry, m);
        cubes.push(cube);
        scene.add(cube);
        cube.position.set(w, h, d);
      }
    }
  }
  // re-center the fixed camera on the lattice
  camera.position.set(trackPosition, heightQuantity / 2, depthQuantity / 2);
  camera.lookAt(trackPosition + 1, heightQuantity / 2, depthQuantity / 2);
}

/**
 * Camera — FOV 10000: the extreme lens is the piece, keep it.
 */
const camera = new THREE.PerspectiveCamera(10000, innerWidth / innerHeight, 0.1, 1000);
const trackPosition = -20;
scene.add(camera);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

build();

// Window resizing
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

// UI
Standard.bind(params, 'speed', (v) => v.toFixed(1), (v) => (params.speed = v));
Standard.bind(params, 'depth', (v) => v.toFixed(0), (v) => {
  params.depth = v;
  build();
});
document.getElementById('palette').addEventListener('change', (e) => {
  paletteName = e.target.value;
  const colors = palettes[paletteName];
  for (const cube of cubes) {
    cube.material.uniforms.color1.value = rawColor(colors[0]);
    cube.material.uniforms.color2.value = rawColor(colors[1]);
    cube.material.uniforms.color3.value = rawColor(colors[2]);
    cube.material.uniforms.color4.value = rawColor(colors[3]);
  }
});

/**
 * Animate — the original jumped the clock ahead by 58s; keep its phase.
 */
const clock = new THREE.Clock();
let accumulated = 58;
renderer.setAnimationLoop(() => {
  accumulated += clock.getDelta() * params.speed;
  const uTime = accumulated / 10.0 + 15.0;
  for (const cube of cubes) {
    cube.material.uniforms.uTime.value = uTime;
  }
  renderer.render(scene, camera);
});
