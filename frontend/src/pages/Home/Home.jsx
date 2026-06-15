// frontend/src/pages/Home/Home.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
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

// ─── useCountUp ──────────────────────────────────────────
function useCountUp(target, duration = 1800) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          let start = null;
          const step = (ts) => {
            if (!start) start = ts;
            const progress = Math.min((ts - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setVal(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);
  return [val, ref];
}

// ─── StatsBar ────────────────────────────────────────────
function StatsBar({ de }) {
  const [stats, setStats] = useState({ books: 1200, readers: 3800, saving: 60, reviews: 890 });
  useEffect(() => {
    axios.get('/api/stats').then(res => { if (res.data) setStats(res.data); }).catch(() => {});
  }, []);

  const [books,   booksRef]   = useCountUp(stats.books,   1600);
  const [readers, readersRef] = useCountUp(stats.readers, 2000);
  const [saving,  savingRef]  = useCountUp(stats.saving,  1200);
  const [reviews, reviewsRef] = useCountUp(stats.reviews, 2200);

  const items = [
    { ref: booksRef,   val: books,   suffix: '+',  label: de ? 'Bücher auf Lager'         : 'Books in stock'        },
    { ref: readersRef, val: readers, suffix: '+',  label: de ? 'Zufriedene Leser'          : 'Happy readers'         },
    { ref: savingRef,  val: saving,  suffix: '%',  label: de ? 'Günstiger als Amazon'      : 'Cheaper than Amazon'   },
    { ref: reviewsRef, val: reviews, suffix: 'K+', label: de ? 'Bewertungen & Rezensionen' : '5-star reviews'        },
  ];

  return (
    <section className="home-stats-section">
      <div className="container">
        <div className="home-stats-grid">
          {items.map((item, i) => (
            <div className="home-stats-item" key={i} ref={item.ref}>
              <div className="home-stats-num">{item.val.toLocaleString()}{item.suffix}</div>
              <div className="home-stats-label">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── BookOfTheWeek ───────────────────────────────────────
function BookOfTheWeek({ de }) {
  const [book, setBook] = useState(null);
  useEffect(() => {
    axios.get('/api/books/book-of-week').then(res => { if (res.data && res.data.id) setBook(res.data); }).catch(() => {});
  }, []);
  if (!book) return null;

  const title  = de ? (book.title_de || book.title_en) : (book.title_en || book.title_de);
  const author = book.author_name || book.author || '';
  const desc   = de ? (book.description_de || book.description_en) : (book.description_en || book.description_de);
  const price  = parseFloat(book.price || 0).toFixed(2);
  const orig   = parseFloat(book.original_price || 0);
  const saving = orig > 0 ? Math.round(((orig - book.price) / orig) * 100) : 0;
  const to     = generateBookUrl(book);

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
              <Link to={to} className="botw-btn-primary">{de ? '🛒 In den Warenkorb' : '🛒 Add to cart'}</Link>
              <Link to={to} className="botw-btn-ghost">{de ? 'Details ansehen' : 'View details'}</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── ForYouShelf ─────────────────────────────────────────
function ForYouShelf({ categorySections, de, t }) {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = useMemo(() => {
    const all = { label: de ? 'Alle' : 'All', books: [] };
    const sections = (categorySections || []).filter(s => s?.books?.length > 0);
    sections.forEach(s => { all.books.push(...s.books); });
    return [all, ...sections.map(s => ({
      label: de ? (s.category.name_de || s.category.name_en) : s.category.name_en,
      catId: s.category.id,
      books: s.books,
    }))].slice(0, 7);
  }, [categorySections, de]);

  const displayBooks = useMemo(() => {
    const pool = tabs[activeTab]?.books || [];
    const seen = new Set();
    return pool.filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true; }).slice(0, 20);
  }, [tabs, activeTab]);

  if (!categorySections || categorySections.length === 0) return null;

  return (
    <section className="for-you-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">✨ {de ? 'Für dich ausgewählt' : 'Picked for you'}</h2>
          <Link
            to={tabs[activeTab]?.catId ? `/books?category=${tabs[activeTab].catId}` : '/books'}
            className="view-all-btn"
          >
            {t('view_all')} →
          </Link>
        </div>
        <div className="fy-tabs">
          {tabs.map((tab, i) => (
            <button key={i} className={`fy-tab${activeTab === i ? ' fy-tab--active' : ''}`} onClick={() => setActiveTab(i)}>
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
      .catch(() => {});
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
            <Link to={`/books?author_id=${author.id}`} className="author-spot-btn">
              {de ? `Alle Bücher von ${author.name} →` : `View all books by ${author.name} →`}
            </Link>
          </div>
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
        const requests = visibleCategories.map(cat =>
          axios.get(`/api/home/category-sections/${cat.id}`, { params: { limit: 20 } })
            .then(res => ({ category: cat, books: Array.isArray(res.data) ? res.data : [] }))
            .catch(() => null)
        );
        const results = await Promise.all(requests);
        setCategorySections(results.filter(item => item && item.books.length > 0));
      } catch (err) { console.error('Category sections fetch failed:', err); }
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
              {/* NEW: floating savings badge */}
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

      {/* ── TRUST STRIP (unchanged) ───────────────────── */}
      <section className="trust-strip">
        <div className="trust-strip__wrapper">
          <div className="trust-strip__track">
            <span>🚚 {de ? 'Kostenlose Lieferung ab 30€' : 'Free shipping over €30'}</span>
            <span>💰 {de ? 'Bis zu 60% günstiger' : 'Up to 60% cheaper'}</span>
            <span>↩ {de ? '14 Tage Rückgabe' : '14-day returns'}</span>
            <span>🔒 {de ? 'Sicher bezahlen' : 'Secure checkout'}</span>
            <span>🚚 {de ? 'Kostenlose Lieferung ab 30€' : 'Free shipping over €30'}</span>
            <span>💰 {de ? 'Bis zu 60% günstiger' : 'Up to 60% cheaper'}</span>
            <span>↩ {de ? '14 Tage Rückgabe' : '14-day returns'}</span>
            <span>🔒 {de ? 'Sicher bezahlen' : 'Secure checkout'}</span>
            <span>🚚 {de ? 'Kostenlose Lieferung ab 30€' : 'Free shipping over €30'}</span>
            <span>💰 {de ? 'Bis zu 60% günstiger' : 'Up to 60% cheaper'}</span>
            <span>↩ {de ? '14 Tage Rückgabe' : '14-day returns'}</span>
            <span>🔒 {de ? 'Sicher bezahlen' : 'Secure checkout'}</span>
            <span>🚚 {de ? 'Kostenlose Lieferung ab 30€' : 'Free shipping over €30'}</span>
            <span>💰 {de ? 'Bis zu 60% günstiger' : 'Up to 60% cheaper'}</span>
            <span>↩ {de ? '14 Tage Rückgabe' : '14-day returns'}</span>
            <span>🔒 {de ? 'Sicher bezahlen' : 'Secure checkout'}</span>
          </div>
        </div>
      </section>

      {/* ── NEW: BOOK OF THE WEEK ─────────────────────── */}
      <BookOfTheWeek de={de} />

      {/* ── WAYS TO SHOP (unchanged) ──────────────────── */}
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

      {/* ── POPULAR BOOKS (unchanged) ─────────────────── */}
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

      {/* ── NEW: FOR YOU SHELF ────────────────────────── */}
      <ForYouShelf categorySections={categorySections} de={de} t={t} />

      {/* ── NEW: ANIMATED STATS BAR ───────────────────── */}
      <StatsBar de={de} />

      {/* ── REQUEST BOOK CTA (unchanged) ─────────────── */}
      <section className="request-book-section">
        <div className="container">
          <div className="request-book-card">
            <div className="request-book-text">
              <h2>
                {de ? 'Mehr englische Bücher folgen regelmäßig' : 'More English books are added regularly'}
              </h2>
              <p>
                {de
                  ? 'Wir erweitern unser Sortiment kontinuierlich. Falls Sie ein bestimmtes Buch nicht finden, können Sie es ganz einfach bei uns anfragen.'
                  : "We continuously expand our catalog. If you can't find a specific book, you can easily request it from us."}
              </p>
            </div>
            <Link to="/request-book" className="home-request-book-btn">
              {de ? 'Buch anfragen' : 'Request a Book'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── CATEGORY ICONS (unchanged) ────────────────── */}
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

      {/* ── NEW ARRIVALS (unchanged) ───────────────────── */}
      {newArrivals.length > 0 && (
        <section className="new-arrivals-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">
                <span className="new-release-glow">{t('home.new_arrivals')}</span>
                <span className="ml-3 text-2xl">{t('home.just_in')}</span>
              </h2>
              <Link to="/books?filter=new" className="view-all-btn">{t('view_all')} →</Link>
            </div>
            <BooksSlider books={newArrivals} variant="default" className="home-swiper" />
          </div>
        </section>
      )}

      {/* ── NEW: AUTHOR SPOTLIGHT ─────────────────────── */}
      <AuthorSpotlight de={de} />

      {/* ── CATEGORY SECTIONS (unchanged) ─────────────── */}
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

    </div>
  );
}

export default Home;
