
// frontend/src/pages/Books/Books.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Search } from 'lucide-react';
import BookCard from '../../components/Book/BookCard';
import config from '../../config';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Slider, Radio, Checkbox, message } from 'antd';
import './Books.css';

const CheckboxGroup = Checkbox.Group;

function Books() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filter options from DB (authors, publishers, formats, editions, categories)
  const [filterOptions, setFilterOptions] = useState({
    authors: [],
    publishers: [],
    formats: [],
    editions: [],
    categories: []
  });

  // ===== Helpers to read/write URL params =====
  const getParam = (name, def = '') => (searchParams.get(name) ?? def);
  const getArrayParam = (name) =>
    (searchParams.get(name) || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

  const updateParams = (updates) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return params;
    });
  };

  // ===== Derived values from URL (single source of truth) =====
  const q = getParam('q', '').trim();
  const author = getParam('author', '');
  const category = getParam('category', '');
  const publisher = getParam('publisher', '');
  const formatList = getArrayParam('format');     // array of strings
  const edition = getParam('edition', '');
  const stock = getParam('stock') === '1';
  const minPriceStr = getParam('min_price', '');
  const maxPriceStr = getParam('max_price', '');
  const ratingStr = getParam('rating', '');
  const reviewsStr = getParam('reviews', '');
  const popStr = getParam('popularity', '');
  const sort = getParam('sort', 'relevance');

  // Normalize numeric/slider values
  const minPrice = minPriceStr ? Number(minPriceStr) : 0;
  const maxPrice = maxPriceStr ? Number(maxPriceStr) : 200;   // match Slider max
  const rating = ratingStr ? Number(ratingStr) : 0;
  const reviews = reviewsStr ? Number(reviewsStr) : 0;
  const popularity = popStr ? Number(popStr) : 0;

  // Slider value (derived from URL)
  const priceRange = useMemo(() => [minPrice, maxPrice], [minPrice, maxPrice]);

  // Debounce typing in the "search within results" input so each keystroke doesn't fetch immediately
  const debounceRef = useRef(null);
  const onSearchInputChange = (e) => {
    const next = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ q: next || null }); // null removes the param
    }, 250);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchParams(new URLSearchParams()); // wipe all params
  };

  // ===== Load filter options once =====
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${config.API_URL}/api/books/filters`)
      .then(res => {
        if (cancelled) return;
        setFilterOptions(res.data || {
          authors: [],
          publishers: [],
          formats: [],
          editions: [],
          categories: []
        });
      })
      .catch(err => {
        if (!cancelled) {
          console.error('filters load failed:', err?.message);
          setFilterOptions({
            authors: [],
            publishers: [],
            formats: [],
            editions: [],
            categories: []
          });
        }
      });
    return () => { cancelled = true; };
  }, []);

  // ===== Fetch books when URL params change =====

  useEffect(() => {
    const controller = new AbortController();

    const loadBooks = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams(searchParams); // use directly
        const res = await axios.get(`/api/books/listing?${params.toString()}`, {
          signal: controller.signal
        });
        const data = Array.isArray(res.data) ? res.data : [];
        setBooks(data);
        setTotal(data.length);
      } catch (err) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error('books load failed:', err?.message);
          message.error(t('loading_books_failed') || 'Failed to load books');
          setBooks([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    loadBooks();
    return () => controller.abort();
  }, [searchParams, t]);

  // ===== Select options (AntD v5-friendly) =====
  const authorOptions = useMemo(
    () => filterOptions.authors.map(a => ({ label: a, value: a })),
    [filterOptions.authors]
  );

  const publisherOptions = useMemo(
    () => filterOptions.publishers.map(p => ({ label: p, value: p })),
    [filterOptions.publishers]
  );

  const editionOptions = useMemo(
    () => filterOptions.editions.map(e => ({ label: e, value: e })),
    [filterOptions.editions]
  );

  const categoryOptions = useMemo(
    () => filterOptions.categories.map(cat => ({
      label: i18n.resolvedLanguage === 'de' ? (cat.name_de || cat.name_en) : cat.name_en,
      value: String(cat.id)
    })),
    [filterOptions.categories, i18n.resolvedLanguage]
  );

  const sortOptions = [
    { value: 'relevance', label: t('relevance') },
    { value: 'title_asc', label: t('title_a_z') },
    { value: 'title_desc', label: t('title_z_a') },
    { value: 'price_asc', label: t('price_low_to_high') },
    { value: 'price_desc', label: t('price_high_to_low') },
    { value: 'rating_desc', label: t('highest_rated') },
    { value: 'review_count_desc', label: t('most_reviews') },
    { value: 'popularity_score_desc', label: t('most_popular') },
  ];

  return (
    <div className="books-listing-page">
      <div className="container">
        <h1 className="page-title">
          {q ? `${t('search_results_for')} "${q}"` : t('all_books')}
          <span className="results-count">({total} {t('results')})</span>
        </h1>

        <div className="listing-grid">
          {/* FILTERS SIDEBAR */}
          <aside className="filters-sidebar">
            <h3>{t('filters')}</h3>

            {/* Author */}
            <div className="filter-group">
              <h4>{t('filter_author')}</h4>
              <Select
                value={author || undefined}
                options={authorOptions}
                allowClear
                showSearch
                placeholder={t('all_authors')}
                style={{ width: '100%' }}
                popupMatchSelectWidth={false}
                getPopupContainer={(trigger) => trigger.parentNode}
                optionFilterProp="label"
                onChange={(val) => updateParams({ author: val || null })}
              />
            </div>

            {/* Category */}
            <div className="filter-group">
              <h4>{t('filter_category')}</h4>
              <Select
                value={category || undefined}
                options={categoryOptions}
                allowClear
                placeholder={t('all_categories')}
                style={{ width: '100%' }}
                popupMatchSelectWidth={false}
                getPopupContainer={(trigger) => trigger.parentNode}
                optionFilterProp="label"
                onChange={(val) => updateParams({ category: val || null })}
              />
            </div>

            {/* Publisher */}
            <div className="filter-group">
              <h4>{t('filter_publisher')}</h4>
              <Select
                value={publisher || undefined}
                options={publisherOptions}
                allowClear
                showSearch
                placeholder={t('all_publishers')}
                style={{ width: '100%' }}
                popupMatchSelectWidth={false}
                getPopupContainer={(trigger) => trigger.parentNode}
                optionFilterProp="label"
                onChange={(val) => updateParams({ publisher: val || null })}
              />
            </div>

            {/* Format */}
            <div className="filter-group">
              <h4>{t('filter_format')}</h4>
              <CheckboxGroup
                value={formatList}
                onChange={(list) => updateParams({ format: list.length ? list.join(',') : null })}
              >
                {filterOptions.formats.map(f => (
                  <div key={f}><Checkbox value={f}>{f}</Checkbox></div>
                ))}
              </CheckboxGroup>
            </div>

            {/* Edition */}
            <div className="filter-group">
              <h4>{t('filter_edition')}</h4>
              <Select
                value={edition || undefined}
                options={editionOptions}
                allowClear
                showSearch
                placeholder={t('all_editions')}
                style={{ width: '100%' }}
                popupMatchSelectWidth={false}
                getPopupContainer={(trigger) => trigger.parentNode}
                optionFilterProp="label"
                onChange={(val) => updateParams({ edition: val || null })}
              />
            </div>

            {/* Price */}
            <div className="filter-group">
              <h4>{t('filter_price')}</h4>
              <Slider
                range
                value={priceRange}
                max={200}
                onChange={(val) => {
                  // live preview without writing URL (to keep fetch debounce calm)
                  // reflect immediately by updating URL onAfterChange:
                }}
                onAfterChange={(val) => {
                  const [min, max] = val;
                  const updates = {};
                  updates.min_price = min > 0 ? String(min) : null;
                  updates.max_price = max < 200 ? String(max) : null;
                  updateParams(updates);
                }}
              />
              <div className="price-values">€{priceRange[0]} – €{priceRange[1]}</div>
            </div>

            {/* In Stock */}
            <div className="filter-group">
              <Checkbox
                checked={stock}
                onChange={(e) => updateParams({ stock: e.target.checked ? '1' : null })}
              >
                {t('in_stock_only')}
              </Checkbox>
            </div>

            {/* Minimum Rating */}
            <div className="filter-group">
              <h4>{t('filter_min_rating')}</h4>
              <Radio.Group
                value={rating}
                onChange={(e) => updateParams({ rating: e.target.value ? String(e.target.value) : null })}
              >
                <Radio value={0}>{t('any_rating')}</Radio>
                <Radio value={4}>4+ {t('stars')}</Radio>
                <Radio value={3}>3+ {t('stars')}</Radio>
              </Radio.Group>
            </div>

            {/* Clear all */}
            <Button type="link" danger onClick={clearFilters} block>
              {t('clear_all_filters')}
            </Button>
          </aside>

          {/* MAIN LISTING */}
          <div className="listing-main">
            {/* Sort */}
            <div className="sort-bar">
              <span>{t('sort_by')}:</span>
              <Select
                value={sort}
                options={sortOptions}
                style={{ width: 240 }}
                onChange={(val) => updateParams({ sort: val || null })}
              />
            </div>

            {/* Search within results */}
            {/*<div className="search-bar-listing">
              <Input
                placeholder={t('search_within_results')}
                value={q}
                onChange={onSearchInputChange}       // debounced URL update
                onPressEnter={(e) => updateParams({ q: e.target.value || null })}
                prefix={<Search size={18} />}
                allowClear
              />
            </div>*/}

            {/* Books */}
            {loading ? (
              <div className="loading">{t('loading_books')}</div>
            ) : books.length === 0 ? (
              <div className="no-results">{t('no_books_found')}</div>
            ) : (
              <div className="books-grid">
                {books.map(book => (
                  <div key={book.id} className="popular-card-wrapper">
                    <BookCard book={book} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Books;
