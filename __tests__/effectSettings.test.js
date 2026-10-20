// __tests__/effectSettings.test.js
// Efekt modu store'unun sozlesmesi: cihaz sinifi VARSAYILANI verir, kayitli
// tercih onu ezer.
//
// MMKV GECISI: kayitli tercih ACILISTA SENKRON okunuyor, yani modul yuklenir
// yuklenmez dogru mod gecerli. "Kullanici secimi gec gelen hidrasyona yenilmez"
// korumasi (tercihSurumu) ve onu dogrulayan test bu yuzden kalkti — beklenecek
// bir hidrasyon kalmadi.

const { withSeededStorage } = require("./helpers/storageTestKit");

const loadService = ({ stored = null, tier = "high" } = {}) => {
  jest.resetModules();
  // services/deviceTier native sabit okur (expo-device); testte katman sabitlenir.
  jest.doMock("../services/deviceTier", () => ({
    __esModule: true,
    deviceTier: tier,
    perfPreset: {},
  }));
  const service = withSeededStorage(
    (Keys) => (stored ? [[Keys.effectMode, stored]] : []),
    () => require("../services/effectSettings"),
  );
  return { service, storage: require("../services/storage") };
};

afterEach(() => {
  jest.resetModules();
  jest.dontMock("../services/deviceTier");
});

describe("varsayilan mod cihaz sinifindan gelir", () => {
  test("high/mid cihaz TAM efektle acilir", () => {
    for (const tier of ["high", "mid"]) {
      const { service } = loadService({ tier });
      expect(service.getEffectMode()).toBe("full");
      expect(service.getEffectPresetNow().blurEnabled).toBe(true);
      expect(service.onerilenEffectMode()).toBe("full");
    }
  });

  test("low cihaz KAPALI efektle acilir (bugunku davranis korunur)", () => {
    const { service } = loadService({ tier: "low" });
    expect(service.getEffectMode()).toBe("off");
    expect(service.getEffectPresetNow().blurEnabled).toBe(false);
  });
});

describe("kayitli tercih", () => {
  test("gecerli kayit cihaz kararini ILK OKUMADA ezer", () => {
    const { service } = loadService({ stored: "balanced", tier: "high" });
    expect(service.getEffectMode()).toBe("balanced");
    // "Orta" gorseli korur: blur ACIK, sureklilik maliyetleri kisilir.
    const p = service.getEffectPresetNow();
    expect(p.blurEnabled).toBe(true);
    expect(p.spriteFpsScale).toBeLessThan(1);
  });

  test("low cihazda kullanici TAM secmisse blur geri gelir", () => {
    const { service } = loadService({ stored: "full", tier: "low" });
    expect(service.getEffectMode()).toBe("full");
    expect(service.getEffectPresetNow().blurEnabled).toBe(true);
    // Oneri yine cihazin kararidir; secim onu gizlemez.
    expect(service.onerilenEffectMode()).toBe("off");
  });

  test("bozuk kayit yok sayilir", () => {
    const { service } = loadService({ stored: "ultra", tier: "high" });
    expect(service.getEffectMode()).toBe("full");
  });
});

describe("goc sirasi", () => {
  // REGRESYON KILIDI: bu modul App.js'teki goc kapisindan ONCE yuklenebiliyor
  // (kapi provider agacini tutuyor, modul seviyesindeki kodu tutmuyor). Bir ara
  // tercih yalnizca modul yuklenirken okunuyordu; guncelleme sonrasi ilk
  // acilista bos depoya denk gelip kullanicinin secimi bir oturum boyunca yok
  // sayiliyordu. Artik anahtara ABONE.
  test("modul goc BITMEDEN yuklenirse, goc yazinca tercih devreye girer", async () => {
    jest.resetModules();
    jest.doMock("../services/deviceTier", () => ({
      __esModule: true,
      deviceTier: "high",
      perfPreset: {},
    }));

    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.__reset();
    AsyncStorage.__store.set("effectMode", "off");

    // Depo hala bos: modul cihaz kararina duser.
    const service = require("../services/effectSettings");
    expect(service.getEffectMode()).toBe("full");

    const uyari = jest.fn();
    service.subscribeEffects(uyari);

    await require("../services/storage").runStorageMigration();

    expect(service.getEffectMode()).toBe("off");
    expect(uyari).toHaveBeenCalled();
  });
});

describe("setEffectMode", () => {
  test("modu degistirir, kalicilastirir ve aboneleri uyarir", () => {
    const { service, storage } = loadService({ tier: "high" });
    const uyari = jest.fn();
    const birak = service.subscribeEffects(uyari);

    service.setEffectMode("off");
    expect(service.getEffectMode()).toBe("off");
    expect(service.getEffectPresetNow().blurEnabled).toBe(false);
    expect(uyari).toHaveBeenCalledTimes(1);
    expect(storage.get(storage.Keys.effectMode)).toBe("off");

    birak();
    service.setEffectMode("balanced");
    expect(uyari).toHaveBeenCalledTimes(1); // abonelikten cikti
  });

  test("ayni mod tekrar secilirse yayin yapilmaz (bos render yok)", () => {
    const { service } = loadService({ tier: "high" });
    const uyari = jest.fn();
    service.subscribeEffects(uyari);
    service.setEffectMode("full"); // zaten "full"
    expect(uyari).not.toHaveBeenCalled();
  });

  test("gecersiz mod yok sayilir", () => {
    const { service, storage } = loadService({ tier: "high" });
    service.setEffectMode("turbo");
    expect(service.getEffectMode()).toBe("full");
    expect(storage.has(storage.Keys.effectMode)).toBe(false);
  });

  test("preset REFERANSI yalniz mod degisince degisir (useSyncExternalStore sarti)", () => {
    const { service } = loadService({ tier: "high" });
    const a = service.getEffectPresetNow();
    expect(service.getEffectPresetNow()).toBe(a); // her okumada yeni nesne YOK
    service.setEffectMode("off");
    expect(service.getEffectPresetNow()).not.toBe(a);
  });

  test("persist:false ile oturumluk degisiklik yazilmaz", () => {
    const { service, storage } = loadService({ tier: "high" });
    service.setEffectMode("off", { persist: false });
    expect(service.getEffectMode()).toBe("off");
    expect(storage.has(storage.Keys.effectMode)).toBe(false);
  });
});
