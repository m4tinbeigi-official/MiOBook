// social-db.js - Integration for Custom Backend Server & Google Login (with Firebase Fallback)

// Set this to true to bypass Firebase and use the Node.js Express server
const USE_CUSTOM_SERVER = true; 
const CUSTOM_SERVER_URL = "https://miobook-m4tinbeigiis-projects.vercel.app"; // Production server URL (Vercel)

const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  projectId: "YOUR_PROJECT_ID",
  clientId: "1065886895516-dhc2g50p68jjr1nkkc8lu0vv3t70q9jd.apps.googleusercontent.com" // Client ID of type Web Application from Google Cloud Console (Required for Google Login)
};

// Helper to check if credentials are set
function isConfigured() {
  if (USE_CUSTOM_SERVER) {
    return FIREBASE_CONFIG.clientId !== "YOUR_GOOGLE_OAUTH_CLIENT_ID" && CUSTOM_SERVER_URL !== "";
  }
  return FIREBASE_CONFIG.apiKey !== "YOUR_FIREBASE_API_KEY" && 
         FIREBASE_CONFIG.projectId !== "YOUR_PROJECT_ID" && 
         FIREBASE_CONFIG.clientId !== "YOUR_GOOGLE_OAUTH_CLIENT_ID";
}

// Helper to get auth header or refresh token if expired
async function getAuthToken() {
  const data = await chrome.storage.local.get(['auth']);
  if (!data.auth) return null;

  const auth = data.auth;
  const now = Date.now();
  
  // If token is expired or expires in less than 5 minutes, handle refresh
  if (auth.expiresAt - now < 5 * 60 * 1000) {
    if (USE_CUSTOM_SERVER) {
      // For Custom Server using direct Google OAuth, if expired, force re-login
      await chrome.storage.local.remove(['auth']);
      return null;
    }
    
    try {
      const refreshed = await refreshFirebaseToken(auth.refreshToken);
      if (refreshed) {
        auth.idToken = refreshed.idToken;
        auth.refreshToken = refreshed.refreshToken;
        auth.expiresAt = Date.now() + (parseInt(refreshed.expiresIn) * 1000);
        await chrome.storage.local.set({ auth });
      } else {
        // Refresh failed, clear auth
        await chrome.storage.local.remove(['auth']);
        return null;
      }
    } catch (err) {
      console.error("Token refresh error:", err);
      return null;
    }
  }
  
  return auth.idToken;
}

// Refresh Firebase Token (Only used in Firebase mode)
async function refreshFirebaseToken(refreshToken) {
  if (!isConfigured() || USE_CUSTOM_SERVER) return null;
  
  const url = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
  });
  
  if (!response.ok) {
    throw new Error("Failed to refresh Firebase token");
  }
  
  const data = await response.json();
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in
  };
}

