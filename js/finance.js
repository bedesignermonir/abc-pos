/**
 * ABC POS - Creditors, Expenses, Cash Register & Financial Summaries
 * Module: js/finance.js
 */

const EXPECTED_CASH_STORAGE_KEY = 'pos_expected_cash';

const EXPECTED_DIGITAL_STORAGE_KEY = 'pos_expected_digital';

const CASH_ADJUSTMENT_STORAGE_KEY = 'pos_cash_adjustments';

const CASH_RECONCILIATION_LABELS = {
  other_income: 'অন্যান্য আয় / ক্যাশব্যাক',
  sales_adjustment: 'বেচাকিনা / অতিরিক্ত বিক্রি',
  expense: 'দৈনন্দিন খরচ / বাজার খরচ',
  loan_given: 'ধার দেওয়া / দেনা'
};

let expectedCashBalance = 0;

let expectedDigitalBalance = 0;

let expectedDigitalKnown = false;

let pendingCashReconciliation = null;

let cashAdjustmentLog = (function () {
  try {
    const raw = JSON.parse(localStorage.getItem(CASH_ADJUSTMENT_STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (error) { return []; }
})();

const DEFAULT_EXPENSE_CATEGORIES = ['বাজার খরচ', 'দোকান ভাড়া', 'বিদ্যুৎ বিল', 'ইন্টারনেট বিল', 'কর্মচারীর বেতন', 'পরিবহন খরচ'];

function roundMoney(value) { return Math.round(safeNum(value) * 100) / 100; }

function logCashAdjustment(entry) {
  cashAdjustmentLog.unshift(entry);
  cashAdjustmentLog = cashAdjustmentLog.slice(0, 50);
  try { localStorage.setItem(CASH_ADJUSTMENT_STORAGE_KEY, JSON.stringify(cashAdjustmentLog)); } catch (error) { }
}

function mirrorExpectedCashToDenominations() {
  CASH_DENOMS.forEach(d => {
    const el = document.getElementById('denom_' + d);
    if (el) el.value = '';
  });
  let remaining = Math.max(0, roundMoney(expectedCashBalance));
  for (let i = CASH_DENOMS.length - 1; i >= 0; i--) {
    const d = CASH_DENOMS[i];
    const count = Math.floor(remaining / d);
    remaining = roundMoney(remaining - count * d);
    const el = document.getElementById('denom_' + d);
    if (el && count > 0) el.value = String(count);
  }
}

function updateExpectedCashPanel() {
  const expectedEl = document.getElementById('expectedCashDisplay');
  const countedEl = document.getElementById('countedCashDisplay');
  const expectedBreakEl = document.getElementById('expectedCashBreakdown');
  const countedBreakEl = document.getElementById('countedCashBreakdown');
  const badge = document.getElementById('cashVarianceBadge');
  const bal = consolidatedBalances();
  if (expectedEl) expectedEl.textContent = formatMoney(bal.expectedGrand);
  if (countedEl) countedEl.textContent = formatMoney(bal.countedGrand);
  if (expectedBreakEl) {
    expectedBreakEl.textContent = 'ক্যাশ ' + formatMoney(bal.expectedCash) + ' + ডিজিটাল ' + formatMoney(bal.expectedDigital);
  }
  if (countedBreakEl) {
    countedBreakEl.textContent = 'ক্যাশ ' + formatMoney(bal.cash) + ' + ডিজিটাল ' + formatMoney(bal.digital);
  }
  if (!badge) return;
  const diff = bal.consolidatedDifference;
  if (Math.abs(diff) < 0.01) {
    // মোট মিলে গেলে ক্যাশ↔ডিজিটাল স্থানান্তরকে ভুল হিসেবে ধরা হয় না
    badge.className = 'cash-variance-badge';
    badge.textContent = Math.abs(bal.cashDifference) >= 0.01
      ? '✓ মোট মিলেছে · ক্যাশ ↔ ডিজিটাল সমন্বয়'
      : '✓ হিসাব মিলে গেছে';
  } else if (diff > 0) {
    badge.className = 'cash-variance-badge surplus';
    badge.textContent = '⬆ ' + formatMoney(diff) + ' বেশি';
  } else {
    badge.className = 'cash-variance-badge shortage';
    badge.textContent = '⬇ ' + formatMoney(Math.abs(diff)) + ' ঘাটতি';
  }
}

function setExpectedCashBalance(value, options) {
  const opts = options || {};
  expectedCashBalance = Math.max(0, roundMoney(value));
  try { localStorage.setItem(EXPECTED_CASH_STORAGE_KEY, String(expectedCashBalance)); } catch (error) { }
  if (opts.mirror !== false) mirrorExpectedCashToDenominations();
  updateRegisterTotals();
}

function setExpectedDigitalBalance(value, options) {
  const opts = options || {};
  expectedDigitalBalance = Math.max(0, roundMoney(value));
  expectedDigitalKnown = opts.known !== false;
  try { localStorage.setItem(EXPECTED_DIGITAL_STORAGE_KEY, String(expectedDigitalBalance)); } catch (error) { }
}

function initializeExpectedDigitalBalance(recordDigitalValue) {
  const hasRecordValue = recordDigitalValue !== undefined && recordDigitalValue !== null
    && recordDigitalValue !== '' && !isNaN(Number(recordDigitalValue));
  if (hasRecordValue) {
    setExpectedDigitalBalance(recordDigitalValue);
    return;
  }
  let stored = null;
  try { stored = localStorage.getItem(EXPECTED_DIGITAL_STORAGE_KEY); } catch (error) { }
  if (stored !== null && stored !== '' && !isNaN(Number(stored))) {
    setExpectedDigitalBalance(stored);
  }
}

function consolidatedBalances() {
  const cash = roundMoney(registerCashTotal());
  const digital = roundMoney(registerDigitalTotal());
  const expectedCash = roundMoney(expectedCashBalance);
  // প্রথমবার ভিত্তি অজানা থাকলে বর্তমান ডিজিটাল ব্যালেন্সই ভিত্তি ধরা হয় — ভুয়া ঘাটতি/বেশি দেখায় না
  const expectedDigital = expectedDigitalKnown ? roundMoney(expectedDigitalBalance) : digital;
  const countedGrand = roundMoney(cash + digital);
  const expectedGrand = roundMoney(expectedCash + expectedDigital);
  return {
    cash: cash,
    digital: digital,
    expectedCash: expectedCash,
    expectedDigital: expectedDigital,
    expectedDigitalKnown: expectedDigitalKnown,
    countedGrand: countedGrand,
    expectedGrand: expectedGrand,
    cashDifference: roundMoney(cash - expectedCash),
    digitalDifference: roundMoney(digital - expectedDigital),
    consolidatedDifference: roundMoney(countedGrand - expectedGrand)
  };
}

function commitConsolidatedBaseline(bal) {
  setExpectedCashBalance(bal.cash, { mirror: false });
  setExpectedDigitalBalance(bal.digital);
  updateRegisterTotals();
}

function initializeExpectedCashBalance() {
  let stored = null;
  try { stored = localStorage.getItem(EXPECTED_CASH_STORAGE_KEY); } catch (error) { }
  if (!cashHistoryRecords.length && stored !== null && stored !== '') {
    expectedCashBalance = Math.max(0, roundMoney(stored));
  }
  initializeExpectedDigitalBalance();
  setExpectedCashBalance(expectedCashBalance, { mirror: true });
}

function buildCashRegisterRecord(extra) {
  const date = localDateKey();
  const denominations = {};
  const balances = {};
  CASH_DENOMS.forEach(d => {
    const el = document.getElementById('denom_' + d);
    denominations[d] = Math.max(0, safeNum(el ? el.value : 0));
  });
  BALANCE_ACCOUNTS.forEach(a => {
    const el = document.getElementById('bal_' + a.key);
    balances[a.key] = Math.max(0, safeNum(el ? el.value : 0));
  });
  const cashTotal = roundMoney(CASH_DENOMS.reduce((sum, d) => sum + d * denominations[d], 0));
  const digitalTotal = roundMoney(BALANCE_ACCOUNTS.reduce((sum, a) => sum + balances[a.key], 0));
  const expectedDigital = roundMoney(expectedDigitalKnown ? expectedDigitalBalance : digitalTotal);
  const expectedGrand = roundMoney(roundMoney(expectedCashBalance) + expectedDigital);
  return Object.assign({
    id: 'cash-' + date,
    date: date,
    cashTotal: cashTotal,
    digitalTotal: digitalTotal,
    grandTotal: roundMoney(cashTotal + digitalTotal),
    expectedCash: roundMoney(expectedCashBalance),
    expectedDigital: expectedDigital,
    expectedGrand: expectedGrand,
    consolidatedVariance: roundMoney(roundMoney(cashTotal + digitalTotal) - expectedGrand),
    cashVariance: roundMoney(cashTotal - roundMoney(expectedCashBalance)),
    denominations: denominations,
    balances: balances,
    adjustments: cashAdjustmentLog.slice(0, 20),
    updatedAt: new Date().toISOString()
  }, extra || {});
}

function persistCashRegisterSnapshot(reason, extra) {
  // ডিজিটাল ভিত্তি প্রথমবারেই রেকর্ড থেকে স্থাপন করা হয়, যাতে পুরোনো ডেটায় ভুয়া পার্থক্য না আসে
  if (!expectedDigitalKnown) setExpectedDigitalBalance(registerDigitalTotal());
  const record = buildCashRegisterRecord(Object.assign({ autoSync: reason || 'manual' }, extra || {}));
  record.expectedCash = roundMoney(expectedCashBalance);
  try { localStorage.setItem('pos_cash_register', JSON.stringify(record)); } catch (error) { }
  cashHistoryRecords = [record].concat(cashHistoryRecords.filter(item => item.id !== record.id));
  renderCashHistory();
  if (currentUserId) saveCashRegisterToFirebase(record);
  return record;
}

function applyOperationalCashDelta(delta, reason) {
  const amount = roundMoney(delta);
  if (!amount) return;
  setExpectedCashBalance(expectedCashBalance + amount);
  persistCashRegisterSnapshot(reason || 'auto');
}

function closeCashReconciliation() {
  const modal = document.getElementById('cashReconcileModal');
  if (modal) modal.classList.remove('active');
}

function cancelCashReconciliation() {
  pendingCashReconciliation = null;
  closeCashReconciliation();
  showToast('ক্যাশ গণনা সেভ হয়নি — হিসাব মিলিয়ে আবার সেভ করুন', 'loading');
}

function showCashReconciliationPrompt(difference, snapshot) {
  const surplus = difference > 0;
  const amount = Math.abs(roundMoney(difference));
  const bal = snapshot && snapshot.countedGrand !== undefined ? snapshot : consolidatedBalances();
  pendingCashReconciliation = {
    surplus: surplus,
    amount: amount,
    countedCash: roundMoney(bal.cash),
    countedDigital: roundMoney(bal.digital),
    countedGrand: roundMoney(bal.countedGrand),
    expectedBefore: roundMoney(bal.expectedCash),
    expectedDigitalBefore: roundMoney(bal.expectedDigital),
    expectedGrandBefore: roundMoney(bal.expectedGrand)
  };
  const modal = document.getElementById('cashReconcileModal');
  const title = document.getElementById('cashReconcileTitle');
  const message = document.getElementById('cashReconcileMessage');
  const summary = document.getElementById('cashReconcileSummary');
  const options = document.getElementById('cashReconcileOptions');
  if (title) title.textContent = surplus ? '💰 মোট ব্যালেন্সে বেশি টাকা পাওয়া গেছে' : '⚠️ মোট ব্যালেন্সে ঘাটতি পাওয়া গেছে';
  if (message) {
    message.className = 'reconcile-message' + (surplus ? '' : ' shortage');
    message.textContent = surplus
      ? 'আপনার মোট ব্যালেন্স (ক্যাশ + ডিজিটাল) সিস্টেমের হিসাবের চেয়ে ' + formatMoney(amount) + ' টাকা বেশি রয়েছে।'
      : 'আপনার মোট ব্যালেন্স (ক্যাশ + ডিজিটাল) সিস্টেমের হিসাবের চেয়ে ' + formatMoney(amount) + ' টাকা কম রয়েছে (ঘাটতি)।';
  }
  if (summary) {
    summary.innerHTML = `
      <div><div class="rs-label">প্রত্যাশিত মোট (ক্যাশ + ডিজিটাল)</div><div class="rs-value">${formatMoney(bal.expectedGrand)}</div></div>
      <div><div class="rs-label">গণনা করা মোট (ক্যাশ + ডিজিটাল)</div><div class="rs-value">${formatMoney(bal.countedGrand)}</div></div>
      <div><div class="rs-label">${surplus ? 'বেশি' : 'ঘাটতি'}</div><div class="rs-value" style="color:${surplus ? '#2563eb' : '#dc2626'};">${formatMoney(amount)}</div></div>
      <div><div class="rs-label">ক্যাশ</div><div class="rs-value">${formatMoney(bal.cash)}</div></div>
      <div><div class="rs-label">ডিজিটাল</div><div class="rs-value">${formatMoney(bal.digital)}</div></div>`;
  }
  if (options) {
    const choices = surplus ? [
      { key: 'other_income', title: 'অন্যান্য আয় / ক্যাশব্যাক', sub: 'বিকাশ/নগদ ক্যাশব্যাক বা বিবিধ আয় হিসেবে এই টাকা হিসাবে যোগ হবে' },
      { key: 'sales_adjustment', title: 'বেচাকিনা / অতিরিক্ত বিক্রি', sub: 'সাধারণ বিক্রয়ের তালিকায় অতিরিক্ত বিক্রি হিসেবে যোগ হবে' }
    ] : [
      { key: 'expense', title: 'দৈনন্দিন খরচ / বাজার খরচ', sub: 'ঘাটতি টাকাটি স্বয়ংক্রিয়ভাবে খরচ হিসেবে রেকর্ড হবে' },
      { key: 'loan_given', title: 'ধার দেওয়া / দেনা', sub: 'পাওনাদার তালিকায় ধার দেওয়া হিসেবে যোগ হবে' }
    ];
    options.innerHTML = choices.map(choice => `
      <button type="button" class="reconcile-option" onclick="confirmCashReconciliation('${choice.key}')">
        <span class="ro-title">${choice.title}</span>
        <span class="ro-sub">${choice.sub} · ${formatMoney(amount)}</span>
      </button>`).join('');
  }
  if (modal) modal.classList.add('active');
}

function recordCashReconciliationIncome(amount) {
  logCashAdjustment({
    id: 'inc-' + Date.now(),
    type: 'other_income',
    label: CASH_RECONCILIATION_LABELS.other_income,
    amount: amount,
    note: 'অতিরিক্ত ক্যাশ আয়',
    date: new Date().toISOString()
  });
}

function recordCashReconciliationSale(amount) {
  const invoice = {
    id: Date.now(),
    invoiceNo: generateInvoiceNo(nextInvoiceNumber),
    customer: 'অতিরিক্ত বিক্রি (ক্যাশ মিলকরণ)',
    phone: '',
    items: [{ name: 'অতিরিক্ত বিক্রি / ক্যাশ সমন্বয়', qty: 1, price: amount, costPrice: 0, total: amount }],
    subtotal: amount,
    total: amount,
    discount: 0,
    discountAmount: 0,
    discountType: 'amount',
    paymentType: 'cash',
    paymentStatus: 'paid',
    dueAmount: 0,
    cashBalanceApplied: true,
    source: 'cash_reconciliation',
    date: new Date().toISOString()
  };
  invoices.unshift(invoice);
  nextInvoiceNumber++;
  localStorage.setItem('pos_next_inv_no', nextInvoiceNumber.toString());
  localStorage.setItem('pos_invoices', JSON.stringify(invoices));
  updateStats();
  renderInvoices();
  renderSalesMetrics();
  updateCurrentInvoiceNo();
  if (currentUserId) saveInvoiceToFirebase(invoice);
  logCashAdjustment({
    id: 'adj-' + invoice.id,
    type: 'sales_adjustment',
    label: CASH_RECONCILIATION_LABELS.sales_adjustment,
    amount: amount,
    note: 'ইনভয়েস ' + invoice.invoiceNo,
    date: invoice.date
  });
}

function recordCashReconciliationExpense(amount) {
  const category = 'দৈনন্দিন খরচ / বাজার খরচ';
  const expense = {
    id: Date.now(),
    category: category,
    items: [{ category: category, qty: 1, unitCost: amount, amount: amount, desc: 'ক্যাশ ঘাটতি সমন্বয়' }],
    amount: amount,
    source: 'cash',
    sourceLabel: srcLabelOf('cash'),
    desc: 'ক্যাশ ঘাটতি সমন্বয় (রিকনসিলিয়েশন)',
    date: new Date().toISOString(),
    reconciliation: true
  };
  expenses.unshift(expense);
  saveExpenses();
  renderExpenseList();
  renderFinanceSummary();
  if (currentUserId) saveExpenseToFirebase(expense);
  logCashAdjustment({
    id: 'adj-' + expense.id,
    type: 'expense',
    label: CASH_RECONCILIATION_LABELS.expense,
    amount: -amount,
    note: 'ঘাটতি খরচ হিসেবে রেকর্ড',
    date: expense.date
  });
}

function recordCashReconciliationLoan(amount) {
  const creditor = {
    id: Date.now(),
    name: 'ক্যাশ ঘাটতি থেকে ধার',
    taken: amount,
    paid: 0,
    due: amount,
    date: new Date().toISOString(),
    note: 'ক্যাশ রিকনসিলিয়েশন — ধার দেওয়া'
  };
  creditors.unshift(creditor);
  saveCreditors();
  renderCreditorList();
  populateExpenseCategoryOptions();
  renderFinanceSummary();
  if (currentUserId) saveCreditorToFirebase(creditor);
  logCashAdjustment({
    id: 'adj-' + creditor.id,
    type: 'loan_given',
    label: CASH_RECONCILIATION_LABELS.loan_given,
    amount: -amount,
    note: creditor.name,
    date: creditor.date
  });
}

function confirmCashReconciliation(choice) {
  const pending = pendingCashReconciliation;
  if (!pending || !CASH_RECONCILIATION_LABELS[choice]) return;
  // বেশি টাকার জন্য আয়/বিক্রয় এবং কম টাকার জন্য খরচ/ধার — শুধু সঠিক অপশন গ্রহণযোগ্য
  if (pending.surplus ? (choice === 'expense' || choice === 'loan_given')
    : (choice === 'other_income' || choice === 'sales_adjustment')) return;
  const amount = roundMoney(pending.amount);
  try {
    if (choice === 'other_income') recordCashReconciliationIncome(amount);
    else if (choice === 'sales_adjustment') recordCashReconciliationSale(amount);
    else if (choice === 'expense') recordCashReconciliationExpense(amount);
    else if (choice === 'loan_given') recordCashReconciliationLoan(amount);

    // নতুন গণনাই এখন থেকে দুই ব্যালেন্সের ভিত্তি (ক্যাশ বা ডিজিটাল কোথাও শূন্য করা হয় না)
    setExpectedCashBalance(pending.countedCash, { mirror: true });
    setExpectedDigitalBalance(pending.countedDigital);
    persistCashRegisterSnapshot('reconciliation', {
      reconciliation: {
        id: 'rec-' + Date.now(),
        type: choice,
        label: CASH_RECONCILIATION_LABELS[choice],
        amount: pending.surplus ? amount : -amount,
        expectedBefore: pending.expectedBefore,
        expectedDigitalBefore: pending.expectedDigitalBefore,
        expectedGrandBefore: pending.expectedGrandBefore,
        countedCash: pending.countedCash,
        countedDigital: pending.countedDigital,
        at: new Date().toISOString()
      }
    });
    const wasSurplus = pending.surplus;
    pendingCashReconciliation = null;
    closeCashReconciliation();
    renderFinanceSummary();
    showToast('✅ ক্যাশ রিকনসিলিয়েশন সম্পন্ন · ' + CASH_RECONCILIATION_LABELS[choice] + ' '
      + formatMoney(amount) + (wasSurplus ? ' যোগ হয়েছে' : ' রেকর্ড হয়েছে'));
  } catch (error) {
    console.error('ক্যাশ রিকনসিলিয়েশন ত্রুটি:', error);
    showToast('ক্যাশ রিকনসিলিয়েশন সম্পন্ন হয়নি: ' + (error.message || error), 'error');
  }
}

function buildRegisterUI() {
  const denomGrid = document.getElementById('cashDenomGrid');
  const balGrid = document.getElementById('balanceInputGrid');
  if (!denomGrid || !balGrid) return;
  denomGrid.innerHTML = CASH_DENOMS.map(d => `
<div class="cash-cell">
  <label for="denom_${d}">৳${toBnNum(d)} টাকা নোট</label>
  <input type="number" id="denom_${d}" min="0" step="1" placeholder="০" oninput="updateRegisterTotals()">
</div>`).join('');
  balGrid.innerHTML = BALANCE_ACCOUNTS.map(a => `
<div class="cash-cell">
  <label for="bal_${a.key}">${a.label}</label>
  <input type="number" id="bal_${a.key}" min="0" step="0.01" placeholder="০" oninput="updateRegisterTotals()">
</div>`).join('');
}

function registerCashTotal() {
  let total = 0;
  CASH_DENOMS.forEach(d => {
    const el = document.getElementById('denom_' + d);
    total += d * Math.max(0, safeNum(el ? el.value : 0));
  });
  return total;
}

function registerDigitalTotal() {
  let total = 0;
  BALANCE_ACCOUNTS.forEach(a => {
    const el = document.getElementById('bal_' + a.key);
    total += Math.max(0, safeNum(el ? el.value : 0));
  });
  return total;
}

function updateRegisterTotals() {
  try {
    const cash = registerCashTotal();
    const digital = registerDigitalTotal();
    const grand = cash + digital;
    const cashEl = document.getElementById('cashTotalDisplay');
    const grandEl = document.getElementById('grandBalanceTotal');
    const breakEl = document.getElementById('grandBalanceBreakdown');
    if (cashEl) cashEl.textContent = formatMoney(cash);
    if (grandEl) grandEl.textContent = formatMoney(grand);
    if (breakEl) breakEl.textContent = 'ক্যাশ ' + formatMoney(cash) + ' + ডিজিটাল ' + formatMoney(digital);
    updateExpectedCashPanel();
    updateNetAssetsCard();
  } catch (error) {
    console.error('রেজিস্টার হিসাব ত্রুটি:', error);
  }
}

async function saveRegister() {
  let localSaved = false;
  try {
    const bal = consolidatedBalances();
    const difference = bal.consolidatedDifference;
    // পপআপ শুধু তখনই আসবে যখন মোট (ক্যাশ + ডিজিটাল) সত্যিই সিস্টেমের হিসাবের সঙ্গে মেলে না
    if (Math.abs(difference) >= 0.01) {
      showCashReconciliationPrompt(difference, bal);
      return;
    }
    // মোট মিলে গেলে ক্যাশ ↔ ডিজিটাল স্থানান্তর হিসেবেই সেভ হবে, কোনো ব্যালেন্স শূন্য হবে না
    const cashShift = roundMoney(bal.cashDifference);
    const digitalShift = roundMoney(bal.digitalDifference);
    commitConsolidatedBaseline(bal);
    persistCashRegisterSnapshot('manual', {
      expectedCash: bal.cash,
      expectedDigital: bal.digital,
      transferDetected: Math.abs(cashShift) >= 0.01 && Math.abs(roundMoney(cashShift + digitalShift)) < 0.01
        ? { cash: cashShift, digital: digitalShift }
        : null
    });
    localSaved = true;
    updateRegisterTotals();
    const shiftNote = Math.abs(digitalShift) >= 0.01
      ? ' · ক্যাশ ↔ ডিজিটাল সমন্বয় ' + formatMoney(Math.abs(digitalShift))
      : '';
    showToast((currentUserId
      ? '✅ মোট ব্যালেন্স সেভ হয়েছে — Firebase-এ সিঙ্ক হচ্ছে'
      : '✅ মোট ব্যালেন্স লোকালি সেভ হয়েছে') + shiftNote);
  } catch (error) {
    console.error('ক্যাশ রেজিস্টার সেভ ত্রুটি:', error);
    showToast((localSaved ? 'লোকালি সেভ হয়েছে, কিন্তু ক্লাউডে সিঙ্ক হয়নি: ' : 'সেভ করা যায়নি: ') + error.message, 'error');
  }
}

function parseRegisterMap(value, label) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); }
    catch (error) { throw new Error(label + ' JSON ত্রুটিপূর্ণ: ' + error.message); }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(label + ' একটি অবজেক্ট হতে হবে');
  }
  return parsed;
}

function loadRegister(sourceData) {
  try {
    let data = sourceData;
    if (!data) {
      const raw = localStorage.getItem('pos_cash_register');
      if (!raw) return false;
      data = JSON.parse(raw);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('ক্যাশ রেজিস্টার রেকর্ডটি সঠিক অবজেক্ট নয়');
    }
    const denominations = parseRegisterMap(data.denominations, 'Denominations');
    const balances = parseRegisterMap(data.balances, 'Balances');
    const recordExpected = data.expectedCash === undefined || data.expectedCash === null
      ? safeNum(data.cashTotal) : safeNum(data.expectedCash);
    expectedCashBalance = Math.max(0, roundMoney(recordExpected));
    try { localStorage.setItem(EXPECTED_CASH_STORAGE_KEY, String(expectedCashBalance)); } catch (error) { }
    const recordBalancesTotal = BALANCE_ACCOUNTS.reduce((sum, a) => sum + Math.max(0, safeNum(balances[a.key])), 0);
    const hasDigitalRecord = (data.expectedDigital !== undefined && data.expectedDigital !== null)
      || (data.digitalTotal !== undefined && data.digitalTotal !== null);
    if (hasDigitalRecord || recordBalancesTotal > 0) {
      const recordDigital = hasDigitalRecord
        ? (data.expectedDigital !== undefined && data.expectedDigital !== null ? data.expectedDigital : data.digitalTotal)
        : recordBalancesTotal;
      initializeExpectedDigitalBalance(recordDigital);
    }
    if (!sourceData) {
      cashHistoryRecords = [data];
      renderCashHistory();
    }
    CASH_DENOMS.forEach(d => {
      const el = document.getElementById('denom_' + d);
      if (el) { const v = safeNum(denominations[d]); el.value = v > 0 ? String(v) : ''; }
    });
    BALANCE_ACCOUNTS.forEach(a => {
      const el = document.getElementById('bal_' + a.key);
      if (el) { const v = safeNum(balances[a.key]); el.value = v > 0 ? String(v) : ''; }
    });
    return true;
  } catch (error) {
    console.error('রেজিস্টার লোড ত্রুটি:', error);
    return false;
  }
}

function resetRegister() {
  CASH_DENOMS.forEach(d => { const el = document.getElementById('denom_' + d); if (el) el.value = ''; });
  BALANCE_ACCOUNTS.forEach(a => { const el = document.getElementById('bal_' + a.key); if (el) el.value = ''; });
  updateRegisterTotals();
  showToast('🔄 রেজিস্টার রিসেট হয়েছে (সেভ করা পুরোনো রেকর্ড মোবাইলে থাকবে — নতুন মান সেভ করলে আপডেট হবে)');
}

function renderCashHistory() {
  const list = document.getElementById('cashHistoryList');
  if (!list) return;
  const records = cashHistoryRecords.slice().sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')));
  const adjustmentHtml = cashAdjustmentLog.length ? `
<div class="cash-history-row" style="background:var(--gray-50);font-weight:800;">সাম্প্রতিক ক্যাশ সমন্বয়</div>` +
    cashAdjustmentLog.slice(0, 8).map(entry => `
<div class="cash-history-row">
  <div><strong>${escapeHtml(entry.label || 'সমন্বয়')}</strong><br><span>${formatDate(entry.date)}${entry.note ? ' · ' + escapeHtml(entry.note) : ''}</span></div>
  <strong style="color:${safeNum(entry.amount) >= 0 ? 'var(--success)' : '#dc2626'};">${safeNum(entry.amount) >= 0 ? '+' : '−'}${formatMoney(Math.abs(safeNum(entry.amount)))}</strong>
</div>`).join('') : '';
  if (!records.length) {
    list.innerHTML = adjustmentHtml || '<div class="empty">কোনো ক্যাশ রেকর্ড নেই</div>';
    return;
  }
  list.innerHTML = records.map(record => `
<div class="cash-history-row">
  <div><strong>${escapeHtml(record.date || 'তারিখ নেই')}</strong><br><span>ক্যাশ ${formatMoney(record.cashTotal)} · ডিজিটাল ${formatMoney(record.digitalTotal)}</span></div>
  <strong>${formatMoney(record.grandTotal)}</strong>
</div>`).join('') + adjustmentHtml;
}

function saveCreditors() { try { localStorage.setItem('pos_creditors', JSON.stringify(creditors)); } catch (e) { } }

function saveExpenses() { try { localStorage.setItem('pos_expenses', JSON.stringify(expenses)); } catch (e) { } }

async function backupCreditorToSheet(c) { await saveCreditorToFirebase(c); }

async function removeCreditorFromSheet(id) { await removeCreditorFromFirebase(id); }

async function backupExpenseToSheet(e) { await saveExpenseToFirebase(e); }

async function removeExpenseFromSheet(id) { await removeExpenseFromFirebase(id); }

function getExpenseCategoryList() {
  const raw = typeof settings.expenseCategories === 'string' && settings.expenseCategories.trim()
    ? settings.expenseCategories
    : DEFAULT_EXPENSE_CATEGORIES.join('\n');
  const cats = raw.split('\n').map(s => s.trim()).filter(Boolean);
  return [...new Set(cats)];
}

function expenseSourceOptions() {
  const opts = [{ key: 'cash', label: '💵 ক্যাশ (অপারেশনাল ব্যালেন্স)' }];
  BALANCE_ACCOUNTS.forEach(a => opts.push({ key: a.key, label: '📱 ' + a.label }));
  return opts;
}

function srcLabelOf(sourceKey) {
  const source = expenseSourceOptions().find(option => option.key === sourceKey);
  return source ? source.label : 'অজানা পেমেন্ট মাধ্যম';
}

function getRegisterBalanceValue(sourceKey) {
  // ক্যাশের ক্ষেত্রে সিস্টেমের প্রত্যাশিত অপারেশনাল ব্যালেন্সই মূল হিসাব
  if (sourceKey === 'cash') return roundMoney(expectedCashBalance);
  const el = document.getElementById('bal_' + sourceKey);
  return Math.max(0, safeNum(el ? el.value : 0));
}

function setRegisterBalanceValue(sourceKey, value) {
  const v = Math.max(0, roundMoney(value));
  if (sourceKey === 'cash') {
    setExpectedCashBalance(v);
    return;
  }
  const el = document.getElementById('bal_' + sourceKey);
  if (el) el.value = v > 0 ? String(v) : '';
  updateRegisterTotals();
}

function populateExpenseCategoryOptions() {
  document.querySelectorAll('#expenseItemsContainer .exp-item-row').forEach(row => {
    const sel = row.querySelector('.expCatSelect');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = expenseCategoryDropdownHtml(prev);
    onExpCatChange(sel);
  });
}

function resolveCreditor(name) {
  const target = String(name || '').trim().toLowerCase();
  if (!target) return null;
  return creditors.find(c => String(c.name || '').trim().toLowerCase() === target) || null;
}

function renderCreditorList() {
  const wrap = document.getElementById('creditorList');
  if (!wrap) return;
  if (!creditors.length) {
    wrap.innerHTML = '<div style="color:var(--gray-500);font-size:13px;padding:6px 2px;">এখনো কোনো পাওনাদার নেই। উপরের ফর্মে যোগ করুন।</div>';
    return;
  }
  wrap.innerHTML = creditors.map(c => {
    const taken = safeNum(c.taken), paid = safeNum(c.paid), due = Math.max(0, taken - paid);
    return `
<div class="creditor-row">
  <div class="creditor-info">
    <div class="creditor-name">🤝 ${escapeHtml(c.name)}</div>
    <div class="creditor-sub">ধারা ${formatMoney(taken)} · পরিশোধ ${formatMoney(paid)} · ${formatDate(c.date)}</div>
  </div>
  <div class="creditor-due" style="color:${due > 0 ? '#dc2626' : 'var(--success)'};">বকেয়া ${formatMoney(due)}</div>
  <div class="row-actions">
    <button class="mini-btn pay" onclick="payCreditorPrompt(${safeNum(c.id)})">✅ পরিশোধ</button>
    <button class="mini-btn del" onclick="deleteCreditor(${safeNum(c.id)})">🗑️</button>
  </div>
</div>`;
  }).join('');
}

function addCreditor() {
  try {
    const nameEl = document.getElementById('creditorName');
    const amtEl = document.getElementById('creditorAmount');
    const paidEl = document.getElementById('creditorPaid');
    const name = (nameEl.value || '').trim();
    const taken = Math.max(0, safeNum(amtEl.value));
    const paid = Math.max(0, safeNum(paidEl.value));
    if (!name) return showToast('পাওনাদারের নাম লিখুন', 'error');
    if (taken <= 0 && paid <= 0) return showToast('ধারার পরিমাণ অথবা পরিশোধের পরিমাণ দিন', 'error');
    if (paid > taken) return showToast('পরিশোধের পরিমাণ ধারার অঙ্কের চেয়ে বেশি হতে পারবে না।', 'error');
    const creditor = {
      id: Date.now(), name: name, taken: taken, paid: paid,
      due: Math.max(0, Number((taken - paid).toFixed(2))), date: new Date().toISOString()
    };
    creditors.unshift(creditor);
    saveCreditors();
    backupCreditorToSheet(creditor);
    nameEl.value = ''; amtEl.value = ''; paidEl.value = '';
    renderCreditorList();
    populateExpenseCategoryOptions();
    renderFinanceSummary();
    showToast('✓ পাওনাদার "' + name + '" যোগ হয়েছে (বকেয়া ' + formatMoney(Math.max(0, taken - paid)) + ')');
  } catch (error) {
    console.error('addCreditor ত্রুটি:', error);
    showToast('পাওনাদার যোগ করা যায়নি: ' + error.message, 'error');
  }
}

function payCreditorPrompt(id) {
  const c = creditors.find(x => safeNum(x.id) === safeNum(id));
  if (!c) return showToast('পাওনাদার খুঁজে পাওয়া যায়নি', 'error');
  const due = Math.max(0, Number((safeNum(c.taken) - safeNum(c.paid)).toFixed(2)));
  if (due <= 0) return showToast('"' + c.name + '" এর কোনো বকেয়া নেই');
  const input = prompt('"' + c.name + '" কে কত টাকা পরিশোধ করবেন?\n(বর্তমান বকেয়া: ' + formatMoney(due) + ')', due.toFixed(2));
  if (input === null) return;
  const amount = Number(safeNum(input).toFixed(2));
  if (amount <= 0) return showToast('সঠিক পরিমাণ দিন', 'error');
  if (amount - due > 0.001) return showToast('পরিশোধের পরিমাণ বর্তমান বকেয়ার চেয়ে বেশি হতে পারবে না।', 'error');
  c.paid = Number((safeNum(c.paid) + amount).toFixed(2));
  c.due = Math.max(0, Number((safeNum(c.taken) - c.paid).toFixed(2)));
  saveCreditors();
  backupCreditorToSheet(c);
  renderCreditorList();
  renderFinanceSummary();
  showToast('✓ "' + c.name + '" — ' + formatMoney(amount) + ' পরিশোধ হিসাব হয়েছে (নতুন বকেয়া ' + formatMoney(c.due) + ')');
}

function deleteCreditor(id) {
  const c = creditors.find(x => safeNum(x.id) === safeNum(id));
  if (!c) return;
  if (!confirm('"' + c.name + '" এর রেকর্ড মুছে ফেলবেন?')) return;
  creditors = creditors.filter(x => safeNum(x.id) !== safeNum(id));
  saveCreditors();
  removeCreditorFromSheet(id);
  renderCreditorList();
  populateExpenseCategoryOptions();
  renderFinanceSummary();
  showToast('🗑️ পাওনাদারের রেকর্ড মুছে ফেলা হয়েছে');
}

function renderExpenseList() {
  const wrap = document.getElementById('expenseList');
  if (!wrap) return;
  const monthFilterEl = document.getElementById('expenseMonthFilter');
  const monthVal = monthFilterEl ? monthFilterEl.value : '';
  const list = monthVal
    ? expenses.filter(e => String(e.date || '').slice(0, 7) === monthVal)
    : expenses;
  if (!list.length) {
    wrap.innerHTML = '<div style="color:var(--gray-500);font-size:13px;padding:8px 2px;">এই সময়ের কোনো খরচ নেই।</div>';
    return;
  }
  const srcLabels = {};
  expenseSourceOptions().forEach(o => { srcLabels[o.key] = o.label; });
  wrap.innerHTML = list.map(e => `
<div class="expense-row">
  <div class="expense-info">
    <div><span class="expense-cat-tag">${escapeHtml(e.category || '')}</span><b>${formatMoney(e.amount)}</b></div>
    <div class="expense-sub">${formatDate(e.date)} · মাধ্যম: ${escapeHtml(e.sourceLabel || srcLabels[e.source] || e.source || '')}${e.desc ? ' · ' + escapeHtml(e.desc) : ''}</div>
  </div>
  <div class="row-actions">
    <button class="mini-btn edit" onclick="editExpense(${safeNum(e.id)})">✏️ এডিট</button>
    <button class="mini-btn pay" onclick="printExpense(${safeNum(e.id)})">🖨️ প্রিন্ট</button>
    <button class="mini-btn del" onclick="deleteExpense(${safeNum(e.id)})">🗑️ ডিলিট</button>
  </div>
</div>`).join('');
}

