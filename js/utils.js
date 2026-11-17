/**
 * ABC POS - Utility Functions & Global State Configuration
 * Module: js/utils.js
 */

const BUSINESS = {
  name: 'ABC COMPUTER',
  tagline: 'আপনার বিশ্বস্ত ডিজিটাল সেবা কেন্দ্র',
  address: 'বনগ্রাম স্কুল রোড, তেঘরিয়া, দক্ষিণ কেরানীগঞ্জ, ঢাকা।',
  phone: '০১৮৭৭৯৮৭৫৮৭',
  services: 'কম্পিউটার ট্রেনিং | গ্রাফিক ডিজাইন | টাইপিং | ওয়েব ডিজাইন | আইনি সহায়তা',
  website: 'https://www.teamsabc.com/',
  social: {
    youtube: { handle: '@teamabccom', url: 'https://www.youtube.com/@teamabccom' },
    facebook: { handle: 'teamabccom', url: 'https://www.facebook.com/teamabccom/' },
    tiktok: { handle: '@teamabccom', url: 'https://www.tiktok.com/@teamabccom' },
    instagram: { handle: '@teamabccom', url: 'https://www.instagram.com/teamabccom' }
  },
  review: 'https://share.google/KXGlETK8yzlJE6DeS'
};

const CASH_DENOMS = [5, 10, 20, 50, 100, 200, 500, 1000];

const BALANCE_ACCOUNTS = [
  { key: 'bkash', label: 'বিকাশ (Business/Main)' },
  { key: 'nagad', label: 'নগদ' },
  { key: 'rocket', label: 'রকেট' },
  { key: 'gp', label: 'জিপি রিচার্জ' },
  { key: 'banglalink', label: 'বাংলালিংক রিচার্জ' },
  { key: 'robi', label: 'রবি রিচার্জ' },
  { key: 'airtel', label: 'এয়ারটেল রিচার্জ' },
  { key: 'bank', label: 'ব্যাংক অ্যাকাউন্ট' },
  { key: 'bkashSaving', label: 'বিকাশ সেভিংস' },
  { key: 'personalMfs', label: 'বিকাশ/নগদ পার্সোনাল' }
];

let invoices = JSON.parse(localStorage.getItem('pos_invoices') || '[]');

let settings = JSON.parse(localStorage.getItem('pos_settings') || '{}');

let currentInvoiceId = null;

let nextInvoiceNumber = parseInt(localStorage.getItem('pos_next_inv_no') || '1');

let creditors = [];

let expenses = [];

let cloudSyncActive = true;

const EMOJI_OK = supportsEmoji();

let toastTimeoutId = null;

let currentUser = null;

let currentUserId = null;

const MASTER_ADMIN_EMAIL = 'clkmonir@gmail.com';

const MASTER_ADMIN_UID = 'sLChvjrk8ygkMD8AzEZepqvqLEz1';

const BUSINESS_TENANT_ID = 'abc-computer';

const PENDING_APPROVAL_MESSAGE = 'আপনার অ্যাকাউন্টটি অনুমোদন অপেক্ষমাণ রয়েছে। এডমিনের অনুমতির পর ব্যবহার করতে পারবেন।';

const PENDING_PATIENCE_QUOTES = [
  { text: 'নিশ্চয়ই আল্লাহ ধৈর্যশীলদের সাথে আছেন।', reference: 'সূরা আল-বাকারা: ১৫৩' },
  { text: 'ধৈর্য ধারণ করো, নিশ্চয়ই আল্লাহর ওয়াদা সত্য।', reference: 'সূরা আর-রূম: ৬০' },
  { text: 'নিশ্চয়ই ধৈর্যশীলদের তাদের প্রতিদান দেওয়া হবে অগণিতভাবে।', reference: 'সূরা আয-যুমার: ১০' },
  { text: 'যে ধৈর্য ধারণ করে, আল্লাহ তাকে ধৈর্য ধারণের শক্তি দান করেন। ধৈর্যের চেয়ে উত্তম ও ব্যাপক কোনো দান কাউকে দেওয়া হয়নি।', reference: 'সহীহ বুখারী: ১৪৬৯' }
];

let currentAccess = { role: 'Pending', status: 'pending' };

let partnerSales = [];

let partnerExpenses = [];

let partnerSettlements = [];

let partnerCatalog = { presetItems: '', costPrices: {}, sellingPrices: {} };

let businessCashBalance = 0;

let businessUnsubscribers = [];

let accountProfileUnsubscribe = null;

const settlingPartnerIds = new Set();

