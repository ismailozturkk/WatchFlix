// utils/weatherParticles.js
//
// "Atmosfer" parçacık katmanının SAF mantığı. RN/Skia importu YOK (jest yalnız
// saf modülleri test ediyor); çizim components/decor/ParticleField.js,
// şekiller components/decor/particleSprites.js.
//
// SEÇİLEBİLEN EFEKTLER (WEATHER_GROUPS)
// Seçicide grup başına en çok 6 simge (tek satıra sığsın):
//   mevsimler      mevsime göre, kar, bahar bahçesi (çim + büyüyen çiçek), yaz
//                  kıyısı (dalga + kum + martı + parıltı), yaprak
//   gökyüzü/ışık   yağmur, fırtına (yağmur + şimşek), aurora, yıldız tozu, kıvılcım, güneş sistemi (Güneş + 8 gezegen yörüngede, Ay, Uzay
//                  İstasyonu, asteroit kuşağı, kara delik, pulsar, kuyruklu yıldız; renkli şekiller)
//   doğa           sakura, ateş böceği, kelebek
//   sinema/şenlik  patlamış mısır, bilet ve yıldız, havai fişek, kalpler,
//                  Cadılar Bayramı (yarasa, balkabağı, hayalet, mezar, örümcek), Noel
//                  (kar, hediye, kardan adam, ağaç, ara sıra Noel Baba kızağı)
//   film / dizi / anime  19 "evren" sahnesi (utils/weatherUniverses.js): Star Wars,
//                  Matrix, Harry Potter, … Fullmetal Alchemist. Detay ekranında
//                  yapımın TMDB kimliğiyle kendiliğinden, seçicide elle.
// Karahindiba ayrı seçenek DEĞİL: bahar bahçesinin parçası (eski kayıt → bahar).
// Özel günler (SPECIAL_DAYS, yalnız SABİT tarihli) ayrı "Özel günler" anahtarıyla.
// Kaldırılanlar (eski kayıt → kar): film tozu, bokeh, sis, projektör, kabarcık.
// İÇ EFEKTLER (seçicide yok): bileşik efektlerin ve tür karışımının parçaları
//   (şimşek, çim, çiçek, dalga, kum, martı, aurora şeridi, balon, nota, ...).
//
// TÜRE GÖRE (detay ekranları): TMDB türleri (19 film + 16 dizi = 27 id)
// kanonik 20 türe, onlar da 17 TÜR AİLESİNE iner (GENRE_FAMILIES: filmde
// "Bilim Kurgu", dizide "Bilim Kurgu & Fantazi" aynı aile, aynı atmosfer); bir
// yapımın ilk 3 farklı ailesinin efektleri KARIŞIK çizilir (aksiyon + bilim
// kurgu + korku → kıvılcım + yıldız tozu + yarasa).
//
// MODEL
//   • Her parçacığın özellikleri tohumdan BİR KEZ üretilir. Kare başına state YOK.
//   • Konum/opaklık/şekil karesi her karede yalnız zamandan hesaplanır
//     (`particlePose`, `particleAlpha`, `particleSprite` — "worklet": UI
//     thread'de, Reanimated mapper'ında). Rastgele yeniden belirme gereken
//     türler (kayan yıldız, şimşek, çiçek, fişek) döngü numarasından türeyen
//     bir hash kullanır.
//   • Şekil hücreleri dokuda SPRITE_CELL aralıklı; her şeklin hücre içindeki
//     dikdörtgeni (SPRITE_RECT) şekle göre DAR/BASIK olabilir: ince yağmur
//     çizgisi kare değil şerit olarak çizilir → boş piksel işlenmez.
//   • `size` = şeklin UZUN kenarının dp karşılığı (`sizeMode` ile ekran
//     yüksekliği/genişliği katı da olabilir).

import { seededRandom, deriveSeed } from "./decorLayout";
import { foldGenreName, kanonikTur } from "./genreCanon";
import {
  SCENE_BUILDERS,
  SCENERY,
  UNIVERSE_COMPOSITES,
  UNIVERSE_GROUPS,
  UNIVERSE_SPECS,
} from "./weatherUniverses";

// ── Seçici ──────────────────────────────────────────────────────────────────

/** Seçici grupları (sıra = ekrandaki sıra). "auto" mevsimler grubunun başında. */
export const WEATHER_GROUPS = Object.freeze([
  Object.freeze({ id: "seasons", effects: Object.freeze(["auto", "snow", "springGarden", "summerShore", "leaves"]) }),
  Object.freeze({ id: "sky", effects: Object.freeze(["rain", "storm", "aurora", "stardust", "embers", "solarSystem"]) }),
  Object.freeze({ id: "nature", effects: Object.freeze(["sakura", "fireflies", "butterflies"]) }),
  Object.freeze({ id: "festive", effects: Object.freeze(["popcorn", "tickets", "fireworks", "hearts", "halloween", "christmas"]) }),
  // evrenler: films (7), series (6), anime (5)
  ...UNIVERSE_GROUPS.map((g) => Object.freeze({ id: g.id, effects: Object.freeze([...g.effects]) })),
]);

/** Seçicide bir grubun en çok simge sayısı (kayan tek satır). */
export const WEATHER_GROUP_MAX = 7;

/** Seçici değerleri ("auto" dahil). */
export const WEATHER_CHOICES = Object.freeze(WEATHER_GROUPS.flatMap((g) => g.effects));

/** Seçilebilir, çizilebilir efektler ("auto" hariç). */
export const WEATHER_EFFECTS = Object.freeze(WEATHER_CHOICES.filter((c) => c !== "auto"));

// Işık katmanı efektleri (ad → OVERLAY türü). Sıra = OVERLAY numarası.
const OVERLAY_EFFECT_OF = Object.freeze({
  flare: 0, planet: 1, heartbeat: 2, fog: 3, lampFlicker: 4, flashlight: 5, blinds: 6, neon: 7,
  warmGlow: 8, equalizer: 9, candle: 10, viewfinder: 11, farFlashes: 12, heatHaze: 13, spotlight: 14,
  paparazzi: 15, orbits: 16,
  // evren sahneleri (büyük silüetler + sahne ışıkları)
  iceWall: 17, dunes: 18, gotham: 19, skyline: 20, mordor: 21, mesa: 22, prison: 23, london: 24,
  pool: 25, titanWall: 26, transmute: 27, blueprint: 28, skyBeam: 30, river: 31, swPlanet: 32, hogwarts: 33, opShip: 34, rmPortal: 35,
});
const OVERLAY_EFFECTS = Object.keys(OVERLAY_EFFECT_OF);

/** Yalnız bileşiklerin ve tür karışımının içinde kullanılan efektler. */
export const INTERNAL_EFFECTS = Object.freeze([
  "lightning", "grass", "flowers", "waves", "sand", "glints", "seagulls", "auroraBands", "skyStars",
  "balloons", "notes", "motes", "wisps", "bats", "ash", "sandDrift", "dandelion",
  // özel gün parçaları
  "solarBodies", "asteroidBelt", "blackHole", "pulsar", "comets",
  "halloweenBats", "ghosts", "tombstones", "spiders", "xmasGoodies", "xmasScene", "sleigh", "cinema",
  // evren sahnesi parçaları (SCENE_BUILDERS)
  ...Object.keys(SCENE_BUILDERS),
  // tür parçaları (parçacık)
  "coals", "magicMotes", "rosePetals", "windowDrops", "confetti", "paperStars", "clouds", "kites",
  "planes", "parchment", "smoke", "tumbleweed",
  // tür ışık katmanları (vektör)
  ...OVERLAY_EFFECTS,
  // tür aileleri (bileşik; GENRE_FAMILIES)
  "genreAction", "genreScifi", "genreThriller", "genreHorror", "genreMystery", "genreCrime",
  "genreRomance", "genreDrama", "genreComedy", "genreAnimation", "genreFamily", "genreMusic",
  "genreHistory", "genreDocumentary", "genreWar", "genreWestern", "genreReality",
]);

const ALL_EFFECTS = Object.freeze([...WEATHER_EFFECTS, ...INTERNAL_EFFECTS]);

/** Yoğunluk basamakları (diğer dekor ayarlarıyla aynı dil). */
export const WEATHER_DENSITIES = Object.freeze(["auto", "low", "medium", "high"]);

export const WEATHER_SEED_SALT = 0x5e7;

// ── Doku şeridi ─────────────────────────────────────────────────────────────

/** Bir şeklin dokudaki hücre aralığı (px). */
export const SPRITE_CELL = 128; // 10 Kas: 64 → 128 (büyütülen şekiller bulanıktı); doku 1024 × 2048
/** Doku ızgarasının sütun sayısı: 8 × 5 hücre = 512 × 320 px (eski cihazların
 *  2048 px doku sınırının çok altında). Şimşek, dalga ve kum dokuda DEĞİL:
 *  ekranda büyük çizildikleri için vektör (components/decor/VectorLayers.js). */
export const SPRITE_COLS = 8;

// Sıra components/decor/particleSprites.js'teki hücrelerle BİREBİR aynı.
// Kanat çırpanlarda "kapalı" kare "açık"tan hemen sonra gelir.
export const SPRITE = Object.freeze({
  dot: 0,
  flake: 1,
  leafA: 2,
  leafB: 3,
  streak: 4,
  petal: 5,
  glow: 6,
  popcorn: 7,
  ticket: 8,
  star: 9,
  butterflyOpen: 10,
  butterflyClosed: 11,
  dandelion: 12,
  heart: 13,
  batOpen: 14,
  batClosed: 15,
  pumpkin: 16,
  speck: 17,
  trail: 18,
  grassA: 19,
  grassB: 20,
  flowerStem: 21,
  flowerHead: 22,
  gullOpen: 23,
  gullClosed: 24,
  ribbon: 25,
  solid: 26,
  balloon: 27,
  noteA: 28,
  noteB: 29,
  drop: 30,
  confetti: 31,
  cloud: 32,
  kite: 33,
  plane: 34,
  parchment: 35,
  tumbleweed: 36,
  sleigh: 37,
  snowman: 38,
  xmasTree: 39,
  gift: 40,
  candyCane: 41,
  ornament: 42,
  ghost: 43,
  tombstone: 44,
  spider: 45,
  thread: 46,
  sun: 47,
  mercury: 48,
  venus: 49,
  earth: 50,
  mars: 51,
  jupiter: 52,
  saturn: 53,
  uranus: 54,
  neptune: 55,
  moon: 56,
  iss: 57,
  pulsar: 58,
  blackHole: 59,
  // ── evrenler (utils/weatherUniverses.js)
  deathStar: 60,
  xwing: 61,
  tie: 62,
  glyphA: 63,
  glyphA2: 64,
  glyphB: 65,
  glyphB2: 66,
  pill: 67,
  bullet: 68,
  shockRing: 69,
  catA: 70,
  catB: 71,
  candle: 72,
  snitchOpen: 73,
  snitchClosed: 74,
  owlOpen: 75,
  owlClosed: 76,
  letter: 77,
  fellOpen: 78,
  fellClosed: 79,
  oneRing: 80,
  wormHead: 81,
  wormSeg: 82,
  thopterA: 83,
  thopterB: 84,
  capeA: 85,
  capeB: 86,
  web: 87,
  swinger: 88,
  rv: 89,
  tileBr: 90,
  tileBa: 91,
  hat: 92,
  flask: 93,
  dragonOpen: 94,
  dragonClosed: 95,
  ravenOpen: 96,
  ravenClosed: 97,
  longshipA: 98,
  longshipB: 99,
  runeA: 100,
  runeB: 101,
  runeC: 102,
  crane: 103,
  footprint: 104,
  magnifier: 105,
  duckSwim: 106,
  duckFlyOpen: 107,
  duckFlyClosed: 108,
  feather: 109,
  apple: 110,
  appleBitten: 111,
  page: 112,
  titan: 113,
  scout: 114,
  shuriken: 115,
  kunai: 116,
  pirateShip: 117,
  strawHat: 118,
  devilFruit: 119,
  pocketWatch: 120,
  starDestroyer: 121,
  blastRing: 122,
  broomRiderL: 123, // sola bakan süpürgeli oyuncu (eski falcon hücresi)
  broomRider: 124,
  rick: 125,
  morty: 126,
  saucer: 127,
});
export const SPRITE_COUNT = 128;

/**
 * Kendi renkleriyle çizilen (renkli) şekiller. Diğerleri beyaz/gri çizilip
 * parçacık başına paletle boyanır (modulate). Renkli şekilde parçacık BEYAZA
 * boyanır, doku olduğu gibi görünür; opaklık, solma, yoğunluk aynen çalışır.
 * Çizim components/decor/particleSprites.js'te (renkleri orada verilir).
 * Not: renkli şekil açık/koyu temaya göre renk değiştirmez.
 */
export const COLORED_SPRITES = Object.freeze([
  SPRITE.sleigh, SPRITE.sun, SPRITE.mercury, SPRITE.venus, SPRITE.earth, SPRITE.mars, SPRITE.jupiter,
  SPRITE.saturn, SPRITE.uranus, SPRITE.neptune, SPRITE.moon, SPRITE.iss, SPRITE.pulsar, SPRITE.blackHole,
  // evrenler
  SPRITE.deathStar, SPRITE.xwing, SPRITE.tie, SPRITE.bullet, SPRITE.candle, SPRITE.snitchOpen,
  SPRITE.snitchClosed, SPRITE.owlOpen, SPRITE.owlClosed, SPRITE.letter, SPRITE.oneRing, SPRITE.rv,
  SPRITE.tileBr, SPRITE.tileBa, SPRITE.dragonOpen, SPRITE.dragonClosed, SPRITE.longshipA, SPRITE.longshipB,
  SPRITE.magnifier, SPRITE.duckSwim, SPRITE.duckFlyOpen, SPRITE.duckFlyClosed, SPRITE.apple,
  SPRITE.appleBitten, SPRITE.titan, SPRITE.scout, SPRITE.pirateShip, SPRITE.strawHat, SPRITE.devilFruit,
  SPRITE.pocketWatch, SPRITE.starDestroyer, SPRITE.broomRiderL,
  SPRITE.broomRider, SPRITE.rick, SPRITE.morty, SPRITE.saucer, SPRITE.swinger,
]);
const COLORED_SET = new Set(COLORED_SPRITES);
export const SPRITE_ROWS = Math.ceil(SPRITE_COUNT / SPRITE_COLS);

// Hücre içindeki şekil dikdörtgeni, 100 birimlik kutuda [x, y, w, h].
// Listede olmayan şekil tam kare. Dar şekiller burada daraltılır: GPU yalnız
// bu dikdörtgeni boyar (yağmur çizgisi %84 daha az alan).
export const SPRITE_RECT = Object.freeze({
  [SPRITE.streak]: [42, 0, 16, 100],
  [SPRITE.trail]: [45, 0, 10, 100],
  [SPRITE.grassA]: [38, 0, 24, 100],
  [SPRITE.grassB]: [30, 0, 40, 100],
  [SPRITE.flowerStem]: [44, 0, 12, 100],
  [SPRITE.ribbon]: [0, 30, 100, 40],
  [SPRITE.solid]: [40, 40, 20, 20],
  [SPRITE.balloon]: [20, 0, 60, 100],
  [SPRITE.drop]: [40, 0, 20, 100],
  [SPRITE.confetti]: [20, 37, 60, 26],
  [SPRITE.sleigh]: [0, 22, 100, 50],
  [SPRITE.thread]: [47, 0, 6, 100],
  [SPRITE.iss]: [0, 30, 100, 40],
  [SPRITE.glyphA]: [25, 6, 50, 88],
  [SPRITE.glyphA2]: [25, 6, 50, 88],
  [SPRITE.glyphB]: [25, 6, 50, 88],
  [SPRITE.glyphB2]: [25, 6, 50, 88],
  [SPRITE.bullet]: [0, 36, 100, 28],
  [SPRITE.kunai]: [0, 38, 100, 24],
  [SPRITE.rv]: [0, 18, 100, 64],
  [SPRITE.xwing]: [0, 14, 100, 72],
  [SPRITE.longshipA]: [0, 10, 100, 80],
  [SPRITE.longshipB]: [0, 10, 100, 80],
});
const FULL_RECT = Object.freeze([0, 0, 100, 100]);
export const spriteRect = (sprite) => SPRITE_RECT[sprite] || FULL_RECT;

export const KIND = Object.freeze({
  fall: 0, // düşer (dir −1: yükselir)
  float: 1, // yerinde gezinir
  drift: 2, // yatay akar, dikeyde dalgalanır
  meteor: 3, // ara sıra çapraz geçer
  screenFlash: 4, // şimşek aydınlığı (tam ekran, çift çakma)
  burst: 5, // grup halinde patlar (havai fişek)
  // 6, 7 boş: projektör ışını ve ışın içi toz kaldırıldı (numaralar sabit,
  // particlePose sayıyla dallanıyor).
  anchor: 8, // alttan sabitli, sallanır (çim)
  grow: 9, // alttan büyür, açar, solar, başka yerde yeniden (çiçek)
  tile: 10, // kıyı katmanı: dalga / kum (VEKTÖR, Atlas çizmez)
  band: 11, // geniş, yavaş dalgalanan ışık şeridi (aurora)
  bolt: 12, // şimşek çizgisi (VEKTÖR; aydınlıkla aynı zamanlama)
  orbit: 16, // güneş sistemi: elips yörüngede dolanır (isteğe bağlı bir ebeveyn çevresinde: ay, uzay istasyonu)
  glide: 14, // ara sıra ekranı yatay geçer (Noel Baba kızağı)
  dangle: 15, // tavandan iplikle sarkar, aşağı yukarı iner (örümcek: part 0 ip, 1 gövde)
  track: 17, // evren sahnesi: anahtar karelerle senaryolu rota (gel–dur–eylem–git), isteğe bağlı kare değişimi
  emit: 18, // evren sahnesi: bir rotadan (ya da sabit noktadan) pencerede saçılan parçacık (ateş, buhar, mermi halkası)
  overlay: 13, // tür ışık katmanı (VEKTÖR: vinyet, sis, fener, ekolayzer…; `part` = OVERLAY)
});

// Tür ışık katmanları (KIND.overlay, `part`). Çizim components/decor/OverlayLayers.js,
// kare hesabı aşağıda (overlayFrame / overlaySlot / equalizerLevel / hazeLine).
export const OVERLAY = Object.freeze({
  flare: 0, // aksiyon: alt kenardan turuncu patlama ışığı (seyrek)
  planet: 1, // bilim kurgu: yavaş geçen halkalı gezegen
  heartbeat: 2, // gerilim: kenarlarda kalp atışı gibi koyulaşan vinyet
  fog: 3, // korku: alttan süzülen sis
  lamp: 4, // korku: arada titreyen tavan lambası konisi
  flashlight: 5, // gizem: ekranda gezinen el feneri halkası
  blinds: 6, // suç: çapraz jaluzi gölgesi
  neon: 7, // suç: alttan pembe/camgöbeği neon yansıması
  warmGlow: 8, // romantik: üst köşelerde nefes alan sıcak ışık
  equalizer: 9, // müzik: altta ritimle atan çubuklar
  candle: 10, // tarih: titreyen mum ışığı
  viewfinder: 11, // belgesel: kamera vizörü köşeleri + REC noktası
  farFlashes: 12, // savaş: ufukta uzak çakmalar
  heatHaze: 13, // western: yükselen sıcak hava dalgaları
  spotlight: 14, // realite: yavaşça gezen spot ışığı
  paparazzi: 15, // realite: küçük flaş patlamaları
  orbits: 16, // güneş sistemi: gezegen yörünge elipsleri (sabit çizgiler)
  // evren sahneleri (utils/weatherUniverses.js)
  iceWall: 17, // Game of Thrones: buz duvarı + Kara Kale kuleleri
  dunes: 18, // Dune: kum tepeleri + iki ay
  gotham: 19, // Batman: gotik şehir silüeti + çatı heykeli
  skyline: 20, // Spider-Man: gökdelenler + su kuleleri
  mordor: 21, // Yüzüklerin Efendisi: kule + alevli göz + süpüren bakış + yanardağ
  mesa: 22, // Breaking Bad: çöl masaları
  prison: 23, // Prison Break: tel örgü + dikenli tel + kule projektörü
  london: 24, // Sherlock: çatılar, bacalar, saat kulesi
  pool: 25, // Sopranos: havuz + banliyö ağaçları
  titanWall: 26, // Attack on Titan: dev duvar (ÖNDE: titan arkasından yükselir)
  transmute: 27, // Fullmetal Alchemist: kendini çizen dönüşüm çemberi + mavi şimşekler
  blueprint: 28, // Prison Break: kendini çizen kaçış planı
  tether: 29, // ip / halat / zincir: bir rotadaki gövdeyi pencerelerdeki çapaya bağlar
  skyBeam: 30, // Batman: şehirden göğe uzanan, bulutları tarayan projektör
  river: 31, // Vikings: nehir, kıyı ormanı, kuşatılan kale (yanar)
  swPlanet: 32, // Star Wars: Ölüm Yıldızı, gezegen, süperlazer ışını ve patlama (vektör)
  hogwarts: 33, // Harry Potter: Hogwarts şatosu + göl + ay (arka planda)
  opShip: 34, // One Piece: aslan başlı yelkenli (vektör, 44 sn)
  rmPortal: 35, // Rick and Morty: yeşil portal (30 sn)
});
/** İçeriğe yakın (Atlas'ın ÖNÜNDE) çizilen katmanlar; gerisi arkada. */
export const OVERLAY_FRONT = Object.freeze([
  OVERLAY.heartbeat, OVERLAY.fog, OVERLAY.equalizer, OVERLAY.viewfinder, OVERLAY.paparazzi, OVERLAY.titanWall,
]);

