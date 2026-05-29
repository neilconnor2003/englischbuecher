
// backend/services/bookMetadataService.js
const axios = require('axios');

//const forceHttps = (u = '') => String(u).replace(/^http=\d+/g, 'zoom=0'),
const forceHttps = (u = '') => String(u).replace(/^http:\/\//i, 'https://');


const parseOpenLibraryBook = async (payloadByIsbn, isbn) => {
  const b = payloadByIsbn?.[`ISBN:${isbn}`];
  if (!b) return null;

  let description = '';
  if (typeof b.description === 'string') description = b.description;
  else if (b.description?.value) description = b.description.value;

  return {
    source: 'openlibrary',
    title: normalizeText(b.title),
    subtitle: '',
    authors: Array.isArray(b.authors) ? b.authors.map(a => a.name).filter(Boolean) : [],
    publisher: Array.isArray(b.publishers) ? normalizeText(b.publishers[0]?.name || b.publishers[0]) : '',
    publishedDate: normalizeText(b.publish_date),
    description: normalizeText(description),
    pageCount: Number.isFinite(b.number_of_pages) ? b.number_of_pages : null,
    categories: Array.isArray(b.subjects) ? b.subjects.map(s => s.name).filter(Boolean) : [],
    language: 'EN',
    cover: forceHttps(b.cover?.large || b.cover?.medium || b.cover?.small || ''),
    isbn13: isbn.length === 13 ? isbn : '',
    isbn10: isbn.length === 10 ? isbn : '',
  };
};

const parseIsbnDbBook = (payload, isbn) => {
  const b = payload?.book;
  if (!b) return null;

  return {
    source: 'isbndb',
    title: normalizeText(b.title),
    subtitle: normalizeText(b.title_long?.replace(b.title, '').trim()),
    authors: Array.isArray(b.authors) ? b.authors : [],
    publisher: normalizeText(b.publisher),
    publishedDate: normalizeText(b.date_published),
    description: normalizeText(b.synopsis),
    pageCount: Number.isFinite(b.pages) ? b.pages : null,
    categories: Array.isArray(b.subjects) ? b.subjects : [],
    language: normalizeText(b.language).toUpperCase() || 'EN',
    cover: forceHttps(b.image || ''),
    isbn13: normalizeText(b.isbn13 || (isbn.length === 13 ? isbn : '')),
    isbn10: normalizeText(b.isbn || (isbn.length === 10 ? isbn : '')),
    binding: normalizeText(b.binding),
  };
};

const pickFirst = (...vals) => vals.find(v => {
  if (Array.isArray(v)) return v.length > 0;
  return v !== null && v !== undefined && String(v).trim() !== '';
}) ?? '';

const pickLongestText = (...vals) => {
  const filtered = vals.filter(v => typeof v === 'string' && v.trim());
  if (!filtered.length) return '';
  return filtered.sort((a, b) => b.length - a.length)[0];
};

const uniqueStrings = (arr = []) =>
  [...new Set(arr.map(v => String(v).trim()).filter(Boolean))];

async function fetchGoogle(isbn) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=DE`;
  const { data } = await axios.get(url, { timeout: 10000 });
  return parseGoogleBook(data, isbn);
}

async function fetchOpenLibrary(isbn) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const { data } = await axios.get(url, { timeout: 10000 });
  return parseOpenLibraryBook(data, isbn);
}

async function fetchIsbnDb(isbn) {
  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey) return null;

  const url = `https://api2.isbndb.com/book/${isbn}`;
  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: { Authorization: apiKey }
  });

  return parseIsbnDbBook(data, isbn);
}

function inferFormat(title = '', binding = '') {
  const t = `${title} ${binding}`.toLowerCase();
  if (t.includes('hardcover')) return 'Hardcover';
  if (t.includes('audiobook')) return 'Audiobook';
  if (t.includes('ebook') || t.includes('e-book')) return 'eBook';
  return 'Paperback';
}

