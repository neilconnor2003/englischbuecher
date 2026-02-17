
// frontend/src/components/Shipping/ShippoEstimator.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Input, Spin, message, Radio } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import config from '../../config';

export default function ShippoEstimator({ weightGrams = 500, t, i18n }) {
  const [dest, setDest] = useState({ country: 'DE', postal: '', city: '' });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cheapest, setCheapest] = useState(null);
  const [allRates, setAllRates] = useState([]);
  const [selection, setSelection] = useState(null);

  // Try to restore last choice from localStorage (client-only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('shippo_dest');
      if (raw) setDest(JSON.parse(raw));
    } catch {/* ignore */}
  }, []);

  async function fetchRates(currentDest) {
    const postal = (currentDest?.postal || '').trim();
    const city = (currentDest?.city || '').trim() || 'Berlin';
    if (!postal) return; // wait until user provides a postal code

    setLoading(true);
    try {
      const { data } = await axios.post(
        `${config.API_URL}/api/shippo/rates`,
        {
          to_zip: postal,
          to_city: city,
          weight_grams: Number(weightGrams) || 500
        },
        { withCredentials: true }
      );

      setCheapest(data?.cheapest || null);
      setAllRates(Array.isArray(data?.rates) ? data.rates : []);
      setSelection(data?.cheapest?.rate_object_id || null);
    } catch (e) {
      console.error('shippo rates error', e);
      setCheapest(null);
      setAllRates([]);
      message.error(t?.('shipping_error') || 'Could not fetch shipping rates');
    } finally {
      setLoading(false);
    }
  }

  // Refresh when weight changes or destination changes (after we have a postal)
  useEffect(() => {
    if (dest?.postal) fetchRates(dest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightGrams, dest.postal, dest.city]);

  const onSaveAddress = (vals) => {
    const next = {
      country: 'DE',
      postal: (vals.postal || '').trim(),
      city: (vals.city || '').trim()
    };
    setDest(next);
    try { localStorage.setItem('shippo_dest', JSON.stringify(next)); } catch {}
    setOpen(false);
    // fetch happens via useEffect
  };

  const label = (r) => `${r.provider} · ${r.service}`;

  return (
    <div className="shipping-estimator">
      {/* Destination row */}
      <div className="ship-dest" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <EnvironmentOutlined />
        <span>
          {t?.('deliver_to') || 'Deliver to'}{' '}
          <strong>{dest.postal ? `${dest.postal} (DE)` : 'DE'}</strong>
        </span>
        <Button type="link" onClick={() => setOpen(true)} size="small">
          {t?.('change') || 'Change'}
        </Button>
      </div>

      {/* Quotes */}
      {loading ? (
        <div style={{ marginTop: 6 }}><Spin size="small" /></div>
      ) : cheapest ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 700 }}>
            €{Number(cheapest.amount).toFixed(2)} — {label(cheapest)}
          </div>
          {Number.isFinite(cheapest.estimated_days) && (
            <div style={{ color: '#666', fontSize: 12 }}>
              {(t?.('arrives') || 'Arrives')} ~{cheapest.estimated_days} {(t?.('days') || 'days')}
            </div>
          )}

          {/* (Optional) let the user see/select all rates */}
          {allRates?.length > 1 && (
            <div style={{ marginTop: 8 }}>
              <Radio.Group
                onChange={(e) => setSelection(e.target.value)}
                value={selection}
              >
                {allRates.map(r => (
                  <Radio key={r.rate_object_id} value={r.rate_object_id}>
                    €{Number(r.amount).toFixed(2)} — {label(r)}
                    {Number.isFinite(r.estimated_days) && (
                      <span style={{ color: '#666', fontSize: 12 }}> · ~{r.estimated_days} d</span>
                    )}
                  </Radio>
                ))}
              </Radio.Group>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 6, color: '#999' }}>
          {dest.postal
            ? (t?.('no_shipping_options') || 'No shipping options for this destination.')
            : (t?.('enter_postal') || 'Enter a postal code to see shipping.')}
        </div>
      )}

      {/* Save the chosen rate id in window so Checkout can reuse (lightweight pattern) */}
      <input
        type="hidden"
        value={selection || ''}
        data-selected-rate-id
        readOnly
      />

      {/* Change address modal */}
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        title={t?.('delivery_location') || 'Delivery location'}
      >
        <Form
          layout="vertical"
          initialValues={{ postal: dest.postal || '', city: dest.city || '' }}
          onFinish={onSaveAddress}
        >
          <Form.Item
            label={t?.('postal_code') || 'Postal code'}
            name="postal"
            rules={[{ required: true, message: t?.('required') || 'Required' }]}
          >
            <Input autoFocus />
          </Form.Item>
          <Form.Item label={t?.('city') || 'City'} name="city">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            {t?.('save') || 'Save'}
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
