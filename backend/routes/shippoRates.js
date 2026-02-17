
// backend/routes/shippoRates.js
const express = require('express');
const axios = require('axios');

const router = express.Router();

/* ----------------- config / fallbacks ----------------- */
const PKG_FIXED = Number(process.env.PACKAGING_FIXED_GRAMS ?? 80);
const PKG_PER_ITEM = Number(process.env.PACKAGING_PER_ITEM_GRAMS ?? 15);
const BOOK_FALLBACK = Number(process.env.BOOK_DEFAULT_WEIGHT_GRAMS ?? 500);

// Packaging padding (dimensions)
const PAD_LW_CM = Number(process.env.PACKAGING_PAD_LW_CM ?? 2); // +cm to length & width
const PAD_H_CM  = Number(process.env.PACKAGING_PAD_H_CM  ?? 3); // +cm to height

// Dimension defaults if a book is missing them
const DEF_WIDTH_CM     = Number(process.env.DEF_BOOK_WIDTH_CM     ?? 13);
const DEF_HEIGHT_CM    = Number(process.env.DEF_BOOK_HEIGHT_CM    ?? 20);
const DEF_THICKNESS_CM = Number(process.env.DEF_BOOK_THICKNESS_CM ?? 3);

/* ----------------- helpers ----------------- */
function gramsToKg(grams) {
  const g = Math.max(1, Number(grams || 0));
  return (g / 1000).toFixed(3);
}

function makeFrom() {
  return {
    name: process.env.SHIP_FROM_NAME || 'Warehouse',
    street1: process.env.SHIP_FROM_STREET || 'Konrad-Adenauer-Str. 1',
    city: process.env.SHIP_FROM_CITY || 'Ingelheim am Rhein',
    zip: process.env.SHIP_FROM_ZIP || '55216',
    country: process.env.SHIP_FROM_COUNTRY || 'DE'
  };
}

function shippoAuthHeader() {
  const key = process.env.SHIPPO_API_KEY;
  if (!key) throw new Error('Missing SHIPPO_API_KEY in .env');
  return { Authorization: `ShippoToken ${key}` };
}

/** Compute total shipping weight (grams) + breakdown
 *  Shape A (Book Details):  { weight_grams }
 *  Shape B (Cart):          { items: [{ weight_grams, quantity, width_cm?, height_cm?, thickness_cm? }] }
 */
function computeTotalWeight(body = {}) {
  let totalBooksGrams = 0;
  let totalItems = 0;

  if (Array.isArray(body.items) && body.items.length > 0) {
    for (const it of body.items) {
      const w = Number(it?.weight_grams ?? BOOK_FALLBACK);
      const q = Math.max(1, Number(it?.quantity ?? 1));
      totalBooksGrams += w * q;
      totalItems += q;
    }
  } else {
    // Single book flow
    const w = Number(body.weight_grams ?? BOOK_FALLBACK);
    totalBooksGrams = Math.max(1, w);
    totalItems = 1;
  }

  // Packaging model: fixed + per item
  const pkgFixed = Math.max(0, PKG_FIXED);
  const pkgPerItem = Math.max(0, PKG_PER_ITEM);
  const pkgGrams = pkgFixed + pkgPerItem * totalItems;

  const totalGrams = Math.max(1, Math.round(totalBooksGrams + pkgGrams));

  return {
    total_grams: totalGrams,
    breakdown: {
      books_grams: Math.round(totalBooksGrams),
      packaging_grams: Math.round(pkgGrams),
      items: totalItems
    }
  };
}

/** Compute outer parcel dimensions (cm) for a stack of books
 * Strategy:
 * - Stack all books on top of each other → height = sum(thickness * qty)
 * - Footprint takes the max width & height across all books
 * - Add small packaging padding on all axes
 */
function computeParcelDimensions(body = {}) {
  const items = Array.isArray(body.items) ? body.items : [];

  if (!items.length) {
    // Single-book detail flow (no items array): use provided parcel or defaults
    const length_cm = Number(body?.parcel?.length_cm ?? DEF_HEIGHT_CM + PAD_LW_CM);
    const width_cm  = Number(body?.parcel?.width_cm  ?? DEF_WIDTH_CM  + PAD_LW_CM);
    const height_cm = Number(body?.parcel?.height_cm ?? DEF_THICKNESS_CM + PAD_H_CM);
    return { length_cm, width_cm, height_cm };
  }

  let maxWidth = 0;
  let maxHeight = 0;
  let totalThickness = 0;

  for (const it of items) {
    const q = Math.max(1, Number(it?.quantity ?? 1));
    const w = Number(it?.width_cm)     || DEF_WIDTH_CM;
    const h = Number(it?.height_cm)    || DEF_HEIGHT_CM;
    const t = Number(it?.thickness_cm) || DEF_THICKNESS_CM;

    maxWidth = Math.max(maxWidth, w);
    maxHeight = Math.max(maxHeight, h);
    totalThickness += (t * q);
  }

  const length_cm = Math.max(1, Math.round((maxHeight + PAD_LW_CM) * 10) / 10);
  const width_cm  = Math.max(1, Math.round((maxWidth  + PAD_LW_CM) * 10) / 10);
  const height_cm = Math.max(1, Math.round((totalThickness + PAD_H_CM) * 10) / 10);

  return { length_cm, width_cm, height_cm };
}

