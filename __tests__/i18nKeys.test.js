// __tests__/i18nKeys.test.js
//
// Kayıp çeviri anahtarı bekçisi.
//
// NEDEN: `i18nText(key, türkçeFallback)` + i18next `fallbackLng: "tr"` ikilisi
// eksik anahtarı SESSİZCE yutar — ekran patlamaz, yalnızca İngilizce kullanan
// kullanıcıya Türkçe basar. Denetimde koddan çağrılan 87 anahtarın iki pakette
// de bulunmadığı böyle ortaya çıktı. Bu test o sınıfı build zamanına çeker:
// anahtar eklemeyi unutan geliştirici kırmızı test görür, EN kullanıcı değil.
//
// KAPSAM: statik `"autoI18n.x"` dizgeleri regex'le çıkarılır. Anahtarı çalışma
// anında kuran çağrı yerleri (`autoI18n.${...}`) regex'le çözülemez; her biri
// DINAMIK_YERLER'de elle kayıtlı ve KAYITSIZ yeni bir dinamik çağrı çıkarsa
// test kırılır (yoksa bu sınıf sessizce geri gelirdi).

const fs = require("fs");
const path = require("path");

const KOK = path.join(__dirname, "..");

// Taranan kaynak ağacı. Yeni bir üst klasör açılırsa buraya eklenmeli.
const TARANAN_KLASORLER = ["screens", "components", "context", "services", "utils"];
const TARANAN_DOSYALAR = ["App.js"];

// `i18nText("autoI18n.x"` ve `t("autoI18n.x"` — tek/çift tırnak.
// `t` öncesindeki [\w.] engeli `format(`/`.at(` gibi çağrıları eler; zaten
// "autoI18n." öneki şartı olduğu için yanlış eşleşme pratikte imkânsız.
const STATIK_DESEN = /(?:i18nText|(?<![\w.])t)\(\s*(["'])autoI18n\.([A-Za-z0-9_]+)\1/g;

// Anahtarı şablonla kuran dosyalar. Her kayıt, o dosyadaki anahtar TABLOSUNU
// okuyan desenleri verir — böylece tabloya satır eklenince test onu da korur.
const DINAMIK_YERLER = [
  {
    dosya: "screens/tabs/settings/WidgetSettingsScreen.js",
    // Dosyaya özel `copy(key, fallback)` sarmalayıcısı `autoI18n.${key}` çağırır.
    // Ayrıca WIDGETS tablosundaki titleKey'ler copy()'ye değişkenle giriyor.
    desenler: [/\bcopy\(\s*"([A-Za-z0-9_]+)"/g, /\btitleKey:\s*"([A-Za-z0-9_]+)"/g],
  },
  {
    dosya: "components/moderation/ReportReasonSheet.js",
    desenler: [/\bkey:\s*"([A-Za-z0-9_]+)"/g], // REASON_UI tablosu
  },
  {
    dosya: "components/notifications/NotificationPrimingSheet.js",
    desenler: [/\bkey:\s*"([A-Za-z0-9_]+)"/g], // BENEFITS tablosu
  },
  {
    dosya: "components/CacheManagerModal.js",
    // META tablosunun ALAN ADI anahtarın gövdesi: `autoI18n.cache_${cat.id}`.
    desenler: [/^ {2}([A-Za-z0-9_]+):\s*\{\s*tr:/gm],
    onek: "cache_",
  },
];

function jsDosyalari(klasor, toplam = []) {
  for (const girdi of fs.readdirSync(klasor, { withFileTypes: true })) {
    const tamYol = path.join(klasor, girdi.name);
    if (girdi.isDirectory()) {
      if (girdi.name === "node_modules" || girdi.name === "__tests__") continue;
      jsDosyalari(tamYol, toplam);
    } else if (girdi.name.endsWith(".js")) {
      toplam.push(tamYol);
    }
  }
  return toplam;
}

const kaynakDosyalari = [
  ...TARANAN_KLASORLER.flatMap((k) => jsDosyalari(path.join(KOK, k))),
  ...TARANAN_DOSYALAR.map((d) => path.join(KOK, d)),
];

const goreliYol = (tamYol) => path.relative(KOK, tamYol).split(path.sep).join("/");

// anahtar -> onu çağıran dosyalar (hata mesajında "nerede" yazabilmek için).
const kullanilanAnahtarlar = new Map();
const ekle = (anahtar, dosya) => {
  if (!kullanilanAnahtarlar.has(anahtar)) kullanilanAnahtarlar.set(anahtar, new Set());
  kullanilanAnahtarlar.get(anahtar).add(dosya);
};

const dinamikSablonluDosyalar = new Set();

for (const tamYol of kaynakDosyalari) {
  const kaynak = fs.readFileSync(tamYol, "utf8");
  const rel = goreliYol(tamYol);

  for (const eslesme of kaynak.matchAll(STATIK_DESEN)) ekle(eslesme[2], rel);

  if (/autoI18n\.\$\{/.test(kaynak)) dinamikSablonluDosyalar.add(rel);

  const kayit = DINAMIK_YERLER.find((y) => y.dosya === rel);
  if (kayit) {
    for (const desen of kayit.desenler) {
      for (const eslesme of kaynak.matchAll(desen)) ekle(`${kayit.onek || ""}${eslesme[1]}`, rel);
    }
  }
}

const paket = (ad) => JSON.parse(fs.readFileSync(path.join(KOK, "translations", ad), "utf8"));
const tr = paket("tr.json");
const en = paket("en.json");

// Sözlüğü "a.b.c" düz anahtar listesine indirger (paketler iç içe).
function duzAnahtarlar(nesne, onek = "", toplam = []) {
  for (const ad of Object.keys(nesne)) {
    const deger = nesne[ad];
    const yol = onek ? `${onek}.${ad}` : ad;
    if (deger && typeof deger === "object" && !Array.isArray(deger)) duzAnahtarlar(deger, yol, toplam);
    else toplam.push(yol);
  }
  return toplam;
}

describe("i18n anahtar bekçisi", () => {
  it("tarama gerçekten çalışıyor (desen bozulursa test sessizce yeşile dönmesin)", () => {
    expect(kaynakDosyalari.length).toBeGreaterThan(200);
    expect(kullanilanAnahtarlar.size).toBeGreaterThan(1000);
  });

  it("koddan çağrılan her autoI18n anahtarı tr.json'da var", () => {
    const eksik = [...kullanilanAnahtarlar.entries()]
      .filter(([anahtar]) => !(anahtar in (tr.autoI18n || {})))
      .map(([anahtar, dosyalar]) => `${anahtar}  (${[...dosyalar].join(", ")})`);
    expect(eksik).toEqual([]);
  });

  it("koddan çağrılan her autoI18n anahtarı en.json'da var", () => {
    const eksik = [...kullanilanAnahtarlar.entries()]
      .filter(([anahtar]) => !(anahtar in (en.autoI18n || {})))
      .map(([anahtar, dosyalar]) => `${anahtar}  (${[...dosyalar].join(", ")})`);
    expect(eksik).toEqual([]);
  });

  it("tr.json ve en.json aynı anahtar kümesine sahip", () => {
    const trKumesi = new Set(duzAnahtarlar(tr));
    const enKumesi = new Set(duzAnahtarlar(en));
    expect([...trKumesi].filter((k) => !enKumesi.has(k))).toEqual([]); // EN'de eksik
    expect([...enKumesi].filter((k) => !trKumesi.has(k))).toEqual([]); // TR'de eksik
  });

  it("EN paketinde hiçbir değer boş bırakılmamış", () => {
    const bos = Object.entries(en.autoI18n || {})
      .filter(([, deger]) => typeof deger === "string" && deger.trim() === "")
      .map(([anahtar]) => anahtar);
    expect(bos).toEqual([]);
  });

  it("anahtarı şablonla kuran her dosya DINAMIK_YERLER'de kayıtlı", () => {
    // Kayıtsız dinamik çağrı = regex'in göremediği, bu yüzden hiç korunmayan
    // anahtar ailesi. `cache_*` ailesi tam olarak böyle gözden kaçmıştı.
    const kayitli = new Set(DINAMIK_YERLER.map((y) => y.dosya));
    expect([...dinamikSablonluDosyalar].filter((d) => !kayitli.has(d))).toEqual([]);
  });

  it("DINAMIK_YERLER kaydı bayatlamadı (her kayıt hâlâ anahtar üretiyor)", () => {
    const bos = DINAMIK_YERLER.filter((yer) => {
      const tamYol = path.join(KOK, yer.dosya);
      if (!fs.existsSync(tamYol)) return true;
      const kaynak = fs.readFileSync(tamYol, "utf8");
      // `/g` desenlerde test() lastIndex'i ilerletir — her denemede sıfırla.
      return !yer.desenler.some((desen) => {
        desen.lastIndex = 0;
        return desen.test(kaynak);
      });
    }).map((yer) => yer.dosya);
    expect(bos).toEqual([]);
  });
});
