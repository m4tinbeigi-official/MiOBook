// ============================================================
// MioBook Phase 6 – Side Panel JS additions
// Appended to the bottom of sidepanel.js concerns:
// 1. Ambient Sounds wiring
// 2. Word Bank (vocabulary) CRUD
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    // ===================== AMBIENT SOUNDS =====================
    const soundBtns    = document.querySelectorAll('.sound-btn');
    const volumeSlider = document.getElementById('sound-volume');
    const volumeLabel  = document.getElementById('volume-label');
    const soundStatus  = document.getElementById('sound-status');
    const ambient      = window.MioBookAmbient;

    if (soundBtns.length && ambient) {
        let activeSoundType = null;

        soundBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-sound');

                if (activeSoundType === type) {
                    // Toggle off
                    ambient.stop();
                    activeSoundType = null;
                    soundBtns.forEach(b => b.classList.remove('playing'));
                    soundStatus.textContent = '⏸ هیچ صدایی در حال پخش نیست';
                } else {
                    ambient.play(type);
                    activeSoundType = type;
                    soundBtns.forEach(b => b.classList.remove('playing'));
                    btn.classList.add('playing');
                    const nameEl = btn.querySelector('.sound-name');
                    soundStatus.textContent = `▶ در حال پخش: ${nameEl ? nameEl.textContent : type}`;
                }
            });
        });

        if (volumeSlider) {
            volumeSlider.addEventListener('input', () => {
                const val = parseInt(volumeSlider.value);
                ambient.setVolume(val);
                volumeLabel.textContent = val.toLocaleString('fa-IR') + '٪';
            });
        }
    }

    // ===================== WORD BANK =====================
    const wordInput     = document.getElementById('word-input');
    const meaningInput  = document.getElementById('word-meaning-input');
    const saveWordBtn   = document.getElementById('save-word-btn');
    const wordsList     = document.getElementById('words-list');
    const wordsEmpty    = document.getElementById('words-empty');
    const exportWordsBtn = document.getElementById('export-words-btn');

    function loadWords() {
        chrome.storage.local.get(['wordBank'], result => {
            const words = result.wordBank || [];
            if (words.length === 0) {
                wordsEmpty.classList.remove('hidden');
                wordsList.classList.add('hidden');
                if (exportWordsBtn) exportWordsBtn.classList.add('hidden');
            } else {
                wordsEmpty.classList.add('hidden');
                wordsList.classList.remove('hidden');
                if (exportWordsBtn) exportWordsBtn.classList.remove('hidden');
                renderWords(words);
            }
        });
    }

    function renderWords(words) {
        if (!wordsList) return;
        wordsList.innerHTML = '';
        words.slice().reverse().forEach(w => {
            const card = document.createElement('div');
            card.className = 'word-card';
            const dateStr = new Date(w.addedAt).toLocaleDateString('fa-IR');
            card.innerHTML = `
                <div class="word-card-term">${escapeHtml(w.term)}</div>
                ${w.meaning ? `<div class="word-card-meaning">${escapeHtml(w.meaning)}</div>` : ''}
                <div class="word-card-footer">
                    <span>${dateStr}</span>
                    <span class="action-link delete" data-id="${w.id}" style="cursor:pointer;">حذف</span>
                </div>
            `;
            card.querySelector('[data-id]').addEventListener('click', () => deleteWord(w.id));
            wordsList.appendChild(card);
        });
    }

    function saveWord() {
        const term    = wordInput    ? wordInput.value.trim()   : '';
        const meaning = meaningInput ? meaningInput.value.trim() : '';
        if (!term) return;

        chrome.storage.local.get(['wordBank'], result => {
            const words = result.wordBank || [];
            words.push({ id: 'w-' + Date.now(), term, meaning, addedAt: Date.now() });
            chrome.storage.local.set({ wordBank: words }, () => {
                if (wordInput)    wordInput.value    = '';
                if (meaningInput) meaningInput.value = '';
                loadWords();
            });
        });
    }

    function deleteWord(id) {
        chrome.storage.local.get(['wordBank'], result => {
            const updated = (result.wordBank || []).filter(w => w.id !== id);
            chrome.storage.local.set({ wordBank: updated }, loadWords);
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
    }

    if (saveWordBtn)   saveWordBtn.addEventListener('click', saveWord);
    if (wordInput)     wordInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveWord(); });

    if (exportWordsBtn) {
        exportWordsBtn.addEventListener('click', () => {
            chrome.storage.local.get(['wordBank'], result => {
                const words = result.wordBank || [];
                if (!words.length) return;
                const csv = 'کلمه,معنی,تاریخ\n' + words.map(w =>
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
        });
    }

    // Initial load
    loadWords();
});
