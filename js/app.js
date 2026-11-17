/**
 * ABC POS - Application Bootstrap & Event Handlers
 * Module: js/app.js
 */

window.addEventListener('online', () => {
  firestoreReconnectAttempts = 0;
  void reconnectFirestore();
});

window.addEventListener('offline', () => {
  setSyncStatus('offline', 'ইন্টারনেট নেই · ডেটা লোকালি সংরক্ষিত');
});

invoices = invoices.map(normalizeInvoiceFinancials);

localStorage.setItem('pos_invoices', JSON.stringify(invoices));

document.addEventListener('DOMContentLoaded', () => {
  const itemsContainer = document.getElementById('itemsContainer');
  if (itemsContainer) itemsContainer.innerHTML = '';
  addItem();
  updateStats();
  renderInvoices();
  renderSalesMetrics();
  updateCurrentInvoiceNo();
  const now = new Date();
  const monthFilter = document.getElementById('monthFilter');
  if (monthFilter && !monthFilter.value) {
    monthFilter.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  buildRegisterUI();
  loadRegister();
  initializeExpectedCashBalance();
  updateRegisterTotals();

  buildExpensesUI();
  renderCreditorList();
  renderExpenseList();
  renderFinanceSummary();

  const _origUpdateRegisterTotals = updateRegisterTotals;
  updateRegisterTotals = function () {
    _origUpdateRegisterTotals();
    try { renderFinanceSummary(); } catch (e) { console.error('সামারি রেন্ডার ত্রুটি:', e); }
  };
  document.querySelectorAll('#cashDenomGrid input, #balanceInputGrid input').forEach(inp => {
    inp.addEventListener('input', () => { try { renderFinanceSummary(); } catch (e) { } });
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(error => console.error('Service worker registration failed:', error));
  }

  // Wire up modal close handlers
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', event => {
      if (event.target !== modal) return;
      if (modal.id === 'authLoginModal') closeAuthModal();
      else if (modal.id === 'settingsModal') closeSettings();
      else if (modal.id === 'invoiceModal') closeInvoiceModal();
      else if (modal.id === 'accountPasswordModal') closeAccountPasswordModal();
      else if (modal.id === 'cashReconcileModal') cancelCashReconciliation();
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const activeModals = [...document.querySelectorAll('.modal.active')];
    const activeModal = activeModals[activeModals.length - 1];
    if (!activeModal) return;
    if (activeModal.id === 'authLoginModal') closeAuthModal();
    else if (activeModal.id === 'settingsModal') closeSettings();
    else if (activeModal.id === 'invoiceModal') closeInvoiceModal();
    else if (activeModal.id === 'accountPasswordModal') closeAccountPasswordModal();
    else if (activeModal.id === 'cashReconcileModal') cancelCashReconciliation();
  });

  // Wire up tab navigation
  document.querySelectorAll('.app-nav [data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Wire up cross-tab settings sync
  window.addEventListener('storage', event => {
    if (event.key !== 'pos_settings' || !event.newValue) return;
    try {
      const updatedSettings = JSON.parse(event.newValue);
      if (!updatedSettings || typeof updatedSettings !== 'object' || Array.isArray(updatedSettings)) {
        throw new Error('Settings data must be an object');
      }
      settings = { ...settings, ...updatedSettings };
      refreshPresetOptions();
      populateExpenseCategoryOptions();
      updateStats();
      renderInvoices();
      renderFinanceSummary();
    } catch (error) {
      console.error('Cross-tab settings sync failed:', error);
      showToast('অন্য ট্যাবের সেটিংস সিঙ্ক করা যায়নি।', 'error');
    }
  });

  // Network status listeners
  window.addEventListener('online', () => {
    firestoreReconnectAttempts = 0;
    void reconnectFirestore();
  });
  window.addEventListener('offline', () => {
    setSyncStatus('offline', 'ইন্টারনেট নেই · ডেটা লোকালি সংরক্ষিত');
  });

  // Process redirect login if applicable
  auth.getRedirectResult().then(result => {
    if (result && result.user) {
      console.log('Redirect sign-in successful for:', result.user.email);
    }
  }).catch(error => {
    console.error('Google redirect sign-in failed:', error);
    showToast(getGoogleAuthErrorMessage(error), 'error');
  });

  // Auth state listener
  let authBootstrapped = false;
  auth.onAuthStateChanged(async user => {
    const nextUid = user ? user.uid : null;
    if (currentUserId !== nextUid) resetTenantPermissionRecovery(nextUid);
    if (isMasterAdmin(user)) {
      const alreadyRendered = authBootstrapped && currentUserId === user.uid;
      currentUser = user;
      currentUserId = user.uid;
      currentAccess = {
        role: 'Admin', accountStatus: 'approved', status: 'approved', email: user.email
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
});
