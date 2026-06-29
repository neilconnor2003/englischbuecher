// backend/server.js
require('dotenv').config();


//console.log('DB_USER:', process.env.DB_USER);
//console.log('DB_HOST:', process.env.DB_HOST);



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

const cron = require('node-cron');
const Anthropic = require('@anthropic-ai/sdk');

const dpdRoutes = require('./routes/dpd');
//('✅ LOADING dpd routes from:', require.resolve('./routes/dpd'));

const FRONTEND_URL = process.env.FRONTEND_URL;

//const ACTIVE_SENTINEL = '1970-01-01 00:00:01';
const ACTIVE_SENTINEL = '1969-12-31T23:00:01.000Z'
const VERIFIED_SENTINEL = '1970-01-01 00:00:01';

//const bookEnrichmentRoutes = require('./routes/bookEnrichmentRoutes');
const createBookEnrichmentRoutes = require('./routes/bookEnrichmentRoutes');

// MOVE TRANSPORTER HERE — OUTSIDE async() — GLOBAL
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  //secure: false,
  secure: true,   // ✅ VERY IMPORTANT for 465 (SSL)
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
  dest: path.join(__dirname, 'uploads', 'books'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Images only!'));
  }
});


const XLSX = require('xlsx');

const uploadExcel = multer({
  dest: path.join(__dirname, 'uploads', 'excel')
});


// ===== Book image storage: <ISBN>-<counter>.<ext> =====
const bookImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', 'books');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },

  filename: (req, file, cb) => {
    // ✅ Prefer query param because req.body might be empty here (order issue)
    const cleanIsbn = String(req.query.isbn || req.body?.isbn || '')
      .replace(/\D/g, '');

    // If ISBN not available, use a safe fallback
    const base = cleanIsbn || 'manual';

    // ✅ Determine extension (some uploads have no original extension)
    const extFromOriginal = path.extname(file.originalname || '').toLowerCase();
    const extFromMime =
      file.mimetype === 'image/png' ? '.png' :
        file.mimetype === 'image/webp' ? '.webp' :
          file.mimetype === 'image/gif' ? '.gif' : '.jpg';

    const ext = extFromOriginal || extFromMime;

    // ✅ Counter to avoid overwriting
    const dir = path.join(__dirname, 'uploads', 'books');
    let counter = 1;
    let filename = `${base}-${counter}${ext}`;

    while (fs.existsSync(path.join(dir, filename))) {
      counter += 1;
      filename = `${base}-${counter}${ext}`;
    }

    cb(null, filename);
  }
});