// Sign in with Google using launchWebAuthFlow
async function loginWithGoogle() {
  if (!isConfigured()) {
    throw new Error("لطفاً ابتدا تنظیمات شناسه کلاینت گوگل (clientId) را در فایل scripts/social-db.js وارد کنید.");
  }

  const redirectUrl = chrome.identity.getRedirectURL();
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
                  `?client_id=${encodeURIComponent(FIREBASE_CONFIG.clientId)}` +
                  `&response_type=token%20id_token` +
                  `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
                  `&scope=openid%20profile%20email` +
                  `&nonce=${Math.random().toString(36).substring(2)}`;

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, async (redirectResultUrl) => {
      if (chrome.runtime.lastError || !redirectResultUrl) {
        return reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : "ورود لغو شد."));
      }

      try {
        // Extract parameters from hash fragment
        const urlParams = new URLSearchParams(new URL(redirectResultUrl).hash.substring(1));
        const googleIdToken = urlParams.get('id_token');
        const googleAccessToken = urlParams.get('access_token');
        
        if (!googleIdToken) {
          throw new Error("توکن گوگل دریافت نشد.");
        }

        if (USE_CUSTOM_SERVER) {
          // Fetch user profile info from Google API
          const userinfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
            headers: { 'Authorization': `Bearer ${googleAccessToken}` }
          });
          
          if (!userinfoRes.ok) {
            throw new Error("خطا در دریافت پروفایل کاربر از گوگل.");
          }
          
          const userinfo = await userinfoRes.json();
          
          const authInfo = {
            uid: userinfo.sub,
            displayName: userinfo.name || userinfo.email.split('@')[0],
            email: userinfo.email,
            photoUrl: userinfo.picture || '../assets/icons/icon-48.png',
            idToken: googleIdToken, // Direct Google ID token sent to our server
            expiresAt: Date.now() + 3600 * 1000 // Google ID tokens are valid for 1 hour
          };

          await chrome.storage.local.set({ auth: authInfo });
          return resolve(authInfo);
        }

        // --- Firebase Mode fallback ---
        const firebaseAuthUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_CONFIG.apiKey}`;
        const firebaseRes = await fetch(firebaseAuthUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requestUri: "http://localhost",
            postBody: `id_token=${googleIdToken}&providerId=google.com`,
            returnSecureToken: true
          })
        });

        if (!firebaseRes.ok) {
          const errData = await firebaseRes.json();
          throw new Error(errData.error?.message || "خطا در احراز هویت با فایربیس.");
        }

        const firebaseData = await firebaseRes.json();
        
        const authInfo = {
          uid: firebaseData.localId,
          displayName: firebaseData.displayName || firebaseData.email.split('@')[0],
          email: firebaseData.email,
          photoUrl: firebaseData.photoUrl || '../assets/icons/icon-48.png',
          idToken: firebaseData.idToken,
          refreshToken: firebaseData.refreshToken,
          expiresAt: Date.now() + (parseInt(firebaseData.expiresIn) * 1000)
        };

        await chrome.storage.local.set({ auth: authInfo });
        resolve(authInfo);
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Log out
async function logout() {
  await chrome.storage.local.remove(['auth']);
}

// Request an OTP code be sent to a phone number via sms.ir
async function requestPhoneOtp(phone) {
  const res = await fetch(`${CUSTOM_SERVER_URL}/api/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "خطا در ارسال کد تایید.");
  }
  return data;
}

// Verify the OTP code and log the user in with a phone number
async function loginWithPhoneOtp(phone, code) {
  const res = await fetch(`${CUSTOM_SERVER_URL}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "کد تایید نامعتبر است.");
  }

  const authInfo = {
    uid: data.uid,
    displayName: data.displayName || data.phone,
    email: '',
    phone: data.phone,
    photoUrl: '../assets/icons/icon-48.png',
    idToken: data.token, // Our own session token, sent as Bearer to the server
    expiresAt: data.expiresAt
  };

  await chrome.storage.local.set({ auth: authInfo });
  return authInfo;
}

// Push status to Server/Firestore
async function publishReadingStatus(bookTitle, author, currentPage, totalPages, status, isReadingNow = false) {
  if (!isConfigured()) return;
  
  const idToken = await getAuthToken();
  if (!idToken) return;

  const data = await chrome.storage.local.get(['auth']);
  const auth = data.auth;
  if (!auth) return;

  if (USE_CUSTOM_SERVER) {
    const url = `${CUSTOM_SERVER_URL}/api/reading-status`;
    const payload = {
      bookTitle: bookTitle || "",
      author: author || "",
      currentPage: currentPage || 0,
      totalPages: totalPages || 0,
      status: status || "reading",
      isReadingNow: isReadingNow
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const err = await res.json();
        console.error("Failed to write reading status to Custom Server:", err);
      }
    } catch (err) {
      console.error("Custom Server network error:", err);
    }
    return;
  }

  // --- Firebase Mode fallback ---
  const uid = auth.uid;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/reading_statuses/${uid}?key=${FIREBASE_CONFIG.apiKey}`;

  const payload = {
    fields: {
      uid: { stringValue: uid },
      displayName: { stringValue: auth.displayName },
      photoUrl: { stringValue: auth.photoUrl },
      bookTitle: { stringValue: bookTitle || "" },
      author: { stringValue: author || "" },
      currentPage: { integerValue: String(currentPage || 0) },
      totalPages: { integerValue: String(totalPages || 0) },
      status: { stringValue: status || "reading" },
      updatedAt: { integerValue: String(Date.now()) },
      isReadingNow: { booleanValue: isReadingNow }
    }
  };

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const err = await res.json();
      console.error("Failed to write reading status to Firestore:", err);
    }
  } catch (err) {
    console.error("Firestore network error:", err);
  }
}

// Fetch all social reading statuses
async function fetchSocialStatuses() {
  if (!isConfigured()) return [];

  if (USE_CUSTOM_SERVER) {
    const url = `${CUSTOM_SERVER_URL}/api/social-feed`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("Error fetching feed from Custom Server:", await res.json());
        return [];
      }
      return await res.json();
    } catch (err) {
      console.error("Fetch social statuses error (Custom Server):", err);
      return [];
    }
  }

  // --- Firebase Mode fallback ---
  const idToken = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents:runQuery?key=${FIREBASE_CONFIG.apiKey}`;
  
  const query = {
    structuredQuery: {
      from: [{ collectionId: "reading_statuses" }],
      orderBy: [{ field: { fieldPath: "updatedAt" }, direction: "DESCENDING" }],
      limit: 30
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(query)
    });

    if (!res.ok) {
      console.error("Error running query:", await res.json());
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const list = [];
    data.forEach(item => {
      if (item.document && item.document.fields) {
        const fields = item.document.fields;
        list.push({
          uid: fields.uid?.stringValue || "",
          displayName: fields.displayName?.stringValue || "کتاب‌خوان ناشناس",
          photoUrl: fields.photoUrl?.stringValue || "../assets/icons/icon-48.png",
          bookTitle: fields.bookTitle?.stringValue || "",
          author: fields.author?.stringValue || "",
          currentPage: parseInt(fields.currentPage?.integerValue || "0"),
          totalPages: parseInt(fields.totalPages?.integerValue || "0"),
          status: fields.status?.stringValue || "",
          updatedAt: parseInt(fields.updatedAt?.integerValue || "0"),
          isReadingNow: fields.isReadingNow?.booleanValue || false
        });
      }
    });

    return list;
  } catch (err) {
    console.error("Fetch social statuses error:", err);
    return [];
  }
}

