// CineSwipe solo durum makinesi: eski sonuçlar atılır, kartlar tekrarlanmaz,
// geri alma sepeti/görülenleri geri yükler, final turu sayfalamaz.

const {
  createSoloState,
  soloReducer,
  soloView,
  SOLO_PREFETCH_THRESHOLD,
} = require("../services/cineswipe/soloReducer");
const { cineMediaKey } = require("../services/cineswipe/deckModel");

const card = (id, mediaType = "movie") => ({ id, mediaType, title: `Film ${id}`, poster_path: `/${id}.jpg` });
const cards = (...ids) => ids.map((id) => card(id));
const run = (state, ...actions) => actions.reduce(soloReducer, state);

const loaded = (items = cards(1, 2, 3, 4, 5, 6, 7, 8), extra = {}) =>
  run(
    createSoloState(),
    { type: "LOAD_START", requestId: 1 },
    { type: "LOAD_OK", requestId: 1, items, page: 1, hasMore: true, ...extra },
  );

describe("yükleme", () => {
  test("başlangıç: yükleniyor, boş", () => {
    const state = createSoloState();
    expect(state.status).toBe("loading");
    expect(state.deck).toEqual([]);
    expect(state.round).toBe(1);
  });

  test("LOAD_START desteyi sıfırlar ama sepeti ve görülenleri korur", () => {
    let state = loaded();
    state = run(state, { type: "SWIPE", direction: "like" });
    expect(state.basket).toHaveLength(1);
    state = run(state, { type: "LOAD_START", requestId: 2 });
    expect(state).toMatchObject({ status: "loading", deck: [], index: 0, history: [], round: 1 });
    expect(state.basket).toHaveLength(1);
    expect(state.seen).toHaveProperty("movie_1");
  });

  test("clearSeen görülenleri siler (kullanıcı bilerek baştan başlıyor)", () => {
    let state = run(loaded(), { type: "SWIPE", direction: "pass" });
    state = run(state, { type: "LOAD_START", requestId: 2, clearSeen: true });
    expect(state.seen).toEqual({});
  });

  test("eskimiş LOAD_OK / LOAD_FAIL yok sayılır", () => {
    const state = run(createSoloState(), { type: "LOAD_START", requestId: 2 });
    expect(soloReducer(state, { type: "LOAD_OK", requestId: 1, items: cards(9), hasMore: true })).toBe(state);
    expect(soloReducer(state, { type: "LOAD_FAIL", requestId: 1 })).toBe(state);
  });

  test("ağ hatası boş destenin sonuç yok sayılmasına yol açmaz", () => {
    const failed = run(createSoloState(), { type: "LOAD_START", requestId: 1 }, { type: "LOAD_FAIL", requestId: 1 });
    expect(failed.status).toBe("error");
    expect(soloView(failed).noResults).toBe(false);
  });

  test("yeni desteden daha önce görülenler elenir", () => {
    let state = loaded(cards(1, 2));
    state = run(state, { type: "SWIPE", direction: "pass" }, { type: "LOAD_START", requestId: 2 });
    state = run(state, { type: "LOAD_OK", requestId: 2, items: cards(1, 2, 3), page: 1, hasMore: false });
    expect(state.deck.map(cineMediaKey)).toEqual(["movie_2", "movie_3"]);
  });
});

