const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@libsql/client');

const SMSIR_API_KEY = process.env.SMSIR_API_KEY;
const SMSIR_TEMPLATE_ID = process.env.SMSIR_TEMPLATE_ID;
const OTP_TTL_MS = 2 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const app = express();

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
`).then(() => db.execute(`
  CREATE TABLE IF NOT EXISTS activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT,
    displayName TEXT,
    photoUrl TEXT,
    type TEXT,
    bookTitle TEXT,
    detail TEXT,
    createdAt INTEGER
  )
`)).then(() => db.execute(`
  CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT,
    bookTitle TEXT,
    durationMinutes INTEGER,
    completedAt INTEGER
  )
`)).then(() => db.execute(`
  CREATE TABLE IF NOT EXISTS reading_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT,
    bookTitle TEXT,
    pageNumber INTEGER,
    noteText TEXT,
    createdAt INTEGER
  )
`)).then(() => db.execute(`
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT,
    displayName TEXT,
    photoUrl TEXT,
    createdAt INTEGER
  )
`)).then(() => db.execute(`
  CREATE TABLE IF NOT EXISTS friendships (
    uid TEXT,
    friendUid TEXT,
    createdAt INTEGER,
    PRIMARY KEY (uid, friendUid)
  )
`)).then(() => db.execute(`
  CREATE TABLE IF NOT EXISTS otp_codes (
    phone TEXT PRIMARY KEY,
    code TEXT,
    expiresAt INTEGER,
    attempts INTEGER DEFAULT 0
  )
`)).then(() => db.execute(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    uid TEXT,
    expiresAt INTEGER
  )
`)).then(() => db.execute(`
  CREATE TABLE IF NOT EXISTS book_metadata (
    cacheKey TEXT PRIMARY KEY,
    title TEXT,
    author TEXT,
    publisher TEXT,
    summary TEXT,
    coverUrl TEXT,
    source TEXT,
    updatedAt INTEGER
  )
`)).then(() => db.execute(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    uid TEXT PRIMARY KEY,
    genres TEXT,
    pace TEXT,
    goal TEXT,
    discovery TEXT,
    completedAt INTEGER,
    updatedAt INTEGER
  )
`)).then(() => db.execute(`
  CREATE TABLE IF NOT EXISTS library_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT,
    title TEXT,
    author TEXT,
    publisher TEXT,
    summary TEXT,
    coverUrl TEXT,
    totalPages INTEGER DEFAULT 0,
    currentPage INTEGER DEFAULT 0,
    status TEXT DEFAULT 'toRead',
    addedAt INTEGER,
    updatedAt INTEGER
  )
`)).then(() => db.execute(`
  ALTER TABLE users ADD COLUMN phone TEXT
`).catch(() => {})).catch((err) => {
  console.error('Error initializing database:', err.message);
});

// Normalize a title/author pair into a stable cache key for book_metadata
function bookCacheKey(title, author) {
  const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
  return `${norm(title)}::${norm(author)}`;
}

// Look up (and cache) publisher/summary/cover info for a book via Google Books
async function getOrFetchBookInfo(title, author) {
  const cacheKey = bookCacheKey(title, author);
  await dbReady;

  const cached = await db.execute({
    sql: `SELECT * FROM book_metadata WHERE cacheKey = ?`,
    args: [cacheKey]
  });

  if (cached.rows.length > 0) {
    const row = cached.rows[0];
    return {
      title: row.title,
      author: row.author,
      publisher: row.publisher,
      summary: row.summary,
      coverUrl: row.coverUrl,
      source: row.source
    };
  }

  let info = { title: title || '', author: author || '', publisher: '', summary: '', coverUrl: '', source: 'none' };

  try {
    const q = encodeURIComponent(`intitle:${title || ''}${author ? ' inauthor:' + author : ''}`);
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`);
    if (response.ok) {
      const data = await response.json();
      const item = data.items && data.items[0];
      if (item && item.volumeInfo) {
        const vi = item.volumeInfo;
        info = {
          title: vi.title || title || '',
          author: (vi.authors && vi.authors.join('، ')) || author || '',
          publisher: vi.publisher || '',
          summary: vi.description || '',
          coverUrl: (vi.imageLinks && (vi.imageLinks.thumbnail || vi.imageLinks.smallThumbnail)) || '',
          source: 'google_books'
        };
      }
    }
  } catch (err) {
    console.error('Google Books lookup error:', err.message);
  }

  try {
    await db.execute({
      sql: `INSERT INTO book_metadata (cacheKey, title, author, publisher, summary, coverUrl, source, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cacheKey) DO UPDATE SET
              title = excluded.title, author = excluded.author, publisher = excluded.publisher,
              summary = excluded.summary, coverUrl = excluded.coverUrl, source = excluded.source, updatedAt = excluded.updatedAt`,
      args: [cacheKey, info.title, info.author, info.publisher, info.summary, info.coverUrl, info.source, Date.now()]
    });
  } catch (err) {
    console.error('book_metadata cache write error:', err.message);
  }

  return info;
}

