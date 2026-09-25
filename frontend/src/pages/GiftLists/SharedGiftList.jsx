// frontend/src/pages/GiftLists/SharedGiftList.jsx
import React, { useContext, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import config from '../../config';
import { AuthContext } from '../../context/AuthContext';
import { addItem, replaceWithServerCart } from '../../features/cart/cartSlice';
import { addGiftClaim } from '../../utils/giftClaims';
import { Gift, Check, ShoppingCart } from 'lucide-react';
import { toast } from 'react-toastify';
import BookCard from '../../components/Book/BookCard';
import './GiftLists.css';

export default function SharedGiftList() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const dispatch = useDispatch();
  const { user } = useContext(AuthContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null); // itemId currently being added

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${config.API_URL}/api/gift-lists/shared/${slug}`, { withCredentials: true });
      setData(data);
    } catch (err) {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (item) => {
    const remaining = item.quantity_desired - (item.quantity_given || 0);
    const outOfStock = typeof item.stock === 'number' && item.stock <= 0;
    if (remaining <= 0 || outOfStock) return;
    setAdding(item.id);

    try {
      if (!user || !user.id) {
        // Guest: same local-cart path used elsewhere on the site.
        dispatch(addItem({
          bookId: item.book_id,
          quantity: 1,
          book: {
            title_en: item.title_en,
            title_de: item.title_de,
            image: item.image,
            slug: item.slug,
            stock: typeof item.stock === 'number' ? item.stock : Infinity,
            price: item.price,
          },
        }));
      } else {
        await axios.post(`${config.API_URL}/api/cart/add`, { bookId: item.book_id, quantity: 1 }, { withCredentials: true });
        const res = await axios.get(`${config.API_URL}/api/cart`, { withCredentials: true });
        dispatch(replaceWithServerCart({ items: res.data.items || [] }));
      }

      // Remember this addition is a gift claim, read back at checkout.
      addGiftClaim(item.book_id, item.id, 1);
      toast.success(t('added_to_cart') || 'Added to cart');
    } catch (err) {
      toast.error(t('update_failed') || 'Failed to add to cart');
    } finally {
      setAdding(null);
    }
  };

  if (loading) return <div className="gl-page"><div className="gl-loading">{t('loading') || 'Loading...'}</div></div>;

  if (!data) {
    return (
      <div className="gl-page">
        <div className="gl-container">
          <div className="gl-empty">
            <Gift size={40} className="gl-empty-icon" />
            <p>{t('gift_list_not_found') || "This list doesn't exist or is no longer available."}</p>
            <Link to="/" className="gl-btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
              {t('back_to_home') || 'Back to Home'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { list, items, isOwnerViewing } = data;

  return (
    <div className="gl-page">
      <div className="gl-container">
        <div className="gl-shared-hero">
          <Gift size={32} />
          <h1 className="gl-title" style={{ margin: 0 }}>{list.title}</h1>
          {list.occasion && <p className="gl-shared-occasion">{list.occasion}</p>}
          {isOwnerViewing && (
            <p className="gl-owner-notice">
              {t('gift_list_owner_notice') || "This is your own list — you won't see what's already been given, to keep it a surprise."}
            </p>
          )}
        </div>

        {items.length === 0 ? (
          <div className="gl-empty"><p>{t('gift_list_empty') || 'This list is empty.'}</p></div>
        ) : (
          <div className="gl-shared-grid">
            {items.map(it => {
              const total = it.quantity_desired || 1;
              const given = it.quantity_given || 0;
              const remaining = total - given;
              const fullyGiven = remaining <= 0;
              const outOfStock = typeof it.stock === 'number' && it.stock <= 0;
              const pct = total > 0 ? Math.min(100, Math.round((given / total) * 100)) : 0;

              const bookForCard = {
                id: it.book_id,
                title_en: it.title_en,
                title_de: it.title_de,
                image: it.image,
                slug: it.slug,
                isbn13: it.isbn13,
                isbn10: it.isbn10,
                price: it.price,
                stock: it.stock,
              };

              // Always a numeric "X of Y given" line — shown even at 0 of N so
              // buttons line up across every tile in the row regardless of state.
              let progressText;
              if (fullyGiven) {
                progressText = t('gift_progress_complete_of', { total }) || `All ${total} given — thank you! 🎉`;
              } else {
                progressText = t('gift_progress_partial', { given, total }) || `${given} ${t('of') || 'of'} ${total} ${t('already_given') || 'already given'}`;
              }

              return (
                <div key={it.id} className="gl-shared-tile">
                  <BookCard book={bookForCard} showActions={false} />

                  <div className="gl-shared-tile-footer">
                    <div className="gl-progress-bar" aria-hidden="true">
                      <div className="gl-progress-fill" style={{ width: `${pct}%` }} />
                    </div>

                    <p className="gl-progress-note">{progressText}</p>

                    <div className="gl-shared-tile-action">
                      {fullyGiven ? (
                        <div className="gl-given-badge"><Check size={14} /> {t('already_given_full') || 'Already given'}</div>
                      ) : outOfStock ? (
                        <button className="gl-btn-primary gl-shared-add-btn" disabled>
                          {t('out_of_stock') || 'Out of Stock'}
                        </button>
                      ) : (
                        <button
                          className="gl-btn-primary gl-shared-add-btn"
                          disabled={adding === it.id}
                          onClick={() => handleAddToCart(it)}
                        >
                          <ShoppingCart size={15} />
                          {adding === it.id ? (t('adding') || 'Adding...') : (t('add_to_cart') || 'Add to Cart')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
