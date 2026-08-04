// __tests__/commentScope.test.js
// Dizi yorumlarının kapsam (dizi / sezon / bölüm) modeli — saf JS.

const {
  COMMENT_SCOPE,
  SCOPE_FILTER,
  ALL_SCOPE_FILTER,
  normalizeScope,
  scopeKey,
  parseScopeKey,
  scopeWriteFields,
  isSameScope,
  makeScopeFilter,
  filterForScope,
  scopeForFilter,
  isAllFilter,
  filterAllowsShowLevelSources,
  scopeMatchesFilter,
  summarizeScopes,
  seasonBucket,
  countForFilter,
  shortScopeLabel,
  longScopeLabel,
  filterLabel,
} = require("../utils/commentScope");

const showComment = { id: "a" }; // legacy: hiç scope alanı yok
const seasonComment = { id: "b", scope: "season", seasonNumber: 2 };
const episodeComment = {
  id: "c",
  scope: "episode",
  seasonNumber: 2,
  episodeNumber: 5,
  scopeTitle: "Ozymandias",
};

describe("normalizeScope", () => {
  it("alan taşımayan eski yorumu dizi geneli sayar", () => {
    expect(normalizeScope(showComment)).toEqual({
      scope: COMMENT_SCOPE.SHOW,
      seasonNumber: null,
      episodeNumber: null,
      title: null,
    });
  });

  it("scope alanı yoksa sayılardan türetir", () => {
    expect(normalizeScope({ seasonNumber: 3 }).scope).toBe(COMMENT_SCOPE.SEASON);
    expect(normalizeScope({ seasonNumber: 3, episodeNumber: 1 }).scope).toBe(
      COMMENT_SCOPE.EPISODE,
    );
  });

  it("TMDB alan adlarını (season_number/episode_number) da okur", () => {
    expect(normalizeScope({ season_number: 4, episode_number: 2 })).toMatchObject({
      scope: COMMENT_SCOPE.EPISODE,
      seasonNumber: 4,
      episodeNumber: 2,
    });
  });

  it("eksik numaralı bozuk kapsamı bir üst seviyeye düşürür", () => {
    expect(normalizeScope({ scope: "episode", seasonNumber: 2 }).scope).toBe(
      COMMENT_SCOPE.SEASON,
    );
    expect(normalizeScope({ scope: "episode" }).scope).toBe(COMMENT_SCOPE.SHOW);
    expect(normalizeScope({ scope: "season" }).scope).toBe(COMMENT_SCOPE.SHOW);
  });

  it("tanınmayan scope değerini sayılara bakarak düzeltir", () => {
    expect(normalizeScope({ scope: "chapter", seasonNumber: 1 }).scope).toBe(
      COMMENT_SCOPE.SEASON,
    );
  });

  it("dizi genelinde sezon/bölüm numarasını temizler", () => {
    const s = normalizeScope({ scope: "show", seasonNumber: 9, episodeNumber: 9 });
    expect(s.seasonNumber).toBeNull();
    expect(s.episodeNumber).toBeNull();
  });

  it("sezon kapsamında bölüm numarasını düşürür", () => {
    expect(
      normalizeScope({ scope: "season", seasonNumber: 2, episodeNumber: 7 })
        .episodeNumber,
    ).toBeNull();
  });

  it("sayısal olmayan numaraları yok sayar", () => {
    expect(normalizeScope({ scope: "season", seasonNumber: "abc" }).scope).toBe(
      COMMENT_SCOPE.SHOW,
    );
    expect(normalizeScope({ scope: "season", seasonNumber: "2" })).toMatchObject({
      scope: COMMENT_SCOPE.SEASON,
      seasonNumber: 2,
    });
  });

  it("boş başlığı null'a indirger", () => {
    expect(normalizeScope({ scope: "show", scopeTitle: "   " }).title).toBeNull();
    expect(normalizeScope({ scope: "show", scopeTitle: " Pilot " }).title).toBe(
      "Pilot",
    );
  });

  // Üretimde bir kapsam ekrandan Firestore'a giderken defalarca normalize
  // edilir (ScopedCommentButton → Comment → scopeWriteFields). İdempotent
  // olmazsa scopeTitle yolda düşer ve hiçbir yoruma bölüm adı yazılmaz.
  it("normalize İDEMPOTENT'tir — ikinci geçişte başlık düşmez", () => {
    const once = normalizeScope(episodeComment);
    const twice = normalizeScope(once);
    expect(twice).toEqual(once);
    expect(twice.title).toBe("Ozymandias");
    expect(normalizeScope(normalizeScope(twice)).title).toBe("Ozymandias");
  });

  it("kendi çıktısını (title alanı) da başlık olarak okur", () => {
    expect(normalizeScope({ scope: "season", seasonNumber: 1, title: "Pilot" }).title).toBe(
      "Pilot",
    );
    // scopeTitle öncelikli: Firestore alanı taze olan.
    expect(
      normalizeScope({
        scope: "season",
        seasonNumber: 1,
        scopeTitle: "Yeni",
        title: "Eski",
      }).title,
    ).toBe("Yeni");
  });

  it("null/undefined girdide çökmez", () => {
    expect(normalizeScope(null).scope).toBe(COMMENT_SCOPE.SHOW);
    expect(normalizeScope(undefined).scope).toBe(COMMENT_SCOPE.SHOW);
  });

  it("sezon 0 (özel bölümler) geçerli bir kapsamdır", () => {
    expect(normalizeScope({ scope: "season", seasonNumber: 0 })).toMatchObject({
      scope: COMMENT_SCOPE.SEASON,
      seasonNumber: 0,
    });
  });
});

