// backend/routes/contact.js
const express = require('express');
const path = require('path');
const multer = require('multer');

module.exports = (db) => {
  const router = express.Router();

  const storage = multer.diskStorage({
    destination: './uploads/contact/',
    filename: (req, file, cb) => {
      cb(null, 'contact-hero-' + Date.now() + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = /jpeg|jpg|png|webp/;
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.test(ext)) cb(null, true);
      else cb(new Error('Images only!'));
    }
  });

  // GET contact content
  router.get('/', async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM contact_content ORDER BY id DESC LIMIT 1');
      res.json(rows[0] || {});
    } catch (err) {
      console.error('GET /api/contact error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // PATCH update contact
  router.patch('/', upload.single('hero_image'), async (req, res) => {
    try {
      const data = req.body;
      if (req.file) {
        data.hero_image_url = `/uploads/contact/${req.file.filename}`;
      }

      Object.keys(data).forEach(key => {
        if (data[key] === '' || data[key] === 'undefined') data[key] = null;
      });

      await db.execute(`
        INSERT INTO contact_content (
          title_en, title_de, subtitle_en, subtitle_de,
          email, phone, phone_hours_en, phone_hours_de,
          response_time_en, response_time_de, hero_image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title_en = VALUES(title_en), title_de = VALUES(title_de),
          subtitle_en = VALUES(subtitle_en), subtitle_de = VALUES(subtitle_de),
          email = VALUES(email), phone = VALUES(phone),
          phone_hours_en = VALUES(phone_hours_en), phone_hours_de = VALUES(phone_hours_de),
          response_time_en = VALUES(response_time_en), response_time_de = VALUES(response_time_de),
          hero_image_url = VALUES(hero_image_url)
      `, [
        data.title_en, data.title_de,
        data.subtitle_en, data.subtitle_de,
        data.email, data.phone,
        data.phone_hours_en, data.phone_hours_de,
        data.response_time_en, data.response_time_de,
        data.hero_image_url || null
      ]);

      res.json({ success: true, message: 'Contact page updated!' });
    } catch (err) {
      console.error('PATCH /api/contact error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};