const KEY = 'engb_delivery_context';

// default shape so callers never get null
const DEFAULTS = {
  shippingMode: 'delivery',
  postalCode: '',
  city: '',
};

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

{/*export function getDeliveryContext() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setDeliveryContext(update) {
  try {
    const prev = getDeliveryContext() || {};
    const next = { ...prev, ...update };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}*/}

export function getDeliveryContext() {
  try {
    // 1) Preferred: our shared context
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      return { ...DEFAULTS, ...parsed };
    }

    // 2) Fallback: ShippoEstimator’s storage
    const shippoRaw =
      localStorage.getItem('ship_dest') || localStorage.getItem('shippo_dest');
    const shippoParsed = shippoRaw ? safeParse(shippoRaw) : null;

    if (shippoParsed && typeof shippoParsed === 'object') {
      return {
        ...DEFAULTS,
        shippingMode: 'delivery',
        postalCode: shippoParsed.postal || '',
        city: shippoParsed.city || '',
      };
    }

    return { ...DEFAULTS };
  } catch {
    // If storage access is blocked, still return safe defaults
    return { ...DEFAULTS };
  }
}

export function setDeliveryContext(update) {
  try {
    const prev = getDeliveryContext();
    const next = { ...prev, ...update };

    localStorage.setItem(KEY, JSON.stringify(next));

    // Optional: keep ShippoEstimator storage in sync too (helps Cart/BookDetails)
    if (next.postalCode || next.city) {
      const shipDest = {
        country: 'DE',
        postal: next.postalCode || '',
        city: next.city || '',
      };
      try { localStorage.setItem('ship_dest', JSON.stringify(shipDest)); } catch {}
    }

    return next;
  } catch {
    return null;
  }
}
