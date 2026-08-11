// 2.5d conway's — ported from cgol (webpack / three 0.126 / WebXR harness)
// Conway's Game of Life on a 50×50 wall of small boxes: live cells solid,
// dead cells wireframe. Hover highlights a cell red; clicking toggles it.
// The env-map/ice PBR of the original is simplified to plain standard
// materials under a sun + ambient light; the click.wav survives.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ROWS = 50;
const COLUMNS = 50;
const CELL_SIZE = 0.1;
const CELL_MARGIN = 0.9;

const params = { speed: 4 };
let playing = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color('black');

const camera = new THREE.PerspectiveCamera(
  35,
  innerWidth / innerHeight,
  0.1,
  100
);
camera.position.set(0, (ROWS * CELL_SIZE) / 2, 8.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, (ROWS * CELL_SIZE) / 2, 0);

// ---------------------------------------------------------------- lights
const sunLight = new THREE.DirectionalLight('#ffffff', 3.5);
sunLight.position.set(3.5, 2, 10.25);
scene.add(sunLight);
scene.add(new THREE.AmbientLight('#ffffff', 0.6));

// ---------------------------------------------------------------- sim
class Sim {
  constructor(rows, columns) {
    this.rows = rows;
    this.columns = columns;
    this.grid = new Array(rows).fill(0).map(() => new Array(columns).fill(0));

    this.cellGeometry = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, CELL_SIZE);
    this.cellMaterial = new THREE.MeshStandardMaterial();
    this.meshes = new THREE.Group();
    this.grid.forEach((row, r) => {
      row.forEach((col, c) => {
        const cell = new THREE.Mesh(this.cellGeometry, this.cellMaterial.clone());
        cell.userData.r = r;
        cell.userData.c = c;
        cell.position.x = c * CELL_SIZE;
        cell.position.y = r * CELL_SIZE;
        cell.scale.x *= CELL_MARGIN;
        cell.scale.y *= CELL_MARGIN;
        this.meshes.add(cell);
      });
    });
    this.meshes.position.x -= (this.columns * CELL_SIZE) / 2;
    this.meshes.position.y += CELL_SIZE;
    scene.add(this.meshes);
  }
  randomize() {
    this.grid.forEach((row, r) => {
      row.forEach((col, c) => {
        this.grid[r][c] = Math.random() < 0.5;
      });
    });
  }
  updateMeshes() {
    for (const cell of this.meshes.children) {
      cell.material.wireframe = !this.grid[cell.userData.r][cell.userData.c];
    }
  }
  step() {
    const past = JSON.parse(JSON.stringify(this.grid));
    this.grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        // out-of-bounds indexing yields undefined, which is falsy
        const neighbors =
          +Boolean(past[r][c + 1]) +
          +Boolean(past[r][c - 1]) +
          (past[r + 1]
            ? +Boolean(past[r + 1][c + 1]) +
              +Boolean(past[r + 1][c]) +
              +Boolean(past[r + 1][c - 1])
            : 0) +
          (past[r - 1]
            ? +Boolean(past[r - 1][c + 1]) +
              +Boolean(past[r - 1][c]) +
              +Boolean(past[r - 1][c - 1])
            : 0);
        this.grid[r][c] = (neighbors == 2 && this.grid[r][c]) || neighbors == 3;
      });
    });
  }
  clear() {
    this.grid = new Array(this.rows)
      .fill(0)
      .map(() => new Array(this.columns).fill(0));
  }
  toggleCell(r, c) {
    this.grid[r][c] = !this.grid[r][c];
  }
}

const sim = new Sim(ROWS, COLUMNS);
sim.randomize();
sim.updateMeshes();

// ---------------------------------------------------------------- floor
const floorVertex = /* glsl */ `
varying vec3 vPosition;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    vPosition = position;
}
`;

