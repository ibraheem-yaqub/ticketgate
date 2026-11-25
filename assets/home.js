/* =========================================================================
   TickGate · home page. Pre-launch preview. All data is sample data. No network
   calls are made by the simulator; nothing is stored. Shared behaviour
   (nav, smooth scroll, reveals, marquees, copy) lives in core.js.
   ========================================================================= */
import { CONFIG, $, $$, RM, FINE, root, gsap, ScrollTrigger, Flip, HAS_GSAP, wait, lenis, scrollToEl, bindTilt, copyText, hl } from './core.js';
import * as M from './motion.js';

const fire = step => window.dispatchEvent(new CustomEvent('tgate', { detail: step }));
window.__tgate = { dropped: false, lenis };

/* ---------------- marble (canvas, domain-warped fbm) ---------------- */
function makeMarble(W = 512, H = 256) {
  const PX = 8, PY = 4;
  let seed = 90210;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const L = new Float32Array(256 * 256); for (let i = 0; i < L.length; i++) L[i] = rnd();
  const vn = (x, y, px, py) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = L[x0 * 256 + y0], b = L[x1 * 256 + y0], c = L[x0 * 256 + y1], d = L[x1 * 256 + y1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (x, y) => { let v = 0, a = .5, f = 1; for (let o = 0; o < 4; o++) { v += a * vn(x * f, y * f, PX * f, PY * f); f *= 2; a *= .5; } return v; };
  const col = document.createElement('canvas'); col.width = W; col.height = H;
  const tint = document.createElement('canvas'); tint.width = W; tint.height = H;
  const ci = col.getContext('2d').createImageData(W, H), ti = tint.getContext('2d').createImageData(W, H);
  const coral = [232, 106, 102], light = [242, 161, 156], glow = [248, 201, 196], crim = [179, 36, 43], deep = [110, 20, 24];
  const toLin = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  const toS = l => 255 * (l <= .0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - .055);
  const coralLin = coral.map(toLin);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = i / W * PX, y = j / H * PY;
    const qx = fbm(x, y), qy = fbm(x + 5.2, y + 1.3);
    const f = fbm(x + 3.5 * qx, y + 3.5 * qy);
    const ph = (i / W) * Math.PI * 2 * 3 + f * 11;
    const s = Math.abs(Math.sin(ph));
    const vein = Math.pow(1 - s, 9), soft = Math.pow(1 - s, 2.5), core = Math.pow(1 - s, 40);
    let c = mix(coral, light, ss(.42, .72, f));
    c = mix(c, glow, ss(.66, .85, f) * .7);
    c = mix(c, crim, Math.min(1, vein * .85 + soft * .28));
    c = mix(c, deep, core * .55);
    const k = (j * W + i) * 4;
    ci.data[k] = c[0]; ci.data[k + 1] = c[1]; ci.data[k + 2] = c[2]; ci.data[k + 3] = 255;
    for (let n = 0; n < 3; n++) ti.data[k + n] = toS(Math.min(1, toLin(c[n]) / coralLin[n]));
    ti.data[k + 3] = 255;
  }
  col.getContext('2d').putImageData(ci, 0, 0); tint.getContext('2d').putImageData(ti, 0, 0);
  return { col, tint };
}
const MARBLE = makeMarble();
try { root.style.setProperty('--marble', `url(${MARBLE.col.toDataURL('image/jpeg', .86)})`); } catch (e) { /* keep gradient */ }

/* ---------------- hero entrance ---------------- */
const cmdText = $('#cmd-text');
const CMD = cmdText.textContent;
const dropTokens = () => { window.__tgate.dropped = true; window.dispatchEvent(new Event('tgate:drop')); };
async function typeCmd() {
  cmdText.textContent = '';
  for (let i = 1; i <= CMD.length; i++) { cmdText.textContent = CMD.slice(0, i); await wait(i < 6 ? 55 : 28); }
  await wait(200); dropTokens();
}
const h1 = $('.hero-h1');
window.__tgate.heroExit = 0;
if (M.ON) {
  const root = document.documentElement, stage = $('.intro-stage'), intro = root.classList.contains('intro');
  const chars = M.splitChars(h1), rhLine = $('.ln-rh', h1);
  const rhChars = $$('.ch', rhLine), mainChars = chars.filter(c => !rhLine.contains(c));
  const rest = ['.hero .eyebrow', '.hero .tagline', '.hero .sub', '.cmd-card', '.hero .actions > *', '.rh-badge'];
  cmdText.textContent = '';
  gsap.set(chars, { yPercent: 115, opacity: 0, rotate: 8 });
  gsap.set(rest, { opacity: 0, y: 18 });
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, onComplete: () => { gsap.set(chars, { clearProps: 'transform,opacity' }); magnetic(); } });
  // 1. intro: coin drops into the booth, the gate lifts, the curtain rises (once per session, ≤1.8s, skippable)
  if (intro && stage) {
    try { sessionStorage.setItem('tg-intro', '1'); } catch (e) { }
    stage.style.animation = 'none';                       // JS owns it now; the CSS safety net is for no-JS
    const coin = $('.i-coin', stage), arm = $('.i-arm', stage), lamp = $('.i-lamp', stage);
    tl.fromTo(coin, { y: -80 }, { y: 150, duration: .34, ease: 'power2.in' })
      .set(coin, { opacity: 0 })
      .set(lamp, { attr: { fill: '#3fbf72' } })
      .to(arm, { rotation: -62, svgOrigin: '208 115', duration: .3, ease: 'back.out(2.2)' })
      .to(stage, { yPercent: -100, duration: .4, ease: 'expo.inOut', onComplete: () => { root.classList.remove('intro'); gsap.set(stage, { clearProps: 'all' }); } });
    const skip = () => { if (tl.progress() < 1) tl.progress(1); off(); };
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const off = () => evs.forEach(ev => removeEventListener(ev, skip));
    evs.forEach(ev => addEventListener(ev, skip, { passive: true }));
    tl.eventCallback('onComplete', () => { off(); root.classList.remove('intro'); gsap.set(chars, { clearProps: 'transform,opacity' }); magnetic(); });
  } else root.classList.remove('intro');
  // H1 char reveal; "On Robinhood Chain." lands last with a stamp
  tl.to(mainChars, { yPercent: 0, opacity: 1, rotate: 0, duration: .5, stagger: .016 }, intro ? '-=.22' : .1)
    .to(rhChars, { yPercent: 0, opacity: 1, rotate: 0, duration: .4, stagger: .012 }, '-=.25')
    .add(() => M.stamp($('strong.rh', h1), { rot: 0, from: 1.5 }))
    .to(rest, { opacity: 1, y: 0, duration: .5, stagger: .06, ease: 'power3.out', clearProps: 'transform,opacity' }, '-=.35')
    .add(() => { typeCmd(); }, '-=.3');

  // 2. letters lean toward the cursor (fine pointers only)
  function magnetic() {
    if (!FINE || h1.dataset.mag) return; h1.dataset.mag = '1';
    const q = chars.map(c => ({ c, x: gsap.quickTo(c, 'x', { duration: .5, ease: 'power3' }), y: gsap.quickTo(c, 'y', { duration: .5, ease: 'power3' }) }));
    let raf = 0, px = 0, py = 0;
    const hero = $('.hero');
    hero.addEventListener('pointermove', e => {
      px = e.clientX; py = e.clientY; if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        q.forEach(o => {
          const r = o.c.getBoundingClientRect(), dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2), d = Math.hypot(dx, dy);
          const f = Math.max(0, 1 - d / 160);
          o.x(dx * .18 * f); o.y(dy * .18 * f);
        });
      });
    });
    hero.addEventListener('pointerleave', () => q.forEach(o => { o.x(0); o.y(0); }));
  }
  // 3. scroll-scrubbed exit: headline scales and blurs out, the 3D coin rolls down the ribbon
  gsap.to(h1, { scale: .9, opacity: .1, filter: 'blur(8px)', transformOrigin: '0% 50%', ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .4, onUpdate: self => window.__tgate.heroExit = self.progress } });
} else { document.documentElement.classList.remove('intro'); dropTokens(); }

