// Made For Ju site settings.
// Menu, prices, delivery days, order cut-off and gift options all live here.
// Anything left as null is hidden on the site.

export const site = {
  instagram: {
    handle: '_madeforju',
    profileUrl: 'https://www.instagram.com/_madeforju/',
    // Opens a DM thread with the account directly (app on phones, web on desktop).
    dmUrl: 'https://ig.me/m/_madeforju',
  },

  // Prices. Set `showPrices: true` and fill each `price` (number, e.g. 14)
  // to show prices on the menu and a running total in the order builder.
  currency: '€',
  showPrices: false,

  boxes: [
    { id: 'box4', label: 'Box of 4', size: 4, tagline: 'The Classic JU', price: null },
    { id: 'box6', label: 'Box of 6', size: 6, tagline: 'Party & Share Size', price: null },
  ],

  // "Custom box": the customer picks how many cookies they want.
  // min is the smallest order allowed. pricePerCookie (number or null) is
  // used for the running total when showPrices is on.
  custom: { enabled: true, min: 4, max: 48, start: 8, pricePerCookie: null },

  // SAMPLE MENU, replace with Ju's real flavours before launch.
  // `art` points to an image in /public/art. Swap in real photos with the
  // same file name (or change the path) and nothing else needs to change.
  flavours: [
    {
      id: 'classic',
      name: 'The Classic JU',
      description: 'Brown-butter dough loaded with Belgian dark and milk chocolate chunks.',
      art: '/art/cookie-classic.svg',
      available: true,
    },
    {
      id: 'double-dark',
      name: 'Double Dark',
      description: 'Deep cocoa dough, white chocolate chunks and a pinch of sea salt.',
      art: '/art/cookie-double-dark.svg',
      available: true,
    },
    {
      id: 'salted-caramel',
      name: 'Salted Caramel Pecan',
      description: 'Toasted pecans, a ribbon of caramel and flaky salt on top.',
      art: '/art/cookie-caramel.svg',
      available: true,
    },
    {
      id: 'pistachio',
      name: 'Pistachio White',
      description: 'Pistachio dough with white chocolate and crushed pistachios.',
      art: '/art/cookie-pistachio.svg',
      available: true,
    },
  ],

  delivery: {
    // e.g. 'Saturday & Sunday'. null hides the line.
    days: null,
    // e.g. 'Delivery across Malta & Gozo'. null hides the line.
    area: null,
  },

  // Weekly order cut-off. Example: { weekday: 4, hour: 20, label: 'Thursday 8pm' }
  // weekday: 0 = Sunday … 6 = Saturday, hour: 0–23 (Malta time).
  // null hides the cut-off banner and countdown.
  orderCutoff: null,

  // This weekend's drop. status: 'open' | 'soldout' | null (hidden).
  // slotsLeft: a number shows "Only N boxes left". Only use real numbers.
  drop: { status: null, slotsLeft: null },

  hero: {
    // Path to a professionally made 3D cookie (.glb) in /public, e.g. '/models/cookie.glb'.
    // When set, it replaces the code-built cookie. If the file contains an
    // animation (e.g. the cookie breaking open), scrolling scrubs through it.
    modelUrl: null,
  },

  gift: {
    enabled: true,
    noteMaxLength: 140,
    // Extra charge for gift wrapping, or null if free / not shown.
    price: null,
    cardStyles: ['Classic Kraft', 'Birthday', 'Thank You'],
  },
};
