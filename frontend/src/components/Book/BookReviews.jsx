// frontend/src/components/Book/BookReviews.jsx
import React, { useState, useEffect, useContext } from 'react';
import { Star, MessageCircle, X } from 'lucide-react';
import axios from 'axios';
import config from '../../config';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import './BookReviews.css';

const normalizeUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${config.API_URL}${url}`;
  return url;
};

const StarRating = ({ value, interactive = false, onChange, size = 22 }) => {
  const [hovered, setHovered] = useState(0);
  const display = interactive ? (hovered || value) : value;
  return (
    <div className="br-stars" style={{ gap: size < 18 ? 2 : 4 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          className={`br-star ${s <= display ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
          style={{ width: size, height: size }}
          onClick={() => interactive && onChange?.(s)}
          onMouseEnter={() => interactive && setHovered(s)}
          onMouseLeave={() => interactive && setHovered(0)}
          disabled={!interactive}
        >
          <Star size={size} fill={s <= display ? '#f59e0b' : 'none'} color={s <= display ? '#f59e0b' : '#d1d5db'} />
        </button>
      ))}
    </div>
  );
};

const Avatar = ({ src, name, size = 44 }) => {
  const [imgError, setImgError] = useState(false);
  const initials = (name || 'A').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626'];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];

  if (src && !imgError) {
    return (
      <img
        src={normalizeUrl(src)}
        alt={name}
        className="br-avatar br-avatar-img"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div className="br-avatar br-avatar-initials" style={{ width: size, height: size, background: color }}>
      {initials}
    </div>
  );
};

function BookReviews({ bookId }) {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage || 'en') === 'de' ? 'de-DE' : 'en-US';
  const { user } = useContext(AuthContext);

  const [reviews, setReviews]   = useState([]);
  const [stats, setStats]       = useState({ average: 0, total: 0, distribution: { 1:0,2:0,3:0,4:0,5:0 } });
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');
  const [form, setForm]         = useState({ rating: 0, review_text: '', reviewer_name: '' });

  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString(locale, { year:'numeric', month:'short', day:'numeric' }) : '';
  const formatRating = (v) => new Intl.NumberFormat(locale, { minimumFractionDigits:1, maximumFractionDigits:1 }).format(Number(v)||0);

  const fetchData = async () => {
    try {
      const [statsRes, reviewsRes] = await Promise.all([
        axios.get(`${config.API_URL}/api/books/${bookId}/reviews/stats`),
        axios.get(`${config.API_URL}/api/books/${bookId}/reviews`),
      ]);
      setStats(statsRes.data);
      setReviews(reviewsRes.data);
    } catch (err) {
      console.error('Failed to load reviews', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (bookId) fetchData(); }, [bookId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.rating) return setError(t('reviews.rating_required') || 'Please select a rating');
    if (!form.review_text || form.review_text.trim().length < 10)
      return setError(t('reviews.text_too_short') || 'Review must be at least 10 characters');
    if (!user && !form.reviewer_name.trim())
      return setError(t('reviews.name_required') || 'Please enter your name');

    setSubmitting(true);
    try {
      await axios.post(`${config.API_URL}/api/books/${bookId}/reviews`, {
        rating: form.rating,
        review_text: form.review_text,
        reviewer_name: form.reviewer_name || user?.first_name || 'Anonymous',
      });
      setModalOpen(false);
      setForm({ rating: 0, review_text: '', reviewer_name: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || t('reviews.submit_error') || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="br-loading">{t('reviews.loading') || 'Loading reviews…'}</div>;
  }

  return (
    <div className="br-wrap" id="reviews-section">
      <div className="container">
        <h2 className="br-heading">{t('customer_reviews') || 'Customer Reviews'}</h2>

        <div className="br-layout">
          {/* ── LEFT: summary ── */}
          <aside className="br-sidebar">
            <div className="br-summary-card">
              <div className="br-big-score">{formatRating(stats.average)}</div>
              <StarRating value={Math.round(stats.average)} size={20} />
              <p className="br-total-count">{t('review_count', { count: stats.total })}</p>

              <div className="br-distribution">
                {[5,4,3,2,1].map(star => {
                  const pct = stats.total > 0 ? (stats.distribution[star] / stats.total) * 100 : 0;
                  return (
                    <div key={star} className="br-dist-row">
                      <span className="br-dist-label">{star}★</span>
                      <div className="br-dist-bar">
                        <div className="br-dist-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="br-dist-count">{stats.distribution[star] || 0}</span>
                    </div>
                  );
                })}
              </div>

              <button className="br-write-btn" onClick={() => setModalOpen(true)}>
                {t('write_review') || 'Write a review'}
              </button>
            </div>
          </aside>

          {/* ── RIGHT: reviews list ── */}
          <div className="br-list">
            {reviews.length === 0 ? (
              <div className="br-empty">
                <MessageCircle size={48} className="br-empty-icon" />
                <h3>{t('reviews.no_reviews_yet') || 'No reviews yet'}</h3>
                <p>
                  {t('reviews.be_the_first') || 'Be the first to review this book.'}{' '}
                  <button type="button" className="br-inline-link" onClick={() => setModalOpen(true)}>
                    {t('reviews.write_first') || 'Write a review'}
                  </button>
                </p>
              </div>
            ) : (
              reviews.map(review => (
                <div key={review.id} className="br-card">
                  <div className="br-card-header">
                    <Avatar src={review.reviewer_photo_url} name={review.reviewer_name} />
                    <div className="br-card-meta">
                      <span className="br-reviewer-name">{review.reviewer_name || 'Anonymous'}</span>
                      <span className="br-review-date">{formatDate(review.created_at)}</span>
                    </div>
                    <StarRating value={review.rating} size={16} />
                  </div>
                  {review.review_text && (
                    <p className="br-review-text">{review.review_text}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL ── */}
      {modalOpen && (
        <div className="br-modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="br-modal">
            <button className="br-modal-close" onClick={() => setModalOpen(false)}><X size={20} /></button>
            <h2 className="br-modal-title">{t('write_review') || 'Write a Review'}</h2>

            <form onSubmit={handleSubmit} className="br-form">
              {error && <div className="br-form-error">{error}</div>}

              <div className="br-form-group">
                <label>{t('reviews.rating_question') || 'Your rating'}</label>
                <StarRating
                  value={form.rating}
                  interactive
                  onChange={(v) => setForm(f => ({ ...f, rating: v }))}
                  size={32}
                />
              </div>

              {!user && (
                <div className="br-form-group">
                  <label>{t('reviews.name_placeholder') || 'Your name'}</label>
                  <input
                    type="text"
                    className="br-input"
                    value={form.reviewer_name}
                    onChange={e => setForm(f => ({ ...f, reviewer_name: e.target.value }))}
                    placeholder={t('reviews.name_placeholder') || 'Your name'}
                  />
                </div>
              )}

              <div className="br-form-group">
                <label>{t('reviews.text_placeholder') || 'Your review'}</label>
                <textarea
                  className="br-textarea"
                  rows={5}
                  value={form.review_text}
                  onChange={e => setForm(f => ({ ...f, review_text: e.target.value }))}
                  placeholder={t('reviews.text_placeholder') || 'Share your thoughts about this book…'}
                />
              </div>

              <button type="submit" className="br-submit-btn" disabled={submitting}>
                {submitting ? (t('saving') || 'Submitting…') : (t('reviews.submit') || 'Submit Review')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BookReviews;
