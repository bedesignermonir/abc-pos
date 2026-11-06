/**
 * ABC POS - Firebase Multi-Tenant Architecture & Real-Time Sync
 * Module: js/firebase-service.js
 */

const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: 'AIzaSyCyqeeiDFEfhQLB4VrGra-UKVXORbnHyGA',
  authDomain: 'abc-pos-webapp.firebaseapp.com',
  projectId: 'abc-pos-webapp',
  storageBucket: 'abc-pos-webapp.firebasestorage.app',
  messagingSenderId: '316988028882',
  appId: '1:316988028882:web:319f8a418a5bf1fea8fa0b',
  measurementId: 'G-6TBPGJM44V'
};

const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
let analytics = null;
window.firebaseServices = { app, auth: null, db: null, analytics: null, persistenceReady: null };

const analyticsReady = firebase.analytics.isSupported()
  .then(supported => {
    if (!supported) return null;
    analytics = firebase.analytics(app);
    window.firebaseServices.analytics = analytics;
    return analytics;
  })
  .catch(error => {
    console.warn('Firebase Analytics is unavailable in this browser:', error);
    return null;
  });
window.firebaseServices.analyticsReady = analyticsReady;

const auth = firebase.auth(app);
try {
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(pErr => console.warn('Auth persistence set failed:', pErr));
} catch (pErr) {
  console.warn('Auth persistence unsupported:', pErr);
}

const db = firebase.firestore(app);
window.firebaseServices.auth = auth;
window.firebaseServices.db = db;

// Start multi-tab IndexedDB persistence before any Firestore reads or listeners
const firestorePersistenceReady = db.enablePersistence({ synchronizeTabs: true })
  .then(() => {
    console.info('Firestore multi-tab offline persistence enabled.');
    return true;
  })
  .catch(error => {
    if (error.code === 'failed-precondition') {
      console.warn('Firestore persistence is disabled because another tab already owns the cache; using in-memory cache.');
    } else if (error.code === 'unimplemented') {
      console.warn('Firestore persistence is unsupported in this browser; using in-memory cache.');
    } else {
      console.warn('Firestore persistence could not be enabled; using in-memory cache:', error);
    }
    return false;
  });
window.firebaseServices.persistenceReady = firestorePersistenceReady;

// Firestore Collection References
function getUserRef(uid = currentUserId) {
  if (!uid) throw new Error('ব্যবহারকারী লগইন করেননি');
  return db.collection('users').doc(uid);
}
function getSalesRef(uid = currentUserId) {
  return getUserRef(uid).collection('sales');
}
function getExpensesRef(uid = currentUserId) {
  return getUserRef(uid).collection('expenses');
}
function getCreditorsRef(uid = currentUserId) {
  return getUserRef(uid).collection('creditors');
}
function getCashRegisterRef(uid = currentUserId) {
  return getUserRef(uid).collection('cash_register');
}
function getSettingsRef(uid = currentUserId) {
  return getUserRef(uid).collection('settings').doc('doc');
}
function getPresetsRef(uid = currentUserId) {
  return getUserRef(uid).collection('settings').doc('presets');
}
function getBusinessRef() {
  return db.collection('businesses').doc(BUSINESS_TENANT_ID);
}
function getMembersRef() {
  return getBusinessRef().collection('members');
}
function getPartnerSalesRef() {
  return getBusinessRef().collection('partner_sales');
}
function getPartnerExpensesRef() {
  return getBusinessRef().collection('partner_expenses');
}

// Sync Status & Error Handling
function setSyncStatus(state, message) {
  const status = document.getElementById('syncStatus');
  const button = document.getElementById('syncNowButton');
  if (status) {
    status.dataset.state = state;
    status.textContent = message;
  }
  if (button) {
    button.disabled = state === 'syncing';
    button.textContent = state === 'synced' ? '✓ সব সিঙ্ক হয়েছে · আবার সিঙ্ক করুন' : '🔄 এখনই সিঙ্ক করুন';
  }
}

function isFirestoreOfflineError(error) {
  const message = String(error && error.message || '');
  return !navigator.onLine
    || ['unavailable', 'network-request-failed', 'deadline-exceeded'].includes(error && error.code)
    || /client is offline|network unavailable|network error/i.test(message);
}

