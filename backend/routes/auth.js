// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
//const { ACTIVE_SENTINEL } = require('../../frontend/src/constants');
const ACTIVE_SENTINEL = '1970-01-01 00:00:01';
const FRONTEND_URL = process.env.FRONTEND_URL;

//const { sendWelcomeEmail } = require('../utils/email');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/email');

module.exports = function (db, transporter) {  // ← ACCEPT transporter
  const crypto = require('crypto');



  const logEmail = async ({ to, subject, html, status, error = null, type = null }) => {
    try {
      console.log('📥 INSERTING INTO sent_emails:', { to, subject, status, type });

      const [result] = await db.execute(
        `INSERT INTO sent_emails (to_email, subject, html, status, error, type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [to, subject, html, status, error, type]
      );

      console.log('✅ EMAIL LOG INSERT RESULT:', result);

    } catch (err) {
      console.error('❌ EMAIL LOG INSERT FAILED FULL:', err);
    }
  };



  router.post('/register', async (req, res) => {
    const { first_name, last_name, email, password, language = 'de' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    try {
      // Check if email exists
      const [existing] = await db.execute(
        'SELECT id FROM users WHERE email = ? AND deleted_at = ?', [email, ACTIVE_SENTINEL]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000); // 1 hour

      // Insert user
      const [result] = await db.execute(
        `INSERT INTO users 
         (first_name, last_name, email, password, language, registration_method,
          created_at, deleted_at, verification_token, verification_expires)
         VALUES (?, ?, ?, ?, ?, 'manual', NOW(), ?, ?, ?)`,
        [first_name, last_name, email, hash, language, ACTIVE_SENTINEL, token, expires]
      );

      const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

      // === SEND BEAUTIFUL EMAIL ===
      /*try {
        await sendWelcomeEmail(transporter, email, first_name || 'User', 'manual', language, verifyUrl);
        //console.log('Beautiful welcome email sent to:', email);
      } catch (emailErr) {
        console.error('EMAIL FAILED:', emailErr);
        // Don't fail registration
      }*/

      try {
        const mailMeta = await sendWelcomeEmail(
          transporter,
          email,
          first_name || 'User',
          'manual',
          language,
          verifyUrl
        );

        await logEmail({
          to: email,
          subject: mailMeta.subject,
          html: mailMeta.html,
          status: 'sent',
          type: 'Welcome'
        });

      } catch (emailErr) {
        console.error('EMAIL FAILED:', emailErr);

        await logEmail({
          to: email,
          subject: emailErr.emailMeta?.subject || (
            language === 'de'
              ? 'Fast geschafft – bestätige deine E-Mail'
              : 'Almost there – verify your email'
          ),
          html: emailErr.emailMeta?.html || null,
          status: 'failed',
          error: emailErr.message,
          type: 'Welcome'
        });

        // Don't fail registration
      }


      // Log action
      const logUserAction = async (data) => {
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
        const ua = req.headers['user-agent'] || 'unknown';
        await db.execute(
          `INSERT INTO user_audit_log 
           (user_id, action, changed_by, changed_by_role, new_data, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [data.user_id, data.action, data.changed_by, data.changed_by_role, JSON.stringify(data.new_data), ip, ua]
        );
      };

      await logUserAction({
        user_id: result.insertId,
        action: 'register',
        changed_by: result.insertId,
        changed_by_role: 'user',
        new_data: { email, first_name, last_name }
      });

      res.json({ success: true, message: 'Check your email to verify' });

    } catch (err) {
      console.error('REGISTER ERROR:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // === EMAIL VERIFICATION ===
  router.get('/verify-email', async (req, res) => {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token missing' });
    }

    try {
      const [[user]] = await db.execute(
        `SELECT id FROM users 
       WHERE verification_token = ? 
         AND verification_expires > NOW() 
         AND email_verified_at IS NULL`,
        [token]
      );

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }

      await db.execute(
        `UPDATE users 
       SET email_verified_at = NOW(), 
           verification_token = NULL, 
           verification_expires = NULL 
       WHERE id = ?`,
        [user.id]
      );

      //console.log(`EMAIL VERIFIED: User ID ${user.id}`);

      // Optional: Log audit
      // await logUserAction(...)

      res.json({ success: true, message: 'Email verified!' });

    } catch (err) {
      console.error('VERIFY EMAIL ERROR:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ===== PASSWORD RESET — 100% WORKING — SAME FLOW AS WELCOME EMAIL =====
  router.post('/forgot-password', async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    try {
      // Rate limit (same as before)
      const [recent] = await db.execute(
        `SELECT COUNT(*) as count FROM password_resets 
       WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
        [email]
      );
      if (recent[0].count >= 3) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' });
      }

      const [users] = await db.execute(
        'SELECT id, first_name, language FROM users WHERE email = ? AND deleted_at = ?',
        [email, ACTIVE_SENTINEL]
      );

      if (!users.length) {
        return res.json({ message: 'If account exists, reset link has been sent.' });
      }

      const user = users[0];
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      await db.execute(
        `INSERT INTO password_resets (email, token, expires) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE token = VALUES(token), expires = VALUES(expires)`,
        [email, token, expires]
      );

      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;

      // THIS USES THE SAME WORKING TRANSPORTER AS WELCOME EMAIL
      /*await sendPasswordResetEmail(
        transporter,            // ← SAME verified transporter!
        email,
        user.first_name || 'Kunde',
        resetLink,
        user.language || 'de'
      );*/


      try {
        const mailMeta = await sendPasswordResetEmail(
          transporter,
          email,
          user.first_name || 'Kunde',
          resetLink,
          user.language || 'de'
        );

        await logEmail({
          to: email,
          subject: mailMeta.subject,
          html: mailMeta.html,
          status: 'sent',
          type: 'PWDReset'
        });

      } catch (emailErr) {
        console.error('PASSWORD RESET EMAIL FAILED:', emailErr);

        await logEmail({
          to: email,
          subject: emailErr.emailMeta?.subject || (
            (user.language || 'de') === 'de'
              ? 'Passwort zurücksetzen'
              : 'Reset Your Password'
          ),
          html: emailErr.emailMeta?.html || null,
          status: 'failed',
          error: emailErr.message,
          type: 'PWDReset'
        });

        // keep existing behavior
      }



      res.json({ message: 'Passwort-Reset-Link gesendet!' });

    } catch (err) {
      console.error('FORGOT PASSWORD ERROR:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // === RESEND VERIFICATION EMAIL ===
  router.post('/resend-verification', async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    try {
      const [users] = await db.execute(
        `SELECT id, first_name, verification_token, verification_expires 
       FROM users 
       WHERE email = ? AND deleted_at = ? AND verification_token IS NOT NULL`,
        [email, ACTIVE_SENTINEL]
      );

      if (users.length === 0) {
        // Don't reveal if email exists or already verified
        return res.json({ success: true, message: 'If your email exists and is unverified, a new link was sent.' });
      }

      const user = users[0];

      // Check if token expired → generate new one
      // ✅ ALWAYS generate new token on resend
      //let token = user.verification_token;
      //let expires = new Date(user.verification_expires);
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000); // 1 hour


      /*if (expires < new Date()) {
        token = crypto.randomBytes(32).toString('hex');
        expires = new Date(Date.now() + 3600000); // 1 hour*/

      await db.execute(
        `UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?`,
        [token, expires, user.id]
      );
      //}

      const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

      /*await sendWelcomeEmail(
        transporter,
        email,
        user.first_name || 'User',
        'manual',
        'de', // you can detect language from user later
        verifyUrl
      );*/

      try {
        await sendWelcomeEmail(
          transporter,
          email,
          user.first_name || 'User',
          'manual',
          'de',
          verifyUrl
        );

        await logEmail({
          to: email,
          subject: 'Fast geschafft – bestätige deine E-Mail',
          //html: null,
          html: mailMeta.html,
          status: 'sent',
          type: 'Welcome-Resend'
        });

      } catch (emailErr) {
        console.error('RESEND EMAIL FAILED:', emailErr);

        await logEmail({
          to: email,
          subject: 'Fast geschafft – bestätige deine E-Mail',
          //html: null,
          html: emailErr.emailMeta?.html || null,
          status: 'failed',
          error: emailErr.message,
          type: 'Welcome-Resend'
        });

        throw emailErr;
      }


      res.json({ success: true, message: 'Verification email resent!' });

    } catch (err) {
      console.error('RESEND VERIFICATION ERROR:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};