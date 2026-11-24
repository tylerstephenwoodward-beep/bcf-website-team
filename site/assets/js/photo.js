// "See it on your own wall": a pop-up that shows how to take the photo, then lets the visitor pick one.
// The photo never leaves the device: design.js draws it straight from the file (BCFUsePhoto).
import { art, animateArt, loadMotion } from '/assets/js/photo-art.js?v=20261124a';

const $ = (id) => document.getElementById(id);
const dlg = $('photoDlg');
const desktop = matchMedia('(hover: hover) and (pointer: fine)').matches;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('photoArt').innerHTML = art;
dlg.dataset.desktop = desktop ? 'yes' : 'no';

async function open() {
  dlg.showModal();
  animateArt(dlg);
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
