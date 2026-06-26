// backend/utils/emailTemplate.js
// Shared branded wrapper for all englischbuecher.de emails

const emailFooter = require('./emailFooter');

const SENDER_NAME = 'EnglischBücher';

/**
 * Wraps content HTML in the standard branded email shell.
 * @param {object} opts
 * @param {string} opts.lang        - 'de' | 'en'
 * @param {string} opts.title       - Email <title> tag
 * @param {string} opts.headerTitle - Bold white text shown in the purple header
 * @param {string} opts.headerEmoji - Optional emoji after headerTitle
 * @param {string} opts.bodyHtml    - Inner HTML for the white content area
 */
function buildEmail({ lang = 'de', title, headerTitle, headerEmoji = '', bodyHtml }) {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://englischbuecher.de';
  const logoUrl = `${FRONTEND_URL}/assets/logo.png`;
  const storeName = SENDER_NAME;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f8; color: #1a1a2e; line-height: 1.6; }
    .wrapper { max-width: 620px; margin: 30px auto; }
    .header { background: linear-gradient(135deg, #1f1633 0%, #3b1d6e 50%, #5e42d6 100%); padding: 36px 32px 32px; border-radius: 16px 16px 0 0; text-align: center; }
    .header-logo { height: 52px; display: block; margin: 0 auto 14px; }
    .header-brand { font-size: 13px; font-weight: 700; letter-spacing: 0.1em; color: #c4b5fd; text-transform: uppercase; margin-bottom: 10px; }
    .header-title { color: #ffffff; font-size: 26px; font-weight: 800; margin: 0; text-shadow: 0 2px 10px rgba(0,0,0,0.3); }
    .body { background: #ffffff; padding: 36px 36px 28px; border: 1px solid #ede9fe; border-top: none; }
    .greeting { font-size: 17px; font-weight: 600; color: #1a1a2e; margin-bottom: 14px; }
    .text { font-size: 15px; color: #444; margin-bottom: 18px; }
    .btn-wrap { text-align: center; margin: 28px 0 20px; }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed, #5e42d6);
      color: #ffffff !important;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 36px;
      text-decoration: none;
      border-radius: 999px;
      box-shadow: 0 6px 20px rgba(124, 58, 237, 0.35);
      letter-spacing: 0.02em;
    }
    .info-box { background: #f5f3ff; border-left: 4px solid #7c3aed; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 14px; color: #333; }
    .info-box strong { color: #1a1a2e; }
    .highlight-box { background: #faf5ff; border-radius: 12px; padding: 18px 20px; text-align: center; margin: 20px 0; }
    .highlight-label { font-size: 13px; color: #888; margin-bottom: 6px; }
    .highlight-value { font-size: 24px; font-weight: 800; color: #7c3aed; }
    .divider { border: none; border-top: 1px solid #ede9fe; margin: 24px 0; }
    .note { font-size: 13px; color: #9ca3af; text-align: center; margin-top: 16px; }
    .regards { font-size: 15px; color: #333; margin-top: 28px; }
    .regards-team { font-weight: 700; color: #7c3aed; margin-top: 4px; }
    table.order-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
    table.order-table th { background: #f5f3ff; color: #5e42d6; font-weight: 700; padding: 10px 12px; text-align: left; }
    table.order-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; color: #333; vertical-align: top; }
    table.order-table tr:last-child td { border-bottom: none; }
    .total-row { font-size: 16px; font-weight: 700; color: #1a1a2e; }
    .book-thumb { width: 80px; height: auto; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); display: block; margin: 0 auto 12px; }
    @media (max-width: 480px) {
      .wrapper { margin: 10px; }
      .header { padding: 28px 20px 24px; border-radius: 12px 12px 0 0; }
      .body { padding: 28px 20px 20px; }
      .header-title { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- HEADER -->
    <div class="header">
      <img src="${logoUrl}" alt="${storeName}" class="header-logo" />
      <div class="header-title">${headerTitle}${headerEmoji ? ' ' + headerEmoji : ''}</div>
    </div>

    <!-- BODY -->
    <div class="body">
      ${bodyHtml}
    </div>

    <!-- FOOTER -->
    ${emailFooter(lang)}
  </div>
</body>
</html>`;
}

module.exports = { buildEmail, SENDER_NAME };