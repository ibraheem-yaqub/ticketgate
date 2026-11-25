/* =========================================================================
   TickGate · inner pages. Each block only runs when its page's markup exists.
   ========================================================================= */
import { CONFIG, $, $$, RM, gsap, ScrollTrigger, Flip, HAS_GSAP, copyText } from './core.js';
import * as M from './motion.js';

/* ---------------- protocol: flow player ---------------- */
{
  const steps = $$('#flowSteps li'), groups = $$('#flowSvg [data-step]'), play = $('#flowPlay'), dot = $('#flowDot');
  if (steps.length) {
    let cur = -1, timer = null;
    const set = i => {
      cur = i;
      steps.forEach((s, k) => s.classList.toggle('on', k === i));
      groups.forEach(g => {
        const on = +g.dataset.step <= i;
        g.querySelector('.msg').classList.toggle('on', on); g.querySelector('.lbl').classList.toggle('on', on);
      });
      const path = groups[i]?.querySelector('.msg');
      if (!path || !dot) return;
      if (RM || !HAS_GSAP) { const p = path.getPointAtLength(path.getTotalLength()); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('opacity', 1); return; }
      const len = path.getTotalLength(), o = { t: 0 };
      gsap.killTweensOf(o);
      gsap.to(o, { t: 1, duration: .9, ease: 'power2.inOut', onStart: () => dot.setAttribute('opacity', 1),
        onUpdate: () => { const p = path.getPointAtLength(len * o.t); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); } });
    };
    const stop = () => { clearInterval(timer); timer = null; play.setAttribute('aria-pressed', 'false'); play.textContent = '▶ Play flow'; };
    play.addEventListener('click', () => {
      if (timer) return stop();
      play.setAttribute('aria-pressed', 'true'); play.textContent = '❚❚ Pause';
      let i = cur >= 5 ? -1 : cur;
      const tick = () => { i = (i + 1) % 6; set(i); if (i === 5) setTimeout(() => timer && stop(), 1400); };
      tick(); timer = setInterval(tick, 1700);
    });
    steps.forEach(s => {
      const go = () => { stop(); set(+s.dataset.i); };
      s.addEventListener('click', go);
      s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    set(0);
    // auto-play once when the diagram scrolls into view
    if (HAS_GSAP && !RM) ScrollTrigger.create({ trigger: '#flowSvg', start: 'top 70%', once: true, onEnter: () => { if (!timer) play.click(); } });
  }
}

/* ---------------- protocol: quote anatomy hover ---------------- */
{
  const anat = $('#anat');
  if (anat) {
    const on = f => $$('[data-f]', anat).forEach(el => el.classList.toggle('on', el.dataset.f === f));
    $$('[data-f]', anat).forEach(el => {
      el.addEventListener('pointerenter', () => on(el.dataset.f));
      el.addEventListener('focus', () => on(el.dataset.f));
    });
    anat.addEventListener('pointerleave', () => on(null));
    $$('dl div', anat).forEach(d => d.tabIndex = 0);
  }
}

/* ---------------- shared: filter tabs + search over a list ---------------- */
function filterList({ items, tabs, search, empty, text }) {
  let cat = 'all', q = '';
  const apply = () => {
    const state = (HAS_GSAP && Flip && !RM) ? Flip.getState(items) : null;
    let shown = 0;
    items.forEach(it => {
      const ok = (cat === 'all' || it.dataset.cat === cat) && (!q || text(it).includes(q));
      it.classList.toggle('is-hidden', !ok); if (ok) shown++;
    });
    if (empty) empty.hidden = shown > 0;
    if (state) Flip.from(state, { duration: .5, ease: 'power3.inOut', absolute: false, onEnter: els => gsap.fromTo(els, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .4 }) });
  };
  tabs.forEach(t => t.addEventListener('click', () => {
    cat = t.dataset.filter; tabs.forEach(b => b.setAttribute('aria-pressed', String(b === t))); apply();
  }));
  search?.addEventListener('input', () => { q = search.value.trim().toLowerCase(); apply(); });
}

