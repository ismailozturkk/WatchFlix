// utils/watchLedgerCore.js
//
// İzleme rozeti defterinin SAF çekirdeği — depolama yok, React yok.
// AsyncStorage sarmalayıcısı utils/watchBadgeLedger.js'te; ayrı durmasının
// sebebi jest.config.js'in belgelenmiş kısıtı: bu repoda yalnızca RN/Firebase
// importu olmayan saf modüller test edilebiliyor. Mantık burada olduğu için
// geri alınamazlık sözleşmesi gerçekten test ediliyor.
//
// SÖZLEŞME — TEK CÜMLE: **puan düşebilir, Perde ve rozet düşmez.**
//
// Neden zorunlu: MovieDetail.js:413 bir filme ikinci kez basmayı
// `removeFromList` olarak yorumluyor ve watchedTvService.markShow tüm
// episodeWatchTime'ları eziyor. İzleme verisi — oyun tarafındaki totalCorrect'in
// aksine — MONOTON DEĞİLDİR: işareti geri almak birinci sınıf bir aksiyondur.
// Defter olmadan yanlışlıkla tek bir postere iki kez basan kullanıcı kazandığı
// rozeti kaybeder, Perdesi düşer, bar geri sarar ve hiçbir açıklama görmez.
// Kazanılmış bir rozetin geri alınması, puanın 100 eksik hesaplanmasından çok
// daha ağır bir adalet ihlalidir.

// v2: `known` alanı eklendi — KATALOG GENİŞLEME KORUMASI.
//
// Sessiz tohumlama yalnızca defterin İLK kurulduğu anı koruyor. Katalog sonradan
// büyüdüğünde aynı felaket ikinci kez oluyordu: yeni bir rozet eklendiğinde
// kullanıcı onu ZATEN hak ediyorsa, rozet `earned`e girer ama `seen`de olmadığı
// için `kutlanacaklar` onu "yeni kazandın" diye döndürür. 3 yıllık bir kullanıcıya
// 15 ara kademe eklendiğinde, güncellemeden sonra uygulamayı açtığı ilk saniyede
// 15 rozetlik konfeti yağmuru patlıyordu — tam da sessiz tohumlamanın önlemek
// için yazıldığı şey.
//
// `known`, defterin VARLIĞINDAN haberdar olduğu katalog id'lerini tutar
// (kazanılmış olması gerekmez). Bir id ilk kez katalogda görülüyorsa ve kullanıcı
// onu o an zaten hak ediyorsa, rozet `earned` VE `seen`e birlikte yazılır: sahip
// olur, kutlama görmez. Henüz hak etmiyorsa yalnızca `known`a girer ve ileride
// gerçekten kazandığında normal biçimde kutlanır.
//
// `known === null` (v1 defteri) = "bu defter bugünkü katalogla yazılmış" demektir;
// o an hiçbir şey emilmez, alan yalnızca doldurulur. Aksi halde göç anında
// kullanıcının gerçekten yeni kazandığı bir rozetin kutlaması yutulurdu.
//
// v3: `earnedAt` eklendi — KAZANMA TARİHİ.
//
// Defter bir rozetin kazanılıp kazanılmadığını biliyordu ama NE ZAMAN kazanıldığını
// bilmiyordu; bu yüzden detay sayfası "Kazanıldı" diyebiliyor, "12 Mart'ta" diyemiyordu
// ve "son kazanılanlar" diye bir görünüm kurulamıyordu. Tarih cihaz saatiyle gerçek
// kazanma ANINDAN yazılır (kullanıcının seçtiği izleme tarihinden değil) ve yalnızca
// bir kez, ilk yazıldığı gibi kalır.
//
// BİLEREK TARİHSİZ KALANLAR: sessiz tohumlama ve katalog genişlemesiyle emilen
// rozetler. Onları gerçekte ne zaman kazandığını bilmiyoruz; bugünün tarihini
// damgalamak yalan olurdu. Arayüz bunları "arşivden" diye etiketler.
//
// Alan eksikse (v2 defteri) boş haritaya iner — göç gerekmez, v2 defterindeki
// rozetler tarihsiz sayılır.
export const LEDGER_SURUM = 3;

