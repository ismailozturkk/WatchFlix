// utils/weatherUniverses.js
//
// Atmosferin "evren" sahneleri: 7 film, 6 dizi, 6 anime. Her sahne bir ANA OLAY
// (ejderha gelir → duvara ateş üfler → gider) ve 2–3 sürekli arka hareketten
// (kar, kuzgun, kod yağmuru) kurulu "yaşayan döngü". Hepsi motorun saf, kare
// başına state'siz modelinde: konum/opaklık/şekil karesi yalnız saatten.
//
// Analiz ve kurallar: docs/planlama/ATMOSFER_EVRENLER.md
//   • logo / amblem YOK; "esinli silüet" (genel nesneler). İstisna (kullanıcı isteği): Rick and Morty
//     karakterleri, Spider-Man ve Falcon çizimleri, Batman'in yarasa işareti jenerik yarasa silüeti
//   • olaylar SEYREK gelir: track/emit/overlay `rest` katı (dönem = olay süresi × rest), 1–2 dk'da bir
//   • ışığa duyarlılık: çakma yok, ateş ve parlama yumuşak (≤ 3 çakma/sn kuralı)
//   • büyük silüetler alt bantta, düşük opaklıkta (içerik önde okunur)
//
// Bu dosya motoru (utils/weatherParticles.js) İÇE AKTARMAZ: motor bunu aktarır
// ve sahne kurucularına araç takımını (kit) çağrı anında verir — döngüsel bağ yok.
//
// Hareket dili (motorda):
//   KIND.track  anahtar karelerle rota: [u, x, y, boy, açı, opaklık, kare, yumuşak, dy]
//               (x/y ekran oranı, dy dp × ölçek — kıyı katmanıyla aynı ölçek), takipçi
//               (tlag), döngü başına kayma (jitter), süzülme (bob), gidişe dönme (face),
//               kare değişimi (framed: yüzen ördek → uçan ördek; bütün elma → ısırılmış)
//   KIND.emit   rotanın (ya da sabit noktanın) saçılma anındaki konumundan pencerede
//               saçılan parçacık: ateş, buhar, kum fışkırması, mermi halkası, lazer
//   OVERLAY.tether  çapadan rotadaki gövdeye ip (ağ, ODM halatı, saat zinciri)

// ── Evren listesi ve TMDB eşlemesi ─────────────────────────────────────────
// Kimlikler TMDB'den doğrulandı (10 Kas 2026). Filmler KOLEKSİYON kimliğiyle
// (serideki her film), koleksiyonsuz filmler film kimliğiyle; diziler dizi kimliğiyle.

export const UNIVERSES = Object.freeze([
  // filmler
  { id: "starWars", group: "films", collections: [10], movies: [330459, 348350] }, // + Rogue One, Solo
  { id: "matrix", group: "films", collections: [2344] },
  { id: "harryPotter", group: "films", collections: [1241, 435259] }, // + Fantastik Canavarlar
  { id: "lotr", group: "films", collections: [119, 121938] }, // + Hobbit
  { id: "dune", group: "films", collections: [726871], movies: [841] }, // + Dune (1984)
  { id: "batman", group: "films", collections: [120794, 263, 948485] },
  { id: "spiderMan", group: "films", collections: [556, 531241, 125574, 573436] },
  // diziler
  { id: "breakingBad", group: "series", tv: [1396] },
  { id: "got", group: "series", tv: [1399] },
  { id: "vikings", group: "series", tv: [44217, 116135] }, // + Valhalla
  { id: "prisonBreak", group: "series", tv: [2288] },
  { id: "sherlock", group: "series", tv: [19885] },
  { id: "sopranos", group: "series", tv: [1398] },
  // anime
  { id: "deathNote", group: "anime", tv: [13916] },
  { id: "aot", group: "anime", tv: [1429] },
  { id: "naruto", group: "anime", tv: [46260, 31910] }, // + Shippūden
  { id: "onePiece", group: "anime", tv: [37854, 111110] }, // + canlı çekim
  { id: "fma", group: "anime", tv: [31911] },
  { id: "rickAndMorty", group: "anime", tv: [60625] },
].map((u) => Object.freeze(u)));

export const UNIVERSE_IDS = Object.freeze(UNIVERSES.map((u) => u.id));

/** Seçici grupları (motor WEATHER_GROUPS'a ekler). */
export const UNIVERSE_GROUPS = Object.freeze(
  ["films", "series", "anime"].map((id) =>
    Object.freeze({ id, effects: Object.freeze(UNIVERSES.filter((u) => u.group === id).map((u) => u.id)) }),
  ),
);

const byKey = (field) => {
  const m = new Map();
  for (const u of UNIVERSES) for (const k of u[field] || []) m.set(Number(k), u.id);
  return m;
};
const BY_COLLECTION = byKey("collections");
const BY_MOVIE = byKey("movies");
const BY_TV = byKey("tv");

/**
 * Detay ekranındaki yapımın evreni ya da null.
 * @param {{type?: "movie"|"tv", id?: number|string, collectionId?: number|string}} title
 */
export function universeFor(title) {
  if (!title || typeof title !== "object") return null;
  const id = Number(title.id);
  const col = Number(title.collectionId);
  if (title.type === "tv") return (Number.isFinite(id) && BY_TV.get(id)) || null;
  if (Number.isFinite(col) && BY_COLLECTION.has(col)) return BY_COLLECTION.get(col);
  return (Number.isFinite(id) && BY_MOVIE.get(id)) || null;
}

/** Kararlı anahtar (bellekleme için). */
export const universeTitleKey = (title) =>
  title && typeof title === "object" ? `${title.type || ""}:${title.id ?? ""}:${title.collectionId ?? ""}` : "";

// ── Katalog: bileşikler ve sayılar ─────────────────────────────────────────

const p2 = (dark, light) => ({ dark, light });
const NEUTRAL = p2(["#ffffff"], ["#000000"]); // sahne kurucusu renkleri kendisi seçer
const ONE = Object.freeze({ low: 1, medium: 1, high: 1 });
const c3 = (low, medium, high) => ({ low, medium, high });

// Parçalar sırayla çizilir (sonraki öndedir). Sabit sayılar (fixed) yoğunluktan
// bağımsız sahne; paylar (oran) yoğunlukla ölçeklenen ortam (kar, kod yağmuru...).
export const UNIVERSE_COMPOSITES = Object.freeze({
  starWars: Object.freeze([["skyStars", 1], ["swPlanet", { fixed: 1 }], ["swScene", { fixed: 125 }]]),
  matrix: Object.freeze([["matrixRain", 1], ["matrixScene", { fixed: 33 }]]),
  harryPotter: Object.freeze([["skyStars", 0.45], ["magicMotes", 0.55], ["hogwarts", { fixed: 1 }], ["hpScene", { fixed: 29 }]]),
  lotr: Object.freeze([["mordor", { fixed: 1 }], ["embers", 0.7], ["ash", 0.3], ["lotrScene", { fixed: 4 }]]),
  dune: Object.freeze([["dunes", { fixed: 1 }], ["sandDrift", 1], ["duneScene", { fixed: 84 }]]),
  batman: Object.freeze([
    ["skyBeam", { fixed: 2 }], ["gotham", { fixed: 1 }], ["rain", 1], ["lightning", { fixed: 2 }], ["batScene", { fixed: 12 }],
  ]),
  spiderMan: Object.freeze([["skyline", { fixed: 1 }], ["motes", 1], ["spiderScene", { fixed: 15 }]]),
  breakingBad: Object.freeze([
    ["mesa", { fixed: 1 }], ["heatHaze", { fixed: 1 }], ["sandDrift", 0.85], ["tumbleweed", 0.15], ["bbScene", { fixed: 18 }],
  ]),
  got: Object.freeze([["iceWall", { fixed: 1 }], ["snow", 1], ["gotScene", { fixed: 42 }]]),
  vikings: Object.freeze([["skyStars", 1], ["auroraBands", { fixed: 3 }], ["river", { fixed: 1 }], ["vikScene", { fixed: 37 }]]),
  prisonBreak: Object.freeze([["blueprint", { fixed: 1 }], ["prison", { fixed: 1 }], ["motes", 1], ["pbScene", { fixed: 4 }]]),
  sherlock: Object.freeze([["london", { fixed: 1 }], ["fog", { fixed: 2 }], ["motes", 1], ["shScene", { fixed: 20 }]]),
  sopranos: Object.freeze([["pool", { fixed: 1 }], ["leaves", 1], ["soprScene", { fixed: 11 }]]),
  deathNote: Object.freeze([["dnFeathers", 1], ["dnScene", { fixed: 5 }]]),
  aot: Object.freeze([["titanWall", { fixed: 1 }], ["aotFeathers", 1], ["aotScene", { fixed: 34 }]]),
  naruto: Object.freeze([["narLeaves", 1], ["narScene", { fixed: 13 }]]),
  onePiece: Object.freeze([["waves", { fixed: 3 }], ["opShip", { fixed: 1 }], ["seagulls", 0.35], ["glints", 0.65], ["opScene", { fixed: 2 }]]),
  fma: Object.freeze([["transmute", { fixed: 1 }], ["motes", 1], ["fmaScene", { fixed: 7 }]]),
  rickAndMorty: Object.freeze([["skyStars", 0.5], ["motes", 0.5], ["rmPortal", { fixed: 1 }], ["rmScene", { fixed: 18 }]]),
});

const SCENE_PART_IDS = [
  "swScene", "matrixRain", "matrixScene", "hpScene", "lotrScene", "duneScene", "batScene", "spiderScene",
  "bbScene", "gotScene", "vikScene", "pbScene", "shScene", "soprScene", "dnFeathers", "dnScene",
  "aotFeathers", "aotScene", "narLeaves", "narScene", "opScene", "fmaScene", "rmScene",
];

// Toplam sayı = sabit sahne + ortam payı. Ortam azken bile sahne tam çizilir.
export const UNIVERSE_SPECS = Object.freeze({
  starWars: { counts: c3(150, 210, 270) },
  matrix: { counts: c3(97, 140, 185) }, // 8'li kod sütunları + 9 sahne
  harryPotter: { counts: c3(52, 80, 100) },
  lotr: { counts: c3(31, 45, 65) },
  dune: { counts: c3(100, 150, 185) },
  batman: { counts: c3(67, 97, 147) },
  spiderMan: { counts: c3(30, 50, 66) },
  breakingBad: { counts: c3(40, 54, 76) },
  got: { counts: c3(70, 105, 145) },
  vikings: { counts: c3(46, 80, 104) },
  prisonBreak: { counts: c3(18, 26, 38) },
  sherlock: { counts: c3(32, 48, 64) },
  sopranos: { counts: c3(18, 28, 40) },
  deathNote: { counts: c3(15, 21, 29) },
  aot: { counts: c3(46, 80, 100) },
  naruto: { counts: c3(28, 41, 55) },
  onePiece: { counts: c3(25, 37, 55) },
  fma: { counts: c3(24, 33, 46) },
  rickAndMorty: { counts: c3(52, 74, 100) },
  ...Object.fromEntries(SCENE_PART_IDS.map((id) => [id, { counts: ONE, palette: NEUTRAL }])),
});

