// backend/auth/google.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const callbackURL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.englischbuecher.de/auth/google/callback'
    : 'https://api-dev.englischbuecher.de/auth/google/callback';

module.exports = function (db) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL,
    scope: ['profile', 'email'],
    state: false,
    passReqToCallback: true,
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email      = profile.emails?.[0]?.value;
      const givenName  = profile.name?.givenName  || '';
      const familyName = profile.name?.familyName || '';
      const photoURL   = profile.photos?.[0]?.value || null;

      if (!email) return done(new Error('No email from Google'));

      // Detect preferred language from browser Accept-Language header
      const acceptLang = req.headers['accept-language'] || '';
      const lang = acceptLang.toLowerCase().startsWith('de') ? 'de' : 'en';

      // ── EXISTING USER ──
      const [existingRows] = await db.execute(
        'SELECT id, first_name, last_name, photo_url, custom_pic FROM users WHERE email = ? AND deleted_at = ?',
        [email, '1970-01-01 00:00:01']
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0];
        const updates  = [];
        const values   = [];

        if (photoURL && Number(existing.custom_pic) !== 1 && photoURL !== existing.photo_url) {
          updates.push('photo_url = ?'); values.push(photoURL);
        }
        if (givenName && givenName !== existing.first_name) {
          updates.push('first_name = ?'); values.push(givenName);
        }
        if (familyName && (!existing.last_name || existing.last_name.trim() === '')) {
          updates.push('last_name = ?'); values.push(familyName);
        }
        if (updates.length > 0) {
          values.push(existing.id);
          await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        const [[updated]] = await db.execute(
          'SELECT id, email, first_name, last_name, role, language, photo_url, created_at, email_verified_at FROM users WHERE id = ?',
          [existing.id]
        );
        return done(null, {
          ...updated,
          photoURL: updated.photo_url,
          displayName: `${updated.first_name} ${updated.last_name}`.trim(),
        });
      }

      // ── NEW USER ──
      const safeFirst = givenName  || 'User';
      const safeLast  = familyName || '';

      const [result] = await db.execute(
        `INSERT INTO users
         (email, first_name, last_name, photo_url, registration_method, language, created_at, email_verified_at, deleted_at)
         VALUES (?, ?, ?, ?, 'google', ?, NOW(), NOW(), '1970-01-01 00:00:01')`,
        [email, safeFirst, safeLast, photoURL, lang]
      );

      const newUser = {
        id: result.insertId,
        email,
        first_name: safeFirst,
        last_name: safeLast,
        photoURL,
        displayName: `${safeFirst} ${safeLast}`.trim(),
        role: 'user',
        language: lang,
      };

      // Send welcome email — non-fatal, never blocks login
      try {
        const nodemailer = require('nodemailer');
        const { sendWelcomeEmail } = require('../utils/email');
        const welcomeTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 465,
          secure: parseInt(process.env.SMTP_PORT) !== 587,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          tls: { rejectUnauthorized: false },
        });
        await sendWelcomeEmail(welcomeTransporter, email, safeFirst, 'google', lang);
      } catch (emailErr) {
        console.warn('[Google] Welcome email failed (non-fatal):', emailErr.message);
      }

      return done(null, newUser);

    } catch (err) {
      console.error('Google OAuth error:', err);
      return done(err);
    }
  }));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const [[user]] = await db.execute(
        'SELECT id, email, first_name, last_name, role, language, photo_url, created_at, email_verified_at FROM users WHERE id = ?',
        [id]
      );
      if (!user) return done(null, false);
      done(null, {
        ...user,
        photoURL: user.photo_url || null,
        displayName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      });
    } catch (err) {
      done(err);
    }
  });
};