import { site } from './config.js';

const $ = (sel, root = document) => root.querySelector(sel);
const money = (n) => `${site.currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;
const hasPrice = (v) => typeof v === 'number' && Number.isFinite(v);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const flavours = site.flavours.filter((f) => f.available !== false);

const state = {
  boxId: site.boxes[0]?.id,
  juMix: true,
  counts: Object.fromEntries(flavours.map((f) => [f.id, 0])),
  fulfil: 'Weekend delivery',
  gift: false,
  cardStyle: site.gift.cardStyles[0] || null,
};

const box = () => site.boxes.find((b) => b.id === state.boxId) || site.boxes[0];
const picked = () => Object.values(state.counts).reduce((a, b) => a + b, 0);

// order cut-off
// Returns the next cut-off Date in Malta time, or null when not configured.
export function nextCutoff(now = new Date()) {
  const c = site.orderCutoff;
  if (!c || typeof c.weekday !== 'number' || typeof c.hour !== 'number') return null;
  // Work in Europe/Malta wall-clock time regardless of the visitor's zone.
  const malta = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Malta' }));
  const offset = malta.getTime() - now.getTime();
  const target = new Date(malta);
  target.setHours(c.hour, 0, 0, 0);
  let add = (c.weekday - malta.getDay() + 7) % 7;
  if (add === 0 && malta >= target) add = 7;
  target.setDate(target.getDate() + add);
  return new Date(target.getTime() - offset);
}

export function cutoffText(now = new Date()) {
  const c = site.orderCutoff;
  const at = nextCutoff(now);
  if (!c || !at) return '';
  const ms = at - now;
  const h = Math.floor(ms / 36e5);
  const left = h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h}h left` : `${Math.max(1, Math.round(ms / 6e4))} min left`;
  return `Order by ${c.label} for this weekend · ${left}`;
}

// rendering
function renderBoxes() {
  $('#box-options').innerHTML = site.boxes
    .map(
      (b) => `
      <label class="opt">
        <input type="radio" name="box" value="${esc(b.id)}" ${b.id === state.boxId ? 'checked' : ''} />
        <span class="font-serif text-lg font-semibold">${esc(b.label)}</span>
        <span class="text-xs text-choco/65">${esc(b.tagline || '')}</span>
        ${site.showPrices && hasPrice(b.price) ? `<span class="mt-1 text-sm font-semibold">${money(b.price)}</span>` : ''}
      </label>`
    )
    .join('');
}

function renderFlavours() {
  $('#flavour-list').innerHTML = flavours
    .map(
      (f) => `
      <li class="flex items-center gap-3 px-3 py-2.5">
        <img src="${esc(f.art)}" alt="" width="44" height="44" class="size-11 shrink-0 object-contain" loading="lazy" />
        <span class="min-w-0 flex-grow text-sm font-medium leading-tight">${esc(f.name)}</span>
        <span class="flex items-center gap-2">
          <button type="button" class="stepper-btn" data-step="-1" data-id="${esc(f.id)}" aria-label="Remove one ${esc(f.name)}">−</button>
          <output class="w-5 text-center text-sm font-semibold tabular-nums" data-count="${esc(f.id)}">0</output>
          <button type="button" class="stepper-btn" data-step="1" data-id="${esc(f.id)}" aria-label="Add one ${esc(f.name)}">+</button>
        </span>
      </li>`
    )
    .join('');
}

function renderCardStyles() {
  const wrap = $('#card-styles');
  wrap.innerHTML = site.gift.cardStyles
    .map(
      (s, i) => `
      <label class="opt rounded-full px-3.5 py-1.5">
        <input type="radio" name="card" value="${esc(s)}" ${i === 0 ? 'checked' : ''} />
        <span class="text-xs font-semibold">${esc(s)}</span>
      </label>`
    )
    .join('');
  if (!site.gift.cardStyles.length) wrap.parentElement.hidden = true;
}

function syncFlavourUI() {
  const size = box().size;
  // Clamp counts if the box got smaller.
  let over = picked() - size;
  for (const f of [...flavours].reverse()) {
    while (over > 0 && state.counts[f.id] > 0) {
      state.counts[f.id]--;
      over--;
    }
  }
  const total = picked();
  const list = $('#flavour-list');
  list.classList.toggle('opacity-45', state.juMix);
  list.classList.toggle('pointer-events-none', state.juMix);
  list.toggleAttribute('inert', state.juMix);

  for (const f of flavours) {
    $(`[data-count="${f.id}"]`).textContent = state.counts[f.id];
    $(`[data-step="-1"][data-id="${f.id}"]`).disabled = state.counts[f.id] === 0;
    $(`[data-step="1"][data-id="${f.id}"]`).disabled = total >= size;
  }
  $('#flavour-count').textContent = state.juMix
    ? `${size} cookies, our pick`
    : total === size
      ? `${total} of ${size} chosen ✓`
      : `${total} of ${size} chosen${total ? ` · ${size - total} left for Ju to pick` : ''}`;
}

