// frontend/src/pages/Privacy.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGetPrivacyQuery } from '../../admin/features/privacy/privacyApiSlice';
//import './Legal.css';
import './legal.css';

const Privacy = () => {
  const { t, i18n } = useTranslation();
  const { data: p = {}, isLoading } = useGetPrivacyQuery();
  const lang = i18n.language;

  if (isLoading) return <div className="legal-page"><div className="legal-container p-20 text-center">Loading...</div></div>;

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>{t('privacy.title')}</h1>
        <p>{lang === 'de' ? p.intro_de : p.intro_en || t('privacy.intro')}</p>

        <h2>1. {t('privacy.controller')}</h2>
        <p>
          {lang === 'de' ? p.controller_name_de : p.controller_name_en || 'Max Mustermann'}<br />
          {lang === 'de' ? p.controller_address_de : p.controller_address_en || 'Musterstraße 123, 80331 München'}<br />
          E-Mail: <a href={`mailto:${p.controller_email || 'datenschutz@dein-englisch-buecher.de'}`}>
            {p.controller_email || 'datenschutz@dein-englisch-buecher.de'}
          </a>
        </p>

        <h2>2. {t('privacy.data_collection')}</h2>
        <div dangerouslySetInnerHTML={{ __html: (lang === 'de' ? p.collection_de : p.collection_en) || t('privacy.collection.1') }} />

        <h2>3. {t('privacy.cookies')}</h2>
        <p>{lang === 'de' ? p.cookies_de : p.cookies_en || t('privacy.cookies_text')}</p>

        <h2>4. {t('privacy.tools')}</h2>
        <p><strong>Google Analytics</strong> – {lang === 'de' ? p.analytics_de : p.analytics_en || t('privacy.analytics')}</p>
        <p><strong>Stripe/PayPal</strong> – {lang === 'de' ? p.payment_de : p.payment_en || t('privacy.payment')}</p>

        <h2>5. {t('privacy.rights')}</h2>
        <p>{lang === 'de' ? p.rights_de : p.rights_en || t('privacy.rights_text')}</p>

        <h2>6. {t('privacy.security')}</h2>
        <p>{lang === 'de' ? p.security_de : p.security_en || t('privacy.security_text')}</p>

        <p><em>Stand: {p.last_updated || 'November 2025'}</em></p>
      </div>
    </div>
  );
};

export default Privacy;