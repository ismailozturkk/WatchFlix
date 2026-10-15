// __tests__/profileStoryCard.test.js
//
// Profil hikaye kartının saf mantığı: seçenek doğrulama, poster seçimi, sayılar,
// tür/seri/Perde/üyelik/rozet özetleri ve "Profil rengi" paleti.

const {
  DEFAULT_PROFILE_STORY_OPTIONS,
  STORY_LAYOUT_IDS,
  STORY_NOTE_MAX,
  STORY_POSTER_COUNT,
  STORY_THEME_IDS,
  WRAPPED_THEME_IDS,
  buildRankPalette,
  buildStoryGenres,
  buildStoryPerde,
  buildStoryStats,
  buildStoryStreak,
  cleanStoryNote,
  cleanStoryUsername,
  formatMemberSince,
  formatStoryNumber,
  hslStringToHex,
  persistableStoryOptions,
  pickShowcaseBadges,
  pickStoryPosters,
  sanitizeStoryOptions,
  toStoryBadge,
} = require("../utils/profileStoryCard");

// Kart paleti Wrapped paletlerinden gelir (utils/wrappedCard.js, ilk altısı
// ortak); kimlikler ayrışırsa seçili tema sessizce "signature"a düşerdi.
describe("tema kimlikleri", () => {
  test("Wrapped paletlerinin ortak ilk altısıyla birebir aynı", () => {
    const { WRAPPED_SHARED_PALETTES } = require("../utils/wrappedCard");
    expect(WRAPPED_SHARED_PALETTES.map((p) => p.id)).toEqual([...WRAPPED_THEME_IDS]);
  });

  test("kart teması = Wrapped paletleri + halka rengi", () => {
    expect(STORY_THEME_IDS).toEqual([...WRAPPED_THEME_IDS, "rank"]);
  });
});

describe("sanitizeStoryOptions", () => {
  test("boş/bozuk girdi varsayılana döner", () => {
    for (const bad of [undefined, null, 5, "x", [], {}]) {
      expect(sanitizeStoryOptions(bad)).toEqual(DEFAULT_PROFILE_STORY_OPTIONS);
    }
  });

  test("geçersiz değerler varsayılana düşer, geçerliler korunur", () => {
    const out = sanitizeStoryOptions({
      layout: "wall",
      themeId: "yok-boyle-tema",
      background: "clean",
      posterSource: "shows",
      showStats: false,
      showPosters: "false", // boolean değil → varsayılan (true)
      bilinmeyen: 1,
    });
    expect(out.layout).toBe("wall");
    expect(out.themeId).toBe(DEFAULT_PROFILE_STORY_OPTIONS.themeId);
    expect(out.background).toBe("clean");
    expect(out.posterSource).toBe("shows");
    expect(out.showStats).toBe(false);
    expect(out.showPosters).toBe(true);
    expect(out).not.toHaveProperty("bilinmeyen");
  });

  test("yeni düzen ve tema kimlikleri kabul edilir", () => {
    expect(STORY_LAYOUT_IDS).toContain("minimal");
    const out = sanitizeStoryOptions({ layout: "minimal", themeId: "rank" });
    expect(out.layout).toBe("minimal");
    expect(out.themeId).toBe("rank");
  });

  test("eski kayıtta olmayan yeni anahtarlar açık gelir", () => {
    // Güncellemeden ÖNCE kaydedilmiş bir tercih: showGenres/showStreak/showMember yok.
    const old = { layout: "identity", themeId: "ocean", showStats: false, showUsername: false };
    const out = sanitizeStoryOptions(old);
    expect(out.layout).toBe("identity");
    expect(out.showStats).toBe(false);
    expect(out.showGenres).toBe(true);
    expect(out.showStreak).toBe(true);
    expect(out.showMember).toBe(true);
  });

  test("not: satır sonu/boşluk tek boşluğa iner ve sınırlanır", () => {
    expect(cleanStoryNote("  merhaba\n\n  dünya  ")).toBe("merhaba dünya");
    expect(cleanStoryNote(42)).toBe("");
    expect(cleanStoryNote("a".repeat(500))).toHaveLength(STORY_NOTE_MAX);
  });

  test("persistableStoryOptions notu saklamaz", () => {
    const saved = persistableStoryOptions({ layout: "identity", note: "gizli not" });
    expect(saved).not.toHaveProperty("note");
    expect(saved.layout).toBe("identity");
  });
});

