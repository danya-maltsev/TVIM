// Show the intro only when this script runs; failed or disabled JS leaves the page usable.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const started = performance.now();
  const held = new Map();
  let loader, observer, closing = false, removed = false;
  let deadline, fallbackTimer, holdTimer, exitTimer;

  function remove() {
    removed = true;
    clearTimeout(deadline);
    clearTimeout(fallbackTimer);
    clearTimeout(holdTimer);
    clearTimeout(exitTimer);
    observer?.disconnect();
    root.classList.remove('is-loading');
    held.forEach((wasInert, element) => { element.inert = wasInert; });
    held.clear();
    document.getElementById('site-loader')?.remove();
    document.removeEventListener('keydown', skip);
  }

  function skip(event) {
    // Keyboard users can immediately reach the site, without waiting for decoration.
    if (event.key === 'Tab' || event.key === 'Escape') remove();
  }

  function finish() {
    if (closing || removed) return;
    closing = true;
    clearTimeout(fallbackTimer);
    observer?.disconnect();
    loader.style.setProperty('--load-progress', '1');
    holdTimer = setTimeout(() => {
      loader.classList.add('is-leaving');
      exitTimer = setTimeout(remove, reduced.matches ? 0 : 550);
    }, reduced.matches ? 0 : Math.max(300, 850 - (performance.now() - started)));
  }

  root.classList.add('is-loading');
  // Independent of fonts, images, WebGL and the rest of the site's scripts.
  deadline = setTimeout(remove, 4200);
  document.addEventListener('keydown', skip);
  addEventListener('pagehide', remove, { once: true });
  addEventListener('pageshow', event => { if (event.persisted) remove(); });

  document.addEventListener('DOMContentLoaded', () => {
    if (removed) { document.getElementById('site-loader')?.remove(); return; }
    loader = document.getElementById('site-loader');
    if (!loader) { remove(); return; }
    for (const element of document.body.children) {
      if (element === loader || element.tagName === 'SCRIPT') continue;
      held.set(element, element.inert);
      element.inert = true;
    }

    let fontReady = false, sceneReady = false;
    function update() {
      if (removed || closing) return;
      loader.style.setProperty('--load-progress', String(.3 + (fontReady ? .3 : 0) + (sceneReady ? .3 : 0)));
      if (fontReady && sceneReady) finish();
    }
    update();
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      fontReady = true;
      update();
    });
    const scene = document.getElementById('scene');
    sceneReady = !scene || scene.classList.contains('ready');
    if (!sceneReady) {
      observer = new MutationObserver(() => {
        if (scene.classList.contains('ready')) {
          sceneReady = true;
          observer.disconnect();
          update();
        }
      });
      observer.observe(scene, { attributes: true, attributeFilter: ['class'] });
    }
    update();
    // Use the existing hero fallback if 3D or fonts are slow/unavailable.
    fallbackTimer = setTimeout(finish, Math.max(0, 3000 - (performance.now() - started)));
  }, { once: true });
})();
