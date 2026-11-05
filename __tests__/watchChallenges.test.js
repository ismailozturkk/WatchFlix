// __tests__/watchChallenges.test.js — Meydan Okumalar saf çekirdeği (utils/watchChallenges.js).

import {
  CHALLENGES,
  CHALLENGE_DECADES,
  CHALLENGE_GROUPS,
  MAX_ACTIVE_CHALLENGES,
  RUN_STATUS,
  activeRuns,
  addDays,
  catalogGroups,
  challengeProgress,
  completedRuns,
  daysLeftOf,
  getChallenge,
  joinBlocker,
  joinChallenge,
  leaveChallenge,
  normalizeChallengeState,
  paceOf,
  settleChallenges,
  toStoredChallengeState,
  windowOf,
} from "../utils/watchChallenges";
import { CHALLENGE_FILMOGRAPHIES } from "../data/challengeFilmographies";

const film = (id, dateAdded, extra = {}) => ({ id, type: "movie", name: `F${id}`, dateAdded, ...extra });
const episode = (showId, s, e, at) => ({ showId, showName: `S${showId}`, seasonNumber: s, episodeNumber: e, episodeWatchTime: at });
const empty = { runs: [] };

describe("katalog", () => {
  it("kimlikler eşsiz ve her görevin hedefi, penceresi, kuralı var", () => {
    const ids = CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHALLENGES) {
      expect(c.target).toBeGreaterThan(0);
      expect(["rolling", "month", "open"]).toContain(c.window.type);
      expect(c.rule.kind).toBeTruthy();
      expect(c.colors).toHaveLength(2);
    }
  });

  it("kişi görevleri üretilmiş filmografiden gelir, hedef = film sayısı, kimlik role göre", () => {
    for (const person of CHALLENGE_FILMOGRAPHIES) {
      const role = person.role === "actor" ? "actor" : "director";
      const c = getChallenge(`${role}_${person.id}`);
      expect(c.target).toBe(person.films.length);
      expect(c.window.type).toBe("open");
      expect(c.group).toBe(role === "actor" ? "actors" : "directors");
      expect(c.person).toMatchObject({ id: person.id, name: person.name, role, tr: !!person.tr, capped: !!person.capped });
      expect(person.films.length).toBeGreaterThanOrEqual(3);
      expect(person.films.length).toBeLessThanOrEqual(40);
      expect(new Set(person.films.map((f) => f.id)).size).toBe(person.films.length);
    }
  });

  it("katalog genişledi: her ayın görevi, Türk sineması kişileri, istenen yönetmen ve oyuncular", () => {
    const months = CHALLENGES.filter((c) => c.window.type === "month").map((c) => c.window.month);
    expect([...months].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const names = CHALLENGE_FILMOGRAPHIES.map((p) => `${p.role}:${p.name}`);
    expect(names).toEqual(expect.arrayContaining(["director:Zeki Demirkubuz", "actor:Aamir Khan", "director:Christopher Nolan"]));
    expect(CHALLENGE_FILMOGRAPHIES.filter((p) => p.tr).length).toBeGreaterThanOrEqual(10);
    for (const group of CHALLENGE_GROUPS) expect(CHALLENGES.some((c) => c.group === group)).toBe(true);
  });

  it("kayıtlı eski yönetmen görevleri kimliğini korur (Nolan, Ceylan)", () => {
    expect(getChallenge("director_525")).toBeTruthy();
    expect(getChallenge("director_56214")).toBeTruthy();
  });

  it("antoloji / yeniden kurgu dışlanmış (Four Rooms, Grindhouse, Tokyo!)", () => {
    const all = CHALLENGE_FILMOGRAPHIES.flatMap((p) => p.films.map((f) => f.id));
    for (const id of [5, 285923, 414419, 284582, 8938]) expect(all).not.toContain(id);
  });
});

