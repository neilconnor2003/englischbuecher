// backend/utils/sendWalletCreditEmail.js
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

module.exports = async (user, amount, reason = 'Admin credit', balance = null) => {
  let subject = '';
  let htmlBody = null;
  const lang = user.language || 'de';
  const isDe = lang === 'de';

  try {
    subject = isDe
      ? `€${amount.toFixed(2)} wurde deinem Guthaben gutgeschrieben${balance !== null ? ` (Neues Guthaben: €${balance.toFixed(2)})` : ''}`
      : `€${amount.toFixed(2)} added to your wallet${balance !== null ? ` (New balance: €${balance.toFixed(2)})` : ''}`;

    const greeting = isDe ? `Hallo ${user.first_name || ''},` : `Hi ${user.first_name || ''},`;

    const bodyHtml = `
      <p class="greeting">${greeting}</p>
      <p class="text">
        ${isDe
          ? `Dein Guthaben wurde um <strong style="color:#7c3aed;">€${amount.toFixed(2)}</strong> aufgeladen.`
          : `Your wallet has been credited with <strong style="color:#7c3aed;">€${amount.toFixed(2)}</strong>.`}
      </p>

      ${balance !== null ? `
      <div class="highlight-box">
        <div class="highlight-label">${isDe ? 'Neues Guthaben' : 'New Balance'}</div>
        <div class="highlight-value">€${balance.toFixed(2)}</div>
      </div>` : ''}

      <div class="info-box">
        <strong>${isDe ? 'Grund' : 'Reason'}:</strong> ${reason}
      </div>

      <p class="text">
        ${isDe
          ? 'Du kannst dieses Guthaben beim nächsten Checkout auf <strong>englischbuecher.de</strong> verwenden.'
          : 'You can use this balance during checkout on <strong>englischbuecher.de</strong>.'}
      </p>

      <div class="btn-wrap">
        <a href="${process.env.FRONTEND_URL || 'https://englischbuecher.de'}/books" class="btn">
          ${isDe ? 'Jetzt stöbern' : 'Browse Books'}
        </a>
      </div>

      <div class="regards">
        ${isDe ? 'Viele Grüße' : 'Best regards'},<br>
        <div class="regards-team">${isDe ? `Dein ${SENDER_NAME} Team` : `Your ${SENDER_NAME} Team`}</div>
      </div>
    `;

    htmlBody = buildEmail({
      lang,
      title: subject,
      headerTitle: isDe ? 'Guthaben aufgeladen!' : 'Wallet Credited!',
      headerEmoji: '💜',
      bodyHtml,
    });

    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject,
      html: htmlBody,
    });

    await logEmail({ to: user.email, subject, html: htmlBody, status: 'sent', type: 'WalletCredit' });

  } catch (err) {
    console.error('WALLET EMAIL ERROR:', err);
    await logEmail({
      to: user?.email || null,
      subject: subject || 'Wallet email',
      html: htmlBody,
      status: 'failed',
      error: err.message,
      type: 'WalletCredit',
    });
  }
};