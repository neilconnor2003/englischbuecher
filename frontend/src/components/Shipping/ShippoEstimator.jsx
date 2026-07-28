
import React, { useEffect, useState } from 'react';
import { Button, Spin, Tooltip, message } from 'antd';
import { EnvironmentOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { MapPin } from 'lucide-react';
import axios from 'axios';
import config from '../../config';
import { setDeliveryContext } from '../../utils/deliveryContext';
import BrandModal, { brandInputStyle, brandLabelStyle } from '../common/BrandModal';

/**
 * Props:
 * - items: [{ weight_grams: number, quantity: number }]
 * - t, i18n
 */
export default function ShippoEstimator({ items = [], t, i18n }) {
  const [dest, setDest] = useState({ country: 'DE', postal: '', city: '' });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);

  // Local form fields for the "change delivery location" modal — replaces
  // antd's Form.useForm(), which the previous version relied on.
  const [formPostal, setFormPostal] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formError, setFormError] = useState('');

  // restore
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ship_dest') || localStorage.getItem('shippo_dest');
      if (raw) setDest(JSON.parse(raw));
    } catch { }
  }, []);

  const fmtKg = (g) => (Number(g || 0) / 1000).toFixed(2);

  async function fetchRate() {
    if (!dest.postal) return;
    if (!items.length) return;
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${config.API_URL}/api/shippo/rates`,
        {
          to_zip: dest.postal,
          to_city: dest.city || 'Berlin',
          items,
          estimate_only: true   // ✅ THIS IS THE KEY
        },
        { withCredentials: true }
      );
      setQuote(data || null);
    } catch (err) {
      console.error('ShippoEstimator error:', err);
      setQuote(null);
      message.error(t?.('shipping_error') || 'Could not fetch shipping');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest.postal, dest.city, items?.length]);

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString(
      i18n?.resolvedLanguage === 'de' ? 'de-DE' : 'en-US',
      { weekday: 'short', day: '2-digit', month: 'short' }
    );

  const etaLine = (r) => {
    const eta = r?.eta || {};
    if (eta?.date_min && eta?.date_max && eta.date_min === eta.date_max)
      return `${t?.('arrives') || 'Arrives'} ${fmtDate(eta.date_min)}`;
    if (eta?.date_min && eta?.date_max)
      return `${t?.('arrives') || 'Arrives'} ${fmtDate(eta.date_min)}–${fmtDate(eta.date_max)}`;
    if (Number.isFinite(r?.estimated_days))
      return `${t?.('arrives') || 'Arrives'} ~${r.estimated_days} ${t?.('days') || 'days'}`;
    if (eta?.range)
      return `${t?.('arrives') || 'Arrives'} ${eta.range[0]}–${eta.range[1]} ${t?.('days') || 'days'}`;
    return '';
  };

  const info = quote?.cheapest;
  const wb = quote?.weight_breakdown;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <EnvironmentOutlined />
        <span>
          {t?.('deliver_to') || 'Deliver to'}{' '}
          <strong>{dest.postal ? `${dest.postal} (DE)` : 'DE'}</strong>
        </span>
        <Button
          type="link"
          size="small"
          onClick={() => {
            setFormPostal(dest.postal || '');
            setFormCity(dest.city || '');
            setFormError('');
            setOpen(true);
          }}
        >
          {t?.('change') || 'Change'}
        </Button>
      </div>

      {loading && <Spin size="small" />}

      {!loading && info && (
        <div
          style={{
            marginTop: 6,
            padding: '10px 12px',
            border: '1px solid #e5e5e5',
            borderRadius: 8,
            background: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              €{Number(info.amount).toFixed(2)}
            </div>
            <Tooltip
              title={
                wb
                  ? `Total ${fmtKg((wb.books_grams || 0) + (wb.packaging_grams || 0))} kg 
• Books ${fmtKg(wb.books_grams)} kg 
• Packaging ${fmtKg(wb.packaging_grams)} kg`
                  : ''
              }
            >
              <InfoCircleOutlined style={{ color: '#888' }} />
            </Tooltip>
          </div>

          <div style={{ fontSize: 14, color: '#333', marginTop: 2 }}>
            {info.provider} · {info.service}
          </div>

          <div style={{ fontSize: 13, color: '#0a7b16', fontWeight: 600, marginTop: 2 }}>
            📦 {etaLine(info)}
          </div>
        </div>
      )}

      {!loading && !info && (
        <div style={{ color: '#999' }}>
          {dest.postal
            ? (t?.('no_shipping_options') || 'No shipping options for this destination.')
            : (t?.('enter_postal') || 'Enter a postal code to see shipping.')}
        </div>
      )}

      <BrandModal
        open={open}
        onClose={() => setOpen(false)}
        icon={MapPin}
        accent="default"
        title={t?.('delivery_location') || 'Delivery location'}
        primaryLabel={t?.('save') || 'Save'}
        onPrimary={() => {
          const postal = formPostal.trim();
          if (!postal) {
            setFormError(t?.('required') || 'Required');
            return;
          }
          const next = { country: 'DE', postal, city: formCity.trim() };

          setDest(next);
          try { localStorage.setItem('ship_dest', JSON.stringify(next)); } catch { }

          // also sync the shared context used by Cart/Checkout
          setDeliveryContext({
            shippingMode: 'delivery',
            postalCode: next.postal,
            city: next.city,
          });

          setOpen(false);
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={brandLabelStyle}>{t?.('postal_code') || 'Postal code'}</label>
          <input
            autoFocus
            style={brandInputStyle}
            value={formPostal}
            onChange={(e) => { setFormPostal(e.target.value); if (formError) setFormError(''); }}
          />
          {formError && (
            <div style={{ color: '#dc2626', fontSize: 13, marginTop: 6 }}>{formError}</div>
          )}
        </div>
        <div>
          <label style={brandLabelStyle}>{t?.('city') || 'City'}</label>
          <input
            style={brandInputStyle}
            value={formCity}
            onChange={(e) => setFormCity(e.target.value)}
          />
        </div>
      </BrandModal>
    </div>
  );
}
