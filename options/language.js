const select = document.getElementById('language-select');
const saveBtn = document.getElementById('save-lang');

chrome.storage.local.get('language', (result) => {
  select.value = result.language || 'fa';
});

select.addEventListener('change', () => {
  window.MioI18n.applyTranslations(select.value);
});

saveBtn.addEventListener('click', () => {
  chrome.storage.local.set({ language: select.value }, () => {
    const lang = select.value;
    saveBtn.textContent = window.MioI18n.t('options.saved', lang);
    setTimeout(() => {
      saveBtn.textContent = window.MioI18n.t('options.save', lang);
    }, 1500);
  });
});
