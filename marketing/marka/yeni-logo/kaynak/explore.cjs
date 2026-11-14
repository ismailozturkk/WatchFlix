// Lens varyasyon panosu
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const INK = '#0D0E13', PAPER = '#F5F2EB';
let uid = 0;
function lens(o = {}) {
  const r = o.r ?? 132, d = o.d ?? 132, top = o.top ?? '#12C8E8', bot = o.bot ?? '#FF3C5F';
  const eye = o.eye ?? INK, cy1 = 256 - d / 2, cy2 = 256 + d / 2, id = 'c' + ++uid;
  let pupil = '';
  const px = 256 + (o.pdx ?? 0), py = 256 + (o.pdy ?? 0), pr = o.pr ?? 30;
  if (o.pupil === 'play') {
    const s = pr * 1.25;
    pupil = `<path d="M${px - s * 0.45} ${py - s * 0.62}L${px + s * 0.72} ${py}L${px - s * 0.45} ${py + s * 0.62}Z" fill="${PAPER}" stroke="${PAPER}" stroke-width="${pr * 0.35}" stroke-linejoin="round"/>`;
  } else if (o.pupil === 'ring') {
    pupil = `<circle cx="${px}" cy="${py}" r="${pr}" fill="none" stroke="${PAPER}" stroke-width="${pr * 0.42}"/>`;
  } else if (o.pupil !== 'none') {
    pupil = `<circle cx="${px}" cy="${py}" r="${pr}" fill="${o.pfill ?? PAPER}"/>`;
    if (o.glint) pupil += `<circle cx="${px + pr * 0.38}" cy="${py - pr * 0.38}" r="${pr * 0.24}" fill="${eye}"/>`;
  }
  const rot = o.rot ? ` transform="rotate(${o.rot} 256 256)"` : '';
  return `<svg viewBox="0 0 512 512" width="${o.size ?? 200}" height="${o.size ?? 200}"><defs><clipPath id="${id}"><circle cx="256" cy="${cy1}" r="${r}"/></clipPath></defs><g${rot}>
  <circle cx="256" cy="${cy1}" r="${r}" fill="${top}"/><circle cx="256" cy="${cy2}" r="${r}" fill="${bot}"/>
  <circle cx="256" cy="${cy2}" r="${r}" fill="${eye}" clip-path="url(#${id})"/></g>${pupil}</svg>`;
}
const V = [
  ['A · şimdiki', {}],
  ['B · daha geniş göz (d .85r)', { d: 112, r: 132 }],
  ['C · daha ince göz (d 1.15r)', { d: 152 }],
  ['D · büyük göz bebeği', { d: 120, pr: 40 }],
  ['E · bakan göz (sağ üst)', { d: 120, pr: 36, pdx: 14, pdy: -6 }],
  ['F · parıltılı bebek', { d: 120, pr: 40, glint: true }],
  ['G · oynat bebeği', { d: 120, pr: 34, pupil: 'play' }],
  ['H · halka bebek', { d: 120, pr: 34, pupil: 'ring' }],
  ['I · yatay gözlük', { d: 120, pr: 34, rot: 90 }],
  ['J · marka renkleri', { d: 120, pr: 36, top: '#2EE6D6', bot: '#8B7CF6' }],
  ['K · sıcak (amber/kırmızı)', { d: 120, pr: 36, top: '#FFC247', bot: '#FF3C5F' }],
  ['L · tek renk', { d: 120, pr: 36, top: PAPER, bot: PAPER, eye: INK, pfill: PAPER }],
];
const cell = ([t, o], bg) => `<div class="c" style="background:${bg}"><div class="t">${t}</div>${lens({ ...o, size: 220 })}<div class="s">${lens({ ...o, size: 48 })}${lens({ ...o, size: 24 })}${lens({ ...o, size: 16 })}</div></div>`;
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1b20;color:#ddd;font:17px system-ui;padding:24px;width:1872px;display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.c{border-radius:18px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:8px}.t{align-self:flex-start;color:#999}.s{display:flex;gap:16px;align-items:center}</style>
${V.map((v) => cell(v, INK)).join('')}${V.slice(0, 6).map((v) => cell(v, PAPER)).join('')}`;
const hp = path.join(OUT, 'kesif.html');
fs.writeFileSync(hp, html);
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 900 });
  await p.goto('file:///' + hp.replace(/\\/g, '/'));
  await p.screenshot({ path: path.join(OUT, 'kesif.png'), fullPage: true });
  await b.close();
})();
