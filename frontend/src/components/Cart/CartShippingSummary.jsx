
// frontend/src/components/Cart/CartShippingSummary.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip, Spin, Button, Modal, Form, Input, message } from 'antd';
import { InfoCircleOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import axios from 'axios';
import config from '../../config';

// Small debounce helper (no external deps)
function simpleDebounce(fn, delay = 350) {
  let timer = null;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export default function CartShippingSummary({ t, i18n, onShippingChange }) {
  const items = useSelector(s => s.cart.items || []);

  const [dest, setDest] = useState({ country: 'DE', postal: '', city: '' });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);

  // restore last destination
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ship_dest') || localStorage.getItem('shippo_dest');
      if (raw) setDest(JSON.parse(raw));
    } catch {}
  }, []);

  // Step 1: build light items (bookId, quantity) to fetch missing weights/dimensions
  const requestItems = useMemo(() => {
    return items.map(it => ({
      bookId: Number(it.bookId) || Number(it.id) || 0,
      quantity: Math.max(1, Number(it.quantity || 1))
    })).filter(it => it.bookId > 0);
  }, [items]);

  // Step 2: resolve per-item weights + dimensions using backend
  const [weightedItems, setWeightedItems] = useState([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (requestItems.length === 0) { setWeightedItems([]); return; }

      try {
        const { data } = await axios.post(
          `${config.API_URL}/api/cart/weights`,
          { items: requestItems },
          { withCredentials: true }
        );

        // data.items = [{ book_id, quantity, weight_grams|null, width_cm|null, height_cm|null, thickness_cm|null }]
        const fromServer = Array.isArray(data?.items) ? data.items : [];

        const map = new Map(fromServer.map(r => [Number(r.book_id), r]));
        const resolved = requestItems.map(it => {
          const row = map.get(it.bookId) || {};
          const w = Number(row?.weight_grams);
          const width     = Number(row?.width_cm);
          const height    = Number(row?.height_cm);
          const thickness = Number(row?.thickness_cm);
          return {
            weight_grams: (Number.isFinite(w) && w > 0 ? w : 500),     // fallback weight
            width_cm:     (Number.isFinite(width)     && width > 0 ? width : 13),
            height_cm:    (Number.isFinite(height)    && height > 0 ? height : 20),
            thickness_cm: (Number.isFinite(thickness) && thickness > 0 ? thickness : 3),
            quantity: it.quantity
          };
        });

        if (!cancelled) setWeightedItems(resolved);
      } catch (err) {
        console.warn('Failed to fetch weights; falling back to defaults.', err?.message);
        // Fallbacks
        if (!cancelled) {
          setWeightedItems(requestItems.map(it => ({
            weight_grams: 500,
            width_cm: 13,
            height_cm: 20,
            thickness_cm: 3,
            quantity: it.quantity
          })));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [requestItems]);

  // Step 3: ask Shippo for rates with final items (books + packaging computed on server)
  const fetchCartRate = useRef(null);
  const abortRef = useRef(null);

  const doFetch = async (signal) => {
    if (!dest.postal) return;
    if (!weightedItems.length) return;
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${config.API_URL}/api/shippo/rates`,
        {
          to_zip: dest.postal,
          to_city: dest.city || 'Berlin',
          items: weightedItems
        },
        { withCredentials: true, signal }
      );
      setQuote(data || null);
    } catch (e) {
      if (axios.isCancel?.(e) || e?.name === 'CanceledError') return; // request was aborted
      if (axios.isAxiosError?.(e) && e.response?.status === 429) {
        message.warning(t?.('shipping_rate_limited') || 'Too many shipping requests. Please wait and try again.');
        return; // keep previous quote
      }
      console.error(e);
      setQuote(null);
      message.error(t?.('shipping_error') || 'Could not fetch shipping rates');
    } finally {
      setLoading(false);
    }
  };

  // create debounced version once (and whenever deps change meaningfully)
  useEffect(() => {
    const debounced = simpleDebounce(() => {
      try { abortRef.current?.abort?.(); } catch {}
      abortRef.current = new AbortController();
      doFetch(abortRef.current.signal);
    }, 350);
    fetchCartRate.current = debounced;
    return () => {
      debounced.cancel?.();
      try { abortRef.current?.abort?.(); } catch {}
    };
    // stringify items so effect runs when contents change (not just ref)
  }, [dest.postal, dest.city, JSON.stringify(weightedItems)]);

  // Allow CartPage to force refresh by dispatching "cart-updated"
  useEffect(() => {
    const onUpdate = () => fetchCartRate.current?.();
    window.addEventListener('cart-updated', onUpdate);
    return () => window.removeEventListener('cart-updated', onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest.postal, dest.city, weightedItems]);

  useEffect(() => {
    fetchCartRate.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest.postal, dest.city, weightedItems.length, weightedItems]);

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
  const wb   = quote?.weight_breakdown;
  const dims = quote?.parcel_dimensions_cm;

  // Notify parent (CartPage) whenever shipping changes
  useEffect(() => {
    if (typeof onShippingChange !== 'function') return;
    if (loading) return;
    const amount = Number(info?.amount);
    if (Number.isFinite(amount) && amount >= 0) {
      onShippingChange(amount);
    } else {
      onShippingChange(0);
    }
  }, [info?.amount, loading, onShippingChange]);

  const fmtKg = (g) => (Number(g || 0) / 1000).toFixed(2);

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <EnvironmentOutlined />
        <span>
          {t?.('deliver_to') || 'Deliver to'}{' '}
          <strong>{dest.postal ? `${dest.postal} (DE)` : 'DE'}</strong>
        </span>
        <Button type="link" size="small" onClick={() => setOpen(true)}>
          {t?.('change') || 'Change'}
        </Button>
      </div>

      {loading ? (
        <Spin size="small" />
      ) : info ? (
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
• Packaging ${fmtKg(wb.packaging_grams)} kg${
                      dims
                        ? `\n• Parcel ${dims.length_cm}×${dims.width_cm}×${dims.height_cm} cm`
                        : ''
                    }`
                  : (dims ? `Parcel ${dims.length_cm}×${dims.width_cm}×${dims.height_cm} cm` : '')
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

          {/* selected rate id (hidden) */}
          <input type="hidden" data-selected-rate-id value={info.rate_object_id || info.object_id || ''} readOnly />
        </div>
      ) : (
        <div style={{ color: '#999' }}>
          {dest.postal
            ? (t?.('no_shipping_options') || 'No shipping options for this destination.')
            : (t?.('enter_postal') || 'Enter a postal code to see shipping.')}
        </div>
      )}

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
          onFinish={(vals) => {
            const next = {
              country: 'DE',
              postal: (vals.postal || '').trim(),
              city: (vals.city || '').trim()
            };
            setDest(next);
            try { localStorage.setItem('ship_dest', JSON.stringify(next)); } catch {}
            setOpen(false);
          }}
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
