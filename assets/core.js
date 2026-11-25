/* =========================================================================
   TickGate · shared site core (every page). Pre-launch preview.
   Nav, smooth scroll, reveal motion, marquees, progress tape, cursor light,
   magnetic buttons, text scramble, copy buttons. All motion is skipped under
   prefers-reduced-motion, and everything degrades if GSAP fails to load.
   ========================================================================= */
export const CONFIG = {
  ca: "",                                   // token contract: "announced at launch" until set
  x: "https://x.com/ticketgaterh",
  telegram: "",
  site: "https://tickgate.live",
  api: "api.tickgate.live",                 // API not live yet · pre-launch
};

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const FINE = matchMedia('(pointer: fine)').matches;
export const root = document.documentElement;
export const gsap = window.gsap;
export const ScrollTrigger = window.ScrollTrigger;
export const Flip = window.Flip;
export const HAS_GSAP = !!(gsap && ScrollTrigger);
if (HAS_GSAP) gsap.registerPlugin(ScrollTrigger, ...(Flip ? [Flip] : []));
export const wait = ms => new Promise(r => setTimeout(r, ms));
root.classList.add('js');

$$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

/* ---------------- config-driven links ---------------- */
$$('[data-x-link]').forEach(a => { if (CONFIG.x) a.href = CONFIG.x; else a.hidden = true; });
$$('[data-tg-link]').forEach(a => { if (CONFIG.telegram) a.href = CONFIG.telegram; else a.hidden = true; });

/* ---------------- smooth scroll ---------------- */
export let lenis = null;
if (!RM && HAS_GSAP) {
  try {
    const { default: Lenis } = await import('lenis');
    lenis = new Lenis({ lerp: .1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } catch (e) { lenis = null; }
}
export const scrollToEl = (target, offset = 0) => {
  const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY + offset;
  if (lenis) lenis.scrollTo(y, { duration: 1.2 });
  else scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
};
// same-page hash links only; cross-page links navigate normally
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href');
  if (id === '#') return;
  const el = id === '#top' ? document.body : document.querySelector(id);
  if (!el) return;
  e.preventDefault();
  closeMenu();
  scrollToEl(id === '#top' ? 0 : el, -((nav?.offsetHeight || 68) + 14));
  history.replaceState(null, '', id);
}));
if (location.hash && lenis) {
  const el = document.querySelector(location.hash);
  if (el) addEventListener('load', () => setTimeout(() => scrollToEl(el, -((nav?.offsetHeight || 68) + 14)), 60));
}

/* ---------------- nav ---------------- */
const nav = $('#nav'), menuBtn = $('.menu-btn'), menu = $('#mobile-menu');
const darkSecs = $$('.label').filter(s => !s.closest('#nav'));
const tape = $('.progress-tape i');
const onScrollNav = () => {
  if (!nav) return;
  nav.classList.toggle('scrolled', scrollY > 12);
  const y = nav.offsetHeight / 2;
  nav.classList.toggle('on-dark', darkSecs.some(s => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom >= y; }));
  if (tape) { const m = document.documentElement.scrollHeight - innerHeight; tape.style.transform = `scaleX(${m > 0 ? Math.min(1, scrollY / m) : 0})`; }
};
if (HAS_GSAP) gsap.ticker.add(onScrollNav);
addEventListener('scroll', onScrollNav, { passive: true }); onScrollNav();
export function closeMenu() { if (!menu) return; menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.setAttribute('aria-label', 'Open menu'); }
menuBtn?.addEventListener('click', () => {
  const open = menu.hidden;
  menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  if (open) menu.querySelector('a').focus();
});
addEventListener('keydown', e => { if (e.key === 'Escape' && menu && !menu.hidden) { closeMenu(); menuBtn.focus(); } });
// active page in nav
{
  const page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  $$('.nav-links a, .mobile-menu a').forEach(a => {
    const p = (a.getAttribute('href') || '').split('#')[0].replace(/\.html$/, '');
    if (p && p === page) a.setAttribute('aria-current', 'page');
  });
}

/* ---------------- text scramble (eyebrows) ---------------- */
const GLYPHS = '▮▯░▒█01$#/:·';
export function scramble(el, dur = 700) {
  const final = el.dataset.text || el.textContent; el.dataset.text = final;
  if (RM) { el.textContent = final; return; }
  const t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / dur), n = Math.floor(final.length * p);
    let out = final.slice(0, n);
    for (let i = n; i < final.length; i++) out += final[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = out;
    if (p < 1) requestAnimationFrame(step); else el.textContent = final;
  };
  requestAnimationFrame(step);
}

