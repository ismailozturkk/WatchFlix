// Lens logo animasyonu 2: iki yıldız birbirinin çevresinde dönerek yaklaşır, çarpışıp birleşir, göz açılır.
// node anim2.cjs <çıkış klasörü> <ffmpeg> [yalnız-kareler]
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const opentype = require('opentype.js');
const puppeteer = require('puppeteer-core');

const OUT = process.argv[2], FF = process.argv[3], ONLY_FRAMES = process.argv[4] === 'kareler';
const FONT = opentype.loadSync(path.join(__dirname, 'font', 'sora-600.ttf'));
const C = { ink: '#0D0E13', paper: '#F5F2EB', cyan: '#14C8E8', red: '#FF3D5E' };
const DUR = 6.4, FPS = 60;

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

const page = (W, H) => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:${C.ink};overflow:hidden}</style>
<canvas id="c" width="${W}" height="${H}"></canvas>
<script>
const DUR=${DUR},W=${W},H=${H},C=${JSON.stringify(C)},BOX=${JSON.stringify(WD.box)};
const LET=${JSON.stringify(WD.paths)}.map(d=>new Path2D(d));
const ctx=document.getElementById('c').getContext('2d');
const cl=x=>Math.max(0,Math.min(1,x)), eo=x=>1-Math.pow(1-x,3), eio=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const spring=x=>x<=0?0:x>=1?1:1-Math.exp(-5.5*x)*Math.cos(9.5*x);
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

// ---- Zaman çizelgesi ----
const T0=.25, TM=2.45, TB=3.05;      // yıldızlar belirir, çarpışma, dönüş biter
const R=132, D=120, SEP0=640, TURNS=2.6;
// Kepler benzeri: açısal hız ayrılığın -1,5 kuvvetiyle artar; çarpışmadan sonra söner.
function sepAt(t){
  if(t<TM){const u=cl((t-T0)/(TM-T0));return 264+(SEP0-264)*Math.pow(1-u,1.6);}
  return 264-(264-D)*spring(cl((t-TM)/(TB-TM)));
}
const DT=1/1200, TH=[]; let acc=0;
for(let t=0;t<=DUR+.01;t+=DT){
  let w=0;
  if(t>=T0&&t<TM) w=Math.pow(sepAt(t),-1.5);
  else if(t>=TM&&t<TB) w=Math.pow(264,-1.5)*Math.pow(1-(t-TM)/(TB-TM),2);
  acc+=w*DT; TH.push(acc);
}
const THEND=TH[Math.round(TB/DT)], KTH=TURNS*2*Math.PI/THEND;
function theta(t){
  const i=Math.max(0,Math.min(TH.length-1,Math.round(t/DT)));
  let th=-Math.PI/2-(THEND-TH[i])*KTH;
  if(t>TB){const q=t-TB;th+=.09*Math.exp(-5*q)*Math.sin(13*q);}
  return th;
}
window.THETA=(t)=>theta(t);
// Yıldız büyüklüğü: küçük ve parlak başlar, çarpışmada tam boy.
function rk(t){ if(t<T0) return 0; if(t<.7) return .3*eo(cl((t-T0)/.45)); if(t<TM) return .3+.7*eio(cl((t-.7)/(TM-.7))); return 1; }
const glowAmt=t=>t<TM?Math.min(1,(t-T0)/.3):1-eo(cl((t-TM)/.9));

// ---- Son düzen (dikey kilit) ----
const K=1.8, mt=256-192*K, mb=256+192*K, gap=110, base=mb+gap-BOX.y1, y2=base+BOX.y2;
const ww=BOX.x2-BOX.x1, width=Math.max(ww,264*K), TT=y2-mt;
const s=Math.min(.78*W/width,.62*H/TT), oy=H/2-(mt+TT/2)*s, sIn=s*K*1.18;

// ---- Arka plan yıldızları ve kıvılcımlar ----
const rs=rng(7), STARS=[...Array(170)].map(()=>({a:rs()*Math.PI*2,r:Math.sqrt(rs())*Math.hypot(W,H)*.55,z:.5+rs()*1.7,ph:rs()*6.3,f:1.5+rs()*3}));
const rp=rng(42), SPARK=[...Array(64)].map(()=>({a:rp()*Math.PI*2,v:.35+rp()*.75,z:1.5+rp()*3.5,c:[C.cyan,C.red,C.paper][Math.floor(rp()*3)],life:.6+rp()*.7}));

function circle(x,y,r){ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);}
function halo(x,y,r,col,a){
  if(a<=0)return;const g=ctx.createRadialGradient(x,y,r*.2,x,y,r*2.6);
  g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.globalAlpha=a;ctx.fillStyle=g;circle(x,y,r*2.6);ctx.fill();ctx.globalAlpha=1;
}
function orbs(t,cx,cy,sc){
  const sep=sepAt(t), th=theta(t), r=R*rk(t)*sc, h=sep/2*sc;
  return {c1:[cx+Math.cos(th)*h,cy+Math.sin(th)*h],c2:[cx-Math.cos(th)*h,cy-Math.sin(th)*h],r};
}

