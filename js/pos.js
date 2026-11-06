/**
 * ABC POS - POS Entry, Items Management, Invoicing, Printing & Settings
 * Module: js/pos.js
 */

let currentLogoDataUrl = null;
let editingInvoiceId = null;

function getBusinessInfo() {
  return {
    name: (settings.businessName && settings.businessName.trim()) ? settings.businessName.trim() : BUSINESS.name,
    tagline: (settings.businessTagline && settings.businessTagline.trim()) ? settings.businessTagline.trim() : BUSINESS.tagline,
    phone: (settings.businessPhone && settings.businessPhone.trim()) ? settings.businessPhone.trim() : BUSINESS.phone,
    address: (settings.businessAddress && settings.businessAddress.trim()) ? settings.businessAddress.trim() : BUSINESS.address,
    website: (settings.businessWebsite && settings.businessWebsite.trim()) ? settings.businessWebsite.trim() : BUSINESS.website,
    logo: settings.businessLogo || null,
    services: BUSINESS.services,
    social: BUSINESS.social,
    review: BUSINESS.review
  };
}

function setLogoPreview(dataUrl) {
  currentLogoDataUrl = dataUrl || null;
  const img = document.getElementById('settingLogoImg');
  const placeholder = document.getElementById('settingLogoPlaceholder');
  if (dataUrl) {
    if (img) { img.src = dataUrl; img.style.display = 'block'; }
    if (placeholder) placeholder.style.display = 'none';
  } else {
    if (img) { img.src = ''; img.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'block';
  }
}

function handleLogoFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const maxDim = 240;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/png');
      setLogoPreview(compressed);
      const urlInput = document.getElementById('settingBizLogoUrl');
      if (urlInput) urlInput.value = '';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleLogoUrlInput(event) {
  const url = (event.target.value || '').trim();
  if (url) {
    setLogoPreview(url);
    const fileInput = document.getElementById('settingBizLogoFile');
    if (fileInput) fileInput.value = '';
  } else {
    setLogoPreview(null);
  }
}

function removeBusinessLogo() {
  setLogoPreview(null);
  const fileInput = document.getElementById('settingBizLogoFile');
  if (fileInput) fileInput.value = '';
  const urlInput = document.getElementById('settingBizLogoUrl');
  if (urlInput) urlInput.value = '';
}

function applyBusinessBranding() {
  const biz = getBusinessInfo();
  const brandH1 = document.querySelector('.brand-text h1');
  if (brandH1) brandH1.textContent = biz.name;
  const brandTagline = document.querySelector('.brand-text .tagline');
  if (brandTagline) brandTagline.textContent = biz.tagline + ' (মাল্টি-টেন্যান্ট ক্লাউড POS)';

  const logoEl = document.querySelector('.header .logo');
  if (logoEl) {
    if (biz.logo) {
      logoEl.innerHTML = `<img src="${biz.logo}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">`;
      logoEl.style.background = 'transparent';
    } else {
      logoEl.textContent = (biz.name || 'A').trim().charAt(0).toUpperCase();
      logoEl.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-dark))';
    }
  }
}

function refreshPresetOptions() {
  document.querySelectorAll('.item-row').forEach(row => {
    const select = row.querySelector('select');
    if (!select) return;
    const selected = select.value;
    populatePresetSelect(select, selected);
    if (select.value === '__custom__') {
      const customInput = row.querySelector('.customName');
      if (selected !== '__custom__') customInput.value = selected;
      customInput.style.display = 'block';
    } else {
      updateItem(select);
    }
  });
}

function populatePresetSelect(select, selectedValue = '') {
  const presets = [...new Set((settings.presetItems || '').split('\n')
    .map(item => item.trim()).filter(Boolean))];
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- বাছাই --';
  select.appendChild(placeholder);
  presets.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
  const customOption = document.createElement('option');
  customOption.value = '__custom__';
  customOption.textContent = '✏️ কাস্টম...';
  select.appendChild(customOption);
  select.value = selectedValue && !presets.includes(selectedValue) && selectedValue !== '__custom__'
    ? '__custom__'
    : selectedValue;
}

function populateSettingsFormFromCurrent() {
  const presetEl = document.getElementById('presetItems');
  if (presetEl) presetEl.value = settings.presetItems || '';
  const expCatEl = document.getElementById('expenseCategories');
  if (expCatEl) expCatEl.value = settings.expenseCategories || '';

  const bName = document.getElementById('settingBizName');
  if (bName) bName.value = settings.businessName || '';
  const bTag = document.getElementById('settingBizTagline');
  if (bTag) bTag.value = settings.businessTagline || '';
  const bPhone = document.getElementById('settingBizPhone');
  if (bPhone) bPhone.value = settings.businessPhone || '';
  const bAddr = document.getElementById('settingBizAddress');
  if (bAddr) bAddr.value = settings.businessAddress || '';
  const bWeb = document.getElementById('settingBizWebsite');
  if (bWeb) bWeb.value = settings.businessWebsite || '';
  const bLogoUrl = document.getElementById('settingBizLogoUrl');
  if (bLogoUrl) bLogoUrl.value = (settings.businessLogo && !settings.businessLogo.startsWith('data:')) ? settings.businessLogo : '';
  setLogoPreview(settings.businessLogo || null);

  renderPresetPriceFields();
  if (typeof populateExpenseCategoryOptions === 'function') {
    populateExpenseCategoryOptions();
  }
}

