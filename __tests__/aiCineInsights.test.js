import {
  applyDiscoveryFilters,
  buildAvoidBlock,
  buildContextBlock,
  buildFollowUps,
  buildShareText,
  buildTargetCard,
  buildVibePrompt,
  collectLibraryItems,
  collectSuggestedTitles,
  computeMatchScore,
  conversationPreview,
  countResponseItems,
  describeMoment,
  filterConversations,
  formatDuration,
  formatRelativeTime,
  groupConversationsByRecency,
  hasVibe,
  matchLevel,
  maxRuntimeForVibe,
  normalizeVibe,
  quotaMeter,
  recencyBucket,
  sessionRuntime,
} from "../services/aiCineInsights";
import { posterKey } from "../services/aiCineService";

const movie = (title, reason = "r") => ({ title, mediaType: "movie", reason });
const tv = (title) => ({ title, mediaType: "tv" });
const card = (mediaType, title, extra = {}) => ({
  [posterKey(mediaType, title)]: { found: true, id: title.length, mediaType, title, ...extra },
});

describe("günün bağlamı", () => {
  test("saat dilimleri ve hafta sonu", () => {
    // 2026-10-14 Çarşamba (yerel saat)
    expect(describeMoment(new Date(2026, 9, 14, 8)).part).toBe("morning");
    expect(describeMoment(new Date(2026, 9, 14, 14)).part).toBe("afternoon");
    expect(describeMoment(new Date(2026, 9, 14, 20)).part).toBe("evening");
    expect(describeMoment(new Date(2026, 9, 14, 2)).part).toBe("late night");
    expect(describeMoment(new Date(2026, 9, 14, 20)).weekend).toBe(false);
    // Cuma akşamı hafta sonu sayılır, cuma öğleden önce sayılmaz
    expect(describeMoment(new Date(2026, 9, 16, 19)).weekend).toBe(true);
    expect(describeMoment(new Date(2026, 9, 16, 10)).weekend).toBe(false);
    expect(describeMoment(new Date(2026, 9, 17, 10)).weekend).toBe(true);
  });

  test("geçersiz tarih bağlam üretmez", () => {
    expect(describeMoment(new Date("x"))).toBeNull();
    expect(describeMoment("bugün")).toBeNull();
    expect(buildContextBlock(new Date("x"))).toBe("");
  });

  test("bağlam bloğu günü ve vakti içerir, kullanıcıya duyurmaz", () => {
    const block = buildContextBlock(new Date(2026, 9, 17, 21));
    expect(block).toContain("Saturday evening, weekend");
    expect(block).toContain("never announce");
  });
});

describe("ruh hali seçicisi", () => {
  test("bilinmeyen anahtarlar düşer", () => {
    expect(normalizeVibe({ mood: "cozy", length: "epic", company: 5 })).toEqual({
      mood: "cozy",
      length: null,
      company: null,
    });
    expect(hasVibe({})).toBe(false);
    expect(hasVibe({ company: "family" })).toBe(true);
  });

  test("istek metni yalnız seçilenleri içerir", () => {
    const prompt = buildVibePrompt({ mood: "funny", company: "partner" });
    expect(prompt).toContain("Mood: light and genuinely funny");
    expect(prompt).toContain("partner");
    expect(prompt).not.toContain("Length:");
  });

  test("yalnız 'kısa' süre yerel üst sınır getirir", () => {
    expect(maxRuntimeForVibe({ length: "short" })).toBe(100);
    expect(maxRuntimeForVibe({ length: "long" })).toBeNull();
    expect(maxRuntimeForVibe(null)).toBeNull();
  });
});

