
// backend/routes/bookEnrichmentRoutes.js
const express = require('express');
const { enrichBookByIsbn } = require('../services/bookMetadataService');
const { enrichBookTextWithAI } = require('../services/aiBookEnrichmentService');

const router = express.Router();

router.get('/books/enrich/:isbn', async (req, res) => {
  try {
    const isbn = req.params.isbn;
    const base = await enrichBookByIsbn(isbn);

    if (!base.found) {
      return res.json(base);
    }

    const ai = await enrichBookTextWithAI(base);

    return res.json({
      ...base,
      description_de: ai.description_de || base.description_de,
      meta_title_en: ai.meta_title_en || `${base.title_en} by ${base.author} – Buy Now`,
      meta_title_de: ai.meta_title_de || `${base.title_en} von ${base.author} – Jetzt kaufen`,
      meta_description_en: ai.meta_description_en || (base.description_en || '').slice(0, 155),
      meta_description_de: ai.meta_description_de || (base.description_de || base.description_en || '').slice(0, 155),
      tags: [...new Set([
        ...(base.tags ? base.tags.split(',').map(x => x.trim()).filter(Boolean) : []),
        ...((ai.tags_ai || []).map(x => String(x).trim()).filter(Boolean))
      ])].join(', ')
    });
  } catch (err) {
    console.error('Enrich ISBN failed:', err);
    return res.status(500).json({
      error: 'Failed to enrich ISBN',
      details: err.message
    });
  }
});

module.exports = router;
