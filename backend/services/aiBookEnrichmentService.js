
// backend/services/aiBookEnrichmentService.js
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function enrichBookTextWithAI(book) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      description_de: book.description_de || book.description_en || '',
      meta_title_en: `${book.title_en} by ${book.author} – Buy Now`,
      meta_title_de: `${book.title_en} von ${book.author} – Jetzt kaufen`,
      meta_description_en: (book.description_en || '').slice(0, 155),
      meta_description_de: (book.description_de || book.description_en || '').slice(0, 155),
      tags_ai: [],
    };
  }

  const prompt = `
You are enriching metadata for an ecommerce bookstore in Germany.
Return ONLY valid JSON.

Input:
Title: ${book.title_en}
Author: ${book.author}
Publisher: ${book.publisher}
Language: ${book.language}
Description EN: ${book.description_en}
Tags: ${book.tags}
Reading Age: ${book.reading_age}

Return JSON with:
{
  "description_de": "...",
  "meta_title_en": "...",
  "meta_title_de": "...",
  "meta_description_en": "...",
  "meta_description_de": "...",
  "tags_ai": ["...", "...", "..."]
}

Rules:
- Do not invent ISBN, publisher, page count, edition, or publication facts.
- If data is missing, keep wording generic.
- Keep meta descriptions under 160 chars.
`;

  const response = await client.responses.create({
    model: 'gpt-4.1-mini',
    input: prompt,
  });

  const text = response.output_text || '{}';

  try {
    return JSON.parse(text);
  } catch {
    return {
      description_de: book.description_en || '',
      meta_title_en: `${book.title_en} by ${book.author} – Buy Now`,
      meta_title_de: `${book.title_en} von ${book.author} – Jetzt kaufen`,
      meta_description_en: (book.description_en || '').slice(0, 155),
      meta_description_de: (book.description_en || '').slice(0, 155),
      tags_ai: [],
    };
  }
}

module.exports = { enrichBookTextWithAI };