/* ---------------- section motion ---------------- */
export function reveal(scope = document) {
  if (!(HAS_GSAP && !RM)) { $$('.groove', scope).forEach(g => g.setAttribute('viewBox', '0 0 1200 64')); return; }
  $$('[data-slide]', scope).forEach(el => {
    if (el.closest('.hero')) return;
    const dir = el.dataset.slide === 'right' ? 1 : el.dataset.slide === 'up' ? 0 : -1;
    gsap.from(el, { x: 80 * dir, y: dir === 0 ? 50 : 0, skewX: 4 * dir, opacity: 0, duration: .9, ease: 'power3.out', clearProps: 'transform',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  $$('[data-stagger]', scope).forEach(group => {
    gsap.from(group.children, { y: 40, opacity: 0, duration: .8, stagger: .08, ease: 'power3.out', clearProps: 'transform,opacity',
      scrollTrigger: { trigger: group, start: 'top 86%', once: true } });
  });
  $$('.hl', scope).forEach(h => {
    if (h.closest('.hero')) return;
    gsap.fromTo(h.querySelectorAll('.ln > span'), { yPercent: 105, clipPath: 'inset(0 0 100% 0)' },
      { yPercent: 0, clipPath: 'inset(0 0 -25% 0)', duration: 1, stagger: .12, ease: 'power4.out',
        scrollTrigger: { trigger: h, start: 'top 86%', once: true } });
  });
  $$('.eyebrow', scope).forEach(e => {
    if (e.closest('.hero')) return;
    ScrollTrigger.create({ trigger: e, start: 'top 90%', once: true, onEnter: () => scramble(e) });
  });
  const sym = $('#groove');
  if (sym) $$('.groove', scope).forEach(g => {
    // <use> content can't be styled per-path from outside, so inline the arcs for draw-in
    g.removeChild(g.firstElementChild);
    g.setAttribute('viewBox', sym.getAttribute('viewBox')); g.setAttribute('preserveAspectRatio', 'xMidYMax meet');
    const grp = document.createElementNS('http://www.w3.org/2000/svg', 'g'); grp.setAttribute('filter', 'url(#mfd)');
    $$('path', sym).forEach(p => { const c = p.cloneNode(); c.setAttribute('pathLength', '1'); c.style.strokeDasharray = '1'; c.style.strokeDashoffset = '1'; grp.appendChild(c); });
    g.appendChild(grp);
    gsap.to(grp.children, { strokeDashoffset: 0, duration: 1.6, stagger: .12, ease: 'power2.inOut', scrollTrigger: { trigger: g, start: 'top 92%', once: true } });
  });
  // draw-in strokes on illustrations
  $$('[data-draw]', scope).forEach(svg => {
    const paths = $$('[data-stroke]', svg);
    paths.forEach(p => { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; });
    gsap.to(paths, { strokeDashoffset: 0, duration: 1.4, stagger: .1, ease: 'power2.inOut', scrollTrigger: { trigger: svg, start: 'top 85%', once: true } });
  });
}

/* page hero entrance (inner pages) */
export function pageHero() {
  const h = $('.page-hero'); if (!h) return;
  if (!(HAS_GSAP && !RM)) return;
  const tl = gsap.timeline({ delay: .05, defaults: { ease: 'power3.out' } });
  const eb = $('.eyebrow', h);
  tl.from(eb, { y: 14, opacity: 0, duration: .5, onStart: () => scramble(eb) })
    .fromTo($$('.hl .ln > span', h), { yPercent: 110, clipPath: 'inset(0 0 100% 0)' }, { yPercent: 0, clipPath: 'inset(0 0 -25% 0)', duration: 1.05, stagger: .12, ease: 'power4.out' }, '-=.25')
    .from($$('.ph-in', h), { y: 18, opacity: 0, duration: .6, stagger: .08 }, '-=.6')
    .from($$('.ph-art', h), { scale: .86, opacity: 0, rotate: -8, duration: 1.1, ease: 'expo.out' }, '-=.9');
}

/* count-ups */
const fmt = (v, dec, pre, suf) => pre + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
export function countUps(scope = document) {
  $$('[data-count]', scope).forEach(el => {
    const target = +el.dataset.count, dec = +(el.dataset.dec || 0), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    if (!HAS_GSAP || RM) { el.textContent = fmt(target, dec, pre, suf); return; }
    const o = { v: 0 }; el.textContent = fmt(0, dec, pre, suf);
    gsap.to(o, { v: target, duration: 1.8, ease: 'power2.out', onUpdate: () => el.textContent = fmt(o.v, dec, pre, suf),
      scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
}

/* 3D tilt cards */
export function bindTilt(el) {
  if (!HAS_GSAP || RM || !FINE) return;
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    gsap.to(el, { rotateY: x * 12, rotateX: -y * 12, transformPerspective: 900, duration: .4, ease: 'power2.out' });
  });
  el.addEventListener('pointerleave', () => gsap.to(el, { rotateX: 0, rotateY: 0, duration: .7, ease: 'elastic.out(1,.6)' }));
}

/* magnetic buttons */
function bindMagnet(el) {
  if (!HAS_GSAP || RM || !FINE) return;
  const xTo = gsap.quickTo(el, 'x', { duration: .5, ease: 'power3' }), yTo = gsap.quickTo(el, 'y', { duration: .5, ease: 'power3' });
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * .25); yTo((e.clientY - r.top - r.height / 2) * .35); });
  el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
}

/* marquees: velocity-reactive, each track can run reversed */
export function marquees() {
  if (!(HAS_GSAP && !RM)) return;
  $$('.mq-track').forEach(track => {
    const dirn = track.dataset.dir === 'rev' ? -1 : 1;
    let x = dirn > 0 ? 0 : -track.scrollWidth / 2, speed = 1, lastY = scrollY, vis = true;
    new IntersectionObserver(([en]) => vis = en.isIntersecting).observe(track);
    gsap.ticker.add((t, dt) => {
      if (!vis) return;
      const vel = lenis ? Math.abs(lenis.velocity) : Math.abs(scrollY - lastY); lastY = scrollY;
      const target = 1 + Math.min(vel * .35, 9);
      speed += (target - speed) * (target > speed ? .2 : .04);
      x -= dirn * speed * Math.min(dt, 50) * .07;
      const w = track.scrollWidth / 2; if (-x >= w) x += w; if (x > 0) x -= w;
      track.style.transform = `translate3d(${x}px,0,0)`;
    });
  });
}

/* cursor light on dark bands (one rAF-throttled listener) */
function cursorLight() {
  if (RM || !FINE) return;
  let px = 0, py = 0, raf = 0;
  addEventListener('pointermove', e => {
    px = e.clientX; py = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const el = document.elementFromPoint(px, py)?.closest('.ex-card, .label, .glow-zone');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${px - r.left}px`); el.style.setProperty('--my', `${py - r.top}px`);
    });
  }, { passive: true });
}

/* clipboard */
export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) { } ta.remove(); return ok;
  }
}
$$('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
  const src = btn.dataset.copy ? document.getElementById(btn.dataset.copy) : btn.closest('.code-card, .doc-code')?.querySelector('pre:not([hidden]) code, pre code');
  if (!src) return;
  const ok = await copyText(src.textContent);
  const was = btn.textContent; btn.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(() => btn.textContent = was, 1600);
}));

/* light syntax highlight for static code blocks */
export const hl = src => src.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  .replace(/(\/\/[^\n]*|#[^\n]*)|(f?"[^"\n]*"|'[^'\n]*'|`[^`\n]*`)|\b(async|await|function|const|let|if|else|throw|new|return|def|raise|not|is|import|from|export|for|of|in)\b|\b(\d+(?:\.\d+)?)\b/g,
    (m, c, s, k, n) => c ? `<span class="c-c">${c}</span>` : s ? `<span class="c-s">${s}</span>` : k ? `<span class="c-k">${k}</span>` : `<span class="c-f">${n}</span>`);
$$('pre[data-hl] code').forEach(c => c.innerHTML = hl(c.textContent));

/* FAQ / details: smooth height animation */
$$('details.acc').forEach(d => {
  const sum = d.querySelector('summary'), body = d.querySelector('.faq-a');
  if (!body || RM || !HAS_GSAP) return;
  sum.addEventListener('click', e => {
    e.preventDefault();
    if (d.open) gsap.to(body, { height: 0, opacity: 0, duration: .35, ease: 'power2.inOut', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'height,opacity' }); } });
    else { d.open = true; gsap.from(body, { height: 0, opacity: 0, duration: .45, ease: 'power2.out', clearProps: 'height,opacity' }); }
  });
});

/* front-end-only forms (waitlist / early access): validate, confirm, store nothing */
$$('form[data-demo-form]').forEach(f => {
  const msg = document.getElementById(f.dataset.demoForm);
  f.addEventListener('submit', e => {
    e.preventDefault();
    const bad = [...f.elements].find(x => x.willValidate && !x.checkValidity());
    if (bad) { msg.textContent = bad.type === 'email' ? 'Please enter a valid email address.' : 'Please fill in the required fields.'; bad.focus(); return; }
    msg.textContent = f.dataset.okText || "Thanks. This is a pre-launch demo: nothing was sent or stored.";
    f.reset();
  });
});

/* boot shared motion */
$$('[data-tilt]').forEach(bindTilt);
$$('.btn-crimson, .btn-magnet').forEach(bindMagnet);
cursorLight();
marquees();
countUps();
reveal();
pageHero();
if (HAS_GSAP) addEventListener('load', () => ScrollTrigger.refresh());
