
// frontend/src/components/Book/BookCard.jsx
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Button, message, Rate } from 'antd';
import {
  ShoppingCartOutlined,
  ThunderboltOutlined,
  HeartOutlined,
  HeartFilled,
  CheckOutlined,
  StopOutlined
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

/**
 * Centralized BookCard component
 * Props:
 * - book: required book object
 * - variant: 'default' | 'compact' | 'large'
 * - showActions: boolean (default true)
 * - className: optional outer class
 */
// ── Build optimised WebP image URL via /api/image resize endpoint ──
// Falls back to original URL if it's already absolute (external CDN etc.)
const optimisedImg = (url, width = 300) => {
  if (!url) return 'https://via.placeholder.com/300x400?text=Book';
  if (!url.startsWith('/uploads/')) return url; // already absolute/external
  return `${config.API_URL}/api/image?src=${encodeURIComponent(url)}&w=${width}&q=80`;
};


const BookCard = ({ book, variant = 'default', showActions = true, className = '' }) => {
  const { t, i18n } = useTranslation();
  const de = i18n.resolvedLanguage === 'de';
  const dispatch = useDispatch();
  const navigate = useNavigate();

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

  const handleAddToCart = async (e, goToCheckout = false) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInCart) {
      if (goToCheckout) {
        navigate('/checkout');
      } else {
        message.info(t('already_in_cart') || 'Dieses Buch ist bereits im Warenkorb');
      }
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

        if (goToCheckout) {
          navigate('/checkout');
        } else {
          message.success(`${title} ${t('added_to_cart') || 'zum Warenkorb hinzugefügt'}`);
        }
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
        image: optimisedImg(book.image),
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

      if (goToCheckout) {
        navigate('/checkout');
      } else {
        message.success(`${title} ${t('added_to_cart') || 'zum Warenkorb hinzugefügt'}`);
      }
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
      <Link to={to} className="book-card-link">
        {/* ── Cover with text overlay ── */}
        <div className="book-cover">
          <img
            src={optimisedImg(book.image, 300)}
            alt={title}
            loading="lazy"
            className="book-cover-img"
          />

          {tag && <span className={`book-tag book-tag--${tag.kind}`}>{tag.label}</span>}

          {discountPercent > 0 && (
            <span className="book-disc">
              <span className="book-disc-num">-{discountPercent}%</span>
            </span>
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
          </div>
        </div>
      </Link>

      {/* ── Action row — sibling to Link, since these are buttons
          with their own click handlers, not navigation targets ── */}
      {showActions && (
        <div className="book-btns">
          <button
            type="button"
            className="btn-cart"
            onClick={(e) => handleAddToCart(e, false)}
            disabled={book.stock === 0}
          >
            {book.stock === 0 ? (
              <><StopOutlined /> <span className="btn-cart-text">{t('out_of_stock')}</span></>
            ) : isInCart ? (
              <><CheckOutlined /> <span className="btn-cart-text">{t('already_in_cart') || 'In Cart'}</span></>
            ) : (
              <><ShoppingCartOutlined /> <span className="btn-cart-text">{t('add_to_cart')}</span></>
            )}
          </button>

          <button
            type="button"
            className="btn-buy-now"
            onClick={(e) => handleAddToCart(e, true)}
            disabled={book.stock === 0}
            aria-label={t('buy_now') || 'Buy now'}
            title={t('buy_now') || 'Buy now'}
          >
            <ThunderboltOutlined />
            <span className="btn-buy-now-label">{t('buy_now') || 'Buy'}</span>
          </button>

          <button
            type="button"
            className={`btn-wishlist${isWishlisted ? ' btn-wishlist--on' : ''}`}
            onClick={handleWishlist}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            {isWishlisted ? <HeartFilled /> : <HeartOutlined />}
          </button>
        </div>
      )}
    </article>
  );
};

export default BookCard;