describe("tekrar öneri engeli", () => {
  const assistant = (response, extra) => ({ role: "assistant", aiResponse: response, ...extra });

  test("önerilen başlıklar sırayla, tekrarsız toplanır", () => {
    const messages = [
      { role: "user", text: "öner" },
      assistant({ type: "recommendations", items: [movie("Arrival"), tv("Dark")] }),
      assistant({ type: "watchlist", sections: [{ items: [movie("Arrival"), movie("Heat")] }] }),
    ];
    expect(collectSuggestedTitles(messages)).toEqual(["Arrival", "Dark", "Heat"]);
  });

  test("hata, karşılaştırma ve spotlight sayılmaz", () => {
    const messages = [
      assistant({ type: "recommendations", items: [movie("A")] }, { status: "error" }),
      assistant({ type: "comparison", left: movie("B"), right: movie("C") }),
      assistant({ type: "title_spotlight", title: "D", mediaType: "movie" }),
    ];
    expect(collectSuggestedTitles(messages)).toEqual([]);
  });

  test("sınır en yeni başlıkları tutar", () => {
    const items = Array.from({ length: 10 }, (_, i) => movie(`T${i}`));
    const out = collectSuggestedTitles([assistant({ type: "recommendations", items })], 3);
    expect(out).toEqual(["T7", "T8", "T9"]);
  });

  test("boş liste boş blok verir; dolu liste adlandırılmış yapımları muaf tutar", () => {
    expect(buildAvoidBlock([])).toBe("");
    expect(buildAvoidBlock(["Arrival", "  ", "Dark"])).toContain("Arrival; Dark");
    expect(buildAvoidBlock(["Arrival"])).toContain("name a specific title are exempt");
  });
});

describe("zevk uyumu", () => {
  test("dayanak yoksa null döner (uydurma sayı yok)", () => {
    expect(computeMatchScore({ found: false }, ["Drama"])).toBeNull();
    expect(computeMatchScore({ found: true, genres: [] }, ["Drama"])).toBeNull();
    expect(computeMatchScore({ found: true, genres: ["Drama"] }, [])).toBeNull();
  });

  test("tür örtüşmesi puanı belirler, Türkçe ve birleşik adlar eşleşir", () => {
    const overlapping = computeMatchScore(
      { found: true, genres: ["Bilim Kurgu", "Dram"], rating: 8 },
      ["Sci-Fi & Fantasy", "Drama"],
    );
    const unrelated = computeMatchScore({ found: true, genres: ["Horror"], rating: 8 }, ["Comedy", "Romance"]);
    expect(overlapping).toBeGreaterThan(unrelated);
    expect(overlapping).toBeLessThanOrEqual(98);
    expect(unrelated).toBeGreaterThanOrEqual(30);
  });

  test("puan rozet düzeylerine ayrılır", () => {
    expect(matchLevel(null)).toBe("none");
    expect(matchLevel(59)).toBe("none");
    expect(matchLevel(60)).toBe("fair");
    expect(matchLevel(72)).toBe("good");
    expect(matchLevel(85)).toBe("high");
  });
});

