// __tests__/cinemaBingo.test.js
//
// Sinema Bingosu çekirdeği (utils/cinemaBingo.js): hafta sınırları, kartın sabitliği ve dengesi,
// karelerin izleme kayıtlarından işaretlenmesi, çizgiler, geçmiş ve seri.

const {
  BINGO_GENRES, BINGO_LINES, CENTER, addDays, bingoStreak, bingoTotals, buildBingoCard, cellsOnLines,
  daysLeftInWeek, dayOf, evaluateBingo, normalizeBingoHistory, previousWeekId, recordBingoWeek,
  markBingoSeen, toStoredBingoHistory, weekEndOf, weekIdOf, monthIdOf, monthEndOf,
  previousMonthId, daysLeftInMonth, evaluateWeeklyGoals, bingoMonthStreak,
} = require("../utils/cinemaBingo");

// 21 Ekim 2026 = Çarşamba → hafta 19 Ekim (Pzt) – 25 Ekim (Paz).
const WED = new Date(2026, 9, 21, 15, 30);
const WEEK = "2026-10-19";

const movie = (id, day, extra = {}) => ({ id, dateAdded: day, minutes: 110, genres: ["Drama"], ...extra });
const episode = (showId, n, day, extra = {}) => ({
  id: `${showId}_1_${n}`, showId, episodeWatchTime: day, genres: ["Drama"], ...extra,
});

