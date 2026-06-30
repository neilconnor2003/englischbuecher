// frontend/src/pages/FooterPages/terms.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import './legal.css';

const Terms = () => {
  const { t } = useTranslation();
  const sections = ['scope', 'contract', 'prices', 'shipping', 'payment', 'revocation', 'warranty', 'liability', 'law'];

  return (
    <div className="legal-page">
      <div className="legal-container">
        <span className="legal-updated">{t('legal_updated') || 'Last updated: June 2026'}</span>
        <h1>{t('terms.title')}</h1>
        <ol className="terms-list">
          {sections.map(key => (
            <li key={key}>
              <strong>{t(`terms.${key}`)}</strong><br />
              {t(`terms.${key}_text`)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default Terms;
