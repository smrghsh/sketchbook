/* webgpu agents — 1000 agents on a 512² field steering toward the mouse,
   green decaying trails, three compute passes (reset / fade / simulate).
   Raw WebGPU, zero deps. Ported from vertex/webgpu-mousefollow; the
   quad-render boilerplate was rewritten for this port. */

const REZ = 512;

const params = {
  agents: 1000,
  steer: 0.001,
  fade: 0.9,
};

// ---- compute shaders (ported from agents.wgsl, steer/fade made uniforms) ---
const agentsWGSL = /* wgsl */ `
// Pixels
@group(0) @binding(0)
  var<storage, read_write> pixels : array<vec4f>;

// Uniforms
@group(1) @binding(0) var<uniform> rez : f32;
@group(1) @binding(1) var<uniform> time : f32;
@group(1) @binding(2) var<uniform> count : u32;
@group(1) @binding(3) var<uniform> mouse : vec2f;
@group(1) @binding(4) var<uniform> steer : f32;
@group(1) @binding(5) var<uniform> fadeAmt : f32;

// Agent buffers
@group(2) @binding(0)
  var<storage, read_write> positions : array<vec2f>;
@group(2) @binding(1)
  var<storage, read_write> velocities : array<vec2f>;

fn r(n: f32) -> f32 {
  let x = sin(n) * 43758.5453;
  return fract(x);
}

fn index(p: vec2f) -> i32 {
  return i32(p.x) + i32(p.y) * i32(rez);
}

@compute @workgroup_size(256)
fn reset(@builtin(global_invocation_id) id : vec3u) {
  let seed = f32(id.x) / f32(count);
  var p = vec2(r(seed), r(seed + 0.1));
  p *= rez;
  positions[id.x] = p;

  velocities[id.x] = vec2(r(f32(id.x + 1)), r(f32(id.x + 2))) - 0.5;
}

@compute @workgroup_size(256)
fn simulate(@builtin(global_invocation_id) id : vec3u) {
  if (id.x >= count) { return; }
  var p = positions[id.x];
  var v = velocities[id.x];

  p += v;
  p = (p + rez) % rez;
  positions[id.x] = p;

  v += (mouse - p) * steer;
  v = normalize(v);
  velocities[id.x] = v;

  pixels[index(p)] = vec4(0.0, 1.0, 0.0, 1.0);
}

@compute @workgroup_size(256)
fn fade(@builtin(global_invocation_id) id : vec3u) {
  pixels[id.x] *= fadeAmt;
}
`;

// ---- fullscreen render of the pixel buffer ---------------------------------
const quadWGSL = /* wgsl */ `
@group(0) @binding(0)
  var<storage, read> pixels : array<vec4f>;

struct VSOut {
  @builtin(position) pos : vec4f,
  @location(0) uv : vec2f,
}

@vertex
fn vert(@builtin(vertex_index) i : u32) -> VSOut {
  // one oversized triangle covers the canvas
  var corners = array(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out : VSOut;
  out.pos = vec4f(corners[i], 0.0, 1.0);
  out.uv = corners[i] * vec2f(0.5, -0.5) + 0.5; // y down, like the sim
  return out;
}

@fragment
fn frag(@location(0) uv : vec2f) -> @location(0) vec4f {
  let x = min(u32(uv.x * ${REZ}.0), ${REZ - 1}u);
  let y = min(u32(uv.y * ${REZ}.0), ${REZ - 1}u);
  let c = pixels[x + y * ${REZ}u];
  return vec4f(c.rgb, 1.0);
}
`;

const gate = document.getElementById('gate');

function showGate() {
  gate.classList.add('visible');
  // no sliders were built — hide the empty panel
  document.getElementById('controls').style.display = 'none';
}

