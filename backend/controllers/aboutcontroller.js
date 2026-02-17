// backend/controllers/aboutController.js
const getAbout = async (req, res) => {
  try {
    const [rows] = await req.db.query('SELECT * FROM about_content WHERE id = 1');
    res.json(rows[0] || {});
  } catch (err) {
    console.error('GET /api/about error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateAbout = async (req, res) => {
  try {
    const data = req.body;

    // Handle image uploads (saved to uploads/about/)
    if (req.files?.hero_image?.[0]) {
      data.hero_image_url = `/uploads/about/${req.files.hero_image[0].filename}`;
    }
    if (req.files?.story_image?.[0]) {
      data.story_image_url = `/uploads/about/${req.files.story_image[0].filename}`;
    }

    const fields = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(data);

    if (fields) {
      await req.db.query(
        `UPDATE about_content SET ${fields}, updated_at = NOW() WHERE id = 1`,
        values
      );
    }

    const [updated] = await req.db.query('SELECT * FROM about_content WHERE id = 1');
    res.json(updated[0]);
  } catch (err) {
    console.error('PATCH /api/about error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getAbout, updateAbout };