# بک‌اند اختصاصی میو بوک (راهنمای راه‌اندازی و دپلویمنت)

این پروژه یک سرور سبک و سریع با **Node.js + Express** و دیتابیس **Turso (libSQL)** است که به عنوان جایگزین کامل برای فایربیس (Firebase) طراحی شده و روی **Vercel** به‌صورت رایگان دیپلوی می‌شود. این سرور مستقیماً توکن احراز هویت گوگل را تأیید کرده و فید مطالعه کاربران را ثبت و واکشی می‌کند.

> توجه: نسخه قبلی این سرور از SQLite فایلی استفاده می‌کرد که روی هاست‌های serverless مثل Vercel کار نمی‌کند (فایل‌سیستم پایدار نیست). دیتابیس اکنون به Turso منتقل شده که یک SQLite ابری است و از هر جا (از جمله Vercel) در دسترس است.

---

## 🚀 راه‌اندازی محلی (Development)

برای اجرای سرور روی سیستم خودتان:

1. ابتدا مطمئن شوید که Node.js (نسخه ۱۸ یا بالاتر) را نصب دارید.
2. با ترمینال وارد پوشه `server` شوید:
   ```bash
   cd server
   ```
3. وابستگی‌ها را نصب کنید:
   ```bash
   npm install
   ```
4. سرور را در حالت توسعه (با قابلیت ری‌استارت خودکار در صورت تغییر فایل‌ها) اجرا کنید:
   ```bash
   npm run dev
   ```
   سرور به صورت پیش‌فرض روی پورت `5000` اجرا خواهد شد (`http://localhost:5000`).

---

## ⚙️ تنظیمات در افزونه کروم

در افزونه کروم، فایل [social-db.js](file:///Users/ricksabchez/Desktop/MioBook/scripts/social-db.js) را باز کنید:
1. مقدار `USE_CUSTOM_SERVER` روی `true` تنظیم شده باشد.
2. آدرس سرور توسعه را قرار دهید:
   ```javascript
   const CUSTOM_SERVER_URL = "http://localhost:5000";
   ```
3. شناسه گوگل خود را در بخش `clientId` در شیء `FIREBASE_CONFIG` قرار دهید:
   ```javascript
   clientId: "YOUR_GOOGLE_OAUTH_CLIENT_ID"
   ```

---

## ☁️ دپلویمنت روی Vercel (Production)

### مرحله ۱: ساخت دیتابیس Turso (رایگان)

1. وارد [turso.tech](https://turso.tech) شوید و ثبت‌نام کنید (یا از CLI استفاده کنید).
2. با Turso CLI یک دیتابیس بسازید:
   ```bash
   turso db create miobook
   ```
3. آدرس اتصال دیتابیس را بگیرید:
   ```bash
   turso db show miobook --url
   ```
4. یک توکن احراز هویت بسازید:
   ```bash
   turso db tokens create miobook
   ```
   این دو مقدار را نگه دارید — در مرحله بعد به‌عنوان متغیر محیطی لازم می‌شوند.

### مرحله ۲: دیپلوی روی Vercel

1. وارد [vercel.com](https://vercel.com) شوید و با گیت‌هاب لاگین کنید.
2. مخزن پروژه را وارد Vercel کنید و **Root Directory** را روی `server` قرار دهید.
3. Framework Preset را روی **Other** بگذارید (پروژه یک Express app است، نه یک فریمورک خاص).
4. در بخش **Environment Variables** دو متغیر زیر را اضافه کنید:
   - `TURSO_DATABASE_URL` = آدرسی که در مرحله قبل گرفتید (چیزی شبیه `libsql://miobook-xxxx.turso.io`)
   - `TURSO_AUTH_TOKEN` = توکنی که ساختید
5. روی **Deploy** بزنید.
6. آدرس تولید شده توسط Vercel (مثلاً `https://miobook-backend.vercel.app`) را در متغیر `CUSTOM_SERVER_URL` در فایل `social-db.js` افزونه قرار دهید.

هر بار که کد را push کنید، Vercel به‌صورت خودکار نسخه جدید را دیپلوی می‌کند.
