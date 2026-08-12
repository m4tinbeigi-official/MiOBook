const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for Chrome Extension requests
app.use(cors({
  origin: '*' // Allow all origins for the Chrome Extension
}));

app.use(express.json());

// Initialize SQLite database
const dbPath = path.join(__dirname, 'miobook.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    db.run(`
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
    `);
  }
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
app.get('/api/social-feed', (req, res) => {
  const query = `
    SELECT * FROM reading_statuses 
    ORDER BY updatedAt DESC 
    LIMIT 30
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Database query error:', err.message);
      return res.status(500).json({ error: 'خطا در دریافت اطلاعات دیتابیس.' });
    }
    
    // Map database fields to the format that the Chrome extension expects
    const formattedRows = rows.map(row => ({
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
  });
});

// 2. Publish or update reading status (Authenticated)
app.post('/api/reading-status', verifyGoogleToken, (req, res) => {
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

  const params = [
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

  db.run(query, params, function(err) {
    if (err) {
      console.error('Database insert error:', err.message);
      return res.status(500).json({ error: 'خطا در ثبت وضعیت در دیتابیس.' });
    }
    res.json({ success: true, message: 'وضعیت مطالعه با موفقیت ثبت شد.' });
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
