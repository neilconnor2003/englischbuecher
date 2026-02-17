// backend/routes/admin/wishlist.js
const express = require('express');
const router = express.Router();

module.exports = function(db) {

  router.get('/', async (req, res) => {
    try {
      const page   = Math.max(1, parseInt(req.query.page, 10)  || 1);
      const limit  = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
      const offset = Math.max(0, (page - 1) * limit);
      const search = (req.query.search || '').toString().trim();

      let where = '';
      let searchParams = [];

      if (search) {
        const like = `%${search}%`;
        where = `AND (u.email LIKE ? OR b.title_en LIKE ? OR b.title_de LIKE ? OR CAST(w.user_id AS CHAR) LIKE ?)`;
        searchParams = [like, like, like, like];
      }

      // CRITICAL FIX: mysql2/promise needs LIMIT/OFFSET as STRINGS
      const limitStr  = String(limit);
      const offsetStr = String(offset);

      //console.log('Query params → search:', searchParams, 'limit:', limitStr, 'offset:', offsetStr);

      const [items] = await db.execute(`
        SELECT 
          w.id,
          w.user_id,
          u.email,
          COALESCE(b.title_de, b.title_en, 'Book Missing') AS book_title,
          w.created_at,
          w.deleted_at
        FROM wishlist w
        JOIN users u ON u.id = w.user_id
        LEFT JOIN books b ON b.id = w.book_id
        WHERE 1=1 ${where}
        ORDER BY w.created_at DESC
        LIMIT ? OFFSET ?
      `, [...searchParams, limitStr, offsetStr]);

      const [[{ total }]] = await db.execute(`
        SELECT COUNT(*) AS total
        FROM wishlist w
        JOIN users u ON u.id = w.user_id
        LEFT JOIN books b ON b.id = w.book_id
        WHERE 1=1 ${where}
      `, searchParams);

      res.json({
        items: items || [],
        total: Number(total || 0)
      });

    } catch (err) {
      console.error('WISHLIST FETCH FAILED:', err.message);
      res.status(500).json({ error: 'Database error', message: err.message });
    }
  });

  // These work fine
  router.delete('/:id', async (req, res) => {
    await db.execute('UPDATE wishlist SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  router.post('/:id/restore', async (req, res) => {
    await db.execute('UPDATE wishlist SET deleted_at = NULL WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  router.get('/:id/audit', async (req, res) => {
    const [logs] = await db.execute(`
      SELECT 'added' AS action, u.email AS changed_by_email, w.created_at FROM wishlist w JOIN users u ON u.id = w.user_id WHERE w.id = ?
      UNION ALL
      SELECT 'removed' AS action, 'admin' AS changed_by_email, w.deleted_at FROM wishlist w WHERE w.id = ? AND w.deleted_at IS NOT NULL
      ORDER BY created_at DESC
    `, [req.params.id, req.params.id]);
    res.json(logs);
  });

  return router;
};