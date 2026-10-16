// __tests__/profileStoryCard.test.js
//
// Profil hikaye kartının saf mantığı: seçenek doğrulama, poster seçimi, sayılar,
// tür/seri/Perde/üyelik/rozet özetleri ve "Profil rengi" paleti.

const {
  DEFAULT_PROFILE_STORY_OPTIONS,
  FAVORITE_RIBBON,
  FAVORITE_SHELF,
  PICKS_BUDGET,
  STORY_INNER_H,
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
  isFavoritesActive,
  persistableStoryOptions,
  pickShowcaseBadges,
  pickStoryFavorites,
  pickStoryPosters,
  planFavoriteShelves,
  planPicksLayout,
  resolveStoryLayout,
  ribbonMetrics,
  sanitizeFavoriteKinds,
  sanitizeStoryOptions,
  toStoryBadge,
  toggleStoryKind,
} = require("../utils/profileStoryCard");
const { FAVORITE_KINDS } = require("../utils/fourFavorites");

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

// ── Dört favori (profil vitrini) ─────────────────────────────────────────────

const entry = (id, extra = {}) => ({ id, title: `Başlık ${id}`, image: `/i${id}.jpg`, ...extra });
const FAVS = {
  movies: [entry(1, { year: "2010" }), entry(2), entry(3), entry(4)],
  shows: [entry(11), entry(12)],
  people: [entry(21, { image: null })],
};

describe("dört favori: seçenekler", () => {
  test("varsayılan: anahtar açık, üç kategori seçili", () => {
    expect(DEFAULT_PROFILE_STORY_OPTIONS.showFavorites).toBe(true);
    expect([...DEFAULT_PROFILE_STORY_OPTIONS.favoriteKinds]).toEqual([...FAVORITE_KINDS]);
  });

  test("eski kayıtta olmayan favori anahtarları varsayılanı alır", () => {
    const out = sanitizeStoryOptions({ layout: "wall", showStats: false });
    expect(out.showFavorites).toBe(true);
    expect(out.favoriteKinds).toEqual([...FAVORITE_KINDS]);
  });

  test("Seçki düzeni kabul edilir ve liste posteri almaz", () => {
    expect(STORY_LAYOUT_IDS).toContain("picks");
    expect(sanitizeStoryOptions({ layout: "picks" }).layout).toBe("picks");
    expect(STORY_POSTER_COUNT.picks).toBe(0);
    // Her düzenin poster sayısı tanımlı (modal `??` ile okur; 0 geçerli).
    for (const id of STORY_LAYOUT_IDS) expect(typeof STORY_POSTER_COUNT[id]).toBe("number");
  });

  test("kategori listesi: sıra kanonik, tekrar/bilinmeyen atılır, boşsa hepsi", () => {
    expect(sanitizeFavoriteKinds(["people", "movies", "movies", "yok"])).toEqual(["movies", "people"]);
    expect(sanitizeFavoriteKinds([])).toEqual([...FAVORITE_KINDS]);
    expect(sanitizeFavoriteKinds(["yok"])).toEqual([...FAVORITE_KINDS]);
    for (const bad of [undefined, null, "movies", 5, {}]) {
      expect(sanitizeFavoriteKinds(bad)).toEqual([...FAVORITE_KINDS]);
    }
    expect(sanitizeStoryOptions({ favoriteKinds: ["shows"], showFavorites: "x" })).toMatchObject({
      favoriteKinds: ["shows"],
      showFavorites: true, // boolean değil → varsayılan
    });
  });

  test("seçimler diske yazılır (not hariç)", () => {
    const saved = persistableStoryOptions({ layout: "picks", favoriteKinds: ["people"], showFavorites: false });
    expect(saved).toMatchObject({ layout: "picks", favoriteKinds: ["people"], showFavorites: false });
    expect(saved).not.toHaveProperty("note");
  });
});

