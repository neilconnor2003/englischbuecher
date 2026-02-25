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

        <h2>{t('shipping.costs')}</h2>
        <p>Deutschland: 3,99 € • ab 29 € versandkostenfrei<br />
        EU: 9,90–14,90 € • Schweiz: 19,90 €</p>

        <h2>{t('shipping.methods')}</h2>
        <ul>
          <li>DHL Paket (2–3 Werktage)</li>
          <li>DHL GoGreen (CO₂-neutral)</li>
        </ul>

        <h2>{t('shipping.payment')}</h2>
        <ul>
          <li>PayPal</li>
          <li>Kreditkarte (Visa, Mastercard)</li>
          <li>Apple Pay / Google Pay</li>
          <li>Klarna Rechnung & Raten</li>
          <li>Vorkasse</li>
        </ul>
      </div>
    </div>
  );
};

export default Shipping;