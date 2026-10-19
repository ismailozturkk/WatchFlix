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

import { copyLanguage } from "../../utils/appLanguages";
import { RARITY_ORDER } from "@theme/badgeTokens";
import { BOLUM_SIRA, KATALOG_SURUMU } from "./watchBadgeCatalog";

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
    return { ...kart, kazanmaTarihi, yeni: once !== null && once < yeniGun, yeniKatalog: yeniEklendi(kart) };
  });
}

/**
 * Kart, son katalog genişlemesinde eklenen bir rozet mi (ya da eklenen bir
 * KADEME taşıyan bir aile mi)? `yeni` ("son 7 günde kazanıldı") ile KARIŞMASIN:
 * o kullanıcının kazanımıdır, bu kataloğun yeniliği — kilitli bir kart da
 * katalog açısından yeni olabilir ve asıl işlevi tam da bu: "burada yeni bir
 * hedef var"ı söylemek.
 *
 * Aile kartında kimlik ulaşılan kademeden geldiği için `since` kartın kendisine
 * değil ÜYELERİNE bakılır: 5 kademeli `dizi` ailesinin 4'ü yeni, zirvesi eski.
 */
export function yeniEklendi(kart, surum = KATALOG_SURUMU) {
  if (!kart) return false;
  const uyeler = kart.aileUyeleri?.length ? kart.aileUyeleri : [kart];
  return uyeler.some((u) => (Number(u?.since) || 1) === surum && surum > 1);
}

/**
 * Son genişlemenin özeti, KATALOG rozetleri üzerinden (düz liste): kaç rozet
 * eklendi, bunlardan kaçına kullanıcı zaten sahip. "60 yeni rozet — 14'üne
 * şimdiden sahipsin" duyurusu buradan beslenir; ikinci sayı kullanıcıya
 * karşılanmış bir ödül gibi okunur (ve doğrudur: katalog genişleme koruması
 * zaten hak edilenleri sessizce sahiplendirir).
 */
export function yeniRozetOzeti(rozetler, surum = KATALOG_SURUMU) {
  const yeniler = (rozetler || []).filter((r) => surum > 1 && (Number(r?.since) || 1) === surum);
  return { toplam: yeniler.length, acik: yeniler.filter((r) => r.acik).length };
}

// ── Takvim fırsatları ───────────────────────────────────────────────────────
//
// Bazı rozetler YILDA BİR kez kazanılabilir (31 Ekim'de korku, 14 Şubat'ta
// romantik içerik…). Kullanıcı bunları ancak o gün hatırlarsa kazanır; hatırlamazsa
// bir yıl bekler. Bu liste onları gün gelmeden ÖNCE ekrana çıkarır ve "N gün
// kaldı" der — rozet ekranını geriye bakan bir envanterden ileriye bakan bir
// takvime çevirir. Rozet kazanma heyecanının en ucuz kaynağı budur: sürpriz
// değil, planlı bekleyiş.
//
// Tanım KATALOGDAKİ kurallarla birebir olmalı (utils/watchScoring.js `md ===`
// karşılaştırmaları ve `takvimOlayi`); test ikisini birlikte kilitler.
const TAKVIM_OLAYLARI = Object.freeze([
  { id: "cadilar_gecesi", gunler: [[10, 31]] },
  { id: "yil_devrilirken", gunler: [[12, 31], [1, 1]] },
  { id: "kirmizi_perde", gunler: [[2, 14]] },
  { id: "nisan_1", gunler: [[4, 1]] },
  { id: "mayis_4", gunler: [[5, 4]] },
  { id: "cuma_13", cuma13: true },
]);

/** Verilen andan itibaren (bugün dahil) ilk "ay/gün" tarihine kaç gün var? */
function sonrakiTarihFarki(ay, gun, simdi) {
  const d = new Date(simdi);
  const bugun = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  for (const yil of [d.getFullYear(), d.getFullYear() + 1]) {
    const hedef = Date.UTC(yil, ay - 1, gun);
    if (hedef >= bugun) return Math.round((hedef - bugun) / 86400000);
  }
  return null;
}

