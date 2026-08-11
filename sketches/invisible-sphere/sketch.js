// invisible sphere — "oceanflare".
// Ported from the 2021 webpack project (three 0.126) to three 0.174.
// 300k mass-attributed points wrap-scroll past a camera placed inside
// the cloud; heavier points streak faster, fbm colors the fragments,
// alpha comes from mass and depth. (The original loaded rand.png as
// uImage but the shader never sampled it, so it's gone.)

import * as THREE from 'three';

const params = {
  points: 300000,
  speed: 0.2, // original: const float speed = 0.2 in the vertex shader
  size: 1,
};

const vertexShader = /* glsl */ `
attribute float mass;

uniform float uTime;
uniform float uSpeed;
uniform float uSize;
varying float vMass;

varying vec2 vCircleSpace;
varying float vDepth;
float random (in vec2 st) {
    return fract(sin(dot(st.xy,
    vec2(12.9898,78.233)))*
    43758.5453123);
}

void main() {
    vMass = mass;
    vec3 modifiedPosition = position;
    // fract-wrap scroll: heavier points move faster and wrap around x
    modifiedPosition.x = (modifiedPosition.x - uTime * mass * uSpeed) - (floor(modifiedPosition.x - uTime * mass * uSpeed));
    vec4 modelPosition = modelMatrix * vec4(modifiedPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_PointSize = uSize * 10.0 * (1.0 - mass);
    gl_Position = projectedPosition;
    //used for sun version
    vCircleSpace = modelPosition.xy;
    vDepth = position.z;
}
`;

const fragmentShader = /* glsl */ `
varying float vMass;
varying vec2 vCircleSpace;
varying float vDepth;
uniform float uTime;


float map(float value, float min1, float max1, float min2, float max2) {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}


float circle(in vec2 _st, in float _radius){
    vec2 dist = _st-vec2(0.5);
	return 1.-smoothstep(_radius-(_radius*0.01),
                         _radius+(_radius*0.01),
                         dot(dist,dist)*4.0);
}

vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
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


void main(){
    vec2 st = vCircleSpace;
    float u_time = uTime;
     vec3 color = vec3(0.0);
        // determines size
        vec2 p = st*3.;
        // river flow strength
        p.x += u_time * 0.01;
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
        float t3 = u_time * 0.1;
        vec2 q = p + t1;
        float s = fbm(p + t3);
        float r = fbm(p + t2 + s);
        // so this is where is ressembles the canonical quilez technique
        color += fbm(q + r);
        // bump up brightness a smidgen
        color += 0.15;
        color.r +=  s + 0.05;
        // note that r here isn't red, it's river as modulated by undercurrent
        color.b += r + 0.3;
        // pollution as opposite of undercurrent color (couldnt use q without more operations)
        color.g += s/2.5;

    gl_FragColor = vec4(color,0.5 + 2.0 * vMass - vDepth * 0.5);

}
`;

/**
 * Base
 */
const scene = new THREE.Scene();
scene.background = new THREE.Color('black');

const invisisphereMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0.0 },
    uSpeed: { value: params.speed },
    uSize: { value: params.size },
  },
  depthWrite: false,
  transparent: true,
  alphaTest: 0.5,
});

/**
 * Points — regenerated when the slider changes
 */
let particles = null;
function buildPoints(quantityPoints) {
  if (particles) {
    scene.remove(particles);
    particles.geometry.dispose();
  }
  const particlesGeometry = new THREE.BufferGeometry();
  const position = new Float32Array(quantityPoints * 3);
  position.forEach((e, i) => {
    position[i] = Math.random();
  });
  const mass = new Float32Array(quantityPoints);
  mass.forEach((e, i) => {
    mass[i] = Math.random();
  });
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  particlesGeometry.setAttribute('mass', new THREE.BufferAttribute(mass, 1));
  particles = new THREE.Points(particlesGeometry, invisisphereMaterial);
  scene.add(particles);
}
buildPoints(params.points);

/**
 * Camera — inside the cloud, looking down +z
 */
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2.0);
camera.position.set(0.5, 0.5, 0.0);
camera.lookAt(0.5, 0.5, 1);
scene.add(camera);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer();
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

/**
 * Params
 */
Standard.bind(params, 'points', (v) => Math.round(v / 1000) + 'k', (v) =>
  buildPoints(Math.round(v))
);
Standard.bind(params, 'speed', (v) => v.toFixed(2), (v) => {
  invisisphereMaterial.uniforms.uSpeed.value = v;
});
Standard.bind(params, 'size', (v) => v.toFixed(1), (v) => {
  invisisphereMaterial.uniforms.uSize.value = v;
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

/**
 * Animate
 */
const clock = new THREE.Clock();

const tick = () => {
  // the +55 drops us into the evolved part of the flow, as rendered
  const elapsedTime = clock.getElapsedTime() + 55;
  invisisphereMaterial.uniforms.uTime.value = elapsedTime;
  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
};

tick();
