// utils/weatherParticles.js
//
// "Atmosfer" parçacık katmanının SAF mantığı. RN/Skia importu YOK (jest yalnız
// saf modülleri test ediyor); çizim components/decor/ParticleField.js,
// şekiller components/decor/particleSprites.js.
//
// SEÇİLEBİLEN EFEKTLER (WEATHER_GROUPS)
// Seçicide grup başına en çok 6 simge (tek satıra sığsın):
//   mevsimler      mevsime göre, kar, bahar bahçesi, yaz kıyısı, yaprak
//   gökyüzü/ışık   yağmur, fırtına, aurora, yıldız tozu, kıvılcım, güneş sistemi
//   Bu iki grubun her efekti parçacıkların yanında TEK bir vektör sahneyle çizilir (12 Kas):
//   karlı dağ + kulübe + tilki, kiraz ağaçlı çayır + gökkuşağı, ufuk denizi + palmiye + yunus,
//   büyük ağaç + yaprak girdabı, ıslak şehir + şemsiyeli yaya, aurora perdeleri + göl, Samanyolu +
//   takımyıldız, kamp ateşi, güneş sistemi (components/decor/*Scene.js; EFFECT_SCENE, COMPOSITES).
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
export const WEATHER_GROUP_MAX = 15; // 12 Kas: evren grupları 15 + 9 + 10 (satır yatay kayar)

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
  iceWall: 17, dunes: 18, gotham: 19, skyline: 20, mordor: 21, mesa: 22, prison: 23,
  titanWall: 26, skyBeam: 30, river: 31, swPlanet: 32, hogwarts: 33, opShip: 34, rmPortal: 35, matrixCity: 36,
  // mevsim / gökyüzü sahneleri (components/decor/*Scene.js; seçilen efektin arkasında/önünde)
  winterScene: 37, springScene: 38, summerSky: 39, summerBeach: 40, autumnScene: 41, rainScene: 42,
  stormScene: 43, auroraScene: 44, starScene: 45, campfireScene: 46,
  // özel gün sahneleri
  fireworksScene: 47, halloweenScene: 48, christmasScene: 49,
  // evren vektör sahneleri (components/decor/<ad>Scene.js; olay saati SEASON_EVENT)
  sherVec: 50, dnVec: 51, opSky: 52, narVec: 53, fmaVec: 54, isVec: 55, stVec: 56, dsVec: 57, brVec: 58, ghVec: 59, tlVec: 60, jpVec: 61, avVec: 62, mmVec: 63, pcVec: 64, inVec: 65, tiVec: 66, dkVec: 67, sqVec: 68, hxVec: 69, jjVec: 70,
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
  orbits: 16, // güneş sistemi: TÜM sahne vektör (Güneş, gezegenler, kuşak, kara delik, pulsar, kuyruklu yıldız; solarFrame, components/decor/solarScene.js)
  // evren sahneleri (utils/weatherUniverses.js)
  iceWall: 17, // Game of Thrones: buz duvarı + Kara Kale kuleleri
  dunes: 18, // Dune: kum tepeleri + iki ay
  gotham: 19, // Batman: Gotham + yarasa işareti + süzülüş (batFrame, components/decor/batScene.js)
  skyline: 20, // Spider-Man: şehir + su kulesi + ağ salınımı (spiderFrame, components/decor/spiderScene.js)
  mordor: 21, // Yüzüklerin Efendisi: Mordor + Göz + Hüküm Dağı + kartallar (lotrFrame, components/decor/lotrScene.js)
  mesa: 22, // Breaking Bad: çöl masaları
  prison: 23, // Prison Break: tel örgü + dikenli tel + kule projektörü
  titanWall: 26, // Attack on Titan: payandalı duvar, kapı, su kapısı + kanal, şehir; dev yükselir ve kapıyı tekmeler (aotFrame)
  tether: 29, // ip / halat / zincir: bir rotadaki gövdeyi pencerelerdeki çapaya bağlar
  skyBeam: 30, // Batman: şehirden göğe uzanan, bulutları tarayan projektör
  river: 31, // Vikings: nehir, kıyı ormanı, kuşatılan kale (yanar)
  swPlanet: 32, // Star Wars: Ölüm Yıldızı, gezegen, süperlazer ışını ve patlama (vektör)
  hogwarts: 33, // Harry Potter: Hogwarts + Kara Göl + Ruh Emiciler + Patronus (hpFrame, components/decor/hpScene.js)
  opShip: 34, // One Piece: aslan başlı yelkenli (vektör, 44 sn)
  rmPortal: 35, // Rick and Morty: yeşil portal (30 sn)
  matrixCity: 36, // Matrix: yeşil şehir + çatı, mermi zamanı (matrixFrame, components/decor/matrixScene.js)
  // mevsim / gökyüzü sahneleri (olay saati restU; çizim components/decor/<ad>Scene.js)
  winter: 37, // kar: karlı dağlar, çam ormanı, kulübe + duman, lamba; olay: tilki + çamlardan savrulan kar
  spring: 38, // bahar: bulutlar, tepeler, çiçek açmış ağaç, dalgalanan çayır + lale/papatya; olay: bahar yağmuru + gökkuşağı
  summerSky: 39, // yaz (KIYININ ALTINDA): güneş, ufuk denizi + parıltı sütunu, ada, yelkenli; olay: yunuslar
  summerBeach: 40, // yaz (kıyının önünde): palmiye, şemsiye, havlu, deniz kabuğu
  autumn: 41, // sonbahar: alçak güneş, büyük ağaç, yaprak halısı, bank + lamba; olay: rüzgâr girdabı
  rain: 42, // yağmur: bulut tabanı, şehir, ıslak sokak, su birikintisi halkaları, lamba konisi; olay: şemsiyeli yaya
  storm: 43, // fırtına: aynı sahne koyu; bulut içi çakmalar, eğilen ağaç; olay: şemsiyesi ters dönen yaya
  aurora: 44, // aurora: vektör perdeler, karlı dağlar, donmuş göl yansıması, çadır (ÖNDE: yıldızlar arkada)
  stars: 45, // yıldız tozu: Samanyolu, bulutsular, parlak yıldızlar, tepede teleskop; olay: takımyıldız + meteor yağmuru (ÖNDE)
  campfire: 46, // kıvılcım: kamp ateşi (alevler, kütükler, taşlar), duman, çadır, ağaçlar; olay: alev parlaması
  // özel gün sahneleri (Sinema ve şenlik)
  fwCity: 47, // havai fişek: nehir kıyısı şehir + dönme dolap; vektör fişekler (5 tür) + suda yansıma; olay: büyük final
  haunted: 48, // Cadılar Bayramı: dolunay, perili köşk, kuru ağaç + baykuş, mezarlık, fenerli balkabakları, sis, hayaletler; olay: cadı
  xmasVillage: 49, // Noel: karlı köy, ışık zinciri, süslü ağaç, kardan adam, hediyeler; olay: Noel Baba kızağı
  // evren vektör sahneleri
  sherVec: 50, // Sherlock: sisli Londra sokağı, saat kulesi, gaz lambaları; olay: dedektif + büyüteç, atlı fayton
  dnVec: 51, // Death Note: çatı, dolunay, şehir; yazılan defter + elma; olay: kanatlı ölüm meleği elmayı alır
  opSky: 52, // One Piece (KIYININ ALTINDA): gök, kümülüs bulutlar, adalar, ufuk; uçan hasır şapka; olay: deniz canavarı
  narVec: 53, // Naruto: gün batımı köyü, oyulmuş yüzlü kayalık, çatılar, antrenman kütükleri; olay: ninja düellosu
  isVec: 55, // Interstellar: kara delik + mercek halkası, dönen halka istasyon, sığ su gezegeni; olay: dev dalga + iniş aracı kaçar
  stVec: 56, // Stranger Things: 80'ler banliyösü, çam ormanı, su kulesi, saçakta yılbaşı ışıkları; olay: bisikletli çocuklar + öbür taraf (kızıl gök, şimşek, sarmaşık)
  dsVec: 57, // Demon Slayer: dolunay, dağlar, sarkan wisteria, fenerli ahşap ev; olay: kılıç ustası + su dalgası şeridi
  brVec: 58, // Blade Runner: pus içinde megakent, basamaklı piramit, alev püskürten bacalar, neon kuleler, holografik pano; olay: uçan polis arabası + projektör
  ghVec: 59, // Ghibli dünyası: yaz kırsalı, dev kümülüs, kafur ağacı, pirinç tarlası, şemsiyeli yolcu ve kırsal durak; olay: eski otobüs gelir + tarlada rüzgâr dalgası
  tlVec: 60, // The Last of Us: doğanın geri aldığı şehir, kırık iskelet kuleler, sarmaşık, ışık hüzmeleri, su basmış cadde; olay: zürafalar + kuş sürüsü
  jpVec: 61, // Jurassic Park: volkanik adalar, orman, Brachiosaurus'lar, meşaleli kütük kapı, elektrikli çit; olay: T-Rex kükremesi + helikopter
  avVec: 62, // Avatar: gaz devi, şelaleli yüzen dağlar, ışık telli Ruhlar Ağacı, biyolüminesan bitkiler; olay: ikran dalışı + parlayan orman
  mmVec: 63, // Mad Max: turuncu gök, şimşekli kum fırtınası duvarı, bahçeli Citadel kuleleri, kum tepeleri, tozlu yol; olay: War Rig + alevli gitar arabası
  pcVec: 64, // Karayip Korsanları: dolunay ve ışık yolu, kurukafa kayalı ada, yırtık yelkenli Siyah İnci, kayan dalgalar; olay: Kraken dokunaçları
  inVec: 65, // Inception: Paris sokağı, tepeden sarkan ters şehir, kafe tentesi, masada dönen topaç; olay: şehir katlanır + topaç yalpalar
  tiVec: 66, // Titanic: ay, sakin Atlantik, dört bacalı ışıklı gemi, suda ışık yansımaları, buzdağı; olay: baca buharı + pruvada kollarını açan siluetler + kayan yıldız
  dkVec: 67, // Dark: yağmurlu Winden ormanı, buharlı soğutma kuleleri, mağara ağzı + demir kapı, sarı yağmurluklu siluet; olay: karanlık küre + üç halkalı sembol
  sqVec: 68, // Squid Game: bulut boyalı duvarlı oyun alanı, ağaç + dev bebek, yeşil eşofmanlı oyuncular, maskeli pembe muhafızlar; olay: kırmızı ışık / yeşil ışık
  hxVec: 69, // Hunter x Hunter: Balina Adası tepesi ve dev ağaç, bulutları delen Göklerin Arenası, kayaya saplı olta + şamandıra; olay: gölün dev balığı sıçrar + Avcı Birliği zeplini
  jjVec: 70, // Jujutsu Kaisen: dolunaylı Tokyo, pagoda + torii, Shibuya gökdelenleri ve dev ekranlar, lanet gözleri, mor lanet alevleri; olay: Hollow Purple
  fmaVec: 54, // Fullmetal Alchemist: tuğla kasaba meydanı, saat kulesi, cep saati; olay: dönüşüm çemberi + taş sütun
});
/** Kıyı katmanının (dalga + kum) da ALTINDA çizilen katmanlar. */
export const OVERLAY_UNDER = Object.freeze([OVERLAY.summerSky, OVERLAY.opSky]);
/** İçeriğe yakın (Atlas'ın ÖNÜNDE) çizilen katmanlar; gerisi arkada. */
export const OVERLAY_FRONT = Object.freeze([
  OVERLAY.heartbeat, OVERLAY.fog, OVERLAY.equalizer, OVERLAY.viewfinder, OVERLAY.paparazzi, OVERLAY.titanWall,
  OVERLAY.orbits, // güneş sistemi: yıldız parçacıkları Güneş'in/gezegenlerin ARKASINDA kalsın
  OVERLAY.aurora, OVERLAY.stars, // yıldızlar dağların/tepenin arkasında kalsın
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
  solarSystem: { counts: { low: 34, medium: 55, high: 80 } }, // + 1 sabit (vektör sahne); gerisi yıldız
  halloween: { counts: { low: 9, medium: 13, high: 21 } }, // + 1 sahne (vektör)
  christmas: { counts: { low: 33, medium: 51, high: 79 } }, // + 1 sahne (vektör)
  cinema: { counts: { low: 24, medium: 40, high: 62 } },
  storm: { counts: { low: 58, medium: 93, high: 153 } }, // + 1 sahne + 2 şimşek
  springGarden: { counts: { low: 15, medium: 24, high: 36 } }, // + 1 sahne (çayır vektör)
  summerShore: { counts: { low: 19, medium: 33, high: 53 } }, // + 2 sahne + 3 dalga + 1 kum (vektör)
  aurora: { counts: { low: 22, medium: 34, high: 52 } }, // + 1 sahne
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
    ["iceWall", "dunes", "gotham", "skyline", "mordor", "mesa", "prison", "titanWall", "skyBeam", "river", "swPlanet", "hogwarts", "opShip", "rmPortal", "matrixCity",
      "winterScene", "springScene", "summerSky", "summerBeach", "autumnScene", "rainScene", "stormScene", "auroraScene", "starScene", "campfireScene",
      "fireworksScene", "halloweenScene", "christmasScene", "sherVec", "dnVec", "opSky", "narVec", "fmaVec", "isVec", "stVec", "dsVec", "brVec", "ghVec", "tlVec", "jpVec", "avVec", "mmVec", "pcVec", "inVec", "tiVec", "dkVec", "sqVec", "hxVec", "jjVec"]
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
  // Mevsim / gökyüzü bileşikleri: parçacıklar + TEK vektör sahne (components/decor/*Scene.js).
  storm: Object.freeze([["stormScene", { fixed: 1 }], ["rain", 1], ["lightning", { fixed: 2 }]]),
  // çim ve çiçekler artık sahnede vektör (dalgalanan çayır); parçacık: sakura, karahindiba, kelebek
  springGarden: Object.freeze([
    ["springScene", { fixed: 1 }], ["sakura", 0.4], ["dandelion", 0.35], ["butterflies", 0.25],
  ]),
  summerShore: Object.freeze([
    ["summerSky", { fixed: 1 }], ["seagulls", 0.18], ["waves", { fixed: 3 }], ["glints", 0.82], ["sand", { fixed: 1 }],
    ["summerBeach", { fixed: 1 }],
  ]),
  aurora: Object.freeze([["skyStars", 1], ["auroraScene", { fixed: 1 }]]),
  // Güneş sistemi: yıldız parçacıkları (arkada) + TEK vektör sahne (components/decor/solarScene.js):
  // Güneş, Güneş'ten aydınlanan 8 gezegen (Ay, İSS, halkalar), asteroit kuşağı, kara delik, pulsar,
  // 75 sn'de bir kuyruklu yıldız geçişi + Güneş patlaması.
  solarSystem: Object.freeze([["skyStars", 1], ["orbits", { fixed: 1 }]]),
  // Özel günler: Cadılar Bayramı ve Noel = vektör sahne (halloweenScene / christmasScene) +
  // önünde yarasa / kar parçacıkları. Sinema Günü (mısır + bilet).
  halloween: Object.freeze([["halloweenScene", { fixed: 1 }], ["bats", 1]]),
  christmas: Object.freeze([["christmasScene", { fixed: 1 }], ["snow", 1]]),
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

/** Seçicide tek başına seçilince sahnesiyle çizilen temel (parçacık) efektler. */
export const EFFECT_SCENE = Object.freeze({
  snow: "winterScene",
  leaves: "autumnScene",
  rain: "rainScene",
  stardust: "starScene",
  embers: "campfireScene",
  fireworks: "fireworksScene",
});
/** Tek başına seçilince YALNIZ sahnesiyle çizilenler (parçacık sürümü karışımlarda kalır). */
export const SCENE_ONLY = Object.freeze(["fireworks"]);

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
  const plan = list.map((e) => [e, Math.max(1, Math.round(resolveParticleCount(e, density, effectMode) * f))]);
  // Tek başına seçilen temel efekt kendi vektör sahnesiyle çizilir (tür karışımında / bileşiklerin
  // içinde yalnız parçacık). Sahne ilk sırada: arkada kalır.
  const scene = list.length === 1 ? EFFECT_SCENE[list[0]] : null;
  if (!scene) return plan;
  return SCENE_ONLY.includes(list[0]) ? [[scene, 1]] : [[scene, 1], ...plan];
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
    lift: 0, // kıyı / deniz bandı: sekme çubuğu payı (dp, × ölçek)
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
/** Cisimlerin başlangıç açıları (SOLAR_BODIES sırası: 0 Güneş, 1–8 gezegenler, 9 Ay, 10 İSS). */
export const SOLAR_PHASES = Object.freeze(Array.from({ length: 11 }, (_, i) => solarPhase(i)));

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
// Mevsim / gökyüzü sahnelerinin olay saati: [dönem sn, rest] → olay süresi dönem / rest.
const SEASON_EVENT = Object.freeze({
  winterScene: [70, 2.6], // tilki ~27 sn
  springScene: [72, 2.6], // bahar yağmuru + gökkuşağı ~28 sn
  summerSky: [66, 2.4], // yunuslar ~27 sn
  summerBeach: [66, 2.4],
  autumnScene: [66, 2.6], // rüzgâr girdabı ~25 sn
  rainScene: [70, 2.6], // şemsiyeli yaya ~27 sn
  stormScene: [52, 2.2], // ters dönen şemsiye ~24 sn
  auroraScene: [60, 2.4], // alt fırtına ~25 sn
  starScene: [64, 2.4], // takımyıldız + meteor yağmuru ~27 sn
  campfireScene: [56, 2.6], // alev parlaması ~22 sn
  fireworksScene: [52, 2.5], // büyük final ~21 sn
  halloweenScene: [62, 2.5], // aya karşı uçan cadı + yarasa sürüsü ~25 sn
  christmasScene: [64, 2.5], // Noel Baba kızağı ~26 sn
  // evren vektör sahneleri
  sherVec: [70, 2.6], // dedektif + fayton ~27 sn
  dnVec: [72, 2.6], // ölüm meleği elmayı alır ~28 sn
  opSky: [66, 2.6], // deniz canavarı yükselir ~25 sn
  narVec: [64, 2.5], // ninja düellosu ~26 sn
  fmaVec: [66, 2.6], // dönüşüm: taş sütun yükselir ~25 sn
  isVec: [66, 2.6], // dev dalga + iniş aracı ~25 sn
  stVec: [68, 2.6], // bisikletler + öbür taraf ~26 sn
  dsVec: [64, 2.6], // kılıç ustası + su dalgası ~25 sn
  brVec: [60, 2.5], // uçan araba + projektör ~24 sn
  ghVec: [66, 2.6], // kırsal otobüs + rüzgâr dalgası ~25 sn
  tlVec: [70, 2.6], // zürafalar + kuş sürüsü ~27 sn
  jpVec: [66, 2.4], // T-Rex + helikopter ~27 sn
  avVec: [64, 2.4], // ikran dalışı ~27 sn
  mmVec: [62, 2.4], // War Rig konvoyu ~26 sn
  pcVec: [68, 2.4], // Kraken ~28 sn
  inVec: [70, 2.5], // şehrin katlanması ~28 sn
  tiVec: [72, 2.5], // pruva sahnesi ~29 sn
  dkVec: [74, 2.55], // mağara geçidi ~29 sn
  sqVec: [60, 2.4], // kırmızı ışık, yeşil ışık ~25 sn
  hxVec: [66, 2.4], // balık sıçrayışı + zeplin ~27 sn
  jjVec: [70, 2.5], // Hollow Purple ~28 sn
});

function makeOverlay(effect, p, rand, index) {
  const type = OVERLAY_EFFECT_OF[effect];
  switch (effect) {
    case "flare":
      return overlay(p, rand, type, { period: [7, 11], duty: 0.18, rise: 0.35, xr: [0.2, 0.8], yr: [1, 1] });
    case "orbits":
      // güneş sistemi: kuyruklu yıldız + Güneş patlaması, 75 sn'de bir 30 sn
      overlay(p, rand, type, { period: [75, 75], rest: 2.5 });
      p.y0 = 0;
      return p;
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
      // Yüzük ateşe → patlama → kule çöker → kartallar: 75 sn'de bir 30 sn
      overlay(p, rand, type, { period: [75, 75], rest: 2.5 });
      p.y0 = 0;
      return p;
    case "prison":
      // Kaçış sahnesi ve projektör aynı saatte.
      overlay(p, rand, type, { period: [75, 75], rest: 2.5 });
      p.y0 = 0;
      return p;
    case "hogwarts":
      // Ruh Emiciler + Patronus: 75 sn'de bir 30 sn
      overlay(p, rand, type, { period: [75, 75], rest: 2.5 });
      p.y0 = 0;
      return p;
    case "gotham":
      // yarasa işareti + atlayış + süzülüş + dönüş: 75 sn'de bir 30 sn
      overlay(p, rand, type, { period: [75, 75], rest: 2.5 });
      p.y0 = 0;
      return p;
    case "skyline":
      // ağ salınımı + su kulesine konma + ağla çekilip gitme: 66 sn'de bir 30 sn
      overlay(p, rand, type, { period: [66, 66], rest: 2.2 });
      p.y0 = 0;
      return p;
    case "mesa":
      overlay(p, rand, type, { period: [75, 75], rest: 2.5 });
      p.y0 = 0;
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
      // tüm sahne (ejderha, ateş, yıkılış, ordu) components/decor/gotScene.js — gotFrame
      overlay(p, rand, type, { period: [75, 75], rest: 2.5 });
      p.y0 = 0;
      return p;
    case "dunes":
      // tüm sahne (Fremen, vurucu, solucan) components/decor/duneScene.js — duneFrame
      overlay(p, rand, type, { period: [72, 72], rest: 2.4 });
      p.y0 = 0;
      return p;
    case "opShip":
      overlay(p, rand, type, { period: [88, 88], rest: 2 });
      p.y0 = rand();
      return p;
    case "rmPortal":
      overlay(p, rand, type, { period: [66, 66], rest: 2.2 });
      p.y0 = 0;
      return p;
    case "winterScene":
    case "springScene":
    case "summerSky":
    case "summerBeach":
    case "autumnScene":
    case "rainScene":
    case "stormScene":
    case "auroraScene":
    case "starScene":
    case "campfireScene":
    case "fireworksScene":
    case "halloweenScene":
    case "christmasScene":
    case "sherVec":
    case "dnVec":
    case "opSky":
    case "narVec":
    case "stVec":
    case "dsVec":
    case "brVec":
    case "ghVec":
    case "tlVec":
    case "jpVec":
    case "avVec":
    case "mmVec":
    case "pcVec":
    case "inVec":
    case "tiVec":
    case "dkVec":
    case "sqVec":
    case "hxVec":
    case "jjVec":
    case "fmaVec":
    case "isVec": {
      // olay dönemi (sn) ve seyrekliği (rest): olay = dönem / rest
      const [per, rest] = SEASON_EVENT[effect];
      overlay(p, rand, type, { period: [per, per], rest });
      p.y0 = 0;
      return p;
    }
    case "matrixCity":
      // Ajan + mermi zamanı: 72 sn'de bir 30 sn
      overlay(p, rand, type, { period: [72, 72], rest: 2.4 });
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
    case "titanWall":
      // 80 sn'de bir 32 sn'lik olay (dev + kapı tekmesi); açılıştan ~5 sn sonra ilki başlar
      overlay(p, rand, type, { period: [80, 80], rest: 2.5 });
      p.y0 = 0.94;
      return p;
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
    // (yaz kıyısında kum da kalkar; ışıltılar deniz bandıyla birlikte kayar)
    if (e === "onePiece" || e === "summerShore")
      for (const q of out) if (q.kind === KIND.tile || q.seaBand) q.lift = SCENERY.lift;
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

/** Star Wars sahnesindeki ana odaklar. Işın, çanak ve çarpma noktası aynı koordinatlardan türetilir. */
export function starWarsLayout(width, height) {
  const k = sceneScale(width, height);
  const R = 56 * k;
  const dcx = width * 0.78;
  const dcy = height * 0.2;
  const dish = [dcx - R * 0.32, dcy - R * 0.34];
  const dishR = R * 0.2;
  const Rp = 42 * k;
  const pcx = width * 0.24;
  const pcy = height * 0.36;
  const dx = pcx - dish[0];
  const dy = pcy - dish[1];
  const len = Math.hypot(dx, dy);
  const hit = [pcx - dx / len * Rp, pcy - dy / len * Rp];
  return { k, R, dcx, dcy, dish, dishR, Rp, pcx, pcy, hit };
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
      baseY = m.seaTop + (m.sandTop - m.seaTop) * p.y0 - p.lift * m.k;
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
 * Breaking Bad (olay 30 sn, ardından 45 sn sessiz çöl). Sıra: gökten pantolon savrulur (pants,
 * −1 = yok) → karavan gelir (drive), toz (dust) → çatıdan pişirme dumanı (smoke) → kapı (door) →
 * Jesse (outJ) ve Walter (outW) çıkar → Walter kristali kaldırır (hold), parlar (glint) →
 * içeri dönerler → karavan gider (depart). walk*: adım genliği, facing*: yön (1 sağ, −1 sol).
 */
export function bbFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) {
    return { u, pants: -1, drive: 0, depart: 0, dust: 0, door: 0, smoke: 0, outJ: 0, outW: 0, walkJ: 0, walkW: 0, facingJ: -1, facingW: -1, visJ: 0, visW: 0, hold: 0, glint: 0 };
  }
  const inn = (a, b) => (u > a && u < b ? 1 : 0);
  const outJ = smooth01(0.37, 0.44, u) * (1 - smooth01(0.68, 0.74, u));
  const outW = smooth01(0.42, 0.5, u) * (1 - smooth01(0.7, 0.76, u));
  const hold = smooth01(0.54, 0.58, u) * (1 - smooth01(0.64, 0.68, u));
  const d1 = smooth01(0.03, 0.08, u) * (1 - smooth01(0.2, 0.27, u));
  const d2 = smooth01(0.8, 0.85, u) * (1 - smooth01(0.95, 1, u));
  return {
    u,
    pants: u < 0.26 ? u / 0.26 : -1,
    drive: smooth01(0.03, 0.24, u),
    depart: smooth01(0.8, 0.99, u),
    dust: d1 > d2 ? d1 : d2,
    door: smooth01(0.33, 0.37, u) * (1 - smooth01(0.76, 0.8, u)),
    smoke: smooth01(0.26, 0.32, u) * (1 - smooth01(0.72, 0.82, u)),
    outJ,
    outW,
    walkJ: inn(0.37, 0.44) + inn(0.68, 0.74),
    walkW: inn(0.42, 0.5) + inn(0.7, 0.76),
    facingJ: u > 0.6 ? 1 : -1,
    facingW: u > 0.69 ? 1 : -1,
    visJ: outJ > 0.02 ? 1 : 0,
    visW: outW > 0.02 ? 1 : 0,
    hold,
    glint: hold * smooth01(0.56, 0.59, u) * (1 - smooth01(0.63, 0.66, u)),
  };
}

/**
 * Prison Break (olay 30 sn, ardından 45 sn sakin gece). plan: dövme çizgisi rotayı çizer (0–1),
 * planO: çizginin opaklığı; mahkûmlar u'dan türetilir (pbScene: 0,14 + i·0,055 başlar, 0,5 sürer);
 * alarm: son kaçak direkteyken kule ışıkları ve projektör kabloya döner.
 */
export function pbFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) return { u, plan: 0, planO: 0, alarm: 0 };
  return {
    u,
    plan: smooth01(0.02, 0.12, u),
    planO: smooth01(0.02, 0.04, u) * (1 - smooth01(0.16, 0.24, u)),
    alarm: smooth01(0.74, 0.79, u) * (1 - smooth01(0.95, 1, u)),
  };
}

/** GoT: ejderha gelir, duvarı yıkar, ölüler gedikten geçer. */
export function gotFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  const fl = 0.9 + 0.06 * Math.sin(t * 4.1) + 0.04 * Math.sin(t * 7.3 + 1);
  if (u > 1) {
    return { u, fly: 0, inhale: 0, breath: 0, reach: 0, sweep: 0, leave: 0, dvis: 0, heat: 0, fall: 0, vis: 1, rubble: 0, dust: 0, shake: 0, army: 0, armyO: 0, fl };
  }
  const lin = (a, b) => (u <= a ? 0 : u >= b ? 1 : (u - a) / (b - a));
  const live = u < 0.9;
  const dustK = (u - 0.5) / 0.38;
  const shakeK = (u - 0.5) / 0.09;
  return {
    u,
    fly: smooth01(0, 0.25, u),
    inhale: smooth01(0.255, 0.3, u) * (1 - smooth01(0.31, 0.335, u)),
    breath: smooth01(0.315, 0.34, u) * (1 - smooth01(0.53, 0.57, u)),
    reach: smooth01(0.315, 0.335, u),
    sweep: lin(0.32, 0.56),
    leave: smooth01(0.58, 0.75, u),
    dvis: u < 0.76 ? 1 : 0,
    heat: smooth01(0.34, 0.46, u) * (1 - smooth01(0.62, 0.8, u)),
    fall: live ? smooth01(0.5, 0.72, u) : 0,
    vis: live ? 1 : smooth01(0.9, 0.985, u),
    rubble: live ? smooth01(0.55, 0.74, u) : 1 - smooth01(0.91, 0.99, u),
    dust: dustK > 0 && dustK < 1 ? Math.sin(dustK * 3.141592653589793) : 0,
    shake: shakeK > 0 && shakeK < 1 ? (1 - shakeK) * (1 - shakeK) : 0,
    army: lin(0.6, 0.87),
    armyO: smooth01(0.6, 0.64, u) * (1 - smooth01(0.82, 0.88, u)),
    fl,
  };
}
/**
 * Vikings — Lindisfarne baskını (olay 30 sn, ardından 60 sn sakin kıyı). sail: gemilerin sisten
 * gelişi (0–1), leave: geri çekiliş, row: kürek genliği, draw: okçu yayı gerer, burn: manastır
 * yangını, smoke: duman, bell: alarm çanı sallanır. Hepsi yumuşak; çakma yok.
 */
