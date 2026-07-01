// frontend/src/pages/BookDetails/BookDetails.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import {
  ShoppingCart, ArrowLeft, Check, Share2,
  Calendar, BookOpen, Hash, Globe, Building,
  Weight, Ruler, Award, Layers, Book, MapPin
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
import { Heart } from 'lucide-react';
import { toast } from 'react-toastify';
import { generateBookUrl } from '../../utils/seoUrl';
import BookReviews from '../../components/Book/BookReviews';
import BooksSlider from '../../components/BooksSlider/BooksSlider';
import { setDeliveryContext, getDeliveryContext } from '../../utils/deliveryContext';
import DPDEstimator from '../../components/Shipping/DPDEstimator';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import ShippoEstimator from '../../components/Shipping/ShippoEstimator';

// Serve resized WebP images via /api/image endpoint (sharp on backend)
const optimisedImg = (url, width = 500) => {
  if (!url) return '/book-placeholder.png';
  if (!url.startsWith('/uploads/')) return url;
  return `${config.API_URL}/api/image?src=${encodeURIComponent(url)}&w=${width}&q=85`;
};

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
  const [quantity, setQuantity] = useState(1);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySubscribed, setNotifySubscribed] = useState(false);
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [shippingMode, setShippingMode] = useState('delivery');
  const initialCtx = getDeliveryContext() || {};

  const [mainImage, setMainImage] = useState('');
  const [recommendations, setRecommendations] = useState({ sameAuthor: [], alsoBought: [], similar: [], series: [] });
  const [authorRecs, setAuthorRecs] = useState([]);
  const [recLoading, setRecLoading] = useState(true);
  const [reviewStats, setReviewStats] = useState({ total: 0, average: 0 });

  const [editions, setEditions] = useState([]);
  const [formatsMap, setFormatsMap] = useState({});
  const [selectedFormat, setSelectedFormat] = useState('');

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
    const style = { width: size, height: size, background: bg };
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

  const formatPrice = (value, i18n) => {
    const locale = i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency: 'EUR',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  };

  const formatRating = (value, i18n) => {
    const locale = i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    }).format(Number(value) || 0);
  };

  const [author, setAuthor] = useState(null);

  const toSlug = (s = '') =>
    String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  useEffect(() => {
    setDeliveryContext({ shippingMode });
  }, [shippingMode]);

  useEffect(() => {
    const controller = new AbortController();
    const resolveBook = async () => {
      if (idFromUrl) { setBookId(idFromUrl); setLoading(false); return; }
      if (isbn) {
        try {
          const { data } = await axios.get(`${config.API_URL}/api/books/by-isbn/${isbn}`, { signal: controller.signal });
          setBookId(data.id); setLoading(false); return;
        } catch { }
      }
      if (slug && slug !== 'undefined') {
        if (/^\d+$/.test(slug)) { setBookId(slug); setLoading(false); return; }
        const cleanSlug = String(slug).replace(/-\d{10,13}(-\d+)?$/, '').replace(/^-+|-+$/g, '');
        try {
          const { data } = await axios.get(`${config.API_URL}/api/books/by-slug/${cleanSlug}`, { signal: controller.signal });
          setBookId(data.id); setLoading(false); return;
        } catch { }
      }
      setLoading(false);
    };
    resolveBook();
    return () => controller.abort();
  }, [isbn, slug, idFromUrl]);

  useEffect(() => { setMainImage(''); setQuantity(1); }, [bookId]);

  useEffect(() => {
    if (!bookId) return;
    axios.post(`${config.API_URL}/api/books/${bookId}/view`, {}, { withCredentials: true }).catch(() => { });
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;
    const controller = new AbortController();

    axios.get(`${config.API_URL}/api/books/${bookId}`, { withCredentials: true, signal: controller.signal })
      .then(res => {
        if (controller.signal.aborted) return;
        setBook(res.data);
        setMainImage(res.data.image || '');
        setLoading(false);
      })
      .catch(() => { if (!controller.signal.aborted) { setBook(null); setLoading(false); } });

    axios.get(`${config.API_URL}/api/books/${bookId}/recommendations`, { signal: controller.signal })
      .then(res => { if (!controller.signal.aborted) setRecommendations(res.data); })
      .catch(() => { if (!controller.signal.aborted) setRecommendations({ sameAuthor: [], alsoBought: [], similar: [], series: [] }); })
      .finally(() => { if (!controller.signal.aborted) setRecLoading(false); });

    return () => controller.abort();
  }, [bookId, navigate, location.pathname]);

  useEffect(() => {
    if (!bookId) return;
    const controller = new AbortController();
    axios.get(`${config.API_URL}/api/books/${bookId}/reviews/stats`, { signal: controller.signal })
      .then(res => setReviewStats(res.data))
      .catch(() => setReviewStats({ total: 0, average: 0 }));
    return () => controller.abort();
  }, [bookId]);

  // Check whether the current user/guest is already on the restock
  // notify list for this book, once we know it's out of stock.
  useEffect(() => {
    if (!book?.id || book.stock > 0) return;
    let cancelled = false;
    const params = user ? {} : (notifyEmail ? { email: notifyEmail } : null);
    if (!user && !notifyEmail) return; // guest hasn't typed an email yet, nothing to check
    axios.get(`${config.API_URL}/api/books/${book.id}/notify-me/status`, { params, withCredentials: true })
      .then(res => { if (!cancelled) setNotifySubscribed(!!res.data?.subscribed); })
      .catch(() => { if (!cancelled) setNotifySubscribed(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, book?.stock, user]);

  // Recently viewed: logged-in users pull from the server; guests pull
  // from localStorage and resolve those IDs into full book objects.
  useEffect(() => {
    if (!book?.id) return;

    if (user) {
      axios.get(`${config.API_URL}/api/users/me/recently-viewed?limit=8`, { withCredentials: true })
        .then(res => setRecentlyViewed((res.data || []).filter(b => b.id !== book.id)))
        .catch(() => setRecentlyViewed([]));
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem('engb_recently_viewed') || '[]');
        const ids = stored.filter(id => id !== book.id).slice(0, 8);
        if (ids.length) {
          axios.post(`${config.API_URL}/api/books/by-ids`, { ids })
            .then(res => setRecentlyViewed(res.data || []))
            .catch(() => setRecentlyViewed([]));
        } else {
          setRecentlyViewed([]);
        }
      } catch {
        setRecentlyViewed([]);
      }
    }

    // Record this view in localStorage for guests (logged-in users are
    // recorded server-side by the existing /view tracking call).
    if (!user) {
      try {
        const stored = JSON.parse(localStorage.getItem('engb_recently_viewed') || '[]');
        const next = [book.id, ...stored.filter(id => id !== book.id)].slice(0, 20);
        localStorage.setItem('engb_recently_viewed', JSON.stringify(next));
      } catch { /* localStorage unavailable, skip silently */ }
    }
  }, [book?.id, user]);

  useEffect(() => {
    if (!book || !book.id) return;
    let cancelled = false;
    axios.get(`${config.API_URL}/api/books/${book.id}/editions`)
      .then(res => { if (!cancelled) setEditions(res.data || []); })
      .catch(() => { if (!cancelled) setEditions([]); });
    return () => { cancelled = true; };
  }, [book?.id]);

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
    if (book.format && map[book.format]) setSelectedFormat(book.format);
    else setSelectedFormat(Object.keys(map)[0] || '');
  }, [book, editions]);

  useEffect(() => {
    if (!book?.authors || book.authors.length === 0) { setAuthor(null); return; }
    setAuthor(book.authors);
  }, [book]);

  useEffect(() => {
    if (!book?.authors?.length) { setAuthorRecs([]); return; }
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        book.authors.map(async (a) => {
          try {
            const { data } = await axios.get(`${config.API_URL}/api/authors/${a.id}/books?limit=12&exclude=${book.id}`);
            return { author: a, books: Array.isArray(data) ? data : [] };
          } catch { return { author: a, books: [] }; }
        })
      );
      if (!cancelled) setAuthorRecs(results);
    })();
    return () => { cancelled = true; };
  }, [book]);

  const editionsForSelected = (formatsMap[selectedFormat] || []).filter(b => b.id !== book?.id);
  const isCurrentFormatSelected = (book?.format || '') === selectedFormat;

  const isInCart = useSelector(
    state => state.cart?.items?.some(item => item.bookId === book?.id) ?? false
  );

  const handleCartAction = async (goToCheckout = false) => {
    if (!book || adding || book.stock === 0) return;
    setAdding(true);
    try {
      if (!isInCart) {
        await axios.post(`${config.API_URL}/api/cart/add`, { bookId: book.id, quantity }, { withCredentials: true });
        const res = await axios.get(`${config.API_URL}/api/cart`, { withCredentials: true });
        dispatch(replaceWithServerCart({ items: res.data.items || [] }));
      }
      if (goToCheckout) {
        setDeliveryContext({ shippingMode, forceQuote: true });
        setTimeout(() => navigate('/checkout'), 500);
      }
    } catch (err) {
      if (err.response?.status === 401) toast.warning(t('please_login'));
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
      if (!user) return toast.warning(t('login_required'));
      try {
        const result = await dispatch(toggleWishlist(book.id)).unwrap();
        dispatch(fetchWishlist());
        toast.success(result.added ? t('added_to_wishlist') : t('removed_from_wishlist'));
      } catch { toast.error(t('wishlist_error')); }
    };
    return (
      <button onClick={handleWishlist} className="wishlist-btn">
        {isWishlisted
          ? <Heart size={18} fill="#e91e63" color="#e91e63" />
          : <Heart size={18} />}
        {isWishlisted ? t('in_wishlist') : t('add_to_wishlist')}
      </button>
    );
  };

  const handleNotifySubmit = async () => {
    if (!book) return;
    const email = user ? user.email : notifyEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.warning(isDE ? 'Bitte gültige E-Mail eingeben' : 'Please enter a valid email');
      return;
    }
    setNotifySubmitting(true);
    try {
      await axios.post(
        `${config.API_URL}/api/books/${book.id}/notify-me`,
        user ? {} : { email },
        { withCredentials: true }
      );
      setNotifySubscribed(true);
      toast.success(isDE ? 'Wir benachrichtigen dich!' : "We'll let you know!");
    } catch (err) {
      toast.error(err.response?.data?.error || (isDE ? 'Fehler beim Anmelden' : 'Something went wrong'));
    } finally {
      setNotifySubmitting(false);
    }
  };

  const handleShare = async () => {
    const shareData = { title, text: `Check out "${title}" by ${book.author}`, url: window.location.href };
    try {
      if (navigator.share && navigator.canShare(shareData)) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(window.location.href); toast.success(t('link_copied')); }
    } catch { toast.success(t('link_copied')); }
  };

  const renderBooksSlider = (books, swiperClassName) => (
    <Swiper
      modules={[Navigation, Pagination]}
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

  const isOutOfStock = book.stock === 0;

  return (
    <>
      <Helmet>
        <title>{isDE ? (book.meta_title_de || title) : (book.meta_title_en || title)} | EnglischBuecher</title>
        <meta
          name="description"
          content={isDE ? (book.meta_description_de || description.substring(0, 155)) : (book.meta_description_en || description.substring(0, 155))}
        />
        <link rel="canonical" href={`${window.location.origin}${generateBookUrl(book)}`} />
        {/* hreflang — tells Google this page serves both DE and EN users */}
        <link rel="alternate" hreflang="de" href={`https://englischbuecher.de${generateBookUrl(book)}`} />
        <link rel="alternate" hreflang="en" href={`https://englischbuecher.de${generateBookUrl(book)}`} />
        <link rel="alternate" hreflang="x-default" href={`https://englischbuecher.de${generateBookUrl(book)}`} />

        {/* ── Open Graph (Facebook, WhatsApp, LinkedIn) ── */}
        <meta property="og:type" content="product" />
        <meta property="og:title" content={isDE ? (book.meta_title_de || title) : (book.meta_title_en || title)} />
        <meta
          property="og:description"
          content={isDE ? (book.meta_description_de || description.substring(0, 200)) : (book.meta_description_en || description.substring(0, 200))}
        />
        <meta property="og:image" content={book.image || `${window.location.origin}/book-placeholder.png`} />
        <meta property="og:url" content={`${window.location.origin}${generateBookUrl(book)}`} />
        <meta property="og:site_name" content="EnglischBuecher" />
        <meta property="product:price:amount" content={String(book.price ?? '')} />
        <meta property="product:price:currency" content="EUR" />
        <meta property="product:availability" content={book.stock > 0 ? 'in stock' : 'out of stock'} />

        {/* ── Twitter Card ── */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={isDE ? (book.meta_title_de || title) : (book.meta_title_en || title)} />
        <meta
          name="twitter:description"
          content={isDE ? (book.meta_description_de || description.substring(0, 200)) : (book.meta_description_en || description.substring(0, 200))}
        />
        <meta name="twitter:image" content={book.image || `${window.location.origin}/book-placeholder.png`} />

        {/* ── Product structured data (JSON-LD) ──
             Enables Google rich results: star rating, price, stock badge
             directly in search results. https://schema.org/Product */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: title,
            image: book.image ? [book.image] : undefined,
            description: (description || '').substring(0, 5000) || undefined,
            sku: book.isbn13 || book.isbn10 || String(book.id),
            ...(book.isbn13 ? { gtin13: book.isbn13 } : {}),
            ...(book.isbn10 ? { gtin10: book.isbn10 } : {}),
            brand: book.publisher ? { '@type': 'Brand', name: book.publisher } : undefined,
            author: book.authors?.length
              ? book.authors.map(a => ({ '@type': 'Person', name: a.name }))
              : (book.author ? { '@type': 'Person', name: book.author } : undefined),
            offers: {
              '@type': 'Offer',
              url: `${window.location.origin}${generateBookUrl(book)}`,
              priceCurrency: 'EUR',
              price: book.price,
              availability: book.stock > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              itemCondition: 'https://schema.org/NewCondition',
            },
            ...(reviewStats.total > 0 ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: Number(reviewStats.average || 0).toFixed(1),
                reviewCount: reviewStats.total,
              },
            } : {}),
          })}
        </script>
      </Helmet>

      <div className="book-details-page">
        <div className="container">
          <button onClick={() => navigate(-1)} className="back-btn">
            <ArrowLeft size={18} /> {t('back')}
          </button>

          <div className="book-grid">
            <div className="image-section">
              <div className="main-image-wrapper">
                <img src={optimisedImg(mainImage, 500)} alt={title} className="main-image" />
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

            <div className="info-section">
              <h1 className="title">{title}</h1>

              {isDE && book.title_en && book.title_en !== book.title_de && (
                <p className="original-title">Original title: {book.title_en}</p>
              )}

              <p className="author">
                by{" "}
                {book.authors?.map((a, index) => (
                  <span key={a.id}>
                    <span className="author-name cursor-pointer" onClick={() => navigate(`/author/${a.slug}`)}>
                      {a.name}
                    </span>
                    {index < book.authors.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>

              {typeof book.views === 'number' && book.views >= 20 && (
                <div className="views-badge">
                  <span className="views-badge-icon">👁</span>
                  {isDE
                    ? `${book.views.toLocaleString('de-DE')} Leser haben dieses Buch angesehen`
                    : `${book.views.toLocaleString('en-US')} readers have viewed this book`}
                </div>
              )}

              <div className="ratings-summary-amazon mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="bd-star-rating">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} style={{ color: s <= Math.round(reviewStats.average || 0) ? '#f59e0b' : '#d1d5db', fontSize: 18 }}>★</span>
                    ))}
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatRating(reviewStats.average, i18n)}
                  </span>
                  <span className="text-gray-600">
                    {t('review_count', { count: reviewStats.total || 0 })}
                  </span>
                  {reviewStats.total > 0 && (
                    <button
                      type="button"
                      onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                      style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}
                    >
                      {t('reviews.read_all') || 'See all reviews'}
                    </button>
                  )}
                </div>
                {reviewStats.total === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-purple-600 hover:text-purple-800 underline font-medium bg-transparent border-none cursor-pointer p-0 text-sm"
                    >
                      {t('reviews.be_the_first') || 'Be the first to review this book'}
                    </button>
                  </p>
                )}
              </div>

              <div className="buy-box">
                <div className="price-row">
                  <span className="price">{formatPrice(book.price, i18n)}</span>
                  {book.original_price && Number(book.original_price) > Number(book.price) && (
                    <div className="savings-row">
                      <span className="list-price">
                        {t('book_details.list_price')}: {formatPrice(book.original_price, i18n)}
                      </span>
                      <span className="save-badge">
                        {t('book_details.save')} {formatPrice(Number(book.original_price) - Number(book.price), i18n)}
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

                {isOutOfStock && (
                  <div className="notify-me-box">
                    {notifySubscribed ? (
                      <div className="notify-me-confirmed">
                        <Check size={16} />
                        {isDE ? 'Wir benachrichtigen dich, sobald es verfügbar ist.' : "We'll email you as soon as it's back."}
                      </div>
                    ) : (
                      <>
                        <p className="notify-me-label">
                          {isDE ? 'Ausverkauft? Wir sagen dir Bescheid:' : 'Out of stock? We\u2019ll let you know:'}
                        </p>
                        <div className="notify-me-row">
                          {!user && (
                            <input
                              type="email"
                              className="notify-me-input"
                              placeholder={isDE ? 'Deine E-Mail' : 'Your email'}
                              value={notifyEmail}
                              onChange={(e) => setNotifyEmail(e.target.value)}
                            />
                          )}
                          <button
                            type="button"
                            className="notify-me-btn"
                            onClick={handleNotifySubmit}
                            disabled={notifySubmitting}
                          >
                            {notifySubmitting
                              ? (isDE ? 'Wird gesendet…' : 'Submitting…')
                              : (isDE ? 'Benachrichtigen' : 'Notify me')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="shipping-choice">
                  <div className="ship-radio selected">
                    <span>{t('delivery_ship_to_postcode') || 'Delivery (DPD)'}</span>
                  </div>
                </div>

                {shippingMode === 'delivery' ? (
                  <div style={{ marginTop: 12 }}>
                    <DPDEstimator weightGrams={Number(book.weight_grams) || 500} />
                  </div>
                ) : (
                  <div className="pickup-card" role="region" aria-label="Click & Collect">
                    <div className="pickup-row">
                      <MapPin size={18} />
                      <div className="pickup-meta">
                        <div className="pickup-title">{t('pickup_title') || 'Click & Collect — Free'}</div>
                        <div className="pickup-addr">
                          {t('pickup_hint') || 'Pickup in Bingen. Exact address and time window will be shared after purchase.'}
                        </div>
                      </div>
                    </div>
                    <div className="pickup-free">{t('free') || '0,00 €'}</div>
                  </div>
                )}

                {!isOutOfStock && (
                  <div className="qty-selector-row">
                    <span className="qty-selector-label">{t('quantity') || (isDE ? 'Menge' : 'Quantity')}</span>
                    <div className="qty-stepper">
                      <button
                        type="button"
                        className="qty-stepper-btn"
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="qty-stepper-value">{quantity}</span>
                      <button
                        type="button"
                        className="qty-stepper-btn"
                        onClick={() => setQuantity(q => Math.min(book.stock, q + 1))}
                        disabled={quantity >= book.stock}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                <div className="buy-buttons">
                  {user ? (
                    <>
                      <button
                        onClick={() => handleCartAction(true)}
                        disabled={adding || isOutOfStock}
                        className={`buy-now-btn ${adding ? 'adding' : ''} ${isOutOfStock ? 'disabled' : ''}`}
                      >
                        {isOutOfStock ? t('out_of_stock') : adding ? t('processing') : t('buy_now')}
                      </button>
                      <button
                        onClick={() => handleCartAction(false)}
                        disabled={adding || isOutOfStock || isInCart}
                        className={`add-to-cart secondary ${isInCart ? 'already-in-cart' : ''} ${isOutOfStock ? 'disabled' : ''}`}
                      >
                        {isOutOfStock ? t('out_of_stock') : isInCart ? t('book_details.already_in_cart') : adding ? t('book_details.adding') : t('add_to_cart')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCartAction(true)}
                        disabled={adding || isOutOfStock}
                        className={`buy-now-btn ${isOutOfStock ? 'disabled' : ''}`}
                      >
                        {isOutOfStock ? t('out_of_stock') : adding ? t('processing') : t('buy_now')}
                      </button>
                      <button
                        onClick={() => handleCartAction(false)}
                        disabled={adding || isOutOfStock || isInCart}
                        className={`add-to-cart ${isInCart ? 'already-in-cart' : ''} ${isOutOfStock ? 'disabled' : ''}`}
                      >
                        {isOutOfStock ? t('out_of_stock') : isInCart ? t('book_details.already_in_cart') : adding ? t('book_details.adding') : t('add_to_cart')}
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

              {book.work_id && (
                <div className="formats-block">
                  <h3 className="formats-title">{t('book_details.formats_and_editions')}</h3>
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

                  {isCurrentFormatSelected && (
                    <div className="edition-chip current">
                      <img src={book.image || '/book-placeholder.png'} alt={title} />
                      <div className="chip-meta">
                        <div className="chip-title">
                          {book.format || 'Format'}{book.edition ? ` · ${book.edition}` : ''}
                        </div>
                        <div className="chip-price">{formatPrice(book.price, i18n)}</div>
                        <div className="chip-stock">{book.stock > 0 ? 'In Stock' : 'Out of stock'}</div>
                      </div>
                      <div className="chip-action selected">Selected</div>
                    </div>
                  )}

                  <div className="edition-list">
                    {editionsForSelected.length === 0 && (
                      <div className="edition-empty">{t('book_details.no_other_editions')}</div>
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
                          <div className="chip-price">{formatPrice(ed.price, i18n)}</div>
                          <div className="chip-stock">{ed.stock > 0 ? 'In Stock' : 'Out of stock'}</div>
                        </div>
                        <div className="chip-action">View</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="details-table">
                <div className="row"><Award size={18} /> <span>Reading Age</span><span>{book.reading_age || '—'}</span></div>
                <div className="row"><BookOpen size={18} /> <span>{t('book_details.pages')}</span><span>{book.pages || '—'}</span></div>
                <div className="row"><Hash size={18} /> <span>ISBN-10</span><span>{book.isbn10 || '—'}</span></div>
                <div className="row"><Hash size={18} /> <span>ISBN-13</span><span>{book.isbn13 || '—'}</span></div>
                <div className="row"><Globe size={18} /> <span>{t('book_details.language')}</span><span>{'English'}</span></div>
                <div className="row"><Building size={18} /> <span>{t('book_details.publisher')}</span><span>{book.publisher || '—'}</span></div>
                <div className="row"><Calendar size={18} /> <span>{t('book_details.published')}</span><span>{formatDate(book.publish_date)}</span></div>
                <div className="row"><Weight size={18} /> <span>Weight</span><span>{book.weight_grams ? `${book.weight_grams} g` : '—'}</span></div>
                <div className="row"><Ruler size={18} /> <span>Dimensions</span><span>{book.dimensions || '—'}</span></div>
                <div className="row"><Book size={18} /> <span>Format</span><span>{book.format || 'Paperback'}</span></div>
                {book.edition && <div className="row"><Award size={18} /> <span>Edition</span><span>{book.edition}</span></div>}

                {book.series_name && (
                  <div className="row">
                    <Layers />
                    <span>Series</span>
                    <span>
                      <Link
                        to={`/series/${book.series_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`}
                        style={{ color: '#9333ea', fontWeight: '600' }}
                        state={{ currentBookId: book.id, currentSeriesVolume: book.series_volume, fromBookTitle: title }}
                        className="series-link"
                      >
                        {book.series_name}
                      </Link>{" "}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="description-section">
              <h2>{t('about_this_book')}</h2>
              {description ? (
                <div className="description-content" dangerouslySetInnerHTML={{ __html: description }} />
              ) : (
                <p>{t('no_description')}</p>
              )}
            </div>
          </div>

          <div className="recommendations-container">
            {recLoading ? (
              <div className="rec-loading">{t('loading_recommendations') || 'Loading...'}</div>
            ) : (
              <>
                {authorRecs.map(({ author: a, books }) => {
                  const filteredBooks = books.filter(b => b.id !== book.id);
                  if (filteredBooks.length === 0) return null;
                  return (
                    <section className="recommendations-section" key={a.id}>
                      <div className="container">
                        <h2>{t('more_from_author', { author: a.name })}</h2>
                        <BooksSlider title="" books={filteredBooks} className="home-swiper" />
                      </div>
                    </section>
                  );
                })}

                {recommendations.alsoBought.length > 0 && (
                  <section className="recommendations-section">
                    <div className="container">
                      <h2>{t('customers_also_bought')}</h2>
                      <BooksSlider title="" books={recommendations.alsoBought} className="home-swiper" />
                    </div>
                  </section>
                )}
                {recommendations.similar.length > 0 && (
                  <section className="recommendations-section">
                    <div className="container">
                      <h2>{t('similar_books')}</h2>
                      <BooksSlider title="" books={recommendations.similar} className="home-swiper" />
                    </div>
                  </section>
                )}
                {book?.series_name && recommendations.series?.length > 0 && (
                  <section className="recommendations-section">
                    <div className="container">
                      <h2>{t('more_in_series', { series: book.series_name })}</h2>
                      <BooksSlider title="" books={recommendations.series.filter(b => b.id !== book.id)} className="home-swiper" />
                    </div>
                  </section>
                )}
              </>
            )}

            {book && (
              <div id="reviews-section" className="book-reviews mt-8 bg-gradient-to-b from-purple-50/50 to-transparent">
                <BookReviews bookId={book.id} />
              </div>
            )}
          </div>

          {author && Array.isArray(author) && author.length > 0 && (
            <div className="author-bio-section">
              <h3 className="author-bio-title">{t('book_details.about_author')}</h3>
              {author.map((a) => (
                <div key={a.id} className="author-bio-content">
                  <div className="author-bio-avatar">
                    <InitialsAvatar name={a.name} size={90} className="w-full h-full" />
                    {a.photo && (
                      <img
                        src={a.photo}
                        alt={a.name}
                        className="author-bio-photo-img"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>
                  <div className="author-bio-text">
                    <p><strong>{a.name}</strong></p>
                    <p className="text-gray-500">
                      {isDE ? (a.bio_de || a.bio || t('book_details.no_author_bio')) : (a.bio || a.bio_de || t('book_details.no_author_bio'))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentlyViewed.length > 0 && (
            <section className="recently-viewed-section">
              <h2>{isDE ? 'Zuletzt angesehen' : 'Recently viewed'}</h2>
              <BooksSlider title="" books={recentlyViewed} className="home-swiper" />
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default BookDetails;
