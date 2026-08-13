// MioBook Connector - همگام‌سازی کتابخانه فیدیبو
(function () {
    if (window.mioBookFidiboConnectorLoaded) return;
    window.mioBookFidiboConnectorLoaded = true;

    const PROVIDER = 'fidibo';

    function isLoggedIn() {
        return !!document.querySelector('a[href*="/logout"], a[href*="/my"], a[href*="/panel"], [class*="avatar" i], [class*="user-menu" i], [class*="usermenu" i]');
    }

    function extractImageUrl(img) {
        if (!img) return '';
        const candidates = [
            img.getAttribute('src'),
            img.getAttribute('data-src'),
            img.getAttribute('data-original'),
            img.getAttribute('data-lazy-src'),
            img.getAttribute('data-lazy'),
            img.currentSrc
        ];
        let srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
        if (srcset) {
            const first = srcset.split(',')[0].trim().split(' ')[0];
            if (first) candidates.push(first);
        }
        for (const c of candidates) {
            if (c && !c.startsWith('data:')) {
                try {
                    return new URL(c, window.location.href).href;
                } catch (e) {
                    return c;
                }
            }
        }
        return '';
    }

    function extractProgress(card) {
        const text = (card.textContent || '');
        const match = text.match(/(\d{1,3})\s*%/);
        if (match) {
            return Math.max(0, Math.min(100, parseInt(match[1], 10)));
        }
        return null;
    }

    function scrapeVisibleBooks() {
        const seen = new Set();
        const books = [];
        const links = document.querySelectorAll('a[href*="/book/"]');

        links.forEach(link => {
            const href = link.href;
            if (seen.has(href)) return;

            const card = link.closest('[class*="card" i], [class*="item" i], li, article') || link;
            let title = '';
            const titleEl = card.querySelector('[class*="title" i]') || link.querySelector('[class*="title" i]');
            if (titleEl) title = titleEl.textContent.trim();
            if (!title && link.title) title = link.title.trim();
            const img = card.querySelector('img');
            if (!title && img && img.alt) title = img.alt.trim();
            if (!title) return;

            seen.add(href);
            books.push({
                title,
                author: '',
                coverUrl: extractImageUrl(img),
                storeLink: href,
                storeSource: PROVIDER,
                progressPct: extractProgress(card)
            });
        });

        return books;
    }

    function injectSyncButton() {
        if (document.getElementById('miobook-sync-btn')) return;
        if (!isLoggedIn()) return;
        if (scrapeVisibleBooks().length === 0) return;

        const btn = document.createElement('button');
        btn.id = 'miobook-sync-btn';
        btn.textContent = '📚 افزودن کتابخانه به میوبوک';
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
        btn.addEventListener('click', () => {
            const books = scrapeVisibleBooks();
            btn.textContent = '⏳ در حال ارسال...';
            chrome.runtime.sendMessage({ action: 'connector-sync', provider: PROVIDER, books }, () => {
                btn.textContent = `✅ ${books.length} کتاب همگام شد`;
                setTimeout(() => { btn.textContent = '📚 افزودن کتابخانه به میوبوک'; }, 2500);
            });
        });
        document.body.appendChild(btn);
    }

    function reportStatus() {
        chrome.runtime.sendMessage({ action: 'connector-status', provider: PROVIDER, loggedIn: isLoggedIn() });
    }

    reportStatus();
    setTimeout(injectSyncButton, 1500);
    const observer = new MutationObserver(() => injectSyncButton());
    observer.observe(document.body, { childList: true, subtree: true });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'connector-check-status') {
            sendResponse({ loggedIn: isLoggedIn() });
        } else if (message.action === 'connector-request-sync') {
            const books = scrapeVisibleBooks();
            chrome.runtime.sendMessage({ action: 'connector-sync', provider: PROVIDER, books });
            sendResponse({ books });
        }
        return true;
    });
})();
