/**
 * ABC POS - Partner Dashboard, POS Entry & Admin Partner Management
 * Module: js/partner.js
 */

let partnerMemberSyncRunning = false;

function refreshPartnerSaleCatalog() {
  const container = document.getElementById('partnerItemsContainer');
  if (!container) return;
  container.querySelectorAll('.partner-item-row').forEach(row => {
    const select = row.querySelector('.partner-item-select');
    if (!select) return;
    const selected = select.value;
    const names = [...new Set((partnerCatalog.presetItems || '').split('\n').map(name => name.trim()).filter(Boolean))];
    select.replaceChildren(new Option('-- আইটেম বাছাই --', ''));
    names.forEach(name => select.add(new Option(name, name)));
    select.add(new Option('✏️ কাস্টম আইটেম', '__custom__'));
    select.value = names.includes(selected) || selected === '__custom__' ? selected : '';
    updatePartnerSaleItem(select, false);
  });
  calculatePartnerSale();
}

function addPartnerSaleItem(selectedName = '') {
  const container = document.getElementById('partnerItemsContainer');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'partner-item-row';
  const select = document.createElement('select');
  select.className = 'partner-item-select';
  select.setAttribute('aria-label', 'পণ্য বা সেবার নাম');
  const names = [...new Set((partnerCatalog.presetItems || '').split('\n').map(name => name.trim()).filter(Boolean))];
  select.add(new Option('-- আইটেম বাছাই --', ''));
  names.forEach(name => select.add(new Option(name, name)));
  select.add(new Option('✏️ কাস্টম আইটেম', '__custom__'));
  select.value = names.includes(selectedName) ? selectedName : '';
  select.addEventListener('change', () => updatePartnerSaleItem(select, true));
  const choice = document.createElement('div');
  choice.className = 'partner-item-choice';

  const customName = document.createElement('input');
  customName.type = 'text';
  customName.className = 'partner-custom-name';
  customName.maxLength = 160;
  customName.placeholder = 'কাস্টম নাম';
  customName.setAttribute('aria-label', 'কাস্টম আইটেমের নাম');
  customName.hidden = true;
  customName.addEventListener('input', calculatePartnerSale);

  const quantity = document.createElement('input');
  quantity.type = 'number';
  quantity.className = 'partner-item-qty';
  quantity.min = '1';
  quantity.step = '1';
  quantity.value = '1';
  quantity.setAttribute('aria-label', 'পরিমাণ');
  quantity.addEventListener('input', calculatePartnerSale);

  const price = document.createElement('input');
  price.type = 'number';
  price.className = 'partner-item-price';
  price.min = '0';
  price.step = '0.01';
  price.value = '0';
  price.setAttribute('aria-label', 'প্রতি ইউনিট বিক্রয় মূল্য');
  price.addEventListener('input', calculatePartnerSale);

  const cost = document.createElement('input');
  cost.type = 'number';
  cost.className = 'partner-item-cost';
  cost.min = '0';
  cost.step = '0.01';
  cost.value = '0';
  cost.readOnly = true;
  cost.setAttribute('aria-label', 'প্রতি ইউনিট কস্ট');

  const lineTotal = document.createElement('span');
  lineTotal.className = 'partner-line-total';
  lineTotal.textContent = formatMoney(0);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'partner-remove-item';
  remove.textContent = '×';
  remove.setAttribute('aria-label', 'আইটেম সরান');
  remove.addEventListener('click', () => {
    if (container.querySelectorAll('.partner-item-row').length === 1) {
      select.value = '';
      customName.value = '';
      customName.hidden = true;
      quantity.value = '1';
      price.value = '0';
      cost.value = '0';
      lineTotal.textContent = formatMoney(0);
    } else {
      row.remove();
    }
    calculatePartnerSale();
  });

  choice.append(select, customName);
  row.append(choice, quantity, price, cost, lineTotal, remove);
  container.appendChild(row);
  if (selectedName) updatePartnerSaleItem(select, true);
  calculatePartnerSale();
}

function updatePartnerSaleItem(select, applyPresetPrices) {
  const row = select.closest('.partner-item-row');
  const customName = row.querySelector('.partner-custom-name');
  const priceInput = row.querySelector('.partner-item-price');
  const costInput = row.querySelector('.partner-item-cost');
  customName.hidden = select.value !== '__custom__';
  if (select.value !== '__custom__') customName.value = '';
  if (applyPresetPrices) {
    const name = select.value;
    priceInput.value = name && name !== '__custom__' ? safeNum(partnerCatalog.sellingPrices[name]) : 0;
    costInput.value = name && name !== '__custom__' ? safeNum(partnerCatalog.costPrices[name]) : 0;
  } else if (select.value === '__custom__') {
    costInput.value = '0';
  }
  calculatePartnerSale();
}

function getPartnerSaleDraft() {
  const rows = [...document.querySelectorAll('#partnerItemsContainer .partner-item-row')];
  const items = rows.map(row => {
    const select = row.querySelector('.partner-item-select');
    const name = select.value === '__custom__'
      ? row.querySelector('.partner-custom-name').value.trim()
      : select.value;
    const qty = Math.floor(safeNum(row.querySelector('.partner-item-qty').value));
    const price = Math.max(0, safeNum(row.querySelector('.partner-item-price').value));
    const costPrice = Math.max(0, safeNum(row.querySelector('.partner-item-cost').value));
    const total = Number((qty * price).toFixed(2));
    const costTotal = Number((qty * costPrice).toFixed(2));
    return { name, qty, price, costPrice, total, costTotal };
  }).filter(item => item.name && item.qty > 0);
  const subtotal = Number(items.reduce((sum, item) => sum + item.total, 0).toFixed(2));
  const costTotal = Number(items.reduce((sum, item) => sum + item.costTotal, 0).toFixed(2));
  const discountAmount = Math.max(0, safeNum(document.getElementById('partnerDiscountAmount').value));
  const discountType = document.getElementById('partnerDiscountType').value;
  const requestedDiscount = discountType === 'percent' ? subtotal * discountAmount / 100 : discountAmount;
  const discount = Number(Math.min(Math.max(0, subtotal - costTotal), Math.max(0, requestedDiscount)).toFixed(2));
  const total = Number(Math.max(0, subtotal - discount).toFixed(2));
  const netProfit = Number(Math.max(0, total - costTotal).toFixed(2));
  const sharePercent = Math.min(100, Math.max(0, safeNum(currentAccess.sharePercent ?? 40)));
  const partnerShare = Number((netProfit * sharePercent / 100).toFixed(2));
  const ownerShare = Number((netProfit - partnerShare).toFixed(2));
  return { items, subtotal, discount, discountAmount, discountType, total, costTotal, netProfit, sharePercent, partnerShare, ownerShare };
}

