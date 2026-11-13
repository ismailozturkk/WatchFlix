// utils/weatherUniverses.js
//
// Atmosferin "evren" sahneleri: 17 film, 12 dizi, 11 anime. Her sahne bir ANA OLAY
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
  { id: "interstellar", group: "films", movies: [157336] },
  { id: "bladeRunner", group: "films", collections: [422837], movies: [78, 335984] }, // Blade Runner + 2049
  { id: "jurassicPark", group: "films", collections: [328] }, // Jurassic Park + Jurassic World
  { id: "avatar", group: "films", collections: [87096] },
  { id: "madMax", group: "films", collections: [8945] }, // Mad Max serisi + Fury Road + Furiosa
  { id: "pirates", group: "films", collections: [295] },
  { id: "inception", group: "films", movies: [27205] },
  { id: "titanic", group: "films", movies: [597] },
  { id: "backToTheFuture", group: "films", collections: [264] }, // üçleme
  { id: "shining", group: "films", movies: [694, 501170] }, // + Doctor Sleep
  // diziler
  { id: "breakingBad", group: "series", tv: [1396] },
  { id: "got", group: "series", tv: [1399] },
  { id: "vikings", group: "series", tv: [44217, 116135] }, // + Valhalla
  { id: "prisonBreak", group: "series", tv: [2288] },
  { id: "sherlock", group: "series", tv: [19885] },
  { id: "strangerThings", group: "series", tv: [66732] },
  { id: "lastOfUs", group: "series", tv: [100088] },
  { id: "dark", group: "series", tv: [70523] },
  { id: "squidGame", group: "series", tv: [93405] },
  { id: "witcher", group: "series", tv: [71912, 106541] }, // + Blood Origin
  { id: "fallout", group: "series", tv: [106379] },
  { id: "moneyHeist", group: "series", tv: [71446, 146176] }, // + Berlin
  // anime
  { id: "deathNote", group: "anime", tv: [13916] },
  { id: "aot", group: "anime", tv: [1429] },
  { id: "naruto", group: "anime", tv: [46260, 31910] }, // + Shippūden
  { id: "onePiece", group: "anime", tv: [37854, 111110] }, // + canlı çekim
  { id: "fma", group: "anime", tv: [31911] },
  { id: "rickAndMorty", group: "anime", tv: [60625] },
  { id: "demonSlayer", group: "anime", tv: [85937], movies: [635302] }, // + Mugen Train
  { id: "ghibli", group: "anime", movies: [8392, 129, 4935, 128, 16859, 12429, 10515, 81, 149870, 51739, 508883, 37797, 11621, 12477] }, // Studio Ghibli filmleri
  { id: "hunterXHunter", group: "anime", tv: [46298] },
  { id: "jujutsuKaisen", group: "anime", tv: [95479], movies: [810693] }, // + Jujutsu Kaisen 0
  { id: "arcane", group: "anime", tv: [94605] },
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
  matrix: Object.freeze([["matrixRain", 1], ["matrixCity", { fixed: 1 }], ["matrixScene", { fixed: 3 }]]),
  harryPotter: Object.freeze([["skyStars", 0.45], ["magicMotes", 0.55], ["hogwarts", { fixed: 1 }], ["hpScene", { fixed: 23 }]]),
  lotr: Object.freeze([["mordor", { fixed: 1 }], ["embers", 0.7], ["ash", 0.3], ["lotrScene", { fixed: 11 }]]),
  dune: Object.freeze([["dunes", { fixed: 1 }], ["sandDrift", 1], ["duneScene", { fixed: 40 }]]),
  batman: Object.freeze([
    ["skyBeam", { fixed: 2 }], ["gotham", { fixed: 1 }], ["rain", 1], ["lightning", { fixed: 2 }], ["batScene", { fixed: 11 }],
  ]),
  spiderMan: Object.freeze([["skyline", { fixed: 1 }], ["motes", 1], ["spiderScene", { fixed: 18 }]]),
  breakingBad: Object.freeze([
    ["mesa", { fixed: 1 }], ["heatHaze", { fixed: 1 }], ["sandDrift", 0.85], ["tumbleweed", 0.15], ["bbScene", { fixed: 4 }],
  ]),
  got: Object.freeze([["iceWall", { fixed: 1 }], ["snow", 1], ["gotScene", { fixed: 2 }]]),
  vikings: Object.freeze([["skyStars", 1], ["auroraBands", { fixed: 3 }], ["river", { fixed: 1 }], ["vikScene", { fixed: 28 }]]),
  prisonBreak: Object.freeze([["prison", { fixed: 1 }], ["motes", 1], ["pbScene", { fixed: 4 }]]),
  // Sherlock, Death Note, Naruto, One Piece, FMA: tek VEKTÖR sahne (components/decor/<ad>Scene.js) + ortam
  sherlock: Object.freeze([["sherVec", { fixed: 1 }], ["motes", 1]]),
  deathNote: Object.freeze([["dnFeathers", 1], ["dnVec", { fixed: 1 }]]),
  aot: Object.freeze([["titanWall", { fixed: 1 }], ["aotFeathers", 1], ["aotScene", { fixed: 34 }]]),
  naruto: Object.freeze([["narVec", { fixed: 1 }], ["narLeaves", 1]]),
  onePiece: Object.freeze([
    ["opSky", { fixed: 1 }], ["waves", { fixed: 3 }], ["opShip", { fixed: 1 }], ["seagulls", 0.35], ["glints", 0.65],
  ]),
  fma: Object.freeze([["fmaVec", { fixed: 1 }], ["motes", 1]]),
  interstellar: Object.freeze([["skyStars", 1], ["isVec", { fixed: 1 }]]),
  strangerThings: Object.freeze([["stVec", { fixed: 1 }], ["ash", 1]]),
  demonSlayer: Object.freeze([["dsVec", { fixed: 1 }], ["sakura", 1]]),
  bladeRunner: Object.freeze([["brVec", { fixed: 1 }], ["rain", 1]]),
  ghibli: Object.freeze([["ghVec", { fixed: 1 }], ["rain", 0.6], ["fireflies", 0.4]]),
  lastOfUs: Object.freeze([["tlVec", { fixed: 1 }], ["motes", 1]]),
  jurassicPark: Object.freeze([["jpVec", { fixed: 1 }], ["motes", 1]]),
  avatar: Object.freeze([["avVec", { fixed: 1 }], ["fireflies", 1]]),
  madMax: Object.freeze([["mmVec", { fixed: 1 }], ["sandDrift", 1]]),
  pirates: Object.freeze([["pcVec", { fixed: 1 }], ["skyStars", 1]]),
  inception: Object.freeze([["inVec", { fixed: 1 }], ["motes", 1]]),
  titanic: Object.freeze([["tiVec", { fixed: 1 }], ["skyStars", 1]]),
  dark: Object.freeze([["dkVec", { fixed: 1 }], ["rain", 0.7]]),
  squidGame: Object.freeze([["sqVec", { fixed: 1 }], ["motes", 0.6]]),
  hunterXHunter: Object.freeze([["hxVec", { fixed: 1 }], ["butterflies", 0.5]]),
  jujutsuKaisen: Object.freeze([["jjVec", { fixed: 1 }], ["ash", 0.6]]),
  backToTheFuture: Object.freeze([["btVec", { fixed: 1 }], ["rain", 0.5]]),
  shining: Object.freeze([["snVec", { fixed: 1 }], ["snow", 1]]),
  witcher: Object.freeze([["wiVec", { fixed: 1 }], ["motes", 0.6]]),
  fallout: Object.freeze([["foVec", { fixed: 1 }], ["sandDrift", 0.8]]),
  moneyHeist: Object.freeze([["mhVec", { fixed: 1 }], ["motes", 0.5]]),
  arcane: Object.freeze([["arVec", { fixed: 1 }], ["motes", 0.7]]),
  rickAndMorty: Object.freeze([["skyStars", 0.5], ["motes", 0.5], ["rmPortal", { fixed: 1 }], ["rmScene", { fixed: 18 }]]),
});

