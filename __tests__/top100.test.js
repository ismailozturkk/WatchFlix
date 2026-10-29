// __tests__/top100.test.js — Seelogd Top 100 sıralama çekirdeği (utils/top100.js).

const {
  TOP100_SIZE,
  TOP100_PICK_COUNTS,
  MIN_TMDB_VOTES,
  PRIOR_MEAN,
  applyVote,
  asCounter,
  combinedScore,
  formatScore,
  mediaKeyOf,
  normalizeMyVotes,
  parseMediaKey,
  pickableCounts,
  rankTop100,
  tmdbWeight,
  toPoolItem,
  top100MediaList,
} = require("../utils/top100");

const item = (key, tmdbAvg, tmdbCount, extra = {}) => {
  const { type, id } = parseMediaKey(key);
  return { key, id, media_type: type, title: key, poster_path: "/p.jpg", year: "2000", tmdbAvg, tmdbCount, ...extra };
};

describe("anahtarlar", () => {
  test("mediaKeyOf / parseMediaKey yalnız film ve dizi kabul eder", () => {
    expect(mediaKeyOf("movie", 550)).toBe("movie_550");
    expect(mediaKeyOf("tv", "1396")).toBe("tv_1396");
    expect(mediaKeyOf("person", 1)).toBeNull();
    expect(mediaKeyOf("movie", 0)).toBeNull();
    expect(mediaKeyOf("movie", -3)).toBeNull();
    expect(parseMediaKey("tv_1396")).toEqual({ type: "tv", id: 1396 });
    expect(parseMediaKey("movie_0")).toBeNull();
    expect(parseMediaKey("movie_12x")).toBeNull();
  });
});

describe("puan modeli", () => {
  test("TMDB ağırlığı log ölçekli ve tavanlı", () => {
    expect(tmdbWeight(0)).toBe(0);
    expect(tmdbWeight(999)).toBeCloseTo(60, 0);
    expect(tmdbWeight(30000)).toBeLessThanOrEqual(100);
    expect(tmdbWeight(1e9)).toBe(100);
  });

  test("Seelogd oyu yokken birleşik ortalama TMDB ortalamasıdır", () => {
    const { avg } = combinedScore({ tmdbAvg: 8.4, tmdbCount: 20000 });
    expect(avg).toBeCloseTo(8.4, 6);
  });

  test("Seelogd oyları TMDB ortalamasına EKLENİR (yüksek oy yukarı, düşük oy aşağı çeker)", () => {
    const base = combinedScore({ tmdbAvg: 7.5, tmdbCount: 5000 });
    const up = combinedScore({ tmdbAvg: 7.5, tmdbCount: 5000, sum: 100, count: 10 });
    const down = combinedScore({ tmdbAvg: 7.5, tmdbCount: 5000, sum: 20, count: 10 });
    expect(up.avg).toBeGreaterThan(base.avg);
    expect(down.avg).toBeLessThan(base.avg);
    expect(up.score).toBeGreaterThan(base.score);
  });

  test("tek bir 10 oyu az oylu yapımı zirveye taşımaz (Bayes çekimi)", () => {
    const lone = combinedScore({ tmdbAvg: 0, tmdbCount: 0, sum: 10, count: 1 });
    expect(lone.avg).toBe(10);
    expect(lone.score).toBeLessThan(PRIOR_MEAN + 0.2);
  });

  test("formatScore tek ondalık; sıfır/boş tire", () => {
    expect(formatScore(8.456)).toBe("8.5");
    expect(formatScore(0)).toBe("–");
    expect(formatScore(undefined)).toBe("–");
  });
});

describe("havuz öğesi", () => {
  test("film/dizi, afişli ve başlıklı kayıtlar alınır; kişi ve afişsiz düşer", () => {
    expect(
      toPoolItem({ id: 550, title: "Fight Club", poster_path: "/a.jpg", release_date: "1999-10-15", vote_average: 8.4, vote_count: 30000 }, "movie"),
    ).toMatchObject({ key: "movie_550", media_type: "movie", year: "1999", tmdbAvg: 8.4, tmdbCount: 30000 });
    expect(toPoolItem({ id: 1396, media_type: "tv", name: "Breaking Bad", poster_path: "/b.jpg", first_air_date: "2008-01-20" }))
      .toMatchObject({ key: "tv_1396", title: "Breaking Bad", year: "2008" });
    expect(toPoolItem({ id: 5, media_type: "person", name: "X", poster_path: "/c.jpg" })).toBeNull();
    expect(toPoolItem({ id: 5, title: "No poster" }, "movie")).toBeNull();
  });

  test("sayaç bozuk alanlarda sıfır; sum puan tavanını aşamaz", () => {
    expect(asCounter(null)).toEqual({ sum: 0, count: 0 });
    expect(asCounter({ sum: "x", count: -2 })).toEqual({ sum: 0, count: 0 });
    expect(asCounter({ sum: 999, count: 2 })).toEqual({ sum: 20, count: 2 });
  });
});

