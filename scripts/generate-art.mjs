// Generates the stand-in cookie illustrations in public/art/.
// Run with: npm run art
// These are placeholders until real photography is available, replace any
// file in public/art with a photo of the same name (or update src/config.js).

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(import.meta.dirname, '../public/art');
mkdirSync(OUT, { recursive: true });

// helpers
function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;

// Smooth closed path through points (Catmull-Rom → cubic Bézier).
function smoothPath(pts) {
  const n = pts.length;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

function blob(cx, cy, r, rand, wobble = 0.06, count = 28) {
  const phases = [1, 2, 3, 5, 7].map(() => rand() * Math.PI * 2);
  const amps = [wobble * 0.5, wobble * 0.7, wobble * 0.5, wobble * 0.35, wobble * 0.25];
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    let k = 1;
    [1, 2, 3, 5, 7].forEach((m, j) => (k += amps[j] * Math.sin(m * a + phases[j])));
    k += (rand() - 0.5) * wobble * 0.4;
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]);
  }
  return smoothPath(pts);
}

function chunkPath(cx, cy, s, rand) {
  const n = 5 + Math.floor(rand() * 3);
  const rot = rand() * Math.PI * 2;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const r = s * (0.65 + rand() * 0.45);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * (0.75 + rand() * 0.3)]);
  }
  return smoothPath(pts);
}

// Scatter non-overlapping points inside a circle.
function scatter(cx, cy, R, count, minDist, rand) {
  const pts = [];
  let tries = 0;
  while (pts.length < count && tries++ < 4000) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * R;
    const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    if (pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > minDist)) pts.push(p);
  }
  return pts;
}

// palettes
const P = {
  classic: { dough: ['#e9c48a', '#d49d58', '#a8692f'], chunk: ['#4a2a16', '#2a160b'], hi: '#7a4a2a' },
  dark: { dough: ['#7a4a30', '#5a321d', '#3a1d0f'], chunk: ['#fbf3e4', '#e6d6bb'], hi: '#ffffff' },
  caramel: { dough: ['#efcf98', '#d9a564', '#ad7136'], chunk: ['#5a3418', '#3a1f0d'], hi: '#8a5a32' },
  pistachio: { dough: ['#efdcaa', '#d9c084', '#a98d50'], chunk: ['#fbf3e4', '#e3d3b6'], hi: '#ffffff' },
};

function defs(id, pal) {
  return `
  <radialGradient id="${id}-dough" cx="46%" cy="42%" r="62%">
    <stop offset="0" stop-color="${pal.dough[0]}"/>
    <stop offset="0.62" stop-color="${pal.dough[1]}"/>
    <stop offset="1" stop-color="${pal.dough[2]}"/>
  </radialGradient>
  <linearGradient id="${id}-chunk" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${pal.chunk[0]}"/>
    <stop offset="1" stop-color="${pal.chunk[1]}"/>
  </linearGradient>
  <filter id="${id}-bake" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="7" result="n"/>
    <feDiffuseLighting in="n" surfaceScale="3.2" lighting-color="#fff" result="l">
      <feDistantLight azimuth="235" elevation="52"/>
    </feDiffuseLighting>
    <feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1.18" k2="0" k3="0" k4="0" result="m"/>
    <feComposite in="m" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="14"/>
  </filter>
  <filter id="${id}-soft"><feGaussianBlur stdDeviation="1.2"/></filter>`;
}

