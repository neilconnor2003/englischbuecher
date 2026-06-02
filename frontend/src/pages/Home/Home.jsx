
// frontend/src/pages/Home/Home.jsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Banner from '../../components/Banner/Banner';
import config from '@config';
import { Image, Sparkles } from 'lucide-react';
import { useGetCategoriesQuery } from '../../admin/features/book/bookApiSlice';
import axios from 'axios';
import BooksSlider from '../../components/BooksSlider/BooksSlider'; // NEW
import './Home.css';
import { Helmet } from 'react-helmet-async';
import { generateBookUrl } from '../../utils/seoUrl';

function Home() {
  const { t, i18n } = useTranslation();
  const [popularBooks, setPopularBooks] = useState([]);
  const [categorySections, setCategorySections] = useState([]);
  const { data = { visibleRoots: [] }, isLoading: catLoading } = useGetCategoriesQuery();

  const [heroBooks, setHeroBooks] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);

  const [heroFading, setHeroFading] = useState(false);


  // ✅ TRUST ROTATION (must be before any return!)
  /*const [trustIndex, setTrustIndex] = useState(0);

  const trustMessages = [
    i18n.resolvedLanguage === 'de'
      ? '🚚 Kostenlose Lieferung ab 30€'
      : '🚚 Free shipping over €30',

    i18n.resolvedLanguage === 'de'
      ? '💰 Bis zu 60% günstiger'
      : '💰 Up to 60% cheaper',

    i18n.resolvedLanguage === 'de'
      ? '↩ 14 Tage Rückgabe'
      : '↩ 14-day returns',

    i18n.resolvedLanguage === 'de'
      ? '🔒 Sicher bezahlen'
      : '🔒 Secure checkout'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTrustIndex(prev => (prev + 1) % trustMessages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [trustMessages.length]);*/


  const visibleCategories = Array.isArray(data.visibleRoots)
    ? [...data.visibleRoots].sort((a, b) => a.id - b.id)
    : [];


  /*const dedupeBySeries = (books = []) => {
    const map = new Map();

    for (const book of books) {
      // ✅ Normalize series_name
      const rawSeries = book.series_name || '';
      const seriesKey = rawSeries.trim().toLowerCase();

      // ✅ If no series → treat as unique
      const key = seriesKey ? `series_${seriesKey}` : `book_${book.id}`;

      if (!map.has(key)) {
        map.set(key, book);
      } else {
        const existing = map.get(key);

        // ✅ Compare publish date
        const existingDate = new Date(existing.publish_date || 0);
        const currentDate = new Date(book.publish_date || 0);

        if (currentDate > existingDate) {
          map.set(key, book);
        }
        // ✅ fallback: higher stock
        else if (
          currentDate.getTime() === existingDate.getTime() &&
          (book.stock || 0) > (existing.stock || 0)
        ) {
          map.set(key, book);
        }
      }
    }

    return Array.from(map.values());
  };*/

  const dedupeBySeries = (books = []) => {
    const map = new Map();

    for (const book of books) {
      const hasValidSeries =
        book.series_name &&
        book.series_volume !== null &&
        book.series_volume !== '';

      // ✅ only treat as series IF both exist
      const key = hasValidSeries
        ? `series_${book.series_name.trim().toLowerCase()}`
        : `book_${book.id}`;

      if (!map.has(key)) {
        map.set(key, book);
      } else {
        const existing = map.get(key);

        // ✅ pick latest by publish_date
        const existingDate = new Date(existing.publish_date || 0);
        const currentDate = new Date(book.publish_date || 0);

        if (currentDate > existingDate) {
          map.set(key, book);
        }
      }
    }

    return Array.from(map.values());
  };



  //useEffect(() => {
  /*axios.get('/api/books/popular')
    .then(res => setPopularBooks(Array.isArray(res.data) ? res.data : []))
    .catch(() => setPopularBooks([]));*/

  /*axios.get('/api/books/popular')
    .then(res => {
      const books = Array.isArray(res.data) ? res.data : [];
      setPopularBooks(dedupeBySeries(books));
    })
}, []);*/

  useEffect(() => {
    axios.get('/api/books/popular')
      .then(res => {
        const books = Array.isArray(res.data) ? res.data : [];
        setPopularBooks(books); // already deduped + capped to 20 in backend
      })
      .catch(() => setPopularBooks([]));
  }, []);




  // 1) Pick a randomized hero list ONCE whenever popularBooks loads/changes
  /*useEffect(() => {
    if (popularBooks && popularBooks.length > 0) {
      const deduped = dedupeBySeries(popularBooks);
      //const shuffled = [...popularBooks].sort(() => 0.5 - Math.random());

      const shuffled = [...deduped].sort(() => 0.5 - Math.random());

      setHeroBooks(shuffled);
      setHeroIndex(0);
    } else {
      setHeroBooks([]);
      setHeroIndex(0);
    }
  }, [popularBooks]);*/

  /*useEffect(() => {
    if (!popularBooks || popularBooks.length === 0) return;

    setHeroBooks(prev => {
      // ✅ if already set, do NOT reinitialize
      if (prev.length > 0) return prev;

      const deduped = dedupeBySeries(popularBooks);
      const shuffled = [...deduped].sort(() => 0.5 - Math.random());

      return shuffled;
    });

    setHeroIndex(0);

  }, [popularBooks]);*/

  useEffect(() => {
    if (!popularBooks || popularBooks.length === 0) {
      setHeroBooks([]);
      setHeroIndex(0);
      return;
    }

    // hero uses the same final popular pool, just shuffled once
    const shuffled = [...popularBooks].sort(() => 0.5 - Math.random());
    setHeroBooks(shuffled);
    setHeroIndex(0);
  }, [popularBooks]);



  // 2) Auto-rotate with fade
  useEffect(() => {
    if (!heroBooks || heroBooks.length === 0) return;

    let fadeTimeout = null;

    const interval = setInterval(() => {
      setHeroFading(true);

      // After fade-out, advance index and fade back in
      fadeTimeout = setTimeout(() => {
        setHeroIndex((prev) => (prev + 1) % heroBooks.length);
        setHeroFading(false);
      }, 260); // matches CSS transition duration below
    }, 5000);

    return () => {
      clearInterval(interval);
      if (fadeTimeout) clearTimeout(fadeTimeout);
    };
  }, [heroBooks]);

  const [newArrivals, setNewArrivals] = useState([]);
  useEffect(() => {
    axios.get('/api/books')
      .then(res => {
        const allBooks = Array.isArray(res.data) ? res.data : [];
        //const filtered = allBooks.filter(b => b.is_new_release === 1).slice(0, 12);

        const filtered = dedupeBySeries(
          allBooks.filter(b => b.is_new_release === 1)
        ).slice(0, 12);

        setNewArrivals(filtered);
      })
      .catch(err => {
        console.error('Failed to load new arrivals:', err);
        setNewArrivals([]);
      });
  }, []);


  // Smooth scroll-reveal animations (IntersectionObserver)
  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduceMotion) return; // respect reduced motion preference

    const sections = document.querySelectorAll('.home-page-v2 > section');
    sections.forEach((s) => s.classList.add('reveal'));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal--in');
            observer.unobserve(entry.target); // reveal once (premium feel)
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
    );

    sections.forEach((s) => observer.observe(s));

    return () => observer.disconnect();
  }, []);

  /*useEffect(() => {
    if (!visibleCategories.length || catLoading) return;

    const fetchBooks = async () => {
      const sections = [];
      for (const cat of visibleCategories) {
        try {
          const res = await axios.get(`/api/books/category/${cat.id}`);
          //const books = Array.isArray(res.data) ? res.data.slice(0, 8) : [];

          const booksRaw = Array.isArray(res.data) ? res.data : [];
          console.log(`Category ${cat.name_en}:`, res.data.length);
          //const books = dedupeBySeries(booksRaw).slice(0, 20);

          const deduped = dedupeBySeries(booksRaw);

          const books = deduped
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 20);


          if (books.length > 0) sections.push({ category: cat, books });
        } catch (err) {
          console.error('Failed to load books for', cat.name_en);
        }
      }
      setCategorySections(sections);
    };
    fetchBooks();
  }, [visibleCategories, catLoading]);*/

  useEffect(() => {
    if (!visibleCategories.length || catLoading) return;

    const fetchBooks = async () => {
      const sections = [];

      for (const cat of visibleCategories) {
        try {
          const res = await axios.get(`/api/home/category-sections/${cat.id}`, {
            params: { limit: 20 }
          });

          const books = Array.isArray(res.data) ? res.data : [];

          if (books.length > 0) {
            sections.push({ category: cat, books });
          }
        } catch (err) {
          console.error('Failed to load books for', cat.name_en, err);
        }
      }

      setCategorySections(sections);
    };

    fetchBooks();
  }, [visibleCategories, catLoading]);

  const visibleHeroBooks = Array.from({ length: 4 }, (_, slotIndex) => {
    if (!heroBooks || heroBooks.length === 0) return null;
    if (slotIndex >= heroBooks.length) return null;

    const wrappedIndex = (heroIndex + slotIndex) % heroBooks.length;
    return heroBooks[wrappedIndex];
  });

  if (catLoading) return <div className="loading-home">Loading...</div>;

  return (
    <div className="home-page-v2">
      <Helmet>
        <title>{t('home.meta.title')}</title>
        <meta
          name="description"
          content={t('home.meta.description')}
        />
        <link rel="canonical" href="https://englischbuecher.de/" />
      </Helmet>

      <Banner />

      {/* WARBY-STYLE HERO (BOOKSTORE VERSION) */}
      <section className="wp-hero">
        <div className="container wp-hero__inner">
          <div className="wp-hero__copy">
            <p className="wp-hero__kicker">
              {i18n.resolvedLanguage === 'de' ? 'Englische Bücher in Deutschland' : 'English books in Germany'}
            </p>

            <h2 className="wp-hero__title">
              {i18n.resolvedLanguage === 'de'
                ? 'Finde dein nächstes Lieblingsbuch – schnell & stressfrei'
                : 'Find your next favorite read — fast & effortless'}
            </h2>

            <p className="wp-hero__subtitle">
              {i18n.resolvedLanguage === 'de'
                ? 'Bestseller, Klassiker & Neuheiten. Sicher bezahlen.'
                : 'Bestsellers, classics & new arrivals. Secure checkout.'}
            </p>

            <div className="wp-hero__actions">
              <Link className="wp-btn wp-btn--primary" to="/books">
                {i18n.resolvedLanguage === 'de' ? 'Jetzt stöbern' : 'Browse books'}
              </Link>

              <Link className="wp-btn wp-btn--ghost" to="/request-book">
                {i18n.resolvedLanguage === 'de' ? 'Buch anfragen' : 'Request a book'}
              </Link>
            </div>

            <div className="wp-trust">
              <span>✓ {i18n.resolvedLanguage === 'de' ? 'Sichere Zahlung' : 'Secure payment'}</span>
              <span>✓ {i18n.resolvedLanguage === 'de' ? 'Versand in DE' : 'Shipping in Germany'}</span>
              {/*<span>✓ {i18n.resolvedLanguage === 'de' ? 'Click & Collect' : 'Click & Collect'}</span>*/}
            </div>
          </div>

          <div className="wp-hero__visual" aria-hidden="true">
            <div className="wp-hero__card">

              {/*<div className="wp-hero__badge-save">
                {i18n.resolvedLanguage === 'de' ? 'Bis zu 60% günstiger' : 'Up to 60% cheaper'}
              </div>

              <div className="wp-hero__review">
                ⭐ 4.8 · {i18n.resolvedLanguage === 'de' ? 'Top bewertet' : 'Top rated'}
              </div>*/}

              <div className="wp-hero__chip">
                {i18n.resolvedLanguage === 'de' ? 'Neu & Beliebt' : 'New & Popular'}
              </div>

              <div className={`wp-hero__mockGrid ${heroFading ? 'wp-hero__mockGrid--fade' : ''}`}>

                {heroBooks && heroBooks.length > 0 ? (
                  visibleHeroBooks.map((book, slotIndex) => {
                    if (!book) {
                      return <div key={`placeholder-${slotIndex}`} className="wp-hero__mockCover" />;
                    }

                    const to = generateBookUrl(book);
                    const title = book.title_en || book.title_de || book.title || 'Book';

                    return (
                      <Link
                        key={`hero-slot-${slotIndex}-${book.id}`}
                        to={to}
                        className="wp-hero__bookLink"
                        aria-label={`View ${title}`}
                      >
                        <img
                          src={book.image ? book.image : 'https://via.placeholder.com/300x400?text=Book'}
                          alt={title}
                          className="wp-hero__bookCover"
                          loading={slotIndex === 0 ? "eager" : "lazy"}
                        />
                      </Link>
                    );
                  })
                ) : (
                  <>
                    <div className="wp-hero__mockCover" />
                    <div className="wp-hero__mockCover" />
                    <div className="wp-hero__mockCover" />
                    <div className="wp-hero__mockCover" />
                  </>
                )}
              </div>

              <div className="wp-hero__info">
                <p>
                  {i18n.resolvedLanguage === 'de'
                    ? 'Beliebte Titel & aktuelle Bestseller'
                    : 'Popular titles & current bestsellers'}
                </p>
                <p className="wp-hero__info-sub">
                  {i18n.resolvedLanguage === 'de'
                    ? 'Schnell verfügbar und regelmäßig aktualisiert'
                    : 'Updated regularly and ready to order'}
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/*<section className="trust-strip">
        <div className="container trust-strip__inner">
          <span className="trust-rotating">
            {trustMessages[trustIndex]}
          </span>
        </div>
      </section>*/}

      <section className="trust-strip">
        <div className="trust-strip__wrapper">
          <div className="trust-strip__track">

            <span>🚚 {i18n.resolvedLanguage === 'de' ? 'Kostenlose Lieferung ab 30€' : 'Free shipping over €30'}</span>
            <span>💰 {i18n.resolvedLanguage === 'de' ? 'Bis zu 60% günstiger' : 'Up to 60% cheaper'}</span>
            <span>↩ {i18n.resolvedLanguage === 'de' ? '14 Tage Rückgabe' : '14-day returns'}</span>
            <span>🔒 {i18n.resolvedLanguage === 'de' ? 'Sicher bezahlen' : 'Secure checkout'}</span>

            {/* duplicate for seamless loop */}
            <span>🚚 {i18n.resolvedLanguage === 'de' ? 'Kostenlose Lieferung ab 30€' : 'Free shipping over €30'}</span>
            <span>💰 {i18n.resolvedLanguage === 'de' ? 'Bis zu 60% günstiger' : 'Up to 60% cheaper'}</span>
            <span>↩ {i18n.resolvedLanguage === 'de' ? '14 Tage Rückgabe' : '14-day returns'}</span>
            <span>🔒 {i18n.resolvedLanguage === 'de' ? 'Sicher bezahlen' : 'Secure checkout'}</span>

            {/* duplicate for seamless loop */}
            <span>🚚 {i18n.resolvedLanguage === 'de' ? 'Kostenlose Lieferung ab 30€' : 'Free shipping over €30'}</span>
            <span>💰 {i18n.resolvedLanguage === 'de' ? 'Bis zu 60% günstiger' : 'Up to 60% cheaper'}</span>
            <span>↩ {i18n.resolvedLanguage === 'de' ? '14 Tage Rückgabe' : '14-day returns'}</span>
            <span>🔒 {i18n.resolvedLanguage === 'de' ? 'Sicher bezahlen' : 'Secure checkout'}</span>

            {/* duplicate for seamless loop */}
            <span>🚚 {i18n.resolvedLanguage === 'de' ? 'Kostenlose Lieferung ab 30€' : 'Free shipping over €30'}</span>
            <span>💰 {i18n.resolvedLanguage === 'de' ? 'Bis zu 60% günstiger' : 'Up to 60% cheaper'}</span>
            <span>↩ {i18n.resolvedLanguage === 'de' ? '14 Tage Rückgabe' : '14-day returns'}</span>
            <span>🔒 {i18n.resolvedLanguage === 'de' ? 'Sicher bezahlen' : 'Secure checkout'}</span>

          </div>
        </div>
      </section>

      {/* WARBY-STYLE “WAYS TO SHOP” (INSPIRED BY “Ways to try” + quiz entry points) */}
      <section className="wp-ways">
        <div className="wp-ways__container">
          <h3 className="wp-ways__title">
            {i18n.resolvedLanguage === 'de' ? 'So kannst du bei uns einkaufen' : 'Ways to shop'}
          </h3>

          <div className="wp-ways__grid">
            <Link to="/books" className="wp-ways__card">
              <div className="wp-ways__icon">📚</div>
              <div className="wp-ways__name">{i18n.resolvedLanguage === 'de' ? 'Online stöbern' : 'Browse online'}</div>
              <div className="wp-ways__desc">
                {i18n.resolvedLanguage === 'de'
                  ? 'Entdecke Kategorien, Bestseller & Neuheiten.'
                  : 'Explore categories, bestsellers & new arrivals.'}
              </div>
            </Link>

            <Link to="/shipping" className="wp-ways__card">
              <div className="wp-ways__icon">🚚</div>
              <div className="wp-ways__name">{i18n.resolvedLanguage === 'de' ? 'Lieferung' : 'Delivery'}</div>
              <div className="wp-ways__desc">
                {i18n.resolvedLanguage === 'de'
                  ? 'Bequem nach Hause – sicher bezahlen.'
                  : 'Delivered to your door — secure checkout.'}
              </div>
            </Link>

            <Link to="/request-book" className="wp-ways__card wp-ways__card--highlight">
              <div className="wp-ways__icon">✨</div>
              <div className="wp-ways__name">{i18n.resolvedLanguage === 'de' ? 'Buch‑Finder' : 'Book finder'}</div>
              <div className="wp-ways__desc">
                {i18n.resolvedLanguage === 'de'
                  ? 'Nichts gefunden? Frag es an — wir erweitern ständig.'
                  : 'Can’t find it? Request it — we add books regularly.'}
              </div>
            </Link>

          </div>
        </div>
      </section>

      <h1 className="sr-only">
        {t('home.seo.h1')}
      </h1>

      {/* POPULAR BOOKS */}
      {popularBooks.length > 0 && (
        <section className="popular-section">
          <div className="container">
            {/*<h2 className="section-title">
              <span className="fire">{t('home.popular')}</span>
            </h2>*/}

            <div className="section-header">
              <h2 className="section-title">
                {t('home.popular')}
              </h2>

              <Link to="/books" className="view-all-btn">
                {t('view_all')} →
              </Link>
            </div>


            <BooksSlider
              books={popularBooks}
              variant="default"
              className="home-swiper"
            />
          </div>
        </section>
      )}

      {/* REQUEST BOOK / CATALOG INFO SECTION */}
      <section className="request-book-section">
        <div className="container">
          <div className="request-book-card">
            <div className="request-book-text">
              <h2>
                {i18n.resolvedLanguage === 'de'
                  ? 'Mehr englische Bücher folgen regelmäßig'
                  : 'More English books are added regularly'}
              </h2>

              <p>
                {i18n.resolvedLanguage === 'de'
                  ? 'Wir erweitern unser Sortiment kontinuierlich. Falls Sie ein bestimmtes Buch nicht finden, können Sie es ganz einfach bei uns anfragen.'
                  : 'We continuously expand our catalog. If you can’t find a specific book, you can easily request it from us.'}

              </p>
            </div>

            <Link
              to="/request-book"
              className="home-request-book-btn"
            >
              {i18n.resolvedLanguage === 'de'
                ? 'Buch anfragen'
                : 'Request a Book'}
            </Link>
          </div>
        </div>
      </section>

      {/* CATEGORY ICONS */}
      {visibleCategories.length > 0 && (
        <section className="categories-section">
          <div className="container">
            <h2 className="section-title">
              <Sparkles className="title-icon" size={36} />
              {i18n.resolvedLanguage === 'de' ? 'Finde dein nächstes Buch' : 'Find your next book'}
            </h2>
            <p className="wp-quiz__sub">
              {i18n.resolvedLanguage === 'de'
                ? 'Wähle eine Stimmung — wir bringen dich direkt zu passenden Titeln.'
                : 'Pick a mood — jump straight to matching titles.'}
            </p>
            <div className="categories-grid">
              {/*{visibleCategories.map(cat => (
                <Link
                  key={cat.id}
                  to={`/books?category=${cat.id}`}
                  className="category-card"
                >
                  {cat.icon_path ? (
                    <img
                      src={`${config.UPLOADS_BASE_URL}${cat.icon_path}?v=${cat.updated_at}`}
                      alt=""
                      className="category-icon"
                    />
                  ) : (
                    <div className="category-icon-placeholder">
                      <Image size={40} />
                    </div>
                  )}
                  <span className="category-name">
                    {i18n.resolvedLanguage === 'de' ? (cat.name_de || cat.name_en) : cat.name_en}
                  </span>
                </Link>
              ))}*/}

              {visibleCategories.map(cat => {

                const section = categorySections.find(
                  s => s.category.id === cat.id
                );

                //const previewBooks = section?.books?.slice(0, 3) || [];

                return (
                  <Link
                    key={cat.id}
                    to={`/books?category=${cat.id}`}
                    className="category-card"
                  >

                    {/* ICON (keep your existing logic) */}
                    {/*{cat.icon_path ? (
                      <img
                        src={`${config.UPLOADS_BASE_URL}${cat.icon_path}?v=${cat.updated_at}`}
                        alt=""
                        className="category-icon"
                      />
                    ) : (
                      <div className="category-icon-placeholder">
                        <Image size={40} />
                      </div>
                    )}*/}

                    {/* ✅ BOOK STACK FIRST */}
                    <div className="category-book-stack">
                      {(() => {
                        const section = categorySections.find(
                          s => s.category.id === cat.id
                        );

                        //const previewBooks = section?.books?.slice(0, 3) || [];

                        const previewBooks =
                          section?.books?.length > 0
                            ? section.books.slice(0, 3)
                            : [
                              { id: 'p1', image: 'https://via.placeholder.com/100x150' },
                              { id: 'p2', image: 'https://via.placeholder.com/100x150' },
                              { id: 'p3', image: 'https://via.placeholder.com/100x150' }
                            ];


                        return previewBooks.map((book, index) => (
                          <img
                            key={book.id}
                            src={book.image || 'https://via.placeholder.com/100x150'}
                            alt={book.title_en || 'Book'}
                            className={`stack-book stack-book-${index}`}
                          />
                        ));
                      })()}
                    </div>

                    {/* NAME */}
                    <span className="category-name">
                      {i18n.resolvedLanguage === 'de'
                        ? (cat.name_de || cat.name_en)
                        : cat.name_en}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CATEGORY PREVIEW SECTION */}
      {/*{categorySections.length > 0 && (
        <section className="categories-section">
          <div className="container">

            <h2 className="section-title">
              {i18n.resolvedLanguage === 'de'
                ? 'Finde dein nächstes Buch'
                : 'Find your next book'}
            </h2>

            <p className="category-sub">
              {i18n.resolvedLanguage === 'de'
                ? 'Durchsuche Kategorien und entdecke dein nächstes Buch'
                : 'Browse categories and discover your next read'}
            </p>

            <div className="categories-grid">

              {categorySections.map(section => (
                <Link
                  key={section.category.id}
                  to={`/books?category=${section.category.id}`}
                  className="category-card"
                >

                  <div className="category-header">
                    <h3>
                      {i18n.resolvedLanguage === 'de'
                        ? (section.category.name_de || section.category.name_en)
                        : section.category.name_en}
                    </h3>

                    <span className="category-cta">
                      {i18n.resolvedLanguage === 'de' ? 'Ansehen →' : 'Browse →'}
                    </span>
                  </div>

                  <div className="category-preview">
                    {section.books.slice(0, 3).map(book => (
                      <img
                        key={book.id}
                        src={book.image || 'https://via.placeholder.com/80x120'}
                        alt={book.title_en || 'Book'}
                      />
                    ))}
                  </div>

                </Link>
              ))}

            </div>

          </div>
        </section>
      )}*/}


      {/* NEW ARRIVALS */}
      {newArrivals.length > 0 && (
        <section className="new-arrivals-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">
                <span className="new-release-glow">{t('home.new_arrivals')}</span>
                <span className="ml-3 text-2xl">{t('home.just_in')}</span>
              </h2>
              <Link to="/books?filter=new" className="view-all-btn">
                {t('view_all')} →
              </Link>
            </div>

            <BooksSlider
              books={newArrivals}
              variant="default"
              className="home-swiper"
            />
          </div>
        </section>
      )}

      {/* CATEGORY SECTIONS */}
      {categorySections.map(section => (
        <section key={section.category.id} className="category-books-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">
                {i18n.resolvedLanguage === 'de'
                  ? (section.category.name_de || section.category.name_en)
                  : section.category.name_en}
              </h2>
              <Link to={`/books?category=${section.category.id}`} className="view-all-btn">
                {t('view_all')} →
              </Link>
            </div>

            <BooksSlider
              books={section.books}
              variant="default"
              className="home-swiper"
            />
          </div>
        </section>
      ))}

    </div>
  );
}

export default Home;