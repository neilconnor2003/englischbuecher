// backend/server.js
require('dotenv').config();


const express = require('express');
const mysql = require('mysql2/promise'); // ← /promise
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const passport = require('passport');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const multer = require('multer'); // ← ADD MULTER
const fs = require('fs');
const axios = require('axios');   // ← ADD THIS LINE
const cookieParser = require('cookie-parser');

const FRONTEND_URL = process.env.FRONTEND_URL;

//const ACTIVE_SENTINEL = '1970-01-01 00:00:01';
const ACTIVE_SENTINEL = '1969-12-31T23:00:01.000Z'
const VERIFIED_SENTINEL = '1970-01-01 00:00:01';

// MOVE TRANSPORTER HERE — OUTSIDE async() — GLOBAL
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: { rejectUnauthorized: false },
  logger: true,
  debug: true
});

const app = express();


// If you deploy behind a proxy (nginx, Render, Fly.io, etc.) this makes req.ip + XFF work
app.set('trust proxy', true);


/*app.use((req, res, next) => {
  console.log('REQUEST →', req.method, req.url);
  next();
});*/

const upload = multer({
  dest: 'uploads/books/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Images only!'));
  }
});


const profileStorage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads/profile-pics'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile-${Date.now()}${ext}`);
  }
});


const uploadProfilePic = multer({
  storage: profileStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Images only!'));
  }
});

// === MULTER FOR CATEGORY ICONS ===
const storage = multer.diskStorage({
  destination: './uploads/categories/',
  filename: (req, file, cb) => {
    cb(null, 'cat-' + Date.now() + path.extname(file.originalname));
  },
});

const uploadCategoryIcon = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|svg/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Icons only!'));
  },
});

// This is for the slug for the Authors
const slugifyStrict = (s = '') =>
  String(s)
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 200); // keep it safe



// --- helpers (near the top of server.js) to standardize the name of the author's photo
const slugify = (s = '') =>
  String(s)
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')   // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')                        // non-alnum -> hyphen
    .replace(/(^-|-$)/g, '')                            // trim hyphens
    .slice(0, 80);                                      // keep it short

// Ensure unique filename: <base>[-counter].<ext>
function uniqueNameInDir(dir, base, ext) {
  let i = 0;
  let candidate = `${base}${ext}`;
  while (fs.existsSync(path.join(dir, candidate))) {
    i += 1;
    candidate = `${base}-${i}${ext}`;
  }
  return candidate;
}

// --- author photos storage ---

// --- author photos storage ---
const authorPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, 'uploads', 'authors');
    try { fs.mkdirSync(dest, { recursive: true }); } catch { }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const rawName = (req.query.name || req.body?.name || '').trim();
    const base = slugify(rawName || 'author'); // fallback if name not provided
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';

    const dest = path.join(__dirname, 'uploads', 'authors');
    const finalName = uniqueNameInDir(dest, base, ext);
    cb(null, finalName);
  }
});

const uploadAuthorPhoto = multer({
  storage: authorPhotoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Images only!'));
  }
});


// Serve static uploads folder already exists: app.use('/uploads', express.static(...))


// Helper: get all descendant category ids (including the root id itself)
async function getCategoryDescendantIds(db, rootId) {
  const sql = `
    WITH RECURSIVE cat_tree AS (
      SELECT id FROM categories WHERE id = ?
      UNION ALL
      SELECT c.id
      FROM categories c
      INNER JOIN cat_tree ct ON c.parent_id = ct.id
    )
    SELECT id FROM cat_tree
  `;
  const [rows] = await db.execute(sql, [rootId]);
  const ids = rows.map(r => Number(r.id)).filter(n => Number.isInteger(n));
  // Always include the root id as a fallback
  return ids.length ? ids : [Number(rootId)];
}

// --- Helpers for book request matching & email ---
function slugifyTitle(s = '') {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function fulfillRequestsForBook(db, transporter, book, req) {
  try {
    const { id: bookId, title_en, title_de, isbn13, isbn10 } = book;
    const titleSlug = slugifyTitle(title_en || title_de || '');

    // Find pending requests by exact ISBN OR loose title match
    const [pending] = await db.execute(
      `SELECT br.*, u.email AS user_email
       FROM book_requests br
       LEFT JOIN users u ON u.id = br.user_id
       WHERE br.status = 'pending'
         AND (
               (br.isbn13 IS NOT NULL AND br.isbn13 = ?) OR
               (br.isbn10 IS NOT NULL AND br.isbn10 = ?) OR
               (br.title IS NOT NULL AND REPLACE(LOWER(br.title), ' ', '-') = ?)
             )`,
      [isbn13 || '', isbn10 || '', titleSlug]
    );

    if (!pending.length) return;

    for (const reqRow of pending) {
      // 1) Mark fulfilled
      await db.execute(
        `UPDATE book_requests
         SET status = 'fulfilled', book_id_fulfilled = ?, fulfilled_at = NOW()
         WHERE id = ?`,
        [bookId, reqRow.id]
      );

      // 2) Add to wishlist (insert or restore) only for logged-in users
      if (reqRow.user_id) {
        const [[existing]] = await db.execute(
          `SELECT id, deleted_at FROM wishlist WHERE user_id = ? AND book_id = ?`,
          [reqRow.user_id, bookId]
        );
        if (existing && existing.deleted_at) {
          await db.execute(`UPDATE wishlist SET deleted_at = NULL WHERE id = ?`, [existing.id]);
        } else if (!existing) {
          await db.execute(
            `INSERT INTO wishlist (user_id, book_id, deleted_at) VALUES (?, ?, NULL)`,
            [reqRow.user_id, bookId]
          );
        }
      }

      // 3) Email notify (guest or user)
      const to = reqRow.requester_email || reqRow.user_email;
      if (to) {
        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject: 'Requested book is now available',
            html: `
              <p>${reqRow.requester_name ? `Hi ${reqRow.requester_name},` : 'Hi,'}</p>
              <p>Good news! The book you requested is now available:</p>
              <ul>
                ${title_en ? `<li><strong>Title:</strong> ${title_en}</li>` : ''}
                ${isbn13 ? `<li><strong>ISBN-13:</strong> ${isbn13}</li>` : ''}
                ${isbn10 ? `<li><strong>ISBN-10:</strong> ${isbn10}</li>` : ''}
              </ul>
              ${reqRow.user_id
                ? `<p>We also added it to your wishlist.</p>`
                : `<p>Create an account or log in to add it to your wishlist.</p>`}
              <p>Thanks,<br/>Dein Englisch Bücher</p>
            `
          });
        } catch (mailErr) {
          console.error('Request notify email failed:', mailErr?.message);
        }
      }

      // Audit (optional)
      if (req) {
        await logUserAction(db, {
          user_id: reqRow.user_id || null,
          action: 'book_request_fulfilled',
          changed_by: req.user?.id || null,
          changed_by_role: req.user?.role || 'system',
          new_data: { request_id: reqRow.id, book_id: bookId },
          req
        });
      }
    }
  } catch (err) {
    console.error('fulfillRequestsForBook error:', err);
  }
}

// Helper to compute a deterministic work_id from (title_en/title_de, author)
const slugForWork = (s = '') =>
  String(s).toLowerCase().trim()
    .replace(/[\u0300-\u036f]/g, '')       // strip diacritics if pre-normalized
    .replace(/[^\w\s-]+/g, '')             // remove punctuation
    .replace(/\s+/g, ' ')                  // collapse spaces
    .replace(/\s/g, '-');                  // hyphenate

const computeWorkId = (titleEn, titleDe, author) => {
  const title = (titleEn || titleDe || '').trim();
  const auth = (author || '').trim();
  if (!title) return null;

  const key = `${slugForWork(title)}__${slugForWork(auth)}`; // e.g. "alices-adventures__lewis-carroll"
  // Keep it short & stable; you can also hash if you prefer:
  // return crypto.createHash('sha1').update(key).digest('hex').slice(0, 40);
  return key.slice(0, 64);
};