/* ---------------- 4. why-per-call: pinned, statements swap with a mask wipe ---------------- */
if (M.ON && matchMedia('(min-width: 901px)').matches) {
  const why = $('.why'), stmts = $$('.why .stmt'), chips = stmts.map(s => s.querySelector('.chip'));
  ScrollTrigger.getAll().filter(st => stmts.includes(st.trigger)).forEach(st => { st.animation?.progress(1); st.kill(); });
  gsap.set(stmts, { clearProps: 'transform,opacity' });
  why.classList.add('pinned');
  gsap.set(stmts.slice(1), { clipPath: 'inset(0 0 0 100%)' });
  let last = -1;
  gsap.timeline({ scrollTrigger: { trigger: why, start: 'top top', end: '+=170%', pin: true, scrub: .6,
    onUpdate: self => { const i = Math.min(2, Math.floor(self.progress * 2.999)); if (i !== last) { last = i; M.stamp(chips[i], { rot: -3 }); } } } })
    .to(stmts[0], { clipPath: 'inset(0 100% 0 0)', duration: 1, ease: 'power2.inOut' }, .6)
    .to(stmts[1], { clipPath: 'inset(0 0 0 0%)', duration: 1, ease: 'power2.inOut' }, .6)
    .to(stmts[1], { clipPath: 'inset(0 100% 0 0)', duration: 1, ease: 'power2.inOut' }, 2.2)
    .to(stmts[2], { clipPath: 'inset(0 0 0 0%)', duration: 1, ease: 'power2.inOut' }, 2.2)
    .to({}, { duration: .6 });
} else if (M.ON) $$('.why .chip').forEach(c => ScrollTrigger.create({ trigger: c, start: 'top 88%', once: true, onEnter: () => M.stamp(c, { rot: -3 }) }));

/* ---------------- 5. odometer stats ---------------- */
$$('[data-odo]').forEach(M.odometer);

/* ---------------- lifecycle ---------------- */
{
  const sec = $('#how'), track = $('#lcTrack'), steps = $$('.lc-step'), bar = $('.lc-bar i'), play = $('.lc-play');
  let cur = 0, timer = null, mode = 'carousel', st = null;
  const setStep = p => {
    const i = Math.max(0, Math.min(3, Math.round(p * 3)));
    if (bar) bar.style.width = `${25 + p * 75}%`;
    if (i !== cur) { M.stamp($('.lc-stamp'), { rot: -10, from: 2.2 }); M.shake(sec); }   // 6. 402 stamp slam + 1-frame jolt
    cur = i;
    steps.forEach((s, k) => k === i ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current'));
  };
  const goTo = i => {
    if (mode === 'pin' && st) scrollToEl(st.start + (st.end - st.start) * (i / 3) + 1);
    else track.scrollTo({ left: i * track.clientWidth, behavior: RM ? 'auto' : 'smooth' });
  };
  steps.forEach(s => s.addEventListener('click', () => { stop(); goTo(+s.dataset.i); }));
  const stop = () => { clearInterval(timer); timer = null; play.setAttribute('aria-pressed', 'false'); play.textContent = '▶'; play.setAttribute('aria-label', 'Play lifecycle'); };
  play.addEventListener('click', () => {
    if (timer) return stop();
    play.setAttribute('aria-pressed', 'true'); play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pause lifecycle');
    let i = cur >= 3 ? 0 : cur; goTo(i);
    timer = setInterval(() => { i = (i + 1) % 4; goTo(i); }, 2400);
  });
  track.addEventListener('scroll', () => { if (mode === 'carousel') setStep(track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth)); }, { passive: true });
  if (HAS_GSAP && !RM) {
    const mm = gsap.matchMedia();
    mm.add('(min-width: 721px)', () => {
      mode = 'pin'; sec.classList.add('pin-mode'); track.scrollLeft = 0;
      const dist = () => track.scrollWidth - innerWidth;
      const tw = gsap.to(track, { x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: sec, pin: true, start: 'top top', end: () => '+=' + dist(), scrub: .6, invalidateOnRefresh: true,
          onUpdate: self => setStep(self.progress) } });
      st = tw.scrollTrigger;
      return () => { mode = 'carousel'; sec.classList.remove('pin-mode'); st = null; };
    });
  }
  setStep(0);
}