function calculatePartnerProfitShares(sale, fallbackPercent = 40) {
  const netProfit = Math.max(0, safeNum(sale.netProfit !== undefined
    ? sale.netProfit
    : safeNum(sale.total) - safeNum(sale.costTotal)));
  const savedPercent = sale.profitSharePercent !== undefined && sale.profitSharePercent !== null
    ? sale.profitSharePercent
    : fallbackPercent;
  const sharePercent = Math.min(100, Math.max(0, safeNum(savedPercent)));
  const partnerShare = Number((netProfit * sharePercent / 100).toFixed(2));
  return { partnerShare, ownerShare: Number((netProfit - partnerShare).toFixed(2)) };
}

function calculatePartnerSale() {
  const container = document.getElementById('partnerItemsContainer');
  if (!container) return null;
  const draft = getPartnerSaleDraft();
  [...container.querySelectorAll('.partner-item-row')].forEach(row => {
    const qty = Math.max(0, Math.floor(safeNum(row.querySelector('.partner-item-qty').value)));
    const price = Math.max(0, safeNum(row.querySelector('.partner-item-price').value));
    row.querySelector('.partner-line-total').textContent = formatMoney(qty * price);
  });
  document.getElementById('partnerSubtotal').textContent = formatMoney(draft.subtotal);
  document.getElementById('partnerDiscount').textContent = '-' + formatMoney(draft.discount);
  document.getElementById('partnerCostTotal').textContent = formatMoney(draft.costTotal);
  document.getElementById('partnerNetProfit').textContent = formatMoney(draft.netProfit);
  document.getElementById('partnerSalePartnerShare').textContent = formatMoney(draft.partnerShare);
  document.getElementById('partnerSaleOwnerShare').textContent = formatMoney(draft.ownerShare);
  document.getElementById('partnerSaleGrandTotal').textContent = formatMoney(draft.total);
  return draft;
}

async function attachPartnerListeners(uid) {
  await firestorePersistenceReady;
  if (currentUserId !== uid || currentAccess.role !== 'Partner/Staff') return;
  stopBusinessListeners();
  // ১) আগেই সদস্যপদ যাচাই — members ডক না থাকলেও আর "permission denied" অ্যালার্ট স্প্যাম হবে না
  let memberDoc = null;
  try {
    const memberSnap = await getMembersRef().doc(uid).get();
    if (memberSnap.exists) memberDoc = memberSnap.data();
  } catch (e) {
    console.warn('[partner] tenant membership pre-check failed:', e && (e.code || e.message));
  }
  partnerSales = [];
  partnerExpenses = [];
  partnerSettlements = [];
  partnerCatalog = { presetItems: '', costPrices: {}, sellingPrices: {} };
  const partnerItemsContainer = document.getElementById('partnerItemsContainer');
  if (partnerItemsContainer) partnerItemsContainer.replaceChildren();
  addPartnerSaleItem();
  renderPartnerDashboard();
  const salesUnsubscribe = getPartnerSalesRef().where('partnerUid', '==', uid)
    .onSnapshot(snapshot => {
      partnerSales = snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      renderPartnerDashboard();
    }, error => handleFirestoreSyncError('পার্টনার বিক্রয়', error));
  const expensesUnsubscribe = getPartnerExpensesRef().where('partnerUid', '==', uid)
    .onSnapshot(snapshot => {
      partnerExpenses = snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      renderPartnerDashboard();
    }, error => handleFirestoreSyncError('পার্টনার খরচ', error));
  const settlementsUnsubscribe = getBusinessRef().collection('settlements').where('partnerUid', '==', uid)
    .onSnapshot(snapshot => {
      partnerSettlements = snapshot.docs.map(doc => doc.data());
      renderPartnerDashboard();
    }, error => handleFirestoreSyncError('পার্টনার সেটেলমেন্ট', error));
  const businessUnsubscribe = getBusinessRef().onSnapshot(snapshot => {
    if (!snapshot.exists) return;
    const business = snapshot.data();
    businessCashBalance = Math.max(0, safeNum(business.operationalCashBalance));
    partnerCatalog = {
      presetItems: business.presetItems || '',
      costPrices: business.costPrices || {},
      sellingPrices: business.sellingPrices || {}
    };
    refreshPartnerSaleCatalog();
    renderPartnerDashboard();
  }, error => handleFirestoreSyncError('অপারেশনাল ক্যাশ', error));
  const memberUnsubscribe = getMembersRef().doc(uid).onSnapshot(snapshot => {
    if (!snapshot.exists) {
      // members ডক নেই — র-এরর/অ্যালার্ট স্প্যাম নয়; users প্রোফাইলের লাভের ভাগ দিয়ে চালিয়ে যাও
      const fallbackShare = currentAccess && currentAccess.sharePercent;
      if (fallbackShare !== undefined && fallbackShare !== null) currentAccess.sharePercent = fallbackShare;
      setSyncStatus(navigator.onLine ? 'pending' : 'offline',
        'পার্টনার সদস্যপদ রেকর্ড পাওয়া যায়নি · এডমিন থেকে "ভাগ সংরক্ষণ" করান');
      renderPartnerDashboard();
      calculatePartnerSale();
      return;
    }
    const member = snapshot.data();
    if (member.sharePercent !== undefined) currentAccess.sharePercent = member.sharePercent;
    renderPartnerDashboard();
    calculatePartnerSale();
  }, error => {
    handleFirestoreSyncError('পার্টনারের লাভের ভাগ', error);
  });
  businessUnsubscribers.push(salesUnsubscribe, expensesUnsubscribe, settlementsUnsubscribe, businessUnsubscribe, memberUnsubscribe);
  const metricsInput = document.getElementById('partnerMetricsDate');
  if (metricsInput && !metricsInput.value) metricsInput.value = localDateKey();
  const dateInput = document.getElementById('partnerHistoryDate');
  if (dateInput && !dateInput.value) dateInput.value = localDateKey();
}