describe("pencere", () => {
  it("rolling: katılım günü + gün sayısı (dahil)", () => {
    expect(windowOf(getChallenge("films10_30"), "2026-10-30")).toEqual({ start: "2026-10-30", end: "2026-11-28" });
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("month: katılım yılının o ayının tamamı", () => {
    expect(windowOf(getChallenge("oct_horror"), "2026-10-20")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(windowOf(getChallenge("feb_romance"), "2028-02-03").end).toBe("2028-02-29");
  });

  it("kalan gün bugün dahil; geçmişte 0", () => {
    const c = getChallenge("oct_horror");
    expect(daysLeftOf(c, "2026-10-01", "2026-10-31")).toBe(1);
    expect(daysLeftOf(c, "2026-10-01", "2026-11-02")).toBe(0);
    expect(daysLeftOf(getChallenge("director_525"), "2026-10-01", "2026-11-02")).toBeNull();
  });
});

describe("ilerleme", () => {
  it("films: katılmadan önceki izleme sayılmaz, tekrar izleme bir sayılır", () => {
    const movies = [film(1, "2026-10-29"), film(2, "2026-10-30"), film(2, "2026-11-02"), film(3, "2026-11-05T21:00:00")];
    const p = challengeProgress(getChallenge("films10_30"), "2026-10-30", { movies });
    expect(p.count).toBe(2);
    expect(p.matches.map((m) => m.id)).toEqual([2, 3]);
  });

  it("genre: saklı ad dilden bağımsız kanonik türe çevrilir", () => {
    const movies = [
      film(1, "2026-10-02", { genres: ["Korku"] }),
      film(2, "2026-10-03", { genres: ["Horror", "Thriller"] }),
      film(3, "2026-10-04", { genres: ["Komedi"] }),
      film(4, "2026-09-30", { genres: ["Korku"] }),
    ];
    const p = challengeProgress(getChallenge("oct_horror"), "2026-10-20", { movies });
    expect(p.count).toBe(2); // ayın başındakiler katılımdan önce olsa da sayılır; Eylül sayılmaz
  });

  it("genres: farklı tür sayısı, 'other' sayılmaz", () => {
    const movies = [
      film(1, "2026-10-30", { genres: ["Dram", "Drama"] }),
      film(2, "2026-10-31", { genres: ["Komedi", "Bilinmeyen Tür"] }),
    ];
    expect(challengeProgress(getChallenge("genres10"), "2026-10-30", { movies }).count).toBe(2);
  });

  it("long: süre eşiği", () => {
    const movies = [film(1, "2026-10-30", { minutes: 150 }), film(2, "2026-10-30", { minutes: 149 })];
    expect(challengeProgress(getChallenge("long5"), "2026-10-30", { movies }).count).toBe(1);
  });

  it("episodes: farklı bölüm; dizi başına özet", () => {
    const episodes = [episode(7, 1, 1, "2026-10-30"), episode(7, 1, 1, "2026-11-01"), episode(7, 1, 2, "2026-10-31"), episode(8, 2, 1, "2026-10-30")];
    const p = challengeProgress(getChallenge("episodes100"), "2026-10-30", { episodes });
    expect(p.count).toBe(3);
    expect(p.matches[0]).toMatchObject({ id: 7, episodes: 2 });
  });

  it("decades: ayrıntısı olmayan film bekler, aralık dışı on yıl sayılmaz", () => {
    const movies = [film(1, "2026-10-30"), film(2, "2026-10-30"), film(3, "2026-10-31"), film(4, "2026-10-31")];
    const meta = { 1: { year: 1994 }, 2: { year: 1999 }, 3: { year: 1931 } };
    const p = challengeProgress(getChallenge("decades"), "2026-10-30", { movies, meta });
    expect(p.count).toBe(1);
    expect(p.pending).toEqual([4]);
    expect(p.slots).toHaveLength(CHALLENGE_DECADES.length);
    expect(p.slots.find((s) => s.decade === 1990).film.id).toBe(1);
  });

  it("countries: birincil ülke başına bir", () => {
    const movies = [film(1, "2026-10-30"), film(2, "2026-10-30"), film(3, "2026-10-30")];
    const meta = { 1: { country: "TR" }, 2: { country: "TR" }, 3: { country: "JP" } };
    expect(challengeProgress(getChallenge("countries10"), "2026-10-30", { movies, meta }).count).toBe(2);
  });

  it("director: tüm geçmiş sayılır, yuvalar filmografi sırasında", () => {
    const c = getChallenge("director_525");
    const first = c.films[0].id;
    const p = challengeProgress(c, "2026-10-30", { movies: [film(first, "2012-01-01"), film(999999999, "2026-10-30")] });
    expect(p.count).toBe(1);
    expect(p.slots[0]).toMatchObject({ id: first, watched: true, day: "2012-01-01" });
    expect(p.slots).toHaveLength(c.target);
  });

  it("tempo: ilk 3 günde yok, sonra beklenene göre", () => {
    const c = getChallenge("films10_30");
    expect(paceOf(c, "2026-10-30", 0, "2026-10-31")).toBeNull();
    expect(paceOf(c, "2026-10-01", 5, "2026-10-15")).toEqual({ expected: 5, ahead: true });
    expect(paceOf(c, "2026-10-01", 4, "2026-10-15").ahead).toBe(false);
  });
});

describe("yeni kural türleri", () => {
  const J = "2026-10-30";

  it("streak: art arda en uzun gün serisi; aynı gün iki film bir gün sayılır", () => {
    const movies = [
      film(1, "2026-10-30"),
      film(2, "2026-10-30"),
      film(3, "2026-10-31"),
      film(4, "2026-11-01"),
      film(5, "2026-11-03"),
      film(6, "2026-11-04"),
    ];
    const p = challengeProgress(getChallenge("streak7"), J, { movies });
    expect(p.count).toBe(3);
    expect(p.matches.map((m) => m.day)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(paceOf(getChallenge("streak7"), "2026-10-01", 1, "2026-10-20")).toBeNull();
  });

  it("sameDay: tek günde en çok film", () => {
    const movies = [film(1, "2026-10-30"), film(2, "2026-10-30"), film(3, "2026-11-01"), film(4, "2026-11-01"), film(5, "2026-11-01T22:00:00")];
    const p = challengeProgress(getChallenge("movie_day3"), J, { movies });
    expect(p.count).toBe(3);
    expect(p.matches.map((m) => m.id)).toEqual([3, 4, 5]);
  });

  it("short / epic: süre eşikleri; süresi bilinmeyen kısa sayılmaz", () => {
    const movies = [film(1, J, { minutes: 0 }), film(2, J, { minutes: 90 }), film(3, J, { minutes: 91 }), film(4, J, { minutes: 181 })];
    expect(challengeProgress(getChallenge("short10"), J, { movies }).count).toBe(1);
    expect(challengeProgress(getChallenge("epic3"), J, { movies }).count).toBe(1);
  });

  it("country: birincil ülke kümede; ayrıntısı olmayan bekler", () => {
    const movies = [film(1, J), film(2, J), film(3, J), film(4, J)];
    const meta = { 1: { country: "TR" }, 2: { country: "TR" }, 3: { country: "US" } };
    const p = challengeProgress(getChallenge("turkish10"), J, { movies, meta });
    expect(p.count).toBe(2);
    expect(p.pending).toEqual([4]);
    expect(p.matches[0].label).toBe("TR");
    expect(challengeProgress(getChallenge("latam5"), J, { movies, meta: { 1: { country: "MX" }, 2: { country: "AR" } } }).count).toBe(2);
  });

  it("countries within: bölgedeki FARKLI ülke sayısı", () => {
    const movies = [film(1, J), film(2, J), film(3, J), film(4, J)];
    const meta = { 1: { country: "FR" }, 2: { country: "FR" }, 3: { country: "DE" }, 4: { country: "US" } };
    expect(challengeProgress(getChallenge("europe6"), J, { movies, meta }).count).toBe(2);
    expect(challengeProgress(getChallenge("countries10"), J, { movies, meta }).count).toBe(3);
  });

  it("era / recent: yapım yılı sınırları (recent katılım yılından geriye)", () => {
    const movies = [film(1, J), film(2, J), film(3, J), film(4, J)];
    const meta = { 1: { year: 1969 }, 2: { year: 1970 }, 3: { year: 2025 }, 4: { year: 2024 } };
    expect(challengeProgress(getChallenge("classics5"), J, { movies, meta }).matches.map((m) => m.id)).toEqual([1]);
    expect(challengeProgress(getChallenge("recent10"), J, { movies, meta }).matches.map((m) => m.id)).toEqual([3]);
  });

  it("gems: yüksek puan + az oy (alt ve üst sınır)", () => {
    const movies = [film(1, J), film(2, J), film(3, J), film(4, J)];
    const meta = {
      1: { rating: 7.5, votes: 500 },
      2: { rating: 7.5, votes: 5000 },
      3: { rating: 7.0, votes: 500 },
      4: { rating: 8.1, votes: 10 },
    };
    expect(challengeProgress(getChallenge("gems5"), J, { movies, meta }).matches.map((m) => m.id)).toEqual([1]);
  });

  it("episodeDay: tek günde en çok farklı bölüm; shows: farklı dizi", () => {
    const episodes = [
      episode(7, 1, 1, "2026-10-30"),
      episode(7, 1, 2, "2026-10-30"),
      episode(7, 1, 3, "2026-10-30"),
      episode(7, 1, 4, "2026-11-01"),
      episode(8, 1, 1, "2026-11-01"),
      episode(8, 1, 2, "2026-11-01"),
      episode(9, 1, 1, "2026-11-01"),
      episode(9, 1, 1, "2026-11-02"), // tekrar izleme
    ];
    const day = challengeProgress(getChallenge("binge10"), J, { episodes });
    expect(day.count).toBe(4);
    expect(day.matches.map((m) => [m.id, m.episodes])).toEqual([[8, 2], [7, 1], [9, 1]]);
    expect(challengeProgress(getChallenge("shows5"), J, { episodes }).count).toBe(3);
    expect(challengeProgress(getChallenge("episodes30_7"), J, { episodes }).count).toBe(7);
  });

  it("oyuncu görevi: başrol filmografisi, tüm geçmiş sayılır", () => {
    const aamir = CHALLENGES.find((c) => c.person?.role === "actor" && c.person.name === "Aamir Khan");
    expect(aamir.id).toBe(`actor_${aamir.person.id}`);
    const p = challengeProgress(aamir, J, { movies: [film(aamir.films[0].id, "2010-01-01")] });
    expect(p.count).toBe(1);
    expect(p.slots).toHaveLength(aamir.target);
    expect(joinBlocker({ runs: [] }, aamir.id, J)).toBe("ok");
  });
});

describe("kayıt", () => {
  it("katıl / bırak; aynı göreve ikinci kez katılınmaz", () => {
    let s = joinChallenge(empty, "films52", "2026-10-30");
    expect(joinBlocker(s, "films52", "2026-10-30")).toBe("active");
    expect(joinChallenge(s, "films52", "2026-10-31")).toBe(s);
    s = leaveChallenge(s, "films52");
    expect(activeRuns(s)).toHaveLength(0);
  });

  it("en çok MAX_ACTIVE_CHALLENGES etkin görev", () => {
    let s = empty;
    const ids = CHALLENGES.filter((c) => c.window.type !== "month").map((c) => c.id);
    for (const id of ids.slice(0, MAX_ACTIVE_CHALLENGES)) s = joinChallenge(s, id, "2026-10-30");
    expect(joinBlocker(s, ids[MAX_ACTIVE_CHALLENGES], "2026-10-30")).toBe("full");
  });

  it("mevsimlik görev yalnız kendi ayında", () => {
    expect(joinBlocker(empty, "oct_horror", "2026-11-01")).toBe("season");
    expect(joinBlocker(empty, "oct_horror", "2026-10-01")).toBe("ok");
    const ids = catalogGroups(empty, "2026-11-01").flatMap((g) => g.items.map((i) => i.challenge.id));
    expect(ids).not.toContain("oct_horror");
  });

  it("settle: hedefe ulaşan tamamlanır, süresi geçen düşer, değişiklik yoksa aynı nesne", () => {
    let s = joinChallenge(empty, "films10_30", "2026-10-01");
    s = joinChallenge(s, "long5", "2026-10-01");
    const same = settleChallenges(s, () => ({ count: 0, target: 10, pending: [] }), "2026-10-05");
    expect(same.state).toBe(s);

    const done = settleChallenges(s, (c) => ({ count: c.id === "films10_30" ? 10 : 1, target: c.target, pending: [] }), "2026-10-20");
    expect(done.completed).toEqual(["films10_30"]);
    expect(completedRuns(done.state)[0]).toMatchObject({ id: "films10_30", endedAt: "2026-10-20", count: 10 });

    const late = settleChallenges(done.state, () => ({ count: 1, target: 5, pending: [] }), "2026-12-15");
    expect(late.expired).toEqual(["long5"]);
    expect(late.state.runs.find((r) => r.id === "long5")).toMatchObject({ status: RUN_STATUS.EXPIRED, endedAt: "2026-11-29" });
  });

  it("settle: ayrıntısı bekleyen film varken süre dolmuş sayılmaz", () => {
    const s = joinChallenge(empty, "decades", "2026-01-01");
    const r = settleChallenges(s, () => ({ count: 2, target: 8, pending: [5] }), "2026-12-01");
    expect(r.expired).toEqual([]);
  });

  it("yönetmen görevi bir kez bitince yeniden katılınmaz; maraton yeniden katılınır", () => {
    let s = joinChallenge(empty, "director_525", "2026-10-01");
    s = joinChallenge(s, "films10_30", "2026-10-01");
    s = settleChallenges(s, (c) => ({ count: c.target, target: c.target, pending: [] }), "2026-10-02").state;
    expect(joinBlocker(s, "director_525", "2026-10-03")).toBe("done");
    expect(joinBlocker(s, "films10_30", "2026-10-03")).toBe("ok");
  });

  it("normalize: bozuk kayıt, bilinmeyen görev ve ikinci etkin kopya düşer", () => {
    const s = normalizeChallengeState({
      runs: [
        { id: "films52", joinedAt: "2026-10-30", status: "active" },
        { id: "films52", joinedAt: "2026-10-31", status: "active" },
        { id: "yok", joinedAt: "2026-10-30" },
        { id: "long5", joinedAt: "30.10.2026" },
        null,
        { id: "long5", joinedAt: "2026-01-01", status: "done", endedAt: "2026-02-01", count: 5.7, target: 5 },
      ],
    });
    expect(s.runs).toEqual([
      { id: "films52", joinedAt: "2026-10-30", status: "active" },
      { id: "long5", joinedAt: "2026-01-01", status: "done", endedAt: "2026-02-01", count: 5, target: 5 },
    ]);
    expect(normalizeChallengeState(null)).toEqual({ runs: [] });
    expect(toStoredChallengeState({ runs: [] })).toBeNull();
  });
});

describe("metin ve film ayrıntısı", () => {
  const { WATCH_CHALLENGES_COPY, getWatchChallengesCopy } = require("../utils/watchChallengesCopy");
  const { flagOf } = require("../utils/watchChallenges");

  it("her görevin her dilde adı, açıklaması ve pencere cümlesi var", () => {
    for (const language of Object.keys(WATCH_CHALLENGES_COPY)) {
      const copy = getWatchChallengesCopy(language);
      for (const c of CHALLENGES) {
        expect([language, c.id, copy.titleOf(c)]).toEqual([language, c.id, expect.stringMatching(/\S/)]);
        expect(copy.descOf(c)).toMatch(/\S/);
        expect(copy.windowOf(c)).toMatch(/\S/);
      }
      for (const group of CHALLENGE_GROUPS) {
        expect(copy.groups[group]).toMatch(/\S/);
        expect(copy.groupSubs[group]).toMatch(/\S/);
      }
    }
  });

  it("bayrak: ISO kodundan, geçersizde boş", () => {
    expect(flagOf("tr")).toBe("🇹🇷");
    expect(flagOf("XYZ")).toBe("");
    expect(flagOf(null)).toBe("");
  });

  it("film ayrıntısı: yıl + birincil ülke (origin_country, yoksa yapım ülkesi)", () => {
    jest.isolateModules(() => {
      jest.doMock("../services/favoriteRecommendations", () => ({ readTmdb: jest.fn() }));
      const { challengeMetaOf } = require("../services/watchChallengeMeta");
      expect(challengeMetaOf({ release_date: "1994-09-23", origin_country: ["US"], vote_average: 8.7, vote_count: 900 })).toEqual({
        year: 1994,
        country: "US",
        rating: 8.7,
        votes: 900,
      });
      expect(challengeMetaOf({ release_date: "", production_countries: [{ iso_3166_1: "JP" }] })).toEqual({
        year: null,
        country: "JP",
        rating: null,
        votes: null,
      });
      expect(challengeMetaOf(null)).toEqual({ year: null, country: null, rating: null, votes: null });
      const { localizedPersonTitles } = require("../services/watchChallengeMeta");
      const credits = {
        crew: [
          { id: 1, job: "Director", title: "Yedi Samuray", original_title: "七人の侍", original_language: "ja" },
          { id: 2, job: "Director", title: "一番美しく", original_title: "一番美しく", original_language: "ja" },
          { id: 3, job: "Director", title: "Kasaba", original_title: "Kasaba", original_language: "tr" },
          { id: 4, job: "Writer", title: "Başka", original_title: "Other", original_language: "en" },
        ],
      };
      // Çeviri var → çeviri; çeviri yok ve özgün dil başka → listede yok (İngilizce kalır); film o dilde → özgün ad.
      expect(localizedPersonTitles(credits, "tr")).toEqual({ 1: "Yedi Samuray", 3: "Kasaba" });
      // Oyuncuda kadro (cast) okunur, yönetmen kaydı (crew) değil.
      const cast = {
        cast: [{ id: 7, title: "Taare Zameen Par", original_title: "तारे ज़मीन पर", original_language: "hi" }],
        crew: [{ id: 8, job: "Director", title: "Başka", original_title: "Other", original_language: "en" }],
      };
      expect(localizedPersonTitles(cast, "tr", "actor")).toEqual({ 7: "Taare Zameen Par" });
    });
  });
});
