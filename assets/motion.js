/* =========================================================================
   TickGate · motion layer. Coin-op / vinyl / toll-gate motion language:
   expo/power4 for reveals, elastic/back for mechanical beats, linear for
   spins and tapes. Everything here is additive: with reduced motion, no JS
   or no GSAP the page is complete and readable without it.
   ========================================================================= */
import { $, $$, RM, FINE, gsap, ScrollTrigger, Flip, HAS_GSAP, lenis } from './core.js';

export const ON = HAS_GSAP && !RM;
const page = document.documentElement.dataset.page || '';
const svgNS = 'http://www.w3.org/2000/svg';

/* ---------------- helpers ---------------- */
// run fn once when el is about to enter the viewport (lazy-init per section)
export function whenNear(el, fn, margin = '300px') {
  if (!el) return;
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: margin });
  io.observe(el);
}
// pause/resume a looping thing when its element leaves/enters the viewport or the tab hides
export function whileVisible(el, start, stop) {
  let vis = false;
  const sync = () => (vis && !document.hidden) ? start() : stop();
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; sync(); }).observe(el);
  document.addEventListener('visibilitychange', sync);
}
// split text nodes into per-char spans (keeps inline wrappers like <em>/<strong>); screen readers get the original text
export function splitChars(el) {
  if (el.dataset.split) return $$('.ch', el);
  el.dataset.split = '1';
  if (!el.hasAttribute('aria-label')) { const lns = $$('.ln', el); el.setAttribute('aria-label', (lns.length ? lns.map(l => l.textContent.trim()).join(' ') : el.textContent).replace(/\s+/g, ' ').trim()); }
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(word => {
          if (!word) return;
          if (/^\s+$/.test(word)) { frag.appendChild(document.createTextNode(word)); return; }
          const w = document.createElement('span'); w.className = 'wd'; w.setAttribute('aria-hidden', 'true');
          [...word].forEach(c => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; w.appendChild(s); });
          frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
  // gradient text (<em>) can't clip across split chars, so give each char its own slice of the same gradient
  const ems = $$('em', el).filter(em => getComputedStyle(em).backgroundImage !== 'none');
  if (ems.length) {
    el.classList.add('grad-split');
    const fit = () => ems.forEach(em => {
      // offsets (not rects) so in-flight transforms never skew the slices
      const cs = $$('.ch', em); if (!cs.length) return;
      const x0 = Math.min(...cs.map(c => c.offsetLeft)), x1 = Math.max(...cs.map(c => c.offsetLeft + c.offsetWidth));
      cs.forEach(c => { c.style.backgroundSize = `${x1 - x0}px 100%`; c.style.backgroundPosition = `${x0 - c.offsetLeft}px 0`; });
    });
    fit(); addEventListener('resize', fit); document.fonts?.ready.then(fit);
  }
  return $$('.ch', el);
}
// rubber-stamp slam
export function stamp(el, { rot = -10, from = 2.4 } = {}) {
  if (!ON || !el) return;
  gsap.fromTo(el, { scale: from, rotate: rot - 14, opacity: 0 }, { scale: 1, rotate: rot, opacity: 1, duration: .42, ease: 'back.out(2.6)', overwrite: true });
}
// 2px, one-frame jolt
export function shake(el) {
  if (!ON || !el) return;
  gsap.fromTo(el, { x: 2, y: -1 }, { x: 0, y: 0, duration: .06, ease: 'none', clearProps: 'transform' });
}
// a 2D coin flying along an arc from one element to another
export function coinFly(fromEl, toEl, { size = 44, duration = .75 } = {}) {
  return new Promise(res => {
    if (!ON || !fromEl || !toEl) return res();
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const c = document.createElement('div'); c.className = 'fly-coin';
    c.innerHTML = '<svg viewBox="0 0 512 512"><use href="#tg-icon"/></svg>';
    c.style.width = c.style.height = size + 'px';
    document.body.appendChild(c);
    const x0 = a.left + a.width / 2 - size / 2, y0 = a.top + a.height / 2 - size / 2;
    const x1 = b.left + b.width / 2 - size / 2, y1 = b.top + b.height * .35 - size / 2;
    const peak = Math.min(y0, y1) - 140;
    gsap.set(c, { x: x0, y: y0, rotateY: 0 });
    const tl = gsap.timeline({ onComplete: () => { c.remove(); res(); } });
    tl.to(c, { x: x1, duration, ease: 'power1.inOut' }, 0)
      .to(c, { y: peak, duration: duration * .45, ease: 'power2.out' }, 0)
      .to(c, { y: y1, duration: duration * .55, ease: 'power2.in' }, duration * .45)
      .to(c, { rotateY: 720, duration, ease: 'none' }, 0)
      .to(c, { scale: .4, opacity: 0, duration: .18, ease: 'power2.in' }, duration - .05);
  });
}
// confetti made of tiny coins; one canvas, removed when done
export function coinBurst(x, y, n = 42) {
  if (!ON) return;
  const cv = document.createElement('canvas'), dpr = Math.min(devicePixelRatio || 1, 2);
  cv.className = 'burst'; cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  document.body.appendChild(cv);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const cols = ['#e86a66', '#f2a19c', '#b3242b', '#f8c9c4'];
  const P = Array.from({ length: n }, (_, i) => ({ x, y, vx: (Math.random() - .5) * 9, vy: -Math.random() * 11 - 5, r: 5 + Math.random() * 5, s: Math.random() * 6, vs: .2 + Math.random() * .3, c: cols[i % 4] }));
  const t0 = performance.now();
  const step = now => {
    const t = now - t0; g.clearRect(0, 0, innerWidth, innerHeight);
    P.forEach(p => {
      p.vy += .38; p.x += p.vx; p.y += p.vy; p.s += p.vs;
      const w = Math.abs(Math.cos(p.s)) * p.r;          // coin seen edge-on as it flips
      g.globalAlpha = Math.max(0, 1 - t / 1500);
      g.fillStyle = p.c; g.beginPath(); g.ellipse(p.x, p.y, Math.max(.8, w), p.r, 0, 0, 7); g.fill();
      g.fillStyle = '#0b0a0a'; g.beginPath(); g.ellipse(p.x, p.y, Math.max(.3, w * .42), p.r * .42, 0, 0, 7); g.fill();
    });
    if (t < 1500) requestAnimationFrame(step); else cv.remove();
  };
  requestAnimationFrame(step);
}
// mechanical odometer: each digit is a vertical strip that rolls to its value
export function odometer(el) {
  const final = el.dataset.odo || el.textContent.trim();
  el.setAttribute('aria-label', final);
  if (!ON) { el.textContent = final; return; }
  el.textContent = ''; el.classList.add('odo-on');
  const strips = [];
  [...final].forEach(ch => {
    if (/\d/.test(ch)) {
      const col = document.createElement('span'); col.className = 'odo'; col.setAttribute('aria-hidden', 'true');
      const strip = document.createElement('span'); strip.className = 'odo-s';
      strip.textContent = '0123456789'.split('').join('\n') + '\n' + '0123456789'.split('').join('\n');
      col.appendChild(strip); el.appendChild(col); strips.push([strip, +ch]);
    } else { const s = document.createElement('span'); s.textContent = ch; s.setAttribute('aria-hidden', 'true'); el.appendChild(s); }
  });
  whenNear(el, () => {
    strips.forEach(([s, d], i) => gsap.fromTo(s, { yPercent: 0 }, { yPercent: -(10 + d) * 5, duration: 1.4 + i * .18, ease: 'power3.out', delay: .1 }));
  }, '-10% 0px');
}

/* ---------------- 13. page transitions: toll-gate wipe ---------------- */
{
  const root = document.documentElement;
  if (ON) {
    root.classList.remove('tg-enter-done');
    if (root.classList.contains('tg-enter')) setTimeout(() => root.classList.replace('tg-enter', 'tg-enter-done'), 900);
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
      if (url.pathname === location.pathname && url.hash) return;   // same-page anchor
      e.preventDefault();
      try { sessionStorage.setItem('tg-wipe', '1'); } catch (_) { }
      root.classList.add('tg-leave');
      setTimeout(() => { location.href = url.href; }, 430);
    });
    // back/forward cache: never come back with the curtain down
    addEventListener('pageshow', e => { if (e.persisted) root.classList.remove('tg-leave', 'tg-enter'); });
  }
}

