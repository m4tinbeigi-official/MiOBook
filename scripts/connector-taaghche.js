// MioBook Connector - همگام‌سازی کتابخانه طاقچه
// از دو API داخلی خود طاقچه استفاده می‌کند:
//  ۱) gw.taaghche.com/mybook/.../GetMyLibrary  -> لیست {book: id, status} کتاب‌های کاربر (نیاز به سشن لاگین)
//  ۲) get.taaghche.com/v2/book/list            -> عنوان/جلد/نویسنده/تعداد صفحه بر اساس id (عمومی، بدون نیاز به لاگین)
(function () {
    if (window.mioBookTaghcheConnectorLoaded) return;
    window.mioBookTaghcheConnectorLoaded = true;

    const PROVIDER = 'taaghche';
    const LIBRARY_API = 'https://gw.taaghche.com/mybook/PostSslService.svc/v2/GetMyLibrary';
    const BOOK_INFO_API = 'https://get.taaghche.com/v2/book/list';
    const AUTO_SYNC_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // هر ۶ ساعت یک‌بار خودکار

    function getSessionToken() {
        const directKeys = ['Taaghche_User', 'Taaghche_UserSession', 'TaaghcheUser'];
        for (const key of directKeys) {
            try {
                const v = localStorage.getItem(key);
                if (v) return v;
            } catch (e) { /* ignore */ }
        }
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && /taaghche/i.test(key) && /(user|session)/i.test(key)) {
                    const v = localStorage.getItem(key);
                    if (v) return v;
                }
            }
        } catch (e) { /* ignore */ }
        try {
            const cookies = document.cookie.split(';').map(c => c.trim());
            for (const c of cookies) {
                const eq = c.indexOf('=');
                if (eq === -1) continue;
                const k = c.slice(0, eq);
                const v = c.slice(eq + 1);
                if (!/taaghche/i.test(k)) continue;
                try {
                    const decoded = JSON.parse(atob(decodeURIComponent(v)));
                    if (decoded && decoded.Session) return decoded.Session;
                } catch (e) { /* not base64 json, skip */ }
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function isLoggedIn() {
        return !!getSessionToken();
    }

    function mapStatus(rawStatus) {
        const s = (rawStatus || '').toLowerCase();
        if (s.includes('read') && !s.includes('tobe') && !s.startsWith('to')) {
            if (s === 'reading') return 'reading';
            return 'read';
        }
        if (s.includes('reading')) return 'reading';
        return 'toRead';
    }

    async function fetchLibraryIds(session, type) {
        const res = await fetch(LIBRARY_API, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'Session': session },
            body: JSON.stringify({ start: 0, size: 500, type, bookmarked: false, borrowed: false, session })
        });
        if (!res.ok) return [];
        const data = await res.json();
        if (!data || !Array.isArray(data.books)) return [];
        return data.books.map(b => ({ id: b.book, status: mapStatus(b.status) }));
    }

    async function fetchBookInfo(ids) {
        if (ids.length === 0) return [];
        const chunks = [];
        for (let i = 0; i < ids.length; i += 60) chunks.push(ids.slice(i, i + 60));
        const results = await Promise.all(chunks.map(chunk =>
            fetch(BOOK_INFO_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunk)
            }).then(r => r.ok ? r.json() : [])
        ));
        return results.flat();
    }

    function formatAuthors(authors) {
        if (!Array.isArray(authors) || authors.length === 0) return '';
        return authors
            .map(a => `${a.firstName || ''} ${a.lastName || ''}`.trim())
            .filter(Boolean)
            .join('، ');
    }

    async function syncLibrary({ silent } = {}) {
        const session = getSessionToken();
        if (!session) {
            chrome.runtime.sendMessage({ action: 'connector-status', provider: PROVIDER, loggedIn: false });
            return { books: [], loggedIn: false };
        }

        let books = [];
        try {
            const [textIds, audioIds] = await Promise.all([
                fetchLibraryIds(session, 'text'),
                fetchLibraryIds(session, 'audio')
            ]);
            const statusById = new Map();
            [...textIds, ...audioIds].forEach(({ id, status }) => statusById.set(id, status));

            const infos = await fetchBookInfo([...statusById.keys()]);

            books = infos.map(info => {
                const status = statusById.get(info.id) || 'toRead';
                return {
                    title: info.title || '',
                    author: formatAuthors(info.authors),
                    totalPages: info.numberOfPages || 0,
                    status,
                    coverUrl: info.coverUri || `https://img.taaghche.com/frontCover/${info.id}.jpg`,
                    storeLink: `https://taaghche.com/book/${info.id}`,
                    storeSource: PROVIDER
                };
            }).filter(b => b.title);

            console.log('[MioBook] Taaghche library synced:', books);
        } catch (e) {
            console.error('[MioBook] Taaghche sync error:', e);
        }

        chrome.runtime.sendMessage({ action: 'connector-status', provider: PROVIDER, loggedIn: true });

        if (books.length > 0) {
            chrome.runtime.sendMessage({ action: 'connector-sync', provider: PROVIDER, books });
        } else if (!silent) {
            console.warn('[MioBook] هیچ کتابی از کتابخانه طاقچه پیدا نشد.');
        }

        return { books, loggedIn: true };
    }

    function injectSyncButton() {
        if (document.getElementById('miobook-sync-btn')) return;
        if (!isLoggedIn()) return;

        const btn = document.createElement('button');
        btn.id = 'miobook-sync-btn';
        btn.textContent = '📚 همگام‌سازی کتابخانه با میوبوک';
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 999999,
            padding: '10px 16px',
            borderRadius: '999px',
            border: 'none',
            background: '#2f6f4f',
            color: '#fff',
            fontFamily: 'Vazirmatn, sans-serif',
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)'
        });
        btn.addEventListener('click', async () => {
            btn.textContent = '⏳ در حال دریافت کتاب‌ها...';
            const { books } = await syncLibrary();
            btn.textContent = books.length ? `✅ ${books.length} کتاب همگام شد` : '⚠️ کتابی پیدا نشد (Console رو چک کن)';
            setTimeout(() => { btn.textContent = '📚 همگام‌سازی کتابخانه با میوبوک'; }, 3000);
        });
        document.body.appendChild(btn);
    }

    async function maybeAutoSync() {
        if (!isLoggedIn()) {
            chrome.runtime.sendMessage({ action: 'connector-status', provider: PROVIDER, loggedIn: false });
            return;
        }
        const { connectedAccounts = {} } = await chrome.storage.local.get(['connectedAccounts']);
        const lastSync = connectedAccounts[PROVIDER] && connectedAccounts[PROVIDER].lastSync;
        if (lastSync && Date.now() - lastSync < AUTO_SYNC_MIN_INTERVAL_MS) {
            chrome.runtime.sendMessage({ action: 'connector-status', provider: PROVIDER, loggedIn: true });
            return;
        }
        syncLibrary({ silent: true });
    }

    setTimeout(maybeAutoSync, 1200);
    setTimeout(injectSyncButton, 1500);
    const observer = new MutationObserver(() => injectSyncButton());
    observer.observe(document.body, { childList: true, subtree: true });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'connector-check-status') {
            sendResponse({ loggedIn: isLoggedIn() });
        } else if (message.action === 'connector-request-sync') {
            syncLibrary().then(result => sendResponse(result));
            return true;
        }
        return true;
    });
})();
