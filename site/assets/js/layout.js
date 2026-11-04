// Shared nav and footer, injected so every page stays in sync.
(function () {
  var here = location.pathname.replace(/\/$/, '/index').split('/').pop().replace('.html', '') || 'index';
  // [page, label, href]. Homes and properties both start in the design tool.
  var links = [['design', 'Design your sign'], ['custom', 'Custom work'], ['work', 'Installed work'], ['about', 'About', '/#about']];
  var nav = document.querySelector('[data-nav]');
  if (nav) {
    nav.className = 'nav';
    nav.innerHTML =
      '<div class="wrap">' +
      '<a class="home" href="/" aria-label="Marks Metal Signs home"><span class="wordmark"><b>MARKS</b><span>METAL SIGNS</span></span></a>' +
      '<ul id="nav-links">' + links.map(function (l) {
        var current = here === l[0];
        return '<li><a href="' + (l[2] || '/' + l[0]) + '"' + (current ? ' aria-current="page"' : '') + '>' + l[1] + '</a></li>';
      }).join('') + '</ul>' +
      '<a class="btn" href="/design">Get a quote</a>' +
      '<button class="menu" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav-links">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>' +
      '</div>';
    var btn = nav.querySelector('.menu'), ul = nav.querySelector('ul');
    btn.addEventListener('click', function () {
      var open = ul.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });
  }
  var foot = document.querySelector('[data-footer]');
  if (foot) {
    foot.className = 'footer';
    foot.innerHTML =
      '<div class="wrap">' +
      '<div class="brand"><span class="wordmark lg"><b>MARKS</b><span>METAL SIGNS</span></span>' +
      '<p>Stainless address signs, precision-cut from 11 gauge 304 stainless in Clear Creek, Indiana.</p></div>' +
      '<ul>' + links.map(function (l) { return '<li><a href="' + (l[2] || '/' + l[0]) + '">' + l[1] + '</a></li>'; }).join('') + '</ul>' +
      '<div><p>Clear Creek, Indiana</p><p>browncountyforge@gmail.com</p>' +
      '<p class="fine">© ' + new Date().getFullYear() + ' Marks Metal Signs · <a href="/privacy">Privacy</a> · <a href="/returns">Returns</a></p></div>' +
      '</div>';
  }
})();
