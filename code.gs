// ============================================
// ABC Computer POS - Robust Backend v4
// Fixed: Connection errors, CORS handling, Write verification
// ============================================

const SHEET_NAME = 'Sales';
const SETTINGS_SHEET_NAME = 'Settings';
const CREDITORS_SHEET_NAME = 'Creditors';
const EXPENSES_SHEET_NAME = 'Expenses';
const CASH_SHEET_NAME = 'CashRegister';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  const callback = (e && e.parameter && e.parameter.callback) || '';
  
  let result;
  
  try {
    if (action === 'list' || action === 'getAll') {
      result = listInvoices(e);
      if (action === 'getAll') {
        result = getAllInvoices(result);
      }
    } else if (action === 'getSettings') {
      result = getSettingsData(e);
    } else if (action === 'test') {
      result = testConnection();
      if (result.success) result.count = listInvoices(e).invoices.length;
    } else if (action === 'listCreditors') {
      result = listCreditors(e);
    } else if (action === 'listExpenses') {
      result = listExpenses(e);
    } else if (action === 'listCash') {
      result = listCashRecords(e);
    } else if (action === 'verifySettings') {
      result = verifySettings(e);
    } else if (action === 'verifyRecord') {
      result = verifyRecord(e);
    } else if (action === 'verifyRecordGone') {
      result = verifyRecordGone(e);
    } else if (action === 'verifyInvoice') {
      result = verifyInvoice(e);
    } else if (action === 'verifyDelete') {
      result = verifyDelete(e);
    } else {
      result = { success: false, error: 'Unknown action' };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }
  
  return jsonOutput(result, callback);
}

function doPost(e) {
  try {
    const data = parsePayload(e);
    const action = data.action || (e && e.parameter && e.parameter.action) || '';
    const callback = data.callback || '';
    
    let result;
    
    if (action === 'saveInvoice') {
      result = saveInvoice(data);
    } else if (action === 'deleteInvoice') {
      result = deleteInvoice(data);
    } else if (action === 'saveSettings') {
      result = saveSettings(data);
    } else if (action === 'saveCreditor') {
      result = saveCreditor(data);
    } else if (action === 'deleteCreditor') {
      result = deleteCreditor(data);
    } else if (action === 'saveExpense') {
      result = saveExpense(data);
    } else if (action === 'deleteExpense') {
      result = deleteExpense(data);
    } else if (action === 'saveCashRecord') {
      result = saveCashRecord(data);
    } else if (action === 'saveCashRegister') {
      result = saveCashRegister(data);
    } else {
      result = { success: false, error: 'Unknown action: ' + action };
    }
    
    return jsonOutput(result, callback);
  } catch (err) {
    return jsonOutput({ success: false, error: err.toString() }, '');
  }
}

// ---------- Helper Functions ----------
function parsePayload(e) {
  if (!e) throw new Error('Request event is missing');

  const contents = e.postData && e.postData.contents;
  if (contents) {
    const contentType = String(e.postData.type || '').toLowerCase();
    if (contentType.indexOf('application/json') !== -1) {
      return parseObjectPayload(contents, 'JSON request body');
    }
  }

  const params = e.parameter || {};
  const encodedPayload = params.payload || params.data;
  if (encodedPayload) {
    const payload = parseObjectPayload(encodedPayload, 'form payload');
    if (!payload.action && params.action) payload.action = params.action;
    return payload;
  }

  if (contents) return parseObjectPayload(contents, 'request body');
  if (params.action) return Object.assign({}, params);
  throw new Error('Request payload is empty');
}

function parseObjectPayload(value, label) {
  let payload;
  try {
    payload = typeof value === 'string' ? JSON.parse(value) : value;
  } catch (err) {
    throw new Error('Invalid ' + label + ': ' + err.message);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(label + ' must be a JSON object');
  }
  return payload;
}

function jsonOutput(obj, callback) {
  if (callback) {
    if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(callback)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Invalid JSONP callback'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Invoice No', 'Date', 'Customer Name', 'Phone', 'Items', 'Subtotal', 'Discount', 'Total', 'Cost Total', 'Notes', 'Saved At']);
  }
  return sheet;
}

function getSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS_SHEET_NAME);
    sheet.appendRow(['Key', 'Value']);
  }
  return sheet;
}

function getCreditorsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CREDITORS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CREDITORS_SHEET_NAME);
    sheet.appendRow(['ID', 'Name', 'Taken', 'Paid', 'Due', 'Date', 'Saved At']);
  }
  return sheet;
}

function getExpensesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EXPENSES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(EXPENSES_SHEET_NAME);
    sheet.appendRow(['ID', 'Category', 'Amount', 'Source', 'Source Label', 'Date', 'Saved At']);
  }
  return sheet;
}

function getCashSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CASH_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CASH_SHEET_NAME);
    sheet.appendRow(['ID', 'Date', 'Cash Total', 'Digital Total', 'Grand Total', 'Denominations', 'Balances', 'Saved At']);
  }
  return sheet;
}

function findRowById(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(id).trim()) {
      return i + 1;
    }
  }
  return 0;
}

// ---------- Invoice Functions ----------
function saveInvoice(data) {
  const sheet = getSheet();
  const invoice = data.invoice || data.data;
  if (!invoice || typeof invoice !== 'object' || !invoice.id) {
    throw new Error('Invoice data with an ID is required');
  }

  const items = parseInvoiceItems(invoice.items);
  const subtotal = items.reduce(function (sum, item) {
    return sum + item.total;
  }, 0);
  const discount = finiteNumber(invoice.discount, 0);
  const total = Math.max(0, subtotal - discount);
  const costTotal = items.reduce(function (sum, item) {
    return sum + item.costPrice * item.qty;
  }, 0);
  
  const existingRow = findRowById(sheet, invoice.id);
  
  const row = [
    invoice.id,
    invoice.invoiceNo || '',
    invoice.date || new Date().toISOString(),
    invoice.customer || invoice.customerName || '',
    invoice.phone || '',
    JSON.stringify(items),
    subtotal,
    discount,
    total,
    costTotal,
    invoice.notes || '',
    new Date().toISOString()
  ];
  
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  SpreadsheetApp.flush();
  
  const verifyRow = findRowById(getSheet(), invoice.id);
  return { 
    success: verifyRow > 0, 
    id: invoice.id, 
    verified: verifyRow > 0 ? true : false 
  };
}

function deleteInvoice(data) {
  const sheet = getSheet();
  const row = findRowById(sheet, data.id);
  if (row > 0) sheet.deleteRow(row);
  if (row > 0) SpreadsheetApp.flush();

  const verifySalesRow = findRowById(getSheet(), data.id);
  return {
    success: verifySalesRow === 0,
    deleted: data.id
  };
}

function listInvoices(e) {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const invoices = [];
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (row[0]) {
      const inv = {};
      for (let j = 0; j < headers.length; j++) {
        inv[headers[j]] = row[j];
      }
      invoices.push(inv);
    }
  }
  
  return { success: true, invoices: invoices };
}

function getAllInvoices(result) {
  const data = result.invoices.map(function (row) {
    const items = parseInvoiceItems(row.Items);
    const subtotalFromItems = items.reduce(function (sum, item) {
      return sum + item.total;
    }, 0);
    const savedSubtotal = finiteNumber(row.Subtotal, 0);
    const subtotal = items.length ? subtotalFromItems : savedSubtotal;
    const discount = finiteNumber(row.Discount, 0);
    const calculatedTotal = Math.max(0, subtotal - discount);
    const calculatedCost = items.reduce(function (sum, item) {
      return sum + item.costPrice * item.qty;
    }, 0);
    const savedCost = finiteNumber(row['Cost Total'], 0);
    return {
      id: row.ID,
      invoiceNo: row['Invoice No'],
      date: row.Date,
      customerName: row['Customer Name'],
      phone: row.Phone,
      items: items,
      subtotal: subtotal,
      discount: discount,
      total: calculatedTotal,
      costTotal: calculatedCost || savedCost,
      notes: row.Notes
    };
  });
  const nextNumber = data.reduce(function (maximum, invoice) {
    const match = String(invoice.invoiceNo || '').match(/(\d+)$/);
    return match ? Math.max(maximum, Number(match[1]) + 1) : maximum;
  }, 1);
  return { success: true, data: data, nextNumber: nextNumber };
}

function finiteNumber(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return isFinite(number) ? number : fallback;
}