describe("pickStoryFavorites", () => {
  test("kategoriler kanonik sırada, giriş sırası korunur, sayaç doğru", () => {
    const pick = pickStoryFavorites(FAVS, ["people", "shows", "movies"]);
    expect(pick.groups.map((g) => g.kind)).toEqual(["movies", "shows", "people"]);
    expect(pick.kinds).toEqual(["movies", "shows", "people"]);
    expect(pick.count).toBe(7);
    expect(pick.groups[0].items.map((i) => i.key)).toEqual(["movies-1", "movies-2", "movies-3", "movies-4"]);
    expect(pick.groups[0].items[0]).toEqual({ key: "movies-1", title: "Başlık 1", imagePath: "/i1.jpg", year: "2010" });
  });

  test("görseli olmayan favori atılmaz, imagePath null olur", () => {
    const people = pickStoryFavorites(FAVS, ["people"]).groups[0].items;
    expect(people).toHaveLength(1);
    expect(people[0].imagePath).toBeNull();
  });

  test("yalnız seçili kategoriler gelir", () => {
    const pick = pickStoryFavorites(FAVS, ["shows"]);
    expect(pick.kinds).toEqual(["shows"]);
    expect(pick.count).toBe(2);
  });

  test("boş kategori grup üretmez", () => {
    const pick = pickStoryFavorites({ movies: FAVS.movies }, [...FAVORITE_KINDS]);
    expect(pick.kinds).toEqual(["movies"]);
  });

  test("seçili kategorilerin hepsi boşsa tüm kategorilere genişler (bayat seçim)", () => {
    const pick = pickStoryFavorites({ movies: FAVS.movies }, ["people"]);
    expect(pick.kinds).toEqual(["movies"]);
    expect(pick.count).toBe(4);
  });

  test("favori yoksa / bozuk veride boş", () => {
    for (const bad of [undefined, null, {}, "x", { movies: "yok" }]) {
      expect(pickStoryFavorites(bad, ["movies"])).toEqual({ groups: [], kinds: [], count: 0 });
    }
  });

  test("bozuk girişler (kimlik/başlık yok, fazla kayıt) normalize edilir", () => {
    const messy = { movies: [entry(1), { id: 2 }, { title: "x" }, entry(1), entry(3), entry(4), entry(5), entry(6)] };
    expect(pickStoryFavorites(messy, ["movies"]).groups[0].items.map((i) => i.key)).toEqual([
      "movies-1",
      "movies-3",
      "movies-4",
      "movies-5",
    ]);
  });
});

describe("dört favori: etkinlik ve düzen çözümü", () => {
  const pick = pickStoryFavorites(FAVS, [...FAVORITE_KINDS]);
  const none = pickStoryFavorites({}, [...FAVORITE_KINDS]);

  test("etkin = anahtar açık VE gösterilecek öğe var", () => {
    expect(isFavoritesActive({ showFavorites: true }, pick)).toBe(true);
    expect(isFavoritesActive({ showFavorites: false }, pick)).toBe(false);
    expect(isFavoritesActive({ showFavorites: true }, none)).toBe(false);
    expect(isFavoritesActive(undefined, pick)).toBe(false);
    expect(isFavoritesActive({ showFavorites: true }, undefined)).toBe(false);
  });

  test("Seçki yalnız favori etkinken çizilir, yoksa Vitrin'e düşer", () => {
    expect(resolveStoryLayout("picks", true)).toBe("picks");
    expect(resolveStoryLayout("picks", false)).toBe("showcase");
    for (const id of ["showcase", "identity", "wall", "minimal"]) {
      expect(resolveStoryLayout(id, false)).toBe(id);
      expect(resolveStoryLayout(id, true)).toBe(id);
    }
    expect(resolveStoryLayout("yok", true)).toBe(DEFAULT_PROFILE_STORY_OPTIONS.layout);
  });
});

