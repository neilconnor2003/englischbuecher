
// backend/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const axios = require('axios');

module.exports = (db) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // === CREATE PAYMENT INTENT — GERMANY ONLY ===
  router.post('/create-payment-intent', async (req, res) => {
    const { items, totalPrice, currency = 'eur' } = req.body;

    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });
    const amount = Math.round(totalPrice * 100);
    if (amount < 50) return res.status(400).json({ error: 'Minimum €0.50' });

    // Before creating paymentIntent in /create-payment-intent:
    for (const i of items) {
      const [[row]] = await db.execute('SELECT stock FROM books WHERE id = ?', [i.bookId]);
      if (!row || row.stock < i.quantity) {
        return res.status(409).json({ error: `Only ${row?.stock ?? 0} left for book ${i.bookId}` });
      }
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        // keep your explicitly allowed methods
        payment_method_types: ['card', 'paypal', 'sofort'],
        metadata: {
          userId: req.user?.id || 'guest',
          cart: JSON.stringify(items.map(i => ({ id: i.bookId, qty: i.quantity }))),
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
      console.error('Stripe error:', err);
      res.status(500).json({ error: err.message });
    }
  });


  // === MY ORDERS (enriched for shipping/tracking) ===
  router.get('/my-orders', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const [rows] = await db.execute(
        `SELECT
         id,
         total,
         status,
         created_at,
         is_paid,
         tracking_number,
         tracking_url,
         label_url,
         shipping_amount_eur,
         shipping_provider,
         shipping_service,
         order_items   -- keep for Profile's quick thumbnails (optional)
       FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC`,
        [userId]
      );

      rows.forEach(o => {
        o.total = Number(o.total);
        // keep original order_items JSON string (ProfilePage parses it)
      });

      res.json(rows);
    } catch (err) {
      console.error('MY ORDERS ERROR:', err);
      res.status(500).json({ error: err.message });
    }
  });


  // === GET ALL ORDERS (ADMIN) ===
  router.get('/', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    try {
      const [rows] = await db.execute(`
        SELECT
          o.*,
          u.first_name,
          u.last_name,
          u.email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
      `);

      const parseIfString = (field) => {
        if (!field) return [];
        if (typeof field === 'string') {
          try { return JSON.parse(field); } catch (e) { return []; }
        }
        return field;
      };

      const orders = rows.map(o => ({
        ...o,
        total: Number(o.total) || 0,
        is_paid: !!o.is_paid,
        order_items: parseIfString(o.order_items),
        shipping_address: parseIfString(o.shipping_address),
        payment_result: parseIfString(o.payment_result),
      }));

      res.json(orders);
    } catch (err) {
      console.error('GET /api/orders error:', err);
      res.status(500).json({ error: err.message });
    }
  });


  router.post('/', async (req, res) => {
    const {
      orderItems,
      shippingAddress,
      paymentMethod,
      paymentResult,
      totalPrice,

      // NEW — shipping metadata coming from CheckoutPage
      shipping_selected_rate_id,
      shipping_amount_eur,
      shipping_provider,
      shipping_service,
    } = req.body;

    const userId = req.user?.id || null;

    // Validation (unchanged)
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }
    if (!shippingAddress?.address) {
      return res.status(400).json({ error: 'Shipping address required' });
    }
    if (!paymentResult?.id) {
      return res.status(400).json({ error: 'Payment result required' });
    }
    if (totalPrice < 0.5) {
      return res.status(400).json({ error: 'Minimum order €0.50' });
    }

    const isPaid = paymentResult.status === 'succeeded';

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      // 1) Insert order header — extended with shipping columns
      const [result] = await conn.execute(
        `INSERT INTO orders (
        user_id,
        order_items,
        shipping_address,
        payment_method,
        payment_result,
        total,
        is_paid,
        paid_at,
        status,
        inventory_adjusted,

        shipping_amount_eur,
        shipping_provider,
        shipping_service,
        shippo_rate_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          JSON.stringify(orderItems),
          JSON.stringify(shippingAddress),
          paymentMethod,
          JSON.stringify(paymentResult),
          totalPrice,
          isPaid ? 1 : 0,
          isPaid ? new Date() : null,
          isPaid ? 'processing' : 'pending',
          0, // inventory_adjusted: not yet

          Number(shipping_amount_eur || 0),
          shipping_provider || null,
          shipping_service || null,
          shipping_selected_rate_id || null
        ]
      );

      const orderId = result.insertId;

      // 2) Adjust inventory (same logic you had)
      for (const it of orderItems) {
        const bookId = Number(it.bookId);
        const qty = Number(it.quantity);
        if (!bookId || !qty || qty <= 0) {
          throw new Error(`Invalid line item: ${JSON.stringify(it)}`);
        }

        const [upd] = await conn.execute(
          `UPDATE books
           SET stock = stock - ?,
               is_available = CASE WHEN (stock - ?) > 0 THEN is_available ELSE 0 END
         WHERE id = ? AND stock >= ?`,
          [qty, qty, bookId, qty]
        );

        if (upd.affectedRows === 0) {
          throw new Error(`Insufficient stock for book id=${bookId}`);
        }
      }

      // 3) Mark inventory adjusted
      await conn.execute(
        `UPDATE orders
          SET inventory_adjusted = 1,
              status = ?
        WHERE id = ?`,
        [isPaid ? 'processing' : 'pending', orderId]
      );

      // 4) Clear cart for logged-in users (same as your code)
      if (userId) {
        await conn.execute('DELETE FROM cart_items WHERE user_id = ?', [userId]);
      }

      await conn.commit();

      // 5) Buy Shippo label (best-effort) AFTER commit (to avoid blocking order creation)
      if (shipping_selected_rate_id) {
        try {
          const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
          // your /api/shippo/buy-label expects { rate_object_id }
          const resp = await axios.post(
            `${BASE_URL}/api/shippo/buy-label`,
            { rate_object_id: shipping_selected_rate_id },
            { timeout: 20000 }
          );
          const label = resp.data || null;

          // Store tracking data on the order
          await db.execute(
            `UPDATE orders
              SET tracking_number = ?,
                  tracking_url = ?,
                  label_url = ?,
                  status = CASE WHEN status = 'processing' THEN 'processing' ELSE status END
            WHERE id = ?`,
            [
              label?.tracking_number || null,
              label?.tracking_url || null,
              label?.label_url || null,
              orderId
            ]
          );
        } catch (e) {
          console.warn('[orders] buy-label failed; order created without label:', e?.response?.data || e?.message);
          // You can add a retry from Admin later
        }
      }

      // 6) PaymentIntent metadata (unchanged best-effort)
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        await stripe.paymentIntents.update(paymentResult.id, {
          metadata: {
            order_id: String(orderId),
            userId: userId ?? 'guest',
            cart: JSON.stringify(orderItems.map(i => ({ id: i.bookId, qty: i.quantity }))),
          },
        });
      } catch (stripeErr) {
        console.warn('Failed to update Stripe metadata:', stripeErr.message);
      }

      // 7) Email invoice (your existing logic – unchanged)
      if (userId) {
        const [userRows] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
        const user = userRows[0];
        if (user) {
          const sendInvoiceEmail = require('../utils/sendInvoiceEmail');
          const fullOrder = {
            id: orderId,
            user_id: userId,
            order_items: orderItems,
            shipping_address: shippingAddress,
            payment_method: paymentMethod,
            payment_result: paymentResult,
            total: totalPrice,
            is_paid: isPaid ? 1 : 0,
            paid_at: isPaid ? new Date() : null,
            status: isPaid ? 'processing' : 'pending',
            inventory_adjusted: 1,
            shipping_amount_eur: Number(shipping_amount_eur || 0),
            shipping_provider: shipping_provider || null,
            shipping_service: shipping_service || null
          };
          // fire and forget
          sendInvoiceEmail(fullOrder, user, user.language || 'de').catch(console.error);
        }
      }

      return res.status(201).json({
        success: true,
        orderId,
        message: 'Order created and inventory adjusted',
      });
    } catch (err) {
      if (conn) await conn.rollback();
      const code = /Insufficient stock/.test(err.message) ? 409 : 500;
      console.error('Order save/stock adjust error:', err.message);
      return res.status(code).json({ error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });


  /**
   * === FINALIZE ORDER FROM PAYMENT INTENT (redirect methods like PayPal) ===
   * Body: { paymentIntentId, shippingAddress?, email? }
   * Returns: { success: true, orderId }
   */
  router.post('/finalize-from-payment-intent', async (req, res) => {
    const { paymentIntentId, shippingAddress, email } = req.body;
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });

    try {
      // 1) Get the PI from Stripe
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (!pi || pi.status !== 'succeeded') {
        return res.status(400).json({ error: 'Payment not succeeded' });
      }

      // 2) If we already have an order for this PI, return it (idempotent)
      const [[existing]] = await db.execute(
        'SELECT id FROM orders WHERE JSON_EXTRACT(payment_result, "$.id") = ? ORDER BY id DESC LIMIT 1',
        [pi.id]
      );
      if (existing) {
        return res.json({ success: true, orderId: existing.id, reused: true });
      }

      // 3) Extract cart from PI metadata
      let items = [];
      try {
        items = JSON.parse(pi.metadata?.cart || '[]');
      } catch (_) {
        items = [];
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No cart metadata on PaymentIntent' });
      }

      // 4) Build order items from DB and compute total
      const orderItems = [];
      let totalPrice = 0;

      for (const it of items) {
        const bookId = Number(it.id);
        const qty = Number(it.qty);
        if (!bookId || !qty || qty <= 0) {
          return res.status(400).json({ error: `Invalid cart line: ${JSON.stringify(it)}` });
        }

        const [[book]] = await db.execute(
          'SELECT id, title_en, title_de, price, stock FROM books WHERE id = ?',
          [bookId]
        );
        if (!book) return res.status(404).json({ error: `Book ${bookId} not found` });
        if (book.stock < qty) return res.status(409).json({ error: `Only ${book.stock} left for book ${bookId}` });

        totalPrice += Number(book.price) * qty;
        orderItems.push({
          bookId: book.id,
          title_en: book.title_en,
          title_de: book.title_de,
          price: Number(book.price),
          quantity: qty,
        });
      }

      // 5) Build a paymentResult payload for persistence
      const paymentResult = {
        id: pi.id,
        status: pi.status,
        amount: pi.amount / 100,
        currency: pi.currency,
        payment_method_types: pi.payment_method_types,
        email_address: email || pi.receipt_email || null,
      };

      // 6) Transaction: insert order + adjust stock atomically
      const userId = req.user?.id || null;
      let conn;
      try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const [insert] = await conn.execute(
          `INSERT INTO orders (
            user_id,
            order_items,
            shipping_address,
            payment_method,
            payment_result,
            total,
            is_paid,
            paid_at,
            status,
            inventory_adjusted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            JSON.stringify(orderItems),
            JSON.stringify(shippingAddress || {}), // optional; can be {} for redirect flows
            (pi.payment_method_types && pi.payment_method_types[0]) || 'paypal',
            JSON.stringify(paymentResult),
            Number(totalPrice.toFixed(2)),
            1,               // payment succeeded
            new Date(),      // paid now
            'processing',
            0
          ]
        );

        const orderId = insert.insertId;

        // Adjust inventory
        for (const it of orderItems) {
          const [upd] = await conn.execute(
            `UPDATE books
               SET stock = stock - ?,
                   is_available = CASE WHEN (stock - ?) > 0 THEN is_available ELSE 0 END
             WHERE id = ? AND stock >= ?`,
            [it.quantity, it.quantity, it.bookId, it.quantity]
          );
          if (upd.affectedRows === 0) throw new Error(`Insufficient stock for book id=${it.bookId}`);
        }

        await conn.execute(
          `UPDATE orders SET inventory_adjusted = 1 WHERE id = ?`,
          [orderId]
        );

        if (userId) {
          await conn.execute('DELETE FROM cart_items WHERE user_id = ?', [userId]);
        }

        await conn.commit();

        // Attach order_id to PI metadata (best-effort)
        try {
          await stripe.paymentIntents.update(pi.id, {
            metadata: {
              ...(pi.metadata || {}),
              order_id: String(orderId),
            },
          });
        } catch (_) { }

        return res.status(201).json({ success: true, orderId });
      } catch (err) {
        if (conn) await conn.rollback();
        const code = /Insufficient stock/.test(err.message) ? 409 : 500;
        console.error('finalize-from-payment-intent error:', err.message);
        return res.status(code).json({ error: err.message });
      } finally {
        if (conn) conn.release();
      }
    } catch (err) {
      console.error('Stripe retrieve PI error:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // === GET ORDER BY ID ===
  router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const [rows] = await db.execute(`
        SELECT
          o.*,
          u.first_name,
                   u.last_name,
          u.email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
      `, [id]);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const order = rows[0];
      const parseIfString = (field) => {
        if (typeof field === 'string') {
          try { return JSON.parse(field); } catch (e) { return []; }
        }
        return field || [];
      };

      order.total = Number(order.total) || 0;
      order.order_items = parseIfString(order.order_items);
      order.shipping_address = parseIfString(order.shipping_address);
      order.payment_result = parseIfString(order.payment_result);

      res.json(order);
    } catch (err) {
      console.error('Fetch order error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};