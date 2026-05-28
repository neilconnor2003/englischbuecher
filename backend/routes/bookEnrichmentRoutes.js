
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


        // ✅ CHECK EXCEL DATABASE
        const [excelRows] = await db.execute(
            `SELECT * FROM excel_books WHERE isbn13 = ?`,
            [enriched.isbn13]
        );

        if (excelRows.length > 0) {
            const excel = excelRows[0];

            console.log('✅ Excel match found for ISBN:', enriched.isbn13);

            enriched.title_en = excel.title_en || enriched.title_en;
            enriched.title_de = excel.title_de || enriched.title_de;
            enriched.author = excel.author || enriched.author;

            enriched.isbn = excel.isbn || enriched.isbn;
            enriched.isbn10 = excel.isbn10 || enriched.isbn10;

            enriched.price = excel.price || enriched.price;
            enriched.original_price = excel.original_price || null;

            enriched.category_id = excel.category_id || null;

            enriched.description_en = excel.description_en || enriched.description_en;
            enriched.description_de = excel.description_de || enriched.description_de;

            enriched.publisher = excel.publisher || enriched.publisher;
            enriched.pages = excel.pages || enriched.pages;

            enriched.weight_grams = excel.weight_grams || enriched.weight_grams;
            enriched.dimensions = excel.dimensions || enriched.dimensions;

            enriched.format = excel.format || enriched.format;
            enriched.language = excel.language || enriched.language;
            enriched.binding = excel.binding || enriched.binding;
            enriched.edition = excel.edition || enriched.edition;

            enriched.series_name = excel.series_name || enriched.series_name;
            enriched.reading_age = excel.reading_age || enriched.reading_age;
        }


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
