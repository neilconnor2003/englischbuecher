// src/pages/AuthComplete/AuthComplete.jsx
//
// Landing page for the iOS/Safari Google-login redirect fallback.
// The backend's /auth/google/callback redirects here with a
// short-lived one-time login_token (see server.js) instead of
// relying on the session cookie surviving the cross-site redirect
// from Google → backend → frontend, which Safari's ITP can silently
// refuse to persist, especially in dev where the frontend and
// backend are on completely unrelated root domains.
//
// This page exchanges that token for a real session via a
// same-origin-initiated POST (exchangeLoginToken in AuthContext),
// which Safari does trust to set/store the cookie, then redirects
// to the homepage.

import React, { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import './AuthComplete.css';

export default function AuthComplete() {
  const { exchangeLoginToken } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const de = i18n.resolvedLanguage === 'de';

  const [status, setStatus] = useState('working'); // working | error
  const ranOnce = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode's double-invoke in dev, which
    // would otherwise try to redeem the one-time token twice.
    if (ranOnce.current) return;
    ranOnce.current = true;

    const token = searchParams.get('login_token');
    if (!token) {
      setStatus('error');
      return;
    }

    exchangeLoginToken(token).then((success) => {
      if (success) {
        navigate('/', { replace: true });
      } else {
        setStatus('error');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'error') {
    return (
      <div className="auth-complete-page">
        <div className="auth-complete-card">
          <p className="auth-complete-title">
            {de ? 'Anmeldung fehlgeschlagen' : 'Login failed'}
          </p>
          <p className="auth-complete-desc">
            {de
              ? 'Der Anmeldelink ist abgelaufen oder ungültig. Bitte versuche es erneut.'
              : 'The login link expired or is invalid. Please try again.'}
          </p>
          <a href="/login" className="auth-complete-link">
            {de ? 'Zurück zum Login' : 'Back to login'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-complete-page">
      <div className="auth-complete-card">
        <div className="auth-complete-spinner" aria-hidden="true" />
        <p className="auth-complete-title">
          {de ? 'Anmeldung wird abgeschlossen…' : 'Completing sign-in…'}
        </p>
      </div>
    </div>
  );
}