/* ---------------- 14. coin cursor (desktop, fine pointer only) ---------------- */
if (ON && FINE && matchMedia('(hover: hover)').matches) {
  const cur = document.createElement('div'); cur.className = 'cur'; cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML = '<span class="cur-coin"><svg viewBox="0 0 512 512"><use href="#tg-icon"/></svg></span><span class="cur-t">PAY</span>';
  document.body.appendChild(cur);
  const coin = cur.firstElementChild;
  const xTo = gsap.quickTo(cur, 'x', { duration: .18, ease: 'power3' }), yTo = gsap.quickTo(cur, 'y', { duration: .18, ease: 'power3' });
  let shown = false;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    if (!shown) { shown = true; document.documentElement.classList.add('has-cur'); gsap.set(cur, { x: e.clientX, y: e.clientY }); }
    xTo(e.clientX); yTo(e.clientY);
    const t = e.target.closest?.('a, button, summary, select, label, [role=tab], .ep summary');
    cur.classList.toggle('hot', !!t);
    cur.classList.toggle('pay', !!t?.matches('.btn-crimson'));
    cur.classList.toggle('txt', !!e.target.closest?.('input, textarea, [contenteditable]'));
  }, { passive: true });
  addEventListener('pointerdown', () => gsap.fromTo(coin, { rotateY: 0 }, { rotateY: 180, duration: .45, ease: 'back.out(2)' }));
  addEventListener('keydown', e => { if (e.key === 'Tab') { shown = false; document.documentElement.classList.remove('has-cur'); } });
  document.addEventListener('mouseleave', () => { shown = false; document.documentElement.classList.remove('has-cur'); });
}

