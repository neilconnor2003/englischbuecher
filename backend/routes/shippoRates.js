
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
const PAD_H_CM = Number(process.env.PACKAGING_PAD_H_CM ?? 3);  // +cm to height

// Dimension defaults if a book is missing them
const DEF_WIDTH_CM = Number(process.env.DEF_BOOK_WIDTH_CM ?? 13);
const DEF_HEIGHT_CM = Number(process.env.DEF_BOOK_HEIGHT_CM ?? 20);
const DEF_THICKNESS_CM = Number(process.env.DEF_BOOK_THICKNESS_CM ?? 3);

const TTL_MS = 30000; // 30s cache window
const rateCache = new Map(); // key -> { data, ts }

/* ----------------- helpers ----------------- */
function gramsToKg(grams) {
  const g = Math.max(1, Number(grams || 0));
  return (g / 1000).toFixed(3);
}

/*function makeFrom() {
  return {
    name: process.env.SHIP_FROM_NAME || 'Warehouse',
    street1: process.env.SHIP_FROM_STREET || 'Konrad-Adenauer-Str. 1',
    city: process.env.SHIP_FROM_CITY || 'Ingelheim am Rhein',
    zip: process.env.SHIP_FROM_ZIP || '55216',
    country: process.env.SHIP_FROM_COUNTRY || 'DE'
  };
}*/


function makeFrom() {
  return {
    name: process.env.SHIP_FROM_NAME || 'Warehouse',
    street1: process.env.SHIP_FROM_STREET || 'Konrad-Adenauer-Str. 1',
    city: process.env.SHIP_FROM_CITY || 'Ingelheim am Rhein',
    zip: process.env.SHIP_FROM_ZIP || '55216',
    country: process.env.SHIP_FROM_COUNTRY || 'DE',
    email: process.env.SHIP_FROM_EMAIL || process.env.SHIPPING_FALLBACK_EMAIL || 'orders@example.com',
    phone: process.env.SHIP_FROM_PHONE || null
  };
}


function shippoAuthHeader() {
  const key = process.env.SHIPPO_API_KEY;
  if (!key) throw new Error('Missing SHIPPO_API_KEY in .env');
  return { Authorization: `ShippoToken ${key}` };
}

function safeEmail(value) {
  const e = String(value || '').trim();
  return e.includes('@') ? e : null; // IMPORTANT: null, not ''
}