export const bosLedger = () => ({
  v: LEDGER_SURUM,
  baseline: null,           // { kare, perde, badgeIds[], seenAt } — tohumlama anı
  earned: { badgeIds: [], perdeFloor: 1, makaraFloor: 0 },   // ASLA küçülmez
  earnedAt: {},             // id → "YYYY-MM-DD" · yalnız bu defter yazarken görülenler
  seen: [],                 // kutlaması gösterilmiş id'ler
  known: null,              // katalogda GÖRÜLMÜŞ id'ler · null = v1 defteri
  aktiflik: bosAktiflik(),  // gerçek işaretleme anından türeyen seri
});

// AKTİFLİK DEFTERİ — seri sisteminin veri tabanı.
//
// `gunler` cihaz saatiyle GERÇEK işaretleme günleridir; kullanıcının seçtiği
// izleme tarihiyle hiç ilgisi yoktur (utils/watchActivity.js'teki uzun gerekçe).
// `sonSayim` bir önceki mutabakattaki toplam eser adedi — artış tespiti bunun
// üzerinden yapılır, böylece HİÇBİR yazma yoluna dokunmadan (listItemsService,
// watchedTvService, toplu işaretleme, bölüm ekleme…) "kullanıcı bugün bir şey
// işaretledi" sinyali elde edilir.
// `rekorGun`/`rekorHafta` MONOTONdur ve pencereden bağımsız durur: `gunler` 400
// günde budandığı için rekor orada tutulsaydı budama eski rekoru silerdi.
//
// `gunluk` (son GUNLUK_TUT gün): gün → { taban, kazanim }. `taban` o günün İLK
// ölçümündeki toplam, `kazanim` gün içinde tabanın üstüne çıkılan en yüksek fark —
// yani o gün NET kaç yeni içerik işaretlendi. İki işi var: (1) aynı içeriği geri
// alıp yeniden basmak artık gün damgalamaz (kazanım 0 kalır), (2) seri TELAFİSİ
// "ertesi gün 2 içerik" ister ve bunu yalnız bu sayı söyleyebilir.
//
// `koruma`: seri koruma durumu (telafi + kalkan). Kararları utils/watchActivity.js
// seriKorumasiniIlerlet verir; burada yalnız biçimi korunur.
export const GUNLUK_TUT = 10;
export const bosKoruma = () => ({ yamalar: {}, kalkan: 0, kalkanAy: 0, islenen: null });
export const bosAktiflik = () => ({
  gunler: [], sonSayim: -1, rekorGun: 0, rekorHafta: 0, gunluk: {}, koruma: bosKoruma(),
});

const dizi = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
const tamsayi = (v, alt = 1) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= alt ? n : alt;
};

const GUN_ANAHTARI = /^\d{4}-\d{2}-\d{2}$/;

/** id → "YYYY-MM-DD" haritasını güvenli biçime indirger; bozuk girdiyi atar. */
function tarihHaritasi(v) {
  const out = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [id, gun] of Object.entries(v)) {
    if (typeof gun === "string" && GUN_ANAHTARI.test(gun)) out[id] = gun;
  }
  return out;
}

const nesneMi = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const sayiAlt = (v, alt) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(alt, n) : alt;
};

/** gün → { taban, kazanim }; bozuk girdi atılır, en yeni GUNLUK_TUT gün kalır. */
export function gunlukOku(v, tut = GUNLUK_TUT) {
  if (!nesneMi(v)) return {};
  const gunler = Object.keys(v).filter((g) => GUN_ANAHTARI.test(g) && nesneMi(v[g])).sort();
  const out = {};
  for (const g of gunler.slice(Math.max(0, gunler.length - tut))) {
    out[g] = { taban: sayiAlt(v[g].taban, 0), kazanim: sayiAlt(v[g].kazanim, 0) };
  }
  return out;
}

