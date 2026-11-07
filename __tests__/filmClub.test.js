// Film Kulübü saf çekirdeği (utils/filmClub.js) + kural aynası.
const fs = require("fs");
const path = require("path");
const {
  CLUB_CADENCES,
  CLUB_COMMENT_MAX,
  CLUB_MAX_CANDIDATES,
  CLUB_MAX_VOTE_DAYS,
  CLUB_MAX_WATCH_DAYS,
  CLUB_MIN_CANDIDATES,
  CLUB_RATING_MAX,
  CLUB_RATING_MIN,
  CLUB_SENDER_NAME_MAX,
  activeRoundOf,
  buildRoundDraft,
  canCloseVoting,
  canFinishRound,
  candidateIdOf,
  clubStats,
  hasWatched,
  isValidRating,
  msLeft,
  myRatingOf,
  nextClubVote,
  nextRoundNumber,
  normalizeCandidates,
  pickWinner,
  roundPhase,
  roundStats,
  sanitizeClubMedia,
  sanitizeComment,
  splitLeft,
  tallyRound,
  toMillis,
  watchEndsAtFor,
} = require("../utils/filmClub");

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 30, 12);
const film = (id, extra = {}) => ({ id, media_type: "movie", title: `Film ${id}`, ...extra });

const round = (extra = {}) => ({
  ...buildRoundDraft({ number: 1, candidates: [film(1), film(2), film(3)], cadence: "weekly", uid: "a", nowMs: NOW }),
  ...extra,
});

describe("aday temizliği", () => {
  test("film ve dizi kalır, kişi ve kimliksiz düşer; tarih ve afiş korunur", () => {
    expect(sanitizeClubMedia({ id: 5, media_type: "person", name: "X" })).toBeNull();
    expect(sanitizeClubMedia({ media_type: "movie", title: "Y" })).toBeNull();
    expect(sanitizeClubMedia({ id: 7, name: "Dark", first_air_date: "2017-12-01", poster_path: "/p.jpg" })).toEqual({
      id: 7,
      media_type: "tv",
      title: "Dark",
      poster_path: "/p.jpg",
      release_date: "2017-12-01",
    });
  });

  test("yinelenenleri atar ve en çok 6 aday bırakır", () => {
    const list = normalizeCandidates([film(1), film(1), film(2), ...[3, 4, 5, 6, 7, 8].map((id) => film(id))]);
    expect(list.map(candidateIdOf)).toEqual(["movie-1", "movie-2", "movie-3", "movie-4", "movie-5", "movie-6"]);
  });

  test("aday kimliği kuraldaki media_type-id biçimi", () => {
    expect(candidateIdOf({ id: 1399, media_type: "tv" })).toBe("tv-1399");
    expect(candidateIdOf({ id: 550, media_type: "movie" })).toBe("movie-550");
  });
});

describe("tur taslağı", () => {
  test("2 adaydan az → null; sıklığa göre oylama bitişi", () => {
    expect(buildRoundDraft({ number: 1, candidates: [film(1)], cadence: "weekly", uid: "a", nowMs: NOW })).toBeNull();
    const weekly = round();
    expect(weekly.status).toBe("voting");
    expect(weekly.candidateIds).toEqual(["movie-1", "movie-2", "movie-3"]);
    expect(weekly.voteEndsAtMs - NOW).toBe(2 * DAY);
    const monthly = buildRoundDraft({ number: 2, candidates: [film(1), film(2)], cadence: "monthly", uid: "a", nowMs: NOW });
    expect(monthly.voteEndsAtMs - NOW).toBe(3 * DAY);
    expect(watchEndsAtFor("monthly", NOW) - NOW).toBe(30 * DAY);
    expect(watchEndsAtFor("bilinmeyen", NOW) - NOW).toBe(7 * DAY);
  });

  test("sıklık süreleri kural tavanlarının içinde", () => {
    Object.values(CLUB_CADENCES).forEach((c) => {
      expect(c.voteDays).toBeLessThan(CLUB_MAX_VOTE_DAYS + 1);
      expect(c.watchDays).toBeLessThan(CLUB_MAX_WATCH_DAYS + 1);
    });
  });
});