function showFirestoreOperationError(error, fallbackMessage) {
  if (isFirestoreOfflineError(error)) {
    setSyncStatus('offline', 'ইন্টারনেট নেই · ডেটা লোকালি সংরক্ষিত, পরে সিঙ্ক হবে');
    console.warn('Firestore operation is queued for reconnect:', error);
    scheduleFirestoreReconnect();
    return;
  }
  showToast(fallbackMessage + (error && error.message ? ': ' + error.message : ''), 'error');
}

function checkSyncStatus() {
  if (!currentUserId) {
    setSyncStatus('offline', 'লোকাল ডেটা · Google-এ সাইন-ইন করুন');
    return;
  }
  if (!navigator.onLine) {
    setSyncStatus('offline', 'ইন্টারনেট নেই · ডেটা লোকালি সংরক্ষিত');
    return;
  }
  const states = Object.values(firestoreSnapshotStates);
  if (!states.length) {
    setSyncStatus('pending', 'Firebase-এর সঙ্গে সংযোগ হচ্ছে…');
  } else if (states.some(state => state.fromCache)) {
    setSyncStatus('pending', 'লোকাল ডেটা দেখানো হচ্ছে · Firebase-এ সিঙ্ক হচ্ছে');
  } else if (states.some(state => state.hasPendingWrites)) {
    setSyncStatus('pending', 'ডেটা Firebase-এ সিঙ্ক হচ্ছে…');
  } else {
    setSyncStatus('synced', 'Firebase-এর সঙ্গে সিঙ্ক হয়েছে');
  }
}

function forceSyncNow() {
  if (!currentUserId) {
    setSyncStatus('offline', 'সিঙ্ক করতে Google-এ সাইন-ইন করুন');
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }
  if (!navigator.onLine) {
    setSyncStatus('offline', 'ইন্টারনেট নেই · সংযোগ ফিরে এলে আবার চেষ্টা করুন');
    return;
  }
  setSyncStatus('pending', 'পেন্ডিং ডেটা Firebase-এ সিঙ্ক হচ্ছে…');
  void db.enableNetwork()
    .then(() => attachFirestoreListeners(currentUserId))
    .catch(error => {
      console.warn('Firebase sync requested; waiting for automatic reconnect:', error);
      setSyncStatus(isFirestoreOfflineError(error) ? 'offline' : 'pending',
        'ডেটা লোকালি সংরক্ষিত · সংযোগ হলে Firebase-এ সিঙ্ক হবে');
    });
}

function handleFirestoreSyncError(label, error) {
  console.warn(label + ' listener:', error);
  if (!currentUserId) return;
  const isOffline = isFirestoreOfflineError(error);
  setSyncStatus(
    isOffline ? (navigator.onLine ? 'pending' : 'offline') : 'error',
    isOffline
      ? 'ইন্টারনেট/সার্ভার সংযোগ নেই · লোকাল/ক্যাশ ডেটা ব্যবহার হচ্ছে'
      : 'Firebase ' + label + ' সিঙ্ক হয়নি · আবার চেষ্টা করুন'
  );
  if (isOffline) scheduleFirestoreReconnect();
}

function handleFirestoreSnapshot(snapshot, label) {
  firestoreSnapshotStates[label] = {
    fromCache: snapshot.metadata.fromCache,
    hasPendingWrites: snapshot.metadata.hasPendingWrites
  };
  checkSyncStatus();
  if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
    firestoreReconnectAttempts = 0;
    if (firestoreReconnectTimer) {
      clearTimeout(firestoreReconnectTimer);
      firestoreReconnectTimer = null;
    }
  }
}

function applyPresetSettingsFromCloud(remote) {
  let changed = false;
  ['presetItems', 'expenseCategories', 'costPrices', 'sellingPrices'].forEach(key => {
    if (remote[key] !== undefined && JSON.stringify(remote[key]) !== JSON.stringify(settings[key])) {
      settings[key] = remote[key];
      changed = true;
    }
  });
  if (!changed) return;

  localStorage.setItem('pos_settings', JSON.stringify(settings));
  if (typeof isMasterAdmin === 'function' && isMasterAdmin()) {
    trackFirestoreWrite(() => getBusinessRef().set({
      presetItems: settings.presetItems || '',
      costPrices: settings.costPrices || {},
      sellingPrices: settings.sellingPrices || {},
      updatedAt: new Date().toISOString()
    }, { merge: true }), 'পার্টনার প্রি-সেট ক্যাটালগ');
  }
  if (typeof refreshPresetOptions === 'function') refreshPresetOptions();
  if (typeof populateExpenseCategoryOptions === 'function') populateExpenseCategoryOptions();
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal && settingsModal.classList.contains('active')) {
    if (typeof populateSettingsFormFromCurrent === 'function') populateSettingsFormFromCurrent();
  }
  if (typeof updateStats === 'function') updateStats();
  if (typeof renderInvoices === 'function') renderInvoices();
  if (typeof renderFinanceSummary === 'function') renderFinanceSummary();
}

