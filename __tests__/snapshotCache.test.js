// __tests__/snapshotCache.test.js
// "Son oturumda gordugun ekrani, bu oturumda beklemeden gor" katmani.
//
// Firestore'un JS SDK'sinda RN icin yerel kalicilik olmadigi icin proje cekilen
// veriyi kendisi diske yaziyor (utils/cacheStore.js). Bu katman o dosyalarin
// UZERINE oturuyor — ayri bir depo DEGIL; "Verileri indir" ayni anahtarlari
// dolduruyor ve o bag korunmali.

jest.useFakeTimers();

const load = () => {
  jest.resetModules();
  require("expo-file-system").__reset();
  return {
    snapshotCache: require("../services/snapshotCache"),
    cacheKeys: require("../utils/cacheKeys").cacheKeys,
    cacheStore: require("../utils/cacheStore"),
  };
};

afterEach(() => {
  jest.clearAllTimers();
  jest.resetModules();
});

describe("seed", () => {
  test("kayit yokken hasCache false", () => {
    const { snapshotCache, cacheKeys } = load();
    const okuma = snapshotCache.seed(cacheKeys.profile("u1"));
    expect(okuma.hasCache).toBe(false);
    expect(okuma.data).toBeNull();
    expect(okuma.age).toBe(Infinity);
  });

  test("yazilan veri SENKRON geri okunur (useState baslangic degeri icin)", () => {
    const { snapshotCache, cacheKeys } = load();
    snapshotCache.publish(cacheKeys.profile("u1"), { username: "ali" }, { immediate: true });

    const okuma = snapshotCache.seed(cacheKeys.profile("u1"));
    expect(okuma.hasCache).toBe(true);
    expect(okuma.data).toEqual({ username: "ali" });
  });

  // KRITIK BAG: "Verileri indir" (services/dataDownloader) dogrudan cacheStore'a
  // yaziyor. Bu katman ayri bir depoya gitseydi indirilen veri ekranlara hic
  // ulasmazdi.
  test("dogrudan cacheStore'a yazilan veriyi de okur (Verileri indir yolu)", () => {
    const { snapshotCache, cacheKeys, cacheStore } = load();
    cacheStore.setJSON(...cacheKeys.notes("u1"), [{ id: "n1" }]);

    const okuma = snapshotCache.seed(cacheKeys.notes("u1"));
    expect(okuma.hasCache).toBe(true);
    expect(okuma.data).toEqual([{ id: "n1" }]);
  });

  test("kullanicilar birbirinin verisini gormez", () => {
    const { snapshotCache, cacheKeys } = load();
    snapshotCache.publish(cacheKeys.profile("u1"), { username: "ali" }, { immediate: true });
    expect(snapshotCache.seed(cacheKeys.profile("u2")).hasCache).toBe(false);
  });

  test("ayni anahtar icin dosya bir kez okunur (bellek katmani)", () => {
    const { snapshotCache, cacheKeys, cacheStore } = load();
    cacheStore.setJSON(...cacheKeys.profile("u1"), { n: 1 });

    const ilk = snapshotCache.seed(cacheKeys.profile("u1"));
    // Diski disaridan degistir: ikinci okuma bellekten gelmeli.
    cacheStore.setJSON(...cacheKeys.profile("u1"), { n: 2 });
    expect(snapshotCache.seed(cacheKeys.profile("u1"))).toBe(ilk);
  });
});

