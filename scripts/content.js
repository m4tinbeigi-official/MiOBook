// MioBook Content Script - Complete Highlighter, Reader Mode & Page Scraper

(function () {
    if (window.mioBookHighlighterLoaded) return;
    window.mioBookHighlighterLoaded = true;

    let activeSelection = null;
    let floatingMenu = null;
    let activeColor = 'yellow';
    let activeTooltip = null;

    // Initialize
    init();

    function init() {
        restorePageHighlights();

        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('selectionchange', handleSelectionChange);

        // Listen for messages from background/sidepanel
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === "trigger-highlight") {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                    highlightSelection(activeColor);
                }
                sendResponse({ success: true });
            } else if (message.action === "get-wpm-stats") {
                const stats = scrapePageText();
                sendResponse({ wordCount: stats.wordCount });
            } else if (message.action === "trigger-reader-mode") {
                toggleReaderMode();
                sendResponse({ success: true });
            } else if (message.action === "get-page-content") {
                const scraped = scrapePageText();
                sendResponse({ title: document.title, author: scraped.author, paragraphs: scraped.paragraphs });
            } else if (message.action === "update-tooltip") {
                // Find all highlights with this ID and update note
                const spans = document.querySelectorAll(`[data-highlight-id="${message.highlightId}"]`);
                spans.forEach(span => {
                    // Update hover handler dynamically
                    span.addEventListener('mouseenter', () => {
                        if (message.note) {
                            showTooltip(span, message.note);
                        }
                    });
                });
            }
            return true;
        });

        chrome.storage.local.get(['activeColor'], (result) => {
            if (result.activeColor) {
                activeColor = result.activeColor;
            }
        });

        initPersianBookstoreIntegration();
    }

    // --- Page Parser & DOM Scraper ---
    function scrapePageText() {
        const pageTitle = document.title;
        let mainContainer = document.body;

        // Common article/text content selectors
        const contentSelectors = [
            'article', 'main', '[role="main"]', '.post', '.entry-content', 
            '.story', '.article-body', '#content', '#main-content', '.post-content'
        ];

        for (const selector of contentSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                mainContainer = el;
                break;
            }
        }

        // Get text and filter paragraphs
        const pElements = mainContainer.querySelectorAll('p, h1, h2, h3, h4');
        const paragraphs = [];
        let totalWords = 0;

        pElements.forEach(el => {
            const text = el.innerText.trim();
            // Filter short header/footer menus (must have some words)
            if (text.split(/\s+/).length > 3) {
                paragraphs.push({
                    tag: el.tagName.toLowerCase(),
                    text: text
                });
            }
        });

        // If no paragraphs found (e.g. news sites with different tags), fallback to body text
        const text = mainContainer.innerText || "";
        const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;

        // Try to guess author
        let author = 'نامشخص';
        const authorSelectors = ['.author', '[rel="author"]', '.byline', '.writer', '.post-author'];
        for (const sel of authorSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                author = el.innerText.trim();
                break;
            }
        }

        return {
            title: pageTitle,
            author: author,
            paragraphs: paragraphs.length > 0 ? paragraphs : [{ tag: 'p', text: text }],
            wordCount: wordCount
        };
    }

    // --- Reader Mode Overlay ---
    let readerOverlay = null;

    function toggleReaderMode() {
        if (readerOverlay) {
            readerOverlay.remove();
            readerOverlay = null;
            document.body.style.overflow = '';
            return;
        }

        const data = scrapePageText();
        
        readerOverlay = document.createElement('div');
        readerOverlay.id = 'miobook-reader-overlay';
        
        // Load active theme
        chrome.storage.local.get(['theme'], (result) => {
            const theme = result.theme || 'light';
            readerOverlay.setAttribute('data-theme', theme);
        });

        // Set style properties for Reader Mode Overlay
        const overlayStyles = `
            #miobook-reader-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: var(--bg-primary, #fcfbfa);
                color: var(--text-primary, #1e1e1c);
                z-index: 99999999;
                overflow-y: auto;
                direction: rtl;
                text-align: right;
                font-family: 'Vazirmatn', sans-serif;
                transition: background-color 0.25s ease, color 0.25s ease;
            }
            .mio-reader-header {
                max-width: 700px;
                margin: 0 auto;
                padding: 24px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.08));
                position: sticky;
                top: 0;
                background-color: var(--bg-primary, #fcfbfa);
                z-index: 10;
            }
            .mio-reader-close {
                background: transparent;
                border: none;
                font-size: 28px;
                cursor: pointer;
                color: var(--text-secondary);
            }
            .mio-reader-body {
                max-width: 700px;
                margin: 0 auto;
                padding: 40px 16px 100px 16px;
            }
            .mio-reader-title {
                font-size: 28px;
                font-weight: 700;
                line-height: 1.4;
                margin-bottom: 12px;
                color: var(--text-primary);
            }
            .mio-reader-author {
                font-size: 13px;
                color: var(--text-muted);
                margin-bottom: 32px;
            }
            .mio-reader-p {
                font-size: 18px;
                line-height: 1.8;
                margin-bottom: 24px;
                color: var(--text-primary);
                text-indent: 12px;
            }
            .mio-reader-h {
                font-size: 20px;
                font-weight: bold;
                line-height: 1.5;
                margin-top: 36px;
                margin-bottom: 16px;
                color: var(--text-primary);
            }
            .mio-reader-themes {
                display: flex;
                gap: 8px;
            }
            .mio-reader-theme-btn {
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 11px;
                font-family: inherit;
                color: var(--text-primary);
                cursor: pointer;
            }
        `;

        const styleSheet = document.createElement("style");
        styleSheet.innerText = overlayStyles;
        document.head.appendChild(styleSheet);

        // Build Paragraphs HTML
        let paragraphsHtml = '';
        data.paragraphs.forEach(p => {
            if (p.tag.startsWith('h')) {
                paragraphsHtml += `<h3 class="mio-reader-h">${p.text}</h3>`;
            } else {
                paragraphsHtml += `<p class="mio-reader-p">${p.text}</p>`;
            }
        });

        readerOverlay.innerHTML = `
            <div class="mio-reader-header">
                <div class="mio-reader-themes">
                    <button class="mio-reader-theme-btn" data-theme="light">روشن</button>
                    <button class="mio-reader-theme-btn" data-theme="sepia">سپیا</button>
                    <button class="mio-reader-theme-btn" data-theme="moss">جنگل</button>
                    <button class="mio-reader-theme-btn" data-theme="dark">تاریک</button>
                </div>
                <button class="mio-reader-close" id="mio-reader-close-btn">&times;</button>
            </div>
            <div class="mio-reader-body">
                <h1 class="mio-reader-title">${data.title}</h1>
                <div class="mio-reader-author">نویسنده: ${data.author} | سرعت تخمینی خواندن: ${Math.ceil(data.wordCount / 200)} دقیقه</div>
                <div class="mio-reader-text">${paragraphsHtml}</div>
            </div>
        `;

        // Bind Theme switches inside overlay
        const btns = readerOverlay.querySelectorAll('.mio-reader-theme-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const selTheme = btn.getAttribute('data-theme');
                readerOverlay.setAttribute('data-theme', selTheme);
                // Also update local storage so it syncs with extension
                chrome.storage.local.set({ theme: selTheme });
            });
        });

        // Close btn action
        readerOverlay.querySelector('#mio-reader-close-btn').addEventListener('click', () => {
            readerOverlay.remove();
            readerOverlay = null;
            document.body.style.overflow = '';
        });

        document.body.appendChild(readerOverlay);
        document.body.style.overflow = 'hidden'; // lock page scroll
    }

    // --- Highlighting Engine (Re-added for continuity) ---

    function generateId() {
        return 'mio-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    function getCssSelector(el) {
        if (!(el instanceof Element)) return '';
        const path = [];
        while (el && el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector += '#' + el.id;
                path.unshift(selector);
                break;
            } else {
                let sibling = el;
                let nth = 1;
                while (sibling = sibling.previousElementSibling) {
                    if (sibling.nodeName.toLowerCase() === el.nodeName.toLowerCase()) {
                        nth++;
                    }
                }
                if (nth > 1) {
                    selector += `:nth-of-type(${nth})`;
                }
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(' > ');
    }

    function getTextNodesInRange(range) {
        const textNodes = [];
        const nodeWalker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    if (range.intersectsNode(node)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );

        let currentNode = nodeWalker.currentNode;
        if (currentNode.nodeType === Node.TEXT_NODE && range.intersectsNode(currentNode)) {
            textNodes.push(currentNode);
        }
        while (currentNode = nodeWalker.nextNode()) {
            textNodes.push(currentNode);
        }
        return textNodes;
    }

    function highlightRange(range, highlightId, color) {
        const textNodes = getTextNodesInRange(range);
        const spans = [];

        textNodes.forEach((node) => {
            let startOffset = 0;
            let endOffset = node.length;

            if (node === range.startContainer) {
                startOffset = range.startOffset;
            }
            if (node === range.endContainer) {
                endOffset = range.endOffset;
            }

            const val = node.nodeValue.substring(startOffset, endOffset);
            if (!val.trim()) return;

            let targetNode = node;
            if (node === range.endContainer && endOffset < node.length) {
                targetNode.splitText(endOffset);
            }
            if (node === range.startContainer && startOffset > 0) {
                targetNode = node.splitText(startOffset);
            }

            const span = document.createElement('span');
            span.className = `miobook-highlight miobook-highlight-${color}`;
            span.dataset.highlightId = highlightId;
            
            targetNode.parentNode.insertBefore(span, targetNode);
            span.appendChild(targetNode);
            spans.push(span);
        });

        return spans;
    }

    async function highlightSelection(color) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = selection.toString();
        if (!selectedText.trim()) return;

        const highlightId = generateId();
        const spans = highlightRange(range, highlightId, color);
        if (spans.length === 0) return;

        const startSelector = getCssSelector(range.startContainer.parentNode);
        const endSelector = getCssSelector(range.endContainer.parentNode);
        
        const highlightData = {
            id: highlightId,
            text: selectedText,
            url: window.location.href,
            pageTitle: document.title || window.location.hostname,
            color: color,
            note: '',
            selector: {
                startSelector,
                startOffset: range.startOffset,
                endSelector,
                endOffset: range.endOffset
            },
            timestamp: Date.now()
        };

        chrome.storage.local.get(['highlights'], (result) => {
            const list = result.highlights || [];
            list.push(highlightData);
            chrome.storage.local.set({ highlights: list }, () => {
                chrome.runtime.sendMessage({ action: "highlights-updated" });
            });
        });

        bindSpansEvents(spans, highlightData);
        selection.removeAllRanges();
        removeFloatingMenu();
    }

    function bindSpansEvents(spans, highlightData) {
        spans.forEach(span => {
            span.addEventListener('mouseenter', () => {
                // Fetch latest data (to see if notes changed)
                chrome.storage.local.get(['highlights'], (result) => {
                    const list = result.highlights || [];
                    const latest = list.find(h => h.id === highlightData.id);
                    if (latest && latest.note) {
                        showTooltip(span, latest.note);
                    }
                });
            });

            span.addEventListener('mouseleave', () => {
                removeTooltip();
            });

            span.addEventListener('click', (e) => {
                e.stopPropagation();
                chrome.runtime.sendMessage({ 
                    action: "focus-highlight-note", 
                    highlightId: highlightData.id 
                });
            });
        });
    }

    function restorePageHighlights() {
        chrome.storage.local.get(['highlights'], (result) => {
            const list = result.highlights || [];
            const pageHighlights = list.filter(h => h.url === window.location.href);

            pageHighlights.forEach(h => {
                try {
                    const range = document.createRange();
                    const startParent = document.querySelector(h.selector.startSelector);
                    const endParent = document.querySelector(h.selector.endSelector);

                    if (!startParent || !endParent) return;

                    let startNode = null;
                    let endNode = null;
                    
                    startParent.childNodes.forEach(child => {
                        if (child.nodeType === Node.TEXT_NODE) startNode = child;
                    });
                    endParent.childNodes.forEach(child => {
                        if (child.nodeType === Node.TEXT_NODE) endNode = child;
                    });

                    if (!startNode) startNode = startParent.firstChild;
                    if (!endNode) endNode = endParent.firstChild;

                    if (startNode && endNode) {
                        range.setStart(startNode, Math.min(h.selector.startOffset, startNode.length || 0));
                        range.setEnd(endNode, Math.min(h.selector.endOffset, endNode.length || 0));
                        const spans = highlightRange(range, h.id, h.color);
                        bindSpansEvents(spans, h);
                    }
                } catch (e) {
                    console.log("Failed to restore highlight", e);
                }
            });
        });
    }

    // --- Floating Menu UI ---
    function handleMouseUp(e) {
        if (floatingMenu && floatingMenu.contains(e.target)) return;
        if (readerOverlay && readerOverlay.contains(e.target)) return;

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
            removeFloatingMenu();
            return;
        }

        activeSelection = selection;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showFloatingMenu(rect);
    }

    function handleSelectionChange() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
            setTimeout(() => {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed) {
                    removeFloatingMenu();
                }
            }, 150);
        }
    }

    function showFloatingMenu(rect) {
        removeFloatingMenu();

        floatingMenu = document.createElement('div');
        floatingMenu.className = 'miobook-floating-menu';
        
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        floatingMenu.style.left = `${rect.left + rect.width / 2 + scrollX - 80}px`;
        floatingMenu.style.top = `${rect.top + scrollY - 45}px`;

        const colors = ['yellow', 'green', 'blue', 'pink'];
        colors.forEach(c => {
            const btn = document.createElement('button');
            btn.className = `miobook-color-btn ${c} ${c === activeColor ? 'active' : ''}`;
            btn.dataset.color = c;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                activeColor = c;
                chrome.storage.local.set({ activeColor: c });
                highlightSelection(c);
            });
            floatingMenu.appendChild(btn);
        });

        const divider = document.createElement('div');
        divider.className = 'miobook-divider';
        floatingMenu.appendChild(divider);

        const highlightBtn = document.createElement('button');
        highlightBtn.className = 'miobook-action-btn';
        highlightBtn.title = 'هایلایت سریع';
        highlightBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 3-1.912 5.886H3.886L8.743 12.5 6.83 18.386 12 14.773l5.17 3.613-1.913-5.886 4.857-3.614h-6.202L12 3Z"/>
            </svg>
        `;
        highlightBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            highlightSelection(activeColor);
        });
        floatingMenu.appendChild(highlightBtn);

        const wordBankBtn = document.createElement('button');
        wordBankBtn.className = 'miobook-action-btn';
        wordBankBtn.title = 'افزودن به جعبه لغات';
        wordBankBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 7V4h16v3"/>
                <path d="M9 20h6"/>
                <path d="M12 4v16"/>
            </svg>
        `;
        wordBankBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = activeSelection ? activeSelection.toString().trim() : '';
            if (text) {
                chrome.storage.local.get(['wordBank'], (result) => {
                    const words = result.wordBank || [];
                    const duplicate = words.find(w => w.term.toLowerCase() === text.toLowerCase());
                    if (!duplicate) {
                        words.push({ id: 'w-' + Date.now(), term: text, meaning: '', addedAt: Date.now() });
                        chrome.storage.local.set({ wordBank: words }, () => {
                            showTransientToast('کلمه به جعبه لغات اضافه شد.');
                        });
                    } else {
                        showTransientToast('این کلمه از قبل در جعبه لغات وجود دارد.');
                    }
                });
            }
            removeFloatingMenu();
        });
        floatingMenu.appendChild(wordBankBtn);

        document.body.appendChild(floatingMenu);
    }

    function removeFloatingMenu() {
        if (floatingMenu) {
            floatingMenu.remove();
            floatingMenu = null;
        }
    }

    function showTooltip(targetSpan, noteText) {
        removeTooltip();

        activeTooltip = document.createElement('div');
        activeTooltip.className = 'miobook-highlight-tooltip';
        activeTooltip.innerText = noteText;

        const rect = targetSpan.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        activeTooltip.style.left = `${rect.left + rect.width / 2 + scrollX - 75}px`;
        activeTooltip.style.top = `${rect.bottom + scrollY + 8}px`;

        document.body.appendChild(activeTooltip);
    }

    function removeTooltip() {
        if (activeTooltip) {
            activeTooltip.remove();
            activeTooltip = null;
        }
    }

    function showTransientToast(message) {
        const toast = document.createElement('div');
        toast.className = 'miobook-toast';
        toast.innerText = message;
        
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.backgroundColor = 'rgba(30, 30, 32, 0.95)';
        toast.style.color = '#ffffff';
        toast.style.padding = '10px 18px';
        toast.style.borderRadius = '8px';
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
        toast.style.fontFamily = "'Vazirmatn', sans-serif";
        toast.style.fontSize = '13px';
        toast.style.zIndex = '2147483647';
        toast.style.direction = 'rtl';
        toast.style.border = '1px solid rgba(255,255,255,0.1)';
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.transform = 'translateY(10px)';
        toast.style.opacity = '0';
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        }, 10);
        
        setTimeout(() => {
            toast.style.transform = 'translateY(10px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Taaghche & Fidibo Integration ---
    function initPersianBookstoreIntegration() {
        const hostname = window.location.hostname;
        const isTaaghche = hostname.includes('taaghche.com');
        const isFidibo = hostname.includes('fidibo.com');

        if (!isTaaghche && !isFidibo) return;

        const path = window.location.pathname;

        // 1. Details Page
        const isTaaghcheDetails = isTaaghche && /\/book\/\d+/.test(path);
        const isFidiboDetails = isFidibo && /\/(?:book|books)\/\d+/.test(path);

        if (isTaaghcheDetails || isFidiboDetails) {
            setupFloatingImportButton(isTaaghche ? 'taaghche' : 'fidibo');
            return;
        }

        // 2. Library/Cabinet/Profile Pages
        const isLibraryPage = path.includes('/profile') || 
                              path.includes('/cabinet') || 
                              path.includes('/library') || 
                              path.includes('/my-books') || 
                              path.includes('/shelf');

        if (isLibraryPage) {
            setupLibraryBanner(isTaaghche ? 'taaghche' : 'fidibo');
        } else {
            // Also monitor page dynamically in case of single-page-app navigation
            let lastPath = path;
            setInterval(() => {
                const currentPath = window.location.pathname;
                if (currentPath !== lastPath) {
                    lastPath = currentPath;
                    removeFloatingImportButton();
                    removeLibraryBanner();
                    
                    const isNowDetails = (isTaaghche && /\/book\/\d+/.test(currentPath)) || 
                                         (isFidibo && /\/(?:book|books)\/\d+/.test(currentPath));
                    const isNowLibrary = currentPath.includes('/profile') || 
                                         currentPath.includes('/cabinet') || 
                                         currentPath.includes('/library') || 
                                         currentPath.includes('/my-books') || 
                                         currentPath.includes('/shelf');
                    
                    if (isNowDetails) {
                        setupFloatingImportButton(isTaaghche ? 'taaghche' : 'fidibo');
                    } else if (isNowLibrary) {
                        setupLibraryBanner(isTaaghche ? 'taaghche' : 'fidibo');
                    }
                }
            }, 2000);
        }
    }

    let floatingImportBtn = null;
    let optionsPopup = null;
    let libraryBanner = null;

    function removeFloatingImportButton() {
        if (floatingImportBtn) {
            floatingImportBtn.remove();
            floatingImportBtn = null;
        }
        if (optionsPopup) {
            optionsPopup.remove();
            optionsPopup = null;
        }
    }

    function removeLibraryBanner() {
        if (libraryBanner) {
            libraryBanner.remove();
            libraryBanner = null;
        }
    }

    function extractBookDetails(source) {
        // Parse ID from URL
        const match = window.location.pathname.match(/\/(?:book|books)\/(\d+)/);
        const bookId = match ? match[1] : Date.now().toString();

        let title = document.querySelector('h1')?.innerText.trim() || 
                    document.querySelector('meta[property="og:title"]')?.content.trim() || 
                    document.title;
        
        // Clean Title
        title = title.replace(/\s*\|\s*طاقچه\s*$/, '')
                     .replace(/\s*\|\s*فیدیبو\s*$/, '')
                     .replace(/^دانلود\s+و\s+خرید\s+کتاب\s+/, '')
                     .replace(/^کتاب\s+/, '')
                     .trim();

        // Extract Author
        let author = '';
        const authorMeta = document.querySelector('meta[name="author"]') || 
                           document.querySelector('meta[property="book:author"]');
        if (authorMeta && authorMeta.content) {
            author = authorMeta.content;
        }
        if (!author) {
            const authorLinks = document.querySelectorAll('a[href*="/author/"], a[href*="/director/"], .author-link, [itemprop="author"]');
            if (authorLinks.length > 0) {
                author = authorLinks[0].innerText.trim();
            }
        }
        if (!author) {
            const elements = document.querySelectorAll('span, div, p, td');
            for (const el of elements) {
                const txt = el.innerText.trim();
                if (txt.includes('نویسنده') && txt.includes(':')) {
                    author = txt.split(':')[1].trim();
                    break;
                }
            }
        }
        author = author || 'نویسنده نامشخص';

        // Extract Page Count
        let totalPages = 0;
        const text = document.body.innerText;
        const persianNumbers = {
            '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
            '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
        };
        const toEnglishNum = str => str.replace(/[۰-۹]/g, w => persianNumbers[w]);
        
        const regexes = [
            /تعداد\s+صفحات\s*[:：]?\s*([0-9۰-۹]+)/i,
            /([0-9۰-۹]+)\s+صفحه/i,
            /صفحه\s*[:：]?\s*([0-9۰-۹]+)/i
        ];
        for (const regex of regexes) {
            const m = text.match(regex);
            if (m) {
                const num = parseInt(toEnglishNum(m[1]));
                if (num > 0 && num < 10000) {
                    totalPages = num;
                    break;
                }
            }
        }

        if (totalPages === 0) {
            const cells = document.querySelectorAll('td, li, span, div');
            for (const cell of cells) {
                const cellText = cell.innerText.trim();
                if (cellText.includes('تعداد صفحات') || cellText.includes('تعداد صفحه')) {
                    const numMatch = cellText.match(/([0-9۰-۹]+)/);
                    if (numMatch) {
                        const num = parseInt(toEnglishNum(numMatch[1]));
                        if (num > 0) { totalPages = num; break; }
                    }
                    if (cell.nextElementSibling) {
                        const siblingText = cell.nextElementSibling.innerText.trim();
                        const siblingNumMatch = siblingText.match(/([0-9۰-۹]+)/);
                        if (siblingNumMatch) {
                            const num = parseInt(toEnglishNum(siblingNumMatch[1]));
                            if (num > 0) { totalPages = num; break; }
                        }
                    }
                }
            }
        }

        // Cover URL
        let coverUrl = document.querySelector('meta[property="og:image"]')?.content || '';
        if (!coverUrl) {
            const img = document.querySelector('.book-cover img, [itemprop="image"], img[src*="/images/"], img[src*="/books/"]');
            if (img) coverUrl = img.src;
        }

        return {
            id: `book-${source}-${bookId}`,
            title,
            author,
            totalPages: totalPages || 200, // default if not found
            coverUrl
        };
    }

    function setupFloatingImportButton(source) {
        removeFloatingImportButton();

        const book = extractBookDetails(source);

        chrome.storage.local.get(['books'], (result) => {
            const books = result.books || [];
            const existingBook = books.find(b => b.id === book.id);

            floatingImportBtn = document.createElement('button');
            floatingImportBtn.className = 'miobook-floating-btn';
            
            const btnText = existingBook ? 'بروزرسانی در میو بوک ✏️' : 'افزودن به میو بوک ➕';
            floatingImportBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                    <path d="M6 6h10M6 10h10"/>
                </svg>
                <span>${btnText}</span>
            `;

            floatingImportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleOptionsPopup(book, existingBook);
            });

            document.body.appendChild(floatingImportBtn);
        });
    }

    function toggleOptionsPopup(book, existingBook) {
        if (optionsPopup) {
            optionsPopup.remove();
            optionsPopup = null;
            return;
        }

        optionsPopup = document.createElement('div');
        optionsPopup.className = 'miobook-floating-popup';
        
        optionsPopup.innerHTML = `
            <div class="miobook-popup-header">انتخاب وضعیت مطالعه در میو بوک</div>
            <button class="miobook-popup-item ${existingBook?.status === 'toRead' ? 'active' : ''}" data-status="toRead">
                <span>می‌خواهم بخوانم</span>
                <span>📌</span>
            </button>
            <button class="miobook-popup-item ${existingBook?.status === 'reading' ? 'active' : ''}" data-status="reading">
                <span>در حال مطالعه</span>
                <span>📖</span>
            </button>
            <button class="miobook-popup-item ${existingBook?.status === 'read' ? 'active' : ''}" data-status="read">
                <span>خوانده شده</span>
                <span>✅</span>
            </button>
        `;

        const items = optionsPopup.querySelectorAll('.miobook-popup-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const status = item.getAttribute('data-status');
                saveBookToMioBook(book, status);
                optionsPopup.remove();
                optionsPopup = null;
            });
        });

        // Close on clicking outside
        const closeHandler = () => {
            if (optionsPopup) {
                optionsPopup.remove();
                optionsPopup = null;
            }
            document.removeEventListener('click', closeHandler);
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);

        document.body.appendChild(optionsPopup);
    }

    function saveBookToMioBook(bookData, status) {
        chrome.storage.local.get(['books'], (result) => {
            const list = result.books || [];
            const idx = list.findIndex(b => b.id === bookData.id);

            const updatedBook = {
                id: bookData.id,
                title: bookData.title,
                author: bookData.author,
                totalPages: bookData.totalPages,
                currentPage: status === 'read' ? bookData.totalPages : (idx !== -1 ? list[idx].currentPage : 0),
                status,
                coverUrl: bookData.coverUrl,
                addedAt: idx !== -1 ? list[idx].addedAt : Date.now()
            };

            if (idx !== -1) {
                list[idx] = updatedBook;
            } else {
                list.push(updatedBook);
            }

            chrome.storage.local.set({ books: list }, () => {
                showTransientToast('کتاب با موفقیت در میو بوک ذخیره شد!');
                // Update floating button text
                if (floatingImportBtn) {
                    floatingImportBtn.querySelector('span').innerText = 'بروزرسانی در میو بوک ✏️';
                }
            });
        });
    }

    function setupLibraryBanner(source) {
        removeLibraryBanner();

        // Scan page for books after a short delay to let dynamic page load
        setTimeout(() => {
            const detectedBooks = scanLibraryBooks(source);
            if (detectedBooks.length === 0) return;

            libraryBanner = document.createElement('div');
            libraryBanner.className = 'miobook-library-banner';
            
            libraryBanner.innerHTML = `
                <div class="miobook-banner-info">
                    <div class="miobook-banner-logo">📚</div>
                    <div>
                        <div class="miobook-banner-title">انتقال کتابخانه به میو بوک</div>
                        <div class="miobook-banner-desc">تعداد ${detectedBooks.length.toLocaleString('fa-IR')} کتاب در این صفحه شناسایی شد. می‌توانید آن‌ها را به کتابخانه میو بوک خود منتقل کنید.</div>
                    </div>
                </div>
                <div class="miobook-banner-actions">
                    <button class="miobook-banner-btn" id="miobook-banner-import-btn">انتقال همه</button>
                    <button class="miobook-banner-close" id="miobook-banner-close-btn">&times;</button>
                </div>
            `;

            libraryBanner.querySelector('#miobook-banner-import-btn').addEventListener('click', () => {
                importLibraryBooks(detectedBooks);
            });

            libraryBanner.querySelector('#miobook-banner-close-btn').addEventListener('click', () => {
                removeLibraryBanner();
            });

            // Insert at the top of the body
            document.body.insertBefore(libraryBanner, document.body.firstChild);
        }, 3000);
    }

    function scanLibraryBooks(source) {
        const detected = [];
        const seenIds = new Set();
        
        // Find anchor links to books
        const links = document.querySelectorAll('a[href*="/book/"], a[href*="/books/"]');
        
        links.forEach(link => {
            const href = link.href;
            const match = href.match(/\/(?:book|books)\/(\d+)/);
            if (!match) return;
            const bookId = match[1];
            if (seenIds.has(bookId)) return;

            // Find parent containing img and text
            let parent = link;
            let img = null;
            for (let i = 0; i < 5; i++) {
                if (!parent) break;
                img = parent.querySelector('img');
                if (img) break;
                parent = parent.parentElement;
            }

            const title = link.innerText.trim() || (img ? img.alt : '') || (parent ? parent.innerText.split('\n')[0].trim() : '');
            if (!title || title.length < 2) return;

            // Guess author
            let author = 'نویسنده نامشخص';
            if (parent) {
                const textLines = parent.innerText.split('\n').map(l => l.trim()).filter(Boolean);
                if (textLines.length > 1) {
                    author = textLines[1];
                }
            }

            seenIds.add(bookId);
            detected.push({
                id: `book-${source}-${bookId}`,
                title: title.replace(/\s*\|\s*طاقچه\s*$/, '').replace(/\s*\|\s*فیدیبو\s*$/, '').trim(),
                author,
                totalPages: 200,
                currentPage: 200, // assume completed if it's in their library/profile shelf
                status: 'read',
                coverUrl: img ? img.src : '',
                addedAt: Date.now()
            });
        });

        return detected;
    }

    function importLibraryBooks(detectedBooks) {
        chrome.storage.local.get(['books'], (result) => {
            const list = result.books || [];
            let addedCount = 0;

            detectedBooks.forEach(newB => {
                const duplicate = list.find(b => b.id === newB.id);
                if (!duplicate) {
                    list.push(newB);
                    addedCount++;
                }
            });

            chrome.storage.local.set({ books: list }, () => {
                showTransientToast(`${addedCount.toLocaleString('fa-IR')} کتاب جدید با موفقیت منتقل شدند!`);
                removeLibraryBanner();
            });
        });
    }

})();
