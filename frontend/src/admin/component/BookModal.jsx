
// frontend/src/admin/component/BookModal.jsx
import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useForm } from 'react-hook-form';
import { X, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useGetCategoriesQuery } from '../features/book/bookApiSlice';
import axios from 'axios';
import config from '@config';
import {
  useGetAuthorsQuery,
  useAddAuthorMutation
} from '../features/authors/authorsApiSlice';

// -----------------------------------------------------
// Utilities
// -----------------------------------------------------

const formatDateForInput = (dateStr) => {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const slugForWork = (s = '') =>
  String(s).toLowerCase().trim()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s/g, '-');

const computeWorkId = (title_en, title_de, author) => {
  const title = (title_en || title_de || '').trim();
  const auth  = (author || '').trim();
  if (!title) return '';
  const key = `${slugForWork(title)}__${slugForWork(auth)}`;
  return key.slice(0, 64);
};

const guessAgeGroup = ({ categories = [], description = '' }) => {
  const text = `${categories.join(' ')} ${description}`.toLowerCase();
  if (/\b(young adult|ya|teen|adolescent|grades?\s*9-12|ages?\s*13(\s*[-–]\s*|\s*to\s*)17)\b/.test(text)) return '13–17 (Young Adult)';
  if (/\b(middle[-\s]?grade|juvenile fiction|tweens?|preteens?|grades?\s*4-8|ages?\s*9(\s*[-–]\s*|\s*to\s*)12)\b/.test(text)) return '9–12 (Middle Grade)';
  if (/\b(children|kids|picture book|early reader|grades?\s*k-3|ages?\s*6(\s*[-–]\s*|\s*to\s*)8)\b/.test(text)) return '6–8 (Children)';
  if (/\b(toddler|preschool|board book|ages?\s*0(\s*[-–]\s*|\s*to\s*)5)\b/.test(text)) return '0–5 (Early Childhood)';
  const ageRangeMatch = text.match(/\b(?:ages?|age range)[:\s]*([0-9]{1,2})\s*(?:[-–to]{1,3}\s*([0-9]{1,2}))?\b/);
  if (ageRangeMatch) {
    const start = parseInt(ageRangeMatch[1], 10);
    const end   = ageRangeMatch[2] ? parseInt(ageRangeMatch[2], 10) : start;
    const avg   = Math.round((start + end) / 2);
    if (avg <= 5)  return '0–5 (Early Childhood)';
    if (avg <= 8)  return '6–8 (Children)';
    if (avg <= 12) return '9–12 (Middle Grade)';
    if (avg <= 17) return '13–17 (Young Adult)';
    return '18+ (Adult)';
  }
  if (/\b(adult|literary fiction|nonfiction)\b/.test(text)) return '18+ (Adult)';
  return '';
};

