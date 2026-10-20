(() => {
  const gallery = document.querySelector('.process-gallery');
  if (!gallery) return;
  const header = document.querySelector('.nav');
  const posters = [...gallery.querySelectorAll('.process-poster')];
  const surfaces = [...document.querySelectorAll('[data-header-theme]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  function render() {
    frame = 0;
    const region = gallery.getBoundingClientRect();
    const nav = header.getBoundingClientRect();
    const navCentre = nav.top + nav.height / 2;
    const surface = surfaces.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.top <= navCentre && rect.bottom > navCentre;
    }).at(-1);
    header.classList.toggle('is-on-dark', surface?.dataset.headerTheme === 'dark');
    if (region.bottom < 0 || region.top > innerHeight) return;
    const top = parseFloat(getComputedStyle(gallery).getPropertyValue('--poster-top')) || 112;
    const stacking = !reduced.matches && innerHeight > 650;
    const rects = posters.map(poster => poster.getBoundingClientRect());
    rects.forEach((rect, index) => {
      const next = rects[index + 1];
      const covered = stacking && next ? Math.max(0, Math.min(1, 1 - (next.top - top) / rect.height)) : 0;
      posters[index].style.setProperty('--poster-scale', String(1 - covered * .025));

    });
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(render); }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  reduced.addEventListener('change', schedule);
  new ResizeObserver(schedule).observe(document.body);
  schedule();
})();
