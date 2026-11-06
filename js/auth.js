/**
 * ABC POS - Authentication & Multi-Tenant Role Access Control
 * Module: js/auth.js
 */

function isMasterAdmin(user = currentUser) {
  return Boolean(user && (user.email === MASTER_ADMIN_EMAIL || user.uid === MASTER_ADMIN_UID));
}

function updateAccessGate(message, title = 'অ্যাকাউন্ট যাচাই হচ্ছে') {
  const gate = document.getElementById('accessGate');
  const titleEl = document.getElementById('accessGateTitle');
  const messageEl = document.getElementById('accessGateMessage');
  const loginButton = document.getElementById('accessGateLogin');
  const logoutButton = document.getElementById('accessGateLogout');
  const quote = document.getElementById('pendingQuote');
  const isPending = title === 'অনুমোদন অপেক্ষমাণ';
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (loginButton) loginButton.hidden = true;
  if (logoutButton) logoutButton.hidden = !currentUser;
  if (gate) gate.hidden = !message;
  if (quote) quote.hidden = !isPending;
  if (isPending) {
    const selected = PENDING_PATIENCE_QUOTES[Math.floor(Math.random() * PENDING_PATIENCE_QUOTES.length)];
    document.getElementById('pendingQuoteText').textContent = '“' + selected.text + '”';
    document.getElementById('pendingQuoteReference').textContent = '— ' + selected.reference;
    if (logoutButton) logoutButton.focus();
  }
  const appContent = document.querySelector('.no-print');
  if (appContent && message) appContent.inert = true;
}

function applyRoleVisibility() {
  const role = currentAccess.role;
  const isPartner = role === 'Partner/Staff';
  const isAdmin = role === 'Admin' || isMasterAdmin();
  const appContent = document.querySelector('.no-print');
  const refreshButton = document.getElementById('headerRefreshButton');
  const exportButton = document.getElementById('headerExportButton');
  if (refreshButton) refreshButton.hidden = isPartner;
  if (exportButton) exportButton.hidden = isPartner;
  const partnerTab = document.querySelector('.app-nav [data-tab="partner"]');
  const adminTab = document.querySelector('.app-nav [data-tab="admin"]');
  if (partnerTab) partnerTab.hidden = !isPartner;
  if (adminTab) adminTab.hidden = !isMasterAdmin();

  if (isPartner) {
    if (appContent) appContent.inert = false;
    document.querySelector('.app-nav').style.display = 'none';
    document.querySelectorAll('[data-tab-panel]').forEach(panel => {
      panel.hidden = panel.id !== 'partnerPanel';
    });
    document.getElementById('partnerPanel').hidden = false;
    updateAccessGate('');
    return;
  }

  document.querySelector('.app-nav').style.display = '';
  document.querySelectorAll('[data-tab-panel]').forEach(panel => {
    panel.hidden = panel.dataset.tabPanel !== 'sales' && panel.dataset.tabPanel !== 'dashboard'
      ? true
      : panel.hidden;
  });
  document.getElementById('partnerPanel').hidden = true;
  document.getElementById('adminPanel').hidden = true;
  if (isMasterAdmin()) {
    if (appContent) appContent.inert = false;
    updateAccessGate('');
    return;
  }
  if (isAdmin) {
    if (appContent) appContent.inert = false;
    updateAccessGate('');
    return;
  }
  if (appContent) appContent.inert = true;
  updateAccessGate('আপনার অ্যাকাউন্টটি পর্যালোচনায় রয়েছে। অনুগ্রহ করে অপেক্ষা করুন।', 'অনুমোদন অপেক্ষমাণ');
}

