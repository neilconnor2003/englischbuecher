// backend/routes/faq.js
module.exports = (db) => {
  const router = require('express').Router();

  // GET all FAQs (public + admin)
  router.get('/', async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT id, question_de, question_en, answer_de, answer_en, sort_order, is_visible
        FROM faq_items
        WHERE is_visible = 1
        ORDER BY sort_order ASC, id ASC
      `);
      res.json(rows);
    } catch (err) {
      console.error('GET /api/faq error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // ADMIN: Get all (including hidden)
  router.get('/admin', async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT * FROM faq_items ORDER BY sort_order ASC, id ASC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ADMIN: Create new FAQ
  router.post('/', async (req, res) => {
    const { question_de, question_en, answer_de, answer_en, sort_order = 999 } = req.body;
    try {
      const [result] = await db.execute(
        `INSERT INTO faq_items (question_de, question_en, answer_de, answer_en, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [question_de, question_en, answer_de, answer_en, sort_order]
      );
      res.json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ADMIN: Update FAQ
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { question_de, question_en, answer_de, answer_en, sort_order, is_visible } = req.body;
    try {
      await db.execute(`
        UPDATE faq_items SET
          question_de = ?, question_en = ?, answer_de = ?, answer_en = ?,
          sort_order = ?, is_visible = ?
        WHERE id = ?
      `, [question_de, question_en, answer_de, answer_en, sort_order || 0, is_visible ? 1 : 0, id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ADMIN: Delete FAQ
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await db.execute('DELETE FROM faq_items WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};