// ===== Items Management =====
function addItem(name = '', qty = 1, price, costPrice) {
  const container = document.getElementById('itemsContainer');
  if (!container) return;
  const presets = (settings.presetItems || '').split('\n').map(item => item.trim()).filter(Boolean);
  const row = document.createElement('div');
  row.className = 'item-row';

  const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const isCustom = name && !presets.includes(name);
  const initialPrice = price == null ? Number((settings.sellingPrices || {})[name] || 0) : safeNum(price);
  const initialCost = costPrice == null
    ? Number((settings.costPrices || {})[name] || 0)
    : safeNum(costPrice);
  row.innerHTML = `
    <div class="item-description">
      <select aria-label="আইটেম প্রিসেট"></select>
      <input type="text" class="customName" placeholder="নাম" value="${isCustom ? escAttr(name) : ''}" style="display:${isCustom ? 'block' : 'none'}">
      <div class="item-cost-display">ক্রয়: ${formatMoney(initialCost)} / ইউনিট</div>
      <input type="hidden" class="itemCostPrice" value="${initialCost}">
    </div>
    <input type="number" class="itemQty" value="${qty}" min="1" onchange="calculateRowTotal(this.closest('.item-row')); calculateTotal()" placeholder="পরিমাণ">
    <input type="number" class="itemPrice" value="${initialPrice}" min="0" step="0.01" onchange="calculateRowTotal(this.closest('.item-row')); calculateTotal()" placeholder="বিক্রয়মূল্য">
    <div class="item-total-display">৳০</div>
    <button class="remove-btn" onclick="this.parentElement.remove(); calculateTotal()">×</button>
  `;
  const select = row.querySelector('select');
  populatePresetSelect(select, isCustom ? '__custom__' : name);
  select.addEventListener('change', () => {
    updateItem(select);
    calculateTotal();
  });
  container.appendChild(row);
  calculateRowTotal(row);
  calculateTotal();
}

function updateItem(sel) {
  const row = sel.closest('.item-row');
  const customInput = row.querySelector('.customName');
  const priceInput = row.querySelector('.itemPrice');
  const costInput = row.querySelector('.itemCostPrice');
  const costDisplay = row.querySelector('.item-cost-display');
  if (sel.value === '__custom__') {
    customInput.style.display = 'block';
    customInput.focus();
    costInput.value = '0';
    costDisplay.textContent = 'ক্রয়: ৳০ / ইউনিট';
    priceInput.value = '0';
  } else {
    customInput.style.display = 'none';
    customInput.value = '';
    const costPrice = Number((settings.costPrices || {})[sel.value] || 0);
    costInput.value = String(costPrice);
    costDisplay.textContent = 'ক্রয়: ' + formatMoney(costPrice) + ' / ইউনিট';
    priceInput.value = Object.prototype.hasOwnProperty.call(settings.sellingPrices || {}, sel.value)
      ? settings.sellingPrices[sel.value]
      : '0';
  }
  calculateRowTotal(row.closest('.item-row'));
}

function calculateRowTotal(row) {
  const qty = Math.max(0, safeNum(row.querySelector('.itemQty').value));
  const price = Math.max(0, safeNum(row.querySelector('.itemPrice').value));
  const total = qty * price;
  const display = row.querySelector('.item-total-display');
  if (display) display.textContent = formatMoney(total);
  return total;
}

function calculateTotal() {
  let subtotal = 0;
  document.querySelectorAll('.item-row').forEach(row => {
    subtotal += safeNum(calculateRowTotal(row));
  });

  const discountAmount = Math.max(0, parseFloat(document.getElementById('discountAmount').value) || 0);
  const discountType = document.getElementById('discountType').value;

  let discount = 0;
  if (discountType === 'percent') {
    discount = (subtotal * discountAmount) / 100;
  } else {
    discount = discountAmount;
  }
  discount = Math.min(subtotal, Math.max(0, discount));

  const total = Math.max(0, subtotal - discount);

  document.getElementById('subtotalDisplay').textContent = formatMoney(subtotal);
  document.getElementById('discountDisplay').textContent = '-' + formatMoney(discount);
  document.getElementById('grandTotal').textContent = formatMoney(total);

  return { subtotal, discount, total };
}

function getItems() {
  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const sel = row.querySelector('select');
    const customInput = row.querySelector('.customName');
    const qty = parseFloat(row.querySelector('.itemQty').value) || 0;
    const price = parseFloat(row.querySelector('.itemPrice').value) || 0;
    const costPrice = parseFloat(row.querySelector('.itemCostPrice').value) || 0;
    let name = '';
    if (sel.value === '__custom__') {
      name = customInput.value.trim();
    } else {
      name = sel.value;
    }
    if (name && qty > 0 && price >= 0) {
      items.push({ name, qty, price, costPrice, total: qty * price });
    }
  });
  return items;
}

