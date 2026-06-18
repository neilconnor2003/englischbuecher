// frontend/src/pages/Home/Home.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Banner from '../../components/Banner/Banner';
import config from '@config';
import { Image, Sparkles } from 'lucide-react';
import { useGetCategoriesQuery } from '../../admin/features/book/bookApiSlice';
import axios from 'axios';
import BooksSlider from '../../components/BooksSlider/BooksSlider';
import './Home.css';
import { Helmet } from 'react-helmet-async';
import { generateBookUrl } from '../../utils/seoUrl';
import { AuthContext } from '../../context/AuthContext';
import BookCard from '../../components/Book/BookCard';
import { useDispatch, useSelector } from 'react-redux';
import { message } from 'antd';
import { addItem, replaceWithServerCart } from '../../features/cart/cartSlice';


// ─── useLazySection (unchanged) ──────────────────────────
function useLazySection() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '300px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
}

// ─── animateCount — pure helper, no hook ─────────────────
// Runs a count-up animation from 0 → target, calling onUpdate each frame.
// Returns a cancel function.
function animateCount(target, duration, onUpdate) {
  let raf = null;
  let start = null;
  const step = (ts) => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    onUpdate(Math.round(eased * target));
    if (progress < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => { if (raf) cancelAnimationFrame(raf); };
}

// ─── StatsBar ────────────────────────────────────────────
// FIX: We wait until the API responds before starting the animation.
// Each stat item observes itself with IntersectionObserver AND waits for
// its real value before animating, so it always counts to the right number.

function StatItem({ value, suffix, label, duration, icon }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const cancelRef = useRef(null);
  const hasAnimated = useRef(false);

  // Whenever real value arrives AND the element is visible, animate to it
  const tryAnimate = useCallback(() => {
    if (hasAnimated.current || !value) return;
    hasAnimated.current = true;
    if (cancelRef.current) cancelRef.current();
    cancelRef.current = animateCount(value, duration, setDisplay);
  }, [value, duration]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) tryAnimate(); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => { observer.disconnect(); if (cancelRef.current) cancelRef.current(); };
  }, [tryAnimate]);

  // Also trigger if value arrives after element is already visible
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) tryAnimate();
  }, [tryAnimate]);

  return (
    <div className="home-stats-item" ref={ref}>
      <div className="home-stats-icon">{icon}</div>
      <div className="home-stats-num">{display.toLocaleString()}{suffix}</div>
      <div className="home-stats-label">{label}</div>
    </div>
  );
}

