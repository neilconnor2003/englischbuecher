
// backend/routes/bookEnrichmentRoutes.js
const express = require('express');
const { enrichBookByIsbn } = require('../services/bookMetadataService');
const { enrichBookTextWithAI } = require('../services/aiBookEnrichmentService');

module.exports = (db) => {
  const router = express.Router();

  router.get('/books/enrich/:isbn', async (req, res) => {
    try {
      const isbn = String(req.params.isbn || '').replace(/\D/g, '');

      if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
        return res.status(400).json({
          found: false,
          error: 'Invalid ISBN'
        });
      }

      // ✅ 1. CHECK EXCEL FIRST
      const [excelRows] = await db.execute(
        `SELECT * FROM excel_books WHERE isbn13 = ? OR isbn10 = ? OR isbn = ? LIMIT 1`,
        [isbn, isbn, isbn]
      );

      if (excelRows.length > 0) {
        const excel = excelRows[0];

        return res.json({
          found: true,
          source: 'excel',

          title_en: excel.title_en || '',
          title_de: excel.title_de || excel.title_en || '',
          author: excel.author || '',

          isbn: excel.isbn || excel.isbn13 || excel.isbn10 || isbn,
          isbn10: excel.isbn10 || '',
          isbn13: excel.isbn13 || '',

          publisher: excel.publisher || '',
          pages: excel.pages || null,
          publish_date: excel.publish_date || null,

          description_en: excel.description_en || '',
          description_de: excel.description_de || '',

          price: excel.price || null,
          original_price: excel.original_price || null,

          category_id: excel.category_id || null,

          weight_grams: excel.weight_grams || null,
          dimensions: excel.dimensions || '',

          format: excel.format || 'Paperback',
          language: excel.language || 'EN',
          binding: excel.binding || '',
          edition: excel.edition || '',

          series_name: excel.series_name || '',
          reading_age: excel.reading_age || '',

          image: null,
          images: []
        });
      }

      // ✅ 2. FALLBACK TO EXTERNAL ENRICHMENT
      const base = await enrichBookByIsbn(isbn);

      if (!base || base.found === false) {
        return res.json({
          found: false
        });
      }

      // ✅ 3. OPTIONAL AI ENRICHMENT
      const ai = await enrichBookTextWithAI(base);

      return res.json({
        ...base,
        found: true,
        source: base.source || 'external',

        description_de: ai.description_de || base.description_de || '',
        meta_title_en: ai.meta_title_en || `${base.title_en} by ${base.author} – Buy Now`,
        meta_title_de: ai.meta_title_de || `${base.title_en} von ${base.author} – Jetzt kaufen`,
        meta_description_en: ai.meta_description_en || (base.description_en || '').slice(0, 155),
        meta_description_de: ai.meta_description_de || (base.description_de || base.description_en || '').slice(0, 155),

        tags: [
          ...new Set([
            ...(base.tags ? String(base.tags).split(',').map(x => x.trim()).filter(Boolean) : []),
            ...((ai.tags_ai || []).map(x => String(x).trim()).filter(Boolean))
          ])
        ].join(', ')
      });

    } catch (err) {
      console.error('Enrich ISBN failed:', err);
      return res.status(500).json({
        error: 'Failed to enrich ISBN',
        details: err.message
      });
    }
  });

  return router;
};