// ── Kurucu yardımcıları ────────────────────────────────────────────────────

/** Anahtar kare satırı. */
const R = (u, x, y, o = {}) => [u, x, y, o.s ?? 1, o.a ?? 0, o.al ?? 1, o.f ?? 0, o.e ?? 0, o.dy ?? 0];
const K = (...rows) => rows.flat();
/** Hiç kıpırdamayan rota (süzülme bob ile verilir). */
const still = (x, y, o = {}) => K(R(0, x, y, o), R(1, x, y, o));
/** u0–u1 arasında fn(τ) → {x, y, s, a, al, f, dy} örneklenmiş doğrusal parçalar. */
function curve(u0, u1, steps, fn) {
  const rows = [];
  for (let i = 0; i <= steps; i += 1) {
    const tau = i / steps;
    const v = fn(tau);
    rows.push(R(u0 + (u1 - u0) * tau, v.x, v.y, v));
  }
  return rows;
}
/** Gizli (opaklık 0) satır. */
const hide = (u, x, y, o = {}) => R(u, x, y, { ...o, al: 0 });

const pick = (tone, dark, light) => (tone === "light" ? light : dark);

/** Rota satırlarını 1/rest'e sıkıştırır; kalan kısım gizli dinlenme (olay seyrekliği). */
function scaleKf(kf, rest) {
  if (!(rest > 1)) return kf;
  const S = 9;
  const out = [];
  for (let i = 0; i < kf.length; i += S) {
    const row = kf.slice(i, i + S);
    row[0] /= rest;
    out.push(...row);
  }
  const last = kf.slice(kf.length - S);
  if (last[5] > 0) out.push(1 / rest + 1e-4, last[1], last[2], last[3], last[4], 0, last[6], 0, last[8]);
  out.push(1, last[1], last[2], last[3], last[4], 0, last[6], 0, last[8]);
  return out;
}

function track(kit, rand, o) {
  const p = kit.blank(rand);
  p.kind = kit.KIND.track;
  kit.setSprite(p, o.sprite);
  const rest = o.rest ?? 1;
  p.rest = rest;
  p.kf = o.kfScaled ? o.kf : scaleKf(o.kf, rest);
  p.size = o.size;
  p.period = (o.period ?? 10) * (o.kfScaled ? 1 : rest);
  p.y0 = o.phase ?? rand();
  p.tlag = o.lag ?? 0;
  p.ox = o.ox ?? 0;
  p.oy = o.oy ?? 0;
  p.jitterX = o.jitterX ?? 0;
  p.jitterY = o.jitterY ?? 0;
  p.face = o.face ? 1 : 0;
  p.framed = o.framed ? 1 : 0;
  p.flapFrom = o.flapFrom ?? 0;
  p.flapFreq = o.flap ?? 0;
  p.bobAmp = o.bob ? o.bob[0] : 0;
  p.bobFreq = o.bob ? o.bob[1] : 0;
  p.bobPh = o.bobPh ?? rand() * kit.TAU;
  p.rot0 = o.rot0 ?? 0;
  p.rotSpeed = o.spin ?? 0;
  p.wobbleAmp = o.rock ? o.rock[0] : 0;
  p.wobbleFreq = o.rock ? o.rock[1] : 0;
  if (o.pulse) {
    p.pulseFreq = o.pulse[0];
    p.pulseMin = o.pulse[1];
  }
  if (o.pulsePh != null) p.pulsePhase = o.pulsePh;
  if (o.salt != null) p.salt = o.salt;
  p.a = o.alpha ?? 1;
  kit.paint(p, o.color ?? "#ffffff");
  return p;
}

/** Lideri izleyen (aynı rota, zaman, kayma ve süzülme; kendi ofseti ve gecikmesi). */
function follow(kit, rand, lead, o) {
  return track(kit, rand, {
    kf: lead.kf,
    kfScaled: true,
    rest: lead.rest,
    period: lead.period,
    phase: lead.y0,
    salt: lead.salt,
    jitterX: lead.jitterX,
    jitterY: lead.jitterY,
    bob: lead.bobAmp ? [lead.bobAmp, lead.bobFreq] : null,
    bobPh: lead.bobPh,
    ...o,
    lag: (lead.tlag || 0) + (o.lag ?? 0) / (lead.rest || 1),
  });
}

/** Rotadan saçılan parçacıklar (yuva başına bir parçacık; yuvalar ömür boyunca kaydırılır). */
function emitter(kit, rand, parent, o) {
  const out = [];
  const slots = o.slots ?? 1;
  const loop = !o.w;
  const rr = parent.rest || 1;
  // kesintisiz saçılmada ömür döngüyü tam bölmeli (sarmada dikiş olmasın)
  const life = loop ? 1 / (rr * Math.max(1, Math.round(1 / o.life))) : o.life / rr;
  const esalt = Math.floor(rand() * 100000);
  for (let i = 0; i < slots; i += 1) {
    const p = kit.blank(rand);
    p.kind = kit.KIND.emit;
    kit.setSprite(p, o.sprite);
    p.kf = parent.kf;
    p.period = parent.period;
    p.y0 = parent.y0;
    p.tlag = parent.tlag;
    p.salt = parent.salt;
    p.jitterX = parent.jitterX;
    p.jitterY = parent.jitterY;
    p.bobAmp = parent.bobAmp;
    p.bobFreq = parent.bobFreq;
    p.bobPh = parent.bobPh;
    p.ox = parent.ox + (o.ox ?? 0);
    p.oy = parent.oy + (o.oy ?? 0);
    p.loop = loop ? 1 : 0;
    p.rest = rr;
    p.w0 = loop ? 0 : o.w[0] / rr;
    p.w1 = loop ? 1 : o.w[1] / rr;
    p.life = life;
    p.eoff = (i / slots) * life;
    p.dirA = o.dir ?? 0;
    p.dirFace = o.dirFace ? 1 : 0;
    p.spread = o.spread ?? 0;
    p.speedV = o.speed ?? 0;
    p.grav = o.grav ?? 0;
    p.grow = o.grow ?? 1;
    p.align = o.align ? 1 : 0;
    p.fadeK = o.fadeK ?? 1;
    p.size = o.size;
    p.swayAmp = o.sway ? o.sway[0] : 0;
    p.swayFreq = o.sway ? o.sway[1] : 0;
    p.rot0 = o.rot0 ?? p.rot0;
    p.rotSpeed = o.spin ? kit.lerp(-o.spin, o.spin, rand()) : 0;
    p.wobbleAmp = o.rock ? o.rock[0] : 0;
    p.wobbleFreq = o.rock ? o.rock[1] : 0;
    p.esalt = esalt + i * 131;
    p.a = o.alpha ?? 1;
    const col = Array.isArray(o.color) ? o.color[i % o.color.length] : o.color;
    kit.paint(p, col ?? "#ffffff");
    out.push(p);
  }
  return out;
}

/** Sabit nokta (çizilmez; saçılma kaynağı). */
const anchorAt = (kit, rand, x, y, o = {}) => track(kit, rand, { sprite: kit.SPRITE.dot, size: 1, kf: still(x, y, o), ...o });

/** İp: pencerelerdeki çapalardan ([u0, u1, ax, ay]...) gövdeye (vektör katman). */
function tether(kit, rand, parent, anchors, o = {}) {
  const p = kit.blank(rand);
  kit.overlay(p, rand, kit.OVERLAY.tether);
  p.kf = parent.kf;
  p.period = parent.period;
  p.y0 = parent.y0;
  p.tlag = parent.tlag;
  p.salt = parent.salt;
  p.jitterX = parent.jitterX;
  p.jitterY = parent.jitterY;
  p.bobAmp = parent.bobAmp;
  p.bobFreq = parent.bobFreq;
  p.bobPh = parent.bobPh;
  p.ox = parent.ox + (o.ox ?? 0);
  p.oy = parent.oy + (o.oy ?? 0);
  p.rest = parent.rest || 1;
  p.anc = anchors.flat().map((v, i) => (i % 4 < 2 ? v / p.rest : v));
  p.slots = o.color ?? 0; // renk sırası (OVERLAY_TONES[29])
  p.size = o.width ?? 1.4;
  return p;
}

// Sarkaç salınımı: çapa (ax, ay), kollar (lx: W oranı, ly: H oranı), en büyük açı tm.
// Gövdenin açısı ipe paralel; hız dipte en büyük (θ = −tm·cos πτ).
const swing = (ax, ay, lx, ly, tm, lean = 0.9) => (tau) => {
  const th = -tm * Math.cos(Math.PI * tau);
  return { x: ax + lx * Math.sin(th), y: ay + ly * Math.cos(th), a: -th * lean };
};

// Sahne silüetlerinin yükseklikleri (dp × ölçek, alt kenardan) — OverlayLayers'la ortak.
export const SCENERY = Object.freeze({
  lift: 86, // alt kenara oturan evren silüetlerinin tab çubuğunun üstüne kaldırılışı (dp); altı zeminle dolar
  wallTop: 190, // Game of Thrones buz duvarı
  titanWallTop: 230, // Attack on Titan duvarı
  gargoyle: { x: 0.8, top: 212 }, // Gotham: heykelli kulenin çıkıntısı
  mesaGround: 18, // Breaking Bad: çöl zemini
  poolTop: 128, // Sopranos: havuz suyu üst kenarı
  poolBottom: 34,
  waterline: 80, // dalgalı deniz (kıyı katmanı) gemi su hattı
  // Vikings nehri (dp, alt kenardan): su bandı near–farBank; gemi şeritleri su hattı yükseklikleri
  river: { near: 88, farBank: 164, far: 142, mid: 121, nearLane: 101, fortTop: 252 },
  // Vikings gemileri (vektör, River katmanı çizer; vikScene aynı rotadan ok atar). x: ekran oranı.
  vikShips: [
    { S: 72, w: 142, from: -0.62, hold: 0.6, at: 0.18, ph: 1.3, stripe: "#2b5f8a" },
    { S: 94, w: 121, from: -0.46, hold: 0.5, at: 0.2, ph: 0.4, stripe: "#c0392b" },
    { S: 120, w: 101, from: -0.34, hold: 0.36, at: 0.22, ph: 2.6, stripe: "#c0392b" },
  ],
});

// ── Sahne kurucuları ───────────────────────────────────────────────────────
// (kit, { rand, count, tone }) → parçacık dizisi. Sayı yalnız ortam parçalarında
// (kod yağmuru, tüy, yaprak) kullanılır; sahnenin kendisi her yoğunlukta tam.

