// frontend/src/pages/Auth/Login.jsx
import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import config from '../../config';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import './Login.css';

function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { checkAuth } = useContext(AuthContext);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const formData = new FormData(e.target);
    const email    = formData.get('email')?.trim();
    const password = formData.get('password');

    if (!email || !password) {
      setError(t('login_all_fields_required') || 'Email and password are required');
      setIsLoading(false);
      return;
    }

    try {
      const res  = await fetch(`${config.API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        await checkAuth();
        window.location.href = '/';
      } else {
        if (json.error?.includes('unverified')) {
          setError(
            <>
              {t('login_email_not_verified') || 'Please verify your email first.'}
              <Link to="/resend-verification" className="login-err-link">
                {t('resend_link') || 'Resend verification email'}
              </Link>
            </>
          );
        } else if (json.error?.includes('Invalid')) {
          setError(t('login_invalid_credentials') || 'Invalid email or password');
        } else {
          setError(json.error || t('login_failed') || 'Login failed');
        }
      }
    } catch (err) {
      setError(t('network_error') || 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const ua    = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
      window.location.href = `${config.API_URL}/auth/google`;
      return;
    }

    const width = 500, height = 600;
    const left  = window.screenX + (window.outerWidth  - width)  / 2;
    const top   = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      `${config.API_URL}/auth/google`,
      'google-login',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) { window.location.href = `${config.API_URL}/auth/google`; return; }

    const handleMessage = async (event) => {
      if (event.data?.type === 'google-login-success') {
        window.removeEventListener('message', handleMessage);
        clearInterval(checkClosed);
        await checkAuth();
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
          .then(async data => { if (data?.id) { await checkAuth(); window.location.href = '/'; } })
          .catch(() => {});
      }
    }, 500);
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* ── HEADER ── */}
        <div className="login-header">
          <div className="login-icon">📖</div>
          <h1 className="login-title">{t('login')}</h1>
          <p className="login-subtitle">{t('login_welcome') || 'Welcome back'}</p>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* ── GOOGLE ── */}
        <button className="login-google-btn" onClick={handleGoogleLogin} disabled={isLoading}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#fff" d="M12 6.25c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t('login_google') || 'Continue with Google'}
        </button>

        {/* ── DIVIDER ── */}
        <div className="login-divider"><span>{t('or') || 'or'}</span></div>

        {/* ── FORM ── */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label>{t('login_email')}</label>
            <div className="login-input-wrap">
              <Mail size={15} className="login-icon-field" />
              <input
                type="email"
                name="email"
                placeholder={t('login_email_placeholder')}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="login-field">
            <div className="login-label-row">
              <label>{t('login_password')}</label>
              <Link to="/forgot-password" className="login-forgot">
                {t('forgot_password') || 'Forgot password?'}
              </Link>
            </div>
            <div className="login-input-wrap">
              <Lock size={15} className="login-icon-field" />
              <input
                type="password"
                name="password"
                placeholder={t('login_password_placeholder')}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <button type="submit" className="login-submit" disabled={isLoading}>
            {isLoading ? (
              <><span className="login-spinner" />{t('login_submitting') || 'Logging in...'}</>
            ) : (
              t('login_submit')
            )}
          </button>
        </form>

        {/* ── FOOTER ── */}
        <p className="login-footer">
          {t('login_no_account')}{' '}
          <Link to="/register">{t('register')}</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
