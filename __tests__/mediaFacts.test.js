import {
  applyFacts,
  describeMediaMeta,
  extractMediaFacts,
  factsKey,
  factsUrl,
  formatMinutes,
  langOf,
  mediaMinutes,
  mediaSignature,
  mergeFactsIntoList,
  needsFacts,
  pickFactTargets,
  sumListMinutes,
  todayListDate,
} from "../utils/mediaFacts";

describe("TMDB detayından olgu çıkarma", () => {
  test("film: runtime dakikaya, dizi alanları null", () => {
    const facts = extractMediaFacts({ id: 550, title: "Film", runtime: 136 }, "movie");
    expect(facts).toMatchObject({
      id: 550,
      type: "movie",
      minutes: 136,
      episodeMinutes: null,
      episodeCount: null,
      seasonCount: null,
    });
  });

  test("film: runtime 0 ise minutes null (0 değil)", () => {
    expect(extractMediaFacts({ id: 1, runtime: 0 }, "movie").minutes).toBeNull();
    expect(extractMediaFacts({ id: 1 }, "movie").minutes).toBeNull();
  });

  test("dizi: episode_run_time içindeki İLK POZİTİF değer alınır", () => {
    const facts = extractMediaFacts(
      { id: 1399, name: "Dizi", episode_run_time: [0, 45], number_of_episodes: 73, number_of_seasons: 8 },
      "tv",
    );
    expect(facts).toMatchObject({
      episodeMinutes: 45,
      episodeCount: 73,
      seasonCount: 8,
      minutes: null,
    });
  });

  test("dizi: episode_run_time boşsa son bölümün süresine düşer", () => {
    expect(
      extractMediaFacts(
        { id: 2, episode_run_time: [], last_episode_to_air: { runtime: 52 } },
        "tv",
      ).episodeMinutes,
    ).toBe(52);
    expect(extractMediaFacts({ id: 2 }, "tv").episodeMinutes).toBeNull();
  });

  test("dizide minutes DAİMA null — toplam izleme süresi şişmesin", () => {
    expect(extractMediaFacts({ id: 3, runtime: 45 }, "tv").minutes).toBeNull();
  });

  test("tür adları çıkarılır, geçersiz olanlar elenir", () => {
    expect(
      extractMediaFacts(
        { id: 4, genres: [{ name: "Dram" }, { name: "  " }, { id: 9 }, "Suç", { name: "Suç" }] },
        "movie",
      ).genres,
    ).toEqual(["Dram", "Suç"]);
  });

  test("bozuk girdi çökmez, null döner", () => {
    expect(extractMediaFacts(null, "movie")).toBeNull();
    expect(extractMediaFacts(undefined, "tv")).toBeNull();
    expect(extractMediaFacts({}, "movie")).toBeNull();
  });
});

describe("istek URL'i", () => {
  test("append_to_response EKLENMEZ — gövde şişmesin", () => {
    const url = factsUrl({ id: 550, mediaType: "movie", language: "tr" });
    expect(url).toBe("https://api.themoviedb.org/3/movie/550?language=tr-TR");
    expect(url).not.toContain("append_to_response");
  });

  test("dil eşlemesi", () => {
    expect(langOf("tr")).toBe("tr-TR");
    expect(langOf("tr-TR")).toBe("tr-TR");
    expect(langOf("en")).toBe("en-US");
    expect(langOf(undefined)).toBe("en-US");
  });

  test("anahtar tip ve id'yi birlikte tutar", () => {
    expect(factsKey({ id: 5, media_type: "tv" })).toBe("tv:5");
    expect(factsKey({ id: 5, type: "movie" })).toBe("movie:5");
    expect(factsKey(5, "tv")).toBe("tv:5");
  });
});

describe("hangi öğe için istek gerekli", () => {
  test("süresi ve türü dolu film istek DOĞURMAZ", () => {
    expect(needsFacts({ id: 1, type: "movie", minutes: 136, genres: ["Dram"] })).toBe(false);
  });

  test("ham arama sonucu (tür id'si var, süre yok) istek doğurur", () => {
    expect(needsFacts({ id: 1, media_type: "movie", genre_ids: [18] })).toBe(true);
  });

  test("bölüm süresi dolu dizi istek doğurmaz", () => {
    expect(needsFacts({ id: 2, type: "tv", episodeMinutes: 45, genres: ["Dram"] })).toBe(false);
  });

  test("bir kez çözülmüş öğe (factsAt) bir daha sorulmaz", () => {
    expect(needsFacts({ id: 3, type: "movie", factsAt: 1700000000000 })).toBe(false);
  });

  test("kimliksiz/boş girdi istek doğurmaz", () => {
    expect(needsFacts(null)).toBe(false);
    expect(needsFacts({ type: "movie" })).toBe(false);
  });

  test("hedefler tekilleşir, aynı id'li film ve dizi AYRI kalır", () => {
    const targets = pickFactTargets([
      { id: 7, media_type: "movie" },
      { id: 7, media_type: "tv" },
      { id: 7, media_type: "movie" },
    ]);
    expect(targets).toEqual([
      { id: 7, type: "movie" },
      { id: 7, type: "tv" },
    ]);
  });

  test("limit kırpması sırayı korur", () => {
    const list = [1, 2, 3, 4, 5].map((id) => ({ id, media_type: "movie" }));
    expect(pickFactTargets(list, { limit: 2 }).map((t) => t.id)).toEqual([1, 2]);
  });
});

