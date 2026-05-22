
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
import { Link } from "react-router-dom";
import config from '../../config';

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

  //const [shippingMode, setShippingMode] = useState('delivery');
  const shippingMode = 'delivery';

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
  const API_BASE = `${config.API_URL}/api`;
  const FREE_SHIPPING_THRESHOLD = 30;


  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);

  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);



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
  /*const effectiveShipping =
    shippingMode === 'pickup' ? 0 : (isFreeShipping ? 0 : Number(shippingAmount || 0));*/

  /*const effectiveShipping =
    isFreeShipping ? 0 : Number(shippingAmount || 0);*/


  const isFreeDeliveryCode =
    appliedDiscount?.type === 'FREE_SHIPPING';

  const effectiveShipping =
    isFreeDeliveryCode
      ? 0
      : (isFreeShipping ? 0 : Number(shippingAmount || 0));


  const grandTotal = subtotal + effectiveShipping;

  const MIN_STRIPE_EUR = 0.50;

  // Wallet can only cover up to (grandTotal - 0.50), so Stripe always charges ≥ 0.50
  const maxWalletAllowed = Math.max(0, grandTotal - MIN_STRIPE_EUR);

  const walletUsed = useWallet
    ? Math.min(walletBalance, maxWalletAllowed)
    : 0;

  const finalTotal = grandTotal - walletUsed;

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('checkout_shipping_amount');
      if (raw) {
        const parsed = JSON.parse(raw);
        setShippingAmount(Number(parsed.amount_eur || 0));
        //setShippingMode(parsed.mode || 'delivery');
        //setShippingMode(resolvedMode);
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

    //setShippingMode(resolvedMode);
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
    async function loadWallet() {
      //const res = await axios.get('/api/wallet', { withCredentials: true });
      const res = await axios.get(`${API_BASE}/wallet`, { withCredentials: true });
      setWalletBalance(Number(res.data.balance || 0));
    }
    loadWallet();
  }, []);


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

    //console.log('🚀 updatePI triggered');
    //console.log('🚀 shippingMode:', shippingMode);
    //console.log('🚀 grandTotal:', grandTotal);
    console.log('PI update:', { grandTotal, walletUsed, finalTotal });

    async function updatePI() {
      if (!clientSecret) return;

      //const amount_cents = Math.round(grandTotal * 100);
      //const amount_cents = Math.round(finalTotal * 100);
      const amount_cents = Math.max(50, Math.round(finalTotal * 100));


      //const shipping_provider = shippingMode === 'pickup' ? 'PICKUP' : 'DPD';
      //const shipping_service = shippingMode === 'pickup' ? 'Click & Collect' : 'Standard';

      const shipping_provider = 'DPD';
      const shipping_service = 'Standard';



      try {
        const res = /*await axios.post(
          '/api/orders/update-payment-intent-amount',
          { clientSecret, amount_cents, shipping_provider, shipping_service },
          { withCredentials: true }
        );*/

          await axios.post(
            `${API_BASE}/orders/update-payment-intent-amount`,
            { clientSecret, amount_cents, shipping_provider, shipping_service },
            { withCredentials: true }
          );


        //console.log('[PI UPDATED]', res.data);
      } catch (e) {
        console.error('[PI UPDATE FAILED]', e?.response?.data || e?.message);
        toast.error(t('payment_failed_try_again'));
      }
    }

    updatePI();
  }, [clientSecret, finalTotal, shippingMode, t]);

  const [discountError, setDiscountError] = useState("");

  /*const applyDiscount = async () => {
    try {
      const normalized = discountCode.trim().toUpperCase();
      const { data } = await axios.post('/api/discounts/validate', {
        code: normalized,
      });

      setAppliedDiscount(data);
      toast.success("Discount applied");

    } catch (err) {
      toast.error(err.response?.data?.error || "Invalid code");
      setAppliedDiscount(null);
    }
  };*/

  const applyDiscount = async () => {
    try {
      setDiscountError(""); // ✅ clear old error

      const normalized = discountCode.trim().toUpperCase();

      /*const { data } = await axios.post('/api/discounts/validate', {
        code: normalized,
      });*/
      const { data } = await axios.post(`${API_BASE}/discounts/validate`, { code: normalized });

      setAppliedDiscount(data);
      toast.success("Discount applied");

    } catch (err) {
      const msg = err.response?.data?.error || "Invalid code";

      setDiscountError(msg);     // ✅ store error for UI
      toast.error(msg);          // ✅ keep toast also
      setAppliedDiscount(null);
    }
  };


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

        discount_code: appliedDiscount?.code || null,
        discount_type: appliedDiscount?.type || null,
        wallet_used: walletUsed,

        //totalPrice: Number(totalPrice || 0) + Number(shippingAmount || 0),
        totalPrice: Number(grandTotal.toFixed(2)),

        // ✅ NEW: shipping metadata (backend already supports this)
        //shipping_amount_eur: Number(shippingAmount || 0),
        shipping_amount_eur: Number(effectiveShipping.toFixed(2)),
        //shipping_provider: shippingMode === 'pickup' ? 'PICKUP' : 'DPD',
        //shipping_service: shippingMode === 'pickup' ? 'Click & Collect' : 'Standard',
        //shipping_mode: shippingMode,
        shipping_provider: 'DPD',
        shipping_service: 'Standard',
        shipping_mode: 'delivery',

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
          <div className="checkout-grid">
            {/* LEFT: Delivery + Discount + Payment */}
            <div className="checkout-main">
              {/* Shipping / address */}
              <div className="address-card">
                <div className="form-header">{t('shipping_address')}</div>

                <div className="form-group">
                  <label>{t('delivery_method') || 'Delivery method'}</label>
                  <div className="shipping-choice">
                    <div className="ship-radio selected">
                      <span>{t('delivery_ship_to_postcode') || 'Delivery (DPD)'}</span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('email')}</label>
                  {/*<input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />*/}
                  <div className="readonly-field">
                    <strong>{email}</strong>
                  </div>
                  <div className="mini-hint">
                    {t('checkout_email_fixed') || 'This email is linked to your account'}
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('street_address')}</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>{t('city')}</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('postal_code')}</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('country')}</label>
                  <div className="readonly-field">
                    <strong>Deutschland (DE)</strong>
                  </div>
                </div>
              </div>

              {/* Discount card */}
              <div className="discount-card">
                <div className="form-header">{t('discount') || 'Discount'}</div>

                {!appliedDiscount ? (
                  <div className="promo-row">
                    <input
                      className="promo-input"
                      type="text"
                      value={discountCode}
                      //onChange={(e) => setDiscountCode(e.target.value)}

                      onChange={(e) => {
                        setDiscountCode(e.target.value);
                        setDiscountError(""); // ✅ clear error when typing
                      }}

                      placeholder={t('discount_placeholder') || 'Enter code'}
                    />
                    <button
                      type="button"
                      className="promo-apply"
                      onClick={applyDiscount}
                      disabled={!discountCode.trim()}
                    >
                      {t('apply') || 'Apply'}
                    </button>
                    {discountError && (
                      <div style={{ color: 'red', marginTop: '8px', fontSize: '14px' }}>
                        {discountError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="promo-applied">
                    <div className="promo-pill">
                      <span className="promo-label">{t('applied') || 'Applied'}:</span>
                      <span className="promo-code">{appliedDiscount.code}</span>
                    </div>

                    <button
                      type="button"
                      className="promo-remove"
                      onClick={() => {
                        setAppliedDiscount(null);
                        setDiscountCode('');
                      }}
                    >
                      {t('remove') || 'Remove'}
                    </button>
                  </div>
                )}

                {appliedDiscount?.type === 'FREE_SHIPPING' && (
                  <div className="promo-success">
                    ✅ {t('free_delivery_applied') || 'Free delivery applied'}
                  </div>
                )}
              </div>

              <div className="wallet-card">
                <div className="form-header">Wallet</div>

                <div>
                  Balance: €{walletBalance.toFixed(2)}
                </div>

                <label style={{ marginTop: '10px', display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={useWallet}
                    onChange={() => setUseWallet(!useWallet)}
                  />
                  Use wallet balance
                </label>

                {useWallet && (
                  <div style={{ marginTop: '8px', color: 'green' }}>
                    Using €{walletUsed.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Payment card */}
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
                          name: user?.first_name
                            ? `${user.first_name} ${user.last_name || ""}`.trim()
                            : email,
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
                    `${t('pay')} €${finalTotal.toFixed(2)}`
                  )}
                </button>

                <div className="trust-note">
                  {t('secure_checkout_note') || 'Secure checkout. Payment handled by Stripe.'}
                </div>
              </div>
            </div>

            {/* RIGHT: Sticky order summary */}
            <div className="checkout-sidebar">
              <div className="summary-card sticky-summary">
                <div className="summary-header">{t('order_summary')}</div>

                <div className="summary-items">
                  {cartItems.map((item) => (
                    <Link
                      key={item.bookId}
                      to={`/book/${item.slug}`}
                      className="summary-item clickable"
                    >
                      <img
                        src={item.image || "/assets/book-placeholder.jpg"}
                        alt={item.title_en}
                      />

                      <div className="item-details">
                        <h3>{item.title_en || item.name}</h3>
                        <p>{t('quantity')}: {item.quantity}</p>
                      </div>

                      <div className="item-price">
                        €{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="summary-total">
                  <div className="total-row">
                    <span>{t('cart.subtotal') || 'Subtotal'}</span>
                    <span className="total-price">€{subtotal.toFixed(2)}</span>
                  </div>

                  <div className="total-row">
                    <span>{t('cart.shipping_label') || 'Shipping'}</span>
                    <span className="total-price">
                      {appliedDiscount?.type === 'FREE_SHIPPING'
                        ? (t('free') || '0,00 €')
                        : (isFreeShipping ? (t('free') || '0,00 €') : `€${effectiveShipping.toFixed(2)}`)
                      }
                    </span>
                  </div>

                  {(appliedDiscount?.type === 'FREE_SHIPPING' || isFreeShipping) && (
                    <div className="mini-hint">
                      {appliedDiscount?.type === 'FREE_SHIPPING'
                        ? t('free_delivery_code')
                        : t('free_delivery_threshold', { amount: FREE_SHIPPING_THRESHOLD })}
                    </div>
                  )}

                  {useWallet && walletUsed > 0 && (
                    <div className="total-row">
                      <span>{t('wallet_used') || 'Wallet used'}</span>
                      <span className="total-price">-€{walletUsed.toFixed(2)}</span>
                    </div>
                  )}


                  <div className="total-row total-strong">
                    <span>{t('total')}</span>
                    <span className="total-price">€{finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckoutPage;
