// frontend/src/components/Banner/Banner.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useGetHeroBannersQuery } from '../../admin/features/hero/heroBannerApiSlice';
import { useGetFeaturedBooksQuery } from '../../admin/features/book/bookApiSlice'; // ← THIS LINE
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Banner.css';

const Banner = () => {
  const { i18n } = useTranslation();

  // Hero Banners
  const { data: banners = [], isLoading: bannersLoading } = useGetHeroBannersQuery();
  const activeBanners = banners.filter(b => b.is_active);

  // Featured Books — THIS IS THE NEW PART
  //const { data: featuredBooks = [], isLoading: booksLoading } = useGetFeaturedBooksQuery();
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
    <div className="relative w-full h-96 md:h-[80vh] lg:h-[75vh] max-h-screen overflow-hidden bg-black">
      {/* HERO BACKGROUND SLIDES */}
      <div className="absolute inset-0">
        {activeBanners.map((banner, i) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${i === currentIndex ? 'opacity-100' : 'opacity-0'}`}
          >
            <div
              className="w-full h-full bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%), url(${banner.image_url})`,
              }}
            />
          </div>
        ))}
      </div>

      {/* CONTENT GRID */}
      <div className="relative container mx-auto px-6 h-full flex items-center z-10">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-white pl-0 md:pl-12 lg:pl-32 xl:pl-48"> {/* THIS LINE DOES THE MAGIC */}
            <div className="max-w-4xl">
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight drop-shadow-2xl">
                {i18n.language === 'de' ? current.title_de || current.title_en : current.title_en}
              </h1>
              <p className="text-xl md:text-3xl mb-10 opacity-95 max-w-2xl drop-shadow-lg">
                {i18n.language === 'de' ? current.subtitle_de || current.subtitle_en : current.subtitle_en}
              </p>
              <Link
                to={current.button_link || '/books'}
                className="inline-block px-12 py-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-2xl font-bold rounded-full hover:shadow-2xl transform hover:scale-105 transition shadow-2xl"
              >
                {i18n.language === 'de'
                  ? current.button_text_de || 'Jetzt entdecken'
                  : current.button_text_en || 'Shop Now'}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ARROWS & DOTS */}
      {activeBanners.length > 1 && (
        <>
          <button onClick={goToPrevious} className="absolute left-8 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur p-4 rounded-full transition z-20">
            <ChevronLeft className="w-10 h-10" />
          </button>
          <button onClick={goToNext} className="absolute right-8 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur p-4 rounded-full transition z-20">
            <ChevronRight className="w-10 h-10" />
          </button>
        </>
      )}
    </div>
  );
};

export default Banner;