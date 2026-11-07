# Made For Ju

Website for **Made For Ju**, a small New York-style cookie bakery in Malta. Orders go through Instagram DMs, so every button on the site ends up there.

## Features

- 3D cookie in the hero (Three.js, built in code). It breaks open as you scroll or tap. Phones that can't handle it just get the illustration.
- Order builder: choose a box, flavours (or Ju's mix), delivery or pickup. The site writes the Instagram message, copies it and opens the DM.
- Gift option with recipient, occasion, card style and a short note.
- Order bar that sticks to the bottom on mobile once you scroll past the hero.
- Fraunces and Outfit fonts, hosted with the site.
- Animations turn off for people who have reduced motion switched on.
- Favicon, app icons, share image and a 404 page.

## Stack

- **Vite** (plain HTML, CSS and JS, no framework)
- **Tailwind CSS v4**, compiled at build time
- **Three.js**, loaded lazily for the hero only
- Fonts self-hosted via `@fontsource-variable`

## Editing content

Flavours, prices, box sizes, delivery days and area, the weekly order cut-off, the weekend drop status and the gift options are all in `src/config.js`. Anything left as `null` is hidden on the site.

- Show prices: set `showPrices: true` and fill in each box's `price`.
- Order cut-off: for example `orderCutoff: { weekday: 4, hour: 20, label: 'Thursday 8pm' }`.
- Sold out or limited boxes: `drop: { status: 'soldout' }` or `drop: { status: 'open', slotsLeft: 6 }`.
- Your own 3D model: put a `.glb` in `public/models/` and set `hero.modelUrl`. If the model has an animation, scrolling scrubs through it.

> The four flavours in `config.js` are placeholders. Replace them with Ju's real menu before launch.

### Photos
The cookie images in `public/art/` are placeholder illustrations (`npm run art` regenerates them). To use real photos, replace a file with the same name, or point the `art` path in `config.js` at a new image.

## Running it locally

```bash
npm install
```

```bash
npm run dev
```

## Deploying to Vercel

1. Import the repository in Vercel. It detects Vite automatically (`npm run build` → `dist/`).
2. Optional: once you have a custom domain, add the environment variable `VITE_SITE_URL` (for example `https://madeforju.com`) so social-share links use it.
3. Deploy. `vercel.json` adds long-term caching for assets, security headers and clean URLs, and `404.html` is served for unknown pages.

### Regenerating images
- `npm run art`: the stand-in cookie illustrations
- `npm run icons`: the favicon, app icons and social-share image (needs Playwright installed locally)

## Developer

**Built by [TerrestrialYT](https://terrestrialyt.com/)**
If you are looking for custom, high-end web development, creative UI/UX design, and digital brand elevation, feel free to reach out.