/* ---------------- 15. groove dividers pulse once after drawing in ---------------- */
if (ON) $$('.groove').forEach(g => ScrollTrigger.create({ trigger: g, start: 'top 92%', once: true,
  onEnter: () => setTimeout(() => { const hot = g.querySelector('.hot'); if (hot) gsap.fromTo(hot, { opacity: .7 }, { opacity: 1, duration: .25, yoyo: true, repeat: 3, ease: 'power1.inOut' }); }, 1500) }));

/* ---------------- 16. text links: letter ripple ---------------- */
if (ON && FINE) $$('.nav-links a, .foot ul a, .crumbs a, .docs-side a, .doc p a, .faq-a a').forEach(a => {
  if (a.children.length) return;
  const t = a.textContent; a.setAttribute('aria-label', t); a.textContent = '';
  [...t].forEach((c, i) => { const s = document.createElement('span'); s.className = 'rp'; s.style.setProperty('--i', i); s.setAttribute('aria-hidden', 'true'); s.textContent = c === ' ' ? ' ' : c; a.appendChild(s); });
  a.classList.add('ripple');
});

/* ---------------- 17. buttons: squash on press, elastic release ---------------- */
if (ON) $$('.btn, .copy-btn, .tab, .lc-step, .code-tab').forEach(b => {
  b.addEventListener('pointerdown', () => { if (!b.disabled) gsap.to(b, { scale: .96, duration: .1, ease: 'power2.out' }); });
  const up = () => gsap.to(b, { scale: 1, duration: .6, ease: 'elastic.out(1.1,.35)' });
  b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
});