/* ---------------- try it (state machine, simulated) ---------------- */
{
  const PRICES = { '/v1/price': '0.001', '/v1/depth': '0.003', '/v1/history': '0.01' };
  const BASE = { 'STK·A': 182.40, 'STK·B': 64.15, 'ETF·X': 411.80 };
  const out = $('#termOut'), form = $('#tryForm'), ep = $('#ep'), sym = $('#sym'), send = $('#sendBtn'), coin = $('#coinBtn'), reset = $('#resetBtn'), chip = $('#countChip'), priceRead = $('#priceRead');
  const slotFb = $('#slotFallback');
  let run = 0, state = 'idle', countdown = null, left = 30, quote = null;
  const updPrice = () => priceRead.textContent = '$' + PRICES[ep.value];
  ep.addEventListener('change', updPrice); updPrice();
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const line = (html, cls = '') => { const d = document.createElement('div'); d.className = 'ln ' + cls; d.innerHTML = html; out.appendChild(d); out.scrollTop = out.scrollHeight; return d; };
  const jsonHTML = obj => esc(JSON.stringify(obj, null, 2))
    .replace(/&quot;|"/g, '"')
    .replace(/"([^"]+)":/g, '<span class="t-key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="t-str">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="t-num">$1</span>');
  async function typeLine(text, id) {
    const d = line(`<span class="ps">$</span> <span aria-hidden="true" class="ty"></span><span class="sr-only">${esc(text)}</span>`, 't-cmd typing');
    const ty = d.querySelector('.ty');
    for (let i = 1; i <= text.length; i++) { if (id !== run) { d.classList.remove('typing'); return false; } ty.textContent = text.slice(0, i); out.scrollTop = out.scrollHeight; await wait(RM ? 0 : 14); }
    d.classList.remove('typing');
    return id === run;
  }
  const hex = n => { let s = ''; const a = new Uint8Array(n); crypto.getRandomValues(a); a.forEach(b => s += b.toString(16).padStart(2, '0')); return s; };
  const setBtns = (s, c) => { send.disabled = !s; coin.disabled = !c; };
  const stopCount = () => { clearInterval(countdown); countdown = null; chip.hidden = true; chip.classList.remove('low'); };
  function payload(e, s) {
    const b = BASE[s]; const r = (k) => (Math.sin(k * 12.9898 + b) * 43758.5453) % 1;
    if (e === '/v1/price') {
      const last = b, spr = +(b * .0004).toFixed(2) || .01;
      return { html: jsonHTML({ symbol: s, last: last.toFixed(2), bid: (last - spr).toFixed(2), ask: (last + spr).toFixed(2), time: new Date().toISOString(), sample: true }) };
    }
    if (e === '/v1/depth') {
      let rows = '  <span class="t-dim">BID size      price │ price      ASK size</span>\n';
      for (let i = 0; i < 5; i++) {
        const bp = (b - .02 - i * .03).toFixed(2), ap = (b + .02 + i * .03).toFixed(2);
        const bs = String(Math.round(120 + Math.abs(r(i)) * 900)).padStart(8), as = String(Math.round(110 + Math.abs(r(i + 9)) * 900)).padEnd(8);
        rows += `  <span class="t-ok">${bs}</span>  ${bp.padStart(9)} │ ${ap.padEnd(9)}  <span class="t-402">${as}</span>\n`;
      }
      return { html: `<span class="t-dim">// ${esc(s)} · top 5×5 · sample</span>\n` + rows };
    }
    let rows = '<span class="t-dim">  time    open     high     low      close</span>\n';
    let p = b - 1.2; const now = new Date(); now.setSeconds(0, 0);
    for (let i = 9; i >= 0; i--) {
      const o = p, c = +(p + r(i + 3) * .9).toFixed(2), h = Math.max(o, c) + Math.abs(r(i + 5)) * .35, l = Math.min(o, c) - Math.abs(r(i + 7)) * .35;
      const t = new Date(now - i * 60000); const tt = t.toTimeString().slice(0, 5);
      rows += `  ${tt}  ${o.toFixed(2).padEnd(8)} ${h.toFixed(2).padEnd(8)} ${l.toFixed(2).padEnd(8)} ${c.toFixed(2)}\n`; p = c;
    }
    return { html: `<span class="t-dim">// ${esc(s)} · 1m OHLC · 10 rows · sample</span>\n` + rows };
  }
  function doReset() {
    run++; stopCount(); state = 'idle'; quote = null;
    out.innerHTML = '<div class="ln term-empty">// pick an endpoint and a symbol, then Send request.</div><div class="ln term-empty">// the meter answers 402 first. that\'s the point.</div><div class="ln term-empty">// api.tickgate.live · API not live yet · pre-launch</div>';
    setBtns(true, false); ep.disabled = sym.disabled = false;
    fire('reset');
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (state === 'requesting' || state === 'paying') return;
    const id = ++run; stopCount(); out.innerHTML = '';
    state = 'requesting'; setBtns(false, false); ep.disabled = sym.disabled = true;
    const e1 = ep.value, s1 = sym.value;
    const sr = $('#slotAnchor').getBoundingClientRect();   // keep the 3D slot in view for the drop
    if (innerWidth > 980 && (sr.top < 70 || sr.bottom > innerHeight)) scrollToEl($('#slotAnchor'), -90);
    fire('request');
    line('// api.tickgate.live · API not live yet · pre-launch · simulated round trip', 't-dim');
    if (!await typeLine(`curl -i "https://api.tickgate.live${e1}?symbol=${s1}"`, id)) return;
    await wait(RM ? 0 : 500); if (id !== run) return;
    line('HTTP/1.1 402 Payment Required', 't-402 pop');
    { const t = out.closest('.term'); t.classList.remove('flash402'); void t.offsetWidth; t.classList.add('flash402'); }
    line('content-type: application/json\nx-payment-chain: 4663\nx-payment-asset: USD stablecoin\nx-simulated: true', 't-dim');
    quote = { price: PRICES[e1], asset: 'USD stablecoin', chainId: 4663, payTo: '0x7A3c…9F02 (sample)', expiresIn: '30s' };
    line(jsonHTML(quote));
    fire('quote');
    state = 'quoted'; setBtns(false, true); coin.focus({ preventScroll: true });
    left = 30; chip.hidden = false; chip.textContent = `quote expires in ${left}s`;
    countdown = setInterval(() => {
      left--; chip.textContent = `quote expires in ${left}s`; chip.classList.toggle('low', left <= 10);
      if (left <= 0) {
        stopCount(); state = 'expired'; run++;
        line('quote expired · request again', 't-warn');
        setBtns(true, false); ep.disabled = sym.disabled = false;
      }
    }, 1000);
    window.__tgate.quote = { e1, s1 };
  });
  coin.addEventListener('click', async () => {
    if (state !== 'quoted') return;
    const id = ++run; stopCount(); state = 'paying'; setBtns(false, false);
    const { e1, s1 } = window.__tgate.quote;
    M.coinFly(coin, $('#slotAnchor'));                     // 7. a coin flies from the button into the toll booth
    line('signing… <span class="t-dim">(simulated, no wallet)</span>');
    await wait(RM ? 0 : 700); if (id !== run) return;
    line('settling on chain 4663… <span class="t-dim">(simulated)</span>');
    fire('pay');
    await wait(RM ? 0 : 1300); if (id !== run) return;
    line('✓ payment proof attached', 't-ok');
    if (!await typeLine(`curl -i -H "X-Payment: 0x${hex(6)}…(sample)" "https://api.tickgate.live${e1}?symbol=${s1}"`, id)) return;
    await wait(RM ? 0 : 400); if (id !== run) return;
    line('HTTP/1.1 200 OK', 't-200 slide-in');
    line('content-type: application/json\nx-receipt-chain: 4663\nx-simulated: true', 't-dim');
    line(payload(e1, s1).html);
    const tx = '0x' + hex(32);
    line(`<div class="t-rcpt print"><span class="t-key">── receipt ──</span>\nendpoint  ${esc(e1)}?symbol=${esc(s1)}\namount    ${PRICES[e1]} USD stablecoin\nchain     Robinhood Chain · 4663\ntx        ${tx}\n<span class="t-warn">sample receipt · not a real transaction</span></div>`);
    fire('data');
    state = 'done'; setBtns(true, false); ep.disabled = sym.disabled = false;
  });
  reset.addEventListener('click', doReset);
  window.addEventListener('tgate', e => {
    if (!slotFb) return;
    if (e.detail === 'quote') { slotFb.classList.add('pulse'); setTimeout(() => slotFb.classList.remove('pulse'), 900); }
    if (e.detail === 'pay') setTimeout(() => slotFb.classList.add('open'), RM ? 0 : 600);    // toll paid: arm lifts
    if (e.detail === 'request' || e.detail === 'reset') slotFb.classList.remove('open');     // arm lowers
  });
}

/* ---------------- endpoint crate ---------------- */
{
  const CARDS = [
    ['price', '/v1/price', 'Last, bid, ask and timestamp for one stock token.', '$0.001'],
    ['price', '/v1/price/batch', 'Up to 20 symbols, one payment.', '$0.001'],
    ['price', '/v1/price/spread', 'Bid/ask spread and mid price.', '$0.001'],
    ['depth', '/v1/depth', 'Top 5×5 order book levels.', '$0.003'],
    ['depth', '/v1/depth/full', 'Up to 50 levels per side.', '$0.003'],
    ['depth', '/v1/depth/imbalance', 'Bid/ask volume ratio at the top of book.', '$0.003'],
    ['history', '/v1/history', 'OHLC candles from 1m to 1d.', '$0.01'],
    ['history', '/v1/history/trades', 'Recent fills with size and side.', '$0.01'],
    ['history', '/v1/history/vwap', 'Volume-weighted average over a window.', '$0.01'],
  ];
  const crate = $('#crate');
  crate.innerHTML = CARDS.map(([cat, path, ret, price]) => `
    <article class="sleeve-card" data-cat="${cat}">
      <div class="disc" aria-hidden="true"></div>
      <div class="sleeve" tabindex="0">
        <div class="top"><span class="cat">${cat}</span><span class="chip sample">Sample</span></div>
        <div class="path">${path}</div>
        <p class="ret">${ret}</p>
        <div class="price"><strong>${price}</strong><span>/ call · illustrative</span></div>
      </div>
    </article>`).join('');
  const cards = $$('.sleeve-card', crate);
  cards.forEach(c => bindTilt(c.querySelector('.sleeve')));
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    const f = t.dataset.filter;
    $$('.tab').forEach(b => b.setAttribute('aria-pressed', String(b === t)));
    const state = (HAS_GSAP && Flip && !RM) ? Flip.getState(cards) : null;
    cards.forEach(c => c.classList.toggle('is-hidden', !(f === 'all' || c.dataset.cat === f)));
    if (state) Flip.from(state, { duration: .7, ease: 'power3.inOut', absolute: true, scale: true, stagger: .03,
      onEnter: els => gsap.fromTo(els, { opacity: 0, scale: .8, y: 40, rotateY: -80, transformPerspective: 900 }, { opacity: 1, scale: 1, y: 0, rotateY: 0, duration: .7, stagger: .05, ease: 'back.out(1.4)' }),
      onLeave: els => gsap.to(els, { opacity: 0, scale: .8, duration: .4 }) });
  }));
  if (HAS_GSAP && !RM) gsap.from(cards, { x: (i) => (i % 2 ? 80 : -80), skewX: (i) => (i % 2 ? 4 : -4), opacity: 0, duration: .9, ease: 'power3.out', stagger: .07, clearProps: 'transform,opacity',
    scrollTrigger: { trigger: crate, start: 'top 85%', once: true } });
}

