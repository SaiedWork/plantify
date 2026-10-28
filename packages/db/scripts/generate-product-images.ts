// Generates a simple, deterministic SVG illustration per product (no stock photos needed).
// Run: pnpm --filter @plantify/db images
import { mkdirSync, writeFileSync } from 'node:fs';
import { PRODUCTS, slugify } from '../src/seed/catalog-data.js';

const OUT = new URL('../../../apps/storefront/public/products/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const BACKGROUNDS: Record<string, [string, string]> = {
  'indoor-plants': ['#e8f3e4', '#cfe5c8'],
  'succulents-cacti': ['#f6efe0', '#ecdcbb'],
  herbs: ['#eaf4e6', '#d7ebcf'],
  flowering: ['#fbeaf0', '#f5d3e1'],
  'pots-planters': ['#efe9e4', '#ddd2c8'],
  'care-supplies': ['#e7eef5', '#d1deeb'],
};

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
const rand = (seed: number, i: number) => ((Math.imul(seed ^ (i * 2654435761), 1597334677) >>> 0) % 1000) / 1000;

const pot = (fill: string) =>
  `<path d="M170 330h160l-18 100a20 20 0 0 1-20 16h-84a20 20 0 0 1-20-16z" fill="${fill}"/><rect x="160" y="316" width="180" height="22" rx="8" fill="${fill}" opacity=".85"/>`;

function leaves(seed: number, greens: string[], count: number, flower?: string) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const angle = -75 + (150 * i) / Math.max(1, count - 1) + (rand(seed, i) - 0.5) * 18;
    const len = 110 + rand(seed, i + 10) * 70;
    const color = greens[i % greens.length]!;
    out += `<g transform="translate(250 322) rotate(${angle.toFixed(1)})"><ellipse cx="0" cy="${-len / 2}" rx="${(22 + rand(seed, i + 20) * 14).toFixed(1)}" ry="${(len / 2).toFixed(1)}" fill="${color}"/><line x1="0" y1="0" x2="0" y2="${-len}" stroke="#ffffff" stroke-opacity=".35" stroke-width="2"/></g>`;
    if (flower && i % 2 === 0) {
      out += `<g transform="translate(250 322) rotate(${angle.toFixed(1)}) translate(0 ${-len})"><circle r="16" fill="${flower}"/><circle r="6" fill="#fff7c2"/></g>`;
    }
  }
  return out;
}

function art(category: string, kind: string, name: string, seed: number) {
  if (category === 'care-supplies') {
    return `<rect x="190" y="170" width="120" height="260" rx="22" fill="#4f7a5a"/><rect x="215" y="140" width="70" height="40" rx="10" fill="#33523b"/><rect x="205" y="240" width="90" height="90" rx="10" fill="#f4f1e8"/><circle cx="250" cy="285" r="22" fill="#7fb08a"/>`;
  }
  if (category === 'pots-planters' && kind === 'single') {
    return `<rect x="170" y="200" width="160" height="220" rx="18" fill="#b98b5e"/><rect x="170" y="200" width="160" height="30" rx="14" fill="#9c7248"/><path d="M170 300h160" stroke="#fff" stroke-opacity=".3" stroke-width="3"/>`;
  }
  if (category === 'pots-planters') {
    return pot(name.includes('Ceramic') ? '#f2efe9' : '#c4693d');
  }
  const greens = category === 'succulents-cacti' ? ['#7fae8d', '#5f9a78', '#9bc4a6'] : ['#2f7d4a', '#3f9a5c', '#256b3e', '#58ad6f'];
  const potColor = category === 'succulents-cacti' ? '#d9a577' : '#c4693d';
  const count = category === 'herbs' ? 9 : category === 'succulents-cacti' ? 7 : 6;
  return leaves(seed, greens, count, category === 'flowering' ? '#e0508a' : undefined) + pot(potColor);
}

for (const p of PRODUCTS) {
  const slug = slugify(p.name);
  const [a, b] = BACKGROUNDS[p.category] ?? ['#eee', '#ddd'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" role="img" aria-label="${p.name.replace(/[<>&"]/g, '')}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="500" height="500" fill="url(#g)"/><ellipse cx="250" cy="452" rx="130" ry="14" fill="#000" opacity=".08"/>
${art(p.category, p.kind, p.name, hash(slug))}
</svg>`;
  writeFileSync(new URL(`${slug}.svg`, OUT), svg);
}
console.log(`wrote ${PRODUCTS.length} images`);