function renderPartnerDashboard() {
  const metricsDateInput = document.getElementById('partnerMetricsDate');
  if (metricsDateInput && !metricsDateInput.value) metricsDateInput.value = localDateKey();
  const selectedDate = (metricsDateInput && metricsDateInput.value) || localDateKey();
  const isToday = selectedDate === localDateKey();

  const dateSales = partnerSales.filter(sale => localDateKey(sale.date) === selectedDate);
  const totalSales = dateSales.reduce((sum, sale) => sum + safeNum(sale.total), 0);
  const partnerPercent = Math.min(100, Math.max(0, safeNum(currentAccess.sharePercent ?? 40)));
  const dateShares = dateSales.reduce((shares, sale) => {
    const saleShares = calculatePartnerProfitShares(sale, partnerPercent);
    shares.partner += saleShares.partnerShare;
    shares.owner += saleShares.ownerShare;
    return shares;
  }, { partner: 0, owner: 0 });

  const settledSales = new Set(partnerSettlements.flatMap(settlement => settlement.salesIds || []));
  const settledExpenses = new Set(partnerSettlements.flatMap(settlement => settlement.expenseIds || []));

  // Only unsettled cash sales can contribute to the amount due for handover.
  const handoverEligibleSales = dateSales.filter(sale =>
    !settledSales.has(sale.docId) && sale.paymentType !== 'due' && safeNum(sale.dueAmount) <= 0);

  const pendingSalesTotal = handoverEligibleSales.reduce((sum, sale) => sum + safeNum(sale.total), 0);
  const pendingPartnerProfit = handoverEligibleSales.reduce(
    (sum, sale) => sum + calculatePartnerProfitShares(sale, partnerPercent).partnerShare, 0);

  const dateExpenses = partnerExpenses.filter(expense => localDateKey(expense.date) === selectedDate);
  const pendingPartnerExpenses = dateExpenses
    .filter(expense => !settledExpenses.has(expense.docId))
    .reduce((sum, expense) => sum + safeNum(expense.amount), 0);

  const handoverDue = Number(Math.max(0, pendingSalesTotal - pendingPartnerProfit - pendingPartnerExpenses).toFixed(2));

  const salesCardLabel = document.getElementById('partnerSalesCardLabel');
  if (salesCardLabel) {
    salesCardLabel.textContent = isToday ? 'আজকের বিক্রি' : 'মোট বিক্রি';
  }
  document.getElementById('partnerTodaySales').textContent = formatMoney(totalSales);
  document.getElementById('partnerTodayShare').textContent = formatMoney(dateShares.partner);
  document.getElementById('ownerTodayShare').textContent = formatMoney(dateShares.owner);
  document.getElementById('partnerSharePercent').textContent = toBnNum(partnerPercent);
  document.getElementById('ownerSharePercent').textContent = toBnNum(100 - partnerPercent);
  document.getElementById('partnerPendingCash').textContent = formatMoney(Math.max(0, handoverDue));

  const pendingSublabel = document.getElementById('partnerPendingCashSublabel');
  if (pendingSublabel) {
    pendingSublabel.textContent = 'বিক্রি ' + formatMoney(pendingSalesTotal) + ' − আমার অংশ ' + formatMoney(pendingPartnerProfit) + ' − খরচ ' + formatMoney(pendingPartnerExpenses);
  }

  const historyDateInput = document.getElementById('partnerHistoryDate');
  if (historyDateInput && !historyDateInput.value) historyDateInput.value = localDateKey();
  const selectedHistoryDay = historyDateInput && historyDateInput.value;
  const historySales = partnerSales.filter(sale => !selectedHistoryDay || localDateKey(sale.date) === selectedHistoryDay);
  const historyExpenses = partnerExpenses.filter(expense =>
    !selectedHistoryDay || localDateKey(expense.date) === selectedHistoryDay);

  const salesList = document.getElementById('partnerSalesHistory');
  if (salesList) {
    salesList.innerHTML = historySales.length ? historySales.map(sale => `
      <div class="role-record">
        <strong>${escapeHtml(sale.customer || 'কাস্টমার')}</strong> · ${formatMoney(sale.total)}
        <div>${escapeHtml(sale.phone || 'ফোন নেই')} · ${formatDate(sale.date)}</div>
        <div>${(sale.items || []).map(item => `${escapeHtml(item.name)} × ${toBnNum(item.qty)}`).join(', ')}</div>
        <div>আমার অংশ ${formatMoney(calculatePartnerProfitShares(sale, partnerPercent).partnerShare)} · মালিকের অংশ ${formatMoney(calculatePartnerProfitShares(sale, partnerPercent).ownerShare)} · ${settledSales.has(sale.docId) ? 'হস্তান্তরিত' : 'হস্তান্তর বাকি'}</div>
      </div>`).join('') : '<div class="empty">এই তারিখে কোনো বিক্রির রেকর্ড নেই</div>';
  }
  const expenseList = document.getElementById('partnerExpensesHistory');
  if (expenseList) {
    expenseList.innerHTML = historyExpenses.length ? historyExpenses.map(expense => `
      <div class="role-record">${escapeHtml(expense.description)} · ${toBnNum(expense.qty)} × ${formatMoney(safeNum(expense.amount) / Math.max(1, safeNum(expense.qty)))} = ${formatMoney(expense.amount)}
        <div>${formatDate(expense.date)} · ${settledExpenses.has(expense.docId) ? 'হিসাবে যুক্ত' : 'হস্তান্তর বাকি'}</div>
      </div>`).join('') : '<div class="empty">এই তারিখে কোনো খরচের রেকর্ড নেই</div>';
  }
}

function savePartnerSale(event) {
  event.preventDefault();
  const partnerUid = auth.currentUser && auth.currentUser.uid;
  if (currentAccess.role !== 'Partner/Staff' || !partnerUid || partnerUid !== currentUserId) return showToast(PENDING_APPROVAL_MESSAGE, 'error');
  const customer = document.getElementById('partnerCustomer').value.trim();
  const phone = document.getElementById('partnerPhone').value.trim();
  const paymentType = document.querySelector('input[name="partnerPaymentType"]:checked').value;
  const draft = calculatePartnerSale();
  if (!customer) return showToast('কাস্টমারের নাম দিন।', 'error');
  if (!draft || !draft.items.length) return showToast('কমপক্ষে একটি আইটেম বাছাই বা লিখুন।', 'error');
  if (draft.items.some(item => item.qty < 1 || !Number.isFinite(item.price) || item.price < 0 || item.costPrice < 0)) {
    return showToast('প্রতিটি আইটেমের সঠিক পরিমাণ, বিক্রয়মূল্য ও কস্ট লিখুন।', 'error');
  }
  if (draft.costTotal > draft.total) return showToast('মোট কস্ট বিক্রয়মূল্যের বেশি হতে পারবে না।', 'error');
  if (draft.total <= 0) return showToast('সর্বমোট বিক্রয় শূন্যের বেশি হতে হবে।', 'error');
  const saleId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const sale = {
    id: saleId,
    partnerUid,
    partnerEmail: auth.currentUser.email || '',
    customer,
    phone,
    items: draft.items,
    subtotal: draft.subtotal,
    discount: draft.discount,
    discountAmount: draft.discountAmount,
    discountType: draft.discountType,
    total: draft.total,
    costTotal: draft.costTotal,
    netProfit: draft.netProfit,
    profitSharePercent: draft.sharePercent,
    partnerShare: draft.partnerShare,
    ownerShare: draft.ownerShare,
    paymentType,
    paymentStatus: paymentType === 'due' ? 'due' : 'paid',
    dueAmount: paymentType === 'due' ? draft.total : 0,
    cashBalanceApplied: paymentType === 'cash',
    invoiceNo: 'P-' + saleId,
    date: new Date().toISOString(),
    settled: false,
    createdAt: new Date().toISOString()
  };
  const dueCreditor = paymentType === 'due' ? {
    id: Date.now(),
    name: customer,
    taken: draft.total,
    paid: 0,
    due: draft.total,
    date: sale.date,
    source: 'pos_sale',
    sourcePartnerSaleId: saleId,
    invoiceNo: sale.invoiceNo
  } : null;
  if (dueCreditor) sale.dueLedgerId = dueCreditor.id;
  try {
    // Cloud-first: offline ফরকিরিয়েট ব্লক করা হয়
    if (!navigator.onLine) {
      return showToast('ইন্টারনেট সংযোগ নেই! আপনার হিসাব বা সেলস ক্লাউডে সিঙ্ক করার জন্য ইন্টারনেট সংযোগ প্রয়োজন।', 'error');
    }
    const batch = db.batch();
    batch.set(getPartnerSalesRef().doc(saleId), sale);
    // নতুন ব্যালেন্স সরাসরি সংখ্যা লিখি — FieldValue.increment ব্যবহার করলে
    // Firestore security rules-এ matchingSaleLedger মিল না করে "Missing or insufficient permissions" দেয়
    const cashDelta = paymentType === 'cash' ? Number((draft.total - draft.partnerShare).toFixed(2)) : 0;
    const newOperationalBalance = Number((safeNum(businessCashBalance) + cashDelta).toFixed(2));
    batch.update(getBusinessRef(), {
      operationalCashBalance: newOperationalBalance,
      lastLedgerId: saleId,
      lastLedgerType: 'partner_sale',
      updatedAt: new Date().toISOString()
    });
    if (dueCreditor) {
      batch.set(getCreditorsRef().doc(String(dueCreditor.id)), dueCreditor);
      creditors.unshift(dueCreditor);
      saveCreditors();
    }
    trackFirestoreWrite(() => batch.commit(), 'পার্টনার বিক্রয়');
    document.getElementById('partnerSaleForm').reset();
    document.getElementById('partnerItemsContainer').replaceChildren();
    addPartnerSaleItem();
    calculatePartnerSale();
    showToast(paymentType === 'due'
      ? 'বাকি বিক্রয় সংরক্ষিত হয়েছে · পাওনাদার লেজারে যোগ হয়েছে'
      : 'নগদ বিক্রয় সংরক্ষিত হয়েছে · ক্যাশ ব্যালেন্স আপডেট হচ্ছে');
  } catch (error) {
    showFirestoreOperationError(error, 'বিক্রয় সংরক্ষণ হয়নি');
  }
}

