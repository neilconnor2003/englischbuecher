// frontend/src/pages/Wishlist/Wishlist.jsx
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import BookCard from '../../components/Book/BookCard';
import { fetchWishlist } from '../../features/wishlist/wishlistSlice';
import './Wishlist.css';

import { createSelector } from '@reduxjs/toolkit';

const selectWishlistBooks = createSelector(
  state => state.wishlist?.items,
  items => items?.map(item => item.book).filter(Boolean) || []
);

function Wishlist() {
  const { t, i18n } = useTranslation();
  const de = i18n.resolvedLanguage === 'de';
  const dispatch = useDispatch();

  const wishlistBooks = useSelector(selectWishlistBooks);
  const loading = useSelector(state => state.wishlist?.loading ?? false);

  useEffect(() => {
    dispatch(fetchWishlist());
  }, [dispatch]);

  if (loading) return <div className="loading">Loading wishlist...</div>;

  if (wishlistBooks.length === 0) {
    return (
      <div className="wishlist-page">
        <div className="container">
          <h1 className="wishlist-title">
            <span className="wishlist-title-icon">♥</span>
            {t('my_wishlist') || 'My Wishlist'}
          </h1>
          <div className="empty-wishlist">
            <div className="empty-wishlist__icon">♡</div>
            <h2 className="empty-wishlist__title">
              {de ? 'Deine Wunschliste ist noch leer' : 'Your wishlist is still empty'}
            </h2>
            <p className="empty-wishlist__desc">
              {de
                ? 'Tippe auf das Herz bei einem Buch, um es hier zu speichern und später wiederzufinden.'
                : "Tap the heart on any book to save it here and find it again later."}
            </p>
            <Link to="/books" className="empty-wishlist__cta">
              {de ? 'Bücher entdecken' : 'Discover books'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wishlist-page">
      <div className="container">
        <h1 className="wishlist-title">
          <span className="wishlist-title-icon">♥</span>
          {t('my_wishlist') || 'My Wishlist'}
        </h1>
        <p className="wishlist-count">
          {wishlistBooks.length} {de
            ? (wishlistBooks.length === 1 ? 'Buch gemerkt' : 'Bücher gemerkt')
            : (wishlistBooks.length === 1 ? 'book saved' : 'books saved')}
        </p>
        <div className="wishlist-grid">
          {wishlistBooks.map(book => (
            <div className="popular-card-wrapper" key={book.id}>
              <BookCard book={book} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Wishlist;