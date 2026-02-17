
// frontend/src/pages/Cart/CartPage.jsx
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Empty, message, Card, Row, Col, Tag, Divider } from 'antd';
import { DeleteOutlined, PlusOutlined, MinusOutlined } from '@ant-design/icons';
import {
  updateQuantity,
  removeItem,
  clearCart,
  syncUpdate,
  syncRemove,
  syncClear,
  setItemStock,
  mergeServerCart
} from '../../features/cart/cartSlice';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import './CartPage.css';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import BookCard from '../../components/Book/BookCard';
import CartShippingSummary from '../../components/Cart/CartShippingSummary';

const CartPage = () => {
  const { t, i18n } = useTranslation();
  const isDE = (i18n.resolvedLanguage || 'en') === 'de';

  const { user, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { items, totalItems, totalPrice, merged } = useSelector((state) => state.cart);

  /* ------------------------------------------------------------
     🔥 Boot merge (dedupe & server-wins):
     - Fetch server cart
     - Compare local vs server (by bookId)
     - POST only the missing local items
     - ALWAYS clear localStorage 'cart' after login
     - Reload server cart and REPLACE Redux cart
     ------------------------------------------------------------ */
  const didMergeRef = useRef(false);

  useEffect(() => {
    if (!user) return;                 // Only after user logs in
    if (merged) return;                // Slice guard
    if (didMergeRef.current) return;   // Local guard for safety
    didMergeRef.current = true;

    const getId = (obj) =>
      Number(obj?.bookId ?? obj?.book_id ?? obj?.id);

    (async () => {
      try {
        // Read local (guest) cart directly from localStorage
        const localSnapshot = (() => {
          try {
            return (JSON.parse(localStorage.getItem('cart') || '[]') || [])
              .map(i => ({ bookId: getId(i), quantity: Number(i.quantity) || 1 }))
              .filter(i => Number.isFinite(i.bookId) && i.bookId > 0 && i.quantity > 0);
          } catch { return []; }
        })();

        // 1) Fetch server cart
        const res1 = await fetch(`${import.meta.env.VITE_API_URL}/api/cart`, {
          credentials: 'include',
        });
        if (res1.status === 401) return; // Not authed unexpectedly
        const data1 = await res1.json();
        let serverItems = Array.isArray(data1?.items) ? data1.items : [];

        // 2) Make a Set of server book IDs
        const serverIds = new Set(
          serverItems
            .map(it => getId(it))
            .filter(id => Number.isFinite(id) && id > 0)
        );

        // 3) Keep only local items not already present on server
        const missing = localSnapshot.filter(li => !serverIds.has(li.bookId));

        // 4) If there are missing items, merge them once
        if (missing.length > 0) {
          const resMerge = await fetch(`${import.meta.env.VITE_API_URL}/api/cart/merge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ items: missing }),
          });

          if (!resMerge.ok) {
            console.warn('[Cart] merge returned non-200', resMerge.status);
          }
        }

        // 5) ALWAYS clear the local guest cart after login
        try { localStorage.removeItem('cart'); } catch { }

        // 6) Re-fetch server cart to get final truth
        const res2 = await fetch(`${import.meta.env.VITE_API_URL}/api/cart`, {
          credentials: 'include',
        });
        const data2 = await res2.json();
        serverItems = Array.isArray(data2?.items) ? data2.items : [];

        // 7) Replace local Redux cart with server cart (REPLACE, not additive)
        dispatch(mergeServerCart({ items: serverItems }));
      } catch (err) {
        console.error('Cart boot merge (dedupe) error:', err);
        // Fallback: do nothing — user still sees local cart; next navigation may reattempt
      }
    })();
  }, [user, merged, dispatch]);

  /* ------------------------------------------------------------
     WISHLIST LOADING
     ------------------------------------------------------------ */
  const [wishlistBooks, setWishlistBooks] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setWishlistBooks([]);
      return;
    }

    setWishlistLoading(true);

    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/wishlist`, {
          credentials: 'include',
        });

        const data = await res.json();
        const books = Array.isArray(data?.books) ? data.books : [];
        setWishlistBooks(books);
      } catch (err) {
        console.error('Failed to load wishlist', err);
        setWishlistBooks([]);
      } finally {
        setWishlistLoading(false);
      }
    })();
  }, [user]);

  /* ------------------------------------------------------------
     STOCK REFRESH
     ------------------------------------------------------------ */
  useEffect(() => {
    const idsNeedingStock = items
      .filter((i) => typeof i.stock !== 'number')
      .map((i) => i.bookId);

    if (!idsNeedingStock.length) return;

    (async () => {
      try {
        await Promise.all(
          idsNeedingStock.map(async (id) => {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/books/${id}`, {
              credentials: 'include',
            });
            const data = await res.json();

            dispatch(setItemStock({
              bookId: id,
              stock: typeof data?.stock === 'number' ? data.stock : 0
            }));
          })
        );
      } catch (err) {
        console.warn("Failed to refresh stock", err);
        idsNeedingStock.forEach((id) =>
          dispatch(setItemStock({ bookId: id, stock: 0 }))
        );
      }
    })();
  }, [dispatch, items]);

  // Shipping cost set by CartShippingSummary (in EUR)
  const [shippingCost, setShippingCost] = useState(0);

  // Subtotal (items only)
  const subtotal = useMemo(() => Number(totalPrice || 0), [totalPrice]);

  // Final total
  const grandTotal = useMemo(() => subtotal + Number(shippingCost || 0), [subtotal, shippingCost]);

  // Locale-aware currency formatter
  const currency = useMemo(() => {
    const locale = (i18n?.resolvedLanguage || 'en') === 'de' ? 'de-DE' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });
  }, [i18n?.resolvedLanguage]);

  /* ------------------------------------------------------------
     🔥 Recalculate shipping on quantity changes
     ------------------------------------------------------------ */
  const triggerShippingUpdate = () => {
    window.dispatchEvent(new Event("cart-updated"));
  };

  const handleQuantityChange = (bookId, delta) => {
    const item = items.find((i) => i.bookId === bookId);
    if (!item) return;

    const newQty = (item.quantity || 0) + delta;

    if (newQty <= 0) {
      dispatch(removeItem(bookId));
      if (user) dispatch(syncRemove(bookId));

      message.info(t("item_removed"));
      triggerShippingUpdate();
      return;
    }

    const max = typeof item.stock === 'number' ? item.stock : Infinity;

    if (newQty > max) {
      message.warning(`${t('only')} ${max} ${t('in_stock')}`);
      return;
    }

    dispatch(updateQuantity({ bookId, quantity: newQty }));
    if (user) dispatch(syncUpdate({ bookId, quantity: newQty }));

    triggerShippingUpdate();
  };

  const handleRemove = (bookId) => {
    dispatch(removeItem(bookId));
    if (user) dispatch(syncRemove(bookId));

    message.success(t("removed_from_cart"));
    triggerShippingUpdate();
  };

  const handleClearCart = () => {
    dispatch(clearCart());
    if (user) dispatch(syncClear());

    message.success(t("cart_cleared"));
    triggerShippingUpdate();
  };

  /* ------------------------------------------------------------
     RECOMMENDATIONS
     ------------------------------------------------------------ */
  const [recommendations, setRecommendations] = useState({
    sameAuthor: [],
    alsoBought: [],
    similar: [],
  });
  const [recLoading, setRecLoading] = useState(false);
  const cacheRef = useRef({ key: "", data: null });

  const recommendationKey = useMemo(() => {
    const ids = [...new Set(items.map((i) => i.bookId))].sort((a, b) => a - b);
    return ids.join(",");
  }, [items]);

  useEffect(() => {
    const bookIds = [...new Set(items.map((i) => i.bookId))];

    if (!bookIds.length) {
      setRecommendations({ sameAuthor: [], alsoBought: [], similar: [] });
      return;
    }

    if (cacheRef.current.key === recommendationKey && cacheRef.current.data) {
      setRecommendations(cacheRef.current.data);
      return;
    }

    setRecLoading(true);

    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cart/recommendations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookIds }),
        });

        const data = await res.json();
        const dedupe = (arr) => {
          const seen = new Set();
          return (arr || []).filter((b) => {
            if (seen.has(b.id)) return false;
            seen.add(b.id);
            return true;
          });
        };

        const mergedRecs = {
          sameAuthor: dedupe(data.sameAuthor),
          alsoBought: dedupe(data.alsoBought),
          similar: dedupe(data.similar),
        };

        setRecommendations(mergedRecs);
        cacheRef.current = { key: recommendationKey, data: mergedRecs };
      } catch (err) {
        console.error("Failed recommendations:", err);
        setRecommendations({ sameAuthor: [], alsoBought: [], similar: [] });
      } finally {
        setRecLoading(false);
      }
    })();
  }, [recommendationKey, items]);

  /* ------------------------------------------------------------
     MOBILE CART ITEM
     ------------------------------------------------------------ */
  const MobileCartItem = ({ item }) => {
    const title = isDE ? (item.title_de || item.title_en) : item.title_en;
    const maxReached =
      typeof item.stock === "number" ? item.quantity >= item.stock : false;

    return (
      <Card
        className="mobile-cart-item"
        onClick={() => navigate(`/book/${item.slug || item.bookId}`)}
        style={{ cursor: "pointer" }}
      >
        <Row gutter={16} align="middle">
          <Col>
            <img
              src={item.image || "/book-placeholder.png"}
              alt={title}
              className="mobile-img"
            />
          </Col>
          <Col flex={1}>
            <div className="mobile-title">{title}</div>
            {typeof item.stock === "number" && (
              <Tag
                color={item.stock > 0 ? "blue" : "red"}
                style={{ marginTop: 6 }}
              >
                {t("in_stock")}: {item.stock}
              </Tag>
            )}
          </Col>
        </Row>

        <Row justify="space-between" style={{ marginTop: 12 }}>
          <Col>
            <div className="mobile-price">{currency.format(item.price)}</div>
          </Col>
          <Col>
            <div className="mobile-qty">
              <Button
                size="small"
                icon={<MinusOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuantityChange(item.bookId, -1);
                }}
              />
              <span>{item.quantity}</span>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuantityChange(item.bookId, 1);
                }}
                disabled={maxReached}
              />
            </div>
          </Col>
          <Col>
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(item.bookId);
              }}
            >
              {t("remove")}
            </Button>
          </Col>
        </Row>

        <div className="mobile-total">
          {t("total")}: {currency.format(item.price * item.quantity)}
        </div>
      </Card>
    );
  };

  const normalizeBook = (b) => ({
    ...b,
    title_en: b.title_en ?? b.title ?? b.name ?? b.title_de,
    title_de: b.title_de ?? b.title ?? b.name ?? b.title_en,
    price: b.sale_price ?? b.price ?? b.final_price ?? 0,
    original_price:
      b.original_price ?? b.list_price ?? b.mrp ?? b.price_original ?? 0,
    image: b.image || "/book-placeholder.png",
  });

  const renderRecSlider = (books, className = "cart-recommendations-swiper") => (
    <Swiper
      modules={[Navigation, Pagination]}
      spaceBetween={30}
      slidesPerView={2}
      navigation
      pagination={{ clickable: true }}
      loop={false}
      watchOverflow
      breakpoints={{
        640: { slidesPerView: 3, spaceBetween: 20 },
        768: { slidesPerView: 4, spaceBetween: 24 },
        1024: { slidesPerView: 4.1, spaceBetween: 30 },
        1280: { slidesPerView: 4.1, spaceBetween: 30 },
      }}
      className={className}
    >
      {books.map((b) => {
        const nb = normalizeBook(b);
        return (
          <SwiperSlide key={b.id}>
            <div className="popular-card-wrapper">
              <BookCard book={nb} variant="default" showActions />
            </div>
          </SwiperSlide>
        );
      })}
    </Swiper>
  );

  /* ------------------------------------------------------------
     MAIN RENDER
     ------------------------------------------------------------ */
  const isEmpty = items.length === 0;

  return (
    <div className="cart-page">
      {loading ? (
        <div className="cart-loading">
          {t("loading") || "Loading..."}
        </div>
      ) : isEmpty ? (
        <div className="cart-empty">
          <Empty description={t("cart_empty")} />
          <Button type="primary" size="large" onClick={() => navigate("/")}>
            {t("continue_shopping")}
          </Button>
        </div>
      ) : (
        <div className="cart-container">
          <h1 className="cart-title">
            {t("your_cart")} ({totalItems}{" "}
            {totalItems === 1 ? t("item") : t("items")})
          </h1>

          <div className="cart-box">
            {/* DESKTOP TABLE */}
            <div className="desktop-view">
              <Table
                dataSource={items}
                rowKey="bookId"
                pagination={false}
                className="cart-line-items"
                columns={[
                  {
                    title: t("book"),
                    align: "left",
                    render: (_, record) => {
                      const title = isDE
                        ? record.title_de || record.title_en
                        : record.title_en;

                      return (
                        <div
                          className="cart-item-head"
                          onClick={() =>
                            navigate(`/book/${record.slug || record.bookId}`)
                          }
                          role="button"
                        >
                          <img
                            className="cart-thumb"
                            src={record.image || "/book-placeholder.png"}
                            alt={title}
                          />
                          <div className="cart-title-wrap">
                            <div className="cart-item-title">{title}</div>
                            {typeof record.stock === "number" && (
                              <div
                                className={`stock-pill ${
                                  record.stock > 0 ? "in" : "out"
                                }`}
                              >
                                {t("in_stock")}: {record.stock}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    title: t("price"),
                    render: (_, r) => {
                      const current = Number(r.sale_price ?? r.price);
                      const original = Number(r.original_price ?? 0);
                      const hasDiscount = original > current;
                      const pct = hasDiscount
                        ? Math.round(((original - current) / original) * 100)
                        : 0;

                      return (
                        <div className="price-stack">
                          {hasDiscount && (
                            <span className="price-original">
                              {currency.format(original)}
                            </span>
                          )}
                          <span className="price-current">
                            {currency.format(current)}
                          </span>
                          {hasDiscount && (
                            <span className="price-badge">-{pct}%</span>
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    title: t("quantity"),
                    render: (_, r) => {
                      const maxReached =
                        typeof r.stock === "number"
                          ? r.quantity >= r.stock
                          : false;

                      return (
                        <div className="qty-control">
                          <Button
                            size="small"
                            onClick={() =>
                              handleQuantityChange(r.bookId, -1)
                            }
                          >
                            -
                          </Button>
                          <span className="qty">{r.quantity}</span>
                          <Button
                            size="small"
                            onClick={() =>
                              handleQuantityChange(r.bookId, 1)
                            }
                            disabled={maxReached}
                          >
                            +
                          </Button>
                        </div>
                      );
                    },
                  },
                  {
                    title: t("total"),
                    render: (_, r) => {
                      const current = Number(r.sale_price ?? r.price);
                      return (
                        <div className="line-total">
                          {currency.format(current * r.quantity)}
                        </div>
                      );
                    },
                  },
                  {
                    title: "",
                    render: (_, r) => (
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemove(r.bookId)}
                      >
                        {t("remove")}
                      </Button>
                    ),
                  },
                ]}
              />
            </div>

            {/* MOBILE VIEW */}
            <div className="mobile-view">
              {items.map((item) => (
                <MobileCartItem key={item.bookId} item={item} />
              ))}
            </div>

            {/* SHIPPING + ORDER SUMMARY */}
            <div className="cart-summary-grid">
              {/* Left: Shipping selector/details */}
              <div className="cart-shipping-panel">
                <CartShippingSummary
                  t={t}
                  i18n={i18n}
                  onShippingChange={setShippingCost}
                />
                <div className="shipping-note">
                  {t("shipping_calculated_at_checkout") ||
                    "Shipping label is purchased at checkout"}
                </div>
              </div>

              {/* Right: Order Summary */}
              <Card variant="borderless" className="cart-summary-card">
                <div className="summary-title">
                  {t("order_summary") || "Order Summary"}
                </div>

                <div className="summary-row">
                  <span className="summary-label">{t("cart.subtotal") || "Subtotal"}</span>
                  <span className="summary-value">{currency.format(subtotal)}</span>
                </div>

                <div className="summary-row">
                  <span className="summary-label">{t("cart.shipping_label") || "Shipping"}</span>
                  <span className="summary-value">
                    {currency.format(Number(shippingCost || 0))}
                  </span>
                </div>

                <Divider className="summary-divider" />

                <div className="summary-row summary-total">
                  <span className="summary-label">{t("total") || "Total"}</span>
                  <span className="summary-value">{currency.format(grandTotal)}</span>
                </div>

                <div className="summary-actions">
                  {user ? (
                    <>
                      <Button
                        type="primary"
                        size="large"
                        className="summary-primary"
                        onClick={() => navigate("/checkout")}
                      >
                        {t("proceed_to_checkout")}
                      </Button>

                      <Button
                        size="large"
                        className="summary-secondary"
                        onClick={handleClearCart}
                      >
                        {t("clear_cart")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="primary"
                        size="large"
                        className="summary-primary"
                        onClick={() => navigate("/login?redirect=/checkout")}
                      >
                        {t("login_to_checkout")}
                      </Button>

                      <Button
                        size="large"
                        className="summary-secondary"
                        onClick={() => navigate("/")}
                      >
                        {t("continue_shopping")}
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* WISHLIST */}
          {user && (
            <div className="cart-wishlist full-bleed">
              <div className="inner-limit">
                <h2 className="section-title">{t("your_wishlist")}</h2>

                {wishlistLoading && (
                  <div className="rec-loading">
                    {t("loading_wishlist")}
                  </div>
                )}

                {!wishlistLoading && wishlistBooks.length === 0 && (
                  <div className="rec-empty">{t("wishlist_empty")}</div>
                )}

                {!wishlistLoading && wishlistBooks.length > 0 && (
                  <section className="recommendations-section">
                    <h3 className="rec-section-title">
                      {t("saved_for_later")}
                    </h3>
                    {renderRecSlider(
                      wishlistBooks,
                      "cart-recommendations-swiper"
                    )}
                  </section>
                )}
              </div>
            </div>
          )}

          {/* GENERAL RECOMMENDATIONS */}
          <div className="cart-recommendations full-bleed">
            <div className="inner-limit">
              <h2 className="section-title">
                {t("you_might_also_like")}
              </h2>

              {recLoading && (
                <div className="rec-loading">
                  {t("loading_recommendations")}
                </div>
              )}

              {!recLoading &&
                recommendations.sameAuthor.length === 0 &&
                recommendations.alsoBought.length === 0 &&
                recommendations.similar.length === 0 && (
                  <div className="rec-empty">
                    {t("no_recommendations")}
                  </div>
                )}

              {!recLoading && recommendations.sameAuthor.length > 0 && (
                <section className="recommendations-section">
                  <h3 className="rec-section-title">
                    {t("more_from_author_plural")}
                  </h3>
                  {renderRecSlider(recommendations.sameAuthor)}
                </section>
              )}

              {!recLoading && recommendations.alsoBought.length > 0 && (
                <section className="recommendations-section">
                  <h3 className="rec-section-title">
                    {t("customers_also_bought")}
                  </h3>
                  {renderRecSlider(recommendations.alsoBought)}
                </section>
              )}

              {!recLoading && recommendations.similar.length > 0 && (
                <section className="recommendations-section">
                  <h3 className="rec-section-title">
                    {t("similar_books")}
                  </h3>
                  {renderRecSlider(recommendations.similar)}
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
