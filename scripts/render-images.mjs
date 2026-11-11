// Renders the PNG icons and the social-share image from SVG/HTML sources.
// Run with: npm run icons   (needs Playwright + Chromium available locally)
// Outputs to public/: favicon-32.png, apple-touch-icon.png, icon-192.png,
// icon-512.png, icon-512-maskable.png, og-image.png

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PUB = resolve(import.meta.dirname, '../public');
const NM = resolve(import.meta.dirname, '../node_modules/@fontsource-variable');
const dataUri = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;

const favicon = dataUri(resolve(PUB, 'favicon.svg'), 'image/svg+xml');
const logo = dataUri(resolve(PUB, 'logo.svg'), 'image/svg+xml');
const cookie = dataUri(resolve(PUB, 'art/cookie-broken.svg'), 'image/svg+xml');
const fraunces = dataUri(resolve(NM, 'fraunces/files/fraunces-latin-opsz-normal.woff2'), 'font/woff2');
const frauncesItalic = dataUri(resolve(NM, 'fraunces/files/fraunces-latin-opsz-italic.woff2'), 'font/woff2');
const outfit = dataUri(resolve(NM, 'outfit/files/outfit-latin-wght-normal.woff2'), 'font/woff2');

const browser = await chromium.launch();
const page = await browser.newPage();

async function shot(html, w, h, file) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:F;src:url(${fraunces}) format('woff2');font-weight:100 900}
    @font-face{font-family:F;font-style:italic;src:url(${frauncesItalic}) format('woff2');font-weight:100 900}
    @font-face{font-family:O;src:url(${outfit}) format('woff2');font-weight:100 900}
    html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}
  </style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: resolve(PUB, file), omitBackground: true });
  console.log('wrote', file);
}

// Icons: the round logo on its own cream (iOS/Android add their own rounding).
const icon = (size, pad) =>
  `<div style="width:${size}px;height:${size}px;background:#fff8db;display:grid;place-items:center">
     <img src="${favicon}" style="width:${size * (1 - pad)}px;height:${size * (1 - pad)}px">
   </div>`;
await shot(`<img src="${favicon}" style="width:32px;height:32px;display:block">`, 32, 32, 'favicon-32.png');
await shot(icon(180, 0), 180, 180, 'apple-touch-icon.png');
await shot(icon(192, 0), 192, 192, 'icon-192.png');
await shot(icon(512, 0), 512, 512, 'icon-512.png');
await shot(icon(512, 0.22), 512, 512, 'icon-512-maskable.png');
// Square PNG of the logo for search engines (structured data)
await shot(`<img src="${logo}" style="width:512px;height:512px;display:block">`, 512, 512, 'logo.png');

// Social-share card (WhatsApp, Instagram DMs, Facebook, X…)
await shot(
  `<div style="width:1200px;height:630px;background:#fdfbf7;display:grid;grid-template-columns:1fr 520px;align-items:center;position:relative;overflow:hidden;font-family:O;color:#4a2e1b">
     <div style="position:absolute;right:-120px;top:-140px;width:760px;height:760px;border-radius:50%;background:#f5eee6"></div>
     <div style="padding:0 0 0 84px;position:relative">
       <div style="display:flex;align-items:center;gap:18px;margin-bottom:40px">
         <img src="${logo}" style="width:84px;height:84px;border-radius:50%">
         <span style="font-size:18px;letter-spacing:.22em;text-transform:uppercase;font-weight:600;opacity:.7">Made For Ju · Malta</span>
       </div>
       <div style="font-family:F;font-size:104px;line-height:.95;letter-spacing:-.035em;font-weight:620">NY Cookies<br><i style="font-weight:400">Malta.</i></div>
       <div style="margin-top:34px;font-size:27px;line-height:1.4;opacity:.8;max-width:520px">Thick, gooey, small-batch cookies. Pre&#8209;order on Instagram for weekend delivery.</div>
     </div>
     <img src="${cookie}" style="width:560px;position:relative;left:-30px">
   </div>`,
  1200,
  630,
  'og-image.png'
);

await browser.close();
