// MioBook Phase 6 – Dashboard Enhancements
// 1. Reading Challenge / Goals Progress Ring
// 2. Word Bank full search & delete grid
// 3. Complete Backup, Restore, and Clear local storage data

document.addEventListener('DOMContentLoaded', () => {
    // Nav tracking to trigger loads
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            if (targetTab === 'tab-goals') {
                loadGoals();
            } else if (targetTab === 'tab-wordbank') {
                loadWordBank();
            } else if (targetTab === 'tab-backup') {
                clearStatus();
            }
        });
    });

    // ============================================================
    // READING GOALS & CHALLENGE
    // ============================================================
    const goalsSetupCard     = document.querySelector('.goals-setup-card');
    const goalsProgressArea  = document.getElementById('goals-progress-area');
    const goalBookInput      = document.getElementById('goal-book-count');
    const saveGoalBtn        = document.getElementById('save-goal-btn');
    const changeGoalBtn      = document.getElementById('change-goal-btn');

    const ringFill           = document.getElementById('goal-ring-fill');
    const goalReadCount      = document.getElementById('goal-read-count');
    const goalTargetLabel    = document.getElementById('goal-target-label');
    const gRead              = document.getElementById('g-read');
    const gRemaining         = document.getElementById('g-remaining');
    const gPct               = document.getElementById('g-pct');
    const gWeekly            = document.getElementById('g-weekly');
    const motivationText     = document.getElementById('motivation-text');

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

    if (changeGoalBtn) {
        changeGoalBtn.addEventListener('click', () => {
            if (confirm('آیا مطمئن هستید که می‌خواهید هدف مطالعه خود را تغییر دهید؟')) {
                chrome.storage.local.remove('readingGoal', loadGoals);
            }
        });
    }

    function loadGoals() {
        chrome.storage.local.get(['readingGoal', 'books', 'readingLogs'], result => {
            const goal = result.readingGoal;
            const books = result.books || [];
            const logs = result.readingLogs || [];

            if (!goal) {
                goalsSetupCard.classList.remove('hidden');
                goalsProgressArea.classList.add('hidden');
            } else {
                goalsSetupCard.classList.add('hidden');
                goalsProgressArea.classList.remove('hidden');
                updateGoalsUI(goal, books, logs);
            }
        });
    }

    function updateGoalsUI(targetGoal, books, logs) {
        // Count finished books in the current calendar year
        const currentYear = new Date().getFullYear();
        const readBooksCount = books.filter(b => {
            if (b.status !== 'read') return false;
            // Fallback to addedAt if no completion date is available
            const date = b.completedAt ? new Date(b.completedAt) : new Date(b.addedAt);
            return date.getFullYear() === currentYear;
        }).length;

        // Circular progress calculation
        const circumference = 502.65; // 2 * pi * 80
        const pct = targetGoal > 0 ? Math.min(readBooksCount / targetGoal, 1) : 0;
        const offset = circumference - (pct * circumference);
        
        if (ringFill) {
            ringFill.style.strokeDashoffset = offset;
        }

        // Numerical Labels
        if (goalReadCount)   goalReadCount.innerText = readBooksCount.toLocaleString('fa-IR');
        if (goalTargetLabel) goalTargetLabel.innerText = targetGoal.toLocaleString('fa-IR');
        if (gRead)           gRead.innerText = readBooksCount.toLocaleString('fa-IR');

        const remaining = Math.max(0, targetGoal - readBooksCount);
        if (gRemaining)      gRemaining.innerText = remaining.toLocaleString('fa-IR');

        const percentage = Math.round(pct * 100);
        if (gPct)            gPct.innerText = percentage.toLocaleString('fa-IR') + '٪';

        // Average reading time per week estimation
        if (gWeekly) {
            const now = Date.now();
            const startOfYear = new Date(currentYear, 0, 1).getTime();
            const weeksPassed = Math.max(1, (now - startOfYear) / (1000 * 60 * 60 * 24 * 7));
            const totalMinutes = logs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
            const weeklyAvg = Math.round(totalMinutes / weeksPassed);
            gWeekly.innerText = weeklyAvg.toLocaleString('fa-IR') + ' دقیقه در هفته';
        }

        // Motivations
        if (motivationText) {
            if (percentage >= 100) {
                motivationText.innerText = '🏆 شگفت‌انگیز است! شما به هدف سالانه خود رسیدید! 🎉';
            } else if (percentage >= 75) {
                motivationText.innerText = '🔥 عالی عمل کردی! فاصله بسیار کمی تا پایان هدف داری.';
            } else if (percentage >= 50) {
                motivationText.innerText = '✨ بیش از نصف راه رو رفتی، ادامه بده دوست من!';
            } else if (percentage >= 25) {
                motivationText.innerText = '📚 بسیار خوب، عادت مطالعه شما هر روز قوی‌تر می‌شود.';
            } else {
                motivationText.innerText = '💪 شروع چالش فوق‌العاده است. هر روز کمی بخوانید.';
            }
        }
    }


    // ============================================================
    // WORD BANK (DASHBOARD GRID)
    // ============================================================
    const wbSearchInput = document.getElementById('wb-search-input');
    const wbEmpty       = document.getElementById('wb-empty');
    const wbGrid        = document.getElementById('wb-grid');
    const dashExportBtn = document.getElementById('dash-export-words-btn');
    let allWordsCached  = [];

    if (wbSearchInput) {
        wbSearchInput.addEventListener('input', () => {
            filterAndRenderWordBank(wbSearchInput.value.trim());
        });
    }

    if (dashExportBtn) {
        dashExportBtn.addEventListener('click', () => {
            if (allWordsCached.length === 0) return;
            const csv = 'کلمه,معنی,تاریخ ثبت\n' + allWordsCached.map(w =>
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
            allWordsCached = result.wordBank || [];
            filterAndRenderWordBank('');
        });
    }

    function filterAndRenderWordBank(query) {
        if (!wbGrid) return;

        const filtered = allWordsCached.filter(w => {
            const q = query.toLowerCase();
            return w.term.toLowerCase().includes(q) || (w.meaning && w.meaning.toLowerCase().includes(q));
        });

        if (allWordsCached.length === 0) {
            wbEmpty.classList.remove('hidden');
            wbGrid.classList.add('hidden');
            if (dashExportBtn) dashExportBtn.classList.add('hidden');
            return;
        }

        wbEmpty.classList.add('hidden');
        wbGrid.classList.remove('hidden');
        if (dashExportBtn) dashExportBtn.classList.remove('hidden');

        wbGrid.innerHTML = '';
        if (filtered.length === 0) {
            wbGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">کلمه‌ای پیدا نشد.</div>';
            return;
        }

        filtered.slice().reverse().forEach(w => {
            const card = document.createElement('div');
            card.className = 'wb-card';
            const dateStr = new Date(w.addedAt).toLocaleDateString('fa-IR');
            card.innerHTML = `
                <div class="wb-card-term">${escapeHtml(w.term)}</div>
                ${w.meaning ? `<div class="wb-card-meaning">${escapeHtml(w.meaning)}</div>` : ''}
                <div class="wb-card-meta">
                    <span>📅 ${dateStr}</span>
                    <button class="wb-card-delete" data-id="${w.id}" title="حذف کلمه">🗑️</button>
                </div>
            `;
            card.querySelector('.wb-card-delete').addEventListener('click', () => deleteWord(w.id));
            wbGrid.appendChild(card);
        });
    }

    function deleteWord(id) {
        if (!confirm('آیا مایل به حذف این واژه هستید؟')) return;
        chrome.storage.local.get(['wordBank'], result => {
            const updated = (result.wordBank || []).filter(w => w.id !== id);
            chrome.storage.local.set({ wordBank: updated }, loadWordBank);
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
    }


    // ============================================================
    // BACKUP & RESTORE
    // ============================================================
    const backupAllBtn     = document.getElementById('backup-all-btn');
    const restoreFileInput = document.getElementById('restore-file-input');
    const clearAllDataBtn  = document.getElementById('clear-all-data-btn');
    const statusBox        = document.getElementById('backup-status-box');
    const statusText       = document.getElementById('backup-status-text');

    function showStatus(text, isError = false) {
        if (!statusBox || !statusText) return;
        statusBox.classList.remove('hidden');
        statusText.innerText = text;
        statusBox.style.borderColor = isError ? '#e63946' : 'var(--accent-color)';
        statusBox.style.background = isError ? 'rgba(230,57,70,0.1)' : 'var(--accent-light)';
        statusBox.style.color = isError ? '#e63946' : 'var(--accent-color)';
    }

    function clearStatus() {
        if (statusBox) statusBox.classList.add('hidden');
    }

    // Export local storage
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
                showStatus('پشتیبان‌گیری با موفقیت انجام شد و دانلود فایل آغاز گردید.');
            });
        });
    }

    // Import local storage
    if (restoreFileInput) {
        restoreFileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = evt => {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    
                    // Simple validation: check if at least one core key exists
                    const validKeys = ['books', 'readingLogs', 'wordBank', 'highlights', 'theme', 'readingGoal'];
                    const hasValidKey = Object.keys(parsed).some(k => validKeys.includes(k));
                    
                    if (!hasValidKey) {
                        showStatus('خطا: ساختار فایل پشتیبان نامعتبر است.', true);
                        return;
                    }

                    // Save parsed items directly back to storage
                    chrome.storage.local.clear(() => {
                        chrome.storage.local.set(parsed, () => {
                            showStatus('بازیابی داده‌ها با موفقیت انجام شد! لطفاً برای بارگذاری کامل صفحه را رفرش کنید.');
                            alert('داده‌ها با موفقیت بازیابی شدند. برای اعمال نهایی تغییرات صفحه رفرش خواهد شد.');
                            window.location.reload();
                        });
                    });
                } catch(err) {
                    console.error(err);
                    showStatus('خطا: بارگذاری فایل با شکست مواجه شد. فرمت JSON نامعتبر است.', true);
                }
            };
            reader.readAsText(file);
        });
    }

    // Clear all
    if (clearAllDataBtn) {
        clearAllDataBtn.addEventListener('click', () => {
            const firstCheck = confirm('⚠️ توجه: آیا مطمئن هستید که می‌خواهید کل کتابخانه، یادداشت‌ها، و پیشرفت خواندن خود را حذف کنید؟ این عمل غیرقابل بازگشت است!');
            if (firstCheck) {
                const secondCheck = confirm('⚠️ تایید نهایی: آیا کاملاً مطمئن هستید؟ همه داده‌ها برای همیشه حذف خواهند شد.');
                if (secondCheck) {
                    chrome.storage.local.clear(() => {
                        alert('تمامی داده‌های شما پاک شدند.');
                        window.location.reload();
                    });
                }
            }
        });
    }

    // Initialize goals widget on load if we are on the tab
    loadGoals();
});
