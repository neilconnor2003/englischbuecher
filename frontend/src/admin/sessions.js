// backend/routes/admin/sessions.js
const express = require('express');
const router = express.Router();

// === ADMIN: GET SESSIONS (with pagination + search) ===
router.get('/', async (req, res) => {
  const { db } = req; // ← We'll pass `db` from server.js
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = (req.query.search || '').trim().toLowerCase();
  const offset = (page - 1) * limit;

  try {
    let whereClause = '';
    let params = [];
    let countParams = [];

    if (search) {
      whereClause = `WHERE (
        LOWER(session_id) LIKE ? OR
        data LIKE ? OR
        data LIKE ?
      )`;
      const like = `%${search}%`;
      params.push(like, like, `%${search}%`);
      countParams.push(like, like, `%${search}%`);
    }

    const [sessions] = await db.execute(`
      SELECT session_id, expires, data, created_at
      FROM sessions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [[{ total }]] = await db.execute(`
      SELECT COUNT(*) as total
      FROM sessions
      ${whereClause}
    `, countParams);

    // === ENRICH WITH USER DATA ===
    const enriched = sessions.map(session => {
      let userId = null;
      let userEmail = null;
      try {
        const parsed = JSON.parse(session.data || '{}');
        userId = parsed.passport?.user?.id || parsed.passport?.user || null;
        userEmail = parsed.passport?.user?.email || null;
      } catch (e) {
        // ignore
      }

      return {
        ...session,
        user_id_parsed: userId,
        user_email_parsed: userEmail,
        is_active: Date.now() < session.expires * 1000,
      };
    });

    res.json({
      sessions: enriched,
      total: total || 0,
    });
  } catch (err) {
    console.error('GET /api/admin/sessions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// === ADMIN: DELETE SESSION (log out user) ===
router.delete('/:sessionId', async (req, res) => {
  const { db } = req;
  const { sessionId } = req.params;

  try {
    const [result] = await db.execute(
      'DELETE FROM sessions WHERE session_id = ?',
      [sessionId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/sessions/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = (db) => {
  // Inject db into req
  router.use((req, res, next) => {
    req.db = db;
    next();
  });
  return router;
};