// sizeMode: 0 = dp, 1 = ekran yüksekliğinin katı, 2 = uzun kenarın katı,
// 3 = ekran genişliğinin katı.
export const SIZE_MODE = Object.freeze({ dp: 0, height: 1, max: 2, width: 3 });

/** Havai fişek: bir roket (baş + kuyruk) ve patlayınca saçılan kıvılcımlar. */
export const FIREWORK_SPARKS = 16;
export const FIREWORK_TRAIL = 6;
/** Bir fişek grubunun parça sayısı (roket + kıvılcım). */
export const BURST_SIZE = FIREWORK_SPARKS + FIREWORK_TRAIL;
/** Döngünün (görünür kısmın) roketin yükseldiği ilk payı. */
export const FIREWORK_LAUNCH = 0.3;

/** Şimşek başına önceden üretilen biçim sayısı (her çakmada biri, aynalı da). */
export const BOLT_VARIANTS = 4;

// ── Efekt kataloğu ──────────────────────────────────────────────────────────

// counts: yoğunluk basamağı başına parçacık sayısı (GPU maliyeti kabaca
// kaplanan alan). palette: ana tür; palette2: karışık efektte ikinci tür.
const p2 = (dark, light) => ({ dark, light });
// Işık katmanlarının asıl renkleri overlayStyle()'da; bu yalnız yer tutucu.
const OVERLAY_PALETTE = p2(["#ffffff"], ["#000000"]);
const EFFECT_SPECS = Object.freeze({
  // ── mevsim
  snow: { counts: { low: 40, medium: 70, high: 120 }, palette: p2(["#ffffff", "#f2f7ff"], ["#9fb4c8", "#8aa3bb"]) },
  leaves: {
    counts: { low: 11, medium: 18, high: 30 },
    palette: p2(
      ["#e0692f", "#eda640", "#c24a2c", "#d6862f", "#a8673a", "#e7b84e"],
      ["#cf5a22", "#df962f", "#ad3d22", "#c47425", "#8e5a2b", "#d4a23a"],
    ),
  },
  // Açık zeminde açık mavi-gri kayboluyordu → koyu çelik mavisi.
  rain: { counts: { low: 55, medium: 90, high: 150 }, palette: p2(["#d6e8ff", "#c2dbfa"], ["#3d5f80", "#2f5273", "#4a6d8f"]) },
  sakura: {
    counts: { low: 16, medium: 28, high: 45 },
    palette: p2(["#ffc4d6", "#ffb3c8", "#ffd9e4", "#f9a8c0"], ["#f497b4", "#ee86a6", "#f7a9c1", "#e9799c"]),
  },
  // Açık zeminde sarı-zeytin tonlar kirli görünüyordu → doygun kehribar.
  fireflies: { counts: { low: 13, medium: 22, high: 36 }, palette: p2(["#fff3a3", "#ecff8f", "#ffe27a"], ["#f59e0b", "#f08c00", "#ffb020"]) },
  // ── sinema
  popcorn: { counts: { low: 14, medium: 24, high: 38 }, palette: p2(["#fff6df", "#ffefc2", "#ffe7a8"], ["#e7b44c", "#d9a23c", "#efc366"]) },
  tickets: {
    counts: { low: 14, medium: 24, high: 38 },
    palette: p2(["#ffcf5c", "#ff6b6b", "#ffd9a0"], ["#e0a326", "#d64545", "#d9902f"]),
    palette2: p2(["#fff4b8", "#ffe066"], ["#d4a017", "#c9a227"]),
  },
  // ── süzülen
  embers: { counts: { low: 30, medium: 50, high: 80 }, palette: p2(["#ff8a3d", "#ffb347", "#ff5e3a"], ["#e8590c", "#d9480f", "#f76707"]) },
  stardust: { counts: { low: 26, medium: 44, high: 70 }, palette: p2(["#ffffff", "#e8e6ff", "#fff7d6"], ["#6b5bd6", "#5a6fd6", "#8a6bd6"]) },
  // ── doğa
  butterflies: {
    counts: { low: 5, medium: 8, high: 12 },
    palette: p2(
      ["#ffb061", "#74b4ff", "#ff86b0", "#ffd86b", "#8c6bff", "#3ee0b4"],
      ["#f08c2a", "#3d8ef0", "#ef5f93", "#e9b632", "#6a45e0", "#14b88c"],
    ),
  },
  dandelion: { counts: { low: 10, medium: 16, high: 26 }, palette: p2(["#ffffff", "#f3f3f3"], ["#7d838d", "#8d939c"]) },
  // ── özel gün
  fireworks: {
    counts: { low: 44, medium: 88, high: 132 }, // BURST_SIZE katları (2 / 4 / 6 fişek)
    palette: p2(
      ["#ffd166", "#ef476f", "#06d6a0", "#4cc9f0", "#f72585", "#ffffff"],
      ["#e09f00", "#d62650", "#06a77d", "#1d8fd0", "#c41a6f", "#7b2cbf"],
    ),
  },
  hearts: { counts: { low: 12, medium: 20, high: 32 }, palette: p2(["#ff7aa2", "#ff4d79", "#ffa3bf"], ["#e8436e", "#d42a57", "#f0668c"]) },
  halloweenBats: {
    counts: { low: 10, medium: 16, high: 26 },
    // yarasa: koyu zeminde mor-gri silüet, açık zeminde koyu
    palette: p2(["#8a7aa8", "#9c8cba"], ["#2b2236", "#3a2f48"]),
    palette2: p2(["#ff8c2b", "#f57a1f"], ["#ef7d1a", "#e06c0f"]),
  },
  // ── bileşikler (sayı = toplam; dağılım COMPOSITES'te)
  solarSystem: { counts: { low: 55, medium: 75, high: 110 } }, // + 15 sabit (11 cisim, kara delik, pulsar, kuyruklu yıldız, yörünge çizgileri)
  halloween: { counts: { low: 26, medium: 36, high: 54 } }, // + 3 mezar + 3 örümcek (sabit)
  christmas: { counts: { low: 45, medium: 75, high: 120 } }, // + 4 sahne + 1 kızak (sabit)
  cinema: { counts: { low: 24, medium: 40, high: 62 } },
  storm: { counts: { low: 57, medium: 92, high: 152 } },
  springGarden: { counts: { low: 34, medium: 52, high: 80 } },
  summerShore: { counts: { low: 18, medium: 32, high: 52 } }, // + 3 dalga + 1 kum (vektör)
  aurora: { counts: { low: 24, medium: 36, high: 54 } },
  // ── güneş sistemi parçaları (renkli şekiller; palet yalnız asteroit/kuyruklu yıldız)
  solarBodies: { counts: { low: 11, medium: 11, high: 11 }, palette: p2(["#ffffff"], ["#ffffff"]) },
  asteroidBelt: { counts: { low: 12, medium: 18, high: 28 }, palette: p2(["#b3a58c", "#9a8d77", "#c4b79e"], ["#6e6252", "#5f5345", "#7d7160"]) },
  blackHole: { counts: { low: 1, medium: 1, high: 1 }, palette: p2(["#ffffff"], ["#ffffff"]) },
  pulsar: { counts: { low: 1, medium: 1, high: 1 }, palette: p2(["#ffffff"], ["#ffffff"]) },
  comets: { counts: { low: 1, medium: 1, high: 1 }, palette: p2(["#bfe9ff", "#e0f4ff"], ["#2b7fd0", "#4a6fd0"]) },
  orbits: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  // ── özel gün parçaları
  ghosts: { counts: { low: 4, medium: 6, high: 10 }, palette: p2(["#e8efff", "#d6e0ff", "#f4f1ff"], ["#6b7a99", "#7b6b99", "#5f7d99"]) },
  tombstones: { counts: { low: 3, medium: 3, high: 3 }, palette: p2(["#7d8497", "#6b7388", "#8b8fa3"], ["#4a5062", "#3d4455", "#575d70"]) },
  spiders: { counts: { low: 6, medium: 6, high: 6 }, palette: p2(["#a99bc4", "#9c8cba"], ["#2b2236", "#3a2f48"]) },
  xmasGoodies: {
    counts: { low: 10, medium: 16, high: 26 },
    palette: p2(["#ff6b6b", "#4cd37b", "#ffd166", "#ffffff", "#7cc4ff"], ["#d62f2f", "#1f9d55", "#d99a00", "#8c98a8", "#2b7fd0"]),
  },
  xmasScene: {
    counts: { low: 4, medium: 4, high: 4 },
    palette: p2(["#f4f8ff", "#ffffff"], ["#9fb4c8", "#8aa3bb"]),
    palette2: p2(["#4fbf7a", "#3aa865"], ["#2f8f55", "#2a7d4a"]),
  },
  sleigh: { counts: { low: 1, medium: 1, high: 1 }, palette: p2(["#ffe2a8", "#ffd68a"], ["#b23a28", "#9c3020"]) },
  // ── iç efektler
  lightning: { counts: { low: 2, medium: 2, high: 2 }, palette: p2(["#f4f8ff"], ["#3d5f80"]) },
  grass: {
    counts: { low: 24, medium: 36, high: 56 },
    palette: p2(["#5fbf6a", "#4caf50", "#7ccf6e", "#3f9e4a"], ["#3f9e4a", "#2e8b3e", "#5aae52", "#357a38"]),
  },
  flowers: {
    counts: { low: 8, medium: 12, high: 16 }, // çift sayı: sap + baş
    palette: p2(["#ff8fb3", "#ffd166", "#c9a7ff", "#ffffff", "#ff9e6b"], ["#e8608d", "#e0a800", "#9a6be6", "#f08c5a", "#d6457a"]),
    palette2: p2(["#5fbf6a", "#4caf50"], ["#3f9e4a", "#2e8b3e"]),
  },
  // Dalga/kum vektör çizilir; asıl renkler shoreStyle()'da (katman başına degrade).
  waves: { counts: { low: 3, medium: 3, high: 3 }, palette: p2(["#3c86b8", "#3a9ccc", "#45bfd6"], ["#5aa7d8", "#3f93c9", "#2fb0c9"]) },
  sand: { counts: { low: 1, medium: 1, high: 1 }, palette: p2(["#e6c88e"], ["#ecd09a"]) },
  glints: { counts: { low: 14, medium: 22, high: 34 }, palette: p2(["#ffffff", "#fff6cf"], ["#ffffff", "#fff3c2"]) },
  seagulls: { counts: { low: 3, medium: 5, high: 7 }, palette: p2(["#e8edf2", "#dfe6ee"], ["#4a5562", "#56616e"]) },
  auroraBands: {
    counts: { low: 3, medium: 4, high: 5 },
    palette: p2(["#5cffb0", "#3ee6c4", "#7fdcff", "#b48cff"], ["#1fb87a", "#14a596", "#3a9fd6", "#8a63e0"]),
  },
  skyStars: { counts: { low: 20, medium: 32, high: 50 }, palette: p2(["#ffffff", "#e8f2ff"], ["#5a6fd6", "#6b5bd6"]) },
  balloons: {
    counts: { low: 8, medium: 12, high: 20 },
    palette: p2(["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#1dd1a1", "#a78bfa"], ["#e04848", "#e0a82e", "#1fa9d6", "#d968cf", "#10a37f", "#7c5ce0"]),
  },
  notes: { counts: { low: 10, medium: 16, high: 26 }, palette: p2(["#e0d4ff", "#ffd6f0", "#c8f0ff"], ["#6a4fd6", "#c2468f", "#2b8fc0"]) },
  motes: { counts: { low: 20, medium: 34, high: 54 }, palette: p2(["#ffe7b3", "#f5d9a0"], ["#a8853f", "#8f6f30"]) },
  wisps: { counts: { low: 8, medium: 12, high: 18 }, palette: p2(["#b9a3ff", "#8fe3ff", "#d6b3ff"], ["#6a4fd6", "#2b8fc0", "#8a4fd6"]) },
  bats: { counts: { low: 8, medium: 12, high: 20 }, palette: p2(["#8a7aa8", "#9c8cba"], ["#2b2236", "#3a2f48"]) },
  ash: { counts: { low: 30, medium: 50, high: 80 }, palette: p2(["#b8b8b8", "#9a9a9a", "#d0d0d0"], ["#6b6b6b", "#555555", "#7d7d7d"]) },
  sandDrift: { counts: { low: 24, medium: 40, high: 64 }, palette: p2(["#e2c38a", "#d6b072"], ["#b08a4a", "#a07a3c"]) },
  // ── tür parçaları
  coals: { counts: { low: 6, medium: 10, high: 16 }, palette: p2(["#ff6a2b", "#ffa04d", "#ff8a3d"], ["#d9480f", "#e8590c", "#c2410c"]) },
  magicMotes: { counts: { low: 8, medium: 12, high: 18 }, palette: p2(["#b8a6ff", "#8fe3ff", "#ffd6f5"], ["#6a4fd6", "#2b8fc0", "#c2468f"]) },
  rosePetals: { counts: { low: 10, medium: 16, high: 26 }, palette: p2(["#ff4d6d", "#e01e4f", "#ff8fa3"], ["#d6183f", "#b5123a", "#e8506c"]) },
  windowDrops: { counts: { low: 8, medium: 12, high: 18 }, palette: p2(["#d6e8ff", "#e8f2ff"], ["#5b7c9c", "#6b8aa8"]) },
  confetti: { counts: { low: 14, medium: 22, high: 34 }, palette: p2(["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#1dd1a1", "#a78bfa"], ["#e04848", "#e0a82e", "#1fa9d6", "#d968cf", "#10a37f", "#7c5ce0"]) },
  paperStars: { counts: { low: 10, medium: 16, high: 24 }, palette: p2(["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#1dd1a1", "#a78bfa"], ["#e04848", "#e0a82e", "#1fa9d6", "#d968cf", "#10a37f", "#7c5ce0"]) },
  clouds: { counts: { low: 3, medium: 4, high: 6 }, palette: p2(["#ffffff", "#eef2ff"], ["#9fb0c8", "#b3c2d6"]) },
  kites: { counts: { low: 2, medium: 3, high: 5 }, palette: p2(["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#1dd1a1", "#a78bfa"], ["#e04848", "#e0a82e", "#1fa9d6", "#d968cf", "#10a37f", "#7c5ce0"]) },
  planes: { counts: { low: 2, medium: 3, high: 5 }, palette: p2(["#ffffff", "#f1f5f9"], ["#64748b", "#7c8aa0"]) },
  parchment: { counts: { low: 8, medium: 12, high: 20 }, palette: p2(["#e8d3a8", "#d9bf8c"], ["#a8854a", "#9a7740"]) },
  smoke: { counts: { low: 6, medium: 10, high: 16 }, palette: p2(["#8a8a8a", "#a0a0a0"], ["#5a5a5a", "#6b6b6b"]) },
  tumbleweed: { counts: { low: 1, medium: 2, high: 3 }, palette: p2(["#c9a46a", "#b08a52"], ["#8a6a3a", "#7a5c30"]) },
  // ── tür ışık katmanları (renk overlayStyle'da; sayı sabit)
  flare: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  planet: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  heartbeat: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  fog: { counts: { low: 2, medium: 2, high: 2 }, palette: OVERLAY_PALETTE },
  lampFlicker: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  flashlight: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  blinds: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  neon: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  warmGlow: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  equalizer: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  candle: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  viewfinder: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  farFlashes: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  heatHaze: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  spotlight: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  paparazzi: { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE },
  // ── evren ışık katmanları ve sahneleri (utils/weatherUniverses.js)
  ...Object.fromEntries(
    ["iceWall", "dunes", "gotham", "skyline", "mordor", "mesa", "prison", "london", "pool", "titanWall", "transmute", "blueprint", "skyBeam", "river", "swPlanet", "hogwarts", "opShip", "rmPortal"]
      .map((e) => [e, { counts: { low: 1, medium: 1, high: 1 }, palette: OVERLAY_PALETTE }]),
  ),
  ...UNIVERSE_SPECS,
  // ── tür aileleri (bileşik: sayı = toplam, dağılım COMPOSITES'te)
  genreAction: { counts: { low: 40, medium: 64, high: 100 } },
  genreScifi: { counts: { low: 34, medium: 56, high: 88 } },
  genreThriller: { counts: { low: 58, medium: 93, high: 153 } },
  genreHorror: { counts: { low: 11, medium: 15, high: 23 } },
  genreMystery: { counts: { low: 9, medium: 13, high: 19 } },
  genreCrime: { counts: { low: 57, medium: 92, high: 152 } },
  genreRomance: { counts: { low: 21, medium: 33, high: 51 } },
  genreDrama: { counts: { low: 16, medium: 26, high: 42 } },
  genreComedy: { counts: { low: 24, medium: 40, high: 62 } },
  genreAnimation: { counts: { low: 16, medium: 26, high: 40 } },
  genreFamily: { counts: { low: 12, medium: 18, high: 28 } },
  genreMusic: { counts: { low: 11, medium: 17, high: 27 } },
  genreHistory: { counts: { low: 25, medium: 41, high: 63 } },
  genreDocumentary: { counts: { low: 21, medium: 35, high: 55 } },
  genreWar: { counts: { low: 35, medium: 57, high: 89 } },
  genreWestern: { counts: { low: 27, medium: 44, high: 70 } },
  genreReality: { counts: { low: 16, medium: 26, high: 40 } },
});

