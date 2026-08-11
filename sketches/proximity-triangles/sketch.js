/* proximity triangles — 2018, from s18portfolio (faileddelaunay.html /
   triangulation-sketch.js). A failed Delaunay implementation that became
   a proximity detector: triangles form between agents within a radius,
   opacity mapped to closeness. Hover swaps the cool palette to warm. */

var params = {
  agents: 108,
  proximity: 0.133, // fraction of height
  maxOpacity: 50,
};

var agents = [];
var minOpacity = 10;
var redEffect = 250;
var backgroundShade = 25;
var ySpeedVariation = 3.5;
var baselineRedValue = 10;
var dotSize = 1;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(51);
  frameRate(20);
  regenerate();

  Standard.bind(params, 'agents', function (v) {
    return v.toFixed(0);
  }, function (v) {
    params.agents = Math.round(v);
    regenerate();
  });
  Standard.bind(params, 'proximity', function (v) {
    return v.toFixed(2);
  }, function (v) {
    params.proximity = v;
  });
  Standard.bind(params, 'maxOpacity', function (v) {
    return v.toFixed(0);
  }, function (v) {
    params.maxOpacity = v;
  });
}

function regenerate() {
  agents = [];
  for (var i = 0; i < params.agents; i++) {
    agents[i] = new Agent();
  }
}

function draw() {
  var triSize = height * params.proximity;
  var warmRadius = height / 8.2;
  var maxOpacity = params.maxOpacity;
  var n = agents.length;

  noStroke();
  fill(backgroundShade, 255);
  rect(0, 0, width, height);

  stroke(255, 5);
  for (var i = 0; i < n; i++) {
    agents[i].update();
    fill(agents[i].r, agents[i].g, agents[i].b);
    agents[i].draw();
  }

  var mouse = createVector(mouseX, mouseY);
  for (i = 0; i < n; i++) {
    var warm = agents[i].pos.dist(mouse) < warmRadius;
    for (var j = 0; j < n; j++) {
      var dij = agents[i].pos.dist(agents[j].pos);
      if (dij >= triSize) continue;
      var alpha = map(dij, 0, triSize, maxOpacity, minOpacity);
      if (warm) {
        fill(redEffect, agents[i].g, agents[i].b, alpha);
      } else {
        fill(agents[i].r, agents[i].g, agents[i].b, alpha);
      }
      for (var k = i + 1; k < n; k++) {
        if (agents[i].pos.dist(agents[k].pos) < triSize) {
          triangle(
            agents[i].pos.x, agents[i].pos.y,
            agents[j].pos.x, agents[j].pos.y,
            agents[k].pos.x, agents[k].pos.y
          );
        }
      }
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(51);
  regenerate();
}

function Agent() {
  // random position
  this.pos = createVector(random(0, width), random(0, height));
  // random yVel
  this.vel = createVector(0, random(-1 * ySpeedVariation, ySpeedVariation));
  // unique color
  this.r = baselineRedValue;
  this.g = random(50, 255);
  this.b = random(100, 200);

  this.draw = function () {
    ellipse(this.pos.x, this.pos.y, dotSize, dotSize);
  };
  this.update = function () {
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.x < 0) this.pos.x = width;
    this.pos = this.pos.add(this.vel);
  };
}
