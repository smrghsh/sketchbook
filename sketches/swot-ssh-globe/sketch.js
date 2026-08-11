/* swot ssh globe — ported from swot-ssh-globe (vite/brahma build).
   SSH anomaly field is synthesized (SSHGenerator) so the piece runs
   standalone; three 21-day frames lerp cyclically in the vertex shader. */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =============================================================================
// SSHGenerator — synthetic SWOT-like sea-surface-height anomaly frames
// =============================================================================
class SSHGenerator {
  constructor(width = 1024, height = 512) {
    this.width = width;
    this.height = height;
    this.frames = [this._generate(0), this._generate(1), this._generate(2)];
  }

  _wave(lat, lon, k, amplitude, phase) {
    return (
      amplitude *
      Math.sin(k * lon * (Math.PI / 180) + phase) *
      Math.exp(-((lat * lat) / 400))
    );
  }

  _eddyCatalogue(frameIndex) {
    const shift = frameIndex * 3.0; // 3° west per 21-day frame
    const features = [];

    // California Current System
    features.push({ lon: -122 - shift, lat: 34, r: 3.5, a: +0.35 });
    features.push({ lon: -126 - shift, lat: 37, r: 2.8, a: -0.28 });
    features.push({ lon: -118 - shift, lat: 32, r: 2.0, a: +0.22 });
    features.push({ lon: -124 - shift, lat: 38, r: 1.8, a: -0.18 });
    features.push({ lon: -135 - shift, lat: 33, r: 4.0, a: +0.3 });
    features.push({ lon: -121.8 - shift, lat: 36.5, r: 1.5, a: -0.2 });

    // Gulf Stream meanders
    features.push({ lon: -60 - shift * 0.5, lat: 38, r: 5.5, a: +0.45 });
    features.push({ lon: -50 - shift * 0.5, lat: 40, r: 4.0, a: -0.32 });
    features.push({ lon: -43 - shift * 0.5, lat: 37, r: 3.5, a: +0.28 });
    features.push({ lon: -70 - shift * 0.5, lat: 36, r: 3.0, a: -0.25 });

    // Agulhas rings
    features.push({ lon: 20 + shift * 0.3, lat: -38, r: 5.0, a: +0.4 });
    features.push({ lon: 12 + shift * 0.3, lat: -35, r: 3.8, a: -0.3 });
    features.push({ lon: 28 + shift * 0.3, lat: -40, r: 4.2, a: +0.35 });

    // Kuroshio Extension
    features.push({ lon: 150 - shift * 0.6, lat: 35, r: 5.0, a: +0.42 });
    features.push({ lon: 158 - shift * 0.6, lat: 37, r: 4.0, a: -0.33 });
    features.push({ lon: 165 - shift * 0.6, lat: 33, r: 3.2, a: +0.28 });

    // Antarctic Circumpolar Current
    for (let lon = -170; lon < 180; lon += 35) {
      features.push({
        lon: lon + shift * 0.2,
        lat: -53 + Math.sin(lon * 0.05) * 4,
        r: 4.5,
        a: (lon % 70 < 35 ? 1 : -1) * 0.22,
      });
    }

    // Tropical Pacific (ENSO signature)
    features.push({ lon: -120 - shift * 0.2, lat: 0, r: 12, a: +0.15 });
    features.push({ lon: -160 - shift * 0.2, lat: 5, r: 10, a: -0.12 });
    features.push({ lon: 170 - shift * 0.2, lat: -3, r: 8, a: +0.1 });

    // Mediterranean outflow / Atlantic
    features.push({ lon: -15 - shift * 0.4, lat: 35, r: 3.5, a: +0.2 });
    features.push({ lon: -25 - shift * 0.4, lat: 32, r: 2.8, a: -0.18 });

    return features;
  }

  _generate(frameIndex) {
    const { width, height } = this;
    const data = new Uint8Array(width * height * 4);
    const eddies = this._eddyCatalogue(frameIndex);

    for (let py = 0; py < height; py++) {
      const lat = 90 - (py / height) * 180;
      for (let px = 0; px < width; px++) {
        const lon = -180 + (px / width) * 360;
        let ssh = 0;
        for (const e of eddies) {
          let dlon = lon - e.lon;
          if (dlon > 180) dlon -= 360;
          if (dlon < -180) dlon += 360;
          const dlat = lat - e.lat;
          const r2 = (dlon * dlon + dlat * dlat) / (e.r * e.r);
          ssh += e.a * Math.exp(-r2 * 2.0);
        }
        ssh += this._wave(lat, lon, 2.5, 0.06, frameIndex * 0.8);
        ssh += this._wave(lat, lon, 5.0, 0.03, frameIndex * 1.3 + 1.0);
        ssh = Math.max(-0.5, Math.min(0.5, ssh));

        const normalised = ssh + 0.5;
        const idx = (py * width + px) * 4;
        data[idx + 0] = Math.round(normalised * 255);
        data[idx + 1] = Math.round((normalised * 65535) % 256);
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      }
    }
    return data;
  }

