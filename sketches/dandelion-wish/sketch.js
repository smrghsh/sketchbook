// 💨 dandelion wish — a dandelion you can blow.
// mic input via native Web Audio (p5.sound blocks p5 startup on Firefox)
let micAnalyser = null;
let micSamples = null;

async function enableMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") await ctx.resume();
    micAnalyser = ctx.createAnalyser();
    micAnalyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(micAnalyser);
    micSamples = new Float32Array(micAnalyser.fftSize);
  } catch (e) {
    // mic denied or unavailable — spacebar and the blow button still work
  }
}

function micLevel() {
  if (!micAnalyser) return 0;
  micAnalyser.getFloatTimeDomainData(micSamples);
  let sum = 0;
  for (let i = 0; i < micSamples.length; i++) {
    sum += micSamples[i] * micSamples[i];
  }
  return Math.sqrt(sum / micSamples.length);
}

// Variables for microphone amplitude values
let avgSamples = 30;
let avgArray = [];
let avgStep = 0;
let micTotal;
let micAvg;

// mic RMS threshold for "blowing" — the wind sensitivity slider scales it
// (sensitivity 1x = the original 0.02 threshold; higher = easier to trigger)
var windSensitivity = 0.02;
const params = {};

// the scene is composed on a fixed 400x600 stage, then scaled to the window
const stageWidth = 400;
const stageHeight = 600;

const receptacleRadius = 15;
const receptacleLocation = { x: 150, y: 240 };
const stemLocation = { x: 100, y: 650 };
const stemControlA = { x: 0, y: 0 };
const stemControlB = { x: 0, y: 800 };
const seedCount = 200;
var densityMult = 1.0;
var wind = 0;
var blowing = false;
var blowHeld = false;
var seeds = [];

function opac(flight, t) {
  return map(flight, 0, 60, t, 0);
}

class Seed {
  constructor(origin, originVariance) {
    this.initialAngle = random(2 * Math.PI);
    this.currentAngle = this.initialAngle;
    this.targetAngle = this.currentAngle;
    this.free = false;
    this.attachment = random(10, 60);
    this.flight = 0;
    this.mass = random(1, 4);
    this.qtyFluff = random(10, 20);
    this.stemLength = random(20, 90);
    this.origin = {
      x: origin.x + random(-originVariance, originVariance) / 2,
      y: origin.y + random(-originVariance, originVariance) / 2,
    };
    this.fluffWidth = 20;
    this.fluffHeight = 10;
  }
  draw() {
    push();
    angleMode(RADIANS);
    if (wind > this.attachment) {
      this.free = true;
    }
    if (!this.free) {
      translate(this.origin.x, this.origin.y);
      let agitation = blowing
        ? map(this.attachment - wind, 40, 0, 0.005, 0.1)
        : 0.002;
      this.targetAngle = blowing
        ? this.initialAngle +
          noise(agitation * frameCount * 0.2 + this.initialAngle) / 5
        : this.initialAngle +
          noise(frameCount * 0.001 + this.initialAngle) * 0.01;
      this.currentAngle =
        this.currentAngle +
        (this.targetAngle - this.currentAngle) / (this.mass * 3);

      rotate(this.currentAngle);
    } else {
      this.targetAngle = Math.PI + noise(this.mass) / Math.PI;
      this.currentAngle =
        this.currentAngle +
        (this.targetAngle - this.currentAngle) / (this.mass * 20);

      this.flight++;
      translate(
        this.origin.x + this.flight * this.mass,
        this.origin.y -
          this.flight * this.mass * noise(this.mass + frameCount * 0.01)
      );
      rotate(this.currentAngle);
    }

    //base
    fill(0, opac(this.flight, 40));
    stroke(0, opac(this.flight, 40));
    rectMode(CENTER);
    ellipse(0, 5, 2, 10);

    //stem
    strokeWeight(1);
    stroke(0, opac(this.flight, 60));
    line(0, 0, 0, this.stemLength);
    //fluff
    stroke(0, opac(this.flight, 30));
    for (let i = 0; i < this.qtyFluff; i++) {
      let theta = (2 * Math.PI * i) / this.qtyFluff;
      let fluffLength = map(
        abs(sin(theta)),
        0,
        1,
        this.fluffWidth,
        this.fluffHeight
      );

      line(
        0,
        this.stemLength,
        fluffLength * cos(theta),
        this.stemLength + fluffLength * sin(theta)
      );
    }

    pop();
  }
}

function newDandelion() {
  wind = 0;
  blowing = false;
  seeds = [];
  for (let i = 0; i < floor(seedCount * densityMult); i++) {
    seeds.push(new Seed(receptacleLocation, receptacleRadius));
  }
}

function setup() {
  angleMode(RADIANS);

  createCanvas(windowWidth, windowHeight);
  newDandelion();
  wireControls();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(255);

  // Write mic amplitude values to an array
  avgArray[avgStep] = micLevel();
  avgStep++;
  if (avgStep > avgSamples) {
    avgStep = 0;
  }

  // Calculate the average of the mic amplitude array
  micTotal = 0;
  for (let i = 0; i < avgSamples; i++) {
    micTotal += avgArray[i];
  }
  micAvg = micTotal / avgSamples;

  if (keyIsDown(32) || blowHeld || micAvg > windSensitivity) {
    wind += 0.4;
    blowing = true;
  } else {
    blowing = false;
  }

  push();
  // scale the stage to the window: centered horizontally, anchored to the bottom
  const s = min(width / stageWidth, height / stageHeight);
  translate((width - stageWidth * s) / 2, height - stageHeight * s);
  scale(s);

  //stem
  noFill();
  strokeWeight(5);
  stroke(0, 195);
  curve(
    stemControlA.x,
    stemControlA.y,
    receptacleLocation.x,
    receptacleLocation.y,
    stemLocation.x,
    stemLocation.y,
    stemControlB.x,
    stemControlB.y
  );
  // receptacle
  fill(255);
  strokeWeight(1);
  ellipse(
    receptacleLocation.x,
    receptacleLocation.y,
    receptacleRadius,
    receptacleRadius
  );
  // seeds
  seeds.forEach((e) => {
    e.draw();
  });
  pop();
}

function wireControls() {
  // mic permission gate
  document.getElementById("start-mic").addEventListener("click", () => {
    enableMic();
    // even if mic permission is denied, spacebar and the blow button still work
    document.getElementById("mic-gate").classList.remove("visible");
  });

  document
    .getElementById("new-dandelion")
    .addEventListener("click", newDandelion);

  document.getElementById("less").addEventListener("click", () => {
    densityMult = max(0.5, densityMult - 0.5);
    newDandelion();
  });
  document.getElementById("more").addEventListener("click", () => {
    densityMult = min(3.0, densityMult + 0.5);
    newDandelion();
  });

  // hold-to-blow button — fallback for no mic
  Standard.holdButton(
    document.getElementById("blow"),
    () => (blowHeld = true),
    () => (blowHeld = false)
  );

  // wind sensitivity: scales the mic threshold (higher = easier to blow)
  Standard.param(document.getElementById("controls"), params, {
    id: "wind-sensitivity",
    label: "wind sensitivity",
    min: 0.2,
    max: 3,
    step: 0.05,
    value: 1,
    fmt: (v) => v.toFixed(2) + "x",
    apply: (v) => {
      params["wind-sensitivity"] = v;
      windSensitivity = 0.02 / v;
    },
  });
}
