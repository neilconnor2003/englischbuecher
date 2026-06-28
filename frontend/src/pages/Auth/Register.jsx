// frontend/src/pages/Auth/Register.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Globe, AlertCircle } from 'lucide-react';
import config from '@/config';
import './Register.css';

function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = () => {
    const width = 500, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top  = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      `${config.API_URL}/auth/google`,
      'google-login',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    const handleMessage = (event) => {
      if (event.data?.type === 'google-login-success') {
        window.removeEventListener('message', handleMessage);
        clearInterval(checkClosed);
        window.location.href = '/';
      }
    };
    window.addEventListener('message', handleMessage);

    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        fetch(`${config.API_URL}/api/current-user`, { credentials: 'include' })
          .then(r => r.json())
          .then(data => { if (data?.id) window.location.href = '/'; })
          .catch(() => {});
      }
    }, 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const formData = new FormData(e.target);
    const data = {
      first_name: formData.get('first_name')?.trim(),
      last_name:  formData.get('last_name')?.trim(),
      email:      formData.get('email')?.trim(),
      password:   formData.get('password'),
      language:   formData.get('language') || 'de',
    };

    if (!data.first_name || !data.last_name || !data.email || !data.password) {
      setError(t('register_all_fields_required') || 'All fields are required');
      setIsLoading(false);
      return;
    }

    try {
      const res  = await fetch(`${config.API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        alert(t('register_success') || 'Registration successful! Check your email.');
        navigate('/login');
      } else {
        setError(json.error || t('register_error') || 'Registration failed');
      }
    } catch (err) {
      setError(t('network_error') || 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="reg-page">
      <div className="reg-card">

        {/* ── HEADER ── */}
        <div className="reg-header">
          <div className="reg-icon">📚</div>
          <h1 className="reg-title">{t('register')}</h1>
          <p className="reg-subtitle">{t('register_welcome') || 'Create your free account'}</p>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="reg-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* ── GOOGLE ── */}
        <button className="reg-google-btn" onClick={handleGoogleLogin} disabled={isLoading}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#fff" d="M12 6.25c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t('continue_with_google') || 'Continue with Google'}
        </button>
        <p className="reg-google-hint">
          {t('google_creates_account') || "New here? We'll create your account automatically."}
        </p>

        {/* ── DIVIDER ── */}
        <div className="reg-divider">
          <span>{t('or') || 'or'}</span>
        </div>

        {/* ── FORM ── */}
        <form onSubmit={handleSubmit} className="reg-form">

          <div className="reg-row-2">
            <div className="reg-field">
              <label>{t('register_first_name')}</label>
              <div className="reg-input-wrap">
                <User size={15} className="reg-icon-field" />
                <input
                  type="text"
                  name="first_name"
                  placeholder={t('register_first_name')}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="reg-field">
              <label>{t('register_last_name')}</label>
              <div className="reg-input-wrap">
                <User size={15} className="reg-icon-field" />
                <input
                  type="text"
                  name="last_name"
                  placeholder={t('register_last_name')}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="reg-field">
            <label>{t('login_email')}</label>
            <div className="reg-input-wrap">
              <Mail size={15} className="reg-icon-field" />
              <input
                type="email"
                name="email"
                placeholder={t('login_email_placeholder')}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="reg-field">
            <label>{t('login_password')}</label>
            <div className="reg-input-wrap">
              <Lock size={15} className="reg-icon-field" />
              <input
                type="password"
                name="password"
                placeholder={t('login_password_placeholder')}
                required
                minLength="6"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="reg-field">
            <label>{t('language')}</label>
            <div className="reg-input-wrap">
              <Globe size={15} className="reg-icon-field" />
              <select name="language" disabled={isLoading}>
                <option value="en">{t('language_en')}</option>
                <option value="de">{t('language_de')}</option>
              </select>
            </div>
          </div>

          <button type="submit" className="reg-submit" disabled={isLoading}>
            {isLoading ? (
              <><span className="reg-spinner" />{t('register_submitting') || 'Creating account...'}</>
            ) : (
              t('register_submit')
            )}
          </button>
        </form>

        {/* ── FOOTER ── */}
        <p className="reg-footer">
          {t('register_have_account')}{' '}
          <Link to="/login">{t('login')}</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
