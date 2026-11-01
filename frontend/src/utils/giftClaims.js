// frontend/src/utils/giftClaims.js
// Entirely new, standalone utility — nothing existing imports or depends
// on this. Tracks "book X, qty Y, earmarked for gift-list item Z" across
// the add-to-cart → (possible login redirect) → checkout flow, using
// sessionStorage so it survives a full-page login redirect within the
// same tab but doesn't linger indefinitely across sessions.
const KEY = 'pending_gift_claims';

export function addGiftClaim(bookId, giftListItemId, quantity) {
  const claims = getGiftClaims();
  const idx = claims.findIndex(c => c.bookId === bookId && c.giftListItemId === giftListItemId);
  if (idx >= 0) claims[idx].quantity += quantity;
  else claims.push({ bookId, giftListItemId, quantity });
  try { sessionStorage.setItem(KEY, JSON.stringify(claims)); } catch { }
}

export function getGiftClaims() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '[]');
  } catch { return []; }
}

export function clearGiftClaims() {
  try { sessionStorage.removeItem(KEY); } catch { }
}

// Remembers the last shared gift list a visitor viewed, so pages further
// down the funnel (cart, checkout) can offer a "Back to gift list" link —
// otherwise, once someone leaves /g/:slug (e.g. to log in or check out),
// the only way back is the original shared link itself.
const LAST_LIST_KEY = 'last_gift_list_slug';

export function setLastGiftListSlug(slug) {
  try { sessionStorage.setItem(LAST_LIST_KEY, slug); } catch { }
}

export function getLastGiftListSlug() {
  try { return sessionStorage.getItem(LAST_LIST_KEY) || null; } catch { return null; }
}

// Builds the giftClaims array to send to create-payment-intent. Caps each
// claim to what's actually still in the cart for that book, in case the
// user removed it or changed quantity after adding it from a gift list.
export function buildGiftClaimsForCheckout(cartItems) {
  const claims = getGiftClaims();
  if (!claims.length) return [];
  const cartQtyByBook = {};
  (cartItems || []).forEach(ci => {
    cartQtyByBook[ci.bookId] = (cartQtyByBook[ci.bookId] || 0) + Number(ci.quantity || 0);
  });
  return claims
    .map(c => ({
      giftListItemId: c.giftListItemId,
      quantity: Math.min(c.quantity, cartQtyByBook[c.bookId] || 0),
    }))
    .filter(c => c.quantity > 0);
}
