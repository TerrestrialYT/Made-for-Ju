// Real-time 3D hero: a thick NY-style cookie that breaks open on scroll/tap,
// revealing a molten centre. Everything is generated in code (no downloads),
// unless `site.hero.modelUrl` points to a .glb, which is used instead.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { site } from './config.js';

// seeded noise
function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return s;
}

// cookie shape (shared by the shell and the break faces)
const R = 1; // radius
const H = 0.2; // half-thickness of the rounded body
const YC = 0.14; // body centre height
const DOME = 0.07; // extra rise in the middle
const N_EXP = 3.2; // squircle exponent: higher = flatter top, rounder rim
const wobble = (th) => 1 + 0.035 * Math.sin(3 * th + 0.7) + 0.025 * Math.sin(5 * th + 2.1) + 0.015 * Math.sin(9 * th + 4.0);
const lumps = (x, z) => (fbm(x * 2.2 + 10, z * 2.2 + 3, 4) - 0.5) * 0.11;
const profile = (rho) => Math.pow(Math.max(0, 1 - Math.pow(rho, N_EXP)), 1 / N_EXP);
const topWeight = (rho) => 1 - smooth(Math.min(1, Math.max(0, (rho - 0.78) / 0.22)));
const topY = (x, z, rho) => YC + H * profile(rho) + DOME * (1 - rho * rho) + lumps(x, z) * topWeight(rho);
const botY = (rho) => YC - H * 0.7 * profile(rho);
const rhoAt = (x, z) => Math.hypot(x, z) / (R * wobble(Math.atan2(z, x)));

// Jagged break line: x = jag(z). Must match the GLSL version below.
const jag = (z) => 0.06 * Math.sin(z * 7.0 + 1.3) + 0.035 * Math.sin(z * 17.0 + 0.4) + 0.018 * Math.sin(z * 31.0);
const JAG_GLSL = 'float jag(float z){return 0.06*sin(z*7.0+1.3)+0.035*sin(z*17.0+0.4)+0.018*sin(z*31.0);}';

const C_CENTER = new THREE.Color('#e6bb80');
const C_EDGE = new THREE.Color('#ad7240');
const C_BOTTOM = new THREE.Color('#87573a');