describe("scopeKey / parseScopeKey", () => {
  it("üç kapsam için kararlı anahtar üretir", () => {
    expect(scopeKey(showComment)).toBe("show");
    expect(scopeKey(seasonComment)).toBe("s2");
    expect(scopeKey(episodeComment)).toBe("s2e5");
  });

  it("anahtarı geri çözer", () => {
    expect(parseScopeKey("s2e5")).toMatchObject({
      scope: COMMENT_SCOPE.EPISODE,
      seasonNumber: 2,
      episodeNumber: 5,
    });
    expect(parseScopeKey("s7")).toMatchObject({
      scope: COMMENT_SCOPE.SEASON,
      seasonNumber: 7,
    });
    expect(parseScopeKey("show").scope).toBe(COMMENT_SCOPE.SHOW);
  });

  it("bozuk anahtarları dizi geneline düşürür", () => {
    expect(parseScopeKey("sXeY").scope).toBe(COMMENT_SCOPE.SHOW);
    expect(parseScopeKey(null).scope).toBe(COMMENT_SCOPE.SHOW);
    expect(parseScopeKey(42).scope).toBe(COMMENT_SCOPE.SHOW);
  });

  it("anahtar → kapsam → anahtar gidiş-dönüşü korur", () => {
    ["show", "s0", "s2", "s2e5", "s12e134"].forEach((key) => {
      expect(scopeKey(parseScopeKey(key))).toBe(key);
    });
  });
});

describe("scopeWriteFields", () => {
  it("Firestore'a yazılacak alanları eksiksiz döndürür", () => {
    expect(scopeWriteFields(episodeComment)).toEqual({
      scope: COMMENT_SCOPE.EPISODE,
      seasonNumber: 2,
      episodeNumber: 5,
      scopeKey: "s2e5",
      scopeTitle: "Ozymandias",
    });
  });

  it("normalize edilmiş kapsamdan da başlığı korur (idempotent yazım)", () => {
    expect(scopeWriteFields(normalizeScope(episodeComment))).toEqual({
      scope: COMMENT_SCOPE.EPISODE,
      seasonNumber: 2,
      episodeNumber: 5,
      scopeKey: "s2e5",
      scopeTitle: "Ozymandias",
    });
  });

  it("dizi genelinde numaraları null yazar (undefined değil)", () => {
    const fields = scopeWriteFields(null);
    expect(fields).toEqual({
      scope: COMMENT_SCOPE.SHOW,
      seasonNumber: null,
      episodeNumber: null,
      scopeKey: "show",
      scopeTitle: null,
    });
    // Firestore undefined kabul etmez — alanların hiçbiri undefined olmamalı.
    Object.values(fields).forEach((v) => expect(v).not.toBeUndefined());
  });
});