function parseInvoiceItems(value) {
  let items = value;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch (err) {
      throw new Error('Invoice items must contain valid JSON: ' + err.message);
    }
  }
  if (!Array.isArray(items)) {
    throw new Error('Invoice items must be an array');
  }
  return items.map(function (item) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invoice item must be an object');
    }
    const qty = finiteNumber(item.qty, 0);
    const price = finiteNumber(item.price, 0);
    return {
      name: String(item.name || ''),
      qty: qty,
      price: price,
      costPrice: finiteNumber(item.costPrice, 0),
      total: qty * price
    };
  });
}

// ---------- Settings Functions ----------
function saveSettings(data) {
  const sheet = getSettingsSheet();
  const settings = data.settings || {};
  
  const existing = {};
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0]) {
      existing[String(values[i][0]).trim()] = values[i][1];
    }
  }
  
  const merged = Object.assign({}, existing, settings);
  
  sheet.clear();
  sheet.appendRow(['Key', 'Value']);
  
  for (const key in merged) {
    let value = merged[key];
    if (typeof value !== 'string') {
      value = JSON.stringify(value);
    }
    sheet.appendRow([key, value]);
  }
  
  SpreadsheetApp.flush();
  
  const verifyValues = getSettingsSheet().getDataRange().getValues();
  let allFound = true;
  for (const key in settings) {
    let found = false;
    for (let i = 1; i < verifyValues.length; i++) {
      if (String(verifyValues[i][0]).trim() === String(key).trim()) {
        found = true;
        break;
      }
    }
    if (!found) allFound = false;
  }
  
  return { success: allFound, verified: allFound };
}

function getSettingsData(e) {
  const sheet = getSettingsSheet();
  const values = sheet.getDataRange().getValues();
  const settings = {};
  
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim();
    if (key) {
      settings[key] = values[i][1];
    }
  }
  
  return { success: true, settings: settings };
}

function verifySettings(e) {
  const sheet = getSettingsSheet();
  const values = sheet.getDataRange().getValues();
  const keysToCheck = ((e && e.parameter && e.parameter.keys) || '').split(',').filter(k => k);
  
  const found = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim();
    if (keysToCheck.indexOf(key) >= 0) {
      found[key] = true;
    }
  }
  
  const missing = keysToCheck.filter(k => !found[k]);
  return { success: missing.length === 0, missing: missing };
}

// ---------- Creditors Functions ----------
function saveCreditor(data) {
  const sheet = getCreditorsSheet();
  const creditor = data.creditor;
  if (!creditor || typeof creditor !== 'object' || !creditor.id) {
    throw new Error('Creditor data with an ID is required');
  }
  
  const row = [
    creditor.id,
    creditor.name,
    creditor.taken || 0,
    creditor.paid || 0,
    creditor.due || 0,
    creditor.date || new Date().toISOString().slice(0, 10),
    new Date().toISOString()
  ];
  
  const existingRow = findRowById(sheet, creditor.id);
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  
  SpreadsheetApp.flush();
  
  const verifyRow = findRowById(getCreditorsSheet(), creditor.id);
  return { success: verifyRow > 0, id: creditor.id };
}

function deleteCreditor(data) {
  const sheet = getCreditorsSheet();
  const row = findRowById(sheet, data.id);
  if (row > 0) {
    sheet.deleteRow(row);
    SpreadsheetApp.flush();
    return { success: findRowById(getCreditorsSheet(), data.id) === 0 };
  }
  return { success: false, error: 'Not found' };
}

function listCreditors(e) {
  const sheet = getCreditorsSheet();
  const values = sheet.getDataRange().getValues();
  const creditors = [];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0]) {
      creditors.push({
        id: values[i][0],
        name: values[i][1],
        taken: values[i][2],
        paid: values[i][3],
        due: values[i][4],
        date: values[i][5]
      });
    }
  }
  
  return { success: true, creditors: creditors };
}