/* ---------------- endpoints ---------------- */
{
  const list = $('#epList');
  if (list) {
    filterList({ items: $$('.ep', list), tabs: $$('.ep-tools .tab'), search: $('#epSearch'), empty: $('#epEmpty'), text: el => el.dataset.q });
    // open from hash, e.g. endpoints.html#v1-depth
    $$('.ep', list).forEach(d => d.addEventListener('toggle', () => {
      if (d.open && HAS_GSAP && !RM) gsap.from(d.querySelector('.ep-body'), { opacity: 0, y: -10, duration: .4, ease: 'power2.out', clearProps: 'all' });
    }));
  }
}

/* ---------------- faq ---------------- */
{
  const list = $('#faqList');
  if (list) {
    filterList({ items: $$('details', list), tabs: $$('.faq-tools .tab'), search: $('#faqSearch'), empty: $('#faqEmpty'), text: el => el.textContent.toLowerCase() });
    if (location.hash) { const d = document.querySelector(location.hash); if (d?.tagName === 'DETAILS') d.open = true; }
    if (HAS_GSAP && !RM) gsap.from($$('details', list), { y: 30, opacity: 0, duration: .6, stagger: .04, ease: 'power3.out', clearProps: 'transform,opacity',
      scrollTrigger: { trigger: list, start: 'top 90%', once: true } });
  }
}

/* ---------------- docs: scrollspy, filter, code tabs ---------------- */
{
  const side = $('.docs-side');
  if (side) {
    const links = $$('a[href^="#"]', side), secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const mark = id => links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
    let raf = 0;
    const spy = () => { raf = 0; let cur = secs[0]; for (const s of secs) if (s.getBoundingClientRect().top < innerHeight * .3) cur = s; mark(cur.id); };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(spy); }, { passive: true }); spy();
    const fs = $('#docSearch');
    fs?.addEventListener('input', () => {
      const q = fs.value.trim().toLowerCase();
      links.forEach(a => {
        const sec = document.querySelector(a.getAttribute('href'));
        a.parentElement.hidden = !!q && !(a.textContent.toLowerCase().includes(q) || sec?.textContent.toLowerCase().includes(q));
      });
    });
    if (HAS_GSAP && !RM) $$('.doc section').forEach(s => gsap.from(s, { opacity: 0, duration: .8, ease: 'power2.out', clearProps: 'opacity', scrollTrigger: { trigger: s, start: 'top 88%', once: true } }));
  }
  $$('.code-tabs').forEach(box => {
    const tabs = $$('.code-tab', box);
    const select = t => tabs.forEach(b => { const on = b === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; document.getElementById(b.getAttribute('aria-controls')).hidden = !on; });
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = tabs[(i + 1) % tabs.length]; select(n); n.focus(); } });
    });
  });
}

/* ---------------- token: contract address from CONFIG ---------------- */
{
  const caText = $('#caText'), caCopy = $('#caCopy');
  if (caText && CONFIG.ca) {
    caText.textContent = 'CA: ' + CONFIG.ca; caCopy.disabled = false; caCopy.removeAttribute('title');
    caCopy.addEventListener('click', async () => { const ok = await copyText(CONFIG.ca); caCopy.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(() => caCopy.textContent = 'Copy', 1600); });
  }
}

/* ---------------- roadmap: rail fills as you scroll ---------------- */
{
  const tl = $('#timeline');
  if (tl) {
    const rail = $('.rail', tl), phases = $$('.phase', tl);
    const upd = () => {
      const r = tl.getBoundingClientRect(), mid = innerHeight * .6;
      const h = Math.max(0, Math.min(r.height - 16, mid - r.top));
      rail.style.height = h + 'px';
      phases.forEach(p => p.classList.toggle('lit', p.getBoundingClientRect().top + 36 < mid || p.querySelector('.pill.done')));
    };
    if (RM) { rail.style.height = 'calc(100% - 16px)'; phases.forEach(p => p.classList.add('lit')); }
    else { addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd(); }
  }
}

/* ---------------- early access: the gate lifts on a valid application ---------------- */
{
  const form = $('form[data-demo-form="eaMsg"]'), arm = $('.ea-arm');
  if (form && arm) form.addEventListener('submit', () => {
    setTimeout(() => { if ($('#eaMsg').textContent.startsWith('Thanks')) arm.classList.add('open'); }, 0);
  });
}