export function vikFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) return { u, sail: 0, leave: 0, row: 0, draw: 0, burn: 0, smoke: 0, bell: 0 };
  const sail = u >= 0.26 ? 1 : u / 0.26;
  const moving = smooth01(0, 0.03, u) * (1 - smooth01(0.24, 0.3, u)) + smooth01(0.82, 0.86, u);
  return {
    u,
    sail,
    leave: smooth01(0.84, 1, u),
    row: 0.2 + 0.8 * (moving > 1 ? 1 : moving),
    draw: smooth01(0.21, 0.24, u) * (1 - smooth01(0.43, 0.46, u)),
    burn: smooth01(0.26, 0.4, u) * (1 - smooth01(0.8, 0.97, u)),
    smoke: smooth01(0.3, 0.45, u) * (1 - smooth01(0.88, 1, u)),
    bell: smooth01(0.3, 0.34, u) * (1 - smooth01(0.7, 0.8, u)),
  };
}

/**
 * Harry Potter (olay 30 sn, ardından 45 sn sakin göl). dem: Ruh Emicilerin inişi (0–1), flee: kaçışları,
 * dark: gök kararır + pencereler söner, frost: göl donar, raise: Harry asayı kaldırır, wand: asa ucu,
 * burst: gümüş patlama (−1 = yok), stag: Patronus koşusu ve sıçrayışı, sparks: ışık zerrelerine dağılış.
 */