// ---------- Expenses Functions ----------
function saveExpense(data) {
  const sheet = getExpensesSheet();
  const expense = data.expense;
  if (!expense || typeof expense !== 'object' || !expense.id) {
    throw new Error('Expense data with an ID is required');
  }
  
  const row = [
    expense.id,
    expense.category,
    expense.amount,
    expense.source,
    expense.sourceLabel || '',
    expense.date || new Date().toISOString().slice(0, 10),
    new Date().toISOString()
  ];
  
  const existingRow = findRowById(sheet, expense.id);
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  
  SpreadsheetApp.flush();
  
  const verifyRow = findRowById(getExpensesSheet(), expense.id);
  return { success: verifyRow > 0, id: expense.id };
}

function deleteExpense(data) {
  const sheet = getExpensesSheet();
  const row = findRowById(sheet, data.id);
  if (row > 0) {
    sheet.deleteRow(row);
    SpreadsheetApp.flush();
    return { success: findRowById(getExpensesSheet(), data.id) === 0 };
  }
  return { success: false, error: 'Not found' };
}

function listExpenses(e) {
  const sheet = getExpensesSheet();
  const values = sheet.getDataRange().getValues();
  const expenses = [];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0]) {
      expenses.push({
        id: values[i][0],
        category: values[i][1],
        amount: values[i][2],
        source: values[i][3],
        sourceLabel: values[i][4],
        date: values[i][5]
      });
    }
  }
  
  return { success: true, expenses: expenses };
}

// ---------- Cash Register Functions ----------
function saveCashRecord(data) {
  const sheet = getCashSheet();
  const record = data.record || data.cashRegister;
  if (!record || typeof record !== 'object' || !record.id) {
    throw new Error('Cash register data with an ID is required');
  }
  
  const row = [
    record.id,
    record.date,
    record.cashTotal || 0,
    record.digitalTotal || 0,
    record.grandTotal || 0,
    JSON.stringify(record.denominations || {}),
    JSON.stringify(record.balances || {}),
    new Date().toISOString()
  ];
  
  const existingRow = findRowById(sheet, record.id);
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  
  SpreadsheetApp.flush();
  
  const verifyRow = findRowById(getCashSheet(), record.id);
  return { success: verifyRow > 0, id: record.id };
}

function saveCashRegister(data) {
  return saveCashRecord(data);
}

function listCashRecords(e) {
  const sheet = getCashSheet();
  const values = sheet.getDataRange().getValues();
  const records = [];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0]) {
      let denom = {}, balances = {};
      try { denom = JSON.parse(values[i][5]) || {}; } catch(err) {}
      try { balances = JSON.parse(values[i][6]) || {}; } catch(err) {}
      
      records.push({
        id: values[i][0],
        date: values[i][1],
        cashTotal: values[i][2],
        digitalTotal: values[i][3],
        grandTotal: values[i][4],
        denominations: denom,
        balances: balances
      });
    }
  }
  
  return { success: true, records: records };
}

// ---------- Verification Actions ----------
function verifyRecord(e) {
  const params = (e && e.parameter) || {};
  const kind = params.kind || '';
  const id = params.id || '';
  
  let sheet;
  if (kind === 'creditor') sheet = getCreditorsSheet();
  else if (kind === 'expense') sheet = getExpensesSheet();
  else if (kind === 'cash') sheet = getCashSheet();
  else return { success: false, error: 'Unknown kind' };
  
  const row = findRowById(sheet, id);
  return { success: row > 0, found: row > 0 };
}

function verifyInvoice(e) {
  const id = (e && e.parameter && e.parameter.id) || '';
  const inSales = findRowById(getSheet(), id) > 0;
  return { success: inSales, inSales: inSales };
}

function verifyDelete(e) {
  const id = (e && e.parameter && e.parameter.id) || '';
  const inSales = findRowById(getSheet(), id) > 0;
  return { success: !inSales, inSales: inSales };
}

function verifyRecordGone(e) {
  const params = (e && e.parameter) || {};
  const kind = params.kind || '';
  const id = params.id || '';
  
  let sheet;
  if (kind === 'creditor') sheet = getCreditorsSheet();
  else if (kind === 'expense') sheet = getExpensesSheet();
  else if (kind === 'cash') sheet = getCashSheet();
  else return { success: false, error: 'Unknown kind' };
  
  const row = findRowById(sheet, id);
  return { success: row === 0, gone: row === 0 };
}

function testConnection() {
  try {
    const sheet = getSheet();
    return { success: true, message: 'Connection OK', sheetName: sheet.getName() };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}