describe("sıralama", () => {
  test("film ve diziler KARIŞIK, puana göre sıralanır ve sıra numarası alır", () => {
    const ranked = rankTop100([
      item("movie_1", 7.0, 10000),
      item("tv_2", 8.9, 10000),
      item("movie_3", 8.2, 10000),
    ]);
    expect(ranked.map((r) => r.key)).toEqual(["tv_2", "movie_3", "movie_1"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  test("Seelogd oyları sırayı değiştirir", () => {
    const pool = [item("movie_1", 8.0, 2000), item("movie_2", 8.1, 2000)];
    expect(rankTop100(pool)[0].key).toBe("movie_2");
    const flipped = rankTop100(pool, { movie_1: { sum: 400, count: 40 } });
    expect(flipped[0].key).toBe("movie_1");
    expect(flipped[0]).toMatchObject({ sum: 400, count: 40 });
  });

  test("tekrarlar elenir, liste TOP100_SIZE ile sınırlanır", () => {
    const pool = Array.from({ length: 130 }, (_, i) => item(`movie_${i + 1}`, 6 + (i % 30) / 10, 5000));
    pool.push(item("movie_1", 9.9, 5000));
    const ranked = rankTop100(pool);
    expect(ranked).toHaveLength(TOP100_SIZE);
    expect(new Set(ranked.map((r) => r.key)).size).toBe(TOP100_SIZE);
    // İlk gelen kazanır: sonradan eklenen 9.9'luk kopya yok sayılır.
    const dup = rankTop100([item("movie_1", 7, 5000), item("movie_1", 9.9, 5000)]);
    expect(dup).toHaveLength(1);
    expect(dup[0].tmdbAvg).toBe(7);
  });

  test("az oylu TMDB kaydı yalnız Seelogd oyu varsa yarışır", () => {
    const pool = [item("movie_9", 9.5, MIN_TMDB_VOTES - 1)];
    expect(rankTop100(pool)).toHaveLength(0);
    expect(rankTop100(pool, { movie_9: { sum: 9, count: 1 } })).toHaveLength(1);
  });
});

describe("oy aritmetiği (sunucu kuralıyla aynı)", () => {
  test("yeni oy count+1 sum+puan; değişim count sabit sum farkı", () => {
    expect(applyVote({ sum: 40, count: 5 }, null, 8)).toEqual({ sum: 48, count: 6 });
    expect(applyVote({ sum: 48, count: 6 }, 8, 3)).toEqual({ sum: 43, count: 6 });
    expect(applyVote({ sum: 0, count: 0 }, null, 10)).toEqual({ sum: 10, count: 1 });
    expect(applyVote({ sum: 10, count: 1 }, null, 11)).toEqual({ sum: 10, count: 1 });
  });

  test("normalizeMyVotes bozuk anahtar ve puanları düşürür", () => {
    expect(normalizeMyVotes({ movie_1: 9, tv_2: 0, foo: 5, movie_3: 7.5, tv_4: 10 })).toEqual({ movie_1: 9, tv_4: 10 });
    expect(normalizeMyVotes(null)).toEqual({});
    expect(normalizeMyVotes([1, 2])).toEqual({});
  });
});

describe("liste kaydı / sohbet", () => {
  test("seçilen uzunluklar 20·50·70·100; eksik listede uzun seçenekler pasif", () => {
    expect(TOP100_PICK_COUNTS).toEqual([20, 50, 70, 100]);
    expect(pickableCounts(60)).toEqual([
      { count: 20, enabled: true },
      { count: 50, enabled: true },
      { count: 70, enabled: false },
      { count: 100, enabled: false },
    ]);
  });

  test("top100MediaList sıralı ilk N öğeyi paylaşım/kayıt şekline çevirir", () => {
    const ranked = rankTop100([item("tv_2", 8.9, 10000), item("movie_1", 7.0, 10000)]);
    const list = top100MediaList(ranked, 1);
    expect(list).toEqual([
      { id: 2, media_type: "tv", title: "tv_2", poster_path: "/p.jpg", release_date: "2000-01-01", vote_average: 8.9 },
    ]);
  });

  test("chatShare.buildListShare ve listShare.sharedListToItems ile uyumlu", () => {
    const { buildListShare } = require("../utils/chatShare");
    const { sharedListToItems } = require("../utils/listShare");
    const ranked = rankTop100([item("tv_2", 8.9, 10000), item("movie_1", 7.0, 10000)]);
    const mediaList = top100MediaList(ranked, 20);
    const share = buildListShare({ title: "Seelogd Top 20", items: mediaList });
    expect(share).toMatchObject({ type: "list", title: "Seelogd Top 20", total: 2 });
    expect(share.items.map((m) => `${m.media_type}_${m.id}`)).toEqual(["tv_2", "movie_1"]);
    expect(sharedListToItems(mediaList).map((i) => `${i.type}_${i.id}`)).toEqual(["tv_2", "movie_1"]);
  });
});