describe("oy ve kazanan", () => {
  test("çoktan aza sayar; eşitlikte aday sırası; geçersiz oy sayılmaz", () => {
    const r = round({ votes: { a: "movie-2", b: "movie-3", c: "movie-3", d: "movie-2", e: "movie-99" } });
    expect(tallyRound(r).map((row) => [row.id, row.count])).toEqual([
      ["movie-2", 2],
      ["movie-3", 2],
      ["movie-1", 0],
    ]);
    expect(pickWinner(r).id).toBe(2);
  });

  test("oy yoksa ilk aday kazanır", () => {
    expect(pickWinner(round()).id).toBe(1);
    expect(pickWinner({ candidates: [] })).toBeNull();
  });

  test("aynı adaya tekrar basmak oyu geri çeker", () => {
    const r = round({ votes: { a: "movie-1" } });
    expect(nextClubVote(r, "a", "movie-1")).toBeNull();
    expect(nextClubVote(r, "a", "movie-2")).toBe("movie-2");
  });
});

describe("evre ve yetki", () => {
  test("oylama süresi dolunca votingOver; üye ancak o zaman kapatır", () => {
    const r = round();
    expect(roundPhase(r, NOW)).toBe("voting");
    expect(canCloseVoting(r, { isManager: false, nowMs: NOW })).toBe(false);
    expect(canCloseVoting(r, { isManager: true, nowMs: NOW })).toBe(true);
    expect(roundPhase(r, NOW + 2 * DAY)).toBe("votingOver");
    expect(canCloseVoting(r, { isManager: false, nowMs: NOW + 2 * DAY })).toBe(true);
  });

  test("Firestore Timestamp alanları okunur; izleme bitişi watchingOver", () => {
    const ts = { toMillis: () => NOW + DAY };
    const r = round({ status: "watching", watchEndsAt: ts });
    expect(roundPhase(r, NOW)).toBe("watching");
    expect(canFinishRound(r, { isManager: false, nowMs: NOW })).toBe(false);
    expect(roundPhase(r, NOW + DAY)).toBe("watchingOver");
    expect(canFinishRound(r, { isManager: false, nowMs: NOW + DAY })).toBe(true);
    expect(roundPhase({ status: "done" }, NOW)).toBe("done");
    expect(canFinishRound({ status: "done" }, { isManager: true, nowMs: NOW })).toBe(false);
  });

  test("kalan süre ve gün/saat bölümü", () => {
    expect(msLeft(round(), NOW)).toBe(2 * DAY);
    expect(msLeft(round(), NOW + 3 * DAY)).toBe(0);
    expect(splitLeft(2 * DAY + 60 * 60 * 1000)).toEqual({ days: 2, hours: 1 });
    expect(splitLeft(30 * 60 * 1000)).toEqual({ days: 0, hours: 1 });
    expect(msLeft({ status: "done" }, NOW)).toBeNull();
  });

  test("toMillis biçimleri", () => {
    expect(toMillis(null)).toBeNull();
    expect(toMillis(5)).toBe(5);
    expect(toMillis(new Date(7))).toBe(7);
    expect(toMillis({ seconds: 2, nanoseconds: 5e6 })).toBe(2005);
  });
});

