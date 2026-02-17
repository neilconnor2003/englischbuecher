// backend/routes/contactForm.js   ← REPLACE your current file with this

const express = require('express');
const router = express.Router();

// We already have the transporter in server.js, but we can't import it directly.
// So we receive it as a parameter — same pattern as your other routes

module.exports = (transporter) => {
  const router = express.Router();

  // Simple in-memory rate limiting (resets on server restart — perfect for now)
  const rateLimit = new Map();

  router.post('/', async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Rate limit: 5 messages per hour per IP
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const attempts = rateLimit.get(ip) || { count: 0, resetTime: now };

    if (now - attempts.resetTime > 3600000) {
      attempts.count = 0;
      attempts.resetTime = now;
    }
    if (attempts.count >= 5) {
      return res.status(429).json({ error: 'Too many requests. Try again in 1 hour.' });
    }
    attempts.count++;
    rateLimit.set(ip, attempts);

    try {
      await transporter.sendMail({
        from: `"Kontaktformular" <${process.env.SMTP_USER}>`,
        to: 'neilconnor2003@gmail.com',     // ← your real email
        replyTo: `${name} <${email}>`,
        subject: `Kontakt: ${subject}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        html: `
          <h3>Neue Nachricht vom Kontaktformular</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Betreff:</strong> ${subject}</p>
          <hr>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <hr>
          <small>Gesendet von der Website am ${new Date().toLocaleString('de-DE')}</small>
        `,
      });

      res.json({ success: true, message: 'Nachricht erfolgreich gesendet!' });
    } catch (err) {
      console.error('Contact form email error:', err);
      res.status(500).json({ error: 'Versand fehlgeschlagen. Bitte später erneut versuchen.' });
    }
  });

  return router;
};