export function hpFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) return { u, dem: 0, flee: 0, dark: 0, frost: 0, raise: 0, wand: 0, burst: -1, stag: -1, sparks: -1 };
  const win = (a, b) => (u >= a && u < b ? (u - a) / (b - a) : -1);
  return {
    u,
    dem: smooth01(0.02, 0.2, u),
    flee: smooth01(0.42, 0.6, u),
    dark: smooth01(0.04, 0.2, u) * (1 - smooth01(0.45, 0.7, u)),
    frost: smooth01(0.1, 0.3, u) * (1 - smooth01(0.6, 0.8, u)),
    raise: smooth01(0.22, 0.28, u) * (1 - smooth01(0.78, 0.85, u)),
    wand: smooth01(0.26, 0.3, u) * (1 - smooth01(0.8, 0.86, u)),
    burst: win(0.3, 0.38),
    stag: win(0.34, 0.82),
    sparks: win(0.8, 0.92),
  };
}

/**
 * Yüzüklerin Efendisi (olay 30 sn, ardından 45 sn sakin Mordor). climb: hobbitler patikada (0–1, yoksa
 * −1), glint: kapıda Yüzük parlaması, look: Göz dağa döner, flare: krater alevlenir, erupt: patlama,
 * eyeDie: Göz söner (döngü sonunda geri gelir), boom: Göz patlama halkası, collapse: kule tepesinin
 * çöküşü (0–1), fallen: çöktü mü, restore: döngü sonunda kulenin sisten belirişi, dust: toz bulutu,
 * beastFall: Nazgûlların düşüşü, eagles: kartallar, out: hobbitler kapı önünde, shake: sarsıntı.
 */
