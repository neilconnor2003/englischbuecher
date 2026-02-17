
// src/pages/Checkout/CheckoutWrapper.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CheckoutPage from './CheckoutPage';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const CheckoutWrapper = () => {
  const { items = [], totalPrice = 0 } = useSelector((state) => state.cart);
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const createIntent = async () => {
      if (items.length === 0) {
        toast.error('Cart is empty');
        setLoading(false);
        return;
      }

      try {
        const { data } = await axios.post('/api/orders/create-payment-intent', {
          items: items.map(i => ({
            bookId: i.bookId,
            quantity: i.quantity,
            price: i.price,
          })),
          totalPrice,
          currency: 'eur',
        }, { withCredentials: true });

        if (!cancelled) {
          setClientSecret(data.clientSecret);
        }
      } catch (err) {
        if (!cancelled) {
          if (err.response?.status === 409) {
            const msg = err.response?.data?.error || 'Not enough stock for one or more items.';
            toast.warning(msg);
          } else {
            toast.error('Failed to initialize payment');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    createIntent();
    return () => { cancelled = true; };
  }, [items, totalPrice]);

  const options = useMemo(
    () => (clientSecret ? { clientSecret } : undefined),
    [clientSecret]
  );

  if (loading) return <div className="loading">Initializing payment...</div>;
  if (!clientSecret) return <div className="error">Payment setup failed</div>;

  return (
    <Elements stripe={stripePromise} options={options} key={clientSecret}>
      <CheckoutPage clientSecret={clientSecret} />
    </Elements>
  );
};

export default CheckoutWrapper;