function normalizeInvoiceFinancials(invoice) {
  const costPrices = settings.costPrices || {};
  const items = (Array.isArray(invoice.items) ? invoice.items : []).map(item => {
    const qty = Math.max(0, safeNum(item.qty));
    const price = Math.max(0, safeNum(item.price));
    const normalized = { ...item, qty, price, total: Number((qty * price).toFixed(2)) };
    if (item.costPrice !== undefined && item.costPrice !== null && item.costPrice !== '') {
      normalized.costPrice = Math.max(0, safeNum(item.costPrice));
    }
    return normalized;
  });
  const subtotal = items.length
    ? Number(items.reduce((sum, item) => sum + item.total, 0).toFixed(2))
    : Math.max(0, safeNum(invoice.subtotal));
  const discount = Math.min(subtotal, Math.max(0, safeNum(invoice.discount)));
  const total = items.length
    ? Number(Math.max(0, subtotal - discount).toFixed(2))
    : Math.max(0, safeNum(invoice.total));
  const hasCompleteItemCosts = items.length > 0 && items.every(item =>
    item.costPrice !== undefined || Object.prototype.hasOwnProperty.call(costPrices, item.name));
  const storedCost = invoice.costTotal !== undefined && invoice.costTotal !== null && invoice.costTotal !== ''
    && Number.isFinite(Number(invoice.costTotal));
  const costTotal = hasCompleteItemCosts || !storedCost
    ? Number(items.reduce((sum, item) => {
      const unitCost = item.costPrice !== undefined
        ? item.costPrice
        : Object.prototype.hasOwnProperty.call(costPrices, item.name) ? costPrices[item.name] : 0;
      return sum + Math.max(0, safeNum(unitCost)) * item.qty;
    }, 0).toFixed(2))
    : Math.max(0, safeNum(invoice.costTotal));

  return {
    ...invoice,
    items,
    subtotal,
    discount,
    total,
    costTotal,
    netProfit: Number((total - costTotal).toFixed(2))
  };
}

function calculateInvoiceCost(invoice) {
  const costPrices = settings.costPrices || {};
  const presets = new Set((settings.presetItems || '').split('\n').map(item => item.trim()).filter(Boolean));
  const missingCostItems = [...new Set(invoice.items
    .filter(item => presets.has(item.name)
      && !Object.prototype.hasOwnProperty.call(costPrices, item.name)
      && (item.costPrice === undefined || item.costPrice === null || item.costPrice === ''))
    .map(item => item.name))];

  if (missingCostItems.length) return { missingCostItems };

  let costTotal = 0;
  invoice.items = invoice.items.map(item => {
    const qty = safeNum(item.qty);
    const price = safeNum(item.price);
    const costPrice = Math.max(0, safeNum(item.costPrice !== undefined
      ? item.costPrice
      : Object.prototype.hasOwnProperty.call(costPrices, item.name) ? costPrices[item.name] : 0));
    const lineTotal = qty * price;
    const itemCost = costPrice * qty;
    costTotal += itemCost;
    return {
      ...item,
      costPrice,
      qty,
      price,
      total: Number(lineTotal.toFixed(2)),
      costTotal: Number(itemCost.toFixed(2))
    };
  });

  invoice.subtotal = Number(invoice.items.reduce((sum, item) => sum + safeNum(item.total), 0).toFixed(2));
  invoice.discount = Math.min(invoice.subtotal, Math.max(0, safeNum(invoice.discount)));
  invoice.total = Number(Math.max(0, invoice.subtotal - invoice.discount).toFixed(2));
  invoice.costTotal = Number(costTotal.toFixed(2));
  invoice.netProfit = Number((safeNum(invoice.total) - invoice.costTotal).toFixed(2));

  return { missingCostItems: [] };
}

function updateCurrentInvoiceNo() {
  const el = document.getElementById('currentInvNo');
  if (el) el.textContent = generateInvoiceNo(nextInvoiceNumber);
}

