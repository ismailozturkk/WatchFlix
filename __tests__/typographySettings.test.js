// __tests__/typographySettings.test.js
// Rol bazli font tercihi store'unun sozlesmesi: uc rol bagimsiz, eski tek
// anahtarli kayit uc role birden tasinir.
//
// MMKV GECISI: tercih artik ACILISTA SENKRON okunuyor. "Kullanici secimi gec
// gelen hidrasyona yenilmez" korumasi (kullaniciSecti) bu yuzden kaldirildi —
// gec gelen bir hidrasyon artik yok. Ilgili test de kalkti; yerine tohumlanmis
// depodan ILK OKUMADA dogru deger geldigi dogrulaniyor.

const { withSeededStorage } = require("./helpers/storageTestKit");

const loadService = ({ roles = null } = {}) => {
  jest.resetModules();
  const service = withSeededStorage(
    (Keys) => (roles ? [[Keys.fontRoles, roles]] : []),
    () => require("../services/typographySettings"),
  );
  return { service, storage: require("../services/storage") };
};

// Eski tek anahtarli kaydin tasinmasi artik gocun isi (registry: fontRoles.legacy).
const loadServiceWithLegacyKey = async (legacyPresetId) => {
  jest.resetModules();
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  AsyncStorage.__reset();
  AsyncStorage.__store.set("appFontFamily", legacyPresetId);
  await require("../services/storage").runStorageMigration();
  return require("../services/typographySettings");
};

afterEach(() => {
  jest.resetModules();
});

describe("varsayilan durum", () => {
  test("kayit yokken uc rol de sistem fontunda", () => {
    const { service } = loadService();
    expect(service.getTypographyState()).toMatchObject({
      heading: "system",
      body: "system",
      numeric: "system",
      fontsLoaded: false,
    });
  });

  test("bozuk JSON kaydi varsayilana duser", () => {
    jest.resetModules();
    const storage = require("../services/storage");
    // Registry disindan bozuk veri enjekte et.
    storage.getStore("settings").set(storage.Keys.fontRoles.key, "{bozuk");
    const service = require("../services/typographySettings");
    expect(service.getTypographyState().heading).toBe("system");
  });

  test("tanimsiz preset id'si yok sayilir", () => {
    const { service } = loadService({
      roles: { heading: "yokBoyleFont", body: "inter" },
    });
    expect(service.getTypographyState().heading).toBe("system");
    expect(service.getTypographyState().body).toBe("inter");
  });
});

describe("kayitli tercih", () => {
  test("uc rol bagimsiz olarak ILK OKUMADA geri yuklenir", () => {
    const { service } = loadService({
      roles: { heading: "bebasNeue", body: "inter", numeric: "spaceMono" },
    });
    expect(service.getTypographyState()).toMatchObject({
      heading: "bebasNeue",
      body: "inter",
      numeric: "spaceMono",
    });
  });

  test("ESKI tek anahtarli kayit gocte yalniz uygun rollere tasinir", async () => {
    const service = await loadServiceWithLegacyKey("oswald");
    expect(service.getTypographyState()).toMatchObject({
      heading: "oswald",
      body: "oswald",
      numeric: "oswald",
    });

    // Dekoratif font, uygun olmadigi govde rolune tasinmamali.
    const dekoratif = await loadServiceWithLegacyKey("monoton");
    expect(dekoratif.getTypographyState()).toMatchObject({
      heading: "monoton",
      body: "system",
      numeric: "monoton",
    });
  });

  test("yeni anahtar varsa eski anahtar yok sayilir", async () => {
    jest.resetModules();
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.__reset();
    AsyncStorage.__store.set("appFontFamily", "monoton");
    AsyncStorage.__store.set(
      "appFontRoles",
      JSON.stringify({ heading: "inter", body: "inter", numeric: "inter" }),
    );
    await require("../services/storage").runStorageMigration();
    const service = require("../services/typographySettings");
    expect(service.getTypographyState().heading).toBe("inter");
  });
});

describe("goc sirasi", () => {
  // REGRESYON KILIDI — bkz. __tests__/effectSettings.test.js'deki ayni desen:
  // modul goc kapisindan once yuklenebiliyor, bu yuzden anahtara abone.
  test("modul goc BITMEDEN yuklenirse, goc yazinca fontlar devreye girer", async () => {
    jest.resetModules();
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.__reset();
    AsyncStorage.__store.set(
      "appFontRoles",
      JSON.stringify({ heading: "bebasNeue", body: "inter", numeric: "spaceMono" }),
    );

    // Depo hala bos: sistem fontuyla baslar.
    const service = require("../services/typographySettings");
    expect(service.getTypographyState().heading).toBe("system");

    await require("../services/storage").runStorageMigration();

    expect(service.getTypographyState()).toMatchObject({
      heading: "bebasNeue",
      body: "inter",
      numeric: "spaceMono",
    });
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
    expect(storage.get(storage.Keys.fontRoles)).toEqual({
      heading: "bebasNeue",
      body: "system",
      numeric: "system",
    });
  });

  test("gecersiz rol veya preset yok sayilir", () => {
    const { service, storage } = loadService();
    service.setFontRole("baslik", "inter");
    service.setFontRole("heading", "yokBoyleFont");
    expect(service.getTypographyState().heading).toBe("system");
    expect(storage.has(storage.Keys.fontRoles)).toBe(false);
  });

  test("role uygun olmayan preset yok sayilir", () => {
    const { service, storage } = loadService();
    service.setFontRole("body", "monoton");
    expect(service.getTypographyState().body).toBe("system");
    expect(storage.has(storage.Keys.fontRoles)).toBe(false);
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
    expect(storage.has(storage.Keys.fontRoles)).toBe(false);
  });

  test("persist:false kaydetmez ama oturum ici gecerlidir", () => {
    const { service, storage } = loadService();
    service.setFontRole("numeric", "spaceMono", { persist: false });
    expect(service.getTypographyState().numeric).toBe("spaceMono");
    expect(storage.has(storage.Keys.fontRoles)).toBe(false);
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
    expect(storage.has(storage.Keys.fontRoles)).toBe(false);

    service.setFontsLoaded(true);
    expect(dinleyici).toHaveBeenCalledTimes(1);
  });
});
