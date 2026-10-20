// __tests__/nativePermissionLocales.test.js
//
// iOS sistem izin iletişim kutularının (NS*UsageDescription) metni UYGULAMA dilini değil
// SİSTEM dilini izler. Config eklentileri Info.plist'e tek bir (yedek) metin yazar;
// `expo.locales` her dil için bir `<dil>.lproj/InfoPlist.strings` üretir.
//
// Burada korunanlar:
//   • her kayıtlı dilin (utils/appLanguages.js) native/locales/<dil>.json dosyası var,
//   • anahtar kümeleri aynı, değerler Expo'nun kaçışsız yazıcısını bozacak karakter içermiyor,
//   • app.json'daki her `*Permission` seçeneği bir Info.plist anahtarına eşlenmiş ve o anahtar
//     her dilde çevrilmiş (yeni izin metni eklenirse bu test karar zorlar),
//   • yedek (Info.plist) metin İngilizce: desteklenmeyen sistem dili → İngilizce kuralı,
//   • CFBundleLocalizations kayıtlı dillerle aynı.
const fs = require("fs");
const path = require("path");
const { SUPPORTED_LANGUAGE_CODES, FALLBACK_LANGUAGE } = require("../utils/appLanguages");

const KOK = path.join(__dirname, "..");
const app = JSON.parse(fs.readFileSync(path.join(KOK, "app.json"), "utf8")).expo;
const kodlar = [...SUPPORTED_LANGUAGE_CODES].sort();

const yukle = (yol) => JSON.parse(fs.readFileSync(path.join(KOK, yol), "utf8"));

// app.json eklenti seçeneği → Info.plist anahtarları (config eklentisinin yazdıkları).
// Yeni bir `…Permission` seçeneği eklenirse BURAYA eşle ve native/locales/*.json'a çevirisini koy.
const IZIN_ESLEMESI = {
  photosPermission: ["NSPhotoLibraryUsageDescription"],
  savePhotosPermission: ["NSPhotoLibraryAddUsageDescription"],
  calendarPermission: ["NSCalendarsUsageDescription", "NSCalendarsFullAccessUsageDescription"],
};

// Eklenti varsayılanıyla gelen ve app.json'da seçenek olarak görünmeyen anahtarlar.
// expo-secure-store NSFaceIDUsageDescription'ı varsayılan İngilizce metinle yazar (uygulama
// henüz biyometrik kimlik doğrulama kullanmıyor; yine de Info.plist'te var).
const VARSAYILAN_ANAHTARLAR = ["NSFaceIDUsageDescription"];

/** [eklentiAdı, seçenekler] listesi */
const eklentiler = (app.plugins || []).map((p) => (Array.isArray(p) ? [p[0], p[1] || {}] : [p, {}]));

