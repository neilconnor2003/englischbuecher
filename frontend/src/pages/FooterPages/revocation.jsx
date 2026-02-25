import React from 'react';
import { useTranslation } from 'react-i18next';
//import './Legal.css';
import './legal.css';

const Revocation = () => {
  const { t } = useTranslation();

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>{t('revocation.title')}</h1>
        <h2>{t('revocation.right')}</h2>
        <p>{t('revocation.right_text')}</p>

        <h2>{t('revocation.consequences')}</h2>
        <p>{t('revocation.consequences_text')}</p>

        <h2>{t('revocation.form')}</h2>
        <p>{t('revocation.form_text')}</p>
        <p>
          <strong>{t('revocation.to')}</strong><br />
          Dein Englisch Bücher<br />
          Max Mustermann<br />
          Musterstraße 123<br />
          80331 München<br />
          E-Mail: widerruf@dein-englisch-buecher.de
        </p>

        <p><em>{t('revocation.end')}</em></p>
      </div>
    </div>
  );
};

export default Revocation;