async function resolveUserAccess(user) {
  if (isMasterAdmin(user)) {
    currentAccess = {
      role: 'Admin',
      status: 'approved',
      accountStatus: 'approved',
      email: user.email
    };
    return currentAccess;
  }

  const profileRef = getUserRef(user.uid);
  try {
    const profileSnapshot = await profileRef.get();
    const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
    const accountStatus = String(profile.accountStatus || profile.status || '').trim().toLowerCase();
    if (!profileSnapshot.exists || !accountStatus) {
      trackFirestoreWrite(() => profileRef.set({
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        accountStatus: 'Pending Approval',
        role: 'Pending',
        tenantId: BUSINESS_TENANT_ID,
        createdAt: new Date().toISOString()
      }, { merge: true }), 'অ্যাকাউন্ট অনুমোদন প্রোফাইল');
      currentAccess = { ...profile, role: 'Pending', status: 'Pending Approval', accountStatus: 'Pending Approval' };
      return currentAccess;
    }
    const roleValue = String(profile.role || '').trim().toLowerCase();
    const approvedRole = roleValue === 'admin'
      ? 'Admin'
      : ['partner/staff', 'partner', 'staff'].includes(roleValue) ? 'Partner/Staff' : null;
    const isApproved = accountStatus === 'approved' && Boolean(approvedRole);
    currentAccess = {
      ...profile,
      role: isApproved ? approvedRole : 'Pending',
      status: isApproved ? 'approved' : accountStatus || 'pending',
      accountStatus: isApproved ? 'approved' : accountStatus || 'Pending Approval'
    };
    if (isApproved && approvedRole === 'Partner/Staff') {
      try {
        const memberSnapshot = await getMembersRef().doc(user.uid).get();
        if (memberSnapshot.exists && memberSnapshot.data().sharePercent !== undefined) {
          currentAccess.sharePercent = memberSnapshot.data().sharePercent;
        }
      } catch (error) {
        showFirestoreOperationError(error, 'পার্টনারের লাভের ভাগ লোড হয়নি');
      }
    }
    return currentAccess;
  } catch (error) {
    showFirestoreOperationError(error, 'অ্যাকাউন্ট অনুমতি যাচাই হয়নি');
    currentAccess = { role: 'Pending', status: 'pending' };
    return currentAccess;
  }
}

