// Zevk eşleşmesi v3 — sentetik simülasyon (docs/ozellikler/ZEVK_ESLESMESI_ALGORITMA.md §12 sayılarının kaynağı).
// Uygulama kodu DEĞİL: formülleri ve sabitleri ölçümle sınamak için tek dosyalık deneme. Çalıştır: node docs/ozellikler/ZEVK_ESLESMESI_SIM.js [tohum]   (belgedeki tohumlar: 7, 11, 23)
"use strict";
let seed = Number(process.argv[2] || 7);
function rnd() { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function gauss() { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a) => Math.sqrt(dot(a, a)) || 1;
const cos = (a, b) => dot(a, b) / (norm(a) * norm(b));

// ── katalog ──
const D = 8, NT = 4000, NF = 36, VIS = 5;
const P = JSON.parse(process.env.P || "{}");
const proj = Array.from({ length: NF }, () => Array.from({ length: D }, gauss)); // özellik = gizli boyutların gürültülü izdüşümü
const titles = Array.from({ length: NT }, (_, i) => {
  const v = Array.from({ length: D }, gauss);
  const pop = 1 / Math.pow(i + 1, 0.85); // Zipf
  const quality = gauss();
  const feats = [];
  proj.forEach((p, f) => { let z = 0; for (let d = 0; d < VIS; d++) z += p[d] * v[d]; if (z / Math.sqrt(VIS) + 0.9 * gauss() > 1.1) feats.push(f); });
  return { i, v, pop, quality, feats, isSeries: rnd() < 0.4 };
});
const popSum = titles.reduce((s, t) => s + t.pop, 0);

// ── kullanıcılar ──
function makeUser(taste, n, opts = {}) {
  const bias = gauss() * 0.9, scale = 0.7 + rnd() * 0.9; // sert/cömert + dar/geniş ölçek
  const silent = opts.silent ?? false;
  const rateShare = silent ? 0 : (opts.rateShare ?? 0.5 + rnd() * 0.5);
  // seçim: popülerlik × zevk yakınlığı
  const w = titles.map((t) => t.pop * Math.exp((opts.sel ?? 1.1) * dot(taste, t.v) / Math.sqrt(D) * 2.2));
  const items = new Map();
  const total = w.reduce((s, x) => s + x, 0);
  let guard = 0;
  while (items.size < n && guard++ < n * 60) {
    let r = rnd() * total, k = 0;
    while ((r -= w[k]) > 0 && k < NT - 1) k++;
    if (items.has(k)) continue;
    const t = titles[k];
    const pref = 0.55 * (dot(taste, t.v) / Math.sqrt(D)) * 2.2 + 0.45 * t.quality; // gerçek beğeni
    const felt = pref + 0.45 * gauss(); // anlık his (ölçüm gürültüsü)
    items.set(k, feel({ k, pref }, bias, scale, rateShare));
  }
  const u = { taste, items, n: items.size, silent, bias, scale, rateShare };
  // dört favori
  [...items.values()].sort((a, b) => b.pref - a.pref).slice(0, 4).forEach((it) => (it.fav = true));
  return u;
}

function feel(it, bias, scale, rateShare) {
  const t = titles[it.k]; const felt = it.pref + 0.45 * gauss();
  const o = { k: it.k, pref: it.pref };
  if (rnd() < rateShare) o.rating = clamp(Math.round(6.2 + bias + scale * 1.7 * felt), 1, 10);
  if (felt > 1.3 && rnd() < 0.35) o.rewatch = true;
  if (t.isSeries) { if (felt < -0.5 && rnd() < 0.6) o.dropped = true; else if (rnd() < 0.8) o.finished = true; }
  return o;
}
function clone(u, rateShare) { const items = new Map(); u.items.forEach((it, k) => { const o = feel(it, u.bias, u.scale, rateShare); o.fav = it.fav; items.set(k, o); }); return { taste: u.taste, items, n: items.size, silent: rateShare === 0, bias: u.bias, scale: u.scale, rateShare }; }
// ── profil hazırlığı ──
const GLOBAL_S = (r) => clamp((r - 6.2) / 3.2, -1, 1);
const KINDS = ["fav", "rewatch", "dropped", "finished"];
const kindOf = (it) => KINDS.find((k) => it[k]) || null;
function explicitS(u) {
  const rated = [...u.items.values()].filter((it) => it.rating != null);
  const sorted = rated.map((it) => it.rating).sort((a, b) => a - b);
  const lam = rated.length / (rated.length + 10);
  const pct = (r) => { let lo = 0, eq = 0; for (const x of sorted) { if (x < r) lo++; else if (x === r) eq++; } return (lo + eq / 2) / sorted.length; };
  const out = new Map();
  for (const it of rated) out.set(it.k, lam * (2 * pct(it.rating) - 1) + (1 - lam) * GLOBAL_S(it.rating));
  return out;
}
// örtük sinyal tablosu: puan verenlerin verisinden öğrenilir (davranış → ortalama s)
function learnImplicit(list) {
  const acc = {}; KINDS.forEach((k) => (acc[k] = { s: 0, n: 0 }));
  const xs = [], ys = [];
  const per = list.map((u) => ({ u, ex: explicitS(u) }));
  for (const { u, ex } of per) for (const [k, s] of ex) { const kind = kindOf(u.items.get(k)); if (kind) { acc[kind].s += s; acc[kind].n++; } }
  const table = {}; KINDS.forEach((k) => (table[k] = acc[k].n ? acc[k].s / acc[k].n : 0));
  for (const { u, ex } of per) for (const [k, s] of ex) { const kind = kindOf(u.items.get(k)); if (kind) { xs.push(table[kind]); ys.push(s); } }
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let n = 0, dx = 0, dy = 0; xs.forEach((x, i) => { n += (x - mx) * (ys[i] - my); dx += (x - mx) ** 2; dy += (ys[i] - my) ** 2; });
  return { table, rie: n / Math.sqrt(dx * dy) };
}
function prepare(u, ctx) {
  const ex = explicitS(u);
  u.sig = new Map(); // k -> { s, d, x } : tercih, artık, açık mı
  const m = { e: [0, 0], i: [0, 0] };
  for (const it of u.items.values()) {
    let s = null, x = false;
    if (ex.has(it.k)) { s = ex.get(it.k); x = true; }
    else { const kind = kindOf(it); if (kind) s = ctx.imp.table[kind]; }
    if (s == null) continue;
    const d = s - ctx.gamma * ctx.crowd[it.k];
    u.sig.set(it.k, { s, d, x });
    const q = x ? m.e : m.i; q[0] += d * d; q[1]++;
  }
  // kütüphane genelinde beklenen sinyal büyüklüğü (tür başına); küçük örnekte nüfus değerine çekilir
  u.Me = (m.e[0] + 8 * ctx.M0e) / (m.e[1] + 8); u.Mi = (m.i[0] + 8 * ctx.M0i) / (m.i[1] + 8);
  u.wSum = 0; for (const k of u.items.keys()) u.wSum += ctx.idf[k];
  const build = (pick) => { const p = new Array(NF + 3).fill(0); let c = 0; for (const it of u.items.values()) { if (!pick(c++)) continue; const g = u.sig.get(it.k); const wt = g ? (g.s >= 0 ? 0.4 + g.s : 0.6 * g.s) : 0.35; const t = titles[it.k]; for (const f of t.feats) p[f] += wt * ctx.fidf[f]; p[NF + ctx.popTier[it.k]] += wt * 0.7; } const n = norm(p); return p.map((x) => x / n); };
  u.prof = build(() => true); u.h1 = build((c) => c % 2 === 0); u.h2 = build((c) => c % 2 === 1);
}
function center(u, mean) { const c = (p) => p.map((x, i) => x - mean[i]); u.cprof = c(u.prof); const r = cos(c(u.h1), c(u.h2)); u.rel = clamp((2 * r) / (1 + r), 0.3, 0.98); }

// ── v3 skor ──
const C = Object.assign({ W1: 0.45, W3: 0.25, W4: 0.30, REL_E: 0.75, H1: 6, H3: 3, H4: 3, SCALE: 1.1, CAP: 25, ZREF: 9, E3R: 0.12, E4MAX: 25, K1MIN: 0.6, PRI: 0.5 }, P);
function selZ(raw, ng, ctx) { const l = Math.log(ng); const med = ctx.sel.ma + ctx.sel.mb * l, mad = Math.max(0.004, ctx.sel.da + ctx.sel.db * l); return (raw - med) / mad; }
function parts3(a, b, ctx) {
  const qI = (ctx.imp.rie / C.REL_E) ** 2; // örtük sinyalin açık puana göre bilgi ağırlığı
  const cEE = C.REL_E, cEI = ctx.imp.rie;
  let num = 0, den = 0, e1 = 0, nSig = 0;
  const [sm, lg] = a.sig.size <= b.sig.size ? [a, b] : [b, a];
  for (const [k, ga] of sm.sig) {
    const gb = lg.sig.get(k); if (!gb) continue;
    const c = ga.x && gb.x ? cEE : ga.x || gb.x ? cEI : cEE;
    const q = Math.sqrt((ga.x ? 1 : qI) * (gb.x ? 1 : qI));
    const w = ctx.idf[k] * q;
    num += w * ga.d * gb.d;
    den += w * c * Math.sqrt((ga.x ? sm.Me : sm.Mi) * (gb.x ? lg.Me : lg.Mi));
    e1 += q; nSig++;
  }
  const K1 = den > 0 ? clamp(num / den, -1, 1) : null;
  let wc = 0, common = 0; const [s2, l2] = a.n <= b.n ? [a, b] : [b, a];
  for (const k of s2.items.keys()) if (l2.items.has(k)) { wc += ctx.idf[k]; common++; }
  const rawSel = wc / Math.sqrt(a.wSum * b.wSum);
  const ng = Math.sqrt(a.n * b.n);
  const K4 = clamp(cos(a.cprof, b.cprof) / Math.sqrt(a.rel * b.rel), -1, 1);
  return { K1, e1, nSig, rawSel, ng, common, K4 };
}
function scoreV3(a, b, ctx) {
  const r = parts3(a, b, ctx);
  const z = selZ(r.rawSel, r.ng, ctx);
  const K3 = clamp(z / C.ZREF, -0.2, 1);
  const rr = Math.sqrt(a.rel * b.rel);
  const E3 = C.E3R * Math.min(a.n, b.n), E4 = Math.min(C.E4MAX, 4 * rr / (1 - rr));
  // bileşen bazında güven daraltması: kanıt azsa bileşen kendi ön değerine çekilir
  const K3s = (E3 * K3) / (E3 + C.H3), K4s = (E4 * r.K4) / (E4 + C.H4);
  const prior1 = C.PRI * Math.max(0, Math.min(K3s, K4s)); // görüş bilinmiyorsa: diğer kanıtın yarısı kadar
  const K1s = ((r.e1 || 0) * (r.K1 ?? 0) + C.H1 * prior1) / ((r.e1 || 0) + C.H1);
  const raw = C.W1 * K1s + C.W3 * K3s + C.W4 * K4s;
  const E = r.e1 + E3 + E4;
  const fin = raw * (C.SCALE || 1);
  const ratio = Math.max(a.n, b.n) / Math.min(a.n, b.n);
  const cap = Math.max(0.6, 1 - (C.CAP / 100) * Math.log10(ratio));
  let sc = Math.min(fin, cap, 1 - 0.30 * Math.exp(-(r.e1 || 0) / 20));
  if (r.K1 != null && r.e1 >= 6 && r.K1 < C.K1MIN) sc = Math.min(sc, 0.85); // görüş uyumu zayıfsa ikiz olamaz
  return { score: 100 * sc, raw, K1: r.K1, K3, K4: r.K4, E, e1: r.e1, common: r.common, rawSel: r.rawSel, cap: cap * 100, z, ng: r.ng };
}
// ── v2 benzeri taban (mevcut tasteMatch'in özü) ──
function scoreV2(a, b) {
  let common = 0; const xs = [], ys = [];
  const [s, l] = a.n <= b.n ? [a, b] : [b, a];
  for (const [k, it] of s.items) { const o = l.items.get(k); if (!o) continue; common++; if (it.rating != null && o.rating != null) { xs.push(it.rating); ys.push(o.rating); } }
  const overlap = Math.sqrt(common / s.n);
  let rat = null; if (xs.length >= 3) { const gap = xs.reduce((q, x, i) => q + Math.abs(x - ys[i]), 0) / xs.length; rat = clamp(1 - gap / 4, 0, 1); }
  const g = clamp(cos(a.prof, b.prof), 0, 1);
  const parts = [[0.4, g], [0.3, overlap]]; if (rat != null) parts.push([0.3, rat]);
  return 100 * parts.reduce((q, [w, v]) => q + w * v, 0) / parts.reduce((q, [w]) => q + w, 0);
}

// ── nüfus ──
const NC = 14;
const centers = Array.from({ length: NC }, () => Array.from({ length: D }, gauss));
const users = [];
const sizes = () => Math.round(clamp(Math.exp(4.9 + 0.8 * gauss()), 40, 1200));
for (let i = 0; i < 320; i++) {
  const c = centers[Math.floor(rnd() * NC)];
  const spread = rnd() < 0.5 ? 0.25 : 0.9; // yarısı merkeze çok yakın (ikiz adayı), yarısı gevşek
  const taste = c.map((x) => x + spread * gauss());
  users.push(makeUser(taste, sizes(), { silent: rnd() < 0.25 }));
}
// bağlam: kalabalık puanı, idf, özellik idf
const cnt = new Array(NT).fill(0); users.forEach((u) => u.items.forEach((_, k) => cnt[k]++));
const ctx = { gamma: 0.45, crowd: titles.map((t) => clamp(t.quality / 2, -1, 1)), idf: cnt.map((c) => clamp(Math.log(1 + users.length / (1 + c)) / Math.log(1 + users.length / 2), 0.15, 2.2)), popTier: titles.map((t) => (t.i < 150 ? 0 : t.i < 900 ? 1 : 2)) };
const fcnt = new Array(NF).fill(1); titles.forEach((t) => t.feats.forEach((f) => fcnt[f]++));
ctx.fidf = fcnt.map((c) => Math.log(NT / c));
ctx.imp = learnImplicit(users.filter((u) => !u.silent));
ctx.M0e = 0.3; ctx.M0i = 0.1;
function prepAll(list) { list.forEach((u) => prepare(u, ctx)); }
prepAll(users);
{ let se = 0, ne = 0, si = 0, ni = 0; users.forEach((u) => u.sig.forEach((g) => { if (g.x) { se += g.d * g.d; ne++; } else { si += g.d * g.d; ni++; } })); ctx.M0e = se / ne; ctx.M0i = si / ni; prepAll(users); }
const meanProf = new Array(NF + 3).fill(0); users.forEach((u) => u.prof.forEach((x, i) => (meanProf[i] += x / users.length)));
users.forEach((u) => center(u, meanProf));
// seçim tavanı: büyüklük kovası başına üst yüzdelik, ln(n) üzerinde doğrusal uydurma
ctx.sel = { a: 0, b: 0.1, e0: 0 };
{ const B = new Map(); const all = [];
  for (let i = 0; i < users.length; i++) for (let j = i + 1; j < users.length; j++) { const a = users[i], b = users[j]; if (Math.max(a.n, b.n) / Math.min(a.n, b.n) > 1.6) continue; const r = parts3(a, b, ctx); all.push(r.rawSel); const key = Math.round(Math.log2(r.ng) * 2); if (!B.has(key)) B.set(key, []); B.get(key).push(r.rawSel); }
  // şans dağılımı: kova başına medyan ve MAD (çiftlerin çoğu şans çiftidir → sağlam)
  const pts = []; for (const [key, arr] of B) { if (arr.length < 150) continue; arr.sort((x, y) => x - y); const med = arr[Math.floor(arr.length / 2)]; const dev = arr.map((x) => Math.abs(x - med)).sort((x, y) => x - y); pts.push([Math.log(Math.pow(2, key / 2)), med, dev[Math.floor(dev.length / 2)]]); }
  const fit = (j) => { const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[j], 0) / pts.length; const bb = pts.reduce((s, p) => s + (p[0] - mx) * (p[j] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0); return [my - bb * mx, bb]; };
  const [ma, mb] = fit(1), [da, db] = fit(2); ctx.sel = { ma, mb, da, db };
  console.log(`öğrenilen: örtük tablo ${JSON.stringify(Object.fromEntries(Object.entries(ctx.imp.table).map(([k, v]) => [k, +v.toFixed(2)])))} r_ie=${ctx.imp.rie.toFixed(2)} | seçim şans medyanı n=50→${(ma + mb * Math.log(50)).toFixed(3)} 200→${(ma + mb * Math.log(200)).toFixed(3)} 600→${(ma + mb * Math.log(600)).toFixed(3)}; MAD 50→${(da + db * Math.log(50)).toFixed(3)} 200→${(da + db * Math.log(200)).toFixed(3)} 600→${(da + db * Math.log(600)).toFixed(3)}`); }
// gerçek tavanlar (aynı kişinin yeniden ölçümü): yalnız simülasyonda bilinebilir
{ const pick = users.filter((u) => u.n >= 150).slice(0, 40); const m = { EE: [], EI: [], II: [] };
  for (const u of pick) { const a = clone(u, 1), b = clone(u, 1), c = clone(u, 0), d = clone(u, 0); [a, b, c, d].forEach((x) => { prepare(x, ctx); center(x, meanProf); });
    const raw = (p, q) => { let num = 0, den = 0; for (const [k, ga] of p.sig) { const gb = q.sig.get(k); if (!gb) continue; num += ga.d * gb.d; den += Math.sqrt((ga.x ? p.Me : p.Mi) * (gb.x ? q.Me : q.Mi)); } return num / den; };
    m.EE.push(raw(a, b)); m.EI.push(raw(a, c)); m.II.push(raw(c, d)); }
  const av = (v) => (v.reduce((s, x) => s + x, 0) / v.length).toFixed(2);
  console.log(`gerçek tavan (yeniden ölçüm): EE ${av(m.EE)} EI ${av(m.EI)} II ${av(m.II)} | kullanılan: EE ${C.REL_E} EI ${ctx.imp.rie.toFixed(2)} II ${((ctx.imp.rie ** 2) / C.REL_E).toFixed(2)}`); }

// ── ölçüm ──
function spearman(xs, ys) { const rk = (v) => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(v.length); o.forEach(([, i], j) => (r[i] = j)); return r; }; const a = rk(xs), b = rk(ys); const m = (a.length - 1) / 2; let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - m) * (b[i] - m); da += (a[i] - m) ** 2; db += (b[i] - m) ** 2; } return n / Math.sqrt(da * db); }
const pairs = [];
for (let i = 0; i < users.length; i++) for (let j = i + 1; j < users.length; j++) {
  const a = users[i], b = users[j];
  const r = scoreV3(a, b, ctx);
  pairs.push({ t: cos(a.taste, b.taste), v3: r.score, e1: r.e1, v2: scoreV2(a, b), r, ratio: Math.max(a.n, b.n) / Math.min(a.n, b.n), silent: (a.silent ? 1 : 0) + (b.silent ? 1 : 0), minN: Math.min(a.n, b.n) });
}
const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const fmt = (x) => (x == null ? "  -  " : x.toFixed(2));
console.log(`çift ${pairs.length}  | Spearman(gerçek, v3)=${spearman(pairs.map((p) => p.t), pairs.map((p) => p.v3)).toFixed(3)}  v2=${spearman(pairs.map((p) => p.t), pairs.map((p) => p.v2)).toFixed(3)}`);
const rnd0 = pairs.filter((p) => p.t < 0.3);
console.log(`rastgele çift (gerçek<0.3): v3 medyan ${q(rnd0.map((p) => p.v3), 0.5).toFixed(1)} p99 ${q(rnd0.map((p) => p.v3), 0.99).toFixed(1)} | v2 medyan ${q(rnd0.map((p) => p.v2), 0.5).toFixed(1)} p99 ${q(rnd0.map((p) => p.v2), 0.99).toFixed(1)}`);
const twins = pairs.filter((p) => p.t >= 0.93);
console.log(`gerçek ikiz (gerçek≥0.93): ${twins.length} çift, v3 medyan ${q(twins.map((p) => p.v3), 0.5).toFixed(1)} p10 ${q(twins.map((p) => p.v3), 0.1).toFixed(1)} p90 ${q(twins.map((p) => p.v3), 0.9).toFixed(1)}`);
const twinsEq = twins.filter((p) => p.ratio <= 2 && p.minN >= 120);
console.log(`  denk+veri zengin ikiz: ${twinsEq.length}, v3 medyan ${q(twinsEq.map((p) => p.v3), 0.5).toFixed(1)}; K1 ${fmt(q(twinsEq.map((p) => p.r.K1 ?? 0), 0.5))} K3 ${fmt(q(twinsEq.map((p) => p.r.K3), 0.5))} K4 ${fmt(q(twinsEq.map((p) => p.r.K4), 0.5))} hamSeçim ${fmt(q(twinsEq.map((p) => p.r.rawSel), 0.5))} E ${q(twinsEq.map((p) => p.r.E), 0.5).toFixed(0)}`);
for (const th of [80, 85, 90, 93]) {
  for (const key of ["v3", "v2"]) {
    const hit = pairs.filter((p) => p[key] >= th);
    const good = hit.filter((p) => p.t >= 0.9).length, ok = hit.filter((p) => p.t >= 0.8).length;
    const rec = hit.filter((p) => p.t >= 0.93).length / Math.max(1, twins.length);
    console.log(`eşik ${th} ${key}: ${String(hit.length).padStart(5)} çift | gerçek≥0.90 %${((100 * good) / Math.max(1, hit.length)).toFixed(0)} | gerçek≥0.80 %${((100 * ok) / Math.max(1, hit.length)).toFixed(0)} | ikiz yakalama %${(100 * rec).toFixed(0)}`);
  }
}
const sil = twins.filter((p) => p.silent === 2 && p.ratio <= 2), mix = twins.filter((p) => p.silent === 1 && p.ratio <= 2), exp = twins.filter((p) => p.silent === 0 && p.ratio <= 2);
console.log(`ikizlerde (oran≤2) v3 medyan — puanlı-puanlı ${exp.length ? q(exp.map((p) => p.v3), 0.5).toFixed(1) : "-"} (${exp.length}) | karışık ${mix.length ? q(mix.map((p) => p.v3), 0.5).toFixed(1) : "-"} (${mix.length}) | sessiz-sessiz ${sil.length ? q(sil.map((p) => p.v3), 0.5).toFixed(1) : "-"} (${sil.length})`);

