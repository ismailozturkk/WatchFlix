// components/badges/badgeSets.js
//
// KOLEKSİYONLAR — rozetlerin ÜSTÜNDEKİ kademe.
//
// Aile içi kademe ekseni doldu: `kademeSekli` beş şekil + beş renk taşıyor ve
// katalogun kendi testi 7-gen ile 8-gen'in çıplak gözle ayrılamadığını ölçüyor.
// Yani "daha yüksek kademe" görsel olarak yeni bir şey söylemiyor. Yeni kademe
// ailenin İÇİNE değil ÜSTÜNE kuruldu: bir koleksiyon, tek bir sayacı büyüterek
// değil BAŞKA ROZETLERİ toplayarak açılır.
//
// İKİ FAYDASI VAR:
//   • Var olan 81 rozetin hepsini daha değerli yapar — tek başına "önemsiz"
//     görünen bir mevsimsel rozet artık bir setin eksik parçasıdır.
//   • Yeni ölçüt, yeni sayaç, yeni Firestore alanı GEREKTİRMEZ. Girdi zaten
//     hesaplanmış rozet listesidir; maliyeti bir dizi taraması kadardır.
//
// KATALOGDAN AYRI DURUR: `WATCH_BADGES` içine konsaydı `getProgress(stats)`
// sözleşmesini bozardı (koleksiyonun girdisi stats değil, rozetlerin kendisi)
// ve katalog testlerindeki sayımlar anlamını yitirirdi.
//
// NADİRLİK: legendary YOK. Panteon üç legendary rozeti birden istediği hâlde
// epic'te bırakıldı — kota (3) katalogun enflasyona karşı tek sigortası ve
// koleksiyonlar o sigortayı dolaylı yoldan delmemeli.

import { RARITY } from "@theme/badgeTokens";
import { BOLUM, WATCH_BADGES } from "./watchBadgeCatalog";

const idler = (fn) => WATCH_BADGES.filter(fn).map((b) => b.id);

// Her ailenin BELİRLİ kademesi. 3 kademeli ailelerde 4. kademe yoktur; bu
// yüzden "kademe >= n" değil "o ailenin n. kademesi VARSA" mantığı kullanılır.
const kademeIdleri = (tier) => idler((b) => b.family && b.tier === tier);

// Her ailenin ZİRVESİ (aile uzunluğu 3–5 arasında değiştiği için sabit tier ile
// bulunamaz).
const zirveIdleri = () => {
  const enYuksek = new Map();
  for (const b of WATCH_BADGES) {
    if (!b.family) continue;
    const m = enYuksek.get(b.family);
    if (!m || b.tier > m.tier) enYuksek.set(b.family, b);
  }
  return [...enYuksek.values()].map((b) => b.id);
};

/**
 * Koleksiyonlar. `uyeler` ÇALIŞMA ANINDA hesaplanır (fonksiyon), sabit dizi
 * değil: katalog büyüdüğünde set kendiliğinden güncellenir, elle liste bakımı
 * gerekmez — ve bir rozet katalogdan çıkarsa sette hayalet id kalmaz.
 */
export const BADGE_SETS = [
  {
    id: "set_ilk_adim",
    icon: "footsteps-outline", iconSolid: "footsteps", rarity: RARITY.uncommon,
    tr: "Merdivenin Başı", en: "First Rungs",
    descTr: "Her ailenin ilk kademesini aç", descEn: "Unlock the first tier of every family",
    uyeler: () => kademeIdleri(1),
  },
  {
    id: "set_mevsim",
    icon: "snow-outline", iconSolid: "snow", rarity: RARITY.rare,
    tr: "Mevsim Kolyesi", en: "Season Necklace",
    descTr: "Tüm mevsimsel rozetleri topla", descEn: "Collect every seasonal badge",
    uyeler: () => idler((b) => b.section === BOLUM.MEVSIM),
  },
  {
    id: "set_uzman",
    icon: "ribbon-outline", iconSolid: "ribbon", rarity: RARITY.rare,
    tr: "Tür Uzmanı", en: "Genre Specialist",
    descTr: "Dört tür uzmanlık rozetini de kazan", descEn: "Earn all four genre specialist badges",
    // Tür ailesinin kademeleri DEĞİL, tek tek tür rozetleri (korku/animasyon/
    // belgesel/komedi): çeşitlilik değil DERİNLİK ölçen set budur.
    uyeler: () => idler((b) => b.section === BOLUM.TUR && !b.family),
  },
  {
    id: "set_yari_yol",
    icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.rare,
    tr: "Yarı Yol", en: "Halfway",
    descTr: "Her ailenin 3. kademesine ulaş", descEn: "Reach the 3rd tier of every family",
    uyeler: () => kademeIdleri(3),
  },
  {
    id: "set_sir",
    icon: "eye-outline", iconSolid: "eye", rarity: RARITY.epic,
    tr: "Sır Toplayıcı", en: "Secret Keeper",
    descTr: "Tüm gizli rozetleri ortaya çıkar", descEn: "Uncover every hidden badge",
    uyeler: () => idler((b) => b.hidden),
  },
  {
    id: "set_panteon",
    icon: "trophy-outline", iconSolid: "trophy", rarity: RARITY.epic,
    tr: "Panteon", en: "Pantheon",
    descTr: "Her ailenin zirvesine ulaş", descEn: "Reach the peak of every family",
    uyeler: zirveIdleri,
  },
];

export const BADGE_SET_IDS = Object.freeze(BADGE_SETS.map((s) => s.id));

export const BADGE_SET_BY_ID = Object.freeze(
  BADGE_SETS.reduce((acc, s) => { acc[s.id] = s; return acc; }, {}),
);

/**
 * Koleksiyonları ROZET ŞEKLİNDE değerlendirir — dönen nesneler WatchBadgeCard'ın
 * beklediği alanların tamamını taşır, böylece ekranda tek satır değişiklik
 * olmadan çizilirler.
 *
 * @param {Array} degerlendirilmis evaluateWatchBadges() çıktısı
 * @param {Set<string>|string[]} kazanilmis defterdeki monoton "earned" kümesi
 */
export function evaluateBadgeSets(degerlendirilmis, kazanilmis) {
  const acikSet = new Set((degerlendirilmis || []).filter((b) => b.acik).map((b) => b.id));
  const defter = kazanilmis instanceof Set ? kazanilmis : new Set(kazanilmis || []);

  return BADGE_SETS.map((s) => {
    const uyeler = s.uyeler();
    const target = uyeler.length;
    const ilerleme = uyeler.filter((id) => acikSet.has(id)).length;
    // Defter üyeliği burada da kazandırır: koleksiyonu bir kez tamamlayan
    // kullanıcı, sonradan bir kaydını silse bile koleksiyonu kaybetmez.
    const acik = defter.has(s.id) || (target > 0 && ilerleme >= target);
    return {
      ...s,
      section: BOLUM.SET,
      family: null,
      tier: 0,
      hidden: false,
      birim: null,
      uyeIdleri: uyeler,
      ham: ilerleme,
      target,
      ilerleme,
      oran: target > 0 ? Math.min(1, ilerleme / target) : 0,
      acik,
    };
  });
}
