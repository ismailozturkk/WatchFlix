// theme/badgeTokens.js
//
// Rozet sisteminin TEK doğruluk kaynağı: nadirlik merdiveni + geometri.
// Rozetler dosya DEĞİL, matematiktir — bkz. components/badges/AppBadge.js.
//
// ALTIN KURALI: #F5C518 bu uygulamada şampiyon/final/premium demektir
// (BracketTree, PodiumModal, MatchCard, TournamentWidget). Bu yüzden altın
// SADECE "legendary" kademesinde yaşar ve o kademede yalnızca üç şey vardır:
// Kurucu rozeti, Premium Unlimited ve target > 500 olan başarımlar. Altını
// merdivenin alt kademelerine yaymak, uygulamanın her yerindeki "şampiyon"
// anlamını öldürür.
//
// Nadirlik renkleri glyph rengiyle YARIŞMAZ: glyph zaten nadirlik rengidir,
// gövde ise aynı rengin soluk gradyanıdır. 50 rozet yan yana geldiğinde göz
// 5 renk grubu görür, 50 rastgele renk değil.

export const GOLD = "#F5C518";

export const RARITY = Object.freeze({
  common: "common",
  uncommon: "uncommon",
  rare: "rare",
  epic: "epic",
  legendary: "legendary",
});

// Merdivenin sırası (ilerleme/karşılaştırma için).
export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

// theme'e bağımlı olanlar fonksiyon, sabitler düz değer.
// rim  : gövde kenar kalınlığı (nadirlik gri tonlamada da okunsun diye artar)
// glow : dışa vuran gölge rengi (yalnız rare ve üstü)
const LADDER = {
  common:    { color: (t) => t.text.muted,            rim: 1.2, glow: null,                     halo: 0 },
  uncommon:  { color: (t) => t.accent,                rim: 1.5, glow: null,                     halo: 0 },
  rare:      { color: () => "#C084FC",                rim: 1.8, glow: "rgba(192,132,252,0.38)", halo: 0.10 },
  epic:      { color: () => "#22D3EE",                rim: 2.0, glow: "rgba(34,211,238,0.38)",  halo: 0.13 },
  legendary: { color: () => GOLD,                     rim: 2.2, glow: "rgba(245,197,24,0.45)",  halo: 0.16 },
};

export function rarityStyle(rarity, theme) {
  const def = LADDER[rarity] || LADDER.common;
  return {
    key: LADDER[rarity] ? rarity : "common",
    color: def.color(theme),
    rim: def.rim,
    glow: def.glow,
    halo: def.halo,
  };
}

// Başarımın hedefinden nadirlik türet. Katalogda `rarity` yazılmışsa o kazanır;
// yazılmamışsa mevcut 9 başarım dahil her kayıt otomatik doğru kademeye düşer.
//   1 → common · 25'e kadar uncommon · 100'e kadar rare · 500'e kadar epic
//   500 üstü → legendary (bugün yalnız score_hunter/1000)
export function resolveRarity(target) {
  const n = Number(target) || 0;
  if (n <= 1) return RARITY.common;
  if (n <= 25) return RARITY.uncommon;
  if (n <= 100) return RARITY.rare;
  if (n <= 500) return RARITY.epic;
  return RARITY.legendary;
}

// ─── Perde (izleme seviyesi) renk bantları ───────────────────────────────────
// 20 perde, 5 renk bandı — 4 perdede bir değişir (computePerde().banded).
// Her perdeye ayrı renk vermek, ProfileStatsContext'in `getDynamicRankColor`
// hue döndürmesiyle aynı hataya düşerdi: 20 rastgele renk kimlik üretmez.
//
// ALTIN YOK. Perde 20 bile altın değildir — altın yalnız legendary rozette
// yaşar (yukarıdaki ALTIN KURALI). Perde 20'nin ödülü `perde_20` rozetidir ve
// ALTIN ORADA parlar; kartın kendisi değil.
// Her bandın İKİ tonu var. Uygulamada 7 tema var ve ikisi (light, green) AÇIK
// zeminli: light primary #EDF0F5, green primary #B9CEC7. Tek bir parlak ton
// (örn. #22D3EE) beyaz zeminde 1.5:1 kontrastla okunmaz hale geliyordu.
const PERDE_BANDS = [
  { koyu: null,      acik: null      },   // 1-4   : tema accent'i (aşağıda)
  { koyu: "#38BDF8", acik: "#0369A1" },   // 5-8   : gök
  { koyu: "#22D3EE", acik: "#0E7490" },   // 9-12  : camgöbeği
  { koyu: "#C084FC", acik: "#7E22CE" },   // 13-16 : mor
  { koyu: "#FB7185", acik: "#BE123C" },   // 17-20 : gül
];