describe("pickStoryPosters", () => {
  const fav = (id, extra = {}) => ({ id, type: "movie", name: `Fav ${id}`, imagePath: `/f${id}.jpg`, ...extra });
  const watched = (id, ms) => ({ id, type: "movie", name: `W ${id}`, imagePath: `/w${id}.jpg`, dateAdded: ms });

  test("favoriler listOrder'a göre dizilir ve sayıya kırpılır", () => {
    const sources = {
      favorites: [fav(1, { listOrder: 2 }), fav(2, { listOrder: 0 }), fav(3, { listOrder: 1 }), fav(4, { listOrder: 3 }), fav(5, { listOrder: 4 })],
    };
    const all = pickStoryPosters(sources, "favorites", STORY_POSTER_COUNT.showcase);
    expect(all.source).toBe("favorites");
    expect(all.items.map((i) => i.name)).toEqual(["Fav 2", "Fav 3", "Fav 1", "Fav 4", "Fav 5"]);
    const four = pickStoryPosters(sources, "favorites", 4);
    expect(four.items.map((i) => i.name)).toEqual(["Fav 2", "Fav 3", "Fav 1", "Fav 4"]);
  });

  test("izlenenler en yeni önce, tarihsiz sona", () => {
    const sources = {
      movies: [watched(1, 1000), watched(2, 3000), { id: 3, type: "movie", name: "Tarihsiz", imagePath: "/t.jpg" }, watched(4, 2000)],
    };
    const { items } = pickStoryPosters(sources, "movies", 4);
    expect(items.map((i) => i.name)).toEqual(["W 2", "W 4", "W 1", "Tarihsiz"]);
  });

  test("posteri olmayan öğeler elenir, aynı öğe iki kez gelmez", () => {
    const sources = {
      favorites: [fav(1), fav(1), { id: 9, name: "posterisiz" }, { id: 8, imagePath: "" }],
    };
    const { items } = pickStoryPosters(sources, "favorites", 4);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe("movie-1");
  });

  test("istenen kaynak boşsa diğerine düşer ve gerçek kaynağı bildirir", () => {
    const sources = { favorites: [], movies: [], shows: [{ id: 7, name: "Dizi", imagePath: "/d.jpg", dateAdded: 5 }] };
    const out = pickStoryPosters(sources, "favorites", 4);
    expect(out.source).toBe("shows");
    expect(out.items[0].key).toBe("tv-7");
  });

  test("istenen kaynakta öğe varsa eksik yuva başka listeyle doldurulmaz", () => {
    const sources = { favorites: [fav(1)], movies: [watched(2, 1), watched(3, 2)] };
    const { source, items } = pickStoryPosters(sources, "favorites", 4);
    expect(source).toBe("favorites");
    expect(items).toHaveLength(1);
  });

  test("hiç veri yoksa boş döner", () => {
    expect(pickStoryPosters({}, "favorites", 4)).toEqual({ source: null, items: [] });
    expect(pickStoryPosters(undefined, "movies", 4)).toEqual({ source: null, items: [] });
  });
});

describe("sayılar", () => {
  test("buildStoryStats: negatif/NaN sıfırlanır, saat ve gün türetilir", () => {
    expect(buildStoryStats({ movies: 12, shows: -3, episodes: "x", totalMinutes: 3 * 24 * 60 + 90 })).toEqual({
      movies: 12,
      shows: 0,
      episodes: 0,
      hours: 73,
      days: 3,
      remHours: 1,
    });
    expect(buildStoryStats()).toEqual({ movies: 0, shows: 0, episodes: 0, hours: 0, days: 0, remHours: 0 });
  });

  test("formatStoryNumber: yerel biçim ve kısaltma", () => {
    expect(formatStoryNumber(950, "tr")).toBe("950");
    expect(formatStoryNumber(1234567, "tr", { compact: true })).toBe("1,2M");
    expect(formatStoryNumber(12300, "tr", { compact: true })).toBe("12,3B");
    expect(formatStoryNumber(12300, "en", { compact: true })).toBe("12.3K");
    expect(formatStoryNumber(10000, "en", { compact: true })).toBe("10K");
    expect(formatStoryNumber(-5, "tr")).toBe("0");
    expect(formatStoryNumber("abc", "tr")).toBe("0");
  });

  test("cleanStoryUsername baştaki @ işaretlerini ve boşluğu atar", () => {
    expect(cleanStoryUsername("  @@ismail ")).toBe("ismail");
    expect(cleanStoryUsername(null)).toBe("");
  });
});

