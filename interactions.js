/* Demo data: replace with confirmed creation years and WhatsApp number. */
const siteConfig = {
  years: { favn: '2024', mbl: '2025', kod: '2025', pollo: '2024', media: '2025' },
  whatsapp: '', // International format, digits only, e.g. country code + number.
};
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = siteConfig.years[el.dataset.year] || '—'; });
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const header = document.querySelector('.nav');
const sectionLinks = [...header.querySelectorAll('[data-section]')];
const trackedSections = ['cases', 'studio', 'contact'].map(id => document.getElementById(id));
const previewScrollUpdates = [];
let scrollFrame;
function updateScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const compact = header.classList.contains('is-compact') ? scrollY > 60 : scrollY > 110;
  header.classList.toggle('is-compact', compact);
  const studioLink = sectionLinks.find(link => link.dataset.section === 'studio');
  studioLink.tabIndex = innerWidth <= 700 && !compact ? -1 : 0;
  header.style.setProperty('--progress', max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0);
  const activationLine = Math.min(innerHeight * .3, 220);
  let active = '';
  trackedSections.forEach(section => {
    if (section.getBoundingClientRect().top <= activationLine) active = section.id;
  });
  if (max > 0 && scrollY >= max - 3) active = 'contact';
  sectionLinks.forEach(link => {
    const selected = link.dataset.section === active;
    link.classList.toggle('is-active', selected);
    if (selected) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  const previewLine = header.getBoundingClientRect().bottom;
  previewScrollUpdates.forEach(update => update(previewLine));
  scrollFrame = null;
}
addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }, { passive: true });
addEventListener('resize', updateScroll);
updateScroll();
const word = document.querySelector('#typed-word');
const typeButton = document.querySelector('.type-toggle');
const phrases = ['характером.', 'ясной идеей.', 'вашим почерком.', 'точным смыслом.', 'сильной подачей.'];
let phrase = 0, cursor = phrases[0].length, deleting = false, timer, userPaused = false, heroVisible = true;
function canType() { return !motion.matches && !userPaused && !document.hidden && heroVisible; }
function schedule(delay = 2000) { clearTimeout(timer); if (canType()) timer = setTimeout(type, delay); }
function type() {
  if (!canType()) return;
  let delay;
  if (!deleting && cursor === phrases[phrase].length) { deleting = true; delay = 240; }
  else if (deleting && cursor > 0) { cursor--; delay = 29; }
  else if (deleting) { deleting = false; phrase = (phrase + 1) % phrases.length; delay = 230; }
  else { cursor++; delay = 64 + (cursor % 3) * 17; if (cursor === phrases[phrase].length) delay = 2200; }
  word.textContent = phrases[phrase].slice(0,cursor);
  schedule(delay);
}
function resetType() { clearTimeout(timer); phrase = 0; cursor = phrases[0].length; deleting = false; word.textContent = phrases[0]; schedule(); }
typeButton.addEventListener('click', () => {
  userPaused = !userPaused;
  typeButton.setAttribute('aria-pressed', String(userPaused));
  typeButton.setAttribute('aria-label', userPaused ? 'Включить смену заголовка' : 'Остановить смену заголовка');
  typeButton.textContent = userPaused ? '▷' : 'Ⅱ';
  if (userPaused) { clearTimeout(timer); word.textContent = phrases[phrase]; cursor = phrases[phrase].length; deleting = false; } else schedule();
});
new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; if (heroVisible) schedule(); else clearTimeout(timer); }).observe(document.querySelector('.hero'));
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else schedule(); });
motion.addEventListener('change', resetType);
schedule();
const mobilePreviews = matchMedia('(max-width: 700px)');
document.querySelectorAll('.scroll-preview').forEach(preview => {
  let hovered = false, focused = false;
  function setPreview(on) {
    const playing = on && !motion.matches;
    preview.classList.toggle('is-open', on);
    preview.classList.toggle('is-playing', playing);
  }
  function syncPreview(line = header.getBoundingClientRect().bottom) {
    const rect = preview.getBoundingClientRect();
    const visible = rect.bottom > line && rect.top < innerHeight;
    const active = mobilePreviews.matches
      ? !motion.matches && rect.top <= line
      : hovered || focused;
    setPreview(!document.hidden && visible && active);
  }
  previewScrollUpdates.push(syncPreview);
  preview.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hovered = true; syncPreview(); } });
  preview.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hovered = false; syncPreview(); } });
  preview.addEventListener('focus', () => { focused = preview.matches(':focus-visible'); syncPreview(); });
  preview.addEventListener('blur', () => { focused = false; syncPreview(); });
  new IntersectionObserver(entries => { if (!entries[0].isIntersecting) setPreview(false); }).observe(preview);
  motion.addEventListener('change', () => syncPreview());
  mobilePreviews.addEventListener('change', () => syncPreview());
  document.addEventListener('visibilitychange', () => syncPreview());
  syncPreview();
});
const services = [...document.querySelectorAll('.services > details')];
services.forEach(detail => {
  const summary = detail.querySelector('summary');
  summary.addEventListener('pointermove', e => {
    if (motion.matches || e.pointerType !== 'mouse') return;
    const rect = summary.getBoundingClientRect();
    const inset = Math.min(220, rect.width / 2);
    const x = Math.max(inset, Math.min(rect.width - inset, e.clientX - rect.left));
    summary.style.setProperty('--pointer-x', `${x}px`);
  }, { passive: true });
  detail.addEventListener('toggle', () => {
    if (detail.open) services.forEach(other => { if (other !== detail) other.open = false; });
    updateScroll();
  });
});
const dialog = document.querySelector('#whatsapp-dialog');
document.querySelectorAll('.whatsapp-demo').forEach(button => button.addEventListener('click', () => {
  if (siteConfig.whatsapp && /^\d{7,15}$/.test(siteConfig.whatsapp)) window.open(`https://wa.me/${siteConfig.whatsapp}`, '_blank', 'noopener');
  else dialog.showModal();
}));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if(e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) dialog.close(); } });

// Stop decorative motion outside the viewport and in background tabs.
const animatedCells = [...document.querySelectorAll('.split-cell')];
const artObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  entry.target.classList.toggle('art-visible', entry.isIntersecting);
}), { threshold: .08 });
animatedCells.forEach(cell => artObserver.observe(cell));
function syncArtVisibility() { document.body.classList.toggle('page-hidden', document.hidden); }
document.addEventListener('visibilitychange', syncArtVisibility);
syncArtVisibility();
new ResizeObserver(() => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }).observe(document.body);

// Cycle accent colours once per selection gesture; preserve native selection.
const selectionPalette=[['#3a36ff','#ffffff'],['#caff7e','#19191d']];
let selectionAccent=0;
function nextSelectionAccent(){
  const [background,ink]=selectionPalette[selectionAccent++%selectionPalette.length];
  document.documentElement.style.setProperty('--selection-bg',background);
  document.documentElement.style.setProperty('--selection-ink',ink);
}
document.addEventListener('selectstart',nextSelectionAccent);
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a')nextSelectionAccent();
});
