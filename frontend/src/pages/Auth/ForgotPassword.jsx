// frontend/src/pages/Auth/ForgotPassword.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import config from '@config';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';
import './ForgotPassword.css';

function ForgotPassword() {
  const { t, i18n } = useTranslation();
  const [email, setEmail]     = useState('');
  const [message, setMessage] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('i18nextLng') || 'de';
    if (savedLang !== i18n.language) i18n.changeLanguage(savedLang);
  }, [i18n]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const res  = await fetch(`${config.API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(t('email_sent') || 'Check your email for the reset link');
        setSent(true);
      } else {
        setError(data.error || t('something_went_wrong'));
      }
    } catch {
      setError(t('network_error') || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fp-page">
      <div className="fp-card">

        {/* ── HEADER ── */}
        <div className="fp-header">
          <div className="fp-icon">🔐</div>
          <h1 className="fp-title">{t('forgot_password_title')}</h1>
          <p className="fp-subtitle">{t('forgot_password_subtitle')}</p>
        </div>

        {/* ── SUCCESS STATE ── */}
        {sent ? (
          <div className="fp-success">
            <div className="fp-success-icon"><CheckCircle size={32} /></div>
            <h2 className="fp-success-title">{t('email_sent') || 'Email sent!'}</h2>
            <p className="fp-success-text">
              {t('check_inbox') || 'Check your inbox for the password reset link. It expires in 15 minutes.'}
            </p>
            <button
              className="fp-resend"
              onClick={() => { setSent(false); setMessage(''); }}
            >
              {t('resend_link') || 'Send again'}
            </button>
          </div>
        ) : (
          <>
            {/* ── ERROR ── */}
            {error && (
              <div className="fp-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* ── FORM ── */}
            <form onSubmit={handleSubmit} className="fp-form">
              <div className="fp-field">
                <label>{t('login_email')}</label>
                <div className="fp-input-wrap">
                  <Mail size={15} className="fp-icon-field" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <button type="submit" className="fp-submit" disabled={loading}>
                {loading ? (
                  <><span className="fp-spinner" />{t('sending') || 'Sending...'}</>
                ) : (
                  t('send_reset_link')
                )}
              </button>
            </form>
          </>
        )}

        {/* ── BACK LINK ── */}
        <p className="fp-footer">
          <Link to="/login">← {t('back_to_login')}</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
