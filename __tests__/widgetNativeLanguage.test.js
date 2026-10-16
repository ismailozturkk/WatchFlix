// __tests__/widgetNativeLanguage.test.js
//
// Native widget'ların (Kotlin / Swift) dil listesi, JS'teki dil kaydıyla AYNI kalmalı.
//
// NEDEN: widget metinleri JS'te değil native kodda; yeni dil kayda eklenince widget
// sessizce İngilizceye düşer ve hiçbir JS testi bunu görmez. Burada kayıttaki her dilin
// (yedek dil İngilizce hariç) iki native tarafta da tanımlı olduğu ve eski
// "isTurkish" ikili kalıbının geri gelmediği doğrulanır.
//
// İkinci blok: widget ADLARI/AÇIKLAMALARI uygulama dilini değil SİSTEM dilini izler
// (Android values-xx/, iOS xx.lproj/Localizable.strings). Her kayıtlı dil için iki
// tarafta da karşılığı olmalı ve anahtar kümeleri eşit kalmalı.
const fs = require("fs");
const path = require("path");
const { SUPPORTED_LANGUAGE_CODES, FALLBACK_LANGUAGE } = require("../utils/appLanguages");

const KOK = path.join(__dirname, "..");
const oku = (...parcalar) => fs.readFileSync(path.join(KOK, ...parcalar), "utf8");
const var_mi = (...parcalar) => fs.existsSync(path.join(KOK, ...parcalar));

const ANDROID_DIZIN = path.join("native", "android-widgets", "java", "com", "smlztrk", "seelogd", "widget");
const ANDROID_RES = path.join("native", "android-widgets", "res");
const SWIFT_DIZIN = path.join("targets", "reminder-widget");

// Yedek dil (en) listede yazılmaz: kayıtsız her şey zaten ona düşer.
const beklenen = SUPPORTED_LANGUAGE_CODES.filter((kod) => kod !== FALLBACK_LANGUAGE).sort();

const kodlar = (govde) => [...govde.matchAll(/"([a-z]{2})"/g)].map((e) => e[1]).sort();

describe("native widget dil listesi", () => {
  it("Android WidgetLanguage.SUPPORTED kayıtla aynı", () => {
    const kaynak = oku(ANDROID_DIZIN, "WidgetLanguage.kt");
    const govde = kaynak.match(/SUPPORTED\s*=\s*setOf\(([^)]*)\)/);
    expect(govde).not.toBeNull();
    expect(kodlar(govde[1])).toEqual(beklenen);
  });

  it("iOS widgetSupportedLanguages kayıtla aynı", () => {
    const kaynak = oku(SWIFT_DIZIN, "shared.swift");
    const govde = kaynak.match(/widgetSupportedLanguages:\s*Set<String>\s*=\s*\[([^\]]*)\]/);
    expect(govde).not.toBeNull();
    expect(kodlar(govde[1])).toEqual(beklenen);
  });

  it("Android pick() her kayıtlı dilin kolunu taşır", () => {
    const kaynak = oku(ANDROID_DIZIN, "WidgetLanguage.kt");
    for (const kod of beklenen) expect(kaynak).toMatch(new RegExp(`"${kod}"\\s*->`));
  });

  it("iOS widgetPick() her kayıtlı dilin kolunu taşır", () => {
    const kaynak = oku(SWIFT_DIZIN, "shared.swift");
    for (const kod of beklenen) expect(kaynak).toMatch(new RegExp(`case "${kod}":`));
  });

  it("eski ikili 'isTurkish' kalıbı native koda geri girmemiş", () => {
    const dosyalar = [
      ...fs.readdirSync(path.join(KOK, ANDROID_DIZIN)).filter((d) => d.endsWith(".kt")).map((d) => path.join(ANDROID_DIZIN, d)),
      ...fs.readdirSync(path.join(KOK, SWIFT_DIZIN)).filter((d) => d.endsWith(".swift")).map((d) => path.join(SWIFT_DIZIN, d)),
    ];
    expect(dosyalar.length).toBeGreaterThan(8);
    const sizan = dosyalar.filter((d) => /isTurkish\b|isTurkishLanguage|hasPrefix\("tr"\)|startsWith\("tr"\)/.test(oku(d)));
    expect(sizan).toEqual([]);
  });

  it("Android config eklentisi java klasörünü bütün olarak kopyalıyor (yeni .kt dosyası ayrıca eklenmez)", () => {
    const eklenti = oku("plugins", "withAndroidWidgets.js");
    expect(eklenti).toMatch(/cpSync\(\s*path\.join\(SRC_DIR,\s*"java"\)/);
  });

  it("Android config eklentisi res klasörünü bütün olarak kopyalıyor (values-xx/ ayrıca eklenmez)", () => {
    const eklenti = oku("plugins", "withAndroidWidgets.js");
    expect(eklenti).toMatch(/cpSync\(\s*path\.join\(SRC_DIR,\s*"res"\)/);
  });
});