  toDataTexture(frameIndex) {
    const tex = new THREE.DataTexture(
      this.frames[frameIndex],
      this.width,
      this.height,
      THREE.RGBAFormat
    );
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }
}

// =============================================================================
// Embedded simplified California coastline GeoJSON
// =============================================================================
const CALIFORNIA_COAST_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'California West Coast' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-124.55, 42.0], [-124.3, 41.78], [-124.18, 41.4], [-124.1, 41.0],
          [-124.08, 40.8], [-124.2, 40.55], [-124.32, 40.44], [-124.4, 40.3],
          [-124.32, 40.1], [-124.15, 39.9], [-123.85, 39.7], [-123.72, 39.55],
          [-123.82, 39.4], [-123.75, 39.2], [-123.63, 39.0], [-123.55, 38.82],
          [-122.98, 38.35], [-122.8, 38.1], [-122.53, 37.9], [-122.38, 37.6],
          [-122.5, 37.3], [-122.52, 37.1], [-122.4, 36.95], [-122.1, 36.9],
          [-121.87, 36.7], [-121.72, 36.52], [-121.5, 36.5], [-121.3, 36.35],
          [-120.87, 35.38], [-120.72, 35.2], [-120.67, 34.95], [-120.63, 34.75],
          [-120.48, 34.65], [-120.32, 34.45], [-119.98, 34.1], [-119.72, 34.05],
          [-119.48, 34.08], [-119.2, 34.16], [-118.83, 34.02], [-118.5, 33.87],
          [-118.18, 33.72], [-117.95, 33.62], [-117.7, 33.53], [-117.38, 33.17],
          [-117.24, 32.88], [-117.25, 32.58], [-117.22, 32.43], [-116.95, 32.2],
          [-116.7, 31.9],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Channel Islands — Santa Cruz' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-119.92, 34.06], [-119.72, 34.02], [-119.52, 34.0], [-119.32, 33.96],
          [-119.25, 34.0], [-119.42, 34.07], [-119.65, 34.1], [-119.92, 34.06],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Channel Islands — Santa Catalina' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-118.6, 33.46], [-118.48, 33.34], [-118.32, 33.3], [-118.28, 33.4],
          [-118.42, 33.5], [-118.6, 33.46],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Monterey Bay Arc' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.0, 36.96], [-121.9, 36.88], [-121.78, 36.8], [-121.65, 36.7],
          [-121.52, 36.6], [-121.4, 36.52],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'San Francisco Bay Opening' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.5, 37.83], [-122.52, 37.75], [-122.48, 37.65], [-122.47, 37.53],
        ],
      },
    },
  ],
};

// =============================================================================
// Shaders (inlined from src/shaders/ssh/)
// =============================================================================
const sshVertexShader = /* glsl */ `
uniform sampler2D uSSHFrame0;
uniform sampler2D uSSHFrame1;
uniform sampler2D uSSHFrame2;

uniform float uTime;
uniform float uDisplaceScale;
uniform float uAnimSpeed;

varying vec2 vUv;
varying float vSSH;

void main() {
  vUv = uv;

  float phase  = mod(uTime * uAnimSpeed, 3.0);
  float fi     = floor(phase);
  float frac   = phase - fi;

  vec4 s0, s1;
  if (fi < 0.5) {
    s0 = texture2D(uSSHFrame0, uv);
    s1 = texture2D(uSSHFrame1, uv);
  } else if (fi < 1.5) {
    s0 = texture2D(uSSHFrame1, uv);
    s1 = texture2D(uSSHFrame2, uv);
  } else {
    s0 = texture2D(uSSHFrame2, uv);
    s1 = texture2D(uSSHFrame0, uv);
  }

  vec4 s = mix(s0, s1, frac);
  float ssh = s.r - 0.5;
  vSSH = s.r;

  vec3 norm = normalize(position);
  vec3 displaced = position + norm * (ssh * uDisplaceScale);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

const sshFragmentShader = /* glsl */ `
varying vec2  vUv;
varying float vSSH;

