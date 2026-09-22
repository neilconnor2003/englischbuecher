// frontend/src/pages/GiftLists/MyGiftLists.jsx
import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import config from '../../config';
import { AuthContext } from '../../context/AuthContext';
import { Gift, Plus, Share2, Trash2 } from 'lucide-react';
import BrandModal, { brandInputStyle, brandLabelStyle } from '../../components/common/BrandModal';
import { toast } from 'react-toastify';
import './GiftLists.css';

export default function MyGiftLists() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

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

  const handleDelete = (list) => {
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

  const shareUrl = (slug) => `${window.location.origin}/g/${slug}`;

  return (
    <div className="gl-page">
      <div className="gl-container">
        <div className="gl-header-row">
          <h1 className="gl-title"><Gift size={26} /> {t('my_gift_lists') || 'My Gift Lists'}</h1>
          <button className="gl-btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> {t('new_list') || 'New List'}
          </button>
        </div>

        {loading ? (
          <div className="gl-loading">{t('loading') || 'Loading...'}</div>
        ) : lists.length === 0 ? (
          <div className="gl-empty">
            <Gift size={40} className="gl-empty-icon" />
            <p>{t('no_gift_lists') || "You haven't created any gift lists yet."}</p>
            <button className="gl-btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> {t('create_first_list') || 'Create your first list'}
            </button>
          </div>
        ) : (
          <div className="gl-list-grid">
            {lists.map(l => (
              <div key={l.id} className="gl-card">
                <Link to={`/lists/${l.id}/manage`} className="gl-card-title">{l.title}</Link>
                {l.occasion && <p className="gl-card-occasion">{l.occasion}</p>}
                <p className="gl-card-meta">{l.item_count} {t('items') || 'items'}</p>
                <div className="gl-card-actions">
                  <button className="gl-btn-ghost" onClick={() => setShareModal(l)}>
                    <Share2 size={14} /> {t('share') || 'Share'}
                  </button>
                  <button className="gl-btn-ghost gl-btn-danger" onClick={() => handleDelete(l)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
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

      <BrandModal
        open={!!shareModal}
        onClose={() => setShareModal(null)}
        icon={Share2}
        accent="default"
        title={t('share_list') || 'Share this list'}
        message={shareModal ? shareUrl(shareModal.share_slug) : ''}
        primaryLabel={t('copy_link') || 'Copy Link'}
        onPrimary={() => {
          navigator.clipboard.writeText(shareUrl(shareModal.share_slug));
          toast.success(t('link_copied') || 'Link copied!');
          setShareModal(null);
        }}
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