// Star Wars: iki saat. Kovalamaca SÜREKLİ döner (22 sn, X-wing iki geçiş); Ölüm Yıldızı ve
// Millennium Falcon sıçraması 60 sn'lik ortak döngüde (swPlanet katmanıyla aynı saat, faz 0):
//   ~0–18 sn sakin (yalnız kovalamaca) → 18–39 sn Ölüm Yıldızı gezegeni yok eder →
//   41–57 sn Falcon alttan ekran ortasına yükselir, hiperuzay, sıçrar → döngü başa sarar.
//   Ölüm Yıldızı/gezegen/ışın/patlama/Falcon VEKTÖR katmandadır (components/decor/universeOverlays.js);
//   burada şarj ışıkları, alev topları, kırıklar, motor ışıkları ve hiperuzay çizgileri (Atlas) var.
function swScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  const P = 60; // olay süresi (sn)
  const RE = 2; // olaylar 2 dk'da bir
  const PC = 22; // kovalamaca süresi (sn)
  const RC = 4; // kovalamaca ~1,5 dk'da bir
  const mix = (a, b) => pick(tone, a, b);

  // ── 1 · Kovalamaca (sürekli, ekranın alt yarısında) ──
  const pass = (u0, u1, y0, amp) => curve(u0, u1, 14, (tau) => ({
    x: -0.16 + 1.36 * tau,
    y: y0 - amp * Math.sin(Math.PI * tau * 1.2) + 0.04 * Math.sin(tau * 9),
  }));
  const kf = K(
    hide(0, -0.16, 0.74),
    ...pass(0.02, 0.42, 0.74, 0.07),
    hide(0.43, 1.2, 0.7), hide(0.5, -0.16, 0.66),
    ...pass(0.52, 0.92, 0.64, -0.06),
    hide(0.93, 1.2, 0.6), hide(1, 1.2, 0.6),
  );
  const lead = track(kit, rand, { sprite: SPRITE.xwing, size: 46, period: PC, rest: RC, phase: 0, kf, face: true });
  const ties = [
    follow(kit, rand, lead, { sprite: SPRITE.tie, size: 30, lag: 0.026, oy: -24, face: true }),
    follow(kit, rand, lead, { sprite: SPRITE.tie, size: 28, lag: 0.041, oy: 20, face: true }),
  ];
  const green = mix(["#7dff6b", "#b8ff9e"], ["#1c9e2a", "#2bb33a"]);
  const red = mix(["#ff5a4f", "#ff8a7a"], ["#d62828", "#c0392b"]);
  for (const [w0, w1] of [[0.05, 0.4], [0.55, 0.9]]) {
    for (const t of ties) {
      out.push(...emitter(kit, rand, t, {
        sprite: SPRITE.streak, size: 18, w: [w0, w1], life: 0.023, slots: 2, dirFace: true, spread: 0.06,
        speed: 560, align: true, color: green, alpha: 0.95, fadeK: 3, ox: 14,
      }));
    }
    out.push(...emitter(kit, rand, lead, {
      sprite: SPRITE.streak, size: 20, w: [w0 + 0.07, w1 - 0.03], life: 0.02, slots: 2, dirFace: true, spread: 0.04,
      speed: 620, align: true, color: red, alpha: 0.95, fadeK: 3, ox: 22,
    }));
  }
  out.push(...ties, lead);

  // ── 2 · Ölüm Yıldızı gezegeni yok eder (görsel: vektör katman; burada parçacıklar) ──
  const charge = mix(["#7dff8a", "#c8ffd0"], ["#1c9e2a", "#2bb33a"]);
  const dsAnchor = anchorAt(kit, rand, 0.78, 0.2, { period: P, rest: RE, phase: 0, alpha: 0.01 });
  out.push(dsAnchor);
  // dişlide toplanan yeşil ışık
  out.push(...emitter(kit, rand, dsAnchor, {
    sprite: SPRITE.glow, size: 12, w: [0.43, 0.505], life: 0.025, slots: 4, spread: kit.TAU, speed: 0, grow: 0.4,
    color: charge, alpha: 0.7, ox: -22, oy: -22, fadeK: 1.3,
  }));
  // patlama: alev topları ve kırıklar (vektör: parlama, halkalar, ışınlar, moloz)
  const boom = anchorAt(kit, rand, 0.24, 0.36, { period: P, rest: RE, phase: 0, alpha: 0.01 });
  out.push(boom);
  out.push(...emitter(kit, rand, boom, {
    sprite: SPRITE.glow, size: 26, w: [0.52, 0.62], life: 0.05, slots: 8, spread: kit.TAU, speed: 120, grow: 2.8,
    color: mix(["#ff9a3c", "#ff6a1a"], ["#e8590c", "#c2410c"]), alpha: 0.8, fadeK: 1.4,
  }));
  out.push(...emitter(kit, rand, boom, {
    sprite: SPRITE.speck, size: 7, w: [0.52, 0.66], life: 0.08, slots: 16, spread: kit.TAU, speed: 190, spin: 4,
    color: mix(["#9bb8d3", "#6b8f5a", "#d9d2c0"], ["#4a6a86", "#44683a", "#8a8472"]), alpha: 0.95,
  }));

  // ── 3 · Millennium Falcon alttan çıkar, hiperuzay, bekler, üstten hızla gider ──
  // (gemi VEKTÖR çizilir: swPlanet katmanı; burada aynı rotada görünmez çapa + motor ışıkları + iz)
  const FS = 190;
  const rise = [
    hide(0, 0.5, 1.6), hide(0.68, 0.5, 1.6),
    R(0.69, 0.5, 1.5, { e: 1 }), R(0.8, 0.5, 0.58),
    // sıçrama: merkeze (0,5 / 0,4) doğru perspektifle küçülür
    ...curve(0.9, 0.932, 10, (tau) => ({ x: 0.5, y: 0.56 - 0.16 * tau * tau, s: 1 / (1 + 14 * tau * tau) })),
    hide(0.934, 0.5, 0.4, { s: 0.05 }), hide(1, 0.5, 0.4, { s: 0.05 }),
  ];
  const ship = track(kit, rand, { sprite: SPRITE.dot, size: 1, period: P, rest: RE, phase: 0, kf: K(...rise), alpha: 0.01 });
  // kıç motorları mavi parlar (burun yukarı → kıç aşağıda)
  for (const ox of [-0.1, -0.05, 0, 0.05, 0.1]) {
    out.push(follow(kit, rand, ship, {
      sprite: SPRITE.glow, size: 20, ox: ox * FS, oy: FS * 0.4, color: mix("#7fc4ff", "#2b7be0"), pulse: [0.4, 0.55],
      pulsePh: ox * 17, alpha: 0.9,
    }));
  }
  out.push(ship);
  // hiperuzay: yıldızlar ışınsal uzar, ekranda hafif mavi parlama
  const hub = anchorAt(kit, rand, 0.5, 0.4, { period: P, rest: RE, phase: 0, alpha: 0.01 });
  out.push(...emitter(kit, rand, hub, {
    sprite: SPRITE.streak, size: 14, w: [0.8, 0.93], life: 0.012, slots: 34, spread: kit.TAU, speed: 760, align: true,
    grow: 3.6, color: mix(["#ffffff", "#cfe6ff"], ["#3b5bdb", "#5a6fd6"]), alpha: 0.75, fadeK: 2,
  }));
  out.push(...emitter(kit, rand, hub, {
    sprite: SPRITE.streak, size: 10, w: [0.81, 0.93], life: 0.01, slots: 16, spread: kit.TAU, speed: 560, align: true,
    grow: 3, color: mix(["#8fb4ff", "#a58bff"], ["#4263eb", "#7048e8"]), alpha: 0.6, fadeK: 2,
  }));
  // sıçrama anı: merkezden kısa, yoğun çizgi atımı ve tek yumuşak parıltı
  out.push(...emitter(kit, rand, hub, {
    sprite: SPRITE.streak, size: 20, w: [0.9, 0.94], life: 0.006, slots: 22, spread: kit.TAU, speed: 1100, align: true,
    grow: 4.2, color: mix("#ffffff", "#3b5bdb"), alpha: 0.9, fadeK: 2.2,
  }));
  out.push(...emitter(kit, rand, hub, {
    sprite: SPRITE.glow, size: 70, w: [0.915, 0.945], life: 0.03, slots: 1, speed: 0, grow: 3.2,
    color: mix("#cfe0ff", "#4263eb"), alpha: 0.55, fadeK: 1.4,
  }));
  out.push(track(kit, rand, {
    sprite: SPRITE.glow, size: 320, period: P, rest: RE, phase: 0, alpha: 0.5, color: mix("#4f7dff", "#3b5bdb"),
    kf: K(hide(0, 0.5, 0.4), hide(0.79, 0.5, 0.4), R(0.84, 0.5, 0.4, { e: 1 }), R(0.91, 0.5, 0.4, { al: 0.5 }), hide(0.94, 0.5, 0.4), hide(1, 0.5, 0.4)),
  }));
  return out;
}


// Yeşil kod yağmuru: sütun başına 8 simge (parlak baş + sönen kuyruk), sütunlar
// farklı hızda; her döngüde sütun kendi şeridinde kayar, simgeler arada değişir.
function matrixRain(kit, { rand, count, tone }) {
  const { SPRITE } = kit;
  const out = [];
  const cols = Math.max(6, Math.min(18, Math.round(count / 8)));
  const head = pick(tone, "#e6ffe9", "#0b6b2a");
  const body = pick(tone, ["#3ee87a", "#22c55e"], ["#15803d", "#16a34a"]);
  for (let c = 0; c < cols; c += 1) {
    const x = (c + 0.5) / cols;
    const lead = track(kit, rand, {
      sprite: (c % 2) ? SPRITE.glyphA : SPRITE.glyphB, size: 15, period: kit.lerp(3.4, 7, rand()),
      kf: K(R(0, x, -0.32), R(1, x, 1.28)), jitterX: 0.7 / cols, flap: kit.lerp(1.2, 3.4, rand()), color: head,
    });
    out.push(lead);
    for (let j = 1; j < 8; j += 1) {
      out.push(follow(kit, rand, lead, {
        sprite: (c + j) % 2 ? SPRITE.glyphA : SPRITE.glyphB, size: 15, oy: -j * 17,
        flap: kit.lerp(0.6, 2.6, rand()), color: body[j % 2], alpha: Math.max(0.12, 0.92 - j * 0.11),
      }));
    }
  }
  return out;
}

function matrixScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // kırmızı ve mavi hap süzülür
  out.push(track(kit, rand, {
    sprite: SPRITE.pill, size: 28, kf: still(0.2, 0.6), bob: [7, 0.12], rock: [0.25, 0.08], rot0: -0.5,
    color: pick(tone, "#ff4d4d", "#d62828"),
  }));
  out.push(track(kit, rand, {
    sprite: SPRITE.pill, size: 28, kf: still(0.8, 0.66), bob: [7, 0.1], rock: [0.25, 0.07], rot0: 0.45,
    color: pick(tone, "#4da6ff", "#1f6fd6"),
  }));
  // mermi zamanı: birkaç mermi ekranı çok yavaş geçer (iki yönde, farklı yükseklik ve hızda),
  // her birinin ardında genişleyen hava halkaları
  [
    { y0: 0.5, y1: 0.47, P: 21, rest: 4, dir: 1, size: 22 },
    { y0: 0.28, y1: 0.33, P: 17, rest: 5, dir: -1, size: 18 },
    { y0: 0.64, y1: 0.6, P: 26, rest: 4, dir: 1, size: 20 },
    { y0: 0.4, y1: 0.36, P: 31, rest: 3, dir: 1, size: 14 },
    { y0: 0.56, y1: 0.58, P: 23, rest: 4, dir: -1, size: 24 },
    { y0: 0.2, y1: 0.18, P: 19, rest: 5, dir: 1, size: 16 },
  ].forEach((o) => {
    const xa = o.dir > 0 ? -0.08 : 1.08;
    const xb = o.dir > 0 ? 1.08 : -0.08;
    const bullet = track(kit, rand, {
      sprite: SPRITE.bullet, size: o.size, period: o.P, rest: o.rest, face: true,
      kf: K(R(0, xa, o.y0), R(0.62, xb, o.y1), hide(0.625, xb, o.y1), hide(1, xb, o.y1)),
    });
    out.push(...emitter(kit, rand, bullet, {
      sprite: SPRITE.shockRing, size: 14, w: [0.02, 0.6], life: 0.05, slots: 4, grow: 3.2, ox: -12 * o.dir, alpha: 0.6,
      color: pick(tone, "#c8ffd8", "#2a7a4a"),
    }));
    out.push(bullet);
  });
  // déjà vu: kara kedi altta geçer… ve hemen ardından AYNISI yine geçer
  const walk = (u0) => curve(u0, u0 + 0.2, 1, (tau) => ({ x: -0.08 + 1.16 * tau, y: 0.8 }));
  out.push(track(kit, rand, {
    sprite: SPRITE.catA, size: 30, period: 28, rest: 3, flap: 2.6,
    kf: K(hide(0, -0.08, 0.8), hide(0.048, -0.08, 0.8), ...walk(0.05), hide(0.252, 1.08, 0.8), hide(0.278, -0.08, 0.8),
      ...walk(0.28), hide(0.482, 1.08, 0.8), hide(1, 1.08, 0.8)),
    color: pick(tone, "#8a919f", "#1c1f25"),
  }));
  return out;
}

function hpScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // Büyük Salon mumları: üst yarıda havada, hafifçe iner çıkar, alev titrer
  const xs = [0.1, 0.24, 0.38, 0.55, 0.68, 0.82, 0.93];
  const glows = [];
  const candles = [];
  for (const [i, x0] of xs.entries()) {
    const size = kit.lerp(26, 34, rand());
    const c = track(kit, rand, {
      sprite: SPRITE.candle, size, kf: still(x0 + kit.lerp(-0.03, 0.03, rand()), kit.lerp(0.07, 0.36, rand())),
      bob: [kit.lerp(4, 9, rand()), kit.lerp(0.07, 0.15, rand())], alpha: 0.95, period: 10 + i,
    });
    candles.push(c);
    glows.push(follow(kit, rand, c, {
      sprite: SPRITE.glow, size: size * 0.95, oy: -size * 0.36, color: pick(tone, "#ffd27a", "#ffb020"),
      pulse: [kit.lerp(1.3, 2.3, rand()), 0.55], alpha: 0.7,
    }));
  }
  out.push(...glows, ...candles);
  // Quidditch (60 sn döngü, tohumdan deterministik benzetim): altın top HER ZAMAN aynı hızda
  // ekranın büyük bölümünde rastgele noktalara uçar; tek süpürgeli oyuncu ondan YAVAŞ ve topu
  // kovalar. İkisi de sınırlı dönüş hızıyla yumuşak yaylar çizer. Oyuncu topa yaklaşınca top
  // başka bir konuma yönelir (aynı hız), kovalamaca sürer. Her döngüde rota kaydırılır (jitter).
  const QP = 60;
  const QW = 390;
  const QH = 844;
  const box = { x0: 0.06 * QW, x1: 0.94 * QW, y0: 0.07 * QH, y1: 0.7 * QH };
  const spot = () => [kit.lerp(box.x0, box.x1, rand()), kit.lerp(box.y0, box.y1, rand())];
  const VS = 140; // top hızı (px/sn) — sabit
  const VR = 84; // oyuncu hızı: daha yavaş
  const TS = 2.1; // topun azami dönüş hızı (rad/sn)
  const TR = 1.5; // oyuncunun azami dönüş hızı
  const CATCH = 70; // bu mesafeye yaklaşınca top yer değiştirir
  const dt = 0.1;
  const wrapPi = (a) => {
    let v = a;
    while (v > Math.PI) v -= 2 * Math.PI;
    while (v < -Math.PI) v += 2 * Math.PI;
    return v;
  };
  const steer = (th, want, rate) => th + Math.max(-rate * dt, Math.min(rate * dt, wrapPi(want - th)));
  let sp = spot();
  let rp = spot();
  let tgt = spot();
  let ths = Math.atan2(tgt[1] - sp[1], tgt[0] - sp[0]);
  let thr = Math.atan2(sp[1] - rp[1], sp[0] - rp[0]);
  let faceR = 1;
  let alR = 1;
  const sRows = [];
  const rRows = [];
  const lRows = [];
  const clampTilt = (v) => Math.max(-0.7, Math.min(0.7, v));
  let tiltS = 0;
  for (let t = 0; t <= QP + 1e-6; t += dt) {
    const u = t / QP;
    const vx = Math.cos(thr);
    const vy = Math.sin(thr);
    if (vx > 0.2) faceR = 1;
    else if (vx < -0.2) faceR = -1;
    alR += (faceR - alR) * Math.min(1, dt / 0.18); // -1..1 → yönlere yumuşak geçiş
    const alRight = Math.max(0, Math.min(1, (alR + 1) / 2));
    const want = clampTilt(faceR > 0 ? Math.atan2(vy, Math.abs(vx)) : -Math.atan2(vy, Math.abs(vx)));
    tiltS += (want - tiltS) * Math.min(1, dt / 0.25);
    sRows.push(R(u, sp[0] / QW, sp[1] / QH));
    rRows.push(R(u, rp[0] / QW, rp[1] / QH, { a: tiltS, al: alRight }));
    lRows.push(R(u, rp[0] / QW, rp[1] / QH, { a: tiltS, al: 1 - alRight }));
    // top: sabit hızla hedefe, yumuşak dönüşle
    const dr = Math.hypot(sp[0] - rp[0], sp[1] - rp[1]);
    if (dr < CATCH) {
      let best = spot();
      for (let i = 0; i < 8; i += 1) {
        const c = spot();
        if (Math.hypot(c[0] - rp[0], c[1] - rp[1]) > Math.hypot(best[0] - rp[0], best[1] - rp[1])) best = c;
      }
      tgt = best;
    }
    if (Math.hypot(tgt[0] - sp[0], tgt[1] - sp[1]) < 28) tgt = spot();
    ths = steer(ths, Math.atan2(tgt[1] - sp[1], tgt[0] - sp[0]), TS);
    sp = [Math.max(0, Math.min(QW, sp[0] + Math.cos(ths) * VS * dt)), Math.max(0, Math.min(QH * 0.76, sp[1] + Math.sin(ths) * VS * dt))];
    // oyuncu: topa doğru, yavaş ve yumuşak
    thr = steer(thr, Math.atan2(sp[1] - rp[1], sp[0] - rp[0]), TR);
    rp = [Math.max(0, Math.min(QW, rp[0] + Math.cos(thr) * VR * dt)), Math.max(0, Math.min(QH * 0.76, rp[1] + Math.sin(thr) * VR * dt))];
  }
  // döngü dikişi: kısa solma (başlangıç ile bitiş konumu farklı)
  const seam = (rows) => {
    const a = rows[0];
    const z = rows[rows.length - 1];
    const first = [0, a[1], a[2], 1, a[4], 0, 0, 0, 0];
    const fadeIn = R(0.008, a[1], a[2], { a: a[4], al: a[5] });
    const last = hide(0.992, z[1], z[2], { a: z[4] });
    return [first, fadeIn, ...rows.filter((r) => r[0] > 0.0085 && r[0] < 0.9915), last, hide(1, z[1], z[2], { a: z[4] })];
  };
  const salt = 4177;
  const jit = { jitterX: 0.22, jitterY: 0.1, salt };
  const snitch = track(kit, rand, {
    sprite: SPRITE.snitchOpen, size: 22, period: QP, phase: 0, flap: 11, bob: [3, 0.9], ...jit,
    kf: K(...seam(sRows)),
  });
  const riderR = track(kit, rand, { sprite: SPRITE.broomRider, size: 56, period: QP, phase: 0, bob: [2, 0.4], ...jit, kf: K(...seam(rRows)) });
  const riderL = track(kit, rand, { sprite: SPRITE.broomRiderL, size: 56, period: QP, phase: 0, bob: [2, 0.4], ...jit, kf: K(...seam(lRows)) });
  const gold = pick(tone, "#ffd27a", "#d99a1c");
  out.push(...emitter(kit, rand, snitch, {
    sprite: SPRITE.glow, size: 8, life: 0.03, slots: 5, speed: 6, grow: 1.6, color: gold, alpha: 0.7, fadeK: 1.4,
  }));
  out.push(...emitter(kit, rand, riderR, {
    sprite: SPRITE.glow, size: 7, life: 0.04, slots: 5, spread: kit.TAU, speed: 10, grow: 1.8,
    color: gold, alpha: 0.5, fadeK: 1.4, oy: 7,
  }));
  out.push(snitch, riderL, riderR);
  // mektup taşıyan baykuş geçer, mektubu bırakır; mektup sallanarak düşer
  const owl = track(kit, rand, {
    sprite: SPRITE.owlOpen, size: 52, period: 17, rest: 6, flap: 2.2,
    kf: K(...curve(0, 0.36, 8, (tau) => ({ x: -0.15 + 1.3 * tau, y: 0.2 + 0.05 * Math.sin(Math.PI * tau) })),
      hide(0.365, 1.15, 0.2), hide(1, 1.15, 0.2)),
  });
  out.push(...emitter(kit, rand, owl, {
    sprite: SPRITE.letter, size: 22, w: [0.15, 0.152], life: 0.32, slots: 1, dir: Math.PI / 2, speed: 8, grav: 26,
    sway: [24, 0.3], rock: [0.5, 0.3], fadeK: 4, oy: 12,
  }));
  out.push(owl);
  return out;
}

function lotrScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // kanatlı karanlık binekler ufukta geçer
  const beast = track(kit, rand, {
    sprite: SPRITE.fellOpen, size: 46, period: 26, rest: 4, flap: 1.3,
    kf: K(...curve(0, 0.42, 8, (tau) => ({ x: -0.12 + 1.24 * tau, y: 0.13 + 0.06 * Math.sin(Math.PI * tau) })),
      hide(0.425, 1.12, 0.13), hide(1, 1.12, 0.13)),
    color: pick(tone, "#4a4150", "#1a1720"),
  });
  out.push(beast, follow(kit, rand, beast, { sprite: SPRITE.fellOpen, size: 34, lag: 0.035, oy: 26, flap: 1.5, color: pick(tone, "#3d3542", "#26222c") }));
  // yüzük süzülür, ara sıra içindeki yazı parlar
  const ring = track(kit, rand, { sprite: SPRITE.oneRing, size: 30, kf: still(0.18, 0.32), bob: [6, 0.1], rock: [0.3, 0.07] });
  out.push(
    follow(kit, rand, ring, { sprite: SPRITE.glow, size: 50, color: pick(tone, "#ffcf5a", "#f0a500"), pulse: [0.12, 0.05], alpha: 0.65 }),
    ring,
  );
  return out;
}

function duneScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  const sand = pick(tone, ["#e0b878", "#c99a5b"], ["#a8783f", "#b98a4c"]);
  // Solucan VEKTÖR çizilir (Dunes katmanı, 40 sn, faz 0). Burada: kum çizgisinde dalış/çıkış
  // tozu, uzakta çalışan baharat toplayıcıların tozu ve sinen baharat parıltıları.
  const P = 40;
  const sandY = -(SCENERY.lift + 64);
  const entry = anchorAt(kit, rand, 0.18, 1, { dy: sandY, period: P, rest: 2, phase: 0, alpha: 0.01 });
  const exit = anchorAt(kit, rand, 0.82, 1, { dy: sandY, period: P, rest: 2, phase: 0, alpha: 0.01 });
  out.push(entry, exit);
  for (const [anchor, w] of [[entry, [0.322, 0.375]], [exit, [0.522, 0.58]], [exit, [0.615, 0.66]]]) {
    out.push(...emitter(kit, rand, anchor, {
      sprite: SPRITE.glow, size: 16, w, life: 0.03, slots: 8, dir: -Math.PI / 2, spread: 0.9, speed: 80, grav: 70, grow: 3,
      color: sand, alpha: 0.55,
    }));
    out.push(...emitter(kit, rand, anchor, {
      sprite: SPRITE.speck, size: 6, w, life: 0.03, slots: 10, dir: -Math.PI / 2, spread: 1.5, speed: 170, grav: 260,
      color: sand, alpha: 0.9, spin: 3,
    }));
  }
  // toplayıcıların arkasında sürekli kalkan toz
  for (const [x, dy] of [[0.09, -(SCENERY.lift + 70)], [0.93, -(SCENERY.lift + 84)]]) {
    const a = anchorAt(kit, rand, x, 1, { dy, period: 10, phase: 0, alpha: 0.01 });
    out.push(a, ...emitter(kit, rand, a, {
      sprite: SPRITE.glow, size: 14, life: 0.1, slots: 5, dir: -Math.PI / 2, spread: 0.7, speed: 14, sway: [8, 0.2], grow: 3,
      color: sand, alpha: 0.32,
    }));
  }
  // kanat çırpan çöl uçakları havada asılı
  for (const [i, y] of [0.22, 0.31].entries()) {
    out.push(track(kit, rand, {
      sprite: SPRITE.thopterA, size: 38, period: 46 + i * 12, rest: 2, flap: 8, bob: [6, 0.3],
      kf: K(...curve(0, 1, 6, (tau) => ({ x: -0.15 + 1.3 * tau, y: y + 0.03 * Math.sin(tau * 7 + i) }))),
      color: pick(tone, "#aab0bb", "#4b5260"),
    }));
  }
  // baharat zerreleri savrulur
  for (let i = 0; i < 14; i += 1) {
    const p = kit.floating(kit.blank(rand), rand, rand(), {
      sprite: SPRITE.glow, size: [3, 7], sway: [14, 40], freq: [0.02, 0.06], drift: [10, 30], pulse: [0.2, 0.6],
      pulseMin: 0.3, alpha: [0.5, 0.9], yRange: [0.15, 0.8],
    });
    kit.paint(p, pick(tone, "#ffa94d", "#e8590c"));
    out.push(p);
  }
  return out;
}

function batScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // çatıdaki heykelin üstünde pelerinli silüet; pelerin rüzgârda dalgalanır
  const fig = 42;
  out.push(track(kit, rand, {
    sprite: SPRITE.capeA, size: fig, flap: 0.9,
    kf: still(SCENERY.gargoyle.x, 1, { dy: -(SCENERY.gargoyle.top + SCENERY.lift + fig * 0.46) }),
    color: pick(tone, "#3a3f4b", "#14161b"),
  }));
  // yarasa sürüsü şehirden yükselip geçer
  const leadKf = K(...curve(0, 0.3, 8, (tau) => ({ x: -0.1 + 1.2 * tau, y: 0.62 - 0.5 * tau + 0.06 * Math.sin(tau * 6) })),
    hide(0.305, 1.1, 0.12), hide(1, 1.1, 0.12));
  const batCol = pick(tone, ["#8a7aa8", "#9c8cba"], ["#2b2236", "#3a2f48"]);
  const lead = track(kit, rand, { sprite: SPRITE.batOpen, size: 22, period: 17, rest: 5, kf: leadKf, flap: 7, color: batCol[0] });
  out.push(lead);
  for (let i = 0; i < 10; i += 1) {
    out.push(follow(kit, rand, lead, {
      sprite: SPRITE.batOpen, size: kit.lerp(13, 24, rand()), lag: rand() * 0.03, ox: kit.lerp(-44, 44, rand()),
      oy: kit.lerp(-55, 55, rand()), flap: kit.lerp(6, 9.5, rand()), color: batCol[i % 2],
    }));
  }
  return out;
}

function spiderScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  const webCol = pick(tone, "#e8ecf2", "#6b7280");
  const W = 120;
  // köşe ağları (sol üst köşe hücrenin sol üstü; sağdaki 90° döndürülür)
  const left = track(kit, rand, { sprite: SPRITE.web, size: W, kf: still(0, 0), ox: W / 2, oy: W / 2, color: webCol, alpha: 0.55 });
  const right = track(kit, rand, { sprite: SPRITE.web, size: W, kf: still(1, 0), ox: -W / 2, oy: W / 2, rot0: Math.PI / 2, color: webCol, alpha: 0.55 });
  out.push(left, right);
  // ağdaki çiy damlaları parlar
  for (const [x, y, ox, oy] of [[0, 0, 30, 70], [0, 0, 64, 38], [0, 0, 90, 20], [1, 0, -40, 62], [1, 0, -76, 30]]) {
    out.push(track(kit, rand, {
      sprite: SPRITE.glow, size: 7, kf: still(x, y), ox, oy, pulse: [kit.lerp(0.4, 0.9, rand()), 0.1], color: "#ffffff",
      alpha: 0.9,
    }));
  }
  // Ağ sallama (16 sn): dört salınım; her salınım yeni bir ağ atışıyla başlar, uçta kısa bir
  // takla (ağ yok) ve sonraki ağ. Gövde ipe paralel yatar, el ağı tutar.
  const P = 16;
  const ay = -0.02;
  const lx = 0.17;
  const ly = 0.34;
  const tm = 1.0;
  const dx = 2 * lx * Math.sin(tm);
  const ax = [0, 1, 2, 3].map((j) => j * (dx + 0.04));
  const rows = [hide(0, -0.2, 0.2)];
  const win = [];
  let u = 0.01;
  ax.forEach((a, j) => {
    rows.push(...curve(u, u + 0.19, 10, swing(a, ay, lx, ly, tm, 0.9)));
    win.push([u, u + 0.19, a, ay]);
    u += 0.19;
    if (j < ax.length - 1) {
      const x0 = a + lx * Math.sin(tm);
      const x1 = ax[j + 1] - lx * Math.sin(tm);
      const y0 = ay + ly * Math.cos(tm);
      rows.push(...curve(u + 0.002, u + 0.044, 7, (tau) => ({
        x: x0 + (x1 - x0) * tau, y: y0 - 0.075 * Math.sin(Math.PI * tau), a: -0.9 + (1.8 + 2 * Math.PI) * tau,
      })));
      u += 0.045;
    }
  });
  rows.push(R(u + 0.02, ax[3] + 0.3, 0.12, { a: -0.6 }), hide(u + 0.025, ax[3] + 0.3, 0.12), hide(1, ax[3] + 0.3, 0.12));
  const SZ = 62;
  const body = track(kit, rand, { sprite: SPRITE.swinger, size: SZ, period: P, rest: 5, phase: 0, kf: K(...rows) });
  out.push(tether(kit, rand, body, win, { oy: -SZ * 0.44, color: 0, width: 1.5 }));
  // ağın izi: gövdenin ardında küçük beyaz zerreler
  out.push(...emitter(kit, rand, body, {
    sprite: SPRITE.glow, size: 5, w: [0.02, 0.9], life: 0.03, slots: 6, spread: 0.6, speed: 6, grow: 0.6,
    color: webCol, alpha: 0.4, fadeK: 1.5, oy: SZ * 0.1,
  }));
  out.push(body);
  return out;
}

function bbScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // karavan çöl zemininde durur; çatıdaki bacadan duman tüter
  const rvSize = 76;
  const rv = track(kit, rand, {
    sprite: SPRITE.rv, size: rvSize, period: 15, kf: still(0.72, 1, { dy: -(SCENERY.mesaGround + SCENERY.lift + rvSize * 0.32) }),
  });
  out.push(...emitter(kit, rand, rv, {
    sprite: SPRITE.glow, size: 12, life: 0.2, slots: 5, dir: -Math.PI / 2, spread: 0.35, speed: 16, sway: [10, 0.15],
    grow: 3.2, color: pick(tone, "#cfcfcf", "#8a8a8a"), alpha: 0.4, ox: -14, oy: -26,
  }));
  out.push(rv);
  // başlık kartındaki gibi element kutucukları süzülür; arada biri parlar
  for (const [sprite, x, y, ph] of [[SPRITE.tileBr, 0.24, 0.2, 0], [SPRITE.tileBa, 0.4, 0.27, 3.1]]) {
    const tile = track(kit, rand, { sprite, size: 44, kf: still(x, y), bob: [5, 0.07], rock: [0.06, 0.05] });
    out.push(
      follow(kit, rand, tile, { sprite: SPRITE.glow, size: 74, color: pick(tone, "#5be37d", "#1f9d55"), pulse: [0.09, 0], pulsePh: ph, alpha: 0.5 }),
      tile,
    );
  }
  // yassı şapka
  out.push(track(kit, rand, {
    sprite: SPRITE.hat, size: 40, kf: still(0.8, 0.34), bob: [6, 0.08], rock: [0.12, 0.06],
    color: pick(tone, "#5a5e68", "#1f2328"),
  }));
  // cam şişede kabarcık
  const flask = track(kit, rand, {
    sprite: SPRITE.flask, size: 40, period: 8, kf: still(0.14, 0.52), bob: [4, 0.09],
    color: pick(tone, "#d6eef8", "#5f8fa8"),
  });
  out.push(...emitter(kit, rand, flask, {
    sprite: SPRITE.dot, size: 5, life: 1 / 6, slots: 6, dir: -Math.PI / 2, spread: 0.4, speed: 22, grow: 1.4,
    color: pick(tone, "#e8f8ff", "#5f8fa8"), alpha: 0.6, oy: -6,
  }));
  out.push(flask);
  return out;
}

function gotScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // Ejderha (24 sn): uzaktan küçük gelir, büyüyerek duvara yaklaşır, havada durur,
  // kanat çırparak duvara ateş üfler, sonra yükselip gider.
  const P = 24;
  rand(); // tohum akışını koru
  const phase = 0; // duvarın yıkılışıyla (iceWall, period 24, faz 0) aynı saat
  const D = 130;
  const kf = K(
    hide(0, 0.06, 0.1, { s: 0.22 }),
    R(0.02, 0.07, 0.11, { s: 0.24, e: 1 }),
    R(0.24, 0.26, 0.38, { s: 0.9, e: 1 }),
    R(0.31, 0.3, 0.42, { s: 1, a: 0.06, e: 1 }),
    R(0.5, 0.31, 0.41, { s: 1, a: 0.06, e: 1 }),
    R(0.62, 0.7, 0.2, { s: 0.8, a: -0.3, e: 1 }),
    R(0.72, 1.25, 0.04, { s: 0.6, a: -0.2 }),
    hide(0.722, 1.25, 0.04, { s: 0.6 }),
    hide(1, 1.25, 0.04, { s: 0.6 }),
  );
  const dragon = track(kit, rand, { sprite: SPRITE.dragonOpen, size: D, period: P, rest: 3, phase, kf, flap: 1.6, bob: [6, 0.45] });
  // ateş: ağızdan aşağı-sağa genişleyen koni (dış turuncu, iç sarı)
  // Beyaz Yürüyen'in buz ateşi: dış mavi, iç beyaz-mavi
  const fireOuter = pick(tone, ["#2f8cff", "#4aa8ff", "#1f6fe0"], ["#1566d6", "#0b4fb3", "#2b7be0"]);
  const fireCore = pick(tone, ["#e8f6ff", "#bfe6ff"], ["#5aa9f0", "#7bbcf5"]);
  const fire = { w: [0.34, 0.48], life: 0.045, dir: 1.2, spread: 0.32, speed: 345, grav: 50, ox: D * 0.4, oy: 8, fadeK: 1.5 };
  out.push(...emitter(kit, rand, dragon, { ...fire, sprite: SPRITE.glow, size: 20, grow: 3, slots: 18, color: fireOuter, alpha: 0.85 }));
  out.push(...emitter(kit, rand, dragon, { ...fire, sprite: SPRITE.glow, size: 11, grow: 2.3, slots: 10, spread: 0.2, color: fireCore, alpha: 0.95 }));
  // alev içinde uçuşan parlak kıvılcımlar
  out.push(...emitter(kit, rand, dragon, {
    ...fire, sprite: SPRITE.dot, size: 4, grow: 0.8, slots: 8, spread: 0.55, speed: 420, life: 0.045, color: pick(tone, "#ffffff", "#2b7be0"),
    alpha: 0.9,
  }));
  out.push(dragon);
  // duvarda mavi parlama ve buhar (yıkılış katmanı iceWall ile aynı saatte)
  const hit = anchorAt(kit, rand, 0.72, 1, { dy: -SCENERY.wallTop, period: P, rest: 3, phase });
  out.push(...emitter(kit, rand, hit, {
    sprite: SPRITE.glow, size: 76, w: [0.36, 0.56], life: 0.05, slots: 5, grow: 1.9, color: pick(tone, "#59b8ff", "#2b7be0"),
    alpha: 0.5,
  }));
  // yıkılırken kalkan buz tozu
  out.push(...emitter(kit, rand, hit, {
    sprite: SPRITE.glow, size: 40, w: [0.52, 0.8], life: 0.1, slots: 7, dir: -Math.PI / 2, spread: 1.2, speed: 22,
    grow: 3.4, sway: [14, 0.18], color: pick(tone, "#dcefff", "#9fb4c8"), alpha: 0.3,
  }));
  out.push(...emitter(kit, rand, hit, {
    sprite: SPRITE.glow, size: 18, w: [0.38, 0.62], life: 0.09, slots: 10, dir: -Math.PI / 2, spread: 0.9, speed: 34,
    grow: 3.2, sway: [12, 0.2], color: pick(tone, "#ffffff", "#9fb4c8"), alpha: 0.35,
  }));
  // kuzgunlar
  for (const [i, per] of [13, 19].entries()) {
    out.push(track(kit, rand, {
      sprite: SPRITE.ravenOpen, size: 22, period: per, rest: 4, flap: 3.2,
      kf: K(...curve(0, 0.5, 6, (tau) => ({ x: -0.1 + 1.2 * tau, y: 0.18 + i * 0.1 + 0.04 * Math.sin(tau * 5 + i) })),
        hide(0.505, 1.1, 0.2), hide(1, 1.1, 0.2)),
      color: pick(tone, "#7c8091", "#22242b"),
    }));
  }
  return out;
}

function vikScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // Baskın (30 sn, nehir katmanı river ile AYNI saat: faz 0): üç uzun gemi nehirde
  // yukarı gelir, kalenin önünde durur, yanan ok yağdırır; kale tutuşunca çekilirler.
  const P = 30;
  const L = SCENERY.river;
  // Gemiler River katmanında vektör çizilir; burada yalnız aynı rotada görünmez çapalar
  // (okların çıkış noktası).
  const leads = SCENERY.vikShips.map((o) => track(kit, rand, {
    sprite: SPRITE.dot, size: 1, period: P, rest: 3, phase: 0,
    kf: K(
      R(0, o.from, 1, { dy: -o.w, e: 1 }),
      R(o.at, o.hold, 1, { dy: -o.w, e: 1 }),
      R(0.62, o.hold + 0.03, 1, { dy: -o.w, e: 1 }),
      R(1, 1.4, 1, { dy: -o.w }),
    ),
  }));
  out.push(...leads);
  // yanan oklar: gemiden kaleye yay çizer (saniyede birkaç ok; çakma yok)
  const arrow = pick(tone, ["#ffb347", "#ff8a2a"], ["#e8590c", "#d9480f"]);
  leads.forEach((lead, i) => {
    out.push(...emitter(kit, rand, lead, {
      sprite: SPRITE.glow, size: 7 - i, w: [0.28, 0.6], life: 0.03, slots: 4, dir: -0.85 + i * 0.07, spread: 0.12, speed: 175 + i * 14,
      grav: 260, grow: 0.7, color: arrow, alpha: 0.95, ox: 26 + i * 8, oy: -(24 + i * 8), fadeK: 1.2,
    }));
  });
  // kale: tutuşunca duman ve kıvılcım yükselir
  const fort = anchorAt(kit, rand, 0.82, 1, { dy: -(L.farBank + 52), period: P, rest: 3, phase: 0 });
  out.push(...emitter(kit, rand, fort, {
    sprite: SPRITE.glow, size: 26, w: [0.34, 0.95], life: 0.12, slots: 8, dir: -Math.PI / 2, spread: 0.5, speed: 20,
    sway: [14, 0.16], grow: 3.4, color: pick(tone, "#9aa3b0", "#5a6270"), alpha: 0.32,
  }));
  out.push(...emitter(kit, rand, fort, {
    sprite: SPRITE.dot, size: 4, w: [0.36, 0.9], life: 0.06, slots: 6, dir: -Math.PI / 2, spread: 0.9, speed: 46,
    sway: [8, 0.3], grow: 0.6, color: pick(tone, ["#ffd08a", "#ff9a3c"], ["#e8590c", "#f59f00"]), alpha: 0.9,
  }));
  // kuzgun çifti
  const raven = track(kit, rand, {
    sprite: SPRITE.ravenOpen, size: 22, period: 20, rest: 4, flap: 3,
    kf: K(...curve(0, 0.55, 8, (tau) => ({ x: -0.1 + 1.2 * tau, y: 0.3 - 0.12 * Math.sin(Math.PI * tau) })),
      hide(0.555, 1.1, 0.3), hide(1, 1.1, 0.3)),
    color: pick(tone, "#8a8fa0", "#22242b"),
  });
  out.push(raven, follow(kit, rand, raven, { sprite: SPRITE.ravenOpen, size: 19, lag: 0.022, oy: 22, ox: -10, flap: 3.4, color: pick(tone, "#7c8091", "#2b2e36") }));
  // runlar sırayla parlayıp söner
  const runes = [SPRITE.runeA, SPRITE.runeB, SPRITE.runeC];
  [[0.14, 0.44], [0.32, 0.37], [0.5, 0.42], [0.68, 0.35], [0.86, 0.43]].forEach(([x, y], i) => {
    out.push(track(kit, rand, {
      sprite: runes[i % 3], size: 24, kf: still(x, y), bob: [3, 0.06], pulse: [0.12, 0.05], pulsePh: i * 1.25,
      color: pick(tone, "#7fe7ff", "#127a9a"), alpha: 0.8,
    }));
  });
  return out;
}

function pbScene(kit, { rand, tone }) {
  const { SPRITE, KIND } = kit;
  const out = [];
  // kâğıttan turnalar süzülür (sağa)
  for (let i = 0; i < 4; i += 1) {
    const p = kit.blank(rand);
    p.kind = KIND.drift;
    kit.setSprite(p, SPRITE.crane);
    p.size = kit.lerp(28, 38, rand());
    p.windX = kit.lerp(14, 30, rand());
    p.y0 = kit.lerp(0.1, 0.55, rand());
    p.swayAmp = kit.lerp(10, 22, rand());
    p.swayFreq = kit.lerp(0.06, 0.14, rand());
    p.driftAmpY = kit.lerp(14, 30, rand());
    p.driftFreqY = kit.lerp(0.03, 0.07, rand());
    p.wobbleAmp = kit.lerp(0.04, 0.1, rand());
    p.wobbleFreq = p.swayFreq;
    p.rot0 = 0;
    p.a = 0.85;
    kit.paint(p, pick(tone, i % 2 ? "#f4f1ea" : "#e6eefc", i % 2 ? "#8a877e" : "#6b7a99"));
    out.push(p);
  }
  return out;
}

function shScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // ayak izleri sırayla belirip söner (biri yürüyormuş gibi)
  const N = 14;
  const col = pick(tone, "#b3a991", "#5a5040");
  for (let i = 0; i < N; i += 1) {
    const tau = i / (N - 1);
    const x = 0.08 + 0.84 * tau;
    const y = 0.7 + 0.04 * Math.sin(2 * Math.PI * tau * 0.8);
    const dydx = (0.04 * 2 * Math.PI * 0.8 * Math.cos(2 * Math.PI * tau * 0.8) * 844) / (0.84 * 390);
    const a = Math.atan(dydx) + Math.PI / 2;
    const ua = 0.04 + i * 0.03;
    const side = i % 2 ? 7 : -7;
    out.push(track(kit, rand, {
      sprite: SPRITE.footprint, size: 16, period: 15, rest: 5, phase: 0.31, oy: side,
      kf: K(hide(0, x, y, { a }), hide(ua, x, y, { a }), R(ua + 0.012, x, y, { a }), R(ua + 0.28, x, y, { a }),
        hide(ua + 0.4, x, y, { a }), hide(1, x, y, { a })),
      color: col, alpha: 0.65,
    }));
  }
  // büyüteç ekranda gezinir
  const pts = [[0.25, 0.3], [0.7, 0.24], [0.78, 0.5], [0.4, 0.58], [0.18, 0.45], [0.25, 0.3]];
  out.push(track(kit, rand, {
    sprite: SPRITE.magnifier, size: 58, period: 34, rock: [0.1, 0.05],
    kf: K(...pts.map(([x, y], i) => R(i / (pts.length - 1), x, y, { e: 1 }))),
  }));
  // ipucu noktaları parlar
  for (let i = 0; i < 5; i += 1) {
    out.push(track(kit, rand, {
      sprite: SPRITE.glow, size: 9, kf: still(kit.lerp(0.12, 0.88, rand()), kit.lerp(0.2, 0.6, rand())),
      pulse: [kit.lerp(0.3, 0.6, rand()), 0.05], color: pick(tone, "#ffc24a", "#d97706"), alpha: 0.9,
    }));
  }
  return out;
}

function soprScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // ördek ailesi havuzda sıra halinde yüzer, birlikte uçup gider, sonra geri döner
  const wy = -(SCENERY.poolBottom + SCENERY.poolTop) / 2 - 6 - SCENERY.lift;
  const kf = K(
    R(0, 0.18, 1, { dy: wy, e: 1 }),
    R(0.12, 0.45, 1, { dy: wy + 8, e: 1 }),
    R(0.24, 0.62, 1, { dy: wy - 4, e: 1 }),
    R(0.34, 0.7, 1, { dy: wy }),
    R(0.36, 0.72, 1, { dy: wy, f: 1 }),
    R(0.42, 0.85, 1, { dy: wy - 110, f: 1, a: -0.25 }),
    R(0.5, 1.2, 0.25, { f: 1, a: -0.2 }),
    hide(0.502, 1.2, 0.25, { f: 1 }),
    hide(0.74, -0.2, 0.3, { f: 1 }),
    R(0.742, -0.2, 0.3, { f: 1, a: 0.15 }),
    R(0.86, 0.1, 1, { dy: wy - 60, f: 1, a: 0.2 }),
    R(0.9, 0.16, 1, { dy: wy - 2, f: 1 }),
    R(0.92, 0.18, 1, { dy: wy, f: 0 }),
    R(1, 0.18, 1, { dy: wy, f: 0 }),
  );
  const mom = track(kit, rand, { sprite: SPRITE.duckSwim, size: 34, period: 34, kf, framed: true, flapFrom: 1, flap: 5, bob: [1.5, 0.4] });
  const kids = [];
  for (let j = 1; j <= 4; j += 1) {
    kids.push(follow(kit, rand, mom, { sprite: SPRITE.duckSwim, size: 20, lag: j * 0.014, framed: true, flapFrom: 1, flap: 6 }));
  }
  out.push(...kids.reverse(), mom);
  // puro dumanı kıvrılarak yükselir
  const ash = anchorAt(kit, rand, 0.9, 1, { dy: -(60 + SCENERY.lift), period: 16 });
  out.push(...emitter(kit, rand, ash, {
    sprite: SPRITE.glow, size: 10, life: 0.25, slots: 6, dir: -Math.PI / 2, spread: 0.25, speed: 22, sway: [16, 0.18],
    grow: 3.5, color: pick(tone, "#d0d0d0", "#7d7d7d"), alpha: 0.35,
  }));
  return out;
}

const featherFall = (kit, rand, tone, cols, o = {}) => {
  const p = kit.falling(kit.blank(rand), rand, rand(), {
    sprite: kit.SPRITE.feather, size: o.size ?? [20, 34], speed: o.speed ?? [14, 30], wind: [-8, 8], sway: [20, 48],
    swayFreq: [0.08, 0.18], rot: 0.4, wobble: [0.3, 0.7], alpha: o.alpha ?? [0.75, 1],
  });
  kit.paint(p, kit.pickFrom(rand, pick(tone, cols[0], cols[1])));
  return p;
};

// Siyah tüyler (yoğunlukla).
function dnFeathers(kit, { rand, count, tone }) {
  const n = Math.max(6, Math.min(30, count));
  return Array.from({ length: n }, () => featherFall(kit, rand, tone, [["#4b4a57", "#5c5a6b"], ["#15141a", "#26242e"]]));
}

function dnScene(kit, { rand, tone }) {
  const { SPRITE, KIND } = kit;
  const out = [];
  // defter sayfaları savrulur
  for (let i = 0; i < 4; i += 1) {
    const p = kit.blank(rand);
    p.kind = KIND.drift;
    kit.setSprite(p, SPRITE.page);
    p.size = kit.lerp(26, 36, rand());
    p.windX = (i % 2 ? -1 : 1) * kit.lerp(12, 26, rand());
    p.y0 = kit.lerp(0.1, 0.8, rand());
    p.swayAmp = kit.lerp(10, 24, rand());
    p.swayFreq = kit.lerp(0.06, 0.14, rand());
    p.driftAmpY = kit.lerp(20, 50, rand());
    p.driftFreqY = kit.lerp(0.03, 0.07, rand());
    p.rotSpeed = kit.lerp(-0.4, 0.4, rand());
    p.wobbleAmp = kit.lerp(0.2, 0.5, rand());
    p.wobbleFreq = p.swayFreq;
    p.a = 0.8;
    kit.paint(p, pick(tone, "#eceae4", "#8a877e"));
    out.push(p);
  }
  // elma havada döner; ara sıra ısırılmış hale geçer, söner, yenisi belirir
  const x = 0.76;
  const y = 0.3;
  out.push(track(kit, rand, {
    sprite: SPRITE.apple, size: 40, period: 18, framed: true, bob: [6, 0.1], rock: [0.25, 0.09],
    kf: K(R(0, x, y), R(0.55, x, y), R(0.56, x, y, { f: 1 }), R(0.82, x, y, { f: 1 }), hide(0.88, x, y, { f: 1 }),
      hide(0.9, x, y), R(0.96, x, y), R(1, x, y)),
  }));
  return out;
}

// Beyaz tüyler (yoğunlukla).
function aotFeathers(kit, { rand, count, tone }) {
  const n = Math.max(4, Math.min(16, Math.round(count / 2)));
  return Array.from({ length: n }, () =>
    featherFall(kit, rand, tone, [["#ffffff", "#e6eefc"], ["#7b8aa0", "#8e9ab0"]], { size: [16, 26], speed: [12, 24], alpha: [0.6, 0.9] }),
  );
}

function aotScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // Dev: 60 sn'de bir, her seferinde duvarın rastgele bir yerinden (jitterX) ve döngü başlangıcına
  // göre rastgele bir anda (faz) duvarın ARDINDAN yükselir; duvar tam opak olduğu için gövdesinin
  // duvarın altında kalan kısmı hiç görünmez. Sonra çöker ve 1 dakika yok olur.
  const T = 190;
  const P = 60;
  const top = SCENERY.titanWallTop + SCENERY.lift;
  const low = -(top - T * 0.62);
  const up = -(top + 6);
  const kf = K(
    hide(0, 0.5, 1, { dy: low }),
    hide(0.3, 0.5, 1, { dy: low, e: 1 }),
    R(0.35, 0.5, 1, { dy: low - 30, e: 1 }),
    R(0.4, 0.5, 1, { dy: up, e: 1 }),
    R(0.5, 0.5, 1, { dy: up - 4, e: 1 }),
    R(0.56, 0.5, 1, { dy: low - 30 }),
    hide(0.6, 0.5, 1, { dy: low }),
    hide(1, 0.5, 1, { dy: low }),
  );
  const titan = track(kit, rand, { sprite: SPRITE.titan, size: T, period: P, kf, jitterX: 0.6 });
  const steam = { sprite: SPRITE.glow, w: [0.37, 0.57], life: 0.037, dir: -Math.PI / 2, speed: 28, sway: [14, 0.2], color: pick(tone, "#ffffff", "#c5cdd8") };
  out.push(...emitter(kit, rand, titan, { ...steam, size: 22, slots: 10, spread: 1.2, grow: 3.4, alpha: 0.4, oy: -T * 0.32 }));
  out.push(...emitter(kit, rand, titan, { ...steam, size: 18, slots: 4, spread: 0.9, grow: 3, alpha: 0.35, ox: -T * 0.3, oy: -T * 0.05 }));
  out.push(...emitter(kit, rand, titan, { ...steam, size: 18, slots: 4, spread: 0.9, grow: 3, alpha: 0.35, ox: T * 0.3, oy: -T * 0.05 }));
  out.push(titan);
  // Keşif birliği askeri (12 sn): iki salınım ve arada takla; her salınım başında gaz püskürür,
  // en alt noktada kılıç parıltısı.
  const P2 = 12;
  const ay = -0.02;
  const lx = 0.22;
  const ly = 0.27;
  const tm = 1.0;
  const ax = [0.2, 0.2 + 2 * lx * Math.sin(tm) + 0.1];
  const rows = [hide(0, -0.15, 0.2)];
  const win = [];
  const spans = [[0.02, 0.4], [0.5, 0.88]];
  ax.forEach((a, j) => {
    rows.push(...curve(spans[j][0], spans[j][1], 9, swing(a, ay, lx, ly, tm, 0.8)));
    win.push([spans[j][0], spans[j][1], a, ay]);
    if (j === 0) {
      const x0 = ax[0] + lx * Math.sin(tm);
      const x1 = ax[1] - lx * Math.sin(tm);
      const y0 = ay + ly * Math.cos(tm);
      rows.push(...curve(0.402, 0.498, 6, (tau) => ({
        x: x0 + (x1 - x0) * tau, y: y0 - 0.07 * Math.sin(Math.PI * tau), a: -0.8 + (1.6 + 2 * Math.PI) * tau,
      })));
    }
  });
  rows.push(R(0.93, ax[1] + 0.3, 0.14, { a: -0.5 }), hide(0.935, ax[1] + 0.3, 0.14), hide(1, ax[1] + 0.3, 0.14));
  const SC = 50;
  const scout = track(kit, rand, { sprite: SPRITE.scout, size: SC, period: P2, rest: 5, kf: K(...rows) });
  for (const dxw of [-0.02, 0.02]) {
    out.push(tether(kit, rand, scout, win.map(([u0, u1, a, y]) => [u0, u1, a + dxw, y]), { oy: -SC * 0.06, color: 1, width: 1.1 }));
  }
  const gas = pick(tone, "#f2f6fb", "#c5cdd8");
  for (const w of [[0.02, 0.07], [0.5, 0.55]]) {
    out.push(...emitter(kit, rand, scout, {
      sprite: SPRITE.glow, size: 12, w, life: 0.012, slots: 5, dir: Math.PI, spread: 0.7, speed: 40, grow: 3, color: gas, alpha: 0.6, ox: -SC * 0.18, oy: SC * 0.05,
    }));
  }
  for (const w of [[0.19, 0.23], [0.67, 0.71]]) {
    out.push(...emitter(kit, rand, scout, {
      sprite: SPRITE.glow, size: 18, w, life: 0.02, slots: 1, speed: 0, grow: 1.8, color: "#ffffff", alpha: 0.85, ox: SC * 0.4, oy: -SC * 0.02,
    }));
  }
  out.push(scout);
  return out;
}

