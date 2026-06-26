// backend/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const axios = require('axios');


const requireAuth = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

// Mirrors frontend/src/utils/seoUrl.js's generateBookUrl exactly, so links
// built here in emails always match the real route the app actually serves.
// Real route shape: /book/{slug}-{isbn}-{id}  (singular "book", not "books")
function buildBookUrl(book) {
  if (!book) return '/';
  const slug = book.slug || '';
  const isbn = book.isbn13 || book.isbn10 || '';
  const idPart = book.id ? `-${book.id}` : '';
  return `/book/${slug}${isbn ? '-' + isbn : ''}${idPart}`;
}


module.exports = (db, transporter) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  //console.log('✅ LOADING orderRoutes from:', __filename);

  // Schedules review-request tracking rows the first time an order
  // becomes 'delivered', and sends the FIRST review-request email
  // immediately (inline, not via cron). The daily cron in server.js
  // (sendReviewRequestEmails) picks up emails #2, #3, #4 on the
  // day-5 / day-12 / day-20 schedule from here.
  async function scheduleReviewRequests(orderId) {
    try {
      const [[order]] = await db.execute(
        'SELECT id, user_id, order_items, status FROM orders WHERE id = ?',
        [orderId]
      );
      if (!order || order.status !== 'delivered' || !order.user_id) return;

      const [[user]] = await db.execute(
        'SELECT email, first_name, language FROM users WHERE id = ?',
        [order.user_id]
      );
      if (!user || !user.email) return;

      const items = typeof order.order_items === 'string'
        ? JSON.parse(order.order_items)
        : (order.order_items || []);

      const deliveredAt = new Date();
      // After the immediate first email, the next one is day 5 —
      // cron then handles day 12 and day 20 from there.
      const secondSend = new Date(deliveredAt.getTime() + 5 * 24 * 60 * 60 * 1000);

      for (const item of items) {
        const bookId = Number(item.bookId);
        if (!bookId) continue;

        // Skip entirely if this user has already reviewed THIS BOOK before,
        // under any order — no point asking again just because they bought
        // it a second time (e.g. as a gift, or a replacement copy).
        const [[alreadyReviewed]] = await db.execute(
          'SELECT 1 FROM reviews WHERE user_id = ? AND book_id = ? LIMIT 1',
          [order.user_id, bookId]
        );
        if (alreadyReviewed) continue;

        // INSERT IGNORE — uq_order_book unique key prevents duplicate scheduling
        // if this route runs more than once for the same order.
        const [insertResult] = await db.execute(`
          INSERT IGNORE INTO review_requests
            (order_id, user_id, book_id, delivered_at, emails_sent, next_send_at)
          VALUES (?, ?, ?, ?, 0, ?)
        `, [orderId, order.user_id, bookId, deliveredAt, secondSend]);

        // Only send the immediate email if this row was newly created —
        // affectedRows is 0 when INSERT IGNORE skips a duplicate, which
        // means this book's request was already scheduled before (e.g.
        // the admin saved the order twice), so don't re-send.
        if (insertResult.affectedRows === 0) continue;

        const [[book]] = await db.execute(
          'SELECT id, title_en, title_de, slug, image, isbn13, isbn10 FROM books WHERE id = ?',
          [bookId]
        );
        if (!book) continue;

        await sendReviewRequestEmailNow({
          db,
          transporter,
          toEmail: user.email,
          firstName: user.first_name,
          language: user.language,
          book,
          orderId,
          bookId,
          userId: order.user_id,
        });
      }
    } catch (err) {
      console.error('scheduleReviewRequests error:', err);
      // Never throw — this must not block the order update response
    }
  }

  // Sends ONE review-request email right now (used for the immediate
  // first email only — the cron in server.js handles emails #2-4).
  // Logs to sent_emails and updates the review_requests row's counters,
  // exactly like the cron does, so both paths stay consistent.
  async function sendReviewRequestEmailNow({ db, transporter, toEmail, firstName, language, book, orderId, bookId, userId }) {
    const isDe = language === 'de';
    const title = isDe ? (book.title_de || book.title_en) : (book.title_en || book.title_de);
    const reviewUrl = `${process.env.FRONTEND_URL}${buildBookUrl(book)}#reviews`;
    const coverImg = book.image || '';

    const subject = isDe
      ? `Wie hat dir "${title}" gefallen?`
      : `How did you like "${title}"?`;

    const html = isDe ? `
      <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
        <div style="background:linear-gradient(135deg,#1f1633,#3b1d6e);padding:36px 32px;border-radius:16px 16px 0 0;text-align:center;">
          <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#c4b5fd;text-transform:uppercase;margin-bottom:10px;">englischbücher.de</div>
          <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">Wie war deine Lektüre? 📖</h1>
        </div>
        <div style="padding:32px;border:1px solid #ede9fe;border-top:none;border-radius:0 0 16px 16px;">
          <p style="color:#1a1a2e;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hallo ${firstName || ''}, dein Buch wurde zugestellt! Wir hoffen, es gefällt dir.
          </p>
          <div style="text-align:center;margin:0 0 24px;">
            ${coverImg ? `<img src="${coverImg}" alt="${title}" style="width:100px;height:auto;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.15);margin-bottom:14px;">` : ''}
            <div style="font-size:16px;font-weight:700;color:#1a1a2e;">${title}</div>
          </div>
          <p style="color:#1a1a2e;font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
            Hättest du eine Minute Zeit, um eine kurze Bewertung zu hinterlassen? Das hilft anderen Lesern bei ihrer Auswahl sehr.
          </p>
          <div style="text-align:center;margin:0 0 8px;">
            <a href="${reviewUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Jetzt bewerten</a>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:24px 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">
            Falls du bereits eine Bewertung abgegeben hast, ignoriere diese E-Mail einfach.
          </p>
        </div>
      </div>
    ` : `
      <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
        <div style="background:linear-gradient(135deg,#1f1633,#3b1d6e);padding:36px 32px;border-radius:16px 16px 0 0;text-align:center;">
          <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#c4b5fd;text-transform:uppercase;margin-bottom:10px;">englischbücher.de</div>
          <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">How was your read? 📖</h1>
        </div>
        <div style="padding:32px;border:1px solid #ede9fe;border-top:none;border-radius:0 0 16px 16px;">
          <p style="color:#1a1a2e;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hi ${firstName || ''}, your book has been delivered! We hope you're enjoying it.
          </p>
          <div style="text-align:center;margin:0 0 24px;">
            ${coverImg ? `<img src="${coverImg}" alt="${title}" style="width:100px;height:auto;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.15);margin-bottom:14px;">` : ''}
            <div style="font-size:16px;font-weight:700;color:#1a1a2e;">${title}</div>
          </div>
          <p style="color:#1a1a2e;font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
            Could you spare a minute to leave a quick review once you've had a chance to read it? It really helps other readers choose their next book.
          </p>
          <div style="text-align:center;margin:0 0 8px;">
            <a href="${reviewUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Leave a review</a>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:24px 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">
            If you've already left a review, just ignore this email.
          </p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: toEmail,
        subject,
        html,
      });

      // day 5 is when email #2 should go out — overwrite the placeholder
      // next_send_at that was set at insert time with the real value here
      // too, just to be explicit (they're already equal, this just keeps
      // the logic colocated and obvious).
      const nextSend = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      await db.execute(`
        UPDATE review_requests
        SET emails_sent = 1,
            last_sent_at = NOW(),
            next_send_at = ?
        WHERE order_id = ? AND book_id = ?
      `, [nextSend, orderId, bookId]);

      await db.execute(`
        INSERT INTO sent_emails (to_email, subject, html, status, type, created_at)
        VALUES (?, ?, ?, 'sent', 'ReviewRequest', NOW())
      `, [toEmail, subject, html]).catch(() => {});

      console.log(`[ReviewRequests] Sent immediate email 1/4 to ${toEmail} for book ${bookId}`);
    } catch (err) {
      console.error(`[ReviewRequests] Immediate send failed for ${toEmail}:`, err.message);

      await db.execute(`
        INSERT INTO sent_emails (to_email, subject, html, status, error, type, created_at)
        VALUES (?, ?, ?, 'failed', ?, 'ReviewRequest', NOW())
      `, [toEmail, subject, html, err.message]).catch(() => {});
      // Don't throw — next_send_at stays at its inserted value (day 5),
      // so if this immediate send fails, the cron will catch it up later
      // rather than the customer never hearing from us at all.
    }
  }

  // === CREATE PAYMENT INTENT — GERMANY ONLY ===

  router.post('/create-payment-intent', requireAuth, async (req, res) => {
    //console.log('Stripe secret key prefix:', process.env.STRIPE_SECRET_KEY.slice(0, 12));

    /*console.log(
      '[HIT create-payment-intent]',
      'port=',
      process.env.PORT,
      'pid=',
      process.pid,
      'hasDebugHeader=',
      req.headers['x-debug-from']
    );*/

    const sk = process.env.STRIPE_SECRET_KEY || '';
    const skPrefix = sk ? sk.slice(0, 12) : 'MISSING';

    try {
      // Identify which Stripe account THIS server key belongs to
      const acct = await stripe.accounts.retrieve();

      //console.log('[Stripe DEBUG] acct:', acct.id, 'skPrefix:', skPrefix);

      //const { items, totalPrice, currency = 'eur' } = req.body;

      const {
        items,
        totalPrice,
        currency = 'eur',
        // ✅ ADD THESE
        shipping_provider,
        shipping_service,
      } = req.body;


      if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });
      const amount = Math.round(totalPrice * 100);
      if (amount < 50) return res.status(400).json({ error: 'Minimum €0.50' });

      for (const i of items) {
        const [[row]] = await db.execute('SELECT stock FROM books WHERE id = ?', [i.bookId]);
        if (!row || row.stock < i.quantity) {
          return res.status(409).json({ error: `Only ${row?.stock ?? 0} left for book ${i.bookId}` });
        }
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'eur',
        //automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        automatic_payment_methods: { enabled: true, allow_redirects: 'always' },
        metadata: {
          userId: req.user?.id || 'guest',
          cart: JSON.stringify(items.map(i => ({ id: i.bookId, qty: i.quantity }))),
          // ✅ PERSIST SHIPPING FOR PAYPAL
          shipping_provider: shipping_provider || '',
          shipping_service: shipping_service || '',
        },
      });

      return res.json({
        clientSecret: paymentIntent.client_secret,
        // TEMP DEBUG — remove after fix
        debug: {
          stripeAccount: acct.id,
          skPrefix,
          nodeEnv: process.env.NODE_ENV || null,
          port: process.env.PORT || null,
        },
      });
    } catch (err) {
      console.error('Stripe error:', err);
      return res.status(500).json({ error: err.message });
    }
  });


  // === MY ORDERS (enriched for shipping/tracking) ===
  router.get('/my-orders', requireAuth, async (req, res) => {
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


      // ===== ENRICH ORDER ITEMS WITH BOOK TITLES (ADMIN DASHBOARD) =====// ===== ENRICH ORDER ITEMS WITH BOOK TITLES all bookIds from all orders
      const bookIds = [
        ...new Set(
          orders
            .flatMap(o => Array.isArray(o.order_items) ? o.order_items : [])
            .map(it => Number(it.bookId))
            .filter(Boolean)
        )
      ];

      // 2. Load book titles once
      if (bookIds.length > 0) {
        const placeholders = bookIds.map(() => '?').join(',');
        const [books] = await db.execute(
          `SELECT id, title_en, title_de, price FROM books WHERE id IN (${placeholders})`,
          bookIds
        );

        const bookMap = new Map(books.map(b => [b.id, b]));

        // 3. Attach title + price to each order item
        orders.forEach(order => {
          order.order_items = order.order_items.map(item => {
            const book = bookMap.get(Number(item.bookId));
            return {
              ...item,
              quantity: Number(item.quantity || 1),
              title_en: book?.title_en || 'Unknown book',
              title_de: book?.title_de || 'Unbekanntes Buch',
              price: Number(book?.price || 0),
            };
          });
        });
      }


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
      wallet_used,
      discount_code,
      discount_amount,

      // NEW — shipping metadata coming from CheckoutPage
      shipping_selected_rate_id,
      shipping_amount_eur,
      shipping_provider,
      shipping_service,
    } = req.body;

    const userId = req.user?.id || null;

    const safeWalletUse = Math.max(0, Number(wallet_used || 0));

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
        shippo_rate_id,

        coupon_code,
        coupon_discount,
        wallet_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          0,

          Number(shipping_amount_eur || 0),
          shipping_provider || null,
          shipping_service || null,
          shipping_selected_rate_id || null,

          discount_code || null,
          Number(discount_amount || 0),
          Number(wallet_used || 0)
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
        const safeWalletUse = Math.max(0, Number(wallet_used || 0));

        // ✅ 3.5 Deduct from wallet
        //if (wallet_used && wallet_used > 0 && userId) {
        if (safeWalletUse > 0 && userId) {

          // Lock the user row to avoid race conditions (transaction-safe)
          await conn.execute(`SELECT id FROM users WHERE id = ? FOR UPDATE`, [userId]);


          // Compute current balance from transactions
          const [[balRow]] = await conn.query(`
            SELECT
            COALESCE(SUM(CASE WHEN type='CREDIT' THEN amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN type='DEBIT'  THEN amount ELSE 0 END), 0)
            AS balance
            FROM wallet_transactions
            WHERE user_id = ?
          `, [userId]);

          const currentBalance = Number(balRow?.balance || 0);


          if (safeWalletUse > currentBalance + 1e-9) {
            throw new Error(`Insufficient wallet balance (have €${currentBalance.toFixed(2)})`);
          }

          // 1. Reduce balance safely
          /*await conn.execute(`
            UPDATE user_wallets
            SET balance = balance - ?
            WHERE user_id = ? AND balance >= ?
          `, [safeWalletUse, userId, safeWalletUse]);*/

          // 2. Store transaction
          await conn.execute(`
            INSERT INTO wallet_transactions (user_id, amount, type, reason)
            VALUES (?, ?, 'DEBIT', ?)
          `, [userId, safeWalletUse, 'Used in order #' + orderId]);
        }

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

            shipping_provider: shipping_provider,   // e.g. "PICKUP"
            shipping_service: shipping_service,     // e.g. "Click & Collect"

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
            created_at: new Date(),
            status: isPaid ? 'processing' : 'pending',
            inventory_adjusted: 1,
            shipping_amount_eur: Number(shipping_amount_eur || 0),
            shipping_provider: shipping_provider || null,
            shipping_service: shipping_service || null,
            coupon_code: discount_code || null,
            coupon_discount: Number(discount_amount || 0),
            wallet_used: Number(wallet_used || 0),
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
  router.post('/finalize-from-payment-intent', requireAuth, async (req, res) => {
    const { paymentIntentId, shippingAddress, email } = req.body;
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });

    try {
      // 1) Get the PI from Stripe
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

      const shipping_provider =
        pi.metadata?.shipping_provider || null;

      const shipping_service =
        pi.metadata?.shipping_service || null;


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
           inventory_adjusted,

           shipping_provider,
           shipping_service,

           coupon_code,
           coupon_discount,
           wallet_used
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            JSON.stringify(orderItems),
            JSON.stringify(shippingAddress || {}),
            (pi.payment_method_types && pi.payment_method_types[0]) || 'paypal',
            JSON.stringify(paymentResult),
            Number(totalPrice.toFixed(2)),
            1,
            new Date(),
            'processing',
            0,

            shipping_provider,
            shipping_service,

            null, // coupon not available via webhook path
            0,
            0,
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

  // === ADMIN: CREATE DPD LABEL FOR AN ORDER (manual packing workflow) ===
  router.post('/:id/create-dpd-label', async (req, res) => {
    //console.log('[ROUTE REGISTERED]', req.originalUrl);
    try {
      // Admin guard (adjust if your auth middleware uses different fields)
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const orderId = Number(req.params.id);
      if (!orderId) return res.status(400).json({ error: 'Invalid order id' });

      // 1) Load order
      const [[order]] = await db.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
      if (!order) return res.status(404).json({ error: 'Order not found' });

      // 2) Safety guards
      if (order.tracking_number || order.label_url) {
        return res.status(409).json({ error: 'Label already created for this order' });
      }


      // Allow NULL (legacy orders), block only explicit non‑DPD providers
      const provider = (order.shipping_provider || '').toUpperCase();

      if (provider && !provider.includes('DPD')) {
        return res.status(400).json({ error: 'Order is not a DPD shipment' });
      }

      // Parse needed fields
      const shippingAddress = typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : (order.shipping_address || {});

      const orderItems = typeof order.order_items === 'string'
        ? JSON.parse(order.order_items)
        : (order.order_items || []);

      // 3) Compute total weight (grams) - fallback 500g each
      const itemIds = orderItems.map(i => Number(i.bookId)).filter(Boolean);
      const weights = new Map();
      if (itemIds.length) {
        const placeholders = itemIds.map(() => '?').join(',');
        const [rows] = await db.execute(
          `SELECT id, weight_grams FROM books WHERE id IN (${placeholders})`,
          itemIds
        );
        rows.forEach(r => weights.set(Number(r.id), Number(r.weight_grams || 0)));
      }

      const totalWeightGrams = orderItems.reduce((sum, it) => {
        const w = weights.get(Number(it.bookId)) || 0;
        const qty = Number(it.quantity || 1);
        return sum + (w > 0 ? w : 500) * qty;
      }, 0);

      // 4) Call DPD Cloud (setOrder) — create real shipment + label
      // NOTE: payload schema may differ slightly depending on your DPD Cloud doc,
      // so keep this structure consistent with what DPD expects in your integration.
      const axios = require('axios');

      const dpdPayload = {
        Request: {
          Version: 100,
          Language: 'de_DE',

          PartnerCredentials: {
            Name: 'DPD Cloud Service Alpha2',
            Token: '33879594E70436D58685',
            //Token: process.env.DPD_PARTNER_TOKEN,
          },

          UserCredentials: {
            CloudUserID: '9687108',
            //CloudUserID: process.env.DPD_CLOUD_USER_ID,
            Token: '635384C4734717235724',
            //Token: process.env.DPD_USER_TOKEN,
          },

          Order: {
            OrderAction: 'create',

            OrderGeneralData: {
              OrderType: 'shipment',
            },

            Sender: {
              Name: 'EnglischBuecher',
              Street: 'Im Schwalg 60',
              City: 'Bingen',
              ZipCode: '55411',
              Country: 'DE',
            },

            Receiver: {
              Name:
                `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() ||
                'Customer',
              Street: shippingAddress.address,
              City: shippingAddress.city,
              ZipCode: shippingAddress.postalCode,
              Country: shippingAddress.country || 'DE',
            },

            Parcels: [
              {
                Weight: Math.max(1, totalWeightGrams / 1000),
              },
            ],

            ProductAndServiceData: {
              Product: 'CL',
              OrderType: 'CL',
              B2C: true,
            },
          },
        },
      };


      /*console.log(
        '[DPD RAW PAYLOAD]',
        JSON.stringify(dpdPayload, null, 2)
      );*/


      const { data } = await axios.post(
        'https://cloud.dpd.com/api/v1/createShipment',
        JSON.stringify(dpdPayload),
        {
          headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept': 'application/json',
            'Content-Encoding': 'identity',   // ✅ THIS IS CRITICAL
          },
          decompress: false,                  // ✅ disable gzip handling
          maxBodyLength: Infinity,
          timeout: 20000,
        }
      );

      // 5) Extract label + tracking from response
      // Your DPD response fields may differ. Adjust keys after first real response.
      const trackingNumber =
        data?.orderResult?.parcels?.[0]?.parcelNumber ||
        data?.orderResult?.trackingNumber ||
        null;

      const labelUrl =
        data?.orderResult?.labelUrl ||
        data?.orderResult?.labelPdfUrl ||
        null;

      const trackingUrl =
        trackingNumber ? `https://tracking.dpd.de/status/en_US/parcel/${trackingNumber}` : null;

      if (!trackingNumber) {
        return res.status(502).json({ error: 'DPD did not return tracking number', dpd: data });
      }

      // 6) Persist on order
      await db.execute(
        `UPDATE orders
       SET tracking_number = ?,
           tracking_url = ?,
           label_url = ?,
           status = 'shipped'
       WHERE id = ?`,
        [trackingNumber, trackingUrl, labelUrl, orderId]
      );

      return res.json({
        success: true,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
        label_url: labelUrl,
      });
    } catch (err) {
      console.error('[create-dpd-label] error:', err?.response?.data || err?.message || err);
      //return res.status(500).json({ error: 'dpd_label_failed' });
      return res.status(500).json({ error: err });
    }
  });


  // === ADMIN: UPDATE ORDER (manual shipping / status) ===
  router.put('/:id', async (req, res) => {
    try {
      // Admin guard
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const orderId = Number(req.params.id);
      if (!orderId) {
        return res.status(400).json({ error: 'Invalid order id' });
      }

      const {
        status,
        shipping_amount_eur,
        shipping_provider,
        shipping_service,
        tracking_number,
        tracking_url,
      } = req.body;

      await db.execute(
        `UPDATE orders
       SET
         status = ?,
         shipping_amount_eur = ?,
         shipping_provider = ?,
         shipping_service = ?,
         tracking_number = ?,
         tracking_url = ?
       WHERE id = ?`,
        [
          status || 'processing',
          Number(shipping_amount_eur || 0),
          shipping_provider || null,
          shipping_service || null,
          tracking_number || null,
          tracking_url || null,
          orderId,
        ]
      );

      // Schedule review-request emails the first time this order is marked delivered.
      // Safe to call even if already scheduled — INSERT IGNORE prevents duplicates.
      if (status === 'delivered') {
        await scheduleReviewRequests(orderId);
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('ADMIN UPDATE ORDER FAILED:', err);
      return res.status(500).json({ error: 'Update order failed' });
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