// ── senaryolar ──
function scenario(name, a, b) { [a, b].forEach((u) => { prepare(u, ctx); center(u, meanProf); }); const r = scoreV3(a, b, ctx); console.log(`${name.padEnd(58)} v3 ${r.score.toFixed(1).padStart(5)} v2 ${scoreV2(a, b).toFixed(1).padStart(5)} | K1 ${fmt(r.K1)} K3 ${fmt(r.K3)} K4 ${fmt(r.K4)} E ${r.E.toFixed(0)} ortak ${r.common} tavan ${r.cap.toFixed(0)}`); return r; }
const avg = (name, f, n = 12) => { let s3 = 0, lines = []; const old = console.log; console.log = (x) => lines.push(x); const rs = []; for (let i = 0; i < n; i++) rs.push(f()); console.log = old; const m = (g) => rs.reduce((s, r) => s + g(r), 0) / n; console.log(`${name.padEnd(52)} v3 ort ${m((r) => r.score).toFixed(1)} (min ${Math.min(...rs.map((r) => r.score)).toFixed(1)} max ${Math.max(...rs.map((r) => r.score)).toFixed(1)}) | K1 ${fmt(m((r) => r.K1 ?? 0))} K3 ${fmt(m((r) => r.K3))} K4 ${fmt(m((r) => r.K4))} E ${m((r) => r.E).toFixed(0)} ortak ${m((r) => r.common).toFixed(0)}`); };
const T = () => centers[3].map((x) => x + 0.15 * gauss());
const near = (t, e) => t.map((x) => x + e * gauss());
console.log("\n— senaryolar (12 tekrar ortalaması) —");
avg("ikiz, 200/200, puanlı", () => { const t = T(); return scenario("", makeUser(t, 200, { rateShare: 0.8 }), makeUser(near(t, 0.1), 200, { rateShare: 0.8 })); });
avg("ikiz, 80/80, puanlı", () => { const t = T(); return scenario("", makeUser(t, 80, { rateShare: 0.8 }), makeUser(near(t, 0.1), 80, { rateShare: 0.8 })); });
avg("ikiz, 40/40, puanlı", () => { const t = T(); return scenario("", makeUser(t, 40, { rateShare: 0.8 }), makeUser(near(t, 0.1), 40, { rateShare: 0.8 })); });
avg("ikiz, 200/200, sessiz-sessiz", () => { const t = T(); return scenario("", makeUser(t, 200, { silent: true }), makeUser(near(t, 0.1), 200, { silent: true })); });
avg("ikiz, 400/400, sessiz-sessiz", () => { const t = T(); return scenario("", makeUser(t, 400, { silent: true }), makeUser(near(t, 0.1), 400, { silent: true })); });
avg("ikiz, 200/200, biri sessiz", () => { const t = T(); return scenario("", makeUser(t, 200, { rateShare: 0.8 }), makeUser(near(t, 0.1), 200, { silent: true })); });
avg("ikiz zevk, 100 vs 1000 (bağımsız seçim)", () => { const t = T(); return scenario("", makeUser(t, 100, { rateShare: 0.8 }), makeUser(near(t, 0.1), 1000, { rateShare: 0.8 })); });
avg("100 ⊂ 1000 (alt küme, aynı puanlar)", () => { const t = T(); const big = makeUser(t, 1000, { rateShare: 0.8 }); const small = { taste: t, items: new Map(), silent: false }; [...big.items.values()].slice(0, 100).forEach((it) => small.items.set(it.k, { ...it, fav: false })); small.n = small.items.size; return scenario("", small, big); });
avg("aynı tür, farklı zevk (gevşek küme), 200/200", () => { return scenario("", makeUser(near(centers[3], 0.9), 200, { rateShare: 0.8 }), makeUser(near(centers[3], 0.9), 200, { rateShare: 0.8 })); });
avg("aynı yapımlar, zıt puanlar", () => { const t = T(); const a = makeUser(t, 200, { rateShare: 0.9 }); const b = { taste: t.map((x) => -x), items: new Map(), silent: false }; a.items.forEach((it, k) => b.items.set(k, { k, pref: -it.pref, rating: it.rating != null ? 11 - it.rating : undefined })); b.n = b.items.size; return scenario("", a, b); });
avg("ikiz ama biri sert biri cömert (ölçek kaydırma)", () => { const t = T(); const a = makeUser(t, 200, { rateShare: 0.9 }); const b = makeUser(near(t, 0.1), 200, { rateShare: 0.9 }); b.items.forEach((it) => { if (it.rating != null) it.rating = clamp(Math.round(it.rating * 0.6 + 1), 1, 10); }); return scenario("", a, b); });
avg("iki ana akım izleyici (yalnız gişe, zevk farklı)", () => scenario("", makeUser(near(centers[1], 0.3), 150, { rateShare: 0.8, sel: 0.15 }), makeUser(near(centers[8], 0.3), 150, { rateShare: 0.8, sel: 0.15 })));
avg("rastgele iki kişi, 200/200", () => scenario("", makeUser(near(centers[1], 0.3), 200, { rateShare: 0.8 }), makeUser(near(centers[8], 0.3), 200, { rateShare: 0.8 })));
avg("2 ortak film, ikisine de 10 (40/40, ayrı zevk)", () => { const a = makeUser(near(centers[1], 0.3), 40, { rateShare: 0.1 }); const b = makeUser(near(centers[8], 0.3), 40, { rateShare: 0.1 }); [0, 1].forEach((k) => { a.items.set(k, { k, pref: 2, rating: 10 }); b.items.set(k, { k, pref: 2, rating: 10 }); }); a.n = a.items.size; b.n = b.items.size; return scenario("", a, b); });
// seçim z değeri: gerçek ikizlerde büyüklük kovasına göre
{ const by = {}; for (const p of pairs) { if (p.t < 0.93 || p.ratio > 1.6) continue; const k = p.r.ng < 80 ? "40-80" : p.r.ng < 160 ? "80-160" : p.r.ng < 320 ? "160-320" : "320+"; (by[k] = by[k] || []).push(p.r.z); } console.log("ikizlerde seçim z medyanı: " + Object.entries(by).map(([k, v]) => `${k}: ${q(v, 0.5).toFixed(1)} (${v.length})`).join(" | ")); }
