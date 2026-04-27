import React from 'react';
import { useTranslation } from 'react-i18next';
//import './Legal.css';
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
          {/*<li>{t('shipping.methods.dpd_gogreen')}</li>*/}
        </ul>

        <h2>{t('shipping.costs.title')}</h2>
        <p>{t('shipping.costs.description')}</p>

        <h2>{t('shipping.payment.title')}</h2>
        <ul>
          <li>{t('shipping.payment.paypal')}</li>
          <li>{t('shipping.payment.card')}</li>
        </ul>

      </div>
    </div>
  );
};

export default Shipping;