// ── Widget adları / açıklamaları (SİSTEM dili) ────────────────────────────────────────────

/** `<string name="x">değer</string>` → { x: "değer" } */
const xmlSozluk = (govde) => {
  const sonuc = {};
  for (const e of govde.matchAll(/<string\s+name="([^"]+)"[^>]*>([^<]*)<\/string>/g)) sonuc[e[1]] = e[2];
  return sonuc;
};

/** Android'de varsayılan values/ Türkçedir; diğer her kayıtlı dil kendi values-xx/ klasörünü ister. */
const ANDROID_VARSAYILAN_DIL = "tr";
const androidDiller = SUPPORTED_LANGUAGE_CODES.filter((kod) => kod !== ANDROID_VARSAYILAN_DIL).sort();

describe("Android widget adları (values-xx/, sistem diline göre)", () => {
  const varsayilan = xmlSozluk(oku(ANDROID_RES, "values", "widget_strings.xml"));

  it("varsayılan values/ dosyası okunabiliyor", () => {
    expect(Object.keys(varsayilan).length).toBeGreaterThan(20);
  });

  it("Türkçe dışındaki her kayıtlı dilin values-xx/widget_strings.xml dosyası var", () => {
    const eksik = androidDiller.filter((kod) => !var_mi(ANDROID_RES, `values-${kod}`, "widget_strings.xml"));
    expect(eksik).toEqual([]);
  });

  for (const kod of androidDiller) {
    describe(`values-${kod}`, () => {
      const dosya = path.join(ANDROID_RES, `values-${kod}`, "widget_strings.xml");
      const sozluk = var_mi(dosya) ? xmlSozluk(oku(dosya)) : {};

      it("anahtar kümesi varsayılanla birebir aynı", () => {
        expect(Object.keys(sozluk).sort()).toEqual(Object.keys(varsayilan).sort());
      });

      it("hiçbir değer boş değil", () => {
        expect(Object.entries(sozluk).filter(([, v]) => !v.trim())).toEqual([]);
      });

      it("adlar ve açıklamalar gerçekten çevrilmiş (Türkçe kopya değil)", () => {
        const cevrilmesiGerekenler = Object.keys(varsayilan).filter((k) => /_(name|description|empty|prev|next)$/.test(k));
        expect(cevrilmesiGerekenler.length).toBeGreaterThanOrEqual(9);
        const kopya = cevrilmesiGerekenler.filter((k) => sozluk[k] === varsayilan[k]);
        expect(kopya).toEqual([]);
      });

      it("sayılar/işaretler varsayılanla aynı (0 hatırlatma, +0, 1/4)", () => {
        const sayilar = (v) => (v.match(/[+]?\d+(?:\/\d+)?/g) || []).join("|");
        const farkli = Object.keys(varsayilan).filter((k) => sayilar(sozluk[k] || "") !== sayilar(varsayilan[k]));
        expect(farkli).toEqual([]);
      });

      it("kaçışsız kesme işareti ve '&' yok (Android aapt derlemesini bozar)", () => {
        const sorunlu = Object.entries(sozluk).filter(([, v]) => /(^|[^\\])'/.test(v) || /&(?!(?:amp|lt|gt|quot|apos);)/.test(v));
        expect(sorunlu).toEqual([]);
      });

      it("XML yorumunun içinde '--' yok (geçersiz XML)", () => {
        const yorumlar = [...oku(dosya).matchAll(/<!--([\s\S]*?)-->/g)].map((e) => e[1]);
        expect(yorumlar.length).toBeGreaterThan(0);
        expect(yorumlar.filter((y) => y.includes("--"))).toEqual([]);
      });
    });
  }

  it("manifest etiketleri ve appwidget açıklamaları bu string'lere başvuruyor (yeni anahtar sessizce yetim kalmaz)", () => {
    const eklenti = oku("plugins", "withAndroidWidgets.js");
    for (const ad of ["reminder_widget_name", "lists_widget_name", "stats_widget_name"]) {
      expect(eklenti).toContain(`@string/${ad}`);
      expect(varsayilan).toHaveProperty(ad);
    }
    for (const ad of ["reminder", "lists", "stats"]) {
      expect(oku(ANDROID_RES, "xml", `${ad}_widget_info.xml`)).toContain(`@string/${ad}_widget_description`);
    }
  });
});

describe("iOS widget galeri adları (xx.lproj/Localizable.strings, sistem diline göre)", () => {
  const iosDiller = [...SUPPORTED_LANGUAGE_CODES].sort();

  // Blok yorumlarını atıp `"anahtar" = "değer";` çiftlerini döndürür; biçim bozuksa satırı bildirir.
  const stringsCozumle = (metin) => {
    const sade = metin.replace(/\/\*[\s\S]*?\*\//g, "");
    const cift = {};
    const bozuk = [];
    for (const satir of sade.split(/\r?\n/)) {
      if (!satir.trim()) continue;
      const m = satir.match(/^"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)";\s*$/);
      if (!m) bozuk.push(satir);
      else cift[m[1]] = m[2];
    }
    return { cift, bozuk };
  };

  const strings = (kod) => stringsCozumle(oku(SWIFT_DIZIN, `${kod}.lproj`, "Localizable.strings"));

  it("her kayıtlı dilin (en dahil) Localizable.strings dosyası var", () => {
    const eksik = iosDiller.filter((kod) => !var_mi(SWIFT_DIZIN, `${kod}.lproj`, "Localizable.strings"));
    expect(eksik).toEqual([]);
  });

  it("dosyalarda biçim hatası yok (anahtar = değer;)", () => {
    for (const kod of iosDiller) expect({ kod, bozuk: strings(kod).bozuk }).toEqual({ kod, bozuk: [] });
  });

  it("anahtar kümeleri her dilde aynı", () => {
    const [ilk, ...diger] = iosDiller;
    const referans = Object.keys(strings(ilk).cift).sort();
    expect(referans.length).toBeGreaterThanOrEqual(6);
    for (const kod of diger) expect({ kod, anahtarlar: Object.keys(strings(kod).cift).sort() }).toEqual({ kod, anahtarlar: referans });
  });

  it("Swift'te kullanılan her LocalizedStringKey her dilde tanımlı", () => {
    const swiftDosyalari = fs.readdirSync(path.join(KOK, SWIFT_DIZIN)).filter((d) => d.endsWith(".swift"));
    const kullanilan = new Set();
    for (const d of swiftDosyalari) {
      for (const m of oku(SWIFT_DIZIN, d).matchAll(/LocalizedStringKey\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g)) kullanilan.add(m[1]);
    }
    // 3 widget x (ad + açıklama)
    expect(kullanilan.size).toBe(6);
    for (const kod of iosDiller) {
      const tanimli = strings(kod).cift;
      expect({ kod, eksik: [...kullanilan].filter((k) => !(k in tanimli)) }).toEqual({ kod, eksik: [] });
    }
  });

  it("widget ad/açıklamaları sabit metin olarak geri girmemiş (hepsi LocalizedStringKey)", () => {
    const swiftDosyalari = fs.readdirSync(path.join(KOK, SWIFT_DIZIN)).filter((d) => d.endsWith(".swift"));
    const sabit = [];
    for (const d of swiftDosyalari) {
      oku(SWIFT_DIZIN, d)
        .split(/\r?\n/)
        .forEach((satir, i) => {
          if (/\.(configurationDisplayName|description)\(\s*"/.test(satir)) sabit.push(`${d}:${i + 1}`);
        });
    }
    expect(sabit).toEqual([]);
  });

  it("anahtar İngilizce metnin kendisi: en.lproj kimlik eşlemesi, tr/es gerçekten çevrilmiş", () => {
    const en = strings(FALLBACK_LANGUAGE).cift;
    expect(Object.entries(en).filter(([k, v]) => k !== v)).toEqual([]);
    for (const kod of iosDiller.filter((k) => k !== FALLBACK_LANGUAGE)) {
      const cevrilmemis = Object.entries(strings(kod).cift).filter(([k, v]) => k === v);
      expect({ kod, cevrilmemis }).toEqual({ kod, cevrilmemis: [] });
    }
  });

  it("es.lproj'da Türkçeye özgü harf (ğ ş ı İ) sızmamış", () => {
    expect(oku(SWIFT_DIZIN, "es.lproj", "Localizable.strings")).not.toMatch(/[ğşıİ]/);
  });
});
