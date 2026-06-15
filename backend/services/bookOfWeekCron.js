// backend/services/bookOfWeekCron.js
// ─────────────────────────────────────────────────────────
// Runs every Monday at 6:00 AM (server time).
// Uses Claude to pick the most culturally relevant book
// from your stock, then sets is_book_of_week = 1 on it.
//
// SETUP:
//   npm install node-cron @anthropic-ai/sdk
//
// USAGE in server.js — add ONE line at the bottom:
//   require('./services/bookOfWeekCron');
// ─────────────────────────────────────────────────────────

const cron = require('node-cron');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db'); // adjust path to your db connection

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY, // add this to your .env
});

// ── Core function (also exported so you can trigger it manually) ──
async function pickBookOfWeek() {
    console.log('[BookOfWeek] Starting weekly pick…');

    try {
        // 1. Fetch a pool of candidates: books with stock, with images,
        //    ordered by a mix of popularity and recency. Cap at 60 so
        //    the Claude prompt stays small.
        const [candidates] = await db.query(`
      SELECT b.id, b.title_en, b.title_de, b.author_id,
             a.name AS author_name,
             b.publish_date, b.price, b.original_price,
             b.description_en
      FROM books b
      LEFT JOIN authors a ON b.author_id = a.id
      WHERE b.stock > 0
        AND b.image IS NOT NULL
        AND b.image != ''
      ORDER BY b.publish_date DESC, b.id DESC
      LIMIT 60
    `);

        if (!candidates.length) {
            console.log('[BookOfWeek] No candidates found, skipping.');
            return;
        }

        // 2. Build a compact list for the prompt
        const bookList = candidates
            .map((b, i) =>
                `${i + 1}. ID=${b.id} | "${b.title_en || b.title_de}" by ${b.author_name || 'Unknown'} | Published: ${b.publish_date?.toISOString?.()?.slice(0, 10) || 'Unknown'}`
            )
            .join('\n');

        // 3. Ask Claude to pick the most relevant book this week
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 100,
            messages: [{
                role: 'user',
                content: `You are a book curator for an English-language bookstore in Germany.

From the list below, pick the ONE book that is most likely to be culturally relevant, trending, or noteworthy THIS WEEK globally — considering literary awards, author prominence, seasonal themes, or general public interest.

Respond with ONLY the book ID number. No explanation. Just the number.

Books:
${bookList}`,
            }],
        });

        const responseText = message.content[0]?.text?.trim() || '';
        // Extract just the number from the response (Claude might say "ID=42" or just "42")
        const idMatch = responseText.match(/\d+/);
        if (!idMatch) {
            console.error('[BookOfWeek] Claude returned unexpected response:', responseText);
            return;
        }

        const pickedId = parseInt(idMatch[0], 10);

        // Validate that the ID is actually in our candidates list
        const isValid = candidates.some(b => b.id === pickedId);
        if (!isValid) {
            console.error(`[BookOfWeek] Claude returned ID ${pickedId} which is not in candidate list`);
            return;
        }

        // 4. Clear previous pick and set new one
        await db.query('UPDATE books SET is_book_of_week = 0 WHERE is_book_of_week = 1');
        await db.query('UPDATE books SET is_book_of_week = 1 WHERE id = ?', [pickedId]);

        const picked = candidates.find(b => b.id === pickedId);
        console.log(`[BookOfWeek] ✅ Picked: "${picked.title_en || picked.title_de}" (ID: ${pickedId})`);

    } catch (err) {
        console.error('[BookOfWeek] Error during weekly pick:', err.message);
        // Don't crash — this is a background job
    }
}

// ── Schedule: every Monday at 06:00 AM ───────────────────
// Cron format: second(opt) minute hour day month weekday
// '0 6 * * 1' = minute=0, hour=6, any day, any month, Monday(1)
cron.schedule('0 6 * * 1', () => {
    pickBookOfWeek();
}, {
    timezone: 'Europe/Berlin', // matches your German audience
});

console.log('[BookOfWeek] Cron scheduled — runs every Monday at 06:00 Berlin time');

// ── Also run immediately on startup if nothing is set ────
// This handles first-time setup so you don't have to wait for Monday
async function runIfNoneSet() {
    try {
        const [[row]] = await db.query('SELECT COUNT(*) as cnt FROM books WHERE is_book_of_week = 1');
        if (row.cnt === 0) {
            console.log('[BookOfWeek] No book of week set — running initial pick now…');
            await pickBookOfWeek();
        } else {
            console.log(`[BookOfWeek] Book of week already set (${row.cnt} book), skipping startup pick`);
        }
    } catch (err) {
        console.error('[BookOfWeek] Startup check failed:', err.message);
    }
}

runIfNoneSet();

module.exports = { pickBookOfWeek }; // export so admin can trigger manually