// frontend/src/pages/GiftLists/SharedGiftList.jsx
import React, { useContext, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import config from '../../config';
import { AuthContext } from '../../context/AuthContext';
import { addItem, replaceWithServerCart } from '../../features/cart/cartSlice';
import { addGiftClaim, getGiftClaims, setLastGiftListSlug } from '../../utils/giftClaims';
import { Gift, Check, ShoppingCart, Calendar, PartyPopper } from 'lucide-react';
import { toast } from 'react-toastify';
import BookCard from '../../components/Book/BookCard';
import './GiftLists.css';

export default function SharedGiftList() {
  const { t, i18n } = useTranslation();
  const { slug } = useParams();
  const dispatch = useDispatch();
  const { user } = useContext(AuthContext);
  const cartItems = useSelector((state) => state.cart?.items) || [];

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null); // itemId currently being added
  const [, setClaimsVersion] = useState(0);   // re-render after a claim is recorded

  useEffect(() => {
    setLastGiftListSlug(slug);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.id]);

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

  // How many of this gift-list item are currently sitting in THIS visitor's
  // cart. A claim only counts while the book is really still in the cart
  // (removing it from the cart frees the claim again).
  const inCartFor = (item) => {
    const claimed = getGiftClaims()
      .filter(c => c.giftListItemId === item.id)
      .reduce((sum, c) => sum + Number(c.quantity || 0), 0);
    const cartQty = cartItems
      .filter(ci => Number(ci.bookId) === Number(item.book_id))
      .reduce((sum, ci) => sum + Number(ci.quantity || 0), 0);
    return Math.min(claimed, cartQty);
  };

  const handleAddToCart = async (item) => {
    const remaining = item.quantity_desired - (item.quantity_given || 0) - inCartFor(item);
    const outOfStock = typeof item.stock === 'number' && item.stock <= 0;
    if (remaining <= 0 || outOfStock || adding) return;
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
      setClaimsVersion(v => v + 1);
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
            <Link to="/" className="gl-btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', marginTop: 16 }}>
              {t('back_to_home') || 'Back to Home'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { list, items, isOwnerViewing } = data;
  const locale = i18n.language === 'de' ? 'de-DE' : 'en-GB';

  const eventDate = list.event_date ? new Date(list.event_date) : null;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const eventPassed = !!(eventDate && eventDate < startOfToday);

  const totalWanted = items.reduce((s, it) => s + (it.quantity_desired || 1), 0);
  const totalGiven = items.reduce((s, it) => s + Math.min(it.quantity_given || 0, it.quantity_desired || 1), 0);
  const overallPct = totalWanted > 0 ? Math.round((totalGiven / totalWanted) * 100) : 0;

  return (
    <div className="gl-page">
      <div className="gl-container">
        <div className="gl-banner">
          <div className="gl-banner-icon"><Gift size={26} /></div>
          <h1 className="gl-banner-title">{list.title}</h1>
          <div className="gl-banner-chips">
            {list.occasion && <span className="gl-banner-chip">{list.occasion}</span>}
            {eventDate && (
              <span className="gl-banner-chip">
                <Calendar size={12} /> {eventDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>

          {!isOwnerViewing && totalWanted > 0 && (
            <div className="gl-banner-progress">
              <div className="gl-banner-progress-bar"><div style={{ width: `${overallPct}%` }} /></div>
              <span>{t('gift_overall_progress', { given: totalGiven, total: totalWanted }) || `${totalGiven} of ${totalWanted} gifts given`}</span>
            </div>
          )}

          {isOwnerViewing && (
            <p className="gl-owner-notice">
              {t('gift_list_owner_notice') || "This is your own list — you won't see what's already been given, to keep it a surprise."}
            </p>
          )}
        </div>

        {eventPassed && !isOwnerViewing && (
          <div className="gl-note">
            {t('gift_event_passed') || 'This event has already taken place — a belated gift is still very welcome!'}
          </div>
        )}

        {items.length === 0 ? (
          <div className="gl-empty"><p>{t('gift_list_empty') || 'This list is empty.'}</p></div>
        ) : (
          <div className="gl-shared-grid">
            {items.map(it => {
              const total = it.quantity_desired || 1;
              const given = it.quantity_given || 0;
              const mine = it.quantity_given_by_me || 0;
              const inCart = inCartFor(it);
              const remaining = total - given;
              const fullyGiven = remaining <= 0;
              const coveredByMyCart = !fullyGiven && remaining - inCart <= 0;
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
              const progressText = fullyGiven
                ? (t('gift_progress_complete_of', { total }) || `All ${total} given — thank you! 🎉`)
                : (t('gift_progress_partial', { given, total }) || `${given} of ${total} already given`);

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
                        <div className="gl-given-badge">
                          {mine > 0
                            ? <><PartyPopper size={14} /> {t('gift_you_gave') || 'You gave this'}</>
                            : <><Check size={14} /> {t('already_given_full') || 'Already given'}</>}
                        </div>
                      ) : coveredByMyCart ? (
                        <Link to="/cart" className="gl-incart-badge">
                          <ShoppingCart size={14} /> {t('gift_in_cart') || 'In your cart'} · {t('gift_view_cart') || 'View cart'}
                        </Link>
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
