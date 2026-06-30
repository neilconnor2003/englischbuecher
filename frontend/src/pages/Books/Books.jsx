
// frontend/src/pages/Books/Books.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Search } from 'lucide-react';
import BookCard from '../../components/Book/BookCard';
import config from '../../config';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import './Books.css';



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

  // When arriving via ?author_id=X (e.g. from the homepage Author Spotlight),
  // resolve the ID to a display name so the dropdown can show it correctly —
  // filtering itself still happens by the reliable ID, not this name.
  const [resolvedAuthorName, setResolvedAuthorName] = useState('');

  // Which filter sections are expanded. Author/Category/Price stay open
  // by default since they're used most; the rest start collapsed to
  // keep the sidebar from feeling overwhelming at a glance.
  const [openSections, setOpenSections] = useState({
    author: true,
    category: true,
    price: true,
    publisher: false,
    format: false,
    edition: false,
    rating: false,
  });
  const toggleSection = (key) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ===== Helpers to read/write URL params =====
  const getParam = (name, def = '') => (searchParams.get(name) ?? def);
  const getArrayParam = (name) =>
    (searchParams.get(name) || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

  /*const updateParams = (updates) => {
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
  };*/

  const updateParams = (updates) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') params.delete(key);
        else params.set(key, value);
      });
      return params;
    });
    // Panel no longer auto-closes on every filter change — that punished
    // mid-adjustment interactions (slider drags, sequential picks).
    // The user closes it explicitly via the Filters toggle button instead.
  };


  // ===== Derived values from URL (single source of truth) =====
  const q = getParam('q', '').trim();
  const author = getParam('author', '');
  const authorId = getParam('author_id', ''); // precise ID, used when arriving from Author Spotlight
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
  const [tempPrice, setTempPrice] = useState([minPrice, maxPrice]);

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


  useEffect(() => {
    setTempPrice([minPrice, maxPrice]);
  }, [minPrice, maxPrice]);


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

  // ===== Resolve author_id -> display name (when arriving via the
  // homepage Author Spotlight link). Used only to show the right name
  // in the dropdown — actual filtering happens by ID, not this name. =====
  useEffect(() => {
    if (!authorId) {
      setResolvedAuthorName('');
      return;
    }
    let cancelled = false;
    axios
      .get(`${config.API_URL}/api/authors/${authorId}`)
      .then(res => {
        if (!cancelled && res.data?.name) setResolvedAuthorName(res.data.name);
      })
      .catch(() => {
        if (!cancelled) setResolvedAuthorName('');
      });
    return () => { cancelled = true; };
  }, [authorId]);

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
        //setBooks(data);
        //setTotal(data.length);

        // FRONTEND price filtering fallback
        let filtered = data;

        if (minPrice > 0 || maxPrice < 200) {
          filtered = data.filter(b => {
            const p = Number(b.price);
            return p >= minPrice && p <= maxPrice;
          });
        }

        setBooks(filtered);
        setTotal(filtered.length);

      } catch (err) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error('books load failed:', err?.message);
          message.error(t('loading_books_failed') || 'Failed to load books');
          setBooks([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
        // Scroll-to-top no longer happens automatically here — on mobile
        // it fired on every single filter tweak, yanking the user away
        // from the panel they were adjusting. Desktop never needed this
        // scroll anyway since the sidebar doesn't cover the results.
        // Mobile now scrolls only when the user taps "Show results".
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


  // -- Filters collapse on small screens --
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1024px)').matches);
  const [showFilters, setShowFilters] = useState(() => !window.matchMedia('(max-width: 1024px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const onChange = (e) => {
      setIsMobile(e.matches);
      setShowFilters(!e.matches); // open on desktop, collapse on mobile
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);


  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (q) c++;
    if (author || authorId) c++;
    if (category) c++;
    if (publisher) c++;
    if (edition) c++;
    if (formatList.length) c++;
    if (stock) c++;
    if (rating) c++;
    if (minPriceStr) c++;
    if (maxPriceStr) c++;
    return c;
  }, [q, author, authorId, category, publisher, edition, formatList, stock, rating, minPriceStr, maxPriceStr]);

  // Active filter chips — human-readable labels + a remove handler each,
  // shown as a row of pills under the sidebar header.
  const activeChips = useMemo(() => {
    const chips = [];
    if (author || authorId) {
      chips.push({
        key: 'author',
        label: `${t('filter_author')}: ${authorId ? resolvedAuthorName : author}`,
        onRemove: () => updateParams({ author: null, author_id: null }),
      });
    }
    if (category) {
      const cat = categoryOptions.find(c => c.value === category);
      chips.push({
        key: 'category',
        label: `${t('filter_category')}: ${cat?.label || category}`,
        onRemove: () => updateParams({ category: null }),
      });
    }
    if (publisher) {
      chips.push({
        key: 'publisher',
        label: `${t('filter_publisher')}: ${publisher}`,
        onRemove: () => updateParams({ publisher: null }),
      });
    }
    if (edition) {
      chips.push({
        key: 'edition',
        label: `${t('filter_edition')}: ${edition}`,
        onRemove: () => updateParams({ edition: null }),
      });
    }
    if (formatList.length) {
      formatList.forEach(f => {
        chips.push({
          key: `format-${f}`,
          label: f,
          onRemove: () => updateParams({
            format: formatList.filter(x => x !== f).join(',') || null,
          }),
        });
      });
    }
    if (stock) {
      chips.push({
        key: 'stock',
        label: t('in_stock_only'),
        onRemove: () => updateParams({ stock: null }),
      });
    }
    if (rating) {
      chips.push({
        key: 'rating',
        label: `${rating}+ ${t('stars')}`,
        onRemove: () => updateParams({ rating: null }),
      });
    }
    if (minPriceStr || maxPriceStr) {
      chips.push({
        key: 'price',
        label: `€${minPrice} – €${maxPrice}`,
        onRemove: () => {
          updateParams({ min_price: null, max_price: null });
          setTempPrice([0, 200]);
        },
      });
    }
    return chips;
  }, [author, authorId, resolvedAuthorName, category, categoryOptions, publisher, edition, formatList, stock, rating, minPriceStr, maxPriceStr, minPrice, maxPrice, t]);



  return (
    <div className="books-listing-page">
      <div className="container">
        <h1 className="page-title">
          <span className="page-title-icon">📚</span>
          {q ? `${t('search_results_for')} "${q}"` : t('all_books')}
        </h1>
        <p className="results-count">{total} {t('results')}</p>

        <div className="listing-grid">

          {/* MOBILE FILTER TOGGLE */}
          {isMobile && (
            <button
              type="button"
              className="filters-toggle"
              onClick={() => setShowFilters(v => !v)}
              aria-expanded={showFilters}
              aria-controls="filters-panel"
            >
              {t('filters')} {activeFilterCount ? `(${activeFilterCount})` : ''}
              <span className={`chevron ${showFilters ? 'open' : ''}`} aria-hidden />
            </button>
          )}

          {/* FILTERS SIDEBAR */}
          {/*<aside className="filters-sidebar">*/}
          <aside
            id="filters-panel"
            className={`filters-sidebar ${isMobile ? (showFilters ? 'open' : 'collapsed') : ''}`}
          >
            <h3>{t('filters')}</h3>

            {activeChips.length > 0 && (
              <div className="active-chips-row">
                {activeChips.map(chip => (
                  <button
                    key={chip.key}
                    type="button"
                    className="active-chip"
                    onClick={chip.onRemove}
                  >
                    {chip.label} <span className="active-chip-x">✕</span>
                  </button>
                ))}
              </div>
            )}
            {/* Author */}
            <div className="filter-group">
              <button type="button" className="filter-group-toggle" onClick={() => toggleSection('author')}>
                <h4>{t('filter_author')}</h4>
                <span className={`fg-chevron ${openSections.author ? 'open' : ''}`} />
              </button>
              {openSections.author && (
                <div className="filter-group-body">
                  <select
                    value={authorId ? (resolvedAuthorName || '') : (author || '')}
                    className="filter-native-select"
                    onChange={(e) => updateParams({ author: e.target.value || null, author_id: null })}
                  >
                    <option value="">{t('all_authors')}</option>
                    {authorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Category */}
            <div className="filter-group">
              <button type="button" className="filter-group-toggle" onClick={() => toggleSection('category')}>
                <h4>{t('filter_category')}</h4>
                <span className={`fg-chevron ${openSections.category ? 'open' : ''}`} />
              </button>
              {openSections.category && (
                <div className="filter-group-body">
                  <select
                    value={category || ''}
                    className="filter-native-select"
                    onChange={(e) => updateParams({ category: e.target.value || null })}
                  >
                    <option value="">{t('all_categories')}</option>
                    {categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Price */}
            <div className="filter-group">
              <button type="button" className="filter-group-toggle" onClick={() => toggleSection('price')}>
                <h4>{t('filter_price')}</h4>
                <span className={`fg-chevron ${openSections.price ? 'open' : ''}`} />
              </button>
              {openSections.price && (
                <div className="filter-group-body">
                  <div className="price-range-wrap">
                    <div className="price-range-inputs">
                      <input type="range" min={0} max={200} value={tempPrice[0]}
                        className="filter-range"
                        onChange={e => {
                          const v = Number(e.target.value);
                          setTempPrice([Math.min(v, tempPrice[1]), tempPrice[1]]);
                        }}
                        onMouseUp={() => updateParams({ min_price: tempPrice[0] > 0 ? String(tempPrice[0]) : null })}
                        onTouchEnd={() => updateParams({ min_price: tempPrice[0] > 0 ? String(tempPrice[0]) : null })}
                      />
                      <input type="range" min={0} max={200} value={tempPrice[1]}
                        className="filter-range"
                        onChange={e => {
                          const v = Number(e.target.value);
                          setTempPrice([tempPrice[0], Math.max(v, tempPrice[0])]);
                        }}
                        onMouseUp={() => updateParams({ max_price: tempPrice[1] < 200 ? String(tempPrice[1]) : null })}
                        onTouchEnd={() => updateParams({ max_price: tempPrice[1] < 200 ? String(tempPrice[1]) : null })}
                      />
                    </div>
                    <div className="price-values">€{tempPrice[0]} – €{tempPrice[1]}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Publisher */}
            <div className="filter-group">
              <button type="button" className="filter-group-toggle" onClick={() => toggleSection('publisher')}>
                <h4>{t('filter_publisher')}</h4>
                <span className={`fg-chevron ${openSections.publisher ? 'open' : ''}`} />
              </button>
              {openSections.publisher && (
                <div className="filter-group-body">
                  <select
                    value={publisher || ''}
                    className="filter-native-select"
                    onChange={(e) => updateParams({ publisher: e.target.value || null })}
                  >
                    <option value="">{t('all_publishers')}</option>
                    {publisherOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Format */}
            <div className="filter-group">
              <button type="button" className="filter-group-toggle" onClick={() => toggleSection('format')}>
                <h4>{t('filter_format')}</h4>
                <span className={`fg-chevron ${openSections.format ? 'open' : ''}`} />
              </button>
              {openSections.format && (
                <div className="filter-group-body">
                  <div className="format-checkbox-list">
                    {filterOptions.formats.map(f => (
                      <label key={f} className="filter-checkbox-item">
                        <input
                          type="checkbox"
                          checked={formatList.includes(f)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...formatList, f]
                              : formatList.filter(x => x !== f);
                            updateParams({ format: next.length ? next.join(',') : null });
                          }}
                          style={{ accentColor: '#7c3aed' }}
                        />
                        {f}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Edition */}
            <div className="filter-group">
              <button type="button" className="filter-group-toggle" onClick={() => toggleSection('edition')}>
                <h4>{t('filter_edition')}</h4>
                <span className={`fg-chevron ${openSections.edition ? 'open' : ''}`} />
              </button>
              {openSections.edition && (
                <div className="filter-group-body">
                  <select
                    value={edition || ''}
                    className="filter-native-select"
                    onChange={(e) => updateParams({ edition: e.target.value || null })}
                  >
                    <option value="">{t('all_editions')}</option>
                    {editionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Minimum Rating — star buttons instead of plain radios */}
            <div className="filter-group">
              <button type="button" className="filter-group-toggle" onClick={() => toggleSection('rating')}>
                <h4>{t('filter_min_rating')}</h4>
                <span className={`fg-chevron ${openSections.rating ? 'open' : ''}`} />
              </button>
              {openSections.rating && (
                <div className="filter-group-body">
                  <div className="rating-star-row">
                    {[4, 3].map(r => (
                      <button
                        key={r}
                        type="button"
                        className={`rating-star-btn ${rating === r ? 'active' : ''}`}
                        onClick={() => updateParams({ rating: rating === r ? null : String(r) })}
                      >
                        <span className="rating-star-icons">
                          {'★'.repeat(r)}{'☆'.repeat(5 - r)}
                        </span>
                        <span className="rating-star-label">{r}+ {t('stars')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* In Stock — toggle switch, own labeled row matching the
                rest of the sidebar instead of a bare unlabeled checkbox */}
            <div className="filter-group filter-group--toggle">
                <div className="stock-toggle-row">
                  <span className="stock-toggle-label">{t('in_stock_only')}</span>
                  <button
                    type="button"
                    className={`filter-toggle-btn ${stock ? 'on' : 'off'}`}
                    onClick={() => updateParams({ stock: stock ? null : '1' })}
                  >
                    <span className="filter-toggle-knob" />
                  </button>
                </div>
            </div>

            {/* Clear all */}
            <button type="button" className="clear-filters-btn" onClick={clearFilters}>
              {t('clear_all_filters')}
            </button>

            {/* Mobile-only — explicit way to close the panel once done,
                now that it no longer auto-closes on every change */}
            {isMobile && showFilters && (
              <button
                type="button"
                className="show-results-btn"
                onClick={() => {
                  setShowFilters(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {(i18n.resolvedLanguage === 'de' ? 'Ergebnisse anzeigen' : 'Show results')} ({total})
              </button>
            )}
          </aside>

          {/* MAIN LISTING */}
          <div className="listing-main">
            {/* Sort */}
            <div className="sort-bar">
              <span className="sort-bar-label">{t('sort_by')}</span>
              <select
                value={sort}
                className="filter-native-select"
                style={{ width: 220 }}
                onChange={(e) => updateParams({ sort: e.target.value || null })}
              >
                {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
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
              <div className="books-section">
                <div className="books-grid">
                  {books.map(book => (
                    <div key={book.id} className="popular-card-wrapper">
                      <BookCard book={book} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Books;