describe("toggleStoryKind", () => {
  test("seçili kategori kapanır, kapalı olan (dolu) açılır; sıra kanonik", () => {
    expect(toggleStoryKind(["movies", "shows", "people"], "shows", FAVS)).toEqual(["movies", "people"]);
    expect(toggleStoryKind(["movies", "people"], "shows", FAVS)).toEqual(["movies", "shows", "people"]);
  });

  test("son görünen kategori kapatılamaz", () => {
    expect(toggleStoryKind(["shows"], "shows", FAVS)).toEqual(["shows"]);
  });

  test("boş kategori seçilemez", () => {
    expect(toggleStoryKind(["movies"], "people", { movies: FAVS.movies })).toEqual(["movies"]);
  });

  test("varsayılan 'hepsi' seçimi, boş kategorileri yok sayarak çalışır", () => {
    // Yalnız film var: seçili üç kategori görünürde tek kategori; kapatılamaz.
    expect(toggleStoryKind([...FAVORITE_KINDS], "movies", { movies: FAVS.movies })).toEqual(["movies"]);
    // Film + dizi var: filmi kapatınca dizi kalır.
    expect(toggleStoryKind([...FAVORITE_KINDS], "movies", { movies: FAVS.movies, shows: FAVS.shows })).toEqual(["shows"]);
  });

  test("bilinmeyen kategori / favorisiz durumda dokunulmaz", () => {
    expect(toggleStoryKind(["movies"], "yok", FAVS)).toEqual(["movies"]);
    expect(toggleStoryKind(["movies"], "movies", {})).toEqual([]);
  });
});

describe("planFavoriteShelves", () => {
  const S = FAVORITE_SHELF;

  test("kategori yoksa plan yok", () => {
    expect(planFavoriteShelves({ kinds: [], available: 400 })).toBeNull();
    expect(planFavoriteShelves({ kinds: ["yok"], available: 400 })).toBeNull();
  });

  test("bol yerde: 3 kategori yan etiketli, adlı, en büyük boy", () => {
    const plan = planFavoriteShelves({ kinds: [...FAVORITE_KINDS], available: 400 });
    expect(plan).toMatchObject({ style: "side", names: true, width: S.sideMaxW });
    expect(plan.rows.map((r) => r.kind)).toEqual(["movies", "shows", "people"]);
    // Poster 2:3, oyuncu yuvarlak (genişlik = yükseklik).
    expect(plan.rows[0].artH).toBe(Math.round(S.sideMaxW * 1.5));
    expect(plan.rows[2].artH).toBe(S.sideMaxW);
    expect(plan.height).toBeLessThanOrEqual(400);
  });

  test("1-2 kategori: etiket üstte, daha geniş posterler", () => {
    for (const kinds of [["movies"], ["shows", "people"]]) {
      const plan = planFavoriteShelves({ kinds, available: 400 });
      expect(plan.style).toBe("top");
      expect(plan.width).toBe(S.topMaxW);
      expect(plan.width).toBeGreaterThan(S.sideMaxW);
    }
  });

  test("dar yerde önce ad satırı düşer, sonra poster küçülür; yükseklik alana sığar", () => {
    const tight = planFavoriteShelves({ kinds: [...FAVORITE_KINDS], available: 230 });
    expect(tight.names).toBe(false);
    expect(tight.width).toBeGreaterThanOrEqual(S.minW);
    expect(tight.height).toBeLessThanOrEqual(230);
    const roomy = planFavoriteShelves({ kinds: [...FAVORITE_KINDS], available: 360 });
    expect(roomy.width).toBeGreaterThan(tight.width);
  });

  test("alan arttıkça: ad satırı bir kez açılır ve kalır; aynı kipte boyut azalmaz", () => {
    // Ad satırı açılınca poster bir miktar küçülür (adlar yer ister) — bilinçli;
    // bu yüzden genişlik yalnız AYNI ad kipinde tek yönlüdür.
    let last = { names: false, width: 0 };
    for (let available = 180; available <= 420; available += 10) {
      const plan = planFavoriteShelves({ kinds: [...FAVORITE_KINDS], available });
      if (last.names) expect(plan.names).toBe(true);
      if (plan.names === last.names) expect(plan.width).toBeGreaterThanOrEqual(last.width);
      if (plan.names && !last.names) expect(plan.width).toBeGreaterThanOrEqual(FAVORITE_SHELF.namesMinW);
      last = plan;
    }
  });

  test("oyuncu rafı poster rafından kısa (yuvarlak portre)", () => {
    const people = planFavoriteShelves({ kinds: ["people"], available: 400 });
    const movies = planFavoriteShelves({ kinds: ["movies"], available: 400 });
    expect(people.height).toBeLessThan(movies.height);
  });
});