async function correctMasterAdminProfile(user) {
  if (!isMasterAdmin(user)) return false;
  try {
    const profileRef = getUserRef(user.uid);
    await profileRef.set({
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      accountStatus: 'approved',
      status: 'approved',
      role: 'Admin',
      tenantId: BUSINESS_TENANT_ID,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (error) {
    showFirestoreOperationError(error, 'মাস্টার অ্যাডমিন প্রোফাইল স্বয়ংক্রিয়ভাবে ঠিক হয়নি');
    return false;
  }
}

function startRoleSession(user, access) {
  if (!user || currentUserId !== user.uid) return;
  currentAccess = access;
  applyRoleVisibility();
  if (access.role !== 'Admin' && access.role !== 'Partner/Staff') {
    stopUserDataListeners();
    return;
  }

  if (access.role === 'Partner/Staff') {
    stopUserDataListeners();
    if (typeof attachPartnerListeners === 'function') {
      void attachPartnerListeners(user.uid);
    }
    return;
  }

  void attachFirestoreListeners(user.uid).catch(error => handleFirestoreSyncError('ডেটা', error));
  if (isMasterAdmin(user)) {
    void ensureBusinessWorkspace().then(() => {
      if (typeof attachAdminManagementListeners === 'function') {
        attachAdminManagementListeners();
      }
    });
  } else {
    stopBusinessListeners();
  }
}

function watchAccountProfile(user) {
  if (isMasterAdmin(user)) return;
  if (accountProfileUnsubscribe) accountProfileUnsubscribe();
  const profileRef = getUserRef(user.uid);
  accountProfileUnsubscribe = profileRef.onSnapshot(snapshot => {
    if (currentUserId !== user.uid || !snapshot.exists) return;
    const profile = snapshot.data();
    const accountStatus = String(profile.accountStatus || profile.status || '').trim().toLowerCase();
    const roleValue = String(profile.role || '').trim().toLowerCase();
    const approvedRole = roleValue === 'admin'
      ? 'Admin'
      : ['partner/staff', 'partner', 'staff'].includes(roleValue) ? 'Partner/Staff' : null;
    const isApproved = accountStatus === 'approved' && Boolean(approvedRole);
    const nextAccess = {
      ...profile,
      ...(currentAccess.role === 'Partner/Staff' ? { sharePercent: currentAccess.sharePercent } : {}),
      role: isApproved ? approvedRole : 'Pending',
      status: isApproved ? 'approved' : accountStatus || 'pending',
      accountStatus: isApproved ? 'approved' : accountStatus || 'Pending Approval'
    };
    const roleChanged = nextAccess.role !== currentAccess.role || nextAccess.status !== currentAccess.status;
    const shareChanged = nextAccess.sharePercent !== currentAccess.sharePercent;
    currentAccess = nextAccess;
    if (roleChanged) {
      startRoleSession(user, nextAccess);
      if (nextAccess.role !== 'Pending') showToast('আপনার অ্যাকাউন্ট অনুমোদিত হয়েছে ✓');
    } else if (shareChanged && nextAccess.role === 'Partner/Staff') {
      if (typeof renderPartnerDashboard === 'function') {
        renderPartnerDashboard();
      }
    }
  }, error => handleFirestoreSyncError('অনুমোদন', error));
}

// Auth UI & Modals
function openAuthModal() {
  sessionStorage.removeItem('pos_auth_modal_dismissed');
  const modal = document.getElementById('authLoginModal');
  if (!modal) return;
  try {
    const emEl = document.getElementById('emailLoginInput');
    if (emEl && !emEl.value && currentUser && currentUser.email) emEl.value = currentUser.email;
  } catch (e) { }
  showAuthEmailPane();
  modal.classList.add('active');
}

function showAuthEmailPane() {
  const paneEmail = document.getElementById('authPaneEmail');
  if (paneEmail) paneEmail.style.display = 'block';
}

function switchAuthTab(tab) {
  showAuthEmailPane();
}

function closeAuthModal() {
  sessionStorage.setItem('pos_auth_modal_dismissed', '1');
  const modal = document.getElementById('authLoginModal');
  if (modal) modal.classList.remove('active');
}

function openAccountPasswordModal() {
  const user = auth.currentUser;
  if (!user || !user.email) return showToast('পাসওয়ার্ড সেট করতে প্রথমে সাইন-ইন করুন।', 'error');
  const hasPassword = (user.providerData || []).some(provider => provider.providerId === 'password');
  document.getElementById('accountPasswordStatus').textContent = hasPassword
    ? 'এই অ্যাকাউন্টে পাসওয়ার্ড আছে। নতুন পাসওয়ার্ড দিলে সেটি আপডেট হবে।'
    : 'Google অ্যাকাউন্টের সঙ্গে সরাসরি পাসওয়ার্ড যুক্ত করুন।';
  document.getElementById('accountPasswordInput').value = '';
  document.getElementById('accountPasswordModal').classList.add('active');
  document.getElementById('accountPasswordInput').focus();
}

function closeAccountPasswordModal() {
  const modal = document.getElementById('accountPasswordModal');
  if (modal) modal.classList.remove('active');
}

function renderAuthUI(user) {
  const slot = document.getElementById('authHeaderSlot');
  const banner = document.getElementById('tenantNoticeBanner');
  const userDisp = document.getElementById('settingsUserDisplay');
  const loginBtn = document.getElementById('settingsLoginBtn');
  const logoutBtn = document.getElementById('settingsLogoutBtn');
  const profileCard = document.getElementById('settingsUserProfileCard');
  const profilePhoto = document.getElementById('settingsUserPhoto');
  const profileName = document.getElementById('settingsUserName');
  const profileEmail = document.getElementById('settingsUserEmail');

  if (user) {
    if (banner) banner.style.display = 'none';
    if (userDisp) userDisp.textContent = (user.displayName || user.email) + ' (' + user.email + ')';
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (profileCard) profileCard.style.display = 'flex';
    if (profilePhoto) profilePhoto.src = user.photoURL || 'app-icon-180.png';
    if (profileName) profileName.textContent = user.displayName || user.email || 'ব্যবহারকারী';
    if (profileEmail) profileEmail.textContent = user.email || '';

    const passCard = document.getElementById('settingsPasswordSetupCard');
    const passStatus = document.getElementById('settingsPasswordStatus');
    const hasPassword = (user.providerData || []).some(p => p.providerId === 'password');
    if (passCard) passCard.style.display = 'block';
    if (passStatus) {
      passStatus.innerHTML = hasPassword
        ? '<span style="color:#059669;font-weight:700;">✓ এই একাউন্টে পাসওয়ার্ড সেট করা আছে। এখানে নতুন পাসওয়ার্ড দিলে সেটি আপডেট হবে।</span>'
        : '<span style="color:#b45309;font-weight:600;">📛 এই একাউন্টে এখনও পাসওয়ার্ড সেট করা নেই। নিচে থেকে একটি পাসওয়ার্ড সংরক্ষণ করুন।</span>';
    }
    const savePassBtn = document.getElementById('savePasswordBtn');
    if (savePassBtn) savePassBtn.textContent = hasPassword ? '💾 পাসওয়ার্ড আপডেট করুন' : '💾 পাসওয়ার্ড সংরক্ষণ করুন';

    if (slot) {
      const avatar = user.photoURL || 'app-icon-180.png';
      slot.innerHTML = `<button type="button" class="profile-button" onclick="openSettings()" aria-label="প্রোফাইল ও সেটিংস" title="${escapeHtml(user.displayName || user.email || 'প্রোফাইল')}"><img src="${escapeHtml(avatar)}" alt="" onerror="this.src='app-icon-180.png'"></button>`;
    }
    checkSyncStatus();
  } else {
    if (banner) banner.style.display = 'flex';
    if (userDisp) userDisp.textContent = 'লগইন করা নেই (লোকাল ড্রাফট মোড)';
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (profileCard) profileCard.style.display = 'none';

    if (slot) {
      slot.innerHTML = `<button type="button" class="login-button" onclick="openAuthModal()"><span class="login-icon">🔒</span>লগইন</button>`;
    }
    setSyncStatus('offline', 'লোকাল ডেটা · Google-এ সাইন-ইন করুন');
  }
}

function shouldUseGoogleRedirect() {
  const hostname = window.location.hostname.toLowerCase();
  const isMobileBrowser = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || isMobileBrowser;
}

function getGoogleAuthErrorMessage(error) {
  const code = error && error.code;
  if (code === 'auth/unauthorized-domain') {
    const hostname = window.location.hostname || '(unknown)';
    return `এই ডোমেইনটি Firebase-এ অনুমোদিত নয়। Firebase Console > Authentication > Settings > Authorized domains-এ "${hostname}" যোগ করুন।`;
  }
  if (code === 'auth/configuration-not-found') {
    return 'Firebase Authentication কনফিগারেশন পাওয়া যায়নি। Firebase Console-এ abc-pos-webapp প্রজেক্টটি খুলে Authentication চালু করুন, Google provider enable করুন, এবং Authentication > Settings > Authorized domains-এ এই ডোমেইন যোগ করুন।';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'এই Firebase প্রজেক্টে Google সাইন-ইন চালু নেই। Firebase Console > Authentication > Sign-in method থেকে Google provider enable করুন।';
  }
  if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid') {
    return 'Firebase API key গ্রহণ করা হয়নি। abc-pos-webapp প্রজেক্টের Web App config এবং Google Cloud Console-এর API key restrictions যাচাই করুন।';
  }
  return 'লগইন ব্যর্থ হয়েছে: ' + ((error && error.message) || error);
}

async function sendPasswordResetLink() {
  const emailEl = document.getElementById('emailLoginInput');
  let email = '';
  if (arguments.length > 0 && typeof arguments[0] === 'string' && arguments[0].includes('@')) {
    email = arguments[0].trim();
  } else {
    email = ((emailEl && emailEl.value) || '').trim();
  }
  if (!email) { showToast('অনুগ্রহ করে আগে আপনার ইমেইলটি লিখুন', 'error'); return; }
  try {
    showLoading('পাসওয়ার্ড রিসেট লিংক পাঠানো হচ্ছে...');
    await auth.sendPasswordResetEmail(email);
    hideLoading();
    showToast('আপনার ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। ইমেইল চেক করুন ✓');
    alert('আপনার ইমেইলে ("' + email + '") একটি পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।\n\nলিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন, তারপর আবার লগইন করুন।');
  } catch (e) {
    console.error('sendPasswordResetEmail failed:', e);
    hideLoading();
    const c = e && e.code;
    let m = 'রিসেট ইমেল পাঠানো যায়নি: ' + ((e && e.message) || e);
    if (c === 'auth/user-not-found') m = 'এই ইমেইলে কোনো একাউন্ট নেই। ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করলে স্বয়ংক্রিয়ভাবে একাউন্ট তৈরি হবে।';
    else if (c === 'auth/invalid-email') m = 'ইমেইল ঠিকানাটি সঠিক নয়।';
    else if (c === 'auth/too-many-requests') m = 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
    else if (c === 'auth/network-request-failed') m = 'ইন্টারনেট সংযোগ নেই। সংযোগ চালু করে আবার চেষ্টা করুন।';
    showToast(m, 'error');
  } finally {
    hideLoading();
  }
}

async function loginWithEmail() {
  const emailEl = document.getElementById('emailLoginInput');
  const passEl = document.getElementById('passwordLoginInput');
  const email = ((emailEl && emailEl.value) || '').trim();
  const password = ((passEl && passEl.value) || '');
  if (!email || !password) {
    showToast('অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড দুটিই পূরণ করুন', 'error');
    return;
  }
  if (password.length < 6) {
    showToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।', 'error');
    return;
  }
  try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); }
  catch (error) { console.warn('Auth persistence set failed during sign-in:', error); }
  try {
    showLoading('লগইন হচ্ছে...');
    await auth.signInWithEmailAndPassword(email, password);
    sessionStorage.removeItem('pos_auth_modal_dismissed');
    hideLoading();
    closeAuthModal();
    showToast('সফলভাবে লগইন হয়েছে ✓');
    return;
  } catch (error) {
    const code = error && error.code;
    console.warn('Email sign-in failed:', code, error);
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      try {
        showLoading('নতুন একাউন্ট তৈরি হচ্ছে...');
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        sessionStorage.removeItem('pos_auth_modal_dismissed');
        hideLoading();
        try { if (!cred.user.emailVerified) await cred.user.sendEmailVerification(); } catch (ve) { console.warn('Verification email failed:', ve); }
        closeAuthModal();
        alert('আপনার অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট তৈরি করা হয়েছে এবং একটি ভেরিফিকেশন ইমেল পাঠানো হয়েছে।');
        showToast('আপনার অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট তৈরি করা হয়েছে এবং একটি ভেরিফিকেশন ইমেল পাঠানো হয়েছে।');
        return;
      } catch (createError) {
        console.error('Auto sign-up failed:', createError);
        const cCode = createError && createError.code;
        let cMsg = 'একাউন্ট তৈরি করা যায়নি: ' + ((createError && createError.message) || createError);
        if (cCode === 'auth/email-already-in-use') {
          cMsg = 'এই ইমেইল দিয়ে আগেই একাউন্ট রয়েছে। সঠিক পাসওয়ার্ড দিয়ে আবার লগইন করুন।';
        } else if (cCode === 'auth/weak-password') {
          cMsg = 'পাসওয়ার্ড অনেক দুর্বল। কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।';
        } else if (cCode === 'auth/invalid-email') {
          cMsg = 'ইমেইল ঠিকানাটি সঠিক নয়।';
        } else if (cCode === 'auth/operation-not-allowed' || cCode === 'auth/email-not-enabled') {
          cMsg = 'এই প্রজেক্টে Email/Password সাইন-ইন চালু নেই। Firebase Console > Authentication > Sign-in method থেকে Email/Password এনেবল করুন।';
        }
        showToast(cMsg, 'error');
        hideLoading();
        return;
      }
    }
    let msg = 'লগইন ব্যর্থ হয়েছে: ' + ((error && error.message) || error);
    if (code === 'auth/wrong-password' || code === 'auth/invalid-login-credentials') {
      hideLoading();
      const resetNow = confirm('⛔ পাসওয়ার্ড ভুল! আপনার ইমেইল দিয়ে একটি একাউন্ট রয়েছে কিন্তু পাসওয়ার্ডটি সঠিক নয়। পাসওয়ার্ড ভুলে গেছেন?\n\n"ওকে" চাপলে আপনার ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠানো হবে।');
      if (resetNow) await sendPasswordResetLink(email);
      return;
    } else if (code === 'auth/invalid-email') {
      msg = 'ইমেইল ঠিকানাটি সঠিক নয়।';
    } else if (code === 'auth/user-disabled') {
      msg = 'এই একাউন্টটি নিষ্ক্রিয় করা হয়েছে।';
    } else if (code === 'auth/too-many-requests') {
      msg = 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
    } else if (code === 'auth/network-request-failed') {
      msg = 'ইন্টারনেট সংযোগ নেই। সংযোগ চালু করে আবার চেষ্টা করুন।';
    } else if (code === 'auth/email-not-enabled' || code === 'auth/operation-not-allowed') {
      msg = 'এই প্রজেক্টে Email/Password সাইন-ইন চালু নেই। Firebase Console > Authentication > Sign-in method থেকে Email/Password এনেবল করুন।';
    }
    showToast(msg, 'error');
  } finally {
    hideLoading();
  }
}

