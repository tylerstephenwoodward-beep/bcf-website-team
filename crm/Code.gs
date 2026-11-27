/**
 * Marks Metal Signs: client list.
 *
 * The website sends every quote request (Design your sign) and custom request (Custom work) here.
 * Each one becomes a row in the "Leads" tab and an email to the shop. Sale made and Paid are
 * checkboxes filled in by hand; a checked box turns green.
 *
 * Setup steps: crm/README.md.
 */

const CONFIG = {
  notifyEmail: 'browncountyforge@gmail.com', // who gets an email (with the PDF quote) for each new request
  businessName: 'Marks Metal Signs',
  sendCustomerCopy: true, // also email the customer their PDF quote (sign details and price only)
  sheetName: 'Leads',
  // Spam limits. A real customer never comes close; a bot hammering the link gets turned away.
  perEmailPer10Min: 3,  // requests from one email address in 10 minutes
  perHour: 30,          // requests from everyone together in one hour
  minSeconds: 3         // a person takes longer than this to fill in the form; bots don't
};

// The website's prices (site/assets/js/pricing.js). The sheet shows the price worked out here from what
// they picked, never a price sent by the browser, so nobody can submit a fake one.
// If the prices change on the website, change them here too.
const PRICES = { home: 69.95, perDoor: 59.95, looseEach: 24.95, black: 20 };

// [column name, field from the website ('' = filled in by hand), width in px]
const COLUMNS = [
  ['Received', 'received', 140],
  ['Quote #', 'quoteId', 95],
  ['Type', 'type', 90],
  ['Name', 'name', 150],
  ['Email', 'email', 200],
  ['Phone', 'phone', 120],
  ['Property', 'property', 170],
  ['Sign number', 'number', 100],
  ['Unit numbers', 'units', 160],
  ['Doors', 'doors', 60],
  ['Style', 'style', 110],
  ['Orientation', 'orientation', 95],
  ['Size', 'size', 65],
  ['Font', 'font', 110],
  ['Finish', 'finish', 130],
  ['Price shown', 'price', 150],
  ['Notes', 'notes', 240],
  ['Their design', 'idea', 260],
  ['Their questions', 'questions', 220],
  ['Sale made', '', 85],
  ['Paid', '', 60],
  ["Terran's notes", '', 240]
];
const TYPES = { 'Home sign': 'Home', 'Property order': 'Property', 'Custom inquiry': 'Custom' };
const TYPE_COLORS = { Home: '#fff2c4', Property: '#dbe9f7', Custom: '#e6dcf5' };
const FIRST_ROW = 2; // row 1 is the column names
// Helper names end in _ so the editor's Run menu only lists setup and testRequest.
const col_ = (name) => COLUMNS.findIndex((c) => c[0] === name) + 1;

/** Run once from the Apps Script editor. Safe to run again: it only redoes the formatting, never deletes rows. */
function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sh = book.getSheetByName(CONFIG.sheetName) || book.insertSheet(CONFIG.sheetName, 0);
  const n = COLUMNS.length, rows = sh.getMaxRows() - 1;

  sh.getRange(1, 1, 1, n).setValues([COLUMNS.map((c) => c[0])])
    .setBackground('#141311').setFontColor('#f3f0ea').setFontWeight('bold').setVerticalAlignment('middle');
  sh.setRowHeight(1, 32);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(3); // Received, Type and Name stay in view while scrolling right
  COLUMNS.forEach((c, i) => sh.setColumnWidth(i + 1, c[2]));
  sh.getRange(FIRST_ROW, 1, rows, n).setVerticalAlignment('top').setWrap(true);
  sh.getRange(FIRST_ROW, col_('Received'), rows, 1).setNumberFormat('mmm d, yyyy h:mm am/pm');
  sh.getRange(FIRST_ROW, col_('Sale made'), rows, 3).setBackground('#fbfaf7'); // the columns Terran fills in

  const rules = [];
  ['Sale made', 'Paid'].forEach((name) => {
    const r = sh.getRange(FIRST_ROW, col_(name), rows, 1);
    r.insertCheckboxes().setHorizontalAlignment('center');
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=' + letter_(col_(name)) + FIRST_ROW + '=TRUE')
      .setBackground('#b7e1cd').setFontColor('#0d652d').setRanges([r]).build());
  });
  const type = sh.getRange(FIRST_ROW, col_('Type'), rows, 1);
  Object.keys(TYPE_COLORS).forEach((t) => {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(t).setBackground(TYPE_COLORS[t]).setBold(true).setRanges([type]).build());
  });
  sh.setConditionalFormatRules(rules);

  if (book.getName() === 'Untitled spreadsheet') book.rename('Marks Metal Signs Clients');
  return 'Setup done';
}

