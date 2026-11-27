// Sends quote and custom requests to the shop's client list: a Google Sheet whose script (crm/Code.gs) adds a row,
// emails the shop a PDF quote and emails the customer their copy. The script's web app link lives in /settings.js (crmUrl).
// Sent: the form is replaced by a short confirmation right where it was.
// Not sent (no link yet, or Google can't be reached): the quote page shows the "Email my request" button instead.
var BCF_PAGE_START = Date.now(); // the client list turns away forms sent faster than a person could fill them in
window.BCFQuote = {
  crmUrl: (window.MMS_SETTINGS && window.MMS_SETTINGS.crmUrl) || '',

  // Sends the summary. Never throws.
  submit: function (summary, button) {
    var fallback = function () {
      summary.sent = false;
      try { sessionStorage.setItem('bcf-quote', JSON.stringify(summary)); } catch (e) { /* page still works */ }
      location.href = '/quote-sent';
    };
    if (!this.crmUrl) return fallback();
    if (button) { button.disabled = true; button.textContent = 'Sending…'; }
    var hp = document.getElementById('hp'); // hidden field only bots fill in
    var body = Object.assign({ website: hp ? hp.value : '', t: Date.now() - BCF_PAGE_START }, summary);
    // Plain text keeps it a "simple" request, which Google's web apps accept from any website.
    fetch(this.crmUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.ok) BCFQuote.showSent(button && button.form, summary); else fallback(); })
      .catch(fallback);
  },

  // Swaps the form for "Request sent" in place, so there's no extra page to click through.
  showSent: function (form, summary) {
    if (!form) return;
    var box = document.createElement('div');
    box.className = 'sent-ok';
    box.setAttribute('role', 'status');
    box.tabIndex = -1;
    var h = document.createElement('h3');
    h.textContent = 'Request sent';
    var p = document.createElement('p');
    p.textContent = summary.type === 'Custom inquiry'
      ? 'We emailed a confirmation to ' + summary.email + '. We read every request and reply by email with ideas and a price.'
      : 'We emailed a copy of your quote to ' + summary.email + '. Every design is reviewed and we reply by email with a final price. Nothing is cut until you approve it.';
    var again = document.createElement('a');
    again.href = location.pathname;
    again.className = 'link';
    again.textContent = 'Start another request';
    box.append(h, p, again);
    form.replaceWith(box);
    box.focus();
  }
};