// Bileşik efektler: [parça, pay] (pay = sabit sayılar düşüldükten sonra kalan
// sayının oranı) ya da [parça, { fixed }] (yoğunluktan bağımsız sabit sayı).
// Parçalar sırayla çizilir (sonraki öndedir).
export const COMPOSITES = Object.freeze({
  storm: Object.freeze([["rain", 1], ["lightning", { fixed: 2 }]]),
  springGarden: Object.freeze([
    ["grass", 0.54], ["flowers", 0.2], ["sakura", 0.08], ["dandelion", 0.12], ["butterflies", 0.06],
  ]),
  summerShore: Object.freeze([
    ["seagulls", 0.18], ["waves", { fixed: 3 }], ["glints", 0.82], ["sand", { fixed: 1 }],
  ]),
  aurora: Object.freeze([["skyStars", 1], ["auroraBands", { fixed: 4 }]]),
  // Güneş sistemi: yıldızlar + yörünge çizgileri + Güneş ve 8 gezegen (Ay, Uzay İstasyonu,
  // Satürn halkaları) + asteroit kuşağı + kara delik + pulsar + ara sıra kuyruklu yıldız.
  solarSystem: Object.freeze([
    ["skyStars", 0.7], ["orbits", { fixed: 1 }], ["asteroidBelt", 0.3], ["blackHole", { fixed: 1 }],
    ["pulsar", { fixed: 1 }], ["solarBodies", { fixed: 11 }], ["comets", { fixed: 1 }],
  ]),
  // Özel günler: Cadılar Bayramı (yarasa + balkabağı + hayalet + mezar + örümcek),
  // Noel (kar + hediye/şeker/top + kardan adam/ağaç + ara sıra Noel Baba kızağı),
  // Sinema Günü (mısır + bilet).
  halloween: Object.freeze([
    ["tombstones", { fixed: 3 }], ["halloweenBats", 0.6], ["ghosts", 0.4], ["spiders", { fixed: 6 }],
  ]),
  christmas: Object.freeze([
    ["snow", 0.55], ["xmasGoodies", 0.45], ["sleigh", { fixed: 1 }], ["xmasScene", { fixed: 4 }],
  ]),
  cinema: Object.freeze([["popcorn", 0.5], ["tickets", 0.5]]),
  // Tür aileleri (GENRE_FAMILIES): parçacık + ışık katmanı.
  genreAction: Object.freeze([["embers", 0.75], ["coals", 0.25], ["flare", { fixed: 1 }]]),
  genreScifi: Object.freeze([["stardust", 0.75], ["magicMotes", 0.25], ["planet", { fixed: 1 }]]),
  genreThriller: Object.freeze([["rain", 1], ["lightning", { fixed: 2 }], ["heartbeat", { fixed: 1 }]]),
  genreHorror: Object.freeze([["bats", 1], ["lampFlicker", { fixed: 1 }], ["fog", { fixed: 2 }]]),
  genreMystery: Object.freeze([["wisps", 1], ["flashlight", { fixed: 1 }]]),
  genreCrime: Object.freeze([["blinds", { fixed: 1 }], ["neon", { fixed: 1 }], ["rain", 1]]),
  genreRomance: Object.freeze([["warmGlow", { fixed: 1 }], ["hearts", 0.6], ["rosePetals", 0.4]]),
  genreDrama: Object.freeze([["leaves", 0.7], ["windowDrops", 0.3]]),
  genreComedy: Object.freeze([["popcorn", 0.55], ["confetti", 0.45]]),
  genreAnimation: Object.freeze([["clouds", 0.2], ["paperStars", 0.5], ["butterflies", 0.3]]),
  genreFamily: Object.freeze([["kites", 0.2], ["balloons", 0.6], ["planes", 0.2]]),
  genreMusic: Object.freeze([["notes", 1], ["equalizer", { fixed: 1 }]]),
  genreHistory: Object.freeze([["candle", { fixed: 1 }], ["motes", 0.65], ["parchment", 0.35]]),
  genreDocumentary: Object.freeze([["motes", 1], ["viewfinder", { fixed: 1 }]]),
  genreWar: Object.freeze([["farFlashes", { fixed: 1 }], ["smoke", 0.2], ["ash", 0.8]]),
  genreWestern: Object.freeze([["heatHaze", { fixed: 1 }], ["sandDrift", 0.85], ["tumbleweed", 0.15]]),
  genreReality: Object.freeze([["spotlight", { fixed: 1 }], ["tickets", 1], ["paparazzi", { fixed: 1 }]]),
  // Evrenler (utils/weatherUniverses.js)
  ...UNIVERSE_COMPOSITES,
});

export const getWeatherSpec = (effect) => EFFECT_SPECS[ALL_EFFECTS.includes(effect) ? effect : "snow"];

export const normalizeWeatherEffect = (value) => (ALL_EFFECTS.includes(value) ? value : "snow");

// Eski kayıt: karahindiba artık ayrı seçenek değil, bahar bahçesinin parçası.
export const normalizeWeatherChoice = (value) =>
  value === "dandelion" ? "springGarden" : WEATHER_CHOICES.includes(value) ? value : "snow";

export const normalizeWeatherDensity = (value) => (WEATHER_DENSITIES.includes(value) ? value : "auto");

/** Efektin seçici grubu ("auto" → seasons). */
export const weatherGroupOf = (choice) =>
  (WEATHER_GROUPS.find((g) => g.effects.includes(choice)) || WEATHER_GROUPS[0]).id;

// ── Takvim ──────────────────────────────────────────────────────────────────

/**
 * Mevsime göre efekt (kuzey yarımküre): Ara–Şub kar, Mar–May bahar bahçesi,
 * Haz–Ağu yaz kıyısı, Eyl–Kas yaprak.
 */
export function seasonalWeatherEffect(date = new Date()) {
  const m = date instanceof Date && !Number.isNaN(date.getTime()) ? date.getMonth() : 0;
  if (m === 11 || m <= 1) return "snow";
  if (m <= 4) return "springGarden";
  if (m <= 7) return "summerShore";
  return "leaves";
}

/**
 * Sabit tarihli, dünyada bilinen özel günler (yıl içinde günü HİÇ değişmeyenler
 * — kullanıcı kararı; Ramazan/Kurban/Anneler Günü gibi kayanlar YOK).
 * `dates`: [ay (0–11), gün]. `effect`: o gün çizilen atmosfer.
 * "Özel günler" ayarı açıkken bu günlerde seçili atmosfer yerine bu çizilir.
 */
export const SPECIAL_DAYS = Object.freeze([
  Object.freeze({ id: "newYear", dates: Object.freeze([[11, 31], [0, 1]]), effect: "fireworks" }),
  Object.freeze({ id: "valentines", dates: Object.freeze([[1, 14]]), effect: "hearts" }),
  Object.freeze({ id: "womensDay", dates: Object.freeze([[2, 8]]), effect: "rosePetals" }),
  Object.freeze({ id: "earthDay", dates: Object.freeze([[3, 22]]), effect: "springGarden" }),
  Object.freeze({ id: "halloween", dates: Object.freeze([[9, 31]]), effect: "halloween" }),
  Object.freeze({ id: "childrensDay", dates: Object.freeze([[10, 20]]), effect: "genreFamily" }),
  Object.freeze({ id: "christmas", dates: Object.freeze([[11, 24], [11, 25]]), effect: "christmas" }),
  Object.freeze({ id: "cinemaDay", dates: Object.freeze([[11, 28]]), effect: "cinema" }),
]);

/** O günün özel günü ({id, dates, effect}); yoksa null. Cihazın yerel tarihi. */
export function specialDayOf(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const m = date.getMonth();
  const d = date.getDate();
  return SPECIAL_DAYS.find((s) => s.dates.some(([sm, sd]) => sm === m && sd === d)) || null;
}

/** O günün özel gün efekti; özel gün yoksa null. */
export const specialDayEffect = (date = new Date()) => specialDayOf(date)?.effect ?? null;

/** "Mevsime göre" o gün ne çizer: önce özel gün (açıksa), yoksa mevsim. */
export const autoWeatherEffect = (date = new Date(), specialDays = true) =>
  (specialDays ? specialDayEffect(date) : null) || seasonalWeatherEffect(date);

/**
 * Ayardaki seçimi (auto dahil) çizilecek efekte çevirir. "Özel günler" açıkken
 * özel günde seçim ne olursa olsun günün efekti çizilir.
 */
export function resolveWeatherEffect(choice, date = new Date(), specialDays = true) {
  const c = normalizeWeatherChoice(choice);
  const special = specialDays ? specialDayEffect(date) : null;
  if (special) return special;
  return c === "auto" ? seasonalWeatherEffect(date) : c;
}

// ── Türe göre ───────────────────────────────────────────────────────────────

// TÜR AİLELERİ: film ve dizi türleri farklı adlarla gelir (filmde "Bilim
// Kurgu" + "Fantastik", dizide tek "Bilim Kurgu & Fantazi"). Benzer türler
// AYNI aileye düşer, aile tek atmosfer kullanır → film ile dizi aynı görünür.
// Aile atmosferi bir BİLEŞİK (COMPOSITES genre*): türün parçacığı + yeni
// parçalar + ışık katmanı (ör. korku = yarasa + sis + titreyen lamba).
// Sıra = açıklama sayfasındaki sıra. `movie` / `tv`: o ailenin TMDB id'leri
// (yalnız dizide olan bileşik türler `tv`de).
export const GENRE_FAMILIES = Object.freeze([
  Object.freeze({ id: "actionAdventure", genres: ["action", "adventure"], movie: [28, 12], tv: [10759], effect: "genreAction" }),
  Object.freeze({ id: "scifiFantasy", genres: ["scifi", "fantasy"], movie: [878, 14], tv: [10765], effect: "genreScifi" }),
  Object.freeze({ id: "thriller", genres: ["thriller"], movie: [53], tv: [], effect: "genreThriller" }),
  Object.freeze({ id: "horror", genres: ["horror"], movie: [27], tv: [], effect: "genreHorror" }),
  Object.freeze({ id: "mystery", genres: ["mystery"], movie: [9648], tv: [9648], effect: "genreMystery" }),
  Object.freeze({ id: "crime", genres: ["crime"], movie: [80], tv: [80], effect: "genreCrime" }),
  Object.freeze({ id: "romance", genres: ["romance"], movie: [10749], tv: [], effect: "genreRomance" }),
  Object.freeze({ id: "drama", genres: ["drama"], movie: [18], tv: [18, 10766], effect: "genreDrama" }),
  Object.freeze({ id: "comedy", genres: ["comedy", "tvmovie"], movie: [35, 10770], tv: [35], effect: "genreComedy" }),
  Object.freeze({ id: "animation", genres: ["animation"], movie: [16], tv: [16], effect: "genreAnimation" }),
  Object.freeze({ id: "family", genres: ["family"], movie: [10751], tv: [10751, 10762], effect: "genreFamily" }),
  Object.freeze({ id: "music", genres: ["music"], movie: [10402], tv: [], effect: "genreMusic" }),
  Object.freeze({ id: "history", genres: ["history"], movie: [36], tv: [], effect: "genreHistory" }),
  Object.freeze({ id: "documentary", genres: ["documentary"], movie: [99], tv: [99, 10763], effect: "genreDocumentary" }),
  Object.freeze({ id: "war", genres: ["war"], movie: [10752], tv: [10768], effect: "genreWar" }),
  Object.freeze({ id: "western", genres: ["western"], movie: [37], tv: [37], effect: "genreWestern" }),
  Object.freeze({ id: "reality", genres: ["reality"], movie: [], tv: [10764, 10767], effect: "genreReality" }),
]);

// Kanonik tür (utils/genreCanon.js GENRE_IDS) → ailesinin efekti.
export const GENRE_EFFECT = Object.freeze(
  Object.fromEntries(GENRE_FAMILIES.flatMap((f) => f.genres.map((g) => [g, f.effect]))),
);

/** Kanonik türün ailesi (yoksa null). */
export const genreFamilyOf = (genre) => GENRE_FAMILIES.find((f) => f.genres.includes(genre)) || null;

// TMDB tür id'si → kanonik tür(ler). Bileşik dizi türleri iki türe açılır
// (Aksiyon & Macera → aksiyon + macera); ikisi de aynı ailede olduğu için tek
// efekt çıkar.
const TMDB_GENRE = Object.freeze({
  28: ["action"], 12: ["adventure"], 16: ["animation"], 35: ["comedy"], 80: ["crime"],
  99: ["documentary"], 18: ["drama"], 10751: ["family"], 14: ["fantasy"], 36: ["history"],
  27: ["horror"], 10402: ["music"], 9648: ["mystery"], 10749: ["romance"], 878: ["scifi"],
  10770: ["tvmovie"], 53: ["thriller"], 10752: ["war"], 37: ["western"],
  10759: ["action", "adventure"], 10762: ["family"], 10763: ["documentary"], 10764: ["reality"],
  10765: ["scifi", "fantasy"], 10766: ["drama"], 10767: ["reality"], 10768: ["war"],
});

/** TMDB'nin tanımlı tür id'leri (19 film + 16 dizi; 8'i ortak → 27). */
export const TMDB_GENRE_IDS = Object.freeze(Object.keys(TMDB_GENRE).map(Number));

// Tür ADI gelen ekranlar (sezon/bölüm, route params) için bileşik adlar.
// kanonikTur bileşiği tek türe indirir; burada ikisine açılır.
const COMPOUND_NAMES = Object.freeze({
  "action adventure": ["action", "adventure"],
  "aksiyon macera": ["action", "adventure"],
  "accion y aventura": ["action", "adventure"],
  "acao e aventura": ["action", "adventure"],
  "action abenteuer": ["action", "adventure"],
  "sci fi fantasy": ["scifi", "fantasy"],
  "science fiction fantasy": ["scifi", "fantasy"],
  "bilim kurgu fantazi": ["scifi", "fantasy"],
  "bilim kurgu fantezi": ["scifi", "fantasy"],
  "bilim kurgu fantastik": ["scifi", "fantasy"],
  "ciencia ficcion y fantasia": ["scifi", "fantasy"],
  "ficcao cientifica e fantasia": ["scifi", "fantasy"],
});

function genreKeysOf(g) {
  if (g == null) return [];
  if (typeof g === "number" || (typeof g === "string" && /^\d+$/.test(g))) return TMDB_GENRE[Number(g)] || [];
  if (typeof g === "object") {
    if (g.id != null && TMDB_GENRE[Number(g.id)]) return TMDB_GENRE[Number(g.id)];
    return genreKeysOf(g.name);
  }
  const folded = foldGenreName(g);
  if (COMPOUND_NAMES[folded]) return COMPOUND_NAMES[folded];
  const k = kanonikTur(g);
  return k && k !== "other" ? [k] : [];
}

/** Tür karışımındaki en fazla farklı efekt sayısı. */
export const GENRE_MIX_MAX = 3;

/**
 * Yapımın türlerinden (TMDB id, {id,name} ya da yerel ad) efekt listesi:
 * TMDB sırasıyla, tekrarsız, en fazla GENRE_MIX_MAX. Tanınmayan tür atlanır.
 */
export function genreEffectsFor(genres) {
  if (!Array.isArray(genres)) return [];
  const out = [];
  for (const g of genres) {
    for (const key of genreKeysOf(g)) {
      const e = GENRE_EFFECT[key];
      if (e && !out.includes(e)) out.push(e);
      if (out.length >= GENRE_MIX_MAX) return out;
    }
  }
  return out;
}

// ── Sayılar ─────────────────────────────────────────────────────────────────

// "auto" yoğunluk efekt modunu izler: Tam = orta, Orta = ortanın %75'i,
// Kapalı = az. Her basamak görünür biçimde ayrışır (bkz. utils/deviceTier.js).
const AUTO_MODE_FACTOR = Object.freeze({ full: 1, balanced: 0.75 });

/** Tam ekran parçacık sayısı. */
export function resolveParticleCount(effect, density, effectMode) {
  const { counts } = getWeatherSpec(effect);
  const d = normalizeWeatherDensity(density);
  if (d !== "auto") return counts[d];
  if (effectMode === "off") return counts.low;
  const f = AUTO_MODE_FACTOR[effectMode] ?? AUTO_MODE_FACTOR.balanced;
  return Math.max(counts.low, Math.round(counts.medium * f));
}

// Karışımda efekt başına pay: 2 efektte %60, 3'te %45 (toplam tek efektten
// biraz fazla — her biri yine seçilebilir kalsın).
const MIX_FACTOR = Object.freeze([1, 0.6, 0.45]);

/**
 * Çizim planı: [[efekt, sayı], ...]. Tek efekt ya da tür karışımı.
 * @param {string[]} effects
 */
export function resolvePlan(effects, density, effectMode) {
  const list = (Array.isArray(effects) ? effects : [effects]).filter((e) => ALL_EFFECTS.includes(e));
  if (!list.length) return [];
  const f = MIX_FACTOR[Math.min(list.length, MIX_FACTOR.length) - 1];
  return list.map((e) => [e, Math.max(1, Math.round(resolveParticleCount(e, density, effectMode) * f))]);
}

/**
 * Küçük alan (ayar satırı önizlemesi) için sayı: alanla orantılı, ama şerit
 * boş görünmesin diye en az 6, en çok tam ekran sayısı.
 */
export function previewParticleCount(fullCount, area, screenArea) {
  const n = Number(fullCount) || 0;
  const ratio = screenArea > 0 ? Math.max(0, area) / screenArea : 0;
  return Math.min(n, Math.max(6, Math.round(n * ratio * 2.5)));
}

/**
 * Atmosferin kare aralığı (ms). "Tam" ve "Orta" 60 fps (30 fps ve boşta 20 fps
 * denendi, takılıyor gibi görünüyordu — 11 Kas); 30 fps yalnız kullanıcının
 * seçtiği "Kapalı" modda. 120 Hz ekranda da aynı sınır.
 */
export const frameIntervalMs = (effectMode) => (effectMode === "off" ? 1000 / 30 : 1000 / 60);

// ── Renk ────────────────────────────────────────────────────────────────────

