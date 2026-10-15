// components/badges/badgeInsights.js
//
// Rozet ekranının SORULARINI cevaplayan saf fonksiyonlar. React, depolama ve
// Firestore importu YOK (jest yalnızca böyle modülleri çalıştırabilir) — ekran
// bu dosyadan "sıradaki hedefim ne?", "bu hafta ne kazandım?", "hangi bölümde
// kaçıncıyım?" cevaplarını hazır alır, kendisi hesaplamaz.
//
// NEDEN AYRI MODÜL: aynı mantık üç yerde kopyalanmıştı. WatchLevelCard "hedefe en
// yakın iki rozet"i kendi useMemo'sunda kuruyordu, rozet ekranı bölüm içi sırayı
// kendi sort'unda, WatchBadgeStrip rafı kendi sort'unda. Üçü de aynı "peşinde
// koşulacak hedef" tanımına (`sonrakiHedef` ya da kilitli kartın kendisi)
// dayanıyor ve birinde olan düzeltme diğerine gitmiyordu. Tanım artık TEK yerde.
//
// GİRDİ KARTLARDIR (gruplaAileler çıktısı, kartın üstünde `kazanmaTarihi` ile):
// kademeli aile tek karttır ve kimliği ULAŞILAN kademeden gelir; peşinde koşulan
// hedef ayrı bir alanda (`sonrakiHedef`) taşınır.

import { RARITY_ORDER } from "@theme/badgeTokens";
import { BOLUM_SIRA } from "./watchBadgeCatalog";

const GUN_ANAHTARI = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" → epoch'tan itibaren takvim günü. Geçersizse NaN. */
export function gunNo(anahtar) {
  const m = GUN_ANAHTARI.exec(String(anahtar || ""));
  if (!m) return NaN;
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
}

