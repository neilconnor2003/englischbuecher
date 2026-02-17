
// frontend/src/pages/BookDetails/BookDetails.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  ShoppingCart, ArrowLeft, Check, Share2,
  Calendar, BookOpen, Hash, Globe, Building,
  Weight, Ruler, Award, Layers, Book
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import config from '../../config';
import './BookDetails.css';
import { useDispatch, useSelector } from 'react-redux';
import { mergeServerCart } from '../../features/cart/cartSlice';
import { replaceWithServerCart } from '../../features/cart/cartSlice';
import { toggleWishlist, fetchWishlist } from '../../features/wishlist/wishlistSlice';
import { AuthContext } from '../../context/AuthContext';
import BookCard from '../../components/Book/BookCard';
import { HeartFilled, HeartOutlined } from '@ant-design/icons';
import { message, Button, Rate } from 'antd';
import { generateBookUrl } from '../../utils/seoUrl';
import BookReviews from '../../components/Book/BookReviews';

// Swiper imports (same as Home.jsx)
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination /*, Autoplay*/ } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
//import ShippingEstimator from '../../components/Shipping/ShippingEstimator';
import ShippoEstimator from '../../components/Shipping/ShippoEstimator';

function BookDetails() {
  const { isbn, slug, id: idFromUrl } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isDE = i18n.resolvedLanguage === 'de';
  const { user } = useContext(AuthContext);
  const dispatch = useDispatch();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookId, setBookId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [mainImage, setMainImage] = useState('');
  const [recommendations, setRecommendations] = useState({ sameAuthor: [], alsoBought: [], similar: [] });
  const [recLoading, setRecLoading] = useState(true);
  const [reviewStats, setReviewStats] = useState({ total: 0, average: 0 });

  // Editions (siblings) + format grouping
  const [editions, setEditions] = useState([]);
  const [formatsMap, setFormatsMap] = useState({});
  const [selectedFormat, setSelectedFormat] = useState('');


  // --- Initials Avatar helpers (BookDetails only) ---
  const colorFromString = (s = '') => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 70% 45%)`;
  };

  const initialsFromName = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const InitialsAvatar = ({ name, size = 90, className = '' }) => {
    const initials = initialsFromName(name);
    const bg = colorFromString(name);
    const style = {
      width: size,
      height: size,
      background: bg,
    };
    return (
      <div
        className={`initials-avatar flex items-center justify-center text-white font-bold rounded-[12px] ${className}`}
        style={style}
        aria-label={name}
        title={name}
      >
        <span style={{ fontSize: Math.max(12, Math.floor(size * 0.36)) }}>
          {initials}
        </span>
      </div>
    );
  };


  const toSlug = (s = '') =>
    String(s)
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  // --- Resolve the canonical book ID from id/isbn/slug ---
  useEffect(() => {
    const controller = new AbortController();
    const resolveBook = async () => {
      if (idFromUrl) {
        setBookId(idFromUrl);
        setLoading(false);
        return;
      }
      if (isbn) {
        try {
          const { data } = await axios.get(`${config.API_URL}/api/books/by-isbn/${isbn}`, { signal: controller.signal });
          setBookId(data.id);
          setLoading(false);
          return;
        } catch {
          /* fall through */
        }
      }
      if (slug && slug !== 'undefined') {
        if (/^\d+$/.test(slug)) {
          setBookId(slug);
          setLoading(false);
          return;
        }
        const cleanSlug = String(slug)
          .replace(/-\d{10,13}(-\d+)?$/, '')
          .replace(/^-+|-+$/g, '');
        try {
          const { data } = await axios.get(`${config.API_URL}/api/books/by-slug/${cleanSlug}`, { signal: controller.signal });
          setBookId(data.id);
          setLoading(false);
          return;
        } catch {
          /* fall through */
        }
      }
      setLoading(false);
    };
    resolveBook();
    return () => controller.abort();
  }, [isbn, slug, idFromUrl]);

  // --- When bookId changes, reset image & cancel old fetches ---
  useEffect(() => {
    setMainImage('');
  }, [bookId]);

  // --- Load book + recommendations for the resolved bookId ---
  useEffect(() => {
    if (!bookId) return;
    const controller = new AbortController();

    axios
      .get(`${config.API_URL}/api/books/${bookId}`, { withCredentials: true, signal: controller.signal })
      .then(res => {
        if (controller.signal.aborted) return;
        setBook(res.data);
        setMainImage(res.data.image || '');
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setBook(null);
          setLoading(false);
        }
      });

    axios
      .get(`${config.API_URL}/api/books/${bookId}/recommendations`, { signal: controller.signal })
      .then(res => {
        if (controller.signal.aborted) return;
        setRecommendations(res.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRecommendations({ sameAuthor: [], alsoBought: [], similar: [] });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRecLoading(false);
        }
      });

    return () => controller.abort();
  }, [bookId, navigate, location.pathname]);

  // --- Review stats ---
  useEffect(() => {
    if (!bookId) return;
    const controller = new AbortController();
    axios
      .get(`${config.API_URL}/api/books/${bookId}/reviews/stats`, { signal: controller.signal })
      .then(res => setReviewStats(res.data))
      .catch(() => setReviewStats({ total: 0, average: 0 }));
    return () => controller.abort();
  }, [bookId]);

  // --- Load sibling editions
  useEffect(() => {
    if (!book || !book.id) return;
    let cancelled = false;
    axios
      .get(`${config.API_URL}/api/books/${book.id}/editions`)
      .then(res => { if (!cancelled) setEditions(res.data || []); })
      .catch(() => { if (!cancelled) setEditions([]); });
    return () => { cancelled = true; };
  }, [book?.id]);

  // --- Build formats map + default selected format
  useEffect(() => {
    if (!book) return;
    const all = [book, ...editions];
    const map = all.reduce((acc, b) => {
      const fmt = (b.format || 'Other').trim();
      if (!acc[fmt]) acc[fmt] = [];
      acc[fmt].push(b);
      return acc;
    }, {});
    setFormatsMap(map);

    // Default the selected format to the current book's format (fallback: first key)
    if (book.format && map[book.format]) {
      setSelectedFormat(book.format);
    } else {
      const first = Object.keys(map)[0] || '';
      setSelectedFormat(first);
    }
  }, [book, editions]);

  // Filter editions for selected format, exclude current book
  const editionsForSelected = (formatsMap[selectedFormat] || []).filter(b => b.id !== book?.id);
  const isCurrentFormatSelected = (book?.format || '') === selectedFormat;

  // --- Cart helpers
  const isInCart = useSelector(
    state => state.cart?.items?.some(item => item.bookId === book?.id) ?? false
  );

  const handleCartAction = async (goToCheckout = false) => {
    if (!book || adding || book.stock === 0) return;
    setAdding(true);
    try {
      if (!isInCart) {
        await axios.post(`${config.API_URL}/api/cart/add`, { bookId: book.id }, { withCredentials: true });
        const res = await axios.get(`${config.API_URL}/api/cart`, { withCredentials: true });
        //dispatch(mergeServerCart({ items: res.data.items || [] }));
        dispatch(replaceWithServerCart({ items: res.data.items || [] }));
      }
      if (goToCheckout) setTimeout(() => navigate('/checkout'), 500);
    } catch (err) {
      if (err.response?.status === 401) message.warning(t('please_login'));
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="loading-spinner">Loading...</div>;
  if (!book) return <div className="not-found">Book not found</div>;

  const title = isDE ? (book.title_de || book.title_en) : book.title_en;
  const description = isDE ? (book.description_de || book.description_en || '') : (book.description_en || '');

  const gallery = book.images
    ? (typeof book.images === 'string' ? JSON.parse(book.images) : book.images)
    : [];
  if (mainImage && !gallery.includes(mainImage)) gallery.unshift(mainImage);

  const formatDate = (dateStr) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString(isDE ? 'de-DE' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—';

  const WishlistButton = ({ book }) => {
    const isWishlisted = useSelector(state => state.wishlist?.items?.some(item => item.id === book.id) ?? false);
    const handleWishlist = async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!user) return message.warning(t('login_required'));
      try {
        const result = await dispatch(toggleWishlist(book.id)).unwrap();
        dispatch(fetchWishlist());
        message.success(result.added ? t('added_to_wishlist') : t('removed_from_wishlist'));
      } catch { message.error(t('wishlist_error')); }
    };
    return (
      <button onClick={handleWishlist} className="wishlist-btn">
        {isWishlisted ? <HeartFilled style={{ color: '#e91e63' }} /> : <HeartOutlined />}
        {isWishlisted ? t('in_wishlist') : t('add_to_wishlist')}
      </button>
    );
  };

  const handleShare = async () => {
    const shareData = { title, text: `Check out "${title}" by ${book.author}`, url: window.location.href };
    try {
      if (navigator.share && navigator.canShare(shareData)) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        message.success(t('link_copied'));
      }
    } catch {
      message.success(t('link_copied'));
    }
  };

  const renderBooksSlider = (books, swiperClassName) => (
    <Swiper
      modules={[Navigation, Pagination /*, Autoplay*/]}
      spaceBetween={30}
      slidesPerView={2}
      navigation={true}
      pagination={{ clickable: true }}
      loop={false}
      watchOverflow={true}
      breakpoints={{
        640: { slidesPerView: 3, spaceBetween: 20 },
        768: { slidesPerView: 4, spaceBetween: 24 },
        1024: { slidesPerView: 4.1, spaceBetween: 30 },
        1280: { slidesPerView: 4.1, spaceBetween: 30 },
      }}
      className={swiperClassName}
    >
      {books.map(b => (
        <SwiperSlide key={b.id}>
          <div className="popular-card-wrapper">
            <BookCard book={b} />
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );

  return (
    <>
      <Helmet>
        <title>{isDE ? (book.meta_title_de || title) : (book.meta_title_en || title)} | Your Bookstore</title>
        <meta
          name="description"
          content={isDE ? (book.meta_description_de || description.substring(0, 155)) : (book.meta_description_en || description.substring(0, 155))}
        />
        {/* Use the normalized absolute image from backend directly to avoid double prefixing */}
        <meta property="og:image" content={book.image || ''} />
        <link rel="canonical" href={`${window.location.origin}${generateBookUrl(book)}`} />
      </Helmet>

      <div className="book-details-page">
        <div className="container">
          <button onClick={() => navigate(-1)} className="back-btn">
            <ArrowLeft size={18} /> {t('back')}
          </button>

          <div className="book-grid">
            {/* IMAGE SECTION */}
            <div className="image-section">
              <div className="main-image-wrapper">
                <img src={mainImage || '/book-placeholder.png'} alt={title} className="main-image" />
                {book.stock === 0 && <div className="sold-out-badge">Sold Out</div>}
              </div>
              {gallery.length > 1 && (
                <div className="thumbnails">
                  {gallery.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt=""
                      className={`thumb ${mainImage === img ? 'active' : ''}`}
                      onClick={() => setMainImage(img)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* INFO SECTION */}
            <div className="info-section">
              <h1 className="title">{title}</h1>

              {isDE && book.title_en && book.title_en !== book.title_de && (
                <p className="original-title">Original title: {book.title_en}</p>
              )}


              <p className="author">
                by{' '}
                <span
                  className="author-name cursor-pointer"
                  onClick={() => navigate(`/author/${toSlug(book.author_name || book.author || '')}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/author/${toSlug(book.author_name || book.author || '')}`)}
                >
                  {book.author_name || book.author}
                </span>
              </p>


              {/* Ratings summary */}
              <div className="ratings-summary-amazon mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <Rate disabled allowHalf value={reviewStats.average || 0} className="text-lg" />
                  <span className="text-lg font-bold text-gray-900">
                    {(reviewStats.average || 0).toFixed(1)}
                  </span>
                  <span className="text-gray-600">
                    {t('review_count', { count: reviewStats.total || 0 })}
                  </span>
                  {reviewStats.total > 0 && (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-purple-600 hover:text-purple-800 font-medium"
                    >
                      {t('reviews.read_all') || 'See all reviews'}
                    </Button>
                  )}
                </div>
                {reviewStats.total === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    {t('reviews.be_the_first') || 'Be the first to review this book'}
                  </p>
                )}
              </div>

              {/* BUY BOX */}
              <div className="buy-box">
                <div className="price-row">
                  <span className="price">€{(Number(book.price) || 0).toFixed(2)}</span>
                  {book.original_price && Number(book.original_price) > Number(book.price) && (
                    <div className="savings-row">
                      <span className="list-price">
                        {t('book_details.list_price')}: €{(Number(book.original_price)).toFixed(2)}
                      </span>
                      <span className="save-badge">
                        {t('book_details.save')} €{(Number(book.original_price) - Number(book.price)).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="stock-info">
                  {book.stock > 0 ? (
                    <>
                      <Check size={20} className="check-icon" />
                      {book.stock > 10 ? t('in_stock') : t('only_x_left', { count: book.stock })}
                    </>
                  ) : (
                    <span className="out-of-stock">{t('out_of_stock')}</span>
                  )}
                </div>


                {/* Live shipping estimate (Germany-only, Shippo: DPD/Deutsche Post) */}
                <div style={{ marginTop: 12 }}>
                  <ShippoEstimator
                    items={[{ weight_grams: book.weight_grams || 500, quantity: 1 }]}
                    t={t}
                    i18n={i18n}
                  />
                </div>

                <div className="buy-buttons">
                  {user ? (
                    <>
                      <button onClick={() => handleCartAction(true)} disabled={adding || book.stock === 0} className={`buy-now-btn ${adding ? 'adding' : ''}`}>
                        {adding ? t('processing') : t('buy_now')}
                      </button>
                      <button onClick={() => handleCartAction(false)} disabled={adding || book.stock === 0 || isInCart} className={`add-to-cart secondary ${isInCart ? 'already-in-cart' : ''}`}>
                        {isInCart ? 'Bereits im Warenkorb' : adding ? t('adding') : t('add_to_cart')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleCartAction(true)} disabled={adding || book.stock === 0} className="buy-now-btn">
                        {adding ? t('processing') : t('buy_now')}
                      </button>
                      <button onClick={() => handleCartAction(false)} disabled={adding || book.stock === 0 || isInCart} className={`add-to-cart ${isInCart ? 'already-in-cart' : ''}`}>
                        {isInCart ? 'Bereits im Warenkorb' : adding ? t('adding') : t('add_to_cart')}
                      </button>
                    </>
                  )}
                </div>

                <div className="action-buttons">
                  <WishlistButton book={book} />
                  <button onClick={handleShare} className="share-btn">
                    <Share2 size={18} /> {t('share')}
                  </button>
                </div>
              </div>

              {/* ===== Formats Tiles + Editions (filtered) ===== */}
              {book.work_id && (
                <div className="formats-block">
                  <h3 className="formats-title">Formats & Editions</h3>

                  {/* Format tiles */}
                  <div className="format-tiles">
                    {Object.keys(formatsMap).map(fmt => {
                      const count = formatsMap[fmt]?.length || 0;
                      const isActive = fmt === selectedFormat;
                      return (
                        <button
                          key={fmt}
                          className={`format-tile ${isActive ? 'active' : ''}`}
                          onClick={() => setSelectedFormat(fmt)}
                          aria-pressed={isActive}
                          type="button"
                        >
                          <span className="fmt-label">{fmt}</span>
                          <span className="fmt-count">{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Current edition if current format selected */}
                  {isCurrentFormatSelected && (
                    <div className="edition-chip current">
                      <img src={book.image || '/book-placeholder.png'} alt={title} />
                      <div className="chip-meta">
                        <div className="chip-title">
                          {book.format || 'Format'}{book.edition ? ` · ${book.edition}` : ''}
                        </div>
                        <div className="chip-price">€{Number(book.price || 0).toFixed(2)}</div>
                        <div className="chip-stock">{book.stock > 0 ? 'In Stock' : 'Out of stock'}</div>
                      </div>
                      <div className="chip-action selected">Selected</div>
                    </div>
                  )}

                  {/* Sibling editions for selected format */}
                  <div className="edition-list">
                    {editionsForSelected.length === 0 && (
                      <div className="edition-empty">No other editions in this format.</div>
                    )}

                    {editionsForSelected.map(ed => (
                      <button
                        key={ed.id}
                        className="edition-chip"
                        type="button"
                        onClick={() => navigate(`/book/${ed.id}`)}
                        title={`${ed.format || ''} ${ed.edition || ''}`.trim()}
                      >
                        <img src={ed.image || '/book-placeholder.png'} alt={ed.title_en || ed.title_de || ''} />
                        <div className="chip-meta">
                          <div className="chip-title">
                            {ed.format || 'Format'}{ed.edition ? ` · ${ed.edition}` : ''}
                          </div>
                          <div className="chip-price">€{Number(ed.price || 0).toFixed(2)}</div>
                          <div className="chip-stock">{ed.stock > 0 ? 'In Stock' : 'Out of stock'}</div>
                        </div>
                        <div className="chip-action">View</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* DETAILS TABLE */}
              <div className="details-table">
                <div className="row"><Award size={18} /> <span>Reading Age</span><span>{book.reading_age || '—'}</span></div>
                <div className="row"><BookOpen size={18} /> <span>{t('book_details.pages')}</span><span>{book.pages || '—'}</span></div>
                <div className="row"><Hash size={18} /> <span>ISBN-10</span><span>{book.isbn10 || '—'}</span></div>
                <div className="row"><Hash size={18} /> <span>ISBN-13</span><span>{book.isbn13 || '—'}</span></div>
                <div className="row"><Globe size={18} /> <span>{t('book_details.language')}</span><span>{isDE ? 'Deutsch' : 'English'}</span></div>
                <div className="row"><Building size={18} /> <span>{t('book_details.publisher')}</span><span>{book.publisher || '—'}</span></div>
                <div className="row"><Calendar size={18} /> <span>{t('book_details.published')}</span><span>{formatDate(book.publish_date)}</span></div>
                <div className="row"><Weight size={18} /> <span>Weight</span><span>{book.weight_grams ? `${book.weight_grams} g` : '—'}</span></div>
                <div className="row"><Ruler size={18} /> <span>Dimensions</span><span>{book.dimensions || '—'}</span></div>
                <div className="row"><Book size={18} /> <span>Format</span><span>{book.format || 'Paperback'}</span></div>
                {book.edition && <div className="row"><Award size={18} /> <span>Edition</span><span>{book.edition}</span></div>}
                {book.series_name && <div className="row"><Layers size={18} /> <span>Series</span><span>{book.series_name} {book.series_volume}</span></div>}
              </div>
            </div>

            {/* DESCRIPTION */}
            <div className="description-section">
              <h2>{t('about_this_book')}</h2>
              {description ? (
                <div className="description-content" dangerouslySetInnerHTML={{ __html: description }} />
              ) : (
                <p>{t('no_description')}</p>
              )}
            </div>
          </div>

          {/* RECOMMENDATIONS + REVIEWS */}
          <div className="recommendations-container">
            {recLoading ? (
              <div className="rec-loading">{t('loading_recommendations') || 'Loading...'}</div>
            ) : (
              <>
                {recommendations.sameAuthor.length > 0 && (
                  <section className="recommendations-section">
                    <div className="container">
                      <h2>{t('more_from_author', { author: book.author })}</h2>
                      {renderBooksSlider(recommendations.sameAuthor, 'recommendations-swiper')}
                    </div>
                  </section>
                )}
                {recommendations.alsoBought.length > 0 && (
                  <section className="recommendations-section">
                    <div className="container">
                      <h2>{t('customers_also_bought')}</h2>
                      {renderBooksSlider(recommendations.alsoBought, 'recommendations-swiper')}
                    </div>
                  </section>
                )}
                {recommendations.similar.length > 0 && (
                  <section className="recommendations-section">
                    <div className="container">
                      <h2>{t('similar_books')}</h2>
                      {renderBooksSlider(recommendations.similar, 'recommendations-swiper')}
                    </div>
                  </section>
                )}
              </>
            )}

            {book && (
              <div id="reviews-section" className="book-reviews mt-24 bg-gradient-to-b from-purple-50/50 to-transparent">
                <BookReviews bookId={book.id} />
              </div>
            )}
          </div>
          {/* === About the Author === */}
          {(book.author_bio || book.author_photo || book.author_name) && (
            <div className="author-bio-section">
              <h3 className="author-bio-title">About the Author</h3>
              <div className="author-bio-content">

                {/* Avatar fallback + photo overlay */}
                <div className="author-bio-avatar">
                  <InitialsAvatar name={book.author_name || book.author || 'Author'} size={90} className="w-full h-full" />
                  {book.author_photo && (
                    <img
                      src={book.author_photo}
                      alt={book.author_name || book.author || 'Author'}
                      className="author-bio-photo-img"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.style.display = 'none'; // reveals avatar below
                      }}
                      loading="lazy"
                    />
                  )}
                </div>

                <div className="author-bio-text">
                  <p><strong>{book.author_name || book.author}</strong></p>
                  {book.author_bio ? (
                    <p>{book.author_bio}</p>
                  ) : (
                    <p className="text-gray-500">No bio available.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default BookDetails;
