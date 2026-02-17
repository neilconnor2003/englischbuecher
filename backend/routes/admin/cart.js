
// backend/routes/admin/cart.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

module.exports = (db) => {
  // ---------------------------
  // Helpers for shipping route
  // ---------------------------
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

  // Build Shippo items (DB -> API field mapping)
  async function loadCartItemsForUser(db, userId) {
    const [rows] = await db.execute(
      `SELECT ci.book_id, ci.quantity,
              b.weight_grams,
              b.height_cm,   -- face height
              b.length_cm,   -- face width
              b.width_cm     -- spine thickness
         FROM cart_items ci
         JOIN books b ON b.id = ci.book_id
        WHERE ci.user_id = ?`,
      [userId]
    );

    return rows.map(r => ({
      quantity: Math.max(1, Number(r.quantity) || 1),
      weight_grams: (r.weight_grams != null ? Number(r.weight_grams) : null),
      height_cm:    (r.height_cm    != null ? Number(r.height_cm)    : null), // face height
      width_cm:     (r.length_cm    != null ? Number(r.length_cm)    : null), // face width
      thickness_cm: (r.width_cm     != null ? Number(r.width_cm)     : null), // spine
    }));
  }

  // Very small in-memory cache to collapse admin bursts
  const rateCache = new Map(); // key -> { data, ts }
  const TTL_MS = 30000;

  function makeKey(userId, to_zip, to_city, items) {
    try {
      const grams = (items || []).reduce(
        (s, it) => s + (Number(it.weight_grams) || 500) * (Number(it.quantity) || 1),
        0
      );
      const bucket = Math.round(grams / 25);
      return `${userId}|${to_zip}|${to_city}|${bucket}`;
    } catch {
      return `${userId}|${Date.now()}`;
    }
  }

  // --------------------------------
  // 1) List all active carts
  // --------------------------------
  router.get('/', async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT
          ci.user_id,
          u.email,
          COALESCE(u.first_name, '') AS first_name,
          COALESCE(u.last_name, '') AS last_name,
          COUNT(*) AS items_count,
          SUM(ci.quantity) AS total_quantity,
          COALESCE(ROUND(SUM(ci.quantity * b.price), 2), 0.00) AS cart_value_eur,
          MAX(ci.updated_at) AS last_updated
        FROM cart_items ci
        JOIN users u ON ci.user_id = u.id
        LEFT JOIN books b ON ci.book_id = b.id
        WHERE u.deleted_at = '1970-01-01 00:00:01'
           OR u.deleted_at IS NULL
        GROUP BY ci.user_id, u.email, u.first_name, u.last_name
        HAVING items_count > 0
        ORDER BY last_updated DESC
        LIMIT 100
      `);

      res.json({ carts: rows });
    } catch (err) {
      console.error('Cart admin error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --------------------------------
  // 2) Detailed cart for one user
  // --------------------------------
  router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
      const [items] = await db.execute(`
        SELECT 
          ci.book_id,
          ci.quantity,
          b.price,
          (ci.quantity * b.price) AS line_total,
          COALESCE(b.image, '') AS image,
          COALESCE(b.title_en, b.title_de, 'Unknown Book') AS title,
          COALESCE(b.author, 'Unknown Author') AS author
        FROM cart_items ci
        LEFT JOIN books b ON ci.book_id = b.id
        WHERE ci.user_id = ?
        ORDER BY ci.updated_at DESC
      `, [userId]);

      const [userRows] = await db.execute(`
        SELECT email, 
               COALESCE(first_name, '') AS first_name, 
               COALESCE(last_name, '') AS last_name 
        FROM users 
        WHERE id = ? AND (deleted_at = '1970-01-01 00:00:01' OR deleted_at IS NULL)
      `, [userId]);

      const safeItems = items.map(item => ({
        book_id: item.book_id,
        quantity: Number(item.quantity),
        price: Number(item.price || 0),
        line_total: Number(item.line_total || 0),
        image: item.image,
        title: item.title,
        author: item.author
      }));

      res.json({
        user: userRows[0] || { email: 'Deleted User', first_name: '', last_name: '' },
        items: safeItems
      });

    } catch (err) {
      console.error('Cart detail error:', err);
      res.status(500).json({ error: 'Failed to load cart details' });
    }
  });

  // --------------------------------
  // 3) Shipping estimate for a user
  //    GET /api/admin/cart/:userId/shipping
  // --------------------------------
  router.get('/:userId/shipping', async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ error: 'bad_user_id' });
      }

      const items = await loadCartItemsForUser(db, userId);
      if (!items.length) {
        return res.json({ amount_eur: 0, provider: null, service: null, dims: null, weight_grams: 0 });
      }

      // If you have user shipping address fields, map them here.
      // Defaults keep it simple and robust for admin overview:
      const to_zip  = '10115';   // Berlin Mitte
      const to_city = 'Berlin';

      const key = makeKey(userId, to_zip, to_city, items);
      const now = Date.now();
      const cached = rateCache.get(key);
      if (cached && (now - cached.ts) < TTL_MS) {
        return res.json(cached.data);
      }

      // Call your internal Shippo rates route (already handles dims, weight, cache, 429)
      const ratesResp = await axios.post(
        `${BASE_URL}/api/shippo/rates`,
        { to_zip, to_city, items },
        { timeout: 20000 }
      );

      const data = ratesResp.data || {};
      const cheapest = data.cheapest || null;

      const payload = {
        amount_eur: cheapest ? Number(cheapest.amount) : 0,
        provider: cheapest ? cheapest.provider : null,
        service: cheapest ? cheapest.service : null,
        dims: data.parcel_dimensions_cm || null,
        weight_grams: data.weight_grams_used || null
      };

      rateCache.set(key, { data: payload, ts: Date.now() });
      res.json(payload);
    } catch (err) {
      console.error('[admin cart shipping] error:', err?.response?.data || err?.message || err);
      // Return safe payload (don’t block the admin grid)
      res.json({ amount_eur: 0, provider: null, service: null, dims: null, weight_grams: null });
    }
  });

  return router;
};
