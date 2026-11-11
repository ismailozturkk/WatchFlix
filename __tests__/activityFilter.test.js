// Etkinliklerim arama + süzgeç + sıralama (utils/activityFilter.js) — saf kararlar.
import {
  ALL,
  applyActivityFilter,
  countActiveActivityFilters,
  emptyActivityFilter,
  matchesDateRange,
  matchesScoreBucket,
  normalizeSearch,
  presentValues,
  POST_TYPE_ORDER,
} from "../utils/activityFilter";

const NOW = Date.UTC(2026, 10, 11);
const DAY = 86400000;
const state = (patch) => ({ ...emptyActivityFilter(), ...patch });
const ids = (list) => list.map((item) => item.id);

const ratings = [
  { id: "a", mediaType: "movie", rating: 10, title: "Şahsiyet", updatedAt: NOW - 2 * DAY },
  { id: "b", mediaType: "tv", rating: 8.5, title: "Babil", updatedAt: NOW - 20 * DAY },
  { id: "c", mediaType: "movie", rating: 4, title: "Avatar", updatedAt: { seconds: (NOW - 400 * DAY) / 1000 } },
  { id: "d", mediaType: "tv", rating: 9, title: "İçerde", updatedAt: NOW - 100 * DAY },
];

describe("puanlamalar", () => {
  it("varsayılan: tarihe göre yeni → eski", () => {
    expect(ids(applyActivityFilter("ratings", ratings, state(), { now: NOW }))).toEqual(["a", "b", "d", "c"]);
  });
  it("tür + puan kademesi (8.5 → 8; '5-' = 5 ve altı)", () => {
    expect(ids(applyActivityFilter("ratings", ratings, state({ kind: "tv" }), { now: NOW }))).toEqual(["b", "d"]);
    expect(ids(applyActivityFilter("ratings", ratings, state({ score: "8" }), { now: NOW }))).toEqual(["b"]);
    expect(ids(applyActivityFilter("ratings", ratings, state({ score: "5-" }), { now: NOW }))).toEqual(["c"]);
  });
  it("tarih aralığı (Timestamp benzeri saniye alanı da okunur)", () => {
    expect(ids(applyActivityFilter("ratings", ratings, state({ date: "month" }), { now: NOW }))).toEqual(["a", "b"]);
    expect(ids(applyActivityFilter("ratings", ratings, state({ date: "older" }), { now: NOW }))).toEqual(["c"]);
  });
  it("puana ve ada göre sırala; yön çevrilir", () => {
    expect(ids(applyActivityFilter("ratings", ratings, state({ sort: { key: "score", dir: "desc" } }), { now: NOW }))).toEqual(["a", "d", "b", "c"]);
    expect(ids(applyActivityFilter("ratings", ratings, state({ sort: { key: "score", dir: "asc" } }), { now: NOW }))).toEqual(["c", "b", "d", "a"]);
    expect(ids(applyActivityFilter("ratings", ratings, state({ sort: { key: "name", dir: "asc" } }), { now: NOW }))).toEqual(["c", "b", "d", "a"]);
  });
  it("arama Türkçe harf ve aksan duyarsız", () => {
    expect(ids(applyActivityFilter("ratings", ratings, state({ query: "sahsi" }), { now: NOW }))).toEqual(["a"]);
    expect(ids(applyActivityFilter("ratings", ratings, state({ query: "IÇER" }), { now: NOW }))).toEqual(["d"]);
  });
  it("sekmede olmayan süzgeç yok sayılır (puanlamada post türü)", () => {
    expect(applyActivityFilter("ratings", ratings, state({ postType: "poll" }), { now: NOW })).toHaveLength(4);
  });
});

describe("postlar / etkileşimler", () => {
  const posts = [
    { id: "p1", type: "tierlist", title: "Nolan", likesCount: 2, commentsCount: 9, _createdAtMs: NOW - DAY, tierList: { title: "Christopher" } },
    { id: "p2", type: "tvgraph", title: "GoT grafiği", likesCount: 7, commentsCount: 1, _createdAtMs: NOW - 3 * DAY },
    { id: "p3", type: "review", title: "Dune", likesCount: 7, commentsCount: 0, _createdAtMs: NOW - 2 * DAY },
  ];
  it("post türü + beğeni/yorum sıralaması (eşitlikte yeni önce)", () => {
    expect(ids(applyActivityFilter("posts", posts, state({ postType: "tvgraph" }), { now: NOW }))).toEqual(["p2"]);
    expect(ids(applyActivityFilter("posts", posts, state({ sort: { key: "likes", dir: "desc" } }), { now: NOW }))).toEqual(["p3", "p2", "p1"]);
    expect(ids(applyActivityFilter("posts", posts, state({ sort: { key: "comments", dir: "desc" } }), { now: NOW }))).toEqual(["p1", "p2", "p3"]);
  });
  it("arama tier list tablosunun adında da", () => {
    expect(ids(applyActivityFilter("posts", posts, state({ query: "christ" }), { now: NOW }))).toEqual(["p1"]);
  });
  it("yalnız veride olan post türleri, sabit sırayla", () => {
    expect(presentValues("posts", posts, "postType", POST_TYPE_ORDER)).toEqual(["review", "tierlist", "tvgraph"]);
  });
  it("etkileşim: beğeni/kayıt + yazar araması", () => {
    const items = [
      { id: "x", _kind: "like", postType: "poll", postTitle: "Hangisi", postAuthorName: "zeynep", _ts: NOW - DAY },
      { id: "y", _kind: "bookmark", postType: "review", postTitle: "Dune", postAuthorName: "ali", _ts: NOW },
    ];
    expect(ids(applyActivityFilter("interactions", items, state({ action: "bookmark" }), { now: NOW }))).toEqual(["y"]);
    expect(ids(applyActivityFilter("interactions", items, state({ query: "zey" }), { now: NOW }))).toEqual(["x"]);
  });
});

describe("yardımcılar", () => {
  it("etkin süzgeç sayısı: sekmeye ait süzgeçler + değişmiş sıralama", () => {
    expect(countActiveActivityFilters("ratings", state())).toBe(0);
    expect(countActiveActivityFilters("ratings", state({ kind: "tv", score: "9", postType: "poll" }))).toBe(2);
    expect(countActiveActivityFilters("story", state({ sort: { key: "name", dir: "asc" } }))).toBe(1);
  });
  it("kademe ve tarih kenarları", () => {
    expect(matchesScoreBucket(10, "10")).toBe(true);
    expect(matchesScoreBucket(9.9, "10")).toBe(false);
    expect(matchesScoreBucket(5.9, "5-")).toBe(true);
    expect(matchesScoreBucket(1, ALL)).toBe(true);
    expect(matchesDateRange(0, "week", NOW)).toBe(false);
    expect(matchesDateRange(NOW - 7 * DAY, "week", NOW)).toBe(true);
  });
  it("normalizeSearch", () => {
    expect(normalizeSearch("  ŞIĞÜÖÇ İ ")).toBe("siguoc i");
  });
});
