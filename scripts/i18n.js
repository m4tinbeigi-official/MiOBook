/* MioBook i18n — dictionary + apply helper. Default language: Persian (fa). */
(function (root) {
  const DICT = {
    fa: {
      'nav.dashboard': 'داشبورد 🐾',
      'nav.library': 'کتابخانه من 🐾',
      'nav.explore': 'کاوش 🐾',
      'nav.wishlist': 'لیست علاقه‌مندی‌ها 🐾',
      'nav.tools': 'ابزارهای مطالعه 🐾',
      'nav.settings': 'تنظیمات 🐾',
      'nav.profile': 'پروفایل 🐾',
      'nav.now': 'اکنون 🐾',
      'nav.notes': 'یادداشت‌ها 🐾',
      'nav.quotes': 'نقل قول‌ها 🐾',
      'nav.stats': 'آمار و گزارش 🐾',
      'nav.friends': 'دوستان 🐾',

      'dash.title': 'داشبورد',
      'dash.searchPlaceholder': 'جستجوی کتاب یا نویسنده...',
      'dash.currentlyReading': 'در حال مطالعه',
      'dash.myLibrary': 'کتابخانه من',
      'dash.seeAll': 'مشاهده همه',
      'dash.filterAll': 'همه',
      'dash.filterReading': 'در حال مطالعه',
      'dash.filterRead': 'خوانده‌شده',
      'dash.filterToRead': 'می‌خواهم بخوانم',
      'dash.addBook': '+ افزودن کتاب',

      'options.title': 'زبان رابط کاربری',
      'options.save': 'ذخیره',
      'options.saved': 'ذخیره شد ✓',
    },
    en: {
      'nav.dashboard': 'Dashboard 🐾',
      'nav.library': 'My Library 🐾',
      'nav.explore': 'Explore 🐾',
      'nav.wishlist': 'Wishlist 🐾',
      'nav.tools': 'Reading Tools 🐾',
      'nav.settings': 'Settings 🐾',
      'nav.profile': 'Profile 🐾',
      'nav.now': 'Now 🐾',
      'nav.notes': 'Notes 🐾',
      'nav.quotes': 'Quotes 🐾',
      'nav.stats': 'Stats 🐾',
      'nav.friends': 'Friends 🐾',

      'dash.title': 'Dashboard',
      'dash.searchPlaceholder': 'Search book or author...',
      'dash.currentlyReading': 'Currently Reading',
      'dash.myLibrary': 'My Library',
      'dash.seeAll': 'See all',
      'dash.filterAll': 'All',
      'dash.filterReading': 'Reading',
      'dash.filterRead': 'Completed',
      'dash.filterToRead': 'To Read',
      'dash.addBook': '+ Add Book',

      'options.title': 'Interface Language',
      'options.save': 'Save',
      'options.saved': 'Saved ✓',
    },
  };

  const DEFAULT_LANG = 'fa';

  function getLanguage(callback) {
    try {
      chrome.storage.local.get('language', (result) => {
        callback((result && result.language) || DEFAULT_LANG);
      });
    } catch (e) {
      callback(DEFAULT_LANG);
    }
  }

  function t(key, lang) {
    const dict = DICT[lang] || DICT[DEFAULT_LANG];
    return dict[key] || DICT[DEFAULT_LANG][key] || key;
  }

  function applyTranslations(lang) {
    document.documentElement.lang = lang === 'en' ? 'en' : 'fa';
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'), lang);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'), lang));
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title'), lang));
    });
  }

  function init() {
    getLanguage((lang) => applyTranslations(lang));
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.language) {
          applyTranslations(changes.language.newValue || DEFAULT_LANG);
        }
      });
    } catch (e) {
      /* storage change listener unavailable outside extension context */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  root.MioI18n = { t, getLanguage, applyTranslations };
})(window);