// -----------------------------------------------------
// Multi-Author Picker (with inline create)
// -----------------------------------------------------
const MultiAuthorPicker = ({ values = [], onChange }) => {
  const { data: authors = [] } = useGetAuthorsQuery();
  const [addAuthor] = useAddAuthorMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newPhoto, setNewPhoto] = useState('');

  const toggleId = (id) => {
    if (!id) return;
    if (values.includes(id)) onChange(values.filter(v => v !== id));
    else onChange([...values, id]);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return alert('Author name required');
    try {
      const created = await addAuthor({ name, bio: newBio || '', photo: newPhoto || '' }).unwrap();
      onChange([...new Set([...values, created.id])]);
      setShowCreate(false);
      setNewName(''); setNewBio(''); setNewPhoto('');
    } catch (e) {
      console.error(e);
      alert('Failed to create author');
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xl font-bold text-gray-800 mb-2">
        Authors (many-to-many)
      </label>

      {/* Selected badges */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {values.map(id => {
            const a = authors.find(x => x.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm">
                {a?.name || `#${id}`}
                <button
                  type="button"
                  onClick={() => toggleId(id)}
                  className="ml-1 text-red-600 font-bold"
                  aria-label="Remove author"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* List with checkboxes */}
      <div className="max-h-56 overflow-auto border rounded-xl p-3">
        {authors.map(a => (
          <label key={a.id} className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              checked={values.includes(a.id)}
              onChange={() => toggleId(a.id)}
            />
            <span>{a.name}</span>
          </label>
        ))}
        {authors.length === 0 && (
          <div className="text-gray-500 text-sm">No authors yet.</div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowCreate(s => !s)}
        className="mt-2 text-purple-700 font-semibold"
      >
        {showCreate ? 'Cancel new author' : 'Create new author'}
      </button>

      {showCreate && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="px-4 py-3 border-2 rounded-xl"
          />
          <input
            type="text"
            placeholder="Photo URL (optional)"
            value={newPhoto}
            onChange={e => setNewPhoto(e.target.value)}
            className="px-4 py-3 border-2 rounded-xl"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold"
          >
            Save Author
          </button>
          <textarea
            placeholder="Short bio"
            value={newBio}
            onChange={e => setNewBio(e.target.value)}
            rows={4}
            className="md:col-span-3 px-4 py-3 border-2 rounded-xl"
          />
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------
// Component
// -----------------------------------------------------
const BookModal = ({ isOpen, onClose, book, onSave, fields = [], forceIsbnMode = false }) => {
  const { data = { flat: [] } } = useGetCategoriesQuery();
  const categories = Array.isArray(data.flat) ? data.flat : [];
  const { data: authorsList = [] } = useGetAuthorsQuery();

  const [isbnInput, setIsbnInput] = useState('');
  const [originalEnteredIsbn, setOriginalEnteredIsbn] = useState('');
  const [mainImage, setMainImage] = useState('');
  const [galleryImages, setGalleryImages] = useState([]);
  const [modalState, setModalState] = useState('isbn');
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [fetchedBookData, setFetchedBookData] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm();

  // Many-to-many authors
  const [authorIds, setAuthorIds] = useState([]);

  // Helper to compare arrays (order-sensitive)
  const arrEq = (a = [], b = []) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  // 1) INIT/RESET EFFECT — only depends on isOpen/book/forceIsbnMode
  useEffect(() => {
    if (!isOpen) {
      setModalState('isbn');
      setMainImage('');
      setGalleryImages([]);
      setIsbnInput('');
      setOriginalEnteredIsbn('');
      setFetchedBookData(null);
      setIsSavingCover(false);
      setAuthorIds([]);
      reset();
      return;
    }

    if (book) {
      setModalState('edit');
      setOriginalEnteredIsbn('');
      setFetchedBookData(null);

      let mainImg = book.image || '';
      let gallery = [];
      if (book.images) {
        try {
          let parsed = typeof book.images === 'string' ? JSON.parse(book.images) : book.images;
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) gallery = parsed.filter(url => typeof url === 'string' && url);
        } catch (e) {
          console.warn('Failed to parse book.images:', e);
        }
      }
      if (!mainImg && gallery.length > 0) mainImg = gallery[0];
      setMainImage(mainImg);
      setGalleryImages(gallery);

      const correctDate = formatDateForInput(book.publish_date);
      const defaultWorkId = computeWorkId(book.title_en, book.title_de, book.author);

      reset({
        title_en: book.title_en || '',
        title_de: book.title_de || '',
        author: book.author || '',
        isbn: book.isbn || '',
        isbn10: book.isbn10 || '',
        isbn13: book.isbn13 || '',
        price: book.price ? Number(book.price) : null,
        original_price: book.original_price ? Number(book.original_price) : null,
        sale_price: book.sale_price ?? null,
        stock: book.stock ? Number(book.stock) : 10,
        category_id: book.category_id ? Number(book.category_id) : '',
        slug: book.slug || '',
        publisher: book.publisher || '',
        pages: book.pages ? Number(book.pages) : null,
        publish_date: correctDate,
        description_en: book.description_en || '',
        description_de: book.description_de || '',
        meta_title_en: book.meta_title_en || '',
        meta_title_de: book.meta_title_de || '',
        meta_description_en: book.meta_description_en || '',
        meta_description_de: book.meta_description_de || '',
        weight_grams: book?.weight_grams ?? 500,
        dimensions: book?.dimensions || '',
        format: book?.format || 'Paperback',
        language: book?.language || 'EN',
        edition: book?.edition || '',
        binding: book?.binding || '',
        translator: book?.translator || '',
        series_name: book?.series_name || '',
        series_volume: book?.series_volume || '',
        reading_age: book?.reading_age || '',
        is_featured: book?.is_featured || 0,
        is_new_release: book?.is_new_release || 0,
        is_bestseller: book?.is_bestseller || 0,
        tags: book?.tags || '',
        rating: book?.rating ?? 0,
        review_count: book?.review_count ?? 0,
        popularity_score: book?.popularity_score ?? 0,
        work_id: book?.work_id || defaultWorkId,
      });
    } else {
      setModalState(forceIsbnMode ? 'isbn' : 'edit');
      setMainImage('');
      setGalleryImages([]);
      setIsbnInput('');
      setOriginalEnteredIsbn('');
      setFetchedBookData(null);
      setAuthorIds([]);
      reset({
        title_en: '',
        title_de: '',
        author: '',
        isbn: '',
        isbn10: '',
        isbn13: '',
        price: null,
        original_price: null,
        sale_price: null,
        stock: 10,
        category_id: '',
        slug: '',
        publisher: '',
        pages: null,
        publish_date: '',
        description_en: '',
        description_de: '',
        meta_title_en: '',
        meta_title_de: '',
        meta_description_en: '',
        meta_description_de: '',
        weight_grams: 500,
        dimensions: '',
        format: 'Paperback',
        language: 'EN',
        edition: '',
        binding: '',
        translator: '',
        series_name: '',
        series_volume: '',
        reading_age: '',
        is_featured: 0,
        is_new_release: 0,
        is_bestseller: 0,
        tags: '',
        rating: 0,
        review_count: 0,
        popularity_score: 0,
        work_id: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, book, forceIsbnMode]);

  // 2) PRESELECT AUTHORS — depends on isOpen/book/authorsList, guarded by equality check
  useEffect(() => {
    if (!isOpen) return;

    let nextIds = [];
    if (book && Array.isArray(book.authors) && book.authors.length) {
      nextIds = book.authors.map((a) => a.id).filter(Boolean);
    } else if (book?.author && authorsList?.length) {
      const names = String(book.author).split(',').map(s => s.trim()).filter(Boolean);
      nextIds = authorsList
        .filter(a => names.some(n => a.name?.toLowerCase() === n.toLowerCase()))
        .map(a => a.id);
    }

    setAuthorIds((prev) => (arrEq(prev, nextIds) ? prev : nextIds));
  }, [isOpen, book, authorsList]);

  // Apply fetched metadata after form is ready
  useEffect(() => {
    if (fetchedBookData && modalState === 'edit') {
      Object.entries(fetchedBookData).forEach(([key, value]) => setValue(key, value));
      setFetchedBookData(null);
    }
  }, [modalState, fetchedBookData, setValue]);

  // -----------------------------------------------------
  // Fetch by ISBN
  // -----------------------------------------------------
  const handleFetchISBN = async () => {
    if (!isbnInput || isbnInput.length < 10) return;
    const digitsOnly = isbnInput.replace(/\D/g, '');
    if (digitsOnly.length !== 10 && digitsOnly.length !== 13) {
      alert('Please enter a valid 10 or 13-digit ISBN');
      return;
    }
    const cleanIsbn = digitsOnly;
    setOriginalEnteredIsbn(cleanIsbn);
    setIsSavingCover(true);

    try {
      const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&country=DE`;
      const googleRes = await fetch(googleUrl);
      const googleData = await googleRes.json();

      if (googleData.totalItems > 0) {
        const v = googleData.items[0].volumeInfo;
        const title = v.title || 'Unknown Title';
        const subtitle = v.subtitle || '';
        const fullTitle = subtitle ? `${title}: ${subtitle}` : title;
        const authors = v.authors ? v.authors.join(', ') : 'Unknown Author';
        const descriptionEn = (v.description || 'No description available.').replace(/<[^>]*>/g, '').trim();
        const publisher = v.publisher || '';
        const publishedDate = v.publishedDate || '';
        const pageCount = v.pageCount || 350;
        const language = (v.language || 'en').toUpperCase();
        const categories = v.categories || [];
        const inferredAge = guessAgeGroup({ categories, description: descriptionEn });
        let coverUrl = v.imageLinks?.extraLarge || v.imageLinks?.large || v.imageLinks?.medium || v.imageLinks?.smallThumbnail || '/book-placeholder.png';
        if (coverUrl.includes('zoom=1')) coverUrl = coverUrl.replace('zoom=1', 'zoom=0');
        const isbn13 = v.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier || cleanIsbn;
        const isbn10 = v.industryIdentifiers?.find(i => i.type === 'ISBN_10')?.identifier || '';
        const isHardcover = fullTitle.toLowerCase().includes('hardcover');
        const baseWeight = pageCount < 300 ? 320 : pageCount < 600 ? 480 : 680;
        const weight_grams = isHardcover ? baseWeight + 280 : baseWeight;
        const dimensions = isHardcover ? '21.6 x 13.8 x 3.8 cm' : '19.8 x 12.9 x 2.6 cm';
        const slug = fullTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 100);

        let descriptionDe = descriptionEn;
        let metaTitleDe = `${fullTitle} von ${authors} – Jetzt kaufen`;
        let metaDescDe = descriptionEn.substring(0, 155) + '...';
        try {
          const translateRes = await axios.post(`${config.API_URL}/api/translate`, {
            text: [descriptionEn, `${fullTitle} by ${authors} – Buy Now`],
            target: 'de'
          });
          const [translatedDesc, translatedTitle] = translateRes.data.translated || [];
          if (translatedDesc) descriptionDe = translatedDesc;
          if (translatedTitle) {
            metaTitleDe = translatedTitle.replace('by', 'von').replace('Buy Now', 'Jetzt kaufen');
          }
          metaDescDe = (translatedDesc || descriptionEn).substring(0, 155) + '...';
        } catch {}

        let savedCoverUrl = coverUrl;
        if (coverUrl && !coverUrl.includes('placeholder')) {
          try {
            const saveRes = await axios.get(`${config.API_URL}/api/fetch-and-save-cover?url=${encodeURIComponent(coverUrl)}`);
            savedCoverUrl = saveRes.data.url;
          } catch {}
        }

        const work_id = computeWorkId(fullTitle, fullTitle, authors);

        setFetchedBookData({
          title_en: fullTitle,
          title_de: fullTitle,
          author: authors,
          publisher,
          pages: pageCount,
          publish_date: publishedDate ? formatDateForInput(publishedDate) : '',
          description_en: descriptionEn,
          description_de: descriptionDe,
          isbn: isbn13 || isbn10,
          isbn13,
          isbn10,
          price: 0.0,
          original_price: 0.0,
          stock: 0,
          weight_grams: Math.round(weight_grams),
          dimensions,
          format: isHardcover ? 'Hardcover' : 'Paperback',
          language,
          edition: 'Standard Edition',
          binding: isHardcover ? 'Hardcover' : 'Paperback',
          slug,
          meta_title_en: `${fullTitle} by ${authors} – Buy Now`,
          meta_title_de: metaTitleDe,
          meta_description_en: descriptionEn.substring(0, 155) + '...',
          meta_description_de: metaDescDe,
          rating: 0.0,
          review_count: 0,
          popularity_score: 0,
          reading_age: inferredAge || '',
          work_id,
        });

        setMainImage(savedCoverUrl);
        setGalleryImages([savedCoverUrl]);
        setModalState('edit');
        return;
      }

      throw new Error('Not found in Google Books');
    } catch (error) {
      try {
        const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
        const olRes = await fetch(olUrl);
        const olData = await olRes.json();
        const bookData = olData[`ISBN:${cleanIsbn}`];

        if (bookData) {
          const title = bookData.title || 'Unknown';
          const authors = bookData.authors?.map(a => a.name).join(', ') || 'Unknown Author';
          const pages = bookData.number_of_pages || 350;
          const publishDate = bookData.publish_date || '';
          const cover = bookData.cover?.large || bookData.cover?.medium || '/book-placeholder.png';

          let savedCover = cover;
          try {
            const res = await axios.get(`${config.API_URL}/api/fetch-and-save-cover?url=${encodeURIComponent(cover)}`);
            savedCover = res.data.url;
          } catch {}

          const subjects = (bookData.subjects || []).map(s => s.name);
          const description = typeof bookData.description === 'string' ? bookData.description : (bookData.description?.value || '');
          const inferredAge = guessAgeGroup({ categories: subjects, description });
          const work_id = computeWorkId(title, title, authors);

          setFetchedBookData({
            title_en: title,
            title_de: title,
            author: authors,
            pages,
            publish_date: publishDate ? formatDateForInput(publishDate) : '',
            description_en: description || 'Classic literature. No description available from source.',
            description_de: 'Klassische Literatur. Keine Beschreibung verfügbar.',
            weight_grams: Math.round(pages * 1.1 + 300),
            dimensions: '19.8 x 12.9 x 2.8 cm',
            format: 'Paperback',
            language: 'EN',
            rating: 0,
            review_count: 0,
            popularity_score: 0,
            reading_age: inferredAge || '',
            work_id,
          });

          setMainImage(savedCover);
          setGalleryImages([savedCover]);
          setModalState('edit');
          return;
        }
      } catch {}

      const work_id = computeWorkId('', '', '');
      alert('Book not found in any source. Filling basic data...');
      setFetchedBookData({
        isbn: cleanIsbn,
        weight_grams: 480,
        dimensions: '19.8 x 12.9 x 2.8 cm',
        format: 'Paperback',
        language: 'EN',
        rating: 0,
        review_count: 0,
        popularity_score: 0,
        reading_age: '',
        work_id,
      });
      setModalState('edit');
    } finally {
      setIsSavingCover(false);
    }
  };

  // -----------------------------------------------------
  // Image Uploads
  // -----------------------------------------------------
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await axios.post(`${config.API_URL}/api/upload-book-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newUrl = res.data.url;
      setGalleryImages(prev => [...prev, newUrl]);
      if (!mainImage) setMainImage(newUrl);
    } catch (err) {
      alert('Image upload failed. Max 5MB, JPG/PNG/WebP/GIF only.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (url) => {
    setGalleryImages(prev => {
      const next = prev.filter(img => img !== url);
      if (mainImage === url) {
        setMainImage(next[0] || '');
      }
      return next;
    });
  };

  const setAsMain = (url) => setMainImage(url);

  // -----------------------------------------------------
  // Submit
  // -----------------------------------------------------
  const onSubmit = (data) => {
    const effectiveWorkId = (data.work_id?.trim()) || computeWorkId(data.title_en, data.title_de, data.author);

    const savedBook = {
      id: book?.id,

      title_en: data.title_en?.trim() || 'Untitled',
      title_de: (data.title_de || data.title_en)?.trim() || 'Untitled',
      author: data.author?.trim() || 'Unknown Author', // legacy display
      publisher: data.publisher?.trim() || '',
      slug: data.slug?.trim()
        || data.title_en?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        || 'book',
      description_en: data.description_en?.trim() || '',
      description_de: data.description_de?.trim() || data.description_en || '',
      meta_title_en: data.meta_title_en?.trim() || data.title_en || '',
      meta_title_de: data.meta_title_de?.trim() || `${data.title_en} von ${data.author} – Jetzt kaufen`,
      meta_description_en: data.meta_description_en?.trim() || (data.description_en?.substring(0, 155) + '...') || '',
      meta_description_de: data.meta_description_de?.trim() || (data.description_en?.substring(0, 155) + '...') || '',
      dimensions: data.dimensions?.trim() || null,
      format: data.format || 'Paperback',
      language: data.language || 'EN',
      edition: data.edition?.trim() || null,
      binding: data.binding?.trim() || null,
      translator: data.translator?.trim() || null,
      series_name: data.series_name?.trim() || null,
      series_volume: data.series_volume?.trim() || null,
      reading_age: data.reading_age?.trim() || null,
      tags: data.tags?.trim() || null,

      image: mainImage || null,
      images: galleryImages.length > 0 ? galleryImages : null,

      price: parseFloat(data.price) || 0.0,
      original_price: data.original_price ? parseFloat(data.original_price) : null,
      sale_price: data.sale_price ? parseFloat(data.sale_price) : null,
      stock: parseInt(data.stock) || 10,
      pages: data.pages ? parseInt(data.pages) : null,
      weight_grams: data.weight_grams ? parseInt(data.weight_grams) : null,
      rating: parseFloat(data.rating) || 0,
      review_count: parseInt(data.review_count) || 0,
      popularity_score: parseFloat(data.popularity_score) || 0,

      category_id: parseInt(data.category_id) || null,
      isbn: data.isbn13 || data.isbn10 || originalEnteredIsbn || data.isbn || null,
      isbn10: data.isbn10?.trim() || null,
      isbn13: data.isbn13?.trim() || null,
      publish_date: data.publish_date || null,

      is_featured: data.is_featured ? 1 : 0,
      is_new_release: data.is_new_release ? 1 : 0,
      is_bestseller: data.is_bestseller ? 1 : 0,

      work_id: effectiveWorkId,

      // Many-to-many pivot payload
      _authorIds: authorIds,
    };

    onSave(savedBook);
    onClose();
  };

  // -----------------------------------------------------
  // Fields
  // -----------------------------------------------------
  const allFields = [
    { name: 'title_en', label: 'Title (EN)', type: 'text', required: true },
    { name: 'title_de', label: 'Title (DE)', type: 'text' },
    { name: 'author', label: 'Author display (legacy text)', type: 'text', required: true },
    { name: 'isbn', label: 'ISBN', type: 'text' },
    { name: 'isbn10', label: 'ISBN-10', type: 'text' },
    { name: 'isbn13', label: 'ISBN-13', type: 'text' },
    { name: 'price', label: 'Price (€)', type: 'number', step: '0.01', required: true },
    { name: 'original_price', label: 'Original Price (€)', type: 'number', step: '0.01' },
    { name: 'sale_price', label: 'Sale Price (€)', type: 'number', step: '0.01' },
    { name: 'stock', label: 'Stock', type: 'number', required: true },
    { name: 'category_id', label: 'Category', type: 'select', required: true },
    { name: 'slug', label: 'Slug', type: 'text' },
    { name: 'publisher', label: 'Publisher', type: 'text' },
    { name: 'pages', label: 'Pages', type: 'number' },
    { name: 'publish_date', label: 'Publish Date', type: 'date' },
    { name: 'description_en', label: 'Description (EN)', type: 'textarea' },
    { name: 'description_de', label: 'Description (DE)', type: 'textarea' },
    { name: 'meta_title_en', label: 'Meta Title (EN)', type: 'text' },
    { name: 'meta_title_de', label: 'Meta Title (DE)', type: 'text' },
    { name: 'meta_description_en', label: 'Meta Description (EN)', type: 'textarea' },
    { name: 'meta_description_de', label: 'Meta Description (DE)', type: 'textarea' },
    { name: 'weight_grams', label: 'Weight (grams)', type: 'number' },
    { name: 'dimensions', label: 'Dimensions (L×W×H cm)', type: 'text', placeholder: '19.8 x 12.9 x 2.8 cm' },
    {
      name: 'format', label: 'Format', type: 'select', options: [
        { value: 'Paperback', label: 'Paperback' },
        { value: 'Hardcover', label: 'Hardcover' },
        { value: 'eBook', label: 'eBook' },
        { value: 'Audiobook', label: 'Audiobook' },
      ]
    },
    { name: 'language', label: 'Language', type: 'text', placeholder: 'EN' },
    { name: 'edition', label: 'Edition', type: 'text' },
    { name: 'binding', label: 'Binding', type: 'text' },
    { name: 'translator', label: 'Translator', type: 'text' },
    { name: 'series_name', label: 'Series Name', type: 'text' },
    { name: 'series_volume', label: 'Series Volume', type: 'text' },
    { name: 'reading_age', label: 'Reading Age', type: 'text', placeholder: 'e.g., 9–12 (Middle Grade)' },
    { name: 'tags', label: 'Tags (comma separated)', type: 'text' },
    { name: 'rating', label: 'Rating', type: 'number', step: '0.1' },
    { name: 'review_count', label: 'Review Count', type: 'number' },
    { name: 'popularity_score', label: 'Popularity Score', type: 'number' },
    { name: 'is_featured', label: 'Featured', type: 'checkbox' },
    { name: 'is_new_release', label: 'New Release', type: 'checkbox' },
    { name: 'is_bestseller', label: 'Bestseller', type: 'checkbox' },
    { name: 'work_id', label: 'Work ID (editions group)', type: 'text', placeholder: 'auto-generated from Title + Author' },
  ];

  const enhancedFields = allFields.map(field => ({
    ...field,
    options: field.name === 'category_id'
      ? categories.map(cat => ({ value: cat.id.toString(), label: cat.name_en }))
      : field.options || [],
  }));

  // -----------------------------------------------------
  // Render
  // -----------------------------------------------------
  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl p-10 max-h-screen overflow-y-auto">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-4xl font-bold text-purple-800">
                    {book ? 'Edit Book' : 'Add New Book'}
                  </h3>
                  <button onClick={onClose}>
                    <X className="w-9 h-9 text-gray-500 hover:text-red-600" />
                  </button>
                </div>

                {!book && modalState === 'isbn' && (
                  <div className="text-center py-24 bg-gradient-to-b from-purple-50 to-pink-50 rounded-3xl">
                    <h4 className="text-4xl font-bold mb-12 text-purple-900">Enter ISBN to Add Book</h4>
                    <div className="max-w-2xl mx-auto">
                      <input
                        type="text"
                        value={isbnInput}
                        onChange={(e) => setIsbnInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleFetchISBN()}
                        placeholder="9780141439556"
                        className="w-full px-10 py-8 border-4 border-purple-400 rounded-3xl text-2xl text-center focus:outline-none focus:border-purple-700 shadow-lg"
                        disabled={isSavingCover}
                      />
                      <button
                        onClick={handleFetchISBN}
                        disabled={!isbnInput || isbnInput.length < 10 || isSavingCover}
                        className="mt-10 w-full py-8 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-3xl font-bold text-3xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 shadow-2xl flex items-center justify-center gap-4"
                      >
                        {isSavingCover ? (
                          <>
                            <Loader2 className="animate-spin" size={40} />
                            Fetching & Translating...
                          </>
                        ) : (
                          'FETCH BOOK NOW'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {modalState === 'edit' && (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
                    {/* IMAGES SECTION */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-10 rounded-3xl">
                      <h4 className="text-3xl font-bold mb-8 text-purple-800 flex items-center gap-3">
                        <ImageIcon size={40} />
                        Book Images (All Stored Locally)
                      </h4>
                      <div className="mb-8">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handleImageUpload}
                          disabled={isUploading}
                          className="file:mr-6 file:py-4 file:px-8 file:rounded-full file:bg-purple-600 file:text-white hover:file:bg-purple-700 text-lg disabled:opacity-50"
                        />
                        {isUploading && (
                          <p className="text-purple-700 mt-2 flex items-center gap-2">
                            <Loader2 className="animate-spin" size={20} />
                            Uploading...
                          </p>
                        )}
                        <p className="text-sm text-gray-600 mt-2">JPG, PNG, WebP, GIF • Max 5 MB</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                        {mainImage && (
                          <div className="relative group">
                            <img src={mainImage} alt="Main Cover" className="w-full h-64 object-cover rounded-2xl border-8 border-blue-500 shadow-2xl" />
                            <div className="absolute inset-0 bg-blue-600 bg-opacity-70 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                              <span className="text-white font-bold text-2xl">MAIN COVER</span>
                            </div>
                            <button type="button" onClick={() => removeImage(mainImage)} className="absolute top-4 right-4 bg-red-600 p-3 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg">
                              <Trash2 size={24} className="text-white" />
                            </button>
                          </div>
                        )}
                        {galleryImages.filter(img => img !== mainImage).map((img, i) => (
                          <div key={i} className="relative group">
                            <img src={img} alt={`Gallery ${i + 1}`} className="w-full h-64 object-cover rounded-2xl shadow-xl" />
                            <div className="absolute inset-0 bg-black bg-opacity-60 rounded-2xl opacity-0 group-hover:opacity-100 transition flex flex-col justify-center items-center gap-3">
                              <button type="button" onClick={() => setAsMain(img)} className="bg-green-600 text-white px-6 py-3 rounded-full font-bold hover:bg-green-700">Set as Main</button>
                              <button type="button" onClick={() => removeImage(img)} className="bg-red-600 text-white p-3 rounded-full hover:bg-red-700"><Trash2 size={24} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {galleryImages.length === 0 && !isSavingCover && (
                        <div className="text-center py-16 text-gray-500">
                          <ImageIcon size={64} className="mx-auto mb-4 opacity-30" />
                          <p className="text-xl">No images yet. Upload one above!</p>
                        </div>
                      )}
                    </div>

                    {/* AUTHOR TEXT + MULTI AUTHOR PICKER */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="relative">
                        <label className="block text-xl font-bold text-gray-800 mb-4">
                          Author display (legacy text) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          {...register('author', { required: 'Author is required' })}
                          className="w-full px-8 py-5 border-4 border-gray-300 rounded-2xl focus:border-purple-600 focus:outline-none text-lg"
                          placeholder="e.g., J. K. Rowling, Jack Thorne"
                        />
                        {errors['author'] && (
                          <p className="text-red-600 font-bold mt-2">{errors['author'].message}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          This is the human-readable author string kept for SEO/legacy display. The authoritative
                          relationship is managed via the multi-select on the right.
                        </p>
                      </div>

                      <div className="relative">
                        <MultiAuthorPicker values={authorIds} onChange={setAuthorIds} />
                      </div>
                    </div>

                    {/* ALL OTHER FIELDS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      {enhancedFields.map((field, index) => (
                        <div key={index} className="relative">
                          <label className="block text-xl font-bold text-gray-800 mb-4">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>

                          {field.type === 'select' ? (
                            <select
                              {...register(field.name, {
                                required: field.required ? `${field.label} is required` : false,
                              })}
                              className="w-full px-8 py-5 border-4 border-gray-300 rounded-2xl focus:border-purple-600 focus:outline-none text-lg"
                            >
                              <option value="">Select {field.label}</option>
                              {field.options.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : field.type === 'textarea' ? (
                            <textarea
                              {...register(field.name)}
                              rows={6}
                              className="w-full px-8 py-5 border-4 border-gray-300 rounded-2xl focus:outline-none focus:border-purple-600 text-lg resize-none"
                              placeholder={field.placeholder}
                            />
                          ) : field.type === 'checkbox' ? (
                            <input
                              type="checkbox"
                              {...register(field.name)}
                              className="w-6 h-6 border-2 border-gray-300 rounded-md focus:ring-purple-600"
                            />
                          ) : (
                            <input
                              type={field.type || 'text'}
                              step={
                                field.name.includes('price') || field.name === 'rating'
                                  ? '0.01'
                                  : field.name === 'weight_grams'
                                  ? '1'
                                  : undefined
                              }
                              {...register(field.name, {
                                required: field.required ? `${field.label} is required` : false,
                                valueAsNumber: [
                                  'price',
                                  'original_price',
                                  'sale_price',
                                  'stock',
                                  'pages',
                                  'weight_grams',
                                  'rating',
                                  'review_count',
                                  'popularity_score'
                                ].includes(field.name),
                              })}
                              className="w-full px-8 py-5 border-4 border-gray-300 rounded-2xl focus:outline-none focus:border-purple-600 text-lg"
                              placeholder={field.placeholder || (
                                field.name === 'publish_date' ? '2025-06-15' :
                                field.name.includes('price') ? '29.99' :
                                field.name === 'pages' ? '320' : ''
                              )}
                            />
                          )}

                          {errors[field.name] && (
                            <p className="text-red-600 font-bold mt-2">{errors[field.name].message}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-8 mt-20">
                      <button type="button" onClick={onClose} className="px-16 py-7 border-4 border-gray-400 rounded-3xl text-3xl font-bold hover:bg-gray-100 transition">
                        Cancel
                      </button>
                      <button type="submit" className="px-20 py-8 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-3xl font-bold text-4xl shadow-2xl hover:from-green-700 hover:to-emerald-700 transition">
                        {book ? 'UPDATE BOOK' : 'SAVE BOOK'}
                      </button>
                    </div>
                  </form>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default BookModal;
