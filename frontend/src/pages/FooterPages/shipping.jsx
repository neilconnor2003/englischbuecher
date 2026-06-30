// frontend/src/pages/FooterPages/shipping.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import './legal.css';

const Shipping = () => {
  const { t } = useTranslation();

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>{t('shipping.title')}</h1>

        <h2>{t('shipping.methods.title')}</h2>
        <ul>
          <li>{t('shipping.methods.dpd')}</li>
        </ul>

        <h2>{t('shipping.costs.title')}</h2>
        <p>{t('shipping.costs.description')}</p>

        <h2>{t('shipping.tracking.title')}</h2>
        <p>{t('shipping.tracking.text')}</p>

        <h2>{t('shipping.payment.title')}</h2>
        <ul>
          <li>{t('shipping.payment.card')}</li>
          <li>{t('shipping.payment.paypal')}</li>
        </ul>

        <div className="legal-info-box">{t('shipping.checkout_note')}</div>

        <h2>{t('shipping.international.title')}</h2>
        <p>{t('shipping.international.text')}</p>
      </div>
    </div>
  );
};

export default Shipping;
