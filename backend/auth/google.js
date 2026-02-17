// backend/auth/google.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { sendWelcomeEmail } = require('../utils/email');

const API_URL = process.env.BACKEND_URL;

module.exports = function (db) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${API_URL}/auth/google/callback`,
    scope: ['profile', 'email'],
    state: true
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
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
      const [result] = await db.execute(
        `INSERT INTO users
         (email, first_name, last_name, photo_url, registration_method, language, created_at, email_verified_at, deleted_at)
         VALUES (?, ?, ?, ?, 'google', 'de', NOW(), NOW(), '1970-01-01 00:00:01')`,
        [email, givenName || first_name || 'User', familyName, photoURL]
      );

      const newUser = {
        id: result.insertId,
        email,
        first_name: givenName || first_name || 'User',
        last_name,
        photoURL,
        displayName: `${givenName || first_name || 'User'} ${last_name}`.trim(),
        role: 'user',
        language: 'de'
      };

      // SEND WELCOME EMAIL
      try {
        sendWelcomeEmail(email, newUser.first_name, 'google');
      } catch (emailErr) {
        console.warn('Welcome email failed:', emailErr);
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