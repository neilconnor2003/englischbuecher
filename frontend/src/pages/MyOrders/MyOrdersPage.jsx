// src/pages/Profile/MyOrders.jsx
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { listMyOrders } from '../../features/orders/orderSlice';
import { useTranslation } from 'react-i18next';
import './MyOrdersPage.css';

const MyOrders = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { orders, loading, error } = useSelector(state => state.orders);

  useEffect(() => {
    dispatch(listMyOrders());
  }, [dispatch]);

  if (loading) return <p>{t('loading')}</p>;
  if (error) return <p className="error">{error}</p>;
  if (!orders?.length) return <p>{t('no_orders_yet')}</p>;

  return (
    <div className="my-orders">
      <h2>{t('my_orders')}</h2>
      <div className="orders-list">
        {orders.map(order => (
          <div key={order.id} className="order-card">
            <div className="order-header">
              <span>#{order.id}</span>
              <span>{new Date(order.created_at).toLocaleDateString('de-DE')}</span>
            </div>
            <div className="order-body">
              <p><strong>{t('total')}:</strong> €{order.total.toFixed(2)}</p>
              <p><strong>{t('status')}:</strong> {order.status}</p>
              <p><strong>{t('paid')}:</strong> {order.is_paid ? t('yes') : t('no')}</p>
            </div>
            <a href={`/order-success/${order.id}`} className="view-order">
              {t('view_details')}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyOrders;