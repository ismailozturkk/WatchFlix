const {
  beginOverlay,
  settleOverlay,
  failOverlay,
  clearOverlayFor,
  getOverlay,
  subscribeOverlay,
  EMPTY_OVERLAY,
  __resetOverlayForTests,
} = require("../services/libraryOverlay");

beforeEach(() => {
  __resetOverlayForTests();
  jest.useRealTimers();
});

describe("libraryOverlay", () => {
  test("başlangıçta boş ve KARARLI referans", () => {
    expect(getOverlay("u1")).toBe(EMPTY_OVERLAY);
    expect(getOverlay("u1")).toBe(getOverlay("u1"));
    expect(getOverlay(null)).toBe(EMPTY_OVERLAY);
  });

  test("begin niyeti yazar; değişmedikçe anlık görüntü referansı sabit", () => {
    beginOverlay("u1", "movie", 550, { inFavorites: true });
    const first = getOverlay("u1");
    expect(first.movie[550]).toEqual({ inFavorites: true });
    expect(getOverlay("u1")).toBe(first);
  });

  test("kullanıcılar birbirinden yalıtılır", () => {
    beginOverlay("u1", "movie", 550, { inFavorites: true });
    expect(getOverlay("u2")).toBe(EMPTY_OVERLAY);
  });

  test("film ve dizi aynı id'de ayrı kovalar", () => {
    beginOverlay("u1", "movie", 1399, { inWatchList: true });
    beginOverlay("u1", "tv", 1399, { isWatched: true });
    const overlay = getOverlay("u1");
    expect(overlay.movie[1399]).toEqual({ inWatchList: true });
    expect(overlay.tv[1399]).toEqual({ isWatched: true });
  });

  test("fail niyeti HEMEN kaldırır ve dinleyiciyi uyarır", () => {
    const listener = jest.fn();
    subscribeOverlay(listener);
    const token = beginOverlay("u1", "movie", 550, { inFavorites: true });
    expect(listener).toHaveBeenCalledTimes(1);
    failOverlay(token);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getOverlay("u1")).toBe(EMPTY_OVERLAY);
  });

  test("settle niyeti tutma süresi sonunda kaldırır (erken değil)", () => {
    jest.useFakeTimers();
    const token = beginOverlay("u1", "movie", 550, { inFavorites: true });
    settleOverlay(token, 1000);
    jest.advanceTimersByTime(999);
    expect(getOverlay("u1").movie[550]).toEqual({ inFavorites: true });
    jest.advanceTimersByTime(2);
    expect(getOverlay("u1")).toBe(EMPTY_OVERLAY);
  });

  test("settle(0 ms) anında kaldırır", () => {
    const token = beginOverlay("u1", "movie", 550, { inFavorites: true });
    settleOverlay(token, 0);
    expect(getOverlay("u1")).toBe(EMPTY_OVERLAY);
  });

  test("ekle→çıkar: öndeki işlemin geç bitmesi sondakinin niyetini SİLMEZ", () => {
    const add = beginOverlay("u1", "movie", 550, { inFavorites: true });
    const remove = beginOverlay("u1", "movie", 550, { inFavorites: false });
    // Öndeki (ekle) hata ile bitti — sondaki niyet (çıkar) yürürlükte kalmalı.
    failOverlay(add);
    expect(getOverlay("u1").movie[550]).toEqual({ inFavorites: false });
    failOverlay(remove);
    expect(getOverlay("u1")).toBe(EMPTY_OVERLAY);
  });

  test("farklı bayraklar birbirinden bağımsız jetonlara sahip", () => {
    const fav = beginOverlay("u1", "movie", 550, { inFavorites: true });
    beginOverlay("u1", "movie", 550, { inWatchList: true });
    failOverlay(fav);
    expect(getOverlay("u1").movie[550]).toEqual({ inWatchList: true });
  });

  test("aynı jetonu iki kez bırakmak zararsız", () => {
    const token = beginOverlay("u1", "movie", 550, { inFavorites: true });
    failOverlay(token);
    failOverlay(token);
    settleOverlay(token, 0);
    expect(getOverlay("u1")).toBe(EMPTY_OVERLAY);
  });

  test("boolean olmayan bayrak ve eksik girdi yok sayılır", () => {
    expect(beginOverlay("u1", "movie", 550, { inFavorites: "yes" })).toBe(0);
    expect(beginOverlay("", "movie", 550, { inFavorites: true })).toBe(0);
    expect(beginOverlay("u1", "movie", null, { inFavorites: true })).toBe(0);
    expect(getOverlay("u1")).toBe(EMPTY_OVERLAY);
  });

  test("clearOverlayFor yalnız o kullanıcıyı temizler", () => {
    beginOverlay("u1", "movie", 1, { inFavorites: true });
    beginOverlay("u2", "movie", 2, { inFavorites: true });
    clearOverlayFor("u1");
    expect(getOverlay("u1")).toBe(EMPTY_OVERLAY);
    expect(getOverlay("u2").movie[2]).toEqual({ inFavorites: true });
  });

  test("abonelikten çıkınca dinleyici artık çağrılmaz", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeOverlay(listener);
    unsubscribe();
    beginOverlay("u1", "movie", 550, { inFavorites: true });
    expect(listener).not.toHaveBeenCalled();
  });
});
