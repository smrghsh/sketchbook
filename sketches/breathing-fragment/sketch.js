// breathing fragment — a breathing meditation shader.
// Ported from the 2021 webpack project (three 0.126) to three 0.174.
// Fullscreen quad, domain-warped fbm river with a ring; the flow
// reverses inside the ring, and the ring breathes on uBreathPosition.

import * as THREE from 'three';

const params = {
  period: 4, // seconds per breath (original: cos²(t/4))
  radius: 0.4,
  width: 0.01,
  flow: 0.5,
};

const vertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
    vUv = uv;
    // fullscreen quad — the original kept this path commented out:
    // gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uBreathPosition;
uniform float uRingRadius;
uniform float uRingWidth;
uniform float uFlow;
uniform float uAspect;
varying vec2 vUv;

float circle(in vec2 _st, in float _radius){
    vec2 dist = _st-vec2(0.5);
	return 1.-smoothstep(_radius-(_radius*0.01),
                         _radius+(_radius*0.01),
                         dot(dist,dist)*4.0);
}



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
    vec2 st = vUv.xy/5.0;
    vec3 color = vec3(0.0);
    // determines size
    vec2 p = st*3.;

    // aspect-corrected uv so the ring stays a circle at any window shape
    vec2 aUv = vec2((vUv.x - 0.5) * uAspect + 0.5, vUv.y);

    // the ring breathes: uBreathPosition = cos²(t/period) from js
    float circleRadius = uRingRadius * (0.7 + 0.3 * uBreathPosition);
    float circleWidth = uRingWidth;
    float rbDiff = 0.40;
    float circleBrightnessBump = 0.05;


    // // river flow strength
    p.x += uTime * 0.01;
    // the flow reverses inside the ring
    p.x -= uTime * uFlow * (0.9  * circle(aUv,circleRadius-circleWidth));
    // // quilez does fbm( p + fbm(p)), which he notates as fbm(q + r), using q and r to modulate color
    // // fully expanded, I'm doing fbm(p + fbm(p + fbm(p))), so additional nesting r = fbm(p + s)
    // // I add terms to set the d/dt of q,r,s
    // // The undercurrent is s, it has the greatest effect on the whole simulation at the core
    // // its d/dt, t3, is set to be opposite t1, which affects the pollution.
    // // these are nested functions so the order magnitude needs to be different
    // // t2 modulates the rivers velocity, here it's slightly against the river flow strength, almost 0
    // // originally t values had an additional trig term, but alas performance

    // undercurrent relative velocity
    float t1 = uTime * -0.05;
    // river relative velocity
    float t2 = uTime * 0.01;
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
    color.b += r + 0.3;
    // pollution as opposite of undercurrent color (couldnt use q without more operations)
    color.g += s/2.5;


    color.rb -= rbDiff;
    color += circle(aUv,circleRadius) - circle(aUv,circleRadius-circleWidth);
    color += (rbDiff+circleBrightnessBump) * circle(aUv,circleRadius);
    color -= rbDiff * circle(aUv,circleRadius-circleWidth);
    color.rb += rbDiff * circle(aUv,circleRadius-circleWidth);
    gl_FragColor = vec4(color,1.0);

}
`;

const scene = new THREE.Scene();
// camera is unused by the fullscreen-quad vertex shader, but three wants one
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 1.3);
scene.add(camera);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const breathMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0.0 },
    uBreathPosition: { value: 0.0 },
    uRingRadius: { value: params.radius },
    uRingWidth: { value: params.width },
    uFlow: { value: params.flow },
    uAspect: { value: innerWidth / innerHeight },
  },
});

const breath = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), breathMaterial);
scene.add(breath);

Standard.bind(params, 'period', (v) => v.toFixed(1) + 's', (v) => (params.period = v));
Standard.bind(params, 'radius', (v) => v.toFixed(2), (v) => {
  breathMaterial.uniforms.uRingRadius.value = v;
});
Standard.bind(params, 'width', (v) => v.toFixed(3), (v) => {
  breathMaterial.uniforms.uRingWidth.value = v;
});
Standard.bind(params, 'flow', (v) => v.toFixed(2), (v) => {
  breathMaterial.uniforms.uFlow.value = v;
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  breathMaterial.uniforms.uAspect.value = innerWidth / innerHeight;
});

const clock = new THREE.Clock();

const tick = () => {
  const elapsedTime = clock.getElapsedTime();

  breathMaterial.uniforms.uTime.value = elapsedTime + 5.2;
  // original breath: |cos(t/4) · cos(t/4)| = cos²(t/4); period slider scales t
  const c = Math.cos(elapsedTime / params.period);
  breathMaterial.uniforms.uBreathPosition.value = Math.abs(c * c);

  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
};

tick();