async function saveInvoiceOnly() {
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const items = getItems();

  if (!name) return showToast('কাস্টমারের নাম দিন', 'error');
  if (items.length === 0) return showToast('কমপক্ষে একটি আইটেম যোগ করুন', 'error');
  if (!phone) return showToast('ফোন নম্বর দিন', 'error');

  const { subtotal, discount, total } = calculateTotal();
  const discountAmount = Math.max(0, parseFloat(document.getElementById('discountAmount').value) || 0);
  const discountType = document.getElementById('discountType').value;

  const isEdit = Boolean(editingInvoiceId);
  const existing = isEdit ? invoices.find(i => i.id === editingInvoiceId) : null;

  const invoice = {
    id: isEdit ? editingInvoiceId : Date.now(),
    invoiceNo: isEdit && existing && existing.invoiceNo ? existing.invoiceNo : generateInvoiceNo(nextInvoiceNumber),
    customer: name,
    phone: phone,
    items: items,
    subtotal: subtotal,
    total: total,
    discount: discount,
    discountAmount: discountAmount,
    discountType: discountType,
    date: isEdit && existing && existing.date ? existing.date : new Date().toISOString()
  };

  const costResult = calculateInvoiceCost(invoice);
  if (costResult.missingCostItems.length) {
    return showToast('সেটিংসে কস্টিং প্রাইস সেট করুন: ' + costResult.missingCostItems.join(', '), 'error');
  }

  try {
    if (isEdit) {
      const idx = invoices.findIndex(i => i.id === editingInvoiceId);
      if (idx >= 0) invoices[idx] = invoice; else invoices.unshift(invoice);
    } else {
      invoices.unshift(invoice);
      nextInvoiceNumber++;
      localStorage.setItem('pos_next_inv_no', nextInvoiceNumber.toString());
    }
    localStorage.setItem('pos_invoices', JSON.stringify(invoices));
    resetForm();
    if (typeof updateStats === 'function') updateStats();
    renderInvoices();
    updateCurrentInvoiceNo();

    const action = isEdit ? 'আপডেট হয়েছে: ' : 'সেভ হয়েছে: ';
    if (currentUserId) {
      showToast('✓ ইনভয়েস লোকালি ' + action + invoice.invoiceNo + ' — ক্লাউডে সিঙ্ক হচ্ছে');
      saveInvoiceToFirebase(invoice);
    } else {
      showToast('✓ ইনভয়েস লোকাল স্টোরেজে ' + action + invoice.invoiceNo);
    }
  } catch (error) {
    console.error('Invoice save error:', error);
    showToast('ইনভয়েস সেভ করা যায়নি: ' + (error.message || error), 'error');
  }
}

function sendWhatsAppMessage(inv, whatsappWindow = null) {
  let msg;
  try {
    msg = generateWhatsAppMessage({ ...inv, items: Array.isArray(inv && inv.items) ? inv.items : [] });
  } catch (err) {
    console.error('generateWhatsAppMessage error:', err);
    msg = `*ইনভয়েস নং: ${(inv && inv.invoiceNo) || 'N/A'}*\n\nমোট টাকার পরিমাণ = ৳${toBnNum(safeNum(inv && inv.total))} টাকা`;
  }

  const DEFAULT_PHONE = '01877987587';
  let rawPhone = (inv && inv.phone != null && String(inv.phone).trim() !== '') ? String(inv.phone) : DEFAULT_PHONE;
  const BN_DIGITS = { '\u09e6': '0', '\u09e7': '1', '\u09e8': '2', '\u09e9': '3', '\u09ea': '4', '\u09eb': '5', '\u09ec': '6', '\u09ed': '7', '\u09ee': '8', '\u09ef': '9' };
  let waPhone = rawPhone.replace(/[\u09e6-\u09ef]/g, d => BN_DIGITS[d]).replace(/\D/g, '');
  if (waPhone.startsWith('880')) { /* already ok */ }
  else if (waPhone.startsWith('0')) waPhone = '880' + waPhone.substring(1);
  else if (waPhone.length === 10) waPhone = '880' + waPhone;
  if (!waPhone) waPhone = DEFAULT_PHONE.replace(/^0/, '880');

  try {
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    if (whatsappWindow && !whatsappWindow.closed) {
      whatsappWindow.location.href = url;
      return;
    }
    if (!window.open(url, '_blank')) window.location.href = url;
  } catch (err) {
    console.error('sendWhatsAppMessage error:', err);
    showToast('WhatsApp খোলা যায়নি', 'error');
  }
}

