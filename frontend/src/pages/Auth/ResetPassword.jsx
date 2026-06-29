// frontend/src/pages/Auth/ResetPassword.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import config from '@config';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import './ResetPassword.css';

export default function ResetPassword() {
  const { token }   = useParams();
  const navigate    = useNavigate();
  const { t, i18n } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('i18nextLng') || 'de';
    if (saved !== i18n.language) i18n.changeLanguage(saved);
  }, [i18n]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError(t('passwords_dont_match') || "Passwords don't match");
    if (password.length < 8) return setError(t('password_too_short') || 'Min 8 characters');
    setLoading(true);
    try {
      const res  = await fetch(`${config.API_URL}/api/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(data.error || t('link_expired') || 'Link expired or invalid');
      }
    } catch {
      setError(t('network_error') || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rp-page">
      <div className="rp-card">

        <div className="rp-header">
          <div className="rp-icon">🔑</div>
          <h1 className="rp-title">{t('password_reset') || 'Reset Password'}</h1>
          <p className="rp-subtitle">{t('reset_password_subtitle') || 'Enter your new password below'}</p>
        </div>

        {success ? (
          <div className="rp-success">
            <CheckCircle size={36} className="rp-success-icon" />
            <h2 className="rp-success-title">{t('reset_success') || 'Password updated!'}</h2>
            <p className="rp-success-text">{t('redirecting_login') || 'Redirecting you to login…'}</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="rp-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="rp-form">
              <div className="rp-field">
                <label>{t('new_password') || 'New password'}</label>
                <div className="rp-input-wrap">
                  <Lock size={15} className="rp-icon-field" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength="8"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="rp-field">
                <label>{t('confirm_password') || 'Confirm new password'}</label>
                <div className="rp-input-wrap">
                  <Lock size={15} className="rp-icon-field" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                </div>
                {confirm && password !== confirm && (
                  <span className="rp-mismatch">{t('passwords_dont_match') || "Passwords don't match"}</span>
                )}
              </div>

              <button
                type="submit"
                className="rp-submit"
                disabled={loading || !password || password !== confirm}
              >
                {loading
                  ? <><span className="rp-spinner" />{t('saving') || 'Saving…'}</>
                  : t('change_password') || 'Set New Password'}
              </button>
            </form>
          </>
        )}

        <p className="rp-footer">
          <Link to="/login">← {t('back_to_login') || 'Back to Login'}</Link>
        </p>
      </div>
    </div>
  );
}