describe("sonraki sayfa", () => {
  test("MORE_OK yalnız yenileri ekler (tekrar ve görülenler elenir)", () => {
    let state = loaded(cards(1, 2, 3));
    state = run(state, { type: "SWIPE", direction: "like" }); // 1 görüldü
    state = run(
      state,
      { type: "MORE_START", requestId: 1 },
      { type: "MORE_OK", requestId: 1, items: cards(1, 3, 4, 5, 5), page: 2, hasMore: true },
    );
    expect(state.deck.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);
    expect(state).toMatchObject({ page: 2, hasMore: true, fetchingMore: false });
  });

  test("eskimiş sayfa yeni filtrenin destesine eklenmez", () => {
    let state = loaded(cards(1, 2, 3));
    state = run(state, { type: "MORE_START", requestId: 1 }, { type: "LOAD_START", requestId: 2 });
    state = run(state, { type: "LOAD_OK", requestId: 2, items: cards(10, 11), page: 1, hasMore: true });
    const after = soloReducer(state, { type: "MORE_OK", requestId: 1, items: cards(99), page: 2, hasMore: true });
    expect(after).toBe(state);
    expect(after.deck.map((m) => m.id)).toEqual([10, 11]);
  });

  test("çift MORE_START ikinci bir istek başlatmaz", () => {
    const state = run(loaded(), { type: "MORE_START", requestId: 1 });
    expect(soloReducer(state, { type: "MORE_START", requestId: 1 })).toBe(state);
  });

  test("MORE_FAIL deste sonunda hata durumu verir, RETRY_MORE yeniden dener", () => {
    let state = loaded(cards(1));
    state = run(state, { type: "SWIPE", direction: "pass" });
    state = run(state, { type: "MORE_START", requestId: 1 }, { type: "MORE_FAIL", requestId: 1 });
    expect(soloView(state)).toMatchObject({ moreError: true, finished: false, needsMore: false });
    state = run(state, { type: "RETRY_MORE" });
    expect(soloView(state)).toMatchObject({ moreError: false, needsMore: true });
  });

  test("deste sonunda sayfa gelirken 'tamamlandı' ekranı çıkmaz", () => {
    let state = loaded(cards(1));
    state = run(state, { type: "SWIPE", direction: "pass" });
    expect(soloView(state)).toMatchObject({ exhausted: true, waitingMore: true, finished: false });
    state = run(state, { type: "MORE_START", requestId: 1 });
    expect(soloView(state)).toMatchObject({ waitingMore: true, finished: false });
  });

  test("sayfa bitince (hasMore=false) deste tamamlanmış sayılır", () => {
    let state = loaded(cards(1), { hasMore: false });
    state = run(state, { type: "SWIPE", direction: "like" });
    expect(soloView(state)).toMatchObject({ finished: true, waitingMore: false, noResults: false });
  });

  test("sonuç yok: boş deste ve sayfa yok", () => {
    const state = loaded([], { hasMore: false });
    expect(soloView(state)).toMatchObject({ finished: true, noResults: true });
  });

  test("needsMore: eşik altında tetiklenir, yükleme sürerken tetiklenmez", () => {
    const items = Array.from({ length: SOLO_PREFETCH_THRESHOLD + 3 }, (_, i) => card(i + 1));
    let state = loaded(items);
    expect(soloView(state).needsMore).toBe(false);
    state = run(state, { type: "SWIPE", direction: "pass" }, { type: "SWIPE", direction: "pass" }, { type: "SWIPE", direction: "pass" });
    expect(soloView(state).needsMore).toBe(true);
    state = run(state, { type: "MORE_START", requestId: 1 });
    expect(soloView(state).needsMore).toBe(false);
  });
});

describe("kaydırma ve geri alma", () => {
  test("sağa kaydırma sepete ekler; sola kaydırma eklemez", () => {
    let state = loaded();
    state = run(state, { type: "SWIPE", direction: "like" }, { type: "SWIPE", direction: "pass" });
    expect(state.index).toBe(2);
    expect(state.basket.map((m) => m.id)).toEqual([1]);
    expect(state.history.map((h) => h.direction)).toEqual(["like", "pass"]);
  });

  test("aynı numaralı film ve dizi sepette ayrı tutulur", () => {
    let state = loaded([card(7, "movie"), card(7, "tv")]);
    state = run(state, { type: "SWIPE", direction: "like" }, { type: "SWIPE", direction: "like" });
    expect(state.basket.map(cineMediaKey)).toEqual(["movie_7", "tv_7"]);
  });

  test("deste bitince kaydırma durumu bozmaz", () => {
    let state = loaded(cards(1), { hasMore: false });
    state = run(state, { type: "SWIPE", direction: "like" });
    expect(soloReducer(state, { type: "SWIPE", direction: "like" })).toBe(state);
  });

  test("yükleme sırasında kaydırma yok sayılır", () => {
    const state = run(createSoloState(), { type: "LOAD_START", requestId: 1 });
    expect(soloReducer(state, { type: "SWIPE", direction: "like" })).toBe(state);
  });

  test("geri alma beğeniyi sepetten çıkarır ve görülenden siler", () => {
    let state = loaded();
    state = run(state, { type: "SWIPE", direction: "like" });
    state = run(state, { type: "UNDO" });
    expect(state).toMatchObject({ index: 0, history: [], basket: [] });
    expect(state.seen).toEqual({});
    expect(soloView(state).canUndo).toBe(false);
  });

  test("geri alma, daha önce başka destede görülmüş kartı 'görülmemiş' yapmaz", () => {
    let state = run(loaded(cards(1, 2)), { type: "SWIPE", direction: "pass" }); // 1 görüldü
    // Final turu: 1 yine destede, ama zaten görülmüş sayılıyor.
    state = run(state, { type: "START_FINAL", requestId: 2, items: cards(1, 2) });
    state = run(state, { type: "SWIPE", direction: "pass" }, { type: "UNDO" });
    expect(state.seen).toHaveProperty("movie_1");
  });

  test("geri alma sadece son hamleyi geri alır; boş geçmişte etkisizdir", () => {
    let state = loaded();
    expect(soloReducer(state, { type: "UNDO" })).toBe(state);
    state = run(state, { type: "SWIPE", direction: "like" }, { type: "SWIPE", direction: "like" }, { type: "UNDO" });
    expect(state.index).toBe(1);
    expect(state.basket.map((m) => m.id)).toEqual([1]);
  });
});