describe("keşif filtresi doğrulaması", () => {
  const recs = (...items) => ({ type: "recommendations", items });

  test("filtre yoksa yalnız sayı sınırı uygulanır", () => {
    const response = recs(movie("A"), movie("B"), movie("C"));
    const { response: out, report } = applyDiscoveryFilters(response, {}, { maxItems: 2 });
    expect(out.items.map((i) => i.title)).toEqual(["A", "B"]);
    expect(report).toEqual({ removed: 0, relaxed: false, trimmed: 1 });
  });

  test("içerik türü uymayan elenir", () => {
    const response = recs(movie("A"), tv("B"));
    const { response: out, report } = applyDiscoveryFilters(response, {}, { mediaType: "movie" });
    expect(out.items.map((i) => i.title)).toEqual(["A"]);
    expect(report.removed).toBe(1);
  });

  test("doğrulananlar önde, doğrulanamayanlar arkada; uyuşmayan elenir", () => {
    const posterMap = {
      ...card("movie", "Match", { providers: ["Netflix"], genres: ["Comedy"] }),
      ...card("movie", "Wrong", { providers: ["Disney Plus"], genres: ["Comedy"] }),
      ...card("movie", "Unknown", { providers: [], genres: [] }),
    };
    const response = recs(movie("Unknown"), movie("Wrong"), movie("Match"));
    const { response: out, report } = applyDiscoveryFilters(response, posterMap, {
      providers: ["Netflix"],
      genres: ["Comedy"],
    });
    expect(out.items.map((i) => i.title)).toEqual(["Match", "Unknown"]);
    expect(report).toMatchObject({ removed: 1, relaxed: false });
  });

  test("hepsi elenirse boş kart yerine orijinal korunur ve 'gevşetildi' denir", () => {
    const posterMap = card("movie", "Wrong", { providers: ["Disney Plus"] });
    const response = recs(movie("Wrong"));
    const { response: out, report } = applyDiscoveryFilters(response, posterMap, { providers: ["Netflix"] });
    expect(out.items).toHaveLength(1);
    expect(report).toMatchObject({ removed: 0, relaxed: true });
  });

  test("kısa süre filtresi uzun filmi eler, diziye ve süresi bilinmeyene dokunmaz", () => {
    const posterMap = {
      ...card("movie", "Long", { runtimeMinutes: 170 }),
      ...card("movie", "Short", { runtimeMinutes: 88 }),
      ...card("movie", "Mystery", { runtimeMinutes: 0 }),
    };
    const response = recs(movie("Long"), movie("Mystery"), movie("Short"), tv("Series"));
    const { response: out } = applyDiscoveryFilters(response, posterMap, { maxRuntime: 100 });
    // doğrulananlar (Short, Series) önde, süresi bilinmeyen (Mystery) arkada
    expect(out.items.map((i) => i.title)).toEqual(["Short", "Series", "Mystery"]);
  });

  test("izleme listesi bölümlerinde süzer, boşalan bölümü atar", () => {
    const posterMap = card("movie", "Wrong", { providers: ["Disney Plus"] });
    const response = {
      type: "watchlist",
      sections: [
        { key: "a", items: [movie("Wrong")] },
        { key: "b", items: [movie("Free")] },
      ],
    };
    const { response: out, report } = applyDiscoveryFilters(response, posterMap, { providers: ["Netflix"] });
    expect(out.sections.map((s) => s.key)).toEqual(["b"]);
    expect(report.removed).toBe(1);
  });

  test("diğer cevap türleri olduğu gibi döner", () => {
    const plan = { type: "watch_plan", sessions: [{ items: [movie("A")] }] };
    const { response: out, report } = applyDiscoveryFilters(plan, {}, { mediaType: "tv", maxItems: 1 });
    expect(out).toBe(plan);
    expect(report).toEqual({ removed: 0, relaxed: false, trimmed: 0 });
  });

  test("öğe sayacı türe göre sayar", () => {
    expect(countResponseItems({ type: "recommendations", items: [1, 2] })).toBe(2);
    expect(countResponseItems({ type: "watchlist", sections: [{ items: [1] }, { items: [1, 2] }] })).toBe(3);
    expect(countResponseItems({ type: "watch_plan", sessions: [{ items: [1] }] })).toBe(1);
    expect(countResponseItems({ type: "comparison" })).toBe(0);
    expect(countResponseItems(null)).toBe(0);
  });
});

describe("süre biçimi ve oturum süresi", () => {
  test("dakika sa/dk olarak yazılır", () => {
    expect(formatDuration(105, "tr")).toBe("1 sa 45 dk");
    expect(formatDuration(120, "en")).toBe("2 h");
    expect(formatDuration(45, "en")).toBe("45 m");
    expect(formatDuration(0)).toBe("");
    expect(formatDuration("x")).toBe("");
  });

  test("oturum süresi filmleri toplar, dizileri ayrı sayar", () => {
    const posterMap = {
      ...card("movie", "A", { runtimeMinutes: 100 }),
      ...card("movie", "B", { runtimeMinutes: 90 }),
    };
    const session = { items: [movie("A"), movie("B"), tv("Show"), movie("Bilinmeyen")] };
    expect(sessionRuntime(session, posterMap)).toEqual({ minutes: 190, movies: 2, series: 1 });
  });
});

describe("devam çipleri", () => {
  test("öneri cevabı farklı/seç/benzer/kısa çipleri verir ve sınırlanır", () => {
    const response = { type: "recommendations", items: [movie("Arrival"), movie("Dark")] };
    const chips = buildFollowUps(response, { language: "tr", limit: 3 });
    expect(chips).toHaveLength(3);
    expect(chips[0].label).toBe("Daha farklı öner");
    expect(new Set(chips.map((c) => c.id)).size).toBe(chips.length);
    chips.forEach((chip) => {
      expect(chip.prompt.length).toBeGreaterThan(10);
      expect(chip.icon).toBeTruthy();
    });
  });

  test("tek öneride 'hangisini izleyeyim' çipi çıkmaz", () => {
    const chips = buildFollowUps({ type: "recommendations", items: [movie("Arrival")] }, { language: "en", limit: 5 });
    expect(chips.map((c) => c.id)).not.toContain("recommendations:pick");
  });

  test("karşılaştırma iki yapımın adını isteğe koyar", () => {
    const chips = buildFollowUps(
      { type: "comparison", left: movie("Heat"), right: movie("Collateral") },
      { language: "en" },
    );
    expect(chips[0].prompt).toContain('"Heat"');
    expect(chips[0].prompt).toContain('"Collateral"');
  });

  test("spotlight benzer yapım varsa karşılaştırma çipi ekler", () => {
    const posterMap = card("movie", "Heat", { similar: [{ title: "Ronin" }] });
    const chips = buildFollowUps(
      { type: "title_spotlight", title: "Heat", mediaType: "movie" },
      { language: "en", limit: 5, posterMap },
    );
    expect(chips.map((c) => c.id)).toContain("title_spotlight:versus");
  });

  test("boş ya da bilinmeyen cevap çip vermez", () => {
    expect(buildFollowUps(null)).toEqual([]);
    expect(buildFollowUps({ type: "recommendations", items: [] })).toEqual([]);
    expect(buildFollowUps({ type: "watch_plan", sessions: [] })).toEqual([]);
    expect(buildFollowUps({ type: "nonsense" })).toEqual([]);
  });
});