function buildSlug(str = '') {
  return String(str)
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function guessAgeGroup({ categories = [], description = '' }) {
  const text = `${categories.join(' ')} ${description}`.toLowerCase();
  if (/\b(young adult|ya|teen|adolescent)\b/.test(text)) return '13–17 (Young Adult)';
  if (/\b(middle[-\s]?grade|juvenile fiction|tweens?|preteens?)\b/.test(text)) return '9–12 (Middle Grade)';
  if (/\b(children|kids|picture book|early reader)\b/.test(text)) return '6–8 (Children)';
  if (/\b(toddler|preschool|board book)\b/.test(text)) return '0–5 (Early Childhood)';
  if (/\b(adult|literary fiction|nonfiction)\b/.test(text)) return '18+ (Adult)';
  return '';
}

async function enrichBookByIsbn(isbn) {
  const normalized = cleanIsbn(isbn);
  if (![10, 13].includes(normalized.length)) {
    throw new Error('Invalid ISBN');
  }

  const [google, openlibrary, isbndb] = await Promise.allSettled([
    fetchGoogle(normalized),
    fetchOpenLibrary(normalized),
    fetchIsbnDb(normalized),
  ]);

  const g = google.status === 'fulfilled' ? google.value : null;
  const o = openlibrary.status === 'fulfilled' ? openlibrary.value : null;
  const i = isbndb.status === 'fulfilled' ? isbndb.value : null;

  const sources = [i, g, o].filter(Boolean);
  if (!sources.length) {
    return {
      found: false,
      isbn: normalized,
      sources: [],
    };
  }

  const title = pickFirst(i?.title, g?.title, o?.title, '');
  const subtitle = pickFirst(i?.subtitle, g?.subtitle, o?.subtitle, '');
  const fullTitle = subtitle ? `${title}: ${subtitle}` : title;

  const authorsArray = uniqueStrings([
    ...(i?.authors || []),
    ...(g?.authors || []),
    ...(o?.authors || []),
  ]);

  const authorsText = authorsArray.join(', ');
  const publisher = pickFirst(i?.publisher, g?.publisher, o?.publisher, '');
  const publishedDate = pickFirst(i?.publishedDate, g?.publishedDate, o?.publishedDate, '');
  const description = pickLongestText(i?.description, g?.description, o?.description);
  const pageCount = pickFirst(i?.pageCount, g?.pageCount, o?.pageCount, null);
  const categories = uniqueStrings([
    ...(i?.categories || []),
    ...(g?.categories || []),
    ...(o?.categories || []),
  ]);
  const language = pickFirst(i?.language, g?.language, o?.language, 'EN');
  const cover = pickFirst(i?.cover, g?.cover, o?.cover, '');
  const isbn13 = pickFirst(i?.isbn13, g?.isbn13, o?.isbn13, normalized.length === 13 ? normalized : '');
  const isbn10 = pickFirst(i?.isbn10, g?.isbn10, o?.isbn10, normalized.length === 10 ? normalized : '');
  const binding = pickFirst(i?.binding, '');
  const format = inferFormat(fullTitle, binding);
  const slug = buildSlug(fullTitle);
  const readingAge = guessAgeGroup({ categories, description });

  return {
    found: true,
    isbn: isbn13 || isbn10 || normalized,
    isbn10: isbn10 || '',
    isbn13: isbn13 || '',
    title_en: fullTitle || '',
    title_de: fullTitle || '',
    author: authorsText || '',
    authors: authorsArray,
    publisher: publisher || '',
    publish_date: publishedDate || '',
    description_en: description || '',
    description_de: description || '',
    pages: pageCount || null,
    language: language || 'EN',
    binding: binding || format,
    format,
    slug,
    tags: categories.join(', '),
    categoryHints: categories,
    reading_age: readingAge || '',
    image: cover || '',
    images: cover ? [cover] : [],
    sourceSummary: {
      google: !!g,
      openlibrary: !!o,
      isbndb: !!i,
    },
    rawSources: {
      google: g,
      openlibrary: o,
      isbndb: i,
    }
  };
}

module.exports = {
  enrichBookByIsbn,
};

const cleanIsbn = (isbn = '') => String(isbn).replace(/\D/g, '');

const normalizeText = (v) => {
  if (v == null) return '';
  return String(v).trim();
};

const parseGoogleBook = (payload, isbn) => {
  const item = payload?.items?.[0];
  const v = item?.volumeInfo || {};
  if (!item) return null;

  const isbn13 =
    v.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier || (isbn.length === 13 ? isbn : '');
  const isbn10 =
    v.industryIdentifiers?.find(i => i.type === 'ISBN_10')?.identifier || (isbn.length === 10 ? isbn : '');

  const cover =
    v.imageLinks?.extraLarge ||
    v.imageLinks?.large ||
    v.imageLinks?.medium ||
    v.imageLinks?.thumbnail ||
    v.imageLinks?.smallThumbnail ||
    '';

  return {
    source: 'google',
    title: normalizeText(v.title),
    subtitle: normalizeText(v.subtitle),
    authors: Array.isArray(v.authors) ? v.authors : [],
    publisher: normalizeText(v.publisher),
    publishedDate: normalizeText(v.publishedDate),
    description: normalizeText(v.description).replace(/<[^>]*>/g, '').trim(),
    pageCount: Number.isFinite(v.pageCount) ? v.pageCount : null,
    categories: Array.isArray(v.categories) ? v.categories : [],
    language: normalizeText(v.language).toUpperCase() || 'EN',
    isbn13,
    isbn10,
  };
};