function hexToUnitRgb(hex) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  if (!Number.isFinite(n)) return [1, 1, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ── Parçacık üretimi ────────────────────────────────────────────────────────

const lerp = (a, b, k) => a + (b - a) * k;
const TAU = Math.PI * 2;

// Yağmurun eğimi (rad): rüzgâr soldan, damlalar sağa-aşağı.
export const RAIN_SLANT = 0.17;

const pickFrom = (rand, list) => list[Math.floor(rand() * list.length) % list.length];

function setSprite(p, sprite) {
  const [x, y, w, h] = spriteRect(sprite);
  p.sprite = sprite;
  p.rx = (x / 100) * SPRITE_CELL;
  p.ry = (y / 100) * SPRITE_CELL;
  p.cw = (w / 100) * SPRITE_CELL;
  p.ch = (h / 100) * SPRITE_CELL;
  return p;
}

function blank(rand) {
  const p = {
    kind: KIND.fall,
    dir: 1,
    sprite: 0,
    rx: 0,
    ry: 0,
    cw: SPRITE_CELL,
    ch: SPRITE_CELL,
    flapFreq: 0,
    size: 6,
    sizeMode: SIZE_MODE.dp,
    x0: rand(),
    y0: rand(),
    speed: 40,
    windX: 0,
    swayAmp: 0,
    swayFreq: 0,
    swayPhase: rand() * TAU,
    rot0: rand() * TAU,
    rotSpeed: 0,
    wobbleAmp: 0,
    wobbleFreq: 0,
    wobblePhase: rand() * TAU,
    r: 1,
    g: 1,
    b: 1,
    a: 1,
    pulseFreq: 0,
    pulsePhase: rand() * TAU,
    pulseMin: 0.12,
    fadeOut: 0,
    driftAmpY: 0,
    driftFreqY: 0,
    period: 1,
    duty: 1,
    salt: Math.floor(rand() * 100000),
    group: 0,
    part: 0, // grow: 0 sap, 1 baş · tile: 0–2 dalga katmanı, 3 kum
    stemLen: 0,
    orbitR: 0, // orbit: yörünge yarıçapı (dp, × ölçek)
    orbitW: 0, // orbit: açısal hız (rad/sn)
    parentR: 0, // orbit: ebeveynin yörünge yarıçapı (0 = Güneş etrafında)
    parentW: 0,
    parentPh: 0,
    launch: 0, // burst: roket yükselişinin döngü payı
    lag: 0, // burst: kuyruk parçasının geriliği (0 = roketin başı)
    seaBand: 0, // 1: y0 deniz bandı içinde oran (ışıltı)
    ocx: 0.5, // orbit: merkez (ekran oranı)
    ocy: ORBIT_CENTER_Y,
    oratio: 0.5, // orbit: dikey/yatay yarıçap oranı
    orbitPulse: 0, // orbit: yarıçap nefesi (oran; frekans driftFreqY)
    // track / emit (evren sahneleri; utils/weatherUniverses.js)
    kf: null, // anahtar kareler, KF_STRIDE'lık düz dizi
    tlag: 0, // döngü payı kadar geriden izler (takipçi, gövde halkası)
    rest: 1, // dinlenme katı: olay döngünün ilk 1/rest kadarında, kalanı boş (olay seyrekliği)
    jitterX: 0, // döngü başına rastgele kayma (ekran oranı)
    jitterY: 0,
    ox: 0, // ofset (dp × ölçek × kare boyu)
    oy: 0,
    face: 0, // 1: gidiş yönüne döner
    framed: 0, // 1: şekil karesi anahtar kareden (+ kanat çırpma flapFrom'dan itibaren)
    flapFrom: 0,
    bobAmp: 0, // süzülme (dp)
    bobFreq: 0,
    bobPh: 0,
    w0: 0, // emit: saçılma penceresi (döngü payı)
    w1: 1,
    life: 0.1, // emit: bir parçacığın ömrü (döngü payı)
    eoff: 0, // emit: yuvanın faz kayması
    loop: 0, // emit: kesintisiz (pencere yok, döngüyü sarar)
    dirA: 0, // emit: yön (rad, 0 = sağ, π/2 = aşağı)
    dirFace: 0, // emit: yön rotanın gidişine göre
    spread: 0,
    speedV: 0, // emit: hız (dp/sn)
    grav: 0, // emit: yerçekimi (dp/sn²; eksi = yükselir)
    grow: 1, // emit: ömür sonunda boy katı
    align: 0, // emit: şekil hareket yönünde
    fadeK: 1, // emit: sönme eğrisi üssü (büyük = geç söner)
    esalt: 0,
    anc: null, // tether: [u0, u1, ax, ay] dörtlüleri
  };
  return setSprite(p, SPRITE.dot);
}

function paint(p, hex) {
  const [r, g, b] = hexToUnitRgb(hex);
  p.r = r;
  p.g = g;
  p.b = b;
  return p;
}

// Ortak düşme kalıbı (kar/sakura/mısır/kalp/kabarcık gibi).
function falling(p, rand, d, o) {
  p.kind = KIND.fall;
  p.dir = o.dir ?? 1;
  setSprite(p, o.sprite);
  p.size = lerp(o.size[0], o.size[1], d);
  p.speed = lerp(o.speed[0], o.speed[1], d) * lerp(0.85, 1.15, rand());
  p.windX = o.wind ? lerp(o.wind[0], o.wind[1], rand()) : 0;
  p.swayAmp = o.sway ? lerp(o.sway[0], o.sway[1], rand()) : 0;
  p.swayFreq = o.swayFreq ? lerp(o.swayFreq[0], o.swayFreq[1], rand()) : 0;
  p.rotSpeed = o.rot ? lerp(-o.rot, o.rot, rand()) : 0;
  p.wobbleAmp = o.wobble ? lerp(o.wobble[0], o.wobble[1], rand()) : 0;
  p.wobbleFreq = o.wobbleFreq ? lerp(o.wobbleFreq[0], o.wobbleFreq[1], rand()) : p.swayFreq;
  p.a = lerp(o.alpha[0], o.alpha[1], d);
  return p;
}

// Yerinde gezinme kalıbı (ateş böceği, yıldız, toz zerresi).
function floating(p, rand, d, o) {
  p.kind = KIND.float;
  setSprite(p, o.sprite);
  p.size = lerp(o.size[0], o.size[1], d);
  p.swayAmp = lerp(o.sway[0], o.sway[1], rand());
  p.swayFreq = lerp(o.freq[0], o.freq[1], rand());
  p.driftAmpY = lerp(o.drift[0], o.drift[1], rand());
  p.driftFreqY = lerp(o.freq[0], o.freq[1], rand());
  p.rotSpeed = o.rot ? lerp(-o.rot, o.rot, rand()) : 0;
  if (o.pulse) {
    p.pulseFreq = lerp(o.pulse[0], o.pulse[1], rand());
    p.pulseMin = o.pulseMin ?? 0.12;
  }
  if (o.yRange) p.y0 = lerp(o.yRange[0], o.yRange[1], p.y0);
  p.a = lerp(o.alpha[0], o.alpha[1], d);
  return p;
}

// Kanat çırparak yatay akan (kelebek, yarasa, martı).
function flapping(p, rand, d, o) {
  p.kind = KIND.drift;
  setSprite(p, o.sprite);
  p.flapFreq = lerp(o.flap[0], o.flap[1], rand());
  p.size = lerp(o.size[0], o.size[1], d);
  p.windX = (rand() < 0.5 ? -1 : 1) * lerp(o.wind[0], o.wind[1], rand());
  p.swayAmp = lerp(o.sway[0], o.sway[1], rand());
  p.swayFreq = lerp(o.swayFreq[0], o.swayFreq[1], rand());
  p.driftAmpY = lerp(o.drift[0], o.drift[1], rand());
  p.driftFreqY = lerp(0.04, 0.09, rand());
  p.rot0 = o.tilt ? lerp(-o.tilt, o.tilt, rand()) : 0;
  p.wobbleAmp = lerp(o.wobble[0], o.wobble[1], rand());
  p.wobbleFreq = p.swayFreq;
  if (o.yRange) p.y0 = lerp(o.yRange[0], o.yRange[1], p.y0);
  p.a = lerp(o.alpha[0], o.alpha[1], d);
  return p;
}

const BAT = {
  sprite: SPRITE.batOpen, flap: [4, 7], size: [16, 30], wind: [40, 90], sway: [20, 50],
  swayFreq: [0.2, 0.45], drift: [30, 70], wobble: [0.1, 0.25], alpha: [0.8, 1],
};

// Işık katmanı parçacığı (vektör çizilir; Atlas'ta görünmez). Zamanlama
// alanları overlayFrame/overlaySlot'ta okunur. xr/yr: flaş yuvalarının ekran
// oranı aralığı.
function overlay(p, rand, type, o = {}) {
  p.kind = KIND.overlay;
  p.part = type;
  p.period = o.period ? lerp(o.period[0], o.period[1], rand()) : 1;
  p.rest = o.rest ?? 1;
  p.duty = o.duty ?? 1;
  p.rise = o.rise ?? 0.3;
  p.slots = o.slots ?? 1;
  p.xr0 = o.xr ? o.xr[0] : 0;
  p.xr1 = o.xr ? o.xr[1] : 1;
  p.yr0 = o.yr ? o.yr[0] : 0;
  p.yr1 = o.yr ? o.yr[1] : 1;
  p.size = o.size ?? 1;
  p.speed = o.speed ?? 0;
  p.swayFreq = o.swayFreq ? lerp(o.swayFreq[0], o.swayFreq[1], rand()) : 0;
  p.driftFreqY = o.driftFreqY ? lerp(o.driftFreqY[0], o.driftFreqY[1], rand()) : 0;
  p.rotSpeed = 0;
  p.wobbleAmp = 0;
  p.a = 1;
  return p;
}

// ── Güneş sistemi ───────────────────────────────────────────────────────────
// Yörünge yarıçapları (dp, k ile ölçeklenir): Merkür … Neptün. Asteroit kuşağı
// Mars (100) ile Jüpiter (138) arasında. Elipsin dikey oranı 0,5 (üstten eğik bakış).
export const ORBIT_RADII = Object.freeze([46, 64, 82, 100, 138, 158, 176, 192]);
/** Yörünge ortasının ekran yüksekliği oranı (pose ve OverlayLayers aynı değeri kullanır). */
export const ORBIT_CENTER_Y = 0.45;
// sprite, boyut (dp), yörünge sırası, dolanma süresi (sn), kendi ekseninde dönüş (rad/sn),
// eksen eğikliği. Bantlı gezegenler dönmez (bantlar yatay kalmalı); Dünya, Mars, Merkür
// ve Güneş kutuptan bakılan disk gibi döner. parent: Dünya'nın satırı.
const SOLAR_BODIES = Object.freeze([
  { sprite: SPRITE.sun, size: 56, spin: 0.1, tilt: 0 },
  { sprite: SPRITE.mercury, size: 9, orbit: 0, period: 16, spin: 0.5, tilt: 0 },
  { sprite: SPRITE.venus, size: 14, orbit: 1, period: 25, spin: 0, tilt: 0 },
  { sprite: SPRITE.earth, size: 16, orbit: 2, period: 38, spin: 0.7, tilt: 0 },
  { sprite: SPRITE.mars, size: 12, orbit: 3, period: 58, spin: 0.5, tilt: 0 },
  { sprite: SPRITE.jupiter, size: 30, orbit: 4, period: 95, spin: 0, tilt: 0.05 },
  { sprite: SPRITE.saturn, size: 40, orbit: 5, period: 135, spin: 0, tilt: -0.42 },
  { sprite: SPRITE.uranus, size: 24, orbit: 6, period: 190, spin: 0, tilt: 1.45 },
  { sprite: SPRITE.neptune, size: 20, orbit: 7, period: 260, spin: 0, tilt: 0 },
  { sprite: SPRITE.moon, size: 6, parent: 3, r: 22, period: 14, spin: 0, tilt: 0 },
  { sprite: SPRITE.iss, size: 11, parent: 3, r: 13, period: 5, spin: 0, tilt: 0 },
]);
// Başlangıç açıları sabit (her açılışta aynı dizilim), Ay/İstasyon Dünya'nınkini bilir.
const solarPhase = (i) => seededRandom(deriveSeed(0x501, i + 1))() * TAU;

function makeParticle(effect, rand, pal, pal2, index, count) {
  const p = blank(rand);
  const d = rand(); // derinlik: büyük = yakın = hızlı + opak (paralaks)
  paint(p, pickFrom(rand, pal));

  if (OVERLAY_EFFECT_OF[effect] !== undefined) return makeOverlay(effect, p, rand, index);

  switch (effect) {
    case "leaves": {
      falling(p, rand, d, {
        sprite: rand() < 0.5 ? SPRITE.leafA : SPRITE.leafB,
        size: [16, 28], speed: [34, 68], wind: [8, 24], sway: [26, 62], swayFreq: [0.12, 0.28],
        rot: 0.45, wobble: [0.55, 1.05], alpha: [0.8, 1],
      });
      // sarkaç: salınımla aynı frekans ve faz
      p.wobbleFreq = p.swayFreq;
      p.wobblePhase = p.swayPhase;
      return p;
    }
    case "rain": {
      // Uzunluk = boyut; kalınlık çizgi dikdörtgeninin %16'sı içinde ~%7 (≈1,3–2,5 dp).
      setSprite(p, SPRITE.streak);
      p.size = lerp(18, 36, d);
      p.speed = lerp(520, 900, d);
      p.windX = p.speed * Math.tan(RAIN_SLANT);
      p.rot0 = -RAIN_SLANT;
      p.a = lerp(0.4, 0.8, d);
      return p;
    }
    case "lightning": {
      // index 0: ekran aydınlığı, 1: şimşek çizgisi. İkisi AYNI zamanlamada
      // (period/y0/salt grup tohumundan). Aralık 7–14 sn, aktif pencere ~0,5 sn.
      // Işığa duyarlılık: pencerede yalnız İKİ çakma (sn'de 3'ün altında),
      // tam ekran aydınlık en fazla %20 opak.
      const g = seededRandom(deriveSeed(0x11e, Math.floor(index / 2) + 1));
      p.period = lerp(7, 14, g());
      p.y0 = g();
      p.salt = Math.floor(g() * 100000);
      p.duty = 0.5 / p.period;
      if (index % 2 === 0) {
        p.kind = KIND.screenFlash;
        setSprite(p, SPRITE.solid);
        paint(p, "#eef4ff");
        p.size = 1.6;
        p.sizeMode = SIZE_MODE.max;
        p.rot0 = 0;
        p.a = 0.2;
      } else {
        // Vektör çizilir (VectorLayers.BoltLayer): biçim BOLT_VARIANTS taneden
        // çakma başına seçilir; size = boy (ekran yüksekliğinin katı).
        p.kind = KIND.bolt;
        p.size = lerp(0.38, 0.6, g());
        p.sizeMode = SIZE_MODE.height;
        p.a = 0.95;
      }
      return p;
    }
    case "sakura":
      return falling(p, rand, d, {
        sprite: SPRITE.petal, size: [9, 16], speed: [28, 58], wind: [14, 34], sway: [22, 52],
        swayFreq: [0.15, 0.34], rot: 1.2, wobble: [0.25, 0.55], wobbleFreq: [0.3, 0.6], alpha: [0.75, 1],
      });
    case "fireflies":
      return floating(p, rand, d, {
        sprite: SPRITE.glow, size: [10, 20], sway: [20, 60], freq: [0.03, 0.09], drift: [15, 45],
        pulse: [0.2, 0.55], alpha: [0.7, 1],
      });
    case "grass": {
      // alttan sabitli çim yaprağı; rüzgârla sallanır, hafif sağa yatık
      p.kind = KIND.anchor;
      setSprite(p, rand() < 0.55 ? SPRITE.grassA : SPRITE.grassB);
      p.x0 = (index + rand()) / Math.max(1, count); // tabana eşit yayılır
      p.size = lerp(22, 56, d);
      p.rot0 = lerp(-0.05, 0.12, rand());
      p.wobbleAmp = lerp(0.05, 0.14, rand());
      p.wobbleFreq = lerp(0.25, 0.5, rand());
      p.a = lerp(0.75, 1, d);
      return p;
    }
    case "flowers": {
      // iki parçacık bir çiçek: çift index sap (yeşil), tek index baş (renkli).
      // Zamanlama ve konum çiçek tohumundan → iki parça birlikte büyür/solar.
      const flower = Math.floor(index / 2);
      const g = seededRandom(deriveSeed(0xf10, flower + 1));
      p.kind = KIND.grow;
      p.period = lerp(9, 16, g());
      p.y0 = g();
      p.salt = Math.floor(g() * 100000);
      p.stemLen = lerp(30, 62, g());
      p.swayFreq = lerp(0.2, 0.4, g());
      p.swayPhase = g() * TAU;
      p.wobbleAmp = lerp(0.05, 0.12, g());
      const head = pickFrom(g, pal);
      if (index % 2 === 0) {
        p.part = 0;
        setSprite(p, SPRITE.flowerStem);
        paint(p, pickFrom(g, pal2));
        p.size = p.stemLen;
      } else {
        p.part = 1;
        setSprite(p, SPRITE.flowerHead);
        paint(p, head);
        p.size = lerp(14, 22, g());
        p.rotSpeed = lerp(-0.2, 0.2, g());
      }
      p.a = 1;
      return p;
    }
    case "waves": {
      // Kıyı katmanı (vektör, VectorLayers.ShoreLayer): index = katman
      // (0 arka/ufukta, yavaş ve soluk → 2 ön). Biçim shoreGeometry'de; burada
      // yalnız hareket: yatay kayma (dp/sn, ekran genişliğinde sarar) + kabarma.
      const layer = index % 3;
      p.kind = KIND.tile;
      p.part = layer;
      paint(p, pal[layer % pal.length]);
      p.x0 = [0.13, 0.41, 0.77][layer];
      p.windX = [-9, 14, -21][layer];
      p.swayAmp = [1.6, 2.4, 3.2][layer]; // × ölçek k
      p.swayFreq = [0.11, 0.15, 0.19][layer];
      p.swayPhase = layer * 1.7;
      p.a = 1;
      return p;
    }
    case "sand": {
      // Ön plandaki kum (sabit) + üstünde gidip gelen köpük çizgisi.
      p.kind = KIND.tile;
      p.part = 3;
      p.period = lerp(6.5, 8.5, rand()); // köpük gelgit döngüsü (sn)
      p.a = 1;
      return p;
    }
    case "glints": {
      // Suda yanıp sönen ışıltı: y0 deniz bandı içinde oran (shoreMetrics).
      floating(p, rand, d, {
        sprite: SPRITE.star, size: [4, 9], sway: [4, 14], freq: [0.02, 0.06], drift: [0.5, 2],
        pulse: [0.5, 1.4], pulseMin: 0.05, alpha: [0.7, 1], rot: 0.3,
      });
      p.y0 = lerp(0.12, 0.9, rand());
      p.seaBand = 1;
      return p;
    }
    case "seagulls":
      return flapping(p, rand, d, {
        sprite: SPRITE.gullOpen, flap: [1.2, 2.2], size: [16, 28], wind: [18, 40], sway: [8, 20],
        swayFreq: [0.1, 0.25], drift: [10, 30], wobble: [0.05, 0.15], alpha: [0.8, 1], yRange: [0.08, 0.4],
      });
    case "auroraBands": {
      p.kind = KIND.band;
      setSprite(p, SPRITE.ribbon);
      paint(p, pal[index % pal.length]);
      p.size = lerp(0.85, 1.25, rand());
      p.sizeMode = SIZE_MODE.width;
      p.x0 = lerp(0.2, 0.8, rand());
      p.y0 = lerp(0.1, 0.36, (index + rand()) / 4);
      p.swayAmp = lerp(20, 60, rand());
      p.swayFreq = lerp(0.015, 0.035, rand());
      p.driftAmpY = lerp(6, 18, rand());
      p.driftFreqY = lerp(0.02, 0.05, rand());
      p.rot0 = lerp(-0.12, 0.12, rand());
      p.wobbleAmp = lerp(0.04, 0.1, rand());
      p.wobbleFreq = lerp(0.02, 0.05, rand());
      p.pulseFreq = lerp(0.05, 0.12, rand());
      p.pulseMin = 0.35;
      p.a = lerp(0.35, 0.6, rand());
      return p;
    }
    case "skyStars":
      return floating(p, rand, d, {
        sprite: rand() < 0.3 ? SPRITE.star : SPRITE.dot, size: [2, 7], sway: [1, 4], freq: [0.01, 0.03],
        drift: [1, 4], pulse: [0.15, 0.5], pulseMin: 0.2, alpha: [0.5, 0.95], yRange: [0, 0.7],
      });
    case "popcorn":
      return falling(p, rand, d, {
        sprite: SPRITE.popcorn, size: [12, 20], speed: [50, 95], wind: [-6, 6], sway: [6, 18],
        swayFreq: [0.2, 0.45], rot: 1.6, wobble: [0.2, 0.5], wobbleFreq: [0.8, 1.6], alpha: [0.85, 1],
      });
    case "tickets": {
      if (rand() < 0.6) {
        return falling(p, rand, d, {
          sprite: SPRITE.ticket, size: [18, 28], speed: [28, 55], wind: [-8, 14], sway: [18, 44],
          swayFreq: [0.12, 0.26], rot: 0.8, wobble: [0.3, 0.6], alpha: [0.85, 1],
        });
      }
      paint(p, pickFrom(rand, pal2));
      return floating(p, rand, d, {
        sprite: SPRITE.star, size: [7, 13], sway: [6, 20], freq: [0.02, 0.06], drift: [6, 20],
        rot: 0.3, pulse: [0.3, 0.8], pulseMin: 0.15, alpha: [0.75, 1],
      });
    }
    case "embers": {
      falling(p, rand, d, {
        dir: -1, sprite: SPRITE.glow, size: [3, 8], speed: [40, 110], wind: [-6, 10], sway: [8, 22],
        swayFreq: [0.3, 0.8], alpha: [0.7, 1],
      });
      p.pulseFreq = lerp(1.4, 3.2, rand());
      p.pulseMin = 0.4;
      p.fadeOut = 1; // yükseldikçe söner
      return p;
    }
    case "stardust": {
      if (index < 2 && count >= 8) {
        // iki kayan yıldız: uzun aralıkla, kısa süre görünür
        p.kind = KIND.meteor;
        setSprite(p, SPRITE.trail);
        p.size = lerp(60, 110, rand());
        p.period = lerp(6, 11, rand());
        p.duty = 0.12;
        p.a = 0.95;
        return p;
      }
      const star = rand() < 0.45;
      return floating(p, rand, d, {
        sprite: star ? SPRITE.star : SPRITE.dot, size: star ? [6, 13] : [2, 5], sway: [2, 8],
        freq: [0.01, 0.04], drift: [2, 8], rot: star ? 0.2 : 0, pulse: [0.15, 0.6], pulseMin: 0.15, alpha: [0.6, 1],
      });
    }
    case "butterflies":
      return flapping(p, rand, d, {
        sprite: SPRITE.butterflyOpen, flap: [3.5, 6], size: [16, 26], wind: [22, 50], sway: [25, 60],
        swayFreq: [0.15, 0.35], drift: [40, 90], tilt: 0.25, wobble: [0.15, 0.3], alpha: [0.85, 1],
      });
    case "dandelion": {
      p.kind = KIND.drift;
      setSprite(p, SPRITE.dandelion);
      p.size = lerp(14, 24, d);
      p.windX = lerp(16, 40, rand()) * lerp(0.8, 1.2, d);
      p.swayAmp = lerp(8, 24, rand());
      p.swayFreq = lerp(0.08, 0.2, rand());
      p.driftAmpY = lerp(30, 60, rand());
      p.driftFreqY = lerp(0.02, 0.05, rand());
      p.rotSpeed = lerp(-0.3, 0.3, rand());
      p.wobbleAmp = lerp(0.15, 0.35, rand());
      p.wobbleFreq = lerp(0.1, 0.25, rand());
      p.a = lerp(0.6, 0.95, d);
      return p;
    }
    case "fireworks": {
      // index'e göre grup: aynı gruptaki parçalar aynı merkezden, aynı anda.
      // Grubun ilk FIREWORK_TRAIL parçası alttan yükselen roket + kuyruğu (izi),
      // kalan FIREWORK_SPARKS parça patlayan kıvılcım.
      const group = Math.floor(index / BURST_SIZE);
      const k = index % BURST_SIZE;
      const g = seededRandom(deriveSeed(0xf1e, group + 1)); // grup ortak
      p.kind = KIND.burst;
      p.group = group;
      p.period = lerp(3.4, 4.6, g());
      p.y0 = g();
      p.salt = Math.floor(g() * 100000);
      paint(p, pickFrom(g, pal));
      p.duty = 0.86;
      p.a = 1;
      p.launch = FIREWORK_LAUNCH;
      if (k < FIREWORK_TRAIL) {
        // 0 = roketin başı, 1.. = kuyruk (giderek geride, küçük ve sönük)
        p.part = 1;
        p.lag = k;
        setSprite(p, SPRITE.glow);
        p.size = lerp(7, 10, d) * (1 - k * 0.11);
        p.rot0 = 0;
        return p;
      }
      p.part = 0;
      setSprite(p, rand() < 0.25 ? SPRITE.star : SPRITE.glow);
      p.rot0 = ((k - FIREWORK_TRAIL) / FIREWORK_SPARKS) * TAU + lerp(-0.12, 0.12, rand());
      p.speed = lerp(70, 120, rand());
      p.size = lerp(5, 9, d);
      return p;
    }
    case "hearts":
      return falling(p, rand, d, {
        dir: -1, sprite: SPRITE.heart, size: [12, 24], speed: [26, 55], wind: [-6, 6], sway: [14, 36],
        swayFreq: [0.12, 0.3], wobble: [0.15, 0.35], alpha: [0.75, 1],
      });
    case "halloweenBats": {
      if (rand() < 0.75) return flapping(p, rand, d, BAT);
      paint(p, pickFrom(rand, pal2));
      return falling(p, rand, d, {
        sprite: SPRITE.pumpkin, size: [16, 24], speed: [30, 55], wind: [-6, 6], sway: [10, 26],
        swayFreq: [0.12, 0.25], wobble: [0.2, 0.45], alpha: [0.9, 1],
      });
    }
    case "bats":
      return flapping(p, rand, d, BAT);
    case "solarBodies": {
      const row = SOLAR_BODIES[index % SOLAR_BODIES.length];
      p.kind = KIND.orbit;
      setSprite(p, row.sprite);
      p.size = row.size;
      p.rotSpeed = row.spin;
      p.rot0 = row.tilt;
      p.a = 0.95;
      p.swayPhase = solarPhase(index);
      if (row.parent !== undefined) {
        // Ay / Uzay İstasyonu: Dünya'nın çevresinde
        const earth = SOLAR_BODIES[row.parent];
        p.parentR = ORBIT_RADII[earth.orbit];
        p.parentW = TAU / earth.period;
        p.parentPh = solarPhase(row.parent);
        p.orbitR = row.r;
        p.orbitW = TAU / row.period;
      } else if (row.orbit !== undefined) {
        p.orbitR = ORBIT_RADII[row.orbit];
        p.orbitW = TAU / row.period;
      }
      return p;
    }
    case "asteroidBelt": {
      p.kind = KIND.orbit;
      setSprite(p, rand() < 0.5 ? SPRITE.speck : SPRITE.dot);
      p.size = lerp(2.5, 5.5, d);
      p.orbitR = lerp(108, 122, rand());
      p.orbitW = TAU / lerp(100, 118, rand());
      p.rotSpeed = lerp(-1, 1, rand());
      p.a = lerp(0.5, 0.9, d);
      return p;
    }
    case "blackHole":
      // uzak köşede yavaş dönen kara delik (yığılma diski + foton halkası)
      p.kind = KIND.float;
      setSprite(p, SPRITE.blackHole);
      p.size = 84;
      p.x0 = 0.8;
      p.y0 = 0.13;
      p.swayAmp = 5;
      p.swayFreq = 0.02;
      p.driftAmpY = 4;
      p.driftFreqY = 0.02;
      p.rotSpeed = 0.25;
      p.a = 1;
      return p;
    case "pulsar":
      // hızlı dönen nötron yıldızı; iki ışın süpürür, parlaklık yumuşakça nefes alır
      p.kind = KIND.float;
      setSprite(p, SPRITE.pulsar);
      p.size = 70;
      p.x0 = 0.17;
      p.y0 = 0.87;
      p.swayAmp = 4;
      p.swayFreq = 0.025;
      p.driftAmpY = 4;
      p.driftFreqY = 0.02;
      p.rotSpeed = 1.7;
      p.pulseFreq = 0.8;
      p.pulseMin = 0.6;
      p.a = 1;
      return p;
    case "comets":
      p.kind = KIND.meteor;
      setSprite(p, SPRITE.trail);
      p.size = lerp(90, 140, rand());
      p.period = lerp(14, 22, rand());
      p.duty = 0.14;
      p.a = 0.95;
      return p;
    case "ghosts": {
      // süzülerek yatay uçan hayalet; yavaş aşağı yukarı, hafif eğilir, yarı saydam
      p.kind = KIND.drift;
      setSprite(p, SPRITE.ghost);
      p.size = lerp(28, 46, d);
      p.windX = (rand() < 0.5 ? -1 : 1) * lerp(12, 34, rand());
      p.y0 = lerp(0.1, 0.75, p.y0);
      p.swayAmp = lerp(8, 22, rand());
      p.swayFreq = lerp(0.08, 0.18, rand());
      p.driftAmpY = lerp(14, 36, rand());
      p.driftFreqY = lerp(0.04, 0.09, rand());
      p.wobbleAmp = lerp(0.08, 0.2, rand());
      p.wobbleFreq = p.swayFreq;
      p.pulseFreq = lerp(0.12, 0.3, rand());
      p.pulseMin = 0.45;
      p.a = lerp(0.5, 0.85, d);
      return p;
    }
    case "tombstones": {
      // alttan sabitli mezar taşı, taban boyunca eşit aralıklı
      p.kind = KIND.anchor;
      setSprite(p, SPRITE.tombstone);
      p.x0 = (index + 0.2 + rand() * 0.6) / Math.max(1, count);
      p.size = lerp(34, 56, d);
      p.rot0 = lerp(-0.07, 0.07, rand());
      p.a = lerp(0.75, 1, d);
      return p;
    }
    case "spiders": {
      // iki parçacık bir örümcek: çift index ip, tek index gövde (ortak tohum → birlikte iner)
      const sp = Math.floor(index / 2);
      const total = Math.max(1, Math.floor(count / 2));
      const g = seededRandom(deriveSeed(0x5d1, sp + 1));
      p.kind = KIND.dangle;
      p.x0 = (sp + 0.15 + g() * 0.7) / total;
      p.stemLen = lerp(80, 240, g());
      p.swayFreq = lerp(0.12, 0.28, g());
      p.swayPhase = g() * TAU;
      p.driftFreqY = lerp(0.05, 0.11, g());
      p.wobblePhase = g() * TAU;
      p.wobbleAmp = lerp(0.04, 0.1, g());
      p.part = index % 2;
      paint(p, pickFrom(g, pal)); // ip ve gövde aynı renk
      if (p.part === 0) {
        setSprite(p, SPRITE.thread);
        p.size = p.stemLen;
        p.a = 0.6;
      } else {
        setSprite(p, SPRITE.spider);
        p.size = lerp(18, 28, g());
        p.a = 1;
      }
      return p;
    }
    case "xmasGoodies": {
      const kinds = [SPRITE.gift, SPRITE.candyCane, SPRITE.ornament, SPRITE.star];
      return falling(p, rand, d, {
        sprite: pickFrom(rand, kinds), size: [16, 28], speed: [26, 52], wind: [-8, 10], sway: [14, 34],
        swayFreq: [0.1, 0.24], rot: 0.5, wobble: [0.15, 0.4], alpha: [0.8, 1],
      });
    }
    case "xmasScene": {
      // alttan sabitli kardan adam / Noel ağacı, dönüşümlü, tabana eşit yayılır
      p.kind = KIND.anchor;
      const man = index % 2 === 0;
      setSprite(p, man ? SPRITE.snowman : SPRITE.xmasTree);
      paint(p, pickFrom(rand, man ? pal : pal2));
      p.x0 = (index + 0.25 + rand() * 0.5) / Math.max(1, count);
      p.size = man ? lerp(58, 84, d) : lerp(66, 100, d);
      p.rot0 = lerp(-0.03, 0.03, rand());
      p.a = lerp(0.85, 1, d);
      return p;
    }
    case "sleigh": {
      // ara sıra soldan sağa geçen Noel Baba kızağı (ren geyikleriyle)
      p.kind = KIND.glide;
      setSprite(p, SPRITE.sleigh);
      p.size = lerp(130, 160, d);
      p.period = lerp(16, 22, rand());
      p.duty = 0.3;
      p.salt = Math.floor(rand() * 100000);
      p.a = 1;
      return p;
    }
    case "balloons":
      return falling(p, rand, d, {
        dir: -1, sprite: SPRITE.balloon, size: [26, 42], speed: [22, 45], wind: [-5, 8], sway: [10, 26],
        swayFreq: [0.08, 0.18], wobble: [0.06, 0.16], alpha: [0.85, 1],
      });
    case "notes": {
      falling(p, rand, d, {
        dir: -1, sprite: rand() < 0.55 ? SPRITE.noteA : SPRITE.noteB, size: [14, 24], speed: [24, 50],
        wind: [-10, 14], sway: [16, 40], swayFreq: [0.15, 0.32], wobble: [0.2, 0.4], alpha: [0.75, 1],
      });
      p.rot0 = lerp(-0.25, 0.25, rand());
      p.fadeOut = 1;
      return p;
    }
    case "motes":
      return floating(p, rand, d, {
        sprite: rand() < 0.6 ? SPRITE.glow : SPRITE.dot, size: [2.5, 6], sway: [10, 30], freq: [0.02, 0.06],
        drift: [12, 34], pulse: [0.15, 0.45], pulseMin: 0.3, alpha: [0.5, 0.9],
      });
    case "wisps":
      return floating(p, rand, d, {
        sprite: SPRITE.glow, size: [14, 28], sway: [30, 80], freq: [0.015, 0.045], drift: [30, 70],
        pulse: [0.08, 0.2], pulseMin: 0.15, alpha: [0.45, 0.8],
      });
    case "ash":
      return falling(p, rand, d, {
        sprite: rand() < 0.6 ? SPRITE.speck : SPRITE.dot, size: [3, 8], speed: [14, 36], wind: [4, 16],
        sway: [10, 28], swayFreq: [0.08, 0.2], rot: 0.8, alpha: [0.45, 0.85],
      });
    case "sandDrift": {
      p.kind = KIND.drift;
      setSprite(p, rand() < 0.5 ? SPRITE.speck : SPRITE.dot);
      p.size = lerp(2, 5, d);
      p.windX = lerp(60, 150, d);
      p.y0 = lerp(0.3, 0.97, p.y0);
      p.swayAmp = lerp(4, 14, rand());
      p.swayFreq = lerp(0.2, 0.6, rand());
      p.driftAmpY = lerp(4, 16, rand());
      p.driftFreqY = lerp(0.05, 0.15, rand());
      p.rotSpeed = lerp(-2, 2, rand());
      p.a = lerp(0.45, 0.85, d);
      return p;
    }
    // ── tür parçaları
    case "coals": {
      // kor: kıvılcımdan iri, yavaş yükselen, nefes alan ışık
      falling(p, rand, d, {
        dir: -1, sprite: SPRITE.glow, size: [9, 16], speed: [16, 36], wind: [-4, 6], sway: [10, 26],
        swayFreq: [0.08, 0.2], alpha: [0.55, 0.9],
      });
      p.pulseFreq = lerp(0.4, 0.9, rand());
      p.pulseMin = 0.45;
      p.fadeOut = 1;
      return p;
    }
    case "magicMotes":
      return floating(p, rand, d, {
        sprite: SPRITE.glow, size: [5, 10], sway: [20, 50], freq: [0.03, 0.08], drift: [15, 40],
        pulse: [0.3, 0.8], alpha: [0.6, 1],
      });
    case "rosePetals":
      return falling(p, rand, d, {
        sprite: SPRITE.petal, size: [10, 17], speed: [30, 60], wind: [6, 22], sway: [20, 48],
        swayFreq: [0.15, 0.32], rot: 1.4, wobble: [0.3, 0.6], wobbleFreq: [0.35, 0.7], alpha: [0.8, 1],
      });
    case "windowDrops":
      // cama yapışıp yavaşça süzülen damla (izli)
      return falling(p, rand, d, {
        sprite: SPRITE.drop, size: [12, 24], speed: [8, 26], sway: [0, 1.5], swayFreq: [0.05, 0.1],
        alpha: [0.35, 0.7],
      });
    case "confetti":
      return falling(p, rand, d, {
        sprite: SPRITE.confetti, size: [8, 14], speed: [40, 80], wind: [-10, 10], sway: [10, 30],
        swayFreq: [0.3, 0.7], rot: 3, wobble: [0.6, 1.2], wobbleFreq: [1, 2], alpha: [0.85, 1],
      });
    case "paperStars":
      return falling(p, rand, d, {
        sprite: SPRITE.star, size: [8, 16], speed: [18, 40], wind: [-6, 6], sway: [10, 30],
        swayFreq: [0.1, 0.25], rot: 1, alpha: [0.8, 1],
      });
    case "clouds": {
      p.kind = KIND.drift;
      setSprite(p, SPRITE.cloud);
      p.size = lerp(60, 110, d);
      p.windX = lerp(6, 16, d);
      p.y0 = lerp(0.04, 0.32, p.y0);
      p.swayAmp = lerp(2, 6, rand());
      p.swayFreq = lerp(0.02, 0.05, rand());
      p.driftAmpY = lerp(4, 10, rand());
      p.driftFreqY = lerp(0.02, 0.04, rand());
      p.rot0 = 0;
      p.a = lerp(0.35, 0.6, d);
      return p;
    }
    case "kites":
      floating(p, rand, d, {
        sprite: SPRITE.kite, size: [26, 40], sway: [20, 50], freq: [0.03, 0.07], drift: [14, 30],
        alpha: [0.85, 1], yRange: [0.08, 0.45],
      });
      p.rot0 = lerp(-0.2, 0.2, rand());
      p.wobbleAmp = lerp(0.12, 0.25, rand());
      p.wobbleFreq = lerp(0.15, 0.3, rand());
      return p;
    case "planes": {
      // kâğıt uçak soldan sağa süzülür, burnu salınımla inip kalkar
      p.kind = KIND.drift;
      setSprite(p, SPRITE.plane);
      p.size = lerp(22, 34, d);
      p.windX = lerp(40, 80, d);
      p.y0 = lerp(0.1, 0.6, p.y0);
      p.swayAmp = lerp(2, 6, rand());
      p.swayFreq = lerp(0.2, 0.4, rand());
      p.driftAmpY = lerp(20, 40, rand());
      p.driftFreqY = lerp(0.05, 0.1, rand());
      p.rot0 = -0.08;
      p.wobbleAmp = lerp(0.08, 0.16, rand());
      p.wobbleFreq = p.driftFreqY;
      p.wobblePhase = p.wobblePhase + 1.57;
      p.a = lerp(0.85, 1, d);
      return p;
    }
    case "parchment": {
      falling(p, rand, d, {
        sprite: SPRITE.parchment, size: [14, 24], speed: [20, 44], wind: [4, 16], sway: [24, 56],
        swayFreq: [0.1, 0.24], rot: 0.5, wobble: [0.4, 0.9], alpha: [0.75, 0.95],
      });
      p.wobbleFreq = p.swayFreq;
      p.wobblePhase = p.swayPhase;
      return p;
    }
    case "smoke": {
      falling(p, rand, d, {
        dir: -1, sprite: SPRITE.glow, size: [50, 110], speed: [8, 20], wind: [3, 10], sway: [10, 30],
        swayFreq: [0.03, 0.08], rot: 0.1, alpha: [0.12, 0.24],
      });
      p.fadeOut = 1;
      return p;
    }
    case "tumbleweed": {
      // alt kenarda yuvarlanan çalı: dönüş hızı = yol / yarıçap, hafif seker
      p.kind = KIND.drift;
      setSprite(p, SPRITE.tumbleweed);
      p.size = lerp(26, 40, d);
      p.windX = lerp(50, 90, d);
      p.y0 = lerp(0.86, 0.94, rand());
      p.swayAmp = lerp(6, 12, rand());
      p.swayFreq = lerp(0.5, 0.8, rand());
      p.driftAmpY = 0;
      p.rotSpeed = p.windX / (p.size * 0.5);
      p.a = lerp(0.85, 1, d);
      return p;
    }
    default:
      // kar: HEPSİ altı kollu kristal (8 Kas, kullanıcı isteği). Her kristal
      // yavaşça kendi ekseninde döner.
      return falling(p, rand, d, {
        sprite: SPRITE.flake, size: [7, 16], speed: [24, 68], wind: [-4, 6], sway: [8, 26],
        swayFreq: [0.08, 0.24], rot: 0.6, alpha: [0.5, 0.95],
      });
  }
}

// Işık katmanları. Işığa duyarlılık: flaş türleri küçük alanlı ve seyrek
// (paparazzi 3 yuva × ≥2,6 sn → sn'de ~1,2), parlaklık değişimleri yumuşak
// (en kısa yükseliş ~0,06 sn yalnız avuç içi kadar alanda); tam ekranı
// kaplayan katmanlar (vinyet, mum, neon) yalnız yavaş nefes alır.
function makeOverlay(effect, p, rand, index) {
  const type = OVERLAY_EFFECT_OF[effect];
  switch (effect) {
    case "flare":
      return overlay(p, rand, type, { period: [7, 11], duty: 0.18, rise: 0.35, xr: [0.2, 0.8], yr: [1, 1] });
    case "planet":
      overlay(p, rand, type, { period: [80, 110], size: lerp(0.075, 0.095, rand()) });
      p.yr0 = lerp(0.12, 0.24, rand());
      return p;
    case "heartbeat":
      return overlay(p, rand, type, { period: [1.45, 1.7] });
    case "fog":
      overlay(p, rand, type, { speed: lerp(7, 15, rand()) * (index % 2 ? -1 : 1) });
      p.yr0 = 0.86 + (index % 2) * 0.07;
      return p;
    case "lampFlicker":
      return overlay(p, rand, type, { period: [6, 10] });
    case "flashlight":
      return overlay(p, rand, type, { swayFreq: [0.025, 0.045], driftFreqY: [0.03, 0.055] });
    case "neon":
      return overlay(p, rand, type, { period: [5, 9] });
    case "farFlashes":
      return overlay(p, rand, type, { period: [5, 9], duty: 0.14, rise: 0.3, slots: 2, xr: [0.05, 0.95], yr: [0.86, 0.97] });
    case "heatHaze":
      return overlay(p, rand, type, { period: [5, 7] });
    case "spotlight":
      overlay(p, rand, type, { swayFreq: [0.035, 0.055] });
      p.xr0 = lerp(0.35, 0.65, rand());
      return p;
    case "paparazzi":
      return overlay(p, rand, type, { period: [2.6, 4.4], duty: 0.1, rise: 0.15, slots: 3, xr: [0.08, 0.92], yr: [0.14, 0.72] });
    case "mordor":
      // gözün bakışı: sola, ufkun üstünden aşağısına yavaşça süpürür
      overlay(p, rand, type, { swayFreq: [0.03, 0.04] });
      p.rot0 = 1.62;
      p.swayAmp = 0.62;
      return p;
    case "prison":
      // kule projektörü: sola-aşağı tel örgü boyunca tarar
      overlay(p, rand, type, { swayFreq: [0.045, 0.06] });
      p.rot0 = 0.62;
      p.swayAmp = 0.48;
      return p;
    case "skyBeam":
      // şehirden yukarı; iki hüzme farklı yer ve fazda
      overlay(p, rand, type, { swayFreq: [0.025, 0.04] });
      p.xr0 = index % 2 ? 0.7 : 0.24;
      p.yr0 = 0.95;
      p.rot0 = Math.PI + (index % 2 ? 0.16 : -0.16);
      p.swayAmp = 0.34;
      p.swayPhase = index * 2.1;
      return p;
    case "iceWall":
      // duvarın yıkılışı ejderha turuyla (gotScene, 24 sn × 3 = 72 sn) AYNI saatte: faz 0
      overlay(p, rand, type, { period: [72, 72], rest: 3 });
      p.y0 = 0;
      return p;
    case "dunes":
      // solucan ve titreşim: 40 sn saati (duneScene ile aynı, faz 0)
      overlay(p, rand, type, { period: [80, 80], rest: 2 });
      p.y0 = 0;
      return p;
    case "opShip":
      overlay(p, rand, type, { period: [88, 88], rest: 2 });
      p.y0 = rand();
      return p;
    case "rmPortal":
      overlay(p, rand, type, { period: [90, 90], rest: 3 });
      p.y0 = 0;
      return p;
    case "swPlanet":
      // swScene olay döngüsüyle AYNI 60 sn saati (faz 0)
      overlay(p, rand, type, { period: [120, 120], rest: 2 });
      p.y0 = 0;
      return p;
    case "river":
      // baskın turu vikScene ile AYNI saatte (30 sn × 3 = 90 sn, faz 0)
      overlay(p, rand, type, { period: [90, 90], rest: 3 });
      p.y0 = 0;
      return p;
    case "transmute":
      return overlay(p, rand, type, { period: [51, 57], rest: 3 });
    case "blueprint":
      return overlay(p, rand, type, { period: [63, 72], rest: 3 });
    default:
      // blinds, warmGlow, equalizer, candle, viewfinder, evren silüetleri: yalnız saat
      return overlay(p, rand, type);
  }
}

// Sayısı yoğunluktan bağımsız / yapısal olarak yuvarlanan efektler.
function structuralCount(effect, n) {
  if (n <= 0) return 0;
  switch (effect) {
    case "fireworks":
      return Math.max(BURST_SIZE, Math.floor(n / BURST_SIZE) * BURST_SIZE);
    case "lightning":
      return 2;
    case "waves":
      return 3;
    case "sand":
      return 1;
    case "flowers":
    case "spiders":
      return Math.max(2, Math.floor(n / 2) * 2);
    default:
      return n;
  }
}

/**
 * Parçacıkları üretir. Aynı (efekt, sayı, tohum, tema tonu) → aynı dizi.
 * Bileşik efekt parçalarına açılır; bazı türlerde sayı yapıya yuvarlanır
 * (fişek patlama katı, çiçek çifti, dalga/kum döşemesi, şimşek 2).
 */
// Sahne kurucularına (utils/weatherUniverses.js) verilen araç takımı: döngüsel
// içe aktarma olmasın diye motor parçaları çağrı anında geçer.
const SCENE_KIT = Object.freeze({
  SPRITE, KIND, OVERLAY, SIZE_MODE, TAU, lerp, blank, setSprite, paint, falling, floating, flapping,
  overlay, seededRandom, deriveSeed, pickFrom,
});

export function buildParticles(effect, { count, seed = 1, lightSurface = false } = {}) {
  const e = normalizeWeatherEffect(effect);
  const total = Math.max(0, Math.min(400, Math.floor(Number(count) || 0)));
  const parts = COMPOSITES[e];
  if (parts) {
    if (total <= 0) return [];
    const fixedSum = parts.reduce((s, [, v]) => s + (typeof v === "object" ? v.fixed : 0), 0);
    const rest = Math.max(0, total - fixedSum);
    const out = [];
    parts.forEach(([sub, v], i) => {
      const n = typeof v === "object" ? v.fixed : Math.max(1, Math.round(rest * v));
      out.push(...buildParticles(sub, { count: n, seed: deriveSeed(seed, i + 11), lightSurface }));
    });
    // alt kenara oturan deniz: tab çubuğunun üstüne kaldırılır (ParticleField)
    if (e === "onePiece") for (const q of out) if (q.kind === KIND.tile) q.lift = SCENERY.lift;
    return out;
  }
  const scene = SCENE_BUILDERS[e];
  if (scene) {
    if (total <= 0) return [];
    const tone = lightSurface ? "light" : "dark";
    const rand = seededRandom(deriveSeed(deriveSeed(seed, WEATHER_SEED_SALT), ALL_EFFECTS.indexOf(e) + 1));
    const out = scene(SCENE_KIT, { rand, count: total, lightSurface, tone });
    for (const q of out) if (COLORED_SET.has(q.sprite)) paint(q, "#ffffff");
    return out;
  }
  const n = structuralCount(e, total);
  const spec = EFFECT_SPECS[e];
  const tone = lightSurface ? "light" : "dark";
  const pal = spec.palette[tone];
  const pal2 = (spec.palette2 || spec.palette)[tone];
  const rand = seededRandom(deriveSeed(deriveSeed(seed, WEATHER_SEED_SALT), ALL_EFFECTS.indexOf(e) + 1));
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const p = makeParticle(e, rand, pal, pal2, i, n);
    if (COLORED_SET.has(p.sprite)) paint(p, "#ffffff");
    out[i] = p;
  }
  return out;
}

