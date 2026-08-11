/* intermittent — 2018, from s18portfolio/intermittent.html.
   3000 raindrops walk a perlin flow field over a fading white canvas;
   each has a chance per frame of glitch-jumping straight down instead.
   In installation the glitch/flow balance was driven by ambient café
   noise through a hidden microphone, and by an EEG during meditation.

   Credits: the stutter owes a debt to Nicky Case's fireflies web project,
   and the flow field to Daniel Shiffman's The Nature of Code. */

var params = {
  agents: 3000,
  glitchRate: 1, // glitch chance = rate/10 per agent per frame
  glitchStrength: 3,
  fade: 15,
};

var agents = [];
var noiseZ = 0.01;
var noiseZVelocity = 0.002;
var noiseStrength = 10;

function setup() {
  var canvas = createCanvas(windowWidth, windowHeight);
  background(255);
  strokeWeight(0.25);
  regenerate();

  // reseed on canvas clicks only (not on the control chrome)
  canvas.mousePressed(reseed);

  Standard.bind(params, 'agents', function (v) {
    return v.toFixed(0);
  }, function (v) {
    params.agents = Math.round(v);
    regenerate();
  });
  Standard.bind(params, 'glitchRate', function (v) {
    return v.toFixed(1);
  }, function (v) {
    params.glitchRate = v;
  });
  Standard.bind(params, 'glitchStrength', function (v) {
    return v.toFixed(1);
  }, function (v) {
    params.glitchStrength = v;
  });
  Standard.bind(params, 'fade', function (v) {
    return v.toFixed(0);
  }, function (v) {
    params.fade = v;
  });

  document.getElementById('reseed').addEventListener('click', reseed);
}

function regenerate() {
  agents = [];
  for (var i = 0; i < params.agents; i++) {
    agents[i] = new Raindrop();
  }
}

function reseed() {
  regenerate();
  setParam('glitchRate', random(1, 5), 1);
  setParam('glitchStrength', random(5, 8), 1);
  noiseZ = 0.01;
  noiseDetail(random(1, 3), random(1));
  noiseSeed(random(50, 200));
}

// push a randomized value back into params + slider UI
function setParam(id, value, decimals) {
  params[id] = value;
  var el = document.getElementById(id);
  var label = document.getElementById(id + '-value');
  if (el) el.value = value;
  if (label) label.textContent = value.toFixed(decimals);
}

function draw() {
  fill(255, params.fade);
  noStroke();
  rect(0, 0, width, height);
  stroke(0);
  for (var i = 0; i < agents.length; i++) {
    if (random(0, 10) > params.glitchRate) {
      agents[i].move();
    } else {
      agents[i].y += random(1, 5);
    }
    agents[i].display();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(255);
  regenerate();
}

function Raindrop() {
  this.x = random(0, width);
  this.y = random(0, height);
  this.xOld = this.x;
  this.yOld = this.y;
  this.stepSize = 1;

  this.move = function () {
    var angle = noise(this.x / 100, this.y / 100, noiseZ) * noiseStrength;
    this.stepSize = random(0, params.glitchStrength);
    this.x += cos(angle) * this.stepSize;
    this.y += sin(angle) * this.stepSize;
    noiseZ += noiseZVelocity;

    // wrap
    if (this.x < -10) {
      this.x = this.xOld = width + 10;
    }
    if (this.x > width + 10) {
      this.x = this.xOld = 10;
    }
    if (this.y < -10) {
      this.y = this.yOld = height + 10;
    }
    if (this.y > height + 10) {
      this.y = this.yOld = 10;
    }
  };

  this.display = function () {
    line(this.xOld, this.yOld, this.x, this.y);
    this.xOld = this.x;
    this.yOld = this.y;
  };
}
