// backend/utils/sendInvoiceEmail.js
const emailFooter = require('./emailFooter');

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { logEmail } = require('./emailLogger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  //secure: false,
  secure: true,   // ✅ VERY IMPORTANT for 465 (SSL)
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

module.exports = async (order, user, lang = 'de') => {

  let subject = '';
  let htmlBody = null;

  try {
    const invoicesDir = path.join(__dirname, '..', 'invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

    const total = Number(order.total) || 0;
    const filename = `invoice_${order.id}.pdf`;
    const filepath = path.join(invoicesDir, filename);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filepath);
    stream.on('error', (err) => console.error('PDF ERROR:', err));
    doc.pipe(stream);

    // === LOGO ===
    const logoPath = path.join(__dirname, '..', 'public', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 30, { width: 80 });
    }

    // === HEADER ===
    doc.fontSize(24).font('Helvetica-Bold').text(
      lang === 'de' ? 'Ihre Bestellung' : 'Your Order',
      140, 50
    );
    doc.moveDown(2);

    // === ORDER INFO ===
    doc.fontSize(12).font('Helvetica');
    doc.text(`${lang === 'de' ? 'Bestellnummer' : 'Order ID'}: #${order.id}`);
    // Safe date — order.created_at may be a Date object, string, or undefined
    const safeDate = order.created_at
      ? new Date(order.created_at).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
      : (lang === 'de' ? 'Unbekanntes Datum' : 'Unknown date');
    doc.text(`${lang === 'de' ? 'Datum' : 'Date'}: ${safeDate}`);
    doc.text(`${lang === 'de' ? 'Status' : 'Status'}: ${order.status}`);
    doc.moveDown();

    // === CUSTOMER INFO ===
    doc.text(`${lang === 'de' ? 'Kunde' : 'Customer'}: ${user.first_name} ${user.last_name || ''}`);
    doc.text(`E-Mail: ${user.email}`);
    doc.moveDown();

    // === SHIPPING ADDRESS ===
    const addr = order.shipping_address || {};
    doc.text(lang === 'de' ? 'Lieferadresse:' : 'Shipping Address:');
    doc.text(`${addr.address || ''}`);
    doc.text(`${addr.postalCode || ''} ${addr.city || ''}`);
    doc.text(`${addr.country || ''}`);
    doc.moveDown();

    // === TABLE HEADER ===
    const tableTop = doc.y + 20;
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(lang === 'de' ? 'Artikel' : 'Item', 50, tableTop);
    doc.text(lang === 'de' ? 'Menge' : 'Qty', 350, tableTop);
    doc.text(lang === 'de' ? 'Preis' : 'Price', 420, tableTop);
    doc.text(lang === 'de' ? 'Gesamt' : 'Total', 480, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 30;
    const items = Array.isArray(order.order_items) ? order.order_items : [];

    items.forEach(item => {
      const itemTotal = (item.price || 0) * (item.quantity || 1);
      doc.font('Helvetica').fontSize(10);
      doc.text(item.title_en || 'Unknown Book', 50, y, { width: 280 });
      doc.text(item.quantity.toString(), 350, y);
      doc.text(`€${(item.price || 0).toFixed(2)}`, 420, y);
      doc.text(`€${itemTotal.toFixed(2)}`, 480, y);
      y += 25;
    });

    // === TOTALS SECTION ===
    doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();
    y += 25;
    doc.fontSize(11).font('Helvetica');

    const shippingAmt = Number(order.shipping_amount_eur || 0);
    const couponAmt = Number(order.coupon_discount || 0);
    const walletAmt = Number(order.wallet_used || 0);

    if (shippingAmt > 0) {
      doc.text(`${lang === 'de' ? 'Versand' : 'Shipping'}:`, 350, y);
      doc.text(`€${shippingAmt.toFixed(2)}`, 480, y);
      y += 20;
    }
    if (couponAmt > 0) {
      doc.text(`${lang === 'de' ? 'Gutschein' : 'Coupon'}${order.coupon_code ? ` (${order.coupon_code})` : ''}:`, 350, y);
      doc.text(`-€${couponAmt.toFixed(2)}`, 480, y);
      y += 20;
    }
    if (walletAmt > 0) {
      doc.text(`${lang === 'de' ? 'Guthaben' : 'Wallet credit'}:`, 350, y);
      doc.text(`-€${walletAmt.toFixed(2)}`, 480, y);
      y += 20;
    }

    doc.moveTo(350, y + 5).lineTo(550, y + 5).stroke();
    y += 15;
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text(`${lang === 'de' ? 'Gesamt' : 'Total'}: €${total.toFixed(2)}`, 350, y);

    doc.end();

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    // === EMAIL ===
    subject = lang === 'de' ? `Ihre Rechnung #${order.id}` : `Your Invoice #${order.id}`;
    const greeting = lang === 'de' ? `Hallo ${user.first_name},` : `Hi ${user.first_name},`;


    htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
          ${fs.existsSync(logoPath) ? `<img src="cid:logo" style="width: 100px; display: block; margin: 0 auto 20px;" />` : ''}
          <h2 style="color: #4f46e5; text-align: center;">${lang === 'de' ? 'Vielen Dank für Ihren Einkauf!' : 'Thank you for your purchase!'}</h2>
          <p>${greeting}</p>
          <p>${lang === 'de' ? 'Ihre Bestellung' : 'Your order'} <strong>#${order.id}</strong> ${lang === 'de' ? 'wurde erfolgreich abgeschlossen.' : 'has been successfully completed.'}</p>
          <p>${lang === 'de' ? 'Im Anhang finden Sie Ihre Rechnung als PDF.' : 'Your invoice is attached as PDF.'}</p>
          <p>${lang === 'de' ? 'Mit freundlichen Grüßen' : 'Best regards'},<br><strong>Englisch Buecher Team</strong></p>

          ${emailFooter(lang)}
          
        </div>
    `;


    await transporter.sendMail({
      from: `"Englisch Buecher" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject,
      html: htmlBody,
      attachments: [
        { filename, path: filepath, contentType: 'application/pdf' },
        fs.existsSync(logoPath) ? {
          filename: 'logo.png',
          path: logoPath,
          cid: 'logo'
        } : null
      ].filter(Boolean)
    });


    await logEmail({
      to: user.email,
      subject,
      html: htmlBody,
      status: 'sent',
      type: 'Invoice'
    });


    //console.log(`Invoice #${order.id} sent to ${user.email} (${lang})`);
  } catch (err) {
    console.error('INVOICE EMAIL ERROR:', err);

    await logEmail({
      to: user?.email || null,
      subject: `Invoice #${order?.id}`,
      html: htmlBody,
      status: 'failed',
      error: err.message,
      type: 'Invoice'
    });

  }
};