describe("liste eylemleri ve paylaşım", () => {
  const posterMap = {
    ...card("movie", "Heat", { id: 949, posterPath: "/h.jpg", year: "1995", rating: 8.2 }),
    [posterKey("tv", "Dark")]: { found: false },
  };
  const response = { type: "recommendations", items: [movie("Heat"), tv("Dark"), movie("Heat")] };

  test("yalnız bulunmuş başlıklar, tekrarsız toplanır", () => {
    expect(collectLibraryItems(response, posterMap)).toEqual([
      { id: 949, type: "movie", name: "Heat", imagePath: "/h.jpg" },
    ]);
  });

  test("paylaşım metni numaralı liste verir; bulunamayan ad aynen kalır", () => {
    const text = buildShareText(response, posterMap, { language: "tr", appName: "Seelogd" });
    expect(text.split("\n")[0]).toBe("Seelogd · CineMatch önerileri");
    expect(text).toContain("1. Heat (1995) ★8.2");
    expect(text).toContain("Dark");
    expect(buildShareText({ type: "general", content: "x" }, {})).toBe("");
  });
});

describe("detay ekranından gelen yapım kartı", () => {
  const target = {
    mediaType: "movie",
    id: 949,
    title: "Heat",
    year: "1995",
    posterPath: "/p.jpg",
    rating: 8.2,
    genres: ["Crime"],
  };

  test("ataçtaki alanlar yetkilidir, aynı kayıtsa eksikler çözülen karttan tamamlanır", () => {
    const resolved = {
      found: true,
      id: 949,
      posterPath: "/other.jpg",
      backdropPath: "/b.jpg",
      tagline: "A Los Angeles crime saga",
      runtimeMinutes: 170,
      similar: [{ title: "Ronin" }],
      genres: ["Thriller"],
    };
    const built = buildTargetCard(target, resolved);
    expect(built.posterPath).toBe("/p.jpg");
    expect(built.genres).toEqual(["Crime"]);
    expect(built.backdropPath).toBe("/b.jpg");
    expect(built.tagline).toBe("A Los Angeles crime saga");
    expect(built.runtimeMinutes).toBe(170);
    expect(built.similar).toEqual([{ title: "Ronin" }]);
    expect(built.found).toBe(true);
  });

  test("farklı bir kayıtla eşleşmişse çözülen karttan hiçbir alan alınmaz", () => {
    const resolved = { found: true, id: 1, backdropPath: "/x.jpg", tagline: "yanlış", similar: [{ title: "X" }] };
    const built = buildTargetCard(target, resolved);
    expect(built.backdropPath).toBeNull();
    expect(built.tagline).toBe("");
    expect(built.similar).toEqual([]);
  });

  test("çözülen kart yoksa ataçla tek başına kurulur", () => {
    const built = buildTargetCard({ ...target, runtimeMinutes: 170, backdropPath: "/a.jpg" }, undefined);
    expect(built.key).toBe("movie-949");
    expect(built.runtimeMinutes).toBe(170);
    expect(built.backdropPath).toBe("/a.jpg");
  });
});

