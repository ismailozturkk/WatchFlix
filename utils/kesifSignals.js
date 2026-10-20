// utils/kesifSignals.js
//
// KEŞİF rozetlerinin SAF girdi katmanı — React, depolama ve Firebase importu YOK
// (jest yalnız böyle modülleri çalıştırabilir). hooks/useKesifSignals.js bağlamlardan
// ham görünümleri toplar, bu dosya onları rozetlerin okuduğu küçük nesneye indirger.
//
// NEDEN İZLEME MOTORUNA (computeWatchScore) KONMADI: Keşif rozetleri izleme verisinden
// değil, uygulamanın diğer özelliklerinden (not, liste, hatırlatıcı, arkadaş…) türer.
// computeWatchScore'un sözleşmesi "tek geçiş, yeni listener yok, puana girmez" — buraya
// başka bir kaynak karıştırmak 512 film + 3.400 bölümlük geçişi not yazınca da koşturur.
// Bu yüzden sinyaller ayrı üretilir ve `oyunSeviye`/`hesapYili` gibi, hesaplanmış
// `stats`'ın üstüne bindirilir (hooks/useWatchProgress.js).
//
// İKİ ÇIKTI:
//   sayilar — her sinyalin sayısı, KIRPILMIŞ (KESIF_TAVAN). Rozetlerin en büyük ihtiyacı
//             "dört favori" için 4; tavansız sayı, kullanıcı 6. notunu yazınca değer
//             değişsin, rozet listesi yeniden kurulsun, hiçbir rozet etkilenmesin diye
//             boşuna yeniden çizim demekti.
//   hazir   — hangi KAYNAK yüklendi? Bu, işin asıl güvenlik parçası: bkz. aşağıdaki
//             YÜKLENME YARIŞI.
//
// YÜKLENME YARIŞI. Defterin katalog genişleme koruması (watchLedgerCore.js `known`)
// "bir id ilk kez görüldüğünde ve kullanıcı onu o an hak ediyorsa sessizce emilir;
// hak etmiyorsa yalnız `known`a yazılır ve ileride kazanılırsa KUTLANIR" der. İzleme
// verisi `veriHazir` ile bekletiliyor; Keşif kaynakları ise (yerel not motoru, arkadaş
// dinleyicisi, liste haritaları, profil) farklı anlarda hazır oluyor. Kaynak henüz
// yüklenmemişken "hak edilmedi" görünen bir rozet `known`a girerse, kaynak geldiğinde
// 3 yıldır not tutan kullanıcıya "İlk Not'u kazandın" konfetisi yağar. Çözüm: hazır
// olmayan kaynağın rozet id'leri `known`a yazılan listeden ÇIKARILIR
// (watchBadgeCatalog.bilinenRozetIdleri) — kaynak hazır olunca id ilk kez görülür ve hak
// ediliyorsa sessiz emilir.

export const KESIF_KAYNAK = Object.freeze({
  NOTLAR: "notlar",
  MEDYA_NOTLARI: "medyaNotlari",
  HATIRLATICILAR: "hatirlaticilar",
  LISTELER: "listeler",
  ORTAK_LISTELER: "ortakListeler",
  ARKADASLAR: "arkadaslar",
  PROFIL: "profil",
  YAPAY_ZEKA: "yapayZeka",
});

export const KESIF_KAYNAKLARI = Object.freeze(Object.values(KESIF_KAYNAK));

/** Sayıların üst sınırı: en büyük kullanım "dört favori" (4). */
export const KESIF_TAVAN = 4;

const kirp = (n) => Math.min(KESIF_TAVAN, Math.max(0, Math.floor(Number(n) || 0)));
const adet = (dizi) => (Array.isArray(dizi) ? dizi.length : 0);
const metinVar = (v) => typeof v === "string" && v.trim().length > 0;

/** Hiçbir kaynağın hazır olmadığı başlangıç hâli (bağlamlar henüz yok / oturum yok). */
export const bosKesif = () => ({
  sayilar: {},
  hazir: Object.fromEntries(KESIF_KAYNAKLARI.map((k) => [k, false])),
});

/**
 * Not belgeleri: `type` alanı olmayan eski kayıtlar not sayılır (ProfileNotesContext /
 * NotesScreen ile aynı kural).
 */
function notSayilari(notlar) {
  let yapilacak = 0;
  let not = 0;
  for (const n of Array.isArray(notlar) ? notlar : []) {
    if (!n) continue;
    if (n.type === "todo") yapilacak += 1;
    else not += 1;
  }
  return { not, yapilacak };
}

