
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGetPrivacyQuery } from '../../admin/features/privacy/privacyApiSlice';
import './legal.css';

const Privacy = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data: p = {}, isLoading } = useGetPrivacyQuery();

  if (isLoading) return <div className="legal-page"><div className="legal-content">Loading...</div></div>;

  const section = (key) =>
    lang === 'de' ? p[`${key}_de`] : p[`${key}_en`];

  return (
    <div className="legal-page">
      <div className="legal-content">
        <p><em>Stand: {p.last_updated || 'November 2025'}</em></p>
        <h1>{t('privacy.title')}</h1>
        {[
          'intro', 'collection', 'cookies',
          'analytics', 'payment', 'rights', 'security'
        ].map(key => (
          <section key={key}>
            <h2>{t(`privacy.${key}`)}</h2>
            <div dangerouslySetInnerHTML={{ __html: section(key) }} />
          </section>
        ))}
      </div>
    </div>
  );
};

export default Privacy;