describe("hafta", () => {
  test("kimlik pazartesidir; pazar günü aynı haftada kalır", () => {
    expect(weekIdOf(WED)).toBe(WEEK);
    expect(weekIdOf(new Date(2026, 9, 19, 0, 1))).toBe(WEEK);
    expect(weekIdOf(new Date(2026, 9, 25, 23, 59))).toBe(WEEK);
    expect(weekIdOf(new Date(2026, 9, 26, 0, 0))).toBe("2026-10-26");
    expect(weekEndOf(WEEK)).toBe("2026-10-25");
  });

  test("yıl sınırı: 1 Ocak 2027 Cuma, hafta 28 Aralık 2026'da başlar", () => {
    expect(weekIdOf(new Date(2027, 0, 1))).toBe("2026-12-28");
    expect(weekEndOf("2026-12-28")).toBe("2027-01-03");
    expect(previousWeekId("2027-01-04")).toBe("2026-12-28");
  });

  test("bugün dahil kalan gün", () => {
    expect(daysLeftInWeek(new Date(2026, 9, 19))).toBe(7);
    expect(daysLeftInWeek(WED)).toBe(5);
    expect(daysLeftInWeek(new Date(2026, 9, 25))).toBe(1);
  });

  test("addDays ay/yıl taşar", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  test("dayOf: metin, Date, zaman damgası; çöp null", () => {
    expect(dayOf("2026-10-20")).toBe("2026-10-20");
    expect(dayOf("2026-10-20T23:30:00.000Z")).toBe("2026-10-20");
    expect(dayOf(new Date(2026, 9, 20, 23, 59))).toBe("2026-10-20");
    expect(dayOf(null)).toBeNull();
    expect(dayOf("bozuk")).toBeNull();
  });
});

describe("aylık kart ve küçük haftalık hedefler", () => {
  test("ay başı, sonu ve yıl geçişi yerel takvimle hesaplanır", () => {
    expect(monthIdOf(WED)).toBe("2026-10-01");
    expect(monthEndOf("2026-02-01")).toBe("2026-02-28");
    expect(monthEndOf("2028-02-01")).toBe("2028-02-29");
    expect(previousMonthId("2027-01-01")).toBe("2026-12-01");
    expect(daysLeftInMonth(WED)).toBe(11);
  });

  test("ayın ilk ve son günü sayılır, önceki/sonraki ay sayılmaz", () => {
    const monthly = (items) => evaluateBingo({
      card: buildBingoCard("2026-10-01"), weekId: "2026-10-01", endDay: monthEndOf("2026-10-01"),
      movieEntries: items, episodes: [],
    });
    expect(monthly([movie(1, "2026-09-30")]).doneCount).toBe(0);
    expect(monthly([movie(1, "2026-10-01")]).doneCount).toBeGreaterThan(0);
    expect(monthly([movie(1, "2026-10-31")]).doneCount).toBeGreaterThan(0);
    expect(monthly([movie(1, "2026-11-01")]).doneCount).toBe(0);
  });

  test("aylık kartta iki farklı günde iki izleme erişilebilir bir çizgi verir", () => {
    const monthId = "2026-10-01";
    const result = evaluateBingo({
      card: buildBingoCard(monthId), weekId: monthId, endDay: monthEndOf(monthId),
      movieEntries: [movie(1, "2026-10-02")], episodes: [episode(1, 1, "2026-10-20")],
    });
    expect(result.lines).toContain(4); // orta sütun
  });

  test("haftalık üç hedefe iki izleme ve iki gün yeter; film ve bölüm eşit işler", () => {
    const empty = evaluateWeeklyGoals({ weekId: WEEK });
    expect(empty.doneCount).toBe(0);
    const first = evaluateWeeklyGoals({ weekId: WEEK, episodes: [episode(1, 1, "2026-10-20")] });
    expect(first.goals.map((g) => g.have)).toEqual([1, 1, 1]);
    expect(first.doneCount).toBe(1);
    const two = evaluateWeeklyGoals({ weekId: WEEK, movieEntries: [movie(1, "2026-10-22")], episodes: [episode(1, 1, "2026-10-20")] });
    expect(two.doneCount).toBe(3);
    expect(evaluateWeeklyGoals({ weekId: WEEK, movieEntries: [movie(1, "2026-10-26")] }).doneCount).toBe(0);
  });

  test("aylık seri henüz boş ayda geçen ayın çizgisini korur", () => {
    const history = { "2026-08-01": { lines: 1 }, "2026-09-01": { lines: 1 } };
    expect(bingoMonthStreak(history, "2026-10-01")).toBe(2);
    expect(bingoMonthStreak({ ...history, "2026-10-01": { lines: 1 } }, "2026-10-01")).toBe(3);
  });
});

describe("kart", () => {
  test("aynı hafta → aynı kart; farklı hafta → farklı kart", () => {
    expect(buildBingoCard(WEEK)).toEqual(buildBingoCard(WEEK));
    const weeks = Array.from({ length: 12 }, (_, i) => JSON.stringify(buildBingoCard(addDays(WEEK, i * 7))));
    expect(new Set(weeks).size).toBeGreaterThan(8);
  });

  test("9 kare, merkez 'any', kimlikler benzersiz, tür kareleri en çok 2", () => {
    for (let i = 0; i < 200; i += 1) {
      const card = buildBingoCard(addDays(WEEK, i * 7));
      expect(card).toHaveLength(9);
      expect(card[CENTER].kind).toBe("any");
      expect(new Set(card.map((c) => c.id)).size).toBe(9);
      expect(card.filter((c) => c.kind === "genre").length).toBeLessThanOrEqual(2);
      card.filter((c) => c.kind === "genre").forEach((c) => expect(BINGO_GENRES).toContain(c.genre));
    }
  });

  test("sayaçlı karelerin eşikleri makul aralıkta", () => {
    for (let i = 0; i < 200; i += 1) {
      buildBingoCard(addDays(WEEK, i * 7)).forEach((c) => {
        if (c.kind === "movies") expect([2, 3]).toContain(c.n);
        if (c.kind === "episodes") expect([2, 3, 5]).toContain(c.n);
        if (c.kind === "days") expect([2, 3, 4]).toContain(c.n);
        if (c.kind === "watches") expect(c.n).toBe(2);
      });
    }
  });

  test("tüm kare türleri uzun vadede kartlara girer", () => {
    const kinds = new Set();
    for (let i = 0; i < 300; i += 1) buildBingoCard(addDays(WEEK, i * 7)).forEach((c) => kinds.add(c.kind));
    ["any", "watches", "movies", "episodes", "days", "genre", "newGenre", "shortMovie", "longMovie", "weekend",
      "newShow", "rewatch", "bothTypes", "twoShows"].forEach((k) => expect(kinds).toContain(k));
  });
});

// Sınanacak sabit kart: her kareyi tek tek denemek için elle kurulur.
const card = (...cells) => {
  const filler = Array.from({ length: 9 }, (_, i) => ({ id: `x${i}`, kind: "noop" }));
  cells.forEach((cell, i) => { filler[i] = cell; });
  return filler;
};
const run = (cells, movieEntries = [], episodes = []) =>
  evaluateBingo({ card: cells, weekId: WEEK, movieEntries, episodes }).cells;

describe("kare değerlendirmesi", () => {
  test("any: haftada tek izleme yeter; hafta DIŞI izleme saymaz", () => {
    const c = card({ id: "any", kind: "any" });
    expect(run(c, [movie(1, "2026-10-18")])[0].done).toBe(false); // pazar, önceki hafta
    expect(run(c, [movie(1, "2026-10-26")])[0].done).toBe(false); // sonraki pazartesi
    expect(run(c, [movie(1, "2026-10-19")])[0].done).toBe(true); // hafta başı
    expect(run(c, [], [episode(9, 1, "2026-10-25")])[0].done).toBe(true); // hafta sonu
  });

  test("movies: FARKLI film sayılır; aynı filmi iki kez izlemek tek", () => {
    const c = card({ id: "movies:2", kind: "movies", n: 2 });
    const twice = [movie(1, "2026-10-20"), movie(1, "2026-10-21")];
    expect(run(c, twice)[0]).toMatchObject({ have: 1, need: 2, done: false });
    expect(run(c, [...twice, movie(2, "2026-10-22")])[0]).toMatchObject({ have: 2, done: true });
  });

  test("episodes ve days: ilerleme eşikte kırpılır", () => {
    const eps = [1, 2, 3, 4, 5].map((n) => episode(7, n, "2026-10-20"));
    expect(run(card({ id: "e", kind: "episodes", n: 3 }), [], eps)[0]).toMatchObject({ have: 3, need: 3, done: true });
    const d = card({ id: "d", kind: "days", n: 3 });
    expect(run(d, [movie(1, "2026-10-20")], [episode(7, 1, "2026-10-20"), episode(7, 2, "2026-10-22")])[0])
      .toMatchObject({ have: 2, done: false });
    expect(run(d, [movie(1, "2026-10-19"), movie(2, "2026-10-20"), movie(3, "2026-10-21")])[0].done).toBe(true);
  });

  test("genre: film türünden ya da dizi türünden; dile bağlı ad ('Korku' = 'Horror')", () => {
    const c = card({ id: "genre:horror", kind: "genre", genre: "horror" });
    expect(run(c, [movie(1, "2026-10-20", { genres: ["Korku"] })])[0].done).toBe(true);
    expect(run(c, [movie(1, "2026-10-20", { genres: ["Horror"] })])[0].done).toBe(true);
    expect(run(c, [], [episode(3, 1, "2026-10-20", { genres: ["Terror"] })])[0].done).toBe(true);
    expect(run(c, [movie(1, "2026-10-20", { genres: ["Komedi"] })])[0].done).toBe(false);
    expect(run(c, [movie(1, "2026-10-12", { genres: ["Korku"] })])[0].done).toBe(false); // geçen hafta
  });

  test("newGenre: haftadan ÖNCE hiç izlenmemiş tür", () => {
    const c = card({ id: "newGenre", kind: "newGenre" });
    const before = movie(1, "2026-09-01", { genres: ["Drama"] });
    expect(run(c, [before, movie(2, "2026-10-20", { genres: ["Dram"] })])[0].done).toBe(false);
    expect(run(c, [before, movie(2, "2026-10-20", { genres: ["Korku"] })])[0].done).toBe(true);
    // Tanınmayan tür adı ("other") yeni tür SAYILMAZ.
    expect(run(c, [before, movie(2, "2026-10-20", { genres: ["Uydurma Tür"] })])[0].done).toBe(false);
  });

  test("shortMovie / longMovie: dakika bilinmiyorsa (0) ikisi de DEĞİL", () => {
    const s = card({ id: "s", kind: "shortMovie" });
    const l = card({ id: "l", kind: "longMovie" });
    expect(run(s, [movie(1, "2026-10-20", { minutes: 95 })])[0].done).toBe(true);
    expect(run(s, [movie(1, "2026-10-20", { minutes: 100 })])[0].done).toBe(true);
    expect(run(s, [movie(1, "2026-10-20", { minutes: 101 })])[0].done).toBe(false);
    expect(run(s, [movie(1, "2026-10-20", { minutes: 0 })])[0].done).toBe(false);
    expect(run(l, [movie(1, "2026-10-20", { minutes: 140 })])[0].done).toBe(true);
    expect(run(l, [movie(1, "2026-10-20", { minutes: 139 })])[0].done).toBe(false);
    expect(run(l, [movie(1, "2026-10-20", { minutes: undefined })])[0].done).toBe(false);
  });

  test("weekend: cumartesi ya da pazar", () => {
    const c = card({ id: "weekend", kind: "weekend" });
    expect(run(c, [movie(1, "2026-10-23")])[0].done).toBe(false); // cuma
    expect(run(c, [movie(1, "2026-10-24")])[0].done).toBe(true); // cumartesi
    expect(run(c, [], [episode(2, 1, "2026-10-25")])[0].done).toBe(true); // pazar
  });

  test("newShow: dizinin İLK izlemesi bu haftaysa; eskiden izlenen dizi sayılmaz", () => {
    const c = card({ id: "newShow", kind: "newShow" });
    expect(run(c, [], [episode(5, 1, "2026-10-20")])[0].done).toBe(true);
    expect(run(c, [], [episode(5, 1, "2026-08-01"), episode(5, 2, "2026-10-20")])[0].done).toBe(false);
  });

  test("rewatch: haftadan ÖNCE de izlenmiş film; aynı hafta iki izleme tekrar sayılmaz", () => {
    const c = card({ id: "rewatch", kind: "rewatch" });
    expect(run(c, [movie(1, "2026-03-01"), movie(1, "2026-10-21")])[0].done).toBe(true);
    expect(run(c, [movie(1, "2026-10-20"), movie(1, "2026-10-21")])[0].done).toBe(false);
  });

  test("bothTypes ve twoShows", () => {
    const both = card({ id: "b", kind: "bothTypes" });
    expect(run(both, [movie(1, "2026-10-20")])[0].done).toBe(false);
    expect(run(both, [movie(1, "2026-10-20")], [episode(3, 1, "2026-10-21")])[0].done).toBe(true);
    const two = card({ id: "t", kind: "twoShows" });
    expect(run(two, [], [episode(3, 1, "2026-10-20"), episode(3, 2, "2026-10-21")])[0]).toMatchObject({ have: 1, done: false });
    expect(run(two, [], [episode(3, 1, "2026-10-20"), episode(4, 1, "2026-10-21")])[0].done).toBe(true);
  });

  test("kimliksiz eski kayıtlar çökmez; bozuk tarih sessizce atlanır", () => {
    const c = card({ id: "movies:2", kind: "movies", n: 2 });
    const entries = [{ dateAdded: "2026-10-20" }, { dateAdded: "2026-10-21" }, { dateAdded: "çöp" }, null];
    expect(() => run(c, entries)).not.toThrow();
    expect(run(c, entries)[0].done).toBe(true); // iki kimliksiz kayıt ayrışır
  });
});

describe("çizgiler", () => {
  const allKinds = (doneIdx) =>
    Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, kind: doneIdx.includes(i) ? "any" : "weekend" }));
  const evalDone = (doneIdx) =>
    evaluateBingo({
      card: allKinds(doneIdx),
      weekId: WEEK,
      movieEntries: [movie(1, "2026-10-20")], // pazartesi+1 = salı: 'any' dolu, 'weekend' boş
      episodes: [],
    });

  test("satır, sütun ve köşegen sayılır; merkez iki-üç çizgiye girer", () => {
    expect(evalDone([0, 1, 2]).lines).toEqual([0]);
    expect(evalDone([0, 3, 6]).lines).toEqual([3]);
    expect(evalDone([0, 4, 8]).lines).toEqual([6]);
    expect(evalDone([0, 1, 2, 3, 4, 5]).lineCount).toBe(2);
    expect(evalDone([0, 1, 5, 7]).lineCount).toBe(0);
  });

  test("dokuz kare dolu → 8 çizgi + tam kart", () => {
    const r = evalDone([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(r.lineCount).toBe(BINGO_LINES.length);
    expect(r.full).toBe(true);
    expect(r.doneCount).toBe(9);
  });

  test("oneAway: tek eksiği kalan çizgilerin boş karesi", () => {
    const r = evalDone([0, 1, 4]); // 0-1-2 çizgisinin eksiği 2; 1-4-7'nin eksiği 7; 0-4-8'in eksiği 8
    expect(r.oneAway.sort()).toEqual([2, 7, 8]);
    expect(evalDone([]).oneAway).toEqual([]);
  });

  test("cellsOnLines yalnız tamamlanmış çizgilerin karelerini verir", () => {
    expect([...cellsOnLines([0])].sort()).toEqual([0, 1, 2]);
    expect(cellsOnLines([]).size).toBe(0);
  });

  test("gerçek kart + boş kütüphane: yalnız hiçbir şey yapılmamış", () => {
    const r = evaluateBingo({ card: buildBingoCard(WEEK), weekId: WEEK, movieEntries: [], episodes: [] });
    expect(r.doneCount).toBe(0);
    expect(r.lineCount).toBe(0);
    expect(r.full).toBe(false);
  });
});