// --- Book metadata (publisher/summary/cover), always cached server-side ---
async function getBookInfo(title, author) {
  try {
    const url = `${CUSTOM_SERVER_URL}/api/book-info?title=${encodeURIComponent(title || '')}&author=${encodeURIComponent(author || '')}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Fetch book info error:", err);
    return null;
  }
}

// --- Onboarding taste-wizard preferences, stored server-side per account ---
async function getPreferences() {
  const idToken = await getAuthToken();
  if (!idToken) return null;

  try {
    const res = await fetch(`${CUSTOM_SERVER_URL}/api/preferences`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Fetch preferences error:", err);
    return null;
  }
}

async function savePreferences(prefs) {
  const idToken = await getAuthToken();
  if (!idToken) throw new Error("برای ذخیره سلیقه مطالعه باید وارد حساب کاربری شوید.");

  const res = await fetch(`${CUSTOM_SERVER_URL}/api/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(prefs)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "خطا در ذخیره سلیقه مطالعه.");
  return data;
}

// --- Server-side library (single source of truth for the user's books) ---
async function fetchServerLibrary() {
  const idToken = await getAuthToken();
  if (!idToken) return [];

  try {
    const res = await fetch(`${CUSTOM_SERVER_URL}/api/library`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("Fetch server library error:", err);
    return [];
  }
}

async function addServerLibraryBook(book) {
  const idToken = await getAuthToken();
  if (!idToken) throw new Error("برای افزودن کتاب به کتابخانه ابری باید وارد حساب کاربری شوید.");

  const res = await fetch(`${CUSTOM_SERVER_URL}/api/library`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(book)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "خطا در افزودن کتاب.");
  return data;
}

async function updateServerLibraryBook(id, changes) {
  const idToken = await getAuthToken();
  if (!idToken) return null;

  try {
    const res = await fetch(`${CUSTOM_SERVER_URL}/api/library/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(changes)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Update server library book error:", err);
    return null;
  }
}

async function deleteServerLibraryBook(id) {
  const idToken = await getAuthToken();
  if (!idToken) return null;

  try {
    const res = await fetch(`${CUSTOM_SERVER_URL}/api/library/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Delete server library book error:", err);
    return null;
  }
}

// --- Personal reading "story" (Wrapped-style) built from real server-side data ---
async function fetchReadingStory() {
  const idToken = await getAuthToken();
  if (!idToken) return null;

  try {
    const res = await fetch(`${CUSTOM_SERVER_URL}/api/story`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Fetch reading story error:", err);
    return null;
  }
}