async function main() {
  if (!navigator.gpu) {
    showGate();
    return;
  }
  let gpu;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('no adapter');
    gpu = await adapter.requestDevice();
  } catch (e) {
    console.warn('webgpu unavailable:', e);
    showGate();
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = REZ;
  document.body.appendChild(canvas);
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device: gpu, format, alphaMode: 'premultiplied' });

  const visibility = GPUShaderStage.COMPUTE;

  // Pixel buffer (512² vec4f trail field)
  const pixelBuffer = gpu.createBuffer({
    size: REZ * REZ * 16,
    usage: GPUBufferUsage.STORAGE,
  });
  const pixelBufferLayout = gpu.createBindGroupLayout({
    entries: [{ visibility, binding: 0, buffer: { type: 'storage' } }],
  });
  const pixelBufferBindGroup = gpu.createBindGroup({
    layout: pixelBufferLayout,
    entries: [{ binding: 0, resource: { buffer: pixelBuffer } }],
  });

  // Uniform buffers
  const uniformUsage = GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM;
  const rezBuffer = gpu.createBuffer({ size: 4, usage: uniformUsage });
  const timeBuffer = gpu.createBuffer({ size: 4, usage: uniformUsage });
  const countBuffer = gpu.createBuffer({ size: 4, usage: uniformUsage });
  const mouseBuffer = gpu.createBuffer({ size: 8, usage: uniformUsage });
  const steerBuffer = gpu.createBuffer({ size: 4, usage: uniformUsage });
  const fadeBuffer = gpu.createBuffer({ size: 4, usage: uniformUsage });
  gpu.queue.writeBuffer(rezBuffer, 0, new Float32Array([REZ]));
  gpu.queue.writeBuffer(timeBuffer, 0, new Float32Array([0]));
  gpu.queue.writeBuffer(mouseBuffer, 0, new Float32Array([REZ / 2, REZ / 2]));
  gpu.queue.writeBuffer(steerBuffer, 0, new Float32Array([params.steer]));
  gpu.queue.writeBuffer(fadeBuffer, 0, new Float32Array([params.fade]));

  const uniformsLayout = gpu.createBindGroupLayout({
    entries: [0, 1, 2, 3, 4, 5].map((binding) => ({
      visibility,
      binding,
      buffer: { type: 'uniform' },
    })),
  });
  const uniformsBindGroup = gpu.createBindGroup({
    layout: uniformsLayout,
    entries: [
      { binding: 0, resource: { buffer: rezBuffer } },
      { binding: 1, resource: { buffer: timeBuffer } },
      { binding: 2, resource: { buffer: countBuffer } },
      { binding: 3, resource: { buffer: mouseBuffer } },
      { binding: 4, resource: { buffer: steerBuffer } },
      { binding: 5, resource: { buffer: fadeBuffer } },
    ],
  });

  // Agent buffers — rebuilt whenever the count changes
  const agentsLayout = gpu.createBindGroupLayout({
    entries: [
      { visibility, binding: 0, buffer: { type: 'storage' } },
      { visibility, binding: 1, buffer: { type: 'storage' } },
    ],
  });

  const layout = gpu.createPipelineLayout({
    bindGroupLayouts: [pixelBufferLayout, uniformsLayout, agentsLayout],
  });

  const module = gpu.createShaderModule({ code: agentsWGSL });
  const resetPipeline = gpu.createComputePipeline({
    layout,
    compute: { module, entryPoint: 'reset' },
  });
  const simulatePipeline = gpu.createComputePipeline({
    layout,
    compute: { module, entryPoint: 'simulate' },
  });
  const fadePipeline = gpu.createComputePipeline({
    layout,
    compute: { module, entryPoint: 'fade' },
  });

  const pixelWorkgroups = Math.ceil(REZ ** 2 / 256);
  let agentWorkgroups = 0;
  let agentsBindGroup = null;

  const initAgents = (count) => {
    gpu.queue.writeBuffer(countBuffer, 0, new Uint32Array([count]));
    const positionsBuffer = gpu.createBuffer({
      size: 8 * count,
      usage: GPUBufferUsage.STORAGE,
    });
    const velocitiesBuffer = gpu.createBuffer({
      size: 8 * count,
      usage: GPUBufferUsage.STORAGE,
    });
    agentsBindGroup = gpu.createBindGroup({
      layout: agentsLayout,
      entries: [
        { binding: 0, resource: { buffer: positionsBuffer } },
        { binding: 1, resource: { buffer: velocitiesBuffer } },
      ],
    });
    agentWorkgroups = Math.ceil(count / 256);

    const encoder = gpu.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(resetPipeline);
    pass.setBindGroup(0, pixelBufferBindGroup);
    pass.setBindGroup(1, uniformsBindGroup);
    pass.setBindGroup(2, agentsBindGroup);
    pass.dispatchWorkgroups(agentWorkgroups);
    pass.end();
    gpu.queue.submit([encoder.finish()]);
  };
  initAgents(params.agents);

  // Render pipeline (fullscreen triangle over the pixel buffer)
  const quadModule = gpu.createShaderModule({ code: quadWGSL });
  const renderPipeline = gpu.createRenderPipeline({
    layout: 'auto',
    vertex: { module: quadModule, entryPoint: 'vert' },
    fragment: {
      module: quadModule,
      entryPoint: 'frag',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  });
  const renderBindGroup = gpu.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: pixelBuffer } }],
  });

  // Mouse in field-space
  const mouse = { x: REZ / 2, y: REZ / 2 };
  document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * REZ;
    mouse.y = ((e.clientY - rect.top) / rect.height) * REZ;
  });

  // ---- chrome wiring -------------------------------------------------------
  const controls = document.getElementById('controls');
  Standard.param(controls, params, {
    id: 'agents', label: 'agents', min: 100, max: 4000, step: 100, value: params.agents,
    apply: (v) => initAgents(v),
  });
  Standard.param(controls, params, {
    id: 'steer', label: 'steering', min: 0.0001, max: 0.005, step: 0.0001, value: params.steer,
    fmt: (v) => v.toFixed(4),
    apply: (v) => gpu.queue.writeBuffer(steerBuffer, 0, new Float32Array([v])),
  });
  Standard.param(controls, params, {
    id: 'fade', label: 'fade', min: 0.8, max: 0.99, step: 0.005, value: params.fade,
    fmt: (v) => v.toFixed(3),
    apply: (v) => gpu.queue.writeBuffer(fadeBuffer, 0, new Float32Array([v])),
  });

  // ---- loop: fade pass, simulate pass, render ------------------------------
  let time = 0;
  const draw = () => {
    gpu.queue.writeBuffer(mouseBuffer, 0, new Float32Array([mouse.x, mouse.y]));

    const encoder = gpu.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setBindGroup(0, pixelBufferBindGroup);
    pass.setBindGroup(1, uniformsBindGroup);
    pass.setBindGroup(2, agentsBindGroup);

    pass.setPipeline(fadePipeline);
    pass.dispatchWorkgroups(pixelWorkgroups);

    pass.setPipeline(simulatePipeline);
    pass.dispatchWorkgroups(agentWorkgroups);

    pass.end();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.draw(3, 1, 0, 0);
    renderPass.end();

    gpu.queue.submit([encoder.finish()]);
    gpu.queue.writeBuffer(timeBuffer, 0, new Float32Array([time++]));

    requestAnimationFrame(draw);
  };
  draw();
}

main();
