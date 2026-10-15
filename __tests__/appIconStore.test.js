// Seçili uygulama simgesinin uygulama içi kaynağı (services/appIconStore.js).
//
// Uygulamadaki TÜM logolar (giriş, splash, hakkında, paylaşım kartları, widget
// önizlemesi) buradan beslenir. Bozulursa ya simge değişince bazı logolar eski
// kalır ya da açılışta yanlış logo çizilir.

const { withSeededStorage } = require("./helpers/storageTestKit");

const loadStore = ({ stored } = {}) => {
  jest.resetModules();
  const store = withSeededStorage(
    (Keys) => (stored === undefined ? [] : [[Keys.appIcon, stored]]),
    () => require("../services/appIconStore"),
  );
  return { store, storage: require("../services/storage") };
};

afterEach(() => jest.resetModules());

describe("açılış değeri (MMKV'den SENKRON)", () => {
  test("kayıt yoksa varsayılan simge", () => {
    const { store } = loadStore();
    expect(store.getAppIconId()).toBe("default");
  });

  test("geçerli kayıt ilk okumada geçerli (ilk karede doğru logo)", () => {
    const { store } = loadStore({ stored: "glass" });
    expect(store.getAppIconId()).toBe("glass");
  });

  test("katalogda olmayan kayıt varsayılana düşer", () => {
    const { store, storage } = loadStore();
    // validate: registry geçersiz değeri zaten yazdırmaz; yine de store doğrulamalı
    expect(storage.set(storage.Keys.appIcon, "eski_simge")).toBe(false);
    expect(store.getAppIconId()).toBe("default");
  });
});

describe("setAppIconId", () => {
  test("seçimi uygular, kalıcılaştırır ve aboneleri bilgilendirir", () => {
    const { store, storage } = loadStore();
    const abone = jest.fn();
    store.subscribeAppIconId(abone);

    expect(store.setAppIconId("glass")).toBe(true);

    expect(store.getAppIconId()).toBe("glass");
    expect(storage.get(storage.Keys.appIcon)).toBe("glass");
    expect(abone).toHaveBeenCalledTimes(1);
  });

  test("aynı değer tekrar verilirse yayın yapmaz", () => {
    const { store } = loadStore({ stored: "glass" });
    const abone = jest.fn();
    store.subscribeAppIconId(abone);

    expect(store.setAppIconId("glass")).toBe(true);
    expect(abone).not.toHaveBeenCalled();
  });

  test("bilinmeyen kimlik YOK SAYILIR: durum ve abone etkilenmez", () => {
    const { store, storage } = loadStore({ stored: "glass" });
    const abone = jest.fn();
    store.subscribeAppIconId(abone);

    expect(store.setAppIconId("yok")).toBe(false);
    expect(store.setAppIconId(null)).toBe(false);
    expect(store.setAppIconId(undefined)).toBe(false);

    expect(store.getAppIconId()).toBe("glass");
    expect(storage.get(storage.Keys.appIcon)).toBe("glass");
    expect(abone).not.toHaveBeenCalled();
  });

  test("abonelikten çıkan dinleyici artık çağrılmaz", () => {
    const { store } = loadStore();
    const abone = jest.fn();
    const cik = store.subscribeAppIconId(abone);
    cik();
    store.setAppIconId("glass");
    expect(abone).not.toHaveBeenCalled();
  });

  test("birden çok abone aynı yayını alır (tüm logolar birlikte değişir)", () => {
    const { store } = loadStore();
    const aboneler = [jest.fn(), jest.fn(), jest.fn()];
    aboneler.forEach((fn) => store.subscribeAppIconId(fn));
    store.setAppIconId("glass");
    aboneler.forEach((fn) => expect(fn).toHaveBeenCalledTimes(1));
  });
});

describe("depoya dışarıdan yazma (göç / geri yükleme)", () => {
  test("anahtar sonradan değişirse store yakalar ve yayınlar", () => {
    const { store, storage } = loadStore();
    const abone = jest.fn();
    store.subscribeAppIconId(abone);

    storage.set(storage.Keys.appIcon, "glass");

    expect(store.getAppIconId()).toBe("glass");
    expect(abone).toHaveBeenCalledTimes(1);
  });
});
