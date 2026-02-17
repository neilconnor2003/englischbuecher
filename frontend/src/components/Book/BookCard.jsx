
// frontend/src/components/Book/BookCard.jsx
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, message, Rate } from 'antd';
import {
  ShoppingCartOutlined,
  HeartOutlined,
  HeartFilled,
  CheckOutlined
} from '@ant-design/icons';
import { mergeServerCart, addItem } from '../../features/cart/cartSlice';
import { toggleWishlist, fetchWishlist } from '../../features/wishlist/wishlistSlice';
import { useTranslation } from 'react-i18next';
import './BookCard.css';
import axios from 'axios';
import config from '../../config';
import { generateBookUrl } from '../../utils/seoUrl';

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Centralized BookCard component
 * Props:
 * - book: required book object
 * - variant: 'default' | 'compact' | * - variant: 'default' | 'compact' | 'large'
 * - showActions: boolean (default true)
 * - className: optional outer class
 */
const BookCard = ({ book, variant = 'default', showActions = true, className = '' }) => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  // User from Redux
  const user = useSelector(state => state.auth?.user || state.auth);

  // Robust title selection for mixed payloads
  const title =
    i18n.resolvedLanguage === 'de'
      ? (book.title_de || book.title_en || book.title || book.name)
      : (book.title_en || book.title_de || book.title || book.name);

  // Robust price selection for mixed payloads
  const price = toNumber(book.price ?? book.sale_price ?? book.final_price);
  const originalPrice = toNumber(
    book.original_price ?? book.list_price ?? book.mrp ?? book.price_original
  );
  const discountPercent =
    originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  // Wishlist state
  const isWishlisted = useSelector(
    state => state.wishlist?.items?.some(item => item.id === book.id) ?? false
  );

  // Cart state (support various id shapes)
  const isInCart = useSelector(
    state =>
      state.cart?.items?.some(item => {
        const cartBookId = item.bookId;
        const currentBookId = book.id || book.book_id || book.bookId || book._id;
        return cartBookId === currentBookId;
      }) ?? false
  );

  const to = generateBookUrl(book);

  /*const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInCart) {
      message.info(t('already_in_cart') || 'Dieses Buch ist bereits im Warenkorb');
      return;
    }

    try {
      await axios.post(
        `${config.API_URL}/api/cart/add`,
        { bookId: book.id },
        { withCredentials: true }
      );
      const res = await axios.get(`${config.API_URL}/api/cart`, { withCredentials: true });
      dispatch(mergeServerCart({ items: res.data.items || [] }));
      message.success(`${title} ${t('added_to_cart')}`);
    } catch (err) {
      console.error('Add to cart error:', err.response?.data || err.message);
      message.error(t('error_adding_to_cart') || 'Fehler beim Hinzufügen');
    }
  };*/

  
const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInCart) {
      message.info(t('already_in_cart') || 'Dieses Buch ist bereits im Warenkorb');
      return;
    }

    // Signed-in user → server cart
    if (user && user.id) {
      try {
        await axios.post(
          `${config.API_URL}/api/cart/add`,
          { bookId: book.id, quantity: 1 },
          { withCredentials: true }
        );

        const res = await axios.get(`${config.API_URL}/api/cart`, { withCredentials: true });
        dispatch(mergeServerCart({ items: res.data.items || [] }));

        message.success(`${title} ${t('added_to_cart') || 'zum Warenkorb hinzugefügt'}`);
      } catch (err) {
        const msg = err?.response?.data?.error || err?.message || 'Unauthorized';
        console.error('Add to cart error:', err?.response?.data || err.message);
        if (err?.response?.status === 401) {
          message.warning(t('login_required') || 'Bitte melde dich an');
        } else {
          message.error(t('error_adding_to_cart') || 'Fehler beim Hinzufügen');
        }
      }
      return;
    }

    // Guest → local cart (Redux + localStorage)
    try {
      // Build minimal book payload for the client cart
      const clientBookPayload = {
        title_en: book.title_en || title,
        title_de: book.title_de || null,
        image: book.image || 'https://via.placeholder.com/300x400?text=Book',
        slug: book.slug || book.id?.toString(),
        stock: typeof book.stock === 'number' ? book.stock : Infinity,
        price,                 // numeric price
        original_price: originalPrice,
        sale_price: book.sale_price ?? null,
      };

      dispatch(addItem({
        bookId: book.id,
        quantity: 1,
        book: clientBookPayload,
      }));

      message.success(`${title} ${t('added_to_cart') || 'zum Warenkorb hinzugefügt'}`);
    } catch (err) {
      console.error('Guest add to cart failed:', err?.message || err);
      message.error(t('error_adding_to_cart') || 'Fehler beim Hinzufügen');
    }
  };



  // BookCard.jsx → replace handleWishlist with this
  const handleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const result = await dispatch(toggleWishlist(book.id)).unwrap();
      // refresh local list
      dispatch(fetchWishlist());
      message.success(
        result.added
          ? t('added_to_wishlist') || 'Zur Wunschliste hinzugefügt'
          : t('removed_from_wishlist') || 'Von der Wunschliste entfernt'
      );
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 401) {
        message.warning(t('login_required') || 'Bitte melde dich an');
      } else {
        message.error(t('wishlist_error') || 'Fehler beim Aktualisieren der Wunschliste');
      }
    }
  };

  const rootClass = `book-card book-card--${variant} ${className}`.trim();

  return (
    <article className={rootClass}>
      {/* Wishlist heart (top-right) */}
      <Button
        type="text"
        shape="circle"
        size="large"
        icon={isWishlisted ? <HeartFilled style={{ color: '#e91e63' }} /> : <HeartOutlined />}
        onClick={handleWishlist}
        className="wishlist-heart-btn"
      />

      {/* Visual/top area */}
      <Link to={to} className="book-card-link">
        <img
          src={book.image || 'https://via.placeholder.com/300x400?text=Book'}
          alt={title}
          loading="lazy"
        />

        {/* Title */}
        <h3>{title}</h3>

        {/* Author */}
        <p className="author">{book.author || 'Unknown Author'}</p>

        {/* Rating summary (one line; no top ribbon) */}
        <div className="rating-summary">
          <Rate disabled allowHalf value={toNumber(book.rating)} className="rating-stars-inline" />
          <span className="rating-info">
            {book.rating ? toNumber(book.rating).toFixed(1) : '0.0'}
            {book.review_count > 0 ? ` (${book.review_count})` : ''}
          </span>
        </div>

        {/* Price block */}
        <div className="price-block">
          {originalPrice > price && (
            <span className="original-price">€{originalPrice.toFixed(2)}</span>
          )}
          <span className="current-price">€{price.toFixed(2)}</span>
          {discountPercent > 0 && (
            <span className="discount-badge">-{discountPercent}%</span>
          )}
        </div>
      </Link>

      {/* Actions */}
      {showActions && (
        <div className="book-actions">
          <Button
            type="primary"
            icon={isInCart ? <CheckOutlined /> : <ShoppingCartOutlined />}
            onClick={handleAddToCart}
            block
            disabled={book.stock === 0}
          >
            {book.stock === 0
              ? 'Out of Stock'
              : isInCart
                ? (t('already_in_cart') || 'In Cart')
                : t('add_to_cart')}
          </Button>

          <Link to={to} className="details-link">
            {t('home.details') || 'Details'}
          </Link>
        </div>
      )}
    </article>
  );
};

export default BookCard;
