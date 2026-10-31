const SHEET_NAME = 'Sales';
const PROFIT_SHEET_NAME = 'Profit Sharing';
const SETTINGS_SHEET_NAME = 'Settings'; // সেটিংস শিটের নাম
const LEGACY_SHEET_NAME = 'Sheet1';
const SETTINGS_PIN = '25802580';

function getInvoiceSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    const legacySheet = ss.getSheetByName(LEGACY_SHEET_NAME);
    sheet = legacySheet ? (legacySheet.setName(SHEET_NAME), legacySheet) : ss.insertSheet(SHEET_NAME);
  }
  const headers = [
    'ID', 'Invoice No', 'Date', 'Customer', 'Phone', 'Items',
    'Subtotal', 'Discount', 'Total', 'Cost Total', 'Net Profit',
    'Profit Shares', 'Profit Details'
  ];

  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) {
    sheet.appendRow(headers);
  } else if (lastColumn < headers.length) {
    sheet.getRange(1, lastColumn + 1, 1, headers.length - lastColumn)
      .setValues([headers.slice(lastColumn)]);
  }
  const legacySheet = ss.getSheetByName(LEGACY_SHEET_NAME);
  if (legacySheet && legacySheet !== sheet) {
    migrateLegacyInvoices(sheet, legacySheet, headers.length);
  }
  return sheet;
}

function getProfitSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PROFIT_SHEET_NAME);
  const headers = [
    'Invoice ID', 'Invoice No', 'Date', 'Customer', 'Selling Total',
    'Cost Total', 'Net Profit', 'Owner Share Amount', 'Partner Shares', 'Allotment Details', 'Items'
  ];
  if (!sheet) {
    sheet = ss.insertSheet(PROFIT_SHEET_NAME);
    sheet.appendRow(headers);
  } else if (sheet.getLastColumn() < headers.length) {
    const startColumn = Math.max(1, sheet.getLastColumn() + 1);
    sheet.getRange(1, startColumn, 1, headers.length - startColumn + 1)
      .setValues([headers.slice(startColumn - 1)]);
  }
  return sheet;
}

function createRequestResponse(e, data) {
  const callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    if (!/^__posJsonp_[A-Za-z0-9_]+$/.test(callback)) {
      return createJsonResponse({ success: false, message: 'অবৈধ JSONP callback' });
    }
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(data) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return createJsonResponse(data);
}

function getInvoiceFromRow(row) {
  const rawItems = row[5];
  const parsedItems = typeof rawItems === 'string'
    ? safeJsonParse(rawItems, null)
    : rawItems;
  const profitDetails = safeJsonParse(row[12], []);
  const items = Array.isArray(profitDetails) && profitDetails.length
    ? profitDetails
    : (Array.isArray(parsedItems) ? parsedItems : []);
  return {
    id: row[0],
    invoiceNo: row[1],
    date: row[2],
    customer: row[3],
    phone: row[4],
    items: items,
    itemsSummary: items.length ? '' : String(rawItems || ''),
    subtotal: row[6],
    discount: row[7],
    total: row[8],
    costTotal: row[9] || 0,
    netProfit: row[10],
    profitShares: safeJsonParse(row[11], []),
    profitDetails: Array.isArray(profitDetails) ? profitDetails : []
  };
}