describe("isSameScope", () => {
  it("aynı yeri gösteren farklı gösterimleri eşitler", () => {
    expect(isSameScope({ seasonNumber: 2, episodeNumber: 5 }, episodeComment)).toBe(
      true,
    );
    expect(isSameScope(seasonComment, episodeComment)).toBe(false);
  });
});

describe("makeScopeFilter", () => {
  it("eksik numaralı filtreyi 'Tümü'ye düşürür", () => {
    expect(makeScopeFilter(SCOPE_FILTER.SEASON)).toEqual(ALL_SCOPE_FILTER);
    expect(makeScopeFilter(SCOPE_FILTER.EPISODE, 2)).toEqual(ALL_SCOPE_FILTER);
  });

  it("sezon filtresinde bölüm numarasını taşımaz", () => {
    expect(makeScopeFilter(SCOPE_FILTER.SEASON, 2, 5)).toEqual({
      type: SCOPE_FILTER.SEASON,
      seasonNumber: 2,
      episodeNumber: null,
    });
  });

  it("bilinmeyen tipte 'Tümü' döner", () => {
    expect(makeScopeFilter("nope", 1, 1)).toEqual(ALL_SCOPE_FILTER);
  });
});

describe("filterForScope / scopeForFilter", () => {
  it("rozete tıklama o kapsamın filtresini verir", () => {
    expect(filterForScope(episodeComment)).toEqual({
      type: SCOPE_FILTER.EPISODE,
      seasonNumber: 2,
      episodeNumber: 5,
    });
    expect(filterForScope(seasonComment).type).toBe(SCOPE_FILTER.SEASON);
    expect(filterForScope(showComment).type).toBe(SCOPE_FILTER.SHOW);
  });

  it("aktif filtre yeni yorumun hedefini belirler", () => {
    expect(scopeForFilter(ALL_SCOPE_FILTER).scope).toBe(COMMENT_SCOPE.SHOW);
    expect(
      scopeForFilter(makeScopeFilter(SCOPE_FILTER.SEASON_ONLY, 3)),
    ).toMatchObject({ scope: COMMENT_SCOPE.SEASON, seasonNumber: 3 });
    expect(
      scopeForFilter(makeScopeFilter(SCOPE_FILTER.EPISODE, 3, 4)),
    ).toMatchObject({
      scope: COMMENT_SCOPE.EPISODE,
      seasonNumber: 3,
      episodeNumber: 4,
    });
  });

  it("filtre → hedef → filtre gidiş-dönüşü kararlıdır", () => {
    const f = makeScopeFilter(SCOPE_FILTER.EPISODE, 1, 2);
    expect(filterForScope(scopeForFilter(f))).toEqual(f);
  });
});