function generateWhatsAppMessage(inv) {
  const E = EMOJI_OK;
  const biz = getBusinessInfo();
  let msg = `${E ? '🧾' : '>>'} *ইনভয়েস নং: ${inv.invoiceNo}*\n\n`;
  msg += `${E ? '👤' : '>>'} জনাব/জনাবা, *${inv.customer}* আপনার *${biz.name}*-এর কাজের বিলের পরিমাণ নিম্নরূপ:\n\n`;

  inv.items.forEach((item) => {
    msg += `${E ? '▸' : '>>'} ${item.name}\n`;
    msg += `   ${E ? '➜' : '>>'} ${toBnNum(safeNum(item.qty))} × ৳${toBnNum(safeNum(item.price))} = *৳${toBnNum(safeNum(item.total))}*\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  if (inv.subtotal && inv.subtotal !== inv.total) {
    msg += `সাবটোটাল: ৳${toBnNum(safeNum(inv.subtotal))}\n`;
    msg += `ডিসকাউন্ট: ৳${toBnNum(safeNum(inv.discount))}\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n`;
  }
  msg += `*মোট টাকার পরিমাণ = ৳${toBnNum(safeNum(inv.total))} টাকা*\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `╔════════════════════╗\n`;
  msg += `    আমাদের সাথে যুক্ত থাকতে পারেন:\n`;
  msg += `╚════════════════════╝\n`;
  msg += `${E ? '➜' : '>>'}${BUSINESS.social.youtube.url}\n`;
  msg += `${E ? '➜' : '>>'}${BUSINESS.social.facebook.url}\n`;
  msg += `${E ? '➜' : '>>'}${BUSINESS.social.tiktok.url}\n`;
  msg += `${E ? '➜' : '>>'}${BUSINESS.social.instagram.url}\n\n`;

  msg += `${E ? '➜' : '>>'} আমাদের সেবা সম্পর্কে জানাতে: ${BUSINESS.review}\n\n`;

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `*${biz.name}* - ${biz.tagline}`;

  return msg;
}

function resendWhatsApp() {
  if (!currentInvoiceId) return;
  const inv = invoices.find(i => String(i.id) === String(currentInvoiceId));
  if (!inv) return;
  try {
    sendWhatsAppMessage(inv);
  } catch (err) {
    console.error('resendWhatsApp error:', err);
    showToast('WhatsApp খোলা যায়নি', 'error');
  }
}

function resetForm() {
  editingInvoiceId = null;
  document.getElementById('customerName').value = 'ABC Computer (Walk-in)';
  document.getElementById('customerPhone').value = '01877987587';
  document.getElementById('itemsContainer').innerHTML = '';
  document.getElementById('discountAmount').value = '0';
  document.getElementById('discountType').value = 'amount';
  addItem();
  calculateTotal();
  updateCurrentInvoiceNo();
}

function generatePrintHTML(inv) {
  const isSmallBill = inv.items.length <= 4;
  const biz = getBusinessInfo();

  let itemsHtml = inv.items.map((item, i) => `
    <tr>
      <td class="text-center">${toBnNum(i + 1)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td class="text-center">${toBnNum(safeNum(item.qty))}</td>
      <td class="text-right">৳${toBnNum(safeNum(item.price))}</td>
      <td class="text-right">৳${toBnNum(safeNum(item.total))}</td>
    </tr>
  `).join('');

  let totalsHtml = '';
  if (inv.subtotal && inv.subtotal !== inv.total) {
    totalsHtml += `<div class="line"><span>সাবটোটাল:</span><span>৳${toBnNum(safeNum(inv.subtotal))}</span></div>`;
    totalsHtml += `<div class="line discount"><span>ডিসকাউন্ট:</span><span>-৳${toBnNum(safeNum(inv.discount))}</span></div>`;
  }

  const logoHtml = biz.logo ? `
    <div class="print-logo-wrap">
      <img src="${biz.logo}" alt="Logo" class="print-logo-img">
    </div>
  ` : '';

  return `
    <div class="print-header">
      ${logoHtml}
      <div class="biz-name">${biz.logo ? '' : em('🖥️', '>>')} ${escapeHtml(biz.name)}</div>
      <div class="biz-tag">${escapeHtml(biz.tagline)}</div>
      <div class="biz-addr">${em('📍', '>>')} ${escapeHtml(biz.address)}</div>
      <div class="biz-addr">${em('📞', '>>')} ${escapeHtml(biz.phone)} ${biz.website ? `| ${em('🌐', '>>')} ${escapeHtml(biz.website)}` : ''}</div>
      ${biz.services ? `<div class="biz-services">✦ ${escapeHtml(biz.services)} ✦</div>` : ''}
    </div>

    <div class="print-inv-no">ইনভয়েস নং: ${inv.invoiceNo || 'N/A'}</div>

    <div class="print-meta">
      <div><span>তারিখ:</span> ${formatDate(inv.date)}</div>
      <div><span>সময়:</span> ${formatTime(inv.date)}</div>
    </div>
    <div class="print-meta" style="margin-top:-4px;">
      <div><span>কাস্টমার:</span> ${inv.customer}</div>
      ${inv.phone ? `<div><span>ফোন:</span> ${inv.phone}</div>` : ''}
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th style="width:8%;">#</th>
          <th style="width:42%;">বিবরণ</th>
          <th style="width:12%;" class="text-center">পরিমাণ</th>
          <th style="width:18%;" class="text-right">দাম</th>
          <th style="width:20%;" class="text-right">মোট</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="print-totals">
      ${totalsHtml}
      <div class="final-total">সর্বমোট: ৳${toBnNum(safeNum(inv.total))}</div>
    </div>

    <div class="print-footer">
      <div class="thanks">${em('🙏', '>>')} আমাদের সেবার জন্য ধন্যবাদ!</div>
      
      <div class="print-footer-content ${isSmallBill ? 'small-bill' : 'large-bill'}">
        <div class="print-social-text">
          <div style="font-weight:700;margin-bottom:4px;">${em('📲', '>>')} আমাদের সাথে যুক্ত থাকুন:</div>
          <div class="print-social-row">
            <span>${em('▶️', '>>')} / ${BUSINESS.social.youtube.handle}</span>
            <span>${em('📘', '>>')} / ${BUSINESS.social.facebook.handle}</span>
            <span>${em('🎵', '>>')} / ${BUSINESS.social.tiktok.handle}</span>
            <span>${em('📸', '>>')} / ${BUSINESS.social.instagram.handle}</span>
          </div>
          <div class="review-line">${em('⭐', '>>')} স্ক্যান করে রিভিউ দিন</div>
        </div>
        
        <img src="QR.PNG" class="print-qr-img ${isSmallBill ? 'large' : ''}" alt="QR Code">
      </div>
      
      <div class="print-computer-gen">এটি একটি কম্পিউটার জেনারেটেড ইনভয়েস</div>
    </div>
  `;
}

function runPrint(buildHtml, inv, callerName) {
  try {
    showToast('প্রিন্ট প্রস্তুত হচ্ছে...', 'loading');
    const printArea = document.getElementById('printArea');
    if (!printArea) {
      console.error(callerName + ': #printArea element not found');
      return showToast('প্রিন্ট এরিয়া পাওয়া যায়নি', 'error');
    }
    printArea.innerHTML = buildHtml(inv);
    const hideToast = () => {
      const t = document.getElementById('toast');
      if (toastTimeoutId) clearTimeout(toastTimeoutId);
      toastTimeoutId = null;
      if (t) t.className = 'toast';
    };
    let printed = false;
    const startPrint = () => {
      if (printed) return;
      printed = true;
      try {
        window.print();
      } catch (err) {
        console.error(callerName + ': window.print() failed', err);
      } finally {
        hideToast();
      }
    };
    const qrImage = printArea.querySelector('.print-qr-img');
    const logoImage = printArea.querySelector('.print-logo-img');
    const pendingImgs = [qrImage, logoImage].filter(img => img && !img.complete);
    if (pendingImgs.length > 0) {
      let done = 0;
      const onDone = () => {
        done++;
        if (done >= pendingImgs.length) startPrint();
      };
      pendingImgs.forEach(img => {
        img.addEventListener('load', onDone, { once: true });
        img.addEventListener('error', onDone, { once: true });
      });
      setTimeout(startPrint, 2500);
    } else {
      setTimeout(startPrint, 100);
    }
  } catch (err) {
    console.error(callerName + ' error:', err);
    showToast('প্রিন্ট করা যায়নি', 'error');
  }
}

function printInvoice(id) {
  const inv = invoices.find(i => String(i.id) === String(id));
  if (!inv) return showToast('ইনভয়েস খুঁজে পাওয়া যায়নি', 'error');
  runPrint(i => generatePrintHTML(i), inv, 'printInvoice');
}

function printCurrent() {
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const items = getItems();
  if (!name || items.length === 0) return showToast('প্রথমে বিল তৈরি করুন', 'error');

  const { subtotal, discount, total } = calculateTotal();
  const editing = editingInvoiceId ? invoices.find(i => i.id === editingInvoiceId) : null;
  const inv = {
    invoiceNo: editing && editing.invoiceNo ? editing.invoiceNo : generateInvoiceNo(nextInvoiceNumber),
    customer: name,
    phone,
    items,
    subtotal,
    discount,
    total,
    date: editing && editing.date ? editing.date : new Date().toISOString()
  };

  runPrint(i => generatePrintHTML(i), inv, 'printCurrent');
}

function renderInvoices() {
  const list = document.getElementById('invoiceList');
  if (!list) return;
  const monthFilter = document.getElementById('monthFilter').value;
  const search = document.getElementById('searchFilter').value.toLowerCase();

  let filtered = invoices.filter(inv => {
    if (monthFilter) {
      const d = new Date(inv.date);
      const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (ym !== monthFilter) return false;
    }
    if (search) {
      const invNo = (inv.invoiceNo || '').toLowerCase();
      const customer = (inv.customer || '').toLowerCase();
      const phone = (inv.phone || '');
      if (!customer.includes(search) && !phone.includes(search) && !invNo.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty"><div class="icon">📭</div><div>কোনো ইনভয়েস নেই</div></div>';
    return;
  }

  list.innerHTML = filtered.map(inv => `
    <div class="invoice-item" onclick="viewInvoice(${inv.id})">
      <div class="top">
        <div>
          <div class="inv-no">${inv.invoiceNo || 'N/A'}</div>
          <div class="customer" style="margin-top:4px;">👤 ${inv.customer}</div>
        </div>
        <div class="amount">${formatMoney(inv.total)}</div>
      </div>
      <div class="meta">${formatDate(inv.date)} ${inv.phone ? '• 📱 ' + inv.phone : ''}</div>
      <div class="actions" onclick="event.stopPropagation()">
        <button style="background:#25d366;color:white;" onclick="quickResend(${inv.id})">📱 WhatsApp</button>
        <button style="background:#f59e0b;color:white;" onclick="editInvoice(${inv.id})">✏️ এডিট</button>
        <button style="background:#3b82f6;color:white;" onclick="printInvoice(${inv.id})">🖨️ প্রিন্ট</button>
        <button style="background:#ef4444;color:white;" onclick="deleteInvoice(${inv.id})">🗑️</button>
      </div>
    </div>
  `).join('');

  if (typeof updateStats === 'function') updateStats();
}

function quickResend(id) {
  currentInvoiceId = id;
  resendWhatsApp();
}

function editInvoice(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return showToast('ইনভয়েস খুঁজে পাওয়া যায়নি', 'error');

  editingInvoiceId = inv.id;
  currentInvoiceId = inv.id;

  document.getElementById('customerName').value = inv.customer || '';
  document.getElementById('customerPhone').value = inv.phone || '';

  const container = document.getElementById('itemsContainer');
  container.innerHTML = '';
  if (Array.isArray(inv.items) && inv.items.length) {
    inv.items.forEach(item => addItem(item.name || '', item.qty || 1, item.price || 0, item.costPrice));
  } else {
    addItem();
  }

  document.getElementById('discountAmount').value = String(inv.discountAmount != null ? inv.discountAmount : 0);
  document.getElementById('discountType').value = inv.discountType === 'percent' ? 'percent' : 'amount';
  calculateTotal();

  document.getElementById('currentInvNo').textContent = inv.invoiceNo || generateInvoiceNo(nextInvoiceNumber);

  closeInvoiceModal();
  if (typeof updateStats === 'function') updateStats();
  renderInvoices();

  try { document.getElementById('customerName').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
  showToast('✏️ ইনভয়েস এডিট মোডে খোলা হয়েছে: ' + (inv.invoiceNo || ''));
}

function viewInvoice(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  const financials = normalizeInvoiceFinancials(inv);
  currentInvoiceId = id;
  const biz = getBusinessInfo();
  const detail = document.getElementById('invoiceDetail');
  detail.innerHTML = `
    <div style="background:linear-gradient(135deg,var(--dark),var(--dark-2));color:white;padding:12px 16px;border-radius:10px;margin-bottom:12px;text-align:center;">
      <div style="font-size:11px;opacity:0.8;">ইনভয়েস নম্বর</div>
      <div style="font-size:22px;font-weight:700;color:var(--primary);letter-spacing:1px;">${inv.invoiceNo || 'N/A'}</div>
    </div>
    <div style="background:var(--gray-50);padding:15px;border-radius:10px;">
      ${biz.logo ? `
        <div style="text-align:center;margin-bottom:8px;">
          <img src="${biz.logo}" alt="Logo" style="max-height:45px;max-width:140px;object-fit:contain;display:inline-block;">
        </div>
      ` : ''}
      <div style="text-align:center;font-weight:700;color:var(--dark);font-size:16px;">${escapeHtml(biz.name)}</div>
      <div style="text-align:center;font-size:11px;color:var(--gray-500);margin-bottom:10px;">${escapeHtml(biz.address)} • ${escapeHtml(biz.phone)}</div>
      <h3 style="color:var(--dark);margin-top:10px;">👤 ${escapeHtml(inv.customer)}</h3>
      ${inv.phone ? `<p style="color:var(--gray-500);font-size:13px;">📱 ${inv.phone}</p>` : ''}
      <p style="color:#94a3b8;font-size:12px;margin:5px 0;">📅 ${formatDate(inv.date)} • ⏰ ${formatTime(inv.date)}</p>
      <hr style="margin:10px 0;border:none;border-top:1px dashed #cbd5e1;">
      ${financials.items.map(i => `
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--gray-100);">
          <span>${i.name} × ${toBnNum(safeNum(i.qty))}</span>
          <span style="font-weight:700;">${formatMoney(i.total)}</span>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:space-between;padding:5px 0;color:var(--gray-500);">
        <span>সাবটোটাল</span>
        <span>${formatMoney(financials.subtotal)}</span>
      </div>
      ${safeNum(financials.discount) > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:5px 0;color:var(--danger);">
          <span>ডিসকাউন্ট</span>
          <span>-${formatMoney(financials.discount)}</span>
        </div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;padding:10px 0;margin-top:8px;border-top:2px solid var(--primary);font-size:18px;font-weight:700;color:var(--success);">
        <span>সর্বমোট</span>
        <span>${formatMoney(financials.total)}</span>
      </div>
      <div style="margin-top:12px;padding:12px;background:#ecfdf5;border-radius:10px;">
        <div style="display:flex;justify-content:space-between;font-weight:700;color:var(--dark);">
            <span>মোট কস্ট</span>
            <span>${formatMoney(financials.costTotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;color:${financials.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};margin-top:6px;">
          <span>লাভ</span>
          <span>${formatMoney(financials.netProfit)}</span>
        </div>
      </div>
    </div>
  `;
  document.getElementById('invoiceModal').classList.add('active');
}

function closeInvoiceModal() {
  document.getElementById('invoiceModal').classList.remove('active');
}

async function deleteInvoice(id) {
  if (!confirm('এই ইনভয়েসটি মুছে ফেলবেন?')) return;

  try {
    invoices = invoices.filter(i => i.id !== id);
    localStorage.setItem('pos_invoices', JSON.stringify(invoices));
    if (typeof updateStats === 'function') updateStats();
    renderInvoices();

    if (currentUserId) {
      showToast('✓ ইনভয়েস লোকালি মুছে ফেলা হয়েছে — ক্লাউডে সিঙ্ক হচ্ছে');
      saveInvoiceToFirebase(id);
    } else {
      showToast('✓ ইনভয়েস মুছে ফেলা হয়েছে');
    }
  } catch (error) {
    console.error('Invoice delete error:', error);
    showToast('ইনভয়েস মুছে ফেলা যায়নি: ' + (error.message || error), 'error');
  }
}

// ===== Settings Modal & Price Fields =====
function openSettings() {
  if (currentAccess.role === 'Partner/Staff') {
    return showToast('পার্টনার অ্যাকাউন্ট থেকে ব্যবসার সেটিংস খোলা যাবে না।', 'error');
  }
  populateSettingsFormFromCurrent();
  document.getElementById('settingsModal').classList.add('active');
}

function capturePresetPriceDraft() {
  settings.costPrices = settings.costPrices || {};
  settings.sellingPrices = settings.sellingPrices || {};
  document.querySelectorAll('.preset-cost-input, .preset-selling-input').forEach(input => {
    const name = input.dataset.itemName;
    const prices = input.classList.contains('preset-cost-input')
      ? settings.costPrices
      : settings.sellingPrices;
    if (input.value === '') {
      delete prices[name];
    } else {
      prices[name] = input.value;
    }
  });
}

function renderPresetPriceFields() {
  const container = document.getElementById('presetPriceFields');
  if (!container) return;
  const presets = [...new Set((document.getElementById('presetItems').value || '')
    .split('\n').map(item => item.trim()).filter(Boolean))];
  container.innerHTML = '';

  if (!presets.length) {
    container.textContent = 'আগে প্রি-সেট আইটেম যোগ করুন।';
    return;
  }

  presets.forEach(name => {
    const row = document.createElement('div');
    row.className = 'preset-price-row';
    const title = document.createElement('span');
    title.textContent = name;
    const costInput = document.createElement('input');
    costInput.type = 'number';
    costInput.min = '0';
    costInput.step = '0.01';
    costInput.placeholder = 'কস্ট';
    costInput.className = 'preset-cost-input';
    costInput.dataset.itemName = name;
    if (Object.prototype.hasOwnProperty.call(settings.costPrices || {}, name)) {
      costInput.value = settings.costPrices[name];
    }
    const sellingInput = document.createElement('input');
    sellingInput.type = 'number';
    sellingInput.min = '0';
    sellingInput.step = '0.01';
    sellingInput.placeholder = 'বিক্রয়';
    sellingInput.className = 'preset-selling-input';
    sellingInput.dataset.itemName = name;
    if (Object.prototype.hasOwnProperty.call(settings.sellingPrices || {}, name)) {
      sellingInput.value = settings.sellingPrices[name];
    }
    row.append(title, costInput, sellingInput);
    container.appendChild(row);
  });
}

function closeSettings() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.remove('active');
}

async function saveSettings() {
  const costPrices = {};
  const sellingPrices = {};
  let invalidPrice = false;
  document.querySelectorAll('.preset-cost-input, .preset-selling-input').forEach(input => {
    if (input.value === '') return;
    const price = Number(input.value);
    if (!Number.isFinite(price) || price < 0) {
      invalidPrice = true;
      return;
    }
    if (input.classList.contains('preset-cost-input')) {
      costPrices[input.dataset.itemName] = price;
    } else {
      sellingPrices[input.dataset.itemName] = price;
    }
  });
  if (invalidPrice) {
    return showToast('কস্ট ও বিক্রয়মূল্য শূন্য বা তার বেশি সংখ্যা হতে হবে', 'error');
  }

  const bName = (document.getElementById('settingBizName')?.value || '').trim();
  const bTag = (document.getElementById('settingBizTagline')?.value || '').trim();
  const bPhone = (document.getElementById('settingBizPhone')?.value || '').trim();
  const bAddr = (document.getElementById('settingBizAddress')?.value || '').trim();
  const bWeb = (document.getElementById('settingBizWebsite')?.value || '').trim();
  const bLogo = currentLogoDataUrl || (document.getElementById('settingBizLogoUrl')?.value || '').trim();

  settings.businessName = bName;
  settings.businessTagline = bTag;
  settings.businessPhone = bPhone;
  settings.businessAddress = bAddr;
  settings.businessWebsite = bWeb;
  settings.businessLogo = bLogo;

  settings.presetItems = document.getElementById('presetItems').value;
  settings.expenseCategories = document.getElementById('expenseCategories').value;
  settings.costPrices = costPrices;
  settings.sellingPrices = sellingPrices;
  localStorage.setItem('pos_settings', JSON.stringify(settings));
  applyBusinessBranding();
  if (typeof populateExpenseCategoryOptions === 'function') {
    populateExpenseCategoryOptions();
  }
  closeSettings();
  document.getElementById('itemsContainer').innerHTML = '';
  addItem();

  if (currentUserId) {
    showToast('✓ সেটিংস লোকালি সেভ হয়েছে — Firebase ক্লাউডে সিঙ্ক হচ্ছে');
    saveSettingsToFirebase();
  } else {
    showToast('✓ সেটিংস লোকাল স্টোরেজে সেভ হয়েছে');
  }
}

function exportData() {
  const data = { business: BUSINESS, invoices, settings, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `abc-computer-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast('✓ ব্যাকআপ ডাউনলোড হয়েছে');
}