function migrateLegacyInvoices(salesSheet, legacySheet, columnCount) {
  const salesRows = salesSheet.getDataRange().getValues();
  const knownIds = {};
  salesRows.slice(1).forEach(row => {
    if (row[0] !== '' && row[0] !== null && row[0] !== undefined) {
      knownIds[String(row[0])] = true;
    }
  });

  const legacyRows = legacySheet.getDataRange().getValues();
  for (let i = 1; i < legacyRows.length; i++) {
    const row = legacyRows[i].slice(0, columnCount);
    if (!row[0] || knownIds[String(row[0])]) continue;
    while (row.length < columnCount) row.push('');
    row[9] = row[9] || 0;
    row[10] = row[10] || 0;
    row[11] = row[11] || '[]';
    row[12] = row[12] || '[]';
    salesSheet.appendRow(row);
    knownIds[String(row[0])] = true;
  }
}

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'getAll';
    const sheet = getInvoiceSheet();

    if (action === 'test') {
      getProfitSheet();
      const data = sheet.getDataRange().getValues();
      return createRequestResponse(e, {
        success: true,
        message: 'সংযোগ সফল',
        count: Math.max(0, data.length - 1)
      });
    }

    if (action === 'getSettings') {
      if (String(params.pin || '') !== SETTINGS_PIN) {
        return createRequestResponse(e, { success: false, message: 'সেটিংস PIN সঠিক নয়' });
      }
      return createRequestResponse(e, { success: true, settings: getSettings() });
    }

    if (action === 'verifyInvoice' || action === 'verifyDelete') {
      const id = String(params.id || '');
      const salesRow = findInvoiceRow(getInvoiceSheet(), id);
      const profitRow = findInvoiceRow(getProfitSheet(), id);
      return createRequestResponse(e, {
        success: true,
        inSales: salesRow !== -1,
        inProfit: profitRow !== -1
      });
    }

    if (action === 'getAll' || action === 'searchReceiptFromSheet' || action === 'search' ||
        action === 'filterByMonth' || action === 'filterInvoicesByMonth') {
      const data = sheet.getDataRange().getValues();
      const invoices = [];
      let maxNum = 0;
      const month = params.month || '';
      const filterMonth = action === 'filterByMonth' || action === 'filterInvoicesByMonth';

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0] && !row[1]) continue; // খালি সারি বাদ
        const match = String(row[1] || '').match(/ABC-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
        const invoice = getInvoiceFromRow(row);
        const dateValue = invoice.date instanceof Date
          ? Utilities.formatDate(invoice.date, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(invoice.date || '');
        if (!filterMonth || !month || dateValue.indexOf(month) !== -1) {
          invoices.push(invoice);
        }
      }

      return createRequestResponse(e, {
        success: true,
        data: invoices,
        nextNumber: maxNum + 1
      });
    }

    return createRequestResponse(e, {
      success: false,
      message: 'অজানা action: ' + action
    });

  } catch (error) {
    return createRequestResponse(e, {
      success: false,
      message: error.toString()
    });
  }
}

