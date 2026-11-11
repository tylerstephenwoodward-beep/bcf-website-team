// All prices on the site come from this file:
// a plate or numbers on a bar for a home, a set per door for apartments and communities, and loose numbers per character.
// Black powder coat is the premium finish: a set amount more per sign (per set of loose numbers).
// Custom fonts and custom work (property names, logos, shapes) are quoted by Terran, so they have no price here.
window.BCFPricing = {
  home: 69.95,       // one plate or numbers on a bar
  perDoor: 59.95,    // each door's set on a property order (the bulk price)
  looseEach: 24.95,  // each loose number or letter
  black: 20,         // added per sign for black powder coat
  round: function (n) { return Math.round(n * 100) / 100; },
  // choice: { font, kind, chars, property, finish }. count: doors (1 for a home).
  // listEach is what one sign costs on its own (the home price), so property orders can show what they save.
  quote: function (choice, count) {
    count = Math.max(1, count || 1);
    if (choice.font === 'custom') return { custom: true, tier: 'custom', label: 'Custom font', perSign: 0, total: 0 };
    var extra = choice.finish === 'black' ? this.black : 0;
    if (choice.kind === 'loose') {
      var each = this.round(this.looseEach * Math.max(1, choice.chars || 1) + extra);
      return { tier: 'loose', label: 'Loose numbers', perSign: each, listEach: each, total: this.round(each * count) };
    }
    var per = this.round((choice.property ? this.perDoor : this.home) + extra), list = this.round(this.home + extra);
    return { tier: choice.property ? 'property' : 'home', label: '', perSign: per, listEach: list, total: this.round(per * count) };
  }
};
