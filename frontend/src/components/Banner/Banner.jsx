// frontend/src/components/Banner/Banner.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useGetHeroBannersQuery } from '../../admin/features/hero/heroBannerApiSlice';
import { useGetFeaturedBooksQuery } from '../../admin/features/book/bookApiSlice';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Banner.css';

// Simple flat book-spine illustration — replaces the photographic
// background entirely. Crisp at any size, themeable via currentColor
// and the fill values below, and never looks washed out the way a
// low-contrast stock photo did.
const BookStackIllustration = () => (
  <svg viewBox="0 0 420 360" className="hero-illustration" aria-hidden="true">
    <g transform="translate(40, 30) rotate(-6)">
      <rect x="0" y="0" width="60" height="220" rx="6" fill="#C4B5FD" />
      <rect x="8" y="14" width="44" height="3" rx="1.5" fill="#5B21B6" opacity="0.5" />
      <rect x="8" y="24" width="30" height="3" rx="1.5" fill="#5B21B6" opacity="0.35" />
    </g>
    <g transform="translate(110, 10) rotate(-2)">
      <rect x="0" y="0" width="64" height="250" rx="6" fill="#FBBF24" />
      <rect x="9" y="16" width="46" height="3" rx="1.5" fill="#92400E" opacity="0.55" />
      <rect x="9" y="26" width="32" height="3" rx="1.5" fill="#92400E" opacity="0.4" />
    </g>
    <g transform="translate(185, 0) rotate(3)">
      <rect x="0" y="0" width="62" height="260" rx="6" fill="#F472B6" />
      <rect x="9" y="18" width="44" height="3" rx="1.5" fill="#831843" opacity="0.5" />
      <rect x="9" y="28" width="28" height="3" rx="1.5" fill="#831843" opacity="0.35" />
    </g>
    <g transform="translate(258, 18) rotate(-4)">
      <rect x="0" y="0" width="58" height="232" rx="6" fill="#7C3AED" />
      <rect x="8" y="15" width="40" height="3" rx="1.5" fill="#FFFFFF" opacity="0.55" />
      <rect x="8" y="25" width="26" height="3" rx="1.5" fill="#FFFFFF" opacity="0.4" />
    </g>
    <g transform="translate(60, 250)">
      <rect x="0" y="0" width="270" height="14" rx="4" fill="#5B21B6" opacity="0.25" />
    </g>
    {/* open book resting in front */}
    <g transform="translate(100, 255)">
      <path d="M0 30 L95 10 L95 60 L0 80 Z" fill="#FFFFFF" opacity="0.95" />
      <path d="M95 10 L190 30 L190 80 L95 60 Z" fill="#F3F0FF" opacity="0.95" />
      <line x1="95" y1="10" x2="95" y2="60" stroke="#C4B5FD" strokeWidth="2" />
    </g>
  </svg>
);

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
      {/* Illustrated gradient background — no photo. Each slide can still
          carry its own title/subtitle/CTA text, just no image_url behind it. */}
      <div className="hero-banner__bg" aria-hidden="true">
        <div className="hero-banner__blob hero-banner__blob--a" />
        <div className="hero-banner__blob hero-banner__blob--b" />
      </div>

      <div className="hero-banner__inner">
        <div className="hero-banner-content">
          <p className="hero-banner__eyebrow">
            {i18n.language === 'de' ? 'Englische Bücher · Faire Preise' : 'English books · Fair prices'}
          </p>
          <h1>{i18n.language === 'de' ? current.title_de ?? current.title_en : current.title_en}</h1>

          <p className="hero-banner__subtitle">
            {i18n.language === 'de'
              ? current.subtitle_de ?? current.subtitle_en
              : current.subtitle_en}
          </p>

          <Link to={current.button_link || '/books'} className="hero-banner-button">
            {i18n.language === 'de'
              ? current.button_text_de ?? 'Jetzt entdecken'
              : current.button_text_en ?? 'Shop Now'}
          </Link>
        </div>

        <div className="hero-banner__visual">
          <BookStackIllustration />
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