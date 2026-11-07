/**
 * Komansu static site builder
 * ------------------------------------------------------------
 * Wraps every page in src/pages/*.html with the shared <head>,
 * header, sentinel camera, overlays and footer, then writes the
 * finished file to the project root (e.g. src/pages/about.html -> about.html).
 *
 * Each page starts with a JSON meta comment:
 *   <!--{"title":"…","description":"…","nav":"about"}-->
 *
 * Usage:  node build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://www.komansu.com';
const VERSION = Date.now().toString(36); // cache-busting for css/js

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const partial = (name) => read(`src/partials/${name}.html`);

const NAV = [
  { id: 'home', href: 'index.html', label: 'Home' },
  { id: 'services', href: 'services.html', label: 'Services' },
  { id: 'about', href: 'about.html', label: 'About' },
  { id: 'portfolio', href: 'portfolio.html', label: 'Portfolio' },
  { id: 'contact', href: 'contact.html', label: 'Contact' },
];

const navLinks = (active, cls = '') =>
  NAV.map(
    (n, i) =>
      `<li><a class="${cls}" href="${n.href}"${n.id === active ? ' aria-current="page"' : ''} data-iva="NAV · ${n.label.toUpperCase()}"><span class="nav-idx">0${i + 1}</span>${n.label}</a></li>`
  ).join('\n          ');

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': ['Organization', 'LocalBusiness'],
  name: 'Komansu Electronics Pvt. Ltd.',
  url: SITE,
  logo: `${SITE}/logo.jpg`,
  image: `${SITE}/logo.jpg`,
  email: 'info@komansu.com',
  description:
    'Expert ELV systems design and deployment — CCTV, Fire Alarm, PAGA, Access Control & Data Networks.',
  address: { '@type': 'PostalAddress', addressCountry: 'IN' },
  areaServed: ['Delhi', 'Haryana', 'Madhya Pradesh'],
  knowsAbout: [
    'CCTV Surveillance',
    'Intelligent Video Analytics',
    'Fire Alarm Systems',
    'Public Address and General Alarm',
    'Access Control Systems',
    'Structured Cabling and Data Networks',
    'ELV Design and Consulting',
  ],
};

function build(file) {
  const raw = read(`src/pages/${file}`);
  const m = raw.match(/^<!--(\{[\s\S]*?\})-->/);
  if (!m) throw new Error(`Missing meta comment in ${file}`);
  const meta = JSON.parse(m[1]);
  const body = raw.slice(m[0].length).trim();
  const url = file === 'index.html' ? `${SITE}/` : `${SITE}/${file}`;

  const vars = {
    TITLE: meta.title,
    DESCRIPTION: meta.description,
    URL: url,
    OG_IMAGE: `${SITE}/${meta.ogImage || 'proj_industrial.jpg'}`,
    SCHEMA: JSON.stringify(orgSchema),
    V: VERSION,
    NAV_LINKS: navLinks(meta.nav),
    MOBILE_LINKS: navLinks(meta.nav, 'mm-link'),
    BODY_CLASS: `page-${meta.nav}`,
    YEAR: '2026',
  };

  let html = partial('layout').replace('{{HEAD}}', partial('head'))
    .replace('{{HEADER}}', partial('header'))
    .replace('{{OVERLAYS}}', partial('overlays'))
    .replace('{{FOOTER}}', partial('footer'))
    .replace('{{MAIN}}', body);

  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
  fs.writeFileSync(path.join(ROOT, file), html);
  console.log(`✓ ${file}`);
  return url;
}

const pages = fs.readdirSync(path.join(ROOT, 'src/pages')).filter((f) => f.endsWith('.html'));
const urls = pages.map(build);

// sitemap + robots
fs.writeFileSync(
  path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`
);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /storage/\nSitemap: ${SITE}/sitemap.xml\n`);
console.log('✓ sitemap.xml, robots.txt');