function buildShell() {
  const RINGS = 56, SEG = 180;
  const pos = [], col = [], uv = [], idx = [];
  const tmp = new THREE.Color();
  // Top cap: rings 0..RINGS (centre → rim); bottom cap: RINGS..0 (rim → centre)
  const ringRho = (i) => Math.sin((i / RINGS) * Math.PI * 0.5);
  const addRing = (rho, top) => {
    for (let s = 0; s <= SEG; s++) {
      const th = (s / SEG) * Math.PI * 2;
      const w = wobble(th);
      const x = Math.cos(th) * rho * R * w;
      const z = Math.sin(th) * rho * R * w;
      const y = top ? topY(x, z, rho) : botY(rho);
      pos.push(x, y, z);
      uv.push(x / 2.4 + 0.5, z / 2.4 + 0.5);
      if (top) tmp.copy(C_CENTER).lerp(C_EDGE, smooth(Math.min(1, Math.max(0, (rho - 0.45) / 0.55))));
      else tmp.copy(C_BOTTOM);
      // a little baked variation
      const v = 0.92 + fbm(x * 3 + 5, z * 3 + 9, 3) * 0.16;
      col.push(tmp.r * v, tmp.g * v, tmp.b * v);
    }
  };
  for (let i = 0; i <= RINGS; i++) addRing(ringRho(i), true);
  for (let i = RINGS; i >= 0; i--) addRing(ringRho(i), false);
  const rows = (RINGS + 1) * 2;
  for (let r = 0; r < rows - 1; r++) {
    for (let s = 0; s < SEG; s++) {
      const a = r * (SEG + 1) + s, b = a + SEG + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// The exposed inside of the cookie along the break line.
function buildBreakFace() {
  // find z range inside the cookie along the jag line
  const inside = (z) => rhoAt(jag(z), z) < 1;
  const edge = (a, b) => {
    for (let i = 0; i < 30; i++) {
      const m = (a + b) / 2;
      if (inside(m) === inside(a)) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };
  const z0 = edge(0, -1.3), z1 = edge(0, 1.3);
  const NZ = 120, NY = 18;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NZ; i++) {
    const z = z0 + ((z1 - z0) * i) / NZ;
    const x = jag(z);
    const rho = Math.min(1, rhoAt(x, z));
    const yt = topY(x, z, rho) - 0.003, yb = botY(rho) + 0.002;
    for (let j = 0; j <= NY; j++) {
      const y = yb + ((yt - yb) * j) / NY;
      pos.push(x, y, z);
      uv.push((z - z0) / 0.96, y / 0.48);
    }
  }
  for (let i = 0; i < NZ; i++)
    for (let j = 0; j < NY; j++) {
      const a = i * (NY + 1) + j, b = a + NY + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geometry: g, z0, z1 };
}

// procedural textures
function canvasTex(w, h, paint, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  paint(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Give the browser a chance to handle scrolling/taps between heavy steps.
const breathe = () =>
  globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0));

async function crustTextures() {
  const S = 512;
  const data = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    if (y % 24 === 0) await breathe();
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      let n = fbm(u * 18, v * 18, 4) * 0.7 + fbm(u * 70 + 3, v * 70 + 7, 2) * 0.3;
      // crackle: thin dark valleys
      const cr = Math.abs(fbm(u * 9 + 20, v * 9 + 40, 3) - 0.5);
      if (cr < 0.012) n -= (0.012 - cr) * 9;
      data[y * S + x] = n;
    }
  }
  const toImg = (ctx, fn) => {
    const img = ctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const [r, g, b] = fn(data[i]);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  const map = canvasTex(S, S, (ctx) =>
    toImg(ctx, (n) => {
      const k = Math.max(0.55, Math.min(1.12, 0.72 + n * 0.5));
      return [255 * k, 248 * k, 236 * k];
    })
  );
  const bump = canvasTex(
    S,
    S,
    (ctx) =>
      toImg(ctx, (n) => {
        const k = Math.max(0, Math.min(255, n * 255));
        return [k, k, k];
      }),
    false
  );
  return { map, bump };
}

function interiorTextures() {
  const W = 1024, Hh = 512;
  const rand = mulberry(77);
  const blobs = [];
  for (let i = 0; i < 14; i++) blobs.push([(i + 0.15 + rand() * 0.7) * (W / 14), Hh * (0.35 + rand() * 0.4), 30 + rand() * 40, rand()]);
  const paintBase = (ctx, choc, dough) => {
    ctx.fillStyle = dough;
    ctx.fillRect(0, 0, W, Hh);
    return choc;
  };
  const map = canvasTex(W, Hh, (ctx) => {
    paintBase(ctx, null, '#cf9a5c');
    // airy crumb
    for (let i = 0; i < 2600; i++) {
      const x = rand() * W, y = rand() * Hh, r = 1 + rand() * 4;
      ctx.fillStyle = `rgba(125,72,32,${0.1 + rand() * 0.22})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.4, r, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // darker baked skin at top and bottom
    const g = ctx.createLinearGradient(0, 0, 0, Hh);
    g.addColorStop(0, 'rgba(120,70,30,0.25)');
    g.addColorStop(0.18, 'rgba(120,70,30,0)');
    g.addColorStop(0.85, 'rgba(120,70,30,0)');
    g.addColorStop(1, 'rgba(110,60,25,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, Hh);
    // soft, under-baked gooey band through the middle
    const goo = ctx.createLinearGradient(0, Hh * 0.2, 0, Hh * 0.95);
    goo.addColorStop(0, 'rgba(150,90,40,0)');
    goo.addColorStop(0.5, 'rgba(150,90,40,0.35)');
    goo.addColorStop(1, 'rgba(150,90,40,0)');
    ctx.fillStyle = goo;
    ctx.fillRect(0, 0, W, Hh);
    // molten chocolate pockets, soft-edged and slightly drooping
    ctx.filter = 'blur(5px)';
    for (const [x, y, r] of blobs) {
      const g2 = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g2.addColorStop(0, '#6a3a1c');
      g2.addColorStop(0.55, '#3a1c0b');
      g2.addColorStop(1, '#2e1608');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.7, r * 0.45, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = 'none';
  });
  const rough = canvasTex(
    W,
    Hh,
    (ctx) => {
      ctx.fillStyle = 'rgb(235,235,235)';
      ctx.fillRect(0, 0, W, Hh);
      for (const [x, y, r] of blobs) {
        ctx.fillStyle = 'rgb(60,60,60)';
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.7, r * 0.45, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    false
  );
  map.wrapS = rough.wrapS = THREE.RepeatWrapping;
  return { map, rough };
}

function shadowTexture() {
  return canvasTex(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(58,34,19,0.55)');
    g.addColorStop(0.5, 'rgba(58,34,19,0.2)');
    g.addColorStop(1, 'rgba(58,34,19,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

// Shell material that only draws one side of the break line.
function halfMaterial(side, tex) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale: 1.4,
    roughness: 0.82,
    metalness: 0,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSide = { value: side };
    shader.vertexShader = 'varying vec3 vCut;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCut = position;');
    shader.fragmentShader =
      `varying vec3 vCut;\nuniform float uSide;\n${JAG_GLSL}\n` +
      shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (uSide * (vCut.x - jag(vCut.z)) < 0.0) discard;');
  };
  m.customProgramCacheKey = () => `half${side}`;
  return m;
}

function chunkGeometry(rand) {
  let g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const ox = rand() * 50, oy = rand() * 50;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // smooth lumpy chunk: low-frequency noise on the sphere, flattened base
    const k = 0.72 + fbm(x * 1.3 + ox, z * 1.3 + y * 0.9 + oy, 3) * 0.6;
    p.setXYZ(i, x * k, Math.max(y * k, -0.25), z * k);
  }
  g.computeVertexNormals();
  return g;
}

// main
// spin speed (rad/s); slower for visitors who prefer reduced motion
let SPIN = 0.32;

export function mountHero(mount, { calm = false } = {}) {
  if (calm) SPIN = 0.14;
  const stage = mount.closest('.hero-stage');
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  // Phones have very dense screens; 1.5x is visually the same and far cheaper.
  let dpr = Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  mount.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y';

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 4.5, 4.6);
  camera.lookAt(0, 0.12, 0);

  scene.add(new THREE.HemisphereLight('#fff3e2', '#6b4a32', 0.9));
  const key = new THREE.DirectionalLight('#ffe6c8', 2.1);
  key.position.set(3, 5, 2.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffd9ad', 1.1);
  rim.position.set(-3.5, 2, -3);
  scene.add(rim);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 2.9),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.04;
  scene.add(shadow);

  const root = new THREE.Group();
  scene.add(root);

  const state = { breakTarget: 0, breakAmt: 0, manual: false, pointer: new THREE.Vector2(), tilt: new THREE.Vector2(), spin: 0.6, spinTarget: null };
  let onFrame = () => {};
  let ready = false;

  (site.hero?.modelUrl ? loadModel(site.hero.modelUrl, root, state) : buildCookie(root, state))
    .then(async (fn) => {
      onFrame = fn;
      // Compile shaders in the background (where supported) before showing.
      try {
        if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) {
          await renderer.compileAsync(scene, camera);
        }
      } catch {}
      ready = true;
      // Draw the first frame now, even if the cookie is still below the fold,
      // so it is already there when the visitor scrolls to it.
      if (first) loop(performance.now());
    })
    .catch((err) => console.warn('3D hero unavailable, keeping illustration.', err));

  // interaction
  // Break progress follows the cookie's own position on screen, so on phones
  // (where it sits below the buttons) it opens while you can actually see it.
  const onScroll = () => {
    const vh = window.innerHeight;
    const r = mount.getBoundingClientRect();
    const centre = r.top + r.height / 2;
    const start = Math.min(centre + window.scrollY, vh * 0.7);
    state.breakTarget = Math.min(1, Math.max(0, (start - centre) / (vh * 0.4)));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  const onPointerMove = (e) => {
    const r = mount.getBoundingClientRect();
    state.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  let downAt = null;
  mount.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
  mount.addEventListener('pointerup', (e) => {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 8) state.manual = !state.manual;
    downAt = null;
  });
  mount.style.cursor = 'pointer';

  // sizing & loop
  const resize = () => {
    const { width, height } = mount.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // keep the opened cookie (≈3 units wide) in frame on narrow stages
    camera.fov = camera.aspect < 1 ? 28 / Math.max(0.7, camera.aspect) : 28;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(mount);
  resize();

  const clock = new THREE.Timer();
  let first = true;
  // Adaptive quality: if frames are slow, render fewer pixels.
  let slowFrames = 0, sampled = 0;
  const adapt = (rawDt) => {
    if (dpr <= 0.75 || document.hidden) return;
    sampled++;
    if (rawDt > 1 / 40) slowFrames++;
    if (sampled >= 90) {
      if (slowFrames > 45) {
        dpr = Math.max(0.75, dpr * 0.75);
        renderer.setPixelRatio(dpr);
        resize();
      }
      sampled = slowFrames = 0;
    }
  };
  const loop = (time) => {
    clock.update(time);
    if (!ready) return;
    const rawDt = clock.getDelta();
    if (!first) adapt(rawDt);
    const dt = Math.min(rawDt, 0.05);
    const t = clock.getElapsed();
    const target = Math.max(state.breakTarget, state.manual ? 1 : 0);
    state.breakAmt += (target - state.breakAmt) * Math.min(1, dt * 3.2);
    state.tilt.lerp(state.pointer, Math.min(1, dt * 2.5));

    onFrame(dt, t);
    root.position.y = Math.sin(t * 1.1) * (calm ? 0.01 : 0.025);
    root.rotation.x = state.tilt.y * 0.12;
    root.rotation.z = -state.tilt.x * 0.08;
    shadow.scale.setScalar(1 + state.breakAmt * 0.12);
    shadow.material.opacity = 0.9 - Math.sin(t * 1.1) * 0.08;

    renderer.render(scene, camera);
    if (first) {
      first = false;
      stage?.classList.add('is-3d');
      document.getElementById('hero-hint')?.classList.remove('hidden');
    }
  };

  // only render while visible
  let running = false;
  const setRunning = (on) => {
    if (on === running) return;
    running = on;
    renderer.setAnimationLoop(on ? loop : null);
  };
  let inView = true;
  new IntersectionObserver(([en]) => {
    inView = en.isIntersecting;
    setRunning(inView && !document.hidden);
  }).observe(mount);
  document.addEventListener('visibilitychange', () => setRunning(inView && !document.hidden));
  setRunning(true);
}

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

async function buildCookie(root, state) {
  const rand = mulberry(2026);
  const crust = await crustTextures();
  await breathe();
  const inner = interiorTextures();
  await breathe();
  const shell = buildShell();
  const face = buildBreakFace();
  await breathe();

  const faceMat = new THREE.MeshPhysicalMaterial({
    map: inner.map,
    roughnessMap: inner.rough,
    roughness: 1,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    side: THREE.DoubleSide,
  });

  const chocoMat = new THREE.MeshPhysicalMaterial({ color: '#3a1d0c', roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.45 });
  const meltMat = new THREE.MeshPhysicalMaterial({ color: '#45210e', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const saltMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.35 });

  const halves = [-1, 1].map((side) => {
    const pivot = new THREE.Group(); // hinge at the bottom of the break line
    const half = new THREE.Group();
    half.add(new THREE.Mesh(shell, halfMaterial(side, crust)));
    const faceMesh = new THREE.Mesh(face.geometry, faceMat);
    faceMesh.visible = false; // only shown once the cookie starts to open
    half.add(faceMesh);
    pivot.add(half);
    root.add(pivot);
    return { side, pivot, half, faceMesh };
  });

  // chocolate chunks + flaky salt, assigned to whichever half they sit on
  const chunkGeos = Array.from({ length: 5 }, () => chunkGeometry(rand));
  let placed = 0;
  const spots = [];
  for (let tries = 0; placed < 20 && tries < 2000; tries++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.8;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = 0.06 + rand() * 0.06;
    if (Math.abs(x - jag(z)) < s * 1.2) continue;
    if (spots.some(([px, pz]) => Math.hypot(px - x, pz - z) < 0.27)) continue;
    spots.push([x, z]);
    const rho = rhoAt(x, z);
    const m = new THREE.Mesh(chunkGeos[placed % 5], rand() > 0.7 ? meltMat : chocoMat);
    m.scale.set(s * (1 + rand() * 0.4), s * 0.5, s * (0.85 + rand() * 0.35));
    m.rotation.set(rand() * 0.6, rand() * Math.PI, rand() * 0.6);
    m.position.set(x, topY(x, z, rho) - s * 0.12, z);
    halves[x < jag(z) ? 0 : 1].half.add(m);
    placed++;
  }
  const saltGeo = new THREE.BoxGeometry(0.035, 0.012, 0.028);
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.8;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x - jag(z)) < 0.04) continue;
    const m = new THREE.Mesh(saltGeo, saltMat);
    m.position.set(x, topY(x, z, rhoAt(x, z)) + 0.004, z);
    m.rotation.set(rand() * 0.5, rand() * Math.PI, rand() * 0.5);
    halves[x < jag(z) ? 0 : 1].half.add(m);
  }

  // molten strands: tapered, sagging tubes rebuilt in place each frame
  const SEG = 18, RAD = 8;
  const makeTube = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * (RAD + 1) * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((SEG + 1) * (RAD + 1) * 3), 3));
    const idx = [];
    for (let i = 0; i < SEG; i++)
      for (let j = 0; j < RAD; j++) {
        const a = i * (RAD + 1) + j, b = a + RAD + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    g.setIndex(idx);
    return g;
  };
  const strands = Array.from({ length: 9 }, (_, i) => {
    const z = face.z0 * 0.7 + (face.z1 - face.z0) * 0.7 * ((i + 0.2 + rand() * 0.6) / 9);
    const x = jag(z), rho = rhoAt(x, z);
    const y = botY(rho) + (topY(x, z, rho) - botY(rho)) * (0.35 + rand() * 0.45);
    const mesh = new THREE.Mesh(makeTube(), meltMat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    root.add(mesh);
    return { local: new THREE.Vector3(x, y, z), snap: 0.55 + rand() * 0.6, base: 0.04 + rand() * 0.035, mesh };
  });

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const updateTube = (geo, p0, p1, p2, r0) => {
    const pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
    let k = 0;
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG, it = 1 - t;
      P.set(0, 0, 0).addScaledVector(p0, it * it).addScaledVector(p1, 2 * it * t).addScaledVector(p2, t * t);
      T.set(0, 0, 0).addScaledVector(p0, -2 * it).addScaledVector(p1, 2 * (it - t)).addScaledVector(p2, 2 * t).normalize();
      N.crossVectors(T, WORLD_UP).normalize();
      B.crossVectors(N, T).normalize();
      const r = r0 * (0.3 + 0.7 * Math.pow(Math.abs(t - 0.5) * 2, 1.4));
      for (let j = 0; j <= RAD; j++) {
        const ang = (j / RAD) * Math.PI * 2, cs = Math.cos(ang), sn = Math.sin(ang);
        const nx = N.x * cs + B.x * sn, ny = N.y * cs + B.y * sn, nz = N.z * cs + B.z * sn;
        pos[k] = P.x + nx * r; pos[k + 1] = P.y + ny * r; pos[k + 2] = P.z + nz * r;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
        k += 3;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
  };

  return (dt) => {
    const e = easeInOut(state.breakAmt);

    // spin while whole; settle so the break faces the camera while opening
    if (e < 0.02) {
      state.spin += dt * SPIN;
      state.spinTarget = null;
    } else if (state.spinTarget === null) {
      state.spinTarget = Math.round(state.spin / Math.PI) * Math.PI;
    }
    const angle = state.spinTarget === null ? state.spin : state.spin + (state.spinTarget - state.spin) * Math.min(1, e * 1.6);
    root.rotation.y = angle;

    for (const { side, pivot, faceMesh } of halves) {
      pivot.position.set(side * e * 0.36, e * 0.27, 0);
      pivot.rotation.z = -side * e * 0.24;
      faceMesh.visible = e > 0.004;
    }
    root.updateMatrixWorld(true);

    for (const s of strands) {
      // endpoints on each half's break face, in the cookie's local space
      halves[0].half.localToWorld(a.copy(s.local));
      halves[1].half.localToWorld(b.copy(s.local));
      root.worldToLocal(a);
      root.worldToLocal(b);
      const len = a.distanceTo(b);
      const show = e > 0.03 && len < s.snap;
      s.mesh.visible = show;
      if (!show) continue;
      c.addVectors(a, b).multiplyScalar(0.5);
      c.y -= len * 0.35; // sag
      const thick = s.base * Math.min(1, Math.sqrt(0.2 / Math.max(len, 0.05))) * (1 - Math.pow(len / s.snap, 4) * 0.5);
      updateTube(s.mesh.geometry, a, c, b, thick);
    }
  };
}

async function loadModel(url, root, state) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 2 / Math.max(size.x, size.z);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  root.add(model);

  let mixer = null, action = null, clip = null;
  if (gltf.animations?.length) {
    mixer = new THREE.AnimationMixer(model);
    clip = gltf.animations[0];
    action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
  }
  return (dt) => {
    if (state.breakAmt < 0.02) state.spin += dt * SPIN;
    root.rotation.y = state.spin;
    if (action) {
      action.time = easeInOut(state.breakAmt) * clip.duration * 0.999;
      mixer.update(0);
    }
  };
}
