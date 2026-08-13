// MioBook Dashboard Script - Complete 3-Column New Tab Overrides
// Supports Clock, Reading Goals, Word Bank, Wooden Bookshelf Renderer, Quick Search, Charts, Themes, Backups, and Goodreads CSV Importer

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. Themes & Appearance ---
    const themes = ['light', 'sepia', 'moss', 'dark'];
    let currentTheme = 'light';

    // Initialize Theme
    try {
        const result = await chrome.storage.local.get(['theme']);
        if (result.theme) {
            currentTheme = result.theme;
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            currentTheme = prefersDark ? 'dark' : 'light';
        }
        applyTheme(currentTheme);
    } catch (err) {
        console.error("Failed to load theme:", err);
    }

    async function setTheme(theme) {
        currentTheme = theme;
        applyTheme(currentTheme);
        await chrome.storage.local.set({ theme: currentTheme });
    }

    // Header quick-toggle: cycles through the 4 themes
    const modeToggleBtnEarly = document.getElementById('mode-toggle-btn');
    if (modeToggleBtnEarly) {
        modeToggleBtnEarly.addEventListener('click', () => {
            const nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length;
            setTheme(themes[nextIndex]);
        });
    }

    // Settings page: pick an exact theme
    document.querySelectorAll('.settings-theme-btn').forEach(btn => {
        btn.addEventListener('click', () => setTheme(btn.dataset.themeChoice));
    });

    // Theme sync listener across windows
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.theme) {
            currentTheme = changes.theme.newValue;
            applyTheme(currentTheme);
        }
        if (area === 'local' && changes.connectedAccounts) {
            renderConnectorStatus(changes.connectedAccounts.newValue || {});
        }
    });

    // --- Fidibo / Taaghche Connector UI ---
    function renderConnectorStatus(connectedAccounts) {
        const providers = { taaghche: 'طاقچه', fidibo: 'فیدیبو' };
        Object.keys(providers).forEach(provider => {
            const badge = document.getElementById(`connector-status-${provider}`);
            if (!badge) return;
            const info = connectedAccounts[provider];
            if (!info) {
                badge.textContent = 'متصل نشده';
                return;
            }
            if (info.lastSync) {
                const date = new Date(info.lastSync).toLocaleDateString('fa-IR');
                badge.textContent = `همگام شد (${info.bookCount || 0} کتاب) - ${date}`;
                badge.style.background = 'rgba(47,111,79,0.25)';
            } else if (info.loggedIn) {
                badge.textContent = 'وارد شده - آماده همگام‌سازی';
            } else {
                badge.textContent = 'متصل نشده';
            }
        });
    }

    chrome.storage.local.get(['connectedAccounts'], result => {
        renderConnectorStatus(result.connectedAccounts || {});
    });

    document.querySelectorAll('.connector-open-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.dataset.url;
            if (url) chrome.tabs.create({ url });
        });
    });

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelectorAll('.settings-theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.themeChoice === theme);
        });
    }


    // --- 2. Clock & Greeting Widget ---
    const clockTime = document.getElementById('clock-time');
    const clockDate = document.getElementById('clock-date');
    const greetingText = document.getElementById('greeting-text');

    function updateClock() {
        const now = new Date();
        
        // Time HH:MM:SS
        if (clockTime) {
            clockTime.innerText = now.toLocaleTimeString('fa-IR', { hour12: false });
        }
        
        // Persian Date
        if (clockDate) {
            clockDate.innerText = now.toLocaleDateString('fa-IR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Greeting based on hour
        if (greetingText) {
            const hour = now.getHours();
            if (hour >= 5 && hour < 12) {
                greetingText.innerText = "صبح بخیر! برای خواندن چند صفحه کتاب آماده‌ای؟ ☕";
            } else if (hour >= 12 && hour < 17) {
                greetingText.innerText = "ظهر بخیر! وقت استراحت و کتاب خواندن است. 🌤️";
            } else if (hour >= 17 && hour < 22) {
                greetingText.innerText = "عصر بخیر! پایان یک روز شلوغ با یک کتاب خوب. 📚";
            } else {
                greetingText.innerText = "شب بخیر! بیایید قبل از خواب کمی مطالعه کنیم. 🌙";
            }
        }
    }
    updateClock();
    setInterval(updateClock, 1000);


    // --- 3. Reading Goals & Challenge ---
    const goalsSetupCard = document.getElementById('goals-setup-card');
    const goalsProgressArea = document.getElementById('goals-progress-area');
    const goalBookInput = document.getElementById('goal-book-count');
    const saveGoalBtn = document.getElementById('save-goal-btn');
    const editGoalBtn = document.getElementById('edit-goal-btn');

    const ringFill = document.getElementById('goal-ring-fill');
    const goalReadCount = document.getElementById('goal-read-count');
    const goalTargetLabel = document.getElementById('goal-target-label');
    const gRead = document.getElementById('g-read');
    const gRemaining = document.getElementById('g-remaining');
    const gPct = document.getElementById('g-pct');

    if (saveGoalBtn) {
        saveGoalBtn.addEventListener('click', () => {
            const val = parseInt(goalBookInput.value);
            if (isNaN(val) || val < 1) {
                alert('لطفاً یک عدد معتبر بزرگتر از صفر وارد کنید.');
                return;
            }
            chrome.storage.local.set({ readingGoal: val }, loadGoals);
        });
    }

    if (editGoalBtn) {
        editGoalBtn.addEventListener('click', () => {
            if (confirm('آیا مایل به تغییر هدف مطالعه خود هستید؟')) {
                chrome.storage.local.remove('readingGoal', loadGoals);
            }
        });
    }

    function loadGoals() {
        chrome.storage.local.get(['readingGoal', 'books'], result => {
            const goal = result.readingGoal;
            const books = result.books || [];

            if (!goal) {
                if (goalsSetupCard) goalsSetupCard.classList.remove('hidden');
                if (goalsProgressArea) goalsProgressArea.classList.add('hidden');
            } else {
                if (goalsSetupCard) goalsSetupCard.classList.add('hidden');
                if (goalsProgressArea) goalsProgressArea.classList.remove('hidden');
                updateGoalsUI(goal, books);
            }
        });
    }

    function updateGoalsUI(targetGoal, books) {
        const currentYear = new Date().getFullYear();
        const readBooksCount = books.filter(b => {
            if (b.status !== 'read') return false;
            const date = b.completedAt ? new Date(b.completedAt) : new Date(b.addedAt);
            return date.getFullYear() === currentYear;
        }).length;

        // Circular progress calculation (r=48, C=2*pi*r ≈ 301.6)
        const circumference = 301.6;
        const pct = targetGoal > 0 ? Math.min(readBooksCount / targetGoal, 1) : 0;
        const offset = circumference - (pct * circumference);
        
        if (ringFill) {
            ringFill.style.strokeDashoffset = offset;
        }

        if (goalReadCount)   goalReadCount.innerText = readBooksCount.toLocaleString('fa-IR');
        if (goalTargetLabel) goalTargetLabel.innerText = targetGoal.toLocaleString('fa-IR');
        if (gRead)           gRead.innerText = readBooksCount.toLocaleString('fa-IR');

        const remaining = Math.max(0, targetGoal - readBooksCount);
        if (gRemaining)      gRemaining.innerText = remaining.toLocaleString('fa-IR');

        const percentage = Math.round(pct * 100);
        if (gPct)            gPct.innerText = percentage.toLocaleString('fa-IR') + '٪';
    }


    // --- 4. Word Bank Widget ---
    const wbSearchInput = document.getElementById('wb-search-input');
    const wbMiniList = document.getElementById('wb-mini-list');
    const wbEmpty = document.getElementById('wb-empty');
    const dashExportBtn = document.getElementById('dash-export-words-btn');
    let cachedWords = [];

    if (wbSearchInput) {
        wbSearchInput.addEventListener('input', () => {
            renderWordBankList(wbSearchInput.value.trim());
        });
    }

    if (dashExportBtn) {
        dashExportBtn.addEventListener('click', () => {
            if (cachedWords.length === 0) return;
            const csv = 'کلمه,معنی,تاریخ ثبت\n' + cachedWords.map(w =>
                `"${w.term}","${w.meaning || ''}","${new Date(w.addedAt).toLocaleDateString('fa-IR')}"`
            ).join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `miobook-wordbank-${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    function loadWordBank() {
        chrome.storage.local.get(['wordBank'], result => {
            cachedWords = result.wordBank || [];
            renderWordBankList('');
        });
    }

    function renderWordBankList(query) {
        if (!wbMiniList) return;

        const filtered = cachedWords.filter(w => {
            const q = query.toLowerCase();
            return w.term.toLowerCase().includes(q) || (w.meaning && w.meaning.toLowerCase().includes(q));
        });

        if (cachedWords.length === 0) {
            wbEmpty.classList.remove('hidden');
            wbMiniList.innerHTML = '';
            if (dashExportBtn) dashExportBtn.classList.add('hidden');
            return;
        }

        wbEmpty.classList.add('hidden');
        if (dashExportBtn) dashExportBtn.classList.remove('hidden');

        wbMiniList.innerHTML = '';
        if (filtered.length === 0) {
            wbMiniList.innerHTML = '<div style="text-align:center; padding:10px; color:var(--text-muted); font-size:11px;">کلمه‌ای یافت نشد.</div>';
            return;
        }

        // Show recent words first
        filtered.slice().reverse().forEach(w => {
            const item = document.createElement('div');
            item.className = 'wb-mini-item';
            
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="wb-mini-word">${escapeHtml(w.term)}</span>
                    <button class="widget-btn delete-word-btn" data-id="${w.id}" style="color:#e63946;">🗑️</button>
                </div>
                ${w.meaning ? `<span class="wb-mini-def">${escapeHtml(w.meaning)}</span>` : ''}
            `;
            
            item.querySelector('.delete-word-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteWord(w.id);
            });
            wbMiniList.appendChild(item);
        });
    }

    function deleteWord(id) {
        if (!confirm('آیا مایل به حذف این واژه هستید؟')) return;
        chrome.storage.local.get(['wordBank'], result => {
            const updated = (result.wordBank || []).filter(w => w.id !== id);
            chrome.storage.local.set({ wordBank: updated }, loadWordBank);
        });
    }


    // --- 5. Quotes Widget ---
    const quotes = [
        { text: "«کتاب، سفری در جیب شماست.»", author: "ضرب‌المثل" },
        { text: "«برای نابود کردن یک فرهنگ نیازی به سوزاندن کتاب‌ها نیست، کافی است کاری کنید مردم آن‌ها را نخوانند.»", author: "ری بردبری" },
        { text: "«اتاقی بدون کتاب، مانند بدنی بدون روح است.»", author: "سیسرو" },
        { text: "«کتاب دوستی است که هیچ‌وقت خیانت نمی‌کند.»", author: "ویکتور هوگو" },
        { text: "«کتاب‌ها آینه‌هایی هستند که شما فقط آنچه را که در درون خود دارید در آن‌ها می‌بینید.»", author: "کارلوس روئیز ثافون" },
        { text: "«من هیچ غم و اندوهی نداشته‌ام که یک ساعت مطالعه آن را برطرف نکرده باشد.»", author: "مونتسکیو" },
        { text: "«کتاب خواندن، گفتگویی بی صدا با ذهن‌های بزرگ تاریخ است.»", author: "دکارت" }
    ];

    function showRandomQuote() {
        const quoteText = document.getElementById('quote-text');
        const quoteAuthor = document.getElementById('quote-author');
        if (quoteText && quoteAuthor) {
            const randomIdx = Math.floor(Math.random() * quotes.length);
            quoteText.innerText = quotes[randomIdx].text;
            quoteAuthor.innerText = quotes[randomIdx].author;
        }
    }
    showRandomQuote();


    // --- 6. Virtual Bookshelf Renderer ---
    const bookshelfContainer = document.getElementById('bookshelf-container');
    const shelfEmpty = document.getElementById('shelf-empty');
    const filterButtons = document.querySelectorAll('.filter-btn');
    let activeFilter = 'all';

    // Filters Click
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.getAttribute('data-filter');
            loadBookshelf();
        });
    });

    // Profile widget stats (books read / reading / total) driven by real local library data.
    function updateProfileWidgetStats(books) {
        const readingEl = document.getElementById('pw-stat-reading');
        const readEl = document.getElementById('pw-stat-read');
        const totalEl = document.getElementById('pw-stat-total');
        if (readingEl) readingEl.innerText = books.filter(b => b.status === 'reading').length.toLocaleString('fa-IR');
        if (readEl) readEl.innerText = books.filter(b => b.status === 'read').length.toLocaleString('fa-IR');
        if (totalEl) totalEl.innerText = books.length.toLocaleString('fa-IR');
    }

    // Hero "الان داری چی می‌خونی؟" card — the single most prominent book,
    // driven by real library data instead of the static mock it shipped with.
    function renderHeroReadingCard(books) {
        const heroCard = document.getElementById('hero-reading-card');
        if (!heroCard) return;

        chrome.storage.local.get(['pomodoroSelectedBookId'], (result) => {
            const readingBooks = books.filter(b => b.status === 'reading');
            let book = readingBooks.find(b => b.id === result.pomodoroSelectedBookId);
            if (!book) {
                book = readingBooks.slice().sort((a, b) => b.addedAt - a.addedAt)[0];
            }

            const heroInfoEl = heroCard.querySelector('.hero-info');
            const heroCoverEl = document.getElementById('hero-book-cover');
            let heroEmptyEl = document.getElementById('hero-empty-state');

            if (!book) {
                if (heroInfoEl) heroInfoEl.classList.add('hidden');
                if (heroCoverEl) heroCoverEl.classList.add('hidden');
                if (!heroEmptyEl) {
                    heroEmptyEl = document.createElement('div');
                    heroEmptyEl.id = 'hero-empty-state';
                    heroEmptyEl.className = 'hero-empty-state';
                    heroEmptyEl.innerHTML = `
                        <span class="hero-empty-icon">🐾📖</span>
                        <strong>هنوز کتابی رو شروع نکرده‌ای</strong>
                        <span>یک کتاب از کتابخانه‌ات رو به «در حال مطالعه» ببر تا اینجا ببینیش.</span>
                    `;
                    heroCard.appendChild(heroEmptyEl);
                }
                heroEmptyEl.classList.remove('hidden');
                return;
            }

            if (heroEmptyEl) heroEmptyEl.classList.add('hidden');
            if (heroInfoEl) heroInfoEl.classList.remove('hidden');
            if (heroCoverEl) heroCoverEl.classList.remove('hidden');

            const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
            const progressPct = Math.min(Math.max(progress, 0), 100);
            const remainingPages = Math.max((book.totalPages || 0) - (book.currentPage || 0), 0);

            const titleEl = document.getElementById('hero-book-title');
            const authorEl = document.getElementById('hero-book-author');
            const fillEl = document.getElementById('hero-progress-fill');
            const pctEl = document.getElementById('hero-progress-pct');
            const pagesEl = document.getElementById('hero-progress-pages');

            if (titleEl) titleEl.innerText = book.title;
            if (authorEl) authorEl.innerText = book.author || 'نویسنده نامشخص';
            if (fillEl) fillEl.style.width = `${progressPct}%`;
            if (pctEl) pctEl.innerText = `${progressPct.toLocaleString('fa-IR')}٪`;
            if (pagesEl) pagesEl.innerText = `صفحه ${(book.currentPage || 0).toLocaleString('fa-IR')} از ${(book.totalPages || 0).toLocaleString('fa-IR')}`;

            if (heroCoverEl) {
                const spineStyle = getSpineColor(book.title);
                heroCoverEl.style.backgroundImage = book.coverUrl ? `url(${book.coverUrl})` : spineStyle.bg;
            }

            const chipAddedEl = document.getElementById('hero-chip-added');
            const chipRemainingEl = document.getElementById('hero-chip-remaining');
            if (chipAddedEl) chipAddedEl.innerText = getRelativeTime(book.addedAt);
            if (chipRemainingEl) chipRemainingEl.innerText = `${remainingPages.toLocaleString('fa-IR')} صفحه`;
        });
    }

    function loadBookshelf() {
        chrome.storage.local.get(['books'], (result) => {
            const books = result.books || [];
            updateProfileWidgetStats(books);
            renderHeroReadingCard(books);

            // Filter books for library section
            let libraryBooks = books;
            if (activeFilter !== 'all') {
                libraryBooks = books.filter(b => b.status === activeFilter);
            }

            // Sort by manual order if set, otherwise by added date descending
            const hasCustomOrder = libraryBooks.some(b => typeof b.sortOrder === 'number');
            if (hasCustomOrder) {
                libraryBooks.sort((a, b) => {
                    const oa = typeof a.sortOrder === 'number' ? a.sortOrder : Infinity;
                    const ob = typeof b.sortOrder === 'number' ? b.sortOrder : Infinity;
                    if (oa !== ob) return oa - ob;
                    return b.addedAt - a.addedAt;
                });
            } else {
                libraryBooks.sort((a, b) => b.addedAt - a.addedAt);
            }

            // Separate Currently Reading books
            const readingBooks = books.filter(b => b.status === 'reading');
            const currentlyReadingSection = document.getElementById('currently-reading-section');
            const currentlyReadingContainer = document.getElementById('currently-reading-container');
            
            if (currentlyReadingContainer && currentlyReadingSection) {
                if (readingBooks.length > 0) {
                    currentlyReadingSection.classList.remove('hidden');
                    renderCurrentlyReading(readingBooks, currentlyReadingContainer);
                } else {
                    currentlyReadingSection.classList.add('hidden');
                    currentlyReadingContainer.innerHTML = '';
                }
            }

            // Render Library Section
            if (libraryBooks.length === 0) {
                if (shelfEmpty) shelfEmpty.classList.remove('hidden');
                if (bookshelfContainer) bookshelfContainer.classList.add('hidden');
            } else {
                if (shelfEmpty) shelfEmpty.classList.add('hidden');
                if (bookshelfContainer) bookshelfContainer.classList.remove('hidden');
                renderLibraryGrid(libraryBooks);
            }
        });
    }

    function renderCurrentlyReading(books, container) {
        container.innerHTML = '';
        books.forEach(book => {
            const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
            const progressPercentage = Math.min(progress, 100);
            
            const card = document.createElement('div');
            card.className = 'reading-card';
            card.dataset.id = book.id;
            
            const spineStyle = getSpineColor(book.title);
            const coverBg = book.coverUrl ? `url(${book.coverUrl})` : spineStyle.bg;
            
            card.innerHTML = `
                <div class="rc-cover" style="background: ${coverBg};"></div>
                <div class="rc-info">
                    <h3 class="rc-title">${escapeHtml(book.title)}</h3>
                    <p class="rc-author">${escapeHtml(book.author || 'نویسنده نامشخص')}</p>
                    <div class="rc-progress-bar">
                        <div class="rc-progress-fill" style="width: ${progressPercentage}%;"></div>
                    </div>
                    <div class="rc-progress-text">
                        <span>فصل ${book.currentPage}/${book.totalPages}</span>
                        <span>${progressPercentage}٪</span>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', () => {
                openBookDetailsModal(book);
            });
            container.appendChild(card);
        });
    }

    const LIBRARY_COMPACT_THRESHOLD = 18;
    let draggedBookId = null;

    function renderLibraryGrid(booksList) {
        if (!bookshelfContainer) return;
        bookshelfContainer.innerHTML = '';

        bookshelfContainer.classList.toggle('compact', booksList.length > LIBRARY_COMPACT_THRESHOLD);

        booksList.forEach(book => {
            const card = document.createElement('div');
            card.className = 'book-card clickable';
            card.dataset.id = book.id;
            card.draggable = true;

            const spineStyle = getSpineColor(book.title);
            const coverBg = book.coverUrl ? `url(${book.coverUrl})` : spineStyle.bg;
            const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
            const progressPct = Math.min(Math.max(progress, 0), 100);
            const statusLabels = { reading: 'در حال مطالعه', read: 'خوانده‌شده', toRead: 'می‌خواهم بخوانم' };
            const statusLabel = statusLabels[book.status] || '';

            card.innerHTML = `
                <div class="bc-cover" style="background: ${coverBg};" title="${escapeHtml(statusLabel)}">
                    <span class="bc-status-dot ${book.status}"></span>
                    <div class="bc-cover-progress"><div class="bc-cover-progress-fill" style="width: ${progressPct}%;"></div></div>
                </div>
                <h3 class="bc-title">${escapeHtml(book.title)}</h3>
                <div class="bc-meta">
                    <span class="bc-pct">${progressPct}٪</span>
                    <span>${escapeHtml(statusLabel)}</span>
                </div>
            `;

            card.addEventListener('click', () => {
                if (bookshelfContainer.classList.contains('reordering')) return;
                openBookDetailsModal(book);
            });

            card.addEventListener('dragstart', (e) => {
                draggedBookId = book.id;
                card.classList.add('dragging');
                bookshelfContainer.classList.add('reordering');
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                bookshelfContainer.classList.remove('reordering');
                bookshelfContainer.querySelectorAll('.book-card.drag-over').forEach(el => el.classList.remove('drag-over'));
                draggedBookId = null;
            });
            card.addEventListener('dragover', (e) => {
                if (!draggedBookId || draggedBookId === book.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                card.classList.add('drag-over');
            });
            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                if (!draggedBookId || draggedBookId === book.id) return;
                reorderBooks(draggedBookId, book.id);
            });

            bookshelfContainer.appendChild(card);
        });
    }

    function reorderBooks(draggedId, targetId) {
        chrome.storage.local.get(['books'], (result) => {
            const books = result.books || [];
            const ordered = books.slice().sort((a, b) => {
                const oa = typeof a.sortOrder === 'number' ? a.sortOrder : Infinity;
                const ob = typeof b.sortOrder === 'number' ? b.sortOrder : Infinity;
                if (oa !== ob) return oa - ob;
                return b.addedAt - a.addedAt;
            });

            const fromIndex = ordered.findIndex(b => b.id === draggedId);
            const toIndex = ordered.findIndex(b => b.id === targetId);
            if (fromIndex === -1 || toIndex === -1) return;

            const [moved] = ordered.splice(fromIndex, 1);
            ordered.splice(toIndex, 0, moved);

            ordered.forEach((b, i) => { b.sortOrder = i; });

            chrome.storage.local.set({ books: ordered }, () => {
                loadBookshelf();
            });
        });
    }

    // Hash based color palette for book spines
    function getSpineColor(title) {
        const spineColors = [
            { bg: 'linear-gradient(135deg, #7c3f35, #a35648)', text: '#ffffff' }, // terracotta
            { bg: 'linear-gradient(135deg, #1b4d3e, #28735d)', text: '#ffffff' }, // emerald
            { bg: 'linear-gradient(135deg, #22425d, #315e84)', text: '#ffffff' }, // deep navy
            { bg: 'linear-gradient(135deg, #593563, #7d4d8a)', text: '#ffffff' }, // violet
            { bg: 'linear-gradient(135deg, #7a683e, #aa925b)', text: '#ffffff' }, // gold
            { bg: 'linear-gradient(135deg, #444444, #666666)', text: '#ffffff' }, // slate
            { bg: 'linear-gradient(135deg, #2a5235, #3d794e)', text: '#ffffff' }, // moss
            { bg: 'linear-gradient(135deg, #801d44, #af285e)', text: '#ffffff' }  // plum
        ];
        let hash = 0;
        for (let i = 0; i < title.length; i++) {
            hash = title.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % spineColors.length;
        return spineColors[index];
    }


    // --- 7. Book Details & Update Modal ---
    const bookDetailsModal = document.getElementById('book-details-modal');
    const closeDetailsModalBtn = document.getElementById('close-details-modal-btn');
    const detailsBookTitle = document.getElementById('details-book-title');
    const detailsBookAuthor = document.getElementById('details-book-author');
    const detailsBookStatus = document.getElementById('details-book-status');
    const detailsBookCover = document.getElementById('details-book-cover');
    const detailsProgressPct = document.getElementById('details-progress-pct');
    const detailsProgressFill = document.getElementById('details-progress-fill');
    const detailsProgressPages = document.getElementById('details-progress-pages');
    const updateCurrentPageInput = document.getElementById('update-current-page');
    const saveProgressBtn = document.getElementById('save-progress-btn');
    const detailsDeleteBookBtn = document.getElementById('details-delete-book-btn');

    let activeBook = null;

    function openBookDetailsModal(book) {
        if (!bookDetailsModal) return;
        activeBook = book;

        const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
        const progressPercentage = Math.min(progress, 100);

        if (detailsBookTitle) detailsBookTitle.innerText = book.title;
        if (detailsBookAuthor) detailsBookAuthor.innerText = book.author || 'نویسنده نامشخص';
        
        const statusNames = {
            toRead: 'می‌خواهم بخوانم',
            reading: 'در حال مطالعه',
            read: 'خوانده شده'
        };
        if (detailsBookStatus) {
            detailsBookStatus.innerText = statusNames[book.status] || book.status;
            detailsBookStatus.className = `bd-status-badge ${book.status}`;
        }

        if (detailsBookCover) {
            if (book.coverUrl) {
                detailsBookCover.innerHTML = `<img src="${book.coverUrl}" alt="${escapeHtml(book.title)}">`;
            } else {
                detailsBookCover.innerHTML = `<div class="bd-cover-placeholder-card" style="background:${getSpineColor(book.title).bg}">📖</div>`;
            }
        }

        if (detailsProgressPct) detailsProgressPct.innerText = `${progressPercentage.toLocaleString('fa-IR')}٪`;
        if (detailsProgressFill) detailsProgressFill.style.width = `${progressPercentage}%`;
        if (detailsProgressPages) detailsProgressPages.innerText = `صفحه ${book.currentPage.toLocaleString('fa-IR')} از ${book.totalPages.toLocaleString('fa-IR')}`;

        if (updateCurrentPageInput) {
            updateCurrentPageInput.value = book.currentPage;
            updateCurrentPageInput.max = book.totalPages;
        }

        // Update social reading live broadcast controls
        chrome.storage.local.get(['auth', 'activeReadingBook'], (result) => {
            const socialControls = document.getElementById('social-reading-controls');
            const toggleBtn = document.getElementById('toggle-active-reading-btn');
            
            if (socialControls && toggleBtn) {
                if (result.auth && book.status === 'reading') {
                    socialControls.classList.remove('hidden');
                    
                    const isActive = result.activeReadingBook && result.activeReadingBook.id === book.id;
                    if (isActive) {
                        toggleBtn.innerText = "⏸️ توقف اعلام مطالعه فعال";
                        toggleBtn.style.background = "#e63946";
                    } else {
                        toggleBtn.innerText = "📢 اعلام شروع مطالعه";
                        toggleBtn.style.background = "var(--accent-color)";
                    }
                } else {
                    socialControls.classList.add('hidden');
                }
            }
        });

        // Bookstore comparison check
        loadBookstoreComparison(book);

        loadBookSummary(book);

        bookDetailsModal.classList.remove('hidden');
    }

    // Show the author/publisher/synopsis for a book, always fetched (and
    // cached) via the server so it doesn't rely on any local storage.
    function loadBookSummary(book) {
        const section = document.getElementById('details-book-summary-section');
        const textEl = document.getElementById('details-book-summary-text');
        const publisherEl = document.getElementById('details-book-publisher');
        const loadingEl = document.getElementById('details-book-summary-loading');

        if (!section || !textEl) return;

        section.classList.add('hidden');
        if (publisherEl) publisherEl.classList.add('hidden');

        const render = (info) => {
            if (activeBook !== book) return; // user moved to another book while this was loading
            if (loadingEl) loadingEl.classList.add('hidden');

            if (info && info.summary) {
                textEl.innerText = info.summary;
                section.classList.remove('hidden');
            }
            if (info && info.publisher && publisherEl) {
                publisherEl.innerText = `ناشر: ${info.publisher}`;
                publisherEl.classList.remove('hidden');
            }
        };

        if (book.summary || book.publisher) {
            if (loadingEl) loadingEl.classList.add('hidden');
            render({ summary: book.summary, publisher: book.publisher });
            return;
        }

        if (loadingEl) loadingEl.classList.remove('hidden');

        if (typeof getBookInfo !== 'function') {
            if (loadingEl) loadingEl.classList.add('hidden');
            return;
        }

        getBookInfo(book.title, book.author).then(info => {
            if (!info) return;
            // Cache on the local book record so we don't re-fetch every time.
            chrome.storage.local.get(['books'], (result) => {
                const list = result.books || [];
                const target = list.find(b => b.id === book.id);
                if (target) {
                    target.summary = info.summary || '';
                    target.publisher = info.publisher || '';
                    chrome.storage.local.set({ books: list });
                }
            });
            render(info);
        }).catch(() => {
            if (loadingEl) loadingEl.classList.add('hidden');
        });
    }

    if (closeDetailsModalBtn) {
        closeDetailsModalBtn.addEventListener('click', () => {
            bookDetailsModal.classList.add('hidden');
            activeBook = null;
        });
    }

    if (bookDetailsModal) {
        bookDetailsModal.addEventListener('click', (e) => {
            if (e.target === bookDetailsModal) {
                bookDetailsModal.classList.add('hidden');
                activeBook = null;
            }
        });
    }

    if (saveProgressBtn) {
        saveProgressBtn.addEventListener('click', () => {
            if (!activeBook) return;

            const newPage = parseInt(updateCurrentPageInput.value);
            if (isNaN(newPage) || newPage < 0 || newPage > activeBook.totalPages) {
                alert(`لطفاً عدد معتبری بین 0 و ${activeBook.totalPages} وارد کنید.`);
                return;
            }

            const wasToRead = activeBook.status === 'toRead';

            chrome.storage.local.get(['books'], (result) => {
                const list = result.books || [];
                const idx = list.findIndex(b => b.id === activeBook.id);
                if (idx !== -1) {
                    list[idx].currentPage = newPage;

                    if (newPage === activeBook.totalPages && activeBook.totalPages > 0) {
                        list[idx].status = 'read';
                        list[idx].completedAt = Date.now();
                    } else if (newPage > 0 && list[idx].status === 'toRead') {
                        list[idx].status = 'reading';
                    } else if (newPage === 0 && list[idx].status === 'read') {
                        list[idx].status = 'toRead';
                        delete list[idx].completedAt;
                    }

                     chrome.storage.local.set({ books: list }, () => {
                        // Sync with Server/Firestore if user is authenticated
                        chrome.storage.local.get(['auth', 'activeReadingBook', 'privacyDefaultShare'], (res) => {
                            if (res.auth) {
                                let isActive = res.activeReadingBook && res.activeReadingBook.id === activeBook.id;
                                const updatedStatus = newPage === activeBook.totalPages ? 'read' : 'reading';

                                // Just started this book: honor the "share by default" setting
                                // from the Settings tab instead of requiring a manual broadcast click.
                                const justStartedReading = wasToRead && updatedStatus === 'reading';
                                if (justStartedReading && !isActive && res.privacyDefaultShare !== false) {
                                    isActive = true;
                                    chrome.storage.local.set({ activeReadingBook: {
                                        id: activeBook.id, title: activeBook.title, author: activeBook.author,
                                        currentPage: newPage, totalPages: activeBook.totalPages
                                    } });
                                } else if (isActive) {
                                    res.activeReadingBook.currentPage = newPage;
                                    chrome.storage.local.set({ activeReadingBook: res.activeReadingBook });
                                }

                                publishReadingStatus(activeBook.title, activeBook.author, newPage, activeBook.totalPages, updatedStatus, isActive);
                            }
                        });

                        bookDetailsModal.classList.add('hidden');
                        loadBookshelf();
                        loadGoals();
                        renderCharts();
                        syncBookToServer(list[idx]);
                        activeBook = null;
                    });
                }
            });
        });
    }

    const toggleActiveReadingBtn = document.getElementById('toggle-active-reading-btn');
    if (toggleActiveReadingBtn) {
        toggleActiveReadingBtn.addEventListener('click', () => {
            if (!activeBook) return;
            
            chrome.storage.local.get(['activeReadingBook', 'auth'], (result) => {
                if (!result.auth) return;
                
                const isActive = result.activeReadingBook && result.activeReadingBook.id === activeBook.id;
                const toggleBtn = document.getElementById('toggle-active-reading-btn');
                
                if (isActive) {
                    // Stop active reading
                    chrome.storage.local.remove('activeReadingBook', () => {
                        if (toggleBtn) {
                            toggleBtn.innerText = "📢 اعلام شروع مطالعه";
                            toggleBtn.style.background = "var(--accent-color)";
                        }
                        publishReadingStatus(activeBook.title, activeBook.author, activeBook.currentPage, activeBook.totalPages, activeBook.status, false);
                    });
                } else {
                    // Start active reading
                    const activeInfo = {
                        id: activeBook.id,
                        title: activeBook.title,
                        author: activeBook.author,
                        currentPage: activeBook.currentPage,
                        totalPages: activeBook.totalPages
                    };
                    chrome.storage.local.set({ activeReadingBook: activeInfo }, () => {
                        if (toggleBtn) {
                            toggleBtn.innerText = "⏸️ توقف اعلام مطالعه فعال";
                            toggleBtn.style.background = "#e63946";
                        }
                        publishReadingStatus(activeBook.title, activeBook.author, activeBook.currentPage, activeBook.totalPages, activeBook.status, true);
                    });
                }
            });
        });
    }

    if (detailsDeleteBookBtn) {
        detailsDeleteBookBtn.addEventListener('click', () => {
            if (!activeBook) return;
            if (!confirm('آیا مایل به حذف این کتاب از کتابخانه خود هستید؟')) return;

            chrome.storage.local.get(['books'], (result) => {
                const list = result.books || [];
                const removed = list.find(b => b.id === activeBook.id);
                const updated = list.filter(b => b.id !== activeBook.id);
                chrome.storage.local.set({ books: updated }, () => {
                    bookDetailsModal.classList.add('hidden');
                    loadBookshelf();
                    loadGoals();
                    renderCharts();
                    if (removed && removed.serverId && typeof deleteServerLibraryBook === 'function') {
                        deleteServerLibraryBook(removed.serverId);
                    }
                    activeBook = null;
                });
            });
        });
    }


    // --- 8. Manual Add Modal Controls ---
    const addBookBtn = document.getElementById('add-book-btn');
    const addBookModal = document.getElementById('add-book-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const manualForm = document.getElementById('manual-book-form');

    if (addBookBtn && addBookModal && closeModalBtn) {
        addBookBtn.addEventListener('click', () => {
            addBookModal.classList.remove('hidden');
        });

        closeModalBtn.addEventListener('click', () => {
            addBookModal.classList.add('hidden');
            resetModalForm();
        });

        addBookModal.addEventListener('click', (e) => {
            if (e.target === addBookModal) {
                addBookModal.classList.add('hidden');
                resetModalForm();
            }
        });
    }

    function resetModalForm() {
        if (manualForm) manualForm.reset();
        delete manualForm.dataset.coverUrl;
        delete manualForm.dataset.storeLink;
        delete manualForm.dataset.storeSource;
        const results = document.getElementById('search-results-list');
        if (results) {
            results.innerHTML = '';
            results.classList.add('hidden');
        }
        const searchInput = document.getElementById('book-search-input');
        if (searchInput) searchInput.value = '';
        const titleSuggestions = document.getElementById('manual-title-suggestions');
        if (titleSuggestions) {
            titleSuggestions.innerHTML = '';
            titleSuggestions.classList.add('hidden');
        }
    }

    if (manualForm) {
        manualForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const title = document.getElementById('book-title').value.trim();
            const author = document.getElementById('book-author').value.trim();
            const totalPages = parseInt(document.getElementById('book-pages').value) || 0;
            const status = document.getElementById('book-status').value;
            const coverUrlInput = document.getElementById('book-cover-url');
            const coverUrl = (coverUrlInput && coverUrlInput.value.trim()) || manualForm.dataset.coverUrl || '';

            const newBook = {
                id: 'book-' + Date.now(),
                title,
                author,
                totalPages,
                currentPage: status === 'read' ? totalPages : 0,
                status,
                coverUrl,
                addedAt: Date.now(),
                storeLink: manualForm.dataset.storeLink || '',
                storeSource: manualForm.dataset.storeSource || ''
            };

            chrome.storage.local.get(['books'], (result) => {
                const list = result.books || [];
                list.push(newBook);
                chrome.storage.local.set({ books: list }, () => {
                    addBookModal.classList.add('hidden');
                    resetModalForm();
                    loadBookshelf();
                    loadGoals();
                    renderCharts();
                    syncBookToServer(newBook);
                });
            });
        });
    }

    // Mirror a locally-added/updated book to the always-on server library so
    // it's never only on-device. Fire-and-forget: local storage stays the
    // fast operational copy, the server call just keeps it backed up.
    function syncBookToServer(book) {
        if (typeof isConfigured !== 'function' || !isConfigured()) return;

        if (book.serverId) {
            updateServerLibraryBook(book.serverId, {
                currentPage: book.currentPage,
                totalPages: book.totalPages,
                status: book.status
            });
            return;
        }

        addServerLibraryBook({
            title: book.title,
            author: book.author,
            coverUrl: book.coverUrl,
            totalPages: book.totalPages,
            currentPage: book.currentPage,
            status: book.status
        }).then(saved => {
            if (!saved || !saved.id) return;
            chrome.storage.local.get(['books'], (result) => {
                const list = result.books || [];
                const target = list.find(b => b.id === book.id);
                if (target) {
                    target.serverId = saved.id;
                    target.publisher = saved.publisher || target.publisher || '';
                    target.summary = saved.summary || target.summary || '';
                    chrome.storage.local.set({ books: list });
                }
            });
        }).catch(err => console.error('Library server sync error:', err));
    }

    // Right after a fresh login, push every book that only exists locally
    // (added while signed out, or before this feature existed) up to the
    // server so the server library is always the complete, current copy.
    function syncAllLocalBooksToServer() {
        if (typeof isConfigured !== 'function' || !isConfigured()) return;
        chrome.storage.local.get(['books'], (result) => {
            const list = result.books || [];
            list.filter(b => !b.serverId).forEach(b => syncBookToServer(b));
        });
    }


    // --- 9. Unified Bookstore & OpenLibrary Search ---
    const searchInput = document.getElementById('book-search-input');
    const searchBtn = document.getElementById('book-search-btn');
    const searchResultsList = document.getElementById('search-results-list');

    let searchDebounceTimer = null;

    // --- Command palette: Ctrl+K / Cmd+K focuses search; an empty, focused
    // search box shows quick actions instead of book results. ---
    const COMMAND_PALETTE_ACTIONS = [
        { icon: '➕', label: 'افزودن کتاب', run: () => document.getElementById('add-book-btn')?.click() },
        { icon: '🍅', label: 'شروع پومودورو', run: () => document.getElementById('pomodoro-toggle-btn')?.click() },
        { icon: '📚', label: 'رفتن به کتابخانه', run: () => document.querySelector('.nav-item[data-tab="library"]')?.click() },
        { icon: '📝', label: 'یادداشت جدید', run: () => {
            document.querySelector('.nav-item[data-tab="dashboard"]')?.click();
            const noteInput = document.getElementById('quick-note-input');
            if (noteInput) { noteInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); noteInput.focus(); }
        } }
    ];

    function renderCommandPaletteActions() {
        if (!searchResultsList) return;
        searchResultsList.innerHTML = COMMAND_PALETTE_ACTIONS.map((action, i) => `
            <div class="search-result-item command-action-item" data-action-index="${i}">
                <span style="font-size: 18px;">${action.icon}</span>
                <div class="search-result-info"><span class="search-result-title">${escapeHtml(action.label)}</span></div>
            </div>
        `).join('');
        searchResultsList.classList.remove('hidden');
        searchResultsList.querySelectorAll('.command-action-item').forEach(el => {
            el.addEventListener('click', () => {
                const action = COMMAND_PALETTE_ACTIONS[parseInt(el.dataset.actionIndex, 10)];
                searchResultsList.classList.add('hidden');
                if (searchInput) searchInput.value = '';
                if (action) action.run();
            });
        });
    }

    if (searchInput) {
        window.addEventListener('keydown', (e) => {
            const isCmdK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
            if (isCmdK) {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
                if (!searchInput.value.trim()) renderCommandPaletteActions();
            } else if (e.key === 'Escape' && document.activeElement === searchInput) {
                searchInput.blur();
                if (searchResultsList) searchResultsList.classList.add('hidden');
            }
        });

        searchInput.addEventListener('focus', () => {
            if (!searchInput.value.trim()) renderCommandPaletteActions();
        });

        // Trigger search on Enter keypress
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchDebounceTimer);
                if (searchBtn) {
                    searchBtn.click();
                } else {
                    performBookSearch();
                }
            }
        });

        // Live (AJAX-style) search while the user types
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            const query = searchInput.value.trim();

            if (!query) {
                renderCommandPaletteActions();
                return;
            }

            if (query.length < 2) return;

            searchDebounceTimer = setTimeout(() => {
                performBookSearch();
            }, 400);
        });
    }

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            performBookSearch();
        });
    }

    let searchRequestId = 0;

    async function fetchCombinedSearchResults(query) {
        // Run parallel search on Taaghche, Fidibo, and OpenLibrary
        const [taaghcheResults, fidiboResults, openLibraryResults] = await Promise.all([
            searchTaaghcheAPI(query),
            searchFidiboAPI(query),
            searchOpenLibraryAPI(query)
        ]);

        const combinedResults = [];

        // Add source metadata to results
        taaghcheResults.forEach(item => {
            combinedResults.push({
                id: item.id,
                title: item.title,
                author: item.category || 'کتاب الکترونیکی طاقچه',
                coverUrl: `https://img.taaghche.com/${item.type === 'audioBook' ? 'audioCover' : 'frontCover'}/${item.id}.jpg`,
                source: 'taaghche',
                sourceLabel: 'طاقچه',
                link: `https://taaghche.com/book/${item.id}`,
                pages: 200 // default
            });
        });

        fidiboResults.forEach(item => {
            const authorLabel = item.content_type === 'audiobook' ? 'کتاب صوتی فیدیبو' : 'کتاب الکترونیکی فیدیبو';
            combinedResults.push({
                id: item.id,
                title: item.title,
                author: authorLabel,
                coverUrl: item.image,
                source: 'fidibo',
                sourceLabel: 'فیدیبو',
                link: `https://fidibo.com/book/${item.id}`,
                pages: 200 // default
            });
        });

        openLibraryResults.forEach(item => {
            combinedResults.push({
                id: item.id,
                title: item.title,
                author: item.author,
                coverUrl: item.coverUrl,
                source: 'openlibrary',
                sourceLabel: 'OpenLibrary',
                link: item.link,
                pages: item.pages
            });
        });

        return combinedResults;
    }

    async function performBookSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        const requestId = ++searchRequestId;

        if (searchBtn) {
            searchBtn.innerText = 'جستجو...';
            searchBtn.disabled = true;
        }

        if (searchResultsList) {
            searchResultsList.innerHTML = '<div style="padding: 12px; text-align: center; font-size:11px; color: var(--text-secondary);">در حال جستجو...</div>';
            searchResultsList.classList.remove('hidden');
        }

        try {
            const combinedResults = await fetchCombinedSearchResults(query);

            if (requestId !== searchRequestId) return; // a newer search superseded this one

            if (searchBtn) {
                searchBtn.innerText = 'جستجو';
                searchBtn.disabled = false;
            }

            if (combinedResults.length > 0) {
                renderSearchResults(combinedResults, searchResultsList, (item) => {
                    document.getElementById('book-title').value = item.title;
                    document.getElementById('book-author').value = item.source === 'openlibrary' ? item.author : '';
                    document.getElementById('book-pages').value = item.pages;

                    const coverUrlInput = document.getElementById('book-cover-url');
                    if (coverUrlInput) coverUrlInput.value = item.coverUrl || '';

                    if (manualForm) {
                        manualForm.dataset.coverUrl = item.coverUrl;
                        manualForm.dataset.storeLink = item.link;
                        manualForm.dataset.storeSource = item.source;
                    }

                    searchResultsList.classList.add('hidden');
                    searchResultsList.innerHTML = '';

                    // Open manual modal for user confirmation/completion
                    if (addBookModal) addBookModal.classList.remove('hidden');
                });
            } else {
                searchResultsList.innerHTML = '<div style="padding: 12px; text-align: center; font-size:11px; color: var(--text-secondary);">کتابی یافت نشد. اطلاعات را دستی وارد کنید.</div>';
                searchResultsList.classList.remove('hidden');
            }
        } catch (err) {
            if (requestId !== searchRequestId) return; // a newer search superseded this one
            console.error("Unified search failed:", err);
            if (searchBtn) {
                searchBtn.innerText = 'جستجو';
                searchBtn.disabled = false;
            }
            searchResultsList.innerHTML = '<div style="padding: 12px; text-align: center; color: #e63946; font-size:11px;">خطا در برقراری ارتباط با پلتفرم‌ها.</div>';
            searchResultsList.classList.remove('hidden');
        }
    }

    // --- Live suggestions while typing the book title inside the manual-add modal ---
    const manualTitleInput = document.getElementById('book-title');
    const manualTitleSuggestions = document.getElementById('manual-title-suggestions');
    let manualTitleDebounceTimer = null;
    let manualTitleRequestId = 0;

    if (manualTitleInput && manualTitleSuggestions) {
        manualTitleInput.addEventListener('input', () => {
            clearTimeout(manualTitleDebounceTimer);
            const query = manualTitleInput.value.trim();

            // Typing a fresh title invalidates any previously selected suggestion's cover/link
            delete manualForm.dataset.coverUrl;
            delete manualForm.dataset.storeLink;
            delete manualForm.dataset.storeSource;

            if (!query || query.length < 2) {
                manualTitleSuggestions.innerHTML = '';
                manualTitleSuggestions.classList.add('hidden');
                return;
            }

            manualTitleDebounceTimer = setTimeout(async () => {
                const requestId = ++manualTitleRequestId;
                manualTitleSuggestions.innerHTML = '<div style="padding: 12px; text-align: center; font-size:11px; color: var(--text-secondary);">در حال جستجو...</div>';
                manualTitleSuggestions.classList.remove('hidden');

                try {
                    const results = await fetchCombinedSearchResults(query);
                    if (requestId !== manualTitleRequestId) return;

                    if (results.length > 0) {
                        renderSearchResults(results, manualTitleSuggestions, (item) => {
                            manualTitleInput.value = item.title;
                            document.getElementById('book-author').value = item.source === 'openlibrary' ? item.author : '';
                            document.getElementById('book-pages').value = item.pages;

                            const coverUrlInput = document.getElementById('book-cover-url');
                            if (coverUrlInput) coverUrlInput.value = item.coverUrl || '';

                            manualForm.dataset.coverUrl = item.coverUrl;
                            manualForm.dataset.storeLink = item.link;
                            manualForm.dataset.storeSource = item.source;

                            manualTitleSuggestions.classList.add('hidden');
                            manualTitleSuggestions.innerHTML = '';
                        });
                    } else {
                        manualTitleSuggestions.innerHTML = '';
                        manualTitleSuggestions.classList.add('hidden');
                    }
                } catch (err) {
                    if (requestId !== manualTitleRequestId) return;
                    console.error("Manual title suggestion search failed:", err);
                    manualTitleSuggestions.innerHTML = '';
                    manualTitleSuggestions.classList.add('hidden');
                }
            }, 400);
        });

        // Close suggestions dropdown on click outside
        document.addEventListener('click', (e) => {
            if (!manualTitleSuggestions.classList.contains('hidden')) {
                if (!manualTitleInput.contains(e.target) && !manualTitleSuggestions.contains(e.target)) {
                    manualTitleSuggestions.classList.add('hidden');
                }
            }
        });
    }

    async function searchOpenLibraryAPI(query) {
        try {
            const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=3`);
            const data = await response.json();
            if (data.docs) {
                return data.docs.map(doc => ({
                    id: doc.key,
                    title: doc.title,
                    author: doc.author_name ? doc.author_name[0] : 'نامشخص',
                    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
                    link: `https://openlibrary.org${doc.key}`,
                    pages: doc.number_of_pages_median || 200
                }));
            }
        } catch (e) {
            console.error("OpenLibrary API error:", e);
        }
        return [];
    }

    function renderSearchResults(results, listEl, onSelect) {
        if (!listEl) return;
        listEl.innerHTML = '';
        listEl.classList.remove('hidden');

        results.forEach(item => {
            const row = document.createElement('div');
            row.className = 'search-result-item';

            row.innerHTML = `
                ${item.coverUrl ? `<img class="search-result-cover" src="${item.coverUrl}" alt="${escapeHtml(item.title)}">` : `<div class="search-result-cover" style="display:flex;align-items:center;justify-content:center;font-size:16px;">📖</div>`}
                <div class="search-result-info">
                    <span class="search-result-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
                    <span class="search-result-author">${escapeHtml(item.author)}</span>
                    <div class="search-result-meta">
                        <span class="search-badge ${item.source}">${item.sourceLabel}</span>
                    </div>
                </div>
                <button class="btn-secondary clickable select-search-btn">انتخاب</button>
            `;

            const selectBtn = row.querySelector('.select-search-btn');
            const handleSelect = (e) => {
                e.stopPropagation();
                onSelect(item);
            };

            row.addEventListener('click', handleSelect);
            selectBtn.addEventListener('click', handleSelect);

            listEl.appendChild(row);
        });
    }

    // Close search results dropdown on click outside
    document.addEventListener('click', (e) => {
        if (searchResultsList && !searchResultsList.classList.contains('hidden')) {
            if (!searchInput.contains(e.target) && !searchResultsList.contains(e.target) && (!searchBtn || !searchBtn.contains(e.target))) {
                searchResultsList.classList.add('hidden');
            }
        }
    });

    // --- Bookstore Comparison & Availability Checking Functions ---
    async function loadBookstoreComparison(book) {
        const detailsBookstoreList = document.getElementById('details-bookstore-list');
        if (!detailsBookstoreList) return;

        detailsBookstoreList.innerHTML = '<div style="font-size: 11px; text-align: center; color: var(--text-muted);">در حال بررسی موجودی کتاب در طاقچه و فیدیبو...</div>';

        try {
            const title = book.title;
            // Clean title for search
            const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').replace(/[\u200c]/g, ' ').trim();

            // Run search on both stores in parallel
            const [taaghcheResults, fidiboResults] = await Promise.all([
                searchTaaghcheAPI(cleanTitle),
                searchFidiboAPI(cleanTitle)
            ]);

            detailsBookstoreList.innerHTML = '';
            let matchesFound = 0;

            // Render Taaghche results
            if (taaghcheResults && taaghcheResults.length > 0) {
                // Filter matches
                const matches = taaghcheResults.filter(item => checkTitleMatch(cleanTitle, item.title));
                for (const item of matches.slice(0, 2)) {
                    matchesFound++;
                    const priceText = await fetchTaaghchePriceInfo(item.id, item.subscription);
                    const formatLabel = item.type === 'audioBook' ? 'کتاب صوتی' : 'کتاب الکترونیکی';
                    createBookstoreRow(detailsBookstoreList, 'طاقچه', formatLabel, priceText, `https://taaghche.com/book/${item.id}`, 'taaghche');
                }
            }

            // Render Fidibo results
            if (fidiboResults && fidiboResults.length > 0) {
                // Filter matches
                const matches = fidiboResults.filter(item => checkTitleMatch(cleanTitle, item.title));
                for (const item of matches.slice(0, 2)) {
                    matchesFound++;
                    const priceText = await fetchFidiboPriceInfo(item.id);
                    const formatLabel = item.content_type === 'audiobook' ? 'کتاب صوتی' : 'کتاب الکترونیکی';
                    createBookstoreRow(detailsBookstoreList, 'فیدیبو', formatLabel, priceText, `https://fidibo.com/book/${item.id}`, 'fidibo');
                }
            }

            if (matchesFound === 0) {
                detailsBookstoreList.innerHTML = '<div style="font-size: 11px; text-align: center; color: var(--text-muted);">کتابی در طاقچه و فیدیبو یافت نشد.</div>';
            }
        } catch (error) {
            console.error("Error in bookstore comparison:", error);
            detailsBookstoreList.innerHTML = '<div style="font-size: 11px; text-align: center; color: #e63946;">خطا در دریافت اطلاعات فروشگاه‌ها.</div>';
        }
    }

    function checkTitleMatch(original, target) {
        if (!original || !target) return false;
        const clean = str => str.toLowerCase().replace(/[\u200c\s\-\_\:\,\(\)]/g, '');
        const cleanOrig = clean(original);
        const cleanTarg = clean(target);
        return cleanOrig.includes(cleanTarg) || cleanTarg.includes(cleanOrig);
    }

    async function searchTaaghcheAPI(query) {
        try {
            const response = await fetch(`https://explore.taaghche.com/v3/hint?term=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.suggestions) {
                return data.suggestions
                    .filter(s => s.data && s.data.id)
                    .map(s => ({
                        id: s.data.id,
                        title: s.data.content || s.value,
                        category: s.data.category,
                        type: s.data.type,
                        subscription: s.data.subscription
                    }));
            }
        } catch (e) {
            console.error("Taaghche API search error:", e);
        }
        return [];
    }

    async function searchFidiboAPI(query) {
        try {
            const response = await fetch(`https://api.fidibo.com/flex/search/suggestion?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.data && data.data.result) {
                const suggestionResult = data.data.result.find(r => r.component === 'SEARCH_SUGGESTION');
                if (suggestionResult && suggestionResult.items) {
                    return suggestionResult.items.map(item => ({
                        id: item.id,
                        title: item.title.replace(/<\/?[^>]+(>|$)/g, ""),
                        content_type: item.content_type,
                        image: item.image,
                        web_url: item.action?.web_url
                    }));
                }
            }
        } catch (e) {
            console.error("Fidibo API search error:", e);
        }
        return [];
    }

    async function fetchTaaghchePriceInfo(bookId, hasSubscription) {
        let priceLabel = 'موجود برای خرید';
        if (hasSubscription) {
            priceLabel = 'مطالعه در طاقچه بی‌نهایت ♾️';
        }
        try {
            const response = await fetch(`https://taaghche.com/book/${bookId}`);
            const html = await response.text();
            const priceMatch = html.match(/"price"\s*:\s*(\d+)/);
            if (priceMatch && priceMatch[1]) {
                const priceRials = parseInt(priceMatch[1]);
                if (priceRials === 0) {
                    return 'رایگان 🆓';
                }
                const priceTomans = Math.round(priceRials / 10);
                return `${priceTomans.toLocaleString('fa-IR')} تومان` + (hasSubscription ? ' (یا بی‌نهایت ♾️)' : '');
            }
        } catch (e) {
            console.error("Error fetching Taaghche price details:", e);
        }
        return priceLabel;
    }

    async function fetchFidiboPriceInfo(bookId) {
        try {
            const response = await fetch(`https://api.fidibo.com/flex/book/item/${bookId}`);
            const data = await response.json();
            if (data.data && data.data.result && data.data.result[0]) {
                const bookInfo = data.data.result[0];
                if (bookInfo.price !== undefined) {
                    const priceRials = parseInt(bookInfo.price);
                    if (priceRials === 0) return 'رایگان 🆓';
                    const priceTomans = Math.round(priceRials / 10);
                    return `${priceTomans.toLocaleString('fa-IR')} تومان`;
                }
            }
        } catch (e) {
            console.error("Error fetching Fidibo price details:", e);
        }
        return 'موجود برای خرید';
    }

    function createBookstoreRow(container, storeName, format, priceText, url, className) {
        const item = document.createElement('div');
        item.className = 'bookstore-item';
        item.innerHTML = `
            <div class="bookstore-item-info">
                <div class="search-badge ${className}">${storeName}</div>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span class="bookstore-name">${format}</span>
                    <span class="bookstore-price">${priceText}</span>
                </div>
            </div>
            <a href="${url}" target="_blank" class="bookstore-link-btn ${className}">
                <span>مشاهده 🔗</span>
            </a>
        `;
        container.appendChild(item);
    }


    // --- 10. Statistics SVG Charts Generator ---
    const statTabBtns = document.querySelectorAll('.stat-tab-btn');
    const weeklyChartArea = document.getElementById('weekly-chart-area');
    const distChartArea = document.getElementById('dist-chart-area');

    statTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            statTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const selectedChart = btn.getAttribute('data-chart');
            if (selectedChart === 'weekly') {
                if (weeklyChartArea) weeklyChartArea.classList.remove('hidden');
                if (distChartArea) distChartArea.classList.add('hidden');
            } else {
                if (weeklyChartArea) weeklyChartArea.classList.add('hidden');
                if (distChartArea) distChartArea.classList.remove('hidden');
            }
        });
    });

    function renderCharts() {
        chrome.storage.local.get(['readingLogs', 'books'], (result) => {
            const logs = result.readingLogs || [];
            const books = result.books || [];

            renderWeeklyDurationChart(logs);
            renderBookshelfDonutChart(books);
        });
    }

    function renderWeeklyDurationChart(logs) {
        const container = document.getElementById('weekly-chart');
        if (!container) return;

        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push({
                dateString: date.toLocaleDateString('fa-IR', { weekday: 'short' }),
                dayKey: date.toDateString(),
                minutes: 0
            });
        }

        logs.forEach(log => {
            const logDay = new Date(log.timestamp).toDateString();
            const matchingDay = last7Days.find(d => d.dayKey === logDay);
            if (matchingDay) {
                matchingDay.minutes += log.durationMinutes;
            }
        });

        const maxMinutes = Math.max(...last7Days.map(d => d.minutes), 30);
        const width = 280;
        const height = 140;
        const padding = 20;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;
        const barWidth = chartWidth / last7Days.length - 8;

        let barsSvg = '';
        last7Days.forEach((day, index) => {
            const barHeight = (day.minutes / maxMinutes) * chartHeight;
            const x = padding + index * (chartWidth / last7Days.length) + 4;
            const y = height - padding - barHeight;

            barsSvg += `
                <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" fill="var(--accent-color)" opacity="0.85">
                    <title>${day.minutes} دقیقه مطالعه</title>
                </rect>
                <text x="${x + barWidth / 2}" y="${height - 5}" text-anchor="middle" font-size="8" fill="var(--text-secondary)" font-family="var(--font-family)">
                    ${day.dateString}
                </text>
                <text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" font-size="8" font-weight="bold" fill="var(--accent-color)" font-family="var(--font-family)">
                    ${day.minutes > 0 ? day.minutes.toLocaleString('fa-IR') : '۰'}
                </text>
            `;
        });

        const svgCode = `
            <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">
                <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="var(--border-color)" stroke-dasharray="3 3" />
                <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="var(--border-color)" />
                ${barsSvg}
            </svg>
        `;
        container.innerHTML = svgCode;
    }

    function renderBookshelfDonutChart(books) {
        const container = document.getElementById('monthly-chart');
        if (!container) return;

        const toRead = books.filter(b => b.status === 'toRead').length;
        const reading = books.filter(b => b.status === 'reading').length;
        const read = books.filter(b => b.status === 'read').length;
        const total = books.length;

        if (total === 0) {
            container.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); text-align:center;">کتابی یافت نشد.</div>';
            return;
        }

        const toReadPct = Math.round((toRead / total) * 100);
        const readingPct = Math.round((reading / total) * 100);
        const readPct = Math.round((read / total) * 100);

        container.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-around; width:100%; height:100%; padding: 4px;">
                <div style="display:flex; flex-direction:column; gap:6px; font-size:10px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#2e6f40;"></span>
                        <span>خوانده‌شده (${read.toLocaleString('fa-IR')})</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:var(--accent-color);"></span>
                        <span>در حال مطالعه (${reading.toLocaleString('fa-IR')})</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:var(--text-muted);"></span>
                        <span>می‌خواهم بخوانم (${toRead.toLocaleString('fa-IR')})</span>
                    </div>
                </div>

                <svg width="90" height="90" viewBox="0 0 42 42" class="donut">
                    <circle class="donut-ring" cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--bg-tertiary)" stroke-width="4"></circle>
                    <circle class="donut-segment" cx="21" cy="21" r="15.915" fill="transparent" stroke="#2e6f40" stroke-width="4" 
                            stroke-dasharray="${readPct} ${100 - readPct}" stroke-dashoffset="25"></circle>
                    <circle class="donut-segment" cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--accent-color)" stroke-width="4" 
                            stroke-dasharray="${readingPct} ${100 - readingPct}" stroke-dashoffset="${25 - readPct}"></circle>
                    <circle class="donut-segment" cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--text-muted)" stroke-width="4" 
                            stroke-dasharray="${toReadPct} ${100 - toReadPct}" stroke-dashoffset="${25 - readPct - readingPct}"></circle>
                    <g class="chart-text">
                        <text x="50%" y="50%" class="chart-number" text-anchor="middle" font-size="6" font-weight="bold" fill="var(--text-primary)" dy="2" font-family="var(--font-family)">
                            ${total.toLocaleString('fa-IR')}
                        </text>
                    </g>
                </svg>
            </div>
        `;
    }


    // --- 11. Backup, Restore, and Clear data ---
    const backupAllBtn = document.getElementById('backup-all-btn');
    const restoreFileInput = document.getElementById('restore-file-input');
    const clearAllDataBtn = document.getElementById('clear-all-data-btn');

    if (backupAllBtn) {
        backupAllBtn.addEventListener('click', () => {
            chrome.storage.local.get(null, allData => {
                const dataStr = JSON.stringify(allData, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `miobook-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                alert('پشتیبان‌گیری انجام شد و دانلود فایل پشتیبان میو بوک آغاز گردید.');
            });
        });
    }

    if (restoreFileInput) {
        restoreFileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = evt => {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    const validKeys = ['books', 'readingLogs', 'wordBank', 'highlights', 'theme', 'readingGoal'];
                    const hasValidKey = Object.keys(parsed).some(k => validKeys.includes(k));
                    
                    if (!hasValidKey) {
                        alert('خطا: ساختار فایل پشتیبان معتبر نیست.');
                        return;
                    }

                    chrome.storage.local.clear(() => {
                        chrome.storage.local.set(parsed, () => {
                            alert('داده‌ها با موفقیت بازیابی شدند.');
                            window.location.reload();
                        });
                    });
                } catch(err) {
                    console.error(err);
                    alert('خطا در خواندن فایل پشتیبان. قالب فایل معتبر نیست.');
                }
            };
            reader.readAsText(file);
        });
    }

    if (clearAllDataBtn) {
        clearAllDataBtn.addEventListener('click', () => {
            const firstCheck = confirm('⚠️ هشدار: آیا مایل به حذف تمام اطلاعات افزونه میو بوک هستید؟ این مورد شامل کتاب‌ها، پیشرفت و یادداشت‌ها می‌شود و غیرقابل بازگشت است.');
            if (firstCheck) {
                const secondCheck = confirm('⚠️ تایید نهایی: کل داده‌ها برای همیشه حذف خواهند شد.');
                if (secondCheck) {
                    chrome.storage.local.clear(() => {
                        alert('تمامی داده‌ها پاک‌سازی شدند.');
                        window.location.reload();
                    });
                }
            }
        });
    }


    // --- 12. Goodreads CSV Importer ---
    const csvFileInput = document.getElementById('goodreads-csv-file');
    const importStatus = document.getElementById('import-status');

    if (csvFileInput) {
        csvFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (importStatus) {
                importStatus.innerText = 'درحال پردازش فایل...';
                importStatus.style.color = 'var(--text-secondary)';
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const csvText = evt.target.result;
                    const parsedBooks = parseGoodreadsCSV(csvText);
                    
                    if (parsedBooks.length === 0) {
                        if (importStatus) {
                            importStatus.innerText = 'کتاب معتبری یافت نشد یا قالب فایل درست نیست.';
                            importStatus.style.color = '#e63946';
                        }
                        return;
                    }

                    chrome.storage.local.get(['books'], (result) => {
                        const existingList = result.books || [];
                        let addedCount = 0;
                        const newlyAdded = [];

                        parsedBooks.forEach(newB => {
                            const duplicate = existingList.find(b =>
                                b.title.toLowerCase() === newB.title.toLowerCase() &&
                                b.author.toLowerCase() === newB.author.toLowerCase()
                            );
                            if (!duplicate) {
                                existingList.push(newB);
                                newlyAdded.push(newB);
                                addedCount++;
                            }
                        });

                        chrome.storage.local.set({ books: existingList }, () => {
                            if (importStatus) {
                                importStatus.innerText = `${addedCount.toLocaleString('fa-IR')} کتاب جدید افزوده شد!`;
                                importStatus.style.color = '#2e6f40';
                            }
                            loadBookshelf();
                            loadGoals();
                            renderCharts();
                            newlyAdded.forEach(b => syncBookToServer(b));
                        });
                    });
                } catch (err) {
                    console.error(err);
                    if (importStatus) {
                        importStatus.innerText = 'خطا در درون‌ریزی فایل.';
                        importStatus.style.color = '#e63946';
                    }
                }
            };
            reader.readAsText(file, 'UTF-8');
        });
    }

    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.replace(/^"|"$/g, '').trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.replace(/^"|"$/g, '').trim());
        return result;
    }

    function parseGoodreadsCSV(csvText) {
        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return [];

        const headers = parseCSVLine(lines[0]);
        const titleIdx = headers.findIndex(h => h.toLowerCase() === 'title');
        const authorIdx = headers.findIndex(h => h.toLowerCase() === 'author');
        const pagesIdx = headers.findIndex(h => h.toLowerCase() === 'number of pages');
        const shelfIdx = headers.findIndex(h => h.toLowerCase() === 'exclusive shelf');

        if (titleIdx === -1 || authorIdx === -1) return [];

        const booksList = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = parseCSVLine(line);
            if (cols.length < Math.max(titleIdx, authorIdx)) continue;

            const title = cols[titleIdx];
            const author = cols[authorIdx] || 'نویسنده نامشخص';
            const totalPages = parseInt(cols[pagesIdx]) || 0;
            const rawShelf = cols[shelfIdx] ? cols[shelfIdx].toLowerCase() : 'to-read';

            if (!title) continue;

            let status = 'toRead';
            if (rawShelf === 'currently-reading') {
                status = 'reading';
            } else if (rawShelf === 'read') {
                status = 'read';
            }

            booksList.push({
                id: 'book-gr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                title,
                author,
                totalPages,
                currentPage: status === 'read' ? totalPages : 0,
                status,
                coverUrl: '',
                addedAt: Date.now()
            });
        }
        return booksList;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }


    // --- 14. Suggestion / Ideas Logic ---
    const sendSuggestionBtn = document.getElementById('send-suggestion-btn');
    const suggestionText = document.getElementById('suggestion-text');
    const suggestionStatus = document.getElementById('suggestion-status');

    if (sendSuggestionBtn && suggestionText && suggestionStatus) {
        sendSuggestionBtn.addEventListener('click', () => {
            const text = suggestionText.value.trim();
            if (!text) {
                showSuggestionStatus('لطفاً ابتدا ایده یا پیشنهاد خود را بنویسید.', 'error');
                return;
            }

            const emailRecipient = 'm4tinbeigi@gmail.com';
            const subject = encodeURIComponent('ایده و پیشنهاد برای میو بوک');
            const body = encodeURIComponent(text);
            const mailtoUrl = `mailto:${emailRecipient}?subject=${subject}&body=${body}`;

            // Attempt to open the default email program
            window.open(mailtoUrl, '_blank');

            // Show success confirmation and clear text
            showSuggestionStatus('نرم‌افزار ایمیل شما باز شد. لطفاً ایمیل را ارسال کنید! 🌸', 'success');
            suggestionText.value = '';

            // Hide success message after 5 seconds
            setTimeout(() => {
                suggestionStatus.classList.add('hidden');
            }, 5000);
        });
    }

    function showSuggestionStatus(message, type) {
        suggestionStatus.innerText = message;
        suggestionStatus.className = 'suggestion-status-text';
        suggestionStatus.classList.remove('hidden');
        if (type === 'success') {
            suggestionStatus.classList.add('success');
        } else {
            suggestionStatus.classList.add('error');
        }
    }

    // --- 15. Tab Switching Logic ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabViews = document.querySelectorAll('.tab-view-container');
    const pageTitleHeader = document.querySelector('.page-title h1');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            if (!targetTab) return;

            // Set active class
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Switch views
            const isDashboardOrLibrary = targetTab === 'dashboard' || targetTab === 'library';
            
            tabViews.forEach(view => {
                const viewId = `${targetTab}-view`;
                if (view.id === viewId || (isDashboardOrLibrary && view.id === 'dashboard-view')) {
                    view.classList.remove('hidden');
                } else {
                    view.classList.add('hidden');
                }
            });

            // Update Header Title
            if (pageTitleHeader) {
                const lang = document.documentElement.lang === 'en' ? 'en' : 'fa';
                const titles = lang === 'en' ? {
                    dashboard: 'Dashboard',
                    library: 'My Library',
                    explore: 'Explore Community',
                    wishlist: 'Wishlist',
                    tools: 'Reading Tools',
                    profile: 'User Profile',
                    settings: 'Settings'
                } : {
                    dashboard: 'داشبورد',
                    library: 'کتابخانه من',
                    explore: 'کاوش جامعه',
                    wishlist: 'لیست علاقه‌مندی‌ها',
                    tools: 'ابزارهای مطالعه',
                    profile: 'پروفایل کاربری',
                    settings: 'تنظیمات'
                };
                pageTitleHeader.innerText = titles[targetTab] || 'میو بوک';
            }

            if (targetTab === 'explore') {
                loadCommunityFeed();
            } else if (targetTab === 'profile') {
                renderProfileView();
            } else if (targetTab === 'settings') {
                window.renderSettingsView();
            }
        });
    });

    // --- 16. Google Authentication & Profile Rendering ---
    const profileLoginBtn = document.getElementById('profile-login-btn');
    const profileLogoutBtn = document.getElementById('profile-logout-btn');
    const headerAvatar = document.querySelector('.profile-avatar');

    if (profileLoginBtn) {
        profileLoginBtn.addEventListener('click', async () => {
            const errorMsg = document.getElementById('login-error-msg');
            if (errorMsg) errorMsg.innerText = '';
            
            try {
                profileLoginBtn.innerText = 'درحال اتصال...';
                profileLoginBtn.disabled = true;
                const auth = await loginWithGoogle();
                profileLoginBtn.innerText = 'ورود با اکانت گوگل (Gmail)';
                profileLoginBtn.disabled = false;

                renderProfileView();
                syncAllLocalBooksToServer();
                maybeShowTasteWizard();
                alert(`خوش آمدید، ${auth.displayName}!`);
            } catch (err) {
                console.error("Login failed:", err);
                if (profileLoginBtn) {
                    profileLoginBtn.innerText = 'ورود با اکانت گوگل (Gmail)';
                    profileLoginBtn.disabled = false;
                }
                if (errorMsg) {
                    errorMsg.innerText = `خطا در ورود: ${err.message || 'مشکلی پیش آمد.'}`;
                }
            }
        });
    }

    // --- Phone (OTP via sms.ir) Authentication ---
    const phoneOtpSendBtn = document.getElementById('phone-otp-send-btn');
    const phoneOtpVerifyBtn = document.getElementById('phone-otp-verify-btn');
    const phoneLoginInput = document.getElementById('phone-login-input');
    const phoneOtpInput = document.getElementById('phone-otp-input');
    const phoneLoginStepPhone = document.getElementById('phone-login-step-phone');
    const phoneLoginStepCode = document.getElementById('phone-login-step-code');
    let pendingOtpPhone = null;

    if (phoneOtpSendBtn) {
        phoneOtpSendBtn.addEventListener('click', async () => {
            const errorMsg = document.getElementById('phone-login-error-msg');
            if (errorMsg) errorMsg.innerText = '';
            const phone = (phoneLoginInput.value || '').trim();

            if (!/^09\d{9}$/.test(phone)) {
                if (errorMsg) errorMsg.innerText = 'شماره موبایل را به صورت صحیح وارد کنید (مثلا 09121234567).';
                return;
            }

            try {
                phoneOtpSendBtn.innerText = 'در حال ارسال...';
                phoneOtpSendBtn.disabled = true;
                await requestPhoneOtp(phone);
                pendingOtpPhone = phone;
                phoneLoginStepPhone.classList.add('hidden');
                phoneLoginStepCode.classList.remove('hidden');
                phoneOtpInput.focus();
            } catch (err) {
                console.error('OTP send failed:', err);
                if (errorMsg) errorMsg.innerText = err.message || 'ارسال کد تایید ناموفق بود.';
            } finally {
                phoneOtpSendBtn.innerText = 'ارسال کد تایید پیامکی';
                phoneOtpSendBtn.disabled = false;
            }
        });
    }

    if (phoneOtpVerifyBtn) {
        phoneOtpVerifyBtn.addEventListener('click', async () => {
            const errorMsg = document.getElementById('phone-login-error-msg');
            if (errorMsg) errorMsg.innerText = '';
            const code = (phoneOtpInput.value || '').trim();

            if (!pendingOtpPhone || !code) {
                if (errorMsg) errorMsg.innerText = 'کد تایید را وارد کنید.';
                return;
            }

            try {
                phoneOtpVerifyBtn.innerText = 'در حال بررسی...';
                phoneOtpVerifyBtn.disabled = true;
                const auth = await loginWithPhoneOtp(pendingOtpPhone, code);
                pendingOtpPhone = null;
                phoneLoginStepCode.classList.add('hidden');
                phoneLoginStepPhone.classList.remove('hidden');
                phoneLoginInput.value = '';
                phoneOtpInput.value = '';
                renderProfileView();
                syncAllLocalBooksToServer();
                maybeShowTasteWizard();
                alert(`خوش آمدید، ${auth.displayName}!`);
            } catch (err) {
                console.error('OTP verify failed:', err);
                if (errorMsg) errorMsg.innerText = err.message || 'کد تایید نامعتبر است.';
            } finally {
                phoneOtpVerifyBtn.innerText = 'تایید و ورود';
                phoneOtpVerifyBtn.disabled = false;
            }
        });
    }

    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener('click', async () => {
            if (confirm('آیا مایل به خروج از حساب کاربری خود هستید؟')) {
                await logout();
                renderProfileView();
            }
        });
    }

    if (headerAvatar) {
        headerAvatar.addEventListener('click', () => {
            const profileNav = document.getElementById('profile-nav-btn');
            if (profileNav) profileNav.click();
        });
    }

    // Exposed on window so the Settings tab's logout handler (a separate
    // DOMContentLoaded closure) can refresh the profile view too.
    window.renderProfileView = renderProfileView;
    async function renderProfileView() {
        const data = await chrome.storage.local.get(['auth']);
        const loggedIn = document.getElementById('profile-logged-in');
        const loggedOut = document.getElementById('profile-logged-out');
        const avatar = document.getElementById('profile-user-avatar');
        const name = document.getElementById('profile-user-name');
        const email = document.getElementById('profile-user-email');
        
        const hAvatarImg = document.querySelector('.profile-avatar img');
        const hAvatarName = document.querySelector('.profile-avatar span');
        const widgetName = document.getElementById('profile-widget-name');

        if (data.auth) {
            if (loggedIn) loggedIn.classList.remove('hidden');
            if (loggedOut) loggedOut.classList.add('hidden');

            if (avatar) avatar.src = data.auth.photoUrl;
            if (name) name.innerText = data.auth.displayName;
            if (email) email.innerText = data.auth.email;

            if (hAvatarImg) hAvatarImg.src = data.auth.photoUrl;
            if (hAvatarName) hAvatarName.innerText = data.auth.displayName;
            if (widgetName) widgetName.innerText = data.auth.displayName;
        } else {
            if (loggedIn) loggedIn.classList.add('hidden');
            if (loggedOut) loggedOut.classList.remove('hidden');

            if (hAvatarImg) hAvatarImg.src = "https://robohash.org/guest?set=set4";
            if (hAvatarName) hAvatarName.innerText = "میهمان 🐾";
            if (widgetName) widgetName.innerText = "میهمان";
        }
    }

    // --- 16b. Onboarding Taste Wizard (answers stored on the server only) ---
    const wizardModal = document.getElementById('taste-wizard-modal');
    const wizardSteps = wizardModal ? Array.from(wizardModal.querySelectorAll('.wizard-step')) : [];
    const wizardProgressFill = document.getElementById('wizard-progress-fill');
    const wizardBackBtn = document.getElementById('wizard-back-btn');
    const wizardNextBtn = document.getElementById('wizard-next-btn');
    const closeWizardBtn = document.getElementById('close-wizard-btn');
    let wizardStepIndex = 0;
    const wizardAnswers = { genres: [], pace: '', goal: '', discovery: '' };

    const WIZARD_STEP_FIELDS = [
        { grid: 'wizard-genres-grid', key: 'genres', multi: true },
        { grid: 'wizard-pace-grid', key: 'pace', multi: false },
        { grid: 'wizard-goal-grid', key: 'goal', multi: false },
        { grid: 'wizard-discovery-grid', key: 'discovery', multi: false }
    ];

    WIZARD_STEP_FIELDS.forEach(({ grid, key, multi }) => {
        const gridEl = document.getElementById(grid);
        if (!gridEl) return;
        gridEl.addEventListener('click', (e) => {
            const chip = e.target.closest('.wizard-chip');
            if (!chip) return;
            const value = chip.dataset.value;

            if (multi) {
                chip.classList.toggle('selected');
                wizardAnswers[key] = Array.from(gridEl.querySelectorAll('.wizard-chip.selected')).map(c => c.dataset.value);
            } else {
                gridEl.querySelectorAll('.wizard-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                wizardAnswers[key] = value;
            }
        });
    });

    function renderWizardStep() {
        wizardSteps.forEach((step, i) => step.classList.toggle('hidden', i !== wizardStepIndex));
        if (wizardProgressFill) wizardProgressFill.style.width = `${((wizardStepIndex + 1) / wizardSteps.length) * 100}%`;
        if (wizardBackBtn) wizardBackBtn.classList.toggle('hidden', wizardStepIndex === 0);
        if (wizardNextBtn) wizardNextBtn.innerText = wizardStepIndex === wizardSteps.length - 1 ? 'پایان و ذخیره' : 'بعدی';
    }

    function closeWizard() {
        if (wizardModal) wizardModal.classList.add('hidden');
    }

    if (wizardBackBtn) {
        wizardBackBtn.addEventListener('click', () => {
            if (wizardStepIndex > 0) {
                wizardStepIndex--;
                renderWizardStep();
            }
        });
    }

    if (wizardNextBtn) {
        wizardNextBtn.addEventListener('click', async () => {
            if (wizardStepIndex < wizardSteps.length - 1) {
                wizardStepIndex++;
                renderWizardStep();
                return;
            }

            wizardNextBtn.disabled = true;
            wizardNextBtn.innerText = 'در حال ذخیره...';
            try {
                await savePreferences(wizardAnswers);
                closeWizard();
            } catch (err) {
                console.error('Save preferences error:', err);
                alert(err.message || 'ذخیره سلیقه مطالعه با خطا مواجه شد.');
            } finally {
                wizardNextBtn.disabled = false;
                renderWizardStep();
            }
        });
    }

    if (closeWizardBtn) {
        closeWizardBtn.addEventListener('click', closeWizard);
    }

    if (wizardModal) {
        wizardModal.addEventListener('click', (e) => {
            if (e.target === wizardModal) closeWizard();
        });
    }

    // Shown once, right after the first successful login, if this account
    // hasn't completed the wizard yet (checked against the server record).
    async function maybeShowTasteWizard() {
        if (!wizardModal || typeof getPreferences !== 'function') return;
        try {
            const prefs = await getPreferences();
            if (prefs && prefs.completedAt) return;
            wizardStepIndex = 0;
            wizardAnswers.genres = [];
            wizardAnswers.pace = '';
            wizardAnswers.goal = '';
            wizardAnswers.discovery = '';
            wizardModal.querySelectorAll('.wizard-chip.selected').forEach(c => c.classList.remove('selected'));
            renderWizardStep();
            wizardModal.classList.remove('hidden');
        } catch (err) {
            console.error('maybeShowTasteWizard error:', err);
        }
    }

    // --- 16c. Reading Story (Wrapped-style share card, drawn from GET /api/story) ---
    const openStoryBtn = document.getElementById('open-story-btn');
    const storyModal = document.getElementById('story-modal');
    const closeStoryBtn = document.getElementById('close-story-btn');
    const storyCanvas = document.getElementById('story-canvas');
    const storyLoading = document.getElementById('story-loading');
    const storyDownloadBtn = document.getElementById('story-download-btn');
    let lastStoryData = null;

    function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        const words = (text || '').split(' ');
        let line = '';
        let lines = 0;
        for (let i = 0; i < words.length; i++) {
            const testLine = line ? `${line} ${words[i]}` : words[i];
            if (ctx.measureText(testLine).width > maxWidth && line) {
                ctx.fillText(line, x, y);
                line = words[i];
                y += lineHeight;
                lines++;
                if (maxLines && lines >= maxLines) return y;
            } else {
                line = testLine;
            }
        }
        if (line) ctx.fillText(line, x, y);
        return y + lineHeight;
    }

    function loadStoryLogo() {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = chrome.runtime.getURL('assets/icons/logo-white.png');
        });
    }

    async function renderStoryCanvas(data) {
        const ctx = storyCanvas.getContext('2d');
        const W = storyCanvas.width, H = storyCanvas.height;

        const gradient = ctx.createLinearGradient(0, 0, W, H);
        gradient.addColorStop(0, '#1c1030');
        gradient.addColorStop(1, '#3a1f5c');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'right';
        ctx.direction = 'rtl';

        const logo = await loadStoryLogo();
        if (logo) {
            const logoH = 70, logoW = logo.width * (logoH / logo.height);
            ctx.drawImage(logo, W - 80 - logoW, 70, logoW, logoH);
        }

        ctx.fillStyle = '#fff';
        ctx.font = '700 46px Vazirmatn, sans-serif';
        ctx.fillText(`استوری مطالعه ${data.displayName || 'کتاب‌خوان'}`, W - 80, 240);

        ctx.font = '400 30px Vazirmatn, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText('میو بوک 🐈‍⬛', W - 80, 285);

        // Big stat row: total books / pages read
        ctx.font = '800 130px Vazirmatn, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(String(data.totalBooks ?? 0), W - 80, 460);
        ctx.font = '400 30px Vazirmatn, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText('کتاب در کتابخانه‌ات', W - 80, 505);

        ctx.font = '800 90px Vazirmatn, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(String(data.pagesRead ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ','), W - 80, 630);
        ctx.font = '400 30px Vazirmatn, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText('صفحه خوانده‌ای', W - 80, 670);

        let y = 780;
        const section = (title, books, emptyText) => {
            ctx.font = '700 36px Vazirmatn, sans-serif';
            ctx.fillStyle = '#fff';
            ctx.fillText(title, W - 80, y);
            y += 50;
            ctx.font = '400 28px Vazirmatn, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            if (!books || books.length === 0) {
                ctx.fillText(emptyText, W - 80, y);
                y += 46;
            } else {
                books.slice(0, 3).forEach(b => {
                    y = wrapCanvasText(ctx, `• ${b.title}${b.author ? ' — ' + b.author : ''}`, W - 80, y, W - 160, 40, 1);
                });
            }
            y += 30;
        };

        section('در حال خواندن', data.reading, 'در حال حاضر چیزی نمی‌خوانی');
        section('خوانده‌شده', data.read, 'هنوز کتابی رو تموم نکردی');
        section('می‌خوام بخوانم', data.toRead, 'لیست بعدی خالیه');

        if (data.genres && data.genres.length) {
            ctx.font = '400 26px Vazirmatn, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(`ژانر موردعلاقه: ${data.genres.slice(0, 3).join('، ')}`, W - 80, H - 140);
        }

        ctx.font = '400 24px Vazirmatn, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText('miobook.app', W - 80, H - 70);
    }

    async function openStoryModal() {
        if (!storyModal || !storyCanvas) return;
        if (typeof isConfigured !== 'function' || !isConfigured() || typeof fetchReadingStory !== 'function') {
            alert('برای ساخت استوری ابتدا باید وارد حساب کاربری خود شوی.');
            return;
        }

        storyModal.classList.remove('hidden');
        if (storyLoading) storyLoading.classList.remove('hidden');

        const data = await fetchReadingStory();
        if (storyLoading) storyLoading.classList.add('hidden');

        if (!data) {
            alert('برای ساخت استوری ابتدا باید وارد حساب کاربری خود شوی.');
            storyModal.classList.add('hidden');
            return;
        }

        lastStoryData = data;
        await renderStoryCanvas(data);
    }

    if (openStoryBtn) openStoryBtn.addEventListener('click', openStoryModal);
    if (closeStoryBtn) closeStoryBtn.addEventListener('click', () => storyModal.classList.add('hidden'));
    if (storyModal) {
        storyModal.addEventListener('click', (e) => {
            if (e.target === storyModal) storyModal.classList.add('hidden');
        });
    }
    if (storyDownloadBtn) {
        storyDownloadBtn.addEventListener('click', () => {
            if (!lastStoryData || !storyCanvas) return;
            const link = document.createElement('a');
            link.download = 'miobook-story.png';
            link.href = storyCanvas.toDataURL('image/png');
            link.click();
        });
    }

    // --- 17. Community Feed Loading & Rendering ---
    const refreshCommunityBtn = document.getElementById('refresh-community-btn');
    if (refreshCommunityBtn) {
        refreshCommunityBtn.addEventListener('click', loadCommunityFeed);
    }

    async function loadCommunityFeed() {
        const warningCard = document.getElementById('firebase-setup-warning');
        const feedGrid = document.getElementById('social-feed-grid');
        
        if (!warningCard || !feedGrid) return;
        
        if (!isConfigured()) {
            warningCard.classList.remove('hidden');
            feedGrid.innerHTML = '';
            return;
        }
        
        warningCard.classList.add('hidden');
        feedGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">میو! در حال بو کشیدن و پیدا کردن دوستان... 🐾</div>';
        
        try {
            const feed = await fetchSocialStatuses();
            feedGrid.innerHTML = '';
            
            if (feed.length === 0) {
                feedGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">میو! هیچ فعالیت مطالعه‌ای در جامعه ثبت نشده است. اولین گربه‌ای باشید که کتابی را معرفی می‌کند! 🐈</div>';
                return;
            }
            
            feed.forEach(item => {
                const card = document.createElement('div');
                card.className = 'glass';
                card.style.padding = '16px';
                card.style.borderRadius = 'var(--radius-md)';
                card.style.border = '1px solid var(--border-color)';
                card.style.background = 'rgba(255, 255, 255, 0.01)';
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.gap = '12px';
                card.style.position = 'relative';
                
                const relativeTime = getRelativeTime(item.updatedAt);
                const progressPct = item.totalPages > 0 ? Math.round((item.currentPage / item.totalPages) * 100) : 0;
                
                const liveBadgeHtml = item.isReadingNow
                    ? `<span style="position: absolute; top: 12px; left: 12px; display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: bold; color: #2ecc71; background: rgba(46, 204, 113, 0.12); padding: 4px 8px; border-radius: 12px; animation: pulse 2s infinite;">
                         <span style="width: 6px; height: 6px; border-radius: 50%; background: #2ecc71;"></span>
                         در حال مطالعه (زنده)
                       </span>`
                    : '';
                    
                const statusLabels = {
                    reading: 'در حال مطالعه',
                    read: 'تمام کرده است 🎉',
                    toRead: 'می‌خواهد بخواند'
                };
                
                card.innerHTML = `
                    ${liveBadgeHtml}
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${item.photoUrl}" alt="Avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: bold; font-size: 13px; color: var(--text-primary);">${escapeHtml(item.displayName)}</span>
                            <span style="font-size: 10px; color: var(--text-muted);">${relativeTime}</span>
                        </div>
                    </div>
                    
                    <div style="padding: 10px; border-radius: var(--radius-sm); background: rgba(255, 255, 255, 0.02); display: flex; align-items: center; gap: 12px; border: 1px solid var(--border-color);">
                        <div style="font-size: 24px;">📖</div>
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${escapeHtml(item.bookTitle)}</span>
                            <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(item.author || 'نویسنده نامشخص')}</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary);">
                            <span>وضعیت: ${statusLabels[item.status] || item.status}</span>
                            <span>صفحه ${item.currentPage.toLocaleString('fa-IR')} از ${item.totalPages.toLocaleString('fa-IR')} (${progressPct.toLocaleString('fa-IR')}٪)</span>
                        </div>
                        <div style="width: 100%; height: 6px; border-radius: 3px; background: var(--bg-tertiary); overflow: hidden; margin-top: 4px;">
                            <div style="width: ${progressPct}%; height: 100%; background: ${item.status === 'read' ? '#2e6f40' : 'var(--accent-color)'}; border-radius: 3px;"></div>
                        </div>
                    </div>
                `;
                
                feedGrid.appendChild(card);
            });
        } catch (err) {
            console.error(err);
            feedGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #e63946;">خطا در دریافت اطلاعات فید جامعه: ${err.message || 'اتصال برقرار نشد.'}</div>`;
        }
    }

    function getRelativeTime(epoch) {
        if (!epoch) return 'نامشخص';
        const diffMs = Date.now() - epoch;
        const diffMin = Math.round(diffMs / 60000);
        const diffHr = Math.round(diffMs / 3600000);
        const diffDay = Math.round(diffMs / 86400000);
        
        if (diffMin < 1) return 'همین الان';
        if (diffMin < 60) return `${diffMin.toLocaleString('fa-IR')} دقیقه پیش`;
        if (diffHr < 24) return `${diffHr.toLocaleString('fa-IR')} ساعت پیش`;
        return `${diffDay.toLocaleString('fa-IR')} روز پیش`;
    }

    // --- 18. Initialization ---
    loadBookshelf();
    loadGoals();
    loadWordBank();
    renderCharts();
    renderProfileView();

    chrome.storage.local.get(['auth'], (result) => {
        if (result.auth) {
            syncAllLocalBooksToServer();
            maybeShowTasteWizard();
        }
    });
});

