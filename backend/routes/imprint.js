// backend/routes/imprint.js
module.exports = (db) => {
  const router = require('express').Router();

  // GET current imprint
  router.get('/', async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM imprint_content ORDER BY id DESC LIMIT 1');
      res.json(rows[0] || {});
    } catch (err) {
      console.error('GET /api/imprint error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // PATCH update imprint
  router.patch('/', async (req, res) => {
    try {
      const data = req.body;

      // Clean empty strings
      Object.keys(data).forEach(key => {
        if (data[key] === '' || data[key] === 'undefined') data[key] = null;
      });

      await db.execute(`
        INSERT INTO imprint_content (
          company_name_en, company_name_de, owner_name_en, owner_name_de,
          address_street_en, address_street_de, address_city_en, address_city_de,
          phone, email, website, tax_id, tax_number,
          register_court_en, register_court_de, register_number,
          responsible_person_en, responsible_person_de,
          disclaimer_en, disclaimer_de
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          company_name_en = VALUES(company_name_en),
          company_name_de = VALUES(company_name_de),
          owner_name_en = VALUES(owner_name_en),
          owner_name_de = VALUES(owner_name_de),
          address_street_en = VALUES(address_street_en),
          address_street_de = VALUES(address_street_de),
          address_city_en = VALUES(address_city_en),
          address_city_de = VALUES(address_city_de),
          phone = VALUES(phone),
          email = VALUES(email),
          website = VALUES(website),
          tax_id = VALUES(tax_id),
          tax_number = VALUES(tax_number),
          register_court_en = VALUES(register_court_en),
          register_court_de = VALUES(register_court_de),
          register_number = VALUES(register_number),
          responsible_person_en = VALUES(responsible_person_en),
          responsible_person_de = VALUES(responsible_person_de),
          disclaimer_en = VALUES(disclaimer_en),
          disclaimer_de = VALUES(disclaimer_de)
      `, [
        data.company_name_en, data.company_name_de,
        data.owner_name_en, data.owner_name_de,
        data.address_street_en, data.address_street_de,
        data.address_city_en, data.address_city_de,
        data.phone, data.email, data.website,
        data.tax_id, data.tax_number,
        data.register_court_en, data.register_court_de,
        data.register_number,
        data.responsible_person_en, data.responsible_person_de,
        data.disclaimer_en, data.disclaimer_de
      ]);

      res.json({ success: true, message: 'Impressum aktualisiert!' });
    } catch (err) {
      console.error('PATCH /api/imprint error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};