/** Seri koruma durumunu güvenli biçime indirger (bkz. watchActivity seriKorumasiniIlerlet). */
export function korumaOku(v) {
  if (!nesneMi(v)) return bosKoruma();
  const yamalar = {};
  if (nesneMi(v.yamalar)) {
    for (const [g, tur] of Object.entries(v.yamalar)) {
      if (GUN_ANAHTARI.test(g) && (tur === "telafi" || tur === "kalkan")) yamalar[g] = tur;
    }
  }
  return {
    yamalar,
    kalkan: sayiAlt(v.kalkan, 0),
    kalkanAy: sayiAlt(v.kalkanAy, 0),
    islenen: typeof v.islenen === "string" && GUN_ANAHTARI.test(v.islenen) ? v.islenen : null,
  };
}

/** Bilinmeyen/bozuk JSON'u güvenli biçime indirger. Asla atmaz. */
export function normalizeLedger(raw) {
  const bos = bosLedger();
  if (!raw || typeof raw !== "object") return bos;
  const b = raw.baseline;
  return {
    v: LEDGER_SURUM,
    baseline: b && typeof b === "object"
      ? {
          kare: Math.max(0, Number(b.kare) || 0),
          perde: tamsayi(b.perde, 1),
          badgeIds: dizi(b.badgeIds),
          seenAt: typeof b.seenAt === "string" ? b.seenAt : null,
        }
      : null,
    earned: {
      badgeIds: dizi(raw.earned?.badgeIds),
      perdeFloor: tamsayi(raw.earned?.perdeFloor, 1),
      makaraFloor: tamsayi(raw.earned?.makaraFloor, 0),
    },
    earnedAt: tarihHaritasi(raw.earnedAt),
    seen: dizi(raw.seen),
    // `null` ile `[]` AYRI şeyler: null = v1 defteri (katalog bilgisi hiç
    // yazılmamış), [] = katalog bilgisi yazılmış ama boş. İkisini birleştirmek
    // her v1 defterini "hiçbir rozeti tanımıyor" durumuna düşürür ve göç anında
    // kullanıcının açık olan HER rozetini sessizce emerdi.
    known: Array.isArray(raw.known) ? dizi(raw.known) : null,
    aktiflik: {
      gunler: dizi(raw.aktiflik?.gunler),
      // -1 = "hiç ölçülmedi". 0 ile karıştırılamaz: 0 gerçek bir sayımdır
      // (hiç içeriği olmayan kullanıcı) ve ilk işaretlemesi seri başlatmalı.
      sonSayim: Number.isFinite(Number(raw.aktiflik?.sonSayim)) ? Math.floor(Number(raw.aktiflik.sonSayim)) : -1,
      rekorGun: tamsayi(raw.aktiflik?.rekorGun, 0),
      rekorHafta: tamsayi(raw.aktiflik?.rekorHafta, 0),
      gunluk: gunlukOku(raw.aktiflik?.gunluk),
      koruma: korumaOku(raw.aktiflik?.koruma),
    },
  };
}

export const tohumlandiMi = (ledger) => !!normalizeLedger(ledger).baseline;

/**
 * SESSİZ TOHUMLAMA. Sistem bir kullanıcıda ilk kez hesaplandığında o anda açık
 * olan her şey "zaten senindi" olarak kaydedilir ve `seen`e de yazılır —
 * böylece 500 film izlemiş mevcut kullanıcı 31 rozetlik bir konfeti yağmuruna
 * tutulmaz. Geriye dönük veri TAM sayılır (o filmleri gerçekten izledi);
 * değişen tek şey teslim biçimidir.
 */