/** Planı ([[efekt, sayı], ...]) tek diziye açar; her efekt kendi tohumuyla. */
export function buildPlanParticles(plan, { seed = 1, lightSurface = false } = {}) {
  const out = [];
  (plan || []).forEach(([effect, count], i) => {
    out.push(...buildParticles(effect, { count, seed: i ? deriveSeed(seed, 0x9a + i) : seed, lightSurface }));
  });
  return out;
}

/** Kare başına şekil karesi değişen (kanat çırpan) parçacık var mı. */
export const needsAnimatedSprites = (particles) => particles.some((p) => p.flapFreq > 0 || p.framed > 0);

/** Atlas yerine vektör çizilen parçacık (şimşek çizgisi, dalga/kum katmanı, tür ışık katmanı). */
export const isVectorParticle = (p) => p.kind === KIND.tile || p.kind === KIND.bolt || p.kind === KIND.overlay;

const TIMED_KINDS = new Set([KIND.meteor, KIND.screenFlash, KIND.burst, KIND.grow, KIND.bolt, KIND.glide, KIND.track, KIND.emit]);
/** Opaklığı zamanla değişen parçacık var mı (yoksa renkler bir kez yazılır). */
export const needsAnimatedAlpha = (particles) =>
  particles.some((p) => p.pulseFreq > 0 || p.fadeOut > 0 || TIMED_KINDS.has(p.kind));

