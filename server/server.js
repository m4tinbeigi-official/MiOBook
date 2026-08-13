const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*' // Allow all origins for the Chrome Extension
}));

app.use(express.json());

// Turso (libSQL) database client
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let dbReady = db.execute(`
  CREATE TABLE IF NOT EXISTS reading_statuses (
    uid TEXT PRIMARY KEY,
    displayName TEXT NOT NULL,
    photoUrl TEXT,
    bookTitle TEXT,
    author TEXT,
    currentPage INTEGER DEFAULT 0,
    totalPages INTEGER DEFAULT 0,
    status TEXT,
    updatedAt INTEGER,
    isReadingNow INTEGER DEFAULT 0
  )
`).catch((err) => {
  console.error('Error initializing database:', err.message);
});

// Middleware to verify Google ID Token
async function verifyGoogleToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'توکن احراز هویت ارسال نشده است.' });
  }

  const idToken = authHeader.split(' ')[1];

  try {
    // Verify token using Google's tokeninfo API
    const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const response = await fetch(googleVerifyUrl);

    if (!response.ok) {
      return res.status(401).json({ error: 'توکن نامعتبر یا منقضی شده است.' });
    }

    const payload = await response.json();

    // Add verified user info to the request object
    req.user = {
      uid: payload.sub,
      email: payload.email,
      displayName: payload.name || payload.email.split('@')[0],
      photoUrl: payload.picture || ''
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(500).json({ error: 'خطای سرور در احراز هویت.' });
  }
}

// 1. Get social feed (Latest 30 statuses)
app.get('/api/social-feed', async (req, res) => {
  try {
    await dbReady;
    const result = await db.execute(`
      SELECT * FROM reading_statuses
      ORDER BY updatedAt DESC
      LIMIT 30
    `);

    const formattedRows = result.rows.map(row => ({
      uid: row.uid,
      displayName: row.displayName,
      photoUrl: row.photoUrl,
      bookTitle: row.bookTitle,
      author: row.author,
      currentPage: row.currentPage,
      totalPages: row.totalPages,
      status: row.status,
      updatedAt: row.updatedAt,
      isReadingNow: !!row.isReadingNow
    }));

    res.json(formattedRows);
  } catch (err) {
    console.error('Database query error:', err.message);
    res.status(500).json({ error: 'خطا در دریافت اطلاعات دیتابیس.' });
  }
});

// 2. Publish or update reading status (Authenticated)
app.post('/api/reading-status', verifyGoogleToken, async (req, res) => {
  const { uid, displayName, photoUrl } = req.user;
  const { bookTitle, author, currentPage, totalPages, status, isReadingNow } = req.body;

  const updatedAt = Date.now();
  const isReadingNowVal = isReadingNow ? 1 : 0;

  const query = `
    INSERT INTO reading_statuses (
      uid, displayName, photoUrl, bookTitle, author, currentPage, totalPages, status, updatedAt, isReadingNow
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      displayName = excluded.displayName,
      photoUrl = excluded.photoUrl,
      bookTitle = excluded.bookTitle,
      author = excluded.author,
      currentPage = excluded.currentPage,
      totalPages = excluded.totalPages,
      status = excluded.status,
      updatedAt = excluded.updatedAt,
      isReadingNow = excluded.isReadingNow
  `;

  const args = [
    uid,
    displayName,
    photoUrl,
    bookTitle || '',
    author || '',
    currentPage || 0,
    totalPages || 0,
    status || 'reading',
    updatedAt,
    isReadingNowVal
  ];

  try {
    await dbReady;
    await db.execute({ sql: query, args });
    res.json({ success: true, message: 'وضعیت مطالعه با موفقیت ثبت شد.' });
  } catch (err) {
    console.error('Database insert error:', err.message);
    res.status(500).json({ error: 'خطا در ثبت وضعیت در دیتابیس.' });
  }
});

// Local development: run a normal HTTP server.
// On Vercel, the app is imported as a serverless function handler instead.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