/* ---------------- 19. inner page hero entrances ---------------- */
if (ON) {
  const art = $('.page-hero .ph-art');
  if (page === 'protocol' && art) {
    const paths = $$('.sq', art);
    paths.forEach(p => { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; });
    gsap.timeline({ delay: .5 })
      .from($$('.sq-nodes rect', art), { scaleY: 0, transformOrigin: '50% 50%', duration: .5, stagger: .08, ease: 'back.out(2)' })
      .to(paths, { strokeDashoffset: 0, duration: .45, stagger: .28, ease: 'power2.inOut' }, '-=.1')
      .from($$('.sq-l', art), { opacity: 0, y: 6, duration: .3, stagger: .28 }, '<.15');
  }
  if (page === 'docs' && art) {
    const lines = $$('.term-lines text', art), caret = $('.docs-caret', art);
    gsap.set(lines, { clipPath: 'inset(0 100% 0 0)' });
    const tl = gsap.timeline({ delay: .5 });
    lines.forEach(l => tl.to(l, { clipPath: 'inset(0 0% 0 0)', duration: .35, ease: 'steps(18)' }));
    if (caret) tl.from(caret, { opacity: 0, duration: .2 });
  }
  if (page === 'endpoints' && art) {
    gsap.fromTo($$('.sl1', art), { rotation: -30 }, { rotation: 10, svgOrigin: '225 175', duration: 1.1, ease: 'elastic.out(1,.55)', delay: .55 });
    gsap.fromTo($$('.sl2', art), { rotation: 18 }, { rotation: -6, svgOrigin: '200 200', duration: 1.1, ease: 'elastic.out(1,.55)', delay: .65 });
    gsap.from($('.disc-peek', art), { y: 120, duration: 1, ease: 'expo.out', delay: .9 });
  }
  if (page === 'token' && art) gsap.from($('.coin3d', art), { rotateY: -720, scale: .3, y: -160, duration: 1.6, ease: 'expo.out', delay: .4, clearProps: 'transform' });
  if (page === 'roadmap' && art) {
    const p = $$('[data-stroke]', art);
    p.forEach(x => { x.setAttribute('pathLength', '1'); x.style.strokeDasharray = '1'; x.style.strokeDashoffset = '1'; x.removeAttribute('data-stroke'); });
    gsap.timeline({ delay: .5 }).to(p, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' })
      .from($$('circle', art), { scale: 0, transformOrigin: '50% 50%', duration: .5, stagger: .25, ease: 'back.out(3)' }, .2);
  }
  if (page === 'early-access') {
    const arm = $('.ea-arm');
    if (arm) gsap.timeline({ delay: .7 }).to(arm, { rotation: -62, svgOrigin: '207 168', duration: .8, ease: 'back.out(1.8)' })
      .to(arm, { rotation: 0, svgOrigin: '207 168', duration: .9, ease: 'bounce.out', clearProps: 'transform' }, '+=.7');
  }
}

/* ---------------- 20. docs: sliding indicator + code type-on ---------------- */
{
  const side = $('.docs-side');
  if (side) {
    const bar = document.createElement('span'); bar.className = 'side-ind'; bar.setAttribute('aria-hidden', 'true'); side.appendChild(bar);
    const move = () => {
      const on = $('a.on', side); if (!on || on.parentElement.hidden) { bar.style.opacity = 0; return; }
      const r = on.getBoundingClientRect(), s = side.getBoundingClientRect();
      bar.style.opacity = 1;
      const y = r.top - s.top + side.scrollTop;
      ON ? gsap.to(bar, { y, scaleY: r.height / 20, duration: .45, ease: 'expo.out' }) : gsap?.set?.(bar, { y, scaleY: r.height / 20 });
    };
    new MutationObserver(move).observe(side, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    move();
  }
  if (ON) $$('.doc pre code, .page-docs .doc-code pre code').forEach(code => {
    whenNear(code, () => {
      const pre = code.closest('pre'); if (pre.hidden || code.dataset.typed) return;
      code.dataset.typed = '1';
      code.innerHTML = code.innerHTML.split('\n').map(l => `<span class="cl">${l || ' '}</span>`).join('');
      gsap.from($$('.cl', code), { opacity: 0, x: -14, duration: .3, stagger: .055, ease: 'power2.out', clearProps: 'all' });
    }, '-15% 0px');
  });
}

/* ---------------- 18. progress coin riding the tape ---------------- */
{
  const coin = $('.tape-coin');
  if (coin) {
    const upd = () => {
      const m = document.documentElement.scrollHeight - innerHeight, p = m > 0 ? Math.min(1, scrollY / m) : 0;
      coin.style.transform = `translateX(${p * (innerWidth - 16)}px) rotate(${p * 1440}deg)`;
    };
    if (HAS_GSAP) gsap.ticker.add(upd); else addEventListener('scroll', upd, { passive: true });
    upd();
  }
}

/* ---------------- 21. FAQ: elastic icon (CSS) + stagger on open ---------------- */
if (ON) $$('details.acc').forEach(d => d.addEventListener('toggle', () => {
  if (!d.open) return;
  const a = d.querySelector('.faq-a');
  gsap.fromTo(a, { clipPath: 'inset(0 0 100% 0)', y: -6 }, { clipPath: 'inset(0 0 0% 0)', y: 0, duration: .6, ease: 'power3.out', clearProps: 'clipPath,transform' });
}));

/* ---------------- generic: headings reveal per word (inner pages + sections) ---------------- */
if (ON) $$('.band .h2:not(.hl), .doc h2').forEach(h => {
  splitChars(h);
  gsap.from($$('.wd', h), { yPercent: 90, opacity: 0, rotate: 4, duration: .7, stagger: .05, ease: 'power4.out',
    scrollTrigger: { trigger: h, start: 'top 90%', once: true } });
});

/* ---------------- endpoints: 3D flip on filter (Flip enter) ---------------- */
if (ON && page === 'endpoints') $$('.ep-tools .tab').forEach(t => t.addEventListener('click', () => {
  requestAnimationFrame(() => gsap.fromTo($$('.ep:not(.is-hidden)'), { rotateX: -70, opacity: 0, transformPerspective: 900, transformOrigin: '50% 0%' },
    { rotateX: 0, opacity: 1, duration: .6, stagger: .05, ease: 'back.out(1.4)', clearProps: 'transform,opacity' }));
}));