// Zemin açık mı? Basit algılanan parlaklık (ITU-R BT.601).
function acikZemin(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 140;
}

// Bir renk ALTINA yakın mı? `amber` temasının accent'i #F59E0B ve GOLD #F5C518
// ile neredeyse aynı. Band 1 tema accent'ini kullandığı için, o temada Perde
// kartı altın parlar ve bu dosyanın kendi ALTIN KURALI'nı ihlal eder — altın
// yalnız legendary'de yaşamalı. Bu yüzden accent altına yakınsa band 1 gök
// tonuna düşer.
function altinaYakin(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const g = parseInt(GOLD.slice(1), 16);
  const d = Math.abs(((n >> 16) & 255) - ((g >> 16) & 255))
    + Math.abs(((n >> 8) & 255) - ((g >> 8) & 255))
    + Math.abs((n & 255) - (g & 255));
  return d < 90;
}

/** @param {number} banded  computePerde().banded (1..5) */
export function perdeStyle(banded, theme) {
  const i = Math.max(1, Math.min(Number(banded) || 1, PERDE_BANDS.length)) - 1;
  const acik = acikZemin(theme?.primary);
  if (i === 0) {
    const accent = theme?.accent;
    if (!altinaYakin(accent)) return { color: accent, band: 1 };
    return { color: acik ? PERDE_BANDS[1].acik : PERDE_BANDS[1].koyu, band: 1 };
  }
  return { color: acik ? PERDE_BANDS[i].acik : PERDE_BANDS[i].koyu, band: i + 1 };
}

// ─── Geometri (100x100 viewBox, ölçekten bağımsız) ───────────────────────────
export const BADGE_GEO = Object.freeze({
  VIEWBOX: 100,
  R_BODY: 46,      // altıgen çevrel yarıçapı (VARSAYILAN silüet)
  CORNER: 9,       // köşe yuvarlatma
  INNER: 0.8,      // iç çokgen ölçeği (gövde dolgusu)
  SHEEN: 0.9,      // iç kenar parıltısı ölçeği
  R_ARC: 46,       // ilerleme yayı yarıçapı
  GLYPH: 0.42,     // glyph kutusu / rozet boyutu
});

// ─── Kademe merdiveni: KENAR SAYISI + KADEME RENGİ ───────────────────────────
// Kademe İKİ kanaldan birden okunur: kenar sayısı (4→8) ve gövde rengi
// (gri → mavi → mor → zümrüt → altın). Bu ikisi birbirinin YEDEĞİdir, süsü
// değil — ölçüldü: 52px'lik bir rozette 6-gen ile 7-gen arasındaki en geniş
// nokta farkı 0,78 PİKSEL, 7-gen ile 8-gen arasında 0,56 piksel. Üstelik köşe
// yuvarlaması kenarların ~%39'unu yiyor, yani 7 ve 8 kenar tek başına daireye
// yakınsıyor ve ayırt EDİLEMEZ. Renk olmasaydı bu iki şekil eklenemezdi;
// renkle birlikte kademe her boyutta anında okunur.
//
// ÜÇGEN YOK. Aynı yarıçapta üçgenin alanı altıgenin YARISI kadar (1.299 R²'ye
// karşı 2.598 R²); raf içinde "sönük" durur ve glyph'e dar bir iç daire bırakır
// (iç yarıçap R/2). Merdiven kareden başlar.
//
// Yarıçaplar alan farkını KISMEN telafi eder: kare 2.000 R², beşgen 2.378,
// altıgen 2.598, yedigen 2.736, sekizgen 2.828. Altıgen dışındaki hepsi 47
// (viewBox sınırı 50, yay için pay şart); ALTIGEN 46'DA KALIR — AppBadge'i oyun
// başarımları ve kimlik rozetleri de kullanıyor, varsayılan silüetin boyutu
// değişemez.
//
// Köşe yarıçapı kenar uzunluğuyla ÖLÇEKLENİR (n-gen kenarı = 2·r·sin(π/n)):
// sabit 9 kullanmak karenin köşelerini orantısal olarak keskinleştirip
// "aynı aile" hissini bozardı. Oran her şekilde ≈0.196 kenar.
export const KENAR_GEO = Object.freeze({
  4: { r: 47, corner: 13.0 },   // kenar 66.5 → 9 × 66.5/46
  5: { r: 47, corner: 10.8 },   // kenar 55.3
  6: { r: 46, corner: 9.0 },    // bugünkü altıgen, DEĞİŞMEDİ
  7: { r: 47, corner: 8.0 },    // kenar 40.8
  8: { r: 47, corner: 7.0 },    // kenar 36.0
});

