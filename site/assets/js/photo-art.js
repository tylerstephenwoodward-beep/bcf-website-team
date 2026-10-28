// "How to take the photo" picture: a phone's orange flash lighting just the spot by the door where the sign goes.
// Shared by the design page pop-up (photo.js) and the phone page (snap.html). Motion (motion.dev, the vanilla
// version of Framer Motion) pulses the light; without it, or with reduced motion, the picture just sits still.
export const art = `
<svg class="photo-art" viewBox="0 0 480 270" role="img" aria-label="A phone held a few steps back, its light framing the wall beside the front door">
  <defs>
    <linearGradient id="pa-beam" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#f59a4a" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#f59a4a" stop-opacity="0.18"/>
    </linearGradient>
    <clipPath id="pa-wall"><rect width="480" height="270" rx="14"/></clipPath>
  </defs>
  <g clip-path="url(#pa-wall)">
    <rect width="480" height="270" fill="#e8e4dc"/>
    <g stroke="#d3cec4" stroke-width="2">${Array.from({ length: 12 }, (_, i) => `<line x1="0" x2="480" y1="${14 + i * 22}" y2="${14 + i * 22}"/>`).join('')}</g>
    <rect x="370" y="30" width="98" height="250" fill="#fbfaf7" stroke="#d3cec4" stroke-width="2"/>
    <rect x="380" y="40" width="78" height="240" fill="#24221f"/>
    <circle cx="392" cy="162" r="4" fill="#85847f"/>
    <g class="pa-spot">
      <rect x="236" y="78" width="116" height="76" fill="#f59a4a" fill-opacity="0.32"/>
      <rect x="262" y="99" width="64" height="34" rx="2" fill="#c9ccca" stroke="#85847f"/>
      <text x="294" y="124" text-anchor="middle" font-family="Jost, Futura, sans-serif" font-weight="600" font-size="21" fill="#24221f">2724</text>
    </g>
    <polygon class="pa-beam" points="100,150 236,78 352,78 352,154 236,154" fill="url(#pa-beam)"/>
    <g fill="none" stroke="#b3470f" stroke-width="4" stroke-linecap="round">
      <path d="M236 94V78h16M336 78h16v16M352 138v16h-16M252 154h-16v-16"/>
    </g>
    <g transform="translate(58 146) rotate(-14)">
      <rect width="64" height="118" rx="11" fill="#141311"/>
      <rect x="5" y="10" width="54" height="98" rx="5" fill="#2f2c28"/>
      <path d="M17 40v-8h8M39 32h8v8M47 64v8h-8M25 72h-8v-8" fill="none" stroke="#f59a4a" stroke-width="2.5" stroke-linecap="round"/>
      <circle class="pa-flash" cx="32" cy="5" r="3" fill="#f59a4a"/>
    </g>
  </g>
</svg>`;

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
let motion = null;
export const loadMotion = () => motion || (motion = import('https://cdn.jsdelivr.net/npm/motion@11.11.17/+esm').catch(() => null));

// Fade the picture in, then keep the light gently pulsing.
export async function animateArt(root) {
  const m = !still && await loadMotion();
  if (!m) return;
  const beam = root.querySelector('.pa-beam'), spot = root.querySelector('.pa-spot'), flash = root.querySelector('.pa-flash');
  m.animate(beam, { opacity: [0, 1] }, { duration: 0.6, delay: 0.15, ease: 'easeOut' });
  m.animate(spot, { opacity: [0.4, 1] }, { duration: 0.6, delay: 0.25 });
  m.animate(flash, { opacity: [1, 0.35, 1] }, { duration: 1.6, repeat: Infinity, ease: 'easeInOut' });
  m.animate(beam, { opacity: [1, 0.7, 1] }, { duration: 2.4, delay: 0.8, repeat: Infinity, ease: 'easeInOut' });
}
