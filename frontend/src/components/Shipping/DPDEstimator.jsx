
import React from 'react';
import { getDPDShippingPrice } from '../../utils/dpdShipping';

export default function DPDEstimator({ weightGrams }) {
  if (!weightGrams) return null;

  const price = getDPDShippingPrice(weightGrams);

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
        €{price.toFixed(2)}
      </div>
      <div style={{ fontSize: 13 }}>
        DPD · Germany‑wide (incl. VAT)
      </div>
      <div style={{ fontSize: 12, color: '#555' }}>
        Exact shipping confirmed at checkout
      </div>
    </div>
  );
}