export function tohumla(ledger, {
  badgeIds = [], tumIds = null, perde = 1, makara = 0, kare = 0, seenAt = null, icerikSayisi = null,
} = {}) {
  const l = normalizeLedger(ledger);
  if (l.baseline) return l;                       // bir kez tohumlanır
  const ids = [...new Set(dizi(badgeIds))];
  return {
    v: LEDGER_SURUM,
    baseline: { kare: Math.max(0, Number(kare) || 0), perde: tamsayi(perde, 1), badgeIds: ids, seenAt },
    earned: { badgeIds: ids, perdeFloor: tamsayi(perde, 1), makaraFloor: tamsayi(makara, 0) },
    // Tohumlanan rozetlerin kazanma günü BİLİNMİYOR; uydurulmaz (v3 notu).
    earnedAt: {},
    seen: ids,                                    // kutlama tetiklenmesin
    // Katalogun TAMAMI bilinir sayılır — yalnızca açık olanlar değil. Kilitli bir
    // rozeti "bilinmiyor" bırakmak, kullanıcı onu ilk kez hak ettiğinde katalog
    // genişlemesiyle karıştırılıp kutlamasının yutulmasına yol açardı.
    known: Array.isArray(tumIds) ? [...new Set(dizi(tumIds))] : null,
    // Tohumlama GÜN DAMGALAMAZ. 500 filmi olan mevcut kullanıcının serisi
    // sıfırdan başlar; geriye dönük aktiflik verisi YOK ve uydurmak sistemin
    // tek dürüst ölçütünü kirletirdi. Yalnızca `sonSayim` kurulur ki bir sonraki
    // gerçek işaretleme artış olarak görülsün.
    aktiflik: {
      ...bosAktiflik(),
      sonSayim: Number.isFinite(Number(icerikSayisi)) ? Math.floor(Number(icerikSayisi)) : -1,
    },
  };
}

/**
 * "Kullanıcı ŞU AN bir şey işaretledi mi?" — yazma yollarına dokunmadan tespit.
 *
 * Tek sinyal toplam eser adedinin ARTMASI. Bunun üç faydası var:
 *   • listItemsService / watchedTvService / toplu işaretleme / bölüm ekleme —
 *     hepsi tek noktadan yakalanır, hiçbir yazma yolu değiştirilmez (v1'in
 *     "yazma yoluna dokunma" kararı korunur).
 *   • Tarih kullanıcı girdisi DEĞİL cihaz saatidir; geriye dönük tamir edilemez.
 *   • Toplu işaretleme (20 bölüm tek dokunuş) TEK gün damgalar — doğrusu bu.
 *
 * `sonSayim` düşüşte de güncellenir: işaretini geri alıp yeniden basan kullanıcı
 * aksi halde bir daha hiç artış üretemezdi.
 *
 * NET KAZANIM ŞARTI: gün, o günün ilk ölçümüne (`taban`) göre NET artış varsa
 * damgalanır. Eskiden her artış damgalıyordu; dünkü bir içeriği bugün geri alıp
 * yeniden basmak (100 → 99 → 100) bugünü "izlendi" sayıyordu. Artık kazanım 0
 * kalır. Hata düzeltmek (yanlış filmi kaldırıp doğrusunu basmak) etkilenmez:
 * 100 → 101 → 100 → 101 yine 1 kazanımdır.
 */
export function aktifligiGuncelle(ledger, { icerikSayisi = null, bugun = null, tut = 400 } = {}) {
  const l = normalizeLedger(ledger);
  const sayi = Number(icerikSayisi);
  if (!Number.isFinite(sayi) || typeof bugun !== "string" || !GUN_ANAHTARI.test(bugun)) {
    return { ledger: l, degisti: false, yeniGun: false };
  }

  const yeniSayim = Math.floor(sayi);
  const onceki = l.aktiflik.sonSayim;
  if (yeniSayim === onceki) return { ledger: l, degisti: false, yeniGun: false };

  // İlk ölçüm (-1) damgalamaz ve gün kaydı açmaz: o an kullanıcının ne yaptığını
  // bilmiyoruz, yalnızca mevcut durumu ölçüyoruz.
  let gunluk = l.aktiflik.gunluk;
  let kazanim = 0;
  if (onceki >= 0) {
    const kayit = gunluk[bugun];
    const taban = kayit ? kayit.taban : onceki;
    kazanim = Math.max(kayit ? kayit.kazanim : 0, yeniSayim - taban);
    if (!kayit || kayit.kazanim !== kazanim) {
      gunluk = gunlukOku({ ...gunluk, [bugun]: { taban, kazanim } });
    }
  }

  const damga = kazanim >= 1;
  const gunler = damga ? ekleGun(l.aktiflik.gunler, bugun, tut) : l.aktiflik.gunler;
  const yeniGun = damga && gunler.length !== l.aktiflik.gunler.length;

  return {
    ledger: { ...l, aktiflik: { ...l.aktiflik, gunler, sonSayim: yeniSayim, gunluk } },
    degisti: true,
    yeniGun,
  };
}

