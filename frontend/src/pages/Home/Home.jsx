
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
      <Banner />

      {/* CATEGORY ICONS */}
      {visibleCategories.length > 0 && (
        <section className="categories-section">
          <div className="container">
            <h2 className="section-title">
              <Sparkles className="title-icon" size={36} />
              {t('categories')}
            </h2>
            <div className="categories-grid">
              {visibleCategories.map(cat => (
                <Link
                  key={cat.id}
                  to={`/books?category=${cat.id}`}
                  className="category-card"
                >
                  {cat.icon_path ? (
                    <img src={`${config.API_URL}${cat.icon_path}`} alt="" className="category-icon" />
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
              className="popular-swiper"
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
              className="new-arrivals-swiper"
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
              className="category-books-swiper"
            />
          </div>
        </section>
      ))}
       </div>
  );
}

export default Home;