function handleRequest(e) {
  try {
    let data = {};

    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (error) {
        data = e.parameter || {};
        if (typeof data.payload === 'string') {
          try {
            data = JSON.parse(data.payload);
          } catch (payloadError) {
            return createJsonResponse({ success: false, message: 'POST payload JSON সঠিক নয়' });
          }
        }
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    if (typeof data !== 'object' || data === null) {
      data = {};
    }

    let action = data.action || (e && e.parameter && e.parameter.action);

    if (!action) {
      if (data.id || data.invoiceNo || data.data) {
        action = 'saveInvoice';
      } else if (data.receiptId || (e && e.parameter && (e.parameter.id || e.parameter.receiptId))) {
        action = 'deleteInvoice';
      }
    }

    if (action === 'saveSettings') {
      if (String(data.pin || '') !== SETTINGS_PIN) {
        return createJsonResponse({ success: false, message: 'সেটিংস PIN সঠিক নয়' });
      }

      const settings = data.settings || data;
      const shares = Array.isArray(settings.profitShares) ? settings.profitShares : [];
      const shareNames = {};
      const shareTotal = shares.reduce((total, share) => {
        const name = String(share.name || '').trim();
        const percentage = Number(share.percentage);
        if (!name || shareNames[name] || !isFinite(percentage) || percentage < 0 || percentage > 100) {
          throw new Error('লাভের ভাগের সেটিংস সঠিক নয়');
        }
        shareNames[name] = true;
        return total + percentage;
      }, 0);
      if (!shares.length || Math.abs(shareTotal - 100) > 0.01) {
        throw new Error('লাভের ভাগের যোগফল ১০০% হতে হবে');
      }
      ['costPrices', 'sellingPrices'].forEach(function(key) {
        const prices = settings[key] || {};
        Object.keys(prices).forEach(function(name) {
          const price = Number(prices[name]);
          if (!isFinite(price) || price < 0) {
            throw new Error('কস্ট ও বিক্রয়মূল্য শূন্য বা তার বেশি হতে হবে');
          }
        });
      });

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
      if (!settingsSheet) {
        settingsSheet = ss.insertSheet(SETTINGS_SHEET_NAME);
        settingsSheet.appendRow(['Setting Name', 'Value']);
      }

      const values = [
        ['presetItems', String(settings.presetItems || '')],
        ['costPrices', JSON.stringify(settings.costPrices || {})],
        ['sellingPrices', JSON.stringify(settings.sellingPrices || {})],
        ['profitShares', JSON.stringify(settings.profitShares || [])]
      ];
      const existing = settingsSheet.getDataRange().getValues();
      values.forEach(([key, value]) => {
        const index = existing.findIndex((row, i) => i > 0 && row[0] === key);
        if (index >= 1) {
          settingsSheet.getRange(index + 1, 2).setValue(value);
        } else {
          settingsSheet.appendRow([key, value]);
        }
      });

      return createJsonResponse({ success: true, message: 'সেটিংস সেভ হয়েছে' });
    }

    if (action === 'saveInvoice') {
      let inv = data.data || data;
      if (typeof inv === 'string') {
        inv = safeJsonParse(inv, null);
      }

      if (!inv || (!inv.id && !inv.invoiceNo)) {
        return createJsonResponse({ success: false, message: 'ইনভয়েস ডাটা পাওয়া যায়নি' });
      }

      const sheet = getInvoiceSheet();
      const profitSheet = getProfitSheet();
      let itemsSummary = '';
      if (Array.isArray(inv.items)) {
        itemsSummary = inv.items.map(function(item) {
          var name = item.name || '';
          var qty = item.qty || 0;
          var price = item.price || 0;
          return name + ' (' + qty + 'x' + price + 'TK)';
        }).join(', ');
      } else {
        itemsSummary = String(inv.items || inv.itemsSummary || '');
      }

      const invoiceId = inv.id || new Date().getTime();
      const row = [
        invoiceId,
        inv.invoiceNo || '',
        inv.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
        inv.customer || '',
        inv.phone || '',
        itemsSummary,
        inv.subtotal || 0,
        inv.discount || 0,
        inv.total || 0,
        inv.costTotal || 0,
        inv.netProfit || 0,
        JSON.stringify(inv.profitShares || []),
        JSON.stringify(Array.isArray(inv.items) ? inv.items : [])
      ];
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        upsertInvoiceRow(sheet, invoiceId, row);
        const shares = Array.isArray(inv.profitShares) ? inv.profitShares : [];
        const ownerShare = shares.length ? shares[0] : { name: 'আমার অংশ', amount: 0 };
        const partnerShares = shares.slice(1);
        const profitRow = [
          invoiceId,
          inv.invoiceNo || '',
          inv.date || '',
          inv.customer || '',
          inv.total || 0,
          inv.costTotal || 0,
          inv.netProfit || 0,
          Number(ownerShare.amount || 0),
          JSON.stringify(partnerShares),
          JSON.stringify(shares),
          JSON.stringify(Array.isArray(inv.items) ? inv.items : [])
        ];
        upsertInvoiceRow(profitSheet, invoiceId, profitRow);
      } finally {
        lock.releaseLock();
      }

      return createJsonResponse({
        success: true,
        message: 'সেভ হয়েছে'
      });
    }

    if (action === 'deleteInvoice') {
      const id = data.id || data.receiptId || (e && e.parameter && (e.parameter.id || e.parameter.receiptId));
      if (!id) {
        return createJsonResponse({ success: false, message: 'মুছে ফেলার জন্য আইডি দেওয়া হয়নি' });
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const deletedSales = deleteInvoiceRow(getInvoiceSheet(), id);
        const deletedProfit = deleteInvoiceRow(getProfitSheet(), id);
        return createJsonResponse({
          success: deletedSales || deletedProfit,
          message: deletedSales || deletedProfit ? 'মুছে ফেলা হয়েছে' : 'ইনভয়েস খুঁজে পাওয়া যায়নি'
        });
      } finally {
        lock.releaseLock();
      }
    }

    return createJsonResponse({
      success: false,
      message: 'ভুল action: ' + action
    });

  } catch (error) {
    return createJsonResponse({
      success: false,
      message: error.toString()
    });
  }
}

function upsertInvoiceRow(sheet, id, row) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sheet.appendRow(row);
}

function deleteInvoiceRow(sheet, id) {
  const values = sheet.getDataRange().getValues();
  let deleted = false;
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      deleted = true;
    }
  }
  return deleted;
}

function findInvoiceRow(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS_SHEET_NAME);
    sheet.appendRow(['Setting Name', 'Value']);
  }
  
  const data = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    const val = data[i][1];
    if (key) {
      settings[key] = val;
    }
  }
  return settings;
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}