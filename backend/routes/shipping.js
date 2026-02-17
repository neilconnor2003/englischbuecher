
// backend/routes/shipping.js
const express = require('express');
const axios = require('axios');
const { LRUCache } = require('lru-cache');
const requestIp = require('request-ip');
const geoip = require('geoip-lite');

const router = express.Router();

const SC_PUBLIC = process.env.SENDCLOUD_PUBLIC_KEY;
const SC_SECRET = process.env.SENDCLOUD_SECRET_KEY;

const SENDER_COUNTRY = (process.env.SENDER_COUNTRY || 'DE').toUpperCase();
const SENDER_POSTAL = process.env.SENDER_POSTAL || '55411';
const HANDLING_CUTOFF = process.env.HANDLING_CUTOFF || '15:00';
const HANDLING_DAYS = Number(process.env.HANDLING_DAYS || 0);

const SENDCLOUD_BASE = 'https://panel.sendcloud.sc/api';
const authHeader = {
    Authorization:
        'Basic ' + Buffer.from(`${SC_PUBLIC}:${SC_SECRET}`).toString('base64'),
    Accept: 'application/json',
};

// in-memory cache
const cache = new LRUCache({ max: 500, ttl: 1000 * 60 * 30 }); // 30 min


const logAxiosError = (label, err) => {
    if (err.response) {
        console.error(`[${label}] status=${err.response.status} url=${err.config?.url}`, err.response.data);
    } else {
        console.error(`[${label}]`, err.message);
    }
};



if (!SC_PUBLIC || !SC_SECRET) {
    console.error('[Sendcloud] Missing API keys. Check .env: SENDCLOUD_PUBLIC_KEY / SENDCLOUD_SECRET_KEY');
}


// ---- GET location (from cookie or IP) ----
router.get('/location', (req, res) => {
    try {
        if (req.cookies?.dest) {
            try {
                const parsed = JSON.parse(req.cookies.dest);
                return res.json({ ...parsed, source: 'cookie' });
            } catch { /* ignore */ }
        }
        const ip = requestIp.getClientIp(req);
        const info = ip ? geoip.lookup(ip) : null;

        const country = (info?.country || 'DE').toUpperCase();
        const postal = info?.postal || '';
        const city = info?.city || '';

        return res.json({ country, postal, city, source: 'ip' });
    } catch {
        return res.json({ country: 'DE', postal: '', city: '', source: 'fallback' });
    }
});

// ---- POST location (persist chosen address) ----
router.post('/location', (req, res) => {
    const country = String(req.body?.country || 'DE').toUpperCase();
    const postal = String(req.body?.postal || '');
    const city = String(req.body?.city || '');
    const dest = { country, postal, city };

    res.cookie('dest', JSON.stringify(dest), {
        httpOnly: false,
        sameSite: 'Lax',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    });
    res.json({ ...dest, source: 'user' });
});

