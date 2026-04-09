
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Spin } from 'antd';
import { getDeliveryContext } from '../../utils/deliveryContext';

export default function DPDEstimator({ weightGrams }) {
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);

  const ctx = getDeliveryContext() || {};
  const postalCode = ctx.postalCode;
  const city = ctx.city;

  useEffect(() => {
    if (!postalCode || !weightGrams) {
      setQuote(null);
      return;
    }

    let cancelled = false;

    async function fetchEstimate() {
      setLoading(true);
      try {
        const { data } = await axios.post('/api/dpd/estimate', {
          to_postal: postalCode,
          to_city: city,
          weight_grams: weightGrams,
        });

        if (!cancelled) setQuote(data);
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEstimate();
    return () => { cancelled = true; };
  }, [postalCode, city, weightGrams]);

  if (!postalCode)
    return <div style={{ color: '#888' }}>Enter postal code to see delivery cost.</div>;

  if (loading) return <Spin size="small" />;

  if (!quote)
    return <div style={{ color: '#888' }}>Delivery price unavailable.</div>;

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
        €{quote.amount_eur.toFixed(2)}
      </div>
      <div style={{ fontSize: 13 }}>
        {quote.provider} · {quote.service}
      </div>
      <div style={{ fontSize: 12, color: '#0a7b16' }}>
        Delivery in {quote.estimated_days} business day(s)
      </div>
    </div>
  );
}