describe("publish", () => {
  test("erteleme penceresi dolmadan diske inmez, dolunca iner", () => {
    const { snapshotCache, cacheKeys, cacheStore } = load();
    snapshotCache.publish(cacheKeys.notes("u1"), [{ id: "a" }]);
    expect(cacheStore.getJSON(...cacheKeys.notes("u1"))).toBeNull();

    jest.runAllTimers();
    expect(cacheStore.getJSON(...cacheKeys.notes("u1"))).toEqual([{ id: "a" }]);
  });

  test("art arda gelen guncellemelerde yalniz SON hal yazilir", () => {
    const { snapshotCache, cacheKeys, cacheStore } = load();
    const k = cacheKeys.lists("u1", "favorites");
    snapshotCache.publish(k, { a: 1 });
    snapshotCache.publish(k, { a: 2 });
    snapshotCache.publish(k, { a: 3 });
    jest.runAllTimers();
    expect(cacheStore.getJSON(...k)).toEqual({ a: 3 });
  });

  test("ayni veri tekrar gelirse diske YAZILMAZ", () => {
    const { snapshotCache, cacheKeys, cacheStore } = load();
    const k = cacheKeys.profile("u1");
    snapshotCache.publish(k, { n: 1 }, { immediate: true });

    // Diski disaridan boz: tekrar yazilsaydi duzelirdi.
    cacheStore.setJSON(...k, "DOKUNULDU");
    snapshotCache.publish(k, { n: 1 }, { immediate: true });
    expect(cacheStore.getJSON(...k)).toBe("DOKUNULDU");
  });

  test("yazim bellek katmanini da tazeler", () => {
    const { snapshotCache, cacheKeys } = load();
    const k = cacheKeys.profile("u1");
    snapshotCache.publish(k, { n: 1 }, { immediate: true });
    expect(snapshotCache.seed(k).data).toEqual({ n: 1 });

    snapshotCache.publish(k, { n: 2 }, { immediate: true });
    expect(snapshotCache.seed(k).data).toEqual({ n: 2 });
  });
});

describe("flushSnapshotWrites", () => {
  // REGRESYON KILIDI: uygulama arka plana gecerken erteleme penceresi
  // icindeysek surec dondurulur ve son guncelleme kaybolur; kullanici bir
  // sonraki acilista bir onceki hali gorurdu.
  test("bekleyen yazimlari hemen diske indirir", () => {
    const { snapshotCache, cacheKeys, cacheStore } = load();
    snapshotCache.publish(cacheKeys.stats("u1"), { izlenen: 5 });
    expect(cacheStore.getJSON(...cacheKeys.stats("u1"))).toBeNull();

    snapshotCache.flushSnapshotWrites();
    expect(cacheStore.getJSON(...cacheKeys.stats("u1"))).toEqual({ izlenen: 5 });
  });

  test("bekleyen yazim yokken sorunsuz calisir", () => {
    const { snapshotCache } = load();
    expect(() => snapshotCache.flushSnapshotWrites()).not.toThrow();
  });
});

describe("temizlik", () => {
  test("dropSnapshot kaydi, bellegi ve bekleyen yazimi siler", () => {
    const { snapshotCache, cacheKeys, cacheStore } = load();
    const k = cacheKeys.profile("u1");
    snapshotCache.publish(k, { n: 1 }, { immediate: true });
    snapshotCache.publish(k, { n: 2 }); // bekleyen

    snapshotCache.dropSnapshot(k);
    jest.runAllTimers(); // bekleyen iptal edilmis olmali

    expect(cacheStore.getJSON(...k)).toBeNull();
    expect(snapshotCache.seed(k).hasCache).toBe(false);
  });

  // REGRESYON KILIDI: cikista disk temizleniyor ama bu modulun "en son sunu
  // yazmistim" belligi surecte kaliyor. Sifirlanmazsa ayni oturumda geri giren
  // kullanicinin ILK snapshot'i "zaten yazilmis" sanilip diske hic inmez;
  // ayrica `memory` onceki kullanicinin verisini dondururdu.
  test("resetSnapshotCache'ten sonra ayni veri TEKRAR yazilir", () => {
    const { snapshotCache, cacheKeys, cacheStore } = load();
    const k = cacheKeys.profile("u1");
    snapshotCache.publish(k, { n: 1 }, { immediate: true });

    cacheStore.remove(...k); // cikis temizligi
    snapshotCache.resetSnapshotCache();

    snapshotCache.publish(k, { n: 1 }, { immediate: true });
    expect(cacheStore.getJSON(...k)).toEqual({ n: 1 });
    expect(snapshotCache.seed(k).data).toEqual({ n: 1 });
  });
});
