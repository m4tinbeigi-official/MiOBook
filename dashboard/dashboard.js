// MioBook Dashboard Script - Complete 3-Column New Tab Overrides
// Supports Clock, Reading Goals, Word Bank, Wooden Bookshelf Renderer, Quick Search, Charts, Themes, Backups, and Goodreads CSV Importer

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. Themes & Appearance ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
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

    // Toggle theme button
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', async () => {
            const nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length;
            currentTheme = themes[nextIndex];
            applyTheme(currentTheme);
            await chrome.storage.local.set({ theme: currentTheme });
        });
    }

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
        const themeNames = {
            light: 'روشن',
            sepia: 'کاغذی (سپیا)',
            moss: 'جنگل',
            dark: 'تاریک'
        };
        if (themeToggleBtn) {
            themeToggleBtn.querySelector('span').innerText = `تم فعلی: ${themeNames[theme] || theme}`;
        }
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

    function loadBookshelf() {
        chrome.storage.local.get(['books'], (result) => {
            const books = result.books || [];
            
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

            card.innerHTML = `
                <div class="bc-cover" style="background: ${coverBg};"></div>
                <div class="bc-info">
                    <div class="bc-info-cover" style="background: ${coverBg};"></div>
                    <h3 class="bc-title">${escapeHtml(book.title)}</h3>
                    <p class="bc-author">${escapeHtml(book.author || 'نویسنده نامشخص')}</p>
                    <div class="bc-stars">★★★★★</div>
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

        bookDetailsModal.classList.remove('hidden');
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
                        chrome.storage.local.get(['auth', 'activeReadingBook'], (res) => {
                            if (res.auth) {
                                const isActive = res.activeReadingBook && res.activeReadingBook.id === activeBook.id;
                                if (isActive) {
                                    res.activeReadingBook.currentPage = newPage;
                                    chrome.storage.local.set({ activeReadingBook: res.activeReadingBook });
                                }
                                const updatedStatus = newPage === activeBook.totalPages ? 'read' : 'reading';
                                publishReadingStatus(activeBook.title, activeBook.author, newPage, activeBook.totalPages, updatedStatus, isActive);
                            }
                        });

                        bookDetailsModal.classList.add('hidden');
                        loadBookshelf();
                        loadGoals();
                        renderCharts();
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
                const updated = list.filter(b => b.id !== activeBook.id);
                chrome.storage.local.set({ books: updated }, () => {
                    bookDetailsModal.classList.add('hidden');
                    loadBookshelf();
                    loadGoals();
                    renderCharts();
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
                });
            });
        });
    }


    // --- 9. Unified Bookstore & OpenLibrary Search ---
    const searchInput = document.getElementById('book-search-input');
    const searchBtn = document.getElementById('book-search-btn');
    const searchResultsList = document.getElementById('search-results-list');

    let searchDebounceTimer = null;

    if (searchInput) {
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
                if (searchResultsList) {
                    searchResultsList.innerHTML = '';
                    searchResultsList.classList.add('hidden');
                }
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

                        parsedBooks.forEach(newB => {
                            const duplicate = existingList.find(b => 
                                b.title.toLowerCase() === newB.title.toLowerCase() &&
                                b.author.toLowerCase() === newB.author.toLowerCase()
                            );
                            if (!duplicate) {
                                existingList.push(newB);
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
            if (targetTab === 'settings') return; 

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
                    profile: 'User Profile'
                } : {
                    dashboard: 'داشبورد',
                    library: 'کتابخانه من',
                    explore: 'کاوش جامعه',
                    wishlist: 'لیست علاقه‌مندی‌ها',
                    tools: 'ابزارهای مطالعه',
                    profile: 'پروفایل کاربری'
                };
                pageTitleHeader.innerText = titles[targetTab] || 'میو بوک';
            }

            if (targetTab === 'explore') {
                loadCommunityFeed();
            } else if (targetTab === 'profile') {
                renderProfileView();
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

    async function renderProfileView() {
        const data = await chrome.storage.local.get(['auth']);
        const loggedIn = document.getElementById('profile-logged-in');
        const loggedOut = document.getElementById('profile-logged-out');
        const avatar = document.getElementById('profile-user-avatar');
        const name = document.getElementById('profile-user-name');
        const email = document.getElementById('profile-user-email');
        
        const hAvatarImg = document.querySelector('.profile-avatar img');
        const hAvatarName = document.querySelector('.profile-avatar span');
        
        if (data.auth) {
            if (loggedIn) loggedIn.classList.remove('hidden');
            if (loggedOut) loggedOut.classList.add('hidden');
            
            if (avatar) avatar.src = data.auth.photoUrl;
            if (name) name.innerText = data.auth.displayName;
            if (email) email.innerText = data.auth.email;
            
            if (hAvatarImg) hAvatarImg.src = data.auth.photoUrl;
            if (hAvatarName) hAvatarName.innerText = data.auth.displayName;
        } else {
            if (loggedIn) loggedIn.classList.add('hidden');
            if (loggedOut) loggedOut.classList.remove('hidden');
            
            if (hAvatarImg) hAvatarImg.src = "https://robohash.org/guest?set=set4";
            if (hAvatarName) hAvatarName.innerText = "میهمان 🐾";
        }
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
                    ? `<span style="position: absolute; top: 12px; left: 12px; display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: bold; color: #00d2ff; background: rgba(0, 210, 255, 0.1); padding: 4px 8px; border-radius: 12px; animation: pulse 2s infinite;">
                         <span style="width: 6px; height: 6px; border-radius: 50%; background: #00d2ff;"></span>
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
});

// =====================================================================
// 🐾 NEW DASHBOARD REDESIGN — VISUAL-ONLY MOCK DATA SECTIONS 🐾
// Everything below is static/demo data for the new hero card, friends
// "reading now" row, community list, activity feed, and the left-column
// widgets (profile / pomodoro / Jalali calendar / weekly goal).
// None of this reads or writes chrome.storage — it is purely illustrative
// until real backend/social wiring is added later.
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {

    // --- MOCK DATA (demo only, not persisted) ---
    const MOCK_FRIENDS_READING = [
        { name: 'نیلوفر', emoji: '🐱', book: 'ملت عشق', page: '۱۲۰/۳۰۰', status: 'reading' },
        { name: 'آرش', emoji: '🐈', book: 'کیمیاگر', page: '۸۰/۱۸۰', status: 'reading' },
        { name: 'مهسا', emoji: '🐾', book: 'بوف کور', page: '۵۰/۱۲۰', status: 'resting' },
        { name: 'کیان', emoji: '📚', book: 'صد سال تنهایی', page: '۲۰۰/۴۵۰', status: 'reading' },
        { name: 'ترانه', emoji: '🐈‍⬛', book: 'شازده کوچولو', page: '۶۰/۹۶', status: 'resting' }
    ];

    const MOCK_COMMUNITY_READING = [
        { name: 'رضا احمدی', emoji: '📖', book: 'جنایت و مکافات', page: '۱۸۰', pct: '۴۰٪' },
        { name: 'سمانه کریمی', emoji: '📕', book: 'خشم و هیاهو', page: '۹۰', pct: '۲۵٪' },
        { name: 'بابک نوری', emoji: '📗', book: 'تفکر سریع و کند', page: '۳۰۰', pct: '۶۵٪' },
        { name: 'الناز رستمی', emoji: '📘', book: 'میم', page: '۴۵', pct: '۱۵٪' }
    ];

    const MOCK_FRIENDS_ACTIVITY = [
        { icon: '📖', text: '<strong>نیلوفر</strong> مطالعه‌ی «ملت عشق» را شروع کرد', time: '۲۰ دقیقه پیش' },
        { icon: '🎉', text: '<strong>آرش</strong> کتاب «کیمیاگر» را به پایان رساند', time: '۱ ساعت پیش' },
        { icon: '🍅', text: '<strong>مهسا</strong> یک جلسه پومودورو ۲۵ دقیقه‌ای انجام داد', time: '۳ ساعت پیش' },
        { icon: '🔥', text: '<strong>کیان</strong> به رکورد ۷ روز متوالی مطالعه رسید', time: 'دیروز' },
        { icon: '📚', text: '<strong>ترانه</strong> کتاب «شازده کوچولو» را به کتابخانه‌اش اضافه کرد', time: 'دیروز' }
    ];

    function escapeHtmlLocal(str) {
        const div = document.createElement('div');
        div.innerText = str == null ? '' : String(str);
        return div.innerHTML;
    }

    // --- Render: friends reading now (horizontal row) ---
    const friendsNowRow = document.getElementById('friends-now-row');
    if (friendsNowRow) {
        friendsNowRow.innerHTML = MOCK_FRIENDS_READING.map(f => `
            <div class="friend-now-card">
                <div class="friend-now-avatar-wrap">
                    <div class="friend-now-avatar">${f.emoji}</div>
                    <span class="friend-now-status-dot ${f.status}"></span>
                </div>
                <div class="friend-now-name">${escapeHtmlLocal(f.name)}</div>
                <div class="friend-now-book">${escapeHtmlLocal(f.book)}</div>
                <div class="friend-now-pages">صفحه ${f.page}</div>
            </div>
        `).join('');
    }

    // --- Render: community reading now (list) ---
    const communityList = document.getElementById('community-reading-list');
    if (communityList) {
        communityList.innerHTML = MOCK_COMMUNITY_READING.map(u => `
            <div class="community-reading-row">
                <div class="cr-avatar">${u.emoji}</div>
                <div class="cr-info">
                    <div class="cr-name">${escapeHtmlLocal(u.name)}</div>
                    <div class="cr-book">${escapeHtmlLocal(u.book)} · صفحه ${u.page}</div>
                </div>
                <div class="cr-pct">${u.pct}</div>
            </div>
        `).join('');
    }

    // --- Render: friends activity feed ---
    const activityFeed = document.getElementById('friends-activity-feed');
    if (activityFeed) {
        activityFeed.innerHTML = MOCK_FRIENDS_ACTIVITY.map(a => `
            <div class="activity-item">
                <span class="activity-icon">${a.icon}</span>
                <span class="activity-text">${a.text}<span class="activity-time">${a.time}</span></span>
            </div>
        `).join('');
    }

    // --- Quick note / composer (mock, local only — no persistence yet) ---
    const quickNotePostBtn = document.getElementById('quick-note-post-btn');
    if (quickNotePostBtn) {
        quickNotePostBtn.addEventListener('click', () => {
            const input = document.getElementById('quick-note-input');
            if (input && input.value.trim()) {
                alert('یادداشت شما ذخیره شد! (این بخش هنوز نمایشی است و به سرور متصل نیست)');
                input.value = '';
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

    // --- Notification bell / light-dark mode icon toggle (visual-only, mock) ---
    const notifBellBtn = document.getElementById('notif-bell-btn');
    if (notifBellBtn) {
        notifBellBtn.addEventListener('click', () => {
            const badge = document.getElementById('notif-badge');
            if (badge) badge.classList.toggle('hidden');
        });
    }
    const modeToggleBtn = document.getElementById('mode-toggle-btn');
    if (modeToggleBtn) {
        modeToggleBtn.addEventListener('click', () => {
            const themeBtn = document.getElementById('theme-toggle-btn');
            if (themeBtn) themeBtn.click();
        });
    }

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
            html += `<span class="calendar-day${isToday ? ' today' : ''}">${toPersianDigitsLocal(d)}</span>`;
        }
        grid.innerHTML = html;
    }

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

    // --- Pomodoro widget (real countdown via setInterval, local only — no persistence) ---
    const POMODORO_WORK_SECONDS = 25 * 60;
    let pomodoroSecondsLeft = POMODORO_WORK_SECONDS - 1; // starts at 24:59 to match the reference design
    let pomodoroRunning = true;
    let pomodoroInterval = null;
    let pomodoroSessionCurrent = 1;
    const POMODORO_SESSION_TOTAL = 4;

    const pomodoroTimerEl = document.getElementById('pomodoro-timer');
    const pomodoroToggleBtn = document.getElementById('pomodoro-toggle-btn');
    const pomodoroResetBtn = document.getElementById('pomodoro-reset-btn');
    const pomodoroStatusEl = document.getElementById('pomodoro-status');
    const pomodoroSessionCurrentEl = document.getElementById('pomodoro-session-current');

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
            if (pomodoroStatusEl) pomodoroStatusEl.innerText = 'پایان جلسه! کمی استراحت کن 🐾';
            if (pomodoroToggleBtn) pomodoroToggleBtn.innerText = 'شروع مجدد';
            return;
        }
        pomodoroSecondsLeft--;
        renderPomodoroTimer();
    }

    function startPomodoro() {
        pomodoroRunning = true;
        if (pomodoroToggleBtn) pomodoroToggleBtn.innerText = 'توقف';
        if (pomodoroStatusEl) pomodoroStatusEl.innerText = 'در حال مطالعه';
        pomodoroInterval = setInterval(tickPomodoro, 1000);
    }

    function pausePomodoro() {
        pomodoroRunning = false;
        clearInterval(pomodoroInterval);
        if (pomodoroToggleBtn) pomodoroToggleBtn.innerText = 'ادامه';
        if (pomodoroStatusEl) pomodoroStatusEl.innerText = 'متوقف شده';
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
});
