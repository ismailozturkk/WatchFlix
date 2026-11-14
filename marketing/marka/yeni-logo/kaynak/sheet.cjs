// Lens marka sayfası (tek PNG + HTML). node sheet.cjs <lens klasörü>
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const L = process.argv[2];
// SVG'yi okur, kendi boyutunu atar; w veya h CSS ile verilir (diğeri oranla).
const rd = (rel, w, h, extra = '') => {
  const css = w ? `width:${w}px;height:auto` : `height:${h}px;width:auto`;
  return fs.readFileSync(path.join(L, rel), 'utf8').replace(/ width="\d+" height="\d+"/, ` style="${css};${extra}"`);
};
const C = { ink: '#0D0E13', paper: '#F5F2EB', cyan: '#14C8E8', red: '#FF3D5E' };

// Yapı çizimi: iki daire, d ve r ölçüleri, göz bebeği.
const construction = `<svg viewBox="40 20 432 472" width="380">
  <circle cx="256" cy="196" r="132" fill="${C.cyan}" opacity=".18"/><circle cx="256" cy="316" r="132" fill="${C.red}" opacity=".18"/>
  <circle cx="256" cy="196" r="132" fill="none" stroke="${C.cyan}" stroke-width="2"/><circle cx="256" cy="316" r="132" fill="none" stroke="${C.red}" stroke-width="2"/>
  <circle cx="256" cy="256" r="40" fill="none" stroke="${C.paper}" stroke-width="2"/>
  <line x1="256" y1="196" x2="388" y2="196" stroke="${C.paper}" stroke-width="2" stroke-dasharray="6 6"/>
  <line x1="440" y1="196" x2="440" y2="316" stroke="${C.paper}" stroke-width="2"/>
  <line x1="430" y1="196" x2="450" y2="196" stroke="${C.paper}" stroke-width="2"/><line x1="430" y1="316" x2="450" y2="316" stroke="${C.paper}" stroke-width="2"/>
  <circle cx="256" cy="196" r="4" fill="${C.paper}"/><circle cx="256" cy="316" r="4" fill="${C.paper}"/>
  <text x="300" y="186" fill="${C.paper}" font-size="22" font-family="system-ui">r</text>
  <text x="456" y="263" fill="${C.paper}" font-size="22" font-family="system-ui">d</text>
  <text x="300" y="262" fill="${C.paper}" font-size="18" font-family="system-ui">p</text>
</svg>`;