function safePhone(val) {
  const p = String(val || '').trim();
  return p.length >= 6 ? p : null;
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
 * - Stack all books on top of each other -> height = sum(thickness * qty)
 * - Footprint takes the max width & height across all books
 * - Add small packaging padding on all axes
 */
function computeParcelDimensions(body = {}) {
  const items = Array.isArray(body.items) ? body.items : [];

  if (!items.length) {
    // Single-book detail flow (no items array): use provided parcel or defaults
    const length_cm = Number(body?.parcel?.length_cm ?? DEF_HEIGHT_CM + PAD_LW_CM);
    const width_cm = Number(body?.parcel?.width_cm ?? DEF_WIDTH_CM + PAD_LW_CM);
    const height_cm = Number(body?.parcel?.height_cm ?? DEF_THICKNESS_CM + PAD_H_CM);
    return { length_cm, width_cm, height_cm };
  }

  let maxWidth = 0;
  let maxHeight = 0;
  let totalThickness = 0;

  for (const it of items) {
    const q = Math.max(1, Number(it?.quantity ?? 1));
    const w = Number(it?.width_cm) || DEF_WIDTH_CM;
    const h = Number(it?.height_cm) || DEF_HEIGHT_CM;
    const t = Number(it?.thickness_cm) || DEF_THICKNESS_CM;

    maxWidth = Math.max(maxWidth, w);
    maxHeight = Math.max(maxHeight, h);
    totalThickness += (t * q);
  }

  const length_cm = Math.max(1, Math.round((maxHeight + PAD_LW_CM) * 10) / 10);
  const width_cm = Math.max(1, Math.round((maxWidth + PAD_LW_CM) * 10) / 10);
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



function makeKey(to_zip, to_city, body) {
  try {
    const computed = computeTotalWeight(body)?.total_grams || 0;
    const bucket = Math.round(computed / 25);
    const emailOk = !!safeEmail(body?.email);
    const est = body?.estimate_only ? 1 : 0;
    const streetOk =
      !!String(body?.to_street || '').trim() &&
      String(body?.to_street).trim().toLowerCase() !== 'unknown';

    return `${String(to_zip || '').trim()}|${String(to_city || '').trim()}|${bucket}|E${emailOk ? 1 : 0}|S${streetOk ? 1 : 0}|EST${est}`;
  } catch {
    return `key|fallback|${Date.now()}`;
  }
}



/* -------------------------------------------------------------
 *  1) RATE SHOP (DE -> DE)
 * ------------------------------------------------------------- */
router.post('/rates', async (req, res) => {
  try {
    const {
      to_name = 'Customer',
      to_street = '',
      to_city = '',
      to_zip = '',
      email: emailRaw,
      phone: phoneRaw,
      estimate_only = false,
      debug = false
    } = req.body || {};

    // ✅ sanitize/validate email (DPDDE requires a real email; NEVER send "")
    const emailSafe = safeEmail(emailRaw) || process.env.SHIPPING_FALLBACK_EMAIL || null;
    const phoneSafe = safePhone(phoneRaw);

    /*if (!to_zip || !to_city || !to_street) {
      return res.status(400).json({
        error: 'address_required',
        details: 'to_zip, to_city and to_street are required for shipping quote.'
      });
    }

    if (!emailSafe) {
      return res.status(400).json({
        error: 'email_required',
        details: 'Recipient email is required for DPD label creation (cannot be empty).'
      });
    }*/

    // For checkout: require full address + valid email (DPDDE needs this)
    // For cart estimate: allow missing and use placeholders + fallback email
    if (!estimate_only) {
      if (!to_zip || !to_city || !to_street) {
        return res.status(400).json({
          error: 'address_required',
          details: 'to_zip, to_city and to_street are required for shipping quote.'
        });
      }
      if (!emailSafe) {
        return res.status(400).json({
          error: 'email_required',
          details: 'Recipient email is required for DPD label creation (cannot be empty).'
        });
      }
    }

    // Apply placeholders for estimate-only mode
    const toStreetFinal = (to_street || '').trim() || 'Musterstraße 1';
    const toCityFinal = (to_city || '').trim() || 'Berlin';
    const toZipFinal = (to_zip || '').trim() || '10115';
    const emailFinal = emailSafe || process.env.SHIPPING_FALLBACK_EMAIL || 'orders@example.com';


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

    const address_to = {
      name: to_name || 'Customer',
      //street1: to_street,
      //city: to_city,
      //zip: to_zip,
      street1: toStreetFinal,
      city: toCityFinal,
      zip: toZipFinal,
      country: 'DE',
      //email: emailSafe,
      email: emailFinal,
      ...(phoneSafe ? { phone: phoneSafe } : {})
    };

    // 2) Compute parcel dimensions from cart items
    const dims = computeParcelDimensions(req.body);

    const parcelObj = {
      length: String(dims.length_cm),
      width: String(dims.width_cm),
      height: String(dims.height_cm),
      distance_unit: 'cm',
      weight: gramsToKg(weightGrams),
      mass_unit: 'kg'
    };


    console.log('[SHIPPO DEBUG] estimate_only=', estimate_only);
    console.log('[SHIPPO DEBUG] address_from=', address_from);
    console.log('[SHIPPO DEBUG] address_to.email=', JSON.stringify(address_to.email));


    // 3) Create Shipment -> returns rates
    const shipmentResp = await axios.post(
      'https://api.goshippo.com/shipments/',
      { address_from, address_to, parcels: [parcelObj], async: false },
      { headers: { ...shippoAuthHeader(), 'Content-Type': 'application/json' }, timeout: 20000 }
    );

    const shipment = shipmentResp.data || {};
    const rates = Array.isArray(shipment.rates) ? shipment.rates : [];

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
        //rate_object_id: r.object_id,
        rate_object_id: estimate_only ? null : r.object_id,
        provider: normalizeProvider(r.provider),
        raw_provider: r.provider,
        service: r.servicelevel?.name || r.servicelevel?.token || 'Service',
        amount: Number(r.amount),
        currency: r.currency || 'EUR',
        estimated_days: Number.isFinite(r.estimated_days) ? r.estimated_days : null
      }));

    // fallback: if none match allowed providers, take all EUR rates
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

    rateCache.set(cacheKey, { data: payload, ts: Date.now() });
    return res.json(payload);

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
      if (status === 429 && cached) {
        return res.json(cached.data);
      }
    } catch { }

    return res.status(status === 429 ? 429 : 500).json({
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
      return res.status(400).json({
        error: 'shippo_transaction_failed',
        details: tx.messages || []
      });
    }

    return res.json({
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
    return res.status(500).json({ error: 'shippo_label_error', details: data || err.message });
  }
});

/* ------------------ 3) TRACKING WEBHOOK ------------------ */
router.post('/webhook', express.json({ type: '*/*' }), async (req, res) => {
  try {
    // const ev = req.body;
    // TODO: persist tracking updates (orders table) by ev.tracking_number
    return res.status(200).send('OK');
  } catch (err) {
    console.error('[Shippo /webhook] error:', err);
    return res.status(200).send('OK');
  }
});

module.exports = router;