uniform int   uPalette;
uniform float uTime;
uniform float uAnimSpeed;

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  float t = vSSH;
  vec3 col;

  if (uPalette == 0) {
    col = palette(t,
      vec3(0.5, 0.5, 0.5),
      vec3(0.5, 0.5, 0.5),
      vec3(1.0, 1.0, 0.5),
      vec3(0.80, 0.90, 0.30));
  } else if (uPalette == 1) {
    col = palette(t,
      vec3(0.5, 0.2, 0.7),
      vec3(0.5, 0.5, 0.5),
      vec3(1.0, 0.7, 0.4),
      vec3(0.00, 0.15, 0.20));
  } else {
    col = palette(t,
      vec3(0.3, 0.5, 0.7),
      vec3(0.3, 0.4, 0.3),
      vec3(0.8, 0.8, 1.0),
      vec3(0.40, 0.60, 0.20));
  }

  float shimmer = pow(max(0.0, sin(vUv.x * 120.0 + uTime * uAnimSpeed * 0.8)), 22.0) * 0.09;
  col += vec3(shimmer);

  gl_FragColor = vec4(col, 1.0);
}
`;

// =============================================================================
// Scene
// =============================================================================
const params = { speed: 0.12, displace: 0.08 };

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000510, 0.018);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 1000);
camera.position.set(0, 0.5, 3.2);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000510, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1.3;
controls.maxDistance = 6;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.3;

scene.add(new THREE.AmbientLight(0x223355, 1.2));
const pointLight = new THREE.PointLight(0x7ecfff, 2.5, 20);
pointLight.position.set(4, 3, 4);
scene.add(pointLight);

// SSH frames + globe
const generator = new SSHGenerator();
const sshFrames = [
  generator.toDataTexture(0),
  generator.toDataTexture(1),
  generator.toDataTexture(2),
];

const uniforms = {
  uSSHFrame0: { value: sshFrames[0] },
  uSSHFrame1: { value: sshFrames[1] },
  uSSHFrame2: { value: sshFrames[2] },
  uTime: { value: 0 },
  uAnimSpeed: { value: params.speed },
  uDisplaceScale: { value: params.displace },
  uPalette: { value: 0 },
};

const globe = new THREE.Mesh(
  new THREE.SphereGeometry(1, 512, 256),
  new THREE.ShaderMaterial({
    vertexShader: sshVertexShader,
    fragmentShader: sshFragmentShader,
    uniforms,
    side: THREE.FrontSide,
  })
);
scene.add(globe);

// California coastline overlay
{
  const group = new THREE.Group();
  const geoToSphere = (lon, lat, r = 1.005) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  };
  const mat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    opacity: 0.65,
    transparent: true,
  });
  for (const feature of CALIFORNIA_COAST_GEOJSON.features) {
    const geom = feature.geometry;
    const rings =
      geom.type === 'LineString' ? [geom.coordinates]
      : geom.type === 'MultiLineString' ? geom.coordinates
      : geom.type === 'Polygon' ? geom.coordinates
      : geom.type === 'MultiPolygon' ? geom.coordinates.flat()
      : [];
    for (const ring of rings) {
      const pts = ring.map(([lon, lat]) => geoToSphere(lon, lat));
      if (pts.length < 2) continue;
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
  }
  scene.add(group);
}

// Starfield
{
  const count = 8000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 80 + Math.random() * 120;
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(
    new THREE.Points(
      geom,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, sizeAttenuation: true })
    )
  );
}

// Chrome wiring
Standard.bind(params, 'speed', (v) => v.toFixed(2), (v) => {
  uniforms.uAnimSpeed.value = v;
});
Standard.bind(params, 'displace', (v) => v.toFixed(3), (v) => {
  uniforms.uDisplaceScale.value = v;
});
document.getElementById('palette').addEventListener('change', (e) => {
  uniforms.uPalette.value = parseInt(e.target.value, 10);
});
document.getElementById('rotate').addEventListener('change', (e) => {
  controls.autoRotate = e.target.checked;
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const start = performance.now();
renderer.setAnimationLoop(() => {
  uniforms.uTime.value = (performance.now() - start) * 0.001;
  controls.update();
  renderer.render(scene, camera);
});