const deletingPartnerIds = new Set();

let firestoreUnsubscribers = [];

let cashHistoryRecords = [];

let firestoreReconnectTimer = null;

let firestoreReconnectAttempts = 0;

let firestoreSnapshotStates = Object.create(null);

let presetsSnapshotExists = null;

let legacySettingsSnapshot = null;

let presetMigrationStarted = false;

let adminMembers = [];

let adminPartnerSales = [];

let adminPartnerExpenses = [];

let adminSettlements = [];

let adminUserProfiles = [];

let editingExpenseId = null;

function supportsEmoji() {
  try {
    const c = document.createElement('canvas');
    c.width = 20; c.height = 20;
    const ctx = c.getContext('2d');
    ctx.fillText('😀', 0, 15);
    return ctx.getImageData(0, 0, 20, 20).data.some(d => d > 0);
  } catch (e) { return false; }
}

function em(emoji, fallback = '>>') { return EMOJI_OK ? emoji : fallback; }

function safeNum(n) {
  if (typeof n === 'string') {
    const cleaned = n.replace(/[০-৯]/g, ch => String('০১২৩৪৫৬৭৮৯'.indexOf(ch)))
      .replace(/[, ]/g, '');
    const x = parseFloat(cleaned);
    return isFinite(x) ? x : 0;
  }
  if (typeof n === 'number') { return isFinite(n) ? n : 0; }
  const x = Number(n);
  return isFinite(x) ? x : 0;
}

function toBnNum(n) {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  if (n === undefined || n === null) return '০';
  const s = typeof n === 'number' ? (isFinite(n) ? String(n) : '০') : String(n);
  return s.replace(/\d/g, d => bn[+d]);
}

function formatMoney(n) {
  return '৳' + toBnNum(Math.round(safeNum(n)).toLocaleString('en-IN'));
}

function formatDate(d) {
  if (!d) return '';
  let date;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    const parts = d.trim().split('-').map(Number);
    date = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    date = d instanceof Date ? d : new Date(d);
  }
  if (isNaN(date.getTime())) return '';
  const months = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
  return toBnNum(date.getDate()) + ' ' + months[date.getMonth()] + ', ' + toBnNum(date.getFullYear());
}

function formatTime(d) {
  const date = new Date(d);
  let h = date.getHours(), m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return toBnNum(h) + ':' + toBnNum(String(m).padStart(2, '0')) + ' ' + ampm;
}

function generateInvoiceNo(num) {
  return 'ABC-' + String(num).padStart(4, '0');
}

function localDateKey(value = new Date()) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function onPartnerMetricsDateChange() {
  const metricsDateInput = document.getElementById('partnerMetricsDate');
  const historyDateInput = document.getElementById('partnerHistoryDate');
  if (metricsDateInput && historyDateInput && metricsDateInput.value) {
    historyDateInput.value = metricsDateInput.value;
  }
  renderPartnerDashboard();
}

function setPartnerDateToday() {
  const metricsDateInput = document.getElementById('partnerMetricsDate');
  const historyDateInput = document.getElementById('partnerHistoryDate');
  const today = localDateKey();
  if (metricsDateInput) metricsDateInput.value = today;
  if (historyDateInput) historyDateInput.value = today;
  renderPartnerDashboard();
}

function setAdminDateToday() {
  const dateInput = document.getElementById('adminMetricsDate');
  if (dateInput) {
    dateInput.value = localDateKey();
    renderAdminManagement();
  }
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = null;
  t.textContent = msg;
  t.className = 'toast show' + (type === 'error' ? ' error' : '') + (type === 'loading' ? ' loading' : '');
  if (type !== 'loading') {
    toastTimeoutId = setTimeout(() => {
      t.className = 'toast';
      toastTimeoutId = null;
    }, 3000);
  }
}

function showSyncWarning(message) {
  const t = document.getElementById('toast');
  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  t.textContent = message;
  t.className = 'toast show error';
  toastTimeoutId = setTimeout(() => {
    t.className = 'toast';
    toastTimeoutId = null;
  }, 4000);
}

function showLoading(text = 'অপেক্ষা করুন...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('active');
}

function escapeHtml(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

try { creditors = JSON.parse(localStorage.getItem('pos_creditors') || '[]'); } catch (e) { creditors = []; }

try { expenses = JSON.parse(localStorage.getItem('pos_expenses') || '[]'); } catch (e) { expenses = []; }

if (!Array.isArray(creditors)) creditors = [];

if (!Array.isArray(expenses)) expenses = [];
