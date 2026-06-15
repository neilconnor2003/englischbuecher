// frontend/src/pages/Home/Home.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Banner from '../../components/Banner/Banner';
import config from '@config';
import { Sparkles } from 'lucide-react';
import { useGetCategoriesQuery } from '../../admin/features/book/bookApiSlice';
import axios from 'axios';
import BooksSlider from '../../components/BooksSlider/BooksSlider';
import './Home.css';
import { Helmet } from 'react-helmet-async';
import { generateBookUrl } from '../../utils/seoUrl';

/* ─── Lazy-section hook (unchanged) ───────────────────── */
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

/* ─── Component ────────────────────────────────────────── */
function Home() {
  const { t, i18n } = useTranslation();
  const de = i18n.resolvedLanguage === 'de';

  const [popularBooks, setPopularBooks]       = useState([]);
  const [newArrivals, setNewArrivals]         = useState([]);
  const [categorySections, setCategorySections] = useState([]);
  const [heroBooks, setHeroBooks]             = useState([]);
  const [heroIndex, setHeroIndex]             = useState(0);
  const [heroFading, setHeroFading]           = useState(false);

  const [categoryRef, showCategories] = useLazySection();

  const { data = { visibleRoots: [] }, isLoading: catLoading } = useGetCategoriesQuery();

  /* Visible categories */
  const visibleCategories = useMemo(() =>
    Array.isArray(data.visibleRoots)
      ? [...data.visibleRoots].sort((a, b) => a.id - b.id)
      : []
  , [data.visibleRoots]);

  const safeCategories = visibleCategories.filter(
    cat => cat && typeof cat === 'object' &&
           (typeof cat.id === 'number' || typeof cat.id === 'string')
  );

  /* Dedupe series (unchanged) */
  const dedupeBySeries = (books = []) => {
    const map = new Map();
    for (const book of books) {
      const hasValidSeries =
        book.series_name && book.series_volume !== null && book.series_volume !== '';
      const key = hasValidSeries
        ? `series_${book.series_name.trim().toLowerCase()}`
        : `book_${book.id}`;
      if (!map.has(key)) {
        map.set(key, book);
      } else {
        const existing = map.get(key);
        if (new Date(book.publish_date || 0) > new Date(existing.publish_date || 0)) {
          map.set(key, book);
        }
      }
    }
    return Array.from(map.values());
  };

  /* Popular books */
  useEffect(() => {
    axios.get('/api/books/popular')
      .then(res => setPopularBooks(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPopularBooks([]));
  }, []);

  /* Hero rotation setup */
  useEffect(() => {
    if (!popularBooks.length) { setHeroBooks([]); setHeroIndex(0); return; }
    setHeroBooks([...popularBooks].sort(() => 0.5 - Math.random()));
    setHeroIndex(0);
  }, [popularBooks]);

  /* Hero auto-rotate with fade */
  useEffect(() => {
    if (!heroBooks.length) return;
    let fadeTimeout = null;
    const interval = setInterval(() => {
      setHeroFading(true);
      fadeTimeout = setTimeout(() => {
        setHeroIndex(prev => (prev + 1) % heroBooks.length);
        setHeroFading(false);
      }, 260);
    }, 5000);
    return () => { clearInterval(interval); if (fadeTimeout) clearTimeout(fadeTimeout); };
  }, [heroBooks]);

  /* New arrivals */
  useEffect(() => {
    axios.get('/api/books')
      .then(res => {
        const all = Array.isArray(res.data) ? res.data : [];
        setNewArrivals(dedupeBySeries(all.filter(b => b.is_new_release === 1)).slice(0, 12));
      })
      .catch(() => setNewArrivals([]));
  }, []);

  /* Category sections */
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
      } catch (err) {
        console.error('Category sections fetch failed:', err);
      }
    };
    fetchBooks();
  }, [catLoading, data.visibleRoots]);

  /* Scroll-reveal animations */
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    const sections = document.querySelectorAll('.home-page-v2 > section');
    sections.forEach(s => s.classList.add('reveal'));
    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal--in');
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.10, rootMargin: '0px 0px -8% 0px' }
    );
    sections.forEach(s => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  /* Hero book slots */
  const visibleHeroBooks = Array.from({ length: 4 }, (_, i) => {
    if (!heroBooks.length || i >= heroBooks.length) return null;
    return heroBooks[(heroIndex + i) % heroBooks.length];
  });

  if (catLoading) return <div className="loading-home">Loading…</div>;

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

          {/* Copy */}
          <div className="wp-hero__copy">
            <span className="wp-hero__kicker">
              {de ? 'Englische Bücher in Deutschland' : 'English books in Germany'}
            </span>

            <h2 className="wp-hero__title">
              {de
                ? 'Finde dein nächstes Lieblingsbuch'
                : 'Find your next favourite read'}
            </h2>

            <p className="wp-hero__subtitle">
              {de
                ? 'Bestseller, Klassiker & Neuheiten — bis zu 60 % günstiger als im deutschen Buchhandel. Sicher bezahlen, schnell geliefert.'
                : 'Bestsellers, classics & new arrivals — up to 60% cheaper than German retailers. Secure checkout, fast delivery.'}
            </p>

            <div className="wp-hero__actions">
              <Link className="wp-btn wp-btn--primary" to="/books">
                {de ? 'Jetzt stöbern' : 'Browse books'}
              </Link>
              <Link className="wp-btn wp-btn--ghost" to="/request-book">
                {de ? 'Buch anfragen' : 'Request a book'}
              </Link>
            </div>

            <div className="wp-trust">
              <span>✓ {de ? 'Sichere Zahlung' : 'Secure payment'}</span>
              <span>✓ {de ? 'Versand in DE' : 'Ships to Germany'}</span>
              <span>✓ {de ? '14 Tage Rückgabe' : '14-day returns'}</span>
            </div>
          </div>

          {/* Visual card */}
          <div className="wp-hero__visual" aria-hidden="true">
            <div className="wp-hero__card">
              <div className="wp-hero__chip">
                {de ? 'Neu & Beliebt' : 'New & Popular'}
              </div>

              <div className={`wp-hero__mockGrid${heroFading ? ' wp-hero__mockGrid--fade' : ''}`}>
                {heroBooks.length > 0
                  ? visibleHeroBooks.map((book, i) => {
                      if (!book) return <div key={`ph-${i}`} className="wp-hero__mockCover" />;
                      const to = generateBookUrl(book);
                      const title = book.title_en || book.title_de || book.title || 'Book';
                      return (
                        <Link
                          key={`hero-${i}-${book.id}`}
                          to={to}
                          className="wp-hero__bookLink"
                          aria-label={`View ${title}`}
                        >
                          <img
                            src={book.image || 'https://via.placeholder.com/300x400?text=Book'}
                            alt={title}
                            className="wp-hero__bookCover"
                            loading={i === 0 ? 'eager' : 'lazy'}
                          />
                        </Link>
                      );
                    })
                  : Array.from({ length: 4 }, (_, i) => (
                      <div key={`ph-${i}`} className="wp-hero__mockCover" />
                    ))
                }
              </div>

              <div className="wp-hero__info">
                <p>{de ? 'Beliebte Titel & aktuelle Bestseller' : 'Popular titles & current bestsellers'}</p>
                <p className="wp-hero__info-sub">
                  {de ? 'Regelmäßig aktualisiert' : 'Updated regularly'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ────────────────────────────────── */}
      <section className="trust-strip" style={{ padding: 0 }}>
        <div className="trust-strip__wrapper">
          <div className="trust-strip__track">
            {[
              { icon: '🚚', en: 'Free shipping over €30',     de: 'Kostenlose Lieferung ab 30 €' },
              { icon: '💰', en: 'Up to 60% cheaper',          de: 'Bis zu 60 % günstiger' },
              { icon: '↩',  en: '14-day returns',             de: '14 Tage Rückgabe' },
              { icon: '🔒', en: 'Secure checkout',            de: 'Sicher bezahlen' },
              { icon: '📦', en: 'Fast dispatch',              de: 'Schneller Versand' },
              { icon: '📚', en: 'Hundreds of English titles', de: 'Hunderte englische Titel' },
            ].concat([
              { icon: '🚚', en: 'Free shipping over €30',     de: 'Kostenlose Lieferung ab 30 €' },
              { icon: '💰', en: 'Up to 60% cheaper',          de: 'Bis zu 60 % günstiger' },
              { icon: '↩',  en: '14-day returns',             de: '14 Tage Rückgabe' },
              { icon: '🔒', en: 'Secure checkout',            de: 'Sicher bezahlen' },
              { icon: '📦', en: 'Fast dispatch',              de: 'Schneller Versand' },
              { icon: '📚', en: 'Hundreds of English titles', de: 'Hunderte englische Titel' },
            ]).concat([
              { icon: '🚚', en: 'Free shipping over €30',     de: 'Kostenlose Lieferung ab 30 €' },
              { icon: '💰', en: 'Up to 60% cheaper',          de: 'Bis zu 60 % günstiger' },
              { icon: '↩',  en: '14-day returns',             de: '14 Tage Rückgabe' },
              { icon: '🔒', en: 'Secure checkout',            de: 'Sicher bezahlen' },
              { icon: '📦', en: 'Fast dispatch',              de: 'Schneller Versand' },
              { icon: '📚', en: 'Hundreds of English titles', de: 'Hunderte englische Titel' },
            ]).map((item, idx) => (
              <span key={idx}>{item.icon} {de ? item.de : item.en}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Hidden SEO H1 */}
      <h1 className="sr-only">{t('home.seo.h1')}</h1>

      {/* ── POPULAR BOOKS ──────────────────────────────── */}
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

      {/* ── WAYS TO SHOP ───────────────────────────────── */}
      <section className="wp-ways">
        <div className="wp-ways__container">
          <h3 className="wp-ways__title">
            {de ? 'So kannst du bei uns einkaufen' : 'Ways to shop'}
          </h3>
          <div className="wp-ways__grid">
            <Link to="/books" className="wp-ways__card">
              <span className="wp-ways__icon">📚</span>
              <div className="wp-ways__name">{de ? 'Online stöbern' : 'Browse online'}</div>
              <div className="wp-ways__desc">
                {de
                  ? 'Entdecke Kategorien, Bestseller & Neuheiten.'
                  : 'Explore categories, bestsellers & new arrivals.'}
              </div>
            </Link>
            <Link to="/footer/shipping" className="wp-ways__card">
              <span className="wp-ways__icon">🚚</span>
              <div className="wp-ways__name">{de ? 'Lieferung' : 'Delivery'}</div>
              <div className="wp-ways__desc">
                {de
                  ? 'Bequem nach Hause – sicher bezahlen.'
                  : 'Delivered to your door — secure checkout.'}
              </div>
            </Link>
            <Link to="/request-book" className="wp-ways__card wp-ways__card--highlight">
              <span className="wp-ways__icon">✨</span>
              <div className="wp-ways__name">{de ? 'Buch‑Finder' : 'Book finder'}</div>
              <div className="wp-ways__desc">
                {de
                  ? 'Nichts gefunden? Frag es an — wir erweitern ständig.'
                  : "Can't find it? Request it — we add books regularly."}
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── REQUEST BOOK CTA ───────────────────────────── */}
      <section className="request-book-section">
        <div className="container">
          <div className="request-book-card">
            <div className="request-book-text">
              <h2>
                {de
                  ? 'Mehr englische Bücher folgen regelmäßig'
                  : 'More English books added regularly'}
              </h2>
              <p>
                {de
                  ? 'Wir erweitern unser Sortiment kontinuierlich. Falls Sie ein bestimmtes Buch nicht finden, können Sie es ganz einfach bei uns anfragen.'
                  : "We continuously expand our catalog. If you can't find a specific book, you can easily request it from us."}
              </p>
            </div>
            <Link to="/request-book" className="home-request-book-btn">
              {de ? 'Buch anfragen' : 'Request a book'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── CATEGORY MOOD GRID ─────────────────────────── */}
      {safeCategories.length > 0 && categorySections.length > 0 && (
        <section className="categories-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">
                <Sparkles className="title-icon" size={22} />
                {de ? 'Finde dein nächstes Buch' : 'Find your next book'}
              </h2>
              <Link to="/books" className="view-all-btn">
                {de ? 'Alle Kategorien' : 'All categories'} →
              </Link>
            </div>
            <p className="wp-quiz__sub">
              {de
                ? 'Wähle eine Stimmung — wir bringen dich direkt zu passenden Titeln.'
                : 'Pick a mood — jump straight to matching titles.'}
            </p>

            <div className="categories-grid">
              {safeCategories.map(cat => {
                const section = Array.isArray(categorySections)
                  ? categorySections.find(s => s?.category?.id == cat.id)
                  : null;
                if (!section?.books || !Array.isArray(section.books)) return null;

                let books = section.books.filter(
                  b => b && typeof b.image === 'string' && b.image.trim()
                );
                if (books.length === 0) return null;

                if      (books.length === 1) books = [books[0], books[0], books[0]];
                else if (books.length === 2) books = [books[0], books[1], books[0]];
                else                         books = books.slice(0, 3);

                return (
                  <Link
                    key={String(cat.id)}
                    to={`/books?category=${String(cat.id)}`}
                    className="category-card"
                  >
                    <div className="category-book-stack">
                      {books.map((book, index) => (
                        <img
                          key={`${book.id}-${index}`}
                          src={book.image}
                          loading="lazy"
                          decoding="async"
                          alt={typeof book.title_en === 'string' ? book.title_en : 'Book'}
                          className={`stack-book stack-book-${index}`}
                        />
                      ))}
                    </div>
                    <span className="category-name">
                      {de ? (cat.name_de || cat.name_en) : cat.name_en}
                    </span>
                  </Link>
                );
              }).filter(Boolean)}
            </div>
          </div>
        </section>
      )}

      {/* ── NEW ARRIVALS ───────────────────────────────── */}
      {newArrivals.length > 0 && (
        <section className="new-arrivals-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">
                <span className="new-release-glow">{t('home.new_arrivals')}</span>
                {t('home.just_in') && (
                  <span style={{ fontSize: '1rem', color: 'var(--ink-muted)', fontWeight: 400 }}>
                    {' '}— {t('home.just_in')}
                  </span>
                )}
              </h2>
              <Link to="/books?filter=new" className="view-all-btn">{t('view_all')} →</Link>
            </div>
            <BooksSlider books={newArrivals} variant="default" className="home-swiper" />
          </div>
        </section>
      )}

      {/* ── CATEGORY BOOK SECTIONS ─────────────────────── */}
      {categorySections.map(section => (
        <section key={section.category.id} className="category-books-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">
                {de ? (section.category.name_de || section.category.name_en) : section.category.name_en}
              </h2>
              <Link to={`/books?category=${section.category.id}`} className="view-all-btn">
                {t('view_all')} →
              </Link>
            </div>
            <BooksSlider books={section.books} variant="default" className="home-swiper" />
          </div>
        </section>
      ))}

    </div>
  );
}

export default Home;