/* ---------------- receipts: chart + printer ---------------- */
{
  const pts = [38, 31, 24, 19, 17, 22, 35, 52, 68, 81, 77, 72, 66, 74, 88, 94, 86, 71, 63, 58, 54, 49, 45, 40]; // sample
  const W = 600, H = 230, T = 14, B = 196, Lx = 34, Rx = 590, max = 100;
  const X = i => Lx + (Rx - Lx) * i / 23, Y = v => B - (B - T) * v / max;
  let d = `M${X(0)},${Y(pts[0])}`;
  for (let i = 1; i < 24; i++) { const cx = (X(i - 1) + X(i)) / 2; d += ` C${cx},${Y(pts[i - 1])} ${cx},${Y(pts[i])} ${X(i)},${Y(pts[i])}`; }
  $('#chartLine').setAttribute('d', d);
  $('#chartArea').setAttribute('d', d + ` L${X(23)},${B} L${X(0)},${B} Z`);
  const svgNS = 'http://www.w3.org/2000/svg';
  const grid = $('#chart .grid'), xl = $('#chart .xl');
  [0, 50, 100].forEach(v => { const l = document.createElementNS(svgNS, 'line'); l.setAttribute('x1', Lx); l.setAttribute('x2', Rx); l.setAttribute('y1', Y(v)); l.setAttribute('y2', Y(v)); grid.appendChild(l);
    const t = document.createElementNS(svgNS, 'text'); t.setAttribute('x', 0); t.setAttribute('y', Y(v) + 4); t.textContent = v; grid.appendChild(t); });
  ['00h', '06h', '12h', '18h', '23h'].forEach((s, k) => { const t = document.createElementNS(svgNS, 'text'); const i = [0, 6, 12, 18, 23][k]; t.setAttribute('x', X(i)); t.setAttribute('y', H - 8); t.setAttribute('text-anchor', k === 0 ? 'start' : k === 4 ? 'end' : 'middle'); t.textContent = s; xl.appendChild(t); });
  if (HAS_GSAP && !RM) {
    const ln = $('#chartLine'), len = ln.getTotalLength();
    gsap.set(ln, { strokeDasharray: len, strokeDashoffset: len });
    gsap.set('#chartClipRect', { attr: { width: 0 } });
    const tl = gsap.timeline({ scrollTrigger: { trigger: '#chart', start: 'top 82%', once: true } });
    tl.to(ln, { strokeDashoffset: 0, duration: 2, ease: 'power2.inOut' }).to('#chartClipRect', { attr: { width: W }, duration: 2, ease: 'power2.inOut' }, 0);
  }
  // 9. scanner: a dot rides the line showing sample values (runs only while visible)
  if (M.ON) {
    const svg = $('#chart'), g = document.createElementNS(svgNS, 'g'); g.setAttribute('class', 'scan');
    g.innerHTML = '<line y1="14" y2="196"/><circle class="dot" r="6"/><g class="tip"><rect x="-86" y="-34" width="172" height="24" rx="12"/><text text-anchor="middle" y="-17"></text></g>';
    svg.appendChild(g);
    const [vl, dot, tip] = [g.querySelector('line'), g.querySelector('circle'), g.querySelector('.tip')], txt = tip.querySelector('text');
    const o = { i: 0 };
    const draw = () => {
      const i = o.i, a = Math.floor(i), b = Math.min(23, a + 1), f = i - a, v = pts[a] + (pts[b] - pts[a]) * f;
      const x = X(i), y = Y(v);
      vl.setAttribute('x1', x); vl.setAttribute('x2', x); dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      tip.setAttribute('transform', `translate(${Math.min(Math.max(x, 92), W - 92)},${y})`);
      txt.textContent = `${String(a).padStart(2, '0')}h · ${Math.round(v)} calls · sample`;
    };
    gsap.set(g, { opacity: 0 });
    const scan = gsap.to(o, { i: 23, duration: 7, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true, onUpdate: draw });
    draw();
    ScrollTrigger.create({ trigger: svg, start: 'top 82%', once: true, onEnter: () => gsap.to(g, { opacity: 1, delay: 2, duration: .4, onStart: () => scan.play() }) });
    M.whileVisible(svg, () => { if (gsap.getProperty(g, 'opacity') > 0) scan.play(); }, () => scan.pause());
  }

  const list = $('#rcList');
  const EPS = [['/v1/price', '0.001'], ['/v1/depth', '0.003'], ['/v1/history', '0.01'], ['/v1/price/batch', '0.001']];
  const SY = ['STK·A', 'STK·B', 'ETF·X'];
  let n = 0;
  const mk = () => {
    const [e, p] = EPS[n % EPS.length], s = SY[n % 3]; n++;
    const a = new Uint8Array(4); crypto.getRandomValues(a); const h = [...a].map(b => b.toString(16).padStart(2, '0')).join('');
    const el = document.createElement('div'); el.className = 'rc';
    const t = new Date(Date.now() - (n % 9) * 37000).toTimeString().slice(0, 8);
    el.innerHTML = `<div class="r1"><span>#${String(1283 - n).padStart(4, '0')} · ${t}</span><span>$${p}</span></div><div>GET ${e}?symbol=${s}</div><div class="h">tx 0x${h}…${h.slice(2, 6)}e1 · chain 4663</div><div class="s">sample receipt</div>`;
    return el;
  };
  const push = (animate) => {
    const el = mk();
    const state = animate && Flip ? Flip.getState(list.children) : null;
    list.prepend(el);
    while (list.children.length > 5) list.lastElementChild.remove();
    if (animate) {
      if (state) Flip.from(state, { duration: .9, ease: 'power3.inOut' });
      gsap.fromTo(el, { yPercent: -105, clipPath: 'inset(100% 0 0 0)' }, { yPercent: 0, clipPath: 'inset(0% 0 0 0)', duration: .9, ease: 'power3.inOut' });
    }
  };
  for (let i = 0; i < 3; i++) push(false);
  if (HAS_GSAP && !RM) {
    let iv = null;
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !iv) { push(true); iv = setInterval(() => !document.hidden && push(true), 1600); }
      else if (!en.isIntersecting && iv) { clearInterval(iv); iv = null; }
    }, { threshold: .2 });
    io.observe($('.printer'));
  }
}

/* ---------------- code tabs ---------------- */
{
  const SRC = { js: $('#src-js').textContent, py: $('#src-py').textContent };
  $('#code-js-p code').innerHTML = hl(SRC.js); $('#code-py-p code').innerHTML = hl(SRC.py);
  let active = 'js';
  const tabs = $$('.code-tab');
  const select = (t) => {
    tabs.forEach(b => { const on = b === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $('#' + b.getAttribute('aria-controls')).hidden = !on; });
    active = t.id === 'tab-js' ? 'js' : 'py';
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = tabs[(i + 1) % 2]; select(n); n.focus(); } });
  });
  const copyBtn = $('#copyCode');
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(SRC[active]);
    copyBtn.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(() => copyBtn.textContent = 'Copy', 1600);
  });
}
/* ---------------- 12. CTA: coin drops into the slot, gate lifts, coin confetti ---------------- */
{
  const f = $('#wlForm'), msg = $('#wlMsg'), btn = $('#wlForm .btn-slot'), gateSvg = $('.wl-gate');
  f?.addEventListener('submit', async () => {
    if (!msg.textContent.startsWith("You're")) return;          // core.js validated + set the message first
    await M.coinFly($('#cta-h'), btn, { size: 38, duration: .6 });
    gateSvg?.classList.add('open');
    const r = btn.getBoundingClientRect(); M.coinBurst(r.left + r.width / 2, r.top + r.height / 2);
  });
  $('#wlEmail')?.addEventListener('focus', () => gateSvg?.classList.remove('open'));
}

