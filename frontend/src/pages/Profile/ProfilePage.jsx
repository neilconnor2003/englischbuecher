// frontend/src/pages/Profile/ProfilePage.jsx
import React, { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { addItem, syncAdd } from '../../features/cart/cartSlice';
import { toast } from 'react-toastify';
import config from '../../config';
import {
  User, Mail, Globe, ShoppingBag, Wallet, Settings, BookOpen, Star,
  MapPin, Bell, Camera, Edit2, Lock, ChevronRight, AlertCircle,
  CheckCircle, Package, Clock, Truck, XCircle, RotateCcw, Plus,
  Save, X, Eye, ShieldCheck, Cookie
} from 'lucide-react';
import './ProfilePage.css';

const API = axios.create({ baseURL: `${config.API_URL}/api`, withCredentials: true });

// ── helpers ──
const statusConfig = {
  pending:    { icon: Clock,        color: '#d97706', label: 'pending' },
  processing: { icon: Package,      color: '#2563eb', label: 'processing' },
  shipped:    { icon: Truck,        color: '#059669', label: 'shipped' },
  delivered:  { icon: CheckCircle,  color: '#16a34a', label: 'delivered' },
  cancelled:  { icon: XCircle,      color: '#dc2626', label: 'cancelled' },
};

const StatusBadge = ({ status, t }) => {
  const cfg    = statusConfig[status] || statusConfig.pending;
  const Icon   = cfg.icon;
  return (
    <span className="prof-status-badge" style={{ background: cfg.color + '18', color: cfg.color }}>
      <Icon size={12} /> {t(cfg.label)}
    </span>
  );
};

const StarRating = ({ rating }) => (
  <span className="prof-stars">
    {[1,2,3,4,5].map(s => (
      <Star key={s} size={13} fill={s <= rating ? '#f59e0b' : 'none'} color={s <= rating ? '#f59e0b' : '#d1d5db'} />
    ))}
  </span>
);

// ── ProfilePage ──
const ProfilePage = () => {
  const { t } = useTranslation();
  const { user: authUser, updateUser } = useContext(AuthContext);
  const navigate   = useNavigate();
  const location   = useLocation();
  const dispatch   = useDispatch();
  const fileRef    = useRef();

  const TABS = [
    { id: 'info',    icon: User,       label: t('personal_data') },
    { id: 'orders',  icon: ShoppingBag,label: t('my_orders') },
    { id: 'wallet',  icon: Wallet,     label: t('wallet') },
    { id: 'address', icon: MapPin,     label: t('saved_address') || 'Address' },
    { id: 'reviews', icon: Star,       label: t('my_reviews') || 'Reviews' },
    { id: 'requests',icon: BookOpen,   label: t('book_requests') || 'Requests' },
    { id: 'notifs',  icon: Bell,       label: t('notifications') || 'Notifications' },
    { id: 'privacy', icon: ShieldCheck,label: t('privacy_cookies') || 'Privacy & Cookies' },
    { id: 'settings',icon: Settings,   label: t('account_settings') },
  ];

  const [activeTab, setActiveTab]     = useState('info');
  const [orders, setOrders]           = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTx, setWalletTx]       = useState([]);
  const [reviews, setReviews]         = useState([]);
  const [requests, setRequests]       = useState([]);
  const [addresses, setAddresses]     = useState([]);
  const [notifPrefs, setNotifPrefs]   = useState({});
  const [editMode, setEditMode]       = useState(false);
  const [editForm, setEditForm]       = useState({});
  const [addrForm, setAddrForm]       = useState({ label: 'Home', address: '', postalCode: '', city: '', country: 'DE' });
  const [addrEdit, setAddrEdit]       = useState(null); // null=none, 'new'=adding, id=editing
  const [saving, setSaving]           = useState(false);
  const [pwForm, setPwForm]           = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading]     = useState(false);
  const [pwError, setPwError]         = useState('');
  const [pwSuccess, setPwSuccess]     = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [cookieAnalytics, setCookieAnalytics] = useState(false);
  const PAGE_SIZE = 8;

  // ── redirect ──
  useEffect(() => { if (authUser === null) navigate('/login'); }, [authUser, navigate]);

  // ── tab from hash ──
  useEffect(() => {
    if (location.hash === '#orders') setActiveTab('orders');
  }, [location.hash]);

  // ── load everything ──
  useEffect(() => {
    if (!authUser) return;

    // orders
    setOrderLoading(true);
    API.get('/orders/my-orders').then(({ data }) => {
      setOrders(data.map(o => ({
        ...o,
        order_items_parsed: (() => {
          try { return Array.isArray(o.order_items) ? o.order_items : JSON.parse(o.order_items || '[]'); }
          catch { return []; }
        })()
      })));
    }).catch(() => {}).finally(() => setOrderLoading(false));

    // wallet
    API.get('/wallet').then(({ data }) => setWalletBalance(Number(data.balance || 0))).catch(() => {});
    API.get('/wallet/transactions').then(({ data }) => setWalletTx(data || [])).catch(() => {});

    // reviews
    API.get('/user/reviews').then(({ data }) => setReviews(data || [])).catch(() => {});

    // book requests
    API.get('/book-requests/mine').then(({ data }) => setRequests(data || [])).catch(() => {});

    // addresses
    API.get('/user/addresses').then(({ data }) => setAddresses(data || [])).catch(() => {});

    // notify prefs
    API.get('/user/notify-prefs').then(({ data }) => setNotifPrefs(data)).catch(() => {});

    // cookie consent — read current choice from localStorage
    try {
      const raw = localStorage.getItem('cookie_consent_v1');
      if (raw) setCookieAnalytics(!!JSON.parse(raw).analytics);
    } catch {}

  }, [authUser]);

  // ── helpers ──
  const normalizePhoto = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${window.location.origin}${url}`;
    return url;
  };

  const memberDate = new Date(authUser?.created_at || Date.now()).toLocaleDateString('de-DE');
  const photoSrc   = normalizePhoto(authUser?.photoURL);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error(t('only_images_allowed') || 'Images only');
    if (file.size > 2 * 1024 * 1024) return toast.error(t('image_too_large') || 'Max 2MB');
    const fd = new FormData();
    fd.append('photo', file);
    try {
      const { data } = await API.post('/user/profile-photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateUser({ ...authUser, photoURL: normalizePhoto(data.photoURL), custom_pic: 1 });
      toast.success(t('profile_photo_updated') || 'Photo updated!');
    } catch { toast.error(t('failed_to_upload_photo') || 'Upload failed'); }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await API.put('/user/profile', editForm);
      updateUser(data);
      setEditMode(false);
      toast.success(t('profile_updated') || 'Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.error || t('update_failed') || 'Update failed');
    } finally { setSaving(false); }
  };

  const handleSaveAddress = async () => {
    setSaving(true);
    try {
      if (addrEdit === 'new') {
        await API.post('/user/addresses', { ...addrForm, setAsDefault: addresses.length === 0 });
        toast.success(t('address_saved') || 'Address saved!');
      } else if (addrEdit) {
        await API.put(`/user/addresses/${addrEdit}`, addrForm);
        toast.success(t('address_saved') || 'Address updated!');
      }
      const { data } = await API.get('/user/addresses');
      setAddresses(data || []);
      setAddrEdit(null);
    } catch { toast.error(t('update_failed') || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm(t('confirm_delete_address') || 'Delete this address?')) return;
    try {
      await API.delete(`/user/addresses/${id}`);
      const { data } = await API.get('/user/addresses');
      setAddresses(data || []);
      toast.success(t('address_deleted') || 'Address deleted');
    } catch { toast.error(t('update_failed') || 'Failed'); }
  };

  const handleSetDefault = async (id) => {
    try {
      await API.put(`/user/addresses/${id}/default`);
      setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id ? 1 : 0 })));
    } catch { toast.error(t('update_failed') || 'Failed'); }
  };

  const handleChangePassword = async () => {
    setPwError(''); setPwSuccess('');
    if (pwForm.next !== pwForm.confirm) return setPwError(t('passwords_dont_match') || "Passwords don't match");
    if (pwForm.next.length < 6) return setPwError(t('password_too_short') || 'Min 6 characters');
    setPwLoading(true);
    try {
      await API.post('/user/change-password', { current_password: pwForm.current, new_password: pwForm.next });
      setPwSuccess(t('password_changed') || 'Password changed successfully!');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwError(err.response?.data?.error || t('change_password_failed') || 'Failed');
    } finally { setPwLoading(false); }
  };

  const handleNotifToggle = async (key) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    try { await API.put('/user/notify-prefs', updated); }
    catch { toast.error(t('update_failed') || 'Failed to save'); setNotifPrefs(notifPrefs); }
  };

  // Mirrors the logic in CookieConsent.jsx — same storage key, same
  // GA4/Clarity load/no-op behavior, same server-side logging endpoint.
  const handleCookieToggle = async () => {
    const next = !cookieAnalytics;
    setCookieAnalytics(next);
    const consent = { essential: true, analytics: next };
    localStorage.setItem('cookie_consent_v1', JSON.stringify({ ...consent, ts: Date.now() }));

    if (next && !window.gtag) {
      // Lazy-load GA4 + Clarity the same way CookieConsent.jsx does
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=G-T5FKMD328X';
      document.head.appendChild(script);
      window.dataLayer = window.dataLayer || [];
      function gtag() { window.dataLayer.push(arguments); }
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', 'G-T5FKMD328X', { anonymize_ip: true, cookie_flags: 'SameSite=None;Secure' });

      if (!window.clarity) {
        (function (c, l, a, r, i, t, y) {
          c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
          t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
          y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, 'clarity', 'script', 'xembtgq0cs');
      }
    }

    try {
      let anonId = localStorage.getItem('cookie_consent_anon_id');
      if (!anonId) {
        anonId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem('cookie_consent_anon_id', anonId);
      }
      await API.post('/cookie-consent', { essential: true, analytics: next, source: 'profile', consent_id: anonId });
      toast.success(t('cookie_prefs_updated') || 'Cookie preferences updated');
    } catch {
      // Non-fatal — preference still applied locally even if logging fails
    }
  };

  const handleReorder = (order) => {
    if (!order.order_items_parsed?.length) return toast.error(t('no_items_to_reorder') || 'No items');
    order.order_items_parsed.forEach(item => {
      dispatch(addItem({ bookId: item.bookId, book: { title_en: item.title_en, price: item.price, image: item.image }, quantity: item.quantity }));
      dispatch(syncAdd({ bookId: item.bookId, quantity: item.quantity }));
    });
    toast.success(t('items_readded_to_cart') || 'Added to cart!');
  };

  const paginatedOrders = orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages      = Math.ceil(orders.length / PAGE_SIZE);

  if (authUser === undefined) {
    return <div className="prof-loading"><div className="prof-spinner-lg" /></div>;
  }

  // ── render ──
  return (
    <div className="prof-page">
      <div className="prof-container">

        {/* ── PROFILE HEADER ── */}
        <div className="prof-hero">
          <div className="prof-avatar-wrap">
            {photoSrc
              ? <img src={photoSrc} alt="" className="prof-avatar" onError={e => e.target.style.display='none'} />
              : <div className="prof-avatar prof-avatar-initials">{authUser.initials || (authUser.first_name?.[0] || '?')}</div>
            }
            <button className="prof-avatar-edit" onClick={() => fileRef.current?.click()} title={t('change_photo') || 'Change photo'}>
              <Camera size={14} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </div>
          <div className="prof-hero-info">
            <h1 className="prof-name">{authUser.first_name} {authUser.last_name}</h1>
            <p className="prof-email"><Mail size={14} /> {authUser.email}</p>
            <div className="prof-meta">
              <span className="prof-badge"><Globe size={12} /> {authUser.language === 'de' ? 'Deutsch' : 'English'}</span>
              <span className="prof-badge">👤 {t('member_since') || 'Member since'} {memberDate}</span>
              <span className="prof-badge prof-badge-purple">€{walletBalance.toFixed(2)} {t('wallet') || 'Wallet'}</span>
            </div>
          </div>
        </div>

        <div className="prof-layout">
          {/* ── SIDEBAR TABS ── */}
          <nav className="prof-nav">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`prof-nav-item ${activeTab === tab.id ? 'prof-nav-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                  <ChevronRight size={14} className="prof-nav-chevron" />
                </button>
              );
            })}
          </nav>

          {/* ── CONTENT ── */}
          <div className="prof-content">

            {/* ── 1. PERSONAL INFO ── */}
            {activeTab === 'info' && (
              <div className="prof-card">
                <div className="prof-card-header">
                  <h2 className="prof-card-title">{t('personal_information')}</h2>
                  {!editMode && (
                    <button className="prof-btn-ghost" onClick={() => { setEditMode(true); setEditForm({ first_name: authUser.first_name, last_name: authUser.last_name, language: authUser.language }); }}>
                      <Edit2 size={14} /> {t('edit_profile')}
                    </button>
                  )}
                </div>
                {editMode ? (
                  <div className="prof-form">
                    <div className="prof-form-row">
                      <div className="prof-field">
                        <label>{t('first_name')}</label>
                        <input value={editForm.first_name || ''} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} />
                      </div>
                      <div className="prof-field">
                        <label>{t('last_name')}</label>
                        <input value={editForm.last_name || ''} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} />
                      </div>
                    </div>
                    <div className="prof-field">
                      <label>{t('language')}</label>
                      <select value={editForm.language || 'de'} onChange={e => setEditForm({ ...editForm, language: e.target.value })}>
                        <option value="de">Deutsch</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div className="prof-form-actions">
                      <button className="prof-btn-primary" onClick={handleSaveProfile} disabled={saving}>
                        <Save size={14} /> {saving ? t('saving') || 'Saving…' : t('save_changes')}
                      </button>
                      <button className="prof-btn-ghost" onClick={() => setEditMode(false)}><X size={14} /> {t('cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="prof-info-grid">
                    <div className="prof-info-item"><span>{t('first_name')}</span><strong>{authUser.first_name || '—'}</strong></div>
                    <div className="prof-info-item"><span>{t('last_name')}</span><strong>{authUser.last_name || '—'}</strong></div>
                    <div className="prof-info-item"><span>{t('email')}</span><strong>{authUser.email}</strong></div>
                    <div className="prof-info-item"><span>{t('language')}</span><strong>{authUser.language === 'de' ? 'Deutsch' : 'English'}</strong></div>
                    <div className="prof-info-item"><span>{t('member_since')}</span><strong>{memberDate}</strong></div>
                    <div className="prof-info-item"><span>{t('registration_method') || 'Login method'}</span><strong style={{ textTransform: 'capitalize' }}>{authUser.registration_method || '—'}</strong></div>
                  </div>
                )}
              </div>
            )}

            {/* ── 2. ORDERS ── */}
            {activeTab === 'orders' && (
              <div className="prof-card">
                <div className="prof-card-header">
                  <h2 className="prof-card-title">{t('my_orders')} {orders.length > 0 && <span className="prof-count">{orders.length}</span>}</h2>
                </div>
                {orderLoading ? (
                  <div className="prof-loading-mini"><div className="prof-spinner" /></div>
                ) : orders.length === 0 ? (
                  <div className="prof-empty">
                    <ShoppingBag size={40} />
                    <p>{t('no_orders_yet')}</p>
                    <button className="prof-btn-primary" onClick={() => navigate('/')}>{t('start_shopping_now')}</button>
                  </div>
                ) : (
                  <>
                    <div className="prof-orders-list">
                      {paginatedOrders.map(order => (
                        <div key={order.id} className="prof-order-card">
                          <div className="prof-order-top">
                            <div className="prof-order-meta">
                              <strong>#{order.id}</strong>
                              <span className="prof-order-date">{new Date(order.created_at).toLocaleDateString('de-DE')}</span>
                              <StatusBadge status={order.status} t={t} />
                            </div>
                            <div className="prof-order-amount">€{Number(order.total).toFixed(2)}</div>
                          </div>
                          <div className="prof-order-thumbs">
                            {order.order_items_parsed.slice(0, 4).map((item, i) => (
                              item.image
                                ? <img key={i} src={item.image} alt="" className="prof-thumb" />
                                : <div key={i} className="prof-thumb prof-thumb-placeholder" />
                            ))}
                            {order.order_items_parsed.length > 4 && <span className="prof-thumb-more">+{order.order_items_parsed.length - 4}</span>}
                          </div>
                          {(Number(order.coupon_discount) > 0 || Number(order.wallet_used) > 0) && (
                            <div className="prof-order-discounts">
                              {Number(order.coupon_discount) > 0 && <span className="prof-disc-pill prof-disc-green">{order.coupon_code} −€{Number(order.coupon_discount).toFixed(2)}</span>}
                              {Number(order.wallet_used) > 0 && <span className="prof-disc-pill prof-disc-purple">💜 −€{Number(order.wallet_used).toFixed(2)}</span>}
                            </div>
                          )}
                          <div className="prof-order-actions">
                            <button className="prof-btn-sm" onClick={() => navigate(`/order-success/${order.id}`)}><Eye size={13} /> {t('view')}</button>
                            <button className="prof-btn-sm" onClick={() => handleReorder(order)}><RotateCcw size={13} /> {t('reorder') || 'Buy again'}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="prof-pagination">
                        {Array.from({ length: totalPages }, (_, i) => (
                          <button key={i+1} className={`prof-page-btn ${currentPage === i+1 ? 'active' : ''}`} onClick={() => setCurrentPage(i+1)}>{i+1}</button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── 3. WALLET ── */}
            {activeTab === 'wallet' && (
              <div className="prof-card">
                <div className="prof-card-header">
                  <h2 className="prof-card-title">{t('wallet')}</h2>
                </div>
                <div className="prof-wallet-balance">
                  <div>
                    <div className="prof-wallet-label">{t('wallet_balance')}</div>
                    <div className="prof-wallet-amount">€{walletBalance.toFixed(2)}</div>
                  </div>
                  <div className="prof-wallet-icon">💜</div>
                </div>
                <h3 className="prof-section-sub">{t('wallet_transactions')}</h3>
                {walletTx.length === 0 ? (
                  <div className="prof-empty"><Wallet size={36} /><p>{t('wallet_no_transactions')}</p></div>
                ) : (
                  <div className="prof-tx-list">
                    {walletTx.map(tx => (
                      <div key={tx.id} className="prof-tx-row">
                        <div>
                          <div className="prof-tx-reason">{tx.reason}</div>
                          <div className="prof-tx-date">{new Date(tx.created_at).toLocaleDateString('de-DE')}</div>
                        </div>
                        <div className={`prof-tx-amount ${tx.type === 'CREDIT' ? 'credit' : 'debit'}`}>
                          {tx.type === 'CREDIT' ? '+' : '−'}€{Number(tx.amount).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 4. SAVED ADDRESSES ── */}
            {activeTab === 'address' && (
              <div className="prof-card">
                <div className="prof-card-header">
                  <h2 className="prof-card-title">
                    {t('saved_address') || 'Saved Addresses'}
                    {addresses.length > 0 && <span className="prof-count">{addresses.length}</span>}
                  </h2>
                  {addrEdit === null && (
                    <button className="prof-btn-ghost" onClick={() => {
                      setAddrEdit('new');
                      setAddrForm({ label: 'Home', address: '', postalCode: '', city: '', country: 'DE' });
                    }}>
                      <Plus size={14} /> {t('add_address') || 'Add address'}
                    </button>
                  )}
                </div>

                {/* Add / Edit form */}
                {addrEdit !== null && (
                  <div className="prof-form" style={{ marginBottom: 24, padding: 16, background: '#faf5ff', borderRadius: 12, border: '1px solid #ede9fe' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#7c3aed' }}>
                      {addrEdit === 'new' ? (t('add_address') || 'Add address') : (t('edit') || 'Edit address')}
                    </h3>
                    <div className="prof-field">
                      <label>{t('address_label') || 'Label'}</label>
                      <select
                        value={addrForm.label || 'Home'}
                        onChange={e => setAddrForm({ ...addrForm, label: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontFamily: 'Inter,sans-serif' }}
                      >
                        <option value="Home">{t('address_label_home') || 'Home'}</option>
                        <option value="Work">{t('address_label_work') || 'Work'}</option>
                        <option value="Other">{t('address_label_other') || 'Other'}</option>
                      </select>
                    </div>
                    <div className="prof-field">
                      <label>{t('address') || 'Street address'}</label>
                      <input value={addrForm.address || ''} onChange={e => setAddrForm({ ...addrForm, address: e.target.value })} placeholder="Musterstraße 42" />
                    </div>
                    <div className="prof-form-row">
                      <div className="prof-field">
                        <label>{t('postal_code') || 'Postal code'}</label>
                        <input value={addrForm.postalCode || ''} onChange={e => setAddrForm({ ...addrForm, postalCode: e.target.value })} placeholder="60313" />
                      </div>
                      <div className="prof-field">
                        <label>{t('city') || 'City'}</label>
                        <input value={addrForm.city || ''} onChange={e => setAddrForm({ ...addrForm, city: e.target.value })} placeholder="Frankfurt" />
                      </div>
                    </div>
                    <div className="prof-form-actions">
                      <button className="prof-btn-primary" onClick={handleSaveAddress} disabled={saving}>
                        <Save size={14} /> {saving ? '…' : t('save_changes')}
                      </button>
                      <button className="prof-btn-ghost" onClick={() => setAddrEdit(null)}>
                        <X size={14} /> {t('cancel')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Address cards list */}
                {addresses.length === 0 && addrEdit === null ? (
                  <div className="prof-empty">
                    <MapPin size={36} />
                    <p>{t('no_address_saved') || 'No addresses saved yet.'}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {addresses.map(a => (
                      <div key={a.id} style={{
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                        gap: 12, padding: '14px 16px', borderRadius: 12,
                        border: `1px solid ${a.is_default ? '#c4b5fd' : '#f0eefb'}`,
                        background: a.is_default ? '#faf5ff' : '#fdfcff',
                      }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <MapPin size={16} style={{ color: '#7c3aed', marginTop: 2, flexShrink: 0 }} />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{a.label}</span>
                              {a.is_default === 1 && (
                                <span style={{ background: '#7c3aed', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 999 }}>
                                  {t('default') || 'Default'}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                              <div>{a.address}</div>
                              <div>{a.postalCode} {a.city}</div>
                              <div>{a.country}</div>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {!a.is_default && (
                            <button className="prof-btn-sm" onClick={() => handleSetDefault(a.id)}>
                              ★ {t('set_default') || 'Set default'}
                            </button>
                          )}
                          <button className="prof-btn-sm" onClick={() => {
                            setAddrEdit(a.id);
                            setAddrForm({ label: a.label, address: a.address, postalCode: a.postalCode, city: a.city, country: a.country });
                          }}>
                            <Edit2 size={12} /> {t('edit')}
                          </button>
                          <button className="prof-btn-sm" style={{ color: '#dc2626', borderColor: '#fecaca' }}
                            onClick={() => handleDeleteAddress(a.id)}>
                            <X size={12} /> {t('delete') || 'Delete'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 5. REVIEWS ── */}
            {activeTab === 'reviews' && (
              <div className="prof-card">
                <div className="prof-card-header">
                  <h2 className="prof-card-title">{t('my_reviews') || 'My Reviews'} {reviews.length > 0 && <span className="prof-count">{reviews.length}</span>}</h2>
                </div>
                {reviews.length === 0 ? (
                  <div className="prof-empty"><Star size={36} /><p>{t('no_reviews_yet') || "You haven't written any reviews yet."}</p></div>
                ) : (
                  <div className="prof-reviews-list">
                    {reviews.map(r => (
                      <div key={r.id} className="prof-review-card" onClick={() => navigate(`/book/${r.slug}-${r.isbn13}-${r.book_id}`)}>
                        <img src={r.image} alt={r.title_en} className="prof-review-img" onError={e => e.target.style.display='none'} />
                        <div className="prof-review-body">
                          <div className="prof-review-title">{r.title_en}</div>
                          <StarRating rating={r.rating} />
                          {r.review_text && <p className="prof-review-text">{r.review_text}</p>}
                          <div className="prof-review-date">{new Date(r.created_at).toLocaleDateString('de-DE')}</div>
                        </div>
                        <ChevronRight size={16} className="prof-review-arrow" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 6. BOOK REQUESTS ── */}
            {activeTab === 'requests' && (
              <div className="prof-card">
                <div className="prof-card-header">
                  <h2 className="prof-card-title">{t('book_requests') || 'Book Requests'} {requests.length > 0 && <span className="prof-count">{requests.length}</span>}</h2>
                </div>
                {requests.length === 0 ? (
                  <div className="prof-empty"><BookOpen size={36} /><p>{t('no_book_requests') || 'No book requests yet.'}</p></div>
                ) : (
                  <div className="prof-req-list">
                    {requests.map(r => (
                      <div key={r.id} className="prof-req-row">
                        <div className="prof-req-info">
                          <div className="prof-req-title">{r.title_en || r.title_de || r.isbn13 || '—'}</div>
                          {r.isbn13 && <div className="prof-req-isbn">ISBN: {r.isbn13}</div>}
                          <div className="prof-req-date">{new Date(r.created_at).toLocaleDateString('de-DE')}</div>
                        </div>
                        <span className={`prof-req-badge ${r.status === 'fulfilled' ? 'fulfilled' : r.status === 'added' ? 'added' : 'pending'}`}>
                          {r.status === 'fulfilled' ? '✓ ' + (t('available') || 'Available') : r.status === 'added' ? '📦 ' + (t('added') || 'Added') : '⏳ ' + (t('pending') || 'Pending')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 7. NOTIFICATION PREFS ── */}
            {activeTab === 'notifs' && (
              <div className="prof-card">
                <div className="prof-card-header">
                  <h2 className="prof-card-title">{t('notifications') || 'Notification Preferences'}</h2>
                </div>
                <p className="prof-section-desc">{t('notif_prefs_desc') || 'Choose which emails you want to receive from us.'}</p>
                {[
                  { key: 'review_requests', label: t('notif_review_requests') || 'Review request emails', desc: t('notif_review_desc') || 'Receive an email after your book is delivered asking for a review.' },
                  { key: 'restock',         label: t('notif_restock') || 'Back in stock alerts',      desc: t('notif_restock_desc') || 'Get notified when a book you watched comes back in stock.' },
                  { key: 'wallet_credits',  label: t('notif_wallet') || 'Wallet credit notifications', desc: t('notif_wallet_desc') || 'Email when wallet credits are added to your account.' },
                  { key: 'newsletter',      label: t('notif_newsletter') || 'Newsletter',               desc: t('notif_newsletter_desc') || 'New arrivals, exclusive deals, and reading recommendations.' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="prof-notif-row">
                    <div className="prof-notif-info">
                      <div className="prof-notif-label">{label}</div>
                      <div className="prof-notif-desc">{desc}</div>
                    </div>
                    <button
                      className={`prof-toggle ${notifPrefs[key] ? 'on' : 'off'}`}
                      onClick={() => handleNotifToggle(key)}
                      title={notifPrefs[key] ? 'On' : 'Off'}
                    >
                      <span className="prof-toggle-knob" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── PRIVACY & COOKIES ── */}
            {activeTab === 'privacy' && (
              <div className="prof-card">
                <div className="prof-card-header">
                  <h2 className="prof-card-title">{t('privacy_cookies') || 'Privacy & Cookies'}</h2>
                </div>
                <p className="prof-section-desc">
                  {t('privacy_cookies_desc') || 'Manage how we use cookies on this device. This setting only applies to your current browser.'}
                </p>

                <div className="prof-notif-row">
                  <div className="prof-notif-info">
                    <div className="prof-notif-label">{t('cookie_essential') || 'Essential cookies'}</div>
                    <div className="prof-notif-desc">{t('cookie_essential_desc') || 'Required for login, your cart, and core site functions. Cannot be turned off.'}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', background: '#f3f4f6', padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('always_on') || 'Always on'}
                  </span>
                </div>

                <div className="prof-notif-row">
                  <div className="prof-notif-info">
                    <div className="prof-notif-label">{t('cookie_analytics') || 'Analytics cookies'}</div>
                    <div className="prof-notif-desc">{t('cookie_analytics_desc') || 'Google Analytics and Microsoft Clarity help us understand how visitors use our website.'}</div>
                  </div>
                  <button
                    className={`prof-toggle ${cookieAnalytics ? 'on' : 'off'}`}
                    onClick={handleCookieToggle}
                    title={cookieAnalytics ? 'On' : 'Off'}
                  >
                    <span className="prof-toggle-knob" />
                  </button>
                </div>

                <p className="prof-section-desc" style={{ marginTop: 16 }}>
                  {t('privacy_full_policy') || 'Read our full'}{' '}
                  <a href="/privacy" style={{ color: '#7c3aed', fontWeight: 600 }}>
                    {t('privacy_policy_link') || 'Privacy Policy'}
                  </a>.
                </p>
              </div>
            )}

            {/* ── 8. ACCOUNT SETTINGS ── */}
            {activeTab === 'settings' && (
              <div className="prof-card">
                <div className="prof-card-header">
                  <h2 className="prof-card-title">{t('account_settings')}</h2>
                </div>

                <h3 className="prof-section-sub"><Lock size={15} /> {t('change_password')}</h3>

                {authUser.registration_method === 'google' ? (
                  <div className="prof-info-box">
                    <AlertCircle size={15} />
                    {t('google_no_password') || 'Your account uses Google login — password changes are managed through Google.'}
                  </div>
                ) : (
                  <div className="prof-form" style={{ maxWidth: 400 }}>
                    {pwError && <div className="prof-alert prof-alert-error"><AlertCircle size={14}/>{pwError}</div>}
                    {pwSuccess && <div className="prof-alert prof-alert-success"><CheckCircle size={14}/>{pwSuccess}</div>}
                    <div className="prof-field">
                      <label>{t('current_password') || 'Current password'}</label>
                      <input type="password" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} />
                    </div>
                    <div className="prof-field">
                      <label>{t('new_password') || 'New password'}</label>
                      <input type="password" value={pwForm.next} onChange={e => setPwForm({ ...pwForm, next: e.target.value })} />
                    </div>
                    <div className="prof-field">
                      <label>{t('confirm_password') || 'Confirm new password'}</label>
                      <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} />
                    </div>
                    <button className="prof-btn-primary" onClick={handleChangePassword} disabled={pwLoading}>
                      {pwLoading ? <><span className="prof-spinner-sm"/> {t('saving')||'Saving…'}</> : <><Lock size={14}/> {t('change_password')}</>}
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
