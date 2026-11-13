// __tests__/helpers/tasteSynth.js
//
// Zevk eşleşmesi v3 için SENTETİK dünya üreticisi (test ve simülasyon yardımcısı; uygulama kodu değil).
// docs/ozellikler/ZEVK_ESLESMESI_SIM.js içindeki üreticinin utils/tasteMatchV3.js girdi biçimine
// uyarlanmış hâli. Her yapımın ve kullanıcının D boyutlu gizli bir zevk vektörü var; üstveri
// (özellikler) bu boyutların yalnız VIS tanesini görüyor. "Gerçek benzerlik" = gizli vektörlerin kosinüsü.

export function createWorld({ seed = 7, titles: NT = 4000, dims: D = 8, visible: VIS = 5, features: NF = 36 } = {}) {
  let state = seed | 0;
  const rnd = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (!u) u = rnd();
    while (!v) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const cos = (a, b) => dot(a, b) / (Math.sqrt(dot(a, a) * dot(b, b)) || 1);

  const proj = Array.from({ length: NF }, () => Array.from({ length: D }, gauss));
  const catalog = Array.from({ length: NT }, (_, i) => {
    const v = Array.from({ length: D }, gauss);
    const pop = 1 / (i + 1) ** 0.85; // Zipf
    const quality = gauss();
    const features = [];
    proj.forEach((p, f) => {
      let z = 0;
      for (let d = 0; d < VIS; d += 1) z += p[d] * v[d];
      if (z / Math.sqrt(VIS) + 0.9 * gauss() > 1.1) features.push(`f:${f}`);
    });
    features.push(`pop:${i < 150 ? 0 : i < 900 ? 1 : 2}`);
    return {
      i,
      key: `movie:${i + 1}`,
      v,
      quality,
      isSeries: rnd() < 0.4,
      voteAverage: Math.round((6.6 + 0.7 * quality) * 10) / 10,
      voteCount: Math.round(20000 * pop) + 5,
      features,
    };
  });

  function feel(title, pref, bias, scale, rateShare) {
    const felt = pref + 0.45 * gauss();
    const it = { key: title.key, voteAverage: title.voteAverage, voteCount: title.voteCount, features: title.features };
    if (rnd() < rateShare) it.rating = clamp(Math.round(6.2 + bias + scale * 1.7 * felt), 1, 10);
    if (felt > 1.3 && rnd() < 0.35) it.watchCount = 2;
    if (title.isSeries) {
      if (felt < -0.5 && rnd() < 0.6) it.tv = { dropped: true };
      else if (rnd() < 0.8) it.tv = { finished: true };
    }
    return it;
  }

  /**
   * @param {number[]} taste gizli zevk vektörü
   * @param {number} n izlenen yapım sayısı
   * @param {{ silent?: boolean, rateShare?: number, sel?: number }} [opts]
   */
  function makeUser(taste, n, opts = {}) {
    const bias = gauss() * 0.9;
    const scale = 0.7 + rnd() * 0.9;
    const silent = opts.silent ?? false;
    const rateShare = silent ? 0 : opts.rateShare ?? 0.5 + rnd() * 0.5;
    const sel = opts.sel ?? 1.1;
    const w = catalog.map((t, i) => (1 / (i + 1) ** 0.85) * Math.exp((sel * dot(taste, t.v)) / Math.sqrt(D) * 2.2));
    const total = w.reduce((s, x) => s + x, 0);
    const picked = new Map();
    let guard = 0;
    while (picked.size < n && guard++ < n * 60) {
      let r = rnd() * total;
      let k = 0;
      while ((r -= w[k]) > 0 && k < NT - 1) k += 1;
      if (picked.has(k)) continue;
      const t = catalog[k];
      const pref = 0.55 * (dot(taste, t.v) / Math.sqrt(D)) * 2.2 + 0.45 * t.quality;
      picked.set(k, { t, pref });
    }
    const items = [...picked.values()].map(({ t, pref }) => ({ ...feel(t, pref, bias, scale, rateShare), _pref: pref }));
    [...items].sort((a, b) => b._pref - a._pref).slice(0, 4).forEach((it) => { it.favorite = true; });
    items.forEach((it) => delete it._pref);
    return { taste, items, silent, n: items.length };
  }

  const centers = (k) => Array.from({ length: k }, () => Array.from({ length: D }, gauss));
  const near = (t, e) => t.map((x) => x + e * gauss());

  return { rnd, gauss, cos, catalog, makeUser, centers, near, dims: D };
}
