// MioBook New Tab — hero search (Google fallback), quick links, calendar, stats, quote
document.addEventListener('DOMContentLoaded', () => {

    // --- Google fallback search on Enter ---
    const heroInput = document.getElementById('book-search-input');
    if (heroInput) {
        heroInput.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const query = heroInput.value.trim();
            if (!query) return;
            window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
        });
    }

    // --- Quick Links ---
    const DEFAULT_LINKS = [
        { name: 'طاقچه', url: 'https://taaghche.com' },
        { name: 'فیدیبو', url: 'https://fidibo.com' },
        { name: 'Goodreads', url: 'https://www.goodreads.com' },
        { name: 'OpenLibrary', url: 'https://openlibrary.org' }
    ];
    const quickLinksRow = document.getElementById('quick-links-row');

    function renderQuickLinks(links) {
        if (!quickLinksRow) return;
        quickLinksRow.innerHTML = '';

        links.forEach((link, index) => {
            const chip = document.createElement('a');
            chip.className = 'quick-link-chip clickable';
            chip.href = link.url;
            chip.target = '_blank';
            chip.rel = 'noopener noreferrer';
            chip.innerHTML = `<span>${escapeHtmlLocal(link.name)}</span><span class="quick-link-remove" data-index="${index}">×</span>`;

            const removeBtn = chip.querySelector('.quick-link-remove');
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const updated = links.filter((_, i) => i !== index);
                chrome.storage.local.set({ quickLinks: updated }, () => renderQuickLinks(updated));
            });

            quickLinksRow.appendChild(chip);
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'quick-link-add clickable';
        addBtn.type = 'button';
        addBtn.title = 'افزودن سایت';
        addBtn.innerText = '+';
        addBtn.addEventListener('click', () => {
            const name = prompt('نام سایت را وارد کنید:');
            if (!name) return;
            let url = prompt('آدرس سایت را وارد کنید (مثال: https://example.com):');
            if (!url) return;
            if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
            const updated = links.concat([{ name, url }]);
            chrome.storage.local.set({ quickLinks: updated }, () => renderQuickLinks(updated));
        });
        quickLinksRow.appendChild(addBtn);
    }

    chrome.storage.local.get(['quickLinks'], (result) => {
        renderQuickLinks(result.quickLinks || DEFAULT_LINKS);
    });

    function escapeHtmlLocal(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    }


    // --- Reading Stats & Side Lists ---
    function loadStatsAndLists() {
        chrome.storage.local.get(['books', 'readingLogs'], (result) => {
            const books = result.books || [];
            const logs = result.readingLogs || [];

            const readCount = books.filter(b => b.status === 'read').length;
            const readingBooks = books.filter(b => b.status === 'reading');
            const toReadBooks = books.filter(b => b.status === 'toRead');

            setStat('stat-read', readCount);
            setStat('stat-reading', readingBooks.length);
            setStat('stat-toread', toReadBooks.length);

            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const weekMinutes = logs
                .filter(l => l.timestamp >= weekAgo)
                .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
            setStat('stat-week-minutes', weekMinutes);

            renderSideList('reading-side-list', 'reading-side-empty', readingBooks);
            renderSideList('toread-side-list', 'toread-side-empty', toReadBooks);
        });
    }

    function setStat(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerText = value.toLocaleString('fa-IR');
    }

    function renderSideList(listId, emptyId, books) {
        const list = document.getElementById(listId);
        const empty = document.getElementById(emptyId);
        if (!list) return;

        list.innerHTML = '';
        if (books.length === 0) {
            if (empty) empty.classList.remove('hidden');
            return;
        }
        if (empty) empty.classList.add('hidden');

        books.slice(0, 6).forEach(book => {
            const li = document.createElement('li');
            li.className = 'side-list-item';
            const coverBg = book.coverUrl ? `background-image:url(${book.coverUrl})` : 'background: var(--bg-card-hover)';
            li.innerHTML = `
                <div class="side-list-cover" style="${coverBg}"></div>
                <span class="side-list-title" title="${escapeHtmlLocal(book.title)}">${escapeHtmlLocal(book.title)}</span>
            `;
            li.addEventListener('click', () => {
                const card = document.querySelector(`#bookshelf-container .book-card[data-id="${book.id}"]`);
                if (card) card.click();
            });
            list.appendChild(li);
        });
    }

    loadStatsAndLists();
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.books || changes.readingLogs)) {
            loadStatsAndLists();
        }
    });


    // --- Quote Widget ---
    const QUOTES = [
        { text: "«کتاب، سفری در جیب شماست.»", author: "ضرب‌المثل" },
        { text: "«برای نابود کردن یک فرهنگ نیازی به سوزاندن کتاب‌ها نیست، کافی است کاری کنید مردم آن‌ها را نخوانند.»", author: "ری بردبری" },
        { text: "«اتاقی بدون کتاب، مانند بدنی بدون روح است.»", author: "سیسرو" },
        { text: "«کتاب دوستی است که هیچ‌وقت خیانت نمی‌کند.»", author: "ویکتور هوگو" },
        { text: "«کتاب‌ها آینه‌هایی هستند که شما فقط آنچه را که در درون خود دارید در آن‌ها می‌بینید.»", author: "کارلوس روئیز ثافون" },
        { text: "«من هیچ غم و اندوهی نداشته‌ام که یک ساعت مطالعه آن را برطرف نکرده باشد.»", author: "مونتسکیو" },
        { text: "«کتاب خواندن، گفتگویی بی صدا با ذهن‌های بزرگ تاریخ است.»", author: "دکارت" }
    ];

    chrome.storage.local.get(['books'], (result) => {
        const books = result.books || [];
        const candidates = books.filter(b => b.status === 'read' || b.status === 'toRead');

        const quoteTextEl = document.getElementById('hero-quote-text');
        const quoteAuthorEl = document.getElementById('hero-quote-author');
        if (!quoteTextEl || !quoteAuthorEl) return;

        if (candidates.length > 0) {
            const book = candidates[Math.floor(Math.random() * candidates.length)];
            const label = book.status === 'read' ? 'کتابی که خوانده‌ای' : 'کتابی که می‌خواهی بخوانی';
            quoteTextEl.innerText = `«${book.title}»`;
            quoteAuthorEl.innerText = `${label}${book.author ? ' — ' + book.author : ''}`;
        } else {
            const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
            quoteTextEl.innerText = q.text;
            quoteAuthorEl.innerText = q.author;
        }
    });


    // --- Calendar ---
    const calGrid = document.getElementById('calendar-grid');
    const calMonthLabel = document.getElementById('cal-month-label');
    const calPrevBtn = document.getElementById('cal-prev-btn');
    const calNextBtn = document.getElementById('cal-next-btn');

    const monthNames = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
    const dowLabels = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

    const today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth(); // 0-11

    let loggedDayKeys = new Set();

    function loadLoggedDays() {
        chrome.storage.local.get(['readingLogs'], (result) => {
            const logs = result.readingLogs || [];
            loggedDayKeys = new Set(logs.map(l => new Date(l.timestamp).toDateString()));
            renderCalendar();
        });
    }

    function renderCalendar() {
        if (!calGrid || !calMonthLabel) return;

        calMonthLabel.innerText = `${monthNames[viewMonth]} ${viewYear.toLocaleString('fa-IR', { useGrouping: false })}`;
        calGrid.innerHTML = '';

        dowLabels.forEach(d => {
            const el = document.createElement('div');
            el.className = 'calendar-dow';
            el.innerText = d;
            calGrid.appendChild(el);
        });

        const firstDay = new Date(viewYear, viewMonth, 1);
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const leadingBlanks = (firstDay.getDay() + 1) % 7; // week starts Saturday

        for (let i = 0; i < leadingBlanks; i++) {
            const blank = document.createElement('div');
            blank.className = 'calendar-day empty';
            calGrid.appendChild(blank);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(viewYear, viewMonth, day);
            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            if (loggedDayKeys.has(date.toDateString())) cell.classList.add('has-log');
            if (date.toDateString() === today.toDateString()) cell.classList.add('today');
            cell.innerText = day.toLocaleString('fa-IR');
            calGrid.appendChild(cell);
        }
    }

    if (calPrevBtn) {
        calPrevBtn.addEventListener('click', () => {
            viewMonth--;
            if (viewMonth < 0) { viewMonth = 11; viewYear--; }
            renderCalendar();
        });
    }
    if (calNextBtn) {
        calNextBtn.addEventListener('click', () => {
            viewMonth++;
            if (viewMonth > 11) { viewMonth = 0; viewYear++; }
            renderCalendar();
        });
    }

    loadLoggedDays();
});