// Send an OTP SMS via the sms.ir "Fast Login / Verify" API
async function sendOtpSms(phone, code) {
  const response = await fetch('https://api.sms.ir/v1/send/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': SMSIR_API_KEY
    },
    body: JSON.stringify({
      mobile: phone,
      templateId: Number(SMSIR_TEMPLATE_ID),
      parameters: [{ name: 'CODE', value: code }]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status !== 1) {
    throw new Error((data && data.message) || 'خطا در ارسال پیامک از sms.ir');
  }
  return data;
}

// Middleware to verify Google ID Token
async function verifyGoogleToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'توکن احراز هویت ارسال نشده است.' });
  }

  const idToken = authHeader.split(' ')[1];

  try {
    // First check if this is one of our own phone-login session tokens
    await dbReady;
    const sessionResult = await db.execute({
      sql: `SELECT s.uid, s.expiresAt, u.email, u.displayName, u.photoUrl, u.phone
            FROM sessions s JOIN users u ON u.uid = s.uid
            WHERE s.token = ?`,
      args: [idToken]
    });

    if (sessionResult.rows.length > 0) {
      const session = sessionResult.rows[0];
      if (session.expiresAt < Date.now()) {
        return res.status(401).json({ error: 'توکن نامعتبر یا منقضی شده است.' });
      }
      req.user = {
        uid: session.uid,
        email: session.email || '',
        displayName: session.displayName || session.phone,
        photoUrl: session.photoUrl || ''
      };
      return next();
    }

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

    // Keep a minimal users directory up to date so features like "add friend by
    // email" have something real to search against. Fire-and-forget but awaited
    // so it's guaranteed to exist before any downstream handler reads it.
    try {
      await dbReady;
      await db.execute({
        sql: `INSERT INTO users (uid, email, displayName, photoUrl, createdAt)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(uid) DO UPDATE SET
                email = excluded.email,
                displayName = excluded.displayName,
                photoUrl = excluded.photoUrl`,
        args: [req.user.uid, req.user.email, req.user.displayName, req.user.photoUrl, Date.now()]
      });
    } catch (userErr) {
      console.error('Error upserting user directory:', userErr.message);
    }

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(500).json({ error: 'خطای سرور در احراز هویت.' });
  }
}

// Send a login OTP code to a phone number via sms.ir
app.post('/api/auth/otp/send', async (req, res) => {
  const { phone } = req.body;

  if (!phone || !/^09\d{9}$/.test(phone)) {
    return res.status(400).json({ error: 'شماره موبایل نامعتبر است.' });
  }

  const code = String(crypto.randomInt(10000, 99999));

  try {
    await dbReady;
    await db.execute({
      sql: `INSERT INTO otp_codes (phone, code, expiresAt, attempts)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(phone) DO UPDATE SET
              code = excluded.code,
              expiresAt = excluded.expiresAt,
              attempts = 0`,
      args: [phone, code, Date.now() + OTP_TTL_MS]
    });

    await sendOtpSms(phone, code);
    res.json({ success: true, message: 'کد تایید ارسال شد.' });
  } catch (err) {
    console.error('OTP send error:', err.message);
    res.status(500).json({ error: 'خطا در ارسال کد تایید.' });
  }
});