// ── Kare hesabı (worklet) ───────────────────────────────────────────────────

const wrap01 = (v) => {
  "worklet";
  return v - Math.floor(v);
};

/**
 * Olay saati: döngünün ilk 1/rest kadarı olay (0–1'e açılır), kalanı dinlenme (2 = olay bitti).
 * Olaylar `rest` katı seyrek gelir ama süreleri değişmez (dönem rest ile çarpılmıştır).
 */
export function restU(p, t) {
  "worklet";
  const c = (t / p.period + p.y0) % 1;
  const u = (c < 0 ? c + 1 : c) * (p.rest || 1);
  return u > 1 ? 2 : u;
}

/** Kıyı yerleşimi (dp): ölçek k, kumun üst kenarı, deniz bandı, katman tabanları.
 *  particlePose bunu çağırır → ondan ÖNCE tanımlı olmalı (worklet eklentisi
 *  fonksiyonu sabite çevirir, yukarı taşınmaz). */
export function shoreMetrics(width, height) {
  "worklet";
  const k = Math.max(0.45, Math.min(1.3, Math.min(width / 390, height / 640)));
  const sandTop = height - 36 * k;
  return {
    k,
    sandTop,
    seaTop: sandTop - 58 * k,
    bases: [sandTop - 58 * k, sandTop - 36 * k, sandTop - 15 * k],
  };
}

