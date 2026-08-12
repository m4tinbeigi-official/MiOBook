// MioBook Side Panel Script - Fully Loaded MV3 Client Assistant

// Minimal CRC32 for zip packager
function crc32(bytes) {
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    let crc = -1;
    for (let i = 0; i < bytes.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
}

// Minimal Client-Side uncompressed ZIP generator
class MiniZip {
    constructor() {
        this.files = [];
    }

    addFile(name, content) {
        const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        this.files.push({
            name,
            bytes,
            crc: crc32(bytes),
            size: bytes.length
        });
    }

    compile() {
        let localHeadersSize = 0;
        const localHeaders = [];
        const centralDirectory = [];

        this.files.forEach(file => {
            const nameBytes = new TextEncoder().encode(file.name);
            const nameLen = nameBytes.length;
            const dataLen = file.size;

            // --- LOCAL FILE HEADER ---
            const localHeader = new Uint8Array(30 + nameLen + dataLen);
            const view = new DataView(localHeader.buffer);

            view.setUint32(0, 0x04034b50, true); // signature
            view.setUint16(4, 10, true);         // version needed
            view.setUint16(6, 0, true);          // flags
            view.setUint16(8, 0, true);          // compression (0 = stored)
            view.setUint16(10, 0, true);         // mod time
            view.setUint16(12, 0, true);         // mod date
            view.setUint32(14, file.crc, true);  // crc
            view.setUint32(18, dataLen, true);   // compressed size
            view.setUint32(22, dataLen, true);   // uncompressed size
            view.setUint16(26, nameLen, true);   // filename length
            view.setUint16(28, 0, true);         // extra length
            
            localHeader.set(nameBytes, 30);
            localHeader.set(file.bytes, 30 + nameLen);

            const offset = localHeadersSize;
            localHeadersSize += localHeader.length;
            localHeaders.push(localHeader);

            // --- CENTRAL DIRECTORY HEADER ---
            const cdHeader = new Uint8Array(46 + nameLen);
            const cdView = new DataView(cdHeader.buffer);

            cdView.setUint32(0, 0x02014b50, true);
            cdView.setUint16(4, 20, true);
            cdView.setUint16(6, 10, true);
            cdView.setUint16(8, 0, true);
            cdView.setUint16(10, 0, true);
            cdView.setUint16(12, 0, true);
            cdView.setUint16(14, 0, true);
            cdView.setUint32(16, file.crc, true);
            cdView.setUint32(20, dataLen, true);
            cdView.setUint32(24, dataLen, true);
            cdView.setUint16(28, nameLen, true);
            cdView.setUint16(30, 0, true);
            cdView.setUint16(32, 0, true);
            cdView.setUint16(34, 0, true);
            cdView.setUint16(36, 0, true);
            cdView.setUint32(38, 0, true);
            cdView.setUint32(42, offset, true);

            cdHeader.set(nameBytes, 46);
            centralDirectory.push(cdHeader);
        });

        const cdSize = centralDirectory.reduce((acc, val) => acc + val.length, 0);
        const totalSize = localHeadersSize + cdSize + 22;

        const zipBuffer = new Uint8Array(totalSize);
        let ptr = 0;

        localHeaders.forEach(lh => {
            zipBuffer.set(lh, ptr);
            ptr += lh.length;
        });

        centralDirectory.forEach(cd => {
            zipBuffer.set(cd, ptr);
            ptr += cd.length;
        });

        const eocd = new Uint8Array(22);
        const eocdView = new DataView(eocd.buffer);
        eocdView.setUint32(0, 0x06054b50, true);
        eocdView.setUint16(4, 0, true);
        eocdView.setUint16(6, 0, true);
        eocdView.setUint16(8, this.files.length, true);
        eocdView.setUint16(10, this.files.length, true);
        eocdView.setUint32(12, cdSize, true);
        eocdView.setUint32(16, localHeadersSize, true);

        zipBuffer.set(eocd, ptr);

        return zipBuffer;
    }
}

// --- Main Script ---
document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. Core Elements & Navigation ---
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const themeBtn = document.getElementById('theme-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');

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

    themeBtn.addEventListener('click', async () => {
        const nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length;
        currentTheme = themes[nextIndex];
        applyTheme(currentTheme);
        await chrome.storage.local.set({ theme: currentTheme });
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.theme) {
            currentTheme = changes.theme.newValue;
            applyTheme(currentTheme);
        }
    });

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        const iconPaths = {
            light: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', 
            sepia: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 8l0 8"/><path d="M8 12l8 0"/></svg>',
            moss: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
            dark: '<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/>'
        };
        
        if (theme === 'light') {
            themeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths.light}</svg>`;
            themeBtn.title = "تم کاغذی (سِپیا)";
        } else if (theme === 'sepia') {
            themeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>`;
            themeBtn.title = "تم جنگل (Moss)";
        } else if (theme === 'moss') {
            themeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/></svg>`;
            themeBtn.title = "تم تاریک (Obsidian)";
        } else {
            themeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths.dark}</svg>`;
            themeBtn.title = "تم روشن (سفید)";
        }
    }

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetTab = link.getAttribute('data-tab');
            tabLinks.forEach(btn => btn.classList.remove('active'));
            link.classList.add('active');
            tabContents.forEach(content => {
                content.classList.toggle('active', content.id === targetTab);
            });
            if (targetTab === 'tab-focus') {
                updateWpmStats();
            }
        });
    });

    dashboardBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "open-dashboard" });
    });

    // --- 2. Phase 2: Highlighting & Annotations (Marker Tab) ---
    const markerEmpty = document.getElementById('marker-empty');
    const highlightsList = document.getElementById('highlights-list');
    const markerExports = document.getElementById('marker-exports');
    const colorDots = document.querySelectorAll('.color-dot');
    const exportMarkdownBtn = document.getElementById('export-markdown-btn');
    const exportJsonBtn = document.getElementById('export-json-btn');

    chrome.storage.local.get(['activeColor'], (result) => {
        if (result.activeColor) {
            updateColorDotUI(result.activeColor);
        }
    });

    colorDots.forEach(dot => {
        dot.addEventListener('click', async () => {
            const selectedColor = dot.getAttribute('data-color');
            updateColorDotUI(selectedColor);
            await chrome.storage.local.set({ activeColor: selectedColor });
        });
    });

    function updateColorDotUI(color) {
        colorDots.forEach(d => d.classList.toggle('active', d.getAttribute('data-color') === color));
    }

    async function getActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    async function loadHighlights() {
        const activeTab = await getActiveTab();
        if (!activeTab || !activeTab.url) {
            showEmptyState("دسترسی به آدرس صفحه فعلی ممکن نیست.");
            return;
        }

        if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) {
            showEmptyState("امکان استفاده از نشانگر در صفحات داخلی مرورگر وجود ندارد.");
            return;
        }

        chrome.storage.local.get(['highlights'], (result) => {
            const list = result.highlights || [];
            const pageHighlights = list.filter(h => h.url === activeTab.url);

            if (pageHighlights.length === 0) {
                showEmptyState("در این صفحه هنوز هایلایتی ثبت نشده است. متنی را در صفحه انتخاب کنید تا منوی هایلایت ظاهر شود.");
            } else {
                renderHighlightsList(pageHighlights);
            }
        });
    }

    function showEmptyState(message) {
        markerEmpty.classList.remove('hidden');
        if (message) {
            markerEmpty.querySelector('p').innerText = message;
        }
        highlightsList.classList.add('hidden');
        markerExports.classList.add('hidden');
    }

    function renderHighlightsList(highlights) {
        markerEmpty.classList.add('hidden');
        highlightsList.classList.remove('hidden');
        markerExports.classList.remove('hidden');

        highlightsList.innerHTML = '';
        highlights.sort((a, b) => b.timestamp - a.timestamp);

        highlights.forEach(h => {
            const item = document.createElement('div');
            item.className = 'highlight-item';
            item.dataset.id = h.id;

            const colorClass = `miobook-highlight-${h.color}`;
            const dateStr = new Date(h.timestamp).toLocaleDateString('fa-IR');

            item.innerHTML = `
                <div class="highlight-text-content ${colorClass}">
                    ${escapeHtml(h.text)}
                </div>
                <div class="highlight-note ${h.note ? '' : 'hidden'}" id="note-view-${h.id}">
                    <span style="font-weight: 500;">یادداشت شما:</span>
                    <span id="note-text-${h.id}">${escapeHtml(h.note)}</span>
                </div>
                <div class="note-edit-area hidden" id="note-edit-${h.id}">
                    <textarea class="note-input" id="note-textarea-${h.id}" rows="2" placeholder="یادداشت خود را اینجا بنویسید...">${h.note || ''}</textarea>
                    <div class="note-actions">
                        <button class="btn-primary clickable note-save-btn" data-id="${h.id}" style="padding: 4px 10px; font-size: 11px;">ذخیره</button>
                        <button class="btn-secondary clickable note-cancel-btn" data-id="${h.id}" style="padding: 4px 10px; font-size: 11px;">لغو</button>
                    </div>
                </div>
                <div class="highlight-footer">
                    <span>${dateStr}</span>
                    <div class="item-actions">
                        <span class="action-link edit-note" data-id="${h.id}">یادداشت</span>
                        <span class="action-link delete delete-highlight" data-id="${h.id}">حذف</span>
                    </div>
                </div>
            `;

            item.querySelector('.delete-highlight').addEventListener('click', () => deleteHighlight(h.id));
            item.querySelector('.edit-note').addEventListener('click', () => toggleEditNote(h.id, true));
            item.querySelector('.note-cancel-btn').addEventListener('click', () => toggleEditNote(h.id, false));
            item.querySelector('.note-save-btn').addEventListener('click', () => saveNote(h.id));

            highlightsList.appendChild(item);
        });
    }

    async function deleteHighlight(id) {
        if (!confirm('آیا از حذف این هایلایت مطمئن هستید؟')) return;

        chrome.storage.local.get(['highlights'], (result) => {
            const list = result.highlights || [];
            const updated = list.filter(h => h.id !== id);
            chrome.storage.local.set({ highlights: updated }, () => {
                loadHighlights();
                getActiveTab().then(tab => {
                    if (tab && tab.id) {
                        chrome.tabs.reload(tab.id);
                    }
                });
            });
        });
    }

    function toggleEditNote(id, show) {
        const noteView = document.getElementById(`note-view-${id}`);
        const noteEdit = document.getElementById(`note-edit-${id}`);
        
        if (show) {
            noteEdit.classList.remove('hidden');
            if (noteView) noteView.classList.add('hidden');
        } else {
            noteEdit.classList.add('hidden');
            if (noteView && noteView.querySelector('#note-text-' + id).innerText.trim()) {
                noteView.classList.remove('hidden');
            }
        }
    }

    function saveNote(id) {
        const text = document.getElementById(`note-textarea-${id}`).value;
        
        chrome.storage.local.get(['highlights'], (result) => {
            const list = result.highlights || [];
            const index = list.findIndex(h => h.id === id);
            if (index !== -1) {
                list[index].note = text.trim();
                chrome.storage.local.set({ highlights: list }, () => {
                    loadHighlights();
                });
            }
        });
    }

    function focusNoteInput(id) {
        const markerTabLink = document.querySelector('[data-tab="tab-marker"]');
        if (markerTabLink) markerTabLink.click();
        
        setTimeout(() => {
            toggleEditNote(id, true);
            const textarea = document.getElementById(`note-textarea-${id}`);
            if (textarea) textarea.focus();
        }, 300);
    }

    function escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Exports
    exportMarkdownBtn.addEventListener('click', async () => {
        const activeTab = await getActiveTab();
        chrome.storage.local.get(['highlights'], (result) => {
            const list = result.highlights || [];
            const pageHighlights = list.filter(h => h.url === activeTab.url);

            if (pageHighlights.length === 0) return;

            let md = `# هایلایت‌های مطالعه: [${activeTab.title}](${activeTab.url})\n\n`;
            pageHighlights.forEach((h, idx) => {
                md += `### ${idx + 1}. [رنگ: ${h.color}]\n`;
                md += `> ${h.text}\n\n`;
                if (h.note) {
                    md += `*یادداشت:* ${h.note}\n\n`;
                }
                md += `---\n\n`;
            });

            downloadBlob(md, `miobook-highlights-${Date.now()}.md`, 'text/markdown');
        });
    });

    exportJsonBtn.addEventListener('click', async () => {
        const activeTab = await getActiveTab();
        chrome.storage.local.get(['highlights'], (result) => {
            const list = result.highlights || [];
            const pageHighlights = list.filter(h => h.url === activeTab.url);

            if (pageHighlights.length === 0) return;

            const jsonStr = JSON.stringify(pageHighlights, null, 2);
            downloadBlob(jsonStr, `miobook-highlights-${Date.now()}.json`, 'application/json');
        });
    });

    function downloadBlob(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Initialize list load
    loadHighlights();
    
    // Sync lists across tabs
    chrome.tabs.onActivated.addListener(loadHighlights);
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
            loadHighlights();
        }
    });

    // --- 3. Phase 3: Focus & Reading Speed Widget (WPM) ---
    async function updateWpmStats() {
        const activeTab = await getActiveTab();
        if (!activeTab || !activeTab.id || activeTab.url.startsWith('chrome://')) {
            document.getElementById('wpm-word-count').innerText = 'نامشخص';
            document.getElementById('wpm-est-time').innerText = 'نامشخص';
            return;
        }

        chrome.tabs.sendMessage(activeTab.id, { action: "get-wpm-stats" }, (response) => {
            if (chrome.runtime.lastError || !response || !response.wordCount) {
                document.getElementById('wpm-word-count').innerText = '-';
                document.getElementById('wpm-est-time').innerText = '-';
                return;
            }

            const wordCount = response.wordCount;
            const WPM = 200; // Persian WPM
            const minutes = Math.ceil(wordCount / WPM);

            document.getElementById('wpm-word-count').innerText = wordCount.toLocaleString('fa-IR') + ' کلمه';
            document.getElementById('wpm-est-time').innerText = minutes.toLocaleString('fa-IR') + ' دقیقه';
        });
    }

    // --- Focus Timer Logic ---
    const timerTime = document.getElementById('timer-time');
    const timerStateLabel = document.getElementById('timer-state-label');
    const timerStartBtn = document.getElementById('timer-start-btn');
    const timerPauseBtn = document.getElementById('timer-pause-btn');
    const timerResetBtn = document.getElementById('timer-reset-btn');

    let timerInterval = null;
    let timerState = 'focus';
    let durationSeconds = 25 * 60;
    let secondsLeft = durationSeconds;
    let isRunning = false;

    function formatTime(secs) {
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
    }

    function updateTimerDisplay() {
        const standardTime = formatTime(secondsLeft);
        timerTime.innerText = standardTime.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
    }

    function playTimerAlert() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            
            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioCtx.close();
            }, 600);
        } catch (e) {
            console.error("Audio Context beep failed:", e);
        }
    }

    async function logReadingSession() {
        const activeTab = await getActiveTab();
        const durationMinutes = Math.floor((durationSeconds - secondsLeft) / 60);
        
        if (durationMinutes < 1) return;

        chrome.storage.local.get(['readingLogs'], (result) => {
            const logs = result.readingLogs || [];
            logs.push({
                timestamp: Date.now(),
                durationMinutes: durationMinutes,
                url: activeTab && activeTab.url ? activeTab.url : 'custom',
                pageTitle: activeTab && activeTab.title ? activeTab.title.substring(0, 50) : 'مطالعه آفلاین'
            });
            chrome.storage.local.set({ readingLogs: logs });
        });
    }

    function handleTimerEnd() {
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;
        
        playTimerAlert();
        
        if (timerState === 'focus') {
            logReadingSession();
            timerState = 'break';
            timerStateLabel.innerText = 'زمان استراحت ☕';
            secondsLeft = 5 * 60;
            timerStartBtn.innerText = 'شروع استراحت';
        } else {
            timerState = 'focus';
            timerStateLabel.innerText = 'زمان مطالعه 📚';
            secondsLeft = 25 * 60;
            timerStartBtn.innerText = 'شروع مطالعه';
        }

        timerStartBtn.classList.remove('hidden');
        timerPauseBtn.classList.add('hidden');
        updateTimerDisplay();
    }

    timerStartBtn.addEventListener('click', () => {
        if (isRunning) return;

        isRunning = true;
        timerStartBtn.classList.add('hidden');
        timerPauseBtn.classList.remove('hidden');

        timerInterval = setInterval(() => {
            if (secondsLeft > 0) {
                secondsLeft--;
                updateTimerDisplay();
            } else {
                handleTimerEnd();
            }
        }, 1000);
    });

    timerPauseBtn.addEventListener('click', () => {
        if (!isRunning) return;

        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;

        timerStartBtn.innerText = 'ادامه مطالعه';
        timerStartBtn.classList.remove('hidden');
        timerPauseBtn.classList.add('hidden');

        logReadingSession();
        durationSeconds = secondsLeft;
    });

    timerResetBtn.addEventListener('click', () => {
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;

        timerState = 'focus';
        timerStateLabel.innerText = 'زمان مطالعه 📚';
        durationSeconds = 25 * 60;
        secondsLeft = durationSeconds;

        timerStartBtn.innerText = 'شروع مطالعه';
        timerStartBtn.classList.remove('hidden');
        timerPauseBtn.classList.add('hidden');
        
        updateTimerDisplay();
    });

    // Initialize timer visual
    updateTimerDisplay();

    // --- 5. Phase 5: Epubify (Reader Mode & EPUB compiler) ---
    const triggerReaderBtn = document.getElementById('trigger-reader-btn');
    const generateEpubBtn = document.getElementById('generate-epub-btn');

    triggerReaderBtn.addEventListener('click', async () => {
        const activeTab = await getActiveTab();
        if (!activeTab || !activeTab.id || activeTab.url.startsWith('chrome://')) {
            alert('حالت خواندن در این صفحه قابل استفاده نیست.');
            return;
        }

        chrome.tabs.sendMessage(activeTab.id, { action: "trigger-reader-mode" })
            .catch(() => alert('لطفا صفحه را یکبار ریفرش کنید تا اسکریپت فعال شود.'));
    });

    generateEpubBtn.addEventListener('click', async () => {
        const activeTab = await getActiveTab();
        if (!activeTab || !activeTab.id || activeTab.url.startsWith('chrome://')) {
            alert('امکان استخراج این صفحه وجود ندارد.');
            return;
        }

        generateEpubBtn.innerText = 'در حال ساخت EPUB...';
        generateEpubBtn.disabled = true;

        chrome.tabs.sendMessage(activeTab.id, { action: "get-page-content" }, (response) => {
            generateEpubBtn.innerText = 'دانلود به صورت فایل EPUB';
            generateEpubBtn.disabled = false;

            if (chrome.runtime.lastError || !response || !response.paragraphs) {
                alert('خطا در دریافت متن صفحه. لطفاً مطمئن شوید صفحه کاملاً بارگذاری شده است.');
                return;
            }

            // Create EPUB structure
            const title = response.title || 'کتاب استخراج شده';
            const author = response.author || 'نویسنده نامشخص';
            const paragraphs = response.paragraphs;

            try {
                const epubBlob = buildEpubBlob(title, author, paragraphs);
                downloadBlob(epubBlob, `miobook-${title.substring(0, 15)}.epub`, 'application/epub+zip');
            } catch (err) {
                console.error("EPUB compilation failed:", err);
                alert('خطا در فشرده‌سازی و ساخت فایل کتاب.');
            }
        });
    });

    function buildEpubBlob(title, author, paragraphs) {
        const zip = new MiniZip();

        // 1. mimetype (MUST be first, uncompressed)
        zip.addFile('mimetype', 'application/epub+zip');

        // 2. META-INF/container.xml
        zip.addFile('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

        // 3. OEBPS/content.opf
        zip.addFile('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>fa</dc:language>
    <dc:identifier id="bookid">urn:uuid:${Date.now()}</dc:identifier>
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0] + 'Z'}</meta>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="stylesheet.css" media-type="text/css"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter1"/>
  </spine>
</package>`);

        // 4. OEBPS/toc.ncx
        zip.addFile('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
  </head>
  <docTitle>
    <text>${title}</text>
  </docTitle>
  <navMap>
    <navPoint id="navpoint-1" playOrder="1">
      <navLabel>
        <text>${title}</text>
      </navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`);

        // 5. OEBPS/stylesheet.css
        zip.addFile('OEBPS/stylesheet.css', `body {
  font-family: sans-serif;
  line-height: 1.8;
  direction: rtl;
  text-align: justify;
  padding: 5%;
}
h1 {
  text-align: center;
  font-size: 1.8em;
  margin-bottom: 0.8em;
}
h2 {
  font-size: 1.4em;
  margin-top: 1.2em;
  margin-bottom: 0.6em;
}
p {
  margin-bottom: 1em;
  text-indent: 1em;
}`);

        // 6. OEBPS/chapter1.xhtml
        let chapterHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="fa" dir="rtl">
<head>
  <title>${title}</title>
  <meta charset="utf-8"/>
  <link rel="stylesheet" href="stylesheet.css" type="text/css"/>
</head>
<body>
  <h1>${title}</h1>
`;

        paragraphs.forEach(p => {
            if (p.tag && p.tag.startsWith('h')) {
                chapterHtml += `  <h2>${p.text}</h2>\n`;
            } else {
                chapterHtml += `  <p>${p.text}</p>\n`;
            }
        });

        chapterHtml += `</body>
</html>`;
        zip.addFile('OEBPS/chapter1.xhtml', chapterHtml);

        const binaryResult = zip.compile();
        return binaryResult;
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "highlights-updated") {
            loadHighlights();
        } else if (message.action === "focus-highlight-note") {
            focusNoteInput(message.highlightId);
        }
    });
});
