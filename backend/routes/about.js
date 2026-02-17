// backend/routes/about.js  ← REPLACE YOUR ENTIRE FILE WITH THIS

const express = require('express');
const path = require('path');
const multer = require('multer');

module.exports = (db) => {
  const router = express.Router();

  // Multer config for About page images
  const storage = multer.diskStorage({
    destination: './uploads/about/',
    filename: (req, file, cb) => {
      cb(null, 'about-' + Date.now() + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      const allowed = /jpeg|jpg|png|webp/;
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.test(ext)) cb(null, true);
      else cb(new Error('Images only!'));
    }
  });

  // GET: Fetch current About content
  router.get('/', async (req, res) => {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM about_content ORDER BY id DESC LIMIT 1'
      );
      res.json(rows[0] || {});
    } catch (err) {
      console.error('GET /api/about error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // PATCH: Update About content + images
  router.patch('/', upload.fields([
    { name: 'hero_image', maxCount: 1 },
    { name: 'story_image', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const data = req.body;
      const files = req.files || {};

      // Build image URLs
      if (files.hero_image?.[0]) {
        data.hero_image_url = `/uploads/about/${files.hero_image[0].filename}`;
      }
      if (files.story_image?.[0]) {
        data.story_image_url = `/uploads/about/${files.story_image[0].filename}`;
      }

      // Clean empty strings to NULL for DB
      Object.keys(data).forEach(key => {
        if (data[key] === '' || data[key] === 'undefined') data[key] = null;
      });

      // UPSERT: Insert or update the single row
      await db.execute(`
        INSERT INTO about_content (
          title_en, title_de, subtitle_en, subtitle_de,
          mission_en, mission_de, story_en, story_de,
          values_quality_en, values_quality_de, values_quality_text_en, values_quality_text_de,
          values_service_en, values_service_de, values_service_text_en, values_service_text_de,
          values_speed_en, values_speed_de, values_speed_text_en, values_speed_text_de,
          team_en, team_de,
          hero_image_url, story_image_url
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        ) ON DUPLICATE KEY UPDATE
          title_en = VALUES(title_en), title_de = VALUES(title_de),
          subtitle_en = VALUES(subtitle_en), subtitle_de = VALUES(subtitle_de),
          mission_en = VALUES(mission_en), mission_de = VALUES(mission_de),
          story_en = VALUES(story_en), story_de = VALUES(story_de),
          values_quality_en = VALUES(values_quality_en), values_quality_de = VALUES(values_quality_de),
          values_quality_text_en = VALUES(values_quality_text_en), values_quality_text_de = VALUES(values_quality_text_de),
          values_service_en = VALUES(values_service_en), values_service_de = VALUES(values_service_de),
          values_service_text_en = VALUES(values_service_text_en), values_service_text_de = VALUES(values_service_text_de),
          values_speed_en = VALUES(values_speed_en), values_speed_de = VALUES(values_speed_de),
          values_speed_text_en = VALUES(values_speed_text_en), values_speed_text_de = VALUES(values_speed_text_de),
          team_en = VALUES(team_en), team_de = VALUES(team_de),
          hero_image_url = VALUES(hero_image_url),
          story_image_url = VALUES(story_image_url)
      `, [
        data.title_en || null, data.title_de || null,
        data.subtitle_en || null, data.subtitle_de || null,
        data.mission_en || null, data.mission_de || null,
        data.story_en || null, data.story_de || null,
        data.values_quality_en || null, data.values_quality_de || null,
        data.values_quality_text_en || null, data.values_quality_text_de || null,
        data.values_service_en || null, data.values_service_de || null,
        data.values_service_text_en || null, data.values_service_text_de || null,
        data.values_speed_en || null, data.values_speed_de || null,
        data.values_speed_text_en || null, data.values_speed_text_de || null,
        data.team_en || null, data.team_de || null,
        data.hero_image_url || null,
        data.story_image_url || null
      ]);

      res.json({ success: true, message: 'About page updated!' });
    } catch (err) {
      console.error('PATCH /api/about error:', err);
      res.status(500).json({ error: 'Failed to save', details: err.message });
    }
  });

  return router;
};