function savePartnerExpense(event) {
  event.preventDefault();
  const partnerUid = auth.currentUser && auth.currentUser.uid;
  if (currentAccess.role !== 'Partner/Staff' || !partnerUid || partnerUid !== currentUserId) return showToast(PENDING_APPROVAL_MESSAGE, 'error');

  const description = document.getElementById('partnerExpenseDescription').value.trim();
  const qty = Math.floor(safeNum(document.getElementById('partnerExpenseQty').value));
  const amount = Number(safeNum(document.getElementById('partnerExpenseAmount').value).toFixed(2));

  if (!description || qty < 1 || amount <= 0) return showToast('খরচের বিবরণ, পরিমাণ ও সঠিক অঙ্ক লিখুন।', 'error');
  if (amount > businessCashBalance) return showToast('অপারেশনাল ক্যাশে পর্যাপ্ত ব্যালেন্স নেই।', 'error');

  const expenseId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const expense = {
    id: expenseId,
    partnerUid,
    partnerEmail: auth.currentUser.email || '',
    description,
    qty,
    amount,
    date: new Date().toISOString(),
    settled: false,
    createdAt: new Date().toISOString()
  };

  try {
    // Cloud-first: offline ফরকিরিয়েট ব্লক করা হয়
    if (!navigator.onLine) {
      return showToast('ইন্টারনেট সংযোগ নেই! আপনার হিসাব বা সেলস ক্লাউডে সিঙ্ক করার জন্য ইন্টারনেট সংযোগ প্রয়োজন।', 'error');
    }
    const batch = db.batch();
    batch.set(getPartnerExpensesRef().doc(expenseId), expense);
    // নতুন ব্যালেন্স সরাসরি সংখ্যা — increment ব্যবহার করলে matchingExpenseLedger rule fail করে
    const newExpenseBalance = Number((safeNum(businessCashBalance) - amount).toFixed(2));
    batch.update(getBusinessRef(), {
      operationalCashBalance: newExpenseBalance,
      lastLedgerId: expenseId,
      lastLedgerType: 'partner_expense',
      updatedAt: new Date().toISOString()
    });

    trackFirestoreWrite(() => batch.commit(), 'পার্টনার খরচ');

    // লোকাল ডেটা আপডেট করা হচ্ছে যাতে ফায়ারবেসের রেসপন্স আসার আগেই স্ক্রিনে পরিবর্তন দেখা যায়
    partnerExpenses.unshift({ ...expense, docId: expenseId });
    businessCashBalance = Math.max(0, businessCashBalance - amount);

    document.getElementById('partnerExpenseForm').reset();
    document.getElementById('partnerExpenseQty').value = '1';

    // স্ক্রিনে কার্ড এবং লিস্ট রিফ্রেশ করা হচ্ছে
    renderPartnerDashboard();

    showToast('খরচ সংরক্ষিত হয়েছে · অপারেশনাল ক্যাশ থেকে কাটা হচ্ছে');
  } catch (error) {
    showFirestoreOperationError(error, 'খরচ সংরক্ষণ হয়নি');
  }
}

function attachAdminManagementListeners() {
  stopBusinessListeners();
  const listeners = [
    db.collection('users').onSnapshot(snapshot => {
      adminUserProfiles = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      renderAdminManagement();
      void syncApprovedPartnersToMembers(); // self-healing migration — fire-and-forget
    }, error => handleFirestoreSyncError('অ্যাকাউন্ট তালিকা', error)),
    getMembersRef().onSnapshot(snapshot => {
      adminMembers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      renderAdminManagement();
    }, error => handleFirestoreSyncError('পার্টনার তালিকা', error)),
    getPartnerSalesRef().onSnapshot(snapshot => {
      adminPartnerSales = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      renderAdminManagement();
    }, error => handleFirestoreSyncError('পার্টনার বিক্রয়', error)),
    getPartnerExpensesRef().onSnapshot(snapshot => {
      adminPartnerExpenses = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      renderAdminManagement();
    }, error => handleFirestoreSyncError('পার্টনার খরচ', error)),
    getBusinessRef().collection('settlements').onSnapshot(snapshot => {
      adminSettlements = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      renderAdminManagement();
    }, error => handleFirestoreSyncError('পার্টনার সেটেলমেন্ট', error)),
    getBusinessRef().onSnapshot(snapshot => {
      if (snapshot.exists) businessCashBalance = Math.max(0, safeNum(snapshot.data().operationalCashBalance));
      renderAdminManagement();
    }, error => handleFirestoreSyncError('অপারেশনাল ক্যাশ', error))
  ];
  businessUnsubscribers.push(...listeners);
  const adminDateInput = document.getElementById('adminMetricsDate');
  if (adminDateInput && !adminDateInput.value) adminDateInput.value = localDateKey();
  // ★ Self-healing sync: অ্যাডমিন প্যানেল লোড হলেই অনুমোদিত পার্টনারদের
  // members ডক নিশ্চিত করা হয় — তাই তালিকা কখনো ফাঁকা থাকবে না
  void syncApprovedPartnersToMembers();
}

