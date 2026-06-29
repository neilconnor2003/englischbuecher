// frontend/src/utils/analytics.js
// Centralised analytics helpers for GA4 + Microsoft Clarity.
// All calls are safely no-ops if the scripts haven't loaded yet
// (e.g. when consent is denied or during development).

// ── GA4 ──────────────────────────────────────────────────────
export const gtagEvent = (eventName, params = {}) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
};

// Fire on every route change — wired into App.jsx
export const trackPageView = (path) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
    });
  }
};

// Fire on OrderSuccessPage after order loads
// https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
export const trackPurchase = (order) => {
  if (typeof window.gtag !== 'function') return;

  const items = (order.order_items || []).map((item, index) => ({
    item_id:    item.isbn13 || item.bookId || String(index),
    item_name:  item.title_en || 'Unknown Book',
    price:      Number(item.price || 0),
    quantity:   Number(item.quantity || 1),
  }));

  window.gtag('event', 'purchase', {
    transaction_id: String(order.id),
    value:          Number(order.total || 0),
    currency:       'EUR',
    coupon:         order.coupon_code || undefined,
    items,
  });
};

// Optional: fire when user adds to cart
export const trackAddToCart = (book, quantity = 1) => {
  gtagEvent('add_to_cart', {
    currency: 'EUR',
    value:    Number(book.price || 0) * quantity,
    items: [{
      item_id:   book.isbn13 || book.bookId || String(book.id),
      item_name: book.title_en || 'Unknown Book',
      price:     Number(book.price || 0),
      quantity,
    }],
  });
};

// Optional: fire when user views a book detail page
export const trackViewItem = (book) => {
  gtagEvent('view_item', {
    currency: 'EUR',
    value:    Number(book.price || 0),
    items: [{
      item_id:   book.isbn13 || String(book.id),
      item_name: book.title_en || 'Unknown Book',
      price:     Number(book.price || 0),
    }],
  });
};