describe("buildStoryGenres", () => {
  const movie = (id, genres) => ({ id, type: "movie", genres });

  test("dil farkı olan yazımlar tek türde birleşir, kart adı kartın dilinde", () => {
    const items = [
      movie(1, ["Science Fiction", "Thriller"]),
      movie(2, ["Bilim Kurgu"]),
      movie(3, ["Dram"]),
      movie(4, ["Drama", "Gerilim"]),
      movie(5, ["Drama"]),
    ];
    const tr = buildStoryGenres(items, "tr");
    expect(tr.titles).toBe(5);
    expect(tr.top.map((g) => [g.id, g.count])).toEqual([
      ["drama", 3],
      ["scifi", 2],
      ["thriller", 2],
    ]);
    expect(tr.top.map((g) => g.label)).toEqual(["Dram", "Bilim Kurgu", "Gerilim"]);
    expect(buildStoryGenres(items, "en").top.map((g) => g.label)).toEqual(["Drama", "Sci-Fi", "Thriller"]);
  });

  test("yüzde: türü taşıyan yapımların türü bilinen yapımlar içindeki payı", () => {
    const items = [movie(1, ["Drama"]), movie(2, ["Drama"]), movie(3, ["Comedy"]), movie(4, ["Comedy"])];
    const { top } = buildStoryGenres(items, "tr", 2);
    expect(top.map((g) => g.pct)).toEqual([50, 50]);
  });

  test("aynı yapım iki kez sayılmaz; türsüz/tanınmayan adlar yok sayılır", () => {
    const items = [
      movie(1, ["Drama"]),
      movie(1, ["Drama"]),
      movie(2, undefined),
      movie(3, ["Bilinmeyen Tür"]),
      movie(4, ["Drama", "Dram"]), // aynı kimlik, tek sayım
      null,
      { type: "movie", genres: ["Drama"] }, // id yok
    ];
    const { titles, top } = buildStoryGenres(items, "tr");
    expect(titles).toBe(2);
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({ id: "drama", count: 2, pct: 100 });
  });

  test("film ve dizi aynı kimlikte çakışmaz, eşitlikte sıra kararlı", () => {
    const items = [
      { id: 7, type: "movie", genres: ["Comedy"] },
      { id: 7, type: "tv", genres: ["Action"] },
    ];
    const { top } = buildStoryGenres(items, "tr");
    expect(top.map((g) => g.id)).toEqual(["action", "comedy"]); // GENRE_IDS sırası
  });

  test("veri yoksa boş döner", () => {
    expect(buildStoryGenres(undefined, "tr")).toEqual({ titles: 0, top: [] });
    expect(buildStoryGenres([], "tr").top).toEqual([]);
  });
});

describe("buildStoryStreak", () => {
  const week = [true, true, false, false, false, false, false];

  test("geçerli seri ve hafta kutuları", () => {
    const out = buildStoryStreak({ gunSerisi: 5, rekorGun: 12, aktifGunSayisi: 40, haftaKutulari: week });
    expect(out).toEqual({ current: 5, record: 12, week, activeDays: 40, showRecord: false });
  });

  test("seri koptuysa rekor gösterilir", () => {
    const out = buildStoryStreak({ gunSerisi: 0, rekorGun: 9, haftaKutulari: week });
    expect(out.showRecord).toBe(true);
    expect(out.record).toBe(9);
  });

  test("rekor, mevcut seriden küçük olamaz", () => {
    expect(buildStoryStreak({ gunSerisi: 7, rekorGun: 3 }).record).toBe(7);
  });

  test("hiç aktiflik yoksa ya da veri bozuksa null", () => {
    expect(buildStoryStreak(null)).toBeNull();
    expect(buildStoryStreak(undefined)).toBeNull();
    expect(buildStoryStreak({ gunSerisi: 0, rekorGun: 0 })).toBeNull();
    expect(buildStoryStreak({ gunSerisi: "x", rekorGun: -2 })).toBeNull();
  });

  test("hafta kutuları yedi değilse boş yedi kutu", () => {
    expect(buildStoryStreak({ gunSerisi: 1, haftaKutulari: [true] }).week).toEqual(Array(7).fill(false));
  });
});

describe("buildStoryPerde", () => {
  test("dile göre ad, ilerleme 0-1 aralığına sıkıştırılır", () => {
    const info = { perde: 9, ad: "Sinefil", adEn: "Cinephile", makara: 0, zirve: false, ilerleme: 0.64 };
    expect(buildStoryPerde(info, "tr")).toEqual({ number: 9, makara: 0, name: "Sinefil", progress: 0.64, maxed: false });
    expect(buildStoryPerde(info, "en").name).toBe("Cinephile");
    expect(buildStoryPerde({ ...info, ilerleme: 3 }, "tr").progress).toBe(1);
    expect(buildStoryPerde({ ...info, ilerleme: -1 }, "tr").progress).toBe(0);
    expect(buildStoryPerde({ ...info, ilerleme: "x" }, "tr").progress).toBe(0);
  });

  test("zirvede makara taşınır", () => {
    const out = buildStoryPerde({ perde: 20, ad: "Efsane", makara: 3, zirve: true, ilerleme: 0.5 }, "tr");
    expect(out).toMatchObject({ number: 20, makara: 3, maxed: true });
  });

  test("veri yoksa null", () => {
    expect(buildStoryPerde(null)).toBeNull();
    expect(buildStoryPerde({})).toBeNull();
    expect(buildStoryPerde({ perde: 0 })).toBeNull();
  });
});

