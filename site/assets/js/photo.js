// "See it on your own wall": a pop-up that shows how to take the photo, then takes one from this device or
// from the customer's phone. The phone route shows a QR code for /snap?k=<id>; the phone sends its photo
// straight to this page over WebRTC (PeerJS only introduces the two devices), so the photo is never stored.
import { art, animateArt, loadMotion } from '/assets/js/photo-art.js?v=20261026k';

const $ = (id) => document.getElementById(id);
const dlg = $('photoDlg'), qrBox = $('qr'), qrStatus = $('qrStatus');
const desktop = matchMedia('(hover: hover) and (pointer: fine)').matches;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('photoArt').innerHTML = art;
dlg.dataset.desktop = desktop ? 'yes' : 'no';

async function open() {
  dlg.showModal();
  animateArt(dlg);
  if (desktop) startPhoneLink();
  const m = !still && await loadMotion();
  if (m) m.animate(dlg.querySelector('.pdlg-card'), { opacity: [0, 1], scale: [0.96, 1], y: [12, 0] }, { type: 'spring', stiffness: 380, damping: 30 });
}
function close() { if (dlg.open) dlg.close(); }

$('photoOpen').addEventListener('click', open);
$('photoClose').addEventListener('click', close);
dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); }); // click outside the card

$('photo').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  window.BCFUsePhoto(f);
  e.target.value = '';
  close();
});

// Phone link: made once per visit, the first time the pop-up opens on a computer.
// Outside scripts are pinned and checked against a hash, so a changed file from the CDN is refused.
const load = (src, integrity) => new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = src; s.integrity = integrity; s.crossOrigin = 'anonymous'; s.onload = ok; s.onerror = fail;
  document.head.appendChild(s);
});
const MAX_PHOTO = 15 * 1024 * 1024; // the phone sends about 1 MB; anything far bigger isn't from our page
let peer = null;
function startPhoneLink() {
  if (peer) return;
  qrStatus.textContent = 'Making your code…';
  Promise.all([
    load('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR'),
    load('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', 'sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k')
  ]).then(() => {
    const id = 'bcf-' + crypto.getRandomValues(new Uint32Array(2)).join('-');
    peer = new window.Peer(id);
    peer.on('open', () => {
      const qr = window.qrcode(0, 'M');
      qr.addData(location.origin + '/snap?k=' + encodeURIComponent(id));
      qr.make();
      qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      qrStatus.textContent = 'Scan with your phone camera';
    });
    peer.on('connection', (conn) => {
      conn.on('open', () => { qrStatus.textContent = 'Phone connected. Take your photo.'; });
      conn.on('data', (d) => {
        // Only accept a reasonably sized image: the buffer may arrive as an ArrayBuffer or a typed array.
        const size = d && d.buf && d.buf.byteLength;
        if (!(size > 0 && size <= MAX_PHOTO) || !/^image\/(jpeg|png|webp)$/.test(d.type)) { conn.send('rejected'); return; }
        window.BCFUsePhoto(new Blob([d.buf], { type: d.type }));
        conn.send('ok');
        qrStatus.textContent = 'Got it. Send another any time.';
        close();
      });
    });
    peer.on('error', () => {
      qrStatus.textContent = 'The phone link isn’t working right now. Choose a photo instead.';
      qrBox.innerHTML = '';
      peer.destroy();
      peer = null; // try again the next time the pop-up opens
    });
    addEventListener('pagehide', () => peer.destroy());
  }).catch(() => { qrStatus.textContent = 'The phone link couldn’t load. Choose a photo instead.'; });
}