// Verify an OTP code and log the user in, issuing a session token
app.post('/api/auth/otp/verify', async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'شماره موبایل و کد الزامی است.' });
  }

  try {
    await dbReady;
    const result = await db.execute({
      sql: `SELECT code, expiresAt, attempts FROM otp_codes WHERE phone = ?`,
      args: [phone]
    });

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'ابتدا کد تایید را درخواست کنید.' });
    }

    const record = result.rows[0];

    if (record.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'کد تایید منقضی شده است.' });
    }

    if (record.attempts >= 5) {
      return res.status(429).json({ error: 'تعداد تلاش‌های مجاز به پایان رسیده است.' });
    }

    if (String(record.code) !== String(code)) {
      await db.execute({
        sql: `UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?`,
        args: [phone]
      });
      return res.status(400).json({ error: 'کد تایید نادرست است.' });
    }

    await db.execute({ sql: `DELETE FROM otp_codes WHERE phone = ?`, args: [phone] });

    const uid = `phone:${phone}`;
    const displayName = phone;

    await db.execute({
      sql: `INSERT INTO users (uid, email, displayName, photoUrl, phone, createdAt)
            VALUES (?, '', ?, '', ?, ?)
            ON CONFLICT(uid) DO UPDATE SET phone = excluded.phone`,
      args: [uid, displayName, phone, Date.now()]
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_TTL_MS;

    await db.execute({
      sql: `INSERT INTO sessions (token, uid, expiresAt) VALUES (?, ?, ?)`,
      args: [token, uid, expiresAt]
    });

    res.json({
      success: true,
      token,
      uid,
      phone,
      displayName,
      expiresAt
    });
  } catch (err) {
    console.error('OTP verify error:', err.message);
    res.status(500).json({ error: 'خطا در تایید کد.' });
  }
});

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

// 3. Get activity feed (latest 30 events)
app.get('/api/activity-feed', async (req, res) => {
  try {
    await dbReady;
    const result = await db.execute(`
      SELECT * FROM activity_events
      ORDER BY createdAt DESC
      LIMIT 30
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Database query error:', err.message);
    res.status(500).json({ error: 'خطا در دریافت فید فعالیت‌ها.' });
  }
});

// 4. Create an activity event (Authenticated)
app.post('/api/activity-events', verifyGoogleToken, async (req, res) => {
  const { uid, displayName, photoUrl } = req.user;
  const { type, bookTitle, detail } = req.body;

  try {
    await dbReady;
    await db.execute({
      sql: `INSERT INTO activity_events (uid, displayName, photoUrl, type, bookTitle, detail, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [uid, displayName, photoUrl, type || '', bookTitle || '', detail || '', Date.now()]
    });
    res.json({ success: true, message: 'رویداد با موفقیت ثبت شد.' });
  } catch (err) {
    console.error('Database insert error:', err.message);
    res.status(500).json({ error: 'خطا در ثبت رویداد در دیتابیس.' });
  }
});

