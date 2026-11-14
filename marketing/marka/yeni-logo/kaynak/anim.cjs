// Lens logo animasyonu: iki daire gelir, birleşir, göz açılır, kırpar, yazı yükselir.
// node anim.cjs <çıkış klasörü> <ffmpeg>
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const opentype = require('opentype.js');
const puppeteer = require('puppeteer-core');
const C = { ink: '#0D0E13', paper: '#F5F2EB', cyan: '#14C8E8', red: '#FF3D5E' };

const OUT = process.argv[2], FF = process.argv[3];
const FONT = opentype.loadSync(path.join(__dirname, 'font', 'sora-600.ttf'));
const DUR = 4.2, FPS = 60;

// Harf harf yol (sırayla yükselsin diye ayrı)
function letters(text, size, tracking = -0.025) {
  const scale = size / FONT.unitsPerEm, gl = FONT.stringToGlyphs(text);
  let x = 0; const out = []; const all = new opentype.Path();
  gl.forEach((g, i) => {
    const p = g.getPath(x, 0, size); out.push(p.toPathData(2)); all.extend(p);
    x += g.advanceWidth * scale + tracking * size;
    if (gl[i + 1]) x += FONT.getKerningValue(g, gl[i + 1]) * scale;
  });
  return { paths: out, box: all.getBoundingBox() };
}
const WD = letters('seelogd', 300);

function page(W, H) {
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:${C.ink};overflow:hidden}</style>
<svg id="s" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${C.ink}"/>
<defs>
  <clipPath id="ct"><circle id="ctc" cx="256" r="132"/></clipPath>
  <clipPath id="cb"><circle id="cbc" cx="256" r="132"/></clipPath>
</defs>
<g id="mark">
  <circle id="top" cx="256" r="132" fill="${C.cyan}"/>
  <circle id="bot" cx="256" r="132" fill="${C.red}"/>
  <g clip-path="url(#ct)"><circle id="eye" cx="256" r="132" fill="${C.ink}"/>
    <g clip-path="url(#cb)"><g id="pup"><circle cx="0" cy="0" r="40" fill="${C.paper}"/><circle id="gl" cx="15" cy="-15" r="9.6" fill="${C.ink}"/></g></g>
  </g>
</g>
<g id="word">${WD.paths.map((d, i) => `<path id="w${i}" fill="${C.paper}" d="${d}"/>`).join('')}</g>
</svg>
<script>
const W=${W},H=${H},R=132,BOX=${JSON.stringify(WD.box)},N=${WD.paths.length};
const cl=(x)=>Math.max(0,Math.min(1,x));
const eo=(x)=>1-Math.pow(1-x,3), eio=(x)=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const spring=(x)=>x<=0?0:x>=1?1:1-Math.exp(-5.5*x)*Math.cos(9.5*x);
// Son dikey düzen (işaret birimleri): işaret 1,8 kat, altında yazı.
const K=1.8, mt=256-192*K, bottom=256+192*K, gap=110, base=bottom+gap-BOX.y1, y2=base+BOX.y2;
const ww=BOX.x2-BOX.x1, width=Math.max(ww,264*K), T=y2-mt;
const s=Math.min(.78*W/width,.62*H/T);
const ox=W/2-256*s, oy=H/2-(mt+T/2)*s;
// Giriş: işaret ekranın ortasında, biraz daha büyük.
const sIn=s*K*1.18;
window.seek=function(t){
  // Daireler: 0-.55 dışarıdan gelip birbirine değer, .55-1.05 iç içe geçer (göz açılır).
  let d=264, off=(1-eo(cl(t/.55)))*(H*.75)/sIn;
  if(t>=.55) d=264-144*spring(cl((t-.55)/.5));
  // Kırpma: 1.85-2.07 arası göz kapanıp açılır.
  if(t>1.85&&t<2.07) d=120+148*Math.sin(Math.PI*(t-1.85)/.22);
  const cy1=256-d/2-off, cy2=256+d/2+off;
  for(const [id,cy] of [['top',cy1],['ctc',cy1],['bot',cy2],['eye',cy2],['cbc',cy2]]) document.getElementById(id).setAttribute('cy',cy);
  // Göz bebeği: .9'da belirir, 1.3-1.75 sola bakıp döner.
  const ps=spring(cl((t-.9)/.4));
  const look=t>1.3&&t<1.75?-18*Math.sin(Math.PI*(t-1.3)/.45):0;
  document.getElementById('pup').setAttribute('transform','translate('+(256+look)+' 256) scale('+ps+')');
  document.getElementById('gl').setAttribute('opacity',cl((t-1.05)/.15));
  // İşaret: 2.2-2.8 arası ortadan son yerine.
  const m=eio(cl((t-2.2)/.6));
  const sc=sIn+(s*K-sIn)*m;
  const cx=W/2, cyIn=H/2, cyFin=oy+256*s;
  const cy=cyIn+(cyFin-cyIn)*m;
  document.getElementById('mark').setAttribute('transform','translate('+cx+' '+cy+') scale('+sc+') translate(-256 -256)');
  // Yazı: harfler sırayla yükselir.
  const wx=W/2-ww*s/2-BOX.x1*s, wy=oy+base*s;
  document.getElementById('word').setAttribute('transform','translate('+wx+' '+wy+') scale('+s+')');
  for(let i=0;i<N;i++){
    const p=eo(cl((t-2.45-i*.05)/.5));
    const el=document.getElementById('w'+i);
    el.setAttribute('opacity',p);
    el.setAttribute('transform','translate(0 '+((1-p)*120)+')');
  }
};
seek(0);
</script>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  for (const [name, W, H] of [['kare-1080', 1080, 1080], ['dikey-1080x1920', 1080, 1920]]) {
    const html = path.join(OUT, `anim-${name}.html`);
    fs.writeFileSync(html, page(W, H));
    const p = await b.newPage();
    await p.setViewport({ width: W, height: H });
    await p.goto('file:///' + html.replace(/\\/g, '/'));
    const mp4 = path.join(OUT, `seelogd-logo-animasyon-${name}.mp4`);
    const ff = spawn(FF, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-vf', 'tblend=all_mode=average,framestep=2,format=yuv420p', '-r', '30',
      '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', mp4]);
    ff.stderr.on('data', (d) => process.stderr.write(d));
    const n = Math.round(DUR * FPS);
    for (let i = 0; i < n; i++) {
      await p.evaluate((t) => window.seek(t), i / FPS);
      const buf = await p.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      // Kontrol kareleri
      if ([0, 20, 40, 60, 75, 100, 117, 140, 160, 250].includes(i)) fs.writeFileSync(path.join(OUT, `kare-${name}-${String(i).padStart(3, '0')}.png`), buf);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    await p.close();
    console.log('ok', mp4);
  }
  await b.close();
})();
