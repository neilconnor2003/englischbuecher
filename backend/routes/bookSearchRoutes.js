
const express = require('express');
const axios = require('axios');

const router = express.Router();

// very small in-memory cache (optional, simple)
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

router.get('/suggest', async (req, res) => {
    const q = String(req.query.q || '').trim();

    if (q.length < 3) {
        return res.json([]);
    }

    const cacheKey = q.toLowerCase();
    const now = Date.now();

    const cached = cache.get(cacheKey);
    if (cached && (now - cached.ts < CACHE_TTL_MS)) {
        return res.json(cached.data);
    }

    try {
        // Open Library Search API
        const url = 'https://openlibrary.org/search.json';

        const { data } = await axios.get(url, {
            params: {
                q,
                fields: [
                    'title',
                    'author_name',
                    'first_publish_year',
                    'publisher',
                    'isbn',
                    'cover_i'
                ].join(','),
                limit: 12,
                lang: 'en'
            },
            headers: {
                // Open Library docs recommend identifying your application
                'User-Agent': 'EnglischBuecher/1.0 (admin@englischbuecher.de)'
            },
            timeout: 8000
        });


        const suggestions = Array.isArray(data?.docs)
            ? data.docs.map((doc, idx) => {
                if (!doc || !doc.title) return null;

                const isbns = Array.isArray(doc.isbn) ? doc.isbn : [];

                const isbn13 = isbns.find(x => /^\d{13}$/.test(x)) || null;
                const isbn10 = isbns.find(x => /^[0-9X]{10}$/i.test(x)) || null;

                const author =
                    Array.isArray(doc.author_name) && doc.author_name.length > 0
                        ? doc.author_name[0]
                        : '';

                const publisher =
                    Array.isArray(doc.publisher) && doc.publisher.length > 0
                        ? doc.publisher[0]
                        : '';

                return {
                    id: `${doc.title}-${idx}`,
                    title: doc.title || '',
                    author,
                    publisher,
                    year: doc.first_publish_year || null,
                    isbn13,
                    isbn10,
                    cover: doc.cover_i
                        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
                        : null
                };
            }).filter(Boolean)
            : [];


        cache.set(cacheKey, { ts: now, data: suggestions });
        res.json(suggestions);

    } catch (err) {
        console.error('BOOK SUGGEST ERROR:', err.message);
        res.status(500).json({ error: 'suggest_failed' });
    }
});

module.exports = router;
