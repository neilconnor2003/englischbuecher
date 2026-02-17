// backend/routes/admin/sessions.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  //console.log('req.db exists?', !!req.db);
  if (!req.db) {
    return res.status(500).json({ error: 'Database not injected' });
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = (req.query.search || '').toString().trim().toLowerCase();

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  //console.log('page:', safePage, 'limit:', safeLimit, 'offset:', offset);

  let whereClause = '';
  let params = [];
  let countParams = [];

  try {
    if (search) {
      const like = `%${search}%`;
      whereClause = `WHERE LOWER(session_id) LIKE ? OR CAST(data AS CHAR) LIKE ?`;
      params = [like, like];
      countParams = [like, like];
    }

    // === INTERPOLATE LIMIT & OFFSET (NO ?) ===
    const sql = `
      SELECT session_id, expires, data
      FROM sessions
      ${whereClause}
      ORDER BY expires DESC
      LIMIT ${safeLimit} OFFSET ${offset}
    `;

    const [sessions] = await req.db.execute(sql, params);

    const countSql = `SELECT COUNT(*) as total FROM sessions ${whereClause}`;
    const [[{ total }]] = await req.db.execute(countSql, countParams);

    const enriched = sessions.map(s => {
      let userId = null;
      let userEmail = null;
      try {
        const data = JSON.parse(s.data || '{}');
        const user = data.passport?.user;
        if (user) {
          userId = typeof user === 'object' ? user.id : user;
          userEmail = typeof user === 'object' ? user.email : null;
        }
      } catch (e) {}

      return {
        ...s,
        user_id_parsed: userId,
        user_email_parsed: userEmail,
        is_active: Date.now() < s.expires * 1000,
        created_at_estimated: new Date(s.expires * 1000 - 86400000).toISOString(),
      };
    });

    res.json({ sessions: enriched, total: total || 0 });
  } catch (err) {
    console.error('GET /api/admin/sessions error:', err.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [result] = await req.db.execute(
      'DELETE FROM sessions WHERE session_id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE session error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;