/* ---------------- token / CONFIG ---------------- */
{
  const caText = $('#caText'), caCopy = $('#caCopy');
  if (CONFIG.ca) {
    caText.textContent = 'CA: ' + CONFIG.ca; caCopy.disabled = false; caCopy.removeAttribute('title');
    caCopy.addEventListener('click', async () => { const ok = await copyText(CONFIG.ca); caCopy.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(() => caCopy.textContent = 'Copy', 1600); });
  }
  const x = $('#xLink'), tg = $('#tgLink');
  if (CONFIG.x) x.href = CONFIG.x; else x.hidden = true;
  if (CONFIG.telegram) tg.href = CONFIG.telegram; else tg.hidden = true;
  if (!CONFIG.x && !CONFIG.telegram) $('#socials').hidden = true;
}

/* =========================================================================
   3D · groove ribbon, meter tokens, coin slot
   ========================================================================= */
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl'); } catch (e) { return false; }
}
const FORCE_NO_GL = new URLSearchParams(location.search).has('nowebgl');

function showFallback() {
  $('#gl').style.display = 'none';
  $('#gl-fallback').removeAttribute('hidden');   // SVG elements have no .hidden property
  root.classList.add('no-webgl');
  $('#tokenStage').classList.add('fb');
}

if (FORCE_NO_GL || !webglOK()) showFallback();
else initGL().catch(err => { console.warn('3D disabled:', err && err.message); showFallback(); });