async function syncApprovedPartnersToMembers() {
  if (!isMasterAdmin() || partnerMemberSyncRunning || !navigator.onLine) return;
  partnerMemberSyncRunning = true;
  try {
    const membersByUid = new Map(adminMembers.map(member => [member.uid || member.id, member]));
    const approvedPartners = adminUserProfiles.filter(profile => profile.uid !== currentUserId
      && String(profile.accountStatus || profile.status || '').trim().toLowerCase() === 'approved'
      && ['partner/staff', 'partner', 'staff'].includes(String(profile.role || '').trim().toLowerCase()));
    const needsSync = approvedPartners.filter(profile => {
      const member = membersByUid.get(profile.uid);
      return !member
        || String(member.status || '').trim().toLowerCase() !== 'active'
        || !['partner/staff', 'partner', 'staff'].includes(String(member.role || '').trim().toLowerCase());
    });
    if (!needsSync.length) return;
    const batch = db.batch();
    needsSync.forEach(profile => {
      const member = membersByUid.get(profile.uid) || {};
      const sharePercent = member.sharePercent ?? profile.sharePercent ?? member.profitShare ?? 40;
      batch.set(getMembersRef().doc(profile.uid), {
        uid: profile.uid,
        email: profile.email || member.email || '',
        displayName: profile.displayName || member.displayName || '',
        role: 'Partner',
        status: 'active',
        sharePercent,
        ownerSharePercent: member.ownerSharePercent ?? profile.ownerSharePercent ?? 100 - sharePercent,
        profitShare: member.profitShare ?? sharePercent,
        tenantId: BUSINESS_TENANT_ID,
        syncedAt: new Date().toISOString()
      }, { merge: true });
    });
    await batch.commit();
    console.info('[admin] self-heal: ' + needsSync.length + ' approved partner(s) synced to tenant members');
    renderAdminManagement();
  } catch (error) {
    // migration ব্যর্থ হলেও অ্যালার্ট স্প্যাম নয় — মার্জড রেন্ডারিং তো কাজ করছে
    console.warn('[admin] partner→members self-heal skipped:', error && (error.code || error.message));
  } finally {
    partnerMemberSyncRunning = false;
  }
}

