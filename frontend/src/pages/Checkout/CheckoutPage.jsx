
// src/pages/Checkout/CheckoutPage.jsx
import React, { useState, useEffect, useContext } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createOrder, clearCart } from '../../features/cart/cartSlice';
import { toast } from "react-toastify";
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './CheckoutPage.css';

const CheckoutPage = ({ clientSecret }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useContext(AuthContext);
  const { items: cartItems = [], totalPrice = 0 } = useSelector((state) => state.cart);
  const shippingAddress = useSelector((state) => state.cart.shippingAddress);

  const [email, setEmail] = useState(user?.email || "");
  const [address, setAddress] = useState(shippingAddress?.address || "");
  const [city, setCity] = useState(shippingAddress?.city || "");
  const [postalCode, setPostalCode] = useState(shippingAddress?.postalCode || "");
  const [loading, setLoading] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);

  // Shipping quote state
  const [shippingQuote, setShippingQuote] = useState(null); // { amount_eur, provider, service, rate_object_id }
  const [quoting, setQuoting] = useState(false);
  const [piUpdated, setPiUpdated] = useState(false);

  const COUNTRY = "DE";

  useEffect(() => {
    if (!user) navigate("/login?redirect=checkout");
    else if (cartItems.length === 0 && !window.location.pathname.includes('/order-success')) {
      navigate("/cart");
    }
  }, [user, cartItems, navigate]);

  // Quote shipping when postal/city/items change
  useEffect(() => {
    let cancelled = false;

    async function quote() {
      if (!postalCode || cartItems.length === 0) {
        setShippingQuote(null);
        setPiUpdated(false);
        return;
      }
      setQuoting(true);
      try {
        const { data } = await axios.post('/api/checkout/quote', {
          to_zip: postalCode,
          to_city: city || 'Berlin',
          items: cartItems.map(i => ({ bookId: i.bookId, quantity: i.quantity }))
        }, { withCredentials: true });

        const ch = data?.cheapest;
        if (!cancelled && ch) {
          setShippingQuote({
            amount_eur: Number(ch.amount) || 0,
            provider: ch.provider || null,
            service: ch.service || null,
            rate_object_id: ch.rate_object_id || ch.object_id || null
          });
          setPiUpdated(false);
        }
      } catch (e) {
        console.error('[Checkout] quote failed:', e?.response?.data || e?.message);
        if (!cancelled) {
          setShippingQuote(null);
          setPiUpdated(false);
          toast.error(t('shipping_error') || 'Could not fetch shipping rates');
        }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }

    quote();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postalCode, city, cartItems.length]);

  // Update PaymentIntent amount (subtotal + shipping)
  useEffect(() => {
    async function updatePI() {
      if (!shippingQuote || !clientSecret) return;
      try {
        const grand = Number(totalPrice || 0) + Number(shippingQuote.amount_eur || 0);
        const amount_cents = Math.round(grand * 100);
        await axios.post('/api/orders/update-payment-intent-amount', {
          clientSecret,
          amount_cents
        }, { withCredentials: true });
        setPiUpdated(true);
      } catch (e) {
        console.error('[Checkout] PI update failed:', e?.response?.data || e?.message);
        setPiUpdated(false);
        toast.error(t('payment_failed_try_again'));
      }
    }
    updatePI();
  }, [shippingQuote, clientSecret, totalPrice, t]);

  const submitHandler = async (e) => {
    e.preventDefault();

    if (!email.includes('@')) return toast.error(t('valid_email_required'));
    if (!address.trim()) return toast.error(t('address_required'));
    if (!city.trim()) return toast.error(t('city_required'));
    if (!postalCode.trim()) return toast.error(t('postal_code_required'));
    if (!stripe || !elements || !paymentReady) return toast.error(t('payment_not_ready'));
    if (!shippingQuote?.rate_object_id) return toast.error(t('shipping_error') || 'Shipping not ready');
    if (!piUpdated) return toast.error(t('payment_failed_try_again'));

    setLoading(true);

    try {
      localStorage.setItem('checkout_shipping', JSON.stringify({
        email, address, city, postalCode, country: 'DE',
      }));

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-success`,
          payment_method_data: {
            billing_details: {
              email,
              name: user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : email,
              address: { line1: address, city, postal_code: postalCode, country: 'DE' },
            },
          },
        },
        redirect: 'if_required',
      });

      if (error) {
        console.error('Stripe error:', error);
        toast.error(error.message || t('payment_failed'));
        setLoading(false);
        return;
      }

      if (paymentIntent?.status !== 'succeeded') {
        toast.error(t('payment_failed_or_requires_action'));
        setLoading(false);
        return;
      }

      const orderData = {
        orderItems: cartItems,
        shippingAddress: { address, city, postalCode, country: 'DE' },
        paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
        paymentResult: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          email_address: email,
        },
        totalPrice: Number(totalPrice || 0) + Number(shippingQuote.amount_eur || 0),

        // Tell backend which rate to buy + how much shipping was
        shipping_selected_rate_id: shippingQuote.rate_object_id,
        shipping_amount_eur: shippingQuote.amount_eur,
        shipping_provider: shippingQuote.provider || null,
        shipping_service: shippingQuote.service || null
      };

      const result = await dispatch(createOrder(orderData)).unwrap();

      dispatch(clearCart());
      toast.success(t('payment_success'));
      navigate(`/order-success/${result.orderId}`);

    } catch (err) {
      console.error('Checkout error:', err);
      toast.error(err?.response?.data?.error || t('payment_failed_try_again'));
    } finally {
      setLoading(false);
    }
  };

  const subtotal = Number(totalPrice || 0);
  const shipping = Number(shippingQuote?.amount_eur || 0);
  const grandTotal = subtotal + shipping;

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h1 className="checkout-title">{t('checkout')}</h1>

        <form onSubmit={submitHandler} id="checkout-form">
          <div className="top-row">
            {/* LEFT: ORDER SUMMARY */}
            <div className="summary-card">
              <div className="summary-header">{t('order_summary')}</div>
              <div className="summary-items">
                {cartItems.map((item) => (
                  <div key={item.bookId} className="summary-item">
                    <img src={item.image || "/assets/book-placeholder.jpg"} alt={item.title_en} />
                    <div className="item-details">
                      <h3>{item.title_en || item.name}</h3>
                      <p>{t('quantity')}: {item.quantity}</p>
                    </div>
                    <div className="item-price">€{(item.price * item.quantity).toFixed(2)}</div>
                  </div>
                ))}
              </div>

              {/* Totals with shipping */}
              <div className="summary-total">
                <div className="total-row">
                  <span>{t('cart.subtotal') || 'Subtotal'}</span>
                  <span className="total-price">€{subtotal.toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>{t('cart.shipping_label') || 'Shipping'}</span>
                  <span className="total-price">{quoting ? '…' : `€${shipping.toFixed(2)}`}</span>
                </div>
                <div className="total-row total-strong">
                  <span>{t('total')}</span>
                  <span className="total-price">€{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* RIGHT: SHIPPING ADDRESS */}
            <div className="address-card">
              <div className="form-header">{t('shipping_address')}</div>
              <div className="form-group">
                <label>{t('email')}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>{t('street_address')}</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>{t('city')}</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{t('postal_code')}</label>
                  <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required />
                </div>
              </div>

              {/* COUNTRY: FIXED, NON-EDITABLE */}
              <div className="form-group">
                <label>{t('country')}</label>
                <div className="readonly-field">
                  <strong>Deutschland (DE)</strong>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: PAYMENT */}
          <div className="payment-card">
            <div className="form-header">{t('payment_method')}</div>
            <div className="payment-element-container">
              <PaymentElement
                onReady={() => setPaymentReady(true)}
                options={{
                  layout: "tabs",
                  paymentMethodOrder: ['card', 'paypal', 'sofort'],
                  fields: { billingDetails: { email: 'auto', name: 'auto' } },
                  wallets: { applePay: 'never', googlePay: 'never' },
                  defaultValues: {
                    billingDetails: {
                      email,
                      name: user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : email,
                    },
                  },
                }}
              />
            </div>

            <button
              type="submit"
              disabled={!stripe || loading || !paymentReady || !shippingQuote?.rate_object_id || !piUpdated}
              className="pay-button full-width"
            >
              {loading ? (
                <span className="spinner">{t('processing')}...</span>
              ) : (
                `${t('pay')} €${grandTotal.toFixed(2)}`
              )}
            </button>
          </div>
        </form>

        <div className="test-card" style={{ marginTop: '1rem', textAlign: 'center' }}>
          {t('test_card')}: 4242 4242 4242 4242 | {t('any_date')} | 123
          <br />
          <small>Sofort: Use test mode in Stripe Dashboard</small>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
