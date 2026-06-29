// frontend/src/pages/RequestBook/RequestBookPage.jsx
import React, { useContext, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import axios from 'axios';
import config from '../../config';
import { toast } from 'react-toastify';
import { Search, BookOpen, CheckCircle, Loader } from 'lucide-react';
import './request-book.css';

export default function RequestBookPage() {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext);
  const isDe = i18n.resolvedLanguage === 'de';

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);

  const [form, setForm] = useState({
    requester_name: '', requester_email: '',
    isbn13: '', isbn10: '', title: '', author: '', publisher: '', notes: '',
  });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fetchSuggestions = (value) => {
    clearTimeout(debounceRef.current);
    if (!value || value.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const { data } = await axios.get(`${config.API_URL}/api/book-search/suggest`, { params: { q: value } });
        setSuggestions(Array.isArray(data) ? data : []);
      } catch { setSuggestions([]); }
      finally { setLoadingSuggestions(false); }
    }, 300);
  };

  const handleSuggestionSelect = (book) => {
    setForm(f => ({
      ...f,
      title:     book.title     || f.title,
      author:    book.author    || f.author,
      publisher: book.publisher || f.publisher,
      isbn13:    book.isbn13    || f.isbn13,
      isbn10:    book.isbn10    || f.isbn10,
    }));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.isbn13 && !form.isbn10 && !form.title.trim()) {
      toast.error(t('request.validation_isbn_or_title') || 'Please provide ISBN or title');
      return;
    }
    if (!user && (!form.requester_name.trim() || !form.requester_email.trim())) {
      toast.error(t('request.name_required') || 'Name and email are required');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${config.API_URL}/api/book-requests`, {
        isbn13: form.isbn13.trim() || null,
        isbn10: form.isbn10.trim() || null,
        title:  form.title.trim()  || null,
        author: form.author.trim() || null,
        publisher: form.publisher.trim() || null,
        notes:  form.notes.trim()  || null,
        requester_name:  user ? null : form.requester_name.trim(),
        requester_email: user ? null : form.requester_email.trim(),
      });
      setSuccess(true);
    } catch { toast.error(t('request.submit_failed') || 'Submission failed. Please try again.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="request-book-page">
      <div className="request-container">
        <div className="request-layout">

          {/* ── LEFT: info panel ── */}
          <div className="request-intro">
            <p className="request-intro__eyebrow">
              <span className="request-intro__eyebrow-dot" />
              {isDe ? 'Buch anfragen' : 'Request a book'}
            </p>
            <h1 className="request-title">{t('request.page_title')}</h1>
            <p className="request-subtitle">
              {isDe ? 'Finde dein Buch nicht? Frag es einfach an – wir helfen dir schnell.' : "Didn't find your book? Just request it — we'll help you quickly."}
            </p>
            <ol className="request-steps">
              {[
                { title: isDe ? 'Details teilen' : 'Share the details', desc: isDe ? 'Titel, ISBN oder so viel du weißt.' : 'Title, ISBN, or just whatever you know.' },
                { title: isDe ? 'Wir suchen' : 'We source it',        desc: isDe ? 'Unser Team prüft Verfügbarkeit und Preis.' : 'Our team checks availability and pricing.' },
                { title: isDe ? 'Du erfährst es zuerst' : "You'll hear back", desc: isDe ? 'Per E-Mail, sobald dein Buch bereit ist.' : "By email, as soon as your book's ready." },
              ].map((step, i) => (
                <li key={i} className="request-step">
                  <span className="request-step__num">{i + 1}</span>
                  <div>
                    <div className="request-step__title">{step.title}</div>
                    <div className="request-step__desc">{step.desc}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* ── RIGHT: form ── */}
          <div className="request-box">
            {success ? (
              <div className="request-success">
                <CheckCircle size={48} className="request-success-icon" />
                <h2 className="request-success-title">
                  {isDe ? 'Anfrage eingegangen!' : 'Request received!'}
                </h2>
                <p className="request-success-desc">
                  {isDe ? 'Wir melden uns per E-Mail, sobald wir etwas für dich haben.' : "We'll reach out by email as soon as we have something for you."}
                </p>
                <button className="rbook-submit" onClick={() => { setSuccess(false); setForm({ requester_name:'', requester_email:'', isbn13:'', isbn10:'', title:'', author:'', publisher:'', notes:'' }); }}>
                  {isDe ? 'Weiteres Buch anfragen' : 'Request another book'}
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="request-form" noValidate>
                {!user && (
                  <>
                    <div className="rbook-field">
                      <label>{t('request.name')}</label>
                      <input type="text" value={form.requester_name} onChange={e => setField('requester_name', e.target.value)} required />
                    </div>
                    <div className="rbook-field">
                      <label>{t('request.email')}</label>
                      <input type="email" value={form.requester_email} onChange={e => setField('requester_email', e.target.value)} required />
                    </div>
                  </>
                )}

                {/* Title with autocomplete */}
                <div className="rbook-field rbook-field--autocomplete">
                  <label>{t('request.title')} <span className="rbook-required">*</span></label>
                  <div className="rbook-autocomplete-wrap">
                    <input
                      type="text"
                      value={form.title}
                      placeholder={t('request.title_placeholder')}
                      onChange={e => { setField('title', e.target.value); fetchSuggestions(e.target.value); setShowSuggestions(true); }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      onFocus={() => suggestions.length && setShowSuggestions(true)}
                    />
                    {loadingSuggestions && <Loader size={14} className="rbook-spinner" />}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="rbook-suggestions">
                        {suggestions.map((s, i) => (
                          <div key={i} className="rbook-suggestion-item" onMouseDown={() => handleSuggestionSelect(s)}>
                            {s.cover && <img src={s.cover} alt={s.title} className="rbook-sugg-img" />}
                            <div>
                              <div className="rbook-sugg-title">{s.title}</div>
                              <div className="rbook-sugg-meta">{[s.author, s.year].filter(Boolean).join(' · ')}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="rbook-hint">{isDe ? 'Mind. 2 Zeichen für Vorschläge' : 'Type at least 2 characters for suggestions'}</span>
                </div>

                <div className="rbook-row">
                  <div className="rbook-field">
                    <label>{t('request.isbn13')}</label>
                    <input type="text" value={form.isbn13} placeholder="978..." onChange={e => setField('isbn13', e.target.value)} />
                  </div>
                  <div className="rbook-field">
                    <label>{t('request.isbn10')}</label>
                    <input type="text" value={form.isbn10} placeholder="0-..." onChange={e => setField('isbn10', e.target.value)} />
                  </div>
                </div>

                <div className="rbook-field">
                  <label>{t('request.author')}</label>
                  <input type="text" value={form.author} onChange={e => setField('author', e.target.value)} />
                </div>

                <div className="rbook-field">
                  <label>{t('request.publisher')}</label>
                  <input type="text" value={form.publisher} onChange={e => setField('publisher', e.target.value)} />
                </div>

                <div className="rbook-field">
                  <label>{t('request.notes')}</label>
                  <textarea rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} />
                </div>

                <button type="submit" className="rbook-submit" disabled={submitting}>
                  {submitting
                    ? <><Loader size={16} className="rbook-spin" /> {isDe ? 'Wird gesendet…' : 'Sending…'}</>
                    : t('request.submit')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
