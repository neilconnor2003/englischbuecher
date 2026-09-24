// backend/routes/giftListRoutes.js
// Entirely new — does not modify any existing route or table.
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const requireAuth = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

module.exports = (db) => {

  // ── Owner: list all of my gift lists ──────────────────────────
  router.get('/', requireAuth, async (req, res) => {
    try {
      const [lists] = await db.execute(`
        SELECT gl.id, gl.title, gl.occasion, gl.event_date, gl.share_slug, gl.created_at,
               COUNT(gli.id) AS item_count
        FROM gift_lists gl
        LEFT JOIN gift_list_items gli ON gli.gift_list_id = gl.id
        WHERE gl.user_id = ?
        GROUP BY gl.id
        ORDER BY gl.created_at DESC
      `, [req.user.id]);

      // Small cover-preview thumbnails per list, for the overview cards.
      // A tiny extra query per list — fine here since a personal "my
      // lists" page is at most a handful of rows.
      for (const list of lists) {
        const [previews] = await db.execute(`
          SELECT b.image
          FROM gift_list_items gli
          JOIN books b ON b.id = gli.book_id
          WHERE gli.gift_list_id = ?
          ORDER BY gli.added_at DESC
          LIMIT 3
        `, [list.id]);
        list.preview_images = previews.map(p => p.image).filter(Boolean);
      }

      res.json(lists);
    } catch (err) {
      console.error('GET /api/gift-lists error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Owner: create a new list ───────────────────────────────────
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { title, occasion, event_date } = req.body;
      if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });

      const slug = crypto.randomBytes(8).toString('hex'); // unguessable share link
      const [result] = await db.execute(
        `INSERT INTO gift_lists (user_id, title, occasion, event_date, share_slug)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, title.trim(), occasion || null, event_date || null, slug]
      );
      res.status(201).json({ id: result.insertId, share_slug: slug });
    } catch (err) {
      console.error('POST /api/gift-lists error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Owner: delete a list ───────────────────────────────────────
  // ── Owner: edit a list's own details ────────────────────────────
  router.patch('/:id', requireAuth, async (req, res) => {
    try {
      const { title, occasion, event_date } = req.body;
      if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });

      const [result] = await db.execute(
        `UPDATE gift_lists SET title = ?, occasion = ?, event_date = ?
         WHERE id = ? AND user_id = ?`,
        [title.trim(), occasion || null, event_date || null, req.params.id, req.user.id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('PATCH /api/gift-lists/:id error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const [result] = await db.execute(
        `DELETE FROM gift_lists WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE /api/gift-lists/:id error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Owner: get one list for managing (always blind to reservation
  //    status — this is the owner's own list, so it never shows what's
  //    been given, by design) ──────────────────────────────────────
  router.get('/:id/manage', requireAuth, async (req, res) => {
    try {
      const [[list]] = await db.execute(
        `SELECT id, title, occasion, event_date, share_slug, created_at
         FROM gift_lists WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id]
      );
      if (!list) return res.status(404).json({ error: 'Not found' });

      const [items] = await db.execute(`
        SELECT gli.id, gli.book_id, gli.quantity_desired, gli.added_at,
               b.title_en, b.title_de, b.image, b.price, b.slug, b.isbn13, b.isbn10
        FROM gift_list_items gli
        JOIN books b ON b.id = gli.book_id
        WHERE gli.gift_list_id = ?
        ORDER BY gli.added_at DESC
      `, [req.params.id]);

      res.json({ list, items });
    } catch (err) {
      console.error('GET /api/gift-lists/:id/manage error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Owner: add a book to a list ─────────────────────────────────
  router.post('/:id/items', requireAuth, async (req, res) => {
    try {
      const { book_id, quantity_desired } = req.body;
      const [[list]] = await db.execute(
        `SELECT id FROM gift_lists WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id]
      );
      if (!list) return res.status(404).json({ error: 'Not found' });
      if (!book_id) return res.status(400).json({ error: 'book_id required' });

      const [result] = await db.execute(
        `INSERT INTO gift_list_items (gift_list_id, book_id, quantity_desired)
         VALUES (?, ?, ?)`,
        [req.params.id, book_id, Math.max(1, Number(quantity_desired) || 1)]
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      console.error('POST /api/gift-lists/:id/items error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Owner: change a quantity ─────────────────────────────────────
  router.patch('/:id/items/:itemId', requireAuth, async (req, res) => {
    try {
      const { quantity_desired } = req.body;
      const [[list]] = await db.execute(
        `SELECT id FROM gift_lists WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id]
      );
      if (!list) return res.status(404).json({ error: 'Not found' });

      await db.execute(
        `UPDATE gift_list_items SET quantity_desired = ? WHERE id = ? AND gift_list_id = ?`,
        [Math.max(1, Number(quantity_desired) || 1), req.params.itemId, req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('PATCH /api/gift-lists/:id/items/:itemId error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Owner: remove a book from a list ────────────────────────────
  router.delete('/:id/items/:itemId', requireAuth, async (req, res) => {
    try {
      const [[list]] = await db.execute(
        `SELECT id FROM gift_lists WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id]
      );
      if (!list) return res.status(404).json({ error: 'Not found' });

      await db.execute(
        `DELETE FROM gift_list_items WHERE id = ? AND gift_list_id = ?`,
        [req.params.itemId, req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE /api/gift-lists/:id/items/:itemId error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── PUBLIC: the shared view. No auth required to view.
  //    If the requester happens to be logged in AND owns this list,
  //    every item is shown as fully wanted (0 given) regardless of
  //    reality — this is the "blind to reservations" rule that keeps
  //    the gift a surprise for the owner. Everyone else sees real
  //    partial progress. ─────────────────────────────────────────
  router.get('/shared/:slug', async (req, res) => {
    try {
      const [[list]] = await db.execute(
        `SELECT id, user_id, title, occasion, event_date FROM gift_lists WHERE share_slug = ?`,
        [req.params.slug]
      );
      if (!list) return res.status(404).json({ error: 'List not found' });

      const isOwnerViewing = !!(req.isAuthenticated && req.isAuthenticated() && req.user && req.user.id === list.user_id);

      const [items] = await db.execute(`
        SELECT gli.id, gli.book_id, gli.quantity_desired,
               b.title_en, b.title_de, b.image, b.price, b.slug, b.isbn13, b.isbn10, b.stock
        FROM gift_list_items gli
        JOIN books b ON b.id = gli.book_id
        WHERE gli.gift_list_id = ?
        ORDER BY gli.added_at ASC
      `, [list.id]);

      let enriched = items;
      if (!isOwnerViewing) {
        enriched = [];
        for (const it of items) {
          const [[givenRow]] = await db.execute(
            `SELECT COALESCE(SUM(quantity), 0) AS given
             FROM gift_list_reservations
             WHERE gift_list_item_id = ?
               AND (order_id IS NOT NULL OR expires_at > NOW())`,
            [it.id]
          );
          enriched.push({ ...it, quantity_given: Number(givenRow.given) });
        }
      } else {
        // Owner: always show as untouched, regardless of reality.
        enriched = items.map(it => ({ ...it, quantity_given: 0 }));
      }

      res.json({
        list: { title: list.title, occasion: list.occasion, event_date: list.event_date },
        isOwnerViewing,
        items: enriched,
      });
    } catch (err) {
      console.error('GET /api/gift-lists/shared/:slug error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};