const floorFragment = /* glsl */ `
varying vec3 vPosition;

void main() {
    vec3 color = vec3(1.0);
    float thickness = 0.01;
    float opacity = smoothstep(1.0-thickness ,1.0,(vPosition.x - thickness/2.0) - floor(vPosition.x-thickness/2.0));
    opacity += smoothstep(1.0-thickness ,1.0,(vPosition.y - thickness/2.0) - floor(vPosition.y-thickness/2.0));
    opacity = opacity/2.0;
    opacity = step(0.01,opacity);
    opacity = opacity/4.0;
    gl_FragColor = vec4(color,opacity);
}
`;

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.ShaderMaterial({
    vertexShader: floorVertex,
    fragmentShader: floorFragment,
    transparent: true,
  })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// ---------------------------------------------------------------- stars
function makeStarTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const count = 700;
const positions = new Float32Array(count * 3);
const starColor = new Float32Array(count * 3).fill(1);
for (let i = 0; i < count * 3; i += 3) {
  const distance = Math.random() * 5 + 20;
  const rot1 = Math.acos(2 * Math.random() - 1.0);
  const rot2 = Math.random() * 2 * Math.PI;
  positions[i] = Math.sin(rot1) * Math.cos(rot2) * distance;
  positions[i + 1] = Math.sin(rot1) * Math.sin(rot2) * distance;
  positions[i + 2] = Math.cos(rot1) * distance;
}
const starsGeometry = new THREE.BufferGeometry();
starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
starsGeometry.setAttribute('color', new THREE.BufferAttribute(starColor, 3));
const stars = new THREE.Points(
  starsGeometry,
  new THREE.PointsMaterial({
    size: 0.22,
    sizeAttenuation: true,
    color: 'white',
    vertexColors: true,
    transparent: true,
    alphaMap: makeStarTexture(),
    alphaTest: 0.001,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
scene.add(stars);

// ---------------------------------------------------------------- input
const clickSound = new Audio('click.wav');
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-2, -2);
let INTERSECTED = null;

addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / innerHeight) * 2 + 1;
});

let downX = 0;
let downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
});
renderer.domElement.addEventListener('click', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) >= 6) return;
  if (INTERSECTED) {
    sim.toggleCell(INTERSECTED.userData.r, INTERSECTED.userData.c);
    sim.updateMeshes();
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {});
  }
});

// ---------------------------------------------------------------- chrome
Standard.bind(params, 'speed', (v) => v.toFixed(1), (v) => {
  params.speed = v;
});
const playButton = document.getElementById('play');
playButton.addEventListener('click', () => {
  playing = !playing;
  playButton.textContent = playing ? 'pause ✦' : 'play ✦';
});
document.getElementById('randomize').addEventListener('click', () => {
  sim.randomize();
  sim.updateMeshes();
});
document.getElementById('step').addEventListener('click', () => {
  sim.step();
  sim.updateMeshes();
});
document.getElementById('clear').addEventListener('click', () => {
  sim.clear();
  sim.updateMeshes();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- loop
let lastUpdated = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();

  // hover highlight (https://github.com/mrdoob/three.js — interactive cubes)
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(sim.meshes.children, false);
  if (intersects.length > 0) {
    if (INTERSECTED != intersects[0].object) {
      if (INTERSECTED) INTERSECTED.material.color.setHex(INTERSECTED.userData.currentHex);
      INTERSECTED = intersects[0].object;
      INTERSECTED.userData.currentHex = INTERSECTED.material.color.getHex();
      INTERSECTED.material.color.setHex(0xff0000);
    }
  } else {
    if (INTERSECTED) INTERSECTED.material.color.setHex(INTERSECTED.userData.currentHex);
    INTERSECTED = null;
  }

  if (playing && now > lastUpdated + 1000 / params.speed) {
    sim.step();
    sim.updateMeshes();
    lastUpdated = now;
  }

  stars.rotation.x += 0.0002;
  controls.update();
  renderer.render(scene, camera);
});