describe("scopeMatchesFilter", () => {
  const all = [showComment, seasonComment, episodeComment];
  const matching = (filter) => all.filter((c) => scopeMatchesFilter(c, filter));

  it("Tümü her şeyi geçirir", () => {
    expect(matching(ALL_SCOPE_FILTER)).toHaveLength(3);
    expect(scopeMatchesFilter(episodeComment, null)).toBe(true);
  });

  it("Dizi filtresi yalnız dizi geneli yorumlarını gösterir", () => {
    expect(matching(makeScopeFilter(SCOPE_FILTER.SHOW))).toEqual([showComment]);
  });

  it("Sezon filtresi sezonu VE bölümlerini kapsar", () => {
    expect(matching(makeScopeFilter(SCOPE_FILTER.SEASON, 2))).toEqual([
      seasonComment,
      episodeComment,
    ]);
  });

  it("Sezon geneli filtresi bölümleri dışlar", () => {
    expect(matching(makeScopeFilter(SCOPE_FILTER.SEASON_ONLY, 2))).toEqual([
      seasonComment,
    ]);
  });

  it("Bölüm filtresi tek bölümü verir", () => {
    expect(matching(makeScopeFilter(SCOPE_FILTER.EPISODE, 2, 5))).toEqual([
      episodeComment,
    ]);
    expect(matching(makeScopeFilter(SCOPE_FILTER.EPISODE, 2, 6))).toEqual([]);
  });

  it("başka sezonun yorumunu sızdırmaz", () => {
    expect(
      scopeMatchesFilter(
        { scope: "episode", seasonNumber: 3, episodeNumber: 5 },
        makeScopeFilter(SCOPE_FILTER.SEASON, 2),
      ),
    ).toBe(false);
  });
});

describe("kaynak (TMDB) görünürlüğü", () => {
  it("TMDB incelemeleri yalnız Tümü/Dizi filtrelerinde görünür", () => {
    expect(filterAllowsShowLevelSources(ALL_SCOPE_FILTER)).toBe(true);
    expect(filterAllowsShowLevelSources(makeScopeFilter(SCOPE_FILTER.SHOW))).toBe(
      true,
    );
    expect(
      filterAllowsShowLevelSources(makeScopeFilter(SCOPE_FILTER.SEASON, 1)),
    ).toBe(false);
    expect(
      filterAllowsShowLevelSources(makeScopeFilter(SCOPE_FILTER.EPISODE, 1, 1)),
    ).toBe(false);
  });

  it("isAllFilter null filtreyi de 'Tümü' sayar", () => {
    expect(isAllFilter(null)).toBe(true);
    expect(isAllFilter(makeScopeFilter(SCOPE_FILTER.SHOW))).toBe(false);
  });
});

describe("summarizeScopes", () => {
  const items = [
    showComment,
    showComment,
    seasonComment,
    episodeComment,
    { scope: "episode", seasonNumber: 2, episodeNumber: 5 },
    { scope: "episode", seasonNumber: 1, episodeNumber: 3, scopeTitle: "Pilot" },
  ];
  const summary = summarizeScopes(items);

  it("dizi geneli ve sezon toplamlarını ayırır", () => {
    expect(summary.total).toBe(6);
    expect(summary.show).toBe(2);
    expect(summary.seasonTotal).toBe(4);
  });

  it("sezonları artan sırada döndürür", () => {
    expect(summary.seasons.map((s) => s.seasonNumber)).toEqual([1, 2]);
  });

  it("sezon kovasında genel/bölüm ayrımını tutar", () => {
    const s2 = seasonBucket(summary, 2);
    expect(s2.total).toBe(3);
    expect(s2.seasonOnly).toBe(1);
    expect(s2.episodeTotal).toBe(2);
    expect(s2.episodes).toEqual([
      { episodeNumber: 5, count: 2, title: "Ozymandias" },
    ]);
  });

  it("byKey ile anahtar başına sayaç verir", () => {
    expect(summary.byKey).toMatchObject({ show: 2, s2: 1, s2e5: 2, s1e3: 1 });
  });

  it("boş/geçersiz girdide boş özet üretir", () => {
    expect(summarizeScopes(null)).toMatchObject({ total: 0, show: 0, seasons: [] });
  });

  it("bilinmeyen sezon için boş kova döner", () => {
    expect(seasonBucket(summary, 99)).toMatchObject({
      total: 0,
      seasonOnly: 0,
      episodes: [],
    });
    expect(seasonBucket(null, 1).total).toBe(0);
  });

  it("countForFilter her filtre tipini özetten sayar", () => {
    expect(countForFilter(summary, ALL_SCOPE_FILTER)).toBe(6);
    expect(countForFilter(summary, makeScopeFilter(SCOPE_FILTER.SHOW))).toBe(2);
    expect(countForFilter(summary, makeScopeFilter(SCOPE_FILTER.SEASON, 2))).toBe(3);
    expect(
      countForFilter(summary, makeScopeFilter(SCOPE_FILTER.SEASON_ONLY, 2)),
    ).toBe(1);
    expect(countForFilter(summary, makeScopeFilter(SCOPE_FILTER.EPISODE, 2, 5))).toBe(
      2,
    );
    expect(countForFilter(summary, makeScopeFilter(SCOPE_FILTER.EPISODE, 9, 9))).toBe(
      0,
    );
    expect(countForFilter(null, ALL_SCOPE_FILTER)).toBe(0);
  });

  it("sayımlar filtreleyerek elde edilen uzunlukla birebir örtüşür", () => {
    [
      ALL_SCOPE_FILTER,
      makeScopeFilter(SCOPE_FILTER.SHOW),
      makeScopeFilter(SCOPE_FILTER.SEASON, 1),
      makeScopeFilter(SCOPE_FILTER.SEASON, 2),
      makeScopeFilter(SCOPE_FILTER.SEASON_ONLY, 2),
      makeScopeFilter(SCOPE_FILTER.EPISODE, 2, 5),
    ].forEach((filter) => {
      const manual = items.filter((c) => scopeMatchesFilter(c, filter)).length;
      expect(countForFilter(summary, filter)).toBe(manual);
    });
  });
});

