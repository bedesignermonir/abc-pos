/**
 * ABC POS - Application Bootstrap & Event Handlers
 * Module: js/app.js
 */

// Modal backdrop click & Escape key listener
const modalCloseActions = {
  authLoginModal: () => { if (typeof closeAuthModal === 'function') closeAuthModal(); },
  settingsModal: () => { if (typeof closeSettings === 'function') closeSettings(); },
  invoiceModal: () => { if (typeof closeInvoiceModal === 'function') closeInvoiceModal(); },
  accountPasswordModal: () => { if (typeof closeAccountPasswordModal === 'function') closeAccountPasswordModal(); }
};

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', event => {
    if (event.target === modal && modalCloseActions[modal.id]) modalCloseActions[modal.id]();
  });
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const activeModals = [...document.querySelectorAll('.modal.active')];
  const activeModal = activeModals[activeModals.length - 1];
  if (activeModal && modalCloseActions[activeModal.id]) modalCloseActions[activeModal.id]();
});

// Network status listeners
window.addEventListener('online', () => {
  firestoreReconnectAttempts = 0;
  if (typeof reconnectFirestore === 'function') void reconnectFirestore();
});

window.addEventListener('offline', () => {
  if (typeof setSyncStatus === 'function') setSyncStatus('offline', 'ইন্টারনেট নেই · ডেটা লোকালি সংরক্ষিত');
});

// Cross-tab settings sync
window.addEventListener('storage', event => {
  if (event.key !== 'pos_settings' || !event.newValue) return;
  try {
    const updatedSettings = JSON.parse(event.newValue);
    if (!updatedSettings || typeof updatedSettings !== 'object' || Array.isArray(updatedSettings)) {
      throw new Error('Settings data must be an object');
    }
    settings = { ...settings, ...updatedSettings };
    if (typeof refreshPresetOptions === 'function') refreshPresetOptions();
    if (typeof populateExpenseCategoryOptions === 'function') populateExpenseCategoryOptions();
    if (typeof updateStats === 'function') updateStats();
    if (typeof renderInvoices === 'function') renderInvoices();
    if (typeof renderFinanceSummary === 'function') renderFinanceSummary();
  } catch (error) {
    console.error('Cross-tab settings sync failed:', error);
    if (typeof showToast === 'function') showToast('অন্য ট্যাবের সেটিংস সিঙ্ক করা যায়নি।', 'error');
  }
});

// Process redirect login if applicable
auth.getRedirectResult().then(result => {
  if (result && result.user) {
    console.log('Redirect sign-in successful for:', result.user.email);
  }
}).catch(error => {
  console.error('Google redirect sign-in failed:', error);
  if (typeof showToast === 'function' && typeof getGoogleAuthErrorMessage === 'function') {
    showToast(getGoogleAuthErrorMessage(error), 'error');
  }
});

// Authentication State Listener
let authBootstrapped = false;
auth.onAuthStateChanged(async user => {
  if (typeof isMasterAdmin === 'function' && isMasterAdmin(user)) {
    const alreadyRendered = authBootstrapped && currentUserId === user.uid;
    currentUser = user;
    currentUserId = user.uid;
    currentAccess = {
      role: 'Admin',
      accountStatus: 'approved',
      status: 'approved',
      email: user.email
    };
    renderAuthUI(user);
    applyBusinessBranding();
    startRoleSession(user, currentAccess);
    if (!alreadyRendered) void correctMasterAdminProfile(user);
    authBootstrapped = true;
    sessionStorage.removeItem('pos_auth_modal_dismissed');
    closeAuthModal();
    return;
  }

  if (user) {
    const alreadyRendered = authBootstrapped && currentUserId === user.uid;
    currentUser = user;
    currentUserId = user.uid;
    updateAccessGate('অ্যাকাউন্টের অনুমতি যাচাই হচ্ছে...', 'অ্যাকাউন্ট যাচাই');
    renderAuthUI(user);
    if (!alreadyRendered) {
      applyBusinessBranding();
      const access = await resolveUserAccess(user);
      if (auth.currentUser && auth.currentUser.uid === user.uid) {
        startRoleSession(user, access);
        if (!alreadyRendered && access.role !== 'Pending') {
          showToast('স্বাগতম, ' + (user.displayName || user.email) + '!');
        }
        watchAccountProfile(user);
      }
    }
    authBootstrapped = true;
    sessionStorage.removeItem('pos_auth_modal_dismissed');
    closeAuthModal();
  } else {
    currentUser = null;
    currentUserId = null;
    currentAccess = { role: 'Pending', status: 'pending' };
    if (accountProfileUnsubscribe) {
      accountProfileUnsubscribe();
      accountProfileUnsubscribe = null;
    }
    authBootstrapped = false;
    firestoreSnapshotStates = Object.create(null);
    if (firestoreReconnectTimer) {
      clearTimeout(firestoreReconnectTimer);
      firestoreReconnectTimer = null;
    }
    stopUserDataListeners();
    renderAuthUI(null);
    applyBusinessBranding();
    const appContent = document.querySelector('.no-print');
    if (appContent) appContent.inert = false;
    updateAccessGate('');
    if (!sessionStorage.getItem('pos_auth_modal_dismissed')) {
      setTimeout(() => openAuthModal(), 400);
    }
  }
});

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// Also run immediately if DOM is already parsed
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initApp();
}

let appInitialized = false;
function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  const itemsContainer = document.getElementById('itemsContainer');
  if (itemsContainer) itemsContainer.innerHTML = '';
  if (typeof addItem === 'function') addItem();
  if (typeof updateStats === 'function') updateStats();
  if (typeof renderInvoices === 'function') renderInvoices();
  if (typeof updateCurrentInvoiceNo === 'function') updateCurrentInvoiceNo();

  const now = new Date();
  const monthFilter = document.getElementById('monthFilter');
  if (monthFilter && !monthFilter.value) {
    monthFilter.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  if (typeof buildRegisterUI === 'function') buildRegisterUI();
  if (typeof loadRegister === 'function') loadRegister();
  if (typeof updateRegisterTotals === 'function') updateRegisterTotals();

  if (typeof buildExpensesUI === 'function') buildExpensesUI();
  if (typeof renderCreditorList === 'function') renderCreditorList();
  if (typeof renderExpenseList === 'function') renderExpenseList();
  if (typeof renderFinanceSummary === 'function') renderFinanceSummary();

  // Register input changes sync with Finance Summary
  const _origUpdateRegisterTotals = updateRegisterTotals;
  updateRegisterTotals = function () {
    _origUpdateRegisterTotals();
    try {
      if (typeof renderFinanceSummary === 'function') renderFinanceSummary();
    } catch (e) {
      console.error('সামারি রেন্ডার ত্রুটি:', e);
    }
  };

  document.querySelectorAll('#cashDenomGrid input, #balanceInputGrid input').forEach(inp => {
    inp.addEventListener('input', () => {
      try {
        if (typeof renderFinanceSummary === 'function') renderFinanceSummary();
      } catch (e) { }
    });
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(error => console.error('Service worker registration failed:', error));
  }
}
