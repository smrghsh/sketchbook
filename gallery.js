/* gallery strip: thumbnails + prev/next, sketch below in an iframe.
   Deep link with #slug; arrow keys navigate. */

(function () {
  const strip = document.getElementById('strip');
  const viewer = document.getElementById('viewer');
  const sketches = window.SKETCHES;
  let current = -1;

  sketches.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'thumb';
    b.setAttribute('role', 'option');
    b.title = s.title;
    b.innerHTML =
      '<img loading="lazy" src="thumbs/' + s.slug + '.png" alt="" ' +
      "onerror=\"this.style.display='none'\" />" +
      '<span class="thumb-label">' + s.title + '</span>';
    b.addEventListener('click', () => select(i));
    strip.appendChild(b);
  });

  function select(i, replace) {
    if (!sketches.length) return;
    i = (i + sketches.length) % sketches.length;
    if (i === current) return;
    current = i;
    const s = sketches[i];
    viewer.src = 'sketches/' + s.slug + '/';
    document.title = s.title + ' · sketchbook';
    [...strip.children].forEach((el, j) =>
      el.classList.toggle('selected', j === i)
    );
    strip.children[i].scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
    if (replace) history.replaceState(null, '', '#' + s.slug);
    else history.pushState(null, '', '#' + s.slug);
  }

  function fromHash() {
    const slug = location.hash.slice(1);
    const i = sketches.findIndex((s) => s.slug === slug);
    select(i === -1 ? 0 : i, true);
  }

  document.getElementById('prev').addEventListener('click', () =>
    select(current - 1)
  );
  document.getElementById('next').addEventListener('click', () =>
    select(current + 1)
  );

  // arrow keys work even when the iframe has focus, via its blur trick:
  // keydown only reaches us when the top document has focus.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') select(current - 1);
    if (e.key === 'ArrowRight') select(current + 1);
  });

  window.addEventListener('popstate', fromHash);
  fromHash();
})();
