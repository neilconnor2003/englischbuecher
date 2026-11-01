// backend/routes/giftListRoutes.js
// Requires migration_gift_lists_v2.sql (deleted_at / removed_at columns).
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

  // Helper: an owner's own, not-deleted list (or null).
  const getOwnList = async (listId, userId) => {
    const [[list]] = await db.execute(
      `SELECT id FROM gift_lists WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [listId, userId]
    );
    return list || null;
  };

  // ── Owner: list all of my gift lists ──────────────────────────
  router.get('/', requireAuth, async (req, res) => {
    try {
      const [lists] = await db.execute(`
        SELECT gl.id, gl.title, gl.occasion, gl.event_date, gl.share_slug, gl.created_at,
               COUNT(gli.id) AS item_count
        FROM gift_lists gl
        LEFT JOIN gift_list_items gli ON gli.gift_list_id = gl.id AND gli.removed_at IS NULL
        WHERE gl.user_id = ? AND gl.deleted_at IS NULL
        GROUP BY gl.id
        ORDER BY gl.created_at DESC
      `, [req.user.id]);

      for (const list of lists) {
        const [previews] = await db.execute(`
          SELECT b.image
          FROM gift_list_items gli
          JOIN books b ON b.id = gli.book_id
          WHERE gli.gift_list_id = ? AND gli.removed_at IS NULL
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

  // ── Giver: every list I have given from (completed orders only) ──
  // This is the giver's own purchase history, grouped by list.
  router.get('/given', requireAuth, async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT gl.id AS list_id, gl.title, gl.occasion, gl.event_date, gl.share_slug, gl.deleted_at,
               gli.id AS item_id, gli.book_id,
               b.title_en, b.title_de, b.image, b.slug, b.isbn13, b.isbn10,
               glr.quantity, glr.order_id, o.created_at AS given_at
        FROM gift_list_reservations glr
        JOIN orders o ON o.id = glr.order_id
        JOIN gift_list_items gli ON gli.id = glr.gift_list_item_id
        JOIN gift_lists gl ON gl.id = gli.gift_list_id
        JOIN books b ON b.id = gli.book_id
        WHERE o.user_id = ? AND glr.order_id IS NOT NULL
        ORDER BY o.created_at DESC
      `, [req.user.id]);

      const byList = new Map();
      for (const r of rows) {
        if (!byList.has(r.list_id)) {
          byList.set(r.list_id, {
            list_id: r.list_id,
            title: r.title,
            occasion: r.occasion,
            event_date: r.event_date,
            // A deleted list can't be opened any more, so no link for it.
            share_slug: r.deleted_at ? null : r.share_slug,
            last_given_at: r.given_at,
            gifts: [],
          });
        }
        byList.get(r.list_id).gifts.push({
          order_id: r.order_id,
          given_at: r.given_at,
          quantity: r.quantity,
          book_id: r.book_id,
          title_en: r.title_en,
          title_de: r.title_de,
          image: r.image,
          slug: r.slug,
          isbn13: r.isbn13,
          isbn10: r.isbn10,
        });
      }
      res.json([...byList.values()]);
    } catch (err) {
      console.error('GET /api/gift-lists/given error:', err);
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

  // ── Owner: edit a list's own details ────────────────────────────
  router.patch('/:id', requireAuth, async (req, res) => {
    try {
      const { title, occasion, event_date } = req.body;
      if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });

      const [result] = await db.execute(
        `UPDATE gift_lists SET title = ?, occasion = ?, event_date = ?
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [title.trim(), occasion || null, event_date || null, req.params.id, req.user.id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('PATCH /api/gift-lists/:id error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Owner: delete a list ───────────────────────────────────────
  // Soft delete: the list disappears for the owner and the share link stops
  // working, but gift records survive so givers keep their history.
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const [result] = await db.execute(
        `UPDATE gift_lists SET deleted_at = NOW()
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
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
  //    status — the owner never sees what's been given) ───────────
  router.get('/:id/manage', requireAuth, async (req, res) => {
    try {
      const [[list]] = await db.execute(
        `SELECT id, title, occasion, event_date, share_slug, created_at
         FROM gift_lists WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [req.params.id, req.user.id]
      );
      if (!list) return res.status(404).json({ error: 'Not found' });

      const [items] = await db.execute(`
        SELECT gli.id, gli.book_id, gli.quantity_desired, gli.added_at,
               b.title_en, b.title_de, b.image, b.price, b.slug, b.isbn13, b.isbn10
        FROM gift_list_items gli
        JOIN books b ON b.id = gli.book_id
        WHERE gli.gift_list_id = ? AND gli.removed_at IS NULL
        ORDER BY gli.added_at DESC
      `, [req.params.id]);

      res.json({ list, items });
    } catch (err) {
      console.error('GET /api/gift-lists/:id/manage error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Owner: add a book to a list ─────────────────────────────────
  // If the book is already on the list, bump its quantity instead of
  // creating a confusing duplicate tile.
  router.post('/:id/items', requireAuth, async (req, res) => {
    try {
      const { book_id, quantity_desired } = req.body;
      if (!(await getOwnList(req.params.id, req.user.id))) return res.status(404).json({ error: 'Not found' });
      if (!book_id) return res.status(400).json({ error: 'book_id required' });

      const qty = Math.max(1, Number(quantity_desired) || 1);

      const [[existing]] = await db.execute(
        `SELECT id FROM gift_list_items
         WHERE gift_list_id = ? AND book_id = ? AND removed_at IS NULL LIMIT 1`,
        [req.params.id, book_id]
      );
      if (existing) {
        await db.execute(
          `UPDATE gift_list_items SET quantity_desired = quantity_desired + ? WHERE id = ?`,
          [qty, existing.id]
        );
        return res.status(200).json({ id: existing.id, merged: true });
      }

      const [result] = await db.execute(
        `INSERT INTO gift_list_items (gift_list_id, book_id, quantity_desired)
         VALUES (?, ?, ?)`,
        [req.params.id, book_id, qty]
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
      if (!(await getOwnList(req.params.id, req.user.id))) return res.status(404).json({ error: 'Not found' });

      await db.execute(
        `UPDATE gift_list_items SET quantity_desired = ?
         WHERE id = ? AND gift_list_id = ? AND removed_at IS NULL`,
        [Math.max(1, Number(quantity_desired) || 1), req.params.itemId, req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('PATCH /api/gift-lists/:id/items/:itemId error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Owner: remove a book from a list ────────────────────────────
  // Soft remove: hidden from the list, any gifts already bought stay on
  // record for the givers. Unfinished checkout holds on it are dropped.
  router.delete('/:id/items/:itemId', requireAuth, async (req, res) => {
    try {
      if (!(await getOwnList(req.params.id, req.user.id))) return res.status(404).json({ error: 'Not found' });

      await db.execute(
        `UPDATE gift_list_items SET removed_at = NOW()
         WHERE id = ? AND gift_list_id = ? AND removed_at IS NULL`,
        [req.params.itemId, req.params.id]
      );
      await db.execute(
        `DELETE FROM gift_list_reservations WHERE gift_list_item_id = ? AND order_id IS NULL`,
        [req.params.itemId]
      ).catch(() => {});
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE /api/gift-lists/:id/items/:itemId error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── PUBLIC: the shared view. No auth required to view.
  //    If the requester is logged in AND owns this list, every item is
  //    shown as fully wanted (0 given) — the "blind to reservations" rule
  //    that keeps the gift a surprise. Everyone else sees real progress. ──
  router.get('/shared/:slug', async (req, res) => {
    try {
      const [[list]] = await db.execute(
        `SELECT id, user_id, title, occasion, event_date
         FROM gift_lists WHERE share_slug = ? AND deleted_at IS NULL`,
        [req.params.slug]
      );
      if (!list) return res.status(404).json({ error: 'List not found' });

      const loggedIn = !!(req.isAuthenticated && req.isAuthenticated() && req.user);
      const isOwnerViewing = loggedIn && req.user.id === list.user_id;

      const [items] = await db.execute(`
        SELECT gli.id, gli.book_id, gli.quantity_desired,
               b.title_en, b.title_de, b.image, b.price, b.slug, b.isbn13, b.isbn10, b.stock
        FROM gift_list_items gli
        JOIN books b ON b.id = gli.book_id
        WHERE gli.gift_list_id = ? AND gli.removed_at IS NULL
        ORDER BY gli.added_at ASC
      `, [list.id]);

      let enriched;
      if (!isOwnerViewing) {
        // One query for all items instead of one per item.
        const ids = items.map(i => i.id);
        const givenMap = {};
        const mineMap = {};
        if (ids.length) {
          const [givenRows] = await db.query(
            `SELECT gift_list_item_id, COALESCE(SUM(quantity), 0) AS given
             FROM gift_list_reservations
             WHERE gift_list_item_id IN (?)
               AND (order_id IS NOT NULL OR expires_at > NOW())
             GROUP BY gift_list_item_id`,
            [ids]
          );
          givenRows.forEach(r => { givenMap[r.gift_list_item_id] = Number(r.given); });

          // What the current visitor has already given themselves (completed
          // orders only), so the page can say "you gave this".
          if (loggedIn) {
            const [mineRows] = await db.query(
              `SELECT glr.gift_list_item_id, COALESCE(SUM(glr.quantity), 0) AS mine
               FROM gift_list_reservations glr
               JOIN orders o ON o.id = glr.order_id
               WHERE glr.gift_list_item_id IN (?) AND o.user_id = ?
               GROUP BY glr.gift_list_item_id`,
              [ids, req.user.id]
            );
            mineRows.forEach(r => { mineMap[r.gift_list_item_id] = Number(r.mine); });
          }
        }

        enriched = items.map(it => ({
          ...it,
          quantity_given: givenMap[it.id] || 0,
          quantity_given_by_me: mineMap[it.id] || 0,
        }));
      } else {
        enriched = items.map(it => ({ ...it, quantity_given: 0, quantity_given_by_me: 0 }));
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
