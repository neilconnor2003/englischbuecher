import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './OrderSuccessPage.css';

const OrderSuccessPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data } = await axios.get(`/api/orders/${orderId}`, { withCredentials: true });
        setOrder(data);
      } catch (err) {
        console.error('Failed to load order:', err);
      } finally {
        setLoading(false);
      }
    };
    if (orderId) fetchOrder();
  }, [orderId]);

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (!order) {
    return (
      <div className="success-page">
        <div className="success-container">
          <div className="success-error-card">
            <div className="success-error-icon">⚠️</div>
            <h2>{t('order_not_found')}</h2>
            <p>{t('order_load_error')}</p>
            <button className="success-btn-primary" onClick={() => navigate('/')}>
              {t('back_home')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const shipping = Number(order.shipping_amount_eur || 0);
  const couponDiscount = Number(order.coupon_discount || 0);
  const walletUsed = Number(order.wallet_used || 0);
  const total = Number(order.total || 0);
  const itemsSubtotal = (order.order_items || []).reduce(
    (s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0
  );

  const statusColor = {
    processing: '#7c3aed',
    shipped: '#0891b2',
    delivered: '#16a34a',
    pending: '#d97706',
    cancelled: '#dc2626',
  }[order.status] || '#6b7280';

  return (
    <div className="success-page">
      <div className="success-container">

        {/* ── HERO ── */}
        <div className="success-hero">
          <div className="success-checkmark">✓</div>
          <h1 className="success-title">{t('order_placed_success')}</h1>
          <p className="success-meta">
            {t('order_id')}: <strong>#{orderId}</strong>
            &nbsp;·&nbsp;
            <span style={{ color: statusColor, fontWeight: 700, textTransform: 'capitalize' }}>
              {order.status}
            </span>
          </p>
          <p className="success-hint">{t('email_confirmation_sent')}</p>
        </div>

        <div className="success-grid">

          {/* ── LEFT: ITEMS + TOTALS ── */}
          <div className="success-main">

            {/* Items */}
            <div className="success-card">
              <div className="success-card-title">{t('invoice_preview') || 'Order Summary'}</div>
              <div className="success-items">
                {(order.order_items || []).map((item, i) => (
                  <div key={i} className="success-item">
                    {item.image && (
                      <img src={item.image} alt={item.title_en} className="success-item-img" />
                    )}
                    <div className="success-item-info">
                      <div className="success-item-title">{item.title_en}</div>
                      {item.author && <div className="success-item-author">{item.author}</div>}
                    </div>
                    <div className="success-item-right">
                      <div className="success-item-qty">×{item.quantity}</div>
                      <div className="success-item-price">€{(Number(item.price) * Number(item.quantity)).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="success-totals">
                <div className="success-total-row">
                  <span>{t('cart.subtotal') || 'Subtotal'}</span>
                  <span>€{itemsSubtotal.toFixed(2)}</span>
                </div>
                <div className="success-total-row">
                  <span>{t('cart.shipping_label') || 'Shipping'}</span>
                  <span>{shipping === 0
                    ? <span className="success-badge-free">{t('free') || 'Free'}</span>
                    : `€${shipping.toFixed(2)}`}
                  </span>
                </div>
                {couponDiscount > 0 && (
                  <div className="success-total-row success-total-coupon">
                    <span>
                      {t('discount') || 'Coupon'}
                      {order.coupon_code && (
                        <span className="success-coupon-badge">{order.coupon_code}</span>
                      )}
                    </span>
                    <span>−€{couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                {walletUsed > 0 && (
                  <div className="success-total-row success-total-wallet">
                    <span>💜 {t('wallet_used') || 'Wallet credit'}</span>
                    <span>−€{walletUsed.toFixed(2)}</span>
                  </div>
                )}
                <div className="success-total-row success-total-grand">
                  <span>{t('total')}</span>
                  <span>€{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Delivery address */}
            {order.shipping_address && (
              <div className="success-card">
                <div className="success-card-title">{t('shipping_address')}</div>
                <div className="success-address">
                  <div>{order.user?.first_name} {order.user?.last_name}</div>
                  <div>{order.shipping_address.address}</div>
                  <div>{order.shipping_address.postalCode} {order.shipping_address.city}</div>
                  <div>{order.shipping_address.country}</div>
                  {order.user?.email && <div style={{ color: '#9ca3af', marginTop: 4 }}>{order.user.email}</div>}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: SHIPPING + ACTIONS ── */}
          <div className="success-sidebar">

            {/* Shipping & tracking */}
            <div className="success-card">
              <div className="success-card-title">{t('shipping_info') || 'Shipping'}</div>

              <div className="success-shipping-row">
                <span className="success-shipping-label">{t('cart.shipping_label') || 'Carrier'}</span>
                <span className="success-shipping-val">
                  {order.shipping_provider
                    ? <>{order.shipping_provider}{order.shipping_service ? ` · ${order.shipping_service}` : ''}</>
                    : '—'}
                </span>
              </div>

              <div className="success-shipping-row">
                <span className="success-shipping-label">{t('status')}</span>
                <span className="success-status-pill" style={{ background: statusColor + '20', color: statusColor }}>
                  {String(order.status || '').toUpperCase()}
                </span>
              </div>

              {order.tracking_number ? (
                <div className="success-tracking">
                  <div className="success-shipping-label">{t('tracking_number') || 'Tracking'}</div>
                  <div style={{ fontWeight: 700, marginTop: 4 }}>{order.tracking_number}</div>
                  {order.tracking_url && (
                    <a href={order.tracking_url} target="_blank" rel="noreferrer" className="success-track-link">
                      {t('track_package') || 'Track package'} →
                    </a>
                  )}
                </div>
              ) : (
                <div className="success-tracking-pending">
                  {t('tracking_pending') || 'Tracking will appear once the label is created.'}
                </div>
              )}

              {order.label_url && (
                <a href={order.label_url} target="_blank" rel="noreferrer" className="success-label-link">
                  📄 {t('download_label') || 'Download shipping label'}
                </a>
              )}
            </div>

            {/* Payment */}
            <div className="success-card">
              <div className="success-card-title">{t('payment_method')}</div>
              <div className="success-shipping-row">
                <span className="success-shipping-label">{t('paid')}</span>
                <span className={`success-status-pill ${order.is_paid ? 'success-paid' : 'success-unpaid'}`}>
                  {order.is_paid ? '✓ ' + t('paid') : t('pending')}
                </span>
              </div>
              <div className="success-shipping-row">
                <span className="success-shipping-label">{t('date')}</span>
                <span>{new Date(order.created_at || Date.now()).toLocaleDateString('de-DE')}</span>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="success-actions">
              <button className="success-btn-primary" onClick={() => navigate('/profile#orders')}>
                {t('my_orders')}
              </button>
              <button className="success-btn-secondary" onClick={() => navigate('/')}>
                {t('back_home')}
              </button>
              <button className="success-btn-ghost" onClick={() => window.print()}>
                🖨 {t('print') || 'Print'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessPage;