describe("geçmiş", () => {
  test("bozuk kayıt güvenli; geçersiz hafta kimliği atılır; sınırlar kırpılır", () => {
    expect(normalizeBingoHistory(null)).toEqual({});
    expect(normalizeBingoHistory([])).toEqual({});
    expect(normalizeBingoHistory({ "2026-10-19": { lines: 99, squares: 99, full: true }, kotu: { lines: 1 } }))
      .toEqual({ "2026-10-19": { lines: 8, squares: 9, full: true, seen: 0 } });
    // 'full' ancak 9 kareyle tutarlıysa kalır.
    expect(normalizeBingoHistory({ "2026-10-19": { lines: 2, squares: 5, full: true } })["2026-10-19"].full).toBe(false);
  });

  test("yalnız son 26 hafta tutulur", () => {
    let history = {};
    for (let i = 0; i < 40; i += 1) {
      history = recordBingoWeek(history, addDays("2026-01-05", i * 7), { doneCount: 1, lineCount: 0 });
    }
    expect(Object.keys(history)).toHaveLength(26);
    expect(Object.keys(history).sort()[25]).toBe(addDays("2026-01-05", 39 * 7));
  });

  test("değerler yalnız artar; değişim yoksa aynı nesne", () => {
    const first = recordBingoWeek({}, WEEK, { doneCount: 5, lineCount: 2, full: false });
    expect(first[WEEK]).toEqual({ lines: 2, squares: 5, full: false, seen: 0 });
    const lower = recordBingoWeek(first, WEEK, { doneCount: 3, lineCount: 1, full: false });
    expect(lower).toBe(first);
    const higher = recordBingoWeek(first, WEEK, { doneCount: 9, lineCount: 8, full: true });
    expect(higher[WEEK]).toEqual({ lines: 8, squares: 9, full: true, seen: 0 });
  });

  test("görülen çizgi yalnız artar, kaydı koruyarak; değerlendirme görülenleri silmez", () => {
    const recorded = recordBingoWeek({}, WEEK, { doneCount: 5, lineCount: 2, full: false });
    const seen = markBingoSeen(recorded, WEEK, 2);
    expect(seen[WEEK]).toEqual({ lines: 2, squares: 5, full: false, seen: 2 });
    expect(markBingoSeen(seen, WEEK, 1)).toBe(seen); // geriye düşmez, aynı nesne
    // Sonradan yeni değerlendirme `seen`i bozmaz.
    expect(recordBingoWeek(seen, WEEK, { doneCount: 6, lineCount: 3, full: false })[WEEK].seen).toBe(2);
    // Kayıt yokken görmek kaydı açar.
    expect(markBingoSeen({}, WEEK, 1)[WEEK]).toEqual({ lines: 0, squares: 0, full: false, seen: 1 });
    // Geçersiz hafta kimliği sessizce yok sayılır.
    expect(markBingoSeen({}, "kotu", 3)).toEqual({});
  });

  test("seri: ardışık haftalar; bu hafta çizgisizse geçen haftadan sayılır", () => {
    const h = {
      "2026-09-28": { lines: 1, squares: 3, full: false },
      "2026-10-05": { lines: 2, squares: 5, full: false },
      "2026-10-12": { lines: 1, squares: 4, full: false },
    };
    expect(bingoStreak(h, WEEK)).toBe(3); // bu hafta kayıt yok → geçen haftadan geriye
    expect(bingoStreak({ ...h, [WEEK]: { lines: 1, squares: 3, full: false } }, WEEK)).toBe(4);
    expect(bingoStreak({ ...h, "2026-10-05": { lines: 0, squares: 2, full: false } }, WEEK)).toBe(1); // kırıldı
    expect(bingoStreak({}, WEEK)).toBe(0);
  });

  test("toplamlar ve boş geçmişte null saklama", () => {
    const h = {
      "2026-10-05": { lines: 3, squares: 6, full: false, seen: 3 },
      "2026-10-12": { lines: 8, squares: 9, full: true, seen: 8 },
    };
    expect(bingoTotals(h)).toEqual({ weeks: 2, fullCards: 1, bestLines: 8 });
    expect(bingoTotals({})).toEqual({ weeks: 0, fullCards: 0, bestLines: 0 });
    expect(toStoredBingoHistory({})).toBeNull();
    expect(toStoredBingoHistory(h)).toEqual(h);
  });
});