describe("formatMemberSince", () => {
  // 15 Mart 2024 öğlen UTC: hangi saat diliminde olursa olsun Mart 2024.
  const ms = Date.UTC(2024, 2, 15, 12);

  test("ms sayısı, ms dizgesi ve tarih dizgesi kabul edilir", () => {
    expect(formatMemberSince(ms, "tr")).toBe("MART 2024");
    expect(formatMemberSince(String(ms), "tr")).toBe("MART 2024");
    expect(formatMemberSince("2024-03-15T12:00:00Z", "tr")).toBe("MART 2024");
  });

  test("İngilizce kısa ay adı, büyük harf", () => {
    expect(formatMemberSince(ms, "en")).toBe("MAR 2024");
  });

  test("okunamayan girdi boş döner", () => {
    expect(formatMemberSince(undefined, "tr")).toBe("");
    expect(formatMemberSince("", "tr")).toBe("");
    expect(formatMemberSince("bozuk", "tr")).toBe("");
    expect(formatMemberSince(null, "tr")).toBe("");
  });
});

describe("rozet vitrini", () => {
  const card = (id, rarity, extra = {}) => ({ id, rarity, acik: true, icon: `${id}-outline`, iconSolid: id, tier: 0, aileToplam: 0, ...extra });

  test("yalnız açık rozetler, en nadir önce, eşitte aile kademesi", () => {
    const cards = [
      card("a", "common"),
      card("b", "legendary"),
      card("c", "epic", { aileKademe: 1 }),
      card("d", "epic", { aileKademe: 3 }),
      card("e", "legendary", { acik: false }),
      card("f", "rare"),
    ];
    expect(pickShowcaseBadges(cards, 4).map((c) => c.id)).toEqual(["b", "d", "c", "f"]);
  });

  test("sınır uygulanır, bozuk girdi boş döner", () => {
    expect(pickShowcaseBadges([card("a", "common"), card("b", "rare")], 1)).toHaveLength(1);
    expect(pickShowcaseBadges(undefined)).toEqual([]);
    expect(pickShowcaseBadges([null, undefined])).toEqual([]);
  });

  test("toStoryBadge: ailesiz rozet altıgen ve renksiz, kademeli rozet kademe rengini taşır", () => {
    const plain = toStoryBadge(card("x", "rare"));
    expect(plain).toMatchObject({ id: "x", glyph: "x-outline", glyphSolid: "x", rarity: "rare", sides: 6, ornate: false, color: null });
    const tiered = toStoryBadge(card("y", "epic", { tier: 1, aileToplam: 5 }));
    expect(tiered.sides).toBe(4); // ilk kademe kare
    expect(tiered.color).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe("Profil rengi teması", () => {
  test("hsl dizgesi hex'e çevrilir, tanınmayan girdi null", () => {
    expect(hslStringToHex("hsl(0, 100%, 50%)")).toBe("#FF0000");
    expect(hslStringToHex("hsla(120, 100%, 25%, 0.9)")).toMatch(/^#[0-9A-F]{6}$/i);
    expect(hslStringToHex("#FF0000")).toBeNull();
    expect(hslStringToHex(undefined)).toBeNull();
  });

  test("paleti Wrapped paletleriyle aynı şekilde üretir", () => {
    const palette = buildRankPalette(["hsl(265, 60%, 60%)", "hsl(265, 74%, 76%)"]);
    expect(palette.id).toBe("rank");
    expect(palette.colors).toHaveLength(4);
    for (const color of [palette.accent, palette.secondary, ...palette.colors]) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  test("zemin koyulaşarak iner", () => {
    const { colors } = buildRankPalette(["hsl(200, 70%, 50%)", "hsl(200, 80%, 70%)"]);
    const light = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    const levels = colors.map(light);
    expect([...levels].sort((a, b) => b - a)).toEqual(levels);
  });

  test("halka renkleri okunamazsa null (kart varsayılana düşer)", () => {
    expect(buildRankPalette(null)).toBeNull();
    expect(buildRankPalette(["hsl(1, 1%, 1%)"])).toBeNull();
    expect(buildRankPalette(["red", "blue"])).toBeNull();
  });
});
