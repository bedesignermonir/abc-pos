const SHEET_NAME = 'Sheet1'; // আপনার শিটের নাম
const SETTINGS_SHEET_NAME = 'Settings'; // সেটিংস শিটের নাম

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  try {
    const action = e.parameter.action || 'getAll';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    // শিট না থাকলে অটো তৈরি করবে
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['ID', 'Invoice No', 'Date', 'Customer', 'Phone', 'Items', 'Subtotal', 'Discount', 'Total']);
    }

    if (action === 'test') {
      const data = sheet.getDataRange().getValues();
      return createJsonResponse({
        success: true,
        message: 'সংযোগ সফল',
        count: Math.max(0, data.length - 1)
      });
    }

    if (action === 'getAll' || action === 'searchReceiptFromSheet' || action === 'search') {
      const data = sheet.getDataRange().getValues();

      if (data.length <= 1) {
        return createJsonResponse({
          success: true,
          data: [],
          nextNumber: 1,
          settings: getSettings()
        });
      }

      const invoices = [];
      let maxNum = 0;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0] && !row[1]) continue; // খালি সারি বাদ

        const rawItems = row[5];
        let items = [];
        let itemsSummary = '';

        if (typeof rawItems === 'string' && rawItems.trim().indexOf('[') === 0) {
          items = safeJsonParse(rawItems, []);
        } else {
          itemsSummary = String(rawItems || '');
        }

        const inv = {
          id: row[0],
          invoiceNo: row[1],
          date: row[2],
          customer: row[3],
          phone: row[4],
          items: items,
          itemsSummary: itemsSummary,
          subtotal: row[6],
          discount: row[7],
          total: row[8]
        };
        invoices.push(inv);

        const match = String(row[1] || '').match(/ABC-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }

      return createJsonResponse({
        success: true,
        data: invoices,
        nextNumber: maxNum + 1,
        settings: getSettings()
      });
    }

    if (action === 'filterByMonth' || action === 'filterInvoicesByMonth') {
      const month = e.parameter.month; // Format e.g. "2026-08"
      const data = sheet.getDataRange().getValues();

      if (data.length <= 1) {
        return createJsonResponse({
          success: true,
          data: [],
          nextNumber: 1,
          settings: getSettings()
        });
      }

      const invoices = [];
      let maxNum = 0;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0] && !row[1]) continue;

        const dateVal = row[2];
        let dateStr = "";
        
        if (dateVal instanceof Date) {
          dateStr = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          dateStr = String(dateVal || '');
        }

        const rawItems = row[5];
        let items = [];
        let itemsSummary = '';

        if (typeof rawItems === 'string' && rawItems.trim().indexOf('[') === 0) {
          items = safeJsonParse(rawItems, []);
        } else {
          itemsSummary = String(rawItems || '');
        }
        
        const inv = {
          id: row[0],
          invoiceNo: row[1],
          date: row[2],
          customer: row[3],
          phone: row[4],
          items: items,
          itemsSummary: itemsSummary,
          subtotal: row[6],
          discount: row[7],
          total: row[8]
        };

        const match = String(row[1] || '').match(/ABC-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }

        if (!month || dateStr.indexOf(month) !== -1) {
          invoices.push(inv);
        }
      }

      return createJsonResponse({
        success: true,
        data: invoices,
        nextNumber: maxNum + 1,
        settings: getSettings()
      });
    }

    return createJsonResponse({
      success: false,
      message: 'অজানা action: ' + action
    });

  } catch (error) {
    return createJsonResponse({
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

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['ID', 'Invoice No', 'Date', 'Customer', 'Phone', 'Items', 'Subtotal', 'Discount', 'Total']);
    }

    if (action === 'saveSettings') {
      const presetItems = data.presetItems;
      let settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
      if (!settingsSheet) {
        settingsSheet = ss.insertSheet(SETTINGS_SHEET_NAME);
        settingsSheet.appendRow(['Setting Name', 'Value']);
      }
      
      const dataRange = settingsSheet.getDataRange();
      const values = dataRange.getValues();
      let foundIndex = -1;
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === 'presetItems') {
          foundIndex = i + 1;
          break;
        }
      }
      
      if (foundIndex !== -1) {
        settingsSheet.getRange(foundIndex, 2).setValue(presetItems);
      } else {
        settingsSheet.appendRow(['presetItems', presetItems]);
      }
      
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

      sheet.appendRow([
        inv.id || new Date().getTime(),
        inv.invoiceNo || '',
        inv.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
        inv.customer || '',
        inv.phone || '',
        itemsSummary,
        inv.subtotal || 0,
        inv.discount || 0,
        inv.total || 0
      ]);

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

      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      let deleted = false;

      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(id)) {
          sheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }

      if (deleted) {
        return createJsonResponse({
          success: true,
          message: 'মুছে ফেলা হয়েছে'
        });
      } else {
        return createJsonResponse({
          success: false,
          message: 'ইনভয়েস খুঁজে পাওয়া যায়নি'
        });
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

function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS_SHEET_NAME);
    sheet.appendRow(['Setting Name', 'Value']);
    sheet.appendRow(['presetItems', 'Photocopy\nছবি তোলা\nকম্পিউটার ট্রেনিং\nগ্রাফিক ডিজাইন\nটাইপিং\nওয়েব ডিজাইন\nআইনি সহায়তা']);
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