function StatsBar({ de, stats }) {
  // Don't render until we have real data (avoids animating to wrong defaults)
  if (!stats) return (
    <section className="home-stats-section">
      <div className="container">
        <div className="home-stats-grid">
          {[0, 1, 2, 3].map(i => (
            <div className="home-stats-item home-stats-item--loading" key={i}>
              <div className="home-stats-num home-stats-skeleton" />
              <div className="home-stats-label home-stats-skeleton home-stats-skeleton--sm" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const items = [
    { value: stats.books,   suffix: '+',  duration: 1600, label: de ? 'Bücher auf Lager'          : 'Books in stock',    icon: '📚' },
    { value: stats.readers, suffix: '+',  duration: 2000, label: de ? 'Zufriedene Leser'           : 'Happy readers',     icon: '😊' },
    { value: stats.saving,  suffix: '%',  duration: 1200, label: de ? 'Durchschn. Ersparnis'       : 'Average savings',   icon: '💰' },
    { value: stats.reviews, suffix: 'K+', duration: 2200, label: de ? 'Bewertungen & Rezensionen'  : '5-star reviews',    icon: '⭐' },
  ];

  return (
    <section className="home-stats-section">
      <div className="container">
        <div className="home-stats-grid">
          {items.map((item, i) => (
            <StatItem key={i} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── BookOfTheWeek ───────────────────────────────────────
function BookOfTheWeek({ de }) {
  const [book, setBook] = useState(null);
  const dispatch = useDispatch();
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();

  useEffect(() => {
    axios.get('/api/books/book-of-week')
      .then(res => { if (res.data && res.data.id) setBook(res.data); })
      .catch(() => { });
  }, []);

  // Same cart-state check pattern as BookCard
  const isInCart = useSelector(
    state =>
      state.cart?.items?.some(item => {
        const currentBookId = book?.id || book?.book_id || book?.bookId || book?._id;
        return item.bookId === currentBookId;
      }) ?? false
  );

  if (!book) return null;

  const title = de ? (book.title_de || book.title_en) : (book.title_en || book.title_de);
  const author = book.author_name || book.author || '';
  const desc = de ? (book.description_de || book.description_en) : (book.description_en || book.description_de);
  const price = parseFloat(book.price || 0).toFixed(2);
  const orig = parseFloat(book.original_price || 0);
  const saving = orig > 0 ? Math.round(((orig - book.price) / orig) * 100) : 0;
  const to = generateBookUrl(book);

  // Same logic as BookCard.handleAddToCart — server cart for logged-in
  // users, local Redux cart for guests.
  const handleAddToCart = async (e) => {
    e.preventDefault();
    if (isInCart) {
      message.info(t('already_in_cart') || 'Dieses Buch ist bereits im Warenkorb');
      return;
    }

    if (user && user.id) {
      try {
        await axios.post(
          `${config.API_URL}/api/cart/add`,
          { bookId: book.id, quantity: 1 },
          { withCredentials: true }
        );
        const res = await axios.get(`${config.API_URL}/api/cart`, { withCredentials: true });
        dispatch(replaceWithServerCart({ items: res.data.items || [] }));
        message.success(`${title} ${t('added_to_cart') || 'zum Warenkorb hinzugefügt'}`);
      } catch (err) {
        if (err?.response?.status === 401) {
          message.warning(t('login_required') || 'Bitte melde dich an');
        } else {
          message.error(t('error_adding_to_cart') || 'Fehler beim Hinzufügen');
        }
      }
      return;
    }

    try {
      dispatch(addItem({
        bookId: book.id,
        quantity: 1,
        book: {
          title_en: book.title_en || title,
          title_de: book.title_de || null,
          image: book.image || 'https://via.placeholder.com/300x400?text=Book',
          slug: book.slug || book.id?.toString(),
          stock: typeof book.stock === 'number' ? book.stock : Infinity,
          price: parseFloat(book.price || 0),
          original_price: orig,
          sale_price: book.sale_price ?? null,
        },
      }));
      message.success(`${title} ${t('added_to_cart') || 'zum Warenkorb hinzugefügt'}`);
    } catch (err) {
      message.error(t('error_adding_to_cart') || 'Fehler beim Hinzufügen');
    }
  };

  return (
    <section className="botw-section">
      <div className="container">
        <div className="botw-inner">
          <div className="botw-cover-wrap">
            <div className="botw-badge-gold">{de ? '⭐ Buch der Woche' : '⭐ Book of the Week'}</div>
            <Link to={to} className="botw-cover-link">
              {book.image
                ? <img src={book.image} alt={title} className="botw-cover-img" />
                : <div className="botw-cover-placeholder" />}
            </Link>
          </div>
          <div className="botw-info">
            <div className="botw-week-label">{de ? '📖 Diese Woche empfohlen' : "📖 This week's pick"}</div>
            <h2 className="botw-title">{title}</h2>
            {author && <p className="botw-author">{author}</p>}
            <div className="botw-stars">★★★★★<span className="botw-review-count"> · {de ? 'Hoch bewertet' : 'Highly rated'}</span></div>
            {desc && <p className="botw-desc">{desc.length > 220 ? desc.slice(0, 220) + '…' : desc}</p>}
            <div className="botw-price-row">
              <span className="botw-price">€{price}</span>
              {orig > 0 && <span className="botw-was">€{orig.toFixed(2)}</span>}
              {saving > 0 && <span className="botw-save-chip">{de ? `${saving}% gespart` : `Save ${saving}%`}</span>}
            </div>
            <div className="botw-btns">
              <button type="button" onClick={handleAddToCart} className="botw-btn-primary" disabled={book.stock === 0}>
                {book.stock === 0
                  ? (de ? 'Ausverkauft' : 'Out of stock')
                  : isInCart
                    ? (de ? '✓ Im Warenkorb' : '✓ In cart')
                    : (de ? '🛒 In den Warenkorb' : '🛒 Add to cart')}
              </button>
              <Link to={to} className="botw-btn-ghost">{de ? 'Details ansehen' : 'View details'}</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── ForYouShelf ─────────────────────────────────────────
// Logged-in users with order/wishlist/view history get a real
// personalized "All" tab from /api/books/for-you. Everyone else
// (and the per-category tabs) uses the existing category mix.
function ForYouShelf({ categorySections, de, t }) {
  const [activeTab, setActiveTab] = useState(0);
  const [personalized, setPersonalized] = useState(null); // null = not checked yet

  useEffect(() => {
    axios.get('/api/books/for-you')
      .then(res => {
        if (res.data?.personalized && res.data.books?.length > 0) {
          setPersonalized(res.data.books);
        } else {
          setPersonalized(false); // checked, but nothing personalized available
        }
      })
      .catch(() => setPersonalized(false));
  }, []);

  const tabs = useMemo(() => {
    const sections = (categorySections || []).filter(s => s?.books?.length > 0);

    let allBooks;
    let allLabel;

    if (personalized && personalized.length > 0) {
      // Real personalization available
      allBooks = personalized.slice(0, 20);
      allLabel = de ? 'Für dich' : 'For you';
    } else {
      // Fallback: curated sample across categories (3 per category, shuffled)
      const pool = [];
      sections.forEach(s => {
        const top = s.books.filter(b => b.image).slice(0, 3);
        pool.push(...top);
      });
      const seen = new Set();
      allBooks = pool
        .sort(() => 0.5 - Math.random())
        .filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true; })
        .slice(0, 20);
      allLabel = de ? 'Beliebt' : 'Popular mix';
    }

    const allTab = { label: allLabel, books: allBooks };

    const categoryTabs = sections.map(s => ({
      label: de ? (s.category.name_de || s.category.name_en) : s.category.name_en,
      catId: s.category.id,
      books: (() => {
        const seen2 = new Set();
        return s.books.filter(b => {
          if (seen2.has(b.id)) return false;
          seen2.add(b.id);
          return true;
        }).slice(0, 20);
      })(),
    }));

    return [allTab, ...categoryTabs].slice(0, 8); // max 8 tabs
  }, [categorySections, de, personalized]);

  const displayBooks = tabs[activeTab]?.books || [];

  // Wait until personalization check resolves AND category data is ready
  if (personalized === null) return null;
  if (!categorySections || categorySections.length === 0) return null;

  return (
    <section className="for-you-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">
            ✨ {personalized ? (de ? 'Für dich ausgewählt' : 'Picked for you') : (de ? 'Entdecke mehr' : 'Discover more')}
          </h2>
          <Link
            to={tabs[activeTab]?.catId ? `/books?category=${tabs[activeTab].catId}` : '/books'}
            className="view-all-btn"
          >
            {t('view_all')} →
          </Link>
        </div>
        <div className="fy-tabs">
          {tabs.map((tab, i) => (
            <button
              key={i}
              className={`fy-tab${activeTab === i ? ' fy-tab--active' : ''}`}
              onClick={() => setActiveTab(i)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <BooksSlider books={displayBooks} variant="default" className="home-swiper" />
      </div>
    </section>
  );
}

// ─── AuthorSpotlight ─────────────────────────────────────
function AuthorSpotlight({ de }) {
  const [author, setAuthor] = useState(null);
  const [authorBooks, setAuthorBooks] = useState([]);

  useEffect(() => {
    axios.get('/api/authors/featured')
      .then(res => {
        if (res.data && res.data.id) {
          setAuthor(res.data);
          return axios.get(`/api/books?author_id=${res.data.id}&limit=6`);
        }
      })
      .then(res => {
        if (res?.data) {
          const books = Array.isArray(res.data) ? res.data : (res.data.books || []);
          setAuthorBooks(books.filter(b => b.image).slice(0, 5));
        }
      })
      .catch(() => { });
  }, []);

  if (!author) return null;

  const initials = author.name
    ? author.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const bio = de ? (author.bio_de || author.bio) : (author.bio || author.bio_de);
  const photoUrl = author.photo
    ? (author.photo.startsWith('/uploads') ? `${config.API_URL}${author.photo}` : author.photo)
    : null;

  return (
    <section className="author-spotlight-section">
      <div className="container">
        <div className="author-spot-inner">
          <div className="author-spot-left">
            {photoUrl
              ? <img src={photoUrl} alt={author.name} className="author-spot-photo" />
              : <div className="author-spot-avatar">{initials}</div>
            }
          </div>
          <div className="author-spot-right">
            <div className="author-spot-badge">✨ {de ? 'Autor des Monats' : 'Featured Author'}</div>
            <h2 className="author-spot-name">{author.name}</h2>
            {bio && <p className="author-spot-bio">{bio.length > 280 ? bio.slice(0, 280) + '…' : bio}</p>}
            {authorBooks.length > 0 && (
              <div className="author-spot-books">
                {authorBooks.map((b, i) => (
                  <Link key={b.id} to={generateBookUrl(b)} className="author-spot-book-link">
                    <img
                      src={b.image} alt={b.title_en || b.title_de}
                      className="author-spot-book-thumb" loading="lazy"
                      style={{ transitionDelay: `${i * 60}ms` }}
                    />
                  </Link>
                ))}
              </div>
            )}
            <Link to={`/books?author=${encodeURIComponent(author.name)}`} className="author-spot-btn">
              {de ? `Alle Bücher von ${author.name} →` : `View all books by ${author.name} →`}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── WhatReadersSay ──────────────────────────────────────
// Pulls recent, high-quality reviews across all books from
// /api/reviews/recent — the central reviews table, regardless
// of which book's page the review was originally left on.
function WhatReadersSay({ de }) {
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    axios.get('/api/reviews/recent')
      .then(res => { if (Array.isArray(res.data)) setReviews(res.data); })
      .catch(() => {});
  }, []);

  if (!reviews.length) return null;

  return (
    <section className="readers-say-section">
      <div className="container">
        <div className="readers-say-kicker">✦ {de ? 'Das sagen unsere Leser' : 'What our readers say'}</div>
        <h2 className="readers-say-heading">
          {de ? 'Geliebt von Lesern in ganz Deutschland' : 'Loved by readers across Germany'}
        </h2>
        <p className="readers-say-sub">
          {de
            ? 'Schließe dich tausenden zufriedenen Lesern an, die ihre englischen Bücher zu fairen Preisen bekommen.'
            : 'Join thousands of happy readers who get their English books at honest prices.'}
        </p>

        <div className="testi-grid">
          {reviews.slice(0, 6).map(r => {
            const title = de ? (r.title_de || r.title_en) : (r.title_en || r.title_de);
            const to = generateBookUrl({ id: r.book_id, slug: r.slug, title_en: r.title_en, title_de: r.title_de });
            return (
              <Link to={to} key={r.id} className="testi-card">
                <div className="testi-stars">
                  {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                </div>
                <p className="testi-text">
                  "{r.review_text.length > 140 ? r.review_text.slice(0, 140) + '…' : r.review_text}"
                </p>
                <div className="testi-footer">
                  {r.image && <img src={r.image} alt={title} className="testi-cover" loading="lazy" />}
                  <div className="testi-meta">
                    <span className="testi-name">{r.reviewer_name || (de ? 'Anonym' : 'Anonymous')}</span>
                    <span className="testi-book">{title}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── NewsletterSignup ────────────────────────────────────
// "Stay in the Loop" — collects an email via /api/newsletter/subscribe.
// Pre-fills with the logged-in user's email, checks subscription status
// on load, and stays in the "subscribed" state across refreshes until
// the person actually unsubscribes.
function NewsletterSignup({ de }) {
  const { user } = useContext(AuthContext);
  const userEmail = user?.email || '';

  const [email, setEmail] = useState(userEmail);
  const [status, setStatus] = useState('idle'); // idle | checking | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  // Pre-fill when the logged-in user becomes available
  useEffect(() => {
    if (userEmail) setEmail(userEmail);
  }, [userEmail]);

  // Check subscription status for the relevant email (logged-in user's,
  // or whatever's currently typed for guests) so a refresh doesn't
  // reset an already-subscribed person back to the empty form.
  useEffect(() => {
    const checkEmail = userEmail || email;
    if (!checkEmail) return;

    let cancelled = false;
    setStatus('checking');
    axios.get('/api/newsletter/status', { params: { email: checkEmail } })
      .then(res => {
        if (cancelled) return;
        setStatus(res.data?.subscribed ? 'success' : 'idle');
      })
      .catch(() => { if (!cancelled) setStatus('idle'); });

    return () => { cancelled = true; };
    // Only re-check when the logged-in user's email becomes known —
    // guests checking ad-hoc typed emails happens on submit instead.
  }, [userEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === 'loading') return;

    const trimmed = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setStatus('error');
      setErrorMsg(de ? 'Bitte gib eine gültige E-Mail-Adresse ein.' : 'Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    try {
      await axios.post('/api/newsletter/subscribe', {
        email: trimmed,
        language: de ? 'de' : 'en',
        source: 'homepage',
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(de ? 'Etwas ist schiefgelaufen. Bitte versuche es erneut.' : 'Something went wrong. Please try again.');
    }
  };

  return (
    <section className="newsletter-section">
      <div className="container">
        <div className="newsletter-card">
          <div className="newsletter-text">
            <h2>{de ? 'Bleib auf dem Laufenden' : 'Stay in the Loop'}</h2>
            <p>
              {de
                ? 'Erhalte Neuigkeiten zu neuen Büchern, exklusiven Angeboten und mehr — direkt in dein Postfach.'
                : 'Get updates on new arrivals, exclusive deals, and more — straight to your inbox.'}
            </p>
          </div>

          {status === 'success' ? (
            <div className="newsletter-success">
              ✓ {de ? 'Danke! Du bist jetzt angemeldet.' : "Thanks! You're subscribed."}
            </div>
          ) : (
            <form className="newsletter-form" onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={de ? 'Deine E-Mail-Adresse' : 'Your email address'}
                className="newsletter-input"
                disabled={status === 'loading' || status === 'checking' || !!userEmail}
                readOnly={!!userEmail}
              />
              <button type="submit" className="newsletter-btn" disabled={status === 'loading' || status === 'checking'}>
                {status === 'loading'
                  ? (de ? 'Wird gesendet…' : 'Subscribing…')
                  : (de ? 'Anmelden' : 'Subscribe')}
              </button>
            </form>
          )}
          {status === 'error' && <p className="newsletter-error">{errorMsg}</p>}
        </div>
      </div>
    </section>
  );
}


// ─── Home ────────────────────────────────────────────────
function Home() {
  const { t, i18n } = useTranslation();
  const de = i18n.resolvedLanguage === 'de';

  const [popularBooks, setPopularBooks] = useState([]);
  const [categorySections, setCategorySections] = useState([]);
  const { data = { visibleRoots: [] }, isLoading: catLoading } = useGetCategoriesQuery();

  const [heroBooks, setHeroBooks] = useState([]);

  // Shared stats data — used by both StatsBar and the trust strip
  const [homeStats, setHomeStats] = useState(null);
  useEffect(() => {
    axios.get('/api/stats')
      .then(res => { if (res.data) setHomeStats(res.data); })
      .catch(() => {
        setHomeStats({ books: 1200, readers: 3800, saving: 60, reviews: 1 });
      });
  }, []);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroFading, setHeroFading] = useState(false);
  const [categoryRef, showCategories] = useLazySection();

  const visibleCategories = useMemo(() => {
    return Array.isArray(data.visibleRoots)
      ? [...data.visibleRoots].sort((a, b) => a.id - b.id)
      : [];
  }, [data.visibleRoots]);

  const safeCategories = visibleCategories.filter(
    cat => cat && typeof cat === 'object' &&
      (typeof cat.id === 'number' || typeof cat.id === 'string')
  );

  const dedupeBySeries = (books = []) => {
    const map = new Map();
    for (const book of books) {
      const hasValidSeries = book.series_name && book.series_volume !== null && book.series_volume !== '';
      const key = hasValidSeries ? `series_${book.series_name.trim().toLowerCase()}` : `book_${book.id}`;
      if (!map.has(key)) {
        map.set(key, book);
      } else {
        const existing = map.get(key);
        if (new Date(book.publish_date || 0) > new Date(existing.publish_date || 0)) map.set(key, book);
      }
    }
    return Array.from(map.values());
  };

  useEffect(() => {
    axios.get('/api/books/popular')
      .then(res => setPopularBooks(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPopularBooks([]));
  }, []);

  useEffect(() => {
    if (!popularBooks || popularBooks.length === 0) { setHeroBooks([]); setHeroIndex(0); return; }
    setHeroBooks([...popularBooks].sort(() => 0.5 - Math.random()));
    setHeroIndex(0);
  }, [popularBooks]);

  useEffect(() => {
    if (!heroBooks || heroBooks.length === 0) return;
    let fadeTimeout = null;
    const interval = setInterval(() => {
      setHeroFading(true);
      fadeTimeout = setTimeout(() => { setHeroIndex((prev) => (prev + 1) % heroBooks.length); setHeroFading(false); }, 260);
    }, 5000);
    return () => { clearInterval(interval); if (fadeTimeout) clearTimeout(fadeTimeout); };
  }, [heroBooks]);

  const [newArrivals, setNewArrivals] = useState([]);
  useEffect(() => {
    axios.get('/api/books')
      .then(res => {
        const allBooks = Array.isArray(res.data) ? res.data : [];
        setNewArrivals(dedupeBySeries(allBooks.filter(b => b.is_new_release === 1)).slice(0, 12));
      })
      .catch(() => setNewArrivals([]));
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduceMotion) return;
    const sections = document.querySelectorAll('.home-page-v2 > section');
    sections.forEach((s) => s.classList.add('reveal'));
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('reveal--in'); observer.unobserve(entry.target); } }); },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visibleCategories.length || catLoading) return;
    const fetchBooks = async () => {
      try {
        // Single batched call instead of one request per category —
        // major speed win, especially with many categories.
        const res = await axios.get('/api/home/category-sections-batch', { params: { limit: 20 } });
        const results = Array.isArray(res.data) ? res.data : [];
        setCategorySections(results.filter(item => item && item.books?.length > 0));
      } catch (err) {
        console.error('Category sections fetch failed:', err);
        setCategorySections([]);
      }
    };
    fetchBooks();
  }, [catLoading, data.visibleRoots]);

  const visibleHeroBooks = Array.from({ length: 4 }, (_, slotIndex) => {
    if (!heroBooks || heroBooks.length === 0) return null;
    if (slotIndex >= heroBooks.length) return null;
    return heroBooks[(heroIndex + slotIndex) % heroBooks.length];
  });

  if (catLoading) return <div className="loading-home">Loading...</div>;

  return (
    <div className="home-page-v2">
      <Helmet>
        <title>{t('home.meta.title')}</title>
        <meta name="description" content={t('home.meta.description')} />
        <link rel="canonical" href="https://englischbuecher.de/" />
      </Helmet>

      <Banner />

      {/* ── HERO ───────────────────────────────────────── */}
      <section className="wp-hero">
        <div className="container wp-hero__inner">
          <div className="wp-hero__copy">
            <p className="wp-hero__kicker">
              <span className="wp-hero__kicker-dot" />
              {de ? 'Englische Bücher in Deutschland' : 'English books in Germany'}
            </p>
            <h2 className="wp-hero__title">
              {de ? 'Finde dein nächstes Lieblingsbuch – schnell & stressfrei' : 'Find your next favorite read — fast & effortless'}
            </h2>
            <p className="wp-hero__subtitle">
              {de ? 'Bestseller, Klassiker & Neuheiten. Sicher bezahlen.' : 'Bestsellers, classics & new arrivals. Secure checkout.'}
            </p>
            <div className="wp-hero__actions">
              <Link className="wp-btn wp-btn--primary" to="/books">{de ? 'Jetzt stöbern' : 'Browse books'}</Link>
              <Link className="wp-btn wp-btn--ghost" to="/request-book">{de ? 'Buch anfragen' : 'Request a book'}</Link>
            </div>
            <div className="wp-trust">
              <span>✓ {de ? 'Sichere Zahlung' : 'Secure payment'}</span>
              <span>✓ {de ? 'Versand in DE' : 'Shipping in Germany'}</span>
            </div>
          </div>

          <div className="wp-hero__visual" aria-hidden="true">
            <div className="wp-hero__card">
              <div className="wp-hero__savings-float">
                <div className="wp-hero__savings-num">60%</div>
                <div className="wp-hero__savings-label">{de ? 'günstiger' : 'cheaper'}</div>
              </div>
              <div className="wp-hero__chip">{de ? 'Neu & Beliebt' : 'New & Popular'}</div>
              <div className={`wp-hero__mockGrid ${heroFading ? 'wp-hero__mockGrid--fade' : ''}`}>
                {heroBooks && heroBooks.length > 0 ? (
                  visibleHeroBooks.map((book, slotIndex) => {
                    if (!book) return <div key={`placeholder-${slotIndex}`} className="wp-hero__mockCover" />;
                    const to = generateBookUrl(book);
                    const title = book.title_en || book.title_de || book.title || 'Book';
                    return (
                      <Link key={`hero-slot-${slotIndex}-${book.id}`} to={to} className="wp-hero__bookLink" aria-label={`View ${title}`}>
                        <img
                          src={book.image || 'https://via.placeholder.com/300x400?text=Book'}
                          alt={title} className="wp-hero__bookCover"
                          loading={slotIndex === 0 ? 'eager' : 'lazy'}
                        />
                      </Link>
                    );
                  })
                ) : (
                  <><div className="wp-hero__mockCover" /><div className="wp-hero__mockCover" /><div className="wp-hero__mockCover" /><div className="wp-hero__mockCover" /></>
                )}
              </div>
              <div className="wp-hero__info">
                <p>{de ? 'Beliebte Titel & aktuelle Bestseller' : 'Popular titles & current bestsellers'}</p>
                <p className="wp-hero__info-sub">{de ? 'Schnell verfügbar und regelmäßig aktualisiert' : 'Updated regularly and ready to order'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ───────────────────────────────── */}
      <section className="trust-strip">
        <div className="trust-strip__wrapper">
          <div className="trust-strip__track">
            {[0,1,2].map(i => (
              <React.Fragment key={i}>
                <span><strong>🚚 {de ? 'Kostenloser Versand' : 'Free Shipping'}</strong> <em>{de ? 'ab 50 €' : 'over €50'}</em></span>
                <span><strong>India</strong> <em>{de ? 'Direktimport' : 'Direct Import'}</em></span>
                <span><strong>{homeStats ? `${homeStats.books}+` : '…'}</strong> <em>{de ? 'Englische Titel' : 'English Titles'}</em></span>
                <span><strong>60%</strong> <em>{de ? 'Durchschn. Ersparnis' : 'Average Savings'}</em></span>
                <span><strong>{homeStats ? `${homeStats.readers}+` : '…'}</strong> <em>{de ? 'Zufriedene Leser' : 'Happy Readers'}</em></span>
                <span><strong>↩ 14</strong> <em>{de ? 'Tage Rückgabe' : 'Day Returns'}</em></span>
                <span><strong>🔒 {de ? 'Sicher bezahlen' : 'Secure Checkout'}</strong></span>
                <span><strong>📦 {de ? 'Schneller Versand' : 'Fast Dispatch'}</strong></span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOOK OF THE WEEK ──────────────────────────── */}
      <BookOfTheWeek de={de} />

      {/* ── WAYS TO SHOP ──────────────────────────────── */}
      <section className="wp-ways">
        <div className="wp-ways__container">
          <h3 className="wp-ways__title">{de ? 'So kannst du bei uns einkaufen' : 'Ways to shop'}</h3>
          <div className="wp-ways__grid">
            <Link to="/books" className="wp-ways__card">
              <div className="wp-ways__icon">📚</div>
              <div className="wp-ways__name">{de ? 'Online stöbern' : 'Browse online'}</div>
              <div className="wp-ways__desc">{de ? 'Entdecke Kategorien, Bestseller & Neuheiten.' : 'Explore categories, bestsellers & new arrivals.'}</div>
            </Link>
            <Link to="/shipping" className="wp-ways__card">
              <div className="wp-ways__icon">🚚</div>
              <div className="wp-ways__name">{de ? 'Lieferung' : 'Delivery'}</div>
              <div className="wp-ways__desc">{de ? 'Bequem nach Hause – sicher bezahlen.' : 'Delivered to your door — secure checkout.'}</div>
            </Link>
            <Link to="/request-book" className="wp-ways__card wp-ways__card--highlight">
              <div className="wp-ways__icon">✨</div>
              <div className="wp-ways__name">{de ? 'Buch‑Finder' : 'Book finder'}</div>
              <div className="wp-ways__desc">{de ? 'Nichts gefunden? Frag es an — wir erweitern ständig.' : "Can't find it? Request it — we add books regularly."}</div>
            </Link>
          </div>
        </div>
      </section>

      <h1 className="sr-only">{t('home.seo.h1')}</h1>

      {/* ── POPULAR BOOKS ─────────────────────────────── */}
      {popularBooks.length > 0 && (
        <section className="popular-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">{t('home.popular')}</h2>
              <Link to="/books" className="view-all-btn">{t('view_all')} →</Link>
            </div>
            <BooksSlider books={popularBooks} variant="default" className="home-swiper" />
          </div>
        </section>
      )}

      {/* ── FOR YOU SHELF ─────────────────────────────── */}
      <ForYouShelf categorySections={categorySections} de={de} t={t} />

      {/* ── ANIMATED STATS BAR ────────────────────────── */}
      <StatsBar de={de} stats={homeStats} />

      {/* ── REQUEST BOOK CTA ──────────────────────────── */}
      <section className="request-book-section">
        <div className="container">
          <div className="request-book-card">
            <div className="request-book-text">
              <p className="request-book-eyebrow">
                {de ? 'Unser Sortiment wächst' : 'Growing collection'}
              </p>
              <h2>
                {de ? 'Mehr englische Bücher folgen regelmäßig' : 'More English books are added regularly'}
              </h2>
              <p>
                {de
                  ? 'Wir erweitern unser Sortiment kontinuierlich. Falls Sie ein bestimmtes Buch nicht finden, können Sie es ganz einfach bei uns anfragen.'
                  : "We continuously expand our catalog. If you can't find a specific book, you can easily request it from us."}
              </p>
            </div>
            <div className="request-book-right">
              <div className="request-book-decoration">
                <div className="request-book-spine request-book-spine--a" />
                <div className="request-book-spine request-book-spine--b" />
                <div className="request-book-spine request-book-spine--c" />
                <div className="request-book-spine request-book-spine--d" />
                <div className="request-book-spine request-book-spine--e" />
              </div>
              <Link to="/request-book" className="home-request-book-btn">
                {de ? 'Buch anfragen' : 'Request a Book'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORY ICONS ────────────────────────────── */}
      {safeCategories.length > 0 && categorySections.length > 0 && (
        <section className="categories-section">
          <div className="container">
            <h2 className="section-title">
              <Sparkles className="title-icon" size={36} />
              {de ? 'Finde dein nächstes Buch' : 'Find your next book'}
            </h2>
            <p className="wp-quiz__sub">
              {de ? 'Wähle eine Stimmung — wir bringen dich direkt zu passenden Titeln.' : 'Pick a mood — jump straight to matching titles.'}
            </p>
            <div className="categories-grid">
              {safeCategories.map(cat => {
                const section = Array.isArray(categorySections)
                  ? categorySections.find(s => s && s.category &&
                    (typeof s.category.id === 'number' || typeof s.category.id === 'string') &&
                    s.category.id == cat.id)
                  : null;
                if (!section || !section.books || !Array.isArray(section.books)) return null;
                let books = section.books.filter(b => b && typeof b === 'object' && typeof b.image === 'string' && b.image.trim() !== '');
                if (books.length === 0) return null;
                if (books.length === 1) books = [books[0], books[0], books[0]];
                else if (books.length === 2) books = [books[0], books[1], books[0]];
                else books = books.slice(0, 3);
                return (
                  <Link key={String(cat.id)} to={`/books?category=${String(cat.id)}`} className="category-card">
                    <div className="category-book-stack">
                      {books.map((book, index) => (
                        <img key={`${book.id}-${index}`} src={book.image} loading="lazy" decoding="async"
                          alt={typeof book.title_en === 'string' ? book.title_en : 'Book'}
                          className={`stack-book stack-book-${index}`} />
                      ))}
                    </div>
                    <span className="category-name">{de ? (cat.name_de || cat.name_en) : cat.name_en}</span>
                  </Link>
                );
              }).filter(Boolean)}
            </div>
          </div>
        </section>
      )}

      {/* ── NEW ARRIVALS ──────────────────────────────── */}
      {newArrivals.length > 0 && (
        <section className="new-arrivals-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">
                <span className="new-release-glow">{t('home.new_arrivals')}</span>
                <span className="section-title-sub">{t('home.just_in')}</span>
              </h2>
              <Link to="/books?filter=new" className="view-all-btn">{t('view_all')} →</Link>
            </div>
            <BooksSlider books={newArrivals} variant="default" className="home-swiper" />
          </div>
        </section>
      )}

      {/* ── AUTHOR SPOTLIGHT ──────────────────────────── */}
      <AuthorSpotlight de={de} />

      {/* ── CATEGORY SECTIONS ─────────────────────────── */}
      {categorySections.map(section => (
        <section key={section.category.id} className="category-books-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">
                {de ? (section.category.name_de || section.category.name_en) : section.category.name_en}
              </h2>
              <Link to={`/books?category=${section.category.id}`} className="view-all-btn">{t('view_all')} →</Link>
            </div>
            <BooksSlider books={section.books} variant="default" className="home-swiper" />
          </div>
        </section>
      ))}

      {/* ── WHAT READERS SAY ───────────────────────────── */}
      <WhatReadersSay de={de} />

      {/* ── STAY IN THE LOOP ──────────────────────────── */}
      <NewsletterSignup de={de} />

    </div>
  );
}

export default Home;
