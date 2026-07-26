// components/badges/seasonSeals.js
//
// DÖNEM MÜHÜRLERİ — zamanın kendisi bir eksen.
//
// Katalogdaki her rozet ÖMÜR BOYU birikimlidir: bugün de, üç yıl sonra da aynı
// hedefi kovalarsın. Mühür bunun tam tersidir — zor olduğu için değil, GERİ
// ALINAMAZ olduğu için özeldir: o mevsimde buradaydın ya da değildin. Kaçırılan
// bir mühür bir daha asla kazanılamaz, bu yüzden sahip olmak bir şey anlatır.
//
// ÖLÇÜT SAHTELENEMEZ. Katalogun 2. kuralı ("tarih türevi rozet tavanı = rare")
// kullanıcının SEÇTİĞİ izleme tarihinin uydurulabilir olmasından doğar
// (DatePickerModal geçmişe onlarca yıl açık). Mühürler o tarihi HİÇ okumaz;
// kaynakları defterdeki `aktiflik.gunler` — cihaz saatiyle gerçek işaretleme
// anından türeyen, geriye dönük düzeltilemeyen gün listesi (utils/watchActivity.js).
// Yine de cihaz saati sunucu doğrulamalı olmadığı için tavan rare'dir; eşik
// zaten düşük tutuldu, amaç zorluk değil VARLIK.
//
// GERİYE DÖNÜK MÜHÜR YOKTUR. `ILK_DONEM`den önceki dönemler hiç üretilmez:
// yayın anında "2024 Kışı"nı kilitli göstermek, kullanıcıya asla kapatamayacağı
// bir boşluk göstermek olurdu. Ayrıca `gunler` 400 günlük kayan pencere; daha
// eskisi zaten ölçülemez. Kazanılan mühür deftere (earned) yazıldığı için
// pencereden düşse bile KALICIDIR.
//
// SAF MODÜL: React/AsyncStorage/Firestore importu yok.

import { RARITY } from "@theme/badgeTokens";
import { BOLUM } from "./watchBadgeCatalog";

/** Dönemde kaç FARKLI günde işaretleme yapılmalı. */
export const MUHUR_ESIK = 8;

/**
 * Mühür sisteminin başladığı dönem. Bundan öncesi için mühür üretilmez.
 * Yeni dönemler kendiliğinden gelir; bu sabit yalnızca ALT sınırdır.
 */
export const ILK_DONEM = "2026-yaz";

// Kuzey yarımküre mevsimleri. Aralık, TAKİP EDEN yılın kışına sayılır — yoksa
// tek bir kış iki ayrı mühre bölünür ve ikisi de eşiğe ulaşamaz.
const DONEM_TANIM = [
  { id: "kis", aylar: [12, 1, 2], icon: "snow-outline", iconSolid: "snow", tr: "Kışı", en: "Winter" },
  { id: "ilkbahar", aylar: [3, 4, 5], icon: "flower-outline", iconSolid: "flower", tr: "İlkbaharı", en: "Spring" },
  { id: "yaz", aylar: [6, 7, 8], icon: "sunny-outline", iconSolid: "sunny", tr: "Yazı", en: "Summer" },
  { id: "sonbahar", aylar: [9, 10, 11], icon: "leaf-outline", iconSolid: "leaf", tr: "Sonbaharı", en: "Autumn" },
];

const DONEM_BY_AY = (() => {
  const m = {};
  for (const d of DONEM_TANIM) for (const ay of d.aylar) m[ay] = d;
  return m;
})();

export const DONEM_BY_ID = Object.freeze(
  DONEM_TANIM.reduce((acc, d) => { acc[d.id] = d; return acc; }, {}),
);

/** "YYYY-MM-DD" → { yil, donem } · geçersizse null. */
export function donemBilgisi(gunKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(gunKey || ""));
  if (!m) return null;
  const yil = Number(m[1]);
  const ay = Number(m[2]);
  const d = DONEM_BY_AY[ay];
  if (!d) return null;
  // Aralık → gelecek yılın kışı (kış Ara-Oca-Şub olarak tek parça kalsın).
  return { yil: ay === 12 ? yil + 1 : yil, donem: d.id };
}

export const donemAnahtari = (gunKey) => {
  const b = donemBilgisi(gunKey);
  return b ? `${b.yil}-${b.donem}` : null;
};

export const muhurId = (anahtar) => `muhur_${String(anahtar).replace("-", "_")}`;

/** `muhur_2026_yaz` → { yil, donem, anahtar } · tanınmazsa null. */
export function muhurCoz(id) {
  const m = /^muhur_(\d{4})_([a-z]+)$/.exec(String(id || ""));
  if (!m || !DONEM_BY_ID[m[2]]) return null;
  return { yil: Number(m[1]), donem: m[2], anahtar: `${m[1]}-${m[2]}` };
}