describe("Seçki düzeni: dikey bütçe", () => {
  const KIND_SETS = [
    ["movies"],
    ["shows"],
    ["people"],
    ["movies", "shows"],
    ["movies", "people"],
    ["shows", "people"],
    ["movies", "shows", "people"],
  ];
  const bools = [false, true];

  test("her anahtar × kategori birleşiminde kart 600 pikseli aşmaz", () => {
    let checked = 0;
    for (const kinds of KIND_SETS) {
      for (const hasNote of bools) {
        for (const showStats of bools) {
          for (const showPerde of bools) {
            for (const showGenres of bools) {
              for (const showPills of bools) {
                const plan = planPicksLayout({ kinds, hasNote, showStats, showPerde, showGenres, showPills });
                const label = JSON.stringify({ kinds, hasNote, showStats, showPerde, showGenres, showPills });
                expect({ label, fits: plan.used + PICKS_BUDGET.safety <= STORY_INNER_H }).toEqual({ label, fits: true });
                expect(plan.shelf.width).toBeGreaterThanOrEqual(FAVORITE_SHELF.minW);
                checked += 1;
              }
            }
          }
        }
      }
    }
    expect(checked).toBe(7 * 32);
  });

  test("en kalabalık kart (hepsi açık, 2 satır not, 3 kategori) hâlâ okunur boyutta", () => {
    const plan = planPicksLayout({
      kinds: [...FAVORITE_KINDS],
      hasNote: true,
      showStats: true,
      showPerde: true,
      showGenres: true,
      showPills: true,
    });
    expect(plan.shelf.width).toBeGreaterThanOrEqual(34);
    expect(plan.used).toBeLessThanOrEqual(STORY_INNER_H);
  });

  test("sade kartta raflar tam boy ve adlı", () => {
    const plan = planPicksLayout({
      kinds: [...FAVORITE_KINDS],
      hasNote: false,
      showStats: true,
      showPerde: false,
      showGenres: false,
      showPills: false,
    });
    expect(plan.shelf).toMatchObject({ names: true, width: FAVORITE_SHELF.sideMaxW });
  });

  test("bölüm kapanınca raflara kalan alan artar", () => {
    const base = { kinds: [...FAVORITE_KINDS], hasNote: true, showStats: true, showPerde: true, showGenres: true, showPills: true };
    const full = planPicksLayout(base);
    expect(planPicksLayout({ ...base, showPerde: false }).available).toBeGreaterThan(full.available);
    expect(planPicksLayout({ ...base, hasNote: false }).available).toBeGreaterThan(full.available);
    expect(planPicksLayout({ ...base, showGenres: false, showPills: false }).available).toBeGreaterThan(full.available);
  });
});

describe("dört favori şeridi (eski düzenlerin poster alanı)", () => {
  test("şerit, poster alanının yüksekliğine ve kart genişliğine sığar", () => {
    for (const [layout, { slot, thumb }] of Object.entries(FAVORITE_RIBBON)) {
      const m = ribbonMetrics(thumb);
      expect({ layout, fits: m.height <= slot }).toEqual({ layout, fits: true });
      // 3 kategorinin destesi + aralarındaki en az 10 px, 320 px iç genişliğe sığar.
      expect({ layout, fits: m.stackW * 3 + 20 <= 320 }).toEqual({ layout, fits: true });
    }
  });

  test("deste ölçüleri: 4 poster üst üste, ofset yarıdan biraz büyük", () => {
    const m = ribbonMetrics(38);
    expect(m).toMatchObject({ thumb: 38, thumbH: 57, offset: 20, stackW: 98, height: 75 });
  });
});