function migrateLegacyPresetSettingsIfNeeded(uid = currentUserId) {
  if (!uid || uid !== currentUserId || presetsSnapshotExists !== false || !legacySettingsSnapshot || !legacySettingsSnapshot.exists || presetMigrationStarted) {
    return;
  }
  const legacy = legacySettingsSnapshot.data();
  const presets = {};
  ['presetItems', 'expenseCategories', 'costPrices', 'sellingPrices'].forEach(key => {
    if (legacy[key] !== undefined) presets[key] = legacy[key];
  });
  if (!Object.keys(presets).length) return;

  presetMigrationStarted = true;
  applyPresetSettingsFromCloud(presets);
  const presetsRef = getPresetsRef(uid);
  trackFirestoreWrite(
    () => presetsRef.set(presets, { merge: true }),
    'প্রি-সেট তালিকা স্থানান্তর'
  );
}

function scheduleFirestoreReconnect() {
  if (!currentUserId || firestoreReconnectTimer) return;
  const delay = Math.min(30000, 1000 * (2 ** Math.min(firestoreReconnectAttempts, 5)));
  firestoreReconnectAttempts += 1;
  firestoreReconnectTimer = setTimeout(() => {
    firestoreReconnectTimer = null;
    void reconnectFirestore();
  }, delay);
}

async function reconnectFirestore() {
  const uid = currentUserId;
  if (!uid) return;
  if (!navigator.onLine) {
    setSyncStatus('offline', 'ইন্টারনেট নেই · ডেটা লোকালি সংরক্ষিত, সংযোগ এলে আবার চেষ্টা হবে');
    return;
  }
  if (firestoreReconnectTimer) {
    clearTimeout(firestoreReconnectTimer);
    firestoreReconnectTimer = null;
  }
  try {
    await db.enableNetwork();
    await attachFirestoreListeners(uid);
  } catch (error) {
    console.error('Firestore reconnect failed:', error);
    setSyncStatus('error', 'Firebase পুনরায় সংযোগ করতে পারেনি · আবার চেষ্টা করা হবে');
    scheduleFirestoreReconnect();
  }
}