const SCENE_PART_IDS = [
  "swScene", "matrixRain", "matrixScene", "hpScene", "lotrScene", "duneScene", "batScene", "spiderScene",
  "bbScene", "gotScene", "vikScene", "pbScene", "dnFeathers", "aotFeathers", "aotScene", "narLeaves", "rmScene",
];

// Toplam sayı = sabit sahne + ortam payı. Ortam azken bile sahne tam çizilir.
export const UNIVERSE_SPECS = Object.freeze({
  starWars: { counts: c3(150, 210, 270) },
  matrix: { counts: c3(68, 111, 156) }, // 8'li kod sütunları + 4 sahne (çatı katmanı + 2 hap + kedi)
  harryPotter: { counts: c3(46, 74, 94) },
  lotr: { counts: c3(38, 52, 72) },
  dune: { counts: c3(100, 150, 185) },
  batman: { counts: c3(66, 96, 146) },
  spiderMan: { counts: c3(33, 53, 69) },
  breakingBad: { counts: c3(40, 54, 76) },
  got: { counts: c3(70, 105, 145) },
  vikings: { counts: c3(46, 80, 104) },
  prisonBreak: { counts: c3(18, 26, 38) },
  sherlock: { counts: c3(13, 21, 29) }, // + 1 sahne
  deathNote: { counts: c3(10, 15, 22) }, // + 1 sahne
  aot: { counts: c3(46, 80, 100) },
  naruto: { counts: c3(16, 25, 35) }, // + 1 sahne
  onePiece: { counts: c3(24, 36, 54) }, // + gök sahnesi, 3 dalga, gemi
  fma: { counts: c3(13, 19, 27) }, // + 1 sahne
  rickAndMorty: { counts: c3(52, 74, 100) },
  jujutsuKaisen: { counts: c3(18, 30, 48) }, // + 1 sahne
  backToTheFuture: { counts: c3(24, 40, 64) }, // + 1 sahne
  shining: { counts: c3(40, 60, 90) }, // + 1 sahne
  witcher: { counts: c3(13, 21, 29) }, // + 1 sahne
  fallout: { counts: c3(24, 40, 64) }, // + 1 sahne
  moneyHeist: { counts: c3(10, 16, 24) }, // + 1 sahne
  arcane: { counts: c3(13, 21, 29) }, // + 1 sahne
  hunterXHunter: { counts: c3(4, 6, 9) }, // + 1 sahne
  squidGame: { counts: c3(8, 12, 18) }, // + 1 sahne
  dark: { counts: c3(40, 60, 90) }, // + 1 sahne
  titanic: { counts: c3(20, 32, 50) }, // + 1 sahne
  inception: { counts: c3(14, 22, 34) }, // + 1 sahne
  pirates: { counts: c3(20, 32, 50) }, // + 1 sahne
  madMax: { counts: c3(24, 40, 64) }, // + 1 sahne
  avatar: { counts: c3(10, 16, 24) }, // + 1 sahne
  jurassicPark: { counts: c3(10, 16, 24) }, // + 1 sahne
  lastOfUs: { counts: c3(13, 21, 29) }, // + 1 sahne
  ghibli: { counts: c3(40, 60, 90) }, // + 1 sahne
  bladeRunner: { counts: c3(60, 90, 130) }, // + 1 sahne
  demonSlayer: { counts: c3(16, 25, 35) }, // + 1 sahne
  strangerThings: { counts: c3(13, 21, 29) }, // + 1 sahne
  interstellar: { counts: c3(36, 56, 76) }, // + 1 sahne
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
  wallTop: 262, // Game of Thrones buz duvarı (tepe, alttan dp)
  titanWallTop: 230, // Attack on Titan duvarı
  gargoyle: { x: 0.8, top: 212 }, // Gotham: heykelli kulenin çıkıntısı
  mesaGround: 18, // Breaking Bad: çöl zemini
  waterline: 80, // dalgalı deniz (kıyı katmanı) gemi su hattı
});

