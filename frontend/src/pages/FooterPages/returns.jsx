// frontend/src/pages/FooterPages/returns.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import './legal.css';
import './returns.css';

const Returns = () => {
  const { t } = useTranslation();
  const steps = ['1', '2', '3', '4'];

  return (
    <div className="legal-page">
      <div className="returns-hero">
        <h1>{t('returns.title')}</h1>
        <p>{t('returns.subtitle')}</p>
      </div>

      <div className="legal-container">
        <h2>{t('returns.steps.title')}</h2>
        <div className="returns-steps-grid">
          {steps.map(n => (
            <div key={n} className="returns-step">
              <div className="returns-step-num">{n}</div>
              <h3>{t(`returns.steps.${n}.title`)}</h3>
              <p>{t(`returns.steps.${n}.text`)}</p>
            </div>
          ))}
        </div>

        <h2>{t('returns.info.title')}</h2>
        <ul>
          <li><CheckCircle size={14} className="returns-check" /> {t('returns.info.timeframe')}</li>
          <li><CheckCircle size={14} className="returns-check" /> {t('returns.info.condition')}</li>
          <li><CheckCircle size={14} className="returns-check" /> {t('returns.info.cost')}</li>
          <li><CheckCircle size={14} className="returns-check" /> {t('returns.info.damaged')}</li>
        </ul>
      </div>
    </div>
  );
};

export default Returns;