describe("etiketler", () => {
  it("kısa rozet metni üretir", () => {
    expect(shortScopeLabel(showComment)).toBe("Dizi");
    expect(shortScopeLabel(seasonComment)).toBe("S2");
    expect(shortScopeLabel(episodeComment)).toBe("S2·B5");
  });

  it("etiketler dile göre değiştirilebilir", () => {
    expect(
      shortScopeLabel(episodeComment, { show: "Show", episodePrefix: "E" }),
    ).toBe("S2·E5");
  });

  it("uzun etiket bölüm adını ekler", () => {
    expect(longScopeLabel(episodeComment)).toBe("2. Sezon · 5. Bölüm — Ozymandias");
    expect(longScopeLabel(seasonComment)).toBe("2. Sezon");
    expect(longScopeLabel(showComment)).toBe("Dizi geneli");
  });

  it("uzun etiket biçimi çağırandan gelir", () => {
    expect(
      longScopeLabel(episodeComment, {
        episode: "Season {season} · Episode {episode}",
      }),
    ).toBe("Season 2 · Episode 5 — Ozymandias");
  });

  it("çift süslü yer tutucular da doldurulur (geriye dönük)", () => {
    expect(
      longScopeLabel(episodeComment, {
        episode: "S{{season}} · E{{episode}}",
      }),
    ).toBe("S2 · E5 — Ozymandias");
  });

  it("sezon başlığı etiketle aynıysa tekrar etmez", () => {
    expect(
      longScopeLabel({ scope: "season", seasonNumber: 2, scopeTitle: "2. Sezon" }),
    ).toBe("2. Sezon");
  });

  it("filtre etiketi sezon geneli için ayrı metin kullanır", () => {
    expect(filterLabel(ALL_SCOPE_FILTER)).toBe("Tümü");
    expect(filterLabel(makeScopeFilter(SCOPE_FILTER.SEASON_ONLY, 2))).toBe(
      "2. Sezon (genel)",
    );
    expect(filterLabel(makeScopeFilter(SCOPE_FILTER.SEASON, 2))).toBe("2. Sezon");
    expect(filterLabel(makeScopeFilter(SCOPE_FILTER.EPISODE, 2, 5))).toBe(
      "2. Sezon · 5. Bölüm",
    );
  });
});