function renderAdminManagement() {
  if (!isMasterAdmin()) return;

  const dateInput = document.getElementById('adminMetricsDate');
  if (dateInput && !dateInput.value) dateInput.value = localDateKey();
  const selectedDate = (dateInput && dateInput.value) || localDateKey();
  const isToday = selectedDate === localDateKey();

  const dateSales = adminPartnerSales.filter(sale => localDateKey(sale.date) === selectedDate);
  const dateInvoices = invoices.filter(invoice => !invoice.partnerUid && !invoice.sourcePartnerSaleId
    && localDateKey(invoice.date) === selectedDate);
  const salesForMetrics = [...dateSales, ...dateInvoices];
  const totalSales = salesForMetrics.reduce((sum, sale) => sum + safeNum(sale.total), 0);
  const totalCost = salesForMetrics.reduce((sum, sale) => {
    const itemCost = (sale.items || []).reduce((itemSum, item) =>
      itemSum + safeNum(item.costPrice) * safeNum(item.qty), 0);
    const saleCost = sale.costTotal !== undefined && sale.costTotal !== null
      ? sale.costTotal
      : itemCost;
    return sum + Math.max(0, safeNum(saleCost));
  }, 0);
  const netProfit = totalSales - totalCost;
  const totalPartnerShare = Number(dateSales.reduce((sum, sale) => {
    const member = adminMembers.find(item => item.uid === sale.partnerUid);
    return sum + calculatePartnerProfitShares(sale, member ? (member.sharePercent ?? 40) : 40).partnerShare;
  }, 0).toFixed(2));
  const ownerNetShare = Number((netProfit - totalPartnerShare).toFixed(2));

  const salesCardLabel = document.getElementById('adminSalesCardLabel');
  if (salesCardLabel) {
    salesCardLabel.textContent = isToday ? 'আজকের বিক্রি' : 'মোট বিক্রি';
  }
  const salesEl = document.getElementById('adminTodaySales');
  if (salesEl) salesEl.textContent = formatMoney(totalSales);
  const costEl = document.getElementById('adminTodayCost');
  if (costEl) costEl.textContent = formatMoney(totalCost);
  const profitEl = document.getElementById('adminTodayNetProfit');
  if (profitEl) profitEl.textContent = formatMoney(netProfit);
  const ownerShareEl = document.getElementById('adminTodayOwnerShare');
  if (ownerShareEl) ownerShareEl.textContent = formatMoney(ownerNetShare);

  const pendingUsers = adminUserProfiles.filter(profile => profile.uid !== currentUserId
    && String(profile.accountStatus || profile.status || '').trim().toLowerCase() !== 'approved');
  const pendingList = document.getElementById('pendingUsersList');
  if (pendingList) {
    pendingList.innerHTML = pendingUsers.length ? pendingUsers.map(profile => `
      <div class="role-row">
        <div><strong>${escapeHtml(profile.displayName || profile.email || profile.uid)}</strong><div>${escapeHtml(profile.email || '')}</div></div>
        <div class="role-actions">
          <select id="approval-role-${escapeHtml(profile.uid)}" aria-label="অনুমোদনের ভূমিকা">
            <option value="Partner/Staff">Partner/Staff</option><option value="Admin">Admin</option>
          </select>
          <button type="button" onclick="approveAccount('${escapeHtml(profile.uid)}')">অনুমোদন</button>
        </div>
      </div>`).join('') : '<div class="empty">অনুমোদনের অপেক্ষায় কোনো অ্যাকাউন্ট নেই</div>';
  }

  // ★ পার্টনার তালিকা মার্জ: businesses/{tenantId}/members + users (case-insensitive)
  // — কোনো case-sensitive ফিল্টার বা broken compound query নেই, তাই অনুমোদিত
  // পার্টনার কখনো লুকানো থাকবে না ("blank list" bug fix)
  const isPartnerRoleVal = roleVal => ['partner/staff', 'partner', 'staff']
    .includes(String(roleVal || '').trim().toLowerCase());
  const isActiveStatusVal = statusVal => String(statusVal || '').trim().toLowerCase() === 'active';
  const membersByUid = new Map(adminMembers
    .filter(member => isActiveStatusVal(member.status) && isPartnerRoleVal(member.role))
    .map(member => [member.uid || member.id, member]));
  const partnerProfilesByUid = new Map(adminUserProfiles
    .filter(profile => profile.uid !== currentUserId
      && String(profile.accountStatus || profile.status || '').trim().toLowerCase() === 'approved'
      && isPartnerRoleVal(profile.role))
    .map(profile => [profile.uid, profile]));
  const effectiveMembers = [...new Set([...membersByUid.keys(), ...partnerProfilesByUid.keys()])]
    .filter(Boolean)
    .map(uid => {
      const member = membersByUid.get(uid) || {};
      const profile = partnerProfilesByUid.get(uid) || {};
      return {
        ...member,
        uid,
        displayName: member.displayName || profile.displayName || '',
        email: member.email || profile.email || '',
        status: 'active',
        role: member.role || profile.role || 'Partner/Staff',
        sharePercent: member.sharePercent ?? profile.sharePercent ?? member.profitShare ?? 40
      };
    });
  const membersList = document.getElementById('adminPartnersList');
  if (membersList) {
    // প্রতি কার্ডে sales + expenses দুটো সোর্স থেকেই মার্জ করা হয় —
    // কোনো একটি কালেকশন ডেনাইড/খালি হলেও পার্টনার ব্ল্যাঙ্ক দেখাবে না
    const mergePartnerRecords = (primary, fallback, uid, sourceIdKey) => {
      const recordsById = new Map();
      [...primary, ...fallback].filter(record => record.partnerUid === uid).forEach(record => {
        const recordId = record[sourceIdKey] || record.docId || record.id
          || [record.date, record.invoiceNo || record.description || ''].join('-');
        recordsById.set(String(recordId), {
          ...record,
          docId: record.docId || record[sourceIdKey] || String(recordId)
        });
      });
      return [...recordsById.values()];
    };
    const partnerSalesFor = uid => mergePartnerRecords(adminPartnerSales, invoices, uid, 'sourcePartnerSaleId');
    const partnerExpensesFor = uid => mergePartnerRecords(adminPartnerExpenses, expenses, uid, 'sourcePartnerExpenseId');
    const partnerRows = effectiveMembers.map(member => {
      const sales = partnerSalesFor(member.uid);
      const expenses = partnerExpensesFor(member.uid);
      const memberSettlements = adminSettlements.filter(settlement => settlement.partnerUid === member.uid);
      const settledSales = new Set(memberSettlements.flatMap(settlement => settlement.salesIds || []));
      const settledExpenses = new Set(memberSettlements.flatMap(settlement => settlement.expenseIds || []));
      const unsettledSales = sales.filter(sale => !settledSales.has(sale.docId)
        && sale.paymentType !== 'due' && safeNum(sale.dueAmount) <= 0);
      const unsettledExpenses = expenses.filter(expense => !settledExpenses.has(expense.docId));
      const allSalesAmount = sales.reduce((sum, sale) => sum + safeNum(sale.total), 0);
      const partnerProfitEarned = Number(sales.reduce((sum, sale) =>
        sum + calculatePartnerProfitShares(sale, member.sharePercent ?? 40).partnerShare, 0).toFixed(2));
      const partnerProfitPaid = Number(memberSettlements.reduce((sum, settlement) =>
        sum + safeNum(settlement.partnerShare), 0).toFixed(2));
      const partnerProfitDue = Math.max(0, Number((partnerProfitEarned - partnerProfitPaid).toFixed(2)));
      const pending = Math.max(0,
        unsettledSales.reduce((sum, sale) =>
          sum + safeNum(sale.total) - calculatePartnerProfitShares(sale, member.sharePercent ?? 40).partnerShare, 0)
        - unsettledExpenses.reduce((sum, expense) => sum + safeNum(expense.amount), 0));
      const itemCount = sales.reduce((sum, sale) => sum + (sale.items || []).reduce((count, item) => count + safeNum(item.qty), 0), 0);

      const memberDateSales = sales.filter(sale => localDateKey(sale.date) === selectedDate);
      const memberDateTotal = memberDateSales.reduce((sum, s) => sum + safeNum(s.total), 0);
      const memberDatePartnerShare = memberDateSales.reduce((sum, sale) =>
        sum + calculatePartnerProfitShares(sale, member.sharePercent ?? 40).partnerShare, 0);
      const memberDateOwnerShare = memberDateSales.reduce((sum, sale) =>
        sum + calculatePartnerProfitShares(sale, member.sharePercent ?? 40).ownerShare, 0);
      const memberDateCustomerDue = memberDateSales.reduce((sum, sale) => sum + Math.max(0,
        safeNum(sale.dueAmount !== undefined ? sale.dueAmount : sale.paymentType === 'due' ? sale.total : 0)), 0);
      const memberDateUnsettledSales = memberDateSales.filter(sale => !settledSales.has(sale.docId)
        && sale.paymentType !== 'due' && safeNum(sale.dueAmount) <= 0);
      const memberDateUnsettledExpenses = expenses.filter(expense => localDateKey(expense.date) === selectedDate
        && !settledExpenses.has(expense.docId));
      const memberDateHandoverDue = Number(Math.max(0,
        memberDateUnsettledSales.reduce((sum, sale) =>
          sum + safeNum(sale.total) - calculatePartnerProfitShares(sale, member.sharePercent ?? 40).partnerShare, 0)
        - memberDateUnsettledExpenses.reduce((sum, expense) => sum + safeNum(expense.amount), 0)).toFixed(2));

      const details = sales.map(sale => `${escapeHtml(sale.customer || '')} (${escapeHtml(sale.phone || '')}): ${(sale.items || []).map(item => `${escapeHtml(item.name)} × ${toBnNum(item.qty)}`).join(', ')} · ${formatMoney(sale.total)} · ${sale.paymentType === 'due' ? 'বাকি ' + formatMoney(sale.dueAmount !== undefined ? sale.dueAmount : sale.total) : 'নগদ'}${settledSales.has(sale.docId) ? ' · হস্তান্তরিত' : ''}`).join('<br>');
      const disabled = unsettledSales.length + unsettledExpenses.length && !settlingPartnerIds.has(member.uid) ? '' : 'disabled';
      const safeUid = escapeHtml(member.uid);
      const challengeText = escapeHtml(member.email || member.displayName || member.uid);
      return `<article class="partner-record-card">
        <div class="partner-record-heading">
          <div class="partner-record-identity">
            <strong>${escapeHtml(member.displayName || member.email || member.uid)}</strong>
            <span>${escapeHtml(member.email || '')}</span>
          </div>
          <div class="partner-record-balance"><span>মোট হস্তান্তর বাকি</span><strong>${formatMoney(pending)}</strong></div>
        </div>
        <div class="partner-record-summary">আইটেম ${toBnNum(itemCount)} · অপারেশনাল ক্যাশ ${formatMoney(businessCashBalance)}</div>
        <div class="partner-financial-breakdown">
          <div><span>পার্টনারের অংশ / শেয়ার হার</span><strong>${toBnNum(Math.min(100, Math.max(0, safeNum(member.sharePercent ?? 40))))}%</strong></div>
          <div><span>এ পর্যন্ত মোট আয় / বিক্রি</span><strong>${formatMoney(allSalesAmount)}</strong></div>
          <div><span>পার্টনারের মোট প্রাপ্য অংশ</span><strong>${formatMoney(partnerProfitEarned)}</strong></div>
          <div><span>পার্টনার পেয়েছে / পরিশোধিত</span><strong>${formatMoney(partnerProfitPaid)}</strong></div>
          <div><span>পার্টনারের বকেয়া প্রাপ্য অংশ</span><strong>${formatMoney(partnerProfitDue)}</strong></div>
          <div><span>বর্তমান হস্তান্তর বাকি (পার্টনার → মালিক)</span><strong>${formatMoney(pending)}</strong></div>
        </div>
        <details class="partner-date-details">
          <summary>📅 ${formatDate(selectedDate)}-এর হিসাব ও লেনদেন দেখুন</summary>
          <div class="partner-date-metrics">
            <div>বিক্রি<strong>${formatMoney(memberDateTotal)}</strong></div>
            <div>পার্টনারের লাভ<strong>${formatMoney(memberDatePartnerShare)}</strong></div>
            <div>মালিকের অংশ<strong>${formatMoney(memberDateOwnerShare)}</strong></div>
            <div>কাস্টমারের বাকি<strong>${formatMoney(memberDateCustomerDue)}</strong></div>
            <div>হস্তান্তর বাকি<strong>${formatMoney(memberDateHandoverDue)}</strong></div>
          </div>
          <div class="partner-record-transactions">${details || 'নতুন কোনো বিক্রি নেই'}</div>
        </details>
        <div class="role-actions partner-record-actions">
          <label>লাভের ভাগ % <input id="share-${escapeHtml(member.uid)}" type="number" min="0" max="100" value="${Math.min(100, Math.max(0, safeNum(member.sharePercent ?? 40)))}"></label>
          <button type="button" ${deletingPartnerIds.has(member.uid) ? 'disabled' : ''} onclick="savePartnerShare('${safeUid}')">ভাগ সংরক্ষণ</button>
          <button type="button" ${disabled} onclick="markPartnerPaid('${safeUid}')">বুঝে পেলাম / Mark as Paid</button>
          <button type="button" class="mini-btn del delete-partner-button" data-partner-uid="${safeUid}" data-challenge="${challengeText}" ${deletingPartnerIds.has(member.uid) ? 'disabled' : ''}>ডিলিট পার্টনার</button>
        </div>
      </article>`;
    });
    membersList.innerHTML = partnerRows.length ? partnerRows.join('') : '<div class="empty">কোনো সক্রিয় পার্টনার নেই</div>';
    membersList.querySelectorAll('.delete-partner-button').forEach(button => {
      button.addEventListener('click', () => {
        void deletePartnerAccount(button.dataset.partnerUid, button.dataset.challenge);
      });
    });
  }
}