async function saveAccountPassword(inputId) {
  const user = auth.currentUser;
  if (!user || !user.email) {
    showToast('পাসওয়ার্ড সেট করতে প্রথমে লগইন করুন — সেটিংসে সাইন-ইন করা একাউন্টেই পাসওয়ার্ড যুক্ত হয়।', 'error');
    openAuthModal();
    return;
  }
  const passEl = (inputId && document.getElementById(inputId))
    || document.getElementById('settingsNewPasswordInput')
    || document.getElementById('newPasswordInput');
  const password = ((passEl && passEl.value) || '');
  if (!password) { showToast('নতুন পাসওয়ার্ড লিখুন।', 'error'); return; }
  if (password.length < 6) { showToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।', 'error'); return; }
  try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); }
  catch (error) { console.warn('Auth persistence set failed during sign-in:', error); }
  try {
    showLoading('পাসওয়ার্ড সংরক্ষণ হচ্ছে...');
    const hasPassword = (user.providerData || []).some(p => p.providerId === 'password');
    if (!hasPassword) {
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, password);
      await user.linkWithCredential(cred);
    } else {
      await user.updatePassword(password);
    }
    hideLoading();
    if (passEl) passEl.value = '';
    renderAuthUI(auth.currentUser);
    closeAccountPasswordModal();
    showToast(hasPassword
      ? '✅ পাসওয়ার্ড আপডেট হয়েছে!'
      : '✅ পাসওয়ার্ড সংরক্ষিত! এখন থেকে ইমেইল ও পাসওয়ার্ড দিয়েও সরাসরি লগইন করতে পারবেন।');
  } catch (error) {
    console.error('saveAccountPassword failed:', error);
    hideLoading();
    const code = error && error.code;
    let msg = 'পাসওয়ার্ড সেট করা যায়নি: ' + ((error && error.message) || error);
    if (code === 'auth/credential-already-in-use') msg = 'এই ইমেইল দিয়ে আগেই একটি আলাদা পাসওয়ার্ড একাউন্ট রয়েছে। "পাসওয়ার্ড ভুলে গেছেন?" দিয়ে রিসেট লিংক নিয়ে সেই একাউন্টে লগইন করুন।';
    else if (code === 'auth/requires-recent-login') msg = 'সুরক্ষার কারণে সাম্প্রতিক লগইন প্রয়োজন। একবার লগআউট করে আবার লগইন করার পরপরই এই অপশনটি ব্যবহার করুন।';
    else if (code === 'auth/weak-password') msg = 'পাসওয়ার্ড অনেক দুর্বল। কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।';
    else if (code === 'auth/network-request-failed') msg = 'ইন্টারনেট সংযোগ নেই। সংযোগ চালু করে আবার চেষ্টা করুন।';
    showToast(msg, 'error');
  } finally {
    hideLoading();
  }
}