// Girdap yapan ve rüzgârda savrulan yapraklar (yoğunlukla).
function narLeaves(kit, { rand, count, tone }) {
  const { SPRITE, KIND } = kit;
  const out = [];
  const green = pick(tone, ["#7bd66b", "#5fbf4f", "#a6e07a"], ["#2f9e3f", "#3aa845", "#4f8f2a"]);
  const n = Math.max(10, Math.min(36, count));
  const swirl = Math.round(n * 0.7);
  for (let i = 0; i < n; i += 1) {
    const p = kit.blank(rand);
    kit.paint(p, kit.pickFrom(rand, green));
    if (i < swirl) {
      p.kind = KIND.orbit;
      kit.setSprite(p, rand() < 0.5 ? SPRITE.leafA : SPRITE.leafB);
      p.size = kit.lerp(13, 22, rand());
      p.ocx = 0.5;
      p.ocy = 0.42;
      p.orbitR = kit.lerp(36, 150, rand());
      p.orbitW = kit.lerp(0.45, 1.05, rand());
      p.oratio = 0.42;
      p.orbitPulse = 0.22;
      p.driftFreqY = kit.lerp(0.05, 0.1, rand());
      p.rotSpeed = kit.lerp(-2, 2, rand());
      p.a = kit.lerp(0.7, 0.95, rand());
    } else {
      kit.falling(p, rand, rand(), {
        sprite: SPRITE.leafA, size: [12, 20], speed: [26, 50], wind: [40, 80], sway: [20, 46], swayFreq: [0.12, 0.26],
        rot: 0.9, wobble: [0.4, 0.9], alpha: [0.7, 0.95],
      });
    }
    out.push(p);
  }
  return out;
}

function narScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  const steel = pick(tone, "#c9d1dc", "#4b5563");
  // dönen fırlatma yıldızları (simetrik: iki yönde de geçer)
  out.push(track(kit, rand, {
    sprite: SPRITE.shuriken, size: 24, period: 9, rest: 8, spin: 14, color: steel,
    kf: K(R(0, -0.1, 0.24), R(0.14, 1.1, 0.32), hide(0.142, 1.1, 0.32), hide(1, 1.1, 0.32)),
  }));
  out.push(track(kit, rand, {
    sprite: SPRITE.shuriken, size: 20, period: 13, rest: 6, spin: -12, color: steel,
    kf: K(R(0, 1.1, 0.55), R(0.16, -0.1, 0.48), hide(0.162, -0.1, 0.48), hide(1, -0.1, 0.48)),
  }));
  // kunai gidişine dönük uçar
  out.push(track(kit, rand, {
    sprite: SPRITE.kunai, size: 30, period: 15, rest: 6, face: true, color: steel,
    kf: K(R(0, 1.1, 0.16), R(0.12, -0.1, 0.22), hide(0.122, -0.1, 0.22), hide(1, -0.1, 0.22)),
  }));
  // "puf": rastgele bir yerde duman bulutu belirip dağılır
  const spot = anchorAt(kit, rand, 0.5, 0.45, { period: 11, rest: 8, jitterX: 0.6, jitterY: 0.3 });
  out.push(...emitter(kit, rand, spot, {
    sprite: SPRITE.glow, size: 22, w: [0.5, 0.505], life: 0.07, slots: 10, spread: kit.TAU, speed: 60, grow: 2.6,
    color: pick(tone, ["#ffffff", "#e5e7eb"], ["#9ca3af", "#b6bcc6"]), alpha: 0.6, fadeK: 1.4,
  }));
  return out;
}

function opScene(kit, { rand }) {
  const { SPRITE } = kit;
  return [
    // (gemi VEKTÖR: opShip katmanı, 44 sn) hasır şapka rüzgârda takla atarak geçer
    track(kit, rand, {
      sprite: SPRITE.strawHat, size: 40, period: 15, rest: 5, spin: 3.2,
      kf: K(R(0, -0.1, 0.3), R(0.12, 0.3, 0.18, { e: 1 }), R(0.24, 0.62, 0.36, { e: 1 }), R(0.36, 1.12, 0.22),
        hide(0.362, 1.12, 0.22), hide(1, 1.12, 0.22)),
    }),
    // sarmal desenli meyve süzülür
    track(kit, rand, { sprite: SPRITE.devilFruit, size: 36, kf: still(0.18, 0.36), bob: [6, 0.1], rock: [0.2, 0.08] }),
  ];
}

function fmaScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // cep saati zincirinde sarkaç gibi sallanır
  const ax = 0.84;
  const ay = -0.02;
  const rows = curve(0, 1, 16, (tau) => {
    const th = 0.32 * Math.sin(2 * Math.PI * tau);
    return { x: ax + 0.44 * Math.sin(th), y: ay + 0.2 * Math.cos(th), a: -th };
  });
  const watch = track(kit, rand, { sprite: SPRITE.pocketWatch, size: 44, period: 3.2, kf: K(...rows) });
  out.push(watch, tether(kit, rand, watch, [[0, 1.01, ax, ay]], { oy: -18, color: 2, width: 1.6 }));
  // kırmızı taş parçası parıltıları
  for (let i = 0; i < 5; i += 1) {
    out.push(track(kit, rand, {
      sprite: SPRITE.glow, size: kit.lerp(7, 12, rand()), kf: still(kit.lerp(0.1, 0.9, rand()), kit.lerp(0.12, 0.7, rand())),
      bob: [5, 0.08], pulse: [kit.lerp(0.2, 0.45, rand()), 0.08], color: pick(tone, "#ff4d5e", "#c81e3a"), alpha: 0.9,
    }));
  }
  return out;
}

// Rick and Morty (30 sn, rmPortal katmanıyla aynı saat): portal açılır, Rick ve Morty yürüyüp
// içine girer ve küçülerek kaybolur, portal kapanır; sonra Rick'in uçan dairesi gökten geçer.
function rmScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  const P = 30;
  const F = SCENERY.lift + 30; // ayak hizası (dp, alttan)
  const green = pick(tone, ["#7dff8a", "#b8ffbf"], ["#1c9e2a", "#2bb33a"]);
  const rickDy = -(F + 31);
  const kf = K(
    hide(0, 0.04, 1, { dy: rickDy }), hide(0.13, 0.04, 1, { dy: rickDy }),
    R(0.15, 0.06, 1, { dy: rickDy }), R(0.44, 0.62, 1, { dy: rickDy }),
    R(0.5, 0.715, 1, { dy: -(F + 36), s: 0.05 }),
    hide(0.505, 0.72, 1, { dy: -(F + 36), s: 0.05 }), hide(1, 0.72, 1, { dy: -(F + 36), s: 0.05 }),
  );
  const rick = track(kit, rand, { sprite: SPRITE.rick, size: 62, period: P, rest: 3, phase: 0, kf, bob: [1.6, 1.1], rock: [0.04, 2.2] });
  const morty = follow(kit, rand, rick, { sprite: SPRITE.morty, size: 46, lag: 0.04, oy: 8 });
  out.push(morty, rick);
  // portal kıvılcımları
  const portal = anchorAt(kit, rand, 0.72, 1, { dy: -(F + 36), period: P, rest: 3, phase: 0, alpha: 0.01 });
  out.push(portal, ...emitter(kit, rand, portal, {
    sprite: SPRITE.glow, size: 9, w: [0.12, 0.56], life: 0.03, slots: 8, spread: kit.TAU, speed: 38, grow: 0.8, color: green, alpha: 0.7, fadeK: 1.4,
  }));
  // uçan daire: sağdan sola
  const saucer = track(kit, rand, {
    sprite: SPRITE.saucer, size: 64, period: P, rest: 3, phase: 0, bob: [3, 0.4], rock: [0.05, 0.3],
    kf: K(
      hide(0, 1.2, 0.22), hide(0.6, 1.2, 0.22),
      ...curve(0.62, 0.9, 10, (tau) => ({ x: 1.12 - 1.34 * tau, y: 0.22 + 0.05 * Math.sin(tau * 6), a: -0.06 })),
      hide(0.905, -0.2, 0.22), hide(1, -0.2, 0.22),
    ),
  });
  out.push(...emitter(kit, rand, saucer, {
    sprite: SPRITE.glow, size: 10, w: [0.62, 0.9], life: 0.02, slots: 6, dir: 0, spread: 0.3, speed: 60, grow: 2, color: green, alpha: 0.55, ox: 26, oy: 6,
  }));
  out.push(saucer);
  return out;
}

export const SCENE_BUILDERS = Object.freeze({
  swScene, matrixRain, matrixScene, hpScene, lotrScene, duneScene, batScene, spiderScene, bbScene, gotScene,
  vikScene, pbScene, shScene, soprScene, dnFeathers, dnScene, aotFeathers, aotScene, narLeaves, narScene,
  opScene, fmaScene, rmScene,
});
