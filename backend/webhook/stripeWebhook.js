
// backend/webhook/stripeWebhook.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

module.exports = async (req, res, db) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const piId = pi.id;
    const orderIdMeta = Number(pi?.metadata?.order_id);

    try {
      // Try to find the order by:
      // 1) metadata.order_id
      // 2) fallback: payment_result.id == piId (if order already created)
      let orderRow;
      if (orderIdMeta) {
        const [[row]] = await db.execute('SELECT id, inventory_adjusted FROM orders WHERE id = ?', [orderIdMeta]);
        orderRow = row;
      }
      if (!orderRow) {
        const [[row2]] = await db.execute(
          'SELECT id, inventory_adjusted FROM orders WHERE JSON_EXTRACT(payment_result, "$.id") = ? ORDER BY id DESC LIMIT 1',
          [piId]
        );
        orderRow = row2;
      }

      if (orderRow && Number(orderRow.inventory_adjusted) === 1) {
        // Inventory already adjusted in /api/orders → just mark paid/status if needed
        await db.execute(
          `UPDATE orders
             SET is_paid = 1,
                 paid_at = NOW(),
                 status = 'processing'
           WHERE id = ?`,
          [orderRow.id]
        );
        //console.log(`Webhook: order ${orderRow.id} marked paid (inventory already adjusted).`);
      } else if (orderRow) {
        // (Rare) If /api/orders failed before stock adjust, you could choose to adjust here.
        // In your current design, /api/orders is authoritative, so do NOT adjust here:
        await db.execute(
          `UPDATE orders
             SET is_paid = 1,
                 paid_at = NOW(),
                 status = 'processing'
           WHERE id = ?`,
          [orderRow.id]
        );
        //console.log(`Webhook: order ${orderRow.id} marked paid (no inventory change here).`);
      } else {
        // No order found yet — fine. /api/orders will adjust stock when it runs.
        //console.log(`Webhook: no order mapped to PI ${piId}; waiting for /api/orders.`);
      }
    } catch (err) {
      console.error('Webhook handling error:', err.message);
      // Always 200 to Stripe to avoid retries; log for ops triage
    }

    return res.status(200).json({ ok: true });
  }

  // Acknowledge other events
   return res.status(200).json({ received: true });
}