/** The website posts each request here (Deploy -> Web app). Returns {ok: true} once it's saved. */
function doPost(e) {
  let data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return reply_(false, 'bad request'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return reply_(false, 'bad request');
  if (data.website) return reply_(true); // hidden field only bots fill in: ignore quietly
  // Sent faster than a person could type: a bot. Pretend it worked so it doesn't try harder.
  if (!(Number(data.t) >= CONFIG.minSeconds * 1000)) return reply_(true);

  const req = check_(data);
  if (req.error) return reply_(false, req.error);

  // Spam limits, and the same request sent twice (a double click) only counts once.
  const cache = CacheService.getScriptCache();
  const dupKey = 'dup:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(req)));
  if (cache.get(dupKey)) return reply_(true);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const emailKey = 'email:' + req.email.toLowerCase(), hourKey = 'hour:' + new Date().toISOString().slice(0, 13);
    const byEmail = Number(cache.get(emailKey) || 0), thisHour = Number(cache.get(hourKey) || 0);
    if (byEmail >= CONFIG.perEmailPer10Min || thisHour >= CONFIG.perHour) return reply_(false, 'too many requests, try again later');
    cache.put(emailKey, String(byEmail + 1), 600);
    cache.put(hourKey, String(thisHour + 1), 3600);
    cache.put(dupKey, '1', 600);

    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book.getSheetByName(CONFIG.sheetName)) setup(); // first request builds the tab if setup was skipped
    const sh = book.getSheetByName(CONFIG.sheetName);
    // The first row with no "Received" date. (The checkboxes fill every row, so Google's own
    // "last row" would always be the bottom of the sheet.)
    const dates = sh.getRange(FIRST_ROW, 1, sh.getMaxRows() - FIRST_ROW + 1, 1).getValues();
    let r = FIRST_ROW + dates.findIndex((d) => d[0] === '');
    if (r < FIRST_ROW) { // every row is used: add 200 more, with their checkboxes
      r = sh.getMaxRows() + 1;
      sh.insertRowsAfter(sh.getMaxRows(), 200);
      ['Sale made', 'Paid'].forEach((name) => sh.getRange(r, col_(name), 200, 1).insertCheckboxes());
    }
    req.quoteId = 'MMS-' + String(r - FIRST_ROW + 1).padStart(4, '0'); // one number per row, never reused
    // Fill only the request columns; Sale made, Paid and Terran's notes are left alone.
    const row = COLUMNS.slice(0, col_('Sale made') - 1).map((c) => c[1] === 'received' ? new Date() : cell_(req[c[1]]));
    sh.getRange(r, 1, 1, row.length).setValues([row]);
  } finally {
    lock.releaseLock();
  }

  try {
    // To the shop: everything they entered, with the PDF quote attached.
    const lines = COLUMNS.filter((c) => c[1] && c[1] !== 'received' && req[c[1]]).map((c) => c[0] + ': ' + req[c[1]]);
    MailApp.sendEmail({
      to: CONFIG.notifyEmail,
      replyTo: req.email,
      name: CONFIG.businessName + ' website',
      subject: oneLine_('New ' + req.type.toLowerCase() + ' request ' + req.quoteId + ': ' + req.name),
      body: lines.join('\n') + '\n\nReply to this email to answer them directly.\nClient list: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
      attachments: [quotePdf_(req, true)]
    });
  } catch (err) {
    // The row is saved even if the email fails (for example, the daily email limit).
  }
  try {
    // To the customer: their quote number, and for a sign, a PDF of the sign details and price.
    // Nothing they typed is in it, so the form can't be used to send other people messages.
    if (CONFIG.sendCustomerCopy) {
      const sign = req.type !== 'Custom';
      MailApp.sendEmail({
        to: req.email,
        replyTo: CONFIG.notifyEmail,
        name: CONFIG.businessName,
        subject: 'Your ' + CONFIG.businessName + ' ' + (sign ? 'quote ' : 'request ') + req.quoteId,
        body: 'Thanks for your ' + (sign ? 'quote request' : 'custom request') + '. ' + (sign ? 'Your quote ' + req.quoteId + ' is attached.' : 'Your request number is ' + req.quoteId + '.') +
          '\n\nWe review every design and reply by email with a final price. Nothing is cut until you approve it.' +
          '\n\nQuestions? Just reply to this email.\n\n' + CONFIG.businessName,
        attachments: sign ? [quotePdf_(req, false)] : []
      });
    }
  } catch (err) {
    // Saved either way.
  }
  return reply_(true);
}

