// backend/auth/google.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

//const API_URL = process.env.BACKEND_URL;
const API_URL = process.env.FRONTEND_URL;

const callbackURL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.englischbuecher.de/auth/google/callback'
    : 'https://api-dev.englischbuecher.de/auth/google/callback';
//const callbackURL = 'https://api-dev.englischbuecher.de/auth/google/callback';

/*const callbackURL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.englischbuecher.de/auth/google/callback'
    : 'https://dev--englischbuecher.netlify.app/auth/google/callback';*/


module.exports = function (db) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL,
    scope: ['profile', 'email'],
    state: false,
    passReqToCallback: true,   // gives us access to req so we can read Accept-Language
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      // Detect language from browser headers — default to 'de' for German market
      const acceptLang = req.headers['accept-language'] || '';
      const lang = acceptLang.toLowerCase().startsWith('de') ? 'de' : 'en';
      const givenName = profile.name?.givenName || '';
      const familyName = profile.name?.familyName || '';
      const displayName = profile.displayName || '';
      const photoURL = profile.photos?.[0]?.value || null;

      // SPLIT NAME SAFELY
      //const [first_name, ...last_name_arr] = displayName.split(' ');
      //const last_name = last_name_arr.join(' ') || familyName || '';
      const last_name = familyName;

      // CHECK EXISTING USER
      const [existingRows] = await db.execute(
        'SELECT id, first_name, last_name, photo_url, custom_pic FROM users WHERE email = ? AND deleted_at = ?',
        [email, '1970-01-01 00:00:01']
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0];

        // UPDATE PHOTO + NAME IF CHANGED
        const updates = [];
        const values = [];


        // Only update Google photo if the user has NOT set a custom one
        if (photoURL && Number(existing.custom_pic) !== 1) {
          if (photoURL !== existing.photo_url) {
            updates.push('photo_url = ?');
            values.push(photoURL);
          }
        }

        if (givenName && givenName !== existing.first_name) {
          updates.push('first_name = ?');
          values.push(givenName);
        }
        if (last_name && last_name !== existing.last_name && (!existing.last_name || existing.last_name === '')) {
          updates.push('last_name = ?');
          values.push(familyName);
        }
        /*if (familyName && (!existing.last_name || existing.last_name.trim() === '')) {
          updates.push('last_name = ?');
          values.push(familyName);
        }*/

        if (updates.length > 0) {
          values.push(existing.id);
          await db.execute(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
          );
        }

        const [[updated]] = await db.execute(
          'SELECT id, email, first_name, last_name, role, language, photo_url, created_at, email_verified_at FROM users WHERE id = ?',
          [existing.id]
        );

        return done(null, {
          ...updated,
          photoURL: updated.photo_url,
          displayName: `${updated.first_name} ${updated.last_name}`.trim()
        });
      }



      // CREATE NEW USER
      const safeFirstName = givenName || 'User';
      const safeLastName = familyName || '';

      const [result] = await db.execute(
        `INSERT INTO users
   (email, first_name, last_name, photo_url, registration_method, language, created_at, email_verified_at, deleted_at)
   VALUES (?, ?, ?, ?, 'google', ?, NOW(), NOW(), '1970-01-01 00:00:01')`,
        [email, safeFirstName, safeLastName, photoURL, lang]
      );

      const newUser = {
        id: result.insertId,
        email,
        first_name: safeFirstName,
        last_name: safeLastName,
        photoURL,
        displayName: `${safeFirstName} ${safeLastName}`.trim(),
        role: 'user',
        language: lang
      };

      // SEND WELCOME EMAIL
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
        await sendWelcomeEmail(welcomeTransporter, email, newUser.first_name, 'google', lang);
      } catch (emailErr) {
        console.warn('[Google] Welcome email failed (non-fatal):', emailErr.message);
      }

      return done(null, newUser);
    } catch (err) {
      console.error('Google OAuth error:', err);
      return done(err);
    }
  }));

  // SERIALIZE
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // DESERIALIZE — INCLUDE photoURL
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
        displayName: `${user.first_name || ''} ${user.last_name || ''}`.trim()
      });
    } catch (err) {
      done(err);
    }
  });
};