// frontend/src/pages/GiftLists/MyGiftLists.jsx
import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import config from '../../config';
import { AuthContext } from '../../context/AuthContext';
import { Gift, Plus, Share2, Trash2, Calendar, ChevronRight } from 'lucide-react';
import BrandModal, { brandInputStyle, brandLabelStyle } from '../../components/common/BrandModal';
import ShareListModal from './ShareListModal';
import { toast } from 'react-toastify';
import './GiftLists.css';

export default function MyGiftLists() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isDe = i18n.language === 'de';

  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [occasion, setOccasion] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [shareModal, setShareModal] = useState(null);

  useEffect(() => {
    if (!user) { navigate('/login?redirect=/lists'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${config.API_URL}/api/gift-lists`, { withCredentials: true });
      setLists(data || []);
    } catch (err) {
      toast.error(t('gift_lists_load_failed') || 'Could not load your lists');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await axios.post(`${config.API_URL}/api/gift-lists`, {
        title: title.trim(),
        occasion: occasion.trim() || null,
        event_date: eventDate || null,
      }, { withCredentials: true });
      setCreateOpen(false);
      setTitle(''); setOccasion(''); setEventDate('');
      load();
    } catch (err) {
      toast.error(t('gift_list_create_failed') || 'Could not create list');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (e, list) => {
    e.preventDefault(); e.stopPropagation();
    setConfirmDialog({
      message: `${t('delete_gift_list_confirm') || 'Delete'} "${list.title}"?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await axios.delete(`${config.API_URL}/api/gift-lists/${list.id}`, { withCredentials: true });
          load();
        } catch { toast.error(t('update_failed') || 'Failed'); }
      },
    });
  };

  const handleShare = (e, list) => {
    e.preventDefault(); e.stopPropagation();
    setShareModal(list);
  };

  const shareUrl = (slug) => `${window.location.origin}/g/${slug}`;

  const formatDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return date.toLocaleDateString(isDe ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="gl-page">
      <div className="gl-container">
        <div className="gl-hero">
          <Gift size={30} />
          <h1 className="gl-title">{t('my_gift_lists') || 'My Gift Lists'}</h1>
          <p className="gl-hero-sub">
            {isDe
              ? 'Erstelle Listen für jeden Anlass und teile sie mit Familie und Freunden.'
              : 'Create a list for any occasion and share it with friends and family.'}
          </p>
        </div>

        {loading ? (
          <div className="gl-loading">{t('loading') || 'Loading...'}</div>
        ) : (
          <div className="gl-list-grid">
            <button className="gl-new-tile" onClick={() => setCreateOpen(true)}>
              <div className="gl-new-tile-icon"><Plus size={26} /></div>
              <span>{t('new_list') || 'New List'}</span>
            </button>

            {lists.map(l => (
              <Link to={`/lists/${l.id}/manage`} key={l.id} className="gl-card">
                <div className="gl-card-covers">
                  {l.preview_images && l.preview_images.length > 0 ? (
                    l.preview_images.map((img, i) => (
                      <img key={i} src={img} alt="" className="gl-card-cover-img" style={{ zIndex: 3 - i, left: `${i * 18}px` }} />
                    ))
                  ) : (
                    <div className="gl-card-covers-empty"><Gift size={22} /></div>
                  )}
                </div>

                <div className="gl-card-body">
                  <span className="gl-card-title">{l.title}</span>
                  {l.occasion && <span className="gl-card-occasion">{l.occasion}</span>}
                  <div className="gl-card-meta-row">
                    <span className="gl-card-meta">{l.item_count} {t('items') || 'items'}</span>
                    {l.event_date && (
                      <span className="gl-card-meta">
                        <Calendar size={11} /> {formatDate(l.event_date)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="gl-card-actions">
                  <button className="gl-icon-btn" onClick={(e) => handleShare(e, l)} title={t('share') || 'Share'}>
                    <Share2 size={15} />
                  </button>
                  <button className="gl-icon-btn gl-icon-btn-danger" onClick={(e) => handleDelete(e, l)} title={t('delete') || 'Delete'}>
                    <Trash2 size={15} />
                  </button>
                  <span className="gl-card-chevron"><ChevronRight size={18} /></span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && lists.length === 0 && (
          <p className="gl-hint-text">{t('no_gift_lists') || "You haven't created any gift lists yet — click the tile above to start."}</p>
        )}
      </div>

      <BrandModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        icon={Gift}
        accent="default"
        title={t('new_list') || 'New Gift List'}
        primaryLabel={t('create') || 'Create'}
        primaryLoading={creating}
        onPrimary={handleCreate}
      >
        <div style={{ marginBottom: 14 }}>
          <label style={brandLabelStyle}>{t('list_title') || 'List title'}</label>
          <input style={brandInputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. My Birthday" autoFocus />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={brandLabelStyle}>{t('occasion') || 'Occasion (optional)'}</label>
          <input style={brandInputStyle} value={occasion} onChange={e => setOccasion(e.target.value)} placeholder="e.g. Birthday, Wedding" />
        </div>
        <div>
          <label style={brandLabelStyle}>{t('event_date') || 'Event date (optional)'}</label>
          <input type="date" style={brandInputStyle} value={eventDate} onChange={e => setEventDate(e.target.value)} />
        </div>
      </BrandModal>

      <ShareListModal
        open={!!shareModal}
        onClose={() => setShareModal(null)}
        url={shareModal ? shareUrl(shareModal.share_slug) : ''}
        title={shareModal?.title}
      />

      <BrandModal
        open={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        icon={Trash2}
        accent="danger"
        title={t('confirm') || 'Are you sure?'}
        message={confirmDialog?.message}
        primaryLabel={t('delete') || 'Delete'}
        onPrimary={confirmDialog?.onConfirm}
      />
    </div>
  );
}