function giftDetails() {
  const v = (id) => $(id).value.trim();
  return {
    to: v('#g-to'),
    area: v('#g-area'),
    occasion: v('#g-occasion'),
    day: v('#g-day'),
    note: v('#g-note'),
    from: v('#g-from'),
    noPrice: $('#g-noprice').checked,
  };
}

export function buildMessage() {
  const b = box();
  const lines = [`Hey Ju! 👋 I'd love to pre-order a ${b.label}.`];

  if (state.juMix) {
    lines.push(`• Flavours: Ju's mix`);
  } else {
    const parts = flavours.filter((f) => state.counts[f.id]).map((f) => `${state.counts[f.id]}× ${f.name}`);
    const rest = b.size - picked();
    if (rest > 0) parts.push(`${rest}× your pick`);
    lines.push(`• Flavours: ${parts.join(', ')}`);
  }
  lines.push(`• ${state.fulfil}`);

  if (state.gift) {
    const g = giftDetails();
    const who = [g.to || 'someone special', g.area && `in ${g.area}`].filter(Boolean).join(' ');
    lines.push('', `🎁 It's a ${g.occasion ? g.occasion.toLowerCase() + ' ' : ''}gift for ${who}.`);
    if (g.day) lines.push(`• Preferred day: ${g.day}`);
    if (state.cardStyle) lines.push(`• Card: ${state.cardStyle}`);
    if (g.note) lines.push(`• Note: "${g.note}"`);
    if (g.from) lines.push(`• From: ${g.from}`);
    if (g.noPrice) lines.push(`• Please keep prices out of the box.`);
  }

  lines.push('', 'Is there availability this weekend?');
  return lines.join('\n');
}

function total() {
  const b = box();
  if (!site.showPrices || !hasPrice(b.price)) return null;
  let t = b.price;
  if (state.gift && hasPrice(site.gift.price)) t += site.gift.price;
  return t;
}

function update() {
  syncFlavourUI();
  $('#gift-fields').classList.toggle('hidden', !state.gift);
  const note = $('#g-note');
  $('#g-note-count').textContent = `${note.value.length}/${site.gift.noteMaxLength}`;
  $('#dm-preview').textContent = buildMessage();

  const t = total();
  const row = $('#order-total');
  row.classList.toggle('hidden', t === null);
  row.classList.toggle('flex', t !== null);
  if (t !== null) $('#order-total-value').textContent = money(t);
}

// clipboard
function copy(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
  }
  return Promise.resolve(legacyCopy(text));
}
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {}
  ta.remove();
  return ok;
}

// dialog control
const dialog = () => $('#order-dialog');
const DEFAULT_STATUS = 'Instagram opens in a new tab. Just paste the message into the chat.';

export function openOrder({ gift = false, occasion } = {}) {
  const d = dialog();
  state.gift = gift || state.gift;
  $('#is-gift').checked = state.gift;
  if (occasion) {
    const sel = $('#g-occasion');
    sel.value = [...sel.options].some((o) => o.value === occasion) ? occasion : 'Other';
  }
  $('#send-status').textContent = DEFAULT_STATUS;
  const cut = cutoffText();
  $('#order-cutoff').textContent = cut;
  $('#order-cutoff').classList.toggle('hidden', !cut);
  update();
  if (!d.open) {
    d.showModal();
    document.documentElement.classList.add('modal-open');
  }
  if (gift) requestAnimationFrame(() => $('#g-to').focus());
}

export function initOrder() {
  const d = dialog();
  if (!d) return;

  // Instagram links use the direct-DM URL from config.
  document.querySelectorAll('a[href="https://ig.me/m/_madeforju"]').forEach((a) => (a.href = site.instagram.dmUrl));
  document.querySelectorAll('a[href="https://www.instagram.com/_madeforju/"]').forEach((a) => (a.href = site.instagram.profileUrl));

  renderBoxes();
  renderFlavours();
  renderCardStyles();
  $('#g-note').maxLength = site.gift.noteMaxLength;
  if (!site.gift.enabled) $('#gift-fieldset').hidden = true;

  const form = $('#order-form');
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'box') state.boxId = t.value;
    if (t.name === 'fulfil') state.fulfil = t.value;
    if (t.name === 'card') state.cardStyle = t.value;
    if (t.id === 'ju-mix') state.juMix = t.checked;
    if (t.id === 'is-gift') state.gift = t.checked;
    update();
  });
  form.addEventListener('input', update);
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    const id = btn.dataset.id;
    const step = Number(btn.dataset.step);
    if (step > 0 && picked() >= box().size) return;
    state.counts[id] = Math.max(0, state.counts[id] + step);
    update();
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  // The send button is a real link, so the browser opens Instagram
  // immediately on tap (never blocked). We copy the message in the same tap.
  $('#send-order').addEventListener('click', () => {
    const msg = buildMessage();
    copy(msg).then((ok) => {
      $('#send-status').textContent = ok
        ? '✓ Message copied. Paste it into the Instagram chat.'
        : 'Instagram is opening. Copy the message above and paste it in the chat.';
    });
  });

  // Open triggers
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open-order]');
    if (opener) return openOrder();
    const giftBtn = e.target.closest('[data-gift]');
    if (giftBtn) return openOrder({ gift: true, occasion: giftBtn.dataset.gift });
  });

  update();
}
