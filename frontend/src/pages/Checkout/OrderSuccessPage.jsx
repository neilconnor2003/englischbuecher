import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Result, Card, Spin, Tag, Divider } from 'antd';
import {
  CheckCircleOutlined,
  HomeOutlined,
  ShoppingOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
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

  const printInvoice = () => window.print();

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (!order) {
    return (
      <Result
        status="error"
        title={t('order_not_found')}
        subTitle={t('order_load_error')}
      />
    );
  }

  return (
    <div className="success-page">
      <div className="success-container">
        <Result
          status="success"
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          title={t('order_placed_success')}
          subTitle={
            <div style={{ textAlign: 'center' }}>
              <p>
                {t('order_id')}: <strong>#{orderId}</strong>
              </p>
              <p>{t('email_confirmation_sent')}</p>
              <Tag color="green">{t('paid')}</Tag>
            </div>
          }
        />

        {/* INVOICE PREVIEW */}
        <Card
          className="invoice-card"
          title={t('invoice_preview')}
          extra={
            <Button icon={<PrinterOutlined />} onClick={printInvoice}>
              {t('print')}
            </Button>
          }
        >
          <div className="invoice">
            <div className="invoice-header">
              <div>
                <img src="/assets/logo.png" alt="EnglischBuecher.de" className="invoice-logo" />
                <p>
                  EnglischBuecher.de<br />
                  Im Schwalg 60, 55411 Bingen<br />
                  Deutschland<br />
                  <small>USt-ID: DE123456789</small>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3>{t('invoice')}</h3>
                <p><strong>{t('invoice_no')}:</strong> #{orderId}</p>
                <p><strong>{t('date')}:</strong> {new Date().toLocaleDateString('de-DE')}</p>
              </div>
            </div>

            <Divider />

            <div className="invoice-address">
              <strong>{t('bill_to')}:</strong>
              <br />
              {order.user?.first_name} {order.user?.last_name}
              <br />
              {order.shipping_address?.address}
              <br />
              {order.shipping_address?.postalCode} {order.shipping_address?.city}
              <br />
              {order.shipping_address?.country}
            </div>

            <table className="invoice-table">
              <thead>
                <tr>
                  <th>{t('item')}</th>
                  <th>{t('quantity')}</th>
                  <th>{t('price')}</th>
                  <th>{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {order.order_items?.map((item, i) => (
                  <tr key={i}>
                    <td>{item.title_en}</td>
                    <td>{item.quantity}</td>
                    <td>€{item.price.toFixed(2)}</td>
                    <td>€{(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* === Totals (Subtotal + Shipping + Total) === */}
            <div className="invoice-total">
              {(() => {
                const shipping = Number(order.shipping_amount_eur || 0);
                const total = Number(order.total || 0);
                // Guard against negative / NaN with max(0, ...)
                const subtotal = Math.max(0, +(total - shipping).toFixed(2));
                return (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t('cart.subtotal') || 'Subtotal'}</span>
                      <strong>€{subtotal.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t('cart.shipping_label') || 'Shipping'}</span>
                      <strong>€{shipping.toFixed(2)}</strong>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '1px solid #eee',
                      paddingTop: 8
                    }}>
                      <span>{t('total')}</span>
                      <strong>€{total.toFixed(2)}</strong>
                    </div>
                  </div>
                );
              })()}
            </div>


            <div className="invoice-footer">
              <p>{t('thank_you')}</p>
            </div>
          </div>
        </Card>


        {/* SHIPPING & TRACKING */}
        <Card className="shipping-card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ marginBottom: 8 }}>{t('shipping_info') || 'Shipping Information'}</h3>
              <div style={{ color: '#555' }}>
                {/* Carrier & service */}
                {order.shipping_provider ? (
                  <div>
                    <strong>{order.shipping_provider}</strong>
                    {order.shipping_service ? <> · {order.shipping_service}</> : null}
                  </div>
                ) : (
                  <div>{t('shipping') || 'Shipping'}: —</div>
                )}

                {/* Shipping cost */}
                <div>
                  {t('cart.shipping_label') || 'Shipping'}:{' '}
                  <strong>
                    {Number.isFinite(Number(order.shipping_amount_eur))
                      ? `€${Number(order.shipping_amount_eur).toFixed(2)}`
                      : '—'}
                  </strong>
                </div>

                {/* Tracking number + link */}
                <div style={{ marginTop: 6 }}>
                  {order.tracking_number ? (
                    <>
                      {t('tracking_number') || 'Tracking'}:{' '}
                      <strong>{order.tracking_number}</strong>
                      {order.tracking_url ? (
                        <>
                          {' '}
                          ·{' '}
                          <a href={order.tracking_url} target="_blank" rel="noreferrer">
                            {t('track_package') || 'Track package'}
                          </a>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span style={{ color: '#999' }}>
                      {t('tracking_pending') || 'Tracking will appear shortly after the label is purchased.'}
                    </span>
                  )}
                </div>

                {/* Optional: Label PDF link */}
                {order.label_url && (
                  <div style={{ marginTop: 6 }}>
                    <a href={order.label_url} target="_blank" rel="noreferrer">
                      {t('download_label') || 'Download shipping label (PDF)'}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Status tag from order.status */}
            <div>
              <Tag color={
                order.status === 'shipped' ? 'green'
                  : order.status === 'processing' ? 'blue'
                    : order.status === 'pending' ? 'orange'
                      : order.status === 'delivered' ? 'green'
                        : order.status === 'cancelled' ? 'red'
                          : 'default'
              }>
                {String(order.status || '').toUpperCase() || '—'}
              </Tag>
            </div>
          </div>
        </Card>


        <div className="success-buttons">
          <Button type="primary" size="large" onClick={() => navigate('/profile#orders')}>
            {t('my_orders')}
          </Button>
          <Button size="large" onClick={() => navigate('/')}>
            {t('back_home')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessPage;