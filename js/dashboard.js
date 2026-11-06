/**
 * ABC POS - Navigation & Dashboard Analytics
 * Module: js/dashboard.js
 */

function switchTab(tabName) {
  const validTabs = ['sales', 'expenses', 'cash', 'creditors', 'dashboard', 'partner', 'admin'];
  if (!currentUser || currentAccess.role === 'Pending') return;
  if (currentAccess.role === 'Partner/Staff' && tabName !== 'partner') return;
  if (tabName === 'admin' && typeof isMasterAdmin === 'function' && !isMasterAdmin()) return;
  if (!validTabs.includes(tabName)) return;
  document.querySelectorAll('[data-tab-panel]').forEach(panel => {
    panel.hidden = panel.dataset.tabPanel !== tabName;
  });
  document.querySelectorAll('.app-nav [data-tab]').forEach(button => {
    if (button.dataset.tab === tabName) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (tabName === 'partner' && typeof renderPartnerDashboard === 'function') renderPartnerDashboard();
  if (tabName === 'admin' && typeof renderAdminManagement === 'function') renderAdminManagement();
  if (tabName === 'dashboard' && typeof updateStats === 'function') updateStats();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getInvoiceCostTotal(inv) {
  return typeof normalizeInvoiceFinancials === 'function'
    ? normalizeInvoiceFinancials(inv).costTotal
    : safeNum(inv.costTotal);
}

function currentPeriodInfo() {
  const sel = document.getElementById('periodSelect');
  const mode = sel ? sel.value : 'today';
  const now = new Date();
  if (mode === 'all') {
    return { mode, label: 'সব', start: null, end: null };
  }
  if (mode === 'month') {
    return { mode, label: 'এই মাসের', start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }
  let day;
  if (mode === 'custom') {
    const v = (document.getElementById('periodDate') || {}).value;
    day = v ? new Date(v + 'T00:00:00') : now;
    if (isNaN(day.getTime())) day = now;
  } else {
    day = now;
  }
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const isToday = start.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return { mode, label: isToday ? 'আজকের' : formatDate(start) + ' এর', start, end };
}

function isInPeriod(inv, p) {
  if (!p || !p.start) return true;
  if (p.mode === 'today' || p.mode === 'custom') {
    return localDateKey(inv.date) === localDateKey(p.start);
  }
  const d = new Date(inv.date);
  if (isNaN(d.getTime())) return false;
  return d >= p.start && d < p.end;
}

function updateStats() {
  const p = currentPeriodInfo();
  const periodInvoices = invoices.filter(inv => isInPeriod(inv, p));

  let periodSales = 0;
  periodInvoices.forEach(inv => { periodSales += Number(inv.total) || 0; });

  const todaySalesEl = document.getElementById('todaySales');
  if (todaySalesEl) todaySalesEl.textContent = formatMoney(periodSales);
  const totalCountEl = document.getElementById('totalCount');
  if (totalCountEl) totalCountEl.textContent = toBnNum(periodInvoices.length);

  const salesCardLabel = document.getElementById('salesCardLabel');
  if (salesCardLabel) salesCardLabel.textContent = (p.mode === 'all' ? 'সব সময়ের' : p.label) + ' বিক্রি';
  const countCardLabel = document.getElementById('countCardLabel');
  if (countCardLabel) countCardLabel.textContent = p.mode === 'all' ? 'মোট ইনভয়েস (সব)' : p.label + ' ইনভয়েস';

  updateNetAssetsCard();
  updateDailyMetrics();
}

function updateDailyMetrics() {
  const today = localDateKey();
  const todaySales = invoices.filter(inv => localDateKey(inv.date) === today);
  const todayGrossProfit = todaySales.reduce((sum, inv) =>
    sum + safeNum(inv.total) - getInvoiceCostTotal(inv), 0);
  const todayExpenseTotal = expenses.filter(expense => localDateKey(expense.date) === today)
    .reduce((sum, expense) => sum + safeNum(expense.amount), 0);
  const now = new Date();
  const monthPeriod = { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  const monthExpenseTotal = expenses.filter(expense => isInPeriod(expense, monthPeriod))
    .reduce((sum, expense) => sum + safeNum(expense.amount), 0);
  const profitEl = document.getElementById('todayProfit');
  const todayExpenseEl = document.getElementById('todayExpenses');
  const monthExpenseEl = document.getElementById('monthExpenses');
  if (profitEl) profitEl.textContent = formatMoney(todayGrossProfit - todayExpenseTotal);
  if (todayExpenseEl) todayExpenseEl.textContent = formatMoney(todayExpenseTotal);
  if (monthExpenseEl) monthExpenseEl.textContent = formatMoney(monthExpenseTotal);
}

function computeNetAssets() {
  const cash = typeof registerCashTotal === 'function' ? registerCashTotal() : 0;
  const digital = typeof registerDigitalTotal === 'function' ? registerDigitalTotal() : 0;
  const totalDue = creditors.reduce((sum, c) => sum + Math.max(0, safeNum(c.taken) - safeNum(c.paid)), 0);
  return { cash, digital, totalDue, net: cash + digital - totalDue };
}

function updateNetAssetsCard() {
  const el = document.getElementById('netAssetsTotal');
  const sub = document.getElementById('netAssetsBreakdown');
  if (!el || !sub) return;
  const na = computeNetAssets();
  el.textContent = formatMoney(na.net);
  el.style.color = na.net < 0 ? '#dc2626' : '';
  sub.textContent = 'ক্যাশ ' + formatMoney(na.cash) + ' + ডিজিটাল ' + formatMoney(na.digital) +
    ' − বকেয়া ' + formatMoney(na.totalDue);
}

function onPeriodChange() {
  const mode = document.getElementById('periodSelect').value;
  const dateInput = document.getElementById('periodDate');
  if (mode === 'custom') {
    if (!dateInput.value) {
      const n = new Date();
      dateInput.value = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
    }
    dateInput.style.display = '';
  } else {
    dateInput.style.display = 'none';
  }
  syncSectionFiltersToPeriod();
  updateStats();
}

function onPeriodDateChange() {
  syncSectionFiltersToPeriod();
  updateStats();
}

function periodMonthValue(p) {
  if (!p || p.mode === 'all' || p.mode === 'month') return '';
  const d = p.start || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function syncSectionFiltersToPeriod() {
  const p = currentPeriodInfo();
  const mf = document.getElementById('monthFilter');
  const ef = document.getElementById('expenseMonthFilter');
  if (mf) mf.value = periodMonthValue(p);
  if (ef) ef.value = periodMonthValue(p);
  try { if (typeof renderInvoices === 'function') renderInvoices(); } catch (e) { }
  try { if (typeof renderExpenseList === 'function') renderExpenseList(); } catch (e) { }
  try { if (typeof renderFinanceSummary === 'function') renderFinanceSummary(); } catch (e) { }
}

// Auto-reset at midnight
(function scheduleMidnightReset() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  setTimeout(function tick() {
    updateStats();
    if (typeof renderInvoices === 'function') renderInvoices();
    setTimeout(tick, 24 * 60 * 60 * 1000);
  }, nextMidnight - now);
})();