// aktifGunEkle'nin çekirdek kopyası — watchActivity.js'i import etmemek için.
// Bu dosyanın hiçbir bağımlılığı yok ve öyle kalmalı (jest yalnızca saf
// modülleri çalıştırabiliyor, bkz. dosya başı).
function ekleGun(gunler, gun, tut) {
  const gecerli = (g) => /^\d{4}-\d{2}-\d{2}$/.test(String(g || ""));
  if (!gecerli(gun)) return dizi(gunler).filter(gecerli).sort();
  const set = new Set(dizi(gunler).filter(gecerli));
  set.add(gun);
  const sirali = [...set].sort();
  return sirali.length > tut ? sirali.slice(sirali.length - tut) : sirali;
}

/** Rekorları monoton yükseltir. Mevcut seri düşebilir, rekor DÜŞEMEZ. */
export function rekorYukselt(ledger, { rekorGun = 0, rekorHafta = 0 } = {}) {
  const l = normalizeLedger(ledger);
  const g = Math.max(l.aktiflik.rekorGun, Math.max(0, Math.floor(Number(rekorGun) || 0)));
  const h = Math.max(l.aktiflik.rekorHafta, Math.max(0, Math.floor(Number(rekorHafta) || 0)));
  if (g === l.aktiflik.rekorGun && h === l.aktiflik.rekorHafta) return { ledger: l, degisti: false };
  return { ledger: { ...l, aktiflik: { ...l.aktiflik, rekorGun: g, rekorHafta: h } }, degisti: true };
}

/**
 * Yeni hesaplamayı deftere işler. earned MONOTON birleşir, perdeFloor yalnız
 * yükselir. Döndürdüğü `yeniRozetler` kutlanacak olanlardır.
 */
