import {
  AI_HISTORY_LIMITS,
  AI_MAX_ITEM_CHOICES,
  DEFAULT_AI_PREFS,
  countCustomizedPrefs,
  countDiscoveryFilters,
  mergeAiPrefs,
  normalizeAiPrefs,
} from "../utils/aiPrefs";

describe("normalizeAiPrefs", () => {
  test("boş ya da bozuk kayıt tam varsayılana döner", () => {
    [null, undefined, "x", 5, [], {}].forEach((saved) => {
      expect(normalizeAiPrefs(saved)).toEqual(DEFAULT_AI_PREFS);
    });
  });

  test("ilk sürümün eski kaydı bozulmadan okunur, yeni alanlar varsayılan olur", () => {
    const legacy = {
      enabled: true,
      watchList: false,
      favorites: true,
      custom: true,
      watched: false,
      mediaType: "movie",
      providerIds: [8, 337],
      genreKeys: ["comedy"],
    };
    const prefs = normalizeAiPrefs(legacy);
    expect(prefs.enabled).toBe(true);
    expect(prefs.watchList).toBe(false);
    expect(prefs.watched).toBe(false);
    expect(prefs.mediaType).toBe("movie");
    expect(prefs.providerIds).toEqual([8, 337]);
    expect(prefs.genreKeys).toEqual(["comedy"]);
    expect(prefs.responseStyle).toBe(DEFAULT_AI_PREFS.responseStyle);
    expect(prefs.maxItems).toBe(DEFAULT_AI_PREFS.maxItems);
    expect(prefs.timeContext).toBe(true);
    expect(prefs.historyLimit).toBe(DEFAULT_AI_PREFS.historyLimit);
  });

  test("geçersiz seçenekler sessizce varsayılana düşer", () => {
    const prefs = normalizeAiPrefs({
      mediaType: "podcast",
      responseStyle: "poetic",
      spoilerLevel: "full",
      maxItems: 7,
      historyLimit: 1000,
      timeContext: "evet",
    });
    expect(prefs.mediaType).toBe("all");
    expect(prefs.responseStyle).toBe("balanced");
    expect(prefs.spoilerLevel).toBe("none");
    expect(prefs.maxItems).toBe(5);
    expect(prefs.historyLimit).toBe(50);
    expect(prefs.timeContext).toBe(true);
  });

  test("sayı seçenekleri metin olarak gelse de tanınır", () => {
    expect(normalizeAiPrefs({ maxItems: "8", historyLimit: "10" })).toMatchObject({
      maxItems: 8,
      historyLimit: 10,
    });
    AI_MAX_ITEM_CHOICES.forEach((n) => expect(normalizeAiPrefs({ maxItems: n }).maxItems).toBe(n));
    AI_HISTORY_LIMITS.forEach((n) => expect(normalizeAiPrefs({ historyLimit: n }).historyLimit).toBe(n));
  });

  test("platform kimlikleri sayıya çevrilir, tekrarlar ve bilinmeyenler atılır", () => {
    const prefs = normalizeAiPrefs(
      { providerIds: ["8", 8, 337, 999, "abc", null], genreKeys: ["comedy", "comedy", 5, "nope"] },
      { validProviderIds: [8, 337], validGenreKeys: ["comedy", "drama"] },
    );
    expect(prefs.providerIds).toEqual([8, 337]);
    expect(prefs.genreKeys).toEqual(["comedy"]);
  });

  test("kayıtta platform seçimi hiç yoksa üyelikler başlangıç olur; boş dizi açık tercihtir", () => {
    const context = { fallbackProviderIds: [8, 119], validProviderIds: [8, 119] };
    expect(normalizeAiPrefs({}, context).providerIds).toEqual([8, 119]);
    expect(normalizeAiPrefs({ providerIds: [] }, context).providerIds).toEqual([]);
  });

  test("varsayılan nesne dondurulmuş ve sonuç ondan bağımsız", () => {
    const prefs = normalizeAiPrefs({});
    prefs.providerIds.push(1);
    expect(DEFAULT_AI_PREFS.providerIds).toEqual([]);
    expect(Object.isFrozen(DEFAULT_AI_PREFS)).toBe(true);
  });
});

describe("mergeAiPrefs", () => {
  test("yama birleşir ve sonuç yeniden doğrulanır", () => {
    const current = normalizeAiPrefs({ mediaType: "tv", genreKeys: ["drama"] });
    const next = mergeAiPrefs(current, { responseStyle: "detailed", mediaType: "bogus" });
    expect(next.responseStyle).toBe("detailed");
    expect(next.mediaType).toBe("all");
    expect(next.genreKeys).toEqual(["drama"]);
  });

  test("boş yama mevcut tercihi korur", () => {
    const current = normalizeAiPrefs({ maxItems: 8 });
    expect(mergeAiPrefs(current, null)).toEqual(current);
  });
});

describe("rozet sayıları", () => {
  test("keşif filtresi sayısı: tür + her platform + her tür", () => {
    expect(countDiscoveryFilters(null)).toBe(0);
    expect(countDiscoveryFilters(DEFAULT_AI_PREFS)).toBe(0);
    expect(
      countDiscoveryFilters({ mediaType: "movie", providerIds: [8, 337], genreKeys: ["comedy"] }),
    ).toBe(4);
  });

  test("özel ayar sayısı yalnız varsayılandan farklı olanları sayar", () => {
    expect(countCustomizedPrefs(null)).toBe(0);
    expect(countCustomizedPrefs(DEFAULT_AI_PREFS)).toBe(0);
    const prefs = normalizeAiPrefs({ enabled: true, responseStyle: "concise", maxItems: 3, genreKeys: ["drama"] });
    // enabled + stil + öneri sayısı + 1 tür filtresi
    expect(countCustomizedPrefs(prefs)).toBe(4);
  });
});