export function lotrFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) {
    return { u, climb: -1, glint: 0, look: 0, flare: 0, erupt: 0, eyeDie: 0, boom: -1, collapse: 0, fallen: 0, restore: 1, dust: 0, beastFall: -1, eagles: -1, out: 0, shake: 0 };
  }
  const win = (a, b) => (u >= a && u < b ? (u - a) / (b - a) : -1);
  const tri = (c, w) => {
    const v = 1 - Math.abs(u - c) / w;
    return v > 0 ? v : 0;
  };
  const s1 = tri(0.41, 0.03);
  const s2 = tri(0.52, 0.04);
  return {
    u,
    climb: win(0.02, 0.3),
    glint: tri(0.335, 0.025),
    look: smooth01(0.15, 0.25, u) * (1 - smooth01(0.46, 0.5, u)),
    flare: smooth01(0.34, 0.38, u) * (1 - smooth01(0.8, 0.95, u)),
    erupt: smooth01(0.38, 0.44, u) * (1 - smooth01(0.7, 0.9, u)),
    eyeDie: smooth01(0.46, 0.52, u) * (1 - smooth01(0.92, 0.99, u)),
    boom: win(0.5, 0.62),
    collapse: u >= 0.5 && u < 0.68 ? (u - 0.5) / 0.18 : 0,
    fallen: u >= 0.5 ? 1 : 0,
    restore: smooth01(0.92, 0.99, u),
    dust: smooth01(0.5, 0.56, u) * (1 - smooth01(0.8, 0.97, u)),
    beastFall: win(0.5, 0.64),
    eagles: win(0.6, 0.86),
    out: smooth01(0.6, 0.62, u) * (1 - smooth01(0.7, 0.72, u)),
    shake: s1 > s2 ? s1 : s2,
  };
}

/**
 * Batman (olay 30 sn, ardından 45 sn sakin Gotham). sig: projektör + buluttaki yarasa işareti,
 * flash: şimşek (iki çakış), stand: gargoyle üstünde doğrulma, leap/glide/grap/back: atlayış, pelerin
 * kanat süzülüşü, kancayla çekiliş, geri süzülüp konma (0–1, yoksa −1), bats: havalanan yarasalar.
 */
export function batFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) return { u, sig: 0, flash: 0, stand: 0, leap: -1, glide: -1, grap: -1, back: -1, bats: 0 };
  const win = (a, b) => (u >= a && u < b ? (u - a) / (b - a) : -1);
  const tri = (c, w) => {
    const v = 1 - Math.abs(u - c) / w;
    return v > 0 ? v : 0;
  };
  const f1 = tri(0.125, 0.012);
  const f2 = 0.7 * tri(0.153, 0.009);
  return {
    u,
    sig: smooth01(0.02, 0.08, u) * (1 - smooth01(0.8, 0.88, u)),
    flash: f1 > f2 ? f1 : f2,
    stand: smooth01(0.15, 0.2, u),
    leap: win(0.24, 0.29),
    glide: win(0.29, 0.58),
    grap: win(0.58, 0.68),
    back: win(0.86, 0.98),
    bats: u >= 0.24 && u < 0.44 ? (u - 0.24) / 0.2 : 0,
  };
}

/**
 * Güneş sistemi (olay 30 sn, ardından 45 sn sakin dolanım). comet: kuyruklu yıldızın parabolik geçişi
 * (0–1, yoksa −1; günberi 0,5'te), flare: günberide Güneş patlaması (0–1), cme: genişleyen taç kütle
 * atımı halkası (0–1, yoksa −1).
 */
export function solarFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) return { u, comet: -1, flare: 0, cme: -1 };
  const win = (a, b) => (u >= a && u < b ? (u - a) / (b - a) : -1);
  const fl = 1 - Math.abs(u - 0.51) / 0.07;
  return { u, comet: win(0.03, 0.97), flare: fl > 0 ? fl : 0, cme: win(0.5, 0.74) };
}

/**
 * Spider-Man (olay 30 sn, ardından 36 sn sakin şehir). s1/s2: iki sarkaç salınımı (0–1, yoksa −1),
 * f1/f2: aradaki takla uçuşları (f2 su kulesine konar), perch: kule tepesinde çömelme, land: konma
 * çöküşü, look: yön (1 sağ, −1 sola bakınır), zipLine: yukarı ağ atışı, zip: ağla çekilip çıkış
 * (−1 = yok), siren: aşağıda polis ışıkları.
 */
export function spiderFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) return { u, s1: -1, f1: -1, s2: -1, f2: -1, perch: 0, land: 0, look: 1, zipLine: 0, zip: -1, siren: 0 };
  const win = (a, b) => (u >= a && u < b ? (u - a) / (b - a) : -1);
  const landK = (u - 0.42) / 0.05;
  const zl = (u - 0.68) / 0.085;
  return {
    u,
    s1: win(0.04, 0.17),
    f1: win(0.17, 0.23),
    s2: win(0.23, 0.36),
    f2: win(0.36, 0.42),
    perch: u >= 0.42 && u < 0.765 ? 1 : 0,
    land: landK > 0 && landK < 1 ? Math.sin(landK * Math.PI) : 0,
    look: 1 - 2 * smooth01(0.53, 0.55, u) * (1 - smooth01(0.6, 0.62, u)),
    zipLine: u < 0.68 || u >= 0.765 ? 0 : zl > 1 ? 1 : zl,
    zip: win(0.765, 0.84),
    siren: smooth01(0.45, 0.5, u) * (1 - smooth01(0.66, 0.72, u)),
  };
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
  const planet = smooth01(0.33, 0.37, u) * (1 - smooth01(0.52, 0.555, u));
  const charge = smooth01(0.42, 0.5, u) * (1 - smooth01(0.52, 0.56, u));
  const grow = u >= 0.5 ? smooth01(0.5, 0.506, u) : 0;
  const beam = grow * (1 - smooth01(0.522, 0.536, u));
  const impact = smooth01(0.506, 0.52, u) * (1 - smooth01(0.54, 0.575, u));
  const hyper = smooth01(0.8, 0.865, u) * (1 - smooth01(0.918, 0.95, u));
  const hyperDraw = smooth01(0.815, 0.91, u);
  const bank = smooth01(0.69, 0.75, u) * (1 - smooth01(0.79, 0.85, u));
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
  return { u, ds, slide, planet, charge, grow, beam, impact, hyper, hyperDraw, bank, b: blast ? bb : 0, blast, fy, fs, fv: fy < 1.9 ? 1 : 0 };
}

/**
 * Dune sahnesi (olay 30 sn, ardından ~42 sn sakin çöl). Sıra: Fremen kayadan iner (walk) →
 * vurucuyu diker (plant) → geri çekilir (back) → vurucu döver (thump, pulse = halka evresi) →
 * kumda iz yaklaşır (wake), zemin titrer (shake) → solucan yükselir (rise), ağzı açılır (open) →
 * öne devrilir (fall) ve kuma dalar (sink); Fremen üstüne atlar (leap) → uzak sırtta sürülür (ride).
 * burst/dive: kum patlamaları (−1 = yok).
 */
export function duneFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  const pulse = (t / 3.3) % 1;
  if (u > 1) {
    return { u, walk: 0, plant: 0, back: 0, thump: 0, pulse, wake: 0, shake: 0, rise: 0, open: 0, fall: 0, sink: 0, leap: -1, ride: -1, burst: -1, dive: -1 };
  }
  const lin = (a, b) => (u <= a ? 0 : u >= b ? 1 : (u - a) / (b - a));
  const win = (a, b) => (u >= a && u < b ? (u - a) / (b - a) : -1);
  return {
    u,
    walk: lin(0.02, 0.12),
    plant: smooth01(0.115, 0.15, u),
    back: lin(0.16, 0.26),
    thump: smooth01(0.15, 0.17, u) * (1 - smooth01(0.4, 0.42, u)),
    pulse,
    wake: lin(0.2, 0.41),
    shake: smooth01(0.3, 0.42, u) * (1 - smooth01(0.62, 0.7, u)),
    rise: smooth01(0.4, 0.52, u),
    open: smooth01(0.47, 0.53, u) * (1 - smooth01(0.58, 0.63, u)),
    fall: smooth01(0.56, 0.66, u),
    sink: smooth01(0.61, 0.7, u),
    leap: win(0.565, 0.62),
    ride: win(0.66, 0.97),
    burst: win(0.4, 0.5),
    dive: win(0.62, 0.72),
  };
}

/**
 * Attack on Titan sahnesinin zaman çizelgesi (olay ~32 sn, sonra ~48 sn sakin duvar):
 * şimşek → buhar sütunu → dev duvarın ardından yükselir → eli duvarın tepesine iner →
 * bakar → geriye yaslanır (bacağını kaldırır) → KAPIYI TEKMELER: kapı parçalanır, ayak
 * delikten görünür, enkaz ve toz şehre saçılır, sahne sarsılır → dev buhar içinde kaybolur →
 * toz çöker, kapı (döngü sonunda) onarılır. Hepsi 0–1; deb: enkaz uçuşu (−1 = yok).
 */
export const AOT_KICK_U = 0.46;
export function aotFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) {
    return { u, flash: 0, column: 0, rise: 0, hand: 0, thump: 0, lean: 0, broken: 0, foot: 0, deb: -1, dust: 0, spread: 0, shake: 0, vanish: 0, burst: 0 };
  }
  const K0 = AOT_KICK_U;
  const flash = smooth01(0, 0.012, u) * (1 - smooth01(0.018, 0.06, u));
  const column = smooth01(0.01, 0.06, u) * (1 - smooth01(0.18, 0.3, u));
  const rise = smooth01(0.05, 0.17, u);
  const hand = smooth01(0.175, 0.2, u) * (1 - smooth01(0.7, 0.76, u));
  const thump = u >= 0.198 && u < 0.24 ? 1 - (u - 0.198) / 0.042 : 0;
  // geriye yaslanma (bacak kalkar), tekmede öne atılma
  const lean = smooth01(0.37, 0.445, u) * (1 - smooth01(K0 - 0.004, K0 + 0.02, u)) - 0.45 * smooth01(K0, K0 + 0.03, u) * (1 - smooth01(0.56, 0.64, u));
  const broken = u >= K0 ? 1 - smooth01(0.93, 0.99, u) : 0;
  const foot = u >= K0 - 0.006 ? smooth01(K0 - 0.006, K0 + 0.012, u) * (1 - smooth01(0.52, 0.57, u)) : 0;
  const deb = u >= K0 && u < K0 + 0.18 ? (u - K0) / 0.18 : -1;
  const dust = u >= K0 ? smooth01(K0, K0 + 0.03, u) * (1 - smooth01(0.72, 0.96, u)) : 0;
  const sp = (u - K0) / 0.32;
  const spread = u >= K0 ? (sp > 1 ? 1 : sp) : 0;
  const kickShake = u >= K0 && u < K0 + 0.045 ? 1 - (u - K0) / 0.045 : 0;
  const shake = kickShake > thump * 0.35 ? kickShake : thump * 0.35;
  const vanish = smooth01(0.66, 0.79, u);
  const burst = smooth01(0.6, 0.7, u) * (1 - smooth01(0.84, 0.97, u));
  return { u, flash, column, rise, hand, thump, lean, broken, foot, deb, dust, spread, shake, vanish, burst };
}

/**
 * Rick and Morty sahnesi (olay 30 sn, sonra ~36 sn sakin uzaylı ova). Sıra: sağda yer portalı
 * açılır (a) → Rick, ardından Morty içinden yürüyerek çıkar (r1/m1, ampR/ampM = yürüyüş adımı) →
 * portal kapanır → Rick mataradan içer (swig) + geğirir (burp), Morty geriye bakar (look) →
 * Rick portal tabancasıyla nişan alır (aim), yeşil mermi (shot) solda yeni portal açar (b) →
 * ikisi yürüyüp içine girer (r2/m2) → portal kapanır → gökte portal (c) açılır, uzay aracı
 * içinden çıkıp ekranı geçer (ship). sa/sb/sc: portal açılış sıçraması (−1 = yok).
 */
