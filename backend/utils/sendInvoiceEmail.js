// backend/utils/sendInvoiceEmail.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { logEmail } = require('./emailLogger');
const { buildEmail, SENDER_NAME } = require('./emailTemplate');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: parseInt(process.env.SMTP_PORT) !== 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

module.exports = async (order, user, lang = 'de') => {
  let subject = '';
  let htmlBody = null;

  try {
    const invoicesDir = path.join(__dirname, '..', 'invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

    const total      = Number(order.total) || 0;
    const shippingAmt = Number(order.shipping_amount_eur || 0);
    const couponAmt   = Number(order.coupon_discount || 0);
    const walletAmt   = Number(order.wallet_used || 0);
    const items       = Array.isArray(order.order_items) ? order.order_items : [];

    const filename = `invoice_${order.id}.pdf`;
    const filepath = path.join(invoicesDir, filename);
    const logoPath = path.join(__dirname, '..', 'public', 'assets', 'logo.png');
    const hasLogo  = fs.existsSync(logoPath);

    const safeDate = order.created_at
      ? new Date(order.created_at).toLocaleDateString(
          lang === 'de' ? 'de-DE' : 'en-GB',
          { day: '2-digit', month: 'long', year: 'numeric' }
        )
      : (lang === 'de' ? 'Unbekanntes Datum' : 'Unknown date');

    const addr = order.shipping_address || {};

    // ─────────────────────────────────────────────────────────
    // PDF — clean branded layout
    // ─────────────────────────────────────────────────────────
    const doc    = new PDFDocument({ margin: 0, size: 'A4' });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    const W = 595.28; // A4 width pts
    const PURPLE = '#7c3aed';
    const DARK   = '#1a1a2e';
    const MUTED  = '#6b7280';
    const LIGHT  = '#f5f3ff';
    const WHITE  = '#ffffff';

    // ── Header bar ──
    doc.rect(0, 0, W, 110).fill(PURPLE);

    if (hasLogo) {
      doc.image(logoPath, 40, 22, { height: 48 });
    }

    doc.fillColor(WHITE)
       .fontSize(22).font('Helvetica-Bold')
       .text(lang === 'de' ? 'Rechnung' : 'Invoice', 0, 28, { align: 'right', width: W - 40 });

    doc.fillColor('rgba(255,255,255,0.75)')
       .fontSize(10).font('Helvetica')
       .text(`#${order.id}  ·  ${safeDate}`, 0, 58, { align: 'right', width: W - 40 });

    // ── Two-column info block ──
    let y = 130;

    // Left: customer + address
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
       .text((lang === 'de' ? 'RECHNUNG AN' : 'BILL TO'), 40, y);
    y += 14;
    doc.font('Helvetica').fillColor(DARK).fontSize(10)
       .text(`${user.first_name || ''} ${user.last_name || ''}`.trim(), 40, y);
    y += 14;
    if (addr.address) { doc.text(addr.address, 40, y); y += 14; }
    if (addr.postalCode || addr.city) { doc.text(`${addr.postalCode || ''} ${addr.city || ''}`.trim(), 40, y); y += 14; }
    if (addr.country) { doc.text(addr.country, 40, y); y += 14; }
    doc.fillColor(MUTED).text(user.email || '', 40, y); y += 14;

    // Right: order meta
    const metaX = 340;
    let metaY = 130;
    const metaLine = (label, val) => {
      doc.font('Helvetica-Bold').fillColor(MUTED).fontSize(9).text(label, metaX, metaY);
      doc.font('Helvetica').fillColor(DARK).fontSize(10).text(val, metaX + 110, metaY, { width: 200 - 40 });
      metaY += 16;
    };
    metaLine(lang === 'de' ? 'BESTELLUNG' : 'ORDER', `#${order.id}`);
    metaLine(lang === 'de' ? 'DATUM' : 'DATE', safeDate);
    metaLine(lang === 'de' ? 'STATUS' : 'STATUS', (order.status || '').toUpperCase());
    metaLine(lang === 'de' ? 'ZAHLUNG' : 'PAYMENT', order.is_paid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Ausstehend' : 'Pending'));

    // ── Divider ──
    y = Math.max(y, metaY) + 16;
    doc.moveTo(40, y).lineTo(W - 40, y).strokeColor('#ede9fe').lineWidth(1).stroke();
    y += 18;

    // ── Table header ──
    doc.rect(40, y, W - 80, 26).fill(LIGHT);
    doc.fillColor(PURPLE).fontSize(9).font('Helvetica-Bold');
    doc.text(lang === 'de' ? 'ARTIKEL' : 'ITEM',     50,  y + 8);
    doc.text(lang === 'de' ? 'MENGE' : 'QTY',       370, y + 8, { width: 50, align: 'center' });
    doc.text(lang === 'de' ? 'PREIS' : 'PRICE',      430, y + 8, { width: 60, align: 'right' });
    doc.text(lang === 'de' ? 'GESAMT' : 'TOTAL',     490, y + 8, { width: 60, align: 'right' });
    y += 34;

    // ── Table rows ──
    items.forEach((item, idx) => {
      const price     = Number(item.price || 0);
      const qty       = Number(item.quantity || 1);
      const lineTotal = price * qty;
      const rowH      = 28;

      if (idx % 2 === 0) {
        doc.rect(40, y - 4, W - 80, rowH).fill('#faf5ff');
      }

      doc.fillColor(DARK).font('Helvetica').fontSize(10)
         .text(item.title_en || 'Unknown Book', 50, y, { width: 310 });
      doc.text(qty.toString(),           370, y, { width: 50, align: 'center' });
      doc.text(`€${price.toFixed(2)}`,  430, y, { width: 60, align: 'right' });
      doc.text(`€${lineTotal.toFixed(2)}`, 490, y, { width: 60, align: 'right' });

      if (item.author) {
        doc.fillColor(MUTED).fontSize(8).text(item.author, 50, y + 12, { width: 310 });
      }

      y += rowH;
    });

    // ── Totals ──
    y += 8;
    doc.moveTo(40, y).lineTo(W - 40, y).strokeColor('#ede9fe').lineWidth(1).stroke();
    y += 14;

    const totalLine = (label, val, bold = false, color = DARK) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .fillColor(color).fontSize(bold ? 12 : 10);
      doc.text(label, 350, y, { width: 130, align: 'right' });
      doc.text(val,   490, y, { width: 60,  align: 'right' });
      y += bold ? 20 : 17;
    };

    const itemsSubtotal = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0);
    totalLine(lang === 'de' ? 'Zwischensumme' : 'Subtotal', `€${itemsSubtotal.toFixed(2)}`);
    if (shippingAmt > 0) totalLine(lang === 'de' ? 'Versand' : 'Shipping', `€${shippingAmt.toFixed(2)}`);
    if (couponAmt > 0)   totalLine(`${lang === 'de' ? 'Gutschein' : 'Coupon'}${order.coupon_code ? ` (${order.coupon_code})` : ''}`, `-€${couponAmt.toFixed(2)}`, false, '#16a34a');
    if (walletAmt > 0)   totalLine(lang === 'de' ? 'Guthaben' : 'Wallet credit', `-€${walletAmt.toFixed(2)}`, false, PURPLE);

    y += 4;
    doc.moveTo(350, y).lineTo(W - 40, y).strokeColor(PURPLE).lineWidth(1.5).stroke();
    y += 10;
    totalLine(lang === 'de' ? 'Gesamtbetrag' : 'Grand Total', `€${total.toFixed(2)}`, true, PURPLE);

    // ── Footer strip ──
    const pageH = 841.89; // A4 height pts
    doc.rect(0, pageH - 50, W, 50).fill('#1a1a2e');
    doc.fillColor(WHITE).fontSize(8).font('Helvetica')
       .text(
         `${SENDER_NAME}  ·  englischbuecher.de  ·  ${lang === 'de' ? 'Vielen Dank für Ihren Einkauf!' : 'Thank you for your purchase!'}`,
         0, pageH - 30, { align: 'center', width: W }
       );

    doc.end();
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    // ─────────────────────────────────────────────────────────
    // EMAIL — branded buildEmail template
    // ─────────────────────────────────────────────────────────
    subject = lang === 'de'
      ? `Deine Rechnung #${order.id} — ${SENDER_NAME}`
      : `Your Invoice #${order.id} — ${SENDER_NAME}`;

    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://englischbuecher.de';

    const emailItemRows = items.map(item => {
      const price     = Number(item.price || 0);
      const qty       = Number(item.quantity || 1);
      const lineTotal = (price * qty).toFixed(2);
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#333;">
            <div style="font-weight:600;color:#1a1a2e;">${item.title_en || 'Unknown Book'}</div>
            ${item.author ? `<div style="font-size:12px;color:#9ca3af;margin-top:2px;">${item.author}</div>` : ''}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#333;">${qty}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#333;">€${price.toFixed(2)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#1a1a2e;">€${lineTotal}</td>
        </tr>`;
    }).join('');

    const itemsSubtotalEmail = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0);

    const extraRows = [
      `<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;">${lang === 'de' ? 'Zwischensumme' : 'Subtotal'}</td><td style="padding:8px 12px;text-align:right;color:#6b7280;">€${itemsSubtotalEmail.toFixed(2)}</td></tr>`,
      shippingAmt > 0 ? `<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;">${lang === 'de' ? 'Versand' : 'Shipping'}</td><td style="padding:8px 12px;text-align:right;color:#6b7280;">€${shippingAmt.toFixed(2)}</td></tr>` : '',
      couponAmt > 0   ? `<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#16a34a;">${lang === 'de' ? 'Gutschein' : 'Coupon'}${order.coupon_code ? ` <span style="background:#dcfce7;color:#15803d;padding:1px 8px;border-radius:6px;font-size:11px;font-weight:700;">${order.coupon_code}</span>` : ''}</td><td style="padding:8px 12px;text-align:right;color:#16a34a;">−€${couponAmt.toFixed(2)}</td></tr>` : '',
      walletAmt > 0   ? `<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#7c3aed;">${lang === 'de' ? 'Guthaben verwendet' : 'Wallet credit'}</td><td style="padding:8px 12px;text-align:right;color:#7c3aed;">−€${walletAmt.toFixed(2)}</td></tr>` : '',
      `<tr><td colspan="3" style="padding:12px;text-align:right;font-weight:700;font-size:16px;color:#1a1a2e;border-top:2px solid #ede9fe;">${lang === 'de' ? 'Gesamtbetrag' : 'Grand Total'}</td><td style="padding:12px;text-align:right;font-weight:800;font-size:18px;color:#7c3aed;border-top:2px solid #ede9fe;">€${total.toFixed(2)}</td></tr>`,
    ].join('');

    const bodyHtml = `
      <p class="greeting">${lang === 'de' ? `Hallo ${user.first_name},` : `Hi ${user.first_name},`}</p>
      <p class="text">
        ${lang === 'de'
          ? `Deine Bestellung <strong>#${order.id}</strong> vom <strong>${safeDate}</strong> wurde erfolgreich abgeschlossen. Im Anhang findest du deine Rechnung als PDF.`
          : `Your order <strong>#${order.id}</strong> placed on <strong>${safeDate}</strong> has been successfully completed. Your invoice is attached as a PDF.`}
      </p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <thead>
          <tr>
            <th style="background:#f5f3ff;color:#5e42d6;font-weight:700;padding:10px 12px;text-align:left;">${lang === 'de' ? 'Artikel' : 'Item'}</th>
            <th style="background:#f5f3ff;color:#5e42d6;font-weight:700;padding:10px 12px;text-align:center;">${lang === 'de' ? 'Menge' : 'Qty'}</th>
            <th style="background:#f5f3ff;color:#5e42d6;font-weight:700;padding:10px 12px;text-align:right;">${lang === 'de' ? 'Preis' : 'Price'}</th>
            <th style="background:#f5f3ff;color:#5e42d6;font-weight:700;padding:10px 12px;text-align:right;">${lang === 'de' ? 'Gesamt' : 'Total'}</th>
          </tr>
        </thead>
        <tbody>
          ${emailItemRows}
          ${extraRows}
        </tbody>
      </table>

      ${order.shipping_address ? `
      <div style="background:#faf5ff;border-left:4px solid #7c3aed;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;font-size:13px;color:#374151;">
        <strong style="color:#1a1a2e;display:block;margin-bottom:6px;">${lang === 'de' ? 'Lieferadresse' : 'Delivery address'}</strong>
        ${addr.address || ''}, ${addr.postalCode || ''} ${addr.city || ''}, ${addr.country || ''}
      </div>` : ''}

      <div class="btn-wrap">
        <a href="${FRONTEND_URL}/profile#orders" class="btn">
          ${lang === 'de' ? 'Meine Bestellungen ansehen' : 'View My Orders'}
        </a>
      </div>

      <div class="regards">
        ${lang === 'de' ? 'Vielen Dank und viel Freude beim Lesen!' : 'Thank you and happy reading!'}
        <div class="regards-team">${SENDER_NAME} Team</div>
      </div>
    `;

    htmlBody = buildEmail({
      lang,
      title: subject,
      headerTitle: lang === 'de' ? 'Vielen Dank für deinen Einkauf!' : 'Thank you for your purchase!',
      headerEmoji: '🎉',
      bodyHtml,
    });

    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject,
      html: htmlBody,
      attachments: [
        { filename, path: filepath, contentType: 'application/pdf' },
      ],
    });

    await logEmail({ to: user.email, subject, html: htmlBody, status: 'sent', type: 'Invoice' });

  } catch (err) {
    console.error('INVOICE EMAIL ERROR:', err);
    await logEmail({
      to: user?.email || null,
      subject: subject || `Invoice #${order?.id}`,
      html: htmlBody,
      status: 'failed',
      error: err.message,
      type: 'Invoice',
    });
  }
};