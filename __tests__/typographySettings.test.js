// __tests__/typographySettings.test.js
// Rol bazli font tercihi store'unun sozlesmesi: uc rol bagimsiz, eski tek
// anahtarli kayit uc role birden tasinir, kullanici secimi gec gelen
// hidrasyona yenilmez.

const loadService = ({ roles = null, legacy = null } = {}) => {
  jest.resetModules();
  const storage = {
    getItem: jest.fn((key) =>
      Promise.resolve(key === "appFontRoles" ? roles : legacy),
    ),
    setItem: jest.fn(() => Promise.resolve()),
  };
  jest.doMock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: storage,
  }));
  return { service: require("../services/typographySettings"), storage };
};

// Hidrasyon bir mikro-gorev zinciri; bir tur beklemek yeterli.
const hidrasyonuBekle = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  jest.resetModules();
  jest.dontMock("@react-native-async-storage/async-storage");
});

describe("varsayilan durum", () => {
  test("kayit yokken uc rol de sistem fontunda", async () => {
    const { service } = loadService();
    expect(service.getTypographyState()).toMatchObject({
      heading: "system",
      body: "system",
      numeric: "system",
      fontsLoaded: false,
    });
    await hidrasyonuBekle();
    expect(service.getTypographyState().heading).toBe("system");
  });

  test("bozuk JSON kaydi varsayilana duser", async () => {
    const { service } = loadService({ roles: "{bozuk" });
    await hidrasyonuBekle();
    expect(service.getTypographyState().heading).toBe("system");
  });

  test("tanimsiz preset id'si yok sayilir", async () => {
    const { service } = loadService({
      roles: JSON.stringify({ heading: "yokBoyleFont", body: "inter" }),
    });
    await hidrasyonuBekle();
    expect(service.getTypographyState().heading).toBe("system");
    expect(service.getTypographyState().body).toBe("inter");
  });
});

describe("kayitli tercih", () => {
  test("uc rol bagimsiz olarak geri yuklenir", async () => {
    const { service } = loadService({
      roles: JSON.stringify({
        heading: "bebasNeue",
        body: "inter",
        numeric: "spaceMono",
      }),
    });
    await hidrasyonuBekle();
    expect(service.getTypographyState()).toMatchObject({
      heading: "bebasNeue",
      body: "inter",
      numeric: "spaceMono",
    });
  });

  test("ESKI tek anahtarli kayit yalniz uygun rollere tasinir", async () => {
    // Dekoratif font, uygun olmadığı gövde ve rakam rollerine taşınmamalı.
    const { service } = loadService({ legacy: "oswald" });
    await hidrasyonuBekle();
    expect(service.getTypographyState()).toMatchObject({
      heading: "oswald",
      body: "oswald",
      numeric: "oswald",
    });

    const { service: dekoratifService } = loadService({ legacy: "monoton" });
    await hidrasyonuBekle();
    expect(dekoratifService.getTypographyState()).toMatchObject({
      heading: "monoton",
      body: "system",
      numeric: "monoton",
    });
  });

  test("yeni anahtar varsa eski anahtar yok sayilir", async () => {
    const { service } = loadService({
      roles: JSON.stringify({ heading: "inter", body: "inter", numeric: "inter" }),
      legacy: "monoton",
    });
    await hidrasyonuBekle();
    expect(service.getTypographyState().heading).toBe("inter");
  });
});

describe("secim", () => {
  test("tek rol degistirmek digerlerine dokunmaz", () => {
    const { service, storage } = loadService();
    service.setFontRole("heading", "bebasNeue");
    expect(service.getTypographyState()).toMatchObject({
      heading: "bebasNeue",
      body: "system",
      numeric: "system",
    });
    expect(storage.setItem).toHaveBeenCalledWith(
      "appFontRoles",
      JSON.stringify({ heading: "bebasNeue", body: "system", numeric: "system" }),
    );
  });

  test("gecersiz rol veya preset yok sayilir", () => {
    const { service, storage } = loadService();
    service.setFontRole("baslik", "inter");
    service.setFontRole("heading", "yokBoyleFont");
    expect(service.getTypographyState().heading).toBe("system");
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("role uygun olmayan preset yok sayilir", () => {
    const { service, storage } = loadService();
    service.setFontRole("body", "monoton");
    expect(service.getTypographyState().body).toBe("system");
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("tumune uygula uc rolu birden ayarlar", () => {
    const { service } = loadService();
    service.setAllFontRoles("inter");
    expect(service.getTypographyState()).toMatchObject({
      heading: "inter",
      body: "inter",
      numeric: "inter",
    });
  });

  test("tumune uygula uyumsuz fontu reddeder", () => {
    const { service, storage } = loadService();
    service.setAllFontRoles("monoton");
    expect(service.getTypographyState()).toMatchObject({
      heading: "system",
      body: "system",
      numeric: "system",
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("kullanici secimi gec gelen hidrasyonu ezer AMA sadece o rolde", async () => {
    const { service } = loadService({ legacy: "monoton" });
    service.setFontRole("body", "inter");
    await hidrasyonuBekle();
    // Secilen rol korunur...
    expect(service.getTypographyState().body).toBe("inter");
    // ...dokunulmayan uygun rol diskteki tercihle yüklenmeye devam eder.
    // Monoton yeni katalogda rakama da açıkça uygun kabul edilir.
    expect(service.getTypographyState().heading).toBe("monoton");
    expect(service.getTypographyState().numeric).toBe("monoton");
  });

  test("persist:false kaydetmez ama oturum ici gecerlidir", () => {
    const { service, storage } = loadService();
    service.setFontRole("numeric", "spaceMono", { persist: false });
    expect(service.getTypographyState().numeric).toBe("spaceMono");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe("abonelik", () => {
  test("degisimde dinleyici tetiklenir, ayni degerde tetiklenmez", () => {
    const { service } = loadService();
    const dinleyici = jest.fn();
    const birak = service.subscribeTypography(dinleyici);

    service.setFontRole("heading", "inter");
    expect(dinleyici).toHaveBeenCalledTimes(1);

    // Ayni deger -> yeni anlik goruntu URETILMEMELI (useSyncExternalStore
    // sonsuz donguye girer).
    const oncekiDurum = service.getTypographyState();
    service.setFontRole("heading", "inter");
    expect(dinleyici).toHaveBeenCalledTimes(1);
    expect(service.getTypographyState()).toBe(oncekiDurum);

    birak();
    service.setFontRole("heading", "oswald");
    expect(dinleyici).toHaveBeenCalledTimes(1);
  });

  test("fontsLoaded ayri bir alan olarak yayilir", () => {
    const { service, storage } = loadService();
    const dinleyici = jest.fn();
    service.subscribeTypography(dinleyici);

    service.setFontsLoaded(true);
    expect(service.getTypographyState().fontsLoaded).toBe(true);
    expect(dinleyici).toHaveBeenCalledTimes(1);
    // Font yuklenmesi bir KULLANICI tercihi degil; diske yazilmamali.
    expect(storage.setItem).not.toHaveBeenCalled();

    service.setFontsLoaded(true);
    expect(dinleyici).toHaveBeenCalledTimes(1);
  });
});
