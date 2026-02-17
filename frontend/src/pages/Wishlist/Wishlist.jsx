// frontend/src/pages/Wishlist/Wishlist.jsx
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import BookCard from '../../components/Book/BookCard';
import { fetchWishlist } from '../../features/wishlist/wishlistSlice';
import './Wishlist.css';

import { createSelector } from '@reduxjs/toolkit';

const selectWishlistBooks = createSelector(
  state => state.wishlist?.items,
  items => items?.map(item => item.book).filter(Boolean) || []
);

function Wishlist() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  /*const wishlistBooks = useSelector(state => 
    state.wishlist?.items?.map(item => item.book).filter(Boolean) || []
  );*/
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
          <h1>{t('my_wishlist') || 'My Wishlist'}</h1>
          <div className="empty-wishlist">
            {t('wishlist_empty') || 'Your wishlist is empty'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wishlist-page">
      <div className="container">
        <h1>{t('my_wishlist') || 'My Wishlist'}</h1>
        <div className="wishlist-grid">
          {wishlistBooks.map(book => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Wishlist;