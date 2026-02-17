// backend/routes/heroBannerApi.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

let db;

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, 'hero-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Images only!'));
  },
});

// GET ALL BANNERS — ordered by sort_order
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT id, image_path, title_en, title_de, subtitle_en, subtitle_de,
             button_text_en, button_text_de, button_link, sort_order, is_active
      FROM hero_banner 
      ORDER BY sort_order ASC, id ASC
    `);

    const banners = rows.map(b => ({
      ...b,
      image_url: b.image_path ? `${req.protocol}://${req.get('host')}${b.image_path}` : null,
      is_active: b.is_active === 1,
    }));

    res.json(banners);
  } catch (err) {
    console.error('GET error:', err);
    res.status(500).json({ error: 'Failed to load' });
  }
});

// SAVE ALL BANNERS + ORDER + IMAGES
// backend/routes/heroBannerApi.js → REPLACE ENTIRE POST /update-all

router.post('/update-all', upload.array('image'), async (req, res) => {
  const files = req.files || [];
  let fileIndex = 0;

  try {
    const banners = [];
    let i = 0;

    while (req.body[`banners[${i}]id`] !== undefined) {
      const id = req.body[`banners[${i}]id`] || null;
      const newImage = files[fileIndex] ? `/uploads/${files[fileIndex].filename}` : null;
      const currentImagePath = req.body[`banners[${i}]image_path`];

      // FIX: Checkbox sends "on" when checked, nothing when unchecked
      const isActiveRaw = req.body[`banners[${i}]is_active`];
      const is_active = isActiveRaw === 'on' || isActiveRaw === 'true' || isActiveRaw === true ? 1 : 0;

      banners.push({
        id,
        title_en: req.body[`banners[${i}]title_en`] || '',
        title_de: req.body[`banners[${i}]title_de`] || null,
        subtitle_en: req.body[`banners[${i}]subtitle_en`] || null,
        subtitle_de: req.body[`banners[${i}]subtitle_de`] || null,
        button_text_en: req.body[`banners[${i}]button_text_en`] || 'Shop Now',
        button_text_de: req.body[`banners[${i}]button_text_de`] || 'Jetzt einkaufen',
        button_link: req.body[`banners[${i}]button_link`] || '/books',
        image_path: newImage || currentImagePath || '/uploads/hero-default.jpg',
        sort_order: i + 1,
        is_active,
      });

      if (files[fileIndex]) fileIndex++;
      i++;
    }

    for (const b of banners) {
      if (b.id) {
        await db.execute(
          'UPDATE hero_banner SET title_en=?, title_de=?, subtitle_en=?, subtitle_de=?, button_text_en=?, button_text_de=?, button_link=?, sort_order=?, image_path=?, is_active=?, updated_at=NOW() WHERE id=?',
          [
            b.title_en, b.title_de, b.subtitle_en, b.subtitle_de,
            b.button_text_en, b.button_text_de, b.button_link,
            b.sort_order, b.image_path, b.is_active, b.id
          ]
        );
      } else {
        await db.execute(
          'INSERT INTO hero_banner (title_en, title_de, subtitle_en, subtitle_de, button_text_en, button_text_de, button_link, sort_order, image_path, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            b.title_en, b.title_de, b.subtitle_en, b.subtitle_de,
            b.button_text_en, b.button_text_de, b.button_link,
            b.sort_order, b.image_path || '/uploads/hero-default.jpg', b.is_active
          ]
        );
      }
    }

    res.json({ success: true, message: 'Banners saved!' });
  } catch (err) {
    console.error('POST /update-all error:', err);
    res.status(500).json({ error: 'Save failed', details: err.message });
  }
});

// Optional: delete single banner
router.delete('/delete/:id', async (req, res) => {
  try {
    await db.execute('UPDATE hero_banner SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = (database) => {
  db = database;
  return router;
};