// === START ONLY AFTER DB ===
(async () => {
  let db;
  try {
    db = await mysql.createPool({
      //host: 'localhost',
      //user: 'root',
      //password: 'password',
      //database: 'bookstoredb',
      //waitForConnections: true,
      //connectionLimit: 10,
      //queueLimit: 0,

      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0

    });
    await db.execute('SET time_zone = "+00:00"');

  } catch (err) {
    console.error('DB connection failed:', err);
    process.exit(1);
  }

  // === SESSION STORE ===
  const sessionStore = new MySQLStore({}, db);

  // === MIDDLEWARE ===
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


  // (optional, but robust) add per-route CORS headers for this endpoint:
  const addCorsHeaders = (req, res, next) => {
    const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };

  app.use('/api/upload-author-photo', addCorsHeaders);

  // Upload author photo -> returns URL to save in authors.photo
  // ✅ NOW define the route (after CORS):
  app.post('/api/upload-author-photo', (req, res) => {
    uploadAuthorPhoto.single('photo')(req, res, (err) => {
      if (err) {
        console.error('Upload author photo error:', err.message);
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const url = `/uploads/authors/${req.file.filename}`;
      res.json({ url });
    });
  });


  app.use(cors({
    origin: `${FRONTEND_URL}`,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],  // ← ADD PATCH + OPTIONS
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.options(/^\/api\/.*/i, cors());

  app.use(express.json());

  app.use(cookieParser());

  app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-123',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // === PROTECTED ROUTE MIDDLEWARE ===
  const authMiddleware = (req, res, next) => {
    if (req.isAuthenticated() && req.user) {
      return next();
    }
    res.status(401).json({ error: 'You must be logged in' });
  };

  //require('./auth/google');
  //require('./auth/google')(db);  // ← PASS DB

  // === INJECT DB INTO ALL ADMIN ROUTES ===
  app.use('/api/admin', (req, res, next) => {
    req.db = db;
    next();
  });

  // === ADMIN SESSIONS API ===
  app.use('/api/admin/sessions', require('./routes/admin/sessions'));

  // === GOOGLE LOGIN (AUTO VERIFIED) ===
  require('./auth/google')(db, async (user) => {
    const [[existing]] = await db.execute(
      'SELECT id FROM users WHERE email = ? AND deleted_at = ?', [user.email, ACTIVE_SENTINEL]
    );
    if (existing) {
      await db.execute('UPDATE users SET first_name = ?, last_name = ?, photo_url = ?, email_verified_at = NOW() WHERE id = ? AND email_verified_at IS NULL', [user.given_name || 'User', user.family_name || '', user.photoURL, existing.id]);
      return existing;
    }

    const [result] = await db.execute(
      `INSERT INTO users (email, first_name, last_name, photo_url, registration_method, created_at, email_verified_at, deleted_at)
   VALUES (?, ?, ?, ?, 'google', NOW(), NOW(), ?)`,
      [user.email, user.given_name || 'User', user.family_name || '', user.photoURL, ACTIVE_SENTINEL]
    );

    await logUserAction(db, {
      user_id: result.insertId,
      action: 'google_register',
      changed_by: result.insertId,
      changed_by_role: 'user',
      new_data: { email: user.email },
      req: { headers: {} }
    });

    return { insertId: result.insertId, ...user };
  });

  // LOGIN AUDIT LOG HELPER
  const logLoginAttempt = async (db, { email, user_id, success, method = 'email', ip, user_agent, error = null }) => {
    try {
      await db.execute(
        `INSERT INTO login_audit_log 
       (email, user_id, success, method, ip_address, user_agent, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [email || null, user_id || null, success ? 1 : 0, method, ip, user_agent, error]
      );
    } catch (err) {
      console.error('Failed to log login attempt:', err);
    }
  };

  // LOGOUT AUDIT LOG
  const logLogout = async (db, { user_id, email, ip, user_agent }) => {
    try {
      await db.execute(
        `INSERT INTO login_audit_log 
       (user_id, email, success, method, ip_address, user_agent, created_at)
       VALUES (?, ?, 1, 'logout', ?, ?, NOW())`,
        [user_id, email, ip, user_agent]
      );
    } catch (err) {
      console.error('Failed to log logout:', err);
    }
  };

  // === LOGIN CHECK ===
  // FINAL LOGIN WITH FULL AUDIT LOGS
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    if (!email || !password) {
      await logLoginAttempt(db, { email, success: false, ip, user_agent: ua, error: 'Missing credentials' });
      return res.status(400).json({ error: 'Email and password required' });
    }

    try {
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      const [[user]] = await db.execute(
        `SELECT id, email, first_name, role, email_verified_at
       FROM users
       WHERE email = ?
         AND password = ?
         AND deleted_at = "1970-01-01 00:00:01"`,
        [email, hash]
      );

      if (!user) {
        await logLoginAttempt(db, { email, success: false, ip, user_agent: ua, error: 'Invalid credentials' });
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.email_verified_at) {
        await logLoginAttempt(db, { email, user_id: user.id, success: false, ip, user_agent: ua, error: 'Email not verified' });
        return res.status(403).json({ error: 'unverified' });
      }

      // SUCCESSFUL LOGIN
      req.login(user, async () => {
        await logLoginAttempt(db, {
          email: user.email,
          user_id: user.id,
          success: true,
          method: 'email',
          ip,
          user_agent: ua
        });

        await logUserAction(db, {
          user_id: user.id,
          action: 'login',
          changed_by: user.id,
          changed_by_role: user.role,
          new_data: { method: 'email', ip, user_agent: ua },
          req
        });

        res.json({
          success: true,
          user: { id: user.id, email: user.email, first_name: user.first_name, role: user.role }
        });
      });

    } catch (err) {
      console.error('LOGIN ERROR:', err);
      await logLoginAttempt(db, { email, success: false, ip, user_agent: ua, error: err.message });
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ===== FORGOT PASSWORD — FINAL BEAUTIFUL VERSION =====
  /*app.post('/api/auth/forgot-password', async (req, res) => {
    const email = req.body.email?.trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    try {
      // Rate limit
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

      const resetLink = `${config.FRONTEND_URL}/reset-password/${token}`;

      await sendPasswordResetEmail(
        transporter,
        email,
        user.first_name || 'User',
        resetLink,
        user.language || 'de'
      );

      await logUserAction(db, {
        user_id: user.id,
        action: 'password_reset_requested',
        changed_by: null,
        changed_by_role: null,
        old_data: null,
        new_data: { method: 'email', token_generated: true },
        req
      });

      res.json({ message: 'Passwort-Reset-Link gesendet!' });

    } catch (err) {
      console.error('FORGOT PASSWORD ERROR:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });*/

  // ===== 2. RESET PASSWORD (FIXED) =====
  // FINAL RESET PASSWORD — 100% WORKING — NO MORE SERVER ERROR
  app.post('/api/auth/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be 8+ characters' });
    }

    try {
      // Find valid reset token
      const [resets] = await db.execute(
        'SELECT email FROM password_resets WHERE token = ? AND expires > NOW()',
        [token]
      );

      if (!resets.length) {
        return res.status(400).json({ error: 'Invalid or expired reset link' });
      }

      const { email } = resets[0];
      const cleanEmail = email.trim().toLowerCase();

      // Hash new password
      const hash = crypto.createHash('sha256').update(password).digest('hex');

      // Update password
      const [result] = await db.execute(
        'UPDATE users SET password = ? WHERE email = ? AND deleted_at = "1970-01-01 00:00:01"',
        [hash, cleanEmail]
      );

      if (result.affectedRows === 0) {
        return res.status(400).json({ error: 'User not found or deleted' });
      }

      // Delete all reset tokens for this email
      await db.execute('DELETE FROM password_resets WHERE email = ?', [cleanEmail]);

      // Get user ID for audit log
      const [[user]] = await db.execute('SELECT id FROM users WHERE email = ?', [cleanEmail]);

      // AUDIT LOG
      await logUserAction(db, {
        user_id: user.id,
        action: 'password_changed',
        changed_by: user.id,
        changed_by_role: 'user',
        old_data: null,
        new_data: { method: 'reset_link', success: true },
        req
      });

      res.json({ message: 'Password updated successfully!' });

    } catch (err) {
      console.error('RESET PASSWORD ERROR:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // === AUDIT LOG VIEW ===
  app.get('/api/admin/users/:id/audit', async (req, res) => {
    const { id } = req.params;
    try {
      const [logs] = await db.execute(
        `SELECT * FROM user_audit_log WHERE user_id = ? ORDER BY created_at DESC`,
        [id]
      );
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/admin/book-requests  — using db.query to avoid server-prepared LIMIT issues
  app.get('/api/admin/book-requests', async (req, res) => {
    const pageRaw = Number(req.query.page);
    const limitRaw = Number(req.query.limit);

    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 10; // cap to be safe
    const search = (req.query.search || '').trim();
    const offset = (page - 1) * limit;

    try {
      let whereClause = '';
      const whereParams = [];

      if (search.length > 0) {
        whereClause = `WHERE title LIKE ? OR requester_email LIKE ? OR requester_name LIKE ?`;
        const like = `%${search}%`;
        whereParams.push(like, like, like);
      }

      // LIMIT ?, ?  (offset first, then row_count)
      const listSql = `
      SELECT *
      FROM book_requests
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?, ?
    `;
      const listParams = [...whereParams, offset, limit];

      const countSql = `
      SELECT COUNT(*) AS total
      FROM book_requests
      ${whereClause}
    `;
      const countParams = whereParams;

      // 🔁 Use query() here instead of execute()
      const [rows] = await db.query(listSql, listParams);
      const [[{ total }]] = await db.query(countSql, countParams);

      // (Optional) debug once, then remove:
      // console.log('[book-requests] page=%d limit=%d offset=%d search="%s"', page, limit, offset, search);

      res.json({ requests: rows, total });
    } catch (err) {
      console.error('GET /api/admin/book-requests error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });


  // PUT: link one book to a work_id (admin UI can call this)
  app.put('/api/admin/books/:id/work', async (req, res) => {
    const { work_id } = req.body || {};
    if (!work_id || typeof work_id !== 'string' || work_id.length > 64) {
      return res.status(400).json({ error: 'Invalid work_id' });
    }
    try {
      const [result] = await db.execute('UPDATE books SET work_id = ? WHERE id = ?', [work_id.trim(), req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Book not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('PUT /api/admin/books/:id/work error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });


  // PUT /api/admin/books/:id/authors { authorIds: number[] }
  app.put('/api/admin/books/:id/authors', async (req, res) => {
    const bookId = Number(req.params.id);
    const { authorIds } = req.body || {};
    if (!bookId || !Array.isArray(authorIds)) {
      return res.status(400).json({ error: 'book id and authorIds[] required' });
    }
    const ids = [...new Set(authorIds.map(n => Number(n)).filter(Boolean))];

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM book_authors WHERE book_id = ?', [bookId]);

      if (ids.length) {
        const vals = ids.map(aid => [bookId, aid]);
        const placeholders = vals.map(() => '(?, ?)').join(', ');
        await conn.query(
          `INSERT INTO book_authors (book_id, author_id) VALUES ${placeholders}`,
          vals.flat()
        );
      }
      await conn.commit();
      res.json({ success: true, bookId, authorIds: ids });
    } catch (err) {
      await conn.rollback();
      console.error('Set book authors error:', err);
      res.status(500).json({ error: 'Server error' });
    } finally {
      conn.release();
    }
  });



  // === ROUTES ===
  app.use('/api/hero-banner', require('./routes/heroBannerApi')(db));

  app.use('/api/about', require('./routes/about')(db));
  app.use('/api/contact', require('./routes/contact')(db));

  app.use('/api/contact-form', require('./routes/contactForm')(transporter));

  app.use('/api/imprint', require('./routes/imprint')(db));

  app.use('/api/privacy', require('./routes/privacy')(db));

  app.use('/api/faq', require('./routes/faq')(db));


  // Sendcloud shipping endpoints
  //app.use('/api/shipping', require('./routes/shipping'));

  // Shippo shipping endpoint
  app.use('/api/shippo', require('./routes/shippoRates'));



  // === LOG HELPER ===
  const logUserAction = async (db, { user_id, action, changed_by, changed_by_role, old_data, new_data, req }) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    await db.execute(
      `INSERT INTO user_audit_log 
     (user_id, action, changed_by, changed_by_role, old_data, new_data, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, action, changed_by, changed_by_role, old_data ? JSON.stringify(old_data) : null, new_data ? JSON.stringify(new_data) : null, ip, ua]
    );
  };

  // === ADMIN USERS API ===
  // === ADMIN USERS API (100% WORKING - FINAL) ===
  app.get('/api/admin/users', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    if (isNaN(page) || isNaN(limit)) {
      return res.status(400).json({ error: 'Invalid page or limit' });
    }

    try {
      // === BASE: Only active users ===
      /*let sql = `SELECT id, email, first_name, last_name, role, language, registration_method,
                      created_at, email_verified_at, deleted_at
               FROM users
               WHERE deleted_at = ?`;*/

      let sql = `SELECT id, email, first_name, last_name, role, language, registration_method,
                      created_at, email_verified_at, deleted_at
               FROM users`;

      //let countSql = `SELECT COUNT(*) as total FROM users WHERE deleted_at = ?`;
      let countSql = `SELECT COUNT(*) as total FROM users`;

      //let params = [ACTIVE_SENTINEL];
      //let countParams = [ACTIVE_SENTINEL];

      // === SEARCH ===
      /*if (search) {
        const like = `%${search}%`;
        sql += ` AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)`;
        countSql += ` AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)`;
        //params.push(like, like, like);
        //countParams.push(like, like, like);
      }*/

      // === PAGINATION (your working method) ===
      sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      // === EXECUTE ===
      //const [users] = await db.execute(sql, params);
      const [users] = await db.execute(sql);
      //const [[{ total }]] = await db.execute(countSql, countParams);
      const [[{ total }]] = await db.execute(countSql);

      res.json({ users, total: total || 0 });
    } catch (err) {
      console.error('GET /api/admin/users error:', err.message);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });

  app.post('/api/admin/users', async (req, res) => {
    const { first_name, last_name, email, role, language = 'de' } = req.body;
    if (!email || !role) return res.status(400).json({ error: 'Email and role required' });

    try {
      const [existing] = await db.execute(
        'SELECT id FROM users WHERE email = ? AND deleted_at = ?', [email, ACTIVE_SENTINEL]
      );
      if (existing.length > 0) return res.status(400).json({ error: 'Email already in use' });

      const [result] = await db.execute(
        `INSERT INTO users (first_name, last_name, email, role, language, registration_method, 
                         created_at, email_verified_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, 'manual', NOW(), NOW(), ?)`,
        [first_name || null, last_name || null, email, role, language, ACTIVE_SENTINEL]
      );

      const [newUser] = await db.execute(
        'SELECT id, email, first_name, last_name, role, language, created_at FROM users WHERE id = ?',
        [result.insertId]
      );

      await logUserAction(db, {
        user_id: result.insertId,
        action: 'create',
        changed_by: req.user?.id || null,
        changed_by_role: req.user?.role || null,
        new_data: newUser[0],
        req
      });

      res.json({ user: newUser[0] });
    } catch (err) {
      console.error('POST /api/admin/users error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.put('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, email, role, language } = req.body;

    try {
      const [[old]] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
      //if (!old || old.deleted_at !== ACTIVE_SENTINEL) return res.status(404).json({ error: 'User not found' });
      if (!old) return res.status(404).json({ error: 'User not found' });

      // ← Compare with DB string
      if (old.deleted_at !== ACTIVE_SENTINEL) {
        return res.status(400).json({ error: 'User is deleted' });
      }

      if (email !== old.email) {
        const [dup] = await db.execute(
          //'SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at = ?', [email, id, ACTIVE_SENTINEL]
          'SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at = ?',
          [email, id, '1970-01-01 00:00:01']
        );
        if (dup.length > 0) return res.status(400).json({ error: 'Email already in use' });
      }

      await db.execute(
        `UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, language = ? WHERE id = ?`,
        [first_name || old.first_name, last_name || old.last_name, email, role, language || old.language, id]
      );

      const [[updated]] = await db.execute('SELECT id, email, first_name, last_name, role, language FROM users WHERE id = ?', [id]);

      await logUserAction(db, {
        user_id: id,
        action: 'update',
        changed_by: req.user.id,
        changed_by_role: req.user.role,
        old_data: old,
        new_data: updated,
        req
      });

      res.json({ user: updated });
    } catch (err) {
      console.error('PUT /api/admin/users/:id error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.delete('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
      //const [[user]] = await db.execute('SELECT * FROM users WHERE id = ? AND deleted_at = ?', [id, ACTIVE_SENTINEL]);
      const [[user]] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const isActive = user.deleted_at === ACTIVE_SENTINEL;
      if (!isActive) return res.status(400).json({ error: 'User already deleted' });

      /*await db.execute(
        `UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at = ?`,
        [id, ACTIVE_SENTINEL]
      );*/
      await db.execute('UPDATE users SET deleted_at = NOW() WHERE id = ?', [id]);

      await logUserAction(db, {
        user_id: id,
        action: 'soft_delete',
        changed_by: req.user.id,
        changed_by_role: req.user.role,
        old_data: user,
        req
      });

      res.json({ message: 'User soft deleted' });
    } catch (err) {
      console.error('DELETE /api/admin/users/:id error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // === REACTIVATE USER ===
  app.post('/api/admin/users/:id/reactivate', async (req, res) => {
    const { id } = req.params;
    try {
      const [[user]] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
      //if (!user || user.deleted_at === ACTIVE_SENTINEL) return res.status(400).json({ error: 'User not deleted' });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const isActive = user.deleted_at === ACTIVE_SENTINEL;
      if (isActive) return res.status(400).json({ error: 'User is already active' });

      await db.execute('UPDATE users SET deleted_at = ? WHERE id = ?', ['1970-01-01 00:00:01', id]);

      await logUserAction(db, {
        user_id: id,
        action: 'reactivate',
        changed_by: req.user?.id || null,
        changed_by_role: req.user?.role || 'admin',
        old_data: { deleted_at: user.deleted_at },
        new_data: { deleted_at: '1970-01-01 00:00:01' },
        req
      });

      res.json({ message: 'User reactivated', user: { ...user, deleted_at: '1970-01-01 00:00:01' } });
    } catch (err) {
      console.error('POST /api/admin/users/:id/reactivate error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // === USER PROFILE API ===
  app.get('/api/user/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    const [[user]] = await db.execute(
      'SELECT id, email, first_name, last_name, language, created_at, email_verified_at FROM users WHERE id = ? AND deleted_at = ?',
      [req.user.id, VERIFIED_SENTINEL]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });

  app.put('/api/user/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

    const { first_name, last_name, email, language } = req.body;

    try {
      const [[old]] = await db.execute(
        'SELECT * FROM users WHERE id = ? AND deleted_at = ?',
        [req.user.id, VERIFIED_SENTINEL]
      );
      if (!old) return res.status(404).json({ error: 'User not found' });

      // === EMAIL CHANGE LOGIC (OPTIONAL) ===
      let finalEmail = old.email;
      if (email && email !== old.email) {
        const [dup] = await db.execute(
          'SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at = ?',
          [email, req.user.id, ACTIVE_SENTINEL]
        );
        if (dup.length > 0) return res.status(400).json({ error: 'Email already in use' });
        finalEmail = email;
      }

      // === UPDATE ONLY PROVIDED FIELDS ===
      await db.execute(
        `UPDATE users 
       SET first_name = ?, last_name = ?, email = ?, language = ? 
       WHERE id = ?`,
        [
          first_name !== undefined ? first_name : old.first_name,
          last_name !== undefined ? last_name : old.last_name,
          finalEmail,
          language || old.language || 'de',
          req.user.id
        ]
      );

      const [[updated]] = await db.execute(
        'SELECT id, email, first_name, last_name, language, created_at, email_verified_at FROM users WHERE id = ?',
        [req.user.id]
      );

      await logUserAction(db, {
        user_id: req.user.id,
        action: 'profile_update',
        changed_by: req.user.id,
        changed_by_role: 'user',
        old_data: old,
        new_data: updated,
        req
      });

      res.json(updated);
    } catch (err) {
      console.error('PROFILE UPDATE ERROR:', err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });

  app.delete('/api/user/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const [[user]] = await db.execute('SELECT * FROM users WHERE id = ? AND deleted_at = ?', [req.user.id, ACTIVE_SENTINEL]);
      if (!user) return res.status(404).json({ error: 'User not found' });

      await db.execute('UPDATE users SET deleted_at = NOW() WHERE id = ?', [req.user.id]);

      await logUserAction(db, {
        user_id: req.user.id,
        action: 'self_deactivate',
        changed_by: req.user.id,
        changed_by_role: 'user',
        old_data: user,
        req
      });

      req.logout(() => res.json({ message: 'Account deactivated' }));
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });



  app.post('/api/user/profile-photo', uploadProfilePic.single('photo'), async (req, res) => {
    try {
      const filePath = `/uploads/profile-pics/${req.file.filename}`;
      await db.execute('UPDATE users SET photo_url = ?, custom_pic = 1 WHERE id = ?', [filePath, req.user.id]);
      res.json({ photoURL: filePath });
    } catch (err) {
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // === BOOK REQUESTS API ===

  // Create a new request (guest OR authenticated)
  app.post('/api/book-requests', async (req, res) => {
    const {
      isbn13, isbn10, title,
      author, publisher, notes,
      requester_name, requester_email
    } = req.body || {};

    // Require at least one of ISBN or title
    if (!((isbn13 && isbn13.trim()) || (isbn10 && isbn10.trim()) || (title && title.trim()))) {
      return res.status(400).json({ error: 'ISBN or Title is required' });
    }

    const isAuthed = req.isAuthenticated && req.isAuthenticated() && req.user;
    const user_id = isAuthed ? req.user.id : null;
    const emailToSave = isAuthed ? (req.user.email || null) : (requester_email || null);
    const nameToSave = isAuthed ? (req.user.first_name ? `${req.user.first_name} ${req.user.last_name || ''}`.trim() : null)
      : (requester_name || null);

    // For guests, require name + email
    if (!isAuthed && !(nameToSave && emailToSave)) {
      return res.status(400).json({ error: 'Name and Email are required for guest requests' });
    }

    try {
      // Optional: dedupe (same user/email pending request for same book)
      const [dups] = await db.execute(
        `SELECT id FROM book_requests
       WHERE status = 'pending'
         AND ( (isbn13 IS NOT NULL AND isbn13 = ?) OR
               (isbn10 IS NOT NULL AND isbn10 = ?) OR
               (title  IS NOT NULL AND REPLACE(LOWER(title), ' ', '-') = ?) )
         AND ( (user_id IS NOT NULL AND user_id = ?) OR
               (requester_email IS NOT NULL AND requester_email = ?) )`,
        [isbn13 || '', isbn10 || '', slugifyTitle(title || ''), user_id || null, emailToSave || null]
      );

      if (dups.length) {
        return res.json({ success: true, message: 'Request already recorded' });
      }

      await db.execute(
        `INSERT INTO book_requests
       (user_id, requester_name, requester_email,
        isbn13, isbn10, title, author, publisher, notes,
        status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [
          user_id, nameToSave, emailToSave,
          isbn13 || null, isbn10 || null, title || null,
          author || null, publisher || null, notes || null
        ]
      );

      res.json({ success: true });
    } catch (err) {
      console.error('POST /api/book-requests error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // List current user's requests (authenticated only)
  app.get('/api/book-requests/mine', authMiddleware, async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT *
       FROM book_requests
       WHERE user_id = ?
       ORDER BY created_at DESC`,
        [req.user.id]
      );
      res.json(rows);
    } catch (err) {
      console.error('GET /api/book-requests/mine error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET FEATURED BOOKS — used in hero banner
  app.get('/api/books/featured', async (req, res) => {
    try {
      const [rows] = await db.execute(`
      SELECT
        id,
        title_en,
        title_de,
        author,
        original_price,
        price AS discount_price,
        image AS cover_image,
        slug,
        is_featured,
        is_available,
        stock
      FROM books
      WHERE is_featured = 1
        AND is_available = 1
        AND stock > 0
      ORDER BY popularity_score DESC, created_at DESC
      LIMIT 8
    `);

      //console.log('Query returned', rows.length, 'books:');
      console.table(rows.map(r => ({ id: r.id, title: r.title_en, featured: r.is_featured, available: r.is_available, stock: r.stock })));

      if (rows.length === 0) {
        console.log('No featured books found – returning empty array');
        return res.json([]);   // ← VERY IMPORTANT: return [] instead of error
      }

      const books = rows.map(book => ({
        ...book,
        cover_image: book.cover_image
          ? `${req.protocol}://${req.get('host')}${book.cover_image.startsWith('/') ? '' : '/'}${book.cover_image}`
          : 'https://via.placeholder.com/300x450.png?text=No+Image'
      }));

      //console.log('Sending these books to frontend:');
      console.table(books.map(b => ({ id: b.id, title: b.title_en, cover_image: b.cover_image })));

      res.json(books);
    } catch (err) {
      console.error('GET /api/books/featured error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // === BOOK APIs ===


  app.get('/api/books/popular', async (req, res) => {
    try {
      const [rows] = await db.execute(`
      SELECT 
        b.id,
        b.title_en,
        b.title_de,
        b.author,
        b.price,
        b.original_price,
        b.image,
        b.slug,
        b.isbn13,
        b.isbn10,
        b.rating,
        b.review_count,
        COALESCE(agg.total_quantity, 0) AS total_quantity
      FROM books b
      LEFT JOIN (
        SELECT 
          oi.bookId,
          SUM(oi.quantity) AS total_quantity
        FROM orders o
        JOIN JSON_TABLE(o.order_items, '$[*]'
          COLUMNS (
            bookId INT PATH '$.bookId',
            quantity INT PATH '$.quantity'
          )
        ) AS oi
        GROUP BY oi.bookId
      ) AS agg
        ON agg.bookId = b.id
      ORDER BY total_quantity DESC
      LIMIT 10;
    `);

      res.json(rows);
    } catch (err) {
      console.error('GET /api/books/popular error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // backend/server.js — NEW route (keep your existing /api/books)

  app.get('/api/books/listing', async (req, res) => {
    try {
      const {
        q,
        author,
        category,
        publisher,
        format,      // comma-separated from CheckboxGroup
        edition,
        stock,       // '1' → only in stock
        min_price,
        max_price,
        rating,      // minimum rating
        reviews,     // minimum review_count
        popularity,  // minimum popularity_score
        sort         // relevance | title_asc | title_desc | price_asc | price_desc | rating_desc | review_count_desc | popularity_score_desc
      } = req.query;

      const where = [];
      const params = [];

      // ✅ Search across title_en/title_de/author + ISBN10 + ISBN13
      if (q) {
        const qp = `%${q.toLowerCase()}%`;
        where.push(`(
        LOWER(b.title_en) LIKE ? OR
        LOWER(b.title_de) LIKE ? OR
        LOWER(b.author) LIKE ? OR
        b.isbn10 LIKE ? OR
        b.isbn13 LIKE ?
      )`);
        params.push(qp, qp, qp, qp, qp);
      }

      if (author) { where.push(`b.author = ?`); params.push(author); }
      //if (category) { where.push(`b.category_id = ?`); params.push(Number(category)); }

      if (category) {
        const catId = Number(category);
        const catIds = await getCategoryDescendantIds(db, catId);   // 👈 NEW
        // Build a safe IN clause with placeholders
        where.push(`b.category_id IN (${catIds.map(() => '?').join(',')})`);
        params.push(...catIds);
      }

      if (publisher) { where.push(`b.publisher = ?`); params.push(publisher); }
      if (edition) { where.push(`b.edition = ?`); params.push(edition); }

      if (stock === '1') { where.push(`b.is_available = 1 AND b.stock > 0`); }

      if (min_price) { where.push(`b.price >= ?`); params.push(Number(min_price)); }
      if (max_price) { where.push(`b.price <= ?`); params.push(Number(max_price)); }
      if (rating) { where.push(`b.rating >= ?`); params.push(Number(rating)); }
      if (reviews) { where.push(`b.review_count >= ?`); params.push(Number(reviews)); }
      if (popularity) { where.push(`b.popularity_score >= ?`); params.push(Number(popularity)); }

      if (format) {
        const list = String(format).split(',').map(s => s.trim()).filter(Boolean);
        if (list.length) {
          where.push(`b.format IN (${list.map(() => '?').join(',')})`);
          params.push(...list);
        }
      }

      // ✅ ORDER BY mapping
      let orderBy = `b.created_at DESC`;
      switch (sort) {
        case 'title_asc': orderBy = `b.title_en ASC`; break;
        case 'title_desc': orderBy = `b.title_en DESC`; break;
        case 'price_asc': orderBy = `b.price ASC`; break;
        case 'price_desc': orderBy = `b.price DESC`; break;
        case 'rating_desc': orderBy = `b.rating DESC, b.review_count DESC`; break;
        case 'review_count_desc': orderBy = `b.review_count DESC`; break;
        case 'popularity_score_desc': orderBy = `b.popularity_score DESC`; break;
        case 'relevance':
          if (q) {
            const qeq = q.toLowerCase();
            const qlike = `%${qeq}%`;
            orderBy = `
            CASE 
              WHEN LOWER(b.title_en) = ? THEN 1
              WHEN LOWER(b.title_de) = ? THEN 2
              WHEN LOWER(b.author)   = ? THEN 3
              WHEN b.isbn10 = ? THEN 4
              WHEN b.isbn13 = ? THEN 5
              WHEN LOWER(b.title_en) LIKE ? THEN 6
              WHEN LOWER(b.title_de) LIKE ? THEN 7
              WHEN LOWER(b.author)   LIKE ? THEN 8
              ELSE 9
            END ASC,
            b.popularity_score DESC, b.rating DESC, b.review_count DESC, b.created_at DESC
          `;
            params.push(qeq, qeq, qeq, q, q, qlike, qlike, qlike);
          } else {
            orderBy = `b.popularity_score DESC, b.rating DESC, b.review_count DESC, b.created_at DESC`;
          }
          break;
        default: break;
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const sql = `
      SELECT
        b.*, c.name_en AS categoryName, b.isbn13, b.isbn10
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      ${whereSql}
      ORDER BY ${orderBy}
    `;

      const [rows] = await db.execute(sql, params);

      // Normalize local images to absolute URL for the UI
      const books = rows.map(b => ({
        ...b,
        image: b.image?.startsWith('/uploads')
          ? `${req.protocol}://${req.get('host')}${b.image}`
          : b.image
      }));

      res.json(books);
    } catch (err) {
      console.error('GET /api/books/listing error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // GET dynamic filter options
  app.get('/api/books/filters', async (req, res) => {
    try {
      const [authors] = await db.execute('SELECT DISTINCT author FROM books WHERE author IS NOT NULL AND author != "" ORDER BY author');
      const [publishers] = await db.execute('SELECT DISTINCT publisher FROM books WHERE publisher IS NOT NULL AND publisher != "" ORDER BY publisher');
      const [formats] = await db.execute('SELECT DISTINCT format FROM books WHERE format IS NOT NULL ORDER BY format');
      const [editions] = await db.execute('SELECT DISTINCT edition FROM books WHERE edition IS NOT NULL ORDER BY edition');
      const [categories] = await db.execute('SELECT id, name_en, name_de FROM categories WHERE is_visible = 1 ORDER BY name_en');

      res.json({
        authors: authors.map(r => r.author),
        publishers: publishers.map(r => r.publisher),
        formats: formats.map(r => r.format),
        editions: editions.map(r => r.edition),
        categories: categories
      });
    } catch (err) {
      console.error('Filters error:', err);
      res.status(500).json({ authors: [], publishers: [], formats: [], editions: [], categories: [] });
    }
  });


  // backend/server.js — REPLACE your GET /api/books/:id with this

  // REPLACE your GET /api/books/:id with this:

  app.get('/api/books/:id', async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      if (!bookId) return res.status(400).json({ error: 'Invalid id' });

      // 1) Book row (no author_id here)
      const [[book]] = await db.execute(`
      SELECT 
        b.id,
        b.title_en, b.title_de,
        b.author,              -- legacy display string (may contain comma-separated names)
        b.isbn, b.isbn13, b.isbn10,
        b.price, b.original_price, b.sale_price,
        b.image, b.images,
        b.stock, b.slug, b.work_id,
        b.description_en, b.description_de,
        b.meta_title_en, b.meta_title_de,
        b.meta_description_en, b.meta_description_de,
        b.category_id, b.publisher, b.pages, b.publish_date,
        b.weight_grams, b.dimensions, b.format, b.edition, b.binding,
        b.language, b.translator, b.series_name, b.series_volume, b.reading_age,
        b.rating, b.review_count, b.popularity_score, b.tags
      FROM books b
      WHERE b.id = ?
      LIMIT 1
    `, [bookId]);

      if (!book) return res.status(404).json({ error: 'Book not found' });

      // 2) Authors via pivot
      const [authorRows] = await db.execute(`
      SELECT a.id, a.name, a.bio, a.photo
      FROM book_authors ba
      JOIN authors a ON a.id = ba.author_id
      WHERE ba.book_id = ?
      ORDER BY a.name ASC
    `, [bookId]);

      // 3) Normalize URLs
      const origin = `${req.protocol}://${req.get('host')}`;
      const normalize = (url) => {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('/')) return `${origin}${url}`;
        return `${origin}/${url}`;
      };

      const authors = authorRows.map(a => ({
        id: a.id,
        name: a.name,
        bio: a.bio || '',
        photo: normalize(a.photo),
      }));

      book.image = normalize(book.image);
      if (book.images) {
        try {
          const arr = typeof book.images === 'string' ? JSON.parse(book.images) : book.images;
          book.images = Array.isArray(arr) ? arr.map(normalize) : [];
        } catch { book.images = []; }
      } else {
        book.images = [];
      }

      // 4) Legacy top-level fields for compatibility (use first author if any)
      const primary = authors[0] || null;

      res.json({
        ...book,
        authors,
        author_name: primary?.name || book.author || null,
        author_bio: primary?.bio || null,
        author_photo: primary?.photo || null,
      });
    } catch (err) {
      console.error('GET /api/books/:id error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });


  // GET all editions for the same work as book :id
  app.get('/api/books/:id/editions', async (req, res) => {
    try {
      const [[base]] = await db.execute('SELECT work_id FROM books WHERE id = ?', [req.params.id]);
      if (!base || !base.work_id) return res.json([]);

      const [rows] = await db.execute(`
      SELECT 
        id, title_en, title_de, author, format, edition, isbn13, isbn10,
        price, original_price, sale_price, image, stock, language, publisher, publish_date
      FROM books
      WHERE work_id = ? AND id <> ?
      ORDER BY 
        CASE format
          WHEN 'Hardcover' THEN 1
          WHEN 'Paperback' THEN 2
          WHEN 'eBook' THEN 3
          WHEN 'Audiobook' THEN 4
          ELSE 5
        END,
        COALESCE(edition, ''), publish_date DESC, price ASC
    `, [base.work_id, req.params.id]);

      const origin = `${req.protocol}://${req.get('host')}`;
      const normalizeImage = (url) => {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('/')) return `${origin}${url}`;
        return `${origin}/${url}`;
      };

      const editions = rows.map(r => ({ ...r, image: normalizeImage(r.image) }));

      res.json(editions);
    } catch (err) {
      console.error('GET /api/books/:id/editions error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Optional: GET by explicit work_id
  app.get('/api/books/work/:workId/editions', async (req, res) => {
    try {
      const [rows] = await db.execute(`
      SELECT 
        id, title_en, title_de, author, format, edition, isbn13, isbn10,
        price, original_price, sale_price, image, stock, language, publisher, publish_date
      FROM books
      WHERE work_id = ?
      ORDER BY 
        CASE format
          WHEN 'Hardcover' THEN 1
          WHEN 'Paperback' THEN 2
          WHEN 'eBook' THEN 3
          WHEN 'Audiobook' THEN 4
          ELSE 5
        END,
        COALESCE(edition, ''), publish_date DESC, price ASC
    `, [req.params.workId]);

      const origin = `${req.protocol}://${req.get('host')}`;
      const normalizeImage = (url) => {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('/')) return `${origin}${url}`;
        return `${origin}/${url}`;
      };

      res.json(rows.map(r => ({ ...r, image: normalizeImage(r.image) })));
    } catch (err) {
      console.error('GET /api/books/work/:workId/editions error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });



  app.get('/api/books', async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT b.*, c.name_en AS categoryName,
        b.isbn13, b.isbn10
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        ORDER BY b.created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error('GET /api/books error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // POST /api/books — ADD BOOK (NOW WITH ALL MISSING FIELDS + FIX TYPO)

  // backend/server.js — POST /api/books (updated, many-to-many authors, no author_id)
  app.post('/api/books', async (req, res) => {
    const body = req.body;

    const title_en = body.title_en || 'Untitled';
    const title_de = body.title_de || title_en;
    const author = body.author || 'Unknown Author'; // legacy display string
    const isbn = body.isbn || null;
    const isbn10 = body.isbn10 || null;
    const isbn13 = body.isbn13 || null;
    const price = parseFloat(body.price) || 0.0;
    const original_price = body.original_price ? parseFloat(body.original_price) : null;
    const sale_price = body.sale_price ? parseFloat(body.sale_price) : null;
    const stock = parseInt(body.stock) || 10;
    const category_id = parseInt(body.category_id) || 1;
    const slug = body.slug || title_en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const publisher = body.publisher || '';
    const pages = body.pages ? parseInt(body.pages) : null;
    const publish_date = body.publish_date || null;
    const description_en = body.description_en || '';
    const description_de = body.description_de || description_en;
    const meta_title_en = body.meta_title_en || title_en;
    const meta_title_de = body.meta_title_de || `${title_en} von ${author} – Jetzt kaufen`;
    const meta_description_en = body.meta_description_en || '';
    const meta_description_de = body.meta_description_de || meta_description_en.substring(0, 155) + '...';
    const image = body.image || null;
    const images = body.images ? JSON.stringify(body.images) : null;
    const weight_grams = body.weight_grams ? parseInt(body.weight_grams) : null;
    const dimensions = body.dimensions || null;
    const format = body.format || 'Paperback';
    const edition = body.edition || null;
    const binding = body.binding || null;
    const language = body.language || 'EN';
    const translator = body.translator || null;
    const series_name = body.series_name || null;
    const series_volume = body.series_volume || null;
    const reading_age = body.reading_age || null;
    const is_featured = body.is_featured ? 1 : 0;
    const is_new_release = body.is_new_release ? 1 : 0;
    const is_bestseller = body.is_bestseller ? 1 : 0;
    const tags = body.tags || null;
    const rating = parseFloat(body.rating) || 0;
    const review_count = parseInt(body.review_count) || 0;
    const popularity_score = parseFloat(body.popularity_score) || 0;
    const work_id = body.work_id || computeWorkId(title_en, title_de, author);

    // Many-to-many authors (optional)
    const authorIds = Array.isArray(body._authorIds)
      ? [...new Set(body._authorIds.map(n => Number(n)).filter(Boolean))]
      : [];

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // INSERT book (clean column list — no duplicates)
      const [result] = await conn.execute(`
      INSERT INTO books (
        title_en, title_de, author,
        isbn, isbn10, isbn13,
        price, original_price, sale_price,
        stock, category_id, slug, publisher,
        pages, publish_date,
        description_en, description_de,
        meta_title_en, meta_title_de,
        meta_description_en, meta_description_de,
        image, images,
        weight_grams, dimensions, format, edition, binding,
        language, translator, series_name, series_volume, reading_age,
        is_featured, is_new_release, is_bestseller,
        tags,
        rating, review_count, popularity_score,
        work_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        title_en,
        title_de,
        author,
        isbn,
        isbn10,
        isbn13,
        price,
        original_price,
        sale_price,
        stock,
        category_id,
        slug,
        publisher,
        pages,
        publish_date,
        description_en,
        description_de,
        meta_title_en,
        meta_title_de,
        meta_description_en,
        meta_description_de,
        image,
        images,
        weight_grams,
        dimensions,
        format,
        edition,
        binding,
        language,
        translator,
        series_name,
        series_volume,
        reading_age,
        is_featured,
        is_new_release,
        is_bestseller,
        tags,
        rating,
        review_count,
        popularity_score,
        work_id
      ]);

      const bookId = result.insertId;

      // Update pivot book_authors if authorIds provided
      if (authorIds.length) {
        const values = authorIds.map(aid => [bookId, aid]);
        const placeholders = values.map(() => '(?, ?)').join(', ');
        await conn.query(
          `INSERT INTO book_authors (book_id, author_id) VALUES ${placeholders}`,
          values.flat()
        );
      }

      await conn.commit();

      // ✅ Fetch and fulfill (outside transaction OK)
      const [[newBook]] = await db.execute(
        `SELECT id, title_en, title_de, isbn13, isbn10 FROM books WHERE id = ? LIMIT 1`,
        [bookId]
      );
      if (newBook) {
        await fulfillRequestsForBook(db, transporter, newBook, req);
      }

      res.json({ success: true, id: bookId, message: 'Book added successfully' });
    } catch (err) {
      await conn.rollback();
      console.error('ADD BOOK ERROR:', err);
      res.status(500).json({ error: 'Failed to add book', details: err.message });
    } finally {
      conn.release();
    }
  });

  // PUT /api/books/:id — UPDATE BOOK (NOW SAVES ALL FIELDS)

  // backend/server.js — PUT /api/books/:id (updated, many-to-many authors, no author_id)
  app.put('/api/books/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;

    // SAFE DEFAULTS — NEVER UNDEFINED
    const title_en = body.title_en || null;
    const title_de = body.title_de || body.title_en || null;
    const author = body.author || null; // legacy display text (may be comma-separated)
    const isbn = body.isbn || null;
    const isbn10 = body.isbn10 || null;
    const isbn13 = body.isbn13 || null;
    const price = parseFloat(body.price) || 0;
    const original_price = body.original_price ? parseFloat(body.original_price) : null;
    const sale_price = body.sale_price ? parseFloat(body.sale_price) : null;
    const stock = parseInt(body.stock) || 0;
    const category_id = parseInt(body.category_id) || 1;
    const slug = body.slug || (body.title_en || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const publisher = body.publisher || null;
    const pages = body.pages ? parseInt(body.pages) : null;
    const publish_date = body.publish_date || null;
    const description_en = body.description_en || null;
    const description_de = body.description_de || body.description_en || null;
    const meta_title_en = body.meta_title_en || body.title_en || null;
    const meta_title_de = body.meta_title_de || `${body.title_en || ''} von ${body.author || ''} – Jetzt kaufen`;
    const meta_description_en = body.meta_description_en || null;
    const meta_description_de = body.meta_description_de || null;
    const image = body.image || null;
    const images = body.images ? JSON.stringify(body.images) : null;
    const weight_grams = body.weight_grams ? parseInt(body.weight_grams) : null;
    const dimensions = body.dimensions || null;
    const format = body.format || 'Paperback';
    const edition = body.edition || null;
    const binding = body.binding || null;
    const language = body.language || 'EN';
    const translator = body.translator || null;
    const series_name = body.series_name || null;
    const series_volume = body.series_volume || null;
    const reading_age = body.reading_age || null;
    const is_featured = body.is_featured ? 1 : 0;
    const is_new_release = body.is_new_release ? 1 : 0;
    const is_bestseller = body.is_bestseller ? 1 : 0;
    const tags = body.tags || null;
    const rating = parseFloat(body.rating) || 0;
    const review_count = parseInt(body.review_count) || 0;
    const popularity_score = parseFloat(body.popularity_score) || 0;
    const work_id = body.work_id || computeWorkId(title_en, title_de, author);

    // Many-to-many authors (optional)
    const authorIds = Array.isArray(body._authorIds)
      ? [...new Set(body._authorIds.map(n => Number(n)).filter(Boolean))]
      : [];

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.execute(`
      UPDATE books SET
        title_en = ?, title_de = ?, author = ?, isbn = ?, isbn10 = ?, isbn13 = ?,
        price = ?, original_price = ?, sale_price = ?, stock = ?, category_id = ?,
        slug = ?, publisher = ?, pages = ?, publish_date = ?,
        description_en = ?, description_de = ?, meta_title_en = ?, meta_title_de = ?,
        meta_description_en = ?, meta_description_de = ?, image = ?, images = ?,
        weight_grams = ?, dimensions = ?, format = ?, edition = ?, binding = ?,
        language = ?, translator = ?, series_name = ?, series_volume = ?, reading_age = ?,
        is_featured = ?, is_new_release = ?, is_bestseller = ?, tags = ?,
        rating = ?, review_count = ?, popularity_score = ?,
        work_id = ?
      WHERE id = ?
    `, [
        title_en, title_de, author, isbn, isbn10, isbn13,
        price, original_price, sale_price, stock, category_id,
        slug, publisher, pages, publish_date,
        description_en, description_de, meta_title_en, meta_title_de,
        meta_description_en, meta_description_de, image, images,
        weight_grams, dimensions, format, edition, binding,
        language, translator, series_name, series_volume, reading_age,
        is_featured, is_new_release, is_bestseller, tags,
        rating, review_count, popularity_score,
        work_id, id
      ]);

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Book not found' });
      }

      // Update pivot if authorIds provided
      if (authorIds.length >= 0) { // allow clearing authors
        await conn.execute('DELETE FROM book_authors WHERE book_id = ?', [id]);
        if (authorIds.length) {
          const values = authorIds.map(aid => [id, aid]);
          const placeholders = values.map(() => '(?, ?)').join(', ');
          await conn.query(
            `INSERT INTO book_authors (book_id, author_id) VALUES ${placeholders}`,
            values.flat()
          );
        }
      }

      await conn.commit();

      // ✅ Fetch and fulfill
      const [[updatedBook]] = await db.execute(
        `SELECT id, title_en, title_de, isbn13, isbn10 FROM books WHERE id = ? LIMIT 1`,
        [id]
      );
      if (updatedBook) {
        await fulfillRequestsForBook(db, transporter, updatedBook, req);
      }

      res.json({ success: true, message: 'Book updated successfully' });
    } catch (err) {
      await conn.rollback();
      console.error('UPDATE BOOK ERROR:', err);
      res.status(500).json({ error: 'Database error', details: err.message });
    } finally {
      conn.release();
    }
  });


  // === AUTHORS API ===
  // List authors
  app.get('/api/authors', async (req, res) => {
    try {
      let [rows] = await db.execute(`
      SELECT id, name, bio, photo, created_at, updated_at
      FROM authors
      ORDER BY name ASC
    `);

      const origin = `${req.protocol}://${req.get('host')}`;
      const norm = (p) => !p ? null : (p.startsWith('http') ? p : `${origin}${p.startsWith('/') ? '' : '/'}${p}`);
      rows = rows.map(r => ({ ...r, photo: norm(r.photo) }));

      res.json(rows);
    } catch (err) {
      console.error('GET /api/authors error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get one author
  app.get('/api/authors/:id', async (req, res) => {
    try {
      const [[row]] = await db.execute(`
      SELECT id, name, bio, photo, created_at, updated_at
      FROM authors
      WHERE id = ?
    `, [req.params.id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      //res.json(row);

      const origin = `${req.protocol}://${req.get('host')}`;
      const norm = (p) => !p ? null : (p.startsWith('http') ? p : `${origin}${p.startsWith('/') ? '' : '/'}${p}`);
      res.json({ ...row, photo: norm(row.photo) });

    } catch (err) {
      console.error('GET /api/authors/:id error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Create author

  app.post('/api/authors', async (req, res) => {
    const { name, bio, photo } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    try {
      const slug = slugifyStrict(name);
      const [result] = await db.execute(
        `INSERT INTO authors (name, bio, photo, slug) VALUES (?, ?, ?, ?)`,
        [name.trim(), bio || null, photo || null, slug]
      );
      const id = result.insertId;
      const [[author]] = await db.execute('SELECT id, name, bio, photo, slug FROM authors WHERE id = ?', [id]);

      const origin = `${req.protocol}://${req.get('host')}`;
      const norm = (p) => !p ? null : (p.startsWith('http') ? p : `${origin}${p.startsWith('/') ? '' : '/'}${p}`);

      res.json({ ...author, photo: norm(author.photo) });
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'An author with a similar slug already exists. Rename slightly.' });
      }
      console.error('POST /api/authors error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });


  // Update author

  app.put('/api/authors/:id', async (req, res) => {
    const { name, bio, photo } = req.body || {};
    try {
      const slug = name ? slugifyStrict(name) : null;

      const [result] = await db.execute(`
      UPDATE authors
      SET
        name = COALESCE(?, name),
        bio = COALESCE(?, bio),
        photo = COALESCE(?, photo),
        slug = COALESCE(?, slug)
      WHERE id = ?`,
        [name ? name.trim() : null, bio ?? null, photo ?? null, slug, req.params.id]
      );

      if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });

      const [[author]] = await db.execute('SELECT id, name, bio, photo, slug FROM authors WHERE id = ?', [req.params.id]);

      const origin = `${req.protocol}://${req.get('host')}`;
      const norm = (p) => !p ? null : (p.startsWith('http') ? p : `${origin}${p.startsWith('/') ? '' : '/'}${p}`);

      res.json({ ...author, photo: norm(author.photo) });
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'An author with a similar slug already exists. Rename slightly.' });
      }
      console.error('PUT /api/authors/:id error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });


  app.get('/api/authors/slug/:slug', async (req, res) => {
    const [rows] = await db.execute(
      `SELECT id, name, bio, photo, slug FROM authors WHERE slug = ? LIMIT 1`,
      [String(req.params.slug || '').toLowerCase()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Author not found' });

    const origin = `${req.protocol}://${req.get('host')}`;
    const a = rows[0];
    const norm = (p) => !p ? null : (p.startsWith('http') ? p : `${origin}${p.startsWith('/') ? '' : '/'}${p}`);

    res.json({ ...a, photo: norm(a.photo) });
  });


  app.get('/api/authors/:id/books', async (req, res) => {
    const authorId = req.params.id;

    const [rows] = await db.execute(
      `SELECT b.*
     FROM books b
     JOIN book_authors ba ON ba.book_id = b.id
     WHERE ba.author_id = ?
     ORDER BY b.created_at DESC`,
      [authorId]
    );

    res.json(rows);
  });



  // FETCH THE BOOK COVER AND SAVE IT IN APPL. SERVER FROM GOOGLE BOOKS / OPEN LIBRARY
  app.get('/api/fetch-and-save-cover', async (req, res) => {
    const { url } = req.query;
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Valid image URL required' });
    }

    try {
      //console.log('Downloading cover from:', url);

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BookstoreBot/1.0)',
        },
      });

      const contentType = response.headers['content-type'] || 'image/jpeg';
      const ext = contentType.includes('png') ? '.png' :
        contentType.includes('webp') ? '.webp' : '.jpg';

      const filename = `cover-${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
      const filepath = path.join(__dirname, 'uploads', 'books', filename);

      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filepath, response.data);

      const localUrl = `/uploads/books/${filename}`;
      //console.log('Cover saved locally:', localUrl);

      res.json({ url: localUrl });
    } catch (err) {
      console.error('Failed to download/save cover:', err.message);
      // STILL RETURN THE REMOTE URL AS FALLBACK
      res.json({ url }); // ← This prevents total failure
    }
  });

  app.post('/api/translate', async (req, res) => {
    const { text = [], target = 'de' } = req.body;

    // Safety: always accept single string or array
    const texts = Array.isArray(text) ? text : [text];

    try {
      const response = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        body: JSON.stringify({
          q: texts,
          source: 'en',
          target: target,
          format: 'text'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      // LibreTranslate returns { translatedText: [...] } or single string
      const translated = Array.isArray(data.translatedText)
        ? data.translatedText
        : Array.isArray(data)
          ? data.map(d => d.translatedText)
          : texts; // fallback

      res.json({ translated });
    } catch (err) {
      console.warn('LibreTranslate down → returning English');
      res.json({ translated: texts }); // graceful fallback
    }
  });

  // BOOK IMAGE UPLOAD
  app.post('/api/upload-book-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/books/${req.file.filename}` });
  });

  // CATEGORY IMAGE UPLOAD
  app.post('/api/upload-image', uploadCategoryIcon.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/categories/${req.file.filename}`;
    res.json({ url });
  });

  app.delete('/api/books/:id', async (req, res) => {
    try {
      const [result] = await db.execute('DELETE FROM books WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Book not found' });
      res.json({ message: 'Book deleted' });
    } catch (err) {
      console.error('DELETE /api/books/:id error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // === CATEGORY APIs (UPDATED WITH ICON) ===
  // server.js
  app.get('/api/categories', async (req, res) => {
    try {
      const [rows] = await db.execute(`
      SELECT id, name_en, name_de, slug, icon_path, parent_id, is_visible 
      FROM categories 
      ORDER BY parent_id, id
    `);
      res.json(rows);
    } catch (err) {
      console.error('GET /api/categories error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.get('/api/categories/dropdown', async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT id, name_en FROM categories ORDER BY name_en');
      res.json(rows);
    } catch (err) {
      console.error('GET /api/categories/dropdown error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.post('/api/categories', uploadCategoryIcon.single('icon'), async (req, res) => {
    const { name_en, name_de, slug } = req.body;
    const icon_path = req.file ? `/uploads/categories/${req.file.filename}` : null;

    const finalSlug = slug || name_en?.toLowerCase().replace(/\s+/g, '-');

    try {
      const [result] = await db.execute(
        'INSERT INTO categories (name_en, name_de, slug, icon_path) VALUES (?, ?, ?, ?)',
        [name_en || 'Untitled', name_de || 'Unbenannt', finalSlug, icon_path]
      );
      res.json({ id: result.insertId, name_en, name_de, slug: finalSlug, icon_path });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // server.js → PUT /api/categories/:id
  // server.js
  app.put('/api/categories/:id', uploadCategoryIcon.single('icon'), async (req, res) => {
    const { id } = req.params;
    const { name_en, name_de, slug, is_visible } = req.body;
    const icon_path = req.file ? `/uploads/categories/${req.file.filename}` : undefined;

    const updates = {};
    if (name_en !== undefined) updates.name_en = name_en.trim() || 'Untitled';
    if (name_de !== undefined) updates.name_de = name_de.trim() || 'Unbenannt';
    if (slug !== undefined) updates.slug = slug.trim() || name_en?.toLowerCase().replace(/\s+/g, '-');
    if (is_visible !== undefined) updates.is_visible = is_visible === '1' ? 1 : 0;
    if (icon_path) updates.icon_path = icon_path;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No data to update' });
    }

    try {
      const [result] = await db.execute(
        `UPDATE categories SET ${Object.keys(updates).map(k => `${k}=?`).join(', ')} WHERE id = ?`,
        [...Object.values(updates), id]
      );

      if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });

      const [updated] = await db.execute('SELECT * FROM categories WHERE id = ?', [id]);
      res.json(updated[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    try {
      const [result] = await db.execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Category not found' });
      res.json({ message: 'Category deleted' });
    } catch (err) {
      console.error('DELETE /api/categories/:id error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Descendant-aware category listing (MySQL 8+)
  app.get('/api/books/category/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid category id' });
    }

    try {
      const sql = `
      WITH RECURSIVE cat_tree AS (
        SELECT id FROM categories WHERE id = ?
        UNION ALL
        SELECT c.id
        FROM categories c
        INNER JOIN cat_tree ct ON c.parent_id = ct.id
      )
      SELECT
        b.id, b.title_en, b.title_de, b.author, b.price, b.original_price, b.image, b.slug,
        b.isbn13, b.isbn10, b.rating, b.review_count
      FROM books b
      WHERE b.category_id IN (SELECT id FROM cat_tree)
      ORDER BY b.created_at DESC
      LIMIT 20
    `;
      const [rows] = await db.execute(sql, [id]);
      res.json(rows);
    } catch (err) {
      console.error('GET /api/books/category/:id (tree) error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.get('/api/categories-with-books', async (req, res) => {
    try {
      const [categories] = await db.execute('SELECT id, name_en, name_de, icon_path FROM categories ORDER BY name_en');
      const results = await Promise.all(
        categories.map(async (cat) => {
          const [books] = await db.execute(`
            SELECT id, title_en, title_de, author, price, original_price, image, slug
            FROM books WHERE category_id = ? ORDER BY created_at DESC LIMIT 10
          `, [cat.id]);
          return { category: cat, books };
        })
      );
      res.json(results);
    } catch (err) {
      console.error('GET /api/categories-with-books error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // ADD THIS ANYWHERE IN YOUR SERVER FILE (after your other routes)




  // --- Recommendations using JSON_TABLE on orders.order_items (MySQL 8+) ---
  app.get('/api/books/:id/recommendations', async (req, res) => {
    const bookId = Number(req.params.id);
    if (!bookId) return res.status(400).json({ error: 'Invalid book id' });

    try {
      // Current book context
      const [[book]] = await db.execute('SELECT author, category_id FROM books WHERE id = ?', [bookId]);
      if (!book) return res.status(404).json({ error: 'Book not found' });

      const { author, category_id } = book;

      // 1) Same author
      const [sameAuthor] = await db.execute(
        `SELECT id, slug, rating, review_count, title_en, title_de, author, image, price, original_price, isbn13, isbn10
       FROM books
       WHERE author = ? AND id != ?
       LIMIT 8`,
        [author, bookId]
      );

      // 2) Customers who bought this also bought (orders with this book → other books in those orders)
      const [alsoBought] = await db.execute(
        `
      SELECT DISTINCT b.id, b.slug, b.rating, b.review_count, b.title_en, b.title_de, b.author, b.image, b.price, b.original_price, b.isbn10, b.isbn13
      FROM orders o
      JOIN JSON_TABLE(o.order_items, '$[*]'
        COLUMNS (
          bookId INT PATH '$.bookId'
        )
      ) AS jt1
        ON jt1.bookId = ?
      JOIN JSON_TABLE(o.order_items, '$[*]'
        COLUMNS (
          otherBookId INT PATH '$.bookId'
        )
      ) AS jt2
        ON jt2.otherBookId != ?
      JOIN books b
        ON b.id = jt2.otherBookId
      LIMIT 8
      `,
        [bookId, bookId]
      );

      // 3) Similar category
      const [similar] = await db.execute(
        `SELECT id, slug, rating, review_count, title_en, title_de, author, image, price, original_price, isbn13, isbn10
       FROM books
       WHERE category_id = ? AND id != ?
       LIMIT 12`,
        [category_id, bookId]
      );

      res.json({ sameAuthor, alsoBought, similar });
    } catch (err) {
      console.error('Recommendations error:', err);
      // Return an empty payload on failure (no nested res.status in the object)
      res.status(500).json({ sameAuthor: [], alsoBought: [], similar: [] });
    }
  });

  // FETCH RECOMMENDATIONS IN THE CART PAGE
  app.post('/api/cart/recommendations', async (req, res) => {
    const bookIds = req.body.bookIds || [];
    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      return res.json({ sameAuthor: [], alsoBought: [], similar: [] });
    }

    try {
      // Fetch authors and categories for all books in the cart
      const [books] = await db.query(
        `SELECT id, author, category_id FROM books WHERE id IN (${bookIds.map(() => '?').join(',')})`,
        bookIds
      );

      if (!books.length) {
        return res.json({ sameAuthor: [], alsoBought: [], similar: [] });
      }

      const authors = [...new Set(books.map(b => b.author))];
      const categories = [...new Set(books.map(b => b.category_id))];

      // Same author recommendations
      const [sameAuthor] = await db.query(
        `SELECT id, slug, title_en, title_de, author, image, price, original_price
       FROM books
       WHERE author IN (${authors.map(() => '?').join(',')})
       AND id NOT IN (${bookIds.map(() => '?').join(',')})
       LIMIT 12`,
        [...authors, ...bookIds]
      );

      // Similar category recommendations
      const [similar] = await db.query(
        `SELECT id, slug, title_en, title_de, author, image, price, original_price
       FROM books
       WHERE category_id IN (${categories.map(() => '?').join(',')})
       AND id NOT IN (${bookIds.map(() => '?').join(',')})
       LIMIT 12`,
        [...categories, ...bookIds]
      );

      // Also bought recommendations
      const [alsoBought] = await db.query(
        `
      SELECT DISTINCT b.id, b.slug, b.title_en, b.title_de, b.author, b.image, b.price, b.original_price
      FROM orders o
      JOIN JSON_TABLE(o.order_items, '$[*]'
        COLUMNS (bookId INT PATH '$.bookId')
      ) jt1 ON jt1.bookId IN (${bookIds.map(() => '?').join(',')})
      JOIN JSON_TABLE(o.order_items, '$[*]'
        COLUMNS (otherBookId INT PATH '$.bookId')
      ) jt2 ON jt2.otherBookId NOT IN (${bookIds.map(() => '?').join(',')})
      JOIN books b ON b.id = jt2.otherBookId
      LIMIT 12
      `,
        [...bookIds, ...bookIds]
      );

      // Deduplicate results
      const dedupe = arr => {
        const seen = new Set();
        return arr.filter(b => {
          if (seen.has(b.id)) return false;
          seen.add(b.id);
          return true;
        });
      };

      res.json({
        sameAuthor: dedupe(sameAuthor),
        alsoBought: dedupe(alsoBought),
        similar: dedupe(similar)
      });
    } catch (err) {
      console.error('Cart recommendations error:', err);
      res.status(500).json({ sameAuthor: [], alsoBought: [], similar: [] });
    }
  });

  // =============================================
  //               REVIEWS API
  // =============================================

  // 1. GET all reviews for a book + stats
  app.get('/api/books/:bookId/reviews', async (req, res) => {
    const { bookId } = req.params;
    try {
      const [rows] = await db.execute(`
      SELECT 
        r.id,
        r.rating,
        r.review_text,
        r.reviewer_name,
        r.created_at,
        r.user_id,             -- IMPORTANT: we need to know if this was logged-in user
        u.first_name,
        u.last_name,
        u.photo_url            -- pick the photo from the DB
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.book_id = ?
      ORDER BY r.created_at DESC
    `, [bookId]);

      const origin = `${req.protocol}://${req.get('host')}`; // e.g., http://localhost:3001

      const reviews = rows.map(r => {
        const displayName =
          r.reviewer_name ||
          (r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : 'Anonymous');

        // Only attach the photo if it's a logged-in review with a photo in DB
        let reviewer_photo_url = null;
        if (r.user_id && r.photo_url) {
          if (r.photo_url.startsWith('http://') || r.photo_url.startsWith('https://')) {
            reviewer_photo_url = r.photo_url;
          } else if (r.photo_url.startsWith('/')) {
            reviewer_photo_url = `${origin}${r.photo_url}`;
          } else {
            reviewer_photo_url = `${origin}/${r.photo_url}`;
          }
        }

        return {
          id: r.id,
          rating: r.rating,
          review_text: r.review_text,
          reviewer_name: displayName,
          reviewer_photo_url, // absolute URL for authenticated reviews; null for guests
          created_at: r.created_at
        };
      });

      res.json(reviews);
    } catch (err) {
      console.error('GET /api/books/:bookId/reviews error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // 2. GET review stats (average + distribution)
  // GET review stats – 100% safe even with zero reviews
  app.get('/api/books/:bookId/reviews/stats', async (req, res) => {
    const { bookId } = req.params;

    try {
      // 1. Get average + total
      const [[avgRow]] = await db.execute(`
      SELECT 
        COALESCE(AVG(rating), 0) AS average,
        COUNT(*) AS total
      FROM reviews 
      WHERE book_id = ?
    `, [bookId]);

      // 2. Get distribution
      const [distRows] = await db.execute(`
      SELECT rating, COUNT(*) AS count
      FROM reviews 
      WHERE book_id = ? AND rating IS NOT NULL
      GROUP BY rating
    `, [bookId]);

      // Build distribution object safely
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      distRows.forEach(row => {
        if (row.rating >= 1 && row.rating <= 5) {
          distribution[row.rating] = row.count;
        }
      });

      // avgRow.average is already a number (0 if null thanks to COALESCE)
      const average = Number(avgRow.average || 0);
      const total = Number(avgRow.total || 0);

      res.json({
        average: Number(average.toFixed(2)),   // safe now
        total,
        distribution
      });

    } catch (err) {
      console.error('GET review stats error:', err);
      // Even if something explodes, never crash the server
      res.json({
        average: 0,
        total: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      });
    }
  });

  // 3. POST a new review (authenticated or guest)
  app.post('/api/books/:bookId/reviews', async (req, res) => {
    const { bookId } = req.params;
    const { rating, review_text, reviewer_name } = req.body;
    const userId = req.isAuthenticated() ? req.user.id : null;

    // THIS IS THE FIX
    let displayName = 'Anonymous';
    if (userId && req.user) {
      // Build name exactly like you do in GET reviews
      displayName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim();
      if (!displayName) displayName = req.user.email?.split('@')[0] || 'User';
    } else if (reviewer_name?.trim()) {
      displayName = reviewer_name.trim();
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating 1–5 required' });
    }
    if (!review_text || review_text.trim().length < 20) {
      return res.status(400).json({ message: 'Review must be at least 20 characters' });
    }

    try {
      await db.execute(`
      INSERT INTO reviews (book_id, user_id, rating, review_text, reviewer_name, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [bookId, userId, rating, review_text.trim(), displayName]);

      // Update book averages
      await db.execute(`
      UPDATE books b
      SET rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE book_id = b.id),
          review_count = (SELECT COUNT(*) FROM reviews WHERE book_id = b.id)
      WHERE b.id = ?
    `, [bookId]);

      res.json({ success: true, message: 'Review submitted!' });
    } catch (err) {
      console.error('POST review error:', err);
      res.status(500).json({ error: 'Failed to submit review' });
    }
  });


  // END OF REVIEW ROUTES//

  /***************************************************************** */

  // ADD THIS: Find book by ISBN (13 or 10) — supports both
  app.get('/api/books/by-isbn/:isbn', async (req, res) => {
    const { isbn } = req.params;
    if (!isbn || isbn.length < 10) {
      return res.status(400).json({ error: 'Invalid ISBN' });
    }
    try {
      const [rows] = await db.execute(
        `SELECT id, title_en, title_de, author, isbn13, isbn10, image, price, original_price
       FROM books
       WHERE isbn13 = ? OR isbn10 = ?
       LIMIT 1`,
        [isbn, isbn]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Book not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error('by-isbn error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ADD THIS: Find book by slug (title) — fallback when no ISBN
  app.get('/api/books/by-slug/:slug', async (req, res) => {
    const { slug } = req.params;
    try {
      const [rows] = await db.execute(
        `SELECT id, slug, title_en, title_de, author, isbn13, isbn10, image, price, original_price
       FROM books
       WHERE slug = ?
          OR REPLACE(LOWER(title_en), ' ', '-') LIKE ?
          OR REPLACE(LOWER(title_de), ' ', '-') LIKE ?
       LIMIT 1`,
        [slug, `%${slug}%`, `%${slug}%`]
      );

      if (rows.length === 0) return res.status(404).json({ error: 'Book not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error('by-slug error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });


  // GET wishlist
  app.get('/api/wishlist', authMiddleware, async (req, res) => {
    try {
      const [rows] = await db.execute(`
      SELECT 
        b.*,
        w.id AS wishlist_id,
        w.created_at AS wishlist_added_at,
        w.deleted_at   -- ← useful for future "you removed this on X" messages
      FROM wishlist w
      JOIN books b ON w.book_id = b.id
      WHERE w.user_id = ? 
        AND w.deleted_at IS NULL        -- ← ONLY ACTIVE items
      ORDER BY w.created_at DESC
    `, [req.user.id]);

      // Keep your frontend happy — it expects { books: [...] }
      res.json({ books: rows });
    } catch (err) {
      console.error('GET /api/wishlist error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/wishlist/toggle', authMiddleware, async (req, res) => {
    const { book_id } = req.body;
    const userId = req.user.id;

    if (!book_id) return res.status(400).json({ error: 'book_id required' });

    try {
      // Check current active status (not deleted)
      const [[active]] = await db.execute(
        `SELECT id, deleted_at FROM wishlist 
       WHERE user_id = ? AND book_id = ? AND deleted_at IS NULL`,
        [userId, book_id]
      );

      if (active) {
        // Currently in wishlist → soft delete (remove)
        await db.execute(
          'UPDATE wishlist SET deleted_at = NOW() WHERE id = ?',
          [active.id]
        );
        return res.json({
          added: false,
          message: 'Removed from wishlist',
          deleted_at: new Date().toISOString()
        });
      } else {
        // Not in active wishlist → add or restore
        const [[existing]] = await db.execute(
          'SELECT id FROM wishlist WHERE user_id = ? AND book_id = ?',
          [userId, book_id]
        );

        if (existing) {
          // Was previously removed → restore it
          await db.execute(
            'UPDATE wishlist SET deleted_at = NULL WHERE id = ?',
            [existing.id]
          );
          return res.json({
            added: true,
            message: 'Added back to wishlist',
            restored: true
          });
        } else {
          // Never added before → insert new
          const [result] = await db.execute(
            'INSERT INTO wishlist (user_id, book_id, deleted_at) VALUES (?, ?, NULL)',
            [userId, book_id]
          );
          return res.json({
            added: true,
            message: 'Added to wishlist',
            id: result.insertId
          });
        }
      }
    } catch (err) {
      console.error('Wishlist toggle error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // === AUTH ROUTES ===
  app.use('/api/auth', require('./routes/auth')(db, transporter));

  app.get('/api/auth/verify-email', async (req, res) => {
    const { token } = req.query;
    try {
      const [[user]] = await db.execute(
        'SELECT id FROM users WHERE verification_token = ? AND verification_expires > NOW() AND email_verified_at IS NULL',
        [token]
      );
      if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

      await db.execute(
        'UPDATE users SET email_verified_at = NOW(), verification_token = NULL, verification_expires = NULL WHERE id = ?',
        [user.id]
      );

      await logUserAction(db, {
        user_id: user.id,
        action: 'email_verified',
        changed_by: user.id,
        changed_by_role: 'user',
        req
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  // GOOGLE LOGIN CALLBACK — FIXED & AUDIT LOGGED
  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login?error=failed` }),
    async (req, res) => {
      // req.user IS NOW AVAILABLE HERE
      const user = req.user;
      const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
      const ua = req.headers['user-agent'] || 'unknown';

      try {
        // LOG SUCCESSFUL GOOGLE LOGIN
        await logLoginAttempt(db, {
          email: user.email,
          user_id: user.id,
          success: true,
          method: 'google',
          ip,
          user_agent: ua
        });

        await logUserAction(db, {
          user_id: user.id,
          action: 'login',
          changed_by: user.id,
          changed_by_role: user.role || 'user',
          new_data: { method: 'google', ip, user_agent: ua },
          req
        });

        // Send success message to frontend
        res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Login Success</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage('google-login-success', '${process.env.FRONTEND_URL}');
                window.close();
              } else {
                window.location.href = '${process.env.FRONTEND_URL}/dashboard';
              }
            </script>
          </body>
        </html>
      `);
      } catch (err) {
        console.error('GOOGLE LOGIN AUDIT ERROR:', err);
        res.status(500).send('Login failed');
      }
    }
  );

  app.get('/api/current-user', (req, res) => {
    if (req.isAuthenticated() && req.user) {

      const origin = `${req.protocol}://${req.get('host')}`;
      const rawPhoto = req.user.photo_url || null;

      const photoURL =
        rawPhoto
          ? (rawPhoto.startsWith('http://') || rawPhoto.startsWith('https://'))
            ? rawPhoto
            : rawPhoto.startsWith('/')
              ? `${origin}${rawPhoto}`
              : `${origin}/${rawPhoto}`
          : null;

      // Compute initials on the server
      const first = req.user.first_name || '';
      const last = req.user.last_name || '';
      const displayName = `${first} ${last}`.trim() || req.user.email?.split('@')[0] || 'User';
      const initials = displayName
        .split(' ')
        .filter(Boolean)
        .map(s => s[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      res.json({
        id: req.user.id,
        displayName: req.user.first_name,
        email: req.user.email,
        role: req.user.role,
        language: req.user.language,
        first_name: req.user.first_name || '',
        last_name: req.user.last_name || '',
        photoURL,
        initials,
        customPic: req.user.custom_pic || 0,
        created_at: req.user.created_at || null,
        email_verified_at: req.user.email_verified_at || null
      });
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });

  // FINAL LOGOUT WITH AUDIT LOG
  app.get('/api/logout', async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.json({ message: 'Already logged out' });
    }

    const user = req.user;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    try {
      // LOG LOGOUT
      await logLogout(db, {
        user_id: user.id,
        email: user.email,
        ip,
        user_agent: ua
      });

      await logUserAction(db, {
        user_id: user.id,
        action: 'logout',
        changed_by: user.id,
        changed_by_role: user.role,
        new_data: { method: 'manual', ip, user_agent: ua },
        req
      });

      req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
          return res.status(500).json({ error: 'Logout failed' });
        }
        req.session.destroy(() => {
          res.clearCookie('connect.sid');
          res.json({ message: 'Logged out successfully' });
        });
      });

    } catch (err) {
      console.error('LOGOUT AUDIT ERROR:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // === CART ===
  app.get('/api/cart', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    try {

      const [rows] = await db.execute(`
  SELECT
    ci.book_id AS bookId,
    ci.quantity,
    b.id,                  -- keep id for BookCard where needed
    b.slug,
    b.title_en,
    b.title_de,
    b.author,
    b.price,
    b.original_price,
    b.sale_price,
    b.image,
    b.stock,
    b.rating,
    b.review_count,
    b.isbn10,
    b.isbn13
  FROM cart_items ci
  JOIN books b ON ci.book_id = b.id
  WHERE ci.user_id = ?
`, [req.user.id]);

      res.json({ items: rows });
    } catch (err) {
      console.error('GET /api/cart error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // backend/server.js → POST /api/cart/merge

  // backend/server.js → POST /api/cart/merge
  app.post('/api/cart/merge', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true });
    }

    try {
      // ✅ Clean + validate incoming items
      const cleaned = items
        .map(i => ({
          bookId: Number(i.bookId),
          quantity: Math.max(1, Number(i.quantity) || 1),
        }))
        .filter(i => Number.isFinite(i.bookId) && i.bookId > 0);

      if (cleaned.length === 0) {
        return res.json({ success: true });
      }

      const values = cleaned.map(i => [req.user.id, i.bookId, i.quantity]);
      const placeholders = values.map(() => '(?, ?, ?)').join(', ');
      const flatValues = values.flat();

      // ✅ Server qty wins:
      // - inserts missing books
      // - ignores existing (user_id, book_id) rows
      await db.execute(
        `
      INSERT IGNORE INTO cart_items (user_id, book_id, quantity)
      VALUES ${placeholders}
      `,
        flatValues
      );

      res.json({ success: true });
    } catch (err) {
      console.error('POST /api/cart/merge error:', err);
      res.status(500).json({ error: err.message });
    }
  });


  app.post('/api/cart/add', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    const { bookId, quantity = 1 } = req.body;
    try {
      //console.log('cart add');
      await db.execute(`
        INSERT INTO cart_items (user_id, book_id, quantity) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE quantity = quantity + ?
      `, [req.user.id, bookId, quantity, quantity]);
      res.json({ success: true });
    } catch (err) {
      console.error('POST /api/cart/add error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/cart/update', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    const { bookId, quantity } = req.body;
    try {
      if (quantity <= 0) {
        await db.execute('DELETE FROM cart_items WHERE user_id = ? AND book_id = ?', [req.user.id, bookId]);
      } else {
        await db.execute('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND book_id = ?', [quantity, req.user.id, bookId]);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('PUT /api/cart/update error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/cart/remove/:bookId', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    try {
      await db.execute('DELETE FROM cart_items WHERE user_id = ? AND book_id = ?', [req.user.id, req.params.bookId]);
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE /api/cart/remove error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cart/clear', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    try {
      await db.execute('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('POST /api/cart/clear error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- Shipping quote for Checkout ---
  // POST /api/checkout/quote
  // Body: { to_zip, to_city, items: [{ bookId, quantity }] }
  // Returns: { cheapest, parcel_dimensions_cm, weight_grams_used }
  app.post('/api/checkout/quote', async (req, res) => {
    try {
      const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
      const { to_zip, to_city, items } = req.body || {};
      if (!to_zip || !Array.isArray(items) || !items.length) {
        return res.status(400).json({ error: 'bad_request' });
      }

      // 1) Resolve per-line weights + dimensions (re-use your existing route)
      const weightsResp = await axios.post(
        `${BASE_URL}/api/cart/weights`,
        { items },
        { timeout: 15000, withCredentials: true }
      );
      const weighted = (weightsResp.data?.items || []).map(row => ({
        quantity: Number(row.quantity) || 1,
        weight_grams: row.weight_grams ?? 500,
        // DB -> API: height=face height, width=face width, thickness=spine
        height_cm: row.height_cm ?? 20,
        width_cm: row.width_cm ?? 13,
        thickness_cm: row.thickness_cm ?? 3
      }));

      // 2) Ask Shippo via your own rates route (cache + dims already handled)
      const ratesResp = await axios.post(
        `${BASE_URL}/api/shippo/rates`,
        { to_zip, to_city, items: weighted },
        { timeout: 20000 }
      );

      const data = ratesResp.data || {};
      return res.json({
        cheapest: data.cheapest || null,
        parcel_dimensions_cm: data.parcel_dimensions_cm || null,
        weight_grams_used: data.weight_grams_used || null
      });
    } catch (err) {
      console.error('[checkout/quote] error:', err?.response?.data || err?.message || err);
      return res.status(500).json({ error: 'quote_failed' });
    }
  });

  // === CHECKOUT (NO EMAIL) ===
  app.post('/api/checkout', async (req, res) => {
    const { email, items, total } = req.body;
    const userId = req.isAuthenticated() ? req.user.id : null;

    if (!items?.length) return res.status(400).json({ error: 'Cart empty' });

    try {
      const [result] = await db.execute('INSERT INTO orders (user_id, email, total) VALUES (?, ?, ?)', [userId, email, total]);
      const orderId = result.insertId;

      const values = items.map(i => [orderId, i.bookId, i.quantity, i.price]);
      //await db.execute('INSERT INTO order_items (order_id, book_id, quantity, price) VALUES ?', [values]);

      if (userId) {
        await db.execute('DELETE FROM cart_items WHERE user_id = ?', [userId]);
      }

      res.json({ success: true, orderId });
    } catch (err) {
      console.error('POST /api/checkout error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // === STRIPE PAYMENT INTENT - 100% WORKING WITH YOUR SERVER.JS ===
  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });


  // Update the amount of the existing PaymentIntent (subtotal + shipping)
  // POST /api/orders/update-payment-intent-amount
  // Body: { clientSecret, amount_cents }
  app.post('/api/orders/update-payment-intent-amount', async (req, res) => {
    try {
      const { clientSecret, amount_cents } = req.body || {};
      if (!clientSecret || !Number.isFinite(Number(amount_cents)) || amount_cents <= 0) {
        return res.status(400).json({ error: 'bad_request' });
      }
      // Extract pi id from clientSecret: 'pi_..._secret_...'
      const piId = String(clientSecret).split('_secret_')[0];
      const pi = await stripe.paymentIntents.update(piId, { amount: Number(amount_cents) });
      return res.json({ ok: true, paymentIntent: { id: pi.id, status: pi.status, amount: pi.amount } });
    } catch (err) {
      console.error('[orders/update-payment-intent-amount] error:', err?.message || err);
      return res.status(500).json({ error: 'pi_update_failed' });
    }
  });


  // === ORDER ROUTES ===
  app.use('/api/orders', require('./routes/orderRoutes')(db));

  app.use('/admin/wishlist', require('./routes/admin/wishlist')(db));
  app.use('/api/admin/cart', require('./routes/admin/cart')(db));

  app.use('/api/cart', require('./routes/cartWeights')(db));

  // AFTER app.use('/api/orders', ...)
  app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripeWebhook = require('./webhook/stripeWebhook');
    await stripeWebhook(req, res, db);
  });

  // === START SERVER ===
  /*const PORT = 3001;

  //const path = require('path');

  // 1) Serve static frontend
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(distPath));

  // 2) SPA fallback for everything that is NOT an API or static/upload route
  app.get(/^\/(?!api|uploads|webhook|auth).*//*, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });*/


  // === START SERVER ===
  const PORT = process.env.PORT || 3001;

  // 1) Serve static frontend
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(distPath));

  // 2) SPA fallback for everything that is NOT an API or static/upload route
  app.get(/^\/(?!api|uploads|webhook|auth).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });

})();