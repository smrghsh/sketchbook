// weave — the old samir.tech homepage sketch.
// 40 MeshLine ribbons arranged radially around Z, each displaced in a custom
// vertex shader by the nested-sine waveform
//   y = a·sin(b·x + c·sin(d·x − e) + f)
// Ported from webpack + three 0.137 to plain modules + three 0.174.
import * as THREE from "three";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// port note: three 0.137 had no color management and a linear output
// encoding — keep that pipeline so the ribbons stay their original coral
// (must be set before any THREE.Color is created)
THREE.ColorManagement.enabled = false;

// Custom MeshLine vertex shader (the original modMeshLine/vertex.glsl —
// meshline's line expansion with the waveform displacement spliced in).
const modMeshLineVertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
#include <fog_pars_vertex>


attribute vec3 previous;
attribute vec3 next;
attribute float side;
attribute float width;
attribute float counters;

uniform vec2 resolution;
uniform float lineWidth;
uniform vec3 color;
uniform float opacity;
uniform float sizeAttenuation;

//custom uniforms
uniform float uTime;
uniform float speed;
uniform float offset;
uniform float amplitude;
uniform float b;
uniform float c;
uniform float d;
uniform float e;
uniform float f;

varying vec2 vUV;
varying vec4 vColor;
varying float vCounters;
varying vec3 vP;
vec2 fix(vec4 i, float aspect) {
    vec2 res = i.xy / i.w;
    res.x *= aspect;
    vCounters = counters;
    return res;
}

