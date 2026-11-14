// Lens logo seti: işaret, yazı düzenleri, simgeler, favicon, profil, kapak, marka sayfası.
// node lens.cjs <çıkış klasörü>
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const puppeteer = require('puppeteer-core');

const OUT = process.argv[2];
const FONT = opentype.loadSync(path.join(__dirname, 'font', 'sora-600.ttf'));
for (const d of ['svg', 'png', 'simge/ios', 'simge/android', 'simge/favicon', 'sosyal']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const C = { ink: '#0D0E13', paper: '#F5F2EB', cyan: '#14C8E8', red: '#FF3D5E' };
// Geometri (512 birim): r yarıçap, d merkezler arası, göz bebeği p, parıltı g.
const G = { r: 132, d: 120, p: 40, g: 9.6, gdx: 15, gdy: -15 };
const CY1 = 256 - G.d / 2, CY2 = 256 + G.d / 2;
const BOX = { x: 256 - G.r, y: CY1 - G.r, w: 2 * G.r, h: 2 * G.r + G.d }; // 124,64,264,384

let uid = 0;
// Renkli işaret: göz kesişimi mürekkep, bebek kâğıt rengi.
function markInner({ glint = true, top = C.cyan, bot = C.red, eye = C.ink, pupil = C.paper } = {}) {
  const id = 'l' + ++uid;
  return `<defs><clipPath id="${id}"><circle cx="256" cy="${CY1}" r="${G.r}"/></clipPath></defs>`
    + `<circle cx="256" cy="${CY1}" r="${G.r}" fill="${top}"/><circle cx="256" cy="${CY2}" r="${G.r}" fill="${bot}"/>`
    + `<circle cx="256" cy="${CY2}" r="${G.r}" fill="${eye}" clip-path="url(#${id})"/>`
    + `<circle cx="256" cy="256" r="${G.p}" fill="${pupil}"/>`
    + (glint ? `<circle cx="${256 + G.gdx}" cy="${256 + G.gdy}" r="${G.g}" fill="${eye}"/>` : '');
}
// Tek renk: göz saydam oyulur (Android temalı simge, damga, baskı).
function monoInner(color, { glint = true } = {}) {
  const id = 'm' + ++uid, cid = 'mc' + uid;
  return `<defs><clipPath id="${cid}"><circle cx="256" cy="${CY1}" r="${G.r}"/></clipPath>`
    + `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#fff"/>`
    + `<circle cx="256" cy="${CY2}" r="${G.r}" fill="#000" clip-path="url(#${cid})"/><circle cx="256" cy="256" r="${G.p}" fill="#fff"/>`
    + (glint ? `<circle cx="${256 + G.gdx}" cy="${256 + G.gdy}" r="${G.g}" fill="#000"/>` : '') + `</mask></defs>`
    + `<g mask="url(#${id})" fill="${color}"><circle cx="256" cy="${CY1}" r="${G.r}"/><circle cx="256" cy="${CY2}" r="${G.r}"/><circle cx="256" cy="256" r="${G.p}"/></g>`;
}
const svg = (vb, w, h, inner, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">${bg ? `<rect x="-9999" y="-9999" width="99999" height="99999" fill="${bg}"/>` : ''}${inner}</svg>`;

// Yazı: glif glif, izleme em cinsinden; harfler vektöre çevrilir.
function word(text, size, tracking = -0.025) {
  const scale = size / FONT.unitsPerEm, gl = FONT.stringToGlyphs(text);
  let x = 0; const p = new opentype.Path();
  gl.forEach((g, i) => {
    p.extend(g.getPath(x, 0, size));
    x += g.advanceWidth * scale + tracking * size;
    if (gl[i + 1]) x += FONT.getKerningValue(g, gl[i + 1]) * scale;
  });
  return { d: p.toPathData(2), box: p.getBoundingBox() };
}
const WS = 300; // işaret 384 birim yüksekken yazı boyu
const W = word('seelogd', WS);
const XH = FONT.tables.os2.sxHeight * WS / FONT.unitsPerEm;

// Kırpılmış işaret (yalnız şekil, kenar payı yok)
const markSvg = (size, o = {}) => svg(`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`, Math.round(size * BOX.w / BOX.h), size, o.mono ? monoInner(o.mono, o) : markInner(o));

function lockupH(h, fg, o = {}) {
  const gap = 84, wx = BOX.x + BOX.w + gap - W.box.x1, base = 256 + XH / 2;
  const x2 = wx + W.box.x2;
  const vb = `${BOX.x} ${BOX.y} ${x2 - BOX.x} ${BOX.h}`;
  const inner = (o.mono ? monoInner(o.mono, o) : markInner(o)) + `<path transform="translate(${wx.toFixed(1)} ${base.toFixed(1)})" fill="${fg}" d="${W.d}"/>`;
  return svg(vb, Math.round(h * (x2 - BOX.x) / BOX.h), h, inner, o.bg);
}
function lockupV(h, fg, o = {}) {
  // Dikeyde işaret 1,8 kat: yazının genişliğine göre dengeli dursun.
  const k = 1.8, ww = W.box.x2 - W.box.x1, gap = 110;
  const top = 256 - (256 - BOX.y) * k, bottom = 256 + (BOX.y + BOX.h - 256) * k;
  const width = Math.max(ww, BOX.w * k);
  const x0 = 256 - width / 2;
  const base = bottom + gap - W.box.y1;
  const wx = 256 - ww / 2 - W.box.x1;
  const y2 = base + W.box.y2;
  const vb = `${x0} ${top} ${width} ${y2 - top}`;
  const inner = `<g transform="translate(256 256) scale(${k}) translate(-256 -256)">${markInner(o)}</g><path transform="translate(${wx.toFixed(1)} ${base.toFixed(1)})" fill="${fg}" d="${W.d}"/>`;
  return svg(vb, Math.round(h * width / (y2 - top)), h, inner, o.bg);
}
const wordmark = (h, fg) => svg(`${W.box.x1} ${W.box.y1} ${W.box.x2 - W.box.x1} ${W.box.y2 - W.box.y1}`, Math.round(h * (W.box.x2 - W.box.x1) / (W.box.y2 - W.box.y1)), h, `<path fill="${fg}" d="${W.d}"/>`);

// Kare kompozisyon: işaret yüksekliği kenarın k katı, ortada.
function square(size, bg, k, o = {}, rx = 0) {
  const s = (1024 * k) / BOX.h, ox = 512 - 256 * s, oy = 512 - 256 * s;
  const inner = `<g transform="translate(${ox} ${oy}) scale(${s})">${o.mono ? monoInner(o.mono, o) : markInner(o)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}">${bg ? `<rect width="1024" height="1024" rx="${rx}" fill="${bg}"/>` : ''}${inner}</svg>`;
}

// ---- Dosya listesi: [yol, svg, png boyutu çarpanı] ----
const jobs = [];
const add = (rel, s, scale = 1) => jobs.push({ rel, s, scale });
add('svg/lens-isaret.svg', markSvg(512));
add('svg/lens-isaret-kucuk.svg', markSvg(512, { glint: false }));
add('svg/lens-isaret-tek-renk-beyaz.svg', markSvg(512, { mono: '#FFFFFF' }));
add('svg/lens-isaret-tek-renk-siyah.svg', markSvg(512, { mono: C.ink }));
add('svg/lens-yatay-koyu-zemin.svg', lockupH(200, C.paper), 3);
add('svg/lens-yatay-acik-zemin.svg', lockupH(200, C.ink), 3);
add('svg/lens-dikey-koyu-zemin.svg', lockupV(400, C.paper), 2);
add('svg/lens-dikey-acik-zemin.svg', lockupV(400, C.ink), 2);
add('svg/lens-yazi-koyu-zemin.svg', wordmark(160, C.paper), 3);
add('svg/lens-yazi-acik-zemin.svg', wordmark(160, C.ink), 3);
add('svg/lens-yatay-tek-renk-beyaz.svg', lockupH(200, '#FFFFFF', { mono: '#FFFFFF' }), 3);
add('svg/lens-yatay-tek-renk-siyah.svg', lockupH(200, C.ink, { mono: C.ink }), 3);
// iOS: 1024, saydamlık yok; koyu mod için saydam, renkli ton için gri tek renk.
add('simge/ios/ios-1024.svg', square(1024, C.ink, 0.6));
add('simge/ios/ios-1024-koyu-mod.svg', square(1024, null, 0.6));
add('simge/ios/ios-1024-ton.svg', square(1024, null, 0.6, { mono: '#FFFFFF' }));
// Android uyarlanabilir: 432 px (108 dp @4x), güvenli çember 264 px → işaret 0,58.
add('simge/android/on-plan-432.svg', square(432, null, 0.58));
add('simge/android/arka-plan-432.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="432" height="432"><rect width="1024" height="1024" fill="${C.ink}"/></svg>`);
add('simge/android/tek-renk-432.svg', square(432, null, 0.58, { mono: '#FFFFFF' }));
add('simge/android/play-store-512.svg', square(512, C.ink, 0.6));
// Favicon: küçükte parıltı yok.
for (const s of [16, 32, 48, 180, 192, 512]) add(`simge/favicon/favicon-${s}.svg`, square(s, C.ink, s <= 48 ? 0.78 : 0.62, { glint: s > 48 }, s <= 48 ? 200 : 0));
// Sosyal: profil (yuvarlak kırpmaya güvenli) ve X kapağı.
add('sosyal/profil-1080-koyu.svg', square(1080, C.ink, 0.5));
add('sosyal/profil-1080-acik.svg', square(1080, C.paper, 0.5));
{
  const L = lockupH(150, C.paper);
  const inner = L.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const vb = L.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const s = 150 / vb[3], lw = vb[2] * s;
  const tag = word('Your movie & TV life, all in one place.', 34, 0);
  const tw = tag.box.x2 - tag.box.x1;
  add('sosyal/x-kapak-1500x500.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500" width="1500" height="500"><rect width="1500" height="500" fill="${C.ink}"/>`
    + `<circle cx="1360" cy="-40" r="260" fill="${C.cyan}" opacity=".10"/><circle cx="1360" cy="120" r="260" fill="${C.red}" opacity=".10"/>`
    + `<g transform="translate(${(750 - lw / 2).toFixed(1)} 150) scale(${s.toFixed(4)}) translate(${-vb[0]} ${-vb[1]})">${inner}</g>`
    + `<path transform="translate(${(750 - tw / 2 - tag.box.x1).toFixed(1)} 380)" fill="${C.paper}" fill-opacity=".62" d="${tag.d}"/></svg>`);
}

for (const j of jobs) fs.writeFileSync(path.join(OUT, j.rel), j.s);

// ---- ICO (PNG gömülü 16/32/48) ----
function writeIco(pngs, out) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + i * 16;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  fs.writeFileSync(out, Buffer.concat([head, ...pngs.map((p) => p.buf)]));
}

module.exports = { C, G, markInner, monoInner, markSvg, lockupH, lockupV, wordmark, square, BOX };

if (require.main === module) (async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await b.newPage();
  for (const j of jobs) {
    const m = j.s.match(/width="(\d+)" height="(\d+)"/);
    const w = +m[1] * j.scale, h = +m[2] * j.scale;
    const s = j.s.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);
    await p.setViewport({ width: w, height: h });
    await p.setContent(`<body style="margin:0;background:transparent">${s}</body>`);
    const outPng = path.join(OUT, j.rel.startsWith('svg/') ? j.rel.replace(/^svg\//, 'png/') : j.rel).replace(/\.svg$/, '.png');
    await p.screenshot({ path: outPng, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
    // iOS 1024 saydamlık içermemeli: zeminli olan zaten opak.
  }
  writeIco([16, 32, 48].map((s) => ({ size: s, buf: fs.readFileSync(path.join(OUT, `simge/favicon/favicon-${s}.png`)) })), path.join(OUT, 'simge/favicon/favicon.ico'));
  await b.close();
  console.log('ok', jobs.length);
})();
