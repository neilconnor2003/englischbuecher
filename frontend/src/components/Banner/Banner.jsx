// frontend/src/components/Banner/Banner.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useGetHeroBannersQuery } from '../../admin/features/hero/heroBannerApiSlice';
import { useGetFeaturedBooksQuery } from '../../admin/features/book/bookApiSlice';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Banner.css';

const Banner = () => {
  const { i18n } = useTranslation();

  // Hero Banners
  const { data: banners = [], isLoading: bannersLoading } = useGetHeroBannersQuery();
  const activeBanners = banners.filter(b => b.is_active);

  const {
    data: featuredBooks = [],
    isLoading: booksLoading,
    isSuccess: booksSuccess
  } = useGetFeaturedBooksQuery(undefined, {
    refetchOnMountOrArgChange: true
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-rotate hero
  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activeBanners.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [activeBanners.length]);

  const goToNext = () => setCurrentIndex(prev => (prev + 1) % activeBanners.length);
  const goToPrevious = () => setCurrentIndex(prev => (prev - 1 + activeBanners.length) % activeBanners.length);

  if (bannersLoading || activeBanners.length === 0) return null;
  const current = activeBanners[currentIndex];

  return (
    <div className="hero-banner">
      {/* HERO BACKGROUND SLIDES — real admin-uploaded photos.
          Each banner's own image already has a deep purple wash on the
          left (per the source images), so the overlay here is light —
          just enough to guarantee text contrast, not a wholesale wash. */}
      <div className="hero-banner__slides">
        {activeBanners.map((banner, i) => (
          <div
            key={banner.id}
            className={`hero-banner__slide ${i === currentIndex ? 'is-active' : ''}`}
            style={{ backgroundImage: `url(${banner.image_url})` }}
          />
        ))}
      </div>
      <div className="hero-banner__scrim" aria-hidden="true" />

      <div className="hero-banner__inner">
        <div className="hero-banner-content" key={current.id}>
          <p className="hero-banner__eyebrow">
            <span className="hero-banner__eyebrow-dot" />
            {i18n.language === 'de' ? 'Englische Bücher in Deutschland' : 'English books in Germany'}
          </p>

          <h1>{i18n.language === 'de' ? current.title_de ?? current.title_en : current.title_en}</h1>

          <p className="hero-banner__subtitle">
            {i18n.language === 'de'
              ? current.subtitle_de ?? current.subtitle_en
              : current.subtitle_en}
          </p>

          <div className="hero-banner__actions">
            <Link to={current.button_link || '/books'} className="hero-banner-button">
              {i18n.language === 'de'
                ? current.button_text_de ?? 'Jetzt entdecken'
                : current.button_text_en ?? 'Shop Now'}
            </Link>
            {/*<Link to="/books" className="hero-banner-button hero-banner-button--ghost">
              {i18n.language === 'de' ? 'Alle Bücher' : 'Browse all'}
            </Link>*/}
          </div>
        </div>
      </div>

      {/* ARROWS & DOTS */}
      {activeBanners.length > 1 && (
        <>
          <button onClick={goToPrevious} className="hero-arrow hero-arrow--prev" aria-label="Previous">
            <ChevronLeft className="w-7 h-7" />
          </button>
          <button onClick={goToNext} className="hero-arrow hero-arrow--next" aria-label="Next">
            <ChevronRight className="w-7 h-7" />
          </button>
          <div className="hero-banner__dots">
            {activeBanners.map((b, i) => (
              <button
                key={b.id}
                className={`hero-banner__dot ${i === currentIndex ? 'is-active' : ''}`}
                onClick={() => setCurrentIndex(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Banner;
