// __tests__/top100.test.js — Seelogd Top 100 sıralama çekirdeği (utils/top100.js): hibrit oy sayısı + hype.

const {
  TOP100_SIZE,
  TOP100_PICK_COUNTS,
  SEELOGD_VOTE_WEIGHT,
  applyHype,
  asCounter,
  groupDigits,
  hybridVotes,
  mediaKeyOf,
  normalizeMyHype,
  parseMediaKey,
  pickableCounts,
  rankTop100,
  showsTotalVotes,
  toPoolItem,
  top100MediaList,
} = require("../utils/top100");

const item = (key, tmdbCount, extra = {}) => {
  const { type, id } = parseMediaKey(key);
  return { key, id, media_type: type, title: key, poster_path: "/p.jpg", year: "2000", tmdbAvg: 7, tmdbCount, ...extra };
};

describe("anahtarlar ve biçim", () => {
  test("mediaKeyOf / parseMediaKey yalnız film ve dizi kabul eder", () => {
    expect(mediaKeyOf("movie", 550)).toBe("movie_550");
    expect(mediaKeyOf("tv", "1396")).toBe("tv_1396");
    expect(mediaKeyOf("person", 1)).toBeNull();
    expect(mediaKeyOf("movie", 0)).toBeNull();
    expect(parseMediaKey("tv_1396")).toEqual({ type: "tv", id: 1396 });
    expect(parseMediaKey("movie_0")).toBeNull();
    expect(parseMediaKey("movie_12x")).toBeNull();
  });

  test("groupDigits dilin ayracıyla basamak gruplar", () => {
    expect(groupDigits(34215)).toBe("34.215");
    expect(groupDigits(1234567, ",")).toBe("1,234,567");
    expect(groupDigits(999)).toBe("999");
    expect(groupDigits(-5)).toBe("0");
  });

  test("toplam Seelogd oyu 100'ün altında gösterilmez", () => {
    expect(showsTotalVotes(99)).toBe(false);
    expect(showsTotalVotes(100)).toBe(true);
  });
});

describe("hibrit oy", () => {
  test("TMDB değerlendirme sayısı + Seelogd oyu × ağırlık", () => {
    expect(SEELOGD_VOTE_WEIGHT).toBe(100);
    expect(hybridVotes({ tmdbCount: 30000 })).toBe(30000);
    expect(hybridVotes({ tmdbCount: 30000, count: 5 })).toBe(30500);
    expect(hybridVotes({ tmdbCount: "x", count: -3 })).toBe(0);
  });
});

describe("havuz öğesi", () => {
  test("film/dizi, afişli ve başlıklı kayıtlar alınır; kişi ve afişsiz düşer", () => {
    expect(
      toPoolItem({ id: 550, title: "Fight Club", poster_path: "/a.jpg", release_date: "1999-10-15", vote_average: 8.4, vote_count: 30000 }, "movie"),
    ).toMatchObject({ key: "movie_550", media_type: "movie", year: "1999", tmdbCount: 30000 });
    expect(toPoolItem({ id: 1396, media_type: "tv", name: "Breaking Bad", poster_path: "/b.jpg", first_air_date: "2008-01-20" }))
      .toMatchObject({ key: "tv_1396", title: "Breaking Bad", year: "2008", tmdbCount: 0 });
    expect(toPoolItem({ id: 5, media_type: "person", name: "X", poster_path: "/c.jpg" })).toBeNull();
    expect(toPoolItem({ id: 5, title: "No poster" }, "movie")).toBeNull();
  });

  test("sayaç bozuk alanlarda sıfır", () => {
    expect(asCounter(null)).toEqual({ count: 0 });
    expect(asCounter({ count: -2 })).toEqual({ count: 0 });
    expect(asCounter({ count: 7.9 })).toEqual({ count: 7 });
  });
});

