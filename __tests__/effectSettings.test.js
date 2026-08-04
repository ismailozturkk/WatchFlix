// __tests__/effectSettings.test.js
// Efekt modu store'unun sozlesmesi: cihaz sinifi VARSAYILANI verir, kayitli
// tercih onu ezer, kullanici secimi gec gelen hidrasyona yenilmez.

const loadService = ({ stored = null, tier = "high" } = {}) => {
  jest.resetModules();
  const storage = {
    getItem: jest.fn(() => Promise.resolve(stored)),
    setItem: jest.fn(() => Promise.resolve()),
  };
  jest.doMock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: storage,
  }));
  // services/deviceTier native sabit okur (expo-device); testte katman sabitlenir.
  jest.doMock("../services/deviceTier", () => ({
    __esModule: true,
    deviceTier: tier,
    perfPreset: {},
  }));
  return { service: require("../services/effectSettings"), storage };
};

// Hidrasyon bir mikro-gorev zinciri; iki tur beklemek yeterli.
const hidrasyonuBekle = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  jest.resetModules();
  jest.dontMock("@react-native-async-storage/async-storage");
  jest.dontMock("../services/deviceTier");
});

describe("varsayilan mod cihaz sinifindan gelir", () => {
  test("high/mid cihaz TAM efektle acilir", async () => {
    for (const tier of ["high", "mid"]) {
      const { service } = loadService({ tier });
      expect(service.getEffectMode()).toBe("full");
      expect(service.getEffectPresetNow().blurEnabled).toBe(true);
      expect(service.onerilenEffectMode()).toBe("full");
      await hidrasyonuBekle();
      // Kayit yoksa hidrasyon sonrasi da degismez.
      expect(service.getEffectMode()).toBe("full");
    }
  });

  test("low cihaz KAPALI efektle acilir (bugunku davranis korunur)", async () => {
    const { service } = loadService({ tier: "low" });
    expect(service.getEffectMode()).toBe("off");
    expect(service.getEffectPresetNow().blurEnabled).toBe(false);
    await hidrasyonuBekle();
    expect(service.getEffectMode()).toBe("off");
  });
});

describe("kayitli tercih", () => {
  test("gecerli kayit cihaz kararini ezer", async () => {
    const { service } = loadService({ stored: "balanced", tier: "high" });
    await hidrasyonuBekle();
    expect(service.getEffectMode()).toBe("balanced");
    // "Orta" gorseli korur: blur ACIK, sureklilik maliyetleri kisilir.
    const p = service.getEffectPresetNow();
    expect(p.blurEnabled).toBe(true);
    expect(p.spriteFpsScale).toBeLessThan(1);
  });

  test("low cihazda kullanici TAM secmisse blur geri gelir", async () => {
    const { service } = loadService({ stored: "full", tier: "low" });
    await hidrasyonuBekle();
    expect(service.getEffectMode()).toBe("full");
    expect(service.getEffectPresetNow().blurEnabled).toBe(true);
    // Oneri yine cihazin kararidir; secim onu gizlemez.
    expect(service.onerilenEffectMode()).toBe("off");
  });

  test("bozuk kayit yok sayilir", async () => {
    const { service } = loadService({ stored: "ultra", tier: "high" });
    await hidrasyonuBekle();
    expect(service.getEffectMode()).toBe("full");
  });

  test("depolama okunamazsa cihaz karariyla devam eder", async () => {
    jest.resetModules();
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: {
        getItem: jest.fn(() => Promise.reject(new Error("okunamadi"))),
        setItem: jest.fn(() => Promise.resolve()),
      },
    }));
    jest.doMock("../services/deviceTier", () => ({
      __esModule: true,
      deviceTier: "low",
      perfPreset: {},
    }));
    const service = require("../services/effectSettings");
    await hidrasyonuBekle();
    expect(service.getEffectMode()).toBe("off");
  });
});

describe("setEffectMode", () => {
  test("modu degistirir, kalicilastirir ve aboneleri uyarir", async () => {
    const { service, storage } = loadService({ tier: "high" });
    await hidrasyonuBekle();
    const uyari = jest.fn();
    const birak = service.subscribeEffects(uyari);

    service.setEffectMode("off");
    expect(service.getEffectMode()).toBe("off");
    expect(service.getEffectPresetNow().blurEnabled).toBe(false);
    expect(uyari).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith("effectMode", "off");

    birak();
    service.setEffectMode("balanced");
    expect(uyari).toHaveBeenCalledTimes(1); // abonelikten cikti
  });

  test("ayni mod tekrar secilirse yayin yapilmaz (bos render yok)", async () => {
    const { service } = loadService({ tier: "high" });
    await hidrasyonuBekle();
    const uyari = jest.fn();
    service.subscribeEffects(uyari);
    service.setEffectMode("full"); // zaten "full"
    expect(uyari).not.toHaveBeenCalled();
  });

  test("gecersiz mod yok sayilir", async () => {
    const { service, storage } = loadService({ tier: "high" });
    await hidrasyonuBekle();
    service.setEffectMode("turbo");
    expect(service.getEffectMode()).toBe("full");
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("preset REFERANSI yalniz mod degisince degisir (useSyncExternalStore sarti)", async () => {
    const { service } = loadService({ tier: "high" });
    await hidrasyonuBekle();
    const a = service.getEffectPresetNow();
    expect(service.getEffectPresetNow()).toBe(a); // her okumada yeni nesne YOK
    service.setEffectMode("off");
    expect(service.getEffectPresetNow()).not.toBe(a);
  });

  test("hidrasyondan ONCE yapilan secim, gec gelen kayitla EZILMEZ", async () => {
    const { service } = loadService({ stored: "off", tier: "high" });
    service.setEffectMode("balanced"); // kullanici hidrasyon bitmeden secti
    await hidrasyonuBekle();
    expect(service.getEffectMode()).toBe("balanced");
  });

  test("persist:false ile oturumluk degisiklik yazilmaz", async () => {
    const { service, storage } = loadService({ tier: "high" });
    await hidrasyonuBekle();
    service.setEffectMode("off", { persist: false });
    expect(service.getEffectMode()).toBe("off");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
