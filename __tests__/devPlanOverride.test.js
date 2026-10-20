// Plan simülatörü (services/devPlanOverride.js): geliştirme build'inde etkin
// planı Free/Premium/Max'e zorlar.
//
// EN ÖNEMLİ GÜVENCE: release'de HİÇBİR ŞEY yapmaz. Bozulursa App Store/Play'deki
// kullanıcı diskte kalan bir değerle (ya da yanlış bir çağrıyla) ücretsiz yere
// Max planı görür. Bu yüzden "release" bloğu bayrağı kapalı tutup DİSKE kayıtlı
// bir değer tohumlayarak da dener.

const fs = require("fs");
const path = require("path");
const { withSeededStorage } = require("./helpers/storageTestKit");

const ROOT = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

function load({ dev, stored } = {}) {
  jest.resetModules();
  global.__DEV__ = dev;
  const sim = withSeededStorage(
    (Keys) => (stored === undefined ? [] : [[Keys.devPlanOverride, stored]]),
    () => require("../services/devPlanOverride"),
  );
  return { sim, storage: require("../services/storage") };
}

afterEach(() => {
  // jest.config.js globals ile aynı varsayılan: release gibi davran.
  global.__DEV__ = false;
  jest.resetModules();
});

describe("release build (__DEV__ = false)", () => {
  test("simülatör kullanılamaz", () => {
    const { sim } = load({ dev: false });
    expect(sim.isDevPlanSimulatorAvailable()).toBe(false);
  });

  test("diskte kayıtlı seçim bile okunmaz (gerçek plan kalır)", () => {
    const { sim } = load({ dev: false, stored: "unlimited" });
    expect(sim.getDevPlanOverride()).toBe("real");
    expect(sim.applyDevPlanOverride("free")).toBe("free");
    expect(sim.applyDevPlanOverride("premium")).toBe("premium");
  });

  test("açıkça seçim verilse de gerçek plan aynen döner", () => {
    const { sim } = load({ dev: false });
    for (const choice of ["free", "premium", "unlimited"]) {
      expect(sim.applyDevPlanOverride("free", choice)).toBe("free");
      expect(sim.applyDevPlanOverride("unlimited", choice)).toBe("unlimited");
    }
  });

  test("seçim yazılamaz: reddedilir, diske dokunulmaz, abone uyanmaz", () => {
    const { sim, storage } = load({ dev: false });
    const abone = jest.fn();
    sim.subscribeDevPlanOverride(abone);

    expect(sim.setDevPlanOverride("unlimited")).toBe(false);

    expect(sim.getDevPlanOverride()).toBe("real");
    expect(storage.get(storage.Keys.devPlanOverride)).toBe("real");
    expect(abone).not.toHaveBeenCalled();
  });
});

describe("geliştirme build'i (__DEV__ = true)", () => {
  test("varsayılan 'gerçek': plan değişmez", () => {
    const { sim } = load({ dev: true });
    expect(sim.isDevPlanSimulatorAvailable()).toBe(true);
    expect(sim.getDevPlanOverride()).toBe("real");
    expect(sim.applyDevPlanOverride("free")).toBe("free");
    expect(sim.applyDevPlanOverride("unlimited")).toBe("unlimited");
  });

  test("seçim etkin planı zorlar (yükseltme de düşürme de)", () => {
    const { sim } = load({ dev: true });

    expect(sim.setDevPlanOverride("premium")).toBe(true);
    expect(sim.applyDevPlanOverride("free")).toBe("premium");

    expect(sim.setDevPlanOverride("unlimited")).toBe(true);
    expect(sim.applyDevPlanOverride("free")).toBe("unlimited");

    // Max aboneyi Free gibi görmek (kilitleri denemek) mümkün olmalı.
    expect(sim.setDevPlanOverride("free")).toBe(true);
    expect(sim.applyDevPlanOverride("unlimited")).toBe("free");

    expect(sim.setDevPlanOverride("real")).toBe(true);
    expect(sim.applyDevPlanOverride("unlimited")).toBe("unlimited");
  });

  test("geçersiz seçim reddedilir", () => {
    const { sim } = load({ dev: true });
    expect(sim.setDevPlanOverride("platinum")).toBe(false);
    expect(sim.setDevPlanOverride(undefined)).toBe(false);
    expect(sim.getDevPlanOverride()).toBe("real");
  });

  test("kalıcıdır ve aboneleri bilgilendirir", () => {
    const { sim, storage } = load({ dev: true });
    const abone = jest.fn();
    sim.subscribeDevPlanOverride(abone);

    sim.setDevPlanOverride("premium");

    expect(storage.get(storage.Keys.devPlanOverride)).toBe("premium");
    expect(abone).toHaveBeenCalledWith("premium");
  });

  test("aynı seçim tekrar verilirse yayın yapmaz", () => {
    const { sim } = load({ dev: true, stored: "premium" });
    const abone = jest.fn();
    sim.subscribeDevPlanOverride(abone);

    expect(sim.setDevPlanOverride("premium")).toBe(true);
    expect(abone).not.toHaveBeenCalled();
  });

  test("açılışta diskteki seçim geri yüklenir", () => {
    const { sim } = load({ dev: true, stored: "unlimited" });
    expect(sim.getDevPlanOverride()).toBe("unlimited");
    expect(sim.applyDevPlanOverride("free")).toBe("unlimited");
  });
});

// RN bileşenleri bu jest kurulumunda render edilemez (bkz. jest.config.js);
// bağlantının KAYNAKTA bozulmadığını burada kilitliyoruz.
describe("bağlantı noktaları", () => {
  test("PremiumContext etkin planı simülatörden geçirir, analytics'e GERÇEK planı yazar", () => {
    const source = read("context/PremiumContext.js");
    expect(source).toMatch(/applyDevPlanOverride\(realPlan,\s*devPlanChoice\)/);
    expect(source).toMatch(
      /setAnalyticsUserProperty\(USER_PROPERTIES\.PREMIUM_TIER,\s*realPlan\)/,
    );
  });

  test("Ayarlar kartı yalnız __DEV__ altında bağlı; kartın kendisi de kapılı", () => {
    const settings = read("screens/tabs/SettingsScreen.js");
    expect(settings).toMatch(/__DEV__\s*\?\s*<DevPlanSimulatorCard\s*\/>\s*:\s*null/);
    // Kartın başka bir yerden kapısız çağrılmadığından emin ol.
    expect(settings.match(/<DevPlanSimulatorCard/g)).toHaveLength(1);

    const card = read("components/settings/DevPlanSimulatorCard.js");
    expect(card).toMatch(/if \(!isDevPlanSimulatorAvailable\(\)\) return null/);
  });
});