// Döngü numarasından 0–1 (state'siz "rastgele yeniden belirme" için).
export function hash01(n, salt) {
  "worklet";
  const v = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

const easeOutCubic = (x) => {
  "worklet";
  const k = 1 - x;
  return 1 - k * k * k;
};

// Çiçeğin büyüme katsayısı (0–1): hızlı büyür, açık kalır, sonda solar.
export function growthAt(k) {
  "worklet";
  if (k < 0.18) return easeOutCubic(k / 0.18);
  if (k > 0.86) return Math.max(0, 1 - (k - 0.86) / 0.14);
  return 1;
}

const bump = (x, c, w) => {
  "worklet";
  const v = 1 - Math.abs(x - c) / w;
  return v > 0 ? v : 0;
};

/** Güneş sistemi ölçeği: en dış yörünge ekran genişliğinin ~%46'sı (yarıçap) olacak şekilde. */
export function orbitScale(width) {
  "worklet";
  const k = (width * 0.46) / 192;
  return k < 0.5 ? 0.5 : k > 1.35 ? 1.35 : k;
}

/** Anahtar kare satırı: u, x, y (ekran oranı), boy katı, açı, opaklık, şekil karesi,
 *  yumuşatma (1 = bu kareden sonrakine smoothstep), dy (dp × ölçek). */
export const KF_STRIDE = 9;

/** Evren sahnesi ölçeği (dp): kıyı katmanıyla AYNI formül (dalga üstündeki gemi). */
export function sceneScale(width, height) {
  "worklet";
  const k = Math.min(width / 390, height / 640);
  return k < 0.45 ? 0.45 : k > 1.3 ? 1.3 : k;
}

/** Anahtar karelerde u (0–1) anı: doğrusal (ya da yumuşak) ara değer; şekil karesi
 *  bölümün başındaki kare. */
export function trackSample(kf, u) {
  "worklet";
  const S = 9; // KF_STRIDE
  const n = kf.length / S;
  if (n <= 1 || u <= kf[0]) {
    return { x: kf[1], y: kf[2], s: kf[3], a: kf[4], al: kf[5], f: kf[6], dy: kf[8] };
  }
  let i = 0;
  while (i < n - 2 && u >= kf[(i + 1) * S]) i += 1;
  const b = i * S;
  const c = b + S;
  const span = kf[c] - kf[b];
  let k = span > 0 ? (u - kf[b]) / span : 1;
  if (k > 1) k = 1;
  if (kf[b + 7] === 1) k = k * k * (3 - 2 * k);
  return {
    x: kf[b + 1] + (kf[c + 1] - kf[b + 1]) * k,
    y: kf[b + 2] + (kf[c + 2] - kf[b + 2]) * k,
    s: kf[b + 3] + (kf[c + 3] - kf[b + 3]) * k,
    a: kf[b + 4] + (kf[c + 4] - kf[b + 4]) * k,
    al: kf[b + 5] + (kf[c + 5] - kf[b + 5]) * k,
    f: k >= 1 ? kf[c + 6] : kf[b + 6],
    dy: kf[b + 8] + (kf[c + 8] - kf[b + 8]) * k,
  };
}

/** Rotadaki nokta (px): anahtar kare + döngü başına kayma + ofset + süzülme. */
export function trackPoint(p, t, u, n, width, height) {
  "worklet";
  const q = trackSample(p.kf, u);
  const k = sceneScale(width, height);
  let x = q.x * width + p.ox * q.s * k;
  let y = q.y * height + q.dy * k + p.oy * q.s * k;
  if (p.jitterX) x += (hash01(n, p.salt) - 0.5) * p.jitterX * width;
  if (p.jitterY) y += (hash01(n, p.salt + 3) - 0.5) * p.jitterY * height;
  if (p.bobAmp) {
    y += Math.sin(t * p.bobFreq * 6.283185307179586 + p.bobPh) * p.bobAmp * k;
    x += Math.cos(t * p.bobFreq * 3.141592653589793 + p.bobPh) * p.bobAmp * 0.6 * k;
  }
  return { x, y, s: q.s, a: q.a, al: q.al, f: q.f, k };
}

/** Saçılan parçacığın durumu: hangi döngü (n) ve saçılma (e), saçılma anı s0, yaş (0–1). */
export function emitState(p, t) {
  "worklet";
  const c = t / p.period + p.y0 - p.tlag;
  const n = Math.floor(c);
  const u = c - n;
  let local = u - p.w0 - p.eoff;
  if (p.loop) local -= Math.floor(local);
  if (local < 0) return { vis: 0, n, e: 0, s0: 0, age: 0 };
  const e = Math.floor(local / p.life);
  let s0 = p.w0 + p.eoff + e * p.life;
  if (!p.loop && s0 > p.w1) return { vis: 0, n, e, s0, age: 0 };
  if (p.loop) s0 -= Math.floor(s0);
  return { vis: 1, n, e, s0, age: local / p.life - e };
}

/** İp / halat (KIND.overlay, OVERLAY.tether): çapadan rotadaki gövdeye çizgi; pencere dışında a = 0. */
export function tetherFrame(p, t, width, height) {
  "worklet";
  const c = t / p.period + p.y0 - p.tlag;
  const n = Math.floor(c);
  const u = c - n;
  const anc = p.anc;
  for (let j = 0; j + 3 < anc.length; j += 4) {
    if (u >= anc[j] && u < anc[j + 1]) {
      const q = trackPoint(p, t, u, n, width, height);
      if (q.al <= 0.001) break;
      return { a: q.al, x1: anc[j + 2] * width, y1: anc[j + 3] * height, x2: q.x, y2: q.y };
    }
  }
  return { a: 0, x1: -100, y1: -100, x2: -100, y2: -100 };
}

/**
 * Parçacığın t anındaki duruşu, Atlas RSXform'una hazır: şekil dikdörtgeninin
 * MERKEZİ (x, y)'ye oturur, `angle` kadar döner, UZUN kenarı `size` dp olur.
 * Görünmeyen (döngü dışı) parçacık ekran dışına konur (GPU onu kırpar).
 * @returns {{scos:number, ssin:number, tx:number, ty:number, x:number, y:number}}
 */
export function particlePose(p, t, width, height) {
  "worklet";
  const TWO_PI = 6.283185307179586;
  let x = 0;
  let y = 0;
  let size = p.size;
  if (p.sizeMode === 1) size = p.size * height;
  else if (p.sizeMode === 2) size = p.size * (width > height ? width : height);
  else if (p.sizeMode === 3) size = p.size * width;
  let angle =
    p.rot0 +
    t * p.rotSpeed +
    (p.wobbleAmp ? Math.sin(t * p.wobbleFreq * TWO_PI + p.wobblePhase) * p.wobbleAmp : 0);
  const longSide = p.cw > p.ch ? p.cw : p.ch;

  if (p.kind === 0) {
    // fall (dir −1: yükselir)
    const marginY = size * 1.5;
    const travelY = height + marginY * 2;
    const progress = wrap01(p.y0 + (t * p.speed) / travelY);
    y = -marginY + progress * travelY;
    if (p.dir < 0) y = height - y;
    const marginX = size + p.swayAmp;
    const spanX = width + marginX * 2;
    const baseX = wrap01(p.x0 + (t * p.windX) / spanX) * spanX - marginX;
    x = baseX + (p.swayAmp ? Math.sin(t * p.swayFreq * TWO_PI + p.swayPhase) * p.swayAmp : 0);
  } else if (p.kind === 1) {
    // float: yerinde iki frekanslı Lissajous gezinmesi
    x =
      p.x0 * width +
      Math.sin(t * p.swayFreq * TWO_PI + p.swayPhase) * p.swayAmp +
      Math.sin(t * p.swayFreq * 1.7 * TWO_PI + p.pulsePhase) * p.swayAmp * 0.4;
    let baseY = p.y0 * height;
    if (p.seaBand) {
      const m = shoreMetrics(width, height);
      baseY = m.seaTop + (m.sandTop - m.seaTop) * p.y0;
    }
    y = baseY + Math.cos(t * p.driftFreqY * TWO_PI + p.wobblePhase) * p.driftAmpY;
  } else if (p.kind === 2) {
    // drift: yatay akar (sarar), dikeyde iki dalga
    const marginX = size;
    const spanX = width + marginX * 2;
    x = wrap01(p.x0 + (t * p.windX) / spanX) * spanX - marginX;
    y =
      p.y0 * height +
      Math.sin(t * p.swayFreq * TWO_PI + p.swayPhase) * p.swayAmp +
      Math.sin(t * p.driftFreqY * TWO_PI + p.wobblePhase) * p.driftAmpY;
  } else if (p.kind === 3) {
    // meteor: döngünün başında kısa bir çapraz geçiş, gerisi gizli
    const c = t / p.period + p.y0;
    const n = Math.floor(c);
    const ph = c - n;
    if (ph >= p.duty) {
      x = -10000;
      y = -10000;
    } else {
      const k = ph / p.duty;
      const sx = width * (0.25 + 0.85 * hash01(n, p.salt));
      const sy = height * (0.02 + 0.35 * hash01(n, p.salt + 1));
      const len = width * 0.75;
      const vx = -0.866 * len; // sola-aşağı, 30°
      const vy = 0.5 * len;
      x = sx + vx * k;
      y = sy + vy * k;
      angle = Math.atan2(vy, vx) - TWO_PI / 4; // çizginin ucu hareket yönünde
    }
  } else if (p.kind === 4) {
    // şimşek aydınlığı: pencerede ekranın ortasında (tam ekranı örter), değilse gizli
    const c = t / p.period + p.y0;
    if (c - Math.floor(c) >= p.duty) {
      x = -100000;
      y = -100000;
    } else {
      x = width / 2;
      y = height / 2;
      angle = 0;
    }
  } else if (p.kind === 5) {
    // burst: grup ortak merkez, kıvılcım kendi açısında; ağırlıkla hafif iner
    const c = t / p.period + p.y0;
    const n = Math.floor(c);
    const ph = c - n;
    if (ph >= p.duty) {
      x = -10000;
      y = -10000;
    } else {
      const k = ph / p.duty;
      const cx = width * (0.15 + 0.7 * hash01(n, p.salt));
      // patlama noktası ekranın üst yarısında (0.10–0.45 yükseklik)
      const cy = height * (0.1 + 0.35 * hash01(n, p.salt + 1));
      if (p.part === 1) {
        // roket + kuyruk: alttan yavaşlayarak yükselir; kuyruk parçaları geriden gelir
        const u = (k - p.lag * 0.022) / p.launch;
        if (u < 0 || u > 1) {
          x = -10000;
          y = -10000;
        } else {
          const e = 1 - (1 - u) * (1 - u);
          x = cx + Math.sin(u * 9 + p.salt) * 3 * (1 - u);
          y = height + 6 + (cy - height - 6) * e;
        }
      } else {
        const ks = (k - p.launch) / (1 - p.launch);
        if (ks < 0) {
          x = -10000;
          y = -10000;
        } else {
          const r = p.speed * easeOutCubic(ks);
          x = cx + Math.cos(p.rot0) * r;
          y = cy + Math.sin(p.rot0) * r + 55 * ks * ks;
        }
      }
    }
  } else if (p.kind === 8) {
    // anchor: taban (x0·W, alt kenar) sabit, şekil tabandan yukarı uzanır
    const half = size * 0.5;
    x = p.x0 * width + Math.sin(angle) * half;
    y = height + 2 - Math.cos(angle) * half;
  } else if (p.kind === 9) {
    // grow: her döngüde başka yerde büyüyen çiçek (0 sap, 1 baş)
    const c = t / p.period + p.y0;
    const n = Math.floor(c);
    const g = growthAt(c - n);
    const bx = width * (0.04 + 0.92 * hash01(n, p.salt));
    const lean = Math.sin(t * p.swayFreq * TWO_PI + p.swayPhase) * p.wobbleAmp * g;
    const stem = p.stemLen * g;
    if (p.part === 0) {
      size = stem;
      angle = lean;
      x = bx + Math.sin(lean) * stem * 0.5;
      y = height + 2 - Math.cos(lean) * stem * 0.5;
    } else {
      size = p.size * g;
      angle = lean + t * p.rotSpeed;
      x = bx + Math.sin(lean) * stem;
      y = height + 2 - Math.cos(lean) * stem;
    }
    if (g <= 0) {
      x = -10000;
      y = -10000;
    }
  } else if (p.kind === 16) {
    // orbit: Güneş (ya da ebeveyn) çevresinde elips; öndeki yarıda biraz büyük
    const ok = orbitScale(width);
    let ox = width * p.ocx;
    let oy = height * p.ocy; // varsayılan ORBIT_CENTER_Y
    if (p.parentR > 0) {
      const pa = p.parentPh + t * p.parentW;
      ox += Math.cos(pa) * p.parentR * ok;
      oy += Math.sin(pa) * p.parentR * ok * 0.5;
    }
    const oa = p.swayPhase + t * p.orbitW;
    const R = p.orbitR * ok * (p.orbitPulse ? 1 + p.orbitPulse * Math.sin(t * p.driftFreqY * TWO_PI + p.wobblePhase) : 1);
    x = ox + Math.cos(oa) * R;
    y = oy + Math.sin(oa) * R * (p.parentR > 0 ? 0.7 : p.oratio);
    size *= 1 + 0.1 * Math.sin(oa);
  } else if (p.kind === 14) {
    // glide: döngünün başında ekranı soldan sağa geçer (üst bölgede, hafif dalgalı), gerisi gizli
    const c = t / p.period + p.y0;
    const n = Math.floor(c);
    const ph = c - n;
    if (ph >= p.duty) {
      x = -10000;
      y = -10000;
    } else {
      const k = ph / p.duty;
      x = -size + k * (width + size * 2);
      y = height * (0.09 + 0.2 * hash01(n, p.salt)) + Math.sin(k * 6.2832 * 1.5) * 14;
      angle = Math.cos(k * 6.2832 * 1.5) * 0.08 - 0.04;
    }
  } else if (p.kind === 15) {
    // dangle: tavandan ip; boy yavaşça aşağı yukarı, ip hafif sallanır
    const bob = Math.sin(t * p.driftFreqY * TWO_PI + p.wobblePhase);
    const len = p.stemLen * (0.78 + 0.22 * bob);
    const lean = Math.sin(t * p.swayFreq * TWO_PI + p.swayPhase) * p.wobbleAmp;
    const ax = p.x0 * width;
    const sl = Math.sin(lean);
    const cl = Math.cos(lean);
    angle = lean;
    if (p.part === 0) {
      size = len;
      x = ax - sl * len * 0.5;
      y = -4 + cl * len * 0.5;
    } else {
      const half = size * 0.5;
      x = ax - sl * (len + half);
      y = -4 + cl * (len + half);
    }
  } else if (p.kind === 17) {
    // track: anahtar karelerle senaryolu rota; opaklık 0 iken ekran dışı
    const c = t / p.period + p.y0 - p.tlag;
    const n = Math.floor(c);
    const u = c - n;
    const q = trackPoint(p, t, u, n, width, height);
    if (q.al <= 0.001) {
      x = -10000;
      y = -10000;
    } else {
      x = q.x;
      y = q.y;
      size = p.size * q.s * q.k;
      angle += q.a;
      if (p.face) {
        const back = u > 0.996;
        const q2 = trackPoint(p, t, back ? u - 0.003 : u + 0.003, n, width, height);
        const dx = back ? x - q2.x : q2.x - x;
        const dy = back ? y - q2.y : q2.y - y;
        if (dx * dx + dy * dy > 0.0001) angle += Math.atan2(dy, dx);
      }
    }
  } else if (p.kind === 18) {
    // emit: saçılma anındaki rota noktasından yön × hız + yerçekimi; yaşla büyür
    const st = emitState(p, t);
    if (!st.vis) {
      x = -10000;
      y = -10000;
    } else {
      const ageSec = st.age * p.life * p.period;
      const q = trackPoint(p, t - ageSec, st.s0, st.n, width, height);
      const k = q.k;
      let dir = p.dirA;
      if (p.dirFace) {
        const q2 = trackPoint(p, t - ageSec, st.s0 + 0.003, st.n, width, height);
        dir += Math.atan2(q2.y - q.y, q2.x - q.x);
      }
      const h1 = hash01(st.n * 37 + st.e, p.esalt);
      const h2 = hash01(st.n * 37 + st.e, p.esalt + 7);
      dir += (h1 - 0.5) * p.spread;
      const sp = p.speedV * (0.75 + 0.5 * h2) * k;
      const g = p.grav * k;
      x = q.x + Math.cos(dir) * sp * ageSec;
      y = q.y + Math.sin(dir) * sp * ageSec + 0.5 * g * ageSec * ageSec;
      if (p.swayAmp) x += Math.sin(ageSec * p.swayFreq * TWO_PI + p.swayPhase + h1 * 6) * p.swayAmp * k;
      size = p.size * k * (1 + (p.grow - 1) * st.age);
      if (p.align) angle = Math.atan2(Math.sin(dir) * sp + g * ageSec, Math.cos(dir) * sp) - TWO_PI / 4;
    }
  } else if (p.kind === 11) {
    // band: geniş, yavaş dalgalanan aurora şeridi
    x = p.x0 * width + Math.sin(t * p.swayFreq * TWO_PI + p.swayPhase) * p.swayAmp;
    y = p.y0 * height + Math.sin(t * p.driftFreqY * TWO_PI + p.wobblePhase) * p.driftAmpY;
  } else {
    // tile / bolt / overlay: vektör katmanda çizilir (shoreLayerOffset /
    // boltStrike / overlayFrame);
    // Atlas'a gelirse görünmesin.
    x = -10000;
    y = -10000;
  }

  const scale = size / longSide;
  const scos = scale * Math.cos(angle);
  const ssin = scale * Math.sin(angle);
  const hw = p.cw / 2;
  const hh = p.ch / 2;
  return { scos, ssin, tx: x - scos * hw + ssin * hh, ty: y - ssin * hw - scos * hh, x, y };
}

/** Parçacığın t anındaki opaklığı (yanıp sönme, sönerek yükselme, döngü dışı 0). */
export function particleAlpha(p, t, height) {
  "worklet";
  const TWO_PI = 6.283185307179586;
  const PI = 3.141592653589793;
  let a = p.a;
  if (p.kind === 3 || p.kind === 4 || p.kind === 5 || p.kind === 12) {
    const c = t / p.period + p.y0;
    const ph = c - Math.floor(c);
    if (ph >= p.duty) return 0;
    const k = ph / p.duty;
    if (p.kind === 3) a *= Math.sin(k * PI); // belirir → söner
    else if (p.kind === 4) a *= 0.5 * bump(k, 0.16, 0.12) + bump(k, 0.6, 0.18); // çift çakma
    else if (p.kind === 5) {
      if (p.part === 1) {
        // roket izi: yükselirken görünür, kuyruk uca doğru sönük
        const u = (k - p.lag * 0.022) / p.launch;
        if (u < 0 || u > 1) return 0;
        a *= (1 - p.lag * 0.13) * (0.55 + 0.45 * u);
      } else {
        // kıvılcım: roket tepeye varınca patlar ve söner
        const ks = (k - p.launch) / (1 - p.launch);
        if (ks < 0) return 0;
        a *= (1 - ks) * (1 - ks * 0.4);
      }
    }
    else a *= k < 0.48 || k > 0.76 ? 0 : 1 - ((k - 0.48) / 0.28) * ((k - 0.48) / 0.28); // çizgi aydınlığın içinde söner
  } else if (p.kind === 14) {
    const c = t / p.period + p.y0;
    if (c - Math.floor(c) >= p.duty) return 0;
  } else if (p.kind === 17) {
    const c = t / p.period + p.y0 - p.tlag;
    const al = trackSample(p.kf, c - Math.floor(c)).al;
    if (al <= 0.001) return 0;
    a *= al > 1 ? 1 : al;
  } else if (p.kind === 18) {
    const st = emitState(p, t);
    if (!st.vis) return 0;
    a *= (st.age < 0.08 ? st.age / 0.08 : 1) * (1 - Math.pow(st.age, p.fadeK));
  } else if (p.kind === 9) {
    const c = t / p.period + p.y0;
    const k = c - Math.floor(c);
    if (k > 0.86) a *= Math.max(0, 1 - (k - 0.86) / 0.14);
  }
  if (p.fadeOut && p.kind === 0 && height > 0) {
    const marginY = p.size * 1.5;
    const progress = wrap01(p.y0 + (t * p.speed) / (height + marginY * 2));
    a *= 1 - progress * progress;
  }
  if (p.pulseFreq) {
    const s = 0.5 + 0.5 * Math.sin(t * p.pulseFreq * TWO_PI + p.pulsePhase);
    a *= p.pulseMin + (1 - p.pulseMin) * s * s;
  }
  return a;
}

/** Dokudaki şekil hücresi: kanat çırpanlar (kelebek, yarasa, martı) iki kare arasında. */
export function particleSprite(p, t) {
  "worklet";
  if (p.framed) {
    // track: kare anahtar kareden; flapFrom'dan itibaren kanat çırpar (ördek yüzer → uçar)
    const c = t / p.period + p.y0 - p.tlag;
    let f = trackSample(p.kf, c - Math.floor(c)).f;
    if (p.flapFreq && f >= p.flapFrom) f += Math.sin(t * p.flapFreq * 6.283185307179586 + p.swayPhase) > 0 ? 0 : 1;
    return p.sprite + f;
  }
  if (!p.flapFreq) return p.sprite;
  return Math.sin(t * p.flapFreq * 6.283185307179586 + p.swayPhase) > 0 ? p.sprite : p.sprite + 1;
}

/** Şekil hücresinin dokudaki sol üst köşesi (px) — ızgara, SPRITE_COLS sütun. */
export function spriteOrigin(sprite) {
  "worklet";
  const col = sprite % 8; // SPRITE_COLS
  return { x: col * 128, y: ((sprite - col) / 8) * 128 }; // SPRITE_CELL
}

// ── Tür ışık katmanları (worklet) ──────────────────────────────────────────

/**
 * Flaş yuvası (patlama ışığı, uzak çakma, paparazzi): her yuva kendi
 * döngüsünde, `duty` kadarında belirip söner; konum döngü numarasından.
 * @returns {{a:number, x:number, y:number}} a 0–1
 */
export function overlaySlot(p, t, i, width, height) {
  "worklet";
  const per = p.period * (1 + 0.29 * i);
  const c = t / per + p.y0 + i * 0.37;
  const n = Math.floor(c);
  const ph = c - n;
  let a = 0;
  if (ph < p.duty) {
    const k = ph / p.duty;
    if (k < p.rise) {
      const u = k / p.rise;
      a = u * u * (3 - 2 * u);
    } else {
      const u = 1 - (k - p.rise) / (1 - p.rise);
      a = u * u;
    }
  }
  const hx = hash01(n, p.salt + i * 17);
  const hy = hash01(n, p.salt + i * 17 + 5);
  return { a, x: width * (p.xr0 + (p.xr1 - p.xr0) * hx), y: height * (p.yr0 + (p.yr1 - p.yr0) * hy) };
}

/**
 * Işık katmanının t anı: a = opaklık katsayısı (0–1), x/y konum, r türüne
 * göre dönüş (gezegen, spot) ya da ikinci kanal (neon karışımı, REC noktası).
 */
export function overlayFrame(p, t, width, height) {
  "worklet";
  const TWO_PI = 6.283185307179586;
  const type = p.part;
  let a = 1;
  let x = 0;
  let y = 0;
  let r = 0;
  if (type === 0) {
    const s = overlaySlot(p, t, 0, width, height);
    a = s.a;
    x = s.x;
    y = height;
  } else if (type === 1) {
    const R = p.size * width;
    const span = width + R * 5;
    x = wrap01(p.x0 + t / p.period) * span - R * 2.5;
    y = height * p.yr0 + Math.sin(t * 0.04 * TWO_PI + p.swayPhase) * 8;
    r = -0.38 + Math.sin(t * 0.02 * TWO_PI) * 0.04;
  } else if (type === 2) {
    // lub-dub: iki yumuşak vuruş, sonra dinlenme
    const k = wrap01(t / p.period + p.y0);
    const v = bump(k, 0.1, 0.09) + 0.65 * bump(k, 0.3, 0.09);
    a = 0.3 + 0.7 * (v > 1 ? 1 : v);
  } else if (type === 3) {
    const span = width * 2.6;
    x = wrap01(p.x0 + (t * p.speed) / span) * span - width * 0.8;
    y = height * p.yr0 + Math.sin(t * 0.05 * TWO_PI + p.swayPhase) * 10;
  } else if (type === 4) {
    // tavan lambası: hafif uğultu; döngü başında iki kısa sönme
    const ph = wrap01(t / p.period + p.y0);
    a = 0.9 + 0.1 * Math.sin(t * 0.5 * TWO_PI);
    if (ph < 0.09) a *= 1 - 0.7 * (bump(ph, 0.02, 0.014) + bump(ph, 0.06, 0.018));
  } else if (type === 5) {
    x = width * (0.5 + 0.33 * Math.sin(t * p.swayFreq * TWO_PI + p.swayPhase));
    y = height * (0.45 + 0.3 * Math.sin(t * p.driftFreqY * TWO_PI + p.wobblePhase));
  } else if (type === 6) {
    y = Math.sin(t * 0.03 * TWO_PI + p.swayPhase) * 14;
    a = 0.85 + 0.15 * Math.sin(t * 0.07 * TWO_PI);
  } else if (type === 7) {
    r = 0.5 + 0.5 * Math.sin(t * 0.06 * TWO_PI + p.swayPhase);
    a = 0.8 + 0.2 * Math.sin(t * 0.35 * TWO_PI);
    const ph = wrap01(t / p.period + p.y0);
    if (ph < 0.05) a *= 1 - 0.55 * bump(ph, 0.025, 0.02);
  } else if (type === 8) {
    const s = Math.sin(t * 0.08 * TWO_PI + p.swayPhase);
    a = 0.6 + 0.4 * s * s;
  } else if (type === 10) {
    a = 0.72 + 0.12 * Math.sin(t * 1.7 * TWO_PI) + 0.09 * Math.sin(t * 2.9 * TWO_PI + 1) + 0.07 * Math.sin(t * 5.3 * TWO_PI + 2);
  } else if (type === 11) {
    // REC noktası: 1,6 sn'de bir yumuşak yanıp söner (r = nokta opaklığı)
    const k = wrap01(t / 1.6);
    if (k < 0.55) r = 1;
    else if (k < 0.65) r = 1 - ((k - 0.55) / 0.1) * 0.85;
    else if (k > 0.9) r = 0.15 + ((k - 0.9) / 0.1) * 0.85;
    else r = 0.15;
  } else if (type === 14) {
    r = Math.sin(t * p.swayFreq * TWO_PI + p.swayPhase) * 0.42;
  } else if (type === 21 || type === 23 || type === 30) {
    // mordor (göz bakışı), hapishane projektörü, Gotham projektörü: hüzme açısı r, a nabız
    r = p.rot0 + Math.sin(t * p.swayFreq * TWO_PI + p.swayPhase) * p.swayAmp;
    const s = Math.sin(t * 0.21 * TWO_PI + p.pulsePhase);
    a = 0.78 + 0.22 * s * s;
  } else if (type === 25) {
    // havuz: dalgacık kayması (x) ve yüzey parıltısı (a)
    x = wrap01(t * 0.035 + p.y0);
    a = 0.85 + 0.15 * Math.sin(t * 0.3 * TWO_PI);
  } else if (type === 20 || type === 19) {
    // şehir: anten ışığı yumuşak yanıp söner (r 0–1)
    const k = wrap01(t / 2.4 + p.y0);
    r = k < 0.5 ? Math.sin(k * 2 * 3.141592653589793) : 0;
  }
  return { a, x, y, r };
}

/**
 * Kendini çizen çember/plan (dönüşüm çemberi, kaçış planı): draw = çizgi payı
 * (0–1, yol kırpma), glow = parlama (0–1, yumuşak), a = katman opaklığı.
 * Döngü: çizilir (0–0,35) → parlar (0,35–0,55) → söner (0,55–0,7) → boş.
 */
export function drawCycle(p, t) {
  "worklet";
  const u = restU(p, t);
  let draw = 1;
  let glow = 0;
  let a = 1;
  if (u < 0.35) {
    const k = u / 0.35;
    draw = k * k * (3 - 2 * k);
  } else if (u < 0.55) {
    glow = bump(u, 0.45, 0.1);
  } else if (u < 0.7) {
    a = 1 - (u - 0.55) / 0.15;
  } else {
    a = 0;
  }
  return { draw, glow, a, u };
}

const smooth01 = (a, b, x) => {
  "worklet";
  const v = (x - a) / (b - a);
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c * c * (3 - 2 * c);
};

/**
 * Game of Thrones duvarı (24 sn, ejderha turuyla aynı saat): ateş duvarı ısıtır
 * (heat), sütunlar çöker (fall), moloz birikir (rubble), toz kalkar (dust);
 * u ≥ 0,88'de duvar yeniden belirir (vis). Hiçbir değer çakmaz: hepsi yumuşak.
 */
export function wallFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  const heat = smooth01(0.3, 0.5, u) * (1 - smooth01(0.62, 0.8, u));
  const live = u < 0.88;
  const fall = live ? smooth01(0.5, 0.78, u) : 0;
  const vis = live ? 1 : smooth01(0.88, 0.98, u);
  const rubble = live ? smooth01(0.56, 0.8, u) : 1 - smooth01(0.9, 0.99, u);
  const dustK = (u - 0.52) / 0.36;
  const dust = dustK > 0 && dustK < 1 ? Math.sin(dustK * 3.141592653589793) : 0;
  const fl = 0.9 + 0.1 * Math.sin(t * 4.1);
  return { u, heat, fall, vis, rubble, dust, fl };
}

/**
 * Viking baskını (30 sn, vikScene ile aynı saat): gemiler yaklaşır (0–0,22),
 * ok yağdırır (0,22–0,55), kale tutuşur (burn) ve gemiler çekilince söner.
 * Hepsi yumuşak geçiş; yanıp sönme yok (fl yavaş ve ±%8).
 */
export function riverFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  const burn = smooth01(0.3, 0.46, u) * (1 - smooth01(0.84, 0.98, u));
  const fl = 0.92 + 0.05 * Math.sin(t * 3.3) + 0.03 * Math.sin(t * 5.9 + 1);
  return { u, burn, fl, slide: wrap01(t * 0.03) };
}

/**
 * Star Wars Ölüm Yıldızı + Falcon perdesi (60 sn, swScene olay döngüsüyle aynı saat): ds = Ölüm Yıldızı opaklığı,
 * slide = giriş/çıkış kayması, planet = gezegen opaklığı, charge = dişli şarjı, grow/beam = ışın
 * uzaması ve opaklığı, impact = çarpma parlaması ve çatlaklar, b/blast = patlama ilerlemesi.
 * Tümü yumuşak: tek parlama, çakma yok.
 */
export function swFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  const dsIn = smooth01(0.31, 0.37, u);
  const dsOut = smooth01(0.6, 0.665, u);
  const ds = dsIn * (1 - dsOut);
  const slide = 1 - dsIn + dsOut * 0.5;
  const planet = u < 0.52 ? smooth01(0.33, 0.37, u) : 0;
  const charge = smooth01(0.42, 0.5, u) * (1 - smooth01(0.52, 0.56, u));
  const grow = u >= 0.5 ? smooth01(0.5, 0.506, u) : 0;
  const beam = grow * (1 - smooth01(0.522, 0.536, u));
  const impact = u < 0.52 ? smooth01(0.506, 0.52, u) : 0;
  const bb = (u - 0.52) / 0.1;
  const blast = u >= 0.52 && bb < 1;
  // Millennium Falcon: alttan ekran ortasına doğru yavaş yükselir, hiperuzayda bekler, sonra
  // sıçrar: perspektifle ekranın merkezine (0,5 / 0,4) doğru küçülerek yok olur (ekran oranı).
  let fy = 2;
  let fs = 1;
  if (u >= 0.69 && u < 0.932) {
    if (u < 0.8) fy = 1.5 + (0.58 - 1.5) * smooth01(0.69, 0.8, u);
    else if (u < 0.9) fy = 0.58 - 0.02 * ((u - 0.8) / 0.1);
    else {
      const tau = (u - 0.9) / 0.032;
      fy = 0.56 - 0.16 * tau * tau;
      fs = 1 / (1 + 14 * tau * tau);
    }
  }
  return { u, ds, slide, planet, charge, grow, beam, impact, b: blast ? bb : 0, blast, fy, fs, fv: fy < 1.9 ? 1 : 0 };
}

/** Dune (40 sn): head = solucanın yay üzerindeki başı (−1: yer altında), shake = zemin titreşimi (0–1). */
export function duneFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  const head = u >= 0.3 && u <= 0.66 ? -0.12 + (1.74 * (u - 0.3)) / 0.36 : -1;
  const shake = smooth01(0.18, 0.3, u) * (1 - smooth01(0.62, 0.74, u));
  return { u, head, shake };
}