async function initGL() {
  const [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { ShaderPass }, { RoomEnvironment }, { RoundedBoxGeometry }] = await Promise.all([
    import('three'),
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
    import('three/addons/postprocessing/ShaderPass.js'),
    import('three/addons/environments/RoomEnvironment.js'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
  ]);
  await Promise.race([document.fonts.ready, wait(1500)]);
  const V3 = THREE.Vector3, Q = THREE.Quaternion;
  const PAPER = 0xf3f0ec, CORAL = 0xe86a66;

  /* ---- shared assets ---- */
  const tex = (canvas, srgb = true) => { const t = new THREE.CanvasTexture(canvas); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const marbleTint = tex(MARBLE.tint); marbleTint.wrapS = marbleTint.wrapT = THREE.RepeatWrapping;
  const ribbonMap = marbleTint.clone(); ribbonMap.repeat.set(7, 1); ribbonMap.needsUpdate = true;
  const grooves = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 512; const g = c.getContext('2d'); const id = g.createImageData(4, 512);
    for (let y = 0; y < 512; y++) { const s = Math.sin(y / 512 * Math.PI * 2 * 72) * .5; for (let x = 0; x < 4; x++) { const k = (y * 4 + x) * 4; id.data[k] = 128; id.data[k + 1] = 128 + s * 127; id.data[k + 2] = 255; id.data[k + 3] = 255; } }
    g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const vinylParams = { color: CORAL, transmission: .45, thickness: 1.4, roughness: .18, clearcoat: 1, clearcoatRoughness: .06,
    attenuationColor: new THREE.Color(0xb3242b), attenuationDistance: .8, ior: 1.5 };
  const ribbonMat = new THREE.MeshPhysicalMaterial({ ...vinylParams, map: ribbonMap, normalMap: grooves, normalScale: new THREE.Vector2(.22, .22) });
  const tokenMat = new THREE.MeshPhysicalMaterial({ ...vinylParams, map: marbleTint, normalMap: grooves, normalScale: new THREE.Vector2(.12, .12) });

  // gate mark (same geometry as /brand/icon.svg, drawn in 512-unit icon space)
  function drawGate(g) {
    const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
    const dot = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    g.fillStyle = '#f3f0ec'; rr(186, 256, 40, 80, 12); rr(172, 322, 68, 22, 11);
    g.save(); g.translate(206, 258); g.rotate(-35 * Math.PI / 180); g.translate(-206, -258);
    rr(186, 238, 168, 40, 20); g.fillStyle = '#f2a19c'; g.fillRect(252, 238, 22, 40); g.fillRect(292, 238, 22, 40);
    g.restore();
    g.fillStyle = '#f3f0ec'; dot(206, 258, 25); g.fillStyle = '#e86a66'; dot(206, 258, 9);
  }
  const labelTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#0b0a0a'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#1d1919'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
    g.save(); g.translate(128, 128); g.scale(.98, .98); g.translate(-256, -256); drawGate(g); g.restore();
    return tex(c);
  })();
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: .9, metalness: 0 });

  // coin: lathe profile with a raised rim (bottom-center → out → up → top-center)
  const prof = [[0, -.05], [.44, -.05], [.47, -.07], [.52, -.085], [.555, -.06], [.565, 0], [.555, .06], [.52, .085], [.47, .07], [.44, .05], [0, .05]].map(([r, y]) => new THREE.Vector2(r, y));
  const coinGeo = new THREE.LatheGeometry(prof, 72);
  const labelGeo = new THREE.CircleGeometry(.27, 48);
  function makeToken(mat = tokenMat) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(coinGeo, mat));
    const top = new THREE.Mesh(labelGeo, labelMat); top.rotation.x = -Math.PI / 2; top.position.y = .052; g.add(top);
    const bot = new THREE.Mesh(labelGeo, labelMat); bot.rotation.x = Math.PI / 2; bot.position.y = -.052; g.add(bot);
    return g;
  }
  const tileTex = (txt, up, data = false) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 136; const g = c.getContext('2d');
    g.fillStyle = data ? '#1f6feb' : '#f3f0ec'; g.beginPath(); g.roundRect(4, 4, 504, 128, 22); g.fill();
    g.strokeStyle = data ? '#9ec2ff' : 'rgba(20,17,16,.25)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = data ? '#ffffff' : '#141110'; g.font = '600 50px "JetBrains Mono", monospace'; g.textBaseline = 'middle'; g.fillText(txt, 30, 62);
    g.fillStyle = data ? '#ffffff' : (up ? '#2f9e5b' : '#b3242b'); g.textAlign = 'right'; g.fillText(up ? '▲' : '▼', 482, 62);
    g.fillStyle = data ? '#dbe8ff' : '#b3242b'; g.font = '600 17px "JetBrains Mono", monospace'; g.textAlign = 'left'; g.fillText(data ? '200 OK · SIMULATED' : 'SAMPLE', 32, 112);
    return tex(c);
  };

  /* ---- main renderer ---- */
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const PR = Math.min(devicePixelRatio || 1, 2); let PRc = PR;
  renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 500);
  // paper backdrop (exact --paper; seen through the transmissive vinyl)
  const paper = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.MeshBasicMaterial({ color: PAPER, side: THREE.BackSide, depthWrite: false }));
  scene.add(paper);
  const key = new THREE.DirectionalLight(0xfff0e0, 2.1); key.position.set(6, 9, 12); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb3c1, 2.4); rim.position.set(-10, -3, -8); scene.add(rim);
  const rim2 = new THREE.PointLight(0xffc2c8, 30, 40, 2); rim2.position.set(-6, 4, 6); scene.add(rim2);
  scene.add(new THREE.HemisphereLight(PAPER, 0xe9d4cf, .7));

  const world = new THREE.Group(); scene.add(world);

  /* ribbon: TubeGeometry along a CatmullRom curve, cross-section rescaled to ~6:1 */
  const curve = new THREE.CatmullRomCurve3([
    new V3(-17, -9, -3), new V3(-11, -5.6, .5), new V3(-6, -4.2, 1.2), new V3(-1.5, -1.6, -.4),
    new V3(2.5, .6, .6), new V3(6.5, 2.2, -.6), new V3(11, 4.6, .4), new V3(17, 8.5, -2.5)
  ], false, 'catmullrom', .5);
  const RW = 1.25, RT = RW / 6, SEG = 420, RAD = 36;
  const Z = new V3(0, 0, 1), _t = new V3();
  function frameAt(t, P, T, W, D) {
    t = Math.min(1, Math.max(0, t || 0));
    curve.getPointAt(t, P); curve.getTangentAt(t, T);
    W.crossVectors(T, Z).normalize(); D.crossVectors(W, T).normalize();
    const a = .62 * Math.sin(t * Math.PI * 2.3 + .5), c = Math.cos(a), s = Math.sin(a);
    _t.copy(W); W.multiplyScalar(c).addScaledVector(D, s); D.multiplyScalar(c).addScaledVector(_t, -s);
  }
  const ribGeo = new THREE.TubeGeometry(curve, SEG, 1, RAD, false);
  {
    const pos = ribGeo.attributes.position, P = new V3(), T = new V3(), W = new V3(), D = new V3();
    for (let i = 0; i <= SEG; i++) {
      frameAt(i / SEG, P, T, W, D);
      for (let j = 0; j <= RAD; j++) {
        const v = j / RAD * Math.PI * 2, c = -Math.cos(v), s = Math.sin(v);
        pos.setXYZ(i * (RAD + 1) + j, P.x + W.x * RW * c - D.x * RT * s, P.y + W.y * RW * c - D.y * RT * s, P.z + W.z * RW * c - D.z * RT * s);
      }
    }
    ribGeo.computeVertexNormals();
  }
  const ribbon = new THREE.Mesh(ribGeo, ribbonMat); world.add(ribbon);

  /* price tiles sliding along the ribbon */
  const TILES = [['STK·A 182.40', true], ['STK·B  64.15', false], ['ETF·X 411.80', true], ['STK·A 182.44', true], ['STK·B  64.09', false]];
  const tileGeo = new THREE.PlaneGeometry(1.9, .5);
  const tiles = TILES.map(([t, up], i) => {
    const m = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ map: tileTex(t, up), transparent: true, depthWrite: false }));
    m.userData = { t: i / TILES.length, side: (i % 2 ? -.7 : .7) }; world.add(m); return m;
  });

  /* meter tokens riding the ribbon */
  const tokens = [];
  for (let i = 0; i < 8; i++) {
    const g = makeToken(); g.scale.setScalar(.95 + (i % 3) * .12);
    g.userData = { t: (i + .5) / 8, speed: .0065 + (i % 4) * .0018, side: [-.9, .4, -.2, .95, -.6, .2, .8, -1][i], mode: i % 3 === 0 ? 'flip' : 'roll', spin: 0, phase: i * 1.7, drop: 1 };
    world.add(g); tokens.push(g);
  }

  /* hero token (screen-anchored) */
  const hero = makeToken(); hero.scale.setScalar(.001); scene.add(hero);

  /* toll gate: coin booth + boom barrier (screen-anchored near Try it) */
  const slot = new THREE.Group(); scene.add(slot);
  const booth = new THREE.Group(); booth.position.x = -1.43; slot.add(booth);
  const slotBody = new THREE.Mesh(new RoundedBoxGeometry(2.6, 1.4, 1.2, 6, .14), new THREE.MeshPhysicalMaterial({ color: 0x0b0a0a, roughness: .38, metalness: 0, clearcoat: 1, clearcoatRoughness: .2 }));
  booth.add(slotBody);
  const slitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CORAL).multiplyScalar(1.5) });
  const slit = new THREE.Mesh(new RoundedBoxGeometry(1.3, .05, .2, 2, .02), slitMat); slit.position.y = .7; booth.add(slit);
  const faceTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 200; const g = c.getContext('2d');
    g.fillStyle = '#f2a19c'; g.font = '600 46px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.fillText('INSERT COIN', 256, 92);
    g.fillStyle = '#9a918c'; g.font = '500 24px "JetBrains Mono", monospace'; g.fillText('402 · SIMULATED', 256, 146);
    return tex(c);
  })();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.1, .82), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }));
  face.position.z = .605; booth.add(face);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CORAL).multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .7, 72), ringMat); ring.position.set(0, .05, .7); booth.add(ring);
  const ring402 = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#e86a66'; g.font = '700 96px "Space Grotesk", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('402', 128, 68);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .55), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(0, 1.5, .4); booth.add(m); return m;
  })();
  const dropCoin = makeToken(); dropCoin.visible = false; booth.add(dropCoin);
  const dataTile = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ map: tileTex('STK·A 182.40', true, true), transparent: true, opacity: 0, depthWrite: false }));
  dataTile.visible = false; booth.add(dataTile);
  // boom barrier: post + foot + pivoting arm with two vinyl-light stripes, lamp on the booth
  const paperMat = new THREE.MeshPhysicalMaterial({ color: PAPER, roughness: .35, clearcoat: .8, clearcoatRoughness: .25 });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2a19c });
  const gate = new THREE.Group(); gate.position.x = .32; slot.add(gate);
  const post = new THREE.Mesh(new RoundedBoxGeometry(.28, 1.42, .28, 4, .08), paperMat); post.position.y = -.05; gate.add(post);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(.66, .16, .5, 4, .07), paperMat); foot.position.y = -.74; gate.add(foot);
  const pivot = new THREE.Group(); pivot.position.set(0, .58, .2); gate.add(pivot);
  const arm = new THREE.Mesh(new RoundedBoxGeometry(2.5, .24, .14, 4, .1), paperMat); arm.position.x = 1.13; pivot.add(arm);
  [.85, 1.5].forEach(x => { const st = new THREE.Mesh(new THREE.BoxGeometry(.3, .245, .145), stripeMat); st.position.x = x; pivot.add(st); });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .2, 32), paperMat); hub.rotation.x = Math.PI / 2; hub.position.z = .02; pivot.add(hub);
  const hubDot = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .22, 24), new THREE.MeshBasicMaterial({ color: CORAL })); hubDot.rotation.x = Math.PI / 2; hubDot.position.z = .03; pivot.add(hubDot);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CORAL).multiplyScalar(1.3) });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.11, 20, 12), lampMat); lamp.position.set(1.05, .78, .35); booth.add(lamp);
  const GATE_OPEN = 1.05;   // ~60° lift
  const LAMP_RED = new THREE.Color(CORAL).multiplyScalar(1.3), LAMP_GREEN = new THREE.Color(0x3fbf72).multiplyScalar(1.4);
  function setGate(open, instant = false) {
    const z = open ? GATE_OPEN : 0, col = open ? LAMP_GREEN : LAMP_RED;
    if (instant || RM) { pivot.rotation.z = z; lampMat.color.copy(col); return; }
    gsap.to(pivot.rotation, open ? { z, duration: .95, ease: 'back.out(1.7)' } : { z, duration: .8, ease: 'bounce.out' });
    gsap.to(lampMat.color, { r: col.r, g: col.g, b: col.b, duration: .3 });
  }
  window.__tgate.gate = () => pivot.rotation.z;
  const packet = new THREE.Mesh(new THREE.SphereGeometry(.16, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6) }));
  packet.visible = false; packet.userData.t = 0; world.add(packet);

  /* ---- post: selective bloom (paper backdrop is excluded) ---- */
  const size = new THREE.Vector2(innerWidth, innerHeight);
  const bloomComposer = new EffectComposer(renderer); bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(size, .35, .5, .75); bloomComposer.addPass(bloom);
  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, camera));
  const mixPass = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloom.renderTargetsHorizontal[0].texture } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main(){ vec4 b = texture2D(baseTexture,vUv); gl_FragColor = vec4(b.rgb + texture2D(bloomTexture,vUv).rgb, b.a); }'
  }), 'baseTexture');
  mixPass.needsSwap = true;
  finalComposer.addPass(mixPass); finalComposer.addPass(new OutputPass());
  const black = new THREE.MeshBasicMaterial({ color: 0 });
  const darkened = [...tiles, face];
  let useBloom = true, quality = 2;
  function render() {
    if (!useBloom) { renderer.render(scene, camera); return; }
    paper.visible = false; const saved = darkened.map(m => m.material); darkened.forEach(m => m.material = black);
    bloomComposer.render();
    paper.visible = true; darkened.forEach((m, i) => m.material = saved[i]);
    finalComposer.render();
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    finalComposer.setPixelRatio(PRc); finalComposer.setSize(w, h);
    bloomComposer.setPixelRatio(PRc * .5); bloomComposer.setSize(w, h);
    if (RM) staticFrame();
  }

  /* ---- scroll choreography: smoothstep keyframes, damped ---- */
  const KF = [
    { p: 0, cam: [-2.5, 1.6, 15.5], look: [-2.5, 1.6, 0], wx: 0, ry: -.1 },
    { p: .14, cam: [-.5, .8, 19], look: [0, .6, 0], wx: 0, ry: -.02 },
    { p: .42, cam: [1.5, 1, 23], look: [1.5, .8, 0], wx: 0, ry: .14 },
    { p: .72, cam: [-1.5, -.5, 21], look: [0, 0, 0], wx: 0, ry: .26 },
    { p: .88, cam: [0, 0, 19], look: [0, 0, 0], wx: 2, ry: .32 },
    { p: 1, cam: [0, 0, 18], look: [0, 0, 0], wx: 34, ry: .42 },
  ];
  const ss = t => t * t * (3 - 2 * t);
  const tgt = { cam: new V3(), look: new V3(), wx: 0, ry: 0 };
  const curCam = new V3(...KF[0].cam), curLook = new V3(...KF[0].look); let curWx = 0, curRy = KF[0].ry;
  function sample(p) {
    let k = 0; while (k < KF.length - 2 && p > KF[k + 1].p) k++;
    const a = KF[k], b = KF[k + 1], t = ss(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));
    tgt.cam.set(...a.cam).lerp(new V3(...b.cam), t); tgt.look.set(...a.look).lerp(new V3(...b.look), t);
    tgt.wx = a.wx + (b.wx - a.wx) * t; tgt.ry = a.ry + (b.ry - a.ry) * t;
  }
  const progress = () => { const m = document.documentElement.scrollHeight - innerHeight; return m > 0 ? Math.min(1, Math.max(0, scrollY / m)) : 0; };

  /* ---- screen anchors ---- */
  const tmp = new V3(), dir = new V3();
  function anchorTo(el, dist, out) {
    const r = el.getBoundingClientRect();
    const nx = ((r.left + r.width / 2) / innerWidth) * 2 - 1, ny = -((r.top + r.height / 2) / innerHeight) * 2 + 1;
    dir.set(nx, ny, .5).unproject(camera).sub(camera.position).normalize();
    out.copy(camera.position).addScaledVector(dir, dist);
    const worldH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return { r, scale: r.width / innerHeight * worldH };
  }
  const heroAnchor = $('#heroAnchor'), slotAnchor = $('#slotAnchor');
  const qa = new Q(), qb = new Q(), qc = new Q(), X1 = new V3(1, 0, 0), Y1 = new V3(0, 1, 0), Z1 = new V3(0, 0, 1);
  const heroState = { s: 0 };
  window.addEventListener('tgate:drop', () => heroDrop());
  function heroDrop() {
    gsap.to(heroState, { s: 1, duration: 1.4, ease: 'elastic.out(1,.55)' });
    tokens.forEach((tk, i) => gsap.to(tk.userData, { drop: 0, duration: 1.3, delay: i * .09, ease: 'bounce.out' }));
  }

  /* ---- try-it sync ---- */
  let clink = null;
  function playClink() {
    try {
      clink = clink || new (window.AudioContext || window.webkitAudioContext)();
      const t = clink.currentTime;
      [2637, 3520].forEach((f, i) => {
        const o = clink.createOscillator(), g = clink.createGain();
        o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t + i * .05); g.gain.exponentialRampToValueAtTime(.06, t + i * .05 + .005); g.gain.exponentialRampToValueAtTime(.0001, t + i * .05 + .25);
        o.connect(g).connect(clink.destination); o.start(t + i * .05); o.stop(t + i * .05 + .3);
      });
    } catch (e) { }
  }
  window.addEventListener('tgate', e => {
    if (e.detail === 'request' || e.detail === 'reset') setGate(false, RM);
    if (RM) { if (e.detail === 'pay') setGate(true, true); requestAnimationFrame(staticFrame); return; }
    switch (e.detail) {
      case 'request':
        packet.visible = true; packet.userData.t = 0;
        gsap.fromTo(packet.userData, { t: 0 }, { t: 1, duration: 1.8, ease: 'power2.in', onComplete: () => packet.visible = false });
        break;
      case 'quote':
        gsap.fromTo(slitMat.color, { r: 3.2, g: 1.2, b: 1.1 }, { r: new THREE.Color(CORAL).r * 1.5, g: new THREE.Color(CORAL).g * 1.5, b: new THREE.Color(CORAL).b * 1.5, duration: 1.4, ease: 'power2.out' });
        gsap.fromTo(ring.scale, { x: .6, y: .6 }, { x: 3.4, y: 3.4, duration: 1.4, ease: 'power2.out' });
        gsap.fromTo(ringMat, { opacity: 1 }, { opacity: 0, duration: 1.4, ease: 'power1.in' });
        gsap.fromTo(ring402.material, { opacity: 0 }, { opacity: 1, duration: .3, yoyo: true, repeat: 1, repeatDelay: .9 });
        gsap.fromTo(ring402.position, { y: 1.1 }, { y: 1.7, duration: 1.5, ease: 'power2.out' });
        break;
      case 'pay': {
        dropCoin.visible = true; dropCoin.position.set(0, 3.2, 0); dropCoin.rotation.set(Math.PI / 2, 0, 0); dropCoin.scale.set(1, 1, 1);
        const tl = gsap.timeline();
        tl.to(dropCoin.position, { y: 1.27, duration: .55, ease: 'power2.in' })
          .add(playClink)
          .to(dropCoin.scale, { x: 1.18, z: .78, duration: .08, ease: 'power1.out' })
          .to(dropCoin.scale, { x: 1, z: 1, duration: .35, ease: 'elastic.out(1,.4)' })
          .to(dropCoin.position, { y: .1, duration: .45, ease: 'power2.in' }, '-=.1')
          .add(() => { dropCoin.visible = false; })
          .add(() => setGate(true), '-=.15')
          .fromTo(slitMat.color, { r: 3, g: 2, b: 1.8 }, { r: new THREE.Color(CORAL).r * 1.5, g: new THREE.Color(CORAL).g * 1.5, b: new THREE.Color(CORAL).b * 1.5, duration: .8 }, '-=.1');
        break;
      }
      case 'data': {
        const q = window.__tgate.quote || { s1: 'STK·A' };
        dataTile.material.map = tileTex(({ 'STK·A': 'STK·A 182.40', 'STK·B': 'STK·B  64.15', 'ETF·X': 'ETF·X 411.80' })[q.s1] || 'STK·A 182.40', true, true);
        dataTile.visible = true; dataTile.position.set(0, .1, .7); dataTile.scale.setScalar(.4);
        gsap.timeline({ onComplete: () => dataTile.visible = false })
          .to(dataTile.material, { opacity: 1, duration: .15 })
          .to(dataTile.position, { x: -3.6, y: 1.6, z: 2.4, duration: 1.1, ease: 'expo.out' }, 0)
          .to(dataTile.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 1.1, ease: 'expo.out' }, 0)
          .to(dataTile.material, { opacity: 0, duration: .6 }, 1.6);
        break;
      }
    }
  });

  /* ---- per-frame ---- */
  const P = new V3(), T = new V3(), W = new V3(), D = new V3(), M4 = new THREE.Matrix4();
  const labelSecs = $$('section.label');
  const covered = () => labelSecs.some(s => { const r = s.getBoundingClientRect(); return r.top <= 0 && r.bottom >= innerHeight; });
  let last = performance.now(), elapsed = 0;
  function update(dt) {
    elapsed += dt;
    sample(progress());
    const k = RM ? 1 : 1 - Math.exp(-dt * 3.2);
    curCam.lerp(tgt.cam, k); curLook.lerp(tgt.look, k); curWx += (tgt.wx - curWx) * k; curRy += (tgt.ry - curRy) * k;
    camera.position.copy(curCam); camera.lookAt(curLook);
    world.position.x = curWx; world.rotation.y = curRy; world.rotation.x = Math.sin(curRy * 3) * .06;

    tiles.forEach(m => {
      if (!RM) m.userData.t = (m.userData.t + dt * .018) % 1;
      frameAt(m.userData.t, P, T, W, D);
      m.position.copy(P).addScaledVector(D, RT + .04).addScaledVector(W, m.userData.side);
      M4.makeBasis(T, W, D); m.quaternion.setFromRotationMatrix(M4);
    });
    tokens.forEach((g, i) => {
      const u = g.userData;
      if (!RM) u.t = (u.t + dt * u.speed) % 1;
      frameAt(u.t, P, T, W, D);
      const bob = Math.sin(elapsed * 1.6 + u.phase) * .07;
      let hop = 0, flip = 0;
      if (u.mode === 'flip') { const c = (elapsed * .35 + u.phase) % 3; if (c < 1) { flip = ss(c) * Math.PI * 2; hop = Math.sin(c * Math.PI) * 1.1; } }
      g.position.copy(P).addScaledVector(D, RT + .1 + bob + hop + u.drop * 9).addScaledVector(W, u.side);
      g.position.y += u.drop * 6;
      M4.makeBasis(T, D, W); g.quaternion.setFromRotationMatrix(M4);
      u.spin -= dt * (u.speed * curve.getLength() / .56) * (RM ? 0 : 1);
      qa.setFromAxisAngle(X1, flip); qb.setFromAxisAngle(Y1, u.spin);
      g.quaternion.multiply(qa).multiply(qb);
    });
    if (packet.visible) {
      frameAt(Math.min(.999, packet.userData.t), P, T, W, D);
      packet.position.copy(P).addScaledVector(D, RT + .3);
    }

    // hero token: 33⅓ rpm ≈ 3.49 rad/s, eased in by the entrance
    const ha = anchorTo(heroAnchor, 7.5, tmp);
    hero.position.copy(tmp);
    const hx = ss(Math.min(1, window.__tgate.heroExit || 0));
    if (hx > 0) { frameAt(.2 + hx * .22, P, T, W, D); P.addScaledVector(D, RT + .6); world.updateMatrixWorld(); world.localToWorld(P); hero.position.lerp(P, hx); }
    const hs = Math.max(.001, ha.scale * .4 * heroState.s * (1 - hx * .35));
    hero.scale.setScalar(hs / .565);
    hero.position.y += Math.sin(elapsed * 1.2) * .08;
    qa.setFromAxisAngle(Y1, -.42); qb.setFromAxisAngle(X1, Math.PI / 2 - .22); qc.setFromAxisAngle(Y1, -(RM ? 1.1 : elapsed * 3.49 + hx * 14));
    hero.quaternion.copy(camera.quaternion).multiply(qa).multiply(qb).multiply(qc);

    const sa = anchorTo(slotAnchor, 12, tmp);
    slot.position.copy(tmp);
    slot.scale.setScalar(Math.min(sa.scale / 5.9, sa.r.height / innerHeight * 2 * 12 * Math.tan(THREE.MathUtils.degToRad(19)) / 3.4));
    qa.setFromAxisAngle(X1, .42); qb.setFromAxisAngle(Y1, -.28 + Math.sin(elapsed * .5) * .06);
    slot.quaternion.copy(camera.quaternion).multiply(qa).multiply(qb);
  }
  function staticFrame() { update(1 / 60); render(); }

  addEventListener('resize', resize); resize();
  if (window.__tgate.dropped) { heroState.s = 1; tokens.forEach(t => t.userData.drop = 0); }
  if (RM) {
    heroState.s = 1; tokens.forEach(t => t.userData.drop = 0);
    staticFrame();
    let pending = false;
    addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; staticFrame(); }); } }, { passive: true });
  } else {
    let raf = 0;
    let slow = 0;
    const degrade = () => {   // adaptive quality for weak GPUs: drop bloom, then transmission + resolution
      quality--; slow = 0;
      if (quality === 1) { useBloom = false; PRc = 1; }
      if (quality === 0) { ribbonMat.transmission = tokenMat.transmission = 0; ribbonMat.needsUpdate = tokenMat.needsUpdate = true; PRc = .75; }
      renderer.setPixelRatio(PRc); resize();
    };
    const loop = now => {
      raf = requestAnimationFrame(loop);
      const raw = (now - last) / 1000;
      const dt = Math.min(.05, Math.max(0, raw)); last = now;   // rAF time can precede performance.now()
      if (raw > .045 && raw < .5) { if (++slow > 45 && quality > 0) degrade(); } else slow = Math.max(0, slow - 1);
      update(dt);
      if (!covered()) render();
    };
    const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const stopL = () => { cancelAnimationFrame(raf); raf = 0; };
    document.addEventListener('visibilitychange', () => document.hidden ? stopL() : start());
    start();
  }
  window.__tgate.gl = true;

  /* ---- $TGATE showcase: its own small renderer, rendered only when visible ---- */
  initShowcase(THREE, RoomEnvironment, makeToken);
}