// Kademe rengi. İki tonlu, `perdeStyle` ile aynı gerekçe: uygulamada 7 tema var
// ve ikisi (light, green) AÇIK zeminli; tek bir parlak ton beyaz üstünde 1.5:1
// kontrastla okunmuyor.
//
// ALTIN KURALI GÜNCELLENDİ. Altın (#F5C518) bu uygulamada şampiyon/final demek
// ve eskiden YALNIZCA legendary nadirlikte yaşıyordu. Artık ikinci bir yerde
// daha yaşıyor: kademe 5, yani bir ailenin BEŞİNCİ basamağı. Bu kural ihlali
// DEĞİL, kuralın kendi mantığının uygulanmasıdır — altın "zirve" demek ve
// beşinci kademe gerçekten zirvedir. Kural şu hâliyle geçerli: altın merdivenin
// ALT kademelerinde asla görünmez.
const KADEME_RENK = [
  null,                                   // 0 · ailesiz → nadirlik rengine düşer
  { koyu: "#9CA3AF", acik: "#4B5563" },   // 1 · kare     · gri
  { koyu: "#38BDF8", acik: "#0369A1" },   // 2 · beşgen   · mavi
  { koyu: "#C084FC", acik: "#7E22CE" },   // 3 · altıgen  · mor
  { koyu: "#34D399", acik: "#047857" },   // 4 · yedigen  · zümrüt
  { koyu: "#F5C518", acik: "#B45309" },   // 5 · sekizgen · altın
];

/** Kademe rengi; ailesiz rozette (kademe 0) `null` döner → nadirlik rengi kullanılır. */
export function kademeRengi(kademe, theme) {
  const def = KADEME_RENK[Math.max(0, Math.floor(Number(kademe) || 0))];
  if (!def) return null;
  return acikZemin(theme?.primary) ? def.acik : def.koyu;
}

/**
 * Aile kademesinden siluet + renk kademesi.
 * @param {number} tier        rozetin aile içi kademesi (0 = ailesiz)
 * @param {number} aileToplam  ailedeki kademe sayısı
 */
export function kademeSekli(tier = 0, aileToplam = 0) {
  const t = Math.max(0, Math.floor(Number(tier) || 0));
  const toplam = Math.max(0, Math.floor(Number(aileToplam) || 0));
  // Ailesiz rozet (50 rozetin ~21'i) BUGÜNKÜ görünümünde kalır: altıgen ve
  // NADİRLİK rengi. Kenar merdiveni yalnızca gerçekten merdiveni olan yerde
  // anlamlı — kare bir "Cadılar Gecesi" rozeti hiçbir ilerleme ifade etmezdi.
  if (!t) return { kenar: 6, ornate: false, kademe: 0 };
  // KADEME AİLE İÇİNDEKİ KONUMDAN TÜRER, mutlak tier'dan DEĞİL.
  //
  // Mutlak eşleme ölçüldü ve kırıktı: 3 kademeli `perde` ailesinin zirvesi
  // — `perde_20` "Beyazperde Efsanesi", legendary, sistemin EN TEPE rozeti —
  // kademe 3'e düşüyor ve MOR altıgen çiziliyordu; altını hiç görünmüyordu.
  // Aynı hatayla `perde_14` (epic) ile `film_50` (uncommon) aynı maviyi
  // paylaşıyordu. Oranla eşlemede her ailenin SON kademesi 5'e, yani altın
  // sekizgene oturur; ilk kademesi 1'e oturur; aradakiler eşit dağılır.
  //
  // Aile 5 kademeliyse eşleme birebir olur (1→1 … 5→5), yani bugünkü film ve
  // bölüm aileleri hiç değişmez.
  const kademe = toplam > 1
    ? Math.min(5, Math.max(1, Math.round(1 + ((t - 1) * 4) / (toplam - 1))))
    : Math.min(5, t);
  // `ornate` iç konturu artık kademeyi değil TAMAMLANMAYI işaretler: beş ayrı
  // şekil+renk kademeyi zaten söylüyor, ama "bu ailenin sonuna geldin" bilgisi
  // hiçbir kanalda yoktu. Aile uzunluğundan bağımsız çalışır.
  return { kenar: 3 + kademe, ornate: toplam > 0 && t >= toplam, kademe };
}

// Küçük boyutlarda katman azalt (LOD) — 26px'te sheen/halo gürültü yapar.
export const badgeDetail = (size) => ({
  sheen: size >= 40,
  halo: size >= 56,
  arc: size >= 36,
});