describe("izledim, puan, istatistik", () => {
  test("puan 1–10 tam sayı", () => {
    expect(isValidRating(CLUB_RATING_MIN)).toBe(true);
    expect(isValidRating(CLUB_RATING_MAX)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(7.5)).toBe(false);
  });

  test("tur istatistiği yalnız şu anki üyelerle katılım oranı hesaplar", () => {
    const r = round({ status: "done", pick: film(1), watched: { a: 1, b: 1, eski: 1 }, ratings: { a: 9, b: 4, eski: 7 } });
    expect(hasWatched(r, "a")).toBe(true);
    expect(hasWatched(r, "c")).toBe(false);
    expect(myRatingOf(r, "b")).toBe(4);
    expect(myRatingOf(r, "c")).toBeNull();
    expect(roundStats(r, ["a", "b", "c", "d"])).toEqual({
      watchedCount: 3,
      memberCount: 4,
      watchedPct: 50,
      ratingCount: 3,
      avgRating: 6.7,
      spread: 5,
    });
  });

  test("kulüp istatistiği: en beğenilen, en ayrışılan, en sadık", () => {
    const members = ["a", "b", "c"];
    const rounds = [
      round({ number: 1, status: "done", pick: film(1), watched: { a: 1, b: 1 }, ratings: { a: 9, b: 9 } }),
      round({ number: 2, status: "done", pick: film(2), watched: { a: 1, b: 1, c: 1 }, ratings: { a: 10, c: 3 } }),
      round({ number: 3, status: "watching", pick: film(3), watched: { c: 1 } }),
    ];
    const stats = clubStats(rounds, members);
    expect(stats.roundsDone).toBe(2);
    expect(stats.topRated.round.number).toBe(1);
    expect(stats.divisive.round.number).toBe(2);
    expect(stats.divisive.spread).toBe(7);
    expect(stats.loyal).toEqual({ uid: "a", count: 2 });
    expect(stats.participationPct).toBe(84); // (67 + 100) / 2
    expect(stats.avgRating).toBe(7.8); // (9 + 6.5) / 2
    expect(clubStats([], members).roundsDone).toBe(0);
  });

  test("ayrışma 3 puandan azsa ayrışılan film yok", () => {
    const stats = clubStats([round({ status: "done", pick: film(1), watched: { a: 1, b: 1 }, ratings: { a: 8, b: 7 } })], ["a", "b"]);
    expect(stats.divisive).toBeNull();
  });

  test("açık tur ve sonraki numara", () => {
    const rounds = [round({ number: 1, status: "done" }), round({ number: 2, status: "watching" })];
    expect(activeRoundOf(rounds).number).toBe(2);
    expect(activeRoundOf([round({ status: "done" })])).toBeNull();
    expect(nextRoundNumber(rounds)).toBe(3);
    expect(nextRoundNumber([])).toBe(1);
  });

  test("yorum kırpılır, boşsa null", () => {
    expect(sanitizeComment("   ")).toBeNull();
    expect(sanitizeComment("  güzel ")).toBe("güzel");
    expect(sanitizeComment("x".repeat(CLUB_COMMENT_MAX + 50))).toHaveLength(CLUB_COMMENT_MAX);
  });
});

describe("kural aynası (firestore.rules)", () => {
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
  const block = rules.slice(rules.indexOf("match /clubRounds/{roundId}"), rules.indexOf("Grup okunmamış sayacı"));

  test("aday, puan, yorum ve süre sınırları kuralla aynı", () => {
    expect(block).toContain(`candidateIds.size() >= ${CLUB_MIN_CANDIDATES}`);
    expect(block).toContain(`candidateIds.size() <= ${CLUB_MAX_CANDIDATES}`);
    expect(block).toContain(`ratings[me] >= ${CLUB_RATING_MIN} && ratings[me] <= ${CLUB_RATING_MAX}`);
    expect(block).toContain(`text.size() <= ${CLUB_COMMENT_MAX}`);
    expect(block).toContain(`senderName.size() <= ${CLUB_SENDER_NAME_MAX}`);
    expect(block).toContain(`duration.value(${CLUB_MAX_VOTE_DAYS}, 'd')`);
    expect(block).toContain(`duration.value(${CLUB_MAX_WATCH_DAYS}, 'd')`);
  });

  test("sıklık kimlikleri kuralla aynı", () => {
    expect(rules).toContain(`club.cadence in [${Object.keys(CLUB_CADENCES).map((id) => `'${id}'`).join(", ")}]`);
  });
});
