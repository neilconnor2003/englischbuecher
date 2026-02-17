
import React, { useEffect, useState } from 'react';
import { Spin, Result, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useDispatch } from 'react-redux';
import { clearCart } from '../../features/cart/cartSlice';

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

const OrderReturn = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const query = useQuery();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const paymentIntentId = query.get('payment_intent');
    const redirectStatus = query.get('redirect_status');

    if (!paymentIntentId) {
      setError('Missing payment intent');
      setLoading(false);
      return;
    }

    // load persisted shipping details (from CheckoutPage)
    let shippingAddress = {};
    try {
      const raw = localStorage.getItem('checkout_shipping');
      if (raw) {
        const s = JSON.parse(raw);
        // Expecting shape: { email, address, city, postalCode, country }
        // Keep only address block for backend, email is stored in paymentResult
        shippingAddress = {
                   address: s.address,
          city: s.city,
          postalCode: s.postalCode,
          country: s.country || 'DE',
        };
      }
    } catch (_) {}

    (async () => {
      try {
        const { data } = await axios.post(
          '/api/orders/finalize-from-payment-intent',
          { paymentIntentId, shippingAddress },
          { withCredentials: true }
        );

        if (data?.orderId) {
          // Clear client-side cart (backend already clears server cart for logged-in users)
          dispatch(clearCart());
          localStorage.removeItem('checkout_shipping');

          // Go to your existing details page
          navigate(`/order-success/${data.orderId}`, { replace: true });
          return;
        }

        setError('Could not create order from payment');
      } catch (err) {
        const code = err.response?.status;
        const msg = err.response?.data?.error || err.message || 'Failed to finalize order';
        setError(msg);
        toast.error(msg);

        // If stock conflict, send user back to cart to adjust quantities
        if (code === 409) {
          navigate('/cart', { replace: true });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [query, dispatch, navigate]);

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="warning"
        title="We couldn't finalize your order"
        subTitle={error}
        extra={
          <Button type="primary" onClick={() => navigate('/cart', { replace: true })}>
            Go back to cart
          </Button>
        }
      />
    );
  }

  return null;
};

export default OrderReturn;