export function rmFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) {
    return { u, a: 0, b: 0, c: 0, r1: 0, r2: 0, m1: 0, m2: 0, ampR: 0, ampM: 0, swig: 0, burp: -1, look: 0, aim: 0, shot: -1, recoil: 0, ship: -1, sa: -1, sb: -1, sc: -1 };
  }
  const lin = (a, b) => (u <= a ? 0 : u >= b ? 1 : (u - a) / (b - a));
  const win = (a, b) => (u >= a && u < b ? (u - a) / (b - a) : -1);
  // açılırken hafif taşma (pop), kapanırken yumuşak sönme
  const pop = (a0, a1, c0, c1) => {
    const o = smooth01(a0, a1, u);
    return (o + 0.14 * Math.sin(o * 3.14159)) * (1 - smooth01(c0, c1, u));
  };
  const a = pop(0.03, 0.075, 0.27, 0.31);
  const b = pop(0.49, 0.53, 0.76, 0.8);
  const c = pop(0.76, 0.8, 0.87, 0.91);
  const ampR = smooth01(0.09, 0.105, u) * (1 - smooth01(0.29, 0.305, u)) + smooth01(0.55, 0.565, u) * (1 - smooth01(0.69, 0.705, u));
  const ampM = smooth01(0.135, 0.15, u) * (1 - smooth01(0.325, 0.34, u)) + smooth01(0.575, 0.59, u) * (1 - smooth01(0.725, 0.74, u));
  return {
    u, a, b, c,
    r1: lin(0.09, 0.3), r2: lin(0.55, 0.7), m1: lin(0.135, 0.335), m2: lin(0.575, 0.74), ampR, ampM,
    swig: smooth01(0.33, 0.355, u) * (1 - smooth01(0.395, 0.42, u)),
    burp: win(0.415, 0.445),
    look: smooth01(0.36, 0.38, u) * (1 - smooth01(0.44, 0.46, u)),
    aim: smooth01(0.445, 0.47, u) * (1 - smooth01(0.53, 0.555, u)),
    shot: win(0.475, 0.497),
    recoil: u >= 0.475 && u < 0.49 ? 1 - (u - 0.475) / 0.015 : 0,
    ship: win(0.79, 0.975),
    sa: win(0.03, 0.09), sb: win(0.49, 0.55), sc: win(0.76, 0.82),
  };
}

/**
 * Matrix çatı sahnesi (olay 30 sn, ardından ~42 sn sakin şehir). walk: Ajan kapıdan gelir, aim: silah
 * kolu, flash/kick: namlu ışığı ve tepme, slow: mermi zamanı yeşil kayması, lean: Neo geriye bükülür,
 * hand: Neo elini kaldırır, hold: mermiler havada durur, dissolve: Ajan koda dağılır.
 */