describe("olguları listeye işleme", () => {
  const facts = { id: 1, type: "movie", minutes: 120, genres: ["Dram"], resolvedAt: 999 };

  test("eşleşen öğe zenginleşir, eşleşmeyen fact yok sayılır", () => {
    const list = [{ id: 1, media_type: "movie" }, { id: 2, media_type: "movie" }];
    const next = mergeFactsIntoList(list, [facts, { id: 99, type: "tv", minutes: 5 }]);
    expect(next[0]).toMatchObject({ minutes: 120, genres: ["Dram"], factsAt: 999 });
    expect(next[1]).toBe(list[1]);
  });

  test("hidrasyon sırasında SİLİNEN öğe geri gelmez, sıra korunur", () => {
    const shrunk = [{ id: 2, media_type: "movie" }, { id: 1, media_type: "movie" }];
    const next = mergeFactsIntoList(shrunk, [facts]);
    expect(next.map((m) => m.id)).toEqual([2, 1]);
    expect(next).toHaveLength(2);
  });

  test("hiçbir şey değişmediyse AYNI dizi referansı döner", () => {
    const list = [{ id: 1, media_type: "movie", minutes: 120, genres: ["Dram"], factsAt: 999 }];
    expect(mergeFactsIntoList(list, [facts])).toBe(list);
    expect(mergeFactsIntoList(list, null)).toBe(list);
    expect(mergeFactsIntoList(list, [])).toBe(list);
  });

  test("mevcut DOLU değeri null olgu EZMEZ", () => {
    const media = { id: 1, media_type: "movie", minutes: 136, genres: ["Suç"] };
    const applied = applyFacts(media, { id: 1, type: "movie", minutes: null, genres: [], resolvedAt: 5 });
    expect(applied.minutes).toBe(136);
    expect(applied.genres).toEqual(["Suç"]);
  });

  test("Map girdisi de kabul edilir", () => {
    const map = new Map([["movie:1", facts]]);
    expect(mergeFactsIntoList([{ id: 1, media_type: "movie" }], map)[0].minutes).toBe(120);
  });
});

describe("süre hesabı ve biçimi", () => {
  test("film süresi doğrudan, dizi süresi bölüm × sayı", () => {
    expect(mediaMinutes({ type: "movie", minutes: 136 })).toBe(136);
    expect(mediaMinutes({ type: "tv", episodeMinutes: 45, episodeCount: 62 })).toBe(2790);
    expect(mediaMinutes({ type: "tv", totalMinutes: 100, episodeMinutes: 45, episodeCount: 62 })).toBe(100);
  });

  test("bilinmeyen süre null döner — '0 dk' yazdırmak imkânsız", () => {
    expect(mediaMinutes({ type: "movie" })).toBeNull();
    expect(mediaMinutes({ type: "tv", episodeMinutes: 45 })).toBeNull();
    expect(mediaMinutes(null)).toBeNull();
  });

  test("karışık (eski + yeni) listede NaN üretmez", () => {
    const totals = sumListMinutes([
      { type: "movie", minutes: 100 },
      { type: "movie" },
      { type: "tv", episodeMinutes: 45, episodeCount: 2 },
      null,
    ]);
    expect(totals).toEqual({ total: 190, known: 2, unknown: 2 });
    expect(Number.isNaN(totals.total)).toBe(false);
    expect(sumListMinutes([])).toEqual({ total: 0, known: 0, unknown: 0 });
    expect(sumListMinutes(undefined).known).toBe(0);
  });

  test("dakika biçimi", () => {
    expect(formatMinutes(45)).toBe("45 dk");
    expect(formatMinutes(60)).toBe("1 sa");
    expect(formatMinutes(128)).toBe("2 sa 8 dk");
    expect(formatMinutes(90, { hourLabel: "h", minuteLabel: "min" })).toBe("1 h 30 min");
  });

  test("geçersiz dakika null — bileşen hiç çizilmesin", () => {
    [0, -5, null, undefined, NaN, "abc"].forEach((value) => {
      expect(formatMinutes(value)).toBeNull();
    });
  });

  test("poster üstü kısa bilgi", () => {
    expect(describeMediaMeta({ type: "movie", minutes: 128 })).toBe("2 sa 8 dk");
    expect(describeMediaMeta({ type: "tv", seasonCount: 5, episodeCount: 62 })).toBe("5 sezon · 62 bölüm");
    expect(describeMediaMeta({ type: "tv", episodeMinutes: 45 })).toBe("45 dk/bölüm");
    expect(describeMediaMeta({ type: "tv" })).toBeNull();
    expect(describeMediaMeta(null)).toBeNull();
  });
});

describe("kimlik imzası ve tarih", () => {
  test("olgular eklenince imza DEĞİŞMEZ, kimlik değişince değişir", () => {
    const before = [{ id: 1, media_type: "movie" }, { id: 2, media_type: "tv" }];
    const after = [{ id: 1, media_type: "movie", minutes: 120, factsAt: 5 }, { id: 2, media_type: "tv" }];
    expect(mediaSignature(after)).toBe(mediaSignature(before));
    expect(mediaSignature([{ id: 3, media_type: "movie" }])).not.toBe(mediaSignature(before));
  });

  test("liste tarihi YYYY-MM-DD (tek haneler sıfırla dolar)", () => {
    expect(todayListDate(new Date(2026, 0, 5, 13, 0, 0))).toBe("2026-01-05");
    expect(todayListDate(new Date(2026, 11, 31, 23, 0, 0))).toBe("2026-12-31");
  });
});
