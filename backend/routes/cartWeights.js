
// backend/routes/cartWeights.js
const express = require('express');

module.exports = function cartWeightsRouter(pool) {
  const router = express.Router();

  // Sanity endpoint: GET /api/cart/ping → { ok: true }
  router.get('/ping', (req, res) => res.json({ ok: true }));

  /**
   * POST /api/cart/weights
   * Body:
   * { items: [{ bookId: number, quantity: number }] }
   *
   * Response:
   * {
   *   items: [{
   *     book_id,
   *     quantity,
   *     weight_grams|null,
   *     // Mapped for the frontend:
   *     width_cm|null,      // DB.width_cm
   *     height_cm|null,     // DB.length_cm  (book face height / longest side)
   *     thickness_cm|null   // DB.height_cm  (spine thickness)
   *   }]
   * }
   */
  router.post('/weights', async (req, res) => {
    try {
      const bodyItems = Array.isArray(req.body?.items) ? req.body.items : null;

      // Variant A: client supplies items
      if (bodyItems && bodyItems.length) {
        const rowsIn = bodyItems
          .map(it => ({
            bookId: Number(it?.bookId) || 0,
            quantity: Math.max(1, Number(it?.quantity) || 1),
          }))
          .filter(it => it.bookId > 0);

        if (!rowsIn.length) {
          return res.json({ items: [] });
        }

        const ids = [...new Set(rowsIn.map(x => x.bookId))];

        const [books] = await pool.query(
          `SELECT id, weight_grams, length_cm, width_cm, height_cm
             FROM books
            WHERE id IN (?)`,
          [ids]
        );

        const byId = new Map(
          books.map(b => [
            Number(b.id),
            {
              weight_grams: (b.weight_grams != null ? Number(b.weight_grams) : null),

              // Map DB fields → API fields expected by FE:
              // DB.length_cm     -> API.height_cm
              // DB.width_cm      -> API.width_cm
              // DB.height_cm     -> API.thickness_cm
              width_cm: (b.length_cm != null ? Number(b.length_cm) : null),
              height_cm: (b.height_cm != null ? Number(b.height_cm) : null),
              thickness_cm: (b.width_cm != null ? Number(b.width_cm) : null),
            }
          ])
        );

        const out = rowsIn.map(x => {
          const row = byId.get(x.bookId) || {};
          return {
            book_id: x.bookId,
            quantity: x.quantity,
            weight_grams: row.weight_grams ?? null,
            width_cm: row.width_cm ?? null,
            height_cm: row.height_cm ?? null,    // ← from DB.length_cm
            thickness_cm: row.thickness_cm ?? null,    // ← from DB.height_cm
          };
        });

        return res.json({ items: out });
      }

      // Variant B: server-side cart (requires req.user)
      if (req.user?.id) {
        const userId = Number(req.user.id);
        const [rows] = await pool.query(
          `SELECT ci.book_id, ci.quantity, b.weight_grams, b.length_cm, b.width_cm, b.height_cm
             FROM cart_items ci
             JOIN books b ON b.id = ci.book_id
            WHERE ci.user_id = ?`,
          [userId]
        );

        const out = rows.map(r => ({
          book_id: Number(r.book_id),
          quantity: Math.max(1, Number(r.quantity) || 1),
          weight_grams: (r.weight_grams != null ? Number(r.weight_grams) : null),
          //width_cm:     (r.width_cm     != null ? Number(r.width_cm)     : null),
          //height_cm: (r.length_cm != null ? Number(r.length_cm) : null),
          //thickness_cm: (r.height_cm != null ? Number(r.height_cm) : null),
          width_cm: (b.length_cm != null ? Number(b.length_cm) : null),
          height_cm: (b.height_cm != null ? Number(b.height_cm) : null),
          thickness_cm: (b.width_cm != null ? Number(b.width_cm) : null),
        }));

        return res.json({ items: out });
      }

      return res
        .status(400)
        .json({ error: 'items_required', message: 'Provide items[] or use an authenticated session.' });
    } catch (err) {
      console.error('[cart/weights] error:', err?.message || err);
      if (err?.stack) console.error(err.stack);
      res.status(500).json({ error: 'weights_failed', message: err?.message || 'Unknown error' });
    }
  });

  return router;
};
