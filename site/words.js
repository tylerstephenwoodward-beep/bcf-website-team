// THE SITE'S WORDS. Edit the text between the quotes, then save.
// Saving on GitHub (main branch) publishes the change in about a minute.
// Keep the quotes. If your text needs a quote mark inside it, use a curly one (’ or ”).
window.BCF_WORDS = {

  // Home page
  "home.hero.title": "Stainless Steel Address Signs",
  "home.hero.text": "Precision-cut from 11 gauge 304 stainless. For one house or every door on a property.",
  "home.features.label": "Key Features",
  "home.features.title": "Precision Craftsmanship",
  "home.features.text": "Every sign is made to order. Browse photos from the shop below.",
  "home.feature1.title": "304 Stainless Steel",
  "home.feature1.text": "Solid stainless, about 1/8 inch thick (11 gauge). No coating to wear off.",
  "home.feature2.title": "CNC Precision-Cut",
  "home.feature2.text": "Clean lines and consistent characters on every sign.",
  "home.feature3.title": "Hand-Polished",
  "home.feature3.text": "Finished by hand after cutting for a smooth surface.",
  "home.feature4.title": "Mounting Hardware Included",
  "home.feature4.text": "Stainless screws and aluminum spacers. The spacers add a subtle shadow.",
  "home.feature5.title": "Easy to Read",
  "home.feature5.text": "4 and 6 inch characters meet the IFC baseline. Check your local code.",
  "home.feature6.title": "Precision Inspected",
  "home.feature6.text": "Every design is inspected for quality before it is cut.",
  "home.weather.label": "Weather Resistance",
  "home.weather.title": "Built to Last",
  "home.weather1.title": "Rust-Resistant",
  "home.weather1.text": "Stainless steel holds up to rain and keeps its finish for years.",
  "home.weather2.title": "All-Weather",
  "home.weather2.text": "Snow, salt and sun. No paint or sealant to fail.",
  "home.about.label": "About",
  "home.about.title": "About Terran Marks",
  "home.about.text": "Terran Marks is a traditionally trained blacksmith. With a deep knowledge of metalwork and a dedication to customer satisfaction, he is proud to offer stock and custom address signs for homes, communities, and businesses.",
  "home.about.caption": "Terran Marks, the owner, in his blacksmith shop.",
  "home.custom.title": "Custom Work",
  "home.custom.text": "Property entrances, logos in steel and one-of-a-kind pieces.",
  "home.cue": "Click the sign to design yours",
  "home.customlink": "Design something custom!",
  "home.button": "See it on your wall",

  // Design your sign page
  "design.title": "Design Your Sign",

  // Installed work page
  "work.title": "Installed Work"
};

// Fill every element marked data-w="key" with its words.
document.querySelectorAll('[data-w]').forEach(function (el) {
  var t = window.BCF_WORDS[el.getAttribute('data-w')];
  if (typeof t === 'string') el.textContent = t;
});