async function approveAccount(uid) {
  if (!isMasterAdmin()) return showToast('শুধু মাস্টার অ্যাডমিন অনুমোদন দিতে পারবেন।', 'error');
  if (!navigator.onLine) return showToast('ইন্টারনেট নেই। অনুমোদনের জন্য সংযোগ ফিরে এলে আবার চেষ্টা করুন।', 'error');
  const roleSelect = document.getElementById('approval-role-' + uid);
  const role = roleSelect && roleSelect.value === 'Admin' ? 'Admin' : 'Partner';
  const profile = adminUserProfiles.find(item => item.uid === uid);
  if (!profile) return showToast('অ্যাকাউন্টের তথ্য পাওয়া যায়নি।', 'error');
  try {
    const batch = db.batch();
    batch.set(getUserRef(uid), {
      accountStatus: 'approved', role, tenantId: BUSINESS_TENANT_ID,
      approvedBy: currentUser.email, approvedAt: new Date().toISOString()
    }, { merge: true });
    const memberRef = getMembersRef().doc(uid);
    if (role === 'Partner') {
      // ★ দুটোতেই লেখা হচ্ছে: users/{uid} (role/accountStatus/tenantId) +
      // businesses/{tenantId}/members/{uid} (status active, sharePercent/profitShare)
      batch.set(memberRef, {
        uid, email: profile.email || '', displayName: profile.displayName || '',
        role, status: 'active',
        sharePercent: profile.sharePercent ?? 40,
        ownerSharePercent: profile.ownerSharePercent ?? 60,
        profitShare: profile.sharePercent ?? 40,
        tenantId: BUSINESS_TENANT_ID,
        approvedBy: currentUser.email,
        approvedAt: new Date().toISOString()
      }, { merge: true });
      batch.set(getUserRef(uid), { sharePercent: profile.sharePercent ?? 40 }, { merge: true });
    } else {
      batch.delete(memberRef);
    }
    await batch.commit();
    showToast('অ্যাকাউন্ট অনুমোদিত হয়েছে · পার্টনার তালিকায় যুক্ত হয়েছে ✓');
  } catch (error) {
    showFirestoreOperationError(error, 'অ্যাকাউন্ট অনুমোদন হয়নি');
  }
}

async function savePartnerShare(uid) {
  if (!isMasterAdmin()) return;
  if (!navigator.onLine) return showToast('ইন্টারনেট নেই। লাভের ভাগ সংরক্ষণ করতে সংযোগ ফিরে এলে আবার চেষ্টা করুন।', 'error');
  const input = document.getElementById('share-' + uid);
  const percent = safeNum(input && input.value);
  if (percent < 0 || percent > 100) return showToast('লাভের ভাগ ০ থেকে ১০০-এর মধ্যে হতে হবে।', 'error');
  try {
    await getMembersRef().doc(uid).update({
      sharePercent: percent, ownerSharePercent: 100 - percent, updatedAt: new Date().toISOString()
    });
    const profile = adminUserProfiles.find(item => item.uid === uid);
    if (profile) await getUserRef(uid).update({ sharePercent: percent, ownerSharePercent: 100 - percent });
    showToast('লাভের ভাগ সংরক্ষিত হয়েছে ✓');
  } catch (error) {
    showFirestoreOperationError(error, 'লাভের ভাগ সংরক্ষণ হয়নি');
  }
}

