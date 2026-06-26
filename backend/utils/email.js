// backend/utils/email.js
const nodemailer = require('nodemailer');
const juice = require('juice');
const { buildEmail, SENDER_NAME } = require('./emailTemplate');

async function sendWelcomeEmail(transporter, to, name, method, lang = 'de', verifyUrl = null) {
  const isGoogle = method === 'google';

  const CONTENT = {
    de: {
      store_name: SENDER_NAME,
      title_google: 'Willkommen bei EnglischBücher!',
      title_manual: 'Fast geschafft – bestätige deine E-Mail',
      greeting: `Hallo ${name},`,
      body_google: 'Dein Konto wurde erfolgreich mit Google erstellt. Tauche jetzt ein in die Welt englischer Bücher!',
      body_manual: 'Vielen Dank für deine Registrierung! Klicke unten, um deine E-Mail zu bestätigen und loszulegen.',
      button_google: 'Jetzt stöbern',
      button_manual: 'E-Mail bestätigen',
      info_login: 'Login',
      info_method: 'Methode',
      method_manual: 'Manuell',
      expiry: 'Der Link verfällt in 1 Stunde.',
      regards: 'Viele Grüße',
      team: `Dein ${SENDER_NAME} Team`,
    },
    en: {
      store_name: SENDER_NAME,
      title_google: 'Welcome to EnglischBücher!',
      title_manual: 'Almost there – verify your email',
      greeting: `Hello ${name},`,
      body_google: 'Your account was successfully created with Google. Start exploring English books now!',
      body_manual: 'Thanks for signing up! Click below to verify your email and get started.',
      button_google: 'Start Browsing',
      button_manual: 'Verify Email',
      info_login: 'Login',
      info_method: 'Method',
      method_manual: 'Manual',
      expiry: 'The link expires in 1 hour.',
      regards: 'Best regards',
      team: `Your ${SENDER_NAME} Team`,
    },
  };

  const t = CONTENT[lang] || CONTENT.de;
  const subject = isGoogle ? t.title_google : t.title_manual;
  const buttonText = isGoogle ? t.button_google : t.button_manual;
  const buttonLink = isGoogle
    ? `${process.env.FRONTEND_URL || 'https://englischbuecher.de'}/`
    : (verifyUrl || `${process.env.FRONTEND_URL || 'https://englischbuecher.de'}/login`);

  const bodyHtml = `
    <p class="greeting">${t.greeting}</p>
    <p class="text">${isGoogle ? t.body_google : t.body_manual}</p>
    ${!isGoogle ? `
    <div class="info-box">
      <strong>${t.info_login}:</strong> ${to}<br>
      <strong>${t.info_method}:</strong> ${t.method_manual}
    </div>` : ''}
    <div class="btn-wrap">
      <a href="${buttonLink}" class="btn">${buttonText}</a>
    </div>
    ${!isGoogle ? `<p class="note">${t.expiry}</p>` : ''}
    <div class="regards">
      ${t.regards},<br>
      <div class="regards-team">${t.team}</div>
    </div>
  `;

  const rawHtml = buildEmail({
    lang,
    title: subject,
    headerTitle: isGoogle ? t.title_google : t.title_manual,
    headerEmoji: '👋',
    bodyHtml,
  });

  const inlinedHtml = juice(rawHtml);

  try {
    await transporter.sendMail({
      from: `"${t.store_name}" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
      to,
      subject,
      html: inlinedHtml,
    });
    return { subject, html: inlinedHtml };
  } catch (err) {
    console.error('Welcome email failed:', err);
    err.emailMeta = { subject, html: inlinedHtml };
    throw err;
  }
}

async function sendPasswordResetEmail(transporter, to, name, resetUrl, lang = 'de') {
  const CONTENT = {
    de: {
      store_name: SENDER_NAME,
      subject: 'Passwort zurücksetzen',
      title: 'Passwort zurücksetzen',
      greeting: `Hallo ${name},`,
      body: 'Du hast angefordert, dein Passwort zurückzusetzen. Klicke unten, um ein neues Passwort zu setzen.',
      button: 'Neues Passwort setzen',
      expiry: 'Dieser Link verfällt in 15 Minuten.',
      note: 'Falls du das nicht warst – ignoriere diese E-Mail einfach.',
      regards: 'Viele Grüße',
      team: `Dein ${SENDER_NAME} Team`,
    },
    en: {
      store_name: SENDER_NAME,
      subject: 'Reset Your Password',
      title: 'Reset Your Password',
      greeting: `Hello ${name},`,
      body: 'You requested a password reset. Click below to set a new password.',
      button: 'Set New Password',
      expiry: 'This link expires in 15 minutes.',
      note: "If this wasn't you – just ignore this email.",
      regards: 'Best regards',
      team: `Your ${SENDER_NAME} Team`,
    },
  };

  const t = CONTENT[lang] || CONTENT.de;

  const bodyHtml = `
    <p class="greeting">${t.greeting}</p>
    <p class="text">${t.body}</p>
    <div class="btn-wrap">
      <a href="${resetUrl}" class="btn">${t.button}</a>
    </div>
    <p class="note">${t.expiry}</p>
    <hr class="divider">
    <p class="note">${t.note}</p>
    <div class="regards">
      ${t.regards},<br>
      <div class="regards-team">${t.team}</div>
    </div>
  `;

  const rawHtml = buildEmail({
    lang,
    title: t.subject,
    headerTitle: t.title,
    headerEmoji: '🔐',
    bodyHtml,
  });

  const inlinedHtml = juice(rawHtml);

  try {
    await transporter.sendMail({
      from: `"${t.store_name}" <${process.env.SMTP_USER}>`,
      to,
      subject: t.subject,
      html: inlinedHtml,
    });
    return { subject: t.subject, html: inlinedHtml };
  } catch (err) {
    console.error('PASSWORD RESET EMAIL FAILED:', err.message);
    err.emailMeta = { subject: t.subject, html: inlinedHtml };
    throw err;
  }
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };