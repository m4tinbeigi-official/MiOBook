# میو بوک (MioBook) — مستندات فنی پروژه

> این فایل مرجع اصلی مستندات پروژه است. با هر تغییر مهم در کد، این فایل نیز باید به‌روزرسانی شود.

## معرفی

میو بوک یک **افزونه کروم (Manifest V3)** برای دستیاری مطالعه است: هایلایت و یادداشت‌نویسی روی هر صفحه وب، کتابخانه شخصی، تایمر تمرکز (Pomodoro/Ambient sounds)، دیکشنری/بانک لغات، و اتصال به فروشگاه‌های کتاب ایرانی (طاقچه و فیدیبو) برای همگام‌سازی کتابخانه و مقایسه قیمت. یک **بک‌اند سبک Node.js/Express + Turso (libSQL)** هم برای فید اجتماعی مطالعه (خواندن دوستان) روی Vercel دیپلوی شده است.

## ساختار پروژه

```
MioBook/
├── manifest.json          # مانیفست افزونه کروم (MV3)
├── background.js          # Service Worker پس‌زمینه
├── scripts/
│   ├── content.js         # اسکریپت تزریق‌شده در همه صفحات: هایلایت، منوی شناور، یادداشت
│   ├── connector-taaghche.js  # اتصال‌دهنده به taaghche.com (اسکرپ کتابخانه/پیشرفت)
│   ├── connector-fidibo.js    # اتصال‌دهنده به fidibo.com
│   ├── social-db.js       # لایه ارتباط با بک‌اند (فید اجتماعی، Firebase/Custom server)
│   ├── ambient.js          # صداهای محیطی (باران، نویز و...) برای حالت تمرکز
│   └── i18n.js             # چندزبانه‌سازی رابط کاربری
├── dashboard/
│   ├── dashboard.html/js/css   # صفحه اصلی (newtab override) — کتابخانه، آمار، جستجو
│   ├── dashboard_phase6.js     # افزونه‌های فاز ۶ داشبورد
│   └── newtab-extra.js
├── sidepanel/
│   ├── sidepanel.html/js/css   # پنل کناری کروم — هایلایت‌ها، لغات، تایمر
│   └── sidepanel_phase6.js
├── options/
│   └── language.html/js        # صفحه تنظیمات زبان
├── styles/                     # استایل‌های مشترک و هایلایتر
├── assets/                     # آیکون‌ها و فونت‌ها (Vazirmatn)
├── docs/                       # لندینگ‌پیج GitHub Pages (index.html)
└── server/                     # بک‌اند Express + Turso
    ├── app.js                  # تعریف route های Express
    ├── server.js                # نقطه ورود سرور (listen)
    ├── api/index.js             # ورودی Serverless Function برای Vercel
    ├── vercel.json               # پیکربندی روتینگ Vercel
    └── README.md                 # راهنمای راه‌اندازی و دیپلوی (فارسی)
```

## معماری افزونه کروم

- **Manifest V3**، `background.js` به‌عنوان service worker.
- `chrome_url_overrides.newtab` → `dashboard/newtab.html` (داشبورد جایگزین تب جدید می‌شود).
- `content_scripts`:
  - `scripts/content.js` روی همه صفحات (`http(s)://*/*`) تزریق می‌شود؛ مسئول هایلایت متن، منوی شناور، و بنر کتابخانه.
  - `scripts/connector-taaghche.js` فقط روی `*.taaghche.com`.
  - `scripts/connector-fidibo.js` فقط روی `*.fidibo.com`.
- `options_ui` به `dashboard/dashboard.html` اشاره دارد (صفحه تنظیمات = همان داشبورد).
- ذخیره‌سازی عملیاتی (سریع/آفلاین) در `chrome.storage` است، اما کتابخانه، سلیقه مطالعه و اطلاعات کتاب همیشه روی بک‌اند هم آینه‌سازی/ذخیره می‌شوند (نگاه کنید به بخش «کتابخانه، خلاصه کتاب، ویزارد سلیقه و استوری» زیر).

### کتابخانه، خلاصه کتاب، ویزارد سلیقه و استوری (روی بک‌اند)

- **خلاصه/ناشر کتاب:** `GET /api/book-info?title=&author=` — کش‌شده در جدول `book_metadata`؛ در صورت نبود، از Google Books API گرفته و کش می‌شود. در `dashboard.js` با `loadBookSummary()` روی مودال جزئیات کتاب نمایش داده می‌شود.
- **کتابخانه سمت سرور:** جدول `library_books` + روت‌های `GET/POST /api/library` و `PUT/DELETE /api/library/:id`. هر افزودن/ویرایش/حذف کتاب در `dashboard.js` (فرم دستی، به‌روزرسانی پیشرفت، درون‌ریزی Goodreads) و در `background.js` (همگام‌سازی طاقچه/فیدیبو) به‌صورت fire-and-forget با تابع `syncBookToServer` / `syncNewBooksToServer` به سرور هم فرستاده می‌شود؛ `book.serverId` رابط محلی↔سرور است. بعد از لاگین، `syncAllLocalBooksToServer()` هر کتاب بدون `serverId` را هم آپلود می‌کند.
- **ویزارد سلیقه مطالعه:** مودال `#taste-wizard-modal` در `dashboard.html` (ژانر، سرعت مطالعه، هدف، نحوه کشف کتاب) — بعد از اولین ورود (اگر `GET /api/preferences` چیزی برنگرداند) نمایش داده می‌شود و با `POST /api/preferences` روی جدول `user_preferences` ذخیره می‌شود.
- **استوری مطالعه (Wrapped-style):** دکمه «📖 استوری مطالعه من» در ویجت پروفایل → `GET /api/story` (تجمیع از `library_books`, `user_preferences`, `pomodoro_sessions`) → رندر روی `<canvas>` در `dashboard.js` (`renderStoryCanvas`) با برندینگ میو بوک، قابل دانلود به‌صورت PNG.

### ماژول‌های کلیدی (بر اساس گراف کد ایندکس‌شده)

| ماژول | مسئولیت | توابع پرکاربرد (fan-in بالا) |
|---|---|---|
| `dashboard/dashboard.js` | رندر کتابخانه، جستجوی ترکیبی فروشگاه‌ها، آمار مطالعه | `escapeHtml`, `renderLibraryGrid`, `loadBookstoreComparison`, `performBookSearch` |
| `sidepanel/sidepanel.js` | هایلایت‌ها، بانک لغات، تایمر | `getActiveTab`, `loadHighlights`, `renderHighlightsList`, `deleteHighlight` |
| `scripts/content.js` | تعامل با DOM صفحه، هایلایت، منوی شناور | `removeFloatingMenu`, `showTransientToast`, `highlightSelection` |
| `scripts/social-db.js` | لایه احراز هویت و فید اجتماعی (Firebase/Custom server) | `isConfigured`, `getAuthToken`, `refreshFirebaseToken` |
| `scripts/connector-taaghche.js` / `connector-fidibo.js` | همگام‌سازی کتابخانه از فروشگاه‌ها | `syncLibrary`, `isLoggedIn`, `scrapeVisibleBooks` |
| `background.js` | جستجوی پس‌زمینه و مقایسه قیمت بین فروشگاه‌ها | `performBackgroundSearch`, `searchTaaghcheAPI`, `searchFidiboAPI` |
| `scripts/ambient.js` | پخش صداهای محیطی برای تمرکز | `play`, `_playRain`, `_playBrownNoise` |
| `scripts/i18n.js`, `options/language.js` | چندزبانه‌سازی | — |

مرز معماری اصلی: `dashboard` → `social-db` (داشبورد مستقیماً به لایه فید اجتماعی متصل می‌شود).

## بک‌اند (`server/`)

- **Stack:** Node.js + Express + `@libsql/client` (Turso — SQLite ابری، جایگزین Firebase).
- **جدول اصلی:** `reading_statuses` (uid, displayName, photoUrl, bookTitle, author, currentPage, totalPages, status, updatedAt, isReadingNow).
- **Route ها** (`server/app.js`):
  - `GET /api/social-feed` — آخرین ۳۰ وضعیت مطالعه کاربران.
  - `POST /api/reading-status` — ثبت/به‌روزرسانی وضعیت مطالعه (نیازمند `Authorization: Bearer <Google ID Token>`، از طریق middleware `verifyGoogleToken`).
- احراز هویت با استعلام مستقیم از Google `tokeninfo` API انجام می‌شود (بدون SDK فایربیس در سمت سرور).
- **Entry points:** `server/server.js` (اجرای محلی با `npm run dev`، پورت ۵۰۰۰) و `server/api/index.js` (Serverless entry برای Vercel، مسیر روت `server` + `vercel.json` با rewrites).
- **متغیرهای محیطی:** `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- تنظیم آدرس سرور در افزونه: `scripts/social-db.js` → `USE_CUSTOM_SERVER`, `CUSTOM_SERVER_URL`, `FIREBASE_CONFIG.clientId`.

جزئیات کامل راه‌اندازی/دیپلوی: [server/README.md](server/README.md).

## نصب و اجرا (توسعه افزونه)

1. `chrome://extensions` → فعال‌سازی «حالت توسعه‌دهنده».
2. «Load unpacked» → انتخاب ریشه پروژه (`MioBook/`).
3. برای تست بک‌اند محلی، `server/README.md` را دنبال کنید.

## نکات فنی مهم

- تمام رابط کاربری راست‌به‌چپ (فارسی) و از فونت Vazirmatn استفاده می‌کند (`assets/fonts`).
- دیتابیس محلی سرور (`server/miobook.db`) باقیمانده نسخه قبلی SQLite است؛ نسخه فعلی پروداکشن از Turso استفاده می‌کند (نه فایل محلی).
- گراف کد پروژه با MCP ابزار `codebase-memory` ایندکس شده است (پروژه: `Users-ricksabchez-Desktop-MioBook`) — برای کاوش ساختاری کد (یافتن توابع، تحلیل وابستگی، ردیابی call chain) به‌جای grep دستی از آن استفاده کن.

---
*آخرین به‌روزرسانی: بر اساس وضعیت کد در تاریخ ۲۲ مرداد ۱۴۰۴ (2026-08-13).*
