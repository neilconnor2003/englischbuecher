import React from 'react';
import { useTranslation } from 'react-i18next';
//import './Legal.css';
import './legal.css';

const Terms = () => {
  const { t } = useTranslation();

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>{t('terms.title')}</h1>
        <ol>
          <li><strong>{t('terms.scope')}</strong><br />{t('terms.scope_text')}</li>
          <li><strong>{t('terms.contract')}</strong><br />{t('terms.contract_text')}</li>
          <li><strong>{t('terms.prices')}</strong><br />{t('terms.prices_text')}</li>
          <li><strong>{t('terms.shipping')}</strong><br />{t('terms.shipping_text')}</li>
          <li><strong>{t('terms.payment')}</strong><br />{t('terms.payment_text')}</li>
          <li><strong>{t('terms.revocation')}</strong><br />{t('terms.revocation_text')}</li>
        </ol>
        <p><em>Stand: November 2025</em></p>
      </div>
    </div>
  );
};

export default Terms;