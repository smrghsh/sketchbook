/* the-standard — tiny helpers for wiring the overlay chrome.
   Classic script: exposes window.Standard. Works alongside p5
   global mode and three.js modules alike. */

(function () {
  // Bind a range slider to a params object (glass's seeding version:
  // DOM is seeded FROM params, so URL overrides show in the UI).
  // Convention: <input id="X"> pairs with readout <span id="X-value">.
  function bind(params, id, fmt, apply) {
    const el = document.getElementById(id);
    const label = document.getElementById(id + '-value');
    el.value = params[id];
    if (label) label.textContent = fmt(params[id]);
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      if (label) label.textContent = fmt(v);
      apply(v);
    });
  }

  // Build a .param block (label + slider + readout) from a descriptor,
  // so min/max/step/default live in one place in JS.
  // spec: { id, label, min, max, step, value, fmt, apply }
  function param(container, params, spec) {
    const fmt = spec.fmt || ((v) => String(v));
    params[spec.id] = spec.value;
    const div = document.createElement('div');
    div.className = 'param';
    div.innerHTML =
      '<div class="param-label"><span>' +
      spec.label +
      '</span><span id="' +
      spec.id +
      '-value"></span></div>' +
      '<input id="' +
      spec.id +
      '" type="range" min="' +
      spec.min +
      '" max="' +
      spec.max +
      '" step="' +
      spec.step +
      '" />';
    container.appendChild(div);
    bind(params, spec.id, fmt, spec.apply || ((v) => (params[spec.id] = v)));
  }

  // Momentary button helper: .active while held (dandelion-wish's blow).
  function holdButton(el, onDown, onUp) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('active');
      if (onDown) onDown();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) =>
      el.addEventListener(t, () => {
        el.classList.remove('active');
        if (onUp) onUp();
      })
    );
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  window.Standard = { bind, param, holdButton };
})();