describe("expo.locales ve native/locales/*.json", () => {
  it("her kayıtlı dil expo.locales içinde ve dosyası mevcut", () => {
    expect(Object.keys(app.locales || {}).sort()).toEqual(kodlar);
    for (const kod of kodlar) {
      expect(fs.existsSync(path.join(KOK, app.locales[kod]))).toBe(true);
    }
  });

  it("dosyalar yalnız 'ios' anahtarı taşır (üst düzey anahtar Android strings.xml'e sızar)", () => {
    for (const kod of kodlar) expect({ kod, anahtarlar: Object.keys(yukle(app.locales[kod])) }).toEqual({ kod, anahtarlar: ["ios"] });
  });

  it("anahtar kümesi her dilde aynı ve beklenen izinleri kapsıyor", () => {
    const beklenen = [...Object.values(IZIN_ESLEMESI).flat(), ...VARSAYILAN_ANAHTARLAR].sort();
    for (const kod of kodlar) {
      expect({ kod, anahtarlar: Object.keys(yukle(app.locales[kod]).ios).sort() }).toEqual({ kod, anahtarlar: beklenen });
    }
  });

  it("değerler dolu ve Expo yazıcısını bozacak karakter içermiyor (\" \\ satır sonu)", () => {
    for (const kod of kodlar) {
      for (const [anahtar, deger] of Object.entries(yukle(app.locales[kod]).ios)) {
        expect({ kod, anahtar, tip: typeof deger }).toEqual({ kod, anahtar, tip: "string" });
        expect({ kod, anahtar, bos: !deger.trim() }).toEqual({ kod, anahtar, bos: false });
        expect({ kod, anahtar, sorunlu: /["\\\r\n]/.test(deger) }).toEqual({ kod, anahtar, sorunlu: false });
      }
    }
  });

  it("$(PRODUCT_NAME) yer tutucusu yok (InfoPlist.strings'te değişken çözülmez; uygulama adı düz yazılmalı)", () => {
    for (const kod of kodlar) {
      for (const [anahtar, deger] of Object.entries(yukle(app.locales[kod]).ios)) {
        expect({ kod, anahtar, yerTutucu: deger.includes("$(") }).toEqual({ kod, anahtar, yerTutucu: false });
      }
    }
  });

  it("farklı dillerde aynı izin metni kopyalanmamış (tr/es gerçekten çevrilmiş)", () => {
    const en = yukle(app.locales[FALLBACK_LANGUAGE]).ios;
    for (const kod of kodlar.filter((k) => k !== FALLBACK_LANGUAGE)) {
      const ios = yukle(app.locales[kod]).ios;
      const kopya = Object.keys(ios).filter((a) => ios[a] === en[a]);
      expect({ kod, kopya }).toEqual({ kod, kopya: [] });
    }
  });

  it("es.json'da Türkçeye özgü harf (ğ ş ı İ) sızmamış, en.json yalnız ASCII", () => {
    for (const deger of Object.values(yukle(app.locales.es).ios)) expect(deger).not.toMatch(/[ğşıİ]/);
    for (const deger of Object.values(yukle(app.locales.en).ios)) expect(deger).not.toMatch(/[^\x20-\x7E]/);
  });
});

describe("app.json izin seçenekleri", () => {
  const izinSecenekleri = [];
  for (const [eklenti, secenekler] of eklentiler) {
    for (const [ad, deger] of Object.entries(secenekler)) {
      if (/Permission$/.test(ad) && typeof deger === "string") izinSecenekleri.push({ eklenti, ad, deger });
    }
  }

  it("izin metni taşıyan seçenekler bulunuyor (test boş geçmesin)", () => {
    expect(izinSecenekleri.map((s) => s.ad).sort()).toEqual(["calendarPermission", "photosPermission", "savePhotosPermission"]);
  });

  it("her '…Permission' seçeneği IZIN_ESLEMESI'nde (yeni izin metni = çeviri kararı zorunlu)", () => {
    const eslenmemis = izinSecenekleri.filter((s) => !(s.ad in IZIN_ESLEMESI)).map((s) => `${s.eklenti}.${s.ad}`);
    expect(eslenmemis).toEqual([]);
  });

  it("yedek (Info.plist) metni İngilizce paketle birebir aynı: desteklenmeyen sistem dili İngilizce görür", () => {
    const en = yukle(app.locales[FALLBACK_LANGUAGE]).ios;
    for (const { ad, deger } of izinSecenekleri) {
      for (const anahtar of IZIN_ESLEMESI[ad]) expect({ ad, anahtar, deger }).toEqual({ ad, anahtar, deger: en[anahtar] });
    }
  });

  it("ios.infoPlist içindeki elle yazılmış NS*UsageDescription anahtarları da her dilde çevrilmiş", () => {
    const elle = Object.keys((app.ios && app.ios.infoPlist) || {}).filter((k) => /^NS.+UsageDescription$/.test(k));
    for (const kod of kodlar) {
      const ios = yukle(app.locales[kod]).ios;
      expect({ kod, eksik: elle.filter((k) => !(k in ios)) }).toEqual({ kod, eksik: [] });
    }
  });

  it("CFBundleLocalizations kayıtlı dillerle aynı", () => {
    const bildirilen = (app.ios && app.ios.infoPlist && app.ios.infoPlist.CFBundleLocalizations) || [];
    expect([...bildirilen].sort()).toEqual(kodlar);
  });
});
