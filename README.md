# Marks Metal Signs website

The website for Marks Metal Signs: stainless steel address signs for homes and properties.

- **Live site:** https://bcf-site-ten.vercel.app
- **Hosting:** Vercel. When the site is updated, the new version goes live within about a minute.

## What's in here

Everything is in the `site` folder. Each page is one file:

| Page | File |
|---|---|
| Home | `site/index.html` |
| Design Your Sign | `site/design.html` |
| Custom Work | `site/custom.html` |
| Installed Work | `site/work.html` |
| Quote request confirmation | `site/quote-sent.html` |
| Returns policy | `site/returns.html` |
| Privacy | `site/privacy.html` |

`site/assets` holds what those pages use:

- `css/`: the look of the site (colors, fonts, spacing)
- `js/`: what makes the pages work, like the sign drawing, the 3D view and the prices
- `img/`: photos of signs and the shop
- `walls/`: the wall backgrounds in the design tool
- `fonts/`: the fonts used to cut the numbers

## Common changes

- **Wording:** most headings and short lines are in `site/words.js`. Change the text between the quotes.
- **Prices:** all prices are in `site/assets/js/pricing.js`.
- **Photos:** add a photo to `site/assets/img` and list it on the page that shows it.

## History

Every change is saved with a date in this repository's history, so any earlier version of the site can be brought back.