async function deletePartnerAccount(uid, challengeLabel) {
  if (!isMasterAdmin()) return showToast('শুধু মাস্টার অ্যাডমিন পার্টনার মুছে ফেলতে পারবেন।', 'error');
  if (!navigator.onLine) return showToast('ইন্টারনেট নেই। পার্টনার মুছতে সংযোগ ফিরে এলে আবার চেষ্টা করুন।', 'error');
  if (deletingPartnerIds.has(uid)) return;
  if (settlingPartnerIds.has(uid)) return showToast('সেটেলমেন্ট চলাকালে পার্টনার মুছে ফেলা যাবে না।', 'error');
  const member = adminMembers.find(item => item.uid === uid);
  if (!member) return showToast('পার্টনারের তথ্য পাওয়া যায়নি।', 'error');
  const confirmationPhrase = 'DELETE ' + (challengeLabel || uid);
  const confirmation = prompt(
    'এই কাজটি স্থায়ীভাবে পার্টনারের Firestore অ্যাকাউন্টের তথ্য ও সংশ্লিষ্ট লেনদেন মুছে দেবে। Firebase Authentication-এর সাইন-ইন পরিচয়টি মুছবে না, তবে অ্যাপের পার্টনার অ্যাক্সেস থাকবে না।\n' +
    'নিশ্চিত করতে হুবহু লিখুন: ' + confirmationPhrase
  );
  if (confirmation === null) return;
  if (confirmation !== confirmationPhrase) {
    return showToast('নিশ্চিতকরণ বাক্য মেলেনি। কোনো তথ্য মুছে ফেলা হয়নি।', 'error');
  }

  deletingPartnerIds.add(uid);
  renderAdminManagement();
  try {
    const partnerUserRef = getUserRef(uid);
    const ownerSalesRef = getSalesRef();
    const ownerExpensesRef = getExpensesRef();
    const snapshots = await Promise.all([
      getPartnerSalesRef().where('partnerUid', '==', uid).get(),
      getPartnerExpensesRef().where('partnerUid', '==', uid).get(),
      getBusinessRef().collection('settlements').where('partnerUid', '==', uid).get(),
      partnerUserRef.collection('sales').get(),
      partnerUserRef.collection('expenses').get(),
      partnerUserRef.collection('creditors').get(),
      partnerUserRef.collection('cash_register').get(),
      partnerUserRef.collection('settings').get(),
      ownerSalesRef.where('partnerUid', '==', uid).get(),
      ownerExpensesRef.where('partnerUid', '==', uid).get()
    ]);
    const recordRefs = [...new Set(snapshots.flatMap(snapshot => snapshot.docs.map(doc => doc.ref)))];
    for (let offset = 0; offset < recordRefs.length; offset += 400) {
      const batch = db.batch();
      recordRefs.slice(offset, offset + 400).forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    const accountBatch = db.batch();
    accountBatch.delete(getMembersRef().doc(uid));
    accountBatch.delete(partnerUserRef);
    await accountBatch.commit();
    showToast('পার্টনারের Firestore অ্যাকাউন্টের তথ্য ও সংশ্লিষ্ট রেকর্ড স্থায়ীভাবে মুছে ফেলা হয়েছে।');
  } catch (error) {
    showFirestoreOperationError(error, 'পার্টনার ও সংশ্লিষ্ট রেকর্ড সম্পূর্ণ মুছে ফেলা যায়নি');
  } finally {
    deletingPartnerIds.delete(uid);
    renderAdminManagement();
  }
}

async function markPartnerPaid(uid) {
  if (!isMasterAdmin()) return showToast('শুধু মাস্টার অ্যাডমিন সেটেলমেন্ট করতে পারবেন।', 'error');
  if (!navigator.onLine) return showToast('ইন্টারনেট নেই। সেটেলমেন্টের জন্য সংযোগ ফিরে এলে আবার চেষ্টা করুন।', 'error');
  if (settlingPartnerIds.has(uid)) return;
  const priorSettlements = adminSettlements.filter(settlement => settlement.partnerUid === uid);
  const settledSales = new Set(priorSettlements.flatMap(settlement => settlement.salesIds || []));
  const settledExpenses = new Set(priorSettlements.flatMap(settlement => settlement.expenseIds || []));
  const sales = adminPartnerSales.filter(sale => sale.partnerUid === uid && !settledSales.has(sale.docId));
  const expensesForSettlement = adminPartnerExpenses.filter(expense => expense.partnerUid === uid && !settledExpenses.has(expense.docId));
  if (!sales.length && !expensesForSettlement.length) return showToast('সেটেল করার মতো কোনো বাকি রেকর্ড নেই।', 'error');
  settlingPartnerIds.add(uid);
  renderAdminManagement();
  const settlementId = uid + '-' + (sales[0] ? sales[0].docId : expensesForSettlement[0].docId);
  const totalSales = sales.reduce((sum, sale) => sum + safeNum(sale.total), 0);
  const totalExpenses = expensesForSettlement.reduce((sum, expense) => sum + safeNum(expense.amount), 0);
  const collectedSales = sales.filter(sale => sale.paymentType !== 'due' && safeNum(sale.dueAmount) <= 0);
  const member = adminMembers.find(item => item.uid === uid);
  const partnerShare = Number(collectedSales.reduce((sum, sale) =>
    sum + calculatePartnerProfitShares(sale, member ? (member.sharePercent ?? 40) : 40).partnerShare, 0).toFixed(2));
  const cashCollected = Number(Math.max(0,
    collectedSales.reduce((sum, sale) => sum + safeNum(sale.total), 0) - partnerShare - totalExpenses).toFixed(2));
  const entries = [
    ...sales.map(sale => ({ type: 'sale', record: sale })),
    ...expensesForSettlement.map(expense => ({ type: 'expense', record: expense }))
  ];
  try {
    for (let offset = 0; offset < entries.length; offset += 200) {
      const batch = db.batch();
      entries.slice(offset, offset + 200).forEach(({ type, record }, index) => {
        if (type === 'sale') {
          const invoiceId = Date.now() + offset + index;
          const ownerInvoice = {
            ...record, id: invoiceId, invoiceNo: record.invoiceNo || 'PARTNER-' + record.docId,
            partnerUid: uid, sourcePartnerSaleId: record.docId, settled: true, settlementId,
            settlementAt: new Date().toISOString()
          };
          batch.set(getSalesRef().doc('partner-' + uid + '-' + record.docId), ownerInvoice, { merge: true });
        } else {
          const ownerExpense = {
            id: Date.now() + offset + index,
            category: 'পার্টনার খরচ', desc: record.description,
            items: [{ category: 'পার্টনার খরচ', desc: record.description, qty: record.qty, amount: record.amount }],
            amount: safeNum(record.amount), source: 'cash', sourceLabel: 'পার্টনার ক্যাশ',
            date: record.date, partnerUid: uid, sourcePartnerExpenseId: record.docId, settlementId
          };
          batch.set(getExpensesRef().doc('partner-' + uid + '-' + record.docId), ownerExpense, { merge: true });
        }
      });
      await batch.commit();
    }
    await getBusinessRef().collection('settlements').doc(settlementId).set({
      partnerUid: uid, saleCount: sales.length, expenseCount: expensesForSettlement.length,
      salesIds: sales.map(sale => sale.docId), expenseIds: expensesForSettlement.map(expense => expense.docId),
      totalSales, totalExpenses, partnerShare, cashCollected,
      settledBy: currentUser.email, createdAt: new Date().toISOString()
    });
    showToast('সেটেলমেন্ট সম্পন্ন · ' + formatMoney(cashCollected) + ' বুঝে নেওয়া হয়েছে ✓');
  } catch (error) {
    showFirestoreOperationError(error, 'সেটেলমেন্ট সম্পূর্ণ হয়নি · বাকি রেকর্ড আবার চেষ্টা করুন');
  } finally {
    settlingPartnerIds.delete(uid);
    renderAdminManagement();
  }
}