// One cookie, top-down. Returns SVG group markup (expects defs with `id`).
function cookie({ id, pal, cx, cy, r, seed, extras = [] }) {
  const rand = rng(seed);
  const outline = blob(cx, cy, r, rand, 0.07);
  let g = '';
  g += `<ellipse cx="${cx + r * 0.06}" cy="${cy + r * 0.12}" rx="${r * 1.02}" ry="${r * 0.98}" fill="#3a2213" opacity="0.28" filter="url(#${id}-shadow)"/>`;
  g += `<path d="${outline}" fill="url(#${id}-dough)" filter="url(#${id}-bake)"/>`;
  // baked rim
  g += `<path d="${outline}" fill="none" stroke="${pal.dough[2]}" stroke-width="${r * 0.05}" opacity="0.45" filter="url(#${id}-soft)"/>`;

  // cracks
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const r1 = r * (0.25 + rand() * 0.45);
    const len = r * (0.18 + rand() * 0.25);
    const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
    const b = a + (rand() - 0.5) * 1.6;
    const x2 = x1 + Math.cos(b) * len, y2 = y1 + Math.sin(b) * len;
    const mx = (x1 + x2) / 2 + (rand() - 0.5) * len * 0.5, my = (y1 + y2) / 2 + (rand() - 0.5) * len * 0.5;
    g += `<path d="M${f(x1)},${f(y1)} Q${f(mx)},${f(my)} ${f(x2)},${f(y2)}" fill="none" stroke="${pal.dough[2]}" stroke-width="${f(r * 0.022)}" stroke-linecap="round" opacity="0.55"/>`;
    g += `<path d="M${f(x1 + 2)},${f(y1 + 2)} Q${f(mx + 2)},${f(my + 2)} ${f(x2 + 2)},${f(y2 + 2)}" fill="none" stroke="#fff" stroke-width="${f(r * 0.012)}" stroke-linecap="round" opacity="0.18"/>`;
  }

  // chunks
  const chunkPts = scatter(cx, cy, r * 0.78, 13, r * 0.2, rand);
  for (const [x, y] of chunkPts) {
    const s = r * (0.07 + rand() * 0.07);
    g += `<path d="${chunkPath(x + s * 0.18, y + s * 0.22, s, rand)}" fill="#000" opacity="0.18" filter="url(#${id}-soft)"/>`;
    const d = chunkPath(x, y, s, rand);
    g += `<path d="${d}" fill="url(#${id}-chunk)"/>`;
    g += `<path d="${chunkPath(x - s * 0.25, y - s * 0.28, s * 0.35, rand)}" fill="${pal.hi}" opacity="0.35"/>`;
  }

  if (extras.includes('pecan')) {
    for (const [x, y] of scatter(cx, cy, r * 0.7, 4, r * 0.32, rand)) {
      const rot = f(rand() * 180);
      g += `<g transform="rotate(${rot} ${f(x)} ${f(y)})">
        <ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 0.13)}" ry="${f(r * 0.06)}" fill="#7a4520"/>
        <path d="M${f(x - r * 0.11)},${f(y)} Q${f(x - r * 0.05)},${f(y - r * 0.035)} ${f(x)},${f(y)} T${f(x + r * 0.11)},${f(y)}" fill="none" stroke="#4a2810" stroke-width="2.4"/>
        <ellipse cx="${f(x - r * 0.03)}" cy="${f(y - r * 0.025)}" rx="${f(r * 0.06)}" ry="${f(r * 0.014)}" fill="#b27a48" opacity="0.6"/>
      </g>`;
    }
  }
  if (extras.includes('caramel')) {
    let d = '';
    for (let k = 0; k < 3; k++) {
      const y0 = cy - r * 0.45 + k * r * 0.42 + (rand() - 0.5) * r * 0.1;
      d += `M${f(cx - r * 0.72)},${f(y0)} `;
      for (let i = 1; i <= 6; i++) {
        const x = cx - r * 0.72 + (i / 6) * r * 1.44;
        d += `Q${f(x - r * 0.12)},${f(y0 + (i % 2 ? -1 : 1) * r * 0.12)} ${f(x)},${f(y0 + (rand() - 0.5) * r * 0.08)} `;
      }
    }
    g += `<path d="${d}" fill="none" stroke="#9a5a1c" stroke-width="${f(r * 0.05)}" stroke-linecap="round" opacity="0.35" filter="url(#${id}-soft)"/>`;
    g += `<path d="${d}" fill="none" stroke="#d58a32" stroke-width="${f(r * 0.032)}" stroke-linecap="round" opacity="0.9"/>`;
    g += `<path d="${d}" fill="none" stroke="#ffd59a" stroke-width="${f(r * 0.009)}" stroke-linecap="round" opacity="0.7" transform="translate(-2,-2)"/>`;
  }
  if (extras.includes('pistachio')) {
    for (const [x, y] of scatter(cx, cy, r * 0.82, 22, r * 0.09, rand)) {
      const s = r * (0.025 + rand() * 0.03);
      g += `<path d="${chunkPath(x, y, s, rand)}" fill="${rand() > 0.4 ? '#7c9a3c' : '#a7bf5a'}"/>`;
    }
  }
  if (extras.includes('salt')) {
    for (const [x, y] of scatter(cx, cy, r * 0.8, 16, r * 0.1, rand)) {
      const s = r * (0.012 + rand() * 0.014);
      g += `<rect x="${f(x)}" y="${f(y)}" width="${f(s * 2)}" height="${f(s * 1.6)}" rx="1" fill="#fffaf0" opacity="0.92" transform="rotate(${f(rand() * 90)} ${f(x)} ${f(y)})"/>`;
    }
  }
  return g;
}

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">\n<title>${title}</title>\n${body}\n</svg>\n`;