const uploadBookImage = multer({
  storage: bookImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // mimetype is more reliable than extension
    if (/^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
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
          const { buildEmail, SENDER_NAME } = require('./utils/emailTemplate');
          // Look up the user's language preference — book_requests doesn't store it
          let lang = 'de';
          if (reqRow.user_id) {
            const [[userLang]] = await db.execute('SELECT language FROM users WHERE id = ?', [reqRow.user_id]);
            lang = userLang?.language || 'de';
          }
          const isDe = lang === 'de';
          const bookTitle = title_en || title_de || '';
          const bookUrl = `${process.env.FRONTEND_URL}/book/${slugifyTitle(bookTitle)}-${isbn13 || isbn10 || ''}-${bookId}`;
          const reqSubject = isDe ? 'Dein Buchwunsch ist jetzt verfügbar!' : 'Your requested book is now available!';
          const bodyHtml = `
            <p style="font-size:17px;font-weight:600;color:#1a1a2e;margin:0 0 14px;">${isDe ? `Hallo ${reqRow.requester_name || ''},` : `Hi ${reqRow.requester_name || ''},`}</p>
            <p style="font-size:15px;color:#444;margin:0 0 20px;">${isDe ? 'Gute Neuigkeiten! Das Buch, das du angefragt hast, ist jetzt verfügbar:' : 'Good news! The book you requested is now available:'}</p>
            <div style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 24px;font-size:14px;color:#333;">
              ${bookTitle ? `<strong>${isDe ? 'Titel' : 'Title'}:</strong> ${bookTitle}<br>` : ''}
              ${isbn13 ? `<strong>ISBN-13:</strong> ${isbn13}<br>` : ''}
              ${isbn10 ? `<strong>ISBN-10:</strong> ${isbn10}` : ''}
            </div>
            ${reqRow.user_id
              ? `<p style="font-size:15px;color:#444;margin:0 0 20px;">${isDe ? 'Wir haben es auch deiner Wunschliste hinzugefügt.' : "We've also added it to your wishlist."}</p>`
              : `<p style="font-size:15px;color:#444;margin:0 0 20px;">${isDe ? 'Melde dich an, um es deiner Wunschliste hinzuzufügen.' : 'Log in to add it to your wishlist.'}</p>`
            }
            <div style="text-align:center;margin:24px 0;">
              <a href="${bookUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#5e42d6);color:#fff;padding:14px 36px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 6px 20px rgba(124,58,237,0.35);">${isDe ? 'Jetzt kaufen' : 'Buy Now'}</a>
            </div>
            <div style="font-size:15px;color:#333;margin-top:28px;">
              ${isDe ? 'Viele Grüße,' : 'Best regards,'}<br>
              <strong style="color:#7c3aed;">${isDe ? `Dein ${SENDER_NAME} Team` : `Your ${SENDER_NAME} Team`}</strong>
            </div>
          `;
          const html = buildEmail({ lang, title: reqSubject, headerTitle: isDe ? 'Dein Buchwunsch!' : 'Your Book Request!', headerEmoji: '📚', bodyHtml });
          await transporter.sendMail({ from: `"${SENDER_NAME}" <${process.env.SMTP_USER}>`, to, subject: reqSubject, html });
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
      const origin = `${req.protocol}://${req.get('host')}`;
      const url = `${origin}/uploads/authors/${req.file.filename}`;
      res.json({ url });
    });
  });

  const allowedOrigins = new Set([
    "http://localhost:4173",
    "http://localhost:5173",
    "https://englischbuecher.netlify.app",
    "https://dev--englischbuecher.netlify.app",
    "https://englischbuecher.de",
    "https://www.englischbuecher.de",
  ]);

  app.use(cors({
    origin: function (origin, callback) {
      // allow curl/postman (no Origin header)
      if (!origin) return callback(null, true);

      // Allow Netlify branch deploys like https://dev--englischbuecher.netlify.app
      if (origin.endsWith(".netlify.app")) return callback(null, true);

      if (allowedOrigins.has(origin)) return callback(null, true);

      return callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    //allowedHeaders: ['Content-Type', 'Authorization'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-debug-from'],
    optionsSuccessStatus: 204
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
      secure: true,          // ✅ REQUIRED for HTTPS
      httpOnly: true,
      sameSite: 'none',      // ✅ REQUIRED for cross-domain
      maxAge: 24 * 60 * 60 * 1000
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

    // Send welcome email — only fires for NEW users (this block is skipped for returning users)
    try {
      const { sendWelcomeEmail } = require('./utils/email');
      const juice = require('juice');
      const nodemailer = require('nodemailer');
      const welcomeTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 465,
        secure: parseInt(process.env.SMTP_PORT) !== 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false },
      });
      await sendWelcomeEmail(
        welcomeTransporter,
        user.email,
        user.given_name || 'there',
        'google',
        'de'   // default to DE; language not yet known at registration time
      );
    } catch (mailErr) {
      console.error('[Google] Welcome email failed (non-fatal):', mailErr.message);
    }

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


  app.get('/api/admin/email-logs', authMiddleware, async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
      const offset = (page - 1) * limit;

      const status = (req.query.status || '').trim();
      const type = (req.query.type || '').trim();
      const search = (req.query.search || '').trim();

      let where = [];
      let params = [];

      if (status) {
        where.push('status = ?');
        params.push(status);
      }

      if (type) {
        where.push('type = ?');
        params.push(type);
      }

      if (search) {
        where.push('(to_email LIKE ? OR subject LIKE ? OR error LIKE ?)');
        const like = `%${search}%`;
        params.push(like, like, like);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const [rows] = await db.query(
        `
      SELECT id, to_email, subject, status, error, type, created_at
      FROM sent_emails
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
        [...params, limit, offset]
      );

      const [[countRow]] = await db.query(
        `
      SELECT COUNT(*) AS total
      FROM sent_emails
      ${whereSql}
      `,
        params
      );

      res.json({
        rows,
        total: countRow.total,
        page,
        limit
      });

    } catch (err) {
      console.error('GET /api/admin/email-logs error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });


  app.get('/api/admin/email-logs/:id', authMiddleware, async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const [rows] = await db.query(
        `
      SELECT id, to_email, subject, html, status, error, type, created_at
      FROM sent_emails
      WHERE id = ?
      LIMIT 1
      `,
        [req.params.id]
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Email log not found' });
      }

      res.json(rows[0]);

    } catch (err) {
      console.error('GET /api/admin/email-logs/:id error:', err);
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


  app.get('/api/books/isbn/:isbn', async (req, res) => {
    const { isbn } = req.params;

    try {
      const googleRes = await axios.get(
        'https://www.googleapis.com/books/v1/volumes',
        {
          params: {
            q: `isbn:${isbn}`,
            key: process.env.GOOGLE_BOOKS_API_KEY,
          },
        }
      );

      if (googleRes.data.totalItems > 0) {
        return res.json({ source: 'google', data: googleRes.data });
      }

      // fallback to OpenLibrary
      const olRes = await axios.get(
        `https://openlibrary.org/api/books`,
        {
          params: {
            bibkeys: `ISBN:${isbn}`,
            format: 'json',
            jscmd: 'data',
          },
        }
      );

      return res.json({ source: 'openlibrary', data: olRes.data });
    }
    catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'ISBN lookup failed' });
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



  // ── POST /api/user/change-password ──────────────────────────
  app.post('/api/user/change-password', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both fields required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    try {
      const [[user]] = await db.execute('SELECT password, registration_method FROM users WHERE id = ?', [req.user.id]);
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.registration_method === 'google') return res.status(400).json({ error: 'Google accounts cannot change password here' });
      const bcrypt = require('bcrypt');
      const valid = await bcrypt.compare(current_password, user.password || '');
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      const hashed = await bcrypt.hash(new_password, 12);
      await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── GET /api/user/reviews ────────────────────────────────────
  app.get('/api/user/reviews', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [rows] = await db.execute(
        `SELECT r.id, r.rating, r.review_text, r.created_at,
                b.id AS book_id, b.title_en, b.title_de, b.image, b.slug, b.isbn13
         FROM reviews r
         JOIN books b ON b.id = r.book_id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC`,
        [req.user.id]
      );
      res.json(rows);
    } catch (err) {
      console.error('GET /api/user/reviews error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── GET/PUT /api/user/address ────────────────────────────────
  app.get('/api/user/address', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [[row]] = await db.execute('SELECT default_address FROM users WHERE id = ?', [req.user.id]);
      const addr = row?.default_address
        ? (typeof row.default_address === 'string' ? JSON.parse(row.default_address) : row.default_address)
        : {};
      res.json(addr);
    } catch (err) {
      console.error('GET /api/user/address error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.put('/api/user/address', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    const { address, postalCode, city, country } = req.body;
    try {
      await db.execute('UPDATE users SET default_address = ? WHERE id = ?',
        [JSON.stringify({ address, postalCode, city, country }), req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('PUT /api/user/address error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── GET/PUT /api/user/notify-prefs ──────────────────────────
  app.get('/api/user/notify-prefs', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [[row]] = await db.execute('SELECT notify_prefs FROM users WHERE id = ?', [req.user.id]);
      const saved = row?.notify_prefs
        ? (typeof row.notify_prefs === 'string' ? JSON.parse(row.notify_prefs) : row.notify_prefs)
        : {};
      const defaults = { review_requests: true, restock: true, wallet_credits: true, newsletter: true };
      res.json({ ...defaults, ...saved });
    } catch (err) {
      console.error('GET /api/user/notify-prefs error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.put('/api/user/notify-prefs', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const allowed = ['review_requests', 'restock', 'wallet_credits', 'newsletter'];
      const prefs = {};
      allowed.forEach(k => { if (req.body[k] !== undefined) prefs[k] = !!req.body[k]; });
      await db.execute('UPDATE users SET notify_prefs = ? WHERE id = ?',
        [JSON.stringify(prefs), req.user.id]);

      // Sync newsletter toggle with newsletter_subscribers table
      if (req.body.newsletter !== undefined) {
        const isOn = !!req.body.newsletter;
        const lang = req.user.language || 'de';
        if (isOn) {
          await db.execute(
            `INSERT INTO newsletter_subscribers (email, language, source, is_active, unsubscribe_token, created_at)
             VALUES (?, ?, 'profile', 1, UUID(), NOW())
             ON DUPLICATE KEY UPDATE is_active = 1, unsubscribed_at = NULL`,
            [req.user.email, lang]
          ).catch(() => {});
        } else {
          await db.execute(
            `UPDATE newsletter_subscribers SET is_active = 0, unsubscribed_at = NOW() WHERE email = ?`,
            [req.user.email]
          ).catch(() => {});
        }
      }
      res.json({ success: true });
    } catch (err) {
      console.error('PUT /api/user/notify-prefs error:', err);
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


  // Record number of views per user per session in a day
  // ── REPLACES: app.post('/api/books/:id/view', ...) ─────────
  // Same dedup behavior as before, PLUS: upserts into
  // recently_viewed for logged-in users (guests handled by
  // localStorage on the frontend, no server call needed for them).
  app.post('/api/books/:id/view', async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      if (!bookId) return res.status(400).json({ error: 'Invalid book id' });

      const userId = req.user?.id || null;

      if (userId) {
        const [rows] = await db.execute(
          `SELECT 1 FROM book_views
         WHERE book_id = ? AND user_id = ? AND viewed_at >= NOW() - INTERVAL 1 DAY
         LIMIT 1`,
          [bookId, userId]
        );

        // Recently-viewed list updates on every page load regardless of the
        // once-a-day view-count dedup above — re-viewing a book should bump
        // it back to the top of "recently viewed" even if it doesn't count
        // as a fresh stat for analytics purposes.
        await db.execute(`
        INSERT INTO recently_viewed (user_id, book_id, viewed_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE viewed_at = NOW()
      `, [userId, bookId]).catch(err => {
          console.error('recently_viewed upsert failed (non-fatal):', err.message);
        });

        if (rows.length > 0) {
          return res.json({ success: true, skipped: true });
        }
      }

      await db.execute(`INSERT INTO book_views (user_id, book_id) VALUES (?, ?)`, [userId, bookId]);
      res.json({ success: true });
    } catch (err) {
      console.error('Book view error:', err);
      res.status(500).json({ error: 'Failed to record view' });
    }
  });
  /*app.post('/api/books/:id/view', async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      if (!bookId) return res.status(400).json({ error: 'Invalid book id' });

      const userId = req.user?.id || null;

      // ✅ Optional: prevent duplicate views in short time window
      // For logged-in users: 1 view per day
      if (userId) {
        const [rows] = await db.execute(
          `
        SELECT 1 FROM book_views
        WHERE book_id = ?
          AND user_id = ?
          AND viewed_at >= NOW() - INTERVAL 1 DAY
        LIMIT 1
        `,
          [bookId, userId]
        );

        if (rows.length > 0) {
          return res.json({ success: true, skipped: true });
        }
      }

      await db.execute(
        `
      INSERT INTO book_views (user_id, book_id)
      VALUES (?, ?)
      `,
        [userId, bookId]
      );

      res.json({ success: true });
    } catch (err) {
      console.error('Book view error:', err);
      res.status(500).json({ error: 'Failed to record view' });
    }
  });*/


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
        //console.log('No featured books found – returning empty array');
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
      // Step 1: fetch a larger raw pool first
      const [rows] = await db.execute(`
      SELECT
        b.id,
        b.title_en,
        b.title_de,
        b.author,
        b.price,
        b.original_price,
        b.stock,
        b.image,
        b.slug,
        b.isbn13,
        b.isbn10,
        b.rating,
        b.review_count,
        b.series_name,
        b.series_volume,
        b.publish_date,
        b.created_at,
        b.popularity_score,
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
      ORDER BY
        (COALESCE(agg.total_quantity, 0) * 10) +
        (COALESCE(b.popularity_score, 0) * 5) +
        (TIMESTAMPDIFF(DAY, b.created_at, NOW()) * -0.1)
      DESC
      LIMIT 100
    `);

      const origin = `${req.protocol}://${req.get('host')}`;

      const normalizeImage = (url) => {
        if (!url) return null;
        if (url.startsWith('https://')) return url;
        if (url.startsWith('http://')) return url.replace('http://', 'https://');
        if (url.startsWith('/')) return `${origin}${url}`;
        return `${origin}/${url}`;
      };

      const normalizedRows = rows.map((b) => ({
        ...b,
        image: normalizeImage(b.image),
      }));

      // Step 2: dedupe only real series
      const seriesMap = new Map();
      const standaloneBooks = [];

      for (const book of normalizedRows) {
        const hasValidSeries =
          book.series_name &&
          String(book.series_name).trim() !== '' &&
          book.series_volume !== null &&
          book.series_volume !== undefined &&
          String(book.series_volume).trim() !== '';

        if (!hasValidSeries) {
          standaloneBooks.push(book);
          continue;
        }

        const seriesKey = String(book.series_name).trim().toLowerCase();

        if (!seriesMap.has(seriesKey)) {
          seriesMap.set(seriesKey, book);
          continue;
        }

        const existing = seriesMap.get(seriesKey);

        const existingPublishDate = new Date(existing.publish_date || 0).getTime();
        const currentPublishDate = new Date(book.publish_date || 0).getTime();

        if (currentPublishDate > existingPublishDate) {
          seriesMap.set(seriesKey, book);
          continue;
        }

        // tie-breaker: higher popularity wins
        if (currentPublishDate === existingPublishDate) {
          const existingScore =
            (Number(existing.total_quantity || 0) * 10) +
            (Number(existing.popularity_score || 0) * 5);

          const currentScore =
            (Number(book.total_quantity || 0) * 10) +
            (Number(book.popularity_score || 0) * 5);

          if (currentScore > existingScore) {
            seriesMap.set(seriesKey, book);
          }
        }
      }

      // Step 3: rebuild final pool, keep same ranking order, then cap at 20
      const deduped = [...standaloneBooks, ...Array.from(seriesMap.values())]
        .sort((a, b) => {
          const scoreA =
            (Number(a.total_quantity || 0) * 10) +
            (Number(a.popularity_score || 0) * 5) +
            (new Date(a.created_at || 0).getTime() / 1000000000000);

          const scoreB =
            (Number(b.total_quantity || 0) * 10) +
            (Number(b.popularity_score || 0) * 5) +
            (new Date(b.created_at || 0).getTime() / 1000000000000);

          return scoreB - scoreA;
        })
        .slice(0, 20);

      res.json(deduped);
    } catch (err) {
      console.error('GET /api/books/popular error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // =========================================================
  // ADD THESE 3 ROUTES TO YOUR server.js (or a new routes file)
  // =========================================================
  // ── GET /api/admin/newsletter/log ──────────────────────────
  // Admin-only: view the full subscribe/unsubscribe history.
  // Optional ?email=x filters to one person's full timeline.
  app.get('/api/admin/newsletter/log', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    try {
      const email = req.query.email ? String(req.query.email).trim().toLowerCase() : null;
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);

      const [rows] = email
        ? await db.query(
          'SELECT * FROM newsletter_subscription_log WHERE email = ? ORDER BY created_at DESC LIMIT ?',
          [email, limit]
        )
        : await db.query(
          'SELECT * FROM newsletter_subscription_log ORDER BY created_at DESC LIMIT ?',
          [limit]
        );

      res.json(rows);
    } catch (err) {
      console.error('Newsletter log fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch log' });
    }
  });

  // ── GET /api/newsletter/status ─────────────────────────────
  // Checks whether an email is currently subscribed.
  app.get('/api/newsletter/status', async (req, res) => {
    try {
      const email = String(req.query.email || '').trim().toLowerCase();
      if (!email) return res.json({ subscribed: false });

      const [[row]] = await db.query(
        'SELECT is_active FROM newsletter_subscribers WHERE email = ?',
        [email]
      );
      res.json({ subscribed: !!row?.is_active });
    } catch (err) {
      console.error('Newsletter status error:', err);
      res.json({ subscribed: false });
    }
  });

  // ── POST /api/newsletter/subscribe ─────────────────────────
  // Adds an email to newsletter_subscribers. Idempotent —
  // re-subscribing an existing (even unsubscribed) email re-activates it.

  app.post('/api/newsletter/subscribe', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const language = req.body?.language === 'en' ? 'en' : 'de';
      const source = String(req.body?.source || 'homepage').slice(0, 50);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }

      const token = crypto.randomBytes(24).toString('hex');

      // Check existing state BEFORE the upsert, so we know whether this is
      // a brand-new subscriber or someone re-opting-in after unsubscribing —
      // needed to log the correct action type below.
      const [[existing]] = await db.query(
        'SELECT is_active FROM newsletter_subscribers WHERE email = ?',
        [email]
      );
      const logAction = !existing
        ? 'subscribed'
        : existing.is_active
          ? 'subscribed' // already active, re-submitted — still log as a subscribe event
          : 'resubscribed';

      await db.execute(`
        INSERT INTO newsletter_subscribers (email, language, source, is_active, unsubscribe_token, created_at)
        VALUES (?, ?, ?, 1, ?, NOW())
        ON DUPLICATE KEY UPDATE
          is_active = 1,
          unsubscribed_at = NULL,
          language = VALUES(language)
      `, [email, language, source, token]);

      // Permanent audit log entry — never updated or deleted, just appended to.
      await db.execute(`
        INSERT INTO newsletter_subscription_log (email, action, language, source, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [email, logAction, language, source, req.ip || null]).catch(err => {
        console.error('Newsletter log insert failed (non-fatal):', err.message);
      });

      // Fetch the token actually stored (a re-subscribe keeps the original token,
      // so the JS variable above may not match what's in the DB).
      const [[subRow]] = await db.query(
        'SELECT unsubscribe_token FROM newsletter_subscribers WHERE email = ?',
        [email]
      );
      const realToken = subRow?.unsubscribe_token || token;
      // Built from the incoming request rather than an env var, so this
      // works correctly on both dev and prod with zero configuration —
      // same pattern already used elsewhere in this file for image URLs.
      const apiOrigin = `${req.protocol}://${req.get('host')}`;
      const unsubscribeUrl = `${apiOrigin}/api/newsletter/unsubscribe?token=${realToken}`;

      // Send a welcome email — best effort, don't fail the request if this errors
      let subject = '';
      let html = '';
      try {
        const isDe = language === 'de';
        const sourceLabel = source === 'homepage'
          ? (isDe ? 'unserer Startseite' : 'our homepage')
          : (isDe ? `"${source}"` : `"${source}"`);

        subject = isDe
          ? 'Willkommen beim englischbücher.de Newsletter! 📚'
          : 'Welcome to the englischbücher.de newsletter! 📚';

        html = isDe ? `
          <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
            <div style="background:linear-gradient(135deg,#1f1633,#3b1d6e);padding:36px 32px;border-radius:16px 16px 0 0;text-align:center;">
              <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#c4b5fd;text-transform:uppercase;margin-bottom:10px;">englischbücher.de</div>
              <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">Willkommen an Bord! 🎉</h1>
            </div>
            <div style="padding:32px;border:1px solid #ede9fe;border-top:none;border-radius:0 0 16px 16px;">
              <p style="color:#1a1a2e;font-size:15px;line-height:1.6;margin:0 0 16px;">
                Danke, dass du dich über ${sourceLabel} angemeldet hast! Du bekommst ab jetzt:
              </p>
              <ul style="color:#1a1a2e;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 24px;">
                <li>📖 Benachrichtigungen über neue englische Bücher</li>
                <li>💰 Exklusive Rabatte und Angebote</li>
                <li>✨ Empfehlungen und Autoren-Spotlights</li>
              </ul>
              <div style="text-align:center;margin:28px 0;">
                <a href="${process.env.FRONTEND_URL}/books" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Bücher entdecken</a>
              </div>
              <p style="color:#9ca3af;font-size:12px;text-align:center;margin:24px 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">
                Du erhältst diese E-Mail, weil du dich für unseren Newsletter angemeldet hast.<br>
                <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Abbestellen</a>
              </p>
            </div>
          </div>
        ` : `
          <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
            <div style="background:linear-gradient(135deg,#1f1633,#3b1d6e);padding:36px 32px;border-radius:16px 16px 0 0;text-align:center;">
              <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#c4b5fd;text-transform:uppercase;margin-bottom:10px;">englischbücher.de</div>
              <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">Welcome aboard! 🎉</h1>
            </div>
            <div style="padding:32px;border:1px solid #ede9fe;border-top:none;border-radius:0 0 16px 16px;">
              <p style="color:#1a1a2e;font-size:15px;line-height:1.6;margin:0 0 16px;">
                Thanks for signing up via ${sourceLabel}! From now on you'll get:
              </p>
              <ul style="color:#1a1a2e;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 24px;">
                <li>📖 Heads-up on new English book arrivals</li>
                <li>💰 Exclusive discounts and deals</li>
                <li>✨ Recommendations and author spotlights</li>
              </ul>
              <div style="text-align:center;margin:28px 0;">
                <a href="${process.env.FRONTEND_URL}/books" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Browse books</a>
              </div>
              <p style="color:#9ca3af;font-size:12px;text-align:center;margin:24px 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">
                You're receiving this email because you signed up for our newsletter.<br>
                <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
              </p>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: email,
          subject,
          html,
        });

        // Log to sent_emails so admins can see this in the existing
        // email logs view, same pattern as review-request emails.
        await db.query(`
          INSERT INTO sent_emails (to_email, subject, html, status, type, created_at)
          VALUES (?, ?, ?, 'sent', 'Newsletter', NOW())
        `, [email, subject, html]).catch(() => { });
      } catch (mailErr) {
        console.error('Newsletter welcome email failed:', mailErr.message);

        // Log the failure too, so admins can see bounces/errors, not just successes
        await db.query(`
          INSERT INTO sent_emails (to_email, subject, html, status, error, type, created_at)
          VALUES (?, ?, ?, 'failed', ?, 'Newsletter', NOW())
        `, [email, subject, html, mailErr.message]).catch(() => { });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Newsletter subscribe error:', err);
      res.status(500).json({ error: 'Subscription failed' });
    }
  });

  // ── GET /api/newsletter/unsubscribe ────────────────────────
  app.get('/api/newsletter/unsubscribe', async (req, res) => {
    const renderPage = (message) => `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>englischbücher.de</title></head>
        <body style="font-family:-apple-system,'Segoe UI',sans-serif;background:#F6F3FF;margin:0;padding:60px 20px;text-align:center;">
          <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:40px 32px;box-shadow:0 8px 28px rgba(0,0,0,0.08);">
            <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#7C3AED;text-transform:uppercase;margin-bottom:16px;">englischbücher.de</div>
            <p style="color:#1a1a2e;font-size:15px;line-height:1.6;">${message}</p>
            <a href="${process.env.FRONTEND_URL}" style="display:inline-block;margin-top:16px;color:#7C3AED;font-weight:600;text-decoration:none;font-size:14px;">← Back to the homepage</a>
          </div>
        </body>
      </html>
    `;

    try {
      const token = String(req.query.token || '');
      if (!token) return res.status(400).send(renderPage('This unsubscribe link is invalid.'));

      // Fetch first so we have the email + language to log, and so we can
      // tell a fresh unsubscribe apart from a stale/already-used link.
      const [[row]] = await db.query(
        'SELECT email, language, is_active FROM newsletter_subscribers WHERE unsubscribe_token = ?',
        [token]
      );

      if (!row) {
        return res.send(renderPage("This link has already been used, or doesn't exist."));
      }

      if (!row.is_active) {
        // Already unsubscribed previously — don't log a duplicate event
        return res.send(renderPage("You've already been unsubscribed."));
      }

      await db.execute(`
        UPDATE newsletter_subscribers
        SET is_active = 0, unsubscribed_at = NOW()
        WHERE unsubscribe_token = ?
      `, [token]);

      await db.execute(`
        INSERT INTO newsletter_subscription_log (email, action, language, source, ip_address, created_at)
        VALUES (?, 'unsubscribed', ?, 'unsubscribe_link', ?, NOW())
      `, [row.email, row.language, req.ip || null]).catch(err => {
        console.error('Newsletter log insert failed (non-fatal):', err.message);
      });

      res.send(renderPage("You've been unsubscribed. We're sorry to see you go — you can always sign up again from our homepage."));
    } catch (err) {
      console.error('Unsubscribe error:', err);
      res.status(500).send(renderPage('Something went wrong. Please try again later.'));
    }
  });


  // ── GET /api/reviews/recent ────────────────────────────────
  // Central feed of recent, high-quality reviews across all books.
  // Used by the homepage "What Readers Say" section.

  app.get('/api/reviews/recent', async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT r.id, r.rating, r.review_text, r.reviewer_name, r.created_at,
               b.id as book_id, b.title_en, b.title_de, b.slug, b.image, b.author
        FROM reviews r
        JOIN books b ON b.id = r.book_id
        WHERE r.rating >= 4
          AND CHAR_LENGTH(r.review_text) >= 10
        ORDER BY r.created_at DESC
        LIMIT 12
      `);
      res.json(rows);
    } catch (err) {
      console.error('Recent reviews error:', err);
      res.json([]);
    }
  });


  // ── 1. GET /api/stats ─────────────────────────────────────
  // Returns live counts from your DB. Cache 1 hour in memory.
  let statsCache = null;
  let statsCacheTime = 0;

  // Rounds DOWN to the nearest multiple of 10 (e.g. 84 -> 80, 129 -> 120)
  const roundDownTo10 = (n) => Math.floor(n / 10) * 10;

  app.get('/api/stats', async (req, res) => {
    try {
      // Serve from cache if fresh (1 hour)
      if (statsCache && Date.now() - statsCacheTime < 3600000) {
        return res.json(statsCache);
      }

      const [[booksRow]] = await db.query('SELECT COUNT(*) as cnt FROM books WHERE stock > 0');
      const [[readersRow]] = await db.query("SELECT COUNT(DISTINCT user_id) as cnt FROM orders WHERE status = 'delivered'");
      const [[reviewsRow]] = await db.query('SELECT COUNT(*) as cnt FROM reviews');
      // "saving" is a fixed marketing claim — adjust as you like
      const saving = 60;

      statsCache = {
        books: roundDownTo10(booksRow.cnt || 0),
        readers: roundDownTo10(readersRow.cnt || 0),
        saving,
        reviews: Math.round((reviewsRow.cnt || 0) / 1000) || 1,
        // reviews shows as "Xk+" so divide by 1000; fallback 1 means "1K+"
      };
      statsCacheTime = Date.now();

      res.json(statsCache);
    } catch (err) {
      console.error('Stats error:', err);
      // Return safe defaults so the frontend never breaks
      res.json({ books: 1200, readers: 3800, saving: 60, reviews: 890 });
    }
  });


  // ── 2. GET /api/books/book-of-week ────────────────────────
  // Returns whichever book has is_book_of_week = 1.
  // You set this manually in admin (or via the AI cron below).

  app.get('/api/books/book-of-week', async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT b.*, a.name AS author_name
      FROM books b
      LEFT JOIN book_authors ba ON ba.book_id = b.id
      LEFT JOIN authors a ON a.id = ba.author_id
      WHERE b.is_book_of_week = 1
      LIMIT 1
    `);
      if (!rows.length) return res.json(null);
      res.json(rows[0]);
    } catch (err) {
      console.error('Book of week error:', err);
      res.json(null);
    }
  });


  // ── 4. GET /api/books/for-you ──────────────────────────────
  // Logged-in users: recommends books from categories they've
  // ordered, wishlisted, or viewed, weighted by recency.
  // Anonymous users: falls back to a popularity-based mix.

  app.get('/api/books/for-you', async (req, res) => {
    try {
      const isLoggedIn = req.isAuthenticated && req.isAuthenticated() && req.user;

      if (!isLoggedIn) {
        // Anonymous fallback: just return popular books, frontend already
        // has category-section data to build its own "All" mix from.
        return res.json({ personalized: false, books: [] });
      }

      const userId = req.user.id;

      // Step 1: find categories this user has shown interest in
      // (ordered, wishlisted, or viewed in the last 90 days), most recent first
      const [categoryRows] = await db.query(`
        SELECT category_id, MAX(touched_at) as last_touch, COUNT(*) as weight
        FROM (
          SELECT b.category_id, o.created_at as touched_at
          FROM orders o
          JOIN JSON_TABLE(o.order_items, '$[*]'
            COLUMNS (bookId INT PATH '$.bookId')
          ) AS oi ON 1=1
          JOIN books b ON b.id = oi.bookId
          WHERE o.user_id = ?

          UNION ALL

          SELECT b.category_id, w.created_at as touched_at
          FROM wishlist w
          JOIN books b ON b.id = w.book_id
          WHERE w.user_id = ? AND w.deleted_at IS NULL

          UNION ALL

          SELECT b.category_id, v.viewed_at as touched_at
          FROM book_views v
          JOIN books b ON b.id = v.book_id
          WHERE v.user_id = ? AND v.viewed_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        ) AS combined
        WHERE category_id IS NOT NULL
        GROUP BY category_id
        ORDER BY weight DESC, last_touch DESC
        LIMIT 5
      `, [userId, userId, userId]);

      if (!categoryRows.length) {
        // New user with no history yet
        return res.json({ personalized: false, books: [] });
      }

      const categoryIds = categoryRows.map(r => r.category_id);

      // Step 2: books the user already owns/wishlisted (exclude from results)
      const [ownedRows] = await db.query(`
        SELECT DISTINCT b.id
        FROM books b
        LEFT JOIN orders o ON o.user_id = ?
        LEFT JOIN JSON_TABLE(o.order_items, '$[*]'
          COLUMNS (bookId INT PATH '$.bookId')
        ) AS oi ON oi.bookId = b.id
        LEFT JOIN wishlist w ON w.book_id = b.id AND w.user_id = ? AND w.deleted_at IS NULL
        WHERE oi.bookId IS NOT NULL OR w.book_id IS NOT NULL
      `, [userId, userId]);
      const ownedIds = ownedRows.map(r => r.id);
      const excludeClause = ownedIds.length ? `AND b.id NOT IN (${ownedIds.map(() => '?').join(',')})` : '';

      // Step 3: pull books from those categories, prioritizing in-stock + recent
      const [books] = await db.query(`
        SELECT b.*, a.name AS author_name, c.id as cat_id, c.name_en as cat_name_en, c.name_de as cat_name_de
        FROM books b
        LEFT JOIN book_authors ba ON ba.book_id = b.id
        LEFT JOIN authors a ON a.id = ba.author_id
        LEFT JOIN categories c ON c.id = b.category_id
        WHERE b.category_id IN (${categoryIds.map(() => '?').join(',')})
          AND b.stock > 0
          AND b.image IS NOT NULL AND b.image != ''
          ${excludeClause}
        ORDER BY b.popularity_score DESC, b.created_at DESC
        LIMIT 24
      `, [...categoryIds, ...ownedIds]);

      res.json({ personalized: true, books, basedOnCategories: categoryRows.length });
    } catch (err) {
      console.error('For-you error:', err);
      res.json({ personalized: false, books: [] });
    }
  });
  // Returns the author with the most orders in the last 30 days.
  // Fully automatic — no admin intervention needed.

  app.get('/api/authors/featured', async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT
        a.id,
        a.name,
        a.bio,
        a.bio_de,
        a.photo,
        COUNT(oi.bookId) AS order_count
      FROM authors a
      JOIN book_authors ba ON ba.author_id = a.id
      JOIN books b         ON b.id = ba.book_id
      JOIN orders o        ON 1 = 1
      JOIN JSON_TABLE(o.order_items, '$[*]'
        COLUMNS (bookId INT PATH '$.bookId')
      ) AS oi ON oi.bookId = b.id
      WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND a.name IS NOT NULL
      GROUP BY a.id
      ORDER BY order_count DESC
      LIMIT 1
    `);

      if (rows.length) return res.json(rows[0]);

      // Fallback: just pick the author with the most books if no orders yet
      const [fallback] = await db.query(`
      SELECT a.id, a.name, a.bio, a.bio_de, a.photo, COUNT(b.id) as book_count
      FROM authors a
      JOIN book_authors ba ON ba.author_id = a.id
      JOIN books b ON b.id = ba.book_id
      WHERE a.name IS NOT NULL
      GROUP BY a.id
      ORDER BY book_count DESC
      LIMIT 1
    `);
      res.json(fallback[0] || null);
    } catch (err) {
      console.error('Featured author error:', err);
      res.json(null);
    }
  });


  // =========================================================
  // ALSO: Add is_book_of_week column to your books table
  // Run this SQL once in your MySQL:
  // =========================================================
  //
  //   ALTER TABLE books
  //   ADD COLUMN is_book_of_week TINYINT(1) NOT NULL DEFAULT 0;
  //
  //   CREATE INDEX idx_book_of_week ON books(is_book_of_week);
  //
  // Then set one book as book of week in your admin panel,
  // or directly in MySQL:
  //   UPDATE books SET is_book_of_week = 0;  -- clear all
  //   UPDATE books SET is_book_of_week = 1 WHERE id = 123;
  //
  // =========================================================
  // OPTIONAL: Add Book of the Week to your admin Books dashboard
  // In your BookModal / admin books table, add a toggle:
  //   is_book_of_week: checkbox — "Book of the Week"
  // =========================================================

  // ── BOOK OF THE WEEK CRON ─────────────────────────────
  // Paste this block in server.js replacing:
  //   require('./services/bookOfWeekCron');
  //
  // Place it AFTER your DB connection is set up and
  // BEFORE app.listen — it already has access to `db`.
  // Run: npm install node-cron @anthropic-ai/sdk
  // Add to .env: ANTHROPIC_API_KEY=sk-ant-...
  // ──────────────────────────────────────────────────────

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  async function pickBookOfWeek() {
    console.log('[BookOfWeek] Starting weekly pick…');
    try {
      const [candidates] = await db.query(`
        SELECT b.id, b.title_en, b.title_de, b.publish_date,
               a.name AS author_name
        FROM books b
        LEFT JOIN authors a ON b.author_id = a.id
        WHERE b.stock > 0
          AND b.image IS NOT NULL AND b.image != ''
        ORDER BY b.publish_date DESC
        LIMIT 60
      `);

      if (!candidates.length) {
        console.log('[BookOfWeek] No candidates, skipping.');
        return;
      }

      const bookList = candidates
        .map((b, i) =>
          `${i + 1}. ID=${b.id} | "${b.title_en || b.title_de}" by ${b.author_name || 'Unknown'} | Published: ${b.publish_date?.toISOString?.()?.slice(0, 10) || 'Unknown'}`
        )
        .join('\n');

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `You are a book curator for an English-language bookstore in Germany.

From the list below, pick the ONE book that is most likely to be culturally relevant, trending, or noteworthy THIS WEEK globally — considering literary awards, author prominence, seasonal themes, or general public interest.

Respond with ONLY the book ID number. No explanation. Just the number.

Books:
${bookList}`,
        }],
      });

      const responseText = message.content[0]?.text?.trim() || '';
      const idMatch = responseText.match(/\d+/);
      if (!idMatch) {
        console.error('[BookOfWeek] Unexpected Claude response:', responseText);
        return;
      }

      const pickedId = parseInt(idMatch[0], 10);
      const isValid = candidates.some(b => b.id === pickedId);
      if (!isValid) {
        console.error(`[BookOfWeek] Claude returned invalid ID ${pickedId}`);
        return;
      }

      await db.query('UPDATE books SET is_book_of_week = 0 WHERE is_book_of_week = 1');
      await db.query('UPDATE books SET is_book_of_week = 1 WHERE id = ?', [pickedId]);

      const picked = candidates.find(b => b.id === pickedId);
      console.log(`[BookOfWeek] ✅ Picked: "${picked.title_en || picked.title_de}" (ID: ${pickedId})`);

    } catch (err) {
      console.error('[BookOfWeek] Error:', err.message);
    }
  }

  // Run every Monday at 06:00 Berlin time
  cron.schedule('0 6 * * 1', pickBookOfWeek, { timezone: 'Europe/Berlin' });
  console.log('[BookOfWeek] Cron scheduled — every Monday 06:00 Berlin time');

  // On startup: if no book is set, pick one immediately
  db.query('SELECT COUNT(*) as cnt FROM books WHERE is_book_of_week = 1')
    .then(([[row]]) => {
      if (row.cnt === 0) {
        console.log('[BookOfWeek] None set — running initial pick…');
        pickBookOfWeek();
      }
    })
    .catch(err => console.error('[BookOfWeek] Startup check failed:', err.message));

  // ── END BOOK OF THE WEEK CRON ─────────────────────────

  // ── REVIEW REQUEST EMAIL CRON ─────────────────────────────
  // Runs daily at 10:00 Berlin time.
  // Sends up to 3 review-request emails per book purchased,
  // spaced out, stopping once a review is submitted.
  // Add this block in server.js, near your other cron jobs
  // (it reuses the `cron`, `db`, and `transporter` already in scope).

  // Email #1 is sent immediately when the order is marked delivered
  // (handled in orderRoutes.js, not here). This cron sends #2, #3, #4.
  // Gaps from delivery: day 5 (email #2), day 12 (email #3, +7), day 20 (email #4, +8).
  // Mirrors frontend/src/utils/seoUrl.js's generateBookUrl exactly, so links
  // built here in cron emails always match the real route the app serves.
  // Real route shape: /book/{slug}-{isbn}-{id}  (singular "book", not "books")
  function buildBookUrl(book) {
    if (!book) return '/';
    const slug = book.slug || '';
    const isbn = book.isbn13 || book.isbn10 || '';
    const idPart = book.id ? `-${book.id}` : '';
    return `/book/${slug}${isbn ? '-' + isbn : ''}${idPart}`;
  }

  const REVIEW_EMAIL_INTERVALS_DAYS = [7, 8]; // gap from email #2->#3, and #3->#4

  async function sendReviewRequestEmails() {
    console.log('[ReviewRequests] Checking for due emails…');
    try {
      const [due] = await db.query(`
        SELECT rr.id, rr.order_id, rr.user_id, rr.book_id, rr.emails_sent,
               u.email, u.first_name, u.language,
               b.title_en, b.title_de, b.slug, b.image, b.isbn13, b.isbn10
        FROM review_requests rr
        JOIN users u ON u.id = rr.user_id
        JOIN books b ON b.id = rr.book_id
        WHERE rr.stopped = 0
          AND rr.review_submitted = 0
          AND rr.emails_sent < 4
          AND rr.next_send_at <= NOW()
      `);

      if (!due.length) {
        console.log('[ReviewRequests] None due today.');
        return;
      }

      for (const row of due) {
        const isDe = row.language === 'de';
        const title = isDe ? (row.title_de || row.title_en) : (row.title_en || row.title_de);
        const reviewUrl = `${process.env.FRONTEND_URL}${buildBookUrl({ id: row.book_id, slug: row.slug, isbn13: row.isbn13, isbn10: row.isbn10 })}#reviews`;
        const coverImg = row.image || '';

        const subject = isDe
          ? `Wie hat dir "${title}" gefallen?`
          : `How did you like "${title}"?`;

        const html = isDe ? `
          <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
            <div style="background:linear-gradient(135deg,#1f1633,#3b1d6e);padding:36px 32px;border-radius:16px 16px 0 0;text-align:center;">
              <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#c4b5fd;text-transform:uppercase;margin-bottom:10px;">englischbücher.de</div>
              <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">Wie war deine Lektüre? 📖</h1>
            </div>
            <div style="padding:32px;border:1px solid #ede9fe;border-top:none;border-radius:0 0 16px 16px;">
              <p style="color:#1a1a2e;font-size:15px;line-height:1.6;margin:0 0 20px;">
                Hallo ${row.first_name || ''}, wir hoffen, dir hat dieses Buch gefallen!
              </p>
              <div style="text-align:center;margin:0 0 24px;">
                ${coverImg ? `<img src="${coverImg}" alt="${title}" style="width:100px;height:auto;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.15);margin-bottom:14px;">` : ''}
                <div style="font-size:16px;font-weight:700;color:#1a1a2e;">${title}</div>
              </div>
              <p style="color:#1a1a2e;font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
                Hättest du eine Minute Zeit, um eine kurze Bewertung zu hinterlassen? Das hilft anderen Lesern bei ihrer Auswahl sehr.
              </p>
              <div style="text-align:center;margin:0 0 8px;">
                <a href="${reviewUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Jetzt bewerten</a>
              </div>
              <p style="color:#9ca3af;font-size:12px;text-align:center;margin:24px 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">
                Falls du bereits eine Bewertung abgegeben hast, ignoriere diese E-Mail einfach.
              </p>
            </div>
          </div>
        ` : `
          <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
            <div style="background:linear-gradient(135deg,#1f1633,#3b1d6e);padding:36px 32px;border-radius:16px 16px 0 0;text-align:center;">
              <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#c4b5fd;text-transform:uppercase;margin-bottom:10px;">englischbücher.de</div>
              <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">How was your read? 📖</h1>
            </div>
            <div style="padding:32px;border:1px solid #ede9fe;border-top:none;border-radius:0 0 16px 16px;">
              <p style="color:#1a1a2e;font-size:15px;line-height:1.6;margin:0 0 20px;">
                Hi ${row.first_name || ''}, we hope you enjoyed this one!
              </p>
              <div style="text-align:center;margin:0 0 24px;">
                ${coverImg ? `<img src="${coverImg}" alt="${title}" style="width:100px;height:auto;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.15);margin-bottom:14px;">` : ''}
                <div style="font-size:16px;font-weight:700;color:#1a1a2e;">${title}</div>
              </div>
              <p style="color:#1a1a2e;font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
                Could you spare a minute to leave a quick review? It really helps other readers choose their next book.
              </p>
              <div style="text-align:center;margin:0 0 8px;">
                <a href="${reviewUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Leave a review</a>
              </div>
              <p style="color:#9ca3af;font-size:12px;text-align:center;margin:24px 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">
                If you've already left a review, just ignore this email.
              </p>
            </div>
          </div>
        `;

        try {
          await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: row.email,
            subject,
            html,
          });

          const sentCount = row.emails_sent + 1;
          const isLast = sentCount >= 4;
          // sentCount is 2 after sending email #2 -> need gap to #3 (index 0)
          // sentCount is 3 after sending email #3 -> need gap to #4 (index 1)
          const nextGapDays = REVIEW_EMAIL_INTERVALS_DAYS[sentCount - 2] || null;

          await db.query(`
            UPDATE review_requests
            SET emails_sent = ?,
                last_sent_at = NOW(),
                next_send_at = ?,
                stopped = ?
            WHERE id = ?
          `, [
            sentCount,
            nextGapDays ? new Date(Date.now() + nextGapDays * 24 * 60 * 60 * 1000) : null,
            isLast ? 1 : 0,
            row.id,
          ]);

          // Log to your existing sent_emails table for visibility in admin
          await db.query(`
            INSERT INTO sent_emails (to_email, subject, html, status, type, created_at)
            VALUES (?, ?, ?, 'sent', 'ReviewRequest', NOW())
          `, [row.email, subject, html]).catch(() => { });

          console.log(`[ReviewRequests] Sent email ${sentCount}/4 to ${row.email} for book ${row.book_id}`);
        } catch (sendErr) {
          console.error(`[ReviewRequests] Failed to send to ${row.email}:`, sendErr.message);
          // Don't update next_send_at on failure — will retry tomorrow
        }
      }
    } catch (err) {
      console.error('[ReviewRequests] Cron error:', err.message);
    }
  }

  // Run daily at 10:00 Berlin time
  cron.schedule('0 10 * * *', sendReviewRequestEmails, { timezone: 'Europe/Berlin' });
  console.log('[ReviewRequests] Cron scheduled — daily at 10:00 Berlin time');

  // ── END REVIEW REQUEST EMAIL CRON ─────────────────────────




  app.get('/api/series/:slug', async (req, res) => {
    try {
      const { slug } = req.params;

      const normalizedSeries = String(slug || '')
        .toLowerCase()
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // 1) Get all books in the series
      const [bookRows] = await db.execute(`
      SELECT 
        b.*
      FROM books b
      WHERE LOWER(TRIM(b.series_name)) = ?
      ORDER BY
        CASE
          WHEN b.series_volume REGEXP '^[0-9]+(\\.[0-9]+)?$'
            THEN CAST(b.series_volume AS DECIMAL(10,2))
          ELSE 999999
        END ASC,
        b.publish_date ASC,
        b.created_at ASC
    `, [normalizedSeries]);

      if (!bookRows.length) {
        return res.json({
          seriesName: null,
          books: [],
          authors: []
        });
      }

      const origin = `${req.protocol}://${req.get('host')}`;

      const normalizeUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('/')) return `${origin}${url}`;
        return `${origin}/${url}`;
      };

      const books = bookRows.map((b) => ({
        ...b,
        image: normalizeUrl(b.image)
      }));

      // 2) Get ALL DISTINCT authors across ALL books in the series
      const [authorRows] = await db.execute(`
      SELECT DISTINCT
        a.id,
        a.name,
        a.bio,
        a.bio_de,
        a.photo,
        a.slug
      FROM books b
      JOIN book_authors ba
        ON ba.book_id = b.id
      JOIN authors a
        ON a.id = ba.author_id
      WHERE LOWER(TRIM(b.series_name)) = ?
      ORDER BY a.name ASC
    `, [normalizedSeries]);

      const authors = authorRows.map((a) => ({
        ...a,
        photo: normalizeUrl(a.photo)
      }));

      return res.json({
        seriesName: books[0].series_name || normalizedSeries,
        books,
        authors
      });
    } catch (err) {
      console.error('GET /api/series/:slug error:', err);
      return res.status(500).json({ error: 'Failed to fetch series' });
    }
  });




  // backend/server.js — NEW route (keep your existing /api/books)

  app.get('/api/books/listing', async (req, res) => {
    try {
      const {
        q,
        author,
        author_id,   // NEW: filter by author_id via book_authors join
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

      if (author_id) {
        where.push(`b.id IN (SELECT book_id FROM book_authors WHERE author_id = ?)`);
        params.push(Number(author_id));
      }
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


  app.get('/api/books/:id', async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      if (!bookId) return res.status(400).json({ error: 'Invalid id' });

      const [[viewRow]] = await db.execute(
        `SELECT COUNT(*) AS views FROM book_views WHERE book_id = ?`,
        [bookId]
      );

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
      SELECT a.id, a.name, a.bio, a.bio_de, a.photo, a.slug
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
        slug: a.slug,           // ✅ needed by your BookDetails.jsx
        bio: a.bio || '',
        bio_de: a.bio_de ?? null,
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
        views: Number(viewRow.views || 0),
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
      const { author_id, limit } = req.query;

      const where = [];
      const params = [];

      if (author_id) {
        where.push(`b.id IN (SELECT book_id FROM book_authors WHERE author_id = ?)`);
        params.push(Number(author_id));
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const limitSql = limit ? `LIMIT ${Math.min(Math.max(Number(limit) || 50, 1), 100)}` : '';

      const [rows] = await db.execute(`
        SELECT b.*, c.name_en AS categoryName,
        b.isbn13, b.isbn10
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        ${whereSql}
        ORDER BY b.created_at DESC
        ${limitSql}
      `, params);
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

    const height_cm = body.height_cm ? Number(body.height_cm) : null;
    const length_cm = body.length_cm ? Number(body.length_cm) : null;
    const width_cm = body.width_cm ? Number(body.width_cm) : null;

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
    //const tags = body.tags || null;

    const tags = JSON.stringify(
      Array.isArray(body.tags)
        ? body.tags.map(t => String(t).trim()).filter(Boolean)
        : typeof body.tags === 'string'
          ? body.tags.split(',').map(t => t.trim()).filter(Boolean)
          : []
    );

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
        rating, review_count, popularity_score,height_cm, length_cm, width_cm,
        work_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        height_cm,
        length_cm,
        width_cm,
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

    const height_cm = body.height_cm ? Number(body.height_cm) : null;
    const length_cm = body.length_cm ? Number(body.length_cm) : null;
    const width_cm = body.width_cm ? Number(body.width_cm) : null;

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
    //const tags = body.tags || null;

    const tags = JSON.stringify(
      Array.isArray(body.tags)
        ? body.tags.map(t => String(t).trim()).filter(Boolean)
        : typeof body.tags === 'string'
          ? body.tags.split(',').map(t => t.trim()).filter(Boolean)
          : []
    );

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

      // Read old stock BEFORE update so we can detect 0 → positive transition
      const [[beforeUpdate]] = await conn.execute('SELECT stock FROM books WHERE id = ?', [id]);
      const wasOutOfStock = beforeUpdate && Number(beforeUpdate.stock) <= 0;

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
        work_id = ?, height_cm=?, length_cm=?, width_cm=?
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
        work_id, height_cm, length_cm, width_cm, id
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

      // ✅ Fetch and fulfill book requests
      const [[updatedBook]] = await db.execute(
        `SELECT id, title_en, title_de, isbn13, isbn10 FROM books WHERE id = ? LIMIT 1`,
        [id]
      );
      if (updatedBook) {
        await fulfillRequestsForBook(db, transporter, updatedBook, req);

        // Fire restock notifications if stock went 0 → positive via general book edit
        if (wasOutOfStock && stock > 0) {
          sendRestockNotifications(Number(id)).catch(err =>
            console.error('[RestockNotify] book-edit trigger failed:', err.message)
          );
        }
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
      SELECT id, name, bio, bio_de, photo, created_at, updated_at
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
      SELECT id, name, bio, bio_de, photo, created_at, updated_at
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
    const { name, bio, bio_de, photo } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    try {
      const slug = slugifyStrict(name);
      const [result] = await db.execute(
        `INSERT INTO authors (name, bio, bio_de, photo, slug) VALUES (?, ?, ?, ?, ?)`,
        [name.trim(), bio || null, bio_de || null, photo || null, slug]
      );
      const id = result.insertId;
      const [[author]] = await db.execute('SELECT id, name, bio, bio_de, photo, slug FROM authors WHERE id = ?', [id]);

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
    const { name, bio, bio_de, photo } = req.body || {};
    try {
      const slug = name ? slugifyStrict(name) : null;

      const [result] = await db.execute(`
      UPDATE authors
      SET
        name = COALESCE(?, name),
        bio = COALESCE(?, bio),
        bio_de = COALESCE(?, bio_de),
        photo = COALESCE(?, photo),
        slug = COALESCE(?, slug)
      WHERE id = ?`,
        [name ? name.trim() : null, bio ?? null, bio_de ?? null, photo ?? null, slug, req.params.id]
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
      `SELECT id, name, bio, bio_de, photo, slug FROM authors WHERE slug = ? LIMIT 1`,
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
    const { url, isbn } = req.query;   // ✅ accept isbn from frontend
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Valid image URL required' });
    }

    // ✅ sanitize ISBN to digits only (safe filenames)
    const cleanIsbn = String(isbn || '').replace(/\D/g, '');
    const baseName = cleanIsbn.length ? cleanIsbn : `cover-${Date.now()}`;

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookstoreBot/1.0)' },
      });

      const contentType = response.headers['content-type'] || 'image/jpeg';
      const ext =
        contentType.includes('png') ? '.png' :
          contentType.includes('webp') ? '.webp' :
            contentType.includes('gif') ? '.gif' : '.jpg';

      // ✅ ensure directory exists
      const dir = path.join(__dirname, 'uploads', 'books');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // ✅ filename: <ISBN>-<counter>.<ext>
      let counter = 1;
      let filename = `${baseName}-${counter}${ext}`;
      while (fs.existsSync(path.join(dir, filename))) {
        counter += 1;
        filename = `${baseName}-${counter}${ext}`;
      }

      const filepath = path.join(dir, filename);
      fs.writeFileSync(filepath, response.data);

      // ✅ return ABSOLUTE URL so Netlify can load it
      const origin = `${req.protocol}://${req.get('host')}`;
      const absoluteUrl = `${origin}/uploads/books/${filename}`;

      return res.json({ url: absoluteUrl });
    } catch (err) {
      console.error('Failed to download/save cover:', err.message);

      // fallback: force https to reduce mixed-content chances
      const safe = String(url).replace(/^http:\/\//i, 'https://');
      return res.json({ url: safe });
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
  app.post('/api/upload-book-image', uploadBookImage.single('image'), (req, res) => {
    //console.log('FILE:', req.file);
    //console.log('MIMETYPE:', req.file?.mimetype);
    //console.log('SIZE:', req.file?.size);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const origin = `${req.protocol}://${req.get('host')}`;
    res.json({ url: `${origin}/uploads/books/${req.file.filename}` });
  });

  // DELETE A BOOK IMAGE (DB + file system)
  // POST is used (instead of DELETE) to avoid issues with proxies dropping DELETE bodies.
  app.post('/api/books/:id/delete-image', authMiddleware, async (req, res) => {
    const bookId = Number(req.params.id);
    const { imageUrl } = req.body || {};

    if (!bookId || !imageUrl) {
      return res.status(400).json({ error: 'bookId and imageUrl are required' });
    }

    try {
      // 1) Load existing book image fields
      const [[row]] = await db.execute(
        'SELECT image, images FROM books WHERE id = ? LIMIT 1',
        [bookId]
      );
      if (!row) return res.status(404).json({ error: 'Book not found' });

      const origin = `${req.protocol}://${req.get('host')}`;

      // Helper: normalize any URL to a comparable "basename" (filename)
      const getBasename = (u) => {
        try {
          // If absolute URL, parse it
          if (String(u).startsWith('http://') || String(u).startsWith('https://')) {
            const parsed = new URL(u);
            return path.basename(parsed.pathname);
          }
          // If relative path
          return path.basename(String(u));
        } catch {
          return path.basename(String(u));
        }
      };

      const targetBase = getBasename(imageUrl);

      // 2) Parse images array safely
      let imagesArr = [];
      if (row.images) {
        try {
          imagesArr = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
          if (!Array.isArray(imagesArr)) imagesArr = [];
        } catch {
          imagesArr = [];
        }
      }

      // 3) Remove from images array by comparing filename (basename)
      imagesArr = imagesArr.filter(u => getBasename(u) !== targetBase);

      // 4) If main image matches target, clear it (and reassign later)
      let mainImage = row.image || null;
      if (mainImage && getBasename(mainImage) === targetBase) {
        mainImage = null;
      }

      // 5) Re-assign main image if needed
      if (!mainImage) {
        mainImage = imagesArr.length ? imagesArr[0] : null;
      }

      // 6) Save back to DB
      const imagesJson = imagesArr.length ? JSON.stringify(imagesArr) : null;
      await db.execute(
        'UPDATE books SET image = ?, images = ? WHERE id = ?',
        [mainImage, imagesJson, bookId]
      );

      // 7) Delete the file from disk ONLY if it's a local upload under /uploads/books/
      // We delete by filename to avoid any path traversal risk.
      const looksLocal =
        String(imageUrl).includes('/uploads/books/') ||
        String(row.image || '').includes('/uploads/books/') ||
        imagesArr.some(u => String(u).includes('/uploads/books/'));

      // If it looks like a local uploaded image, try deleting the file
      // (Even if not found, that's OK.)
      if (looksLocal) {
        const filePath = path.join(__dirname, 'uploads', 'books', targetBase);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // 8) Respond with updated values (frontend can update UI)
      return res.json({
        success: true,
        image: mainImage ? (mainImage.startsWith('http') ? mainImage : `${origin}${mainImage.startsWith('/') ? '' : '/'}${mainImage}`) : null,
        images: imagesArr,
        deletedFile: looksLocal ? targetBase : null
      });

    } catch (err) {
      console.error('delete-image error:', err);
      return res.status(500).json({ error: 'Failed to delete image', details: err.message });
    }
  });

  // CATEGORY IMAGE UPLOAD
  app.post('/api/upload-image', uploadCategoryIcon.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const origin = `${req.protocol}://${req.get('host')}`;
    res.json({ url: `${origin}/uploads/categories/${req.file.filename}` });
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
  app.get('/api/categories', async (req, res) => {
    try {
      const [rows] = await db.execute(`
      SELECT id, name_en, name_de, slug, icon_path, parent_id, is_visible, updated_at 
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

  // PUT /api/categories/:id
  app.put('/api/categories/:id', uploadCategoryIcon.fields([
    { name: 'icon', maxCount: 1 },
    { name: 'image', maxCount: 1 }
  ]), async (req, res) => {

    const { id } = req.params;
    const { name_en, name_de, slug, is_visible } = req.body;

    // ✅ accept either field name
    const file =
      (req.files?.icon && req.files.icon[0]) ||
      (req.files?.image && req.files.image[0]) ||
      null;

    const icon_path = file ? `/uploads/categories/${file.filename}` : undefined;

    const updates = {};
    if (name_en !== undefined) updates.name_en = name_en.trim() || 'Untitled';
    if (name_de !== undefined) updates.name_de = name_de.trim() || 'Unbenannt';
    if (slug !== undefined) updates.slug = slug.trim() || (name_en ? name_en.toLowerCase().replace(/\s+/g, '-') : undefined);
    if (is_visible !== undefined) updates.is_visible = String(is_visible) === '1' ? 1 : 0;
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
      console.error('PUT /api/categories/:id error:', err);
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
  /*app.get('/api/books/category/:id', async (req, res) => {
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
        b.id, b.title_en, b.title_de, b.author, b.price, b.original_price, b.stock, b.image, b.slug,
        b.isbn13, b.isbn10, b.rating, b.review_count,
        b.series_name, b.publish_date
      FROM books b
      WHERE b.category_id IN (SELECT id FROM cat_tree)
      ORDER BY b.created_at DESC
      LIMIT 100
    `;
      const [rows] = await db.execute(sql, [id]);
      res.json(rows);
    } catch (err) {
      console.error('GET /api/books/category/:id (tree) error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });*/

  app.get('/api/books/category/:id', async (req, res) => {
    const id = Number(req.params.id);
    const excludeSeries = (req.query.excludeSeries || '').toLowerCase().trim();

    try {
      const [rows] = await db.execute(`
      WITH RECURSIVE cat_tree AS (
        SELECT id FROM categories WHERE id = ?
        UNION ALL
        SELECT c.id
        FROM categories c
        INNER JOIN cat_tree ct ON c.parent_id = ct.id
      )
      SELECT b.*
      FROM books b
      WHERE b.category_id IN (SELECT id FROM cat_tree)
    `, [id]);

      const normalize = (s = '') =>
        String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

      let filtered = rows;

      if (excludeSeries) {
        filtered = rows.filter(b =>
          normalize(b.series_name || '') !== normalize(excludeSeries)
        );
      }

      // ✅ sort AFTER filtering
      filtered.sort((a, b) =>
        (b.popularity_score || 0) - (a.popularity_score || 0)
      );

      // ✅ NOW apply limit
      filtered = filtered.slice(0, 20);

      res.json(filtered);

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // ── BATCH: GET /api/home/category-sections-batch ──────────
  // Returns books for ALL visible root categories in ONE request,
  // instead of the frontend firing one request per category.
  // Cache 10 minutes since this data doesn't change every second.

  let categoryBatchCache = null;
  let categoryBatchCacheTime = 0;

  app.get('/api/home/category-sections-batch', async (req, res) => {
    try {
      if (categoryBatchCache && Date.now() - categoryBatchCacheTime < 600000) {
        return res.json(categoryBatchCache);
      }

      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 20);

      const [visibleCats] = await db.query(`
        SELECT id, name_en, name_de, slug
        FROM categories
        WHERE parent_id IS NULL AND is_visible = 1
        ORDER BY id ASC
      `);

      if (!visibleCats.length) {
        categoryBatchCache = [];
        categoryBatchCacheTime = Date.now();
        return res.json([]);
      }

      const origin = `${req.protocol}://${req.get('host')}`;
      const normalizeImage = (url) => {
        if (!url) return null;
        if (url.startsWith('https://')) return url;
        if (url.startsWith('http://')) return url.replace('http://', 'https://');
        if (url.startsWith('/')) return `${origin}${url}`;
        return `${origin}/${url}`;
      };

      const results = [];

      for (const cat of visibleCats) {
        const [rows] = await db.execute(`
          WITH RECURSIVE cat_tree AS (
            SELECT id FROM categories WHERE id = ?
            UNION ALL
            SELECT c.id FROM categories c INNER JOIN cat_tree ct ON c.parent_id = ct.id
          )
          SELECT
            b.id, b.title_en, b.title_de, b.author, b.price, b.original_price,
            b.stock, b.image, b.slug, b.isbn13, b.isbn10, b.rating, b.review_count,
            b.series_name, b.series_volume, b.publish_date, b.created_at
          FROM books b
          INNER JOIN cat_tree ct ON b.category_id = ct.id
          ORDER BY b.created_at DESC
        `, [cat.id]);

        const normalizedRows = rows.map(b => ({ ...b, image: normalizeImage(b.image) }));

        // Same series-dedup logic as the single-category route
        const seriesMap = new Map();
        const standaloneBooks = [];
        for (const book of normalizedRows) {
          const hasValidSeries = book.series_name && String(book.series_name).trim() !== '' &&
            book.series_volume !== null && book.series_volume !== undefined &&
            String(book.series_volume).trim() !== '';
          if (!hasValidSeries) { standaloneBooks.push(book); continue; }
          const seriesKey = String(book.series_name).trim().toLowerCase();
          if (!seriesMap.has(seriesKey)) { seriesMap.set(seriesKey, book); continue; }
          const existing = seriesMap.get(seriesKey);
          const existingPublishDate = new Date(existing.publish_date || 0).getTime();
          const currentPublishDate = new Date(book.publish_date || 0).getTime();
          if (currentPublishDate > existingPublishDate) { seriesMap.set(seriesKey, book); continue; }
          if (currentPublishDate === existingPublishDate) {
            const existingCreatedAt = new Date(existing.created_at || 0).getTime();
            const currentCreatedAt = new Date(book.created_at || 0).getTime();
            if (currentCreatedAt > existingCreatedAt) seriesMap.set(seriesKey, book);
          }
        }

        const finalBooks = [...standaloneBooks, ...Array.from(seriesMap.values())]
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
          .slice(0, limit);

        if (finalBooks.length > 0) {
          results.push({ category: cat, books: finalBooks });
        }
      }

      categoryBatchCache = results;
      categoryBatchCacheTime = Date.now();
      res.json(results);
    } catch (err) {
      console.error('GET /api/home/category-sections-batch error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });



  app.get('/api/home/category-sections/:id', async (req, res) => {
    const id = Number(req.params.id);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 20);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid category id' });
    }

    try {
      const [rows] = await db.execute(`
      WITH RECURSIVE cat_tree AS (
        SELECT id
        FROM categories
        WHERE id = ?

        UNION ALL

        SELECT c.id
        FROM categories c
        INNER JOIN cat_tree ct ON c.parent_id = ct.id
      )
      SELECT
        b.id,
        b.title_en,
        b.title_de,
        b.author,
        b.price,
        b.original_price,
        b.stock,
        b.image,
        b.slug,
        b.isbn13,
        b.isbn10,
        b.rating,
        b.review_count,
        b.series_name,
        b.series_volume,
        b.publish_date,
        b.created_at
      FROM books b
      INNER JOIN cat_tree ct ON b.category_id = ct.id
      ORDER BY b.created_at DESC
    `, [id]);

      const origin = `${req.protocol}://${req.get('host')}`;

      const normalizeImage = (url) => {
        if (!url) return null;
        if (url.startsWith('https://')) return url;
        if (url.startsWith('http://')) return url.replace('http://', 'https://');
        if (url.startsWith('/')) return `${origin}${url}`;
        return `${origin}/${url}`;
      };

      const normalizedRows = rows.map((b) => ({
        ...b,
        image: normalizeImage(b.image)
      }));

      // Your homepage logic:
      // - only dedupe when series_name AND series_volume exist
      // - for a real series keep latest by publish_date
      // - final list sorted by created_at DESC
      const seriesMap = new Map();
      const standaloneBooks = [];

      for (const book of normalizedRows) {
        const hasValidSeries =
          book.series_name &&
          String(book.series_name).trim() !== '' &&
          book.series_volume !== null &&
          book.series_volume !== undefined &&
          String(book.series_volume).trim() !== '';

        if (!hasValidSeries) {
          standaloneBooks.push(book);
          continue;
        }

        const seriesKey = String(book.series_name).trim().toLowerCase();

        if (!seriesMap.has(seriesKey)) {
          seriesMap.set(seriesKey, book);
          continue;
        }

        const existing = seriesMap.get(seriesKey);

        const existingPublishDate = new Date(existing.publish_date || 0).getTime();
        const currentPublishDate = new Date(book.publish_date || 0).getTime();

        if (currentPublishDate > existingPublishDate) {
          seriesMap.set(seriesKey, book);
          continue;
        }

        // Tie-breaker: newer created_at wins
        if (currentPublishDate === existingPublishDate) {
          const existingCreatedAt = new Date(existing.created_at || 0).getTime();
          const currentCreatedAt = new Date(book.created_at || 0).getTime();

          if (currentCreatedAt > existingCreatedAt) {
            seriesMap.set(seriesKey, book);
          }
        }
      }

      const finalBooks = [...standaloneBooks, ...Array.from(seriesMap.values())]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, limit);

      res.json(finalBooks);
    } catch (err) {
      console.error('GET /api/home/category-sections/:id error:', err);
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
      const [[book]] = await db.execute('SELECT author, category_id, series_name FROM books WHERE id = ?', [bookId]);
      if (!book) return res.status(404).json({ error: 'Book not found' });

      const { author, category_id } = book;

      // 1) Same author
      const [sameAuthor] = await db.execute(
        `SELECT id, slug, rating, review_count, title_en, title_de, author, image, price, original_price, isbn13, isbn10, stock
       FROM books
       WHERE author = ? AND id != ?
       LIMIT 8`,
        [author, bookId]
      );

      // 2) Customers who bought this also bought (orders with this book → other books in those orders)
      const [alsoBought] = await db.execute(
        `
      SELECT DISTINCT b.id, b.slug, b.rating, b.review_count, b.title_en, b.title_de, b.author, b.image, b.price, b.original_price, b.isbn10, b.isbn13, b.stock
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
        `SELECT id, slug, rating, review_count, title_en, title_de, author, image, price, original_price, isbn13, isbn10, stock
       FROM books
       WHERE category_id = ? AND id != ?
       LIMIT 12`,
        [category_id, bookId]
      );


      // 4) Same series (only if series_name exists)
      let series = [];
      const seriesName = (book.series_name || '').trim();

      if (seriesName) {
        const [seriesRows] = await db.execute(
          `
    SELECT id, slug, rating, review_count, title_en, title_de, author, image, price, original_price, isbn13, isbn10,
           series_name, series_volume, stock
    FROM books
    WHERE series_name = ? AND id != ?
    ORDER BY
      CASE
        WHEN series_volume REGEXP '^[0-9]+(\\.[0-9]+)?$'
          THEN CAST(series_volume AS DECIMAL(10,2))
        ELSE 999999
      END ASC,
      publish_date DESC,
      created_at DESC
    LIMIT 12
    `,
          [seriesName, bookId]
        );

        series = seriesRows || [];
      }

      res.json({ sameAuthor, alsoBought, similar, series });
    } catch (err) {
      console.error('Recommendations error:', err);
      // Return an empty payload on failure (no nested res.status in the object)
      res.status(500).json({ sameAuthor: [], alsoBought: [], similar: [], series: [] });
    }
  });

  // FETCH RECOMMENDATIONS IN THE CART PAGE
  // === CART RECOMMENDATIONS (multi-author aware; uses book_authors pivot) ===
  app.post('/api/cart/recommendations', async (req, res) => {
    const bookIds = req.body.bookIds ?? [];
    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      return res.json({ byAuthor: [], sameAuthor: [], alsoBought: [], similar: [] });
    }

    // Helpers
    const origin = `${req.protocol}://${req.get('host')}`;
    const normalize = (url) => {
      if (!url) return null;
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      if (url.startsWith('/')) return `${origin}${url}`;
      return `${origin}/${url}`;
    };

    try {
      const placeholders = bookIds.map(() => '?').join(',');

      // 1) All unique authors for all cart books (via pivot)
      const [authRows] = await db.query(
        `
      SELECT DISTINCT a.id   AS author_id,
                      a.name AS author_name,
                      a.slug AS author_slug,
                      a.photo
      FROM book_authors ba
      JOIN authors a ON a.id = ba.author_id
      WHERE ba.book_id IN (${placeholders})
      `,
        bookIds
      );

      const authorIds = authRows.map(r => r.author_id);
      let byAuthor = [];
      let sameAuthor = [];

      // 2) Books by these authors (excluding cart items)
      if (authorIds.length > 0) {
        const aPlace = authorIds.map(() => '?').join(',');
        const nPlace = bookIds.map(() => '?').join(',');
        const params = [...authorIds, ...bookIds];

        const [rows] = await db.query(
          `
        SELECT 
          a.id   AS author_id,
          a.name AS author_name,
          a.slug AS author_slug,

          b.id, b.slug, b.title_en, b.title_de, b.author,
          b.image, b.price, b.original_price, b.rating, b.review_count,
          b.isbn10, b.isbn13, b.stock
        FROM book_authors ba
        JOIN books b   ON b.id = ba.book_id
        JOIN authors a ON a.id = ba.author_id
        WHERE ba.author_id IN (${aPlace})
          AND b.id NOT IN (${nPlace})
        ORDER BY a.name ASC,
                 b.popularity_score DESC,
                 b.rating DESC,
                 b.review_count DESC,
                 b.created_at DESC
        `,
          params
        );

        const metaByAuthor = new Map(
          authRows.map(r => [
            r.author_id,
            {
              id: r.author_id,
              name: r.author_name,
              slug: r.author_slug,
              photo: normalize(r.photo),
            }
          ])
        );

        // Seed groups with every author from the cart (ensures multi-author visibility)
        const grouped = new Map();
        for (const a of authRows) {
          grouped.set(a.author_id, {
            author: metaByAuthor.get(a.author_id),
            books: []
          });
        }

        // Now add the recommended books per author
        for (const r of rows) {
          {/*if (!grouped.has(r.author_id)) {
            grouped.set(r.author_id, {
              author: metaByAuthor.get(r.author_id) || {
                id: r.author_id,
                name: r.author_name,
                slug: r.author_slug,
                photo: null
              },
              books: []
            });
          }
          grouped.get(r.author_id).books.push({*/}

          const g = grouped.get(r.author_id);
          if (!g) continue;
          g.books.push({
            id: r.id,
            slug: r.slug,
            title_en: r.title_en,
            title_de: r.title_de,
            author: r.author,
            image: normalize(r.image),
            price: r.price,
            original_price: r.original_price,
            rating: r.rating,
            review_count: r.review_count,
            isbn10: r.isbn10,
            isbn13: r.isbn13
          });
        }

        // Limit per author (e.g., 12) and build flattened list
        byAuthor = Array.from(grouped.values())
          .map(g => ({ ...g, books: g.books.slice(0, 12) }))
          .filter(g => g.books.length > 0); // hide empty author sections

        const seen = new Set();
        for (const g of byAuthor) {
          for (const b of g.books) {
            if (!seen.has(b.id)) {
              seen.add(b.id);
              sameAuthor.push(b);
            }
          }
        }
      }

      // 3) Also bought (JSON_TABLE) — unchanged, normalized images
      const [alsoBoughtRows] = await db.query(
        `
      SELECT DISTINCT b.id, b.slug, b.title_en, b.title_de, b.author,
             b.image, b.price, b.original_price, b.rating, b.review_count,
             b.isbn10, b.isbn13, b.stock
      FROM orders o
      JOIN JSON_TABLE(o.order_items, '$[*]'
           COLUMNS ( bookId INT PATH '$.bookId' )
      ) jt1 ON jt1.bookId IN (${placeholders})
      JOIN JSON_TABLE(o.order_items, '$[*]'
           COLUMNS ( otherBookId INT PATH '$.bookId' )
      ) jt2 ON jt2.otherBookId NOT IN (${placeholders})
      JOIN books b ON b.id = jt2.otherBookId
      LIMIT 12
      `,
        [...bookIds, ...bookIds]
      );
      const alsoBought = (alsoBoughtRows || []).map(b => ({ ...b, image: normalize(b.image) }));

      // 4) Similar category — unchanged, normalized images
      const [catRows] = await db.query(
        `SELECT DISTINCT category_id FROM books WHERE id IN (${placeholders})`,
        bookIds
      );
      const cats = (catRows || []).map(r => r.category_id).filter(Boolean);

      let similar = [];
      if (cats.length > 0) {
        const cPlace = cats.map(() => '?').join(',');
        const nPlace = bookIds.map(() => '?').join(',');
        const [simRows] = await db.query(
          `
        SELECT id, slug, title_en, title_de, author,
               image, price, original_price, rating, review_count,
               isbn10, isbn13, stock
        FROM books
        WHERE category_id IN (${cPlace})
          AND id NOT IN (${nPlace})
        LIMIT 12
        `,
          [...cats, ...bookIds]
        );
        similar = (simRows || []).map(b => ({ ...b, image: normalize(b.image) }));
      }

      return res.json({ byAuthor, sameAuthor, alsoBought, similar });
    } catch (err) {
      console.error('[cart/recommendations] error:', err);
      return res.status(500).json({ byAuthor: [], sameAuthor: [], alsoBought: [], similar: [] });
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
    if (!review_text || review_text.trim().length < 10) {
      return res.status(400).json({ message: 'Review must be at least 10 characters' });
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

      // Stop any pending review-request emails for this user+book
      if (userId) {
        await db.execute(`
          UPDATE review_requests
          SET review_submitted = 1, stopped = 1
          WHERE user_id = ? AND book_id = ?
        `, [userId, bookId]).catch(() => { });
      }

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

  // =========================================================
  // PASTE THESE ROUTES INTO server.js, inside the async IIFE,
  // anywhere alongside your other /api/books/* routes.
  // Requires the migration in bookdetails_features_migration.sql
  // to be run first.
  // =========================================================

  // ── POST /api/books/:id/notify-me ──────────────────────────
  // Subscribe an email to be notified when this book is back in stock.
  // Works for both logged-in users and guests (guest must supply email).
  app.post('/api/books/:id/notify-me', async (req, res) => {
    const bookId = Number(req.params.id);
    if (!bookId) return res.status(400).json({ error: 'Invalid book id' });

    const isAuthed = req.isAuthenticated && req.isAuthenticated() && req.user;
    const email = isAuthed
      ? (req.user.email || '').trim().toLowerCase()
      : String(req.body?.email || '').trim().toLowerCase();
    const userId = isAuthed ? req.user.id : null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    try {
      // Confirm the book is actually out of stock — no point subscribing
      // someone to a restock alert for something already available.
      const [[book]] = await db.execute('SELECT id, stock FROM books WHERE id = ?', [bookId]);
      if (!book) return res.status(404).json({ error: 'Book not found' });
      if (book.stock > 0) {
        return res.status(400).json({ error: 'Book is already in stock' });
      }

      await db.execute(`
      INSERT INTO stock_notifications (book_id, email, user_id, created_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        notified_at = NULL,
        user_id = COALESCE(VALUES(user_id), user_id)
    `, [bookId, email, userId]);

      res.json({ success: true });
    } catch (err) {
      console.error('POST /api/books/:id/notify-me error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── GET /api/books/:id/notify-me/status ────────────────────
  // Lets the frontend check if the current user/email is already
  // subscribed, so the button can show "You're on the list" instead
  // of the form again.
  app.get('/api/books/:id/notify-me/status', async (req, res) => {
    const bookId = Number(req.params.id);
    const isAuthed = req.isAuthenticated && req.isAuthenticated() && req.user;
    const email = isAuthed
      ? (req.user.email || '').trim().toLowerCase()
      : String(req.query.email || '').trim().toLowerCase();

    if (!bookId || !email) return res.json({ subscribed: false });

    try {
      const [[row]] = await db.execute(
        'SELECT id FROM stock_notifications WHERE book_id = ? AND email = ? AND notified_at IS NULL',
        [bookId, email]
      );
      res.json({ subscribed: !!row });
    } catch (err) {
      console.error('GET notify-me status error:', err);
      res.json({ subscribed: false });
    }
  });

  // Sends restock emails to everyone pending for a book, then marks them
  // notified so they're never emailed twice for the same restock event.
  async function sendRestockNotifications(bookId) {
    try {
      const [[book]] = await db.execute(
        'SELECT id, title_en, title_de, slug, image, isbn13, isbn10, price FROM books WHERE id = ?',
        [bookId]
      );
      if (!book) return;

      const [pending] = await db.execute(
        `SELECT sn.id, sn.email, u.language, u.first_name
       FROM stock_notifications sn
       LEFT JOIN users u ON u.id = sn.user_id
       WHERE sn.book_id = ? AND sn.notified_at IS NULL`,
        [bookId]
      );
      if (!pending.length) return;

      const bookUrl = `${process.env.FRONTEND_URL}${buildBookUrl(book)}`;

      for (const sub of pending) {
        const isDe = sub.language === 'de';
        const title = isDe ? (book.title_de || book.title_en) : (book.title_en || book.title_de);

        const subject = isDe
          ? `Wieder verfügbar: "${title}"`
          : `Back in stock: "${title}"`;

        const html = isDe ? `
        <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
          <div style="background:linear-gradient(135deg,#1f1633,#3b1d6e);padding:36px 32px;border-radius:16px 16px 0 0;text-align:center;">
            <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#c4b5fd;text-transform:uppercase;margin-bottom:10px;">englischbücher.de</div>
            <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">Wieder da! 🎉</h1>
          </div>
          <div style="padding:32px;border:1px solid #ede9fe;border-top:none;border-radius:0 0 16px 16px;">
            <p style="color:#1a1a2e;font-size:15px;line-height:1.6;margin:0 0 20px;">
              Hallo ${sub.first_name || ''}, das Buch, auf das du gewartet hast, ist jetzt wieder auf Lager:
            </p>
            <div style="text-align:center;margin:0 0 24px;">
              ${book.image ? `<img src="${book.image}" alt="${title}" style="width:100px;height:auto;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.15);margin-bottom:14px;">` : ''}
              <div style="font-size:16px;font-weight:700;color:#1a1a2e;">${title}</div>
            </div>
            <div style="text-align:center;margin:0 0 8px;">
              <a href="${bookUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Jetzt ansehen</a>
            </div>
            <p style="color:#9ca3af;font-size:12px;text-align:center;margin:24px 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">
              Bestand ist begrenzt — wir empfehlen, nicht zu lange zu warten.
            </p>
          </div>
        </div>
      ` : `
        <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
          <div style="background:linear-gradient(135deg,#1f1633,#3b1d6e);padding:36px 32px;border-radius:16px 16px 0 0;text-align:center;">
            <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#c4b5fd;text-transform:uppercase;margin-bottom:10px;">englischbücher.de</div>
            <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">It's back! 🎉</h1>
          </div>
          <div style="padding:32px;border:1px solid #ede9fe;border-top:none;border-radius:0 0 16px 16px;">
            <p style="color:#1a1a2e;font-size:15px;line-height:1.6;margin:0 0 20px;">
              Hi ${sub.first_name || ''}, the book you were waiting for is back in stock:
            </p>
            <div style="text-align:center;margin:0 0 24px;">
              ${book.image ? `<img src="${book.image}" alt="${title}" style="width:100px;height:auto;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.15);margin-bottom:14px;">` : ''}
              <div style="font-size:16px;font-weight:700;color:#1a1a2e;">${title}</div>
            </div>
            <div style="text-align:center;margin:0 0 8px;">
              <a href="${bookUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">View it now</a>
            </div>
            <p style="color:#9ca3af;font-size:12px;text-align:center;margin:24px 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">
              Stock is limited — we'd recommend not waiting too long.
            </p>
          </div>
        </div>
      `;

        try {
          await transporter.sendMail({ from: process.env.SMTP_USER, to: sub.email, subject, html });
          await db.execute(`
          INSERT INTO sent_emails (to_email, subject, html, status, type, created_at)
          VALUES (?, ?, ?, 'sent', 'RestockNotification', NOW())
        `, [sub.email, subject, html]).catch(() => { });
        } catch (mailErr) {
          console.error(`Restock email failed for ${sub.email}:`, mailErr.message);
          await db.execute(`
          INSERT INTO sent_emails (to_email, subject, html, status, error, type, created_at)
          VALUES (?, ?, ?, 'failed', ?, 'RestockNotification', NOW())
        `, [sub.email, subject, html, mailErr.message]).catch(() => { });
        }

        // Mark notified regardless of email success, so we don't retry-spam
        // someone forever if their address bounces every time.
        await db.execute('UPDATE stock_notifications SET notified_at = NOW() WHERE id = ?', [sub.id]);
      }

      console.log(`[RestockNotify] Sent ${pending.length} email(s) for book ${bookId}`);
    } catch (err) {
      console.error('sendRestockNotifications error:', err);
    }
  }

  // ── GET /api/users/me/recently-viewed ──────────────────────
  // Logged-in users only — guests use localStorage on the frontend.
  app.get('/api/users/me/recently-viewed', authMiddleware, async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);
      const [rows] = await db.execute(`
      SELECT b.id, b.title_en, b.title_de, b.author, b.slug, b.image,
             b.price, b.original_price, b.rating, b.review_count,
             b.isbn13, b.isbn10, b.stock
      FROM recently_viewed rv
      JOIN books b ON b.id = rv.book_id
      WHERE rv.user_id = ?
      ORDER BY rv.viewed_at DESC
      LIMIT ?
    `, [req.user.id, limit]);

      const origin = `${req.protocol}://${req.get('host')}`;
      const normalize = (url) => {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
      };
      res.json(rows.map(b => ({ ...b, image: normalize(b.image) })));
    } catch (err) {
      console.error('GET recently-viewed error:', err);
      res.json([]);
    }
  });

  // ── POST /api/books/by-ids ──────────────────────────────────
  // Used by the frontend to resolve a guest's localStorage list of
  // book IDs into full book objects for rendering the strip.
  app.post('/api/books/by-ids', async (req, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map(Number).filter(Boolean).slice(0, 20)
      : [];
    if (!ids.length) return res.json([]);

    try {
      const placeholders = ids.map(() => '?').join(',');
      const [rows] = await db.query(`
      SELECT id, title_en, title_de, author, slug, image,
             price, original_price, rating, review_count,
             isbn13, isbn10, stock
      FROM books
      WHERE id IN (${placeholders})
    `, ids);

      // Preserve the order the frontend asked for (most-recent-first),
      // since SQL's IN() doesn't guarantee result order.
      const byId = new Map(rows.map(r => [r.id, r]));
      const origin = `${req.protocol}://${req.get('host')}`;
      const normalize = (url) => {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
      };
      const ordered = ids.map(id => byId.get(id)).filter(Boolean)
        .map(b => ({ ...b, image: normalize(b.image) }));

      res.json(ordered);
    } catch (err) {
      console.error('POST /api/books/by-ids error:', err);
      res.json([]);
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

  // ── One-time login token store (iOS/Safari cross-domain fix) ──
  // Safari's Intelligent Tracking Prevention can silently refuse to
  // persist a session cookie that arrives via a cross-site redirect
  // chain (Google → backend callback → frontend), even with
  // SameSite=None; Secure set correctly — this is especially true in
  // dev where frontend (netlify.app) and backend (englischbuecher.de)
  // are on completely unrelated root domains, not just subdomains.
  // Instead of relying on that cookie surviving the redirect, we hand
  // the frontend a short-lived one-time token in the redirect URL;
  // the frontend then exchanges it via a same-origin-initiated POST,
  // which Safari trusts and will reliably set/store the cookie for.
  const pendingLoginTokens = new Map(); // token -> { userId, expiresAt }

  const PENDING_TOKEN_TTL_MS = 60 * 1000; // 60 seconds is plenty

  function createPendingLoginToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    pendingLoginTokens.set(token, { userId, expiresAt: Date.now() + PENDING_TOKEN_TTL_MS });
    return token;
  }

  // Sweep expired tokens periodically so the Map doesn't grow forever
  setInterval(() => {
    const now = Date.now();
    for (const [token, data] of pendingLoginTokens.entries()) {
      if (data.expiresAt < now) pendingLoginTokens.delete(token);
    }
  }, 5 * 60 * 1000);

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

        // One-time token for the redirect fallback path only (iOS/Safari).
        // The popup path doesn't need this — it never navigates away from
        // the backend domain, so the session cookie set on this response
        // is already attached to the opener's subsequent same-window
        // requests without any cross-site redirect involved.
        const loginToken = createPendingLoginToken(user.id);

        res.send(`
<!DOCTYPE html>
<html>
  <head>
    <title>Login Success</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body>
    <script>
      (function () {
        const FRONTEND = '${process.env.FRONTEND_URL}';
        const LOGIN_TOKEN = '${loginToken}';

        try {
          // ✅ Popup flow (desktop / android) — cookie already works here,
          // no token needed since we never leave the backend's own origin.
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              { type: 'google-login-success' },
              '*'
            );
            window.close();
            return;
          }
        } catch (e) {}

        // ✅ Redirect flow (iOS Safari) — pass a one-time token instead of
        // relying on the session cookie surviving this cross-site redirect.
        // The frontend exchanges it for a real session via its own
        // same-origin-initiated request, which Safari trusts.
        window.location.replace(FRONTEND + '/auth/complete?login_token=' + LOGIN_TOKEN);
      })();
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

  // ── Exchange a one-time login token for a real session ──
  // Called by the frontend immediately after landing on /auth/complete
  // with a login_token in the URL (the iOS/Safari redirect fallback).
  // This is a same-origin-initiated POST from the frontend's own JS,
  // which is exactly the kind of request Safari's ITP will reliably
  // set and store a SameSite=None cookie for — unlike a cookie that
  // merely arrives attached to a cross-site redirect response.
  app.post('/api/auth/exchange-token', express.json(), (req, res) => {
    const { login_token } = req.body || {};
    if (!login_token) {
      return res.status(400).json({ error: 'Missing login_token' });
    }

    const entry = pendingLoginTokens.get(login_token);
    // One-time use: delete immediately on lookup, valid or not, so a
    // token can never be replayed even if this request is retried.
    pendingLoginTokens.delete(login_token);

    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Token expired or invalid' });
    }

    db.execute(
      'SELECT id, email, first_name, last_name, role, language, photo_url, created_at, email_verified_at FROM users WHERE id = ?',
      [entry.userId]
    ).then(([[dbUser]]) => {
      if (!dbUser) return res.status(401).json({ error: 'User not found' });

      const sessionUser = {
        ...dbUser,
        photoURL: dbUser.photo_url || null,
        displayName: `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim()
      };

      req.login(sessionUser, (err) => {
        if (err) {
          console.error('Token exchange login error:', err);
          return res.status(500).json({ error: 'Login failed' });
        }
        res.json({ success: true });
      });
    }).catch(err => {
      console.error('Token exchange DB error:', err);
      res.status(500).json({ error: 'Server error' });
    });
  });

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
  AND ci.is_active = 1
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
      //const placeholders = values.map(() => '(?, ?, ?)').join(', ');
      const placeholders = values.map(() => '(?, ?, ?, 1, NULL)').join(', ');
      const flatValues = values.flat();

      // ✅ Server qty wins:
      // - inserts missing books
      // - ignores existing (user_id, book_id) rows
      await db.execute(`
  INSERT INTO cart_items (user_id, book_id, quantity, is_active, deleted_at)
  VALUES ${placeholders}
  ON DUPLICATE KEY UPDATE
    quantity = IF(is_active = 0, VALUES(quantity), quantity),
    is_active = 1,
    deleted_at = NULL
`, flatValues);
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
  INSERT INTO cart_items (user_id, book_id, quantity, is_active, deleted_at)
  VALUES (?, ?, ?, 1, NULL)
  ON DUPLICATE KEY UPDATE
    quantity = IF(is_active = 0, VALUES(quantity), quantity + VALUES(quantity)),
    is_active = 1,
    deleted_at = NULL
`, [req.user.id, bookId, quantity]);

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
        await db.execute(`
    UPDATE cart_items
    SET is_active = 0,
        quantity = 0,
        deleted_at = NOW()
    WHERE user_id = ? AND book_id = ?
  `, [req.user.id, bookId]);
      } else {
        await db.execute(`
    UPDATE cart_items
    SET quantity = ?, is_active = 1, deleted_at = NULL
    WHERE user_id = ? AND book_id = ?
  `, [quantity, req.user.id, bookId]);
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
      await db.execute(`
  UPDATE cart_items
  SET is_active = 0,
      quantity = 0,
      deleted_at = NOW()
  WHERE user_id = ? AND book_id = ?
`, [req.user.id, req.params.bookId]);
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE /api/cart/remove error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cart/clear', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    try {
      await db.execute(`
  UPDATE cart_items
  SET is_active = 0,
      quantity = 0,
      deleted_at = NOW()
  WHERE user_id = ?
`, [req.user.id]);
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
      //const { to_zip, to_city, items, email } = req.body || {};
      const { to_zip, to_city, to_street, items, email } = req.body || {};
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
        //{ to_zip, to_city, items: weighted },
        //{ to_zip, to_city, email, items: weighted },
        { to_zip, to_city, to_street, email, items: weighted },
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

  app.use('/api/dpd', dpdRoutes);

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
      const { clientSecret, amount_cents, shipping_provider, shipping_service } = req.body || {};
      if (!clientSecret || !Number.isFinite(Number(amount_cents)) || amount_cents <= 0) {
        return res.status(400).json({ error: 'bad_request' });
      }
      // Extract pi id from clientSecret: 'pi_..._secret_...'
      const piId = String(clientSecret).split('_secret_')[0];

      const updatePayload = {
        amount: Number(amount_cents),
        // ✅ set only the keys you care about (Stripe supports updating metadata) [1](https://boehringer.sharepoint.com/sites/z365apollocontrolcenter/SitePages/Notebook---Topic-Classification-with-Large-Language-Models-(LLMs).aspx?web=1)
        metadata: {
          ...(shipping_provider ? { shipping_provider: String(shipping_provider) } : {}),
          ...(shipping_service ? { shipping_service: String(shipping_service) } : {}),
        },
      };

      //console.log('🧠 Updating PI with:', updatePayload);

      const pi = await stripe.paymentIntents.update(piId, updatePayload);

      //console.log('🧠 PI metadata after update:', pi.metadata);

      /*const pi = await stripe.paymentIntents.update(piId, {
        amount: Number(amount_cents),
        metadata: {
          ...(shipping_provider ? { shipping_provider } : {}),
          ...(shipping_service ? { shipping_service } : {}),
          });*/

      return res.json({
        ok: true,
        paymentIntent: { id: pi.id, status: pi.status, amount: pi.amount },
        metadata: pi.metadata,
      });
    } catch (err) {
      console.error('[orders/update-payment-intent-amount] error:', err?.message || err);
      return res.status(500).json({ error: 'pi_update_failed' });
    }
  });

  /*app.post('/api/orders/update-payment-intent-amount', (req, res) => {
    res.status(410).json({ error: 'deprecated' });
  });*/

  // === ORDER ROUTES ===
  //console.log('✅ Mounting orders routes from:', require.resolve('./routes/orderRoutes'));

  const ordersRouter = require('./routes/orderRoutes')(db, transporter);
  app.use('/api/orders', ordersRouter);

  // ✅ DEBUG: list actual registered routes under /api/orders
  app.get('/api/_debug/orders-routes', (req, res) => {
    const list = (ordersRouter.stack || [])
      .filter(l => l.route)
      .map(l => ({
        methods: Object.keys(l.route.methods).join(',').toUpperCase(),
        path: l.route.path
      }));
    res.json(list);
  });

  app.use('/admin/wishlist', require('./routes/admin/wishlist')(db));
  app.use('/api/admin/cart', require('./routes/admin/cart')(db));

  app.use('/api/cart', require('./routes/cartWeights')(db));

  // AFTER app.use('/api/orders', ...)
  app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripeWebhook = require('./webhook/stripeWebhook');
    await stripeWebhook(req, res, db);
  });

  // CREATE DISCOUNT CODE
  app.post('/api/discounts', async (req, res) => {
    const { code, type, value } = req.body;

    await db.query(
      'INSERT INTO discount_codes (code, type, value) VALUES (?, ?, ?)',
      [code.toUpperCase(), type, value]
    );

    res.json({ success: true });
  });

  // POST /api/discounts/validate
  app.post('/api/discounts/validate', async (req, res) => {
    const { code } = req.body;
    const [rows] = await db.query(
      'SELECT * FROM discount_codes WHERE code = ? AND is_active = 1',
      [code.toUpperCase()]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid code' });
    }
    const discount = rows[0];
    if (discount.expiry_date && new Date(discount.expiry_date) < new Date()) {
      return res.status(400).json({ error: 'Code expired' });
    }
    res.json(discount);
  });


  app.get('/api/discounts', async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT id, code, type, value, is_active, expiry_date
      FROM discount_codes
      ORDER BY created_at DESC
    `);

      res.json(rows);
    } catch (err) {
      console.error('GET discounts error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.put('/api/discounts/:id', async (req, res) => {
    const { id } = req.params;
    const { code, type, value, is_active, expiry_date } = req.body;

    try {
      await db.query(`
      UPDATE discount_codes
      SET code = ?, type = ?, value = ?, is_active = ?, expiry_date = ?
      WHERE id = ?
    `, [code.toUpperCase(), type, value, is_active ? 1 : 0, expiry_date, id]);

      res.json({ success: true });
    } catch (err) {
      console.error('UPDATE discount error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });


  app.patch('/api/discounts/:id/toggle', async (req, res) => {
    try {
      const { id } = req.params;

      await db.query(`
      UPDATE discount_codes
      SET is_active = NOT is_active
      WHERE id = ?
    `, [id]);

      res.json({ success: true });
    } catch (err) {
      console.error('TOGGLE discount error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // WALLET RELATED

  app.get('/api/wallet/transactions', authMiddleware, async (req, res) => {
    //app.get('/api/wallet/transactions', requireAuth, async (req, res) => {
    try {
      /*if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }*/

      const userId = req.user.id;

      const [rows] = await db.query(`
      SELECT id, amount, type, reason, created_at
      FROM wallet_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);

      res.json(rows);
    } catch (err) {
      console.error('Wallet transaction error:', err);
      res.status(500).json({ error: 'Server error fetching wallet transactions' });
    }
  });

  //app.get('/api/wallet', requireAuth, async (req, res) => {
  app.get('/api/wallet', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;

      const [[result]] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0)
        AS balance
      FROM wallet_transactions
      WHERE user_id = ?
    `, [userId]);

      res.json({ balance: Number(result.balance || 0) });

    } catch (err) {
      console.error('Wallet balance error:', err);
      res.status(500).json({ error: 'Failed to fetch wallet balance' });
    }
  });


  app.get('/api/admin/wallet/user-lookup', authMiddleware, async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const q = String(req.query.email || '').trim().toLowerCase();
      if (q.length < 3) return res.json([]);

      const [rows] = await db.query(`
      SELECT id, email, first_name, last_name
      FROM users
      WHERE LOWER(email) LIKE ?
      ORDER BY email ASC
      LIMIT 8
    `, [`%${q}%`]);

      res.json(rows);
    } catch (err) {
      console.error('user-lookup error:', err);
      res.status(500).json({ error: 'lookup_failed' });
    }
  });


  const sendWalletCreditEmail = require('./utils/sendWalletCreditEmail');

  app.post('/api/wallet/add', authMiddleware, async (req, res) => {
    const { email, amount, reason } = req.body;

    try {

      // Optional: admin-only guard
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const [[user]] = await db.query(
        `SELECT id, email, first_name, last_name FROM users WHERE email = ?`,
        [email]
      );


      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userId = user.id;

      await db.query(`
      INSERT INTO wallet_transactions (user_id, amount, type, reason)
      VALUES (?, ?, 'CREDIT', ?)
    `, [userId, amount, reason || 'Admin credit']);



      const [[bal]] = await db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type='CREDIT' THEN amount ELSE 0 END),0) -
          COALESCE(SUM(CASE WHEN type='DEBIT' THEN amount ELSE 0 END),0) AS balance
        FROM wallet_transactions
        WHERE user_id = ?
      `, [user.id]);

      sendWalletCreditEmail(
        user,
        Number(amount),
        reason,
        Number(bal.balance)
      ).catch(console.error);

      res.json({ success: true });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error adding wallet money' });
    }
  });


  app.get('/admin/transactions', async (req, res) => {
    const { email } = req.query;

    const [user] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (!user.length) return res.status(404).json({ error: "User not found" });

    const [rows] = await db.query(
      "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC",
      [user[0].id]
    );

    res.json(rows);
  });


  app.get('/admin/balance', async (req, res) => {
    const { email } = req.query;

    const [user] = await db.query(
      "SELECT wallet_balance FROM users WHERE email = ?",
      [email]
    );

    if (!user.length) return res.status(404).json({ error: "User not found" });

    res.json({ balance: user[0].wallet_balance });
  });


  app.get('/api/admin/wallet/users', authMiddleware, async (req, res) => {
    try {
      // ✅ Admin check
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // ✅ Fetch users with wallet activity
      const [rows] = await db.query(`
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,

        -- ✅ Calculate balance from transactions
        COALESCE(
          SUM(
            CASE
              WHEN wt.type = 'CREDIT' THEN wt.amount
              WHEN wt.type = 'DEBIT' THEN -wt.amount
              ELSE 0
            END
          ), 0
        ) AS balance,

        COUNT(wt.id) AS tx_count,
        MAX(wt.created_at) AS last_activity

      FROM users u
      LEFT JOIN wallet_transactions wt
        ON wt.user_id = u.id

      GROUP BY u.id, u.email, u.first_name, u.last_name

      HAVING COUNT(wt.id) > 0   -- ✅ IMPORTANT: only users with wallet activity

      ORDER BY last_activity DESC
    `);

      res.json(rows);

    } catch (err) {
      console.error('❌ wallet users error:', err);
      res.status(500).json({ error: 'Failed to fetch wallet users' });
    }
  });


  app.get('/api/admin/wallet/users/:id/transactions', authMiddleware, async (req, res) => {
    try {
      // ✅ 1. Strict admin check
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // ✅ 2. Validate param
      const userId = parseInt(req.params.id, 10);
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // ✅ 3. OPTIONAL (but recommended): ensure user exists
      const [userRows] = await db.query(
        'SELECT id FROM users WHERE id = ?',
        [userId]
      );

      if (userRows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // ✅ 4. Fetch transactions
      const [rows] = await db.query(
        `
      SELECT
        id,
        amount,
        type,
        reason,
        created_at
      FROM wallet_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
        [userId]
      );

      res.json(rows);

    } catch (err) {
      console.error('❌ admin wallet transactions error:', err);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });


  app.put('/api/admin/books/set-new-release-date', authMiddleware, async (req, res) => {
    try {
      const { lastStockAdditionDate } = req.body;

      if (!lastStockAdditionDate) {
        return res.status(400).json({ error: 'lastStockAdditionDate is required' });
      }

      // Expecting YYYY-MM-DD from frontend
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(lastStockAdditionDate)) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }

      const [result] = await db.execute(
        `
      UPDATE books
      SET is_new_release = CASE
        WHEN DATE(created_at) >= DATE(?) THEN 1
        ELSE 0
      END
      `,
        [lastStockAdditionDate]
      );

      return res.json({
        success: true,
        message: 'New release flags updated successfully',
        affectedRows: result.affectedRows
      });
    } catch (err) {
      console.error('SET NEW RELEASE DATE ERROR:', err);
      return res.status(500).json({
        error: 'Failed to update new release flags',
        details: err.message
      });
    }
  });


  app.post('/api/admin/books/preview-new-release-date', async (req, res) => {
    try {
      const { date } = req.body;

      if (!date) {
        return res.status(400).json({ error: 'Date is required' });
      }

      // ✅ Count books that will become new_release = 1
      const [[newRelease]] = await db.execute(
        `SELECT COUNT(*) as count
       FROM books
       WHERE DATE(created_at) >= DATE(?)`,
        [date]
      );

      // ✅ Count books that will become new_release = 0
      const [[oldRelease]] = await db.execute(
        `SELECT COUNT(*) as count
       FROM books
       WHERE DATE(created_at) < DATE(?)`,
        [date]
      );

      return res.json({
        willBeNewRelease: newRelease.count,
        willBeOld: oldRelease.count
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Preview failed' });
    }
  });

  /*app.put('/api/admin/books/price/:id', async (req, res) => {
    const { id } = req.params;
    const { price } = req.body;

    const parsedPrice = Number(price);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }

    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      // 1) Read the selected book row first
      const [[book]] = await conn.execute(
        `
      SELECT id, isbn13, isbn10, isbn, binding, edition
      FROM books
      WHERE id = ?
      LIMIT 1
      `,
        [id]
      );

      if (!book) {
        await conn.rollback();
        return res.status(404).json({ error: 'Book not found' });
      }

      // 2) Update only books.price
      const [bookResult] = await conn.execute(
        `
      UPDATE books
      SET price = ?
      WHERE id = ?
      `,
        [parsedPrice, id]
      );

      // 3) Build ISBN match for excel_books
      const isbnConditions = [];
      const isbnParams = [];

      if (book.isbn13) {
        isbnConditions.push(`isbn13 = ?`);
        isbnParams.push(book.isbn13);
      }

      if (book.isbn10) {
        isbnConditions.push(`isbn10 = ?`);
        isbnParams.push(book.isbn10);
      }

      if (book.isbn) {
        isbnConditions.push(`isbn = ?`);
        isbnParams.push(book.isbn);
      }

      let excelAffectedRows = 0;

      // 4) Update only excel_books.price
      if (isbnConditions.length > 0) {
        const [excelResult] = await conn.execute(
          `
        UPDATE excel_books
        SET price = ?
        WHERE (${isbnConditions.join(' OR ')})
          AND (binding <=> ?)
          AND (edition <=> ?)
        `,
          [
            parsedPrice,
            ...isbnParams,
            book.binding ?? null,
            book.edition ?? null
          ]
        );

        excelAffectedRows = excelResult.affectedRows || 0;
      }

      await conn.commit();

      return res.json({
        success: true,
        message: 'Price updated successfully',
        updatedBookId: Number(id),
        updatedPrice: parsedPrice,
        updatedBooksRows: bookResult.affectedRows || 0,
        updatedExcelRows: excelAffectedRows
      });
    } catch (err) {
      await conn.rollback();
      console.error('UPDATE PRICE ERROR:', err);
      return res.status(500).json({
        error: 'Failed to update price',
        details: err.message
      });
    } finally {
      conn.release();
    }
  });*/

  app.put('/api/admin/books/price/:id', async (req, res) => {
    const { id } = req.params;
    const { price, original_price } = req.body;

    const parsedPrice = Number(price);
    const parsedOriginalPrice =
      original_price !== null && original_price !== undefined && original_price !== ''
        ? Number(original_price)
        : null;

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }

    if (
      parsedOriginalPrice !== null &&
      (!Number.isFinite(parsedOriginalPrice) || parsedOriginalPrice < 0)
    ) {
      return res.status(400).json({ error: 'Valid original_price is required' });
    }

    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      // 1) Read selected book so excel_books can be matched by ISBN + binding + edition
      const [[book]] = await conn.execute(
        `
      SELECT id, isbn13, isbn10, isbn, binding, edition
      FROM books
      WHERE id = ?
      LIMIT 1
      `,
        [id]
      );

      if (!book) {
        await conn.rollback();
        return res.status(404).json({ error: 'Book not found' });
      }

      // 2) Update only books.price + books.original_price
      const [bookResult] = await conn.execute(
        `
      UPDATE books
      SET price = ?, original_price = ?
      WHERE id = ?
      `,
        [parsedPrice, parsedOriginalPrice, id]
      );

      // 3) Build ISBN match for excel_books
      const isbnConditions = [];
      const isbnParams = [];

      if (book.isbn13) {
        isbnConditions.push(`isbn13 = ?`);
        isbnParams.push(book.isbn13);
      }

      if (book.isbn10) {
        isbnConditions.push(`isbn10 = ?`);
        isbnParams.push(book.isbn10);
      }

      if (book.isbn) {
        isbnConditions.push(`isbn = ?`);
        isbnParams.push(book.isbn);
      }

      let excelAffectedRows = 0;

      // 4) Update only excel_books.price + excel_books.original_price
      if (isbnConditions.length > 0) {
        const [excelResult] = await conn.execute(
          `
        UPDATE excel_books
        SET price = ?, original_price = ?
        WHERE (${isbnConditions.join(' OR ')})
          AND (binding <=> ?)
          AND (edition <=> ?)
        `,
          [
            parsedPrice,
            parsedOriginalPrice,
            ...isbnParams,
            book.binding ?? null,
            book.edition ?? null
          ]
        );

        excelAffectedRows = excelResult.affectedRows || 0;
      }

      await conn.commit();

      return res.json({
        success: true,
        message: 'Price updated successfully',
        updatedBookId: Number(id),
        updatedPrice: parsedPrice,
        updatedOriginalPrice: parsedOriginalPrice,
        updatedBooksRows: bookResult.affectedRows || 0,
        updatedExcelRows: excelAffectedRows
      });
    } catch (err) {
      await conn.rollback();
      console.error('UPDATE PRICE ERROR:', err);
      return res.status(500).json({
        error: 'Failed to update price',
        details: err.message
      });
    } finally {
      conn.release();
    }
  });


  app.post('/api/admin/upload-excel', authMiddleware, uploadExcel.single('file'), async (req, res) => {
    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      //const rows = XLSX.utils.sheet_to_json(sheet);

      const rawRows = XLSX.utils.sheet_to_json(sheet, {
        defval: null
      });

      const rows = rawRows.map(r => {
        const newRow = {};
        for (const key in r) {
          const cleanKey = key.trim().toLowerCase();  // ✅ removes spaces
          newRow[cleanKey] = r[key];
        }
        return newRow;
      });

      let successCount = 0;

      for (const row of rows) {

        if (!row.isbn13) {
          continue;
        }

        try {
          await db.execute(`
          INSERT INTO excel_books (
            isbn13, edition, binding,
            title_en, title_de, author,
            isbn, isbn10,
            price, original_price,
            category_id,
            description_en, description_de,
            publisher, pages,
            weight_grams, dimensions,
            format, language, publish_date,
            series_name, reading_age
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          title_en = VALUES(title_en),
          description_en = VALUES(description_en)
          `, [
            row.isbn13 ?? null,
            row.edition ?? null,
            row.binding ?? null,
            row.title_en ?? null,
            row.title_de ?? null,
            row.author ?? null,
            row.isbn ?? null,
            row.isbn10 ?? null,
            //row.price ?? null,
            //row.original_price ?? null,
            row.price !== null && row.price !== undefined && row.price !== ''
              ? Number(row.price)
              : null,
            row.original_price !== null && row.original_price !== undefined && row.original_price !== ''
              ? Number(row.original_price)
              : null,
            row.category_id ?? null,
            row.description_en ?? null,
            row.description_de ?? null,
            row.publisher ?? null,
            row.pages ?? null,
            row.weight_grams ?? null,
            row.dimensions ?? null,
            row.format ?? null,
            row.language ?? null,
            row.publish_date ?? null,
            row.series_name ?? null,
            row.reading_age ?? null
          ]);

          successCount++;

        } catch (err) {
          console.error('❌ FAILED ROW ISBN:', row.isbn13);
          console.error(err.message);
        }
      }

      /*res.json({
        success: true,
        inserted: successCount,
        total: rows.length
      });*/

      res.status(200).json({
        success: true
      });

      //res.json({ success: true, count: rows.length });

    } catch (err) {
      console.error('Excel upload error:', err);
      res.status(500).json({ error: 'Excel upload failed' });
    }
  });


  app.get('/api/admin/excel-books', async (req, res) => {
    const [rows] = await db.execute(`SELECT * FROM excel_books ORDER BY id DESC`);
    res.json(rows);
  });

  app.put('/api/admin/excel-books/:id', async (req, res) => {
    const id = req.params.id;
    const data = req.body;

    await db.execute(`
    UPDATE excel_books SET
      title_en=?, title_de=?, author=?,
      price=?, original_price=?, category_id=?,
      description_en=?, description_de=?,
      publisher=?, pages=?, weight_grams=?, dimensions=?,
      format=?, language=?, binding=?, edition=?,
      series_name=?, reading_age=?
    WHERE id = ?
  `, [
      data.title_en,
      data.title_de,
      data.author,
      data.price,
      data.original_price,
      data.category_id,
      data.description_en,
      data.description_de,
      data.publisher,
      data.pages,
      data.weight_grams,
      data.dimensions,
      data.format,
      data.language,
      data.binding,
      data.edition,
      data.series_name,
      data.reading_age,
      id
    ]);

    res.json({ success: true });
  });

  /*app.put('/api/admin/books/stock/:id', async (req, res) => {
    const { stock } = req.body;

    await db.execute(`
    UPDATE books
    SET stock = ?, is_available = ?
    WHERE id = ?
  `, [
      stock,
      stock > 0 ? 1 : 0,
      req.params.id
    ]);

    res.json({ success: true });
  });*/
  // ── REPLACES: app.put('/api/admin/books/stock/:id', ...) ───
  // Same stock-update behavior as before, PLUS: detects the
  // 0 -> positive transition and fires restock notification
  // emails to everyone waiting on this book.
  app.put('/api/admin/books/stock/:id', async (req, res) => {
    const { stock } = req.body;
    const bookId = req.params.id;

    try {
      // Read the OLD stock value before updating, so we can detect the
      // 0 -> positive transition precisely (only fire emails on that exact
      // transition, never on every stock edit).
      const [[before]] = await db.execute('SELECT stock FROM books WHERE id = ?', [bookId]);
      const wasOutOfStock = before && Number(before.stock) <= 0;

      await db.execute(`
      UPDATE books
      SET stock = ?, is_available = ?
      WHERE id = ?
    `, [stock, stock > 0 ? 1 : 0, bookId]);

      const isNowInStock = Number(stock) > 0;
      if (wasOutOfStock && isNowInStock) {
        // Fire-and-forget — don't make the admin's save wait on email sending.
        sendRestockNotifications(Number(bookId)).catch(err =>
          console.error('sendRestockNotifications failed:', err)
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error('PUT /api/admin/books/stock/:id error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });




  // REQUEST BOOK RELATED
  const bookSearchRoutes = require('./routes/bookSearchRoutes');
  app.use('/api/book-search', bookSearchRoutes);


  //app.use('/api', bookEnrichmentRoutes);
  app.use('/api', createBookEnrichmentRoutes(db));




  /*const deductWallet = async (userId, amount) => {
    await db.query(`
    UPDATE user_wallets
    SET balance = balance - ?
    WHERE user_id = ? AND balance >= ?
  `, [amount, userId, amount]);

    await db.query(`
    INSERT INTO wallet_transactions (user_id, amount, type, reason)
    VALUES (?, ?, 'DEBIT', 'Used in order')
  `, [userId, amount]);
  };*/


  // === START SERVER ===
  const PORT = process.env.PORT || 3001;

  // ✅ 0) Health endpoint BEFORE any SPA/static fallback
  app.get("/health", (req, res) => {
    res.json({
      env: process.env.NODE_ENV,
      port: process.env.PORT,
      db: process.env.DB_NAME
    });
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const baseUrl = 'https://englischbuecher.de';

      const [books] = await db.execute(`
      SELECT slug, created_at
      FROM books
      WHERE stock > 0
    `);

      const urls = [];

      const staticPages = [
        '',
        '/about',
        '/contact',
        '/faq',
        '/imprint',
        '/privacy',
        '/terms',
        '/shipping',
        '/returns',
        '/revocation',
        '/books',
        '/request-book',
      ];

      staticPages.forEach((path) => {
        urls.push(`
        <url>
          <loc>${baseUrl}${path}</loc>
          <changefreq>monthly</changefreq>
          <priority>0.8</priority>
        </url>
      `);
      });

      books.forEach((book) => {
        urls.push(`
        <url>
          <loc>${baseUrl}/book/${book.slug}</loc>
          <lastmod>${new Date(book.created_at).toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.9</priority>
        </url>
      `);
      });

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`;

      res.header('Content-Type', 'application/xml');
      res.send(sitemap);
    } catch (err) {
      console.error('Sitemap error:', err);
      res.status(500).send('Error generating sitemap');
    }
  });

  // ✅ Optional root endpoint (nice for quick checks)
  app.get("/", (req, res) => {
    res.status(200).send("OK - EnglischBuecher API");
  });

  // ✅ API-only 404 (keeps curl results clean)
  app.use((req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  //  // 1) Serve static frontend (optional on VPS, but keep if you want)
  //  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  //  app.use(express.static(distPath));

  //  // 2) SPA fallback for everything that is NOT an API or static/upload route
  //  app.get(/^\/(?!api|uploads|webhook|auth|health).*/, (req, res) => {
  //    res.sendFile(path.join(distPath, 'index.html'));
  //  });

  app.listen(PORT, '0.0.0.0', () => {
    //console.log(`Server running on port ${PORT}`);
  });

})();