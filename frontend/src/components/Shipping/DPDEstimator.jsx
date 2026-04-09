
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getDPDShippingPrice } from '../../utils/dpdShipping';

export default function DPDEstimator({ weightGrams }) {
  const { t, i18n } = useTranslation();

  if (!weightGrams) return null;

  const price = getDPDShippingPrice(weightGrams);

  const formattedPrice = new Intl.NumberFormat(
    i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US',
    {
      style: 'currency',
      currency: 'EUR',
    }
  ).format(price);

  return (
    <div
      style={{
        marginTop: 6,
        padding: '10px 12px',
        border: '1px solid #e5e5e5',
        borderRadius: 8,
        background: '#fafafa',
      }}
    >
      <div style={{ fontWeight: 700 }}>
        {formattedPrice}
      </div>
      <div style={{ fontSize: 13 }}>
        {t('shipping.provider_label')}
      </div>
      <div style={{ fontSize: 12, color: '#555' }}>
        {t('shipping.checkout_note')}
      </div>
    </div>
  );
}
