// Service Worker for MioBook Chrome Extension

chrome.runtime.onInstalled.addListener(() => {
  console.log("MioBook Extension Installed successfully.");
});

// Open dashboard in a new tab when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
  const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
  chrome.tabs.create({ url: dashboardUrl })
    .catch((error) => console.error('Error opening dashboard tab:', error));
});

// Set up Context Menu for Highlighting (Phase 2 feature, but safe to prepare now)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "miobook-highlight",
    title: "هایلایت کردن در میو بوک",
    contexts: ["selection"]
  });
});

// Listen for Context Menu Clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "miobook-highlight" && tab.id) {
    // Send a message to content script of the active tab to highlight the selected text
    chrome.tabs.sendMessage(tab.id, { action: "trigger-highlight" })
      .catch((err) => console.log("Content script not active or loaded yet:", err));
  }
});

// Listen for messages from content script, dashboard or side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "open-dashboard") {
    chrome.runtime.openOptionsPage()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keeps sendResponse channel open for async response
  }

  if (message.action === "search-books") {
    const { query } = message;
    performBackgroundSearch(query)
      .then(results => sendResponse({ success: true, results }))
      .catch(err => {
        console.error("Background search error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // async response
  }

  if (message.action === "get-bookstore-prices") {
    const { title } = message;
    performBackgroundPriceComparison(title)
      .then(comparison => sendResponse({ success: true, comparison }))
      .catch(err => {
        console.error("Background price comparison error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // async response
  }

  if (message.action === "connector-status") {
    updateConnectorStatus(message.provider, message.loggedIn)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === "connector-sync") {
    mergeConnectorBooks(message.provider, message.books || [])
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err => {
        console.error("Connector sync error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

// --- Fidibo / Taaghche Account Connector ---

async function updateConnectorStatus(provider, loggedIn) {
  if (!provider) return;
  const { connectedAccounts = {} } = await chrome.storage.local.get(['connectedAccounts']);
  connectedAccounts[provider] = {
    ...(connectedAccounts[provider] || {}),
    loggedIn: !!loggedIn
  };
  await chrome.storage.local.set({ connectedAccounts });
}

async function mergeConnectorBooks(provider, scrapedBooks) {
  const { books = [], connectedAccounts = {} } = await chrome.storage.local.get(['books', 'connectedAccounts']);
  const existingLinks = new Set(books.map(b => b.storeLink).filter(Boolean));

  let addedCount = 0;
  let updatedCount = 0;

  scrapedBooks.forEach(item => {
    if (!item.title || !item.storeLink) return;

    const status = item.status || (item.progressPct === 100 ? 'read' : (item.progressPct > 0 ? 'reading' : 'toRead'));
    const totalPages = item.totalPages || 0;
    const existing = books.find(b => b.storeLink === item.storeLink);

    if (existing) {
      existing.status = status;
      if (totalPages) existing.totalPages = totalPages;
      if (status === 'read') {
        existing.completedAt = existing.completedAt || Date.now();
        existing.currentPage = existing.totalPages || existing.currentPage || 0;
      }
      updatedCount++;
    } else {
      books.push({
        id: `book-${provider}-${Date.now()}-${addedCount}`,
        title: item.title,
        author: item.author || '',
        totalPages,
        currentPage: status === 'read' ? totalPages : 0,
        status,
        coverUrl: item.coverUrl || '',
        addedAt: Date.now(),
        storeLink: item.storeLink,
        storeSource: item.storeSource || provider
      });
      addedCount++;
    }
  });

  connectedAccounts[provider] = {
    loggedIn: true,
    lastSync: Date.now(),
    bookCount: scrapedBooks.length
  };

  await chrome.storage.local.set({ books, connectedAccounts });
  return { addedCount, updatedCount, total: scrapedBooks.length };
}

// --- API Search Helper Functions in Background ---

async function performBackgroundSearch(query) {
  const [taaghcheResults, fidiboResults, openLibraryResults] = await Promise.all([
    searchTaaghcheAPI(query),
    searchFidiboAPI(query),
    searchOpenLibraryAPI(query)
  ]);

  const combinedResults = [];

  taaghcheResults.forEach(item => {
    combinedResults.push({
      id: item.id,
      title: item.title,
      author: item.category || 'کتاب الکترونیکی طاقچه',
      coverUrl: `https://img.taaghche.com/${item.type === 'audioBook' ? 'audioCover' : 'frontCover'}/${item.id}.jpg`,
      source: 'taaghche',
      sourceLabel: 'طاقچه',
      link: `https://taaghche.com/book/${item.id}`,
      pages: 200
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
      pages: 200
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
    console.error("Taaghche search background error:", e);
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
    console.error("Fidibo search background error:", e);
  }
  return [];
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
    console.error("OpenLibrary search background error:", e);
  }
  return [];
}

async function performBackgroundPriceComparison(title) {
  const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').replace(/[\u200c]/g, ' ').trim();

  const [taaghcheResults, fidiboResults] = await Promise.all([
    searchTaaghcheAPI(cleanTitle),
    searchFidiboAPI(cleanTitle)
  ]);

  const comparison = [];

  // Taaghche
  const taaghcheMatches = taaghcheResults.filter(item => checkTitleMatch(cleanTitle, item.title));
  for (const item of taaghcheMatches.slice(0, 2)) {
    const priceText = await fetchTaaghchePriceInfo(item.id, item.subscription);
    const formatLabel = item.type === 'audioBook' ? 'کتاب صوتی' : 'کتاب الکترونیکی';
    comparison.push({
      store: 'taaghche',
      storeLabel: 'طاقچه',
      format: formatLabel,
      price: priceText,
      url: `https://taaghche.com/book/${item.id}`,
      className: 'taaghche'
    });
  }

  // Fidibo
  const fidiboMatches = fidiboResults.filter(item => checkTitleMatch(cleanTitle, item.title));
  for (const item of fidiboMatches.slice(0, 2)) {
    const priceText = await fetchFidiboPriceInfo(item.id);
    const formatLabel = item.content_type === 'audiobook' ? 'کتاب صوتی' : 'کتاب الکترونیکی';
    comparison.push({
      store: 'fidibo',
      storeLabel: 'فیدیبو',
      format: formatLabel,
      price: priceText,
      url: `https://fidibo.com/book/${item.id}`,
      className: 'fidibo'
    });
  }

  return comparison;
}

function checkTitleMatch(original, target) {
  if (!original || !target) return false;
  const clean = str => str.toLowerCase().replace(/[\u200c\s\-\_\:\,\(\)]/g, '');
  const cleanOrig = clean(original);
  const cleanTarg = clean(target);
  return cleanOrig.includes(cleanTarg) || cleanTarg.includes(cleanOrig);
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