window.seek=function(t){
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.fillStyle=C.ink;ctx.fillRect(0,0,W,H);
  // İşaret yeri: ortada başlar, 4.1'den sonra yukarı kayar.
  const m=eio(cl((t-4.1)/.6));
  const tau=t-TM, punch=tau>0?.07*Math.exp(-7*tau)*Math.sin(Math.min(tau*14,Math.PI)):0;
  const sc=(sIn+(s*K-sIn)*m)*(1+punch);
  const cx=W/2, cy=H/2+((oy+256*s)-H/2)*m;

  // Yıldız alanı: yavaşça döner, sonda söner.
  const sf=cl(t/.6)*(1-.55*eo(cl((t-4.1)/1.2)));
  ctx.fillStyle=C.paper;
  for(const st of STARS){
    const a=st.a+t*.05*(1.2-st.r/Math.hypot(W,H)), x=W/2+Math.cos(a)*st.r, y=H/2+Math.sin(a)*st.r;
    ctx.globalAlpha=sf*(.18+.5*(.5+.5*Math.sin(t*st.f+st.ph)))*(st.z/2.2);
    circle(x,y,st.z);ctx.fill();
  }
  ctx.globalAlpha=1;

  // İz: geçmiş konumlar, toplamalı ışık.
  const g=glowAmt(t);
  if(t>T0){
    ctx.globalCompositeOperation='lighter';
    const trail=t<TM?1:1-cl((t-TM)/.35);
    for(let k=22;k>=1;k--){
      const tt=t-k*.012; if(tt<T0) continue;
      const o=orbs(tt,cx,cy,sc), f=(1-k/23);
      ctx.globalAlpha=.10*f*trail;
      ctx.fillStyle=C.cyan;circle(o.c1[0],o.c1[1],o.r*(.55+.45*f));ctx.fill();
      ctx.fillStyle=C.red;circle(o.c2[0],o.c2[1],o.r*(.55+.45*f));ctx.fill();
    }
    ctx.globalAlpha=1;
    const o=orbs(t,cx,cy,sc);
    halo(o.c1[0],o.c1[1],o.r,C.cyan,.55*g);halo(o.c2[0],o.c2[1],o.r,C.red,.55*g);
    ctx.globalCompositeOperation='source-over';
  }

  // Çarpışma: parlama, iki şok halkası, kıvılcımlar.
  if(tau>0&&tau<1.4){
    ctx.globalCompositeOperation='lighter';
    if(tau<.5){const p=tau/.5,fr=W*(.12+.3*p);const fg=ctx.createRadialGradient(cx,cy,0,cx,cy,fr);
      fg.addColorStop(0,'rgba(245,242,235,'+(.75*Math.pow(1-p,2))+')');fg.addColorStop(1,'rgba(245,242,235,0)');ctx.fillStyle=fg;circle(cx,cy,fr);ctx.fill();}
    for(const [dl,col,mx] of [[0,'245,242,235',.75],[.08,'20,200,232',.62],[.14,'255,61,94',.55]]){
      const p=cl((tau-dl)/.85);if(p<=0||p>=1)continue;
      ctx.strokeStyle='rgba('+col+','+(.6*Math.pow(1-p,1.4))+')';ctx.lineWidth=Math.max(1,16*(1-p));
      circle(cx,cy,W*.05+W*mx*eo(p));ctx.stroke();
    }
    for(const sp of SPARK){
      const p=tau/sp.life;if(p>=1)continue;
      const dist=(q)=>W*.62*sp.v*(1-Math.exp(-3.2*q))/1;
      const d1=dist(tau),d0=dist(Math.max(0,tau-.04));
      ctx.strokeStyle=sp.c;ctx.globalAlpha=Math.pow(1-p,1.3);ctx.lineWidth=sp.z*(1-p*.6);ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(cx+Math.cos(sp.a)*d0,cy+Math.sin(sp.a)*d0);ctx.lineTo(cx+Math.cos(sp.a)*d1,cy+Math.sin(sp.a)*d1);ctx.stroke();
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }

  // İşaret: iki daire, kesişim göz, bebek.
  if(t>T0){
    let o=orbs(t,cx,cy,sc), blink=0;
    // Kırpma: 3.75-3.97 arası göz kapanıp açılır; kapanırken bebek ince bir şerit olarak kalmasın.
    if(t>3.75&&t<3.97){const b=Math.sin(Math.PI*(t-3.75)/.22),sep=D+148*b,th=theta(t),h=sep/2*sc;blink=cl((b-.55)/.3);
      o={c1:[cx+Math.cos(th)*h,cy+Math.sin(th)*h],c2:[cx-Math.cos(th)*h,cy-Math.sin(th)*h],r:o.r};}
    ctx.fillStyle=C.cyan;circle(o.c1[0],o.c1[1],o.r);ctx.fill();
    ctx.fillStyle=C.red;circle(o.c2[0],o.c2[1],o.r);ctx.fill();
    ctx.save();circle(o.c1[0],o.c1[1],o.r);ctx.clip();
    ctx.fillStyle=C.ink;circle(o.c2[0],o.c2[1],o.r);ctx.fill();
    circle(o.c2[0],o.c2[1],o.r);ctx.clip();
    const ps=spring(cl((t-TB+.05)/.4)), look=t>3.25&&t<3.7?-18*Math.sin(Math.PI*(t-3.25)/.45):0;
    if(ps>0&&blink<1){
      const px=cx+look*sc, py=cy;
      ctx.globalAlpha=1-blink;
      ctx.fillStyle=C.paper;circle(px,py,40*sc*ps);ctx.fill();
      ctx.globalAlpha=cl((t-TB-.12)/.15)*(1-blink);ctx.fillStyle=C.ink;circle(px+15*sc*ps,py-15*sc*ps,9.6*sc*ps);ctx.fill();ctx.globalAlpha=1;
    }
    ctx.restore();
    // Işık süpürmesi: işaret son yerine oturunca soldan sağa parlak bir şerit geçer.
    const sw=cl((t-4.75)/.55);
    if(sw>0&&sw<1){
      ctx.save();circle(o.c1[0],o.c1[1],o.r);circle(o.c2[0],o.c2[1],o.r);
      ctx.beginPath();ctx.arc(o.c1[0],o.c1[1],o.r,0,Math.PI*2);ctx.arc(o.c2[0],o.c2[1],o.r,0,Math.PI*2);ctx.clip('nonzero');
      const x=cx-o.r*1.6+o.r*3.2*eio(sw);
      const lg=ctx.createLinearGradient(x-o.r*.5,0,x+o.r*.5,0);
      lg.addColorStop(0,'rgba(255,255,255,0)');lg.addColorStop(.5,'rgba(255,255,255,.35)');lg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.globalCompositeOperation='lighter';ctx.fillStyle=lg;ctx.fillRect(x-o.r*.5,cy-o.r*3,o.r,o.r*6);ctx.restore();
    }
  }

  // Yazı: harfler sırayla yükselir.
  const wx=W/2-ww*s/2-BOX.x1*s, wy=oy+base*s;
  for(let i=0;i<LET.length;i++){
    const p=eo(cl((t-4.35-i*.055)/.5)); if(p<=0) continue;
    ctx.save();ctx.globalAlpha=p;ctx.translate(wx,wy+(1-p)*120*s);ctx.scale(s,s);
    ctx.fillStyle=C.paper;ctx.fill(LET[i]);ctx.restore();
  }
};
seek(0);
</script>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const sizes = [['kare-1080', 1080, 1080], ['dikey-1080x1920', 1080, 1920]];
  for (const [name, W, H] of ONLY_FRAMES ? sizes.slice(0, 1) : sizes) {
    const html = path.join(OUT, `anim2-${name}.html`);
    fs.writeFileSync(html, page(W, H));
    const p = await b.newPage();
    await p.setViewport({ width: W, height: H });
    await p.goto('file:///' + html.replace(/\\/g, '/'));
    if (name === 'kare-1080') {
      const th = await p.evaluate((dur) => { const a = []; for (let t = 0; t <= dur; t += 1 / 1000) a.push(+window.THETA(t).toFixed(5)); return a; }, DUR);
      fs.writeFileSync(path.join(OUT, 'theta.json'), JSON.stringify({ dt: 1 / 1000, th }));
    }
    const checks = [10, 30, 60, 90, 120, 140, 147, 152, 160, 175, 190, 205, 230, 260, 290, 320, 383];
    if (ONLY_FRAMES) {
      for (const i of checks) { await p.evaluate((t) => window.seek(t), i / FPS); fs.writeFileSync(path.join(OUT, `k-${String(i).padStart(3, '0')}.png`), await p.screenshot({ type: 'png' })); }
      await p.close(); continue;
    }
    const mp4 = path.join(OUT, `sessiz-${name}.mp4`);
    const ff = spawn(FF, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-vf', 'tblend=all_mode=average,framestep=2,format=yuv420p', '-r', '30',
      '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', mp4]);
    ff.stderr.on('data', (d) => process.stderr.write(d));
    const n = Math.round(DUR * FPS);
    for (let i = 0; i < n; i++) {
      await p.evaluate((t) => window.seek(t), i / FPS);
      const buf = await p.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    await p.close();
    console.log('ok', mp4);
  }
  await b.close();
})();