// ── Sahne kurucuları ───────────────────────────────────────────────────────
// (kit, { rand, count, tone }) → parçacık dizisi. Sayı yalnız ortam parçalarında
// (kod yağmuru, tüy, yaprak) kullanılır; sahnenin kendisi her yoğunlukta tam.

// Star Wars: iki saat. Kovalamaca 22 sn sürer (X-wing iki geçiş), sonra dinlenir; Ölüm Yıldızı ve
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

  // ── 1 · Kovalamaca (ekranın alt yarısında) ──
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
  // Motorlar gemiyle aynı rotayı izler. İki ayrı sıcaklık kovalamacayı derinleştirir.
  out.push(follow(kit, rand, lead, { sprite: SPRITE.glow, size: 23, ox: -25, color: mix("#7fc4ff", "#478dd1"), pulse: [1.8, 0.55], alpha: 0.7 }));
  ties.forEach((tie) => out.push(follow(kit, rand, tie, {
    sprite: SPRITE.glow, size: 15, ox: -13, color: mix("#9bd8ff", "#6695c5"), pulse: [2.4, 0.55], alpha: 0.55,
  })));
  for (const [w0, w1] of [[0.05, 0.4], [0.55, 0.9]]) {
    for (const t of ties) {
      out.push(...emitter(kit, rand, t, {
        sprite: SPRITE.streak, size: 18, w: [w0, w1], life: 0.023, slots: 2, dirFace: true, spread: 0.06,
        speed: 560, align: true, color: green, alpha: 0.95, fadeK: 3, ox: 14,
      }));
    }
    out.push(...emitter(kit, rand, lead, {
      sprite: SPRITE.streak, size: 20, w: [w0 + 0.07, w1 - 0.03], life: 0.02, slots: 2, dirFace: true, spread: 0.04,
      speed: 620, dir: Math.PI, align: true, color: red, alpha: 0.95, fadeK: 3, ox: -18,
    }));
    // Yeşil atışlar X-wing'in yakınından geçerken kısa, seyrek kıvılcımlar.
    out.push(...emitter(kit, rand, lead, {
      sprite: SPRITE.speck, size: 5, w: [w0 + 0.12, w1 - 0.04], life: 0.018, slots: 4,
      spread: kit.TAU, speed: 48, grow: 0.5, color: mix("#dfffe9", "#65c77a"), alpha: 0.55,
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
    color: charge, alpha: 0.7, ox: -56 * 0.32, oy: -56 * 0.34, fadeK: 1.3,
  }));
  // Patlama: sıcak çekirdek, önündeki kıvılcımlar, ardından seyrelerek kalan gaz.
  // Büyük kabuk parçaları ve halkalar vektörde; Atlas küçük, yumuşak ayrıntıları taşır.
  const boom = anchorAt(kit, rand, 0.24, 0.36, { period: P, rest: RE, phase: 0, alpha: 0.01 });
  out.push(boom);
  out.push(...emitter(kit, rand, boom, {
    sprite: SPRITE.glow, size: 22, w: [0.52, 0.59], life: 0.05, slots: 6, spread: kit.TAU, speed: 95, grow: 2.3,
    color: mix(["#ffd18a", "#ff8a3c"], ["#f28a28", "#c2410c"]), alpha: 0.72, fadeK: 1.4,
  }));
  out.push(...emitter(kit, rand, boom, {
    sprite: SPRITE.speck, size: 5, w: [0.525, 0.68], life: 0.065, slots: 14, spread: kit.TAU, speed: 150, spin: 3.5,
    color: mix(["#e6edf0", "#8ab0a2", "#f5bc71"], ["#9bafb9", "#658678", "#cb8151"]), alpha: 0.85,
  }));
  out.push(...emitter(kit, rand, boom, {
    sprite: SPRITE.streak, size: 8, w: [0.53, 0.64], life: 0.035, slots: 8, spread: kit.TAU, speed: 210,
    align: true, grow: 1.6, color: mix(["#fff3c8", "#ffad64"], ["#ffd083", "#e87931"]), alpha: 0.75,
  }));
  out.push(...emitter(kit, rand, boom, {
    sprite: SPRITE.glow, size: 15, w: [0.57, 0.72], life: 0.085, slots: 6, spread: kit.TAU, speed: 48,
    grow: 2.5, color: mix("#c4ccd0", "#818c95"), alpha: 0.3,
  }));

  // ── 3 · Millennium Falcon hiperuzayı ──
  // Gemi ve motor ışıkları aynı vektör grubunda. Atlas yalnız yıldız izlerini taşır.
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
  // Neo, Ajan ve mermi zamanı VEKTÖR (components/decor/matrixScene.js, matrixCity katmanı, matrixFrame).
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
  // Şato, göl, Ruh Emiciler, Harry ve Patronus VEKTÖR (components/decor/hpScene.js, hogwarts katmanı:
  // 75 sn, olay 30 sn, faz 0). Burada: geyiğin koşusunda gölde kalan gümüş ışık zerreleri.
  const P = 75;
  const RE = 2.5;
  const lake = anchorAt(kit, rand, 0.32, 1, { dy: -(SCENERY.lift + 90), period: P, rest: RE, phase: 0, alpha: 0.01 });
  out.push(lake);
  out.push(...emitter(kit, rand, lake, {
    sprite: SPRITE.glow, size: 6, w: [0.36, 0.7], life: 0.04, slots: 8, dir: -Math.PI / 2, spread: 2.4, speed: 30, grav: -10,
    color: pick(tone, "#e6f3ff", "#7fb0e0"), alpha: 0.85, fadeK: 1.4,
  }));
  return out;
}

function lotrScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // Mordor, Göz, Hüküm Dağı, Nazgûllar, hobbitler ve kartallar VEKTÖR (components/decor/lotrScene.js,
  // mordor katmanı: 75 sn, olay 30 sn, faz 0). Burada: patlamada kraterden saçılan közler.
  const P = 75;
  const RE = 2.5;
  const crater = anchorAt(kit, rand, 0.27, 1, { dy: -(SCENERY.lift + 244), period: P, rest: RE, phase: 0, alpha: 0.01 });
  out.push(crater);
  out.push(...emitter(kit, rand, crater, {
    sprite: SPRITE.glow, size: 6, w: [0.38, 0.62], life: 0.03, slots: 10, dir: -Math.PI / 2, spread: 1.6, speed: 160, grav: 140,
    color: pick(tone, "#ffb347", "#ff7a1a"), alpha: 0.9, fadeK: 1.2,
  }));
  return out;
}

function duneScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  const sand = pick(tone, ["#e0b878", "#c99a5b"], ["#a8783f", "#b98a4c"]);
  // Solucan, Fremen, ornitopter ve hasatçı VEKTÖR (components/decor/duneScene.js, dunes katmanı:
  // 72 sn, olay 30 sn, faz 0). Burada: solucan yükselirken ve dalarken saçılan kum zerreleri,
  // savrulan baharat parıltıları.
  const P = 72;
  const RE = 2.4;
  const at = (x, dy) => anchorAt(kit, rand, x, 1, { dy: -(SCENERY.lift + dy), period: P, rest: RE, phase: 0, alpha: 0.01 });
  const rise = at(0.6, 70);
  const dive = at(0.24, 72);
  out.push(rise, dive);
  for (const [anchor, w] of [[rise, [0.4, 0.5]], [dive, [0.62, 0.7]]]) {
    out.push(...emitter(kit, rand, anchor, {
      sprite: SPRITE.speck, size: 6, w, life: 0.025, slots: 12, dir: -Math.PI / 2, spread: 1.4, speed: 190, grav: 260,
      color: sand, alpha: 0.9, spin: 3,
    }));
  }
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
  // Gotham, yarasa işareti, gargoyle ve Batman VEKTÖR (components/decor/batScene.js, gotham katmanı, batFrame).
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
  // Şehir, su kulesi, örümcek adam ve ağ ipleri VEKTÖR (components/decor/spiderScene.js, skyline katmanı:
  // 66 sn, olay 30 sn, faz 0). Burada: köşe ağlarındaki çiy damlaları, konmada kalkan toz,
  // havada süzülen ağ lifleri.
  for (const [x, y, ox, oy] of [[0, 0, 30, 70], [0, 0, 64, 38], [0, 0, 90, 20], [1, 0, -40, 62], [1, 0, -76, 30]]) {
    out.push(track(kit, rand, {
      sprite: SPRITE.glow, size: 7, kf: still(x, y), ox, oy, pulse: [kit.lerp(0.4, 0.9, rand()), 0.1], color: "#ffffff",
      alpha: 0.9,
    }));
  }
  const P = 66;
  const RE = 2.2;
  // su kulesi tepesi (spiderLayout: çatı 118 + bacak 22 + gövde 36 → zeminden ~182 dp)
  const perch = anchorAt(kit, rand, 0.8, 1, { dy: -(SCENERY.lift + 180), period: P, rest: RE, phase: 0, alpha: 0.01 });
  out.push(perch);
  out.push(...emitter(kit, rand, perch, {
    sprite: SPRITE.speck, size: 5, w: [0.42, 0.45], life: 0.03, slots: 8, dir: -Math.PI / 2, spread: 2.6, speed: 60, grav: 90,
    color: pick(tone, "#cfd4dc", "#8a93a6"), alpha: 0.7, spin: 2,
  }));
  for (let i = 0; i < 4; i += 1) {
    const p = kit.floating(kit.blank(rand), rand, rand(), {
      sprite: SPRITE.thread, size: [10, 18], sway: [10, 30], freq: [0.02, 0.05], drift: [6, 16], pulse: [0.2, 0.5],
      pulseMin: 0.4, alpha: [0.3, 0.55], yRange: [0.1, 0.5],
    });
    kit.paint(p, webCol);
    out.push(p);
  }
  return out;
}

function bbScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // Karavan, Walter/Jesse, pantolon ve duman VEKTÖR (components/decor/bbScene.js, mesa katmanı, bbFrame).
  // başlık kartındaki gibi element kutucukları süzülür; arada biri parlar
  for (const [sprite, x, y, ph] of [[SPRITE.tileBr, 0.24, 0.2, 0], [SPRITE.tileBa, 0.4, 0.27, 3.1]]) {
    const tile = track(kit, rand, { sprite, size: 44, kf: still(x, y), bob: [5, 0.07], rock: [0.06, 0.05] });
    out.push(
      follow(kit, rand, tile, { sprite: SPRITE.glow, size: 74, color: pick(tone, "#5be37d", "#1f9d55"), pulse: [0.09, 0], pulsePh: ph, alpha: 0.5 }),
      tile,
    );
  }
  return out;
}

function gotScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  // Ejderha, ateş, yıkılış ve ordu vektör: components/decor/gotScene.js (iceWall katmanı, gotFrame).
  // Burada yalnız uzaktan geçen kuzgunlar.
  rand(); // tohum akışını koru
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
  // Gemiler, alevli oklar, manastır ve yangın VEKTÖR (components/decor/vikingsScene.js, river katmanı:
  // 90 sn, olay 30 sn, faz 0). Burada: yanan çatılardan yükselen kıvılcımlar, kuzgunlar, runlar.
  const P = 90;
  const ember = pick(tone, ["#ffd08a", "#ff9a3c"], ["#e8590c", "#f59f00"]);
  for (const [x, dy] of [[0.78, 252], [0.64, 228], [0.92, 296]]) {
    const a = anchorAt(kit, rand, x, 1, { dy: -(SCENERY.lift + dy), period: P, rest: 3, phase: 0 });
    out.push(a, ...emitter(kit, rand, a, {
      sprite: SPRITE.dot, size: 4, w: [0.3, 0.86], life: 0.05, slots: 6, dir: -Math.PI / 2, spread: 0.9, speed: 46,
      sway: [8, 0.3], grow: 0.6, color: ember, alpha: 0.9,
    }));
  }
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
  // Dev, buharı, kapı tekmesi, enkaz ve toz VEKTÖR sahnede (components/decor/aotScene.js,
  // titanWall katmanı, aotFrame zaman çizelgesi). Burada yalnız keşif birliği askeri kalır.
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