/** Cihaz saatiyle bugünün LOKAL gün anahtarı. */
export function bugunAnahtar(simdi = Date.now()) {
  const d = new Date(simdi);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Bir gün anahtarı bugünden kaç gün önce? Bugün = 0. Gelecek ya da geçersiz
 * tarih null döner (saat geri alınmışsa "−3 gün önce" yazmak yerine susarız).
 */
export function kacGunOnce(anahtar, simdi = Date.now()) {
  const fark = gunNo(bugunAnahtar(simdi)) - gunNo(anahtar);
  return Number.isFinite(fark) && fark >= 0 ? fark : null;
}

/**
 * Kartın PEŞİNDE KOŞULACAK hedefi: kademeli ailede sıradaki kademe, aksi halde
 * kilitliyse kartın kendisi. Açık ve bitmiş kart için null.
 */
export const hedefi = (kart) => kart?.sonrakiHedef || (kart && !kart.acik ? kart : null);

/**
 * Hedefin TAM rozet nesnesi: `sonrakiHedef` yalnızca ad/oran taşır (tier, ikon ve
 * nadirlik yok). Hedefin şeklini ve rengini çizmek için (bir sonraki kademe
 * kareden beşgene geçer) ailenin ilgili üyesi gerekir.
 */
export function hedefUyesi(kart) {
  const h = hedefi(kart);
  if (!h) return null;
  return kart.aileUyeleri?.find((u) => u.id === h.id) || h;
}

/** Gizli rozet kilitliyken hiçbir ipucu vermemeli: ne adı, ne oranı, ne hedefi. */
const gizliKilitli = (kart) => !!kart?.hidden && !kart?.acik;

/**
 * Tamamlanmaya en yakın hedefler. Gizli kilitli rozetler HİÇ girmez (oranları
 * sızar). Eşit oranda kalan mutlak mesafe küçük olan öne geçer; o da eşitse
 * giriş sırası korunur (sıralama kararlıdır).
 *
 * @returns {{ kart: object, hedef: object }[]}
 */
export function yaklasanlar(kartlar, { limit = 6, minOran = 0 } = {}) {
  const adaylar = [];
  (kartlar || []).forEach((kart, sira) => {
    const hedef = hedefi(kart);
    if (!hedef || gizliKilitli(kart)) return;
    const oran = Number(hedef.oran) || 0;
    if (oran < minOran || oran >= 1) return;
    adaylar.push({ kart, hedef, oran, kalan: (Number(hedef.target) || 0) - (Number(hedef.ilerleme) || 0), sira });
  });
  adaylar.sort((a, b) => b.oran - a.oran || a.kalan - b.kalan || a.sira - b.sira);
  return adaylar.slice(0, Math.max(0, limit)).map(({ kart, hedef }) => ({ kart, hedef }));
}

/** Hedefe kalan HAM miktar (dakika, film adedi…). Negatife düşmez. */
export const kalanMiktar = (hedef) =>
  Math.max(0, (Number(hedef?.target) || 0) - (Number(hedef?.ilerleme) || 0));

/**
 * Kartlara kazanma tarihini ve "yeni" bayrağını işler. Girdi nesnelerine
 * DOKUNMAZ; tarih yoksa alanlar null/false olur.
 *
 * `yeni`: yalnız GERÇEK kazanma tarihi olanlar. Tohumlanan/emilen rozet tarihsiz
 * olduğu için asla "yeni" görünmez — 3 yıllık kullanıcının ekranı ilk açılışta
 * "YENİ" etiketiyle dolmaz.
 */
export function kartlariDekorle(kartlar, tarihler, { simdi = Date.now(), yeniGun = 7 } = {}) {
  const harita = tarihler && typeof tarihler === "object" ? tarihler : {};
  return (kartlar || []).map((kart) => {
    const kazanmaTarihi = kart.acik && typeof harita[kart.id] === "string" ? harita[kart.id] : null;
    const once = kazanmaTarihi ? kacGunOnce(kazanmaTarihi, simdi) : null;
    return { ...kart, kazanmaTarihi, yeni: once !== null && once < yeniGun };
  });
}

/**
 * Son kazanılanlar, en yeni önce. Aynı gün kazanılanlarda nadir olan öne geçer.
 * @param {number} gun  Kaç gün geriye bakılacak (bugün dahil).
 */
export function sonKazanilanlar(kartlar, { limit = 8, gun = 30, simdi = Date.now() } = {}) {
  const rank = (r) => RARITY_ORDER.indexOf(r);
  return (kartlar || [])
    .map((kart, sira) => ({ kart, sira, once: kart.kazanmaTarihi ? kacGunOnce(kart.kazanmaTarihi, simdi) : null }))
    .filter((x) => x.kart.acik && x.once !== null && x.once < gun)
    .sort((a, b) => a.once - b.once || rank(b.kart.rarity) - rank(a.kart.rarity) || a.sira - b.sira)
    .slice(0, Math.max(0, limit))
    .map((x) => x.kart);
}

/**
 * Bölüm başına kazanılan/toplam. SAYIM KADEME DÜZEYİNDEDİR (aile = üyeleri kadar
 * rozet): "Kilometre taşları 14/28", "Kilometre taşları 7/14 kart" demekten daha
 * dürüst — ikincisi 5 kademeli bir ailenin 4 kademesini tek tik gösterirdi.
 * Koleksiyon ve mühür kartları 1 sayılır. Sıra BOLUM_SIRA'dır; boş bölüm yok.
 */
export function bolumOzetleri(kartlar) {
  const harita = new Map();
  for (const kart of kartlar || []) {
    const uyeler = kart.aileUyeleri?.length ? kart.aileUyeleri : [kart];
    const o = harita.get(kart.section) || { bolum: kart.section, acik: 0, toplam: 0 };
    for (const u of uyeler) {
      o.toplam += 1;
      if (u.acik) o.acik += 1;
    }
    harita.set(kart.section, o);
  }
  return BOLUM_SIRA.filter((b) => harita.has(b)).map((b) => {
    const o = harita.get(b);
    return { ...o, oran: o.toplam > 0 ? o.acik / o.toplam : 0 };
  });
}

/**
 * Nadirlik başına kazanılan/toplam — KATALOG rozetleri üzerinden (düz liste).
 * Koleksiyon/mühür dahil edilmez: payda dönem başında büyürse kullanıcı hiçbir
 * şey yapmadan geride kalmış görünürdü (acikSayisi sayacıyla aynı gerekçe).
 */
export function nadirlikDagilimi(rozetler) {
  return RARITY_ORDER.map((rarity) => {
    const grup = (rozetler || []).filter((r) => r.rarity === rarity);
    return { rarity, acik: grup.filter((r) => r.acik).length, toplam: grup.length };
  });
}

/** Koleksiyonun üyelerini (katalog rozetleri) düz listeden çözer; sıra korunur. */
export function setUyeleri(set, rozetler) {
  const haritasi = new Map((rozetler || []).map((r) => [r.id, r]));
  return (set?.uyeIdleri || []).map((id) => haritasi.get(id)).filter(Boolean);
}

/**
 * Tamamlanmış ve prestij taşıyan ailenin durumu; yoksa null. Zirvenin ÖTESİNİ
 * ölçer: `ham` kırpılmamış değerdir (evaluateWatchBadges), yani kart hedefte
 * durduğu halde burada ilerlemeye devam eder.
 */
export function prestijBilgisi(kart) {
  if (!kart?.family || !kart.aileUyeleri?.length || kart.sonrakiHedef) return null;
  const adim = Number(kart.prestijAdim) || 0;
  if (adim <= 0) return null;
  const zirve = kart.aileUyeleri[kart.aileUyeleri.length - 1];
  if (!zirve?.acik) return null;
  const asan = Math.max(0, (Number(zirve.ham) || 0) - (Number(zirve.target) || 0));
  const kismi = asan % adim;
  return {
    n: Math.floor(asan / adim),
    adim,
    kismi,
    oran: kismi / adim,
    kalan: adim - kismi,
    birim: zirve.birim || null,
  };
}

// Prestij adımının BİRİM adı. Süre ailesi (`sure`) burada yok: onun birimi çeviriciden
// (dk/sa/gün) geliyor ve formatBadgeDeger zaten ekliyor.
const PRESTIJ_EK = Object.freeze({
  film: { tr: "film", en: "films" },
  bolum: { tr: "bölüm", en: "episodes" },
  final: { tr: "dizi", en: "series" },
  gun: { tr: "gün", en: "days" },
  uzunMetraj: { tr: "uzun film", en: "long films" },
});
export const prestijEk = (family, lang = "tr") => PRESTIJ_EK[family]?.[lang === "en" ? "en" : "tr"] || "";

/**
 * Rozeti bir kart listesinde bulur: kartın kendi id'si ya da kademeli ailenin
 * HERHANGİ bir üyesi. Kutlama bildirimi kazanılan kademenin id'sini taşır ama
 * ekrandaki kart (ulaşılan en yüksek kademe) başka bir id'ye sahip olabilir.
 */
export function kartBul(kartlar, id) {
  if (!id) return null;
  const liste = kartlar || [];
  return (
    liste.find((k) => k.id === id) ||
    liste.find((k) => k.aileUyeleri?.some((u) => u.id === id)) ||
    null
  );
}

/**
 * Süzgeçlere göre ızgara satırlarını kurar. Ekran bunu useMemo ile çağırır; mantık burada
 * durur ki RN'siz test edilebilsin.
 *
 * Kademeli aile kartı İKİ durum süzgecine birden girer: 2/4 kademesi açık bir aile
 * hem "kazandıklarım"dır hem de peşinde koşulacak bir hedefi vardır. `!b.acik`
 * yazsaydık böyle bir aile "Kilitli"de hiç görünmezdi — yani kullanıcının sıradaki
 * hedefi, tam da hedefleri listeleyen süzgeçte kaybolurdu.
 */
export function izgaraSatirlari(kartlar, filtre, bolum, sutun = 3) {
  if (!kartlar?.length) return [];
  const suzulmus = kartlar.filter((b) => {
    if (bolum && b.section !== bolum) return false;
    if (filtre === "acik") return b.acik;
    if (filtre === "kilitli") return !b.acik || !!b.sonrakiHedef;
    return true;
  });

  const bolumler = new Map();
  for (const b of suzulmus) {
    if (!bolumler.has(b.section)) bolumler.set(b.section, []);
    bolumler.get(b.section).push(b);
  }

  // Bölüm sırası KATALOGDAN gelir, kart listesinin dizilişinden değil: mühür ve
  // koleksiyon kartları çalışma anında üretilip listeye sonda ekleniyor.
  const sirali = [...bolumler.entries()].sort(
    (a, b) => BOLUM_SIRA.indexOf(a[0]) - BOLUM_SIRA.indexOf(b[0]),
  );

  const satirlar = [];
  for (const [bolumId, liste] of sirali) {
    // "Tamamlanmaya en yakın önce". Peşinde koşulacak bir hedefi olan kart (kilitli
    // rozet YA DA sıradaki kademesi olan aile) üstte durur ve sıralama O HEDEFİN
    // oranına göre yapılır. Kartın kendi `oran`ına bakmak yanlış olurdu: aile
    // kartında o değer ULAŞILAN kademeye ait ve her zaman 1'dir.
    liste.sort((a, b) => {
      const ha = hedefi(a);
      const hb = hedefi(b);
      if (!!ha !== !!hb) return ha ? -1 : 1;
      // Gizli rozetler oran sızdırmasın diye kilitliyken sabit sonda durur...
      if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
      // ...ve KENDİ ARALARINDA da oranla sıralanmaz: "Gizli" bölümünün tamamı gizli
      // rozetlerden oluşuyor, oranla sıralamak en tepedeki gizli rozetin hedefe en
      // yakın olanı olduğunu ele verirdi (katalog sırası korunur, sıralama kararlı).
      if (a.hidden && b.hidden && !a.acik && !b.acik) return 0;
      if (!ha) return 0;
      return hb.oran - ha.oran;
    });
    satirlar.push({ tur: "baslik", id: `h_${bolumId}`, bolum: bolumId });
    // FlatList'in numColumns özelliği bölüm başlıklarını da bir hücre saydığı için
    // heterojen veriyle doğru hizalama yapamaz; rozetleri sanal satırlara ayırıyoruz.
    for (let i = 0; i < liste.length; i += sutun) {
      satirlar.push({ tur: "rozetSatiri", id: `r_${bolumId}_${i}`, rozetler: liste.slice(i, i + sutun) });
    }
  }
  return satirlar;
}
