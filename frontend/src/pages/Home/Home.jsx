
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


function StatsTicker({ lang }) {
  const stats = [
    ['500+', lang === 'de' ? 'Titel' : 'Titles'],
    ['60%', lang === 'de' ? 'Ersparnis' : 'Savings'],
    ['2400+', lang === 'de' ? 'Leser' : 'Readers'],
    ['DPD', lang === 'de' ? 'Lieferung' : 'Delivery'],
  ];

  const doubled = [...stats, ...stats];

  return (
    <div className="stats-ticker">
      <div className="stats-ticker-track">
        {doubled.map(([num, label], i) => (
          <div key={i} className="ticker-item">
            <span className="ticker-num">{num}</span>
            <span className="ticker-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function TrustBar({ lang }) {
  const items = [
    {
      icon: '🚚',
      title: lang === 'de' ? 'Kostenlos ab €30' : 'Free shipping over €30',
      sub: lang === 'de' ? 'DPD Lieferung in DE' : 'Fast DPD delivery in Germany'
    },
    {
      icon: '💰',
      title: lang === 'de' ? 'Bis zu 60% sparen' : 'Save up to 60%',
      sub: lang === 'de' ? 'Direkt importiert' : 'Imported directly'
    },
    {
      icon: '↩',
      title: lang === 'de' ? '14 Tage Rückgabe' : '14-day returns',
      sub: lang === 'de' ? 'Einfach & sicher' : 'Easy & secure'
    },
    {
      icon: '🔒',
      title: lang === 'de' ? 'Sichere Zahlung' : 'Secure checkout',
      sub: 'Stripe · PayPal · Cards'
    },
  ];

  return (
    <div className="trust-bar">
      <div className="trust-bar-inner">
        {items.map((item, i) => (
          <div key={i} className="trust-cell">
            <div className="trust-icon">{item.icon}</div>
            <div className="trust-text">
              <div className="trust-title">{item.title}</div>
              <div className="trust-sub">{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



function ReadingMoods({ lang }) {
  const moods = [
    { name: 'Thriller', emoji: '🔪', to: '/books?mood=thriller' },
    { name: 'Romance', emoji: '💖', to: '/books?mood=romance' },
    { name: 'Fantasy', emoji: '🧙‍♂️', to: '/books?mood=fantasy' },
    { name: 'Self-help', emoji: '💡', to: '/books?mood=selfhelp' },
  ];

  return (
    <section className="moods-section">
      <div className="container">
        <h2 className="section-title">
          {lang === 'de' ? 'Nach Stimmung' : 'Shop by Mood'}
        </h2>

        <div className="moods-grid">
          {moods.map(m => (
            <Link key={m.name} to={m.to} className="mood-card">
              <span>{m.emoji}</span>
              <span>{m.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}




function Home() {
  const { t, i18n } = useTranslation();
  const [popularBooks, setPopularBooks] = useState([]);
  const [categorySections, setCategorySections] = useState([]);
  const { data = { visibleRoots: [] }, isLoading: catLoading } = useGetCategoriesQuery();

  const [heroBooks, setHeroBooks] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);

  const [heroFading, setHeroFading] = useState(false);

  const visibleCategories = Array.isArray(data.visibleRoots)
    ? [...data.visibleRoots].sort((a, b) => a.id - b.id)
    : [];

  useEffect(() => {
    axios.get('/api/books/popular')
      .then(res => setPopularBooks(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPopularBooks([]));
  }, []);

  // 1) Pick a randomized hero list ONCE whenever popularBooks loads/changes
  useEffect(() => {
    if (popularBooks && popularBooks.length > 0) {
      const shuffled = [...popularBooks].sort(() => 0.5 - Math.random());
      setHeroBooks(shuffled);
      setHeroIndex(0);
    } else {
      setHeroBooks([]);
      setHeroIndex(0);
    }
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
        const filtered = allBooks.filter(b => b.is_new_release === 1).slice(0, 12);
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


      <StatsTicker lang={i18n.resolvedLanguage} />
      <TrustBar lang={i18n.resolvedLanguage} />


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

              <div className={`wp-hero__mockGrid ${heroFading ? 'wp-hero__mockGrid--fade' : ''}`}>
                {heroBooks && heroBooks.length > 0 ? (
                  // show 4 books starting from heroIndex, wrap around
                  heroBooks
                    .slice(heroIndex, heroIndex + 4)
                    .concat(heroBooks.slice(0, Math.max(0, heroIndex + 4 - heroBooks.length)))
                    .map((book) => {
                      const to = generateBookUrl(book); // same routing logic as BookCard [1](https://boehringer-my.sharepoint.com/personal/nilanjan_chatterjee_boehringer-ingelheim_com/Documents/EnglischBuecher/project/frontend/src/utils/seoUrl.js?web=1)[2](https://boehringer-my.sharepoint.com/personal/nilanjan_chatterjee_boehringer-ingelheim_com/Documents/Forms/DispForm.aspx?ID=268856&web=1)
                      const title = book.title_en || book.title_de || book.title || 'Book';

                      return (
                        <Link
                          key={book.id}
                          to={to}
                          className="wp-hero__bookLink"
                          aria-label={`View ${title}`}
                        >
                          <img
                            src={book.image ? book.image : 'https://via.placeholder.com/300x400?text=Book'}
                            alt={title}
                            className="wp-hero__bookCover"
                            loading="lazy"
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

      <ReadingMoods lang={i18n.resolvedLanguage} />

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