/** Bugünden itibaren ilk Cuma 13'üne kaç gün var? (bugün dahil) */
function sonrakiCuma13Farki(simdi) {
  const d = new Date(simdi);
  const bugun = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  // En geç 14 ay içinde bir Cuma 13 vardır (her yılda 1–3 tane).
  for (let k = 0; k < 15; k++) {
    const hedef = new Date(d.getFullYear(), d.getMonth() + k, 13);
    if (hedef.getDay() !== 5) continue;
    const t = Date.UTC(hedef.getFullYear(), hedef.getMonth(), hedef.getDate());
    if (t >= bugun) return Math.round((t - bugun) / 86400000);
  }
  return null;
}

/**
 * Yaklaşan, henüz kazanılmamış takvim rozetleri ve (kazanılmamış) güncel dönem
 * mührü; bitişi en yakın olan önce.
 *
 * @param {object[]} kartlar  kartlariDekorle çıktısı (katalog + mühür + set)
 * @param {object}   opts     { simdi, pencere: kaç gün ilerisine bakılsın }
 * @returns {{ kart: object, tur: "olay"|"muhur", gunKaldi: number, eksikGun?: number }[]}
 *   gunKaldi: olay için "gününe", mühür için "dönem bitimine" kalan gün; 0 = bugün.
 */
export function takvimFirsatlari(kartlar, { simdi = Date.now(), pencere = 45, limit = 6 } = {}) {
  const liste = kartlar || [];
  const sonuc = [];

  for (const olay of TAKVIM_OLAYLARI) {
    const kart = liste.find((k) => k.id === olay.id);
    if (!kart || kart.acik) continue;
    const farklar = olay.cuma13
      ? [sonrakiCuma13Farki(simdi)]
      : olay.gunler.map(([ay, gun]) => sonrakiTarihFarki(ay, gun, simdi));
    const gunKaldi = Math.min(...farklar.filter((f) => f !== null));
    if (!Number.isFinite(gunKaldi) || gunKaldi > pencere) continue;
    sonuc.push({ kart, tur: "olay", gunKaldi });
  }

  // Güncel dönem mührü: yalnızca dönem BİTMEK ÜZEREYKEN ve hâlâ yetişebiliyorsa.
  // Dönemin tamamı boyunca listede durursa (≈90 gün) "fırsat" diye bir şey
  // kalmaz; son ay içinde ise gerçek bir geri sayım.
  for (const kart of liste) {
    if (kart.section !== "muhur" || !kart.guncelDonem || kart.acik) continue;
    if (!Number.isFinite(kart.kalanGun) || kart.kalanGun < 0 || kart.kalanGun > 30) continue;
    if (kart.yetisir === false) continue;
    sonuc.push({ kart, tur: "muhur", gunKaldi: kart.kalanGun, eksikGun: kart.eksikGun });
  }

  const rank = (r) => RARITY_ORDER.indexOf(r);
  return sonuc
    .sort((a, b) => a.gunKaldi - b.gunKaldi || rank(b.kart.rarity) - rank(a.kart.rarity))
    .slice(0, Math.max(0, limit));
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
  film: { tr: "film", en: "films", es: "películas", pt: "filmes" },
  bolum: { tr: "bölüm", en: "episodes", es: "episodios", pt: "episódios" },
  final: { tr: "dizi", en: "series", es: "series", pt: "séries" },
  gun: { tr: "gün", en: "days", es: "días", pt: "dias" },
  uzunMetraj: { tr: "uzun film", en: "long films", es: "películas largas", pt: "filmes longos" },
});
export const prestijEk = (family, lang = "tr") => PRESTIJ_EK[family]?.[copyLanguage(lang, ["tr", "en", "es", "pt"])] || "";

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
    // Son genişlemede eklenenler (kilitli ya da açık fark etmez): duyuru kartındaki
    // "yeni olanları göster" bağı buraya düşer.
    if (filtre === "yeni") return !!b.yeniKatalog;
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