/** Rick and Morty portalı (30 sn): open = açıklık (0–1), yumuşak açılıp kapanır. */
export function rmFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  return { u, open: smooth01(0.08, 0.16, u) * (1 - smooth01(0.5, 0.58, u)) };
}

/** Simya şimşeği yuvası i: yalnız parlama penceresinde, kısa (≤ 2,5 çakma/sn toplam). */
export function sparkSlot(p, t, i) {
  "worklet";
  const u = restU(p, t);
  if (u < 0.33 || u > 0.58) return { a: 0, n: 0 };
  const per = 1.25 + 0.17 * i;
  const c = t / per + i * 0.41;
  const n = Math.floor(c);
  const ph = c - n;
  if (ph > 0.22) return { a: 0, n };
  const k = ph / 0.22;
  return { a: k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7, n };
}

/** Ekolayzer çubuğunun boyu (0–1): kendi dalgası + ortak vuruş (~96 bpm). */
export function equalizerLevel(p, t, i) {
  "worklet";
  const TWO_PI = 6.283185307179586;
  const beat = wrap01(t * 1.6 + p.y0);
  const pulse = (1 - beat) * (1 - beat) * (1 - beat);
  const wave = 0.5 + 0.5 * Math.sin(t * (0.55 + 0.11 * (i % 7)) * TWO_PI + i * 1.37 + p.swayPhase);
  const v = 0.12 + 0.5 * wave + 0.38 * pulse * (0.4 + 0.6 * hash01(i, p.salt));
  return v > 1 ? 1 : v;
}

/** Sıcak hava çizgisi i (0–3): yükselir (dy < 0), ortada belirgin, yana salınır. */
export function hazeLine(p, t, i) {
  "worklet";
  const k = wrap01(t / p.period + i / 4 + p.y0);
  return { dy: -k * 46, a: Math.sin(k * 3.141592653589793), dx: Math.sin(t * 0.3 * 6.283185307179586 + i) * 12 };
}

// Işık katmanı renkleri: koyu zeminde ışık, açık zeminde doygun/koyu ton.
// alpha = katmanın tavan opaklığı (overlayFrame.a ile çarpılır).
const OVERLAY_TONES = Object.freeze({
  0: { dark: ["#ff7a1a"], light: ["#ff6a00"], alpha: [0.38, 0.3] },
  1: { dark: ["#c9b8ff", "#5b4bb3", "#e6dcff"], light: ["#9a86f0", "#4a3aa0", "#6a58c8"], alpha: [0.55, 0.45] },
  2: { dark: ["#5a0010"], light: ["#b3132b"], alpha: [0.55, 0.22] },
  3: { dark: ["#c9ced6"], light: ["#8f96a3"], alpha: [0.16, 0.14] },
  4: { dark: ["#ffd59a"], light: ["#ffb347"], alpha: [0.16, 0.14] },
  5: { dark: ["#fff2cc"], light: ["#ffcf66"], alpha: [0.16, 0.16] },
  6: { dark: ["#dfe8ff"], light: ["#1d2433"], alpha: [0.06, 0.06] },
  7: { dark: ["#ff3ea5", "#22d3ee"], light: ["#e11d74", "#0891b2"], alpha: [0.3, 0.2] },
  8: { dark: ["#ff6b8a", "#ffb38a"], light: ["#ff4d79", "#ff9466"], alpha: [0.22, 0.16] },
  9: { dark: ["#a78bfa", "#f472b6", "#38bdf8"], light: ["#7c3aed", "#db2777", "#0284c7"], alpha: [0.35, 0.3] },
  10: { dark: ["#ffb347"], light: ["#f59e0b"], alpha: [0.2, 0.16] },
  11: { dark: ["#ffffff", "#ff3b30"], light: ["#1f2937", "#e11d48"], alpha: [0.5, 0.45] },
  12: { dark: ["#ffb066"], light: ["#ff8a1f"], alpha: [0.3, 0.22] },
  13: { dark: ["#ffe2b0"], light: ["#b07a2a"], alpha: [0.12, 0.12] },
  14: { dark: ["#fff6d8"], light: ["#ffc94d"], alpha: [0.13, 0.14] },
  15: { dark: ["#ffffff", "#dbeafe"], light: ["#fef3c7", "#f59e0b"], alpha: [0.7, 0.55] },
  16: { dark: ["#a9b8ff"], light: ["#4a5a99"], alpha: [0.2, 0.26] },
  // evrenler: [ana, ikinci, vurgu…] — silüetler düşük opaklık (içerik önde okunur)
  17: { dark: ["#cfe8ff", "#4f86bd", "#ffffff", "#20262f", "#59b8ff"], light: ["#9cc7ea", "#4a7fae", "#e8f4ff", "#3a4552", "#2f8fe6"], alpha: [0.5, 0.55] },
  18: { dark: ["#c79a5b", "#a87a40", "#e0b878", "#f2e6d0", "#7a6a58", "#ff9a3c"], light: ["#e2b877", "#c9954f", "#f0cf96", "#8a7a66", "#8a6a48", "#e8590c"], alpha: [0.38, 0.5] },
  19: { dark: ["#2a2f3d", "#3b4254", "#ffd88a"], light: ["#2b3140", "#3f4759", "#f2b84b"], alpha: [0.75, 0.32] },
  20: { dark: ["#323a4f", "#46506a", "#ff5a5a", "#ffe08a"], light: ["#5b6680", "#7884a0", "#e03b3b", "#e8b33a"], alpha: [0.62, 0.3] },
  21: { dark: ["#26161a", "#3a1d1d", "#ff7a1a", "#ffd166"], light: ["#3a2424", "#5a2e2a", "#ff6a00", "#ffb703"], alpha: [0.78, 0.45] },
  22: { dark: ["#a8573a", "#c9703f", "#7a3c2a"], light: ["#d98a5c", "#e8a77a", "#b86a45"], alpha: [0.4, 0.42] },
  23: { dark: ["#8a93a3", "#5d6575", "#fff6d8", "#2a2f39"], light: ["#4b5262", "#6b7384", "#ffd36b", "#2a2f39"], alpha: [0.55, 0.4] },
  24: { dark: ["#2c3240", "#3d4556", "#ffe2a0"], light: ["#3a4150", "#525b6e", "#f0b84a"], alpha: [0.72, 0.3] },
  25: { dark: ["#3fa7d6", "#1f6f9f", "#bfe9ff", "#2f4a35"], light: ["#5cc0ea", "#2b8fc4", "#ffffff", "#3f6b47"], alpha: [0.5, 0.5] },
  26: { dark: ["#4a4f5a", "#3a3e47", "#6a707c", "#2b2e35"], light: ["#9aa0a8", "#868c95", "#b4b9c0", "#6e737b"], alpha: [0.92, 0.85] },
  27: { dark: ["#7fd3ff", "#3aa0ff", "#e6f7ff"], light: ["#1f7fd6", "#0b5fb3", "#4aa8ff"], alpha: [0.6, 0.55] },
  28: { dark: ["#8fc4ff", "#ff6b6b"], light: ["#2b6cb0", "#d64545"], alpha: [0.38, 0.4] },
  29: { dark: ["#f2f4f8", "#c9ced8", "#d9b45a", "#5dff7a", "#eaffe9"], light: ["#5f6675", "#7a8090", "#a8822a", "#1a9a38", "#b8f0c4"], alpha: [0.8, 0.75] },
  30: { dark: ["#eef4ff"], light: ["#ffe9a8"], alpha: [0.2, 0.26] },
  // starWars Ölüm Yıldızı perdesi: [deniz, kara, ışın, ateş, Ölüm Yıldızı ışığı]
  32: { dark: ["#4a9ae0", "#4f9a4a", "#5dff7a", "#ff9a3c", "#cfd5dc", ["#f2f4f6", "#c5cbd2", "#858d97"]], light: ["#2b78c2", "#3f8a3a", "#1a9a38", "#e8590c", "#8a929c", ["#e9ecef", "#aab2bc", "#6d7580"]], alpha: [0.95, 0.9] },
  // Harry Potter: [şato, tepe, pencere ışığı, göl, ay]
  33: { dark: ["#161d33", "#0f1a2c", "#ffd98a", "#0b1626", "#dfe8ff"], light: ["#3a4560", "#4b5a78", "#f2b84b", "#5b7fa8", "#fff3c4"], alpha: [0.88, 0.75] },
  34: { dark: ["#ffffff"], light: ["#ffffff"], alpha: [0.95, 0.9] },
  35: { dark: ["#7dff8a"], light: ["#1c9e2a"], alpha: [0.95, 0.9] },
  // vikings: [nehir, derin su, parıltı, orman, ahşap, ateş]
  31: { dark: ["#2d5a7a", "#102a42", "#bfe3f5", "#0d1c2a", "#5a3a1e", "#ff8a2a"], light: ["#5b9bc4", "#2a5f86", "#ffffff", "#2f4a3a", "#7a5230", "#ff7a1a"], alpha: [0.8, 0.7] },
});

/** Işık katmanı türünün renkleri ve tavan opaklığı. */
export function overlayStyle(type, lightSurface) {
  const t = OVERLAY_TONES[type] || OVERLAY_TONES[0];
  return { colors: lightSurface ? t.light : t.dark, alpha: t.alpha[lightSurface ? 1 : 0] };
}

// ── Vektör katmanlar ────────────────────────────────────────────────────────
// Şimşek ve kıyı ekranda yüzlerce dp boyunda çizilir: 64 px'lik doku
// hücresinden büyütülünce bulanık ve kalın görünüyordu. Bunlar Skia yolu
// olarak (components/decor/VectorLayers.js) bir kez kurulur; kare başına
// yalnız konum/opaklık değişir.

const TWO_PI_JS = Math.PI * 2;

// Dalga katmanları (0 ufuk → 2 ön). n: ekran genişliğindeki tepe sayısı (tam
// sayı → dikişsiz sarma), a: genlik (× k), q: tepe sivriliği (0 sinüs, <1
// trokoid: sivri tepe, yayvan çukur), m/a2: üstteki küçük dalgacık.
const SHORE_WAVES = Object.freeze([
  { n: 4, a: 2.2, q: 0.5, m: 9, a2: 0.6, phase: 0.4 },
  { n: 3, a: 3.4, q: 0.62, m: 7, a2: 0.9, phase: 1.9 },
  { n: 2, a: 4.8, q: 0.72, m: 5, a2: 1.2, phase: 3.1 },
]);

const mixHex = (a, b, t) => {
  const ca = hexToUnitRgb(a);
  const cb = hexToUnitRgb(b);
  const ch = (i) => Math.round((ca[i] + (cb[i] - ca[i]) * t) * 255).toString(16).padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
};

const SEA_TONES = Object.freeze({
  // koyu zemin: ufuk puslu, kıyıya doğru turkuaz
  dark: [
    { top: "#3c86b8", deep: "#173f63", alpha: 0.6, foam: 0.4, foamW: 0.9 },
    { top: "#3597c9", deep: "#164e7a", alpha: 0.8, foam: 0.58, foamW: 1.2 },
    { top: "#3fb9d2", deep: "#17648c", alpha: 0.93, foam: 0.85, foamW: 1.6 },
  ],
  // açık zemin: daha doygun, beyaz zeminde seçilsin
  light: [
    { top: "#5aa7d8", deep: "#2a6d9f", alpha: 0.62, foam: 0.5, foamW: 0.9 },
    { top: "#3f93c9", deep: "#1f5f92", alpha: 0.82, foam: 0.7, foamW: 1.2 },
    { top: "#2aaac4", deep: "#196a91", alpha: 0.94, foam: 0.95, foamW: 1.6 },
  ],
});
const SAND_TONES = Object.freeze({
  dark: { wet: "#a98550", top: "#e3c48a", bottom: "#c29d63", grainDark: "#8f6d3c", grainLight: "#fff1d2" },
  light: { wet: "#bf9658", top: "#efd39e", bottom: "#d6ae6d", grainDark: "#a07c45", grainLight: "#fffaf0" },
});

/** Kıyı renkleri (tema tonuna göre): deniz katmanları, köpük, kum. */
export function shoreStyle(lightSurface) {
  const tone = lightSurface ? "light" : "dark";
  return {
    sea: SEA_TONES[tone].map((l) => ({ ...l, crest: mixHex(l.top, "#ffffff", 0.35) })),
    foam: lightSurface ? "#ffffff" : "#effaff",
    sand: SAND_TONES[tone],
  };
}

function sandEdgeY(x, width, m) {
  const u = (x / width) * TWO_PI_JS;
  return (
    m.sandTop +
    m.k * (2.2 * Math.sin(u + 0.7) + 1.1 * Math.sin(u * 2.6 + 2.1) + 0.6 * Math.sin(u * 5.3 + 0.3)) +
    m.k * 3 * (x / width - 0.5)
  );
}

/**
 * Kıyının yolları (dp, JS'te bir kez): her dalga katmanının tepe çizgisi
 * x ∈ [0, 2W] (yatay kaydırılıp W'de sarar — iki uç aynı yükseklik ve
 * eğimde), kumun üst kenarı ve kum taneleri. Saf veri; yolu bileşen kurar.
 */
export function shoreGeometry(width, height, seed = 1) {
  const m = shoreMetrics(width, height);
  const W = Math.max(1, width);
  const layers = SHORE_WAVES.map((wv, li) => {
    const lambda = W / wv.n;
    const a = wv.a * m.k;
    const a2 = wv.a2 * m.k;
    const base = m.bases[li];
    const steps = wv.n * 2 * 28;
    const crest = new Array(steps + 1);
    for (let i = 0; i <= steps; i += 1) {
      const th = (i / steps) * TWO_PI_JS * wv.n * 2;
      // trokoid: tepede x sıkışır → sivri tepe (q < 1: x hep artar, yol kendini kesmez)
      const x = (th * lambda) / TWO_PI_JS - ((wv.q * lambda) / TWO_PI_JS) * Math.sin(th);
      const y = base - a * Math.cos(th) + a2 * Math.sin((x / W) * TWO_PI_JS * wv.m + wv.phase);
      crest[i] = [x, y];
    }
    return { crest, top: base - a - a2, base };
  });
  const sandEdge = [];
  for (let x = -6; x <= W + 6; x += 6) sandEdge.push([x, sandEdgeY(x, W, m)]);
  const rand = seededRandom(deriveSeed(0x5a4d, seed));
  const grainCount = Math.round((W * 36 * m.k) / 110);
  const grains = new Array(grainCount);
  for (let i = 0; i < grainCount; i += 1) {
    const x = rand() * W;
    const top = sandEdgeY(x, W, m) + 5 * m.k;
    const y = top + rand() * Math.max(1, height - top);
    grains[i] = [x, y, lerp(0.45, 1.05, rand()) * m.k, rand() < 0.62 ? 0 : 1];
  }
  return { metrics: m, layers, sandEdge, grains, sandMin: m.sandTop - 6 * m.k };
}

/** Dalga katmanının t anındaki kayması: dx ∈ [−W, 0) (2W'lik yol ekranı hep örter). */
export function shoreLayerOffset(p, t, width, k) {
  "worklet";
  const u = p.x0 + (t * p.windX) / Math.max(1, width);
  return {
    dx: (u - Math.floor(u)) * width - width,
    dy: Math.sin(t * p.swayFreq * 6.283185307179586 + p.swayPhase) * p.swayAmp * k,
  };
}

/** Kumdaki köpük: kıyıya yayılır (aşağı iner, söner), geri çekilir. */
export function swashAt(p, t, k) {
  "worklet";
  const s = 0.5 - 0.5 * Math.cos((t / p.period) * 6.283185307179586 + p.swayPhase);
  return { dy: s * 7 * k, opacity: 0.85 - 0.6 * s };
}

// ── Şimşek ──

const BOLT_TONES = Object.freeze({
  dark: { core: "#ffffff", glow: "#c4d8ff", halo: "#7f9dff" },
  light: { core: "#ffffff", glow: "#35587c", halo: "#2a4a6e" },
});
/** Şimşek renkleri: çekirdek + iç parıltı + dış hale. */
export const boltStyle = (lightSurface) => BOLT_TONES[lightSurface ? "light" : "dark"];

// Orta nokta kaydırma: her seviyede her parça ortadan, parçaya dik yönde
// (± rough × uzunluk) kırılır → doğal, kendine benzer zikzak.
function displace(a, b, depth, rough, rand) {
  let pts = [a, b];
  for (let level = 0; level < depth; level += 1) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i += 1) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const off = (rand() * 2 - 1) * rough;
      next.push([(x0 + x1) / 2 - (y1 - y0) * off, (y0 + y1) / 2 + (x1 - x0) * off]);
      next.push(pts[i]);
    }
    pts = next;
  }
  return pts;
}

// Çizgiyi uca doğru incelen dolu şeride çevirir (sol kenar + ters sağ kenar).
function taper(pts, w0, w1) {
  const n = pts.length;
  const acc = [0];
  for (let i = 1; i < n; i += 1) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acc[n - 1] || 1;
  const left = [];
  const right = [];
  for (let i = 0; i < n; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    const half = (w0 + (w1 - w0) * (acc[i] / total)) / 2;
    const nx = (-ty / len) * half;
    const ny = (tx / len) * half;
    left.push([pts[i][0] + nx, pts[i][1] + ny]);
    right.push([pts[i][0] - nx, pts[i][1] - ny]);
  }
  return left.concat(right.reverse());
}

/**
 * Bir şimşek biçimi (dp, tepe (0,0), aşağı uzanır): ana kanal + 2–4 dal
 * (bazısında alt dal). Her parçanın `spine`ı (parıltı çizgisi) ve uca doğru
 * incelen `outline`ı (çekirdek, 2,3 → 0,5 dp) var. Aynı tohum → aynı biçim.
 */
export function buildBoltShape(seed, length, k = 1) {
  const rand = seededRandom(deriveSeed(0xb017, seed));
  const L = Math.max(20, length);
  const trunk = displace([0, 0], [lerp(-0.16, 0.16, rand()) * L, L], 6, 0.3, rand);
  const w0 = 2.3 * k;
  const w1 = 0.5 * k;
  const pieces = [{ spine: trunk, w0, w1, main: true }];
  const branches = 2 + Math.floor(rand() * 3);
  for (let b = 0; b < branches; b += 1) {
    const f = lerp(0.16, 0.66, rand());
    const i = Math.max(1, Math.min(trunk.length - 2, Math.round(f * (trunk.length - 1))));
    const [ax, ay] = trunk[i];
    const dir = Math.atan2(trunk[i + 1][1] - trunk[i - 1][1], trunk[i + 1][0] - trunk[i - 1][0]);
    const ang = dir + (b % 2 ? 1 : -1) * lerp(0.38, 0.85, rand());
    const len = L * lerp(0.15, 0.34, rand()) * (1 - f * 0.55);
    const spine = displace([ax, ay], [ax + Math.cos(ang) * len, ay + Math.sin(ang) * len], 4, 0.3, rand);
    const bw = (w0 + (w1 - w0) * f) * 0.6;
    pieces.push({ spine, w0: bw, w1: 0.22 * k, main: false });
    if (rand() < 0.5) {
      const j = Math.floor(spine.length * lerp(0.3, 0.6, rand()));
      const [sx, sy] = spine[j];
      const sang = ang + (rand() < 0.5 ? -1 : 1) * lerp(0.3, 0.7, rand());
      const slen = len * lerp(0.3, 0.5, rand());
      pieces.push({
        spine: displace([sx, sy], [sx + Math.cos(sang) * slen, sy + Math.sin(sang) * slen], 3, 0.3, rand),
        w0: bw * 0.6,
        w1: 0.18 * k,
        main: false,
      });
    }
  }
  return pieces.map((p) => ({ ...p, outline: taper(p.spine, p.w0, p.w1) }));
}

/** Çakma anındaki şimşek: biçim (0..BOLT_VARIANTS−1), tepe x'i, eğim, ayna, opaklık. */
export function boltStrike(p, t, width) {
  "worklet";
  const c = t / p.period + p.y0;
  const n = Math.floor(c);
  return {
    variant: Math.floor(hash01(n, p.salt + 3) * 4) % 4, // BOLT_VARIANTS
    x: width * (0.15 + 0.7 * hash01(n, p.salt)),
    angle: (hash01(n, p.salt + 2) - 0.5) * 0.24,
    flip: hash01(n, p.salt + 4) < 0.5 ? -1 : 1,
    alpha: particleAlpha(p, t, 0),
  };
}