function expenseCategoryDropdownHtml(selected) {
  const cats = getExpenseCategoryList();
  const creditorNames = [...new Set(creditors.map(c => String(c.name || '').trim()).filter(Boolean))];
  let html = '<option value="">-- বাছাই করুন --</option>';
  cats.forEach(c => {
    html += `<option value="${escapeHtml(c)}" ${c === selected ? 'selected' : ''}>${escapeHtml(c)}</option>`;
  });
  if (creditorNames.length) {
    html += '<optgroup label="🤝 পাওনাদারকে পরিশোধ">' +
      creditorNames.map(n => `<option value="${escapeHtml(n)}" ${n === selected ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('') + '</optgroup>';
  }
  html += `<option value="__other__" ${selected === '__other__' ? 'selected' : ''}>✏️ অন্যান্য (নতুন নাম লিখুন...)</option>`;
  return html;
}

function addExpenseItem(data) {
  const container = document.getElementById('expenseItemsContainer');
  if (!container) return;
  const d = data || {};
  const escAttr = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const row = document.createElement('div');
  row.className = 'exp-item-row';
  row.innerHTML = `
<div class="exp-cat-col">
  <select class="expCatSelect" onchange="onExpCatChange(this); calcExpenseFormTotal()">${expenseCategoryDropdownHtml(d.category || '')}</select>
  <input type="text" class="expCatOther" placeholder="নতুন খরচের নাম লিখুন..." value="${d.category === '__other__' ? escAttr(d.otherName) : ''}" style="display:${d.category === '__other__' ? 'block' : 'none'};margin-top:6px;" oninput="calcExpenseFormTotal()">
</div>
<div class="exp-desc-col"><input type="text" class="expDesc" placeholder="বিবরণ (যেমন: রিকশা ভাড়া)" value="${escAttr(d.desc)}"></div>
<input type="number" class="expQty" min="1" step="1" value="${safeNum(d.qty) > 0 ? safeNum(d.qty) : 1}" oninput="calcExpenseFormTotal()">
<input type="number" class="expCost" min="0" step="0.01" placeholder="মূল্য" value="${safeNum(d.unitCost) || ''}" oninput="calcExpenseFormTotal()">
<div class="exp-item-total">৳০</div>
<button type="button" class="exp-remove-btn" title="সারি মুছুন" onclick="this.parentElement.remove(); calcExpenseFormTotal()">×</button>`;
  container.appendChild(row);
  calcExpenseFormTotal();
}

function onExpCatChange(sel) {
  const row = sel.closest('.exp-item-row');
  const other = row.querySelector('.expCatOther');
  other.style.display = sel.value === '__other__' ? 'block' : 'none';
  if (sel.value !== '__other__') other.value = '';
}

function calcExpenseFormTotal() {
  let total = 0;
  document.querySelectorAll('#expenseItemsContainer .exp-item-row').forEach(row => {
    const amt = Math.max(0, safeNum(row.querySelector('.expQty').value)) * Math.max(0, safeNum(row.querySelector('.expCost').value));
    const disp = row.querySelector('.exp-item-total');
    if (disp) disp.textContent = formatMoney(amt);
    total += amt;
  });
  const g = document.getElementById('expenseGrandTotal');
  if (g) g.value = formatMoney(total);
  return total;
}

function collectExpenseFormRows() {
  const rows = [];
  document.querySelectorAll('#expenseItemsContainer .exp-item-row').forEach(row => {
    const sel = row.querySelector('.expCatSelect');
    const other = row.querySelector('.expCatOther');
    const category = sel.value === '__other__' ? (other.value || '').trim() : sel.value;
    const qty = Math.max(0, safeNum(row.querySelector('.expQty').value));
    const unitCost = Math.max(0, safeNum(row.querySelector('.expCost').value));
    const amount = Math.round(qty * unitCost * 100) / 100;
    const desc = (row.querySelector('.expDesc').value || '').trim();
    if (!category && !(qty > 0 && unitCost > 0)) return;
    if (!category) { throw new Error('প্রতিটি খরচের সারিতে ক্যাটাগরি / পাওনাদার বাছাই করুন'); }
    if (!(amount > 0)) { throw new Error('"' + category + '" সারির পরিমাণ ও একক খরচ দিন'); }
    rows.push({ category, qty: qty || 1, unitCost, amount, desc });
  });
  return rows;
}

function setSourceBalanceDelta(sourceKey, delta) {
  const current = getRegisterBalanceValue(sourceKey);
  setRegisterBalanceValue(sourceKey, Math.max(0, current + delta));
  if (sourceKey !== 'cash') {
    // ডিজিটাল অ্যাকাউন্ট থেকে খরচ হলে প্রত্যাশিত ডিজিটাল ভিত্তিও কমে, যাতে একত্রিত হিসাবে ভুয়া ঘাটতি না আসে
    const amount = safeNum(delta);
    const baseline = expectedDigitalKnown ? expectedDigitalBalance : roundMoney(registerDigitalTotal() - amount);
    setExpectedDigitalBalance(baseline + amount);
    updateRegisterTotals();
  }
}

function applyExpenseEffects(rows, source, sign) {
  const totalAmount = rows.reduce((sum, r) => sum + safeNum(r.amount), 0);
  setSourceBalanceDelta(source, -sign * totalAmount);
  const byCreditor = {};
  rows.forEach(r => {
    const c = resolveCreditor(r.category);
    if (!c) return;
    byCreditor[c.id] = (byCreditor[c.id] || 0) + safeNum(r.amount);
  });
  Object.keys(byCreditor).forEach(id => {
    const c = creditors.find(x => safeNum(x.id) === safeNum(id));
    if (!c) return;
    c.paid = Math.max(0, safeNum(c.paid) - sign * byCreditor[id]);
  });
  saveCreditors();
}

function saveExpenseForm() {
  try {
    const rows = collectExpenseFormRows();
    if (!rows.length) return showToast('অন্তত একটি খরচের সারি পূরণ করুন (ক্যাটাগরি + পরিমাণ + একক খরচ)', 'error');
    const srcEl = document.getElementById('expenseSource');
    const source = srcEl.value || 'cash';
    const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);

    if (editingExpenseId !== null) {
      const e = expenses.find(x => safeNum(x.id) === safeNum(editingExpenseId));
      if (!e) { resetExpenseForm(); return showToast('মূল খরচের রেকর্ড পাওয়া যায়নি', 'error'); }
      const oldSource = e.source || 'cash';
      applyExpenseEffects(e.items && e.items.length ? e.items : [{ category: e.category, amount: safeNum(e.amount) }], oldSource, -1);
      const available = getRegisterBalanceValue(source);
      if (available < totalAmount) {
        applyExpenseEffects(e.items && e.items.length ? e.items : [{ category: e.category, amount: safeNum(e.amount) }], oldSource, 1);
        return showToast('⚠️ "' + srcLabelOf(source) + '" এ মাত্র ' + formatMoney(available) + ' আছে — ' + formatMoney(totalAmount) + ' কাটা যাবে না।', 'error');
      }
      applyExpenseEffects(rows, source, 1);
      e.category = rows.map(r => r.category).join(', ');
      e.items = rows;
      e.amount = totalAmount;
      e.source = source;
      e.sourceLabel = srcLabelOf(source);
      e.desc = rows.map(r => r.desc).filter(Boolean).join('; ');
      saveExpenses();
      backupExpenseToSheet(e);
      resetExpenseForm();
      renderExpenseList();
      renderCreditorList();
      populateExpenseCategoryOptions();
      renderFinanceSummary();
      persistCashRegisterSnapshot('expense_update');
      showToast('✓ খরচ আপডেট হয়েছে: ' + formatMoney(totalAmount) + ' (' + srcLabelOf(source) + ')');
      return;
    }

    const available = getRegisterBalanceValue(source);
    if (available < totalAmount) {
      return showToast('⚠️ "' + srcLabelOf(source) + '" এ মাত্র ' + formatMoney(available) + ' আছে — ' + formatMoney(totalAmount) + ' কাটা যাবে না। প্রথমে রেজিস্টারে ব্যালেন্স লিখে 💾 সেভ করুন।', 'error');
    }
    applyExpenseEffects(rows, source, 1);
    const expense = {
      id: Date.now(),
      category: rows.map(r => r.category).join(', '),
      items: rows,
      amount: totalAmount,
      source: source,
      sourceLabel: srcLabelOf(source),
      desc: rows.map(r => r.desc).filter(Boolean).join('; '),
      date: new Date().toISOString()
    };
    expenses.unshift(expense);
    saveExpenses();
    backupExpenseToSheet(expense);
    resetExpenseForm();
    renderExpenseList();
    renderCreditorList();
    populateExpenseCategoryOptions();
    renderFinanceSummary();
    persistCashRegisterSnapshot('expense');
    showToast('✓ খরচ সেভ হয়েছে: ' + formatMoney(totalAmount) + ' (' + srcLabelOf(source) + ')' + (resolveCreditor(rows[0].category) ? ' — বকেয়া কমেছে' : ''));
  } catch (error) {
    console.error('saveExpenseForm ত্রুটি:', error);
    showToast(error.message || 'খরচ সেভ করা যায়নি', 'error');
  }
}

function resetExpenseForm() {
  editingExpenseId = null;
  const container = document.getElementById('expenseItemsContainer');
  if (container) container.innerHTML = '';
  addExpenseItem();
  const srcSel = document.getElementById('expenseSource');
  if (srcSel) srcSel.value = 'cash';
  const banner = document.getElementById('expenseEditBanner');
  if (banner) { banner.style.display = 'none'; banner.textContent = ''; }
  calcExpenseFormTotal();
}

function editExpense(id) {
  const e = expenses.find(x => safeNum(x.id) === safeNum(id));
  if (!e) return showToast('খরচের রেকর্ড পাওয়া যায়নি', 'error');
  editingExpenseId = safeNum(e.id);
  const container = document.getElementById('expenseItemsContainer');
  if (container) container.innerHTML = '';
  const rows = (Array.isArray(e.items) && e.items.length)
    ? e.items
    : [{ category: e.category, qty: 1, unitCost: safeNum(e.amount), amount: safeNum(e.amount), desc: e.desc || '' }];
  rows.forEach(r => addExpenseItem(r));
  const srcSel = document.getElementById('expenseSource');
  if (srcSel) srcSel.value = e.source || 'cash';
  const banner = document.getElementById('expenseEditBanner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = '✏️ এডিট মোড: "' + (e.category || '') + '" (' + formatDate(e.date) + ') — পরিবর্তন করে আবার 💾 সেভ করুন; বাতিল করতে 🔄 রিসেট চাপুন।';
  }
  calcExpenseFormTotal();
  if (container) container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function printExpense(id) {
  const e = expenses.find(x => safeNum(x.id) === safeNum(id));
  if (!e) return showToast('খরচের রেকর্ড পাওয়া যায়নি', 'error');
  const rows = (Array.isArray(e.items) && e.items.length)
    ? e.items
    : [{ category: e.category, qty: 1, unitCost: safeNum(e.amount), amount: safeNum(e.amount), desc: '' }];
  const itemsHtml = rows.map(r => `
<tr>
  <td>${escapeHtml(r.category || '')}${r.desc ? '<br><small>' + escapeHtml(r.desc) + '</small>' : ''}</td>
  <td style="text-align:center;">${toBnNum(safeNum(r.qty) || 1)}</td>
  <td style="text-align:right;">${formatMoney(r.unitCost)}</td>
  <td style="text-align:right;font-weight:700;">${formatMoney(r.amount)}</td>
</tr>`).join('');
  const win = window.open('', '_blank');
  if (!win) return showToast('প্রিন্ট উইন্ডো খোলা যায়নি — ব্রাউজার popup ব্লক চেক করুন', 'error');
  win.document.write(`<!DOCTYPE html><html><head><title>খরচের রসিদ</title>
<style>body{font-family:'Noto Sans Bengali',Arial,sans-serif;padding:24px;max-width:520px;margin:auto;}
h2{text-align:center;margin-bottom:4px;} .sub{text-align:center;color:#555;font-size:13px;margin-bottom:16px;}
table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;font-size:14px;}
th{background:#f1f5f9;} .tot{font-size:17px;font-weight:800;text-align:right;margin-top:14px;}
.meta{font-size:13px;color:#333;margin-bottom:10px;}</style></head><body>
<h2>ABC Computer</h2><div class="sub">খরচের রসিদ (Expense Receipt)</div>
<div class="meta">তারিখ: ${formatDate(e.date)}<br>ক্যাটাগরি: ${escapeHtml(e.category || '')}<br>পেমেন্ট মাধ্যম: ${escapeHtml(e.sourceLabel || srcLabelOf(e.source))}</div>
<table><thead><tr><th>খাত / বিবরণ</th><th>পরিমাণ</th><th>একক খরচ</th><th>মোট</th></tr></thead>
<tbody>${itemsHtml}</tbody></table>
<div class="tot">সর্বমোট: ${formatMoney(e.amount)}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
</body></html>`);
  win.document.close();
}

function deleteExpense(id) {
  const e = expenses.find(x => safeNum(x.id) === safeNum(id));
  if (!e) return;
  if (!confirm('"' + e.category + '" এর ' + formatMoney(e.amount) + ' খরচের রেকর্ড মুছবেন?\n(মুছলে উৎসের ব্যালেন্স ও পাওনাদারের বকেয়া স্বয়ংক্রিয়ভাবে ফিরে আসবে)')) return;
  const rows = (Array.isArray(e.items) && e.items.length)
    ? e.items
    : [{ category: e.category, amount: safeNum(e.amount) }];
  applyExpenseEffects(rows, e.source || 'cash', -1);
  expenses = expenses.filter(x => safeNum(x.id) !== safeNum(id));
  saveExpenses();
  removeExpenseFromSheet(id);
  if (safeNum(editingExpenseId) === safeNum(id)) resetExpenseForm();
  renderExpenseList();
  renderCreditorList();
  renderFinanceSummary();
  persistCashRegisterSnapshot('expense_delete');
  showToast('🗑️ খরচের রেকর্ড মুছে ' + formatMoney(e.amount) + ' "' + srcLabelOf(e.source) + '" ব্যালেন্সে ফেরত দেওয়া হয়েছে');
}

function computeFinanceSummary() {
  const totalSales = invoices.reduce((sum, inv) => sum + safeNum(inv.total), 0);
  const totalCost = invoices.reduce((sum, inv) => sum + getInvoiceCostTotal(inv), 0);
  const grossProfit = totalSales - totalCost;
  const totalExpenses = expenses.reduce((sum, e) => sum + safeNum(e.amount), 0);
  const totalDue = creditors.reduce((sum, c) => sum + Math.max(0, safeNum(c.taken) - safeNum(c.paid)), 0);
  return { totalSales, totalCost, grossProfit, totalExpenses, totalDue, netPosition: grossProfit - totalExpenses };
}

function renderFinanceSummary() {
  const grid = document.getElementById('financeSummaryGrid');
  if (!grid) return;
  updateDailyMetrics();
  const s = computeFinanceSummary();
  const cells = [
    { label: '🛒 মোট বিক্রি (সব)', value: formatMoney(s.totalSales), cls: 'sc-blue' },
    { label: '📦 মোট কস্ট (সব)', value: formatMoney(s.totalCost), cls: '' },
    { label: '📈 মোট লাভ (সব)', value: formatMoney(s.grossProfit), cls: s.grossProfit >= 0 ? 'sc-green' : 'sc-red' },
    { label: '💸 মোট খরচ', value: formatMoney(s.totalExpenses), cls: 'sc-red' },
    { label: '🤝 পাওনাদার / বকেয়া', value: formatMoney(s.totalDue), cls: 'sc-red' },
    { label: '✅ খরচ বাদে নিট লাভ', value: formatMoney(s.netPosition), cls: s.netPosition >= 0 ? 'sc-green' : 'sc-red' }
  ];
  grid.innerHTML = cells.map(c => `
<div class="summary-cell">
  <div class="sc-label">${c.label}</div>
  <div class="sc-value ${c.cls}">${c.value}</div>
</div>`).join('');

  const srcWrap = document.getElementById('sourceBalanceGrid');
  if (srcWrap) {
    srcWrap.innerHTML = expenseSourceOptions().map(o => `
  <div class="summary-cell">
    <div class="sc-label">${escapeHtml(o.label)}</div>
    <div class="sc-value">${formatMoney(getRegisterBalanceValue(o.key))}</div>
  </div>`).join('');
  }

  const netEl = document.getElementById('netPositionValue');
  const breakEl = document.getElementById('netPositionBreakdown');
  if (netEl) netEl.textContent = formatMoney(s.netPosition);
  if (breakEl) breakEl.textContent = 'নিট লাভ ' + formatMoney(s.grossProfit) + ' − মোট খরচ ' + formatMoney(s.totalExpenses);
}

function buildExpensesUI() {
  const srcSel = document.getElementById('expenseSource');
  if (srcSel) {
    srcSel.innerHTML = expenseSourceOptions()
      .map(o => `<option value="${o.key}">${escapeHtml(o.label)}</option>`).join('');
  }
  const mf = document.getElementById('expenseMonthFilter');
  if (mf && !mf.value) {
    const n = new Date();
    mf.value = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
  }
  const container = document.getElementById('expenseItemsContainer');
  if (container && !container.children.length) addExpenseItem();
}
