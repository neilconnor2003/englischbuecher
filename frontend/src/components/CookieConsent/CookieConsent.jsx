// frontend/src/components/CookieConsent/CookieConsent.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';
import axios from 'axios';
import config from '../../config';
import './CookieConsent.css';

const STORAGE_KEY = 'cookie_consent_v1';
const ANON_ID_KEY = 'cookie_consent_anon_id';
const GA4_ID = 'G-T5FKMD328X';
const CLARITY_ID = 'xembtgq0cs';

// ── Get or create a stable anonymous ID for guests ──
function getAnonId() {
  let id = localStorage.getItem(ANON_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(ANON_ID_KEY, id);
  }
  return id;
}

// ── Log the consent decision to the backend (non-blocking) ──
function logConsentToServer(consent, source) {
  axios.post(`${config.API_URL}/api/cookie-consent`, {
    essential: true,
    analytics: !!consent.analytics,
    source,
    consent_id: getAnonId(), // ignored server-side if user is logged in
  }, { withCredentials: true }).catch(() => {
    // Non-fatal — consent already applied locally either way
  });
}

// ── Load GA4 dynamically once consent is given ──
function loadGA4() {
  if (window.gtag) return; // already loaded
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA4_ID, {
    anonymize_ip: true,
    cookie_flags: 'SameSite=None;Secure',
  });
}

// ── Load Clarity dynamically once consent is given ──
function loadClarity() {
  if (window.clarity) return; // already loaded
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', CLARITY_ID);
}

// ── Read saved consent from localStorage ──
export function getStoredConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Apply consent: load scripts if analytics accepted ──
export function applyConsent(consent) {
  if (consent?.analytics) {
    loadGA4();
    loadClarity();
  }
}

// On app boot, if consent was already given previously, re-apply it
// (call this once from App.jsx, outside this component, so analytics
// loads immediately on repeat visits without waiting for the banner).
export function initConsentOnLoad() {
  const stored = getStoredConsent();
  if (stored) applyConsent(stored);
}

export default function CookieConsent() {
  const { t, i18n } = useTranslation();
  const isDe = i18n.resolvedLanguage === 'de';
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      setVisible(true);
    }
    // Listen for "Cookie Settings" link clicks anywhere in the app (e.g. footer)
    const reopen = () => { setVisible(true); setShowCustomize(true); };
    window.addEventListener('open-cookie-settings', reopen);
    return () => window.removeEventListener('open-cookie-settings', reopen);
  }, []);

  const save = (consent, source) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...consent, ts: Date.now() }));
    applyConsent(consent);
    logConsentToServer(consent, source);
    setVisible(false);
    setShowCustomize(false);
  };

  const acceptAll = () => save({ essential: true, analytics: true }, 'accept_all');
  const declineAll = () => save({ essential: true, analytics: false }, 'decline_all');
  const saveCustom = () => save({ essential: true, analytics: analyticsChecked }, 'settings');

  if (!visible) return null;

  return (
    <div className="cc-overlay" role="dialog" aria-label="Cookie consent">
      <div className="cc-banner">
        <button className="cc-close" onClick={declineAll} aria-label="Close">
          <X size={16} />
        </button>

        <div className="cc-icon"><Cookie size={22} /></div>

        {!showCustomize ? (
          <>
            <h3 className="cc-title">{isDe ? 'Wir verwenden Cookies' : 'We use cookies'}</h3>
            <p className="cc-text">
              {isDe
                ? 'Wir nutzen essenzielle Cookies, damit unsere Website funktioniert, sowie optionale Analyse-Cookies (Google Analytics, Microsoft Clarity), um sie zu verbessern. Du kannst frei wählen, welche du erlaubst.'
                : "We use essential cookies to make our website work, plus optional analytics cookies (Google Analytics, Microsoft Clarity) to help us improve it. You can choose which ones to allow."}{' '}
              <Link to="/privacy" className="cc-link">{isDe ? 'Mehr erfahren' : 'Learn more'}</Link>
            </p>

            <div className="cc-actions">
              <button className="cc-btn-ghost" onClick={() => setShowCustomize(true)}>
                {isDe ? 'Anpassen' : 'Customize'}
              </button>
              <button className="cc-btn-secondary" onClick={declineAll}>
                {isDe ? 'Nur essenzielle' : 'Decline'}
              </button>
              <button className="cc-btn-primary" onClick={acceptAll}>
                {isDe ? 'Alle akzeptieren' : 'Accept all'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="cc-title">{isDe ? 'Cookie-Einstellungen' : 'Cookie settings'}</h3>

            <div className="cc-option">
              <div className="cc-option-header">
                <span className="cc-option-title">{isDe ? 'Essenziell' : 'Essential'}</span>
                <span className="cc-option-badge">{isDe ? 'Immer aktiv' : 'Always on'}</span>
              </div>
              <p className="cc-option-desc">
                {isDe
                  ? 'Notwendig für Login, Warenkorb und grundlegende Funktionen. Kann nicht deaktiviert werden.'
                  : 'Required for login, your shopping cart, and core site functions. Cannot be turned off.'}
              </p>
            </div>

            <div className="cc-option">
              <div className="cc-option-header">
                <span className="cc-option-title">{isDe ? 'Analyse' : 'Analytics'}</span>
                <label className="cc-switch">
                  <input
                    type="checkbox"
                    checked={analyticsChecked}
                    onChange={e => setAnalyticsChecked(e.target.checked)}
                  />
                  <span className="cc-switch-slider" />
                </label>
              </div>
              <p className="cc-option-desc">
                {isDe
                  ? 'Google Analytics und Microsoft Clarity helfen uns zu verstehen, wie Besucher unsere Website nutzen.'
                  : 'Google Analytics and Microsoft Clarity help us understand how visitors use our website.'}
              </p>
            </div>

            <div className="cc-actions">
              <button className="cc-btn-ghost" onClick={() => setShowCustomize(false)}>
                {isDe ? 'Zurück' : 'Back'}
              </button>
              <button className="cc-btn-primary" onClick={saveCustom}>
                {isDe ? 'Auswahl speichern' : 'Save preferences'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