describe("geçmiş", () => {
  const now = new Date(2026, 9, 15, 12).getTime();
  const hour = 3600 * 1000;
  const posterMap = card("movie", "Heat", { posterPath: "/h.jpg" });
  const conversation = (id, title, updatedAt, messages = []) => ({ id, title, updatedAt, messages });

  test("önizleme son soruyu ve son cevabın posterlerini verir", () => {
    const preview = conversationPreview(
      conversation("1", "t", now, [
        { role: "user", display: "ilk" },
        { role: "assistant", aiResponse: { type: "recommendations", items: [movie("Heat")] }, posterMap },
        { role: "user", text: "son soru" },
      ]),
    );
    expect(preview).toEqual({ lastUser: "son soru", posters: ["/h.jpg"] });
  });

  test("arama aksan ve büyük/küçük harf duyarsızdır, önerilen başlıklara da bakar", () => {
    const list = [
      conversation("1", "Gerilim önerileri", now),
      conversation("2", "Şaşırtıcı", now, [
        { role: "assistant", aiResponse: { type: "recommendations", items: [movie("Amélie")] }, posterMap: {} },
      ]),
    ];
    expect(filterConversations(list, "gerilim").map((c) => c.id)).toEqual(["1"]);
    expect(filterConversations(list, "SASIRTICI").map((c) => c.id)).toEqual(["2"]);
    expect(filterConversations(list, "amelie").map((c) => c.id)).toEqual(["2"]);
    expect(filterConversations(list, "  ")).toHaveLength(2);
    expect(filterConversations(null, "x")).toEqual([]);
  });

  test("görece zaman kısa biçimde yazılır", () => {
    expect(formatRelativeTime(now - 20 * 1000, "tr", now)).toBe("•");
    expect(formatRelativeTime(now - 5 * 60000, "tr", now)).toBe("5 dk");
    expect(formatRelativeTime(now - 3 * hour, "en", now)).toBe("3 h");
    expect(formatRelativeTime(now - 30 * hour, "tr", now)).toBe("dün");
    expect(formatRelativeTime(now - 72 * hour, "en", now)).toBe("3 d");
    expect(formatRelativeTime(0, "tr", now)).toBe("");
    expect(formatRelativeTime("x", "tr", now)).toBe("");
  });

  test("gruplama bugün/dün/hafta/eski sırasında, boş grup atılır", () => {
    expect(recencyBucket(now - hour, now)).toBe("today");
    expect(recencyBucket(now - 18 * hour, now)).toBe("yesterday");
    expect(recencyBucket(now - 4 * 24 * hour, now)).toBe("week");
    expect(recencyBucket(now - 20 * 24 * hour, now)).toBe("earlier");
    expect(recencyBucket(undefined, now)).toBe("earlier");

    const groups = groupConversationsByRecency(
      [conversation("a", "a", now - 20 * 24 * hour), conversation("b", "b", now - hour)],
      now,
    );
    expect(groups.map((g) => g.bucket)).toEqual(["today", "earlier"]);
  });
});

describe("kota ölçeri", () => {
  const limits = { daily: 3, monthly: 30 };

  test("kullanım sunucudan gelmediyse plan sınırlarıyla başlar", () => {
    const meter = quotaMeter(null, limits);
    expect(meter).toMatchObject({ dailyLimit: 3, dailyLeft: 3, left: 3, level: "ok", ratio: 0 });
  });

  test("az kalınca 'low', bitince 'empty'", () => {
    expect(quotaMeter({ daily: { used: 2, limit: 3 }, monthly: { used: 5, limit: 30 } }, limits).level).toBe("low");
    const empty = quotaMeter({ daily: { used: 3, limit: 3 }, monthly: { used: 5, limit: 30 } }, limits);
    expect(empty.level).toBe("empty");
    expect(empty.left).toBe(0);
  });

  test("aylık hak günlükten önce biterse kalan hak aylığa göre", () => {
    const meter = quotaMeter({ daily: { used: 0, limit: 20 }, monthly: { used: 299, limit: 300 } }, limits);
    expect(meter.left).toBe(1);
  });

  test("kullanım negatif ya da sınır aşılmış olsa da oran 0–1 arasında kalır", () => {
    expect(quotaMeter({ daily: { used: -4, limit: 3 } }, limits).dailyUsed).toBe(0);
    expect(quotaMeter({ daily: { used: 9, limit: 3 } }, limits).ratio).toBe(1);
  });

  test("sınırı bilinmeyen plan boş uyarı vermez", () => {
    expect(quotaMeter(null, null).level).toBe("ok");
  });
});