/**
 * Bağlamlardan toplanan HAM görünümleri rozet girdisine çevirir. Her kaynak
 * `{ hazir, ...ham }` verir; `hazir` false ya da kaynak yoksa o kaynağın sayıları 0 ve
 * `hazir[kaynak]` false kalır. Girdiyi DEĞİŞTİRMEZ, asla atmaz.
 *
 * @param {object} g
 * @param {{hazir:boolean, items:Array}} [g.notlar]          Notes/{uid}/items (yerel kopya)
 * @param {{hazir:boolean, items:Array}} [g.medyaNotlari]    MediaNotes/{uid}/items
 * @param {{hazir:boolean, filmler:Array, bolumler:Array}} [g.hatirlaticilar]
 * @param {{hazir:boolean, ozelListe:number, favori:number, izlemeListesi:number}} [g.listeler]
 * @param {{hazir:boolean, adet:number}} [g.ortakListeler]   üyesi olunan ortak listeler
 * @param {{hazir:boolean, adet:number}} [g.arkadaslar]
 * @param {{hazir:boolean, gonderi:number, dortFavori:number, bio:string}} [g.profil]
 * @param {{hazir:boolean, items:Array}} [g.yapayZeka]       AiConversations/{uid}/items
 * @returns {{ sayilar: object, hazir: Record<string, boolean> }}
 */
export function kesifSinyalleriHesapla(g = {}) {
  const sayilar = {};
  const hazir = {};
  const kaynak = (ad) => {
    const k = g?.[ad];
    const acik = !!k && k.hazir === true;
    hazir[ad] = acik;
    return acik ? k : null;
  };

  const notlar = kaynak(KESIF_KAYNAK.NOTLAR);
  if (notlar) {
    const { not, yapilacak } = notSayilari(notlar.items);
    sayilar.not = kirp(not);
    sayilar.yapilacak = kirp(yapilacak);
  }

  const medya = kaynak(KESIF_KAYNAK.MEDYA_NOTLARI);
  if (medya) sayilar.medyaNotu = kirp(adet(medya.items));

  const hat = kaynak(KESIF_KAYNAK.HATIRLATICILAR);
  if (hat) sayilar.hatirlatici = kirp(adet(hat.filmler) + adet(hat.bolumler));

  const liste = kaynak(KESIF_KAYNAK.LISTELER);
  if (liste) {
    sayilar.ozelListe = kirp(liste.ozelListe);
    sayilar.favori = kirp(liste.favori);
    sayilar.izlemeListesi = kirp(liste.izlemeListesi);
  }

  const ortak = kaynak(KESIF_KAYNAK.ORTAK_LISTELER);
  if (ortak) sayilar.ortakListe = kirp(ortak.adet);

  const ark = kaynak(KESIF_KAYNAK.ARKADASLAR);
  if (ark) sayilar.arkadas = kirp(ark.adet);

  const profil = kaynak(KESIF_KAYNAK.PROFIL);
  if (profil) {
    sayilar.gonderi = kirp(profil.gonderi);
    sayilar.dortFavori = kirp(profil.dortFavori);
    sayilar.biyografi = metinVar(profil.bio) ? 1 : 0;
  }

  const yz = kaynak(KESIF_KAYNAK.YAPAY_ZEKA);
  if (yz) sayilar.cineMatch = kirp(adet(yz.items));

  return { sayilar, hazir };
}

/**
 * Hazır olan kaynakların kısa imzası ("10110100"). Hook'taki defter mutabakatı imzasına
 * girer: bir kaynak hazır olduğunda açık rozet kümesi DEĞİŞMEYEBİLİR (0 arkadaş, hazır) ama
 * defterin `known` listesi değişir; imza bunu görmezse mutabakat hiç koşmaz, id `known`a
 * yazılmaz ve kullanıcının İLK arkadaşı geldiğinde "ilk kez görüldü + hak edildi" diye
 * sessizce emilir — gerçek bir kazanım kutlanmazdı.
 */
export const kesifHazirImzasi = (hazir) =>
  KESIF_KAYNAKLARI.map((k) => (hazir?.[k] === true ? 1 : 0)).join("");

/**
 * İki hesabın aynı olup olmadığı. Hook bununla ESKİ referansı korur: referans
 * değişirse `stats` yeniden kurulur, tüm rozet listesi hesaplanır ve context
 * tüketicilerinin hepsi yeniden çizilir — oysa içerik aynı.
 */
export function kesifAyni(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const esit = (x, y) => {
    const kx = Object.keys(x || {});
    const ky = Object.keys(y || {});
    return kx.length === ky.length && kx.every((k) => x[k] === y?.[k]);
  };
  return esit(a.sayilar, b.sayilar) && esit(a.hazir, b.hazir);
}
