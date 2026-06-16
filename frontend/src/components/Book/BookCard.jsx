
// frontend/src/components/Book/BookCard.jsx
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Button, message, Rate } from 'antd';
import {
  ShoppingCartOutlined,
  HeartOutlined,
  HeartFilled,
  CheckOutlined
} from '@ant-design/icons';
import { mergeServerCart, addItem, replaceWithServerCart } from '../../features/cart/cartSlice';
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

const de = i18n.resolvedLanguage === 'de';

/**
 * Centralized BookCard component
 * Props:
 * - book: required book object
 * - variant: 'default' | 'compact' | 'large'
 * - showActions: boolean (default true)
 * - className: optional outer class
 */
const BookCard = ({ book, variant = 'default', showActions = true, className = '' }) => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  // User from Redux
  const { user } = useContext(AuthContext);

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
        dispatch(replaceWithServerCart({ items: res.data.items || [] }));

        message.success(`${title} ${t('added_to_cart') || 'zum Warenkorb hinzugefügt'}`);
      } catch (err) {
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
      const clientBookPayload = {
        title_en: book.title_en || title,
        title_de: book.title_de || null,
        image: book.image || 'https://via.placeholder.com/300x400?text=Book',
        slug: book.slug || book.id?.toString(),
        stock: typeof book.stock === 'number' ? book.stock : Infinity,
        price,
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

  const handleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const result = await dispatch(toggleWishlist(book.id)).unwrap();
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

  const formatOneDecimal = (value, i18n) => {
    const locale = i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Number(value) || 0);
  };

  const formatCurrency = (value, i18n) => {
    const locale = i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  };

  // Tag logic: priority is new release > bestseller > nothing
  // (uses existing book fields — no new data needed)
  const tag = book.is_new_release
    ? { label: de ? 'Neu' : 'New', kind: 'new' }
    : book.is_bestseller
      ? { label: de ? 'Beliebt' : 'Hot', kind: 'hot' }
      : book.is_book_of_week
        ? { label: de ? 'Tipp' : 'Pick', kind: 'pick' }
        : null;

  return (
    <article className={rootClass}>
      {/* Wishlist heart — sibling to Link, not nested inside it,
          so clicking it never triggers navigation */}
      <button
        type="button"
        className={`book-wish-float${isWishlisted ? ' book-wish-float--on' : ''}`}
        onClick={handleWishlist}
        aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        {isWishlisted ? <HeartFilled /> : <HeartOutlined />}
      </button>

      <Link to={to} className="book-card-link">
        {/* ── Cover with text overlay ── */}
        <div className="book-cover">
          <img
            src={book.image || 'https://via.placeholder.com/300x400?text=Book'}
            alt={title}
            loading="lazy"
            className="book-cover-img"
          />

          {tag && <span className={`book-tag book-tag--${tag.kind}`}>{tag.label}</span>}

          {discountPercent > 0 && (
            <span className="book-disc">-{discountPercent}%</span>
          )}

          <div className="book-cover-content">
            <h3 className="book-title-ov">{title}</h3>
            <p className="book-author-ov">{book.author || 'Unknown Author'}</p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="book-body">
          <div className="book-stars-row">
            <Rate
              disabled
              allowHalf
              value={toNumber(book.rating)}
              className="book-stars"
            />
            <span className="book-rating">
              {formatOneDecimal(toNumber(book.rating), i18n)}
              {book.review_count > 0 ? ` (${book.review_count})` : ''}
            </span>
          </div>

          <div className="book-price-row">
            <span className="book-price">{formatCurrency(price, i18n)}</span>
            {originalPrice > price && (
              <span className="book-was">{formatCurrency(originalPrice, i18n)}</span>
            )}
            {discountPercent > 0 && (
              <span className="book-save">
                {de_save_label(discountPercent, i18n)}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* ── Add to cart — sibling to Link too, since it's a button
          with its own click handler, not a navigation target ── */}
      {showActions && (
        <div className="book-btns">
          <button
            type="button"
            className="btn-cart"
            onClick={handleAddToCart}
            disabled={book.stock === 0}
          >
            {book.stock === 0 ? (
              t('out_of_stock')
            ) : isInCart ? (
              <><CheckOutlined /> {t('already_in_cart') || 'In Cart'}</>
            ) : (
              <><ShoppingCartOutlined /> {t('add_to_cart')}</>
            )}
          </button>
        </div>
      )}
    </article>
  );
};

// Small helper kept local to avoid importing extra deps just for one label
function de_save_label(percent, i18n) {
  return i18n.resolvedLanguage === 'de' ? `-${percent}%` : `Save ${percent}%`;
}

export default BookCard;
