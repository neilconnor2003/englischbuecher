
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
import { getDeliveryContext, setDeliveryContext } from '../../utils/deliveryContext';
import { getDPDShippingPrice } from '../../utils/dpdShipping';

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

  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  const [shippingMode, setShippingMode] = useState('delivery');

  const [loading, setLoading] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);

  const [shippingAmount, setShippingAmount] = useState(0);
  const [weightedItems, setWeightedItems] = useState([]);

  const cart = useSelector(state => state.cart);
  const items = cart?.items || [];

  const itemsSignature = cartItems
    .map(i => `${i.bookId}:${i.quantity}`)
    .join('|');

  const COUNTRY = "DE";

  const FREE_SHIPPING_THRESHOLD = 30;

  //const subtotal = Number(totalPrice || 0);
  //const shipping = Number(shippingAmount || 0);
  //const grandTotal = subtotal + shipping;

  // ✅ Always compute subtotal from cartItems (never trust totalPrice)
  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );

  /*const isFreeShipping =
    shippingMode === 'delivery' &&
    Number(totalPrice || 0) >= FREE_SHIPPING_THRESHOLD;*/
  const isFreeShipping =
    shippingMode === 'delivery' &&
    Number(subtotal || 0) >= FREE_SHIPPING_THRESHOLD;

  // ✅ Effective shipping: pickup = 0, free shipping = 0, otherwise shippingAmount
  const effectiveShipping =
    shippingMode === 'pickup' ? 0 : (isFreeShipping ? 0 : Number(shippingAmount || 0));

  const grandTotal = subtotal + effectiveShipping;



  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('checkout_shipping_amount');
      if (raw) {
        const parsed = JSON.parse(raw);
        setShippingAmount(Number(parsed.amount_eur || 0));
        setShippingMode(parsed.mode || 'delivery');
      }
    } catch { }
  }, []);

  useEffect(() => {
    if (!user) navigate("/login?redirect=checkout");
    else if (cartItems.length === 0 && !window.location.pathname.includes('/order-success')) {
      navigate("/cart");
    }
  }, [user, cartItems, navigate]);

  useEffect(() => {
    // 1️⃣ Try shared delivery context
    const ctx = getDeliveryContext();

    // 2️⃣ Fallback: ShippoEstimator storage
    let shippo = null;
    try {
      const raw =
        localStorage.getItem('ship_dest') || localStorage.getItem('shippo_dest');
      shippo = raw ? JSON.parse(raw) : null;
    } catch { }

    const resolvedPostal =
      ctx?.postalCode || shippo?.postal || '';
    const resolvedCity =
      ctx?.city || shippo?.city || '';
    const resolvedMode =
      ctx?.shippingMode || 'delivery';

    setShippingMode(resolvedMode);
    setPostalCode(resolvedPostal);
    setCity(resolvedCity);

    setHydrated(true);
  }, []);

  const ctx1 = getDeliveryContext();

  useEffect(() => {
    // 1. Only run if Buy Now requested it
    if (!ctx1?.forceQuote) return;

    // 2. Cart must have items
    if (items.length === 0) return;

    // 3. Address MUST exist (otherwise do nothing)
    //if (!deliveryAddress?.postalCode) return;
    if (!postalCode || !city) return;

    // 4. Now it is safe to calculate shipping
    //triggerShippingQuote();

    // 5. Clear the flag so it doesn't repeat
    setDeliveryContext({ ...ctx1, forceQuote: false });

  }, [items, postalCode, city]);

  useEffect(() => {
    if (!hydrated) return;

    // Do not overwrite valid saved values with empty strings
    if (!postalCode || !city) return;

    setDeliveryContext({
      shippingMode,
      postalCode,
      city,
    });
  }, [hydrated, shippingMode, postalCode, city]);

  useEffect(() => {
    let cancelled = false;

    const requestItems = items
      .map(it => ({
        bookId: Number(it.bookId),
        quantity: Math.max(1, Number(it.quantity || 1)),
      }))
      .filter(it => it.bookId > 0);

    if (!requestItems.length) {
      setWeightedItems([]);
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/cart/weights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ items: requestItems }),
        });

        const data = await res.json();
        const rows = Array.isArray(data?.items) ? data.items : [];
        const map = new Map(rows.map(r => [Number(r.book_id), r]));

        const resolved = requestItems.map(it => {
          const row = map.get(it.bookId) || {};
          const w = Number(row?.weight_grams);

          return {
            quantity: it.quantity,
            weight_grams: Number.isFinite(w) && w > 0 ? w : 500,
          };
        });

        if (!cancelled) setWeightedItems(resolved);

      } catch (err) {
        if (!cancelled) {
          setWeightedItems(
            requestItems.map(it => ({
              quantity: it.quantity,
              weight_grams: 500,
            }))
          );
        }
      }
    })();

    return () => { cancelled = true; };
  }, [items]);


  const totalWeightGrams = weightedItems.reduce(
    (sum, it) => sum + it.weight_grams * it.quantity,
    0
  );


  useEffect(() => {
    if (shippingMode !== 'delivery') {
      setShippingAmount(0);
      return;
    }

    if (!postalCode || !city) return;
    if (!totalWeightGrams) return;

    const FREE_SHIPPING_THRESHOLD = 30;
    /*if (totalPrice >= FREE_SHIPPING_THRESHOLD) {
      setShippingAmount(0);
      return;
    }*/

    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      setShippingAmount(0);
      return;
    }


    const amount = getDPDShippingPrice(totalWeightGrams);
    setShippingAmount(amount);

    localStorage.setItem(
      'checkout_shipping_amount',
      JSON.stringify({
        amount_eur: amount,
        mode: shippingMode,
      })
    );

  //}, [postalCode, city, shippingMode, totalWeightGrams, totalPrice]);
  }, [postalCode, city, shippingMode, totalWeightGrams, subtotal]);



  {/*useEffect(() => {
    async function updatePI() {
      if (!clientSecret) return;

      const total = Number(totalPrice || 0) + Number(shippingAmount || 0);
      const amount_cents = Math.round(total * 100);

      try {
        await axios.post(
          '/api/orders/update-payment-intent-amount',
          { clientSecret, amount_cents },
          { withCredentials: true }
        );
      } catch (e) {
        toast.error(t('payment_failed_try_again'));
      }
    }

    updatePI();
  }, [clientSecret, totalPrice, shippingAmount, t]);*/}

  useEffect(() => {
    async function updatePI() {
      if (!clientSecret) return;

      const amount_cents = Math.round(grandTotal * 100);

      try {
        const res = await axios.post(
          '/api/orders/update-payment-intent-amount',
          { clientSecret, amount_cents },
          { withCredentials: true }
        );

        console.log('[PI UPDATED]', res.data);
      } catch (e) {
        console.error('[PI UPDATE FAILED]', e?.response?.data || e?.message);
        toast.error(t('payment_failed_try_again'));
      }
    }

    updatePI();
  }, [clientSecret, grandTotal, t]);


  const submitHandler = async (e) => {
    e.preventDefault();

    if (!email.includes('@')) return toast.error(t('valid_email_required'));
    if (!address.trim()) return toast.error(t('address_required'));
    if (!city.trim()) return toast.error(t('city_required'));
    if (!postalCode.trim()) return toast.error(t('postal_code_required'));
    if (!stripe || !elements || !paymentReady) return toast.error(t('payment_not_ready'));

    if (shippingMode === 'delivery' && shippingAmount <= 0 && !isFreeShipping)
      return toast.error(t('shipping_error'));

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

        //totalPrice: Number(totalPrice || 0) + Number(shippingAmount || 0),
        totalPrice: Number(grandTotal.toFixed(2)),

        // ✅ NEW: shipping metadata (backend already supports this)
        //shipping_amount_eur: Number(shippingAmount || 0),
        shipping_amount_eur: Number(effectiveShipping.toFixed(2)),
        shipping_provider: shippingMode === 'pickup' ? 'PICKUP' : 'DPD',
        shipping_service: shippingMode === 'pickup' ? 'Click & Collect' : 'Standard',


        shipping_mode: shippingMode,

        shipping_selected_rate_id: null, // static pricing, no carrier rate

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
                  {/*<span>{t('cart.shipping_label') || 'Shipping'}</span>*/}

                  <span>
                    {shippingMode === 'pickup'
                      ? (t('cart.pickup_label') || 'Pickup')
                      : (t('cart.shipping_label') || 'Shipping')}
                  </span>

                  {/*<span className="total-price">€{shipping.toFixed(2)}</span>*/}
                  <span className="total-price">
                    {/*{isFreeShipping ? t('free') || '0,00 €' : `€${shipping.toFixed(2)}`}*/}

                    {shippingMode === 'pickup'
                      ? (t('free') || '0,00 €')
                      : (isFreeShipping
                        ? (t('free') || '0,00 €')
                        : `€${effectiveShipping.toFixed(2)}`
                      )
                    }

                  </span>

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
                <label>{t('delivery_method') || 'Delivery method'}</label>
                <div className="shipping-choice">
                  <label className="ship-radio">
                    <input
                      type="radio"
                      name="shippingMode"
                      value="delivery"
                      checked={shippingMode === 'delivery'}
                      onChange={() => setShippingMode('delivery')}
                    />
                    <span>{t('delivery_ship_to_postcode') || 'Deliver to postcode'}</span>
                  </label>

                  <label className="ship-radio">
                    <input
                      type="radio"
                      name="shippingMode"
                      value="pickup"
                      checked={shippingMode === 'pickup'}
                      onChange={() => setShippingMode('pickup')}
                    />
                    <span>{t('click_collect') || 'Click & Collect (pickup)'}</span>
                  </label>
                </div>

                {shippingMode === 'pickup' && (
                  <div className="pickup-hint">
                    {t('pickup_hint') || 'No shipping fees. You will collect the book yourself.'}
                  </div>
                )}
              </div>

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
              disabled={
                !stripe ||
                loading ||
                !paymentReady ||
                (shippingMode === 'delivery' && shippingAmount <= 0 && !isFreeShipping)
              }
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

        {/*<div className="test-card" style={{ marginTop: '1rem', textAlign: 'center' }}>
          {t('test_card')}: 4242 4242 4242 4242 | {t('any_date')} | 123
          <br />
          <small>Sofort: Use test mode in Stripe Dashboard</small>
        </div>*/}
      </div>
    </div>
  );
};

export default CheckoutPage;