function initShowcase(THREE, RoomEnvironment, makeToken) {
  const stage = $('#tokenStage'), c = $('#tokenGL');
  let r2;
  try { r2 = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true }); } catch (e) { stage.classList.add('fb'); return; }
  r2.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  r2.toneMapping = THREE.ACESFilmicToneMapping; r2.toneMappingExposure = 1.15; r2.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.environment = new THREE.PMREMGenerator(r2).fromScene(new RoomEnvironment(r2), .04).texture;
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 50); cam.position.set(0, 0, 6.2);
  const k = new THREE.DirectionalLight(0xfff0e0, 2.4); k.position.set(4, 6, 6); sc.add(k);
  const rl = new THREE.DirectionalLight(0xffb3c1, 3); rl.position.set(-5, -2, -4); sc.add(rl);
  sc.add(new THREE.HemisphereLight(0xf3f0ec, 0x3a1a1a, .5));
  const tk = makeToken(); tk.scale.setScalar(2.6); sc.add(tk);
  const tilt = new THREE.Group(); tilt.add(tk); sc.add(tilt);
  tilt.rotation.set(.55, -.35, .12);
  const size = () => { const w = stage.clientWidth; r2.setSize(w, w, false); cam.aspect = 1; cam.updateProjectionMatrix(); };
  size(); addEventListener('resize', size);
  let vis = false, raf = 0, t0 = performance.now(), last = t0, ang = 0, spd = 3.49, tx = 0, ty = 0;
  // 11. spins faster with scroll velocity, tilts toward the cursor
  if (!RM && FINE) stage.closest('section').addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 1.2)));
    ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 1.2)));
  });
  const draw = now => {
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - last) / 1000); last = now;
    const vel = Math.abs(window.__tgate.lenis?.velocity || 0);
    spd += ((3.49 + Math.min(vel * .9, 26)) - spd) * .08;    // base 33⅓ rpm
    ang -= spd * dt;
    tk.rotation.y = RM ? -1 : ang;
    tilt.position.y = RM ? 0 : Math.sin(t * 1.1) * .08;
    tilt.rotation.x += ((.55 + ty * .35) - tilt.rotation.x) * .08;
    tilt.rotation.y += ((-.35 + tx * .5) - tilt.rotation.y) * .08;
    r2.render(sc, cam);
  };
  const loop = now => { raf = requestAnimationFrame(loop); draw(now); };
  const sync = () => { const go = vis && !document.hidden && !RM; if (go && !raf) raf = requestAnimationFrame(loop); if (!go && raf) { cancelAnimationFrame(raf); raf = 0; } };
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (RM && vis) draw(performance.now()); sync(); }, { rootMargin: '100px' }).observe(stage);
  document.addEventListener('visibilitychange', sync);
  if (RM) draw(performance.now());
}

if (HAS_GSAP) addEventListener('load', () => ScrollTrigger.refresh());
