// frontend/src/utils/seoUrl.js   ← create this file

export const generateBookUrl = (book) => {
  if (!book) return '/';

  // Clean title → slug
  const title = (book.title_en || book.title_de || 'book').trim();
  /*const slug = title
    .toLowerCase()
    .normalize('NFD')                   // handle accents: é → e
    .replace(/[\u0300-\u036f]/g, '')    // remove diacritics
    .replace(/[^a-z0-9]+/g, '-')        // replace spaces & special chars with -
    .replace(/^-+|-+$/g, '')            // trim dashes
    .substring(0, 100);                 // max length
  */
  const slug = book.slug;
  // ISBN priority: isbn13 → isbn10 → nothing
  const isbn = book.isbn13 || book.isbn10 || '';

  // Always keep ID at the end → guarantees uniqueness + works if slug changes
  const idPart = book.id ? `-${book.id}` : '';

  return `/book/${slug}${isbn ? '-' + isbn : ''}${idPart}`;
};