// ---- POST quote (live prices + ETA) ----
router.post('/quote', async (req, res) => {
    try {
        const destination = req.body?.destination || {};
        const to_country = String(destination.country || 'DE').toUpperCase();
        const to_postal_code = String(destination.postal || '');

        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const totalGrams = Math.max(
            1,
            Math.round(items.reduce((acc, it) => acc + (Number(it.weight_grams) || 0), 0))
        );

        // shipping methods (cached)
        const key = `methods:${SENDER_COUNTRY}`;

        let methods = cache.get(key);
        if (!methods) {
            try {
                const { data } = await axios.get(`${SENDCLOUD_BASE}/v2/shipping_methods`, { headers: authHeader });
                methods = (data.shipping_methods || []).filter(m => m.from_country === SENDER_COUNTRY);
                cache.set(key, methods);
            } catch (e) {
                logAxiosError('shipping-methods', e);
                return res.status(502).json({ error: 'sendcloud_methods_failed', details: e.response?.data || e.message });
            }
        }

        // focus on popular carriers
        const preferred = methods.filter((m) =>
            /(dhl|dpd|ups|gls|hermes)/i.test(m.carrier_code || '')
        );

        // price per method
        const priceCalls = preferred.map((m) =>
            axios
                .get(`${SENDCLOUD_BASE}/v2/shipping-price`, {
                    headers: authHeader,
                    params: {
                        shipping_method_id: m.id,
                        from_country: SENDER_COUNTRY,
                        to_country,
                        weight: totalGrams,
                        weight_unit: 'gram',
                        from_postal_code: SENDER_POSTAL,
                        to_postal_code,
                    },
                })
                .then((r) => ({ method: m, prices: r.data }))
                .catch(() => ({ method: m, prices: [] }))
        );
        const priced = await Promise.all(priceCalls);

        // transit time averages (optional)
        const methodCodes = preferred.map((m) => m.code);
        let transitHoursByCode = {};
        try {
            const { data } = await axios.get(
                `${SENDCLOUD_BASE}/v2/insights/shipping-methods/transit-times`,
                {
                    headers: authHeader,
                    params: {
                        shipping_method_code: methodCodes,
                        from_country: SENDER_COUNTRY,
                        to_country,
                    },
                }
            );
            for (const row of data.transit_times || []) {
                transitHoursByCode[row.shipping_method_code] = Number(row.transit_time);
            }
        } catch {
            // not on all plans; default below
        }

        const now = new Date();
        const [hh, mm] = (HANDLING_CUTOFF || '15:00').split(':').map(Number);
        const cutoff = new Date(now);
        cutoff.setHours(Number.isFinite(hh) ? hh : 15, Number.isFinite(mm) ? mm : 0, 0, 0);
        const handoverDays = now <= cutoff ? HANDLING_DAYS : HANDLING_DAYS + 1;

        const options = [];
        for (const { method, prices } of priced) {
            const row = prices.find((p) => p.to_country === to_country);
            if (!row?.price) continue;

            const avgHours = transitHoursByCode[method.code] || 48;
            const etaMin = new Date(now);
            etaMin.setDate(now.getDate() + handoverDays + Math.floor(avgHours / 24));
            const etaMax = new Date(etaMin);
            etaMax.setDate(etaMin.getDate() + 1);

            options.push({
                id: method.id,
                carrier: method.carrier_code,
                method: method.name || method.code,
                service_point_supported: !!method.service_point_delivery,
                price: Number(row.price),
                currency: row.currency || 'EUR',
                eta: { min: etaMin.toISOString(), max: etaMax.toISOString() },
            });
        }

        // Self pick-up
        options.push({
            id: 'self_pickup',
            carrier: 'self',
            method: 'Self pick-up (Ingelheim)',
            service_point_supported: false,
            price: 0,
            currency: 'EUR',
            eta: { min: now.toISOString(), max: now.toISOString() },
        });

        options.sort((a, b) => a.price - b.price);

        res.json({
            options,
            computed_for: { to_country, to_postal_code, total_grams: totalGrams },
        });
    } catch (e) {
        console.error('shipping/quote error:', e?.response?.data || e?.message || e);
        res.status(500).json({ error: 'shipping_quote_failed' });
    }
});

// ---- GET service-points (for pickup point deliveries) ----
router.get('/service-points', async (req, res) => {
    try {
        const country = String(req.query.country || 'DE').toUpperCase();
        const postal = String(req.query.postal || '');
        const carrier = String(req.query.carrier || '');

        const { data } = await axios.get(
            'https://servicepoints.sendcloud.sc/api/v2/service-points',
            { params: { country, address: postal, radius: 2000, carriers: carrier || undefined } }
        );
        res.json(data);
    } catch (e) {
        console.error('service-points error:', e?.message || e);
        res.status(500).json({ error: 'service_points_failed' });
    }
});

module.exports = router;
