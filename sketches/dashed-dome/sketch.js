// dashed dome — genuary 2026. 1200 dashed fat-line strands standing on an
// annulus, wandered sideways by a sin-hash noise, their tips converging into
// a dome/spire. Per-strand dashOffset animation makes the whole thing
// shimmer. Ported standalone from genuary2026/02 (blue) + test01 (ocean
// ceramic colorway).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

// ---- palettes (each hue-sorted, as in the originals) ----------------------

const PALETTES = {
  // various shades of blue (02)
  blue: [
    0x001a33, 0x002244, 0x003366, 0x004477, 0x004d99, 0x0066cc, 0x0080ff,
    0x3399ff, 0x66b3ff, 0x99ccff, 0xb3d9ff,
  ],
  // ocean themed palette with shades of blue and green, very ceramic (test01)
  ocean: [
    0x0d3b66, 0x144f86, 0x1e6091, 0x28aedb, 0x4fb99f, 0x9de0ad, 0xe4f9f5,
    0xf0f3bd, 0xf4d35e, 0xee964b, 0xf95738,
  ],
};

function sortByHue(hexes) {
  const hslA = { h: 0, s: 0, l: 0 };
  const hslB = { h: 0, s: 0, l: 0 };
  return [...hexes].sort((a, b) => {
    new THREE.Color(a).getHSL(hslA);
    new THREE.Color(b).getHSL(hslB);
    return hslA.h - hslB.h;
  });
}

// ---- parameters (defaults from genuary2026/02) ----------------------------

const params = {
  qtyLines: 1200,
  pointsPerLine: 32,
  thicknessMin: 8,
  thicknessMax: 20,
  radiusMin: 1.8,
  radiusMax: 4.5,
  dashSizeMin: 0.2,
  dashSizeMax: 0.3,
  gapSizeMin: 0.05,
  gapSizeMax: 0.1,
  animSpeedMin: 0.0005,
  animSpeedMax: 0.021,
  noiseStrength: 0.54,
  noiseScale: 0.2,
  palette: 'blue',
};

// ---- scene ----------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x04070f);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(14, 13, 23);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 7.5, 0);
controls.enableDamping = true;

// ---- generator ------------------------------------------------------------

// simple 3D noise (sin-hash, Perlin-ish)
function noise3D(x, y, z) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.164) * 43758.5453;
  return n - Math.floor(n);
}

let lines = [];

function generateLines() {
  for (const line of lines) {
    line.geometry.dispose();
    line.material.dispose();
    scene.remove(line);
  }
  lines = [];

  const palette = sortByHue(PALETTES[params.palette]);
  const qtyLines = params.qtyLines;
  const qtyPoints = params.pointsPerLine;
  const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);

  for (let i = 0; i < qtyLines; i++) {
    // strand root on an annulus
    const radius =
      params.radiusMin + Math.random() * (params.radiusMax - params.radiusMin);
    const angle = Math.random() * Math.PI * 2;
    const meshX = Math.cos(angle) * radius;
    const meshZ = Math.sin(angle) * radius;
    const meshY = Math.random() * 2 - 1;

    const positions = [];
    const colors = [];
    const startColorIndex = Math.floor(Math.random() * palette.length);
    const color = new THREE.Color();

    for (let p = 0; p < qtyPoints; p++) {
      const pointY = p / 2;

      // strand root + point height drive noise-based x/z offsets
      const noiseX =
        noise3D(
          meshX * params.noiseScale,
          pointY * params.noiseScale,
          meshZ * params.noiseScale
        ) - 0.5;
      const noiseZ =
        noise3D(
          meshZ * params.noiseScale,
          pointY * params.noiseScale,
          meshX * params.noiseScale + 100
        ) - 0.5;

      const x = noiseX * params.noiseStrength;
      const z = noiseZ * params.noiseStrength;

      // converge last 5 points towards center for the dome effect
      let finalX = x;
      let finalZ = z;
      const convergenceStart = qtyPoints - 5;
      if (p >= convergenceStart) {
        const convergeFactor = (p - convergenceStart) / 5; // 0 to 1
        finalX = x * (1 - convergeFactor);
        finalZ = z * (1 - convergeFactor);
      }

      positions.push(finalX, pointY, finalZ);

      // walk through palette colors
      color.set(palette[(startColorIndex + p) % palette.length]);
      colors.push(color.r, color.g, color.b);
    }

    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    geometry.setColors(colors);

    const material = new LineMaterial({
      linewidth:
        params.thicknessMin +
        Math.random() * (params.thicknessMax - params.thicknessMin), // px
      vertexColors: true,
      resolution,
      dashed: true,
      dashSize:
        params.dashSizeMin +
        Math.random() * (params.dashSizeMax - params.dashSizeMin),
      gapSize:
        params.gapSizeMin +
        Math.random() * (params.gapSizeMax - params.gapSizeMin),
    });

    const line = new Line2(geometry, material);
    line.computeLineDistances();
    line.userData.dashSpeed =
      params.animSpeedMin +
      Math.random() * (params.animSpeedMax - params.animSpeedMin);

    line.position.set(meshX, meshY, meshZ);
    line.rotation.y = Math.random() * Math.PI * 2;

    scene.add(line);
    lines.push(line);
  }
}
generateLines();

// ---- chrome ---------------------------------------------------------------

const ui = {};
const paramsContainer = document.getElementById('params');

Standard.param(paramsContainer, ui, {
  id: 'strands',
  label: 'strands',
  min: 100,
  max: 3000,
  step: 50,
  value: params.qtyLines,
  fmt: (v) => String(v),
  apply: (v) => {
    params.qtyLines = Math.round(v);
    generateLines();
  },
});

Standard.param(paramsContainer, ui, {
  id: 'thickness-min',
  label: 'thickness min',
  min: 1,
  max: 30,
  step: 0.5,
  value: params.thicknessMin,
  fmt: (v) => v.toFixed(1),
  apply: (v) => {
    params.thicknessMin = Math.min(v, params.thicknessMax);
    generateLines();
  },
});

Standard.param(paramsContainer, ui, {
  id: 'thickness-max',
  label: 'thickness max',
  min: 1,
  max: 30,
  step: 0.5,
  value: params.thicknessMax,
  fmt: (v) => v.toFixed(1),
  apply: (v) => {
    params.thicknessMax = Math.max(v, params.thicknessMin);
    generateLines();
  },
});

Standard.param(paramsContainer, ui, {
  id: 'noise-strength',
  label: 'noise strength',
  min: 0,
  max: 2,
  step: 0.01,
  value: params.noiseStrength,
  fmt: (v) => v.toFixed(2),
  apply: (v) => {
    params.noiseStrength = v;
    generateLines();
  },
});

document.getElementById('sel-palette').addEventListener('change', (e) => {
  params.palette = e.target.value;
  generateLines();
});

document
  .getElementById('btn-regenerate')
  .addEventListener('click', () => generateLines());

// ---- loop -----------------------------------------------------------------

renderer.setAnimationLoop(() => {
  for (const line of lines) {
    line.material.dashOffset -= line.userData.dashSpeed;
  }
  controls.update();
  renderer.render(scene, camera);
});

// ---- resize ---------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  for (const line of lines) {
    line.material.resolution.set(window.innerWidth, window.innerHeight);
  }
});