void main() {
    float aspect = resolution.x / resolution.y;
    vColor = vec4(color, opacity);
    vUV = uv;

    mat4 m = projectionMatrix * modelViewMatrix;



    vec3 p = vec3(position);
    vP = p;
    float o = PI *offset;
    o += uTime;
    // p.z += o;
    float a = amplitude * cos( p.z) ;
    float x =(p.z * speed +o);
    p.y += a * sin(b * x + c * sin(d * x - e) + f );
    p.x += a * cos(b * x + c * sin(d * x - e) * p.z/10.0);
    //modying position here
    vec4 finalPosition = m * vec4(p, 1.0);
    vec4 prevPos = m * vec4(previous, 1.0);
    vec4 nextPos = m * vec4(next, 1.0);

    vec2 currentP = fix(finalPosition, aspect);
    vec2 prevP = fix(prevPos, aspect);
    vec2 nextP = fix(nextPos, aspect);

    float w = lineWidth * width;

    vec2 dir;
    if (nextP == currentP) dir = normalize(currentP - prevP);
    else if (prevP == currentP) dir = normalize(nextP - currentP);
    else {
    vec2 dir1 = normalize(currentP - prevP);
    vec2 dir2 = normalize(nextP - currentP);
    dir = normalize(dir1 + dir2);

    vec2 perp = vec2(-dir1.y, dir1.x);
    vec2 miter = vec2(-dir.y, dir.x);
    //w = clamp(w / dot(miter, perp), 0., 4. * lineWidth * width);
    }

    //vec2 normal = (cross(vec3(dir, 0.), vec3(0., 0., 1.))).xy;
    vec4 normal = vec4(-dir.y, dir.x, 0., 1.);
    normal.xy *= .5 * w;
    //normal *= projectionMatrix;
    if (sizeAttenuation == 0.) {
    normal.xy *= finalPosition.w;
    normal.xy /= (vec4(resolution, 0., 1.) * projectionMatrix).xy;
    }

    finalPosition.xy += normal.xy * side;
    gl_Position = finalPosition;
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    #include <fog_vertex>
}
`;

// The original modMeshLine/fragment.glsl. One port note: three 0.174 renamed
// <encodings_fragment> to <colorspace_fragment>.
const modMeshLineFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  uniform sampler2D map;
  uniform sampler2D alphaMap;
  uniform float useMap;
  uniform float useAlphaMap;
  uniform float useDash;
  uniform float dashArray;
  uniform float dashOffset;
  uniform float dashRatio;
  uniform float visibility;
  uniform float alphaTest;
  uniform vec2 repeat;

  varying vec2 vUV;
  varying vec4 vColor;
  varying float vCounters;
  varying vec3 vP;
  uniform float uTime;

  void main() {
    #include <logdepthbuf_fragment>
    vec4 c = vColor;
    c.r = sin(vP.z);
    c.a = 0.7;
    if (useMap == 1.) c *= texture2D(map, vUV * repeat);
    if (useAlphaMap == 1.) c.a *= texture2D(alphaMap, vUV * repeat).a;
    if (c.a < alphaTest) discard;
    if (useDash == 1.) {
      c.a *= ceil(mod(vCounters + dashOffset, dashArray) - (dashArray * dashRatio));
    }
    gl_FragColor = c;
    gl_FragColor.a *= step(vCounters, visibility);
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

//Palette
const backgroundColor = new THREE.Color("beige");

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

// Scene
const scene = new THREE.Scene();
scene.background = backgroundColor;

/**
 * Camera — samir likes these numbers
 */
const camera = new THREE.PerspectiveCamera(
  35,
  sizes.width / sizes.height,
  0.1,
  120
);
camera.position.set(-1.526809290138386, 2.933433136629435, 2.2502940751091676);
camera.rotation.set(
  -0.9164283978958037,
  -0.3916373693287119,
  -0.46170863682209606
);
scene.add(camera);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/** weave */

/**
 * Parameterization — slider defaults from the original page
 */
const params = {
  a: 1.0,
  b: 0.8,
  c: 2.0,
  d: 1.2,
  e: 2.5,
  f: 5.5,
  speed: 1.0,
};

const lineLength = 8;
const points = [];
for (let i = -lineLength; i < lineLength; i += 0.01) {
  points.push(new THREE.Vector3(0, 0, i));
}
const geometry = new MeshLineGeometry();
// ribbon width tapers with sin(p)/5
geometry.setPoints(points, (p) => Math.sin(p) / 5);

const material = new MeshLineMaterial({
  side: THREE.DoubleSide,
  color: new THREE.Color(0.8, 0.1, 0.3),
});
// custom uniforms live directly on the ShaderMaterial, so the sliders can
// reach them before/after first compile alike
material.uniforms.uTime = { value: 0.0 };
material.uniforms.offset = { value: 0.0 };
material.uniforms.speed = { value: 1.0 };
material.uniforms.amplitude = { value: params.a };
material.uniforms.b = { value: params.b };
material.uniforms.c = { value: params.c };
material.uniforms.d = { value: params.d };
material.uniforms.e = { value: params.e };
material.uniforms.f = { value: params.f }; //offset
//https://stackoverflow.com/questions/59548828/how-to-give-vertex-shader-to-a-geometry-without-changing-the-material-in-threejs
material.onBeforeCompile = function (info) {
  info.vertexShader = modMeshLineVertexShader;
  info.fragmentShader = modMeshLineFragmentShader;
};

for (let i = 0; i < 2 * Math.PI; i += (2 * Math.PI) / 40) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.y += Math.PI / 2;
  mesh.rotation.z = i;
  mesh.position.y += Math.random() * 0.1;
  mesh.position.z += Math.random() * 0.1;
  mesh.position.x += Math.random() * 0.1;
  scene.add(mesh);
}

// Window resizing
window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// sliders — y = a·sin(b·x + c·sin(d·x − e) + f)
const controlsEl = document.getElementById("controls");
const fmt = (v) => v.toFixed(2);
Standard.param(controlsEl, params, {
  id: "a", label: "a", min: 0, max: 2, step: 0.01, value: params.a, fmt,
  apply: (v) => (material.uniforms.amplitude.value = v),
});
Standard.param(controlsEl, params, {
  id: "b", label: "b", min: 0, max: 4, step: 0.01, value: params.b, fmt,
  apply: (v) => (material.uniforms.b.value = v),
});
Standard.param(controlsEl, params, {
  id: "c", label: "c", min: 0, max: 4, step: 0.01, value: params.c, fmt,
  apply: (v) => (material.uniforms.c.value = v),
});
Standard.param(controlsEl, params, {
  id: "d", label: "d", min: 0, max: 4, step: 0.01, value: params.d, fmt,
  apply: (v) => (material.uniforms.d.value = v),
});
Standard.param(controlsEl, params, {
  id: "e", label: "e", min: 0, max: 5, step: 0.01, value: params.e, fmt,
  apply: (v) => (material.uniforms.e.value = v),
});
Standard.param(controlsEl, params, {
  id: "f", label: "f", min: 0, max: 10, step: 0.01, value: params.f, fmt,
  apply: (v) => (material.uniforms.f.value = v),
});
Standard.param(controlsEl, params, {
  id: "speed", label: "speed", min: 0, max: 3, step: 0.01, value: params.speed, fmt,
  apply: (v) => (params.speed = v),
});

/**
 * Animate
 */
const clock = new THREE.Clock();
let t = 0;
renderer.setAnimationLoop(() => {
  t += clock.getDelta() * params.speed;
  material.uniforms.uTime.value = t;
  controls.update();
  renderer.render(scene, camera);
});
