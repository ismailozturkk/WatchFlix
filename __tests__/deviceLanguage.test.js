// __tests__/deviceLanguage.test.js
//
// Cihaz dili seçimi: yanlış karar "her yabancı kullanıcı Türkçe açılıyor"
// hatasını geri getirir, ekranda da sessizce olur — sınırlar burada kilitli.
const {
  cihazDilindenSec,
  DESTEKLENEN_DILLER,
  YEDEK_DIL,
} = require("../utils/deviceLanguage");

const locale = (languageCode) => ({ languageCode });

describe("cihazDilindenSec", () => {
  it("Türkçe cihaz Türkçe açılır", () => {
    expect(cihazDilindenSec([locale("tr")])).toBe("tr");
  });

  it("İngilizce cihaz İngilizce açılır", () => {
    expect(cihazDilindenSec([locale("en")])).toBe("en");
  });

  it("desteklenmeyen dil yedek dile düşer (Türkçe'ye DEĞİL)", () => {
    expect(cihazDilindenSec([locale("de")])).toBe("en");
    expect(cihazDilindenSec([locale("ar")])).toBe("en");
    expect(cihazDilindenSec([locale("ja")])).toBe("en");
  });

  it("yalnız ilk tercih dikkate alınır", () => {
    // Cihazın birinci dili İngilizce, ikincisi Türkçe → İngilizce.
    expect(cihazDilindenSec([locale("en"), locale("tr")])).toBe("en");
    expect(cihazDilindenSec([locale("tr"), locale("en")])).toBe("tr");
    // Birinci dil desteklenmiyorsa listede ilerideki "tr" onu kurtarmaz.
    expect(cihazDilindenSec([locale("fr"), locale("tr")])).toBe("en");
  });

  it("bölgeli etiketler kısaltılır", () => {
    expect(cihazDilindenSec([locale("tr-TR")])).toBe("tr");
    expect(cihazDilindenSec([locale("en-US")])).toBe("en");
    expect(cihazDilindenSec([locale("en_GB")])).toBe("en");
    expect(cihazDilindenSec([locale("TR")])).toBe("tr");
  });

  it("geçersiz kayıtlar atlanır, sonrakine bakılır", () => {
    expect(cihazDilindenSec([locale(null), locale("tr")])).toBe("tr");
    expect(cihazDilindenSec([locale(""), locale("tr")])).toBe("tr");
    expect(cihazDilindenSec([{}, locale("tr")])).toBe("tr");
    expect(cihazDilindenSec([null, locale("tr")])).toBe("tr");
  });

  it("okunamayan cihaz yedek dile düşer", () => {
    expect(cihazDilindenSec([])).toBe(YEDEK_DIL);
    expect(cihazDilindenSec(undefined)).toBe(YEDEK_DIL);
    expect(cihazDilindenSec(null)).toBe(YEDEK_DIL);
    expect(cihazDilindenSec("tr")).toBe(YEDEK_DIL); // dizi değil
    expect(cihazDilindenSec([locale(42)])).toBe(YEDEK_DIL);
  });

  it("dönen değer daima desteklenen bir dil", () => {
    const girdiler = [[locale("tr")], [locale("zz")], [], null, [locale("en-AU")]];
    for (const girdi of girdiler) {
      expect(DESTEKLENEN_DILLER).toContain(cihazDilindenSec(girdi));
    }
  });
});
