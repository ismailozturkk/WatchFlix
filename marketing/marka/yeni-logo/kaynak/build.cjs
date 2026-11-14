// Yeni logo konseptleri: SVG + önizleme panosu + PNG.
// node build.cjs <çıkış klasörü>
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const puppeteer = require('puppeteer-core');

const OUT = process.argv[2];
const FONT = opentype.loadSync(path.join(__dirname, 'font', 'sora-600.ttf'));
fs.mkdirSync(path.join(OUT, 'svg'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'png'), { recursive: true });

const INK = '#0D0E13';
const PAPER = '#F5F2EB';

// Köşeleri yuvarlatılmış çokgen (r: tek sayı veya köşe başına dizi).
function roundedPoly(pts, r) {
  const n = pts.length;
  const rad = (i) => (Array.isArray(r) ? r[i] : r);
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const ua = unit(a, p), ub = unit(b, p);
    const s = [p[0] + ua[0] * rad(i), p[1] + ua[1] * rad(i)];
    const e = [p[0] + ub[0] * rad(i), p[1] + ub[1] * rad(i)];
    d += (i === 0 ? `M${f(s)}` : `L${f(s)}`) + `Q${f(p)} ${f(e)}`;
  }
  return d + 'Z';
}
function unit(a, p) { const dx = a[0] - p[0], dy = a[1] - p[1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; }
function f(p) { return `${+p[0].toFixed(2)} ${+p[1].toFixed(2)}`; }

// Yazı: glif glif dizilir, izleme (tracking) em cinsinden.
function wordPath(text, size, tracking) {
  const scale = size / FONT.unitsPerEm;
  const glyphs = FONT.stringToGlyphs(text);
  let x = 0, d = '';
  glyphs.forEach((g, i) => {
    d += g.getPath(x, 0, size).toPathData(2);
    x += g.advanceWidth * scale + tracking * size;
    if (glyphs[i + 1]) x += FONT.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  const bb = new opentype.Path(); // ölçü için tekrar topla
  glyphs.reduce((xx, g, i) => {
    bb.extend(g.getPath(xx, 0, size));
    let nx = xx + g.advanceWidth * scale + tracking * size;
    if (glyphs[i + 1]) nx += FONT.getKerningValue(g, glyphs[i + 1]) * scale;
    return nx;
  }, 0);
  const box = bb.getBoundingBox();
  return { d, box };
}

// ---- İşaretler (512 birimlik kare) ----
const CONCEPTS = {
  gordum: {
    name: 'Gördüm',
    idea: 'Göz kapağının alt çizgisi bir onay işaretine dönüşür: izledin, kaydedildi.',
    accent: '#FF5A3C',
    iconScale: 1.5,
    mark: (fg, bgDark) => `
      <path d="M72 262C138 152 352 138 428 242M72 262L196 350L468 222" fill="none" stroke="${fg}" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="250" cy="250" r="42" fill="#FF5A3C"/>`,
  },
  imge: {
    name: 'İmge',
    idea: 'Yer imi (kaydet, listele) ile oynat düğmesi tek biçimde: izlediğini kaydet.',
    accent: '#6B4EFF',
    mark: () => `
      <path fill-rule="evenodd" fill="#6B4EFF" d="${roundedPoly([[120, 72], [392, 72], [392, 448], [256, 356], [120, 448]], [44, 44, 30, 22, 30])}${roundedPoly([[214, 160], [214, 288], [324, 224]], 18)}"/>`,
  },
  lens: {
    name: 'Lens',
    idea: '3D sinema gözlüğünün iki rengi üst üste biner, kesişimleri bir göz olur.',
    accent: '#12C8E8',
    mark: () => `
      <defs><clipPath id="c-top"><circle cx="256" cy="190" r="132"/></clipPath></defs>
      <circle cx="256" cy="190" r="132" fill="#12C8E8"/>
      <circle cx="256" cy="322" r="132" fill="#FF3C5F"/>
      <circle cx="256" cy="322" r="132" fill="${INK}" clip-path="url(#c-top)"/>
      <circle cx="256" cy="256" r="30" fill="${PAPER}"/>`,
  },
};

// Benzersiz clipPath kimliği: aynı sayfada birden çok SVG olduğu için.
let uid = 0;
function markSvg(key, fg, size, extra = '') {
  const id = `u${++uid}`;
  const inner = CONCEPTS[key].mark(fg).replace(/c-top/g, `c-top-${id}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}"${extra}>${inner}</svg>`;
}

function lockupSvg(key, fg, h) {
  const id = `u${++uid}`;
  const inner = CONCEPTS[key].mark(fg).replace(/c-top/g, `c-top-${id}`);
  const word = wordPath('seelogd', 300, -0.025);
  // İşaret 512 birim; yazının x-yüksekliği işaretin ortasına hizalanır.
  const markH = 512, gap = 70;
  const xh = FONT.tables.os2.sxHeight * 300 / FONT.unitsPerEm;
  const baseline = 256 + xh / 2;
  const wx = markH + gap - word.box.x1;
  const W = Math.ceil(wx + word.box.x2 + 8);
  const w = Math.round(h * W / 512);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 512" width="${w}" height="${h}">${inner}<path transform="translate(${wx.toFixed(1)} ${baseline.toFixed(1)})" fill="${fg}" d="${word.d}"/></svg>`;
}

function iconSvg(key, size) {
  const id = `u${++uid}`;
  const inner = CONCEPTS[key].mark(PAPER).replace(/c-top/g, `c-top-${id}`);
  // Uygulama simgesi: koyu zemin, işaret ortada (yatay işaret daha büyük ölçeklenir).
  const s = CONCEPTS[key].iconScale || 1.28;
  const o = 512 - 256 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}"><rect width="1024" height="1024" rx="228" fill="${INK}"/><g transform="translate(${o} ${o}) scale(${s})">${inner}</g></svg>`;
}

// ---- Dosyalar ----
const files = [];
for (const key of Object.keys(CONCEPTS)) {
  const put = (name, svg) => { const p = path.join(OUT, 'svg', `${key}-${name}.svg`); fs.writeFileSync(p, svg); files.push(p); };
  put('isaret-koyu-zemin', markSvg(key, PAPER, 512));
  put('isaret-acik-zemin', markSvg(key, INK, 512));
  put('yatay-koyu-zemin', lockupSvg(key, PAPER, 200));
  put('yatay-acik-zemin', lockupSvg(key, INK, 200));
  put('uygulama-simgesi', iconSvg(key, 1024));
}

// ---- Pano ----
const row = (key) => {
  const c = CONCEPTS[key];
  const sizes = [64, 32, 16];
  return `
  <section>
    <h2>${c.name}<span>${c.idea}</span></h2>
    <div class="grid">
      <div class="tile dark">${lockupSvg(key, PAPER, 120)}</div>
      <div class="tile light">${lockupSvg(key, INK, 120)}</div>
      <div class="tile icon">${iconSvg(key, 200)}</div>
      <div class="tile small dark">${sizes.map((s) => markSvg(key, PAPER, s)).join('')}</div>
      <div class="tile small light">${sizes.map((s) => markSvg(key, INK, s)).join('')}</div>
      <div class="tile small dark">${sizes.map((s) => iconSvg(key, s)).join('')}</div>
    </div>
  </section>`;
};
const board = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#1a1b20;color:#eee;font:20px system-ui,sans-serif;padding:40px;width:1840px}
  h1{margin:0 0 30px;font-size:34px}
  section{margin-bottom:44px}
  h2{font-size:30px;margin:0 0 16px;display:flex;gap:18px;align-items:baseline}
  h2 span{font-size:19px;font-weight:400;color:#aaa}
  .grid{display:grid;grid-template-columns:1fr 1fr 260px;gap:16px}
  .tile{border-radius:22px;display:flex;align-items:center;justify-content:center;height:260px;gap:28px}
  .tile.small{height:120px}
  .dark{background:${INK}}.light{background:${PAPER}}.icon{background:#2a2c33}
</style><h1>seelogd · yeni logo konseptleri</h1>${Object.keys(CONCEPTS).map(row).join('')}`;
const boardPath = path.join(OUT, 'pano.html');
fs.writeFileSync(boardPath, board);

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1000, deviceScaleFactor: 1 });
  await p.goto('file:///' + boardPath.replace(/\\/g, '/'));
  await p.screenshot({ path: path.join(OUT, 'png', 'pano.png'), fullPage: true });
  // Her SVG'yi saydam PNG'ye çevir (yatay olanlar 2 kat).
  for (const fp of files) {
    const svg = fs.readFileSync(fp, 'utf8');
    const m = svg.match(/width="(\d+)" height="(\d+)"/);
    let w = +m[1], h = +m[2];
    if (fp.includes('yatay')) { w *= 3; h *= 3; }
    const html = `<body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`)}</body>`;
    await p.setViewport({ width: w, height: h });
    await p.setContent(html);
    await p.screenshot({ path: fp.replace(/[\\/]svg[\\/]/, path.sep + 'png' + path.sep).replace(/\.svg$/, '.png'), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  }
  await b.close();
  console.log('ok', files.length, 'svg');
})();
