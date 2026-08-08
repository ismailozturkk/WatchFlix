// __tests__/apiCacheSwr.test.js
// "Bayat goster, arka planda tazele" okuma yolunun sozlesmesi.
//
// NEDEN VAR: getCachedValue TTL dolunca null donup kaydi SILIYOR; cagiran
// iskelet gosterip agi bekliyor. Trend TTL'i 1 saat oldugu icin bu pratikte HER
// acilis demekti. getSwr ayni kaydi silmeden, "taze mi?" bilgisiyle birlikte
// donuyor.

const load = () => {
  jest.resetModules();
  return require("../utils/apiCache");
};

afterEach(() => {
  jest.resetModules();
  jest.useRealTimers();
});

describe("getSwr", () => {
  test("kayit yokken bos sonuc doner", () => {
    const { getSwr } = load();
    expect(getSwr("yok_boyle_anahtar", { maxAge: 1000 })).toMatchObject({
      data: null,
      fresh: false,
    });
  });

  test("taze kayit fresh:true doner", () => {
    const api = load();
    api.setCachedValue("tv_trends_test", [{ id: 1 }], { force: true });
    const sonuc = api.getSwr("tv_trends_test", { maxAge: 60_000 });
    expect(sonuc.data).toEqual([{ id: 1 }]);
    expect(sonuc.fresh).toBe(true);
  });

  // ASIL DAVRANIS: getCachedValue burada null donup kaydi silerdi.
  test("BAYAT kayit yine de doner, fresh:false ile", () => {
    jest.useFakeTimers();
    const api = load();
    api.setCachedValue("tv_trends_bayat", [{ id: 7 }], { force: true });

    jest.advanceTimersByTime(2 * 60 * 60 * 1000); // 2 saat

    const sonuc = api.getSwr("tv_trends_bayat", { maxAge: 60 * 60 * 1000 });
    expect(sonuc.data).toEqual([{ id: 7 }]);
    expect(sonuc.fresh).toBe(false);
    expect(sonuc.age).toBeGreaterThan(60 * 60 * 1000);
  });

  test("bayat okuma kaydi SILMEZ (getCachedValue'nun aksine)", () => {
    jest.useFakeTimers();
    const api = load();
    api.setCachedValue("tv_trends_kalici", [{ id: 3 }], { force: true });
    jest.advanceTimersByTime(2 * 60 * 60 * 1000);

    api.getSwr("tv_trends_kalici", { maxAge: 1000 });
    // Ikinci okuma da veriyi bulmali.
    expect(api.getSwr("tv_trends_kalici", { maxAge: 1000 }).data).toEqual([{ id: 3 }]);
    expect(api.rawCachedEntry("tv_trends_kalici")).not.toBeNull();
  });

  // `getIsOnline` bayragini yalniz ConnectivityContext'in provider'i (React
  // efekti) guncelliyor; node ortaminda provider mount edilmedigi icin NetInfo
  // taklidini oynatmak yetmiyor, modulun kendisi taklit ediliyor.
  test("cevrimdisiyken bayat kayit TAZE sayilir (bosuna istek atilmasin)", () => {
    jest.useFakeTimers();
    jest.resetModules();
    jest.doMock("../context/ConnectivityContext", () => ({ getIsOnline: () => false }));
    const api = require("../utils/apiCache");

    api.setCachedValue("tv_trends_offline", [{ id: 5 }], { force: true });
    jest.advanceTimersByTime(5 * 60 * 60 * 1000);

    const sonuc = api.getSwr("tv_trends_offline", { maxAge: 1000 });
    expect(sonuc.age).toBeGreaterThan(1000); // gercekten bayat
    expect(sonuc.fresh).toBe(true); // ama tazelenmeye calisilmayacak

    jest.dontMock("../context/ConnectivityContext");
  });
});

describe("seedList", () => {
  // Ayni onbellek ailesine iki bicimde yaziliyor: loadPage {results,total_pages}
  // yazarken fetchSeriesTrends duz dizi yaziyor. Tohumlayan taraf bunu
  // bilmek zorunda kalmamali.
  test("duz dizi bicimini okur", () => {
    const api = load();
    api.setCachedValue("tv_seed_dizi", [{ id: 1 }, { id: 2 }], { force: true });
    const seed = api.seedList("tv_seed_dizi", { maxAge: 60_000 });
    expect(seed.list).toHaveLength(2);
    expect(seed.hasCache).toBe(true);
    expect(seed.totalPages).toBe(1);
  });

  test("{results,total_pages} bicimini okur", () => {
    const api = load();
    api.setCachedValue(
      "tv_seed_sayfali",
      { results: [{ id: 1 }], total_pages: 12 },
      { force: true },
    );
    const seed = api.seedList("tv_seed_sayfali", { maxAge: 60_000 });
    expect(seed.list).toEqual([{ id: 1 }]);
    expect(seed.totalPages).toBe(12);
  });

  test("kayit yokken bos liste ve hasCache:false", () => {
    const { seedList } = load();
    const seed = seedList("hic_yok", { maxAge: 1000 });
    expect(seed.list).toEqual([]);
    expect(seed.hasCache).toBe(false);
  });

  // Onemli: "veri var ama bayat" ile "veri yok" ayri seyler. Ilki iskeleti
  // atlatir, ikincisi atlatamaz.
  test("bayat kayit hasCache:true ama fresh:false", () => {
    jest.useFakeTimers();
    const api = load();
    api.setCachedValue("tv_seed_bayat", [{ id: 1 }], { force: true });
    jest.advanceTimersByTime(10 * 60 * 60 * 1000);

    const seed = api.seedList("tv_seed_bayat", { maxAge: 60 * 60 * 1000 });
    expect(seed.hasCache).toBe(true);
    expect(seed.fresh).toBe(false);
    expect(seed.list).toEqual([{ id: 1 }]);
  });
});
