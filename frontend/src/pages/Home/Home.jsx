
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

function Home() {
  const { t, i18n } = useTranslation();
  const [popularBooks, setPopularBooks] = useState([]);
  const [categorySections, setCategorySections] = useState([]);
  const { data = { visibleRoots: [] }, isLoading: catLoading } = useGetCategoriesQuery();

  const visibleCategories = Array.isArray(data.visibleRoots)
    ? [...data.visibleRoots].sort((a, b) => a.id - b.id)
    : [];

  useEffect(() => {
    axios.get('/api/books/popular')
      .then(res => setPopularBooks(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPopularBooks([]));
  }, []);

  const [newArrivals, setNewArrivals] = useState([]);
  useEffect(() => {
    axios.get('/api/books')
      .then(res => {
        const allBooks = Array.isArray(res.data) ? res.data : [];
        const filtered = allBooks.filter(b => b.is_new_release === 1).slice(0, 12);
        setNewArrivals(filtered);
      })
      .catch(err => {
        console.error('Failed to load new arrivals:', err);
        setNewArrivals([]);
      });
  }, []);

  useEffect(() => {
    if (!visibleCategories.length || catLoading) return;

    const fetchBooks = async () => {
      const sections = [];
      for (const cat of visibleCategories) {
        try {
          const res = await axios.get(`/api/books/category/${cat.id}`);
          const books = Array.isArray(res.data) ? res.data.slice(0, 8) : [];
          if (books.length > 0) sections.push({ category: cat, books });
        } catch (err) {
          console.error('Failed to load books for', cat.name_en);
        }
      }
      setCategorySections(sections);
    };
    fetchBooks();
  }, [visibleCategories, catLoading]);

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
              <div className="wp-hero__chip">
                {i18n.resolvedLanguage === 'de' ? 'Neu & Beliebt' : 'New & Popular'}
              </div>
              {/*<div className="wp-hero__mockGrid">
                <div className="wp-hero__mockCover" />
                <div className="wp-hero__mockCover" />
                <div className="wp-hero__mockCover" />
                <div className="wp-hero__mockCover" />
              </div>*/}




              <div className="wp-hero__mockGrid">
                {popularBooks && popularBooks.length > 0 ? (
                  [...popularBooks]                 // IMPORTANT: clone array
                    .sort(() => 0.5 - Math.random()) // ✅ randomize books every load
                    .slice(0, 4)
                    .map((book) => (
                      <img
                        key={book.id}
                        src={
                          book.image
                            ? book.image
                            : 'https://via.placeholder.com/300x400?text=Book'
                        }
                        alt={book.title_en || book.title || 'Book'}
                        className="wp-hero__bookCover"
                      />
                    ))
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

      {/* WARBY-STYLE “WAYS TO SHOP” (INSPIRED BY “Ways to try” + quiz entry points) */}
      <section className="wp-ways">
        <div className="container">
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

            <Link to="/books" className="wp-ways__card">
              <div className="wp-ways__icon">🚚</div>
              <div className="wp-ways__name">{i18n.resolvedLanguage === 'de' ? 'Lieferung' : 'Delivery'}</div>
              <div className="wp-ways__desc">
                {i18n.resolvedLanguage === 'de'
                  ? 'Bequem nach Hause – sicher bezahlen.'
                  : 'Delivered to your door — secure checkout.'}
              </div>
            </Link>

            {/*<Link to="/books" className="wp-ways__card">
              <div className="wp-ways__icon">🏬</div>
              <div className="wp-ways__name">{i18n.resolvedLanguage === 'de' ? 'Click & Collect' : 'Click & Collect'}</div>
              <div className="wp-ways__desc">
                {i18n.resolvedLanguage === 'de'
                  ? 'Online bezahlen & selbst abholen.'
                  : 'Pay online and pick up yourself.'}
              </div>
            </Link>*/}

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



      {/*<section className="hero-v3">
        <div className="container hero-v3__inner">
          <div className="hero-v3__copy">
            <h2 className="hero-v3__title">
              {i18n.resolvedLanguage === 'de'
                ? 'Englische Bücher in Deutschland – schnell & zuverlässig'
                : 'English books in Germany — fast & reliable'}
            </h2>

            <p className="hero-v3__subtitle">
              {i18n.resolvedLanguage === 'de'
                ? 'Entdecke Bestseller, Klassiker und Neuheiten. Sicher bezahlen – Lieferung oder Click & Collect.'
                : 'Discover bestsellers, classics, and new arrivals. Secure payments — delivery or Click & Collect.'}
            </p>

            <div className="hero-v3__actions">
              <Link to="/books" className="hero-v3__primary">
                {i18n.resolvedLanguage === 'de' ? 'Jetzt stöbern' : 'Browse books'}
              </Link>
              <Link to="/request-book" className="hero-v3__secondary">
                {i18n.resolvedLanguage === 'de' ? 'Buch anfragen' : 'Request a book'}
              </Link>
            </div>

            <div className="hero-v3__trust">
              <span>✓ {i18n.resolvedLanguage === 'de' ? 'Sichere Zahlung' : 'Secure payment'}</span>
              <span>✓ {i18n.resolvedLanguage === 'de' ? 'Versand in DE' : 'Shipping in Germany'}</span>
              <span>✓ {i18n.resolvedLanguage === 'de' ? 'Click & Collect' : 'Click & Collect'}</span>
            </div>
          </div>

          <div className="hero-v3__visual" aria-hidden="true">
            <div className="hero-v3__card">
              <div className="hero-v3__badge">{i18n.resolvedLanguage === 'de' ? 'Neu' : 'New'}</div>
              <div className="hero-v3__mockCover" />
              <div className="hero-v3__lines">
                <div className="hero-v3__line hero-v3__line--a" />
                <div className="hero-v3__line hero-v3__line--b" />
                <div className="hero-v3__line hero-v3__line--c" />
              </div>
            </div>
          </div>
        </div>
      </section>*/}


      <h1 className="sr-only">
        {t('home.seo.h1')}
      </h1>


      {/* CATEGORY ICONS */}
      {visibleCategories.length > 0 && (
        <section className="categories-section">
          <div className="container">
            <h2 className="section-title">
              <Sparkles className="title-icon" size={36} />
              {/*{t('categories')}*/}
              {i18n.resolvedLanguage === 'de' ? 'Finde dein nächstes Buch' : 'Find your next book'}
            </h2>
            <p className="wp-quiz__sub">
              {i18n.resolvedLanguage === 'de'
                ? 'Wähle eine Stimmung — wir bringen dich direkt zu passenden Titeln.'
                : 'Pick a mood — jump straight to matching titles.'}
            </p>
            <div className="categories-grid">
              {visibleCategories.map(cat => (
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
              ))}
            </div>
          </div>
        </section>
      )}


      {/*<section className="wp-quiz">
        <div className="container">
          <div className="wp-quiz__header">
            <h3 className="wp-quiz__title">
              {i18n.resolvedLanguage === 'de' ? 'Finde dein nächstes Buch' : 'Find your next book'}
            </h3>
            <p className="wp-quiz__sub">
              {i18n.resolvedLanguage === 'de'
                ? 'Wähle eine Stimmung — wir bringen dich direkt zu passenden Titeln.'
                : 'Pick a mood — jump straight to matching titles.'}
            </p>
          </div>

          <div className="wp-quiz__grid">
            <Link className="wp-quiz__tile" to="/books?q=classic">
              <span className="wp-quiz__emoji">📖</span>
              <span className="wp-quiz__label">{i18n.resolvedLanguage === 'de' ? 'Klassiker' : 'Classics'}</span>
            </Link>
            <Link className="wp-quiz__tile" to="/books?q=thriller">
              <span className="wp-quiz__emoji">🕵️</span>
              <span className="wp-quiz__label">{i18n.resolvedLanguage === 'de' ? 'Spannung' : 'Thrillers'}</span>
            </Link>
            <Link className="wp-quiz__tile" to="/books?q=business">
              <span className="wp-quiz__emoji">💼</span>
              <span className="wp-quiz__label">{i18n.resolvedLanguage === 'de' ? 'Business' : 'Business'}</span>
            </Link>
            <Link className="wp-quiz__tile" to="/books?q=kids">
              <span className="wp-quiz__emoji">🧸</span>
              <span className="wp-quiz__label">{i18n.resolvedLanguage === 'de' ? 'Kinder' : 'Kids'}</span>
            </Link>
          </div>
        </div>
      </section>*/}



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


      {/*<section className="trust-strip">
        <div className="container trust-strip__inner">
          <div className="trust-item">🔒 {i18n.resolvedLanguage === 'de' ? 'Sicher bezahlen' : 'Secure payments'}</div>
          <div className="trust-item">🚚 {i18n.resolvedLanguage === 'de' ? 'Versand in Deutschland' : 'Shipping in Germany'}</div>
          <div className="trust-item">📦 {i18n.resolvedLanguage === 'de' ? 'Click & Collect möglich' : 'Click & Collect available'}</div>
          <div className="trust-item">💬 {i18n.resolvedLanguage === 'de' ? 'Support & Kontakt' : 'Support & contact'}</div>
        </div>
      </section>*/}



      {/* POPULAR BOOKS */}
      {popularBooks.length > 0 && (
        <section className="popular-section">
          <div className="container">
            <h2 className="section-title">
              <span className="fire">{t('home.popular')}</span>
            </h2>

            <BooksSlider
              books={popularBooks}
              variant="default"
              className="home-swiper"
            />
          </div>
        </section>
      )}

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

      {/*<section className="home-seo-text container">
        <h2>{t('home.seo.h2')}</h2>

        <p>
          {t('home.seo.p1')}
        </p>

        <p>
          {t('home.seo.p3')}
        </p>
      </section>*/}

    </div>
  );
}

export default Home;