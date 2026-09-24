// frontend/src/pages/GiftLists/GiftListManage.jsx
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import config from '../../config';
import { AuthContext } from '../../context/AuthContext';
import { generateBookUrl } from '../../utils/seoUrl';
import { ArrowLeft, Gift, Minus, Plus, Search, Share2, Trash2 } from 'lucide-react';
import BrandModal from '../../components/common/BrandModal';
import { toast } from 'react-toastify';
import './GiftLists.css';

export default function GiftListManage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    if (!user) { navigate(`/login?redirect=/lists/${id}/manage`); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${config.API_URL}/api/gift-lists/${id}/manage`, { withCredentials: true });
      setList(data.list);
      setItems(data.items || []);
    } catch (err) {
      toast.error(t('gift_list_load_failed') || 'Could not load this list');
      navigate('/lists');
    } finally {
      setLoading(false);
    }
  };

  const onSearchChange = (val) => {
    setSearchTerm(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = val.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await axios.get(`${config.API_URL}/api/books/listing`, {
          params: { q, sort: 'relevance' },
        });
        setSearchResults(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 250);
  };

  const addBook = async (book) => {
    try {
      await axios.post(`${config.API_URL}/api/gift-lists/${id}/items`, {
        book_id: book.id,
        quantity_desired: 1,
      }, { withCredentials: true });
      setSearchTerm('');
      setSearchResults([]);
      load();
      toast.success(t('added_to_list') || 'Added to list');
    } catch {
      toast.error(t('update_failed') || 'Failed');
    }
  };

  const changeQty = async (item, delta, e) => {
    e.preventDefault(); e.stopPropagation();
    const next = Math.max(1, item.quantity_desired + delta);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity_desired: next } : i));
    try {
      await axios.patch(`${config.API_URL}/api/gift-lists/${id}/items/${item.id}`, {
        quantity_desired: next,
      }, { withCredentials: true });
    } catch {
      toast.error(t('update_failed') || 'Failed');
      load();
    }
  };

  const removeItem = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    setConfirmDialog({
      message: t('remove_from_list_confirm') || 'Remove this book from the list?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await axios.delete(`${config.API_URL}/api/gift-lists/${id}/items/${item.id}`, { withCredentials: true });
          load();
        } catch { toast.error(t('update_failed') || 'Failed'); }
      },
    });
  };

  const shareUrl = list ? `${window.location.origin}/g/${list.share_slug}` : '';

  if (loading) return <div className="gl-page"><div className="gl-loading">{t('loading') || 'Loading...'}</div></div>;
  if (!list) return null;

  return (
    <div className="gl-page">
      <div className="gl-container">
        <button className="gl-back-btn" onClick={() => navigate('/lists')}>
          <ArrowLeft size={16} /> {t('back') || 'Back'}
        </button>

        <div className="gl-header-row">
          <h1 className="gl-title"><Gift size={26} /> {list.title}</h1>
          <button className="gl-btn-primary" onClick={() => setShareOpen(true)}>
            <Share2 size={16} /> {t('share') || 'Share'}
          </button>
        </div>

        <div className="gl-search-box">
          <Search size={16} className="gl-search-icon" />
          <input
            className="gl-search-input"
            placeholder={t('search_books_to_add') || 'Search books to add...'}
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
          />
          {searching && <span className="gl-search-loading">...</span>}
          {searchResults.length > 0 && (
            <div className="gl-search-results">
              {searchResults.map(b => (
                <button key={b.id} className="gl-search-result-item" onClick={() => addBook(b)}>
                  <img src={b.image} alt="" className="gl-search-result-img" />
                  <span className="gl-search-result-title">{b.title_en || b.title_de}</span>
                  <Plus size={16} />
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="gl-empty">
            <p>{t('gift_list_no_items') || 'No books added yet — search above to add some.'}</p>
          </div>
        ) : (
          <div className="gl-tiles-grid">
            {items.map(it => {
              const bookUrl = generateBookUrl({
                id: it.book_id,
                title_en: it.title_en,
                title_de: it.title_de,
                slug: it.slug,
                isbn13: it.isbn13,
                isbn10: it.isbn10,
              });
              return (
                <div key={it.id} className="gl-tile">
                  <button className="gl-tile-remove" onClick={(e) => removeItem(e, it)} title={t('remove') || 'Remove'}>
                    <Trash2 size={14} />
                  </button>
                  <Link to={bookUrl} className="gl-tile-cover-link">
                    <img src={it.image} alt="" className="gl-tile-cover" />
                  </Link>
                  <div className="gl-tile-body">
                    <Link to={bookUrl} className="gl-tile-title">{it.title_en || it.title_de}</Link>
                    <span className="gl-tile-price">€{Number(it.price).toFixed(2)}</span>
                    <div className="gl-tile-qty">
                      <button onClick={(e) => changeQty(it, -1, e)} disabled={it.quantity_desired <= 1}><Minus size={13} /></button>
                      <span>{it.quantity_desired}</span>
                      <button onClick={(e) => changeQty(it, 1, e)}><Plus size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BrandModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        icon={Share2}
        accent="default"
        title={t('share_list') || 'Share this list'}
        message={shareUrl}
        primaryLabel={t('copy_link') || 'Copy Link'}
        onPrimary={() => {
          navigator.clipboard.writeText(shareUrl);
          toast.success(t('link_copied') || 'Link copied!');
          setShareOpen(false);
        }}
      />

      <BrandModal
        open={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        icon={Trash2}
        accent="danger"
        title={t('confirm') || 'Are you sure?'}
        message={confirmDialog?.message}
        primaryLabel={t('remove') || 'Remove'}
        onPrimary={confirmDialog?.onConfirm}
      />
    </div>
  );
}