function single(name, title, pal, seed, extras) {
  const id = name;
  const body = `<defs>${defs(id, pal)}</defs>${cookie({ id, pal, cx: 300, cy: 290, r: 230, seed, extras })}`;
  writeFileSync(resolve(OUT, `cookie-${name}.svg`), svg(600, 600, body, title));
}

single('classic', 'The Classic JU cookie (illustration)', P.classic, 11, ['salt']);
single('double-dark', 'Double Dark cookie (illustration)', P.dark, 23, ['salt']);
single('caramel', 'Salted Caramel Pecan cookie (illustration)', P.caramel, 37, ['pecan', 'caramel', 'salt']);
single('pistachio', 'Pistachio White cookie (illustration)', P.pistachio, 41, ['pistachio']);

// broken cookie with molten centre (hero fallback)
function broken(fileName, title, withCrumbs) {
  const id = 'brk';
  const pal = P.classic;
  const rand = rng(99);
  const cx = 400, cy = 330, r = 250;
  // jagged break line, top to bottom
  const line = [];
  for (let i = 0; i <= 12; i++) {
    const y = cy - r * 1.2 + (i / 12) * r * 2.4;
    line.push([cx + (rand() - 0.5) * r * 0.22, y]);
  }
  const lineStr = line.map((p) => `${f(p[0])},${f(p[1])}`).join(' L');
  const left = `M${cx - r * 1.5},${cy - r * 1.3} L${lineStr} L${cx - r * 1.5},${cy + r * 1.3}Z`;
  const right = `M${cx + r * 1.5},${cy - r * 1.3} L${lineStr} L${cx + r * 1.5},${cy + r * 1.3}Z`;
  const whole = cookie({ id, pal, cx, cy, r, seed: 5, extras: ['salt'] });

  // molten chocolate along the break
  const molten = [];
  const ml = line.slice(3, 10);
  const leftEdge = ml.map(([x, y]) => [x - 34, y]);
  const rightEdge = ml.map(([x, y]) => [x + 34, y]).reverse();
  molten.push(`<path d="${smoothPath([...leftEdge, ...rightEdge])}" fill="url(#brk-molten)"/>`);
  // strands
  for (let i = 0; i < 6; i++) {
    const [x, y] = ml[1 + Math.floor(rand() * (ml.length - 2))];
    const w = 4 + rand() * 7;
    molten.push(`<path d="M${f(x - 46)},${f(y)} C${f(x - 15)},${f(y + 10 + rand() * 12)} ${f(x + 15)},${f(y + 10 + rand() * 12)} ${f(x + 46)},${f(y)}" fill="none" stroke="#3a1d0c" stroke-width="${f(w)}" stroke-linecap="round"/>`);
    molten.push(`<path d="M${f(x - 40)},${f(y - 1)} C${f(x - 14)},${f(y + 7)} ${f(x + 14)},${f(y + 7)} ${f(x + 40)},${f(y - 1)}" fill="none" stroke="#8a5530" stroke-width="${f(w * 0.25)}" stroke-linecap="round" opacity="0.8"/>`);
  }
  // glossy highlights
  molten.push(`<path d="${smoothPath(ml.slice(1, 6).map(([x, y]) => [x - 8, y]).concat(ml.slice(1, 6).map(([x, y]) => [x + 2, y]).reverse()))}" fill="#a06a40" opacity="0.55"/>`);

  let crumbs = '';
  if (withCrumbs) {
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2, d = r * (1.05 + rand() * 0.45);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8 + 30;
      const s = 4 + rand() * 12;
      crumbs += `<path d="${chunkPath(x, y, s, rand)}" fill="${rand() > 0.75 ? '#3a1d0c' : pal.dough[1]}" opacity="0.95"/>`;
    }
  }

  const body = `<defs>${defs(id, pal)}
  <linearGradient id="brk-molten" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#2a1408"/><stop offset="0.45" stop-color="#5a3016"/><stop offset="0.55" stop-color="#6a3a1c"/><stop offset="1" stop-color="#2a1408"/>
  </linearGradient>
  <clipPath id="brk-l"><path d="${left}"/></clipPath>
  <clipPath id="brk-r"><path d="${right}"/></clipPath></defs>
  ${crumbs}
  ${molten.join('\n')}
  <g transform="translate(-42,8) rotate(-6 ${cx} ${cy})" clip-path="url(#brk-l)">${whole}</g>
  <g transform="translate(42,-4) rotate(5 ${cx} ${cy})" clip-path="url(#brk-r)">${whole}</g>`;
  writeFileSync(resolve(OUT, fileName), svg(800, 660, body, title));
}
broken('cookie-broken.svg', 'Cookie broken open with a molten chocolate centre (illustration)', false);
broken('cookie-crumbled.svg', 'A crumbled cookie (illustration)', true);

