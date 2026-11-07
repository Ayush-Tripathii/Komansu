# Komansu Electronics — "The Living Blueprint"

A static multi-page site in plain HTML, CSS and JS that runs as-is on Apache/XAMPP or any static host.

## Structure
```
src/partials/   layout, head, header (sentinel camera + beam), overlays, footer
src/pages/      page bodies, each with a JSON meta comment (title, description, nav)
build.mjs       stitches partials + pages → /*.html, sitemap.xml, robots.txt
assets/css/main.css   design tokens, components, motion (sections numbered 01–15)
assets/js/main.js     interaction modules (Boot, Sentinel, IVA, Tripwires, Process …)
api/contact.php       form endpoint (validates, logs to storage/, tries mail())
```

## Editing
Edit files in `src/`, then run `node build.mjs`. Don't edit the root `*.html` files directly; the build overwrites them.

## Before going live
- WhatsApp/call placeholder `910000000000` in `src/partials/overlays.html`
- The brand mark is an SVG placeholder (header/footer partials). Swap in the real logo if preferred.
- Images and IVA media load from `https://www.komansu.com/…`. Copy them into `assets/` and update the paths to self-host.
- Configure SMTP for `api/contact.php` (on XAMPP `mail()` is usually off; enquiries are still saved to `storage/enquiries.jsonl`).
- About → Core Principles copy was drafted; replace with the original descriptions if different.