async function attachFirestoreListeners(uid) {
  await firestorePersistenceReady;
  if (currentUserId !== uid) return;
  firestoreUnsubscribers.forEach(unsub => { try { unsub(); } catch (e) { } });
  firestoreUnsubscribers = [];
  firestoreSnapshotStates = Object.create(null);
  presetsSnapshotExists = null;
  legacySettingsSnapshot = null;
  presetMigrationStarted = false;
  setSyncStatus(navigator.onLine ? 'pending' : 'offline',
    navigator.onLine ? 'Firebase-এর সঙ্গে সংযোগ হচ্ছে…' : 'ইন্টারনেট নেই · ডেটা লোকালি সংরক্ষিত');

  // 1. Sales / Invoices Listener
  const unsubSales = getSalesRef(uid).orderBy('date', 'desc').onSnapshot({ includeMetadataChanges: true }, snap => {
    invoices = snap.docs.map(doc => typeof normalizeInvoiceFinancials === 'function' ? normalizeInvoiceFinancials(doc.data()) : doc.data());
    localStorage.setItem('pos_invoices', JSON.stringify(invoices));
    let maxNum = 0;
    invoices.forEach(inv => {
      const match = String(inv.invoiceNo || '').match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1]);
        if (n > maxNum) maxNum = n;
      }
    });
    nextInvoiceNumber = maxNum > 0 ? maxNum + 1 : 1;
    localStorage.setItem('pos_next_inv_no', nextInvoiceNumber.toString());
    if (typeof updateStats === 'function') updateStats();
    if (typeof renderInvoices === 'function') renderInvoices();
    if (typeof updateCurrentInvoiceNo === 'function') updateCurrentInvoiceNo();
    handleFirestoreSnapshot(snap, 'বিক্রয়');
  }, err => handleFirestoreSyncError('বিক্রয়', err));
  firestoreUnsubscribers.push(unsubSales);

  // 2. Expenses Listener
  const unsubExpenses = getExpensesRef(uid).orderBy('date', 'desc').onSnapshot({ includeMetadataChanges: true }, snap => {
    expenses = snap.docs.map(doc => doc.data());
    if (typeof saveExpenses === 'function') saveExpenses();
    if (typeof renderExpenseList === 'function') renderExpenseList();
    if (typeof renderFinanceSummary === 'function') renderFinanceSummary();
    handleFirestoreSnapshot(snap, 'খরচ');
  }, err => handleFirestoreSyncError('খরচ', err));
  firestoreUnsubscribers.push(unsubExpenses);

  // 3. Creditors Listener
  const unsubCreditors = getCreditorsRef(uid).onSnapshot({ includeMetadataChanges: true }, snap => {
    creditors = snap.docs.map(doc => doc.data());
    if (typeof saveCreditors === 'function') saveCreditors();
    if (typeof renderCreditorList === 'function') renderCreditorList();
    if (typeof updateNetAssetsCard === 'function') updateNetAssetsCard();
    if (typeof renderFinanceSummary === 'function') renderFinanceSummary();
    handleFirestoreSnapshot(snap, 'পাওনাদার');
  }, err => handleFirestoreSyncError('পাওনাদার', err));
  firestoreUnsubscribers.push(unsubCreditors);

  // 4. Cash Register Listener
  const unsubCash = getCashRegisterRef(uid).orderBy('date', 'desc').limit(30).onSnapshot({ includeMetadataChanges: true }, snap => {
    cashHistoryRecords = snap.docs.map(doc => doc.data());
    if (typeof renderCashHistory === 'function') renderCashHistory();
    if (cashHistoryRecords.length) {
      const latest = cashHistoryRecords[0];
      if (typeof loadRegister === 'function') loadRegister(latest);
      localStorage.setItem('pos_cash_register', JSON.stringify(latest));
      if (typeof updateRegisterTotals === 'function') updateRegisterTotals();
      if (typeof updateNetAssetsCard === 'function') updateNetAssetsCard();
    }
    handleFirestoreSnapshot(snap, 'ক্যাশ');
  }, err => handleFirestoreSyncError('ক্যাশ', err));
  firestoreUnsubscribers.push(unsubCash);

  // 5. Settings Listener
  const unsubSettings = getSettingsRef(uid).onSnapshot({ includeMetadataChanges: true }, snap => {
    legacySettingsSnapshot = snap;
    if (snap.exists) {
      const remote = snap.data();
      let changed = false;
      ['businessName', 'businessTagline', 'businessPhone', 'businessAddress', 'businessWebsite', 'businessLogo'].forEach(k => {
        if (remote[k] !== undefined && JSON.stringify(remote[k]) !== JSON.stringify(settings[k])) {
          settings[k] = remote[k];
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('pos_settings', JSON.stringify(settings));
        if (typeof refreshPresetOptions === 'function') refreshPresetOptions();
        if (typeof applyBusinessBranding === 'function') applyBusinessBranding();
        if (typeof updateStats === 'function') updateStats();
        if (typeof renderInvoices === 'function') renderInvoices();
        if (typeof renderFinanceSummary === 'function') renderFinanceSummary();
      }
    }
    migrateLegacyPresetSettingsIfNeeded(uid);
    handleFirestoreSnapshot(snap, 'সেটিংস');
  }, err => handleFirestoreSyncError('সেটিংস', err));
  firestoreUnsubscribers.push(unsubSettings);

  // 6. Presets Listener
  const unsubPresets = getPresetsRef(uid).onSnapshot({ includeMetadataChanges: true }, snap => {
    if (snap.exists) {
      presetsSnapshotExists = true;
      applyPresetSettingsFromCloud(snap.data());
    } else if (!snap.metadata.fromCache) {
      presetsSnapshotExists = false;
      migrateLegacyPresetSettingsIfNeeded(uid);
    }
    handleFirestoreSnapshot(snap, 'প্রি-সেট');
  }, err => handleFirestoreSyncError('প্রি-সেট', err));
  firestoreUnsubscribers.push(unsubPresets);
}

function stopBusinessListeners() {
  businessUnsubscribers.forEach(unsubscribe => { try { unsubscribe(); } catch (error) { } });
  businessUnsubscribers = [];
}

function stopUserDataListeners() {
  firestoreUnsubscribers.forEach(unsubscribe => { try { unsubscribe(); } catch (error) { } });
  firestoreUnsubscribers = [];
  stopBusinessListeners();
}

async function ensureBusinessWorkspace() {
  const businessRef = getBusinessRef();
  try {
    const snapshot = await businessRef.get();
    if (!snapshot.exists) {
      await businessRef.set({
        name: BUSINESS.name,
        operationalCashBalance: Math.max(0, typeof registerCashTotal === 'function' ? registerCashTotal() : 0),
        presetItems: settings.presetItems || '',
        costPrices: settings.costPrices || {},
        sellingPrices: settings.sellingPrices || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      await businessRef.set({
        presetItems: settings.presetItems || '',
        costPrices: settings.costPrices || {},
        sellingPrices: settings.sellingPrices || {},
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (error) {
    showFirestoreOperationError(error, 'ব্যবসার সেটেলমেন্ট হিসাব লোড হয়নি');
  }
}

async function getFirestoreSnapshotWithFallback(query, label) {
  if (!navigator.onLine) {
    try {
      return await query.get({ source: 'cache' });
    } catch (error) {
      console.warn('Firestore cache unavailable for ' + label + ':', error);
      if (isFirestoreOfflineError(error)) {
        showFirestoreOperationError(error, label + ' ডেটা লোড হয়নি');
        throw error;
      }
      throw new Error(label + ' এর ক্যাশ ডেটা পাওয়া যায়নি। ইন্টারনেট সংযোগ করে আবার চেষ্টা করুন।');
    }
  }
  try {
    return await query.get();
  } catch (serverError) {
    console.warn('Firestore server fetch failed for ' + label + '; trying cache:', serverError);
    try {
      const cachedSnapshot = await query.get({ source: 'cache' });
      if (currentUserId) {
        setSyncStatus('pending', label + ' · ক্যাশ ডেটা দেখানো হচ্ছে, Firebase-এ পুনরায় চেষ্টা হচ্ছে');
        scheduleFirestoreReconnect();
      }
      return cachedSnapshot;
    } catch (cacheError) {
      console.error('Firestore cache fallback failed for ' + label + ':', cacheError);
      if (isFirestoreOfflineError(cacheError)) {
        showFirestoreOperationError(cacheError, label + ' ডেটা লোড হয়নি');
        throw cacheError;
      }
      throw new Error(label + ' Firebase থেকে বা ক্যাশ থেকে লোড হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
    }
  }
}

async function refreshFromFirebase() {
  if (!currentUserId) {
    showToast('অনুরোধ করতে অনুগ্রহ করে প্রথমে লগইন করুন', 'error');
    if (typeof openAuthModal === 'function') openAuthModal();
    return false;
  }
  setSyncStatus(navigator.onLine ? 'pending' : 'offline',
    navigator.onLine ? 'Firebase থেকে ডেটা রিফ্রেশ হচ্ছে…' : 'ক্যাশ ডেটা লোড হচ্ছে…');
  try {
    await firestorePersistenceReady;
    const [salesSnap, credSnap, expSnap, cashSnap, setSnap, presetsSnap] = await Promise.all([
      getFirestoreSnapshotWithFallback(getSalesRef().orderBy('date', 'desc'), 'বিক্রয়'),
      getFirestoreSnapshotWithFallback(getCreditorsRef(), 'পাওনাদার'),
      getFirestoreSnapshotWithFallback(getExpensesRef().orderBy('date', 'desc'), 'খরচ'),
      getFirestoreSnapshotWithFallback(getCashRegisterRef().orderBy('date', 'desc').limit(30), 'ক্যাশ'),
      getFirestoreSnapshotWithFallback(getSettingsRef(), 'সেটিংস'),
      getFirestoreSnapshotWithFallback(getPresetsRef(), 'প্রি-সেট')
    ]);

    invoices = salesSnap.docs.map(doc => typeof normalizeInvoiceFinancials === 'function' ? normalizeInvoiceFinancials(doc.data()) : doc.data());
    localStorage.setItem('pos_invoices', JSON.stringify(invoices));

    let maxNum = 0;
    invoices.forEach(inv => {
      const match = String(inv.invoiceNo || '').match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1]);
        if (n > maxNum) maxNum = n;
      }
    });
    nextInvoiceNumber = maxNum > 0 ? maxNum + 1 : 1;
    localStorage.setItem('pos_next_inv_no', nextInvoiceNumber.toString());

    creditors = credSnap.docs.map(doc => doc.data());
    if (typeof saveCreditors === 'function') saveCreditors();

    expenses = expSnap.docs.map(doc => doc.data());
    if (typeof saveExpenses === 'function') saveExpenses();

    cashHistoryRecords = cashSnap.docs.map(doc => doc.data());
    if (typeof renderCashHistory === 'function') renderCashHistory();
    if (cashHistoryRecords.length) {
      const latest = cashHistoryRecords[0];
      if (typeof loadRegister === 'function') loadRegister(latest);
      localStorage.setItem('pos_cash_register', JSON.stringify(latest));
    }

    if (setSnap.exists) {
      const remote = setSnap.data();
      ['businessName', 'businessTagline', 'businessPhone', 'businessAddress', 'businessWebsite', 'businessLogo'].forEach(key => {
        if (remote[key] !== undefined) settings[key] = remote[key];
      });
      localStorage.setItem('pos_settings', JSON.stringify(settings));
      if (typeof applyBusinessBranding === 'function') applyBusinessBranding();
    }

    if (typeof updateStats === 'function') updateStats();
    if (typeof renderInvoices === 'function') renderInvoices();
    if (typeof renderCreditorList === 'function') renderCreditorList();
    if (typeof renderExpenseList === 'function') renderExpenseList();
    if (typeof renderFinanceSummary === 'function') renderFinanceSummary();
    if (typeof updateCurrentInvoiceNo === 'function') updateCurrentInvoiceNo();

    const usedCache = [salesSnap, credSnap, expSnap, cashSnap, setSnap, presetsSnap].some(snap => snap.metadata.fromCache);
    if (usedCache) {
      setSyncStatus(navigator.onLine ? 'pending' : 'offline', 'ক্যাশ ডেটা দেখানো হচ্ছে · Firebase-এ সিঙ্ক বাকি');
      showToast('ক্যাশ ডেটা দেখানো হয়েছে · সংযোগ ফিরে এলে Firebase-এ সিঙ্ক হবে');
    } else {
      setSyncStatus('synced', 'Firebase-এর সঙ্গে সিঙ্ক হয়েছে');
      showToast('✓ Firebase ক্লাউড থেকে সব ডাটা সফলভাবে রিফ্রেশ হয়েছে');
    }
    return true;
  } catch (error) {
    console.error('Refresh error:', error);
    setSyncStatus(navigator.onLine ? 'error' : 'offline', navigator.onLine
      ? 'Firebase ডেটা রিফ্রেশ হয়নি · আবার চেষ্টা করুন'
      : 'ইন্টারনেট নেই · লোকাল ডেটা অক্ষত আছে');
    if (!isFirestoreOfflineError(error)) {
      showToast('ডেটা রিফ্রেশ হয়নি। লোকাল ডেটা অক্ষত আছে; ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।', 'error');
    }
    return false;
  }
}

async function testFirebaseConnection() {
  if (!currentUserId) {
    showToast('কানেকশন টেস্ট করতে প্রথমে লগইন করুন', 'error');
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }
  if (!navigator.onLine) {
    setSyncStatus('offline', 'ইন্টারনেট নেই · সংযোগ ফিরে এলে পরীক্ষা করুন');
    showToast('ইন্টারনেট সংযোগ ছাড়া Firebase পরীক্ষা করা যাবে না।', 'error');
    return;
  }
  try {
    await firestorePersistenceReady;
    await db.enableNetwork();
    void attachFirestoreListeners(currentUserId);
    setSyncStatus('pending', 'Firebase সংযোগ পরীক্ষা হচ্ছে · ডেটা লোকালি নিরাপদ আছে');
    showToast('Firebase সংযোগ পরীক্ষা শুরু হয়েছে · স্ট্যাটাস আপডেট হলে দেখা যাবে');
  } catch (error) {
    showFirestoreOperationError(error, 'Firebase পারমিশন ত্রুটি');
  }
}

// Track Writes to Firestore
function trackFirestoreWrite(writeOperation, label) {
  if (!currentUserId) return true;
  setSyncStatus(navigator.onLine ? 'pending' : 'offline',
    navigator.onLine ? 'ডেটা Firebase-এ সিঙ্ক হচ্ছে…' : 'ডেটা লোকালি সেভ · সংযোগ এলে সিঙ্ক হবে');
  Promise.resolve(firestorePersistenceReady).then(() => writeOperation()).then(() => {
    checkSyncStatus();
  }).catch(error => {
    console.warn('Firestore ' + label + ' write remains unsynced:', error);
    if (isFirestoreOfflineError(error)) {
      setSyncStatus(navigator.onLine ? 'pending' : 'offline',
        'ডেটা লোকালি সেভ · সংযোগ হলে Firebase-এ সিঙ্ক হবে');
      scheduleFirestoreReconnect();
    } else {
      showFirestoreOperationError(error, label + ' Firebase-এ সিঙ্ক হয়নি');
    }
  });
  return true;
}

function saveInvoiceToFirebase(invoice) {
  return trackFirestoreWrite(
    () => getSalesRef().doc(String(invoice.id)).set(invoice, { merge: true }),
    'ইনভয়েস'
  );
}

function deleteInvoiceFromFirebase(id) {
  return trackFirestoreWrite(
    () => getSalesRef().doc(String(id)).delete(),
    'ইনভয়েস মুছে ফেলা'
  );
}

function saveCreditorToFirebase(creditor) {
  return trackFirestoreWrite(
    () => getCreditorsRef().doc(String(creditor.id)).set(creditor, { merge: true }),
    'পাওনাদার'
  );
}

function removeCreditorFromFirebase(id) {
  return trackFirestoreWrite(
    () => getCreditorsRef().doc(String(id)).delete(),
    'পাওনাদার মুছে ফেলা'
  );
}

function saveExpenseToFirebase(expense) {
  return trackFirestoreWrite(
    () => getExpensesRef().doc(String(expense.id)).set(expense, { merge: true }),
    'খরচ'
  );
}

function removeExpenseFromFirebase(id) {
  return trackFirestoreWrite(
    () => getExpensesRef().doc(String(id)).delete(),
    'খরচ মুছে ফেলা'
  );
}

function saveCashRegisterToFirebase(record) {
  return trackFirestoreWrite(
    () => getCashRegisterRef().doc(String(record.id)).set(record, { merge: true }),
    'ক্যাশ রেজিস্টার'
  );
}

function saveSettingsToFirebase() {
  const uid = currentUserId;
  if (!uid) return false;
  const settingsRef = getSettingsRef(uid);
  const presetsRef = getPresetsRef(uid);
  const settingsSaved = trackFirestoreWrite(() => settingsRef.set({
    businessName: settings.businessName || '',
    businessTagline: settings.businessTagline || '',
    businessPhone: settings.businessPhone || '',
    businessAddress: settings.businessAddress || '',
    businessWebsite: settings.businessWebsite || '',
    businessLogo: settings.businessLogo || '',
    updatedAt: new Date().toISOString()
  }, { merge: true }), 'ব্যবসার সেটিংস');
  const presetsSaved = trackFirestoreWrite(() => presetsRef.set({
    presetItems: settings.presetItems || '',
    expenseCategories: settings.expenseCategories || '',
    costPrices: settings.costPrices || {},
    sellingPrices: settings.sellingPrices || {},
    updatedAt: new Date().toISOString()
  }, { merge: true }), 'প্রি-সেট তালিকা');
  const catalogSaved = (typeof isMasterAdmin === 'function' && isMasterAdmin())
    ? trackFirestoreWrite(() => getBusinessRef().set({
      presetItems: settings.presetItems || '',
      costPrices: settings.costPrices || {},
      sellingPrices: settings.sellingPrices || {},
      updatedAt: new Date().toISOString()
    }, { merge: true }), 'পার্টনার প্রি-সেট ক্যাটালগ')
    : true;
  return settingsSaved && presetsSaved && catalogSaved;
}
