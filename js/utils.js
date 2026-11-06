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

const CASH_DENOMS = [10, 20, 50, 100, 200, 500, 1000];
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

// Application state variables
let invoices = JSON.parse(localStorage.getItem('pos_invoices') || '[]');
let settings = JSON.parse(localStorage.getItem('pos_settings') || '{}');
let currentInvoiceId = null;
let nextInvoiceNumber = parseInt(localStorage.getItem('pos_next_inv_no') || '1');
let creditors = [];
let expenses = [];
let cloudSyncActive = true;
let editingExpenseId = null;

try { creditors = JSON.parse(localStorage.getItem('pos_creditors') || '[]'); } catch (e) { creditors = []; }
try { expenses = JSON.parse(localStorage.getItem('pos_expenses') || '[]'); } catch (e) { expenses = []; }
if (!Array.isArray(creditors)) creditors = [];
if (!Array.isArray(expenses)) expenses = [];

// Multi-Tenant Isolation: State of authenticated business owner
let currentUser = null;
let currentUserId = null;
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

// Admin partner management state
let adminMembers = [];
let adminPartnerSales = [];
let adminPartnerExpenses = [];
let adminSettlements = [];
let adminUserProfiles = [];

// ===== ইমোজি সাপোর্ট =====
function supportsEmoji() {
  try {
    const c = document.createElement('canvas');
    c.width = 20; c.height = 20;
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '32px Arial';
    ctx.fillText('\ud83d\ude03', 0, 0);
    return ctx.getImageData(0, 0, 20, 20).data.some(channel => channel !== 0);
  } catch (e) { return true; }
}
const EMOJI_OK = supportsEmoji();
function em(emoji, fallback = '>>') { return EMOJI_OK ? emoji : fallback; }

// ===== ইউটিলিটি ফাংশন =====
function safeNum(n) {
  if (typeof n === 'string') {
    const bnDigits = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
    n = n.replace(/[০-৯]/g, d => bnDigits[d]);
  }
  const v = parseFloat(n);
  return isNaN(v) ? 0 : v;
}

const BN_NUMS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
function toBnNum(n) {
  return String(n == null ? '' : n).replace(/\d/g, d => BN_NUMS[d]);
}

function formatMoney(n) {
  const v = safeNum(n);
  const formatted = v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return '৳' + toBnNum(formatted);
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const months = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
  const day = toBnNum(String(dt.getDate()).padStart(2, '0'));
  const month = months[dt.getMonth()];
  const year = toBnNum(dt.getFullYear());
  return `${day} ${month} ${year}`;
}

function formatTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  let hours = dt.getHours();
  const minutes = toBnNum(String(dt.getMinutes()).padStart(2, '0'));
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${toBnNum(hours)}:${minutes} ${ampm}`;
}

function generateInvoiceNo(num) {
  return 'INV-' + String(num).padStart(4, '0');
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function onPartnerMetricsDateChange() {
  const metricsDateInput = document.getElementById('partnerMetricsDate');
  const historyDateInput = document.getElementById('partnerHistoryDate');
  if (metricsDateInput && historyDateInput && metricsDateInput.value) {
    historyDateInput.value = metricsDateInput.value;
  }
  if (typeof renderPartnerDashboard === 'function') {
    renderPartnerDashboard();
  }
}

function setPartnerDateToday() {
  const metricsDateInput = document.getElementById('partnerMetricsDate');
  const historyDateInput = document.getElementById('partnerHistoryDate');
  const today = localDateKey();
  if (metricsDateInput) metricsDateInput.value = today;
  if (historyDateInput) historyDateInput.value = today;
  if (typeof renderPartnerDashboard === 'function') {
    renderPartnerDashboard();
  }
}

function setAdminDateToday() {
  const dateInput = document.getElementById('adminMetricsDate');
  if (dateInput) {
    dateInput.value = localDateKey();
    if (typeof renderAdminManagement === 'function') {
      renderAdminManagement();
    }
  }
}

let toastTimeoutId = null;

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }
  toastTimeoutId = setTimeout(() => {
    t.className = 'toast';
    toastTimeoutId = null;
  }, 3500);
}

function showSyncWarning(message) {
  let warning = document.getElementById('syncWarning');
  if (!warning) {
    warning = document.createElement('div');
    warning.id = 'syncWarning';
    warning.className = 'sync-warning';
    document.body.appendChild(warning);
  }
  warning.textContent = message;
  warning.style.display = 'block';
  setTimeout(() => {
    if (warning) warning.style.display = 'none';
  }, 4000);
}

function showLoading(text = 'অপেক্ষা করুন...') {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    const textEl = overlay.querySelector('div');
    if (textEl) textEl.textContent = text;
    overlay.style.display = 'flex';
  }
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}
