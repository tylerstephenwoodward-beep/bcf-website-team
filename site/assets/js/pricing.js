// All prices on the site come from this file. These are Terran's prices (2026-10-25):
// a plate or numbers on a bar for a home, a set per door for apartments and communities, and loose numbers per character.
// Custom fonts and custom work (property names, logos, shapes) are quoted by Terran, so they have no price here.
window.BCFPricing = {
  home: 69.95,       // one plate or numbers on a bar
  perDoor: 49.95,    // each door's set on a property order
  looseEach: 24.95,  // each loose number or letter
  round: function (n) { return Math.round(n * 100) / 100; },
  // choice: { font, kind, chars, property }. count: doors (1 for a home).
  quote: function (choice, count) {
    count = Math.max(1, count || 1);
    if (choice.font === 'custom') return { custom: true, tier: 'custom', label: 'Custom font', perSign: 0, total: 0 };
    if (choice.kind === 'loose') {
      var each = this.round(this.looseEach * Math.max(1, choice.chars || 1));
      return { tier: 'loose', label: 'Loose numbers', perSign: each, total: this.round(each * count) };
    }
    var per = choice.property ? this.perDoor : this.home;
    return { tier: choice.property ? 'property' : 'home', label: '', perSign: per, total: this.round(per * count) };
  }
};