// open box of 4 (gifts section)
{
  const pals = [P.classic, P.dark, P.caramel, P.pistachio];
  const ex = [['salt'], ['salt'], ['pecan', 'caramel'], ['pistachio']];
  let d = '';
  pals.forEach((p, i) => (d += defs(`b${i}`, p)));
  let body = `<defs>${d}
  <linearGradient id="kraft" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9b88a"/><stop offset="1" stop-color="#b8915e"/></linearGradient>
  <filter id="box-sh"><feGaussianBlur stdDeviation="18"/></filter></defs>
  <rect x="70" y="90" width="660" height="660" rx="34" fill="#3a2213" opacity="0.3" filter="url(#box-sh)"/>
  <rect x="50" y="60" width="660" height="660" rx="30" fill="url(#kraft)"/>
  <rect x="78" y="88" width="604" height="604" rx="18" fill="#f3e6d2"/>
  <path d="M380 88 V692 M78 390 H682" stroke="#e2d0b4" stroke-width="6"/>`;
  [[229, 239], [531, 239], [229, 541], [531, 541]].forEach(([x, y], i) => {
    body += cookie({ id: `b${i}`, pal: pals[i], cx: x, cy: y, r: 128, seed: 200 + i * 7, extras: ex[i] });
  });
  writeFileSync(resolve(OUT, 'box-of-four.svg'), svg(780, 800, body, 'An open box of four cookies (illustration)'));
}

// gift box with ribbon and tag
{
  const body = `<defs>
  <linearGradient id="g-kraft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4c69a"/><stop offset="1" stop-color="#c49a64"/></linearGradient>
  <linearGradient id="g-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecd2aa"/><stop offset="1" stop-color="#d2ac76"/></linearGradient>
  <linearGradient id="g-rib" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a2213"/><stop offset="0.5" stop-color="#5c3a21"/><stop offset="1" stop-color="#3a2213"/></linearGradient>
  <filter id="g-sh"><feGaussianBlur stdDeviation="16"/></filter></defs>
  <ellipse cx="400" cy="700" rx="290" ry="34" fill="#3a2213" opacity="0.28" filter="url(#g-sh)"/>
  <rect x="140" y="330" width="520" height="370" rx="14" fill="url(#g-kraft)"/>
  <rect x="120" y="270" width="560" height="100" rx="14" fill="url(#g-lid)"/>
  <rect x="120" y="356" width="560" height="14" fill="#000" opacity="0.08"/>
  <rect x="370" y="270" width="60" height="430" fill="url(#g-rib)"/>
  <path d="M400 272 C330 180 220 180 236 236 C250 286 340 284 400 272Z" fill="#4a2e1b"/>
  <path d="M400 272 C470 180 580 180 564 236 C550 286 460 284 400 272Z" fill="#4a2e1b"/>
  <path d="M400 272 C350 205 270 205 280 238" fill="none" stroke="#7a5133" stroke-width="6" stroke-linecap="round"/>
  <path d="M400 272 C450 205 530 205 520 238" fill="none" stroke="#7a5133" stroke-width="6" stroke-linecap="round"/>
  <path d="M388 276 L340 380 L372 372 L384 404 L400 284Z M412 276 L460 380 L428 372 L416 404 L400 284Z" fill="#3a2213"/>
  <ellipse cx="400" cy="272" rx="30" ry="24" fill="#5c3a21"/>
  <g transform="rotate(-10 560 470)">
    <path d="M430 300 C470 360 520 420 540 450" fill="none" stroke="#7a5133" stroke-width="3"/>
    <rect x="510" y="440" width="150" height="96" rx="10" fill="#fdfbf7" stroke="#c9b08a" stroke-width="3"/>
    <circle cx="530" cy="462" r="7" fill="none" stroke="#c9b08a" stroke-width="3"/>
    <path d="M548 484 H636 M548 506 H612" stroke="#4a2e1b" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
    <path d="M610 466 c-4 -8 -14 -8 -14 1 c0 7 14 14 14 14 s14 -7 14 -14 c0 -9 -10 -9 -14 -1z" fill="#4a2e1b"/>
  </g>`;
  writeFileSync(resolve(OUT, 'gift-box.svg'), svg(800, 760, body, 'A gift box tied with a ribbon and a note card (illustration)'));
}

console.log('Artwork written to', OUT);