/* ---- ETA helpers (Germany-only, simple calendar days) ---- */
function etaRangeForProvider(provider = '') {
  const p = provider.toLowerCase();
  if (p.includes('dpd')) return { min: 1, max: 2, source: 'fallback' };
  if (p.includes('deutsche')) return { min: 1, max: 2, source: 'fallback' };
  return { min: 2, max: 4, source: 'fallback' };
}

function addEtaToRate(rate) {
  const today = new Date();

  if (Number.isFinite(rate.estimated_days)) {
    const d = new Date(today);
    d.setDate(today.getDate() + rate.estimated_days);
    return {
      ...rate,
      eta: {
        days: rate.estimated_days,
        date_min: d.toISOString(),
        date_max: d.toISOString(),
        source: 'carrier'
      }
    };
  }

  const { min, max, source } = etaRangeForProvider(rate.provider);
  const minD = new Date(today);
  const maxD = new Date(today);
  minD.setDate(today.getDate() + min);
  maxD.setDate(today.getDate() + max);

  return {
    ...rate,
    eta: {
      days: null,
      range: [min, max],
      date_min: minD.toISOString(),
      date_max: maxD.toISOString(),
      source
    }
  };
}

function normalizeProvider(p = '') {
  const u = (p || '').toUpperCase();
  if (u === 'DPD DE' || u === 'DPD_DE') return 'DPD';
  if (u === 'DEUTSCHE POST') return 'DEUTSCHE_POST';
  return u;
}

/* ----------------- simple in-memory cache ----------------- */
// Collapses bursts for same destination/weight. Perfect for dev & low traffic.
const rateCache = new Map(); // key -> { data, ts }
const TTL_MS = 30000;        // 30s cache window

function makeKey(to_zip, to_city, body) {
  try {
    const items = Array.isArray(body?.items) ? body.items : [];
    const totalGrams = items.length
      ? items.reduce((s, it) => s + (Number(it?.weight_grams) || 0) * (Number(it?.quantity) || 0), 0)
      : Number(body?.weight_grams || 0) || 0;
    // Include packaging approximation from computeTotalWeight to be closer to used weight
    const computed = computeTotalWeight(body)?.total_grams || totalGrams;
    // Bucket by 25g to avoid cache churn on tiny changes
    const bucket = Math.round(computed / 25);
    return `${String(to_zip || '').trim()}|${String(to_city || '').trim()}|${bucket}`;
  } catch {
    return `key|fallback|${Date.now()}`;
  }
}

/* -------------------------------------------------------------
 *  1) RATE SHOP (DE -> DE)
 *     - accepts { to_city, to_zip, weight_grams }   // Book page
 *     - or      { to_city, to_zip, items:[{weight_grams,quantity,width_cm,height_cm,thickness_cm}] } // Cart
 * ------------------------------------------------------------- */
