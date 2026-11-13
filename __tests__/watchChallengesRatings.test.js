// __tests__/watchChallengesRatings.test.js — Meydan Okumalar puan görevleri (başlangıç = katılış anındaki puanlar).

import {
  RUN_STATUS,
  activeRuns,
  challengeProgress,
  getChallenge,
  isRatingChallenge,
  joinChallenge,
  normalizeChallengeState,
  paceOf,
  ratedKeysOf,
  settleChallenges,
  toStoredChallengeState,
} from "../utils/watchChallenges";
import { WATCH_CHALLENGES_COPY } from "../utils/watchChallengesCopy";

const RATING_IDS = ["rate10_7", "rate25_30", "rate50_90", "rateShows5", "rateRange5"];
const empty = { runs: [] };
const progress = (id, ratings, run, titles = {}) =>
  challengeProgress(getChallenge(id), run?.joinedAt || "2026-11-01", { ratings, titles }, run);

describe("puan görevleri", () => {
  test("katalogda 5 puan görevi, hepsi puan türü", () => {
    for (const id of RATING_IDS) {
      expect(getChallenge(id)?.group).toBe("ratings");
      expect(isRatingChallenge(getChallenge(id))).toBe(true);
    }
    expect(isRatingChallenge(getChallenge("shows5"))).toBe(false);
  });

  test("ratedKeysOf: geçersiz anahtar ve 0/negatif puan sayılmaz", () => {
    expect(ratedKeysOf({ movie_2: 6, tv_1: 8, movie_3: 0, bozuk: 9, movie_x: 4, tv_4: -1 })).toEqual(["movie_2", "tv_1"]);
    expect(ratedKeysOf(null)).toEqual([]);
  });

  test("katılış başlangıcı yazar; puan haritası yoksa katılmaz", () => {
    expect(joinChallenge(empty, "rate10_7", "2026-11-01")).toBe(empty);
    const state = joinChallenge(empty, "rate10_7", "2026-11-01", { ratings: { movie_1: 8, tv_2: 6, movie_9: 0 } });
    expect(state.runs[0]).toEqual({ id: "rate10_7", joinedAt: "2026-11-01", status: RUN_STATUS.ACTIVE, baseline: ["movie_1", "tv_2"] });
    // Puanı olmayan kullanıcı da katılabilir (boş başlangıç).
    expect(joinChallenge(empty, "rate10_7", "2026-11-01", { ratings: {} }).runs[0].baseline).toEqual([]);
  });

  test("ilerleme yalnız YENİ puanlanan yapımlar; eski puanı değiştirmek sayılmaz", () => {
    const run = { id: "rate10_7", joinedAt: "2026-11-01", status: "active", baseline: ["movie_1", "tv_2"] };
    const now = { movie_1: 3, tv_2: 10, movie_5: 7, tv_6: 9 };
    const p = progress("rate10_7", now, run, { movie_5: { name: "Beş", imagePath: "/5.jpg" } });
    expect(p.count).toBe(2);
    expect(p.matches.map((m) => m.key)).toEqual(["movie_5", "tv_6"]);
    expect(p.matches[0]).toMatchObject({ type: "movie", id: 5, name: "Beş", imagePath: "/5.jpg" });
    expect(p.matches[1]).toMatchObject({ type: "tv", id: 6, name: "", imagePath: null });
  });

  test("dizi görevi yalnız dizi puanlarını sayar", () => {
    const run = { id: "rateShows5", joinedAt: "2026-11-01", status: "active", baseline: [] };
    expect(progress("rateShows5", { movie_1: 8, tv_2: 6, tv_3: 7 }, run).count).toBe(2);
  });

  test("ölçeğin tamamı: farklı kademe sayılır, aynı değer bir kez", () => {
    const run = { id: "rateRange5", joinedAt: "2026-11-01", status: "active", baseline: ["movie_9"] };
    const p = progress("rateRange5", { movie_1: 8, movie_2: 8, movie_3: 2, tv_4: 10, tv_5: 5, movie_9: 1 }, run);
    expect(p.count).toBe(4);
    expect(p.matches.map((m) => m.rating)).toEqual([2, 5, 8, 10]);
    expect(p.matches.find((m) => m.rating === 8).key).toBe("movie_1");
    // Tempo yok (kaç farklı değer gerektiği güne yayılmaz).
    expect(paceOf(getChallenge("rateRange5"), "2026-11-01", 1, "2026-11-10")).toBeNull();
  });

  test("önizleme (kayıt yok) 0 gösterir: bugün katılsan eski puanlar sayılmaz", () => {
    expect(progress("rate10_7", { movie_1: 8, tv_2: 6 }, null).count).toBe(0);
  });

  test("normalize: başlangıçsız etkin puan kaydı düşer; bitmiş kayıtta başlangıç tutulmaz", () => {
    const state = normalizeChallengeState({
      runs: [
        { id: "rate10_7", joinedAt: "2026-11-01", status: "active" },
        { id: "rate25_30", joinedAt: "2026-11-01", status: "active", baseline: ["movie_1", 5, "bozuk"] },
        { id: "rate50_90", joinedAt: "2026-08-01", status: "done", endedAt: "2026-09-01", count: 50, target: 50, baseline: ["movie_1"] },
      ],
    });
    expect(activeRuns(state).map((r) => r.id)).toEqual(["rate25_30"]);
    expect(activeRuns(state)[0].baseline).toEqual(["movie_1"]);
    const done = state.runs.find((r) => r.id === "rate50_90");
    expect(done.baseline).toBeUndefined();
    // Depoya yazıp geri okuyunca başlangıç korunur.
    const again = normalizeChallengeState(toStoredChallengeState(state));
    expect(activeRuns(again)[0].baseline).toEqual(["movie_1"]);
  });

  test("sonuçlandırma: kayıt progressOf'a geçer, tamamlanınca başlangıç silinir", () => {
    const state = joinChallenge(empty, "rate10_7", "2026-11-01", { ratings: { movie_1: 8 } });
    const ratings = { movie_1: 8 };
    for (let i = 2; i <= 11; i += 1) ratings[`movie_${i}`] = 6;
    const progressOf = (challenge, joinedAt, run) => challengeProgress(challenge, joinedAt, { ratings }, run);
    const result = settleChallenges(state, progressOf, "2026-11-03");
    expect(result.completed).toEqual(["rate10_7"]);
    expect(result.state.runs[0]).toEqual({ id: "rate10_7", joinedAt: "2026-11-01", status: "done", endedAt: "2026-11-03", count: 10, target: 10 });
  });

  test("süresi dolan puan görevi başlangıcını bırakır", () => {
    const state = joinChallenge(empty, "rate10_7", "2026-11-01", { ratings: {} });
    const progressOf = (challenge, joinedAt, run) => challengeProgress(challenge, joinedAt, { ratings: { movie_1: 5 } }, run);
    const result = settleChallenges(state, progressOf, "2026-11-20");
    expect(result.state.runs[0].status).toBe("expired");
    expect(result.state.runs[0].count).toBe(1);
    expect(result.state.runs[0].baseline).toBeUndefined();
  });

  test("6 dilde başlık + açıklama + grup metni", () => {
    for (const [lang, copy] of Object.entries(WATCH_CHALLENGES_COPY)) {
      expect([lang, typeof copy.groups.ratings]).toEqual([lang, "string"]);
      expect([lang, typeof copy.groupSubs.ratings]).toEqual([lang, "string"]);
      for (const id of RATING_IDS) {
        expect([lang, id, typeof copy.titles[id], typeof copy.descs[id]]).toEqual([lang, id, "string", "string"]);
      }
    }
  });
});

describe("eşleşme adımı → puan görevi", () => {
  const { stepChallengeId } = require("../utils/matchCopy");
  test("puan adımları gerçek görevlere gider; diğerleri yok", () => {
    expect(stepChallengeId("movie", { id: "diversify" })).toBe("rateRange5");
    expect(stepChallengeId("movie", { id: "rate", need: 4 })).toBe("rate10_7");
    expect(stepChallengeId("movie", { id: "twinRate", need: 30 })).toBe("rate25_30");
    expect(stepChallengeId("tv", { id: "rate", need: 30 })).toBe("rateShows5");
    expect(stepChallengeId("movie", { id: "watch", need: 3 })).toBeNull();
    for (const id of ["rateRange5", "rate10_7", "rate25_30", "rateShows5"]) expect(getChallenge(id)).toBeTruthy();
  });
});
