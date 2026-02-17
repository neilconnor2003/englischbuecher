// backend/routes/privacy.js
module.exports = (db) => {
  const router = require('express').Router();

  router.get('/', async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM privacy_content ORDER BY id DESC LIMIT 1');
      res.json(rows[0] || {});
    } catch (err) {
      console.error('GET /api/privacy error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  router.patch('/', async (req, res) => {
    try {
      const data = req.body;
      Object.keys(data).forEach(key => {
        if (data[key] === '' || data[key] === 'undefined') data[key] = null;
      });

      await db.execute(`
        INSERT INTO privacy_content (
          intro_en, intro_de, controller_name_en, controller_name_de,
          controller_address_en, controller_address_de, controller_email,
          collection_en, collection_de, cookies_en, cookies_de,
          analytics_en, analytics_de, payment_en, payment_de,
          rights_en, rights_de, security_en, security_de, last_updated
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          intro_en = VALUES(intro_en), intro_de = VALUES(intro_de),
          controller_name_en = VALUES(controller_name_en), controller_name_de = VALUES(controller_name_de),
          controller_address_en = VALUES(controller_address_en), controller_address_de = VALUES(controller_address_de),
          controller_email = VALUES(controller_email),
          collection_en = VALUES(collection_en), collection_de = VALUES(collection_de),
          cookies_en = VALUES(cookies_en), cookies_de = VALUES(cookies_de),
          analytics_en = VALUES(analytics_en), analytics_de = VALUES(analytics_de),
          payment_en = VALUES(payment_en), payment_de = VALUES(payment_de),
          rights_en = VALUES(rights_en), rights_de = VALUES(rights_de),
          security_en = VALUES(security_en), security_de = VALUES(security_de),
          last_updated = VALUES(last_updated)
      `, [
        data.intro_en, data.intro_de,
        data.controller_name_en, data.controller_name_de,
        data.controller_address_en, data.controller_address_de,
        data.controller_email,
        data.collection_en, data.collection_de,
        data.cookies_en, data.cookies_de,
        data.analytics_en, data.analytics_de,
        data.payment_en, data.payment_de,
        data.rights_en, data.rights_de,
        data.security_en, data.security_de,
        data.last_updated || 'November 2025'
      ]);

      res.json({ success: true, message: 'Datenschutzerklärung gespeichert!' });
    } catch (err) {
      console.error('PATCH /api/privacy error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};