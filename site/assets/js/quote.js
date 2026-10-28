// Sends quote requests through Web3Forms (https://web3forms.com), which emails them to the shop inbox.
// Paste the access key from the Web3Forms email below. The key is meant to be public, so it is safe in this file.
// While it is empty, requests fall back to the quote page's "Email my request to Terran" button.
window.BCFQuote = {
  accessKey: '',

  // Sends the summary, stores it for the quote page, then goes there. Never throws.
  submit: function (summary, button) {
    var go = function (sent) {
      summary.sent = sent;
      try { sessionStorage.setItem('bcf-quote', JSON.stringify(summary)); } catch (e) { /* page still works */ }
      location.href = '/quote-sent';
    };
    if (!this.accessKey) return go(false);
    if (button) { button.disabled = true; button.textContent = 'Sending…'; }
    var body = Object.assign({
      access_key: this.accessKey,
      subject: 'Quote request: ' + (summary.number || summary.property || summary.type),
      from_name: 'Marks Metal Signs website',
      replyto: summary.email
    }, summary);
    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); })
      .then(function (j) { go(!!j.success); })
      .catch(function () { go(false); });
  }
};