export function matrixFrame(p, t) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) return { u, walk: 0, aim: 0, kick: 0, flash: 0, slow: 0, lean: 0, hand: 0, hold: 0, dissolve: 0 };
  const shots = [0.19, 0.235, 0.28, 0.325, 0.62, 0.632, 0.644];
  let flash = 0;
  for (let i = 0; i < shots.length; i += 1) {
    const b = bump(u, shots[i] + 0.004, 0.006);
    if (b > flash) flash = b;
  }
  return {
    u,
    walk: smooth01(0.02, 0.13, u),
    aim: smooth01(0.13, 0.17, u) * (1 - smooth01(0.4, 0.46, u)) + smooth01(0.56, 0.6, u) * (1 - smooth01(0.76, 0.82, u)),
    kick: flash,
    flash,
    slow: smooth01(0.17, 0.21, u) * (1 - smooth01(0.5, 0.56, u)),
    lean: smooth01(0.17, 0.25, u) * (1 - smooth01(0.48, 0.56, u)),
    hand: smooth01(0.58, 0.62, u) * (1 - smooth01(0.84, 0.88, u)),
    hold: smooth01(0.66, 0.68, u) * (1 - smooth01(0.79, 0.81, u)),
    dissolve: smooth01(0.88, 0.98, u),
  };
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
  // Güneş sistemi (components/decor/solarScene.js SOLAR_TONE): [yörünge, Güneş ışıması, bulutsu A, bulutsu B, kuşak]
  16: { dark: ["#a9b8ff", "#ffb347", "#6a3a9a", "#1e5a9a", "#c8b8a0"], light: ["#4a5a99", "#ff8a1a", "#8a6ac0", "#4a8ac0", "#6a5a48"], alpha: [0.95, 0.95] },
  // evrenler: [ana, ikinci, vurgu…] — silüetler düşük opaklık (içerik önde okunur)
  // got: [buz, derin buz, parıltı, ahşap, mavi ateş, taş, koyu taş, çatı, pencere, kar, kuzey gecesi, kuzey ovası]
  17: {
    dark: ["#a6c4de", "#284a6e", "#eef6ff", "#3a2c22", "#59b8ff", "#4a4f58", "#2b2f37", "#1f2228", "#ffb54a", "#c2d2e2", "#0c1420", "#24364a"],
    light: ["#b4d6f0", "#4f84b3", "#f4faff", "#5a4334", "#2f8fe6", "#6c727c", "#4a505a", "#3a3f48", "#ff9a2a", "#f4f8fc", "#3a4e63", "#7d93a8"],
    alpha: [0.9, 0.86],
  },
  // dune: [aydınlık kum, kum, gölge kum, derin kum, kaya, aydınlık kaya, pus, ay, baharat, kumaş, metal, solucan, yıldız]
  18: {
    dark: ["#d9a066", "#a8703f", "#6a4026", "#2e1c12", "#3e281c", "#8c5a36", "#e0823a", "#f1e6cf", "#ff8a24", "#231d19", "#8d8a84", "#9a7552", "#fff1d6"],
    light: ["#f4cf96", "#dca866", "#b5763f", "#7a4a26", "#8a5a38", "#d79a62", "#ffb56b", "#fff8e8", "#f07010", "#3f362f", "#6d6a66", "#a17a54", "#ffffff"],
    alpha: [0.95, 0.9],
  },
  // Batman (components/decor/batScene.js BAT_TONE): [uzak, orta, yakın, pencere, taş, aydınlık taş, bulut,
  //  işaret, hüzme, kostüm, pelerin, kemer, kenar ışığı, sokak/gece, sis]
  19: {
    dark: ["#1c2130", "#232838", "#141822", "#ffcf7a", "#3a3f4a", "#5a6170", "#2a3042", "#fff1b0", "#fff4c8", "#3d424e", "#101217", "#d9a92e", "#9fb6d8", "#0a0c12", "#3a4256"],
    light: ["#8892a8", "#6f7990", "#4a5164", "#ffd98a", "#6e7484", "#9aa1b0", "#aab3c6", "#fff6c4", "#fffbe6", "#3d424e", "#15171c", "#d9a92e", "#ffffff", "#c9d1e0", "#b9c2d4"],
    alpha: [0.95, 0.9],
  },
  // Spider-Man (components/decor/spiderScene.js SPIDER_TONE): [uzak kule, orta kat, yakın çatı, pencere,
  //  kırmızı, mavi, ağ, ay, şehir ışıması, çatı, ahşap, metal, sokak/gece]
  20: {
    dark: ["#1b2235", "#232c42", "#141a28", "#ffd98a", "#d4232f", "#2453b0", "#e8ecf2", "#f3efe2", "#ff9a5a", "#2c3446", "#5a3d2a", "#6b7385", "#0b0f18"],
    light: ["#8e9bb8", "#6c7896", "#3f4a63", "#ffe39a", "#d4232f", "#2453b0", "#ffffff", "#fff8e6", "#ffb37a", "#56607a", "#7a5236", "#8a93a6", "#cfd8ea"],
    alpha: [0.95, 0.9],
  },
  // Yüzüklerin Efendisi (components/decor/lotrScene.js LOTR_TONE): [gök, sırt, kaya, aydınlık kaya, kule,
  //  kule ışığı, lav, ateş, öz, kül, duman, kartal, Nazgûl, ova, ışıma]
  21: {
    dark: ["#3a1410", "#1e1414", "#2a1d1c", "#5a2f22", "#141012", "#3a2422", "#ff5a14", "#ff9a2a", "#fff0a8", "#4a3a38", "#2a2224", "#6a4a2e", "#0e0b0d", "#120c0c", "#ff6a1a"],
    light: ["#d98a5a", "#5a3a34", "#6a4a40", "#a05a40", "#2a2024", "#5a3c38", "#ff4a00", "#ff8a1a", "#ffe680", "#a08880", "#7a6a68", "#7a5634", "#1a1416", "#4a3430", "#ff7a2a"],
    alpha: [0.95, 0.9],
  },
  // Breaking Bad (components/decor/bbScene.js BB_TONE): [mesa, aydınlık mesa, mesa gölgesi, uzak dağ,
  //  kum, kum gölgesi, yol, çalı, ufuk pusu, yıldız, aydınlık kum]
  22: {
    dark: ["#8a4a32", "#c4683f", "#3e2420", "#3a2f4a", "#7a5a40", "#2e2018", "#9a7a58", "#4f5a34", "#ff8a4a", "#fff3dc", "#a98260"],
    light: ["#c8744a", "#ec9466", "#8a4a34", "#9a90b8", "#e2c49a", "#c09468", "#efd8b4", "#7a8a4a", "#ffd9a0", "#ffffff", "#f2dcb8"],
    alpha: [0.95, 0.92],
  },
  // Prison Break (components/decor/pbScene.js PB_TONE): [tuğla, koyu tuğla, beton, çelik, pencere,
  //  projektör, çimen, gece, pus/bulut, figür, alarm, plan]
  23: {
    dark: ["#5e3b32", "#2e1f1c", "#6a6e74", "#8a93a3", "#ffcf7a", "#fff6d8", "#1c2a20", "#0b1016", "#3a4658", "#12161c", "#ff3b30", "#8fc4ff"],
    light: ["#a06c58", "#6a463c", "#b9bdc3", "#5a6272", "#ffc861", "#fff1b8", "#5f7a52", "#3a4a3a", "#c2cfde", "#1e242c", "#e0352b", "#2b6cb0"],
    alpha: [0.95, 0.92],
  },
  // AoT sahnesi (components/decor/aotScene.js AOT_TONE sırası):
  // [taş yüzü, taş dibi, payanda ışık, payanda gölge, derz, sıva, ahşap, çatı ışık, çatı gölge,
  //  pencere, uzak ev/pus, yol, su, su parıltısı, kapı ahşabı, demir, kiremit (koyu çatı varyantı)]
  26: {
    dark: [
      "#5d5a53", "#403d38", "#77726a", "#3b3833", "#2c2a26", "#6d665b", "#2e2620", "#9a4c38", "#5e2c22",
      "#ffcf7a", "#3d3c40", "#4c4740", "#2c4a5c", "#7fa6bd", "#3a2a1e", "#22201d", "#7a4a30",
    ],
    light: [
      "#cfc6b4", "#aea48f", "#e4dccb", "#a49a85", "#8f8572", "#ebe0ca", "#6b5040", "#b8643f", "#87442e",
      "#ffc861", "#bdb7ab", "#cbbb98", "#5b8dab", "#d6ebf5", "#6a4a30", "#3d3a35", "#946446",
    ],
    alpha: [0.92, 0.88],
  },
  29: { dark: ["#f2f4f8", "#c9ced8", "#d9b45a", "#5dff7a", "#eaffe9"], light: ["#5f6675", "#7a8090", "#a8822a", "#1a9a38", "#b8f0c4"], alpha: [0.8, 0.75] },
  30: { dark: ["#eef4ff"], light: ["#ffe9a8"], alpha: [0.2, 0.26] },
  // starWars Ölüm Yıldızı perdesi: [deniz, kara, ışın, ateş, Ölüm Yıldızı ışığı]
  32: { dark: ["#4a9ae0", "#4f9a4a", "#5dff7a", "#ff9a3c", "#cfd5dc", ["#f2f4f6", "#c5cbd2", "#858d97"]], light: ["#2b78c2", "#3f8a3a", "#1a9a38", "#e8590c", "#8a929c", ["#e9ecef", "#aab2bc", "#6d7580"]], alpha: [0.95, 0.9] },
  // Harry Potter (components/decor/hpScene.js HP_TONE): [şato, aydınlık şato, çatı, pencere, göl, göl ışığı,
  //  tepe, orman, ay, gümüş (Patronus), Ruh Emici, buz, kıyı, gece, ışıma]
  33: {
    dark: ["#1c2236", "#2e3650", "#2a3550", "#ffcf7a", "#0f1a2c", "#3a5a80", "#141b2c", "#0c1420", "#eef2ff", "#cfe6ff", "#06070a", "#dbe8f5", "#121826", "#0b1020", "#ffd98a"],
    light: ["#4a5672", "#6a7898", "#3d4c6e", "#ffc861", "#5b7fa8", "#c8dcf0", "#6a7a98", "#3a4a5a", "#fffbea", "#ffffff", "#141418", "#ffffff", "#4a5468", "#c8d4e8", "#f2b84b"],
    alpha: [0.95, 0.9],
  },
  34: { dark: ["#ffffff"], light: ["#ffffff"], alpha: [0.95, 0.9] },
  // rick and morty: [portal, zemin, zemin üstü, mor bitki, turkuaz ışık, gezegen, gezegen 2, spor, uzak tepe]
  35: {
    dark: ["#7dff8a", "#141d2b", "#24364a", "#4a3470", "#4fe0c8", "#f0a35e", "#c483ff", "#c8ffd4", "#1b2a3d"],
    light: ["#1c9e2a", "#5f7f96", "#7d9db3", "#8a6cc0", "#1f9c8c", "#e0893a", "#9a5ad8", "#2e9c52", "#9fb7c8"],
    alpha: [0.95, 0.9],
  },
  // matrix (components/decor/matrixScene.js MX_TONE): [uzak bina, yakın bina, pencere, çatı, aydınlık çatı,
  //  pus, palto, takım, ten, yeşil ışık, metal, gece]
  36: {
    dark: ["#0c1d14", "#10261a", "#3ee87a", "#18261e", "#3a5a44", "#1a4a2a", "#070908", "#151a17", "#c9b89a", "#7dffa8", "#6f8578", "#040806"],
    light: ["#8fb09c", "#6a8c78", "#169c4c", "#9ab3a4", "#c4d8cb", "#b9e2c6", "#0d110e", "#262c28", "#d9c0a0", "#16a34a", "#56685e", "#d9eadf"],
    alpha: [0.95, 0.9],
  },
  // ── mevsim / gökyüzü sahneleri (ton adları: ilgili sahne dosyasındaki *_TONE)
  // kar (winterScene.js WINTER_TONE)
  37: {
    dark: ["#1d2c4a", "#f3efdc", "#26354f", "#34466a", "#c6d3e8", "#0f1a26", "#d6e2f2", "#c4d2e6", "#71849f", "#3b2a1f", "#e4ecf7", "#ffc46a", "#8c9ab0", "#d8682a", "#ffb35c", "#ffffff"],
    light: ["#d4e4f4", "#fff3cf", "#a3b9d6", "#8099bb", "#f4f8fd", "#2c4a3e", "#ffffff", "#dde8f4", "#a7bbd4", "#7a4d33", "#ffffff", "#ffc24d", "#c9d4e2", "#d9692b", "#ffcf66", "#ffffff"],
    alpha: [0.95, 0.92],
  },
  // bahar (springScene.js SPRING_TONE)
  38: {
    dark: ["#3a2f5a", "#ffb37a", "#7d6f9e", "#4c4470", "#2d4a4a", "#2a5a3a", "#1f4a2c", "#4f9a55", "#3a2a26", "#f7a8c4", "#d9709a", "#ff6b8a", "#ffc94d", "#f4f1ff", "#ffcc33", "#a9c4e8"],
    light: ["#cfe8ff", "#fff1b8", "#eef4fb", "#c3d3e6", "#a6d4b0", "#7cc483", "#3f9e4a", "#7ccf6e", "#6b4a3a", "#ffc4d6", "#f08cb0", "#ef476f", "#ffb703", "#ffffff", "#ffc300", "#7fa8d6"],
    alpha: [0.95, 0.92],
  },
  // yaz gökyüzü + deniz (summerScene.js SUMMER_SKY_TONE)
  39: {
    dark: ["#ffb347", "#ff7a3d", "#c46a7a", "#1d4f78", "#123352", "#e8875a", "#ffd08a", "#1a2a33", "#2a2f3a", "#f2d9c2", "#3a5568"],
    light: ["#fff4c2", "#ffd866", "#e6f0fa", "#4aa3d8", "#2a78b0", "#a8d8f2", "#ffffff", "#4f8a6a", "#3a4a5a", "#ffffff", "#5a7a90"],
    alpha: [0.95, 0.92],
  },
  // yaz kumsal önü (summerScene.js BEACH_TONE)
  40: {
    dark: ["#8a6a4a", "#5a4230", "#2f6a45", "#1f4a30", "#5a3a22", "#e8505b", "#f4efe6", "#d9d2c4", "#3aa6c9", "#ffd166", "#000000", "#f6d7c3"],
    light: ["#a07a52", "#6e5236", "#3f9a52", "#2a7040", "#6b4526", "#ef476f", "#ffffff", "#c8bca8", "#1fa9d6", "#ffd166", "#7a5a2a", "#f6c7b3"],
    alpha: [0.95, 0.92],
  },
  // sonbahar (autumnScene.js AUTUMN_TONE)
  41: {
    dark: ["#5a3a4a", "#ff9a5a", "#3a3040", "#6a3a2a", "#4a3424", "#2e2018", "#2e211c", "#e0692f", "#eda640", "#c24a2c", "#a8673a", "#3a2a20", "#22201e", "#ffc46a", "#5a4636"],
    light: ["#fde4c8", "#ffd08a", "#dcc0aa", "#e09a6a", "#d1aa7a", "#a8804e", "#5a4030", "#e0692f", "#eda640", "#c24a2c", "#b07a3a", "#6a4a30", "#3a3330", "#ffd27a", "#e2ccac"],
    alpha: [0.95, 0.92],
  },
  // yağmur (rainScene.js RAIN_TONE)
  42: {
    dark: ["#3a4658", "#252e3c", "#5a6a80", "#1c2430", "#ffcf7a", "#1e252e", "#2c3846", "#ffcf7a", "#151a20", "#ffd894", "#34465a", "#a9c4e8", "#56637a", "#c0392b", "#1a2620", "#dfe8ff"],
    light: ["#aab6c6", "#8794a6", "#cdd6e2", "#8a97a8", "#ffd27a", "#7d8896", "#93a0b0", "#ffe2a0", "#3a4250", "#ffe0a0", "#6f8094", "#ffffff", "#3a4656", "#d63c3c", "#4a6050", "#ffffff"],
    alpha: [0.95, 0.92],
  },
  // fırtına (rainScene.js RAIN_TONE, koyu)
  43: {
    dark: ["#3c4556", "#262d3a", "#8a9ab8", "#141a22", "#e6b860", "#141920", "#202a36", "#e6b860", "#0e1216", "#ffd08a", "#28384a", "#9fb4d4", "#4e5a70", "#2d5fa8", "#121c18", "#eef3ff"],
    light: ["#7d8a9c", "#5a6576", "#c8d4e8", "#6a7686", "#ffd27a", "#5f6a78", "#7a8796", "#ffe2a0", "#2a323e", "#ffe0a0", "#55667a", "#ffffff", "#2a3442", "#2d6fd0", "#34483c", "#ffffff"],
    alpha: [0.95, 0.92],
  },
  // aurora (auroraScene.js AURORA_TONE)
  44: {
    dark: ["#4dffa6", "#3ee6c4", "#9a7aff", "#ff6aa8", "#121a28", "#5d7088", "#0d1622", "#2a3a50", "#070c12", "#ff9a3d", "#ffb35c", "#05080c", "#1a3a44"],
    light: ["#12b878", "#14a5a0", "#7a52e0", "#e0458a", "#4a5a78", "#dfe8f4", "#6e86a6", "#c4d4e8", "#22303e", "#f08a2a", "#ffb35c", "#1a222c", "#9ab8d0"],
    alpha: [0.95, 0.92],
  },
  // yıldız tozu (starScene.js STAR_TONE)
  45: {
    dark: ["#b8c4ff", "#ffe9c8", "#0a0d18", "#7a4fd6", "#2b9fc0", "#ffffff", "#ffe2a8", "#9fb8ff", "#06080e", "#06080e", "#06080e", "#e8f0ff"],
    light: ["#6b7ad6", "#c9a0ff", "#eef0fa", "#8a63e0", "#2b8fc0", "#4a58c8", "#c88a2a", "#5a6fd6", "#2a3050", "#2a3050", "#2a3050", "#4a58c8"],
    alpha: [0.95, 0.92],
  },
  // kamp ateşi (campfireScene.js CAMP_TONE)
  46: {
    dark: ["#2a1a2a", "#121820", "#0a0e12", "#ff8a3d", "#1a1612", "#6a3a1a", "#3a3634", "#c07a4a", "#4a3020", "#c89a6a", "#ff4a1a", "#ff9a2a", "#fff0a8", "#ff5a1a", "#6a6260", "#3a5a6a", "#ffb35c"],
    light: ["#f2d8c8", "#9aa8a0", "#3a4a40", "#ff9a4a", "#b8a088", "#e8a060", "#8a8480", "#e0a070", "#6a4a30", "#e0b880", "#ff5a1a", "#ff9a2a", "#ffe680", "#ff6a2a", "#b8b0a8", "#3a7a8a", "#ffc46a"],
    alpha: [0.95, 0.92],
  },
  // havai fişek (fireworksScene.js FW_TONE)
  47: {
    dark: ["#5a2a6a", "#1b2238", "#0f1424", "#ffcf7a", "#122038", "#070c18", "#1a2030", "#2c3550", "#ff6ad5", "#ff4d6d", "#ffd166", "#4cc9f0", "#06d6a0", "#c77dff", "#ffffff", "#ffc35a", "#8a8fa8", "#fff3d6", "#ff3b3b", "#0a0e18"],
    light: ["#ffb4c8", "#a9b8cf", "#6f81a0", "#ffe39a", "#86b0d4", "#5684ad", "#5a6a84", "#4a5a78", "#ff4fa8", "#e0244f", "#e09a00", "#1c8fd0", "#05a37a", "#8a3ad6", "#ff6a00", "#d9921a", "#9aa3b8", "#fff6e0", "#e02424", "#3a4560"],
    alpha: [0.95, 0.92],
  },
  // Cadılar Bayramı (halloweenScene.js HW_TONE)
  48: {
    dark: ["#2a1a40", "#ffd9a0", "#ff9a3d", "#e8b880", "#3a2c50", "#2e2346", "#221a30", "#1a1426", "#ffb347", "#1a1522", "#5a5468", "#38334a", "#1d1628", "#ff7a1a", "#c4520a", "#3a5a2a", "#ffd23a", "#b8a8d8", "#e8f0ff", "#9a90b8", "#08060c", "#ffe14a"],
    light: ["#e8d4f0", "#fff4dc", "#ffb46a", "#f0d4a8", "#cbbcd8", "#9a88b4", "#6a5a84", "#3a3048", "#ffb347", "#5a4e66", "#8a8498", "#6a6478", "#2e2836", "#ff7a1a", "#d0601a", "#4a7a3a", "#ffe066", "#ffffff", "#ffffff", "#6a6080", "#1e1a26", "#ffd23a"],
    alpha: [0.95, 0.92],
  },
  // Noel (christmasScene.js XM_TONE)
  49: {
    dark: ["#1a2440", "#fff4d6", "#2a3a5c", "#3a4c70", "#e8eef8", "#a8b8d4", "#1c3a3a", "#1f4a3a", "#5a3a3a", "#3e2a2a", "#2a2230", "#ffc46a", "#3a3448", "#1f6a44", "#134a30", "#ffe066", "#ff4d4d", "#ffd166", "#4cc9f0", "#7dff8a", "#1a1a22", "#f4f8ff", "#d62839", "#ff8a2a", "#c0392b", "#2a7fd4", "#ffd166", "#ffcf7a", "#b3202a", "#6a4a32", "#fff2b0", "#8a96aa"],
    light: ["#dbe6f4", "#fffaf0", "#c4d2e6", "#a9bbd6", "#ffffff", "#c8d6ea", "#5a8a7a", "#2e7a56", "#c86a4a", "#a8563c", "#5a4a5a", "#ffcf5a", "#9aa0b8", "#2a8a52", "#1c6a3e", "#ffc300", "#e63946", "#f4a300", "#1f9ad6", "#2db84a", "#4a4450", "#ffffff", "#d62839", "#ff7a1a", "#c0392b", "#2a6fd4", "#f4b400", "#ffd27a", "#c81e2a", "#7a5232", "#ffe680", "#b8c0cc"],
    alpha: [0.95, 0.92],
  },
  // Sherlock (sherlockScene.js SH_TONE)
  50: {
    dark: ["#1a2030", "#f1ead2", "#2e3546", "#2a303e", "#222835", "#171b24", "#3a3530", "#2f2b28", "#ffc66a", "#5a544c", "#2a2420", "#7a7f8a", "#22262e", "#3a404a", "#4a4e56", "#ffe2a0", "#ffcf7a", "#a8b4c4", "#0c0e12", "#14161c", "#1a1614", "#eaf6ff", "#fff0c4"],
    light: ["#d8dde6", "#ffffff", "#c4cad6", "#7e8796", "#a3abb8", "#4a505c", "#9a7a64", "#86695a", "#ffd27a", "#e8e0d2", "#7a5a48", "#b8bec8", "#7c838e", "#9aa1ac", "#b4b9c0", "#ffe8a8", "#ffd27a", "#ffffff", "#1c1e24", "#262a32", "#3a2c22", "#ffffff", "#fff6dc"],
    alpha: [0.95, 0.92],
  },
  // Death Note (deathNoteScene.js DN_TONE)
  51: {
    dark: ["#1a1424", "#e8e4dc", "#c8c0d8", "#221c2c", "#1a1a26", "#12121a", "#d8c27a", "#ff3030", "#26262e", "#3a3a44", "#4a4a54", "#2e2e38", "#0c0c10", "#3a3a44", "#ece8dc", "#b8b0a0", "#14141a", "#d4202a", "#ff8a8a", "#3a8a3a", "#07070a", "#0b0b10", "#ff2a2a", "#e8e0d0"],
    light: ["#d8d0e0", "#ffffff", "#e8dcf4", "#b8b0c4", "#9a98ac", "#6e6c80", "#ffd98a", "#e02020", "#8a8a94", "#a8a8b2", "#5a5a64", "#76767f", "#141418", "#4a4a52", "#ffffff", "#c8c0b0", "#14141a", "#d4202a", "#ff9a9a", "#2f8a2f", "#141218", "#1c1a22", "#e01818", "#f4ece0"],
    alpha: [0.95, 0.92],
  },
  // One Piece gök + ufuk (onePieceScene.js OP_TONE)
  52: {
    dark: ["#3a2a5a", "#ff9a5a", "#ffcf6a", "#ff8a3d", "#f2b8a0", "#9a6a8a", "#5a6a9a", "#2a4a7a", "#ffd890", "#5a4a6a", "#2e2a3e", "#1e1c2a", "#3a3448", "#3a6a6a", "#c8b070", "#c84a3a", "#ffe14a", "#ffffff", "#f2c86a", "#d42a2a", "#ffffff"],
    light: ["#4aa8e8", "#bfe6ff", "#fff4c2", "#ffe680", "#ffffff", "#c8dcef", "#5ab0e0", "#2a88c8", "#ffffff", "#8ab4c8", "#4a8a5a", "#2e6a3a", "#8a7a6a", "#3a8a7a", "#e8d090", "#e05a3a", "#ffd23a", "#ffffff", "#f2c86a", "#d42a2a", "#ffffff"],
    alpha: [0.95, 0.92],
  },
  // Naruto (narutoScene.js NR_TONE)
  53: {
    dark: ["#2a2050", "#ff8a4a", "#ffb85a", "#c86a7a", "#3a2e52", "#5a4a5e", "#3e3248", "#2c2236", "#22283a", "#7a6a6a", "#5a4c50", "#a83a3a", "#3a6a72", "#ffcf7a", "#4a4450", "#2a2228", "#1e1a20", "#1a2a22", "#2a4a30", "#5a3a28", "#0e0c12", "#3a5aa8", "#e8e4ec", "#fff2a8", "#7a5232"],
    light: ["#7ac0f0", "#ffe0b0", "#fff0b0", "#ffffff", "#8aa4b8", "#b8a48c", "#958068", "#7a6650", "#5a8a5a", "#efe2cc", "#d6c4a8", "#d8503c", "#3a8a8a", "#ffd27a", "#9a8c80", "#5a4a40", "#3a3230", "#3a6a3a", "#4f9a4a", "#8a5a38", "#1a1820", "#2a4ab8", "#ffffff", "#ffd23a", "#9a6a3a"],
    alpha: [0.95, 0.92],
  },
  // Fullmetal Alchemist (fmaScene.js FM_TONE)
  54: {
    dark: ["#1e2236", "#5a4a6a", "#ffcf8a", "#3a3a52", "#2a2c40", "#6a3e34", "#4e2e28", "#5a5a64", "#2a2e3a", "#ffc86a", "#f4e8c4", "#2e2c34", "#45424c", "#cfd8e8", "#7fd3ff", "#3aa0ff", "#e6f7ff", "#8a8478", "#5e5a52", "#c8242a", "#8a8e98", "#4e525c", "#d8d2c4", "#b8b2a4", "#ff2a4a"],
    light: ["#9ac4e8", "#f4e0c8", "#fff2c8", "#ffffff", "#a8a8b8", "#b0624a", "#8e4a38", "#a8a4a0", "#5a6070", "#ffd27a", "#fff8e0", "#a49c94", "#8a827a", "#ffffff", "#1f7fd6", "#4aa8ff", "#0b5fb3", "#b8b0a2", "#8e8678", "#c8242a", "#7a7e88", "#50545e", "#c8c0ae", "#8a8270", "#e0102e"],
    alpha: [0.95, 0.92],
  },
  // Interstellar (interstellarScene.js tonu)
  55: {
    dark: ["#3a4a7a", "#ffb36a", "#ffd9a0", "#ff8a3d", "#030306", "#9aa4b4", "#ffe6a8", "#2a4458", "#0e1a26", "#3a5468", "#e8f4ff", "#5a7a90", "#1c2e3e", "#c8ccd4", "#7fd3ff", "#fff4dc"],
    light: ["#9ab4e8", "#ffb060", "#ffc070", "#ff7a2a", "#0a0a10", "#5a6474", "#ffcf5a", "#8ab4cc", "#4a7896", "#7a9cb2", "#ffffff", "#6a94ae", "#3a6680", "#4a5058", "#2a9ad6", "#ffffff"],
    alpha: [0.95, 0.92],
  },
  // Stranger Things (strangerScene.js tonu)
  56: {
    dark: ["#e8ecf4", "#2a3040", "#161c26", "#0e131a", "#2e3440", "#20252e", "#1a1d24", "#ffcf7a", "#14171c", "#1a1d22", "#fff2c4", "#ffd08a", "#ff3b3b", "#ffd23a", "#3ad16a", "#3a9aff", "#0a0c10", "#0a0b0e", "#fff4d0", "#7a0e14", "#ff3a2a", "#1a0a0c", "#ff4a3a", "#aab4c4"],
    light: ["#ffffff", "#c8d0dc", "#5a6a62", "#3e4c46", "#d8cfc0", "#bdb3a4", "#6a4a3e", "#ffd27a", "#4a3a32", "#8a8c90", "#fff2c4", "#ffc46a", "#e02424", "#e0a800", "#20a050", "#1a74e0", "#3a3a3a", "#2a2a2e", "#fff0b0", "#c0303a", "#ff5a4a", "#3a1418", "#ff6a5a", "#5a5048"],
    alpha: [0.95, 0.92],
  },
  // Demon Slayer (demonSlayerScene.js tonu)
  57: {
    dark: ["#fff4e0", "#ffe9c4", "#2a2a4a", "#1c1c34", "#121626", "#1a1a24", "#3a2e2a", "#ffd9a0", "#e0402a", "#ffb070", "#0e1018", "#2a1e1e", "#6a3a9a", "#9a5ad0", "#c89af0", "#1e6a4a", "#0c0c0c", "#e8f4ff", "#3a8ad8", "#9ad8ff", "#f0faff", "#20222a", "#1e3a2a"],
    light: ["#ffffff", "#fff4dc", "#9aa4c8", "#7a84ac", "#4a6a5a", "#3a3036", "#c8b49a", "#fff2c8", "#e0402a", "#ffb070", "#7a8a6a", "#5a4036", "#8a5ac0", "#b07ae0", "#e0c4ff", "#2a8a5a", "#111111", "#ffffff", "#1a7ad0", "#5ab8ff", "#ffffff", "#5a5a62", "#3a6a3a"],
    alpha: [0.95, 0.92],
  },
  // Blade Runner (bladeRunnerScene.js tonu)
  58: {
    dark: ["#1f4a5a", "#c8642a", "#141a22", "#ffb35a", "#0e1218", "#ffb04a", "#18202a", "#0a0d12", "#ffcf8a", "#ff3a8a", "#2ad0ff", "#ffb02a", "#a64aff", "#0e1218", "#1a2a3a", "#1a1c22", "#f4f8ff", "#ff3a3a", "#3a7aff", "#9ad8ff"],
    light: ["#9ac0c8", "#e8a060", "#5a6470", "#ffcf7a", "#4a525c", "#ff9a2a", "#7a8692", "#3e4650", "#ffe0a0", "#ff2a7a", "#0aa8e0", "#e89a00", "#8a3ae0", "#5a626c", "#8a9aa8", "#2e3238", "#fff4d0", "#e02020", "#1a5ae0", "#5ab4e0"],
    alpha: [0.95, 0.92],
  },
  // Ghibli dünyası (ghibliScene.js tonu)
  59: {
    dark: ["#3a4458", "#262e3e", "#1e2a3e", "#16241e", "#10201a", "#1c3424", "#1a1410", "#1a3020", "#2e5a3a", "#2a2620", "#3a3430", "#22242e", "#3a2e24", "#ffe2a0", "#ffd08a", "#c8d0dc", "#e8b030", "#0c0e10", "#7a6a4a", "#c8b890", "#ffe8b0", "#fff2c8"],
    light: ["#ffffff", "#dce8f4", "#8ab4d4", "#6aa86a", "#2e7a3e", "#4ea85a", "#5a4030", "#5aa04a", "#a8dc7a", "#c8b088", "#efe4d0", "#4a5a7a", "#6a4a32", "#fff2b0", "#ffe08a", "#3a6ab0", "#f4c430", "#2a2a2e", "#5a8ac8", "#f4f0e0", "#d8ecff", "#fffbe0"],
    alpha: [0.95, 0.92],
  },
  // The Last of Us (lastOfUsScene.js tonu)
  60: {
    dark: ["#ffe2a8", "#2a3436", "#222a2a", "#182020", "#0e1414", "#2e4a2a", "#2a4a26", "#24401f", "#3a6a2e", "#1e3434", "#9ac8c0", "#1a2e1a", "#c8a060", "#5a3a1e", "#0e1210", "#3a4a48"],
    light: ["#fff2c4", "#a8b4b0", "#8a948e", "#6a7470", "#3a4440", "#5a8a46", "#4a7a3a", "#4a8a3a", "#7ab85a", "#7aa0a0", "#ffffff", "#5a8a3e", "#e0b060", "#7a4a20", "#2a3030", "#d8e0d8"],
    alpha: [0.95, 0.92],
  },
  // Jurassic Park (jurassicScene.js tonu)
  61: {
    dark: ["#3a4a46", "#1e2a2c", "#18241f", "#0f1d14", "#1a3320", "#2a4a2a", "#4a3420", "#2a1c10", "#ff9a3a", "#ffe08a", "#3a3a3a", "#6a7a70", "#bfe8ff", "#2a2e26", "#1c201a", "#ffcf3a", "#4a545c", "#2c3a32", "#1e3a1e", "#122612", "#0c140c", "#3a2614"],
    light: ["#d8e4d8", "#8aa094", "#6a8a76", "#4a7a52", "#5a8a4a", "#7aa85a", "#8a6038", "#5a3a1e", "#ff8a2a", "#ffd860", "#5a5a58", "#4a524c", "#3aa0e0", "#5a5e4e", "#3e4236", "#e0a020", "#3a3e42", "#56665e", "#4a8a3a", "#2e6a2a", "#4a5a32", "#6a4424"],
    alpha: [0.95, 0.92],
  },
  // Avatar (avatarScene.js tonu)
  62: {
    dark: ["#1a2a4a", "#3a6a9a", "#a0c8e8", "#c8d8f0", "#3a4450", "#262c36", "#1e4a34", "#2a5a40", "#a8e0ff", "#0e1e2a", "#2c2a3c", "#5af0ff", "#3ae8ff", "#c05aff", "#14384a", "#0a1a24", "#06101a", "#2a4a6a", "#ffcf4a"],
    light: ["#c8e8f0", "#9ac0e0", "#e8f4ff", "#ffffff", "#8a8e94", "#6a6e76", "#3a8a4a", "#4a7a40", "#ffffff", "#7aa898", "#4a4038", "#7adcc8", "#1ab8c8", "#a050d8", "#3a8a6a", "#2a6a52", "#3a6a4a", "#3a6a8a", "#e09a2a"],
    alpha: [0.95, 0.92],
  },
  // Mad Max (madMaxScene.js tonu)
  63: {
    dark: ["#2a1208", "#7a2e10", "#ff8a3a", "#6a3418", "#3a1a0c", "#ffe0b0", "#5a2a12", "#2a1208", "#4a2210", "#3a6a2a", "#a8d8ff", "#8a3e14", "#b8622a", "#4a200c", "#3a2a20", "#160c06", "#6a5a4a", "#0c0806", "#c8763a", "#ff7a1a", "#ffe080"],
    light: ["#ffd8a8", "#ffb070", "#fff0c0", "#d88a4a", "#b8622a", "#ffffff", "#c87a3a", "#8a4a1e", "#a85a28", "#5a8a3a", "#e0f4ff", "#e8a050", "#ffd090", "#c0783a", "#5a4a3e", "#2e2620", "#9a8a78", "#1e1814", "#e0a060", "#ff6a10", "#ffe070"],
    alpha: [0.95, 0.92],
  },
  // Karayip Korsanları (piratesScene.js tonu)
  64: {
    dark: ["#1a2a3a", "#f4f0dc", "#cfe0ff", "#0c1a26", "#10283a", "#1c3e58", "#9ac0d8", "#08121a", "#0e1a14", "#2a1e16", "#100c0a", "#262222", "#3e3a38", "#ffb04a", "#3a2234", "#24141e", "#8a5a6a", "#0a0a0a"],
    light: ["#d8e8f0", "#ffffff", "#fff4d0", "#7aa8c0", "#4a88aa", "#2a6a90", "#ffffff", "#4a6a5a", "#2e6a3a", "#3a2a20", "#1a1410", "#2e2a28", "#4a4440", "#ffb04a", "#7a4a6a", "#5a2e4a", "#c890a8", "#1a1a1a"],
    alpha: [0.95, 0.92],
  },
  // Inception (inceptionScene.js tonu)
  65: {
    dark: ["#2a3040", "#232a38", "#3a3a44", "#22232a", "#2e3440", "#1a1e28", "#ffcf7a", "#8a1e24", "#e8dcc8", "#ffd890", "#16181e", "#2a1a12", "#5a3a24", "#9aa0a8", "#e8eef4", "#3a4048", "#2c3446", "#4a5468"],
    light: ["#e4e8ee", "#b8bcc4", "#d8cdb8", "#a89c88", "#5a6470", "#6a7888", "#ffd88a", "#b02a30", "#f4ece0", "#ffd060", "#9a958c", "#5a3a24", "#8a6040", "#8a9098", "#ffffff", "#4a5058", "#a8b0bc", "#e8ecf0"],
    alpha: [0.95, 0.92],
  },
  // Titanic (titanicScene.js tonu)
  66: {
    dark: ["#1a2438", "#f0f0e4", "#050a12", "#0e1a2a", "#0a0a0c", "#6a1a1a", "#d8d4c8", "#8a8a84", "#c8963a", "#121212", "#2a2a2a", "#ffd88a", "#6a6a70", "#d8ecf8", "#8ab0c8", "#4a7a9a", "#0a0a0c", "#ffffff"],
    light: ["#e0e8f0", "#ffffff", "#2a5a7a", "#6a9ab8", "#1a1a1e", "#a02020", "#ffffff", "#b8b8b0", "#e0a040", "#1a1a1a", "#3a3a3a", "#ffe0a0", "#d8d8d8", "#ffffff", "#b8d4e8", "#8ab8d8", "#1a1a1e", "#ffffff"],
    alpha: [0.95, 0.92],
  },
  // Dark (darkScene.js tonu)
  67: {
    dark: ["#1a1e22", "#141a1a", "#0e1414", "#080c0c", "#3a3e40", "#24282a", "#6a7074", "#ff2a2a", "#2a2e2c", "#181c1a", "#020303", "#3a3a36", "#f0c020", "#fff4c0", "#000000", "#c8d0ff", "#e8ecff", "#0a0e0c"],
    light: ["#b8bec4", "#6a7a76", "#3e504a", "#24302c", "#a8acb0", "#7a8084", "#e4e8ec", "#e02020", "#7a7e7a", "#5a5e5a", "#1a1c1c", "#5a5a56", "#f0c020", "#fff8d0", "#101010", "#5a6aa8", "#2a3a7a", "#3a4a40"],
    alpha: [0.95, 0.92],
  },
  // Squid Game (squidGameScene.js tonu)
  68: {
    dark: ["#1e3a6a", "#3a6aa8", "#a8c0e0", "#2a2e3a", "#6a5a3e", "#8a7a5a", "#2a2018", "#d86a1a", "#e8c030", "#e8c8a8", "#141414", "#e8e8e8", "#ff2020", "#1e6a5a", "#e8f0e8", "#e04a8a", "#141414", "#f0f0f0", "#ff1a1a"],
    light: ["#5aa8e8", "#a8d4f4", "#ffffff", "#d8d8d8", "#d8b888", "#b89868", "#4a3a2a", "#f07a20", "#ffd030", "#f8d8b8", "#1a1a1a", "#ffffff", "#ff2020", "#2a8a72", "#ffffff", "#f05a9a", "#1a1a1a", "#ffffff", "#ff2020"],
    alpha: [0.95, 0.92],
  },
  // Hunter x Hunter (hunterScene.js tonu)
  69: {
    dark: ["#1a2a40", "#3a4a66", "#26324a", "#0e2236", "#1e3e5a", "#2a3448", "#1c2434", "#14301e", "#1e4a2a", "#2a1e16", "#163a20", "#26582e", "#3a3e44", "#24282c", "#6a4a2a", "#c8d0d8", "#ff5a3a", "#3a4a52", "#5a7080", "#c8c0a8", "#6a3a2a", "#cfe8ff", "#12304a"],
    light: ["#e0f0ff", "#ffffff", "#d8e4f0", "#2a7ab0", "#7ac0e8", "#8a96a8", "#6a7688", "#5aa04a", "#7ac85a", "#6a4a2a", "#3a8a3a", "#6ab848", "#8a8a86", "#5a5a58", "#8a5a2a", "#3a3a3a", "#ff4a2a", "#4a5a62", "#7a9098", "#f0e8d0", "#b05a3a", "#ffffff", "#4a9ac8"],
    alpha: [0.95, 0.92],
  },
  // Jujutsu Kaisen (jujutsuScene.js tonu)
  70: {
    dark: ["#f4f0ff", "#b8a8ff", "#1a1630", "#1a1a2c", "#141420", "#0c0c16", "#ffd890", "#ff3a8a", "#2ad0ff", "#1a1a22", "#3a2a2a", "#120c0e", "#d02a2a", "#0a0a10", "#8a3aff", "#ff3a3a", "#3a7aff", "#ff2a3a", "#9a3aff", "#f4e8ff"],
    light: ["#ffffff", "#d8d0ff", "#e0dcf0", "#9a9ab0", "#6a6a84", "#4a4a60", "#fff0b0", "#ff4a9a", "#2ab8f0", "#3a3a44", "#a07a6a", "#4a3a3a", "#e03030", "#5a5a68", "#7a3ad8", "#d02020", "#2a6aff", "#ff2a3a", "#8a2ae0", "#ffffff"],
    alpha: [0.95, 0.92],
  },
  // vikings (components/decor/vikingsScene.js VIK_TONE): [deniz, derin su, parıltı, kaya, aydınlık kaya,
  //  taş, çatı, ahşap, ateş, sis/duman, çimen, pencere, gece]
  31: {
    dark: ["#1f4058", "#0b1d2c", "#cfe8f5", "#23272d", "#4f5862", "#6f6d66", "#2c3036", "#5a3a1e", "#ff8a2a", "#8aa0b4", "#24352a", "#ffc46a", "#070d14"],
    light: ["#5b9bc4", "#2a6a92", "#ffffff", "#5a5e64", "#8a929c", "#b4b0a6", "#55606c", "#7a5230", "#ff7a1a", "#e2eaf2", "#5f7a52", "#ffb84a", "#30485e"],
    alpha: [0.95, 0.9],
  },
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