// 5. Log a completed Pomodoro session (Authenticated) — also writes an activity event
app.post('/api/pomodoro-sessions', verifyGoogleToken, async (req, res) => {
  const { uid, displayName, photoUrl } = req.user;
  const { bookTitle, durationMinutes } = req.body;
  const completedAt = Date.now();

  try {
    await dbReady;
    await db.execute({
      sql: `INSERT INTO pomodoro_sessions (uid, bookTitle, durationMinutes, completedAt) VALUES (?, ?, ?, ?)`,
      args: [uid, bookTitle || '', durationMinutes || 0, completedAt]
    });

    const detail = `${durationMinutes || 0} دقیقه`;
    await db.execute({
      sql: `INSERT INTO activity_events (uid, displayName, photoUrl, type, bookTitle, detail, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [uid, displayName, photoUrl, 'pomodoro_session', bookTitle || '', detail, completedAt]
    });

    res.json({ success: true, message: 'جلسه پومودورو با موفقیت ثبت شد.' });
  } catch (err) {
    console.error('Database insert error:', err.message);
    res.status(500).json({ error: 'خطا در ثبت جلسه پومودورو در دیتابیس.' });
  }
});

// 6. Get current user's Pomodoro sessions (Authenticated)
app.get('/api/pomodoro-sessions', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;

  try {
    await dbReady;
    const result = await db.execute({
      sql: `SELECT * FROM pomodoro_sessions WHERE uid = ? ORDER BY completedAt DESC`,
      args: [uid]
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Database query error:', err.message);
    res.status(500).json({ error: 'خطا در دریافت جلسات پومودورو.' });
  }
});

// 7. Create a reading note (Authenticated)
app.post('/api/notes', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;
  const { bookTitle, pageNumber, noteText } = req.body;

  if (!noteText || !noteText.trim()) {
    return res.status(400).json({ error: 'متن یادداشت نمی‌تواند خالی باشد.' });
  }

  try {
    await dbReady;
    await db.execute({
      sql: `INSERT INTO reading_notes (uid, bookTitle, pageNumber, noteText, createdAt) VALUES (?, ?, ?, ?, ?)`,
      args: [uid, bookTitle || '', pageNumber || 0, noteText.trim(), Date.now()]
    });
    res.json({ success: true, message: 'یادداشت با موفقیت ذخیره شد.' });
  } catch (err) {
    console.error('Database insert error:', err.message);
    res.status(500).json({ error: 'خطا در ذخیره یادداشت در دیتابیس.' });
  }
});

// 8. Get current user's reading notes (Authenticated)
app.get('/api/notes', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;

  try {
    await dbReady;
    const result = await db.execute({
      sql: `SELECT * FROM reading_notes WHERE uid = ? ORDER BY createdAt DESC`,
      args: [uid]
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Database query error:', err.message);
    res.status(500).json({ error: 'خطا در دریافت یادداشت‌ها.' });
  }
});

// 9. Add a friend by email (Authenticated) — mutual add, looks up target in the users directory
app.post('/api/friends', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;
  const { friendEmail } = req.body;

  if (!friendEmail || !friendEmail.trim()) {
    return res.status(400).json({ error: 'ایمیل دوست را وارد کنید.' });
  }

  try {
    await dbReady;

    const userResult = await db.execute({
      sql: `SELECT * FROM users WHERE email = ?`,
      args: [friendEmail.trim().toLowerCase()]
    });

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربری با این ایمیل در میو بوک پیدا نشد. باید حداقل یک‌بار وارد حساب کاربری خود در میو بوک شده باشد.' });
    }

    const friend = userResult.rows[0];
    if (friend.uid === uid) {
      return res.status(400).json({ error: 'نمی‌توانید خودتان را به عنوان دوست اضافه کنید.' });
    }

    const now = Date.now();
    await db.execute({
      sql: `INSERT INTO friendships (uid, friendUid, createdAt) VALUES (?, ?, ?)
            ON CONFLICT(uid, friendUid) DO NOTHING`,
      args: [uid, friend.uid, now]
    });
    await db.execute({
      sql: `INSERT INTO friendships (uid, friendUid, createdAt) VALUES (?, ?, ?)
            ON CONFLICT(uid, friendUid) DO NOTHING`,
      args: [friend.uid, uid, now]
    });

    res.json({ success: true, message: 'دوست با موفقیت اضافه شد.', friend: { uid: friend.uid, displayName: friend.displayName, photoUrl: friend.photoUrl } });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: 'خطا در افزودن دوست.' });
  }
});

// 10. Get current user's friends, joined with their latest reading status (Authenticated)
app.get('/api/friends', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;

  try {
    await dbReady;
    const result = await db.execute({
      sql: `
        SELECT u.uid AS uid, u.displayName AS displayName, u.photoUrl AS photoUrl,
               rs.bookTitle AS bookTitle, rs.author AS author, rs.currentPage AS currentPage,
               rs.totalPages AS totalPages, rs.status AS status, rs.updatedAt AS updatedAt,
               rs.isReadingNow AS isReadingNow
        FROM friendships f
        JOIN users u ON u.uid = f.friendUid
        LEFT JOIN reading_statuses rs ON rs.uid = f.friendUid
        WHERE f.uid = ?
        ORDER BY rs.updatedAt DESC
      `,
      args: [uid]
    });

    const formatted = result.rows.map(row => ({
      uid: row.uid,
      displayName: row.displayName,
      photoUrl: row.photoUrl,
      bookTitle: row.bookTitle,
      author: row.author,
      currentPage: row.currentPage || 0,
      totalPages: row.totalPages || 0,
      status: row.status,
      updatedAt: row.updatedAt,
      isReadingNow: !!row.isReadingNow
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Database query error:', err.message);
    res.status(500).json({ error: 'خطا در دریافت لیست دوستان.' });
  }
});

// 11. Unfriend (Authenticated) — removes both directions
app.delete('/api/friends/:friendUid', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;
  const { friendUid } = req.params;

  try {
    await dbReady;
    await db.execute({ sql: `DELETE FROM friendships WHERE uid = ? AND friendUid = ?`, args: [uid, friendUid] });
    await db.execute({ sql: `DELETE FROM friendships WHERE uid = ? AND friendUid = ?`, args: [friendUid, uid] });
    res.json({ success: true, message: 'دوست با موفقیت حذف شد.' });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: 'خطا در حذف دوست.' });
  }
});

// 12. Get book info (publisher, summary, cover) — public, cached server-side
app.get('/api/book-info', async (req, res) => {
  const { title, author } = req.query;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'عنوان کتاب الزامی است.' });
  }

  try {
    const info = await getOrFetchBookInfo(title.trim(), (author || '').trim());
    res.json(info);
  } catch (err) {
    console.error('book-info error:', err.message);
    res.status(500).json({ error: 'خطا در دریافت اطلاعات کتاب.' });
  }
});

// 13. Get current user's taste preferences (Authenticated)
app.get('/api/preferences', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;

  try {
    await dbReady;
    const result = await db.execute({
      sql: `SELECT * FROM user_preferences WHERE uid = ?`,
      args: [uid]
    });

    if (result.rows.length === 0) {
      return res.json(null);
    }

    const row = result.rows[0];
    res.json({
      genres: row.genres ? JSON.parse(row.genres) : [],
      pace: row.pace || '',
      goal: row.goal || '',
      discovery: row.discovery || '',
      completedAt: row.completedAt || null
    });
  } catch (err) {
    console.error('Database query error:', err.message);
    res.status(500).json({ error: 'خطا در دریافت سلیقه مطالعه.' });
  }
});

// 14. Save current user's taste preferences from the onboarding wizard (Authenticated)
app.post('/api/preferences', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;
  const { genres, pace, goal, discovery } = req.body;
  const now = Date.now();

  try {
    await dbReady;
    await db.execute({
      sql: `INSERT INTO user_preferences (uid, genres, pace, goal, discovery, completedAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET
              genres = excluded.genres, pace = excluded.pace, goal = excluded.goal,
              discovery = excluded.discovery, completedAt = excluded.completedAt, updatedAt = excluded.updatedAt`,
      args: [uid, JSON.stringify(genres || []), pace || '', goal || '', discovery || '', now, now]
    });
    res.json({ success: true, message: 'سلیقه مطالعه با موفقیت ذخیره شد.' });
  } catch (err) {
    console.error('Database insert error:', err.message);
    res.status(500).json({ error: 'خطا در ذخیره سلیقه مطالعه.' });
  }
});

// 15. Get current user's full library, stored server-side (Authenticated)
app.get('/api/library', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;

  try {
    await dbReady;
    const result = await db.execute({
      sql: `SELECT * FROM library_books WHERE uid = ? ORDER BY updatedAt DESC`,
      args: [uid]
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Database query error:', err.message);
    res.status(500).json({ error: 'خطا در دریافت کتابخانه.' });
  }
});

// 16. Add a book to the server-side library (Authenticated) — enriches publisher/summary automatically
app.post('/api/library', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;
  const { title, author, coverUrl, totalPages, currentPage, status } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'عنوان کتاب الزامی است.' });
  }

  try {
    const info = await getOrFetchBookInfo(title.trim(), (author || '').trim());
    const now = Date.now();

    await dbReady;
    const result = await db.execute({
      sql: `INSERT INTO library_books
              (uid, title, author, publisher, summary, coverUrl, totalPages, currentPage, status, addedAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        uid,
        title.trim(),
        (author || '').trim(),
        info.publisher || '',
        info.summary || '',
        coverUrl || info.coverUrl || '',
        totalPages || 0,
        currentPage || 0,
        status || 'toRead',
        now,
        now
      ]
    });

    res.json({
      id: Number(result.lastInsertRowid),
      uid, title: title.trim(), author: (author || '').trim(),
      publisher: info.publisher || '', summary: info.summary || '',
      coverUrl: coverUrl || info.coverUrl || '',
      totalPages: totalPages || 0, currentPage: currentPage || 0,
      status: status || 'toRead', addedAt: now, updatedAt: now
    });
  } catch (err) {
    console.error('Database insert error:', err.message);
    res.status(500).json({ error: 'خطا در افزودن کتاب به کتابخانه.' });
  }
});

// 17. Update a server-side library book's progress/status (Authenticated)
app.put('/api/library/:id', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;
  const { id } = req.params;
  const { currentPage, totalPages, status } = req.body;

  try {
    await dbReady;
    const existing = await db.execute({
      sql: `SELECT id FROM library_books WHERE id = ? AND uid = ?`,
      args: [id, uid]
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'کتاب یافت نشد.' });
    }

    await db.execute({
      sql: `UPDATE library_books SET
              currentPage = COALESCE(?, currentPage),
              totalPages = COALESCE(?, totalPages),
              status = COALESCE(?, status),
              updatedAt = ?
            WHERE id = ? AND uid = ?`,
      args: [currentPage ?? null, totalPages ?? null, status || null, Date.now(), id, uid]
    });

    res.json({ success: true, message: 'کتاب به‌روزرسانی شد.' });
  } catch (err) {
    console.error('Database update error:', err.message);
    res.status(500).json({ error: 'خطا در به‌روزرسانی کتاب.' });
  }
});

