// ─── diwali on the styx ────────────────────────────────────────────────────
// Domain-warped fbm river of light and pollution. The original ran the
// fragment shader below on a fullscreen quad through a vendored old
// three.min.js; here it's the same GLSL (comments and all) on a raw
// WebGL fullscreen triangle, with the "stillness" variant's mouse-calming
// smoothstep merged in behind a u_stillness fader (0 = plain flow).

'use strict';

const VERT = `
//    oh I can't wait to mess around with this!
attribute vec4 position;
void main() {
    gl_Position = position;
}
`;

const FRAG = `
#ifdef GL_ES
precision mediump float;
#endif
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_zoom;       // determines size (original hard-coded st*3.)
uniform float u_pollution;  // pollution rate multiplier
uniform float u_stillness;  // 0 = original flow, 1 = full stillness variant
// book of shaders random from fbm chapter
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
    vec2 st = gl_FragCoord.xy/u_resolution.xy;

    float aspect = u_resolution.x/u_resolution.y;
    st.x *= aspect;
    vec3 color = vec3(0.0);
    // https://stackoverflow.com/questions/55850554/how-can-i-pass-the-mouse-positions-from-js-to-shader-through-a-uniform
    // why tf the window height and canvas resolution are different, idk
    vec2 m = u_mouse.xy;
    m.y = 1. - m.y;
    m.x *= aspect;
    // stillness variant: reduce turbulence around mouse location;
    // u_stillness fades the effect in (1.0 everywhere when it's 0)
    float turbulence = mix(1.0, smoothstep(0.,.4,distance(m,st)), u_stillness);

    // determines size
    vec2 p = st*u_zoom;
    // river flow strength
    p.x += u_time * 0.01 * turbulence;
    // quilez does fbm( p + fbm(p)), which he notates as fbm(q + r), using q and r to modulate color
    // fully expanded, I'm doing fbm(p + fbm(p + fbm(p))), so additional nesting r = fbm(p + s)
    // I add terms to set the d/dt of q,r,s
    // The undercurrent is s, it has the greatest effect on the whole simulation at the core
    // its d/dt, t3, is set to be opposite t1, which affects the pollution.
    // these are nested functions so the order magnitude needs to be different
    // t2 modulates the rivers velocity, here it's slightly against the river flow strength, almost 0
    // originally t values had an additional trig term, but alas performance

    // undercurrent relative velocity
    float t1 = u_time * -0.05;
    // river relative velocity
    float t2 = u_time * 0.01;
    // pollution relative velocity
    float t3 = u_time * 0.1 * u_pollution;
    vec2 q = p + t1;
    float s = fbm(p + t3);
    float r = fbm(p + t2 + s) * turbulence;
    // so this is where is ressembles the canonical quilez technique
    color += fbm(q + r);
    // bump up brightness a smidgen (stillness glows where the water calms)
    color += 0.15 + u_stillness*(1.- turbulence)/3.;
    color.r +=  s + 0.05;
    // note that r here isn't red, it's river as modulated by undercurrent
    color.b += r + 0.3;
    // pollution as opposite of undercurrent color (couldnt use q without more operations)
    color.g += s/2.5;
    gl_FragColor = vec4(color,1.0);
}
`;

// ─── setup ─────────────────────────────────────────────────────────────────

const params = {};

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh));
  }
  return sh;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
  throw new Error(gl.getProgramInfoLog(prog));
}
gl.useProgram(prog);

// one big triangle covering the screen (the fullscreen-quad trick)
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, 3, -1, -1, 3]),
  gl.STATIC_DRAW
);
const posLoc = gl.getAttribLocation(prog, 'position');
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

const U = {
  resolution: gl.getUniformLocation(prog, 'u_resolution'),
  mouse: gl.getUniformLocation(prog, 'u_mouse'),
  time: gl.getUniformLocation(prog, 'u_time'),
  zoom: gl.getUniformLocation(prog, 'u_zoom'),
  pollution: gl.getUniformLocation(prog, 'u_pollution'),
  stillness: gl.getUniformLocation(prog, 'u_stillness'),
};

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// mouse in 0..1 window coordinates, as in the stillness variant
let mouseX = 0.5;
let mouseY = 0.5;
window.addEventListener('pointermove', (e) => {
  mouseX = e.clientX / innerWidth;
  mouseY = e.clientY / innerHeight;
});

// ─── chrome ────────────────────────────────────────────────────────────────

const controls = document.getElementById('controls');
Standard.param(controls, params, {
  id: 'flow', label: 'flow speed', min: 0, max: 3, step: 0.05, value: 1,
  fmt: (v) => v.toFixed(2) + 'x',
});
Standard.param(controls, params, {
  id: 'zoom', label: 'zoom', min: 0.5, max: 8, step: 0.1, value: 3,
  fmt: (v) => v.toFixed(1),
});
Standard.param(controls, params, {
  id: 'pollution', label: 'pollution rate', min: 0, max: 3, step: 0.05, value: 1,
  fmt: (v) => v.toFixed(2) + 'x',
});
Standard.param(controls, params, {
  id: 'stillness', label: 'stillness', min: 0, max: 1, step: 0.01, value: 0,
  fmt: (v) => v.toFixed(2),
});

// ─── render loop ───────────────────────────────────────────────────────────
// the original stepped u_time by 0.05 per frame; flow speed scales that

let time = 1.0;
function frame() {
  time += 0.05 * params.flow;
  gl.uniform2f(U.resolution, canvas.width, canvas.height);
  gl.uniform2f(U.mouse, mouseX, mouseY);
  gl.uniform1f(U.time, time);
  gl.uniform1f(U.zoom, params.zoom);
  gl.uniform1f(U.pollution, params.pollution);
  gl.uniform1f(U.stillness, params.stillness);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
