// frontend/src/pages/GiftLists/GivenGiftLists.jsx
// "Lists I gave from" — everything the logged-in visitor has bought for
// other people's gift lists, grouped by list, with a way back to each list.
import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import config from '../../config';
import { AuthContext } from '../../context/AuthContext';
import { generateBookUrl } from '../../utils/seoUrl';
import { Gift, ExternalLink, Calendar } from 'lucide-react';
import { toast } from 'react-toastify';
import GiftListTabs from './GiftListTabs';
import './GiftLists.css';

export default function GivenGiftLists() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isDe = i18n.language === 'de';
  const locale = isDe ? 'de-DE' : 'en-GB';

  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login?redirect=/lists/given'); return; }
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${config.API_URL}/api/gift-lists/given`, { withCredentials: true });
        setLists(Array.isArray(data) ? data : []);
      } catch {
        toast.error(t('gift_lists_load_failed') || 'Could not load your lists');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fmt = (d) => d ? new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <div className="gl-page">
      <div className="gl-container">
        <div className="gl-banner">
          <div className="gl-banner-icon"><Gift size={26} /></div>
          <h1 className="gl-banner-title">{t('gift_given_title') || 'Lists I gave from'}</h1>
          <p className="gl-banner-sub">
            {t('gift_given_sub') || 'Every gift you bought from someone else’s list — with a quick way back to each one.'}
          </p>
        </div>

        <GiftListTabs />

        {loading ? (
          <div className="gl-loading">{t('loading') || 'Loading...'}</div>
        ) : lists.length === 0 ? (
          <div className="gl-empty">
            <Gift size={40} className="gl-empty-icon" />
            <p>{t('gift_given_empty') || "You haven't given from any gift list yet. When you buy a gift from a shared list, it shows up here."}</p>
          </div>
        ) : (
          <div className="gl-given-stack">
            {lists.map(l => (
              <section key={l.list_id} className="gl-given-card">
                <header className="gl-given-head">
                  <div>
                    <h2 className="gl-given-title">{l.title}</h2>
                    <div className="gl-manage-meta">
                      {l.occasion && <span className="gl-manage-meta-item">{l.occasion}</span>}
                      {l.event_date && (
                        <span className="gl-manage-meta-item"><Calendar size={12} /> {fmt(l.event_date)}</span>
                      )}
                    </div>
                  </div>
                  {l.share_slug ? (
                    <Link to={`/g/${l.share_slug}`} className="gl-btn-ghost" style={{ textDecoration: 'none' }}>
                      <ExternalLink size={14} /> {t('gift_given_open_list') || 'Open list'}
                    </Link>
                  ) : (
                    <span className="gl-given-gone">{t('gift_given_unavailable') || 'This list is no longer available'}</span>
                  )}
                </header>

                <ul className="gl-given-items">
                  {l.gifts.map((g, i) => {
                    const url = generateBookUrl({
                      id: g.book_id, title_en: g.title_en, title_de: g.title_de,
                      slug: g.slug, isbn13: g.isbn13, isbn10: g.isbn10,
                    });
                    return (
                      <li key={`${g.order_id}-${g.book_id}-${i}`} className="gl-given-item">
                        <img src={g.image} alt="" className="gl-given-cover" />
                        <div className="gl-given-info">
                          <Link to={url} className="gl-given-book">{(isDe ? (g.title_de || g.title_en) : (g.title_en || g.title_de))}</Link>
                          <span className="gl-given-sub">
                            {g.quantity} × · {t('gift_given_on', { date: fmt(g.given_at) }) || `Given on ${fmt(g.given_at)}`}
                          </span>
                        </div>
                        <Link to="/my-orders" className="gl-given-order">#{g.order_id}</Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
