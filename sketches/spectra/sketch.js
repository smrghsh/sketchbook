/* spectra — WebAudio AnalyserNode bar spectrum on canvas2d.
   Ported from vertex/spectra: drag-drop / file-pick an audio file, plus a
   microphone mode gated behind the overlay card. Black background,
   amplitude-red bars. */

'use strict';

const params = {
  gain: 2,
};

// ---- canvas ---------------------------------------------------------------

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const canvasCtx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ---- audio graph ----------------------------------------------------------

let audioCtx = null;
let analyserNode = null;
let bufferLength = 0;
let dataArray = null;

const audio = document.createElement('audio');
audio.loop = true;
let elementSource = null; // createMediaElementSource is once-per-element

let micStream = null;
let micSource = null;

function ensureAudio() {
  if (audioCtx) {
    audioCtx.resume();
    return;
  }
  audioCtx = new AudioContext();
  analyserNode = audioCtx.createAnalyser();
  setFFT(parseInt(document.getElementById('fft').value, 10));
}

function setFFT(size) {
  if (!analyserNode) return;
  analyserNode.fftSize = size;
  bufferLength = analyserNode.frequencyBinCount;
  dataArray = new Float32Array(bufferLength);
}

function stopMic() {
  if (micSource) {
    micSource.disconnect();
    micSource = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
}

// file mode: element → analyser → speakers
function spectra(file) {
  if (!file) return;
  ensureAudio();
  stopMic();

  const reader = new FileReader();
  reader.onload = (e) => {
    audio.src = e.target.result;
    audio.play();
  };
  reader.readAsDataURL(file);

  if (!elementSource) {
    elementSource = audioCtx.createMediaElementSource(audio);
  }
  analyserNode.disconnect();
  elementSource.disconnect();
  elementSource.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);
}

// mic mode: stream → analyser (not to speakers — no feedback)
async function startMic() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  ensureAudio();
  audio.pause();
  if (elementSource) elementSource.disconnect();
  analyserNode.disconnect();

  micStream = stream;
  micSource = audioCtx.createMediaStreamSource(stream);
  micSource.connect(analyserNode);
}

// ---- idle placeholder -----------------------------------------------------
// Before any audio is playing, show a gently drifting synthetic spectrum:
// layered sines + smooth noise over frequency, same red-amplitude mapping
// but dimmer — replaced by the real analyser the moment audio starts.

const IDLE_BINS = 128;
const idleArray = new Float32Array(IDLE_BINS);

function idleSpectrum(t) {
  for (let i = 0; i < IDLE_BINS; i++) {
    const f = i / IDLE_BINS;
    // pink-noise-ish downward slope over frequency
    let db = -52 - f * 55;
    // slow-drifting broad humps (layered sines over frequency + time)
    db += 16 * Math.sin(f * 9.0 - t * 0.45) * Math.exp(-f * 1.6);
    db += 10 * Math.sin(f * 21.0 + t * 0.3 + Math.sin(t * 0.11) * 4.0);
    db += 7 * Math.sin(f * 47.0 - t * 0.8 + 1.7);
    // fine per-bar shimmer (deterministic pseudo-noise, slow)
    db += 5 * Math.sin(i * 12.9898 + t * (0.9 + ((i * 7919) % 13) / 26));
    // gentle overall breathing
    db += 6 * Math.sin(t * 0.23);
    idleArray[i] = Math.min(db, -18);
  }
  return idleArray;
}

// ---- draw loop ------------------------------------------------------------

function draw() {
  requestAnimationFrame(draw);

  // Draw black background
  canvasCtx.fillStyle = 'rgb(0, 0, 0)';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  if (!analyserNode || !dataArray) {
    // idle: synthetic placeholder spectrum, dimmer than the live one
    const t = performance.now() / 1000;
    const synth = idleSpectrum(t);
    const barWidth = (canvas.width / IDLE_BINS) * 2.5;
    let posX = 0;
    for (let i = 0; i < IDLE_BINS; i++) {
      const barHeight = (synth[i] + 140) * params.gain;
      const r = Math.floor((barHeight + 100) * 0.72);
      canvasCtx.fillStyle = 'rgb(' + r + ', 36, 36)';
      canvasCtx.fillRect(posX, canvas.height - barHeight / 2, barWidth, barHeight / 2);
      posX += barWidth + 1;
    }
    return;
  }

  // Get spectrum data
  analyserNode.getFloatFrequencyData(dataArray);

  // Draw spectrum
  const barWidth = (canvas.width / bufferLength) * 2.5;
  let posX = 0;
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] + 140) * params.gain;
    canvasCtx.fillStyle = 'rgb(' + Math.floor(barHeight + 100) + ', 50, 50)';
    canvasCtx.fillRect(posX, canvas.height - barHeight / 2, barWidth, barHeight / 2);
    posX += barWidth + 1;
  }
}
draw();

// ---- chrome wiring --------------------------------------------------------

const controls = document.getElementById('controls');
const fileInput = document.getElementById('file-input');
const filePick = document.getElementById('file-pick');
const micBtn = document.getElementById('mic');
const gate = document.getElementById('gate');
const gateNote = document.getElementById('gate-note');
const gateEnable = document.getElementById('gate-enable');
const gateCancel = document.getElementById('gate-cancel');

Standard.param(controls, params, {
  id: 'gain', label: 'bar gain', min: 0.5, max: 6, step: 0.1, value: params.gain,
  fmt: (v) => v.toFixed(1),
});
// keep the buttons below the slider
controls.appendChild(micBtn);
controls.appendChild(filePick);
controls.appendChild(fileInput);

document.getElementById('fft').addEventListener('change', (e) => {
  setFFT(parseInt(e.target.value, 10));
});

fileInput.addEventListener('change', function () {
  spectra(this.files[0]);
});
filePick.addEventListener('click', () => fileInput.click());

// mic gate: the ctrl button opens the overlay card; the card's button
// carries the actual getUserMedia gesture
micBtn.addEventListener('click', () => {
  gateNote.textContent = 'spectra listens locally — nothing is recorded or uploaded';
  gate.classList.add('visible');
});
gateCancel.addEventListener('click', () => gate.classList.remove('visible'));
gateEnable.addEventListener('click', async () => {
  try {
    await startMic();
    gate.classList.remove('visible');
  } catch (err) {
    console.warn('microphone unavailable:', err);
    gateNote.textContent = 'microphone unavailable — check browser permissions';
  }
});

// drag-drop an audio file anywhere
['dragenter', 'dragover'].forEach((t) =>
  document.addEventListener(t, (e) => {
    e.stopPropagation();
    e.preventDefault();
  })
);
document.addEventListener('drop', (e) => {
  e.stopPropagation();
  e.preventDefault();
  spectra(e.dataTransfer.files[0]);
});
