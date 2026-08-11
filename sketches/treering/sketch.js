/* treering — concentric perlin-perturbed rings as a real inline SVG,
   sized in physical inches for the plotter.
   p5 is used only as a noise/random engine (bare instance, no canvas);
   @svgdotjs/svg.js emits the geometry. */

'use strict';

// bare p5 instance: noise / random / map / createVector, no canvas
const p5_ = new p5((p) => {
  p.setup = () => p.noCanvas();
});

const obj = {
  size: 5.0, // inches
  pixelsPerInch: 96,
  initialRadius: 20,
  maxRadius: 500,
  incrementBase: 3,
  growthVariation: 5,
  noisiness: 3.0,
};

const stage = document.getElementById('stage');

const createSVG = function () {
  const size = obj.size * obj.pixelsPerInch;
  const draw = SVG().addTo('#stage').size(size, size);
  const width = draw.width();
  const height = draw.height();
  for (
    let r = obj.initialRadius;
    r < obj.maxRadius;
    r += obj.incrementBase + p5_.random(obj.growthVariation)
  ) {
    const points = [];
    for (let theta = 0; theta < p5_.TWO_PI; theta += 0.01) {
      const strength = p5_.map(r, 0, obj.maxRadius, 0, 300);
      const modifiedR =
        r +
        strength *
          p5_.noise(
            p5_.cos(theta) + 2,
            p5_.sin(theta) + 1,
            (obj.noisiness * r) / obj.maxRadius
          );
      let x = modifiedR * p5_.cos(theta);
      let y = modifiedR * p5_.sin(theta);
      x += width / 2;
      y += height / 2;
      points.push(p5_.createVector(x, y));
    }
    let pathString = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathString += ` L ${points[i].x} ${points[i].y}`;
    }
    draw
      .path(pathString)
      .attr({ fill: 'none', stroke: '#1a1a1a', 'stroke-width': 1 });
  }
};

const destroySVG = function () {
  const el = stage.querySelector('svg');
  if (el) el.remove();
};

const newSVG = function () {
  destroySVG();
  createSVG();
};

const downloadSVG = function (svgElement, fileName) {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(svgBlob);
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadLink.href);
};

// ---- chrome wiring ---------------------------------------------------------

const controls = document.getElementById('controls');
const regenBtn = document.getElementById('regenerate');
const dlBtn = document.getElementById('download');
const params = {};

Standard.param(controls, params, {
  id: 'size', label: 'size (in)', min: 0.05, max: 5, step: 0.05, value: obj.size,
  fmt: (v) => v.toFixed(2),
  apply: (v) => { obj.size = v; newSVG(); },
});
Standard.param(controls, params, {
  id: 'initialRadius', label: 'initial radius', min: 0, max: 100, step: 1, value: obj.initialRadius,
  apply: (v) => { obj.initialRadius = v; newSVG(); },
});
Standard.param(controls, params, {
  id: 'maxRadius', label: 'max radius', min: 100, max: 1000, step: 1, value: obj.maxRadius,
  apply: (v) => { obj.maxRadius = v; newSVG(); },
});
Standard.param(controls, params, {
  id: 'growthVariation', label: 'growth variation', min: 1, max: 12, step: 1, value: obj.growthVariation,
  apply: (v) => { obj.growthVariation = v; newSVG(); },
});
Standard.param(controls, params, {
  id: 'noisiness', label: 'noisiness', min: 1, max: 5, step: 0.05, value: obj.noisiness,
  fmt: (v) => v.toFixed(2),
  apply: (v) => { obj.noisiness = v; newSVG(); },
});

// keep buttons below the sliders
controls.appendChild(regenBtn);
controls.appendChild(dlBtn);

regenBtn.addEventListener('click', () => {
  p5_.noiseSeed(Math.floor(Math.random() * 1e6));
  newSVG();
});
dlBtn.addEventListener('click', () => {
  const el = stage.querySelector('svg');
  if (el) downloadSVG(el, 'treering.svg');
});

createSVG();
