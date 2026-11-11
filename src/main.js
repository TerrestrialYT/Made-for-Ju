import { site } from './config.js';
import { initOrder, cutoffText } from './order.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// intro: fade out as soon as the page is ready (max ~1.2s)
function initIntro() {
  const root = document.documentElement;
  const intro = $('#intro');
  if (!intro || !root.classList.contains('intro')) return;
  const start = performance.now();
  let done = false;
  const hide = () => {
    if (done) return;
    done = true;
    const wait = Math.max(0, 450 - (performance.now() - start));
    setTimeout(() => {
      intro.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: 'ease', fill: 'forwards' }).onfinish = () =>
        root.classList.remove('intro');
    }, wait);
  };
  if (document.readyState === 'complete') hide();
  else window.addEventListener('load', hide, { once: true });
  setTimeout(hide, 1200);
}

// content from config
function renderMenu() {
  const grid = $('#menu-grid');
  if (!grid) return;
  const priced = site.showPrices && site.boxes.some((b) => typeof b.price === 'number');
  grid.innerHTML = site.flavours
    .filter((f) => f.available !== false)
    .map(
      (f, i) => `
      <article class="group text-center sm:text-left" data-reveal style="--delay:${i * 80}ms">
        <div class="relative mb-6 aspect-square overflow-hidden rounded-[1.75rem] bg-dough">
          <img src="${esc(f.art)}" alt="${esc(f.name)} cookie" width="600" height="600" loading="lazy"
            class="absolute inset-0 m-auto w-[86%] transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-105 group-hover:rotate-3" />
        </div>
        <h3 class="mb-2 font-serif text-xl font-semibold">${esc(f.name)}</h3>
        <p class="text-sm leading-relaxed text-choco/70">${esc(f.description)}</p>
      </article>`
    )
    .join('');

  const note = $('#menu-price-note');
  if (note && priced) {
    note.textContent = site.boxes
      .filter((b) => typeof b.price === 'number')
      .map((b) => `${b.label} · ${site.currency}${b.price}`)
      .join('   ·   ');
  }
}

function applyConfig() {
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
  const days = $('[data-config="delivery-days"]');
  if (days && site.delivery.days) days.textContent = `Delivery: ${site.delivery.days}`;
  const area = $('[data-config="delivery-area"]');
  if (area && site.delivery.area) area.textContent = site.delivery.area;

  // Drop / cut-off notice under the hero buttons
  const notice = $('#drop-notice');
  if (!notice) return;
  const bits = [];
  if (site.drop.status === 'soldout') bits.push('<strong class="font-semibold text-choco">This weekend is sold out.</strong> DM us to join next week\'s list.');
  else if (site.drop.status === 'open' && typeof site.drop.slotsLeft === 'number')
    bits.push(`<strong class="font-semibold text-choco">Only ${site.drop.slotsLeft} boxes left</strong> this weekend.`);
  const cut = site.drop.status !== 'soldout' ? cutoffText() : '';
  if (cut) bits.push(esc(cut));
  if (bits.length) {
    notice.innerHTML = bits.join(' ');
    notice.classList.remove('hidden');
  }
}

// dialogs (native <dialog>: focus trap + Esc built in)
function initDialogs() {
  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
    d.addEventListener('close', () => {
      if (!$$('dialog').some((x) => x.open)) document.documentElement.classList.remove('modal-open');
    });
  });
  $$('[data-open-guide]').forEach((b) =>
    b.addEventListener('click', () => {
      $('#guide-dialog').showModal();
      document.documentElement.classList.add('modal-open');
    })
  );
}

// scroll reveal
function initReveal() {
  const els = $$('[data-reveal]');
  if (calm.matches || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  els.forEach((el) => io.observe(el));
}

// gentle parallax (rAF-throttled, off for reduced motion)
function initParallax() {
  const items = $$('.parallax');
  if (!items.length || calm.matches) return;
  let ticking = false;
  const frame = () => {
    ticking = false;
    const vh = window.innerHeight;
    for (const el of items) {
      const host = el.parentElement.getBoundingClientRect();
      if (host.bottom < -200 || host.top > vh + 200) continue;
      const progress = host.top + host.height / 2 - vh / 2; // 0 when centred
      const y = -progress * parseFloat(el.dataset.speed || 0.1);
      const r = -progress * parseFloat(el.dataset.rot || 0);
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) rotate(${r.toFixed(2)}deg)`;
    }
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  frame();
}

// crumbs: only on primary order buttons, mouse/trackpad only
function initCrumbs() {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  document.addEventListener('click', (e) => {
    if (calm.matches || !fine.matches) return;
    const btn = e.target.closest('[data-crumbs]');
    if (!btn || e.detail === 0) return; // ignore keyboard "clicks"
    for (let i = 0; i < 4; i++) {
      const c = document.createElement('span');
      c.className = 'crumb';
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const d = 18 + Math.random() * 22;
      c.style.left = `${e.clientX - 3}px`;
      c.style.top = `${e.clientY - 3}px`;
      c.style.setProperty('--dx', `${(Math.cos(a) * d).toFixed(1)}px`);
      c.style.setProperty('--dy', `${(Math.sin(a) * d + 26).toFixed(1)}px`);
      c.style.setProperty('--rot', `${Math.round(Math.random() * 240 - 120)}deg`);
      const s = 4 + Math.random() * 3;
      c.style.width = c.style.height = `${s.toFixed(1)}px`;
      document.body.appendChild(c);
      c.addEventListener('animationend', () => c.remove(), { once: true });
    }
  });
}

// sticky mobile order bar: shows once the hero buttons scroll away
function initOrderBar() {
  const bar = $('#order-bar');
  const hero = $('#hero-ctas');
  const footer = $('footer');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;
  let heroVisible = true;
  let footerVisible = false;
  const set = () => {
    const show = !heroVisible && !footerVisible;
    bar.classList.toggle('is-visible', show);
    bar.setAttribute('aria-hidden', String(!show));
    $$('a,button', bar).forEach((el) => (el.tabIndex = show ? 0 : -1));
  };
  new IntersectionObserver(([en]) => {
    heroVisible = en.isIntersecting || en.boundingClientRect.top > 0;
    set();
  }).observe(hero);
  new IntersectionObserver(([en]) => {
    footerVisible = en.isIntersecting;
    set();
  }, { rootMargin: '0px 0px -40% 0px' }).observe(footer);
}

// 3D hero: loaded after the page is ready, only on capable devices
function canRun3D() {
  if (calm.matches) return false;
  const nav = navigator;
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory && nav.deviceMemory < 3) return false;
  if (nav.hardwareConcurrency && nav.hardwareConcurrency < 4) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function initHero3D() {
  const mount = $('#hero-3d');
  if (!mount || !canRun3D()) return;
  const start = () =>
    import('./hero3d.js')
      .then((m) => m.mountHero(mount))
      .catch((err) => console.warn('3D hero unavailable, keeping illustration.', err));
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
  if (document.readyState === 'complete') idle(start);
  else window.addEventListener('load', () => idle(start), { once: true });
}

// boot
initIntro();
renderMenu();
applyConfig();
initDialogs();
initOrder();
initReveal();
initParallax();
initCrumbs();
initOrderBar();
initHero3D();
