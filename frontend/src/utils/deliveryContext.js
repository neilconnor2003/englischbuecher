
const KEY = 'engb_delivery_context';

export function getDeliveryContext() {
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
}