export function birlestir(ledger, { badgeIds = [], tumIds = null, perde = 1, makara = 0, bugun = null } = {}) {
  const l = normalizeLedger(ledger);
  const gelen = [...new Set(dizi(badgeIds))];
  const oncekiSet = new Set(l.earned.badgeIds);
  const hamYeni = gelen.filter((id) => !oncekiSet.has(id));

  // ── Katalog genişleme koruması ────────────────────────────────────────────
  // `tumIds` verilmezse (eski çağrı biçimi, testler) hiçbir emilim yapılmaz ve
  // `known` olduğu gibi kalır — davranış v1 ile birebir aynı olur.
  const katalog = Array.isArray(tumIds) ? [...new Set(dizi(tumIds))] : null;
  let known = l.known;
  let sessizler = [];
  if (katalog) {
    if (known === null) {
      // v1 defteri: bugünkü katalogla yazılmış, hiçbiri "yeni" değil. Yalnızca
      // alanı doldur; bu turda kesinlikle emilim YAPMA.
      known = katalog;
    } else {
      const bilinen = new Set(known);
      const ilkKezGorulen = new Set(katalog.filter((id) => !bilinen.has(id)));
      sessizler = hamYeni.filter((id) => ilkKezGorulen.has(id));
      known = bilinen.size === katalog.length && katalog.every((id) => bilinen.has(id))
        ? known
        : [...new Set([...known, ...katalog])];
    }
  }
  const sessizSet = new Set(sessizler);
  // Sessiz emilen rozet SAHİPLENİLİR ama KUTLANMAZ: `earned`e girer (aşağıda
  // hamYeni üzerinden) ve aynı anda `seen`e yazılır.
  const yeniRozetler = hamYeni.filter((id) => !sessizSet.has(id));
  const yeniGorulmus = sessizler.filter((id) => !l.seen.includes(id));
  const knownDegisti = katalog ? (l.known === null || known !== l.known) : false;

  // KAZANMA GÜNÜ yalnız GERÇEKTEN kazanılanlara yazılır (`yeniRozetler`); sessizce
  // emilenler (katalog genişlemesi) tarihsiz kalır. `bugun` verilmezse hiçbir şey
  // damgalanmaz — eski çağrı biçimi ve testler v2 davranışında kalır. Var olan bir
  // tarih ASLA ezilmez: ilk damga kalıcıdır.
  const damgaGunu = typeof bugun === "string" && GUN_ANAHTARI.test(bugun) ? bugun : null;
  const yeniDamgalar = damgaGunu ? yeniRozetler.filter((id) => !l.earnedAt[id]) : [];
  const earnedAt = yeniDamgalar.length
    ? { ...l.earnedAt, ...Object.fromEntries(yeniDamgalar.map((id) => [id, damgaGunu])) }
    : l.earnedAt;

  const oncekiPerde = l.earned.perdeFloor;
  const yeniPerdeFloor = Math.max(oncekiPerde, tamsayi(perde, 1));
  const oncekiMakara = l.earned.makaraFloor;
  const yeniMakaraFloor = Math.max(oncekiMakara, tamsayi(makara, 0));

  const sonraki = {
    v: LEDGER_SURUM,
    baseline: l.baseline,
    earned: {
      // hamYeni: sessiz emilenler de SAHİPLENİLİR, yalnızca kutlanmazlar.
      badgeIds: [...l.earned.badgeIds, ...hamYeni],
      perdeFloor: yeniPerdeFloor,
      makaraFloor: yeniMakaraFloor,
    },
    earnedAt,
    seen: yeniGorulmus.length ? [...l.seen, ...yeniGorulmus] : l.seen,
    known,
    aktiflik: l.aktiflik,   // bu fonksiyonun konusu değil, ama DÜŞÜRÜLEMEZ
  };

  return {
    ledger: sonraki,
    yeniRozetler,
    sessizler,
    // Perde ve Makara AYRI bildirilir. Tek bir `perdeAtladi` bayrağı, yalnızca
    // Makara artınca da true dönüyordu ve tüketici "Perde 20'e yükseldin"
    // toast'ı basıyordu — oysa Perde değişmemişti, kullanıcı zaten 20'deydi.
    perdeAtladi: yeniPerdeFloor > oncekiPerde,
    makaraAtladi: yeniMakaraFloor > oncekiMakara,
    oncekiPerde,
    yeniPerde: yeniPerdeFloor,
    oncekiMakara,
    yeniMakara: yeniMakaraFloor,
    // Defter değişmediyse çağıran diske yazmaz (gereksiz AsyncStorage I/O yok).
    // `knownDegisti` şart: katalog genişlemesi tek başına hiçbir rozet ya da
    // Perde değiştirmeyebilir, ama diske yazılmazsa her açılışta aynı id'ler
    // "ilk kez görüldü" sayılır ve emilim mekanizması hiç kalıcı olmaz.
    degisti: hamYeni.length > 0 || yeniPerdeFloor > oncekiPerde
      || yeniMakaraFloor > oncekiMakara || knownDegisti,
  };
}

/** Kazanılmış ama kutlaması henüz gösterilmemiş rozetler. */
export function kutlanacaklar(ledger) {
  const l = normalizeLedger(ledger);
  const gorulmus = new Set(l.seen);
  return l.earned.badgeIds.filter((id) => !gorulmus.has(id));
}

export function isaretleGorulmus(ledger, ids) {
  const l = normalizeLedger(ledger);
  const ekle = dizi(ids).filter((id) => !l.seen.includes(id));
  if (!ekle.length) return l;
  return { ...l, seen: [...l.seen, ...ekle] };
}