// Rick and Morty: karakterler, portallar ve uzay aracı artık vektör (components/decor/rmScene.js,
// rmPortal katmanı, rmFrame). Burada yalnız portal kıvılcımları — aynı saat (66 sn, olay 30 sn).
function rmScene(kit, { rand, tone }) {
  const { SPRITE } = kit;
  const out = [];
  const P = 66;
  const REST = 2.2;
  const PY = SCENERY.lift + 26 + 44; // portal merkezi (dp, alttan)
  const green = pick(tone, ["#7dff8a", "#b8ffbf"], ["#1c9e2a", "#2bb33a"]);
  for (const [x, w] of [[0.8, [0.04, 0.29]], [0.2, [0.5, 0.78]]]) {
    const portal = anchorAt(kit, rand, x, 1, { dy: -PY, period: P, rest: REST, phase: 0, alpha: 0.01 });
    out.push(portal, ...emitter(kit, rand, portal, {
      sprite: SPRITE.glow, size: 8, w, life: 0.025, slots: 8, spread: kit.TAU, speed: 34, grow: 0.8, color: green, alpha: 0.7, fadeK: 1.4,
    }));
  }
  return out;
}
export const SCENE_BUILDERS = Object.freeze({
  swScene, matrixRain, matrixScene, hpScene, lotrScene, duneScene, batScene, spiderScene, bbScene, gotScene,
  vikScene, pbScene, dnFeathers, aotFeathers, aotScene, narLeaves, rmScene,
});
