
// backend/routes/bookEnrichmentRoutes.js
const express = require('express');
const { enrichBookByIsbn } = require('../services/bookMetadataService');
const { enrichBookTextWithAI } = require('../services/aiBookEnrichmentService');
const axios = require('axios');

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

            // ✅ 1. Get Excel data
            const [excelRows] = await db.execute(
                `SELECT * FROM excel_books WHERE isbn13 = ? OR isbn10 = ? OR isbn = ? LIMIT 1`,
                [isbn, isbn, isbn]
            );

            // ✅ 2. Always fetch API data (for images!)
            const base = await enrichBookByIsbn(isbn);

            const openLibraryImage = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;


            if (!base || base.found === false) {
                console.log('⚠️ API enrichment failed, using Excel only');

                if (excelRows.length > 0) {
                    const excel = excelRows[0];

                    // ✅ attempt fallback image from Google Books
                    let fallbackImage = null;

                    try {
                        /*const googleRes = await fetch(
                            `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
                        );
                        const googleData = await googleRes.json();*/

                        const googleRes = await axios.get(
                            `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
                        );

                        const img =
                            googleRes.data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;


                        /*const img =
                            googleData?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;*/

                        if (img) {
                            fallbackImage = img.replace('http://', 'https://');
                        }
                    } catch (e) {
                        console.log('⚠️ Google fallback image failed');
                    }

                    return res.json({
                        found: true,
                        source: 'excel',

                        title_en: excel.title_en || '',
                        title_de: excel.title_de || '',
                        author: excel.author || '',

                        isbn: excel.isbn || isbn,
                        isbn13: excel.isbn13 || '',
                        isbn10: excel.isbn10 || '',

                        price: excel.price || null,
                        original_price: excel.original_price || null,
                        category_id: excel.category_id || null,

                        description_en: excel.description_en || '',
                        description_de: excel.description_de || '',

                        publisher: excel.publisher || '',
                        pages: excel.pages || null,
                        publish_date: excel.publish_date || null,

                        weight_grams: excel.weight_grams || null,
                        dimensions: excel.dimensions || '',

                        format: excel.format || 'Paperback',
                        language: excel.language || 'EN',
                        binding: excel.binding || '',
                        edition: excel.edition || '',

                        series_name: excel.series_name || '',
                        reading_age: excel.reading_age || '',

                        // ✅ IMPORTANT FIX HERE
                        //image: fallbackImage,
                        //images: fallbackImage ? [fallbackImage] : []

                        image: fallbackImage || openLibraryImage,
                        images: fallbackImage ? [fallbackImage] : [openLibraryImage]

                    });
                }

                return res.json({ found: false });
            }

            // ✅ 3. CREATE MERGED OBJECT
            let enriched = { ...base };
            console.log('BASE DATA:', base);

            // ✅ 4. APPLY Excel overrides
            if (excelRows.length > 0) {
                const excel = excelRows[0];

                //console.log('✅ Excel override for ISBN:', isbn);


                // ✅ IMPORTANT: also override ISBN fields from excel_books
                enriched.isbn = excel.isbn ? String(excel.isbn) : (enriched.isbn || isbn);
                enriched.isbn13 = excel.isbn13 ? String(excel.isbn13) : (enriched.isbn13 || '');
                enriched.isbn10 = excel.isbn10 ? String(excel.isbn10) : (enriched.isbn10 || '');


                enriched.title_en = excel.title_en || enriched.title_en;
                enriched.title_de = excel.title_de || enriched.title_de;
                enriched.author = excel.author || enriched.author;

                enriched.price = excel.price ?? enriched.price;
                enriched.original_price = excel.original_price ?? enriched.original_price;

                enriched.category_id = excel.category_id ?? enriched.category_id;

                enriched.description_en = excel.description_en || enriched.description_en;
                enriched.description_de = excel.description_de || enriched.description_de;

                enriched.publisher = excel.publisher || enriched.publisher;
                enriched.pages = excel.pages || enriched.pages;

                enriched.weight_grams = excel.weight_grams ?? enriched.weight_grams;
                enriched.dimensions = excel.dimensions || enriched.dimensions;

                enriched.format = excel.format || enriched.format;
                enriched.language = excel.language || enriched.language;
                enriched.binding = excel.binding || enriched.binding;
                enriched.edition = excel.edition || enriched.edition;

                enriched.series_name = excel.series_name || enriched.series_name;
                enriched.reading_age = excel.reading_age || enriched.reading_age;

                enriched.source = 'excel+api';
            }

            // ✅ 5. AI ENRICHMENT (after merge!)
            const ai = await enrichBookTextWithAI(enriched);

            const finalImage =
                enriched.image ||
                base.image ||
                `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;


            // ✅ 6. FINAL RETURN
            return res.json({
                ...enriched,

                // ✅ ALWAYS FORCE IMAGE
                image: finalImage,
                //images: finalImage ? [finalImage] : [],

                images:
                    enriched.images?.length > 0
                        ? enriched.images
                        : finalImage
                            ? [finalImage]
                            : [],


                found: true,

                description_de: ai.description_de || enriched.description_de || '',
                meta_title_en: ai.meta_title_en || `${enriched.title_en} by ${enriched.author} – Buy Now`,
                meta_title_de: ai.meta_title_de || `${enriched.title_en} von ${enriched.author} – Jetzt kaufen`,
                meta_description_en: ai.meta_description_en || (enriched.description_en || '').slice(0, 155),
                meta_description_de: ai.meta_description_de || (enriched.description_de || enriched.description_en || '').slice(0, 155),

                tags: [
                    ...new Set([
                        ...(enriched.tags ? String(enriched.tags).split(',').map(x => x.trim()).filter(Boolean) : []),
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