// =====================================================================
// 🐾 DASHBOARD WIDGETS — real data 🐾
// Friends "reading now" row, community list, activity feed, quick-note
// composer, and the Pomodoro/weekly-goal widgets are all backed by the
// real Turso-backed Express API (server/app.js) or existing
// chrome.storage-based systems (books / readingGoal). No mock arrays.
// =====================================================================
document.addEventListener('DOMContentLoaded', async () => {

    function escapeHtmlLocal(str) {
        const div = document.createElement('div');
        div.innerText = str == null ? '' : String(str);
        return div.innerHTML;
    }

    // Compact, friendly empty/error state markup shared by the social widgets.
    function renderEmptyState(icon, title, subtitle) {
        return `
            <div class="mini-empty-state">
                <span class="mini-empty-icon">${icon}</span>
                <strong class="mini-empty-title">${escapeHtmlLocal(title)}</strong>
                <span class="mini-empty-subtitle">${escapeHtmlLocal(subtitle || '')}</span>
            </div>
        `;
    }

    // Returns the title of the book currently being read (first "reading" status book), or null.
    function getCurrentBookTitle() {
        return new Promise(resolve => {
            chrome.storage.local.get(['books'], result => {
                const books = result.books || [];
                const reading = books.find(b => b.status === 'reading');
                resolve(reading ? reading.title : null);
            });
        });
    }

    async function isLoggedIn() {
        const data = await chrome.storage.local.get(['auth']);
        return !!data.auth;
    }

    // --- Render: friends reading now (horizontal row) + community reading list ---
    // Community list (whole community, no follow-graph needed) — real /api/social-feed.
    const communityList = document.getElementById('community-reading-list');
    const communityLiveCountEl = document.getElementById('community-live-count');

    async function loadCommunityWidget() {
        if (communityList) {
            communityList.innerHTML = '<div style="padding: 12px; color: var(--text-secondary); font-size: 12px;">در حال بارگذاری... 🐾</div>';
        }
        try {
            const feed = await fetchSocialStatuses();
            if (!communityList) return;

            if (communityLiveCountEl) {
                communityLiveCountEl.innerText = feed.length > 0
                    ? `${feed.length.toLocaleString('fa-IR')} نفر همین الان در حال مطالعه‌اند`
                    : '';
            }

            if (feed.length === 0) {
                communityList.innerHTML = renderEmptyState('🌙', 'فعلاً کسی در حال مطالعه نیست', 'اولین نفر باش و شروع کن!');
            } else {
                communityList.innerHTML = feed.map(u => {
                    const progress = u.totalPages > 0 ? Math.round((u.currentPage / u.totalPages) * 100) : 0;
                    return `
                        <div class="community-reading-row">
                            <img class="cr-avatar" src="${escapeHtmlLocal(u.photoUrl || '../assets/icons/icon-48.png')}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                            <div class="cr-info">
                                <div class="cr-name">${escapeHtmlLocal(u.displayName)}</div>
                                <div class="cr-book">${escapeHtmlLocal(u.bookTitle || 'بدون عنوان')} · صفحه ${(u.currentPage || 0).toLocaleString('fa-IR')}</div>
                            </div>
                            <div class="cr-pct">${progress.toLocaleString('fa-IR')}٪</div>
                        </div>
                    `;
                }).join('');
            }
        } catch (err) {
            console.error('Error loading community widget:', err);
            if (communityList) {
                communityList.innerHTML = renderEmptyState('⚠️', 'خطا در دریافت اطلاعات جامعه', err.message || 'اتصال برقرار نشد.');
            }
        }
    }
    loadCommunityWidget();

    // --- Friends widget — real follow-graph via GET/POST/DELETE /api/friends ---
    const friendsNowRow = document.getElementById('friends-now-row');
    const addFriendInput = document.getElementById('add-friend-input');
    const addFriendBtn = document.getElementById('add-friend-btn');
    const addFriendFeedbackEl = document.getElementById('add-friend-feedback');

    function setAddFriendFeedback(message, isError) {
        if (!addFriendFeedbackEl) return;
        addFriendFeedbackEl.innerText = message;
        addFriendFeedbackEl.style.color = isError ? '#e63946' : '#2e6f40';
    }

    async function loadFriendsWidget() {
        if (!friendsNowRow) return;

        if (!(await isLoggedIn())) {
            friendsNowRow.innerHTML = renderEmptyState('🔑', 'برای دیدن دوستان وارد شو', 'با اکانت گوگل وارد شو تا ببینی دوستانت چه کتابی می‌خوانند.');
            return;
        }

        friendsNowRow.innerHTML = '<div style="padding: 12px; color: var(--text-secondary); font-size: 12px;">در حال بارگذاری... 🐾</div>';

        try {
            const idToken = await getAuthToken();
            if (!idToken) {
                friendsNowRow.innerHTML = '<div style="padding: 12px; color: var(--text-secondary); font-size: 12px;">نشست ورود شما منقضی شده است.</div>';
                return;
            }

            const res = await fetch(`${CUSTOM_SERVER_URL}/api/friends`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            if (!res.ok) throw new Error('پاسخ نامعتبر از سرور');
            const friends = await res.json();

            if (!Array.isArray(friends) || friends.length === 0) {
                friendsNowRow.innerHTML = renderEmptyState('🐱', 'هنوز کسی را دنبال نکرده‌ای', 'ایمیل دوستت را بالا وارد کن و دعوتش کن؛ ببین چه کتاب‌هایی می‌خواند.');
                return;
            }

            friendsNowRow.innerHTML = friends.map(f => {
                const progress = f.totalPages > 0 ? Math.round((f.currentPage / f.totalPages) * 100) : 0;
                const statusClass = f.isReadingNow ? 'reading' : 'resting';
                return `
                    <div class="friend-now-card">
                        <div class="friend-now-avatar-wrap">
                            <img class="friend-now-avatar" src="${escapeHtmlLocal(f.photoUrl || '../assets/icons/icon-48.png')}" alt="" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                            <span class="friend-now-status-dot ${statusClass}"></span>
                        </div>
                        <div class="friend-now-name">${escapeHtmlLocal(f.displayName)}</div>
                        <div class="friend-now-book">${escapeHtmlLocal(f.bookTitle || 'کتابی ثبت نشده')}</div>
                        <div class="friend-now-pages">${f.totalPages ? `صفحه ${(f.currentPage || 0).toLocaleString('fa-IR')}/${(f.totalPages || 0).toLocaleString('fa-IR')} (${progress.toLocaleString('fa-IR')}٪)` : ''}</div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Error loading friends widget:', err);
            friendsNowRow.innerHTML = renderEmptyState('⚠️', 'خطا در دریافت لیست دوستان', err.message || 'اتصال برقرار نشد.');
        }
    }
    loadFriendsWidget();

    if (addFriendBtn) {
        addFriendBtn.addEventListener('click', async () => {
            const email = addFriendInput ? addFriendInput.value.trim() : '';
            if (!email) return;

            if (!(await isLoggedIn())) {
                setAddFriendFeedback('برای افزودن دوست ابتدا با اکانت گوگل وارد شوید.', true);
                return;
            }

            const idToken = await getAuthToken();
            if (!idToken) {
                setAddFriendFeedback('نشست ورود شما منقضی شده است. دوباره وارد شوید.', true);
                return;
            }

            addFriendBtn.disabled = true;
            setAddFriendFeedback('در حال افزودن...', false);

            try {
                const res = await fetch(`${CUSTOM_SERVER_URL}/api/friends`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ friendEmail: email })
                });
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data.error || 'خطا در افزودن دوست.');
                }

                setAddFriendFeedback(`${data.friend ? data.friend.displayName : ''} به دوستان اضافه شد! 🐾`, false);
                if (addFriendInput) addFriendInput.value = '';
                loadFriendsWidget();
            } catch (err) {
                console.error('Error adding friend:', err);
                setAddFriendFeedback(err.message || 'اتصال برقرار نشد.', true);
            } finally {
                addFriendBtn.disabled = false;
            }
        });
    }

    // --- Render: friends activity feed (real /api/activity-feed) ---
    const ACTIVITY_ICON_MAP = {
        started_reading: '📖',
        finished_book: '🎉',
        pomodoro_session: '🍅',
        added_book: '📚',
        streak: '🔥'
    };
    const ACTIVITY_TEXT_MAP = {
        started_reading: (n, b) => `<strong>${n}</strong> مطالعه‌ی «${b}» را شروع کرد`,
        finished_book: (n, b) => `<strong>${n}</strong> کتاب «${b}» را به پایان رساند`,
        pomodoro_session: (n, b, d) => `<strong>${n}</strong> یک جلسه پومودورو ${d ? `(${escapeHtmlLocal(d)}) ` : ''}${b ? `روی «${b}» ` : ''}انجام داد`,
        added_book: (n, b) => `<strong>${n}</strong> کتاب «${b}» را به کتابخانه‌اش اضافه کرد`,
        streak: (n, b, d) => `<strong>${n}</strong> ${d || 'به یک رکورد مطالعه متوالی'} رسید`
    };

    const activityFeed = document.getElementById('friends-activity-feed');

    async function loadActivityFeed() {
        if (!activityFeed) return;
        activityFeed.innerHTML = '<div style="padding: 12px; color: var(--text-secondary); font-size: 12px;">در حال بارگذاری... 🐾</div>';
        try {
            const res = await fetch(`${CUSTOM_SERVER_URL}/api/activity-feed`);
            if (!res.ok) throw new Error('پاسخ نامعتبر از سرور');
            const events = await res.json();

            if (!Array.isArray(events) || events.length === 0) {
                activityFeed.innerHTML = renderEmptyState('🐾', 'هنوز فعالیتی ثبت نشده', 'وقتی تو یا دوستانت مطالعه کنید، اینجا نمایش داده می‌شود.');
                return;
            }

            activityFeed.innerHTML = events.map(e => {
                const icon = ACTIVITY_ICON_MAP[e.type] || '📌';
                const textFn = ACTIVITY_TEXT_MAP[e.type];
                const name = escapeHtmlLocal(e.displayName || 'کاربر ناشناس');
                const book = escapeHtmlLocal(e.bookTitle || '');
                const detail = escapeHtmlLocal(e.detail || '');
                const text = textFn ? textFn(name, book, detail) : `<strong>${name}</strong> ${detail || 'یک فعالیت جدید ثبت کرد'}`;
                return `
                    <div class="activity-item">
                        <span class="activity-icon">${icon}</span>
                        <span class="activity-text">${text}<span class="activity-time">${getRelativeTime(e.createdAt)}</span></span>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Error loading activity feed:', err);
            activityFeed.innerHTML = renderEmptyState('⚠️', 'خطا در دریافت فید فعالیت‌ها', err.message || 'اتصال برقرار نشد.');
        }
    }
    loadActivityFeed();

    // --- Quick note composer — real authenticated POST /api/notes ---
    const quickNotePostBtn = document.getElementById('quick-note-post-btn');
    const quickNoteInputEl = document.getElementById('quick-note-input');
    let quickNoteFeedbackEl = document.getElementById('quick-note-feedback');
    if (!quickNoteFeedbackEl && quickNotePostBtn && quickNotePostBtn.parentNode) {
        quickNoteFeedbackEl = document.createElement('div');
        quickNoteFeedbackEl.id = 'quick-note-feedback';
        quickNoteFeedbackEl.style.cssText = 'font-size: 12px; margin-top: 8px; min-height: 16px;';
        quickNotePostBtn.parentNode.appendChild(quickNoteFeedbackEl);
    }

    function setQuickNoteFeedback(message, isError) {
        if (!quickNoteFeedbackEl) return;
        quickNoteFeedbackEl.innerText = message;
        quickNoteFeedbackEl.style.color = isError ? '#e63946' : '#2e6f40';
    }

    if (quickNotePostBtn) {
        quickNotePostBtn.addEventListener('click', async () => {
            const input = quickNoteInputEl || document.getElementById('quick-note-input');
            const noteText = input ? input.value.trim() : '';
            if (!noteText) return;

            if (!(await isLoggedIn())) {
                setQuickNoteFeedback('برای ثبت یادداشت ابتدا با اکانت گوگل وارد شوید.', true);
                return;
            }

            const idToken = await getAuthToken();
            if (!idToken) {
                setQuickNoteFeedback('نشست ورود شما منقضی شده است. دوباره وارد شوید.', true);
                return;
            }

            quickNotePostBtn.disabled = true;
            setQuickNoteFeedback('در حال ذخیره...', false);

            try {
                const bookTitle = await getCurrentBookTitle();
                const res = await fetch(`${CUSTOM_SERVER_URL}/api/notes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ bookTitle: bookTitle || '', pageNumber: 0, noteText })
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'خطا در ذخیره یادداشت.');
                }

                if (input) input.value = '';
                setQuickNoteFeedback('یادداشت شما ذخیره شد! 🐾', false);
            } catch (err) {
                console.error('Error posting note:', err);
                setQuickNoteFeedback(err.message || 'اتصال برقرار نشد.', true);
            } finally {
                quickNotePostBtn.disabled = false;
            }
        });
    }
    const heroQuickNoteBtn = document.getElementById('hero-quick-note-btn');
    if (heroQuickNoteBtn) {
        heroQuickNoteBtn.addEventListener('click', () => {
            const quickNoteInput = document.getElementById('quick-note-input');
            if (quickNoteInput) quickNoteInput.focus();
        });
    }

    // --- Notification bell: real unseen-activity count, dismissible ---
    const notifBellBtn = document.getElementById('notif-bell-btn');
    if (notifBellBtn) {
        notifBellBtn.addEventListener('click', async () => {
            const badge = document.getElementById('notif-badge');
            if (badge) badge.classList.add('hidden');
            const events = await fetchActivityFeedSafe();
            await chrome.storage.local.set({ notifSeenCount: events.length });
        });
    }

    async function fetchActivityFeedSafe() {
        try {
            const res = await fetch(`${CUSTOM_SERVER_URL}/api/activity-feed`);
            if (!res.ok) return [];
            const events = await res.json();
            return Array.isArray(events) ? events : [];
        } catch (err) {
            return [];
        }
    }

    async function refreshNotificationBadge() {
        const badge = document.getElementById('notif-badge');
        if (!notifBellBtn || !badge) return;

        const settings = await chrome.storage.local.get(['notificationsEnabled']);
        const notificationsEnabled = settings.notificationsEnabled !== false;
        notifBellBtn.classList.toggle('hidden', !notificationsEnabled);
        if (!notificationsEnabled) return;

        const events = await fetchActivityFeedSafe();
        const seen = await chrome.storage.local.get(['notifSeenCount']);
        const seenCount = seen.notifSeenCount || 0;
        const unseen = Math.max(events.length - seenCount, 0);

        if (unseen > 0) {
            badge.innerText = unseen.toLocaleString('fa-IR');
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    refreshNotificationBadge();

    // --- Simple Jalali (Persian) calendar widget — pure JS conversion, no deps ---
    const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    function toPersianDigitsLocal(n) {
        return String(n).replace(/[0-9]/g, d => PERSIAN_DIGITS[d]);
    }

    // Gregorian -> Jalali conversion (standard algorithm)
    function gregorianToJalali(gy, gm, gd) {
        const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        let jy;
        const gy2 = (gm > 2) ? (gy + 1) : gy;
        let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
        jy = -1595 + (33 * Math.floor(days / 12053));
        days %= 12053;
        jy += 4 * Math.floor(days / 1461);
        days %= 1461;
        if (days > 365) {
            jy += Math.floor((days - 1) / 365);
            days = (days - 1) % 365;
        }
        let jm, jd;
        if (days < 186) {
            jm = 1 + Math.floor(days / 31);
            jd = 1 + (days % 31);
        } else {
            jm = 7 + Math.floor((days - 186) / 30);
            jd = 1 + ((days - 186) % 30);
        }
        return [jy, jm, jd];
    }

    // Jalali -> Gregorian (needed to know which weekday the 1st of the month falls on)
    function jalaliToGregorian(jy, jm, jd) {
        jy += 1595;
        let days = -355668 + (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
        let gy = 400 * Math.floor(days / 146097);
        days %= 146097;
        if (days > 36524) {
            gy += 100 * Math.floor(--days / 36524);
            days %= 36524;
            if (days >= 365) days++;
        }
        gy += 4 * Math.floor(days / 1461);
        days %= 1461;
        if (days > 365) {
            gy += Math.floor((days - 1) / 365);
            days = (days - 1) % 365;
        }
        const gd = days + 1;
        const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let gm = 0, gdRemain = gd;
        for (gm = 1; gm <= 12 && gdRemain > sal_a[gm]; gm++) {
            gdRemain -= sal_a[gm];
        }
        return new Date(gy, gm - 1, gdRemain);
    }

    function jalaliMonthLength(jy, jm) {
        if (jm <= 6) return 31;
        if (jm <= 11) return 30;
        // Esfand: 29 or 30 (leap) — approximate via conversion round-trip
        const isLeap = ((((jy - (jy > 0 ? 474 : 473)) % 2820) + 474 + 38) * 682 % 2816) < 682;
        return isLeap ? 30 : 29;
    }

    let calState = null; // { jy, jm }

    // Per-day reading activity (real pomodoro sessions), keyed by Gregorian
    // "Y-M-D" so it lines up with each rendered Jalali day's actual date.
    let calendarActivityMap = {};
    let calendarActivityLoaded = false;

    function dateKey(d) {
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }

    async function loadCalendarActivity() {
        if (calendarActivityLoaded) return;
        if (!(await isLoggedIn())) { calendarActivityLoaded = true; return; }
        try {
            const idToken = await getAuthToken();
            if (!idToken) { calendarActivityLoaded = true; return; }
            const res = await fetch(`${CUSTOM_SERVER_URL}/api/pomodoro-sessions`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            if (!res.ok) throw new Error('پاسخ نامعتبر از سرور');
            const sessions = await res.json();
            const map = {};
            (Array.isArray(sessions) ? sessions : []).forEach(s => {
                const key = dateKey(new Date(s.completedAt));
                if (!map[key]) map[key] = { minutes: 0, count: 0 };
                map[key].minutes += s.durationMinutes || 0;
                map[key].count += 1;
            });
            calendarActivityMap = map;
        } catch (err) {
            console.error('Error loading calendar activity:', err);
        } finally {
            calendarActivityLoaded = true;
            renderCalendar();
        }
    }

    let openCalendarPopoverDay = null;

    function closeCalendarPopover() {
        const existing = document.getElementById('calendar-day-popover');
        if (existing) existing.remove();
        openCalendarPopoverDay = null;
    }

    function showCalendarPopover(dayEl, jy, jm, jd, gregorianDate) {
        closeCalendarPopover();
        openCalendarPopoverDay = `${jy}-${jm}-${jd}`;

        const activity = calendarActivityMap[dateKey(gregorianDate)];
        const dateLabel = `${toPersianDigitsLocal(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigitsLocal(jy)}`;

        const popover = document.createElement('div');
        popover.id = 'calendar-day-popover';
        popover.className = 'calendar-day-popover glass';
        popover.innerHTML = activity
            ? `<strong>${dateLabel}</strong>
               <div class="cdp-row">⏱️ ${toPersianDigitsLocal(activity.minutes)} دقیقه مطالعه</div>
               <div class="cdp-row">🍅 ${toPersianDigitsLocal(activity.count)} پومودورو</div>`
            : `<strong>${dateLabel}</strong><div class="cdp-row cdp-empty">مطالعه‌ای ثبت نشده</div>`;

        dayEl.appendChild(popover);
    }

    function renderCalendar() {
        const monthLabel = document.getElementById('calendar-month-label');
        const grid = document.getElementById('calendar-grid');
        if (!monthLabel || !grid) return;

        const now = new Date();
        const [todayJy, todayJm, todayJd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());

        if (!calState) calState = { jy: todayJy, jm: todayJm };

        monthLabel.innerText = `${PERSIAN_MONTHS[calState.jm - 1]} ${toPersianDigitsLocal(calState.jy)}`;

        // Find weekday of the 1st of this Jalali month (Saturday = 0 ... Friday = 6)
        const firstDayGregorian = jalaliToGregorian(calState.jy, calState.jm, 1);
        const jsWeekday = firstDayGregorian.getDay(); // Sun=0..Sat=6
        const leadingBlanks = (jsWeekday + 1) % 7; // shift so Saturday = 0

        const daysInMonth = jalaliMonthLength(calState.jy, calState.jm);

        let html = '';
        for (let i = 0; i < leadingBlanks; i++) {
            html += `<span class="calendar-day empty"></span>`;
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = (calState.jy === todayJy && calState.jm === todayJm && d === todayJd);
            const gDate = jalaliToGregorian(calState.jy, calState.jm, d);
            const hasActivity = !!calendarActivityMap[dateKey(gDate)];
            html += `<span class="calendar-day${isToday ? ' today' : ''}${hasActivity ? ' has-activity' : ''}" data-jy="${calState.jy}" data-jm="${calState.jm}" data-jd="${d}">${toPersianDigitsLocal(d)}${hasActivity ? '<span class="calendar-day-dot"></span>' : ''}</span>`;
        }
        grid.innerHTML = html;

        grid.querySelectorAll('.calendar-day:not(.empty)').forEach(dayEl => {
            dayEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const jy = parseInt(dayEl.dataset.jy, 10);
                const jm = parseInt(dayEl.dataset.jm, 10);
                const jd = parseInt(dayEl.dataset.jd, 10);
                const key = `${jy}-${jm}-${jd}`;
                if (openCalendarPopoverDay === key) { closeCalendarPopover(); return; }
                showCalendarPopover(dayEl, jy, jm, jd, jalaliToGregorian(jy, jm, jd));
            });
        });

        if (!calendarActivityLoaded) loadCalendarActivity();
    }

    document.addEventListener('click', (e) => {
        if (openCalendarPopoverDay && !e.target.closest('.calendar-day')) closeCalendarPopover();
    });

    const calPrevBtn = document.getElementById('calendar-prev-btn');
    const calNextBtn = document.getElementById('calendar-next-btn');
    if (calPrevBtn) {
        calPrevBtn.addEventListener('click', () => {
            if (!calState) return;
            calState.jm--;
            if (calState.jm < 1) { calState.jm = 12; calState.jy--; }
            renderCalendar();
        });
    }
    if (calNextBtn) {
        calNextBtn.addEventListener('click', () => {
            if (!calState) return;
            calState.jm++;
            if (calState.jm > 12) { calState.jm = 1; calState.jy++; }
            renderCalendar();
        });
    }
    renderCalendar();

    // --- Pomodoro widget (real countdown via setInterval; completed sessions are
    // persisted to the server via POST /api/pomodoro-sessions when the user is logged in) ---
    // Duration/session-count are user-configurable from the Settings tab (see
    // applyPomodoroSettings below) — these are just the defaults until loaded.
    let POMODORO_WORK_MINUTES = 25;
    let POMODORO_WORK_SECONDS = POMODORO_WORK_MINUTES * 60;
    let POMODORO_SESSION_TOTAL = 4;
    const storedPomodoroSettings = await chrome.storage.local.get(['pomodoroSettings']);
    if (storedPomodoroSettings.pomodoroSettings) {
        POMODORO_WORK_MINUTES = storedPomodoroSettings.pomodoroSettings.workMinutes || 25;
        POMODORO_SESSION_TOTAL = storedPomodoroSettings.pomodoroSettings.sessionTotal || 4;
        POMODORO_WORK_SECONDS = POMODORO_WORK_MINUTES * 60;
    }
    let pomodoroSecondsLeft = POMODORO_WORK_SECONDS - 1; // starts one second below full to match the reference design
    let pomodoroRunning = true;
    let pomodoroInterval = null;
    let pomodoroSessionCurrent = 1;

    const pomodoroTimerEl = document.getElementById('pomodoro-timer');
    const pomodoroToggleBtn = document.getElementById('pomodoro-toggle-btn');
    const pomodoroResetBtn = document.getElementById('pomodoro-reset-btn');
    const pomodoroStatusEl = document.getElementById('pomodoro-status');
    const pomodoroSessionCurrentEl = document.getElementById('pomodoro-session-current');
    const pomodoroSessionTotalEl = document.getElementById('pomodoro-session-total');
    const pomodoroBookSelect = document.getElementById('pomodoro-book-select');
    const pomodoroBookTitleEl = document.getElementById('pomodoro-book-title');
    const pomodoroBookAuthorEl = document.getElementById('pomodoro-book-author');
    let pomodoroLoginHintEl = null;

    if (pomodoroSessionTotalEl) pomodoroSessionTotalEl.innerText = POMODORO_SESSION_TOTAL.toLocaleString('fa-IR');

    // --- Pomodoro: which book the user is reading during this session ---
    function renderPomodoroBookDisplay(book) {
        if (pomodoroBookTitleEl) pomodoroBookTitleEl.innerText = book ? book.title : 'بدون کتاب';
        if (pomodoroBookAuthorEl) pomodoroBookAuthorEl.innerText = book ? (book.author || '') : '';
    }

    function loadPomodoroBookOptions(selectedId) {
        if (!pomodoroBookSelect) return;
        chrome.storage.local.get(['books', 'pomodoroSelectedBookId'], (result) => {
            const books = result.books || [];
            const readingBooks = books.filter(b => b.status === 'reading');
            const currentSelection = selectedId !== undefined ? selectedId : (result.pomodoroSelectedBookId || '');

            pomodoroBookSelect.innerHTML = '<option value="">-- بدون کتاب --</option>';
            readingBooks.forEach(book => {
                const opt = document.createElement('option');
                opt.value = book.id;
                opt.textContent = book.title;
                if (book.id === currentSelection) opt.selected = true;
                pomodoroBookSelect.appendChild(opt);
            });

            const selectedBook = readingBooks.find(b => b.id === currentSelection) || null;
            renderPomodoroBookDisplay(selectedBook);
        });
    }

    if (pomodoroBookSelect) {
        pomodoroBookSelect.addEventListener('change', () => {
            const bookId = pomodoroBookSelect.value;
            chrome.storage.local.set({ pomodoroSelectedBookId: bookId }, () => {
                loadPomodoroBookOptions(bookId);
            });
        });
    }

    loadPomodoroBookOptions();

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.books) {
            loadPomodoroBookOptions();
        }
    });

    // Returns the title/author of the book selected in the Pomodoro widget, or null.
    function getPomodoroSelectedBook() {
        return new Promise(resolve => {
            chrome.storage.local.get(['books', 'pomodoroSelectedBookId'], result => {
                const books = result.books || [];
                const book = books.find(b => b.id === result.pomodoroSelectedBookId);
                resolve(book || null);
            });
        });
    }

    async function renderPomodoroLoginHint() {
        if (await isLoggedIn()) {
            if (pomodoroLoginHintEl) pomodoroLoginHintEl.style.display = 'none';
            return;
        }
        if (!pomodoroLoginHintEl && pomodoroTimerEl && pomodoroTimerEl.parentNode) {
            pomodoroLoginHintEl = document.createElement('div');
            pomodoroLoginHintEl.id = 'pomodoro-login-hint';
            pomodoroLoginHintEl.style.cssText = 'font-size: 11px; color: var(--text-secondary); margin-top: 6px;';
            pomodoroLoginHintEl.innerText = 'برای ثبت جلسات وارد حساب کاربری شوید 🐾';
            pomodoroTimerEl.parentNode.appendChild(pomodoroLoginHintEl);
        }
        if (pomodoroLoginHintEl) pomodoroLoginHintEl.style.display = '';
    }
    renderPomodoroLoginHint();

    // Persist a completed session to the server (no-op, gracefully, if not logged in)
    async function persistPomodoroSession() {
        try {
            if (!(await isLoggedIn())) return;
            const idToken = await getAuthToken();
            if (!idToken) return;

            const selectedBook = await getPomodoroSelectedBook();
            const bookTitle = selectedBook ? selectedBook.title : await getCurrentBookTitle();
            const res = await fetch(`${CUSTOM_SERVER_URL}/api/pomodoro-sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ bookTitle: bookTitle || '', durationMinutes: POMODORO_WORK_MINUTES })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error('Failed to persist pomodoro session:', err);
                return;
            }
            // Refresh activity feed + weekly goal widget so the new session shows up.
            loadActivityFeed();
            loadWeeklyGoalWidget();
        } catch (err) {
            console.error('Pomodoro session network error:', err);
        }
    }

    function renderPomodoroTimer() {
        if (!pomodoroTimerEl) return;
        const mins = Math.floor(pomodoroSecondsLeft / 60);
        const secs = pomodoroSecondsLeft % 60;
        const padded = `${toPersianDigitsLocal(String(mins).padStart(2, '0'))}:${toPersianDigitsLocal(String(secs).padStart(2, '0'))}`;
        pomodoroTimerEl.innerText = padded;
    }

    function tickPomodoro() {
        if (pomodoroSecondsLeft <= 0) {
            clearInterval(pomodoroInterval);
            pomodoroRunning = false;
            if (pomodoroSessionCurrent < POMODORO_SESSION_TOTAL) {
                pomodoroSessionCurrent++;
                if (pomodoroSessionCurrentEl) pomodoroSessionCurrentEl.innerText = toPersianDigitsLocal(pomodoroSessionCurrent);
            }
            if (pomodoroStatusEl) pomodoroStatusEl.innerText = '🟡 در حال استراحت';
            if (pomodoroToggleBtn) pomodoroToggleBtn.innerText = 'شروع مجدد';
            persistPomodoroSession();
            return;
        }
        pomodoroSecondsLeft--;
        renderPomodoroTimer();
    }

    function startPomodoro() {
        pomodoroRunning = true;
        if (pomodoroToggleBtn) pomodoroToggleBtn.innerText = 'توقف';
        if (pomodoroStatusEl) pomodoroStatusEl.innerText = '🟢 در حال مطالعه';
        pomodoroInterval = setInterval(tickPomodoro, 1000);
    }

    function pausePomodoro() {
        pomodoroRunning = false;
        clearInterval(pomodoroInterval);
        if (pomodoroToggleBtn) pomodoroToggleBtn.innerText = 'ادامه';
        if (pomodoroStatusEl) pomodoroStatusEl.innerText = '⚪ متوقف شده';
    }

    if (pomodoroToggleBtn) {
        pomodoroToggleBtn.addEventListener('click', () => {
            if (pomodoroSecondsLeft <= 0) {
                pomodoroSecondsLeft = POMODORO_WORK_SECONDS;
                renderPomodoroTimer();
                startPomodoro();
                return;
            }
            if (pomodoroRunning) {
                pausePomodoro();
            } else {
                startPomodoro();
            }
        });
    }
    if (pomodoroResetBtn) {
        pomodoroResetBtn.addEventListener('click', () => {
            clearInterval(pomodoroInterval);
            pomodoroSecondsLeft = POMODORO_WORK_SECONDS - 1;
            pomodoroSessionCurrent = 1;
            if (pomodoroSessionCurrentEl) pomodoroSessionCurrentEl.innerText = toPersianDigitsLocal(pomodoroSessionCurrent);
            renderPomodoroTimer();
            startPomodoro();
        });
    }

    renderPomodoroTimer();
    if (pomodoroRunning) startPomodoro();

    // --- Weekly goal widget — real data from GET /api/pomodoro-sessions ---
    // Target is user-configurable from Settings (stored as weeklyGoalMinutes);
    // falls back to one Pomodoro/day worth of minutes if never set.
    let WEEKLY_GOAL_TARGET_MINUTES = POMODORO_WORK_MINUTES * 7;
    const storedWeeklyGoal = await chrome.storage.local.get(['weeklyGoalMinutes']);
    if (storedWeeklyGoal.weeklyGoalMinutes) WEEKLY_GOAL_TARGET_MINUTES = storedWeeklyGoal.weeklyGoalMinutes;
    const weeklyGoalCurrentEl = document.getElementById('weekly-goal-current');
    const weeklyGoalTargetEl = document.getElementById('weekly-goal-target');
    const weeklyGoalFillEl = document.getElementById('weekly-goal-fill');
    const weeklyGoalTextEl = document.querySelector('.weekly-goal-text');
    const weeklyGoalStreakEl = document.getElementById('weekly-goal-streak');

    // Consecutive-day streak, counted backward from today, based on days that have at least one completed session.
    function computeStreakDays(sessions) {
        const daysWithSession = new Set(
            sessions.map(s => new Date(s.completedAt).toDateString())
        );
        let streak = 0;
        const cursor = new Date();
        while (daysWithSession.has(cursor.toDateString())) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }
        return streak;
    }

    function startOfWeek() {
        // Persian week starts on Saturday.
        const now = new Date();
        const day = now.getDay(); // Sun=0..Sat=6
        const diffToSaturday = (day + 1) % 7;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToSaturday);
        start.setHours(0, 0, 0, 0);
        return start.getTime();
    }

    async function loadWeeklyGoalWidget() {
        if (!weeklyGoalCurrentEl && !weeklyGoalFillEl) return;

        if (!(await isLoggedIn())) {
            if (weeklyGoalTextEl) weeklyGoalTextEl.innerText = 'برای مشاهده پیشرفت هفتگی وارد حساب کاربری شوید.';
            if (weeklyGoalFillEl) weeklyGoalFillEl.style.width = '0%';
            return;
        }

        try {
            const idToken = await getAuthToken();
            if (!idToken) return;

            const res = await fetch(`${CUSTOM_SERVER_URL}/api/pomodoro-sessions`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            if (!res.ok) throw new Error('پاسخ نامعتبر از سرور');
            const sessions = await res.json();

            const weekStart = startOfWeek();
            const weeklyMinutes = (Array.isArray(sessions) ? sessions : [])
                .filter(s => s.completedAt >= weekStart)
                .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

            const pct = Math.min(100, Math.round((weeklyMinutes / WEEKLY_GOAL_TARGET_MINUTES) * 100));

            if (weeklyGoalCurrentEl) weeklyGoalCurrentEl.innerText = weeklyMinutes.toLocaleString('fa-IR');
            if (weeklyGoalTargetEl) weeklyGoalTargetEl.innerText = WEEKLY_GOAL_TARGET_MINUTES.toLocaleString('fa-IR');
            if (weeklyGoalTextEl) {
                weeklyGoalTextEl.innerHTML = `<span id="weekly-goal-current">${weeklyMinutes.toLocaleString('fa-IR')}</span> از <span id="weekly-goal-target">${WEEKLY_GOAL_TARGET_MINUTES.toLocaleString('fa-IR')}</span> دقیقه مطالعه (پومودورو)`;
            }
            if (weeklyGoalFillEl) weeklyGoalFillEl.style.width = `${pct}%`;

            if (weeklyGoalStreakEl) {
                const streakDays = computeStreakDays(Array.isArray(sessions) ? sessions : []);
                weeklyGoalStreakEl.innerText = streakDays > 0
                    ? `🔥 ${streakDays.toLocaleString('fa-IR')} روز متوالی`
                    : '';
            }
        } catch (err) {
            console.error('Error loading weekly goal widget:', err);
            if (weeklyGoalTextEl) weeklyGoalTextEl.innerText = 'خطا در دریافت پیشرفت هفتگی.';
        }
    }
    loadWeeklyGoalWidget();

    // --- Settings tab: account status, appearance, pomodoro/goal config, privacy & notifications ---
    // Every control here reads from and writes to real chrome.storage state —
    // nothing on this page is a static placeholder.
    // Exposed on window: the tab-switch handler lives in the earlier,
    // separate DOMContentLoaded closure and can't see this scope directly.
    window.renderSettingsView = async function renderSettingsView() {
        const auth = await chrome.storage.local.get(['auth']);
        const loggedInEl = document.getElementById('settings-account-logged-in');
        const loggedOutEl = document.getElementById('settings-account-logged-out');

        if (auth.auth) {
            if (loggedInEl) loggedInEl.classList.remove('hidden');
            if (loggedOutEl) loggedOutEl.classList.add('hidden');
            const avatarEl = document.getElementById('settings-account-avatar');
            const nameEl = document.getElementById('settings-account-name');
            const emailEl = document.getElementById('settings-account-email');
            if (avatarEl) avatarEl.src = auth.auth.photoUrl;
            if (nameEl) nameEl.innerText = auth.auth.displayName;
            if (emailEl) emailEl.innerText = auth.auth.email;
        } else {
            if (loggedInEl) loggedInEl.classList.add('hidden');
            if (loggedOutEl) loggedOutEl.classList.remove('hidden');
        }

        const pomodoroMinutesInput = document.getElementById('settings-pomodoro-minutes');
        const pomodoroSessionsInput = document.getElementById('settings-pomodoro-sessions');
        const weeklyGoalHoursInput = document.getElementById('settings-weekly-goal-hours');
        if (pomodoroMinutesInput) pomodoroMinutesInput.value = POMODORO_WORK_MINUTES;
        if (pomodoroSessionsInput) pomodoroSessionsInput.value = POMODORO_SESSION_TOTAL;
        if (weeklyGoalHoursInput) weeklyGoalHoursInput.value = Math.round(WEEKLY_GOAL_TARGET_MINUTES / 60);

        const prefs = await chrome.storage.local.get(['privacyDefaultShare', 'notificationsEnabled']);
        const privacyToggle = document.getElementById('settings-privacy-toggle');
        const notifToggle = document.getElementById('settings-notifications-toggle');
        if (privacyToggle) privacyToggle.checked = prefs.privacyDefaultShare !== false; // default: on
        if (notifToggle) notifToggle.checked = prefs.notificationsEnabled !== false; // default: on
    };

    const settingsGotoLoginBtn = document.getElementById('settings-goto-login-btn');
    if (settingsGotoLoginBtn) {
        settingsGotoLoginBtn.addEventListener('click', () => {
            const profileNav = document.getElementById('profile-nav-btn');
            if (profileNav) profileNav.click();
        });
    }

    const settingsLogoutBtn = document.getElementById('settings-logout-btn');
    if (settingsLogoutBtn) {
        settingsLogoutBtn.addEventListener('click', async () => {
            if (confirm('آیا مایل به خروج از حساب کاربری خود هستید؟')) {
                await logout();
                window.renderProfileView();
                window.renderSettingsView();
            }
        });
    }

    const settingsSaveGoalsBtn = document.getElementById('settings-save-goals-btn');
    if (settingsSaveGoalsBtn) {
        settingsSaveGoalsBtn.addEventListener('click', async () => {
            const statusEl = document.getElementById('settings-goals-status');
            const minutesInput = document.getElementById('settings-pomodoro-minutes');
            const sessionsInput = document.getElementById('settings-pomodoro-sessions');
            const goalHoursInput = document.getElementById('settings-weekly-goal-hours');

            const workMinutes = Math.min(Math.max(parseInt(minutesInput.value, 10) || 25, 5), 120);
            const sessionTotal = Math.min(Math.max(parseInt(sessionsInput.value, 10) || 4, 1), 12);
            const goalHours = Math.min(Math.max(parseInt(goalHoursInput.value, 10) || 3, 1), 60);

            POMODORO_WORK_MINUTES = workMinutes;
            POMODORO_SESSION_TOTAL = sessionTotal;
            POMODORO_WORK_SECONDS = POMODORO_WORK_MINUTES * 60;
            WEEKLY_GOAL_TARGET_MINUTES = goalHours * 60;

            await chrome.storage.local.set({
                pomodoroSettings: { workMinutes, sessionTotal },
                weeklyGoalMinutes: WEEKLY_GOAL_TARGET_MINUTES
            });

            if (pomodoroSessionTotalEl) pomodoroSessionTotalEl.innerText = POMODORO_SESSION_TOTAL.toLocaleString('fa-IR');
            if (!pomodoroRunning) {
                pomodoroSecondsLeft = POMODORO_WORK_SECONDS - 1;
                renderPomodoroTimer();
            }
            loadWeeklyGoalWidget();

            minutesInput.value = workMinutes;
            sessionsInput.value = sessionTotal;
            goalHoursInput.value = goalHours;

            if (statusEl) {
                statusEl.innerText = 'ذخیره شد ✅';
                setTimeout(() => { statusEl.innerText = ''; }, 2500);
            }
        });
    }

    const settingsPrivacyToggle = document.getElementById('settings-privacy-toggle');
    if (settingsPrivacyToggle) {
        settingsPrivacyToggle.addEventListener('change', () => {
            chrome.storage.local.set({ privacyDefaultShare: settingsPrivacyToggle.checked });
        });
    }

    const settingsNotifToggle = document.getElementById('settings-notifications-toggle');
    if (settingsNotifToggle) {
        settingsNotifToggle.addEventListener('change', () => {
            chrome.storage.local.set({ notificationsEnabled: settingsNotifToggle.checked });
            refreshNotificationBadge();
        });
    }
});