/**
 * Checks a request field by field and returns only what the sheet keeps, or {error}.
 * Choices must be ones the website offers; free text is trimmed, length-capped and stripped of
 * hidden control characters. Anything else the browser sent is ignored.
 */
function check_(d) {
  const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '').trim().slice(0, max);
  const pick = (v, list) => list.indexOf(String(v)) >= 0 ? String(v) : null;
  const type = TYPES[d.type];
  if (!type) return { error: 'unknown request type' };
  const r = { type: type, name: oneLine_(text(d.name, 100)), email: text(d.email, 254), phone: oneLine_(text(d.phone, 40)) };
  if (!r.name) return { error: 'missing name' };
  if (!/^[^\s@,;<>"']+@[^\s@,;<>"']+\.[A-Za-z]{2,}$/.test(r.email)) return { error: 'bad email' };
  if (r.phone && !/^[0-9 +().\-x]+$/i.test(r.phone)) return { error: 'bad phone' };

  if (type === 'Custom') {
    r.idea = text(d.idea, 3000);
    r.questions = text(d.questions, 2000);
    if (!r.idea) return { error: 'missing design' };
    return r;
  }

  // A sign from the design tool: every choice must be one the website offers.
  r.number = text(d.number, 6);
  if (!/^[0-9A-Za-z -]{1,6}$/.test(r.number)) return { error: 'bad sign number' };
  r.style = pick(d.style, ['Cut plate', 'Numbers on a bar', 'Loose numbers']);
  r.orientation = pick(d.orientation, ['Horizontal', 'Vertical']);
  r.size = pick(d.size, ['4 inch', '6 inch']);
  r.font = pick(d.font, ['Futura', 'Helvetica', 'Besley', 'Custom font (quoted separately)']);
  r.finish = pick(d.finish, ['Brushed stainless', 'Black powder coat']);
  if (!r.style || !r.orientation || !r.size || !r.font || !r.finish) return { error: 'unknown choice' };
  r.notes = text(d.notes, 2000);
  if (type === 'Property') {
    const doors = Number(d.doors);
    if (!(Number.isInteger(doors) && doors >= 2 && doors <= 5000)) return { error: 'bad door count' };
    r.doors = String(doors);
    r.property = oneLine_(text(d.property, 150));
    r.units = text(d.units, 500);
    const addons = String(d.addons || '').split(',').map((a) => a.trim())
      .filter((a) => ['Building entry signs', 'Carport signs', 'Directional signs', 'Monument sign', 'Gatehouse sign'].indexOf(a) >= 0);
    if (addons.length) r.notes = [r.notes, 'Also wants: ' + addons.join(', ')].filter(Boolean).join('\n');
  }
  r.price = price_(r, type === 'Property' ? Number(r.doors) : 1);
  return r;
}

/** The price for what they picked, worked out the same way as the website. */
function price_(r, doors) {
  if (r.font.indexOf('Custom') === 0) return 'Quoted separately';
  const money = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const black = r.finish === 'Black powder coat' ? PRICES.black : 0;
  const each = r.style === 'Loose numbers'
    ? PRICES.looseEach * r.number.replace(/\s/g, '').length + black
    : (doors > 1 ? PRICES.perDoor : PRICES.home) + black;
  return doors > 1 ? money(each) + ' a door, ' + money(each * doors) + ' total' : money(each);
}

/**
 * The quote as a PDF. full: the shop's copy with everything they entered. Otherwise the customer's copy:
 * only the sign details and price, which all come from fixed choices, never from text they typed.
 */
function quotePdf_(req, full) {
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const shown = ['Type', 'Sign number', 'Doors', 'Style', 'Orientation', 'Size', 'Font', 'Finish', 'Price shown'];
  const rows = COLUMNS.filter((c) => c[1] && c[1] !== 'received' && c[1] !== 'quoteId' && req[c[1]] && (full || shown.indexOf(c[0]) >= 0))
    .map((c) => '<tr' + (c[0] === 'Price shown' ? ' class="price"' : '') + '><th>' + esc(c[0] === 'Price shown' ? 'Price' : c[0]) + '</th><td>' + esc(req[c[1]]).replace(/\n/g, '<br>') + '</td></tr>').join('');
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy');
  const html = '<html><head><style>' +
    'body{font-family:Helvetica,Arial,sans-serif;color:#141311;margin:0}' +
    '.bar{color:#141311;border-bottom:6px solid #ffd23f;padding:18px 28px 12px;font-size:20px;font-weight:bold;letter-spacing:2px}' + // the PDF maker drops background colors, so no dark bar
    'tr.price th,tr.price td{font-weight:bold;color:#141311;font-size:15px}' +
    '.wrap{padding:24px 28px}h1{font-size:22px;margin:0 0 4px}.muted{color:#55524c;font-size:12px}' +
    'table{border-collapse:collapse;width:100%;margin:18px 0}th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #d3cec4;font-size:13px;vertical-align:top}' +
    'th{width:32%;color:#55524c;font-weight:normal}.note{font-size:12px;color:#55524c;margin-top:14px}' +
    '</style></head><body><div class="bar">' + esc(CONFIG.businessName.toUpperCase()) + '</div><div class="wrap">' +
    '<h1>Quote ' + esc(req.quoteId) + '</h1><div class="muted">' + esc(date) + (full ? '' : ' &middot; prepared for your sign request') + '</div>' +
    '<table>' + rows + '</table>' +
    '<p class="note">Every design is reviewed before anything is cut, and we confirm the final price by email. Nothing is cut until you approve it. Custom signs are made to order.</p>' +
    '</div></body></html>';
  return Utilities.newBlob(html, 'text/html', 'quote.html').getAs('application/pdf').setName('Quote ' + req.quoteId + '.pdf');
}

/** What goes in a cell: plain text that can never run as a spreadsheet formula. */
function cell_(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function oneLine_(s) {
  return String(s).replace(/[\r\n]+/g, ' ');
}

/** Opening the web app link in a browser just confirms it's running. */
function doGet() {
  return ContentService.createTextOutput('Marks Metal Signs client list is running.');
}

function reply_(ok, error) {
  return ContentService.createTextOutput(JSON.stringify(ok ? { ok: true } : { ok: false, error: error })).setMimeType(ContentService.MimeType.JSON);
}

function letter_(n) {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Optional: run from the editor to add a test row and send a test email. Delete the row after. */
function testRequest() {
  return doPost({ postData: { contents: JSON.stringify({ t: 5000, type: 'Property order', name: 'Test Person', email: 'test@example.com', property: 'Maple Ridge Apartments', doors: '24', units: '101-112, 201-212', number: '101', style: 'Cut plate', orientation: 'Horizontal', size: '6 inch', font: 'Futura', finish: 'Brushed stainless', perDoor: '$59.95', total: '$1,438.80', notes: 'Test from the Apps Script editor. Delete this row.' }) } }).getContent();
}