const sw = (name, hex, fg) => `<div class="sw" style="background:${hex};color:${fg}"><b>${name}</b><span>${hex}</span></div>`;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:${C.ink};color:${C.paper};font:20px/1.45 system-ui,sans-serif;width:1800px;padding:70px 60px}
h1{font-size:20px;letter-spacing:.2em;text-transform:uppercase;color:#8a8d98;margin:0 0 40px}
h2{font-size:15px;letter-spacing:.18em;text-transform:uppercase;color:#8a8d98;margin:0 0 18px}
.hero{display:flex;align-items:center;justify-content:center;height:520px;border-radius:28px;background:#14161d;margin-bottom:28px}
.row{display:grid;gap:28px;margin-bottom:28px}
.card{background:#14161d;border-radius:28px;padding:36px}
.light{background:${C.paper};color:${C.ink}}.light h2{color:#6b6c72}
.c{display:flex;align-items:center;justify-content:center;gap:40px}
.sw{border-radius:20px;padding:22px;height:150px;display:flex;flex-direction:column;justify-content:flex-end;font-size:19px}.sw span{opacity:.75;font-family:ui-monospace,monospace}
p{margin:0;color:#b9bcc6;font-size:18px}.light p{color:#555}
.dont{position:relative}.dont:after{content:"";position:absolute;inset:0;background:linear-gradient(to top right,transparent calc(50% - 2px),#FF3D5E calc(50% - 2px),#FF3D5E calc(50% + 2px),transparent calc(50% + 2px));opacity:.85}
.dontrow .card{flex-direction:column;height:260px;gap:18px}.dont{display:flex;justify-content:center;width:240px}
.lab{font-size:15px;color:#8a8d98;text-align:center;margin-top:10px}
</style>
<h1>seelogd · Lens · marka sayfası</h1>
<div class="hero">${rd('svg/lens-yatay-koyu-zemin.svg', 1100, null)}</div>
<div class="row" style="grid-template-columns:1fr 1fr 1fr">
  <div class="card"><h2>Fikir</h2><p style="font-size:21px;color:${C.paper}">3D sinema gözlüğünün iki camı üst üste biner. Kesiştikleri yerde bir göz açılır: <b>see</b>. Göz bebeğindeki küçük parıltı ona canlılık verir.</p></div>
  <div class="card c">${construction}</div>
  <div class="card"><h2>Ölçüler (512 birim)</h2><p>Daire yarıçapı <b>r = 132</b><br>Merkezler arası <b>d = 120</b><br>Göz bebeği <b>p = 40</b>, parıltı 9,6<br>Göz genişliği ≈ 1,78 r<br><br>Boşluk: işaretin çevresinde en az <b>r/2</b>.<br>En küçük: işaret 16 px, yatay logo 96 px genişlik. 32 px ve altında parıltısız sürüm.</p></div>
</div>
<div class="row" style="grid-template-columns:repeat(5,1fr)">
  ${sw('Mürekkep', C.ink, C.paper).replace('style="background', 'style="outline:1px solid #2a2c35;background')}
  ${sw('Kâğıt', C.paper, C.ink)}${sw('Camgöbeği', C.cyan, C.ink)}${sw('Kırmızı', C.red, C.ink)}
  <div class="sw" style="background:#14161d;color:${C.paper}"><b>Yazı</b><span>Sora SemiBold · küçük harf</span></div>
</div>
<div class="row" style="grid-template-columns:1.2fr 1fr 1fr">
  <div class="card light c" style="height:300px">${rd('svg/lens-yatay-acik-zemin.svg', 560, null)}</div>
  <div class="card c">${rd('svg/lens-dikey-koyu-zemin.svg', null, 250)}</div>
  <div class="card light c">${rd('svg/lens-dikey-acik-zemin.svg', null, 250)}</div>
</div>
<div class="row" style="grid-template-columns:1fr 1fr 1fr 1fr">
  <div class="card c" style="background:${C.red}">${rd('svg/lens-yatay-tek-renk-beyaz.svg', 330, null)}</div>
  <div class="card c" style="background:${C.cyan}">${rd('svg/lens-yatay-tek-renk-siyah.svg', 330, null)}</div>
  <div class="card c">${rd('svg/lens-isaret.svg', null, 130)}${rd('svg/lens-isaret-kucuk.svg', null, 32)}${rd('svg/lens-isaret-kucuk.svg', null, 16)}</div>
  <div class="card light c">${rd('svg/lens-isaret.svg', null, 130)}${rd('svg/lens-isaret-kucuk.svg', null, 32)}${rd('svg/lens-isaret-kucuk.svg', null, 16)}</div>
</div>
<h2 style="margin-top:10px">Simgeler</h2>
<div class="row" style="grid-template-columns:repeat(5,1fr)">
  <div class="card c" style="flex-direction:column"><img src="simge/ios/ios-1024.png" width="180" style="border-radius:40px"><div class="lab">iOS</div></div>
  <div class="card c" style="flex-direction:column"><img src="simge/ios/ios-1024-ton.png" width="180" style="border-radius:40px;background:#3a3c44"><div class="lab">iOS renkli ton</div></div>
  <div class="card c" style="flex-direction:column"><div style="width:180px;height:180px;border-radius:50%;overflow:hidden;background:${C.ink}"><img src="simge/android/on-plan-432.png" width="180"></div><div class="lab">Android uyarlanabilir</div></div>
  <div class="card c" style="flex-direction:column"><div style="width:180px;height:180px;border-radius:50%;overflow:hidden;background:#d9e3ea"><img src="simge/android/tek-renk-432.png" width="180" style="filter:brightness(0) saturate(100%) invert(22%) sepia(18%) saturate(900%) hue-rotate(170deg)"></div><div class="lab">Android temalı</div></div>
  <div class="card c" style="flex-direction:column"><img src="sosyal/profil-1080-koyu.png" width="180" style="border-radius:50%"><div class="lab">Profil fotoğrafı</div></div>
</div>
<h2 style="margin-top:10px">Yapma</h2>
<div class="row dontrow" style="grid-template-columns:repeat(4,1fr)">
  <div class="card c"><div class="dont">${rd('svg/lens-isaret.svg', null, 150, 'transform:scaleX(1.5)')}</div><div class="lab">Esnetme</div></div>
  <div class="card c"><div class="dont">${rd('svg/lens-isaret.svg', null, 150).replace(/#14C8E8/g, '#7CFC00').replace(/#FF3D5E/g, '#FFA500')}</div><div class="lab">Renk değiştirme</div></div>
  <div class="card c"><div class="dont">${rd('svg/lens-isaret.svg', null, 150, 'transform:rotate(90deg)')}</div><div class="lab">Döndürme</div></div>
  <div class="card c" style="background:linear-gradient(135deg,#d6489a,#f6c344)"><div class="dont">${rd('svg/lens-isaret.svg', null, 150)}</div><div class="lab" style="color:#222">Karışık zemin</div></div>
</div>`;
const out = path.join(L, 'marka-sayfasi.html');
fs.writeFileSync(out, html);
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1000 });
  await p.goto('file:///' + out.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await p.screenshot({ path: path.join(L, 'marka-sayfasi.png'), fullPage: true });
  await b.close();
  console.log('ok');
})();
