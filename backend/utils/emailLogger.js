
// backend/utils/emailLogger.js

/*const mysql = require('mysql2/promise');

// ✅ create connection using ENV (same as your app)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function logEmail({ to, subject, html, status, error = null, type = null }) {
  try {
    await pool.execute(
      `INSERT INTO sent_emails (to_email, subject, html, status, error_message, type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [to, subject, html, status, error, type]
    );
  } catch (err) {
    console.error('Email logging failed:', err.message);
  }
}

module.exports = { logEmail };*/





const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    });
  }
  return pool;
}

async function logEmail({ to, subject, html, status, error = null, type = null }) {
  try {
    const pool = getPool();

    const [result] = await pool.execute(
      `INSERT INTO sent_emails 
       (to_email, subject, html, status, error, type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [to, subject, html, status, error, type]
    );

    console.log('✅ EMAIL LOGGER INSERT RESULT:', result);
    return result;
  } catch (err) {
    console.error('❌ EMAIL LOGGER FAILED:', err);
  }
}

module.exports = { logEmail };
