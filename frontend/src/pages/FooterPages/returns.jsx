import React from 'react';
import { useTranslation } from 'react-i18next';
import './Returns.css';

const Returns = () => {
  const { t } = useTranslation();

  return (
    <div className="returns-page">
      <div className="returns-hero">
        <h1>{t('returns.title')}</h1>
        <p>{t('returns.subtitle')}</p>
      </div>

      <div className="returns-content">
        <section className="returns-steps">
          <h2>{t('returns.steps.title')}</h2>
          <div className="steps-grid">
            <div className="step">
              <div className="step-number">1</div>
              <h3>{t('returns.steps.1.title')}</h3>
              <p>{t('returns.steps.1.text')}</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>{t('returns.steps.2.title')}</h3>
              <p>{t('returns.steps.2.text')}</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>{t('returns.steps.3.title')}</h3>
              <p>{t('returns.steps.3.text')}</p>
            </div>
          </div>
        </section>

        <section className="returns-info">
          <h2>{t('returns.info.title')}</h2>
          <p><strong>{t('returns.info.address')}</strong></p>
          <p>
            Dein Englisch Bücher<br />
            Retourenabteilung<br />
            Musterstraße 123<br />
            80331 München
          </p>
          <p className="highlight">{t('returns.info.free')}</p>
        </section>
      </div>
    </div>
  );
};

export default Returns;