router.post('/rates', async (req, res) => {
  try {
    const {
      to_name = 'Customer',
      to_street = 'Unknown',
      to_city = 'Berlin',
      to_zip = '10115',
      debug = false
    } = req.body || {};

    // 1) Compute shipping weight (books + packaging)
    const weightInfo = computeTotalWeight(req.body);
    const weightGrams = weightInfo.total_grams;

    // ---- cache: serve if fresh ----
    const cacheKey = makeKey(to_zip, to_city, req.body);
    const now = Date.now();
    const cached = rateCache.get(cacheKey);
    if (cached && (now - cached.ts) < TTL_MS) {
      return res.json(cached.data);
    }

    const address_from = makeFrom();
    const address_to = { name: to_name, street1: to_street, city: to_city || 'Berlin', zip: to_zip, country: 'DE' };

    // 2) Compute parcel dimensions from cart items
    const dims = computeParcelDimensions(req.body);

    const parcelObj = {
      length: String(dims.length_cm),
      width:  String(dims.width_cm),
      height: String(dims.height_cm),
      distance_unit: 'cm',
      weight: gramsToKg(weightGrams),  // Shippo expects kg (string)
      mass_unit: 'kg'
    };

    // 3) Create Shipment -> returns rates
    const shipmentResp = await axios.post(
      'https://api.goshippo.com/shipments/',
      { address_from, address_to, parcels: [parcelObj], async: false },
      { headers: { ...shippoAuthHeader(), 'Content-Type': 'application/json' }, timeout: 20000 }
    );

    const shipment = shipmentResp.data || {};
    const rates = Array.isArray(shipment.rates) ? shipment.rates : [];

    console.log('[Shippo rates raw]', {
      payload_weight_g: weightGrams,
      payload_dims_cm: dims,
      count: rates.length,
      providers: rates.map(r => ({
        provider: r.provider,
        service: r?.servicelevel?.name || r?.servicelevel?.token,
        amount: r.amount,
        currency: r.currency
      }))
    });

    const diagnostics = rates.map(r => ({
      provider: r.provider,
      service: r.servicelevel?.name || r.servicelevel?.token,
      amount: r.amount,
      currency: r.currency,
      object_id: r.object_id
    }));

    const ALLOWED = new Set([
      'DPD', 'DPD_DE', 'DPD DE',
      'DEUTSCHE_POST', 'DEUTSCHE POST',
      'DHL', 'DHL_DE', 'DHL_PAKET', 'DHL_ECOMMERCE'
    ]);

    let candidates = rates
      .filter(r =>
        r.currency === 'EUR' &&
        r.amount && Number(r.amount) > 0 &&
        ALLOWED.has((r.provider || '').toUpperCase())
      )
      .map(r => ({
        rate_object_id: r.object_id,
        provider: normalizeProvider(r.provider),
        raw_provider: r.provider,
        service: r.servicelevel?.name || r.servicelevel?.token || 'Service',
        amount: Number(r.amount),
        currency: r.currency || 'EUR',
        estimated_days: Number.isFinite(r.estimated_days) ? r.estimated_days : null
      }));

    if (!candidates.length) {
      candidates = rates
        .filter(r => r.currency === 'EUR' && r.amount && Number(r.amount) > 0)
        .map(r => ({
          rate_object_id: r.object_id,
          provider: normalizeProvider(r.provider),
          raw_provider: r.provider,
          service: r.servicelevel?.name || r.servicelevel?.token || 'Service',
          amount: Number(r.amount),
          currency: r.currency || 'EUR',
          estimated_days: Number.isFinite(r.estimated_days) ? r.estimated_days : null
        }));
    }

    candidates = candidates.map(addEtaToRate);

    if (!candidates.length) {
      const payload = {
        cheapest: null,
        rates: [],
        note: 'No usable EUR rates returned by Shippo.',
        weight_breakdown: weightInfo.breakdown,
        weight_grams_used: weightGrams,
        parcel_dimensions_cm: dims,
        debug: debug ? diagnostics : undefined
      };
      rateCache.set(cacheKey, { data: payload, ts: Date.now() });
      return res.json(payload);
    }

    candidates.sort((a, b) => a.amount - b.amount);
    const cheapest = candidates[0];

    const payload = {
      cheapest,
      rates: candidates,
      weight_breakdown: weightInfo.breakdown,
      weight_grams_used: weightGrams,
      parcel_dimensions_cm: dims,
      debug: debug ? diagnostics : undefined
    };

    // store in cache
    rateCache.set(cacheKey, { data: payload, ts: Date.now() });
    res.json(payload);

  } catch (err) {
    const data = err?.response?.data;
    const status = err?.response?.status || 500;
    const retryAfter = err?.response?.headers?.['retry-after'];
    console.error('[Shippo /rates] error:', data || err.message || err);

    // If rate-limited and we have a recent cached response for this key, serve it
    try {
      const { to_city = 'Berlin', to_zip = '10115' } = req.body || {};
      const key = makeKey(to_zip, to_city, req.body);
      const cached = rateCache.get(key);
      if ((status === 429) && cached) {
        return res.json(cached.data);
      }
    } catch {}

    res.status(status === 429 ? 429 : 500).json({
      error: 'shippo_rate_error',
      details: data || err.message,
      retry_after: retryAfter
    });
  }
});

/* --------------------- 2) BUY LABEL --------------------- */
router.post('/buy-label', async (req, res) => {
  try {
    const { rate_object_id } = req.body || {};
    if (!rate_object_id) {
      return res.status(400).json({ error: 'rate_object_id required' });
    }

    const txResp = await axios.post(
      'https://api.goshippo.com/transactions/',
      { rate: rate_object_id, label_file_type: 'PDF', async: false },
      { headers: { ...shippoAuthHeader(), 'Content-Type': 'application/json' }, timeout: 20000 }
    );

    const tx = txResp.data || {};
    if (tx.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'shippo_transaction_failed', details: tx.messages || [] });
    }

    res.json({
      provider: tx.provider,
      amount: tx.amount,
      currency: tx.currency,
      tracking_number: tx.tracking_number,
      tracking_url: tx.tracking_url_provider,
      label_url: tx.label_url
    });
  } catch (err) {
    const data = err?.response?.data;
    console.error('[Shippo /buy-label] error:', data || err.message || err);
    res.status(500).json({ error: 'shippo_label_error', details: data || err.message });
  }
});

/* ------------------ 3) TRACKING WEBHOOK ------------------ */
router.post('/webhook', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const ev = req.body;
    // TODO: persist tracking updates (orders table) by ev.tracking_number
    res.status(200).send('OK');
  } catch (err) {
    console.error('[Shippo /webhook] error:', err);
    res.status(200).send('OK');
  }
});

module.exports = router;
