// ============================================
// ABC Computer POS - Robust Backend v4
// Fixed: Connection errors, CORS handling, Write verification
// ============================================

const SHEET_NAME = 'Sales';
const PROFIT_SHEET_NAME = 'Profit Sharing';
const SETTINGS_SHEET_NAME = 'Settings';
const CREDITORS_SHEET_NAME = 'Creditors';
const EXPENSES_SHEET_NAME = 'Expenses';
const CASH_SHEET_NAME = 'CashRegister';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  const callback = (e && e.parameter && e.parameter.callback) || '';
  
  let result;
  
  try {
    if (action === 'list') {
      result = listInvoices(e);
    } else if (action === 'getSettings') {
      result = getSettingsData(e);
    } else if (action === 'test') {
      result = testConnection();
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
    // Robust payload parsing
    const data = parsePayload(e);
    const action = data.action || '';
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
  try {
    if (e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.data) {
      return JSON.parse(decodeURIComponent(e.parameter.data));
    }
  } catch (err) {}
  return {};
}

function jsonOutput(obj, callback) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(obj) + ')');
  }
  return output;
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

function getProfitSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PROFIT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PROFIT_SHEET_NAME);
    sheet.appendRow(['Invoice ID', 'Invoice No', 'Date', 'Total Sale', 'Total Cost', 'Net Profit', 'Saved At']);
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
  const invoice = data.invoice;
  
  const existingRow = findRowById(sheet, invoice.id);
  
  const row = [
    invoice.id,
    invoice.invoiceNo,
    invoice.date,
    invoice.customerName,
    invoice.phone,
    JSON.stringify(invoice.items),
    invoice.subtotal,
    invoice.discount,
    invoice.total,
    invoice.costTotal || 0,
    invoice.notes || '',
    new Date().toISOString()
  ];
  
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  
  const profitSheet = getProfitSheet();
  const costTotal = parseFloat(invoice.costTotal) || 0;
  const totalSale = parseFloat(invoice.total) || 0;
  const netProfit = totalSale - costTotal;
  
  const profitRow = [
    invoice.id,
    invoice.invoiceNo,
    invoice.date,
    totalSale,
    costTotal,
    netProfit,
    new Date().toISOString()
  ];
  
  const existingProfitRow = findRowById(profitSheet, invoice.id);
  if (existingProfitRow > 0) {
    profitSheet.getRange(existingProfitRow, 1, 1, profitRow.length).setValues([profitRow]);
  } else {
    profitSheet.appendRow(profitRow);
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
  if (row > 0) {
    sheet.deleteRow(row);
    SpreadsheetApp.flush();
    const verifyRow = findRowById(getSheet(), data.id);
    return { success: verifyRow === 0, deleted: data.id };
  }
  return { success: false, error: 'Not found' };
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
  const keysToCheck = (e.parameter.keys || '').split(',').filter(k => k);
  
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
  const record = data.record;
  
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
  const kind = e.parameter.kind || '';
  const id = e.parameter.id || '';
  
  let sheet;
  if (kind === 'creditor') sheet = getCreditorsSheet();
  else if (kind === 'expense') sheet = getExpensesSheet();
  else if (kind === 'cash') sheet = getCashSheet();
  else return { success: false, error: 'Unknown kind' };
  
  const row = findRowById(sheet, id);
  return { success: row > 0, found: row > 0 };
}

function verifyRecordGone(e) {
  const kind = e.parameter.kind || '';
  const id = e.parameter.id || '';
  
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