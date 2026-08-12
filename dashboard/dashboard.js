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

            // Sort by added date descending
            libraryBooks.sort((a, b) => b.addedAt - a.addedAt);

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

    function renderLibraryGrid(booksList) {
        if (!bookshelfContainer) return;
        bookshelfContainer.innerHTML = '';

        booksList.forEach(book => {
            const card = document.createElement('div');
            card.className = 'book-card clickable';
            
            const spineStyle = getSpineColor(book.title);
            const coverBg = book.coverUrl ? `url(${book.coverUrl})` : spineStyle.bg;
            
            card.innerHTML = `
                <div class="bc-cover" style="background: ${coverBg};"></div>
                <h3 class="bc-title">${escapeHtml(book.title)}</h3>
                <p class="bc-author">${escapeHtml(book.author || 'نویسنده نامشخص')}</p>
                <div class="bc-stars">
                    ★★★★★
                </div>
            `;
            
            card.addEventListener('click', () => {
                openBookDetailsModal(book);
            });
            
            bookshelfContainer.appendChild(card);
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
        const results = document.getElementById('search-results-list');
        if (results) {
            results.innerHTML = '';
            results.classList.add('hidden');
        }
        const searchInput = document.getElementById('book-search-input');
        if (searchInput) searchInput.value = '';
    }

    if (manualForm) {
        manualForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const title = document.getElementById('book-title').value.trim();
            const author = document.getElementById('book-author').value.trim();
            const totalPages = parseInt(document.getElementById('book-pages').value) || 0;
            const status = document.getElementById('book-status').value;
            const coverUrl = manualForm.dataset.coverUrl || '';

            const newBook = {
                id: 'book-' + Date.now(),
                title,
                author,
                totalPages,
                currentPage: status === 'read' ? totalPages : 0,
                status,
                coverUrl,
                addedAt: Date.now()
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


    // --- 9. OpenLibrary Quick Search (Right Sidebar) ---
    const searchInput = document.getElementById('book-search-input');
    const searchBtn = document.getElementById('book-search-btn');
    const searchResultsList = document.getElementById('search-results-list');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', async () => {
            const query = searchInput.value.trim();
            if (!query) return;

            searchBtn.innerText = 'جستجو...';
            searchBtn.disabled = true;

            try {
                const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`);
                const data = await response.json();
                
                searchBtn.innerText = 'جستجو';
                searchBtn.disabled = false;

                if (data.docs && data.docs.length > 0) {
                    renderSearchResults(data.docs);
                } else {
                    searchResultsList.innerHTML = '<div style="padding: 10px; text-align: center; font-size:11px;">کتابی پیدا نشد. اطلاعات را دستی وارد کنید.</div>';
                    searchResultsList.classList.remove('hidden');
                }
            } catch (err) {
                console.error("OpenLibrary search failed:", err);
                searchBtn.innerText = 'جستجو';
                searchBtn.disabled = false;
                searchResultsList.innerHTML = '<div style="padding: 10px; text-align: center; color: #e63946; font-size:11px;">خطا در اتصال به اینترنت.</div>';
                searchResultsList.classList.remove('hidden');
            }
        });
    }

    function renderSearchResults(docs) {
        if (!searchResultsList) return;
        searchResultsList.innerHTML = '';
        searchResultsList.classList.remove('hidden');

        docs.forEach(doc => {
            const item = document.createElement('div');
            item.className = 'search-result-item clickable';
            
            const author = doc.author_name ? doc.author_name[0] : 'نامشخص';
            const pages = doc.number_of_pages_median || 0;
            const coverId = doc.cover_i;
            const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : '';

            item.innerHTML = `
                <div class="search-result-info">
                    <span class="search-result-title">${escapeHtml(doc.title)}</span>
                    <span class="search-result-author">${escapeHtml(author)} (${pages > 0 ? pages + ' صفحه' : 'بدون صفحه'})</span>
                </div>
                <button class="btn-secondary clickable select-search-btn" style="padding: 4px 8px; font-size: 10px;">انتخاب</button>
            `;

            item.addEventListener('click', () => {
                document.getElementById('book-title').value = doc.title;
                document.getElementById('book-author').value = author;
                document.getElementById('book-pages').value = pages;
                
                if (manualForm) manualForm.dataset.coverUrl = coverUrl;
                searchResultsList.classList.add('hidden');
                searchResultsList.innerHTML = '';

                // Open manual modal for user confirmation/completion
                if (addBookModal) addBookModal.classList.remove('hidden');
            });

            searchResultsList.appendChild(item);
        });
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

    // --- 13. Initialization ---
    loadBookshelf();
    loadGoals();
    loadWordBank();
    renderCharts();
});