describe("final turu", () => {
  test("START_FINAL desteyi sepetle değiştirir; sepeti sıfırlar, sayfalamayı kapatır", () => {
    let state = loaded(cards(1, 2, 3, 4, 5, 6, 7, 8));
    state = run(state, { type: "SWIPE", direction: "like" }, { type: "SWIPE", direction: "like" });
    const picks = state.basket;
    state = run(state, { type: "START_FINAL", requestId: 2, items: picks });
    expect(state).toMatchObject({ round: 2, index: 0, history: [], basket: [], hasMore: false, requestId: 2 });
    expect(state.deck.map((m) => m.id)).toEqual([1, 2]);
    // Deste küçük olsa bile orijinal kategoriden kart eklenmez.
    expect(soloView(state).needsMore).toBe(false);
  });

  test("START_FINAL uçuştaki eski sayfa isteğini geçersiz kılar", () => {
    let state = run(loaded(cards(1, 2, 3)), { type: "MORE_START", requestId: 1 });
    state = run(state, { type: "START_FINAL", requestId: 2, items: cards(1, 2) });
    expect(soloReducer(state, { type: "MORE_OK", requestId: 1, items: cards(50), page: 2, hasMore: true })).toBe(state);
  });

  test("final turunda tek kart kalırsa kazanan belli olur", () => {
    let state = run(loaded(cards(1, 2, 3)), { type: "START_FINAL", requestId: 2, items: cards(1, 2) });
    state = run(state, { type: "SWIPE", direction: "like" }, { type: "SWIPE", direction: "pass" });
    expect(soloView(state)).toMatchObject({ finished: true, finalOver: true });
    expect(soloView(state).winner).toMatchObject({ id: 1 });
  });

  test("final turunda hiç beğeni yoksa ya da birden çok varsa kazanan yok", () => {
    let none = run(loaded(cards(1, 2)), { type: "START_FINAL", requestId: 2, items: cards(1, 2) });
    none = run(none, { type: "SWIPE", direction: "pass" }, { type: "SWIPE", direction: "pass" });
    expect(soloView(none).winner).toBeNull();
    expect(soloView(none).finalOver).toBe(true);

    let many = run(loaded(cards(1, 2)), { type: "START_FINAL", requestId: 2, items: cards(1, 2) });
    many = run(many, { type: "SWIPE", direction: "like" }, { type: "SWIPE", direction: "like" });
    expect(soloView(many).winner).toBeNull();
    expect(many.basket).toHaveLength(2);
  });

  test("ilk turda tek beğeni 'kazanan' sayılmaz", () => {
    let state = loaded(cards(1), { hasMore: false });
    state = run(state, { type: "SWIPE", direction: "like" });
    expect(soloView(state).winner).toBeNull();
  });
});

describe("sepet", () => {
  test("öğe kaldırma ve temizleme", () => {
    let state = loaded();
    state = run(state, { type: "SWIPE", direction: "like" }, { type: "SWIPE", direction: "like" });
    state = run(state, { type: "REMOVE_FROM_BASKET", key: "movie_1" });
    expect(state.basket.map((m) => m.id)).toEqual([2]);
    state = run(state, { type: "CLEAR_BASKET" });
    expect(state.basket).toEqual([]);
  });

  test("sepetten kaldırılan kart görülmüş kalır (aynı oturumda tekrar gelmez)", () => {
    let state = run(loaded(), { type: "SWIPE", direction: "like" }, { type: "REMOVE_FROM_BASKET", key: "movie_1" });
    expect(state.seen).toHaveProperty("movie_1");
  });
});

describe("türetilmiş durum", () => {
  test("current ve upcoming", () => {
    const state = loaded(cards(1, 2, 3, 4, 5, 6, 7, 8, 9));
    const view = soloView(state);
    expect(view.current.id).toBe(1);
    expect(view.upcoming.map((m) => m.id)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(view.remaining).toBe(9);
  });

  test("yüklenirken current yok", () => {
    expect(soloView(createSoloState()).current).toBeNull();
  });

  test("bilinmeyen eylem durumu değiştirmez", () => {
    const state = loaded();
    expect(soloReducer(state, { type: "YOK" })).toBe(state);
  });
});