async function linkEmailCredential() {
  await saveAccountPassword();
}

async function loginWithGoogle() {
  try {
    showLoading('Google দিয়ে সাইন ইন হচ্ছে...');
    if (auth.app !== app || auth.app.options.projectId !== firebaseConfig.projectId) {
      throw new Error('Google Sign-In is connected to a different Firebase project than abc-pos-webapp.');
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    try {
      await auth.signInWithPopup(provider);
      sessionStorage.removeItem('pos_auth_modal_dismissed');
      hideLoading();
      closeAuthModal();
      showToast('সফলভাবে লগইন হয়েছে ✓');
    } catch (popupError) {
      const code = popupError && popupError.code;
      if (code === 'auth/user-cancelled' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        hideLoading();
        return;
      }
      if (code !== 'auth/popup-blocked'
        && code !== 'auth/operation-not-supported-in-this-environment'
        && code !== 'auth/unauthorized-domain') {
        throw popupError;
      }
      console.warn('Google Sign-In popup unavailable; falling back to redirect:', code);
      if (code === 'auth/unauthorized-domain') {
        hideLoading();
        showToast(getGoogleAuthErrorMessage(popupError), 'error');
        return;
      }
      await auth.signInWithRedirect(provider);
    }
  } catch (error) {
    console.error('Google Sign-In failed for Firebase project "' + firebaseConfig.projectId + '":', error);
    hideLoading();
    showToast(getGoogleAuthErrorMessage(error), 'error');
  }
}

async function logoutUser() {
  if (!confirm('আপনি কি নিশ্চিত যে আপনার একাউন্ট থেকে লগআউট করতে চান?')) return;
  try {
    showLoading('লগআউট হচ্ছে...');
    firestoreUnsubscribers.forEach(unsub => { try { unsub(); } catch (e) { } });
    firestoreUnsubscribers = [];
    await auth.signOut();
    showToast('সফলভাবে লগআউট হয়েছে');
    openAuthModal();
  } catch (error) {
    showToast('লগআউট সমস্যা: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}