// 18. Delete a server-side library book (Authenticated)
app.delete('/api/library/:id', verifyGoogleToken, async (req, res) => {
  const { uid } = req.user;
  const { id } = req.params;

  try {
    await dbReady;
    await db.execute({ sql: `DELETE FROM library_books WHERE id = ? AND uid = ?`, args: [id, uid] });
    res.json({ success: true, message: 'کتاب حذف شد.' });
  } catch (err) {
    console.error('Database delete error:', err.message);
    res.status(500).json({ error: 'خطا در حذف کتاب.' });
  }
});

// 19. Build a personal "reading story" summary card from the user's real server-side data (Authenticated)
app.get('/api/story', verifyGoogleToken, async (req, res) => {
  const { uid, displayName, photoUrl } = req.user;

  try {
    await dbReady;

    const library = await db.execute({
      sql: `SELECT title, author, status, totalPages, currentPage FROM library_books WHERE uid = ?`,
      args: [uid]
    });

    const prefsResult = await db.execute({
      sql: `SELECT genres FROM user_preferences WHERE uid = ?`,
      args: [uid]
    });

    const pomodoroResult = await db.execute({
      sql: `SELECT COALESCE(SUM(durationMinutes), 0) AS totalMinutes, COUNT(*) AS sessionCount FROM pomodoro_sessions WHERE uid = ?`,
      args: [uid]
    });

    const read = library.rows.filter(r => r.status === 'read');
    const reading = library.rows.filter(r => r.status === 'reading');
    const toRead = library.rows.filter(r => r.status === 'toRead');

    const pagesRead = read.reduce((sum, r) => sum + (r.totalPages || 0), 0)
      + reading.reduce((sum, r) => sum + (r.currentPage || 0), 0);

    res.json({
      displayName,
      photoUrl,
      totalBooks: library.rows.length,
      read: read.map(r => ({ title: r.title, author: r.author })),
      reading: reading.map(r => ({ title: r.title, author: r.author })),
      toRead: toRead.map(r => ({ title: r.title, author: r.author })),
      pagesRead,
      genres: prefsResult.rows[0] && prefsResult.rows[0].genres ? JSON.parse(prefsResult.rows[0].genres) : [],
      pomodoroMinutes: (pomodoroResult.rows[0] && pomodoroResult.rows[0].totalMinutes) || 0,
      pomodoroSessions: (pomodoroResult.rows[0] && pomodoroResult.rows[0].sessionCount) || 0
    });
  } catch (err) {
    console.error('Database query error:', err.message);
    res.status(500).json({ error: 'خطا در ساخت استوری.' });
  }
});

module.exports = app;