describe("sıralama", () => {
  test("en çok oy alan en üstte; film ve dizi KARIŞIK; puan ortalaması sırayı belirlemez", () => {
    const ranked = rankTop100([
      item("movie_1", 10000, { tmdbAvg: 9.5 }),
      item("tv_2", 25000, { tmdbAvg: 6.1 }),
      item("movie_3", 18000, { tmdbAvg: 8.0 }),
    ]);
    expect(ranked.map((r) => r.key)).toEqual(["tv_2", "movie_3", "movie_1"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(ranked[0].votes).toBe(25000);
  });

  test("Seelogd oyları ağırlıkla eklenir ve sırayı değiştirir", () => {
    const pool = [item("movie_1", 20000), item("movie_2", 20500)];
    expect(rankTop100(pool)[0].key).toBe("movie_2");
    const flipped = rankTop100(pool, { movie_1: { count: 6 } }); // 20000 + 600 > 20500
    expect(flipped[0]).toMatchObject({ key: "movie_1", count: 6, votes: 20600 });
  });

  test("eşitlikte Seelogd oyu, sonra TMDB ortalaması belirler", () => {
    const tie = rankTop100([item("movie_1", 1000, { tmdbAvg: 9 }), item("movie_2", 900, { tmdbAvg: 5 })], { movie_2: { count: 1 } });
    expect(tie.map((r) => r.key)).toEqual(["movie_2", "movie_1"]);
    const avg = rankTop100([item("movie_1", 1000, { tmdbAvg: 6 }), item("movie_2", 1000, { tmdbAvg: 8 })]);
    expect(avg[0].key).toBe("movie_2");
  });

  test("tekrarlar elenir (ilk gelen kazanır), liste TOP100_SIZE ile sınırlanır", () => {
    const pool = Array.from({ length: 130 }, (_, i) => item(`movie_${i + 1}`, 50000 - i));
    expect(rankTop100(pool)).toHaveLength(TOP100_SIZE);
    const dup = rankTop100([item("movie_1", 5), item("movie_1", 99999)]);
    expect(dup).toHaveLength(1);
    expect(dup[0].tmdbCount).toBe(5);
  });
});

describe("oy (hype) aritmetiği — sunucu kuralıyla aynı", () => {
  test("oy +1, geri alma −1, aynı durum değişmez, sıfırın altına inmez", () => {
    expect(applyHype({ count: 4 }, false, true)).toEqual({ count: 5 });
    expect(applyHype({ count: 5 }, true, false)).toEqual({ count: 4 });
    expect(applyHype({ count: 5 }, true, true)).toEqual({ count: 5 });
    expect(applyHype({ count: 0 }, true, false)).toEqual({ count: 0 });
  });

  test("normalizeMyHype yalnız geçerli anahtar + true kabul eder (eski puan kaydı düşer)", () => {
    expect(normalizeMyHype({ movie_1: true, tv_2: 9, foo: true, tv_4: true })).toEqual({ movie_1: true, tv_4: true });
    expect(normalizeMyHype(null)).toEqual({});
    expect(normalizeMyHype([1])).toEqual({});
  });
});

describe("liste kaydı / sohbet", () => {
  test("seçilen uzunluklar 20·50·70·100; eksik listede uzun seçenekler pasif", () => {
    expect(TOP100_PICK_COUNTS).toEqual([20, 50, 70, 100]);
    expect(pickableCounts(60).map((o) => o.enabled)).toEqual([true, true, false, false]);
  });

  test("top100MediaList sıralı ilk N öğeyi paylaşım/kayıt şekline çevirir", () => {
    const ranked = rankTop100([item("tv_2", 9000, { tmdbAvg: 8.94 }), item("movie_1", 100)]);
    expect(top100MediaList(ranked, 1)).toEqual([
      { id: 2, media_type: "tv", title: "tv_2", poster_path: "/p.jpg", release_date: "2000-01-01", vote_average: 8.9 },
    ]);
  });

  test("chatShare.buildListShare ve listShare.sharedListToItems ile uyumlu", () => {
    const { buildListShare } = require("../utils/chatShare");
    const { sharedListToItems } = require("../utils/listShare");
    const ranked = rankTop100([item("tv_2", 9000), item("movie_1", 100)]);
    const mediaList = top100MediaList(ranked, 20);
    const share = buildListShare({ title: "Seelogd Top 20", items: mediaList });
    expect(share).toMatchObject({ type: "list", title: "Seelogd Top 20", total: 2 });
    expect(share.items.map((m) => `${m.media_type}_${m.id}`)).toEqual(["tv_2", "movie_1"]);
    expect(sharedListToItems(mediaList).map((i) => `${i.type}_${i.id}`)).toEqual(["tv_2", "movie_1"]);
  });
});