// Dönem sıralaması: kış(1) → ilkbahar(2) → yaz(3) → sonbahar(4)
const SIRA = { kis: 1, ilkbahar: 2, yaz: 3, sonbahar: 4 };
const donemSayi = (anahtar) => {
  const [y, d] = String(anahtar).split("-");
  return Number(y) * 10 + (SIRA[d] || 0);
};
const ILK_DONEM_SAYI = donemSayi(ILK_DONEM);

/** Verilen an hangi döneme düşüyor? */
export function bugunkuDonem(simdi = Date.now()) {
  const d = new Date(simdi);
  const gun = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  return donemAnahtari(gun);
}

const baslikTr = (yil, donem) => `${yil} ${DONEM_BY_ID[donem]?.tr || ""}`.trim();
const baslikEn = (yil, donem) => `${DONEM_BY_ID[donem]?.en || ""} ${yil}`.trim();

/**
 * Mühür kartlarını üretir — ROZET ŞEKLİNDE, WatchBadgeCard değişmeden çizer.
 *
 * Gösterilenler: (a) İÇİNDE BULUNULAN dönem — kilitliyken ilerleme çubuğuyla,
 * (b) defterde kazanılmış geçmiş mühürler. Gelecek dönemler ve kaçırılmış
 * dönemler HİÇ üretilmez: ilki anlamsız, ikincisi kapatılamayan bir boşluk.
 *
 * @param {string[]} aktifGunler defterdeki gerçek işaretleme günleri
 * @param {object} opts { simdi, kazanilmis }
 */
export function muhurleriHesapla(aktifGunler, { simdi = Date.now(), kazanilmis = [] } = {}) {
  const defter = kazanilmis instanceof Set ? kazanilmis : new Set(kazanilmis || []);

  // Dönem → farklı gün adedi
  const sayac = new Map();
  for (const g of Array.isArray(aktifGunler) ? aktifGunler : []) {
    const anahtar = donemAnahtari(g);
    if (!anahtar || donemSayi(anahtar) < ILK_DONEM_SAYI) continue;
    sayac.set(anahtar, (sayac.get(anahtar) || 0) + 1);
  }

  const suan = bugunkuDonem(simdi);
  const anahtarlar = new Set();
  if (suan && donemSayi(suan) >= ILK_DONEM_SAYI) anahtarlar.add(suan);
  for (const id of defter) {
    const c = muhurCoz(id);
    if (c) anahtarlar.add(c.anahtar);
  }

  return [...anahtarlar]
    .sort((a, b) => donemSayi(b) - donemSayi(a))     // en yeni dönem üstte
    .map((anahtar) => {
      const [yilStr, donem] = anahtar.split("-");
      const yil = Number(yilStr);
      const tanim = DONEM_BY_ID[donem];
      const id = muhurId(anahtar);
      const gun = sayac.get(anahtar) || 0;
      const ilerleme = Math.min(gun, MUHUR_ESIK);
      return {
        id,
        section: BOLUM.MUHUR,
        family: null,
        tier: 0,
        hidden: false,
        birim: null,
        icon: tanim.icon,
        iconSolid: tanim.iconSolid,
        rarity: RARITY.uncommon,
        tr: baslikTr(yil, donem),
        en: baslikEn(yil, donem),
        descTr: `${baslikTr(yil, donem)} döneminde ${MUHUR_ESIK} farklı günde işaretle`,
        descEn: `Log on ${MUHUR_ESIK} separate days during ${baslikEn(yil, donem)}`,
        donem,
        yil,
        guncelDonem: anahtar === suan,
        ham: gun,
        target: MUHUR_ESIK,
        ilerleme,
        oran: ilerleme / MUHUR_ESIK,
        // Defter üyeliği kalıcıdır: 400 günlük pencereden düşen eski dönem
        // yeniden hesaplanamaz, `earned` onu ayakta tutar.
        acik: defter.has(id) || gun >= MUHUR_ESIK,
      };
    });
}

/**
 * Deftere bildirilecek mühür id'leri. Güncel dönem HER ZAMAN listede olmalı:
 * defter bir id'yi ancak ÖNCEDEN "biliyorsa" kazanıldığında kutlar; ilk kez
 * kazanıldığı anda görülen id sessizce emilir ve kutlama hiç oynamaz.
 */
export function muhurIdleri({ simdi = Date.now(), kazanilmis = [] } = {}) {
  const out = new Set();
  const suan = bugunkuDonem(simdi);
  if (suan && donemSayi(suan) >= ILK_DONEM_SAYI) out.add(muhurId(suan));
  for (const id of kazanilmis instanceof Set ? kazanilmis : kazanilmis || []) {
    if (muhurCoz(id)) out.add(id);
  }
  return [...out];
}
