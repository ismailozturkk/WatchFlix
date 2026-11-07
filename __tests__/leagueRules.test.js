// __tests__/leagueRules.test.js
//
// Haftalık Lig çekirdeği: hafta/gün sınırları (İstanbul), terfi/düşme kontenjanı, sıralama, XP kararı ve
// sunucu kaynağı (functions/leagueRules.js) ile uygulama aynasının (utils/leagueRules.js) EŞİTLİĞİ.

const server = require("../functions/leagueRules");
const client = require("../utils/leagueRules");

const at = (iso) => Date.parse(iso);

describe("hafta ve gün (İstanbul, UTC+3)", () => {
  test("hafta kimliği pazartesi; pazar gecesi 23:59 hâlâ eski hafta", () => {
    expect(server.weekIdOf(at("2026-10-30T12:00:00Z"))).toBe("2026-10-26"); // cuma
    expect(server.weekIdOf(at("2026-11-01T20:59:00Z"))).toBe("2026-10-26"); // pazar 23:59 TR
    expect(server.weekIdOf(at("2026-11-01T21:00:00Z"))).toBe("2026-11-02"); // pazartesi 00:00 TR
    expect(server.weekIdOf(at("2026-10-25T21:30:00Z"))).toBe("2026-10-26"); // pazartesi 00:30 TR, UTC'de pazar
  });

  test("hafta başı/sonu ve önceki hafta (ay ve yıl sınırı)", () => {
    expect(new Date(server.weekStartMs("2026-10-26")).toISOString()).toBe("2026-10-25T21:00:00.000Z");
    expect(server.weekEndMs("2026-10-26") - server.weekStartMs("2026-10-26")).toBe(server.WEEK_MS);
    expect(server.prevWeekId("2026-11-02")).toBe("2026-10-26");
    expect(server.prevWeekId("2027-01-04")).toBe("2026-12-28");
  });

  test("gün anahtarı ve kaydırma", () => {
    expect(server.dayKeyOf(at("2026-10-30T20:59:00Z"))).toBe("2026-10-30");
    expect(server.dayKeyOf(at("2026-10-30T21:00:00Z"))).toBe("2026-10-31");
    expect(server.shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(server.shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("terfi / düşme", () => {
  test("kontenjan: %20, terfi en az 1, küçük grupta düşme yok", () => {
    expect(server.zoneCounts(30)).toEqual({ promote: 6, demote: 6 });
    expect(server.zoneCounts(25)).toEqual({ promote: 5, demote: 5 });
    expect(server.zoneCounts(5)).toEqual({ promote: 1, demote: 1 });
    expect(server.zoneCounts(4)).toEqual({ promote: 1, demote: 0 });
    expect(server.zoneCounts(1)).toEqual({ promote: 1, demote: 0 });
    expect(server.zoneCounts(0)).toEqual({ promote: 0, demote: 0 });
  });

  test("terfi için en az MIN_PROMOTE_XP; en üst ligde terfi, en altta düşme yok", () => {
    const min = server.MIN_PROMOTE_XP;
    expect(server.outcomeFor({ tier: 1, rank: 1, size: 10, xp: min })).toBe("up");
    expect(server.outcomeFor({ tier: 1, rank: 1, size: 10, xp: min - 1 })).toBe("stay");
    expect(server.outcomeFor({ tier: 4, rank: 1, size: 10, xp: 9999 })).toBe("stay");
    expect(server.outcomeFor({ tier: 1, rank: 10, size: 10, xp: 5 })).toBe("down");
    expect(server.outcomeFor({ tier: 0, rank: 10, size: 10, xp: 5 })).toBe("stay");
    expect(server.outcomeFor({ tier: 2, rank: 4, size: 4, xp: 5 })).toBe("stay");
  });

  test("sıralama: XP, eşitse o XP'ye önce ulaşan, sonra uid", () => {
    const rows = server.rankMembers([
      { uid: "c", xp: 50, xpAt: 300 },
      { uid: "a", xp: 80, xpAt: 500 },
      { uid: "b", xp: 50, xpAt: 100 },
      { uid: "d", xp: 50 },
      null,
    ]);
    expect(rows.map((r) => [r.uid, r.rank])).toEqual([["a", 1], ["b", 2], ["c", 3], ["d", 4]]);
  });

  test("grup sonucu: 6 kişide 1 çıkar, 1 düşer", () => {
    const members = ["a", "b", "c", "d", "e", "f"].map((uid, i) => ({ uid, xp: 600 - i * 100, xpAt: i }));
    const rows = server.settleGroup(2, members);
    expect(rows[0]).toMatchObject({ uid: "a", outcome: "up", fromTier: 2, toTier: 3, rank: 1, size: 6 });
    expect(rows.slice(1, 5).every((r) => r.outcome === "stay" && r.toTier === 2)).toBe(true);
    expect(rows[5]).toMatchObject({ uid: "f", outcome: "down", toTier: 1 });
  });
});

describe("XP kararı", () => {
  const now = at("2026-10-30T12:00:00Z"); // cuma, TR günü 2026-10-30

  test("geçerli olay XP verir; aynı olay ikinci kez sayılmaz", () => {
    const first = server.awardDecision(null, { source: "watch", ref: "movie:550", nowMs: now });
    expect(first).toMatchObject({ ok: true, xp: 10 });
    expect(first.next).toMatchObject({ week: "2026-10-26", xp: 10, todayKey: "2026-10-30", counts: { watch: 1 } });
    const again = server.awardDecision(first.next, { source: "watch", ref: "movie:550", nowMs: now + 1000 });
    expect(again).toMatchObject({ ok: false, reason: "duplicate" });
  });

  test("günlük tavan; ertesi gün sayaç sıfırlanır ama hafta XP'si kalır", () => {
    let state = null;
    for (let i = 0; i < server.XP_SOURCES.vote.daily; i += 1) {
      state = server.awardDecision(state, { source: "vote", ref: `top100:movie_${i + 1}`, nowMs: now }).next;
    }
    expect(server.awardDecision(state, { source: "vote", ref: "top100:tv_9", nowMs: now })).toMatchObject({
      ok: false,
      reason: "daily_cap",
    });
    const tomorrow = server.awardDecision(state, { source: "vote", ref: "top100:tv_9", nowMs: now + server.DAY_MS });
    expect(tomorrow.ok).toBe(true);
    expect(tomorrow.next.xp).toBe(6 * server.XP_SOURCES.vote.xp);
  });

  test("yeni hafta durumu sıfırlar", () => {
    const old = { week: "2026-10-19", xp: 900, groupId: "gold-1", refs: ["watch|movie:550"], counts: {}, todayKey: "x" };
    const result = server.awardDecision(old, { source: "watch", ref: "movie:550", nowMs: now });
    expect(result.ok).toBe(true);
    expect(result.next).toMatchObject({ week: "2026-10-26", xp: 10, groupId: null });
  });

  test("ref doğrulaması: biçim, kaynak ve tarih penceresi (±1 gün)", () => {
    const ok = (source, ref) => server.isValidRef(source, ref, now);
    expect(ok("daily", "frame:2026-10-30")).toBe(true);
    expect(ok("daily", "chain:2026-10-29")).toBe(true);
    expect(ok("daily", "chain:2026-10-31")).toBe(true);
    expect(ok("daily", "chain:2026-10-27")).toBe(false);
    expect(ok("daily", "bingo:2026-10-30")).toBe(false);
    expect(ok("vote", "poll:2026-10-30")).toBe(true);
    expect(ok("vote", "poll:2026-10-01")).toBe(false);
    expect(ok("vote", "top100:tv_1399")).toBe(true);
    expect(ok("watch", "tv:1399:s1:e3")).toBe(true);
    expect(ok("watch", "tv:1399:e3")).toBe(false);
    expect(ok("watch", "movie:0")).toBe(false);
    expect(ok("game", "quick:popular:1730289600000")).toBe(true);
    expect(ok("game", "x".repeat(30))).toBe(false);
    expect(ok("nope", "a:b")).toBe(false);
    expect(server.awardDecision(null, { source: "nope", ref: "a:b", nowMs: now })).toMatchObject({ reason: "bad_source" });
  });
});

describe("uygulama aynası sunucuyla aynı", () => {
  test("aynı dışa aktarımlar ve sabitler", () => {
    expect(Object.keys(client).filter((k) => k !== "__esModule").sort()).toEqual(Object.keys(server).sort());
    for (const key of Object.keys(server)) {
      if (typeof server[key] !== "function") expect(client[key]).toEqual(server[key]);
    }
  });

  test("aynı girdide aynı çıktı", () => {
    const base = at("2026-10-25T00:00:00Z");
    for (let h = 0; h < 24 * 9; h += 5) {
      const ms = base + h * 3600 * 1000;
      expect(client.weekIdOf(ms)).toBe(server.weekIdOf(ms));
      expect(client.dayKeyOf(ms)).toBe(server.dayKeyOf(ms));
    }
    for (let size = 0; size <= 31; size += 1) {
      expect(client.zoneCounts(size)).toEqual(server.zoneCounts(size));
      for (let tier = 0; tier < 5; tier += 1) {
        for (const rank of [1, 2, Math.max(1, size - 1), size]) {
          for (const xp of [0, 99, 100, 500]) {
            const args = { tier, rank, size, xp };
            expect(client.outcomeFor(args)).toBe(server.outcomeFor(args));
          }
        }
      }
    }
    const members = Array.from({ length: 12 }, (_, i) => ({ uid: `u${i}`, xp: (i * 37) % 200, xpAt: i % 3 }));
    expect(client.settleGroup(3, members)).toEqual(server.settleGroup(3, members));
    const now = at("2026-10-30T12:00:00Z");
    const refs = [
      ["game", "quick:older:1"],
      ["daily", "frame:2026-10-30"],
      ["watch", "tv:1:s2:e3"],
      ["vote", "poll:2026-10-31"],
      ["vote", "top100:movie_5"],
      ["watch", "bad"],
    ];
    let s = null;
    let c = null;
    for (const [source, ref] of refs) {
      const a = server.awardDecision(s, { source, ref, nowMs: now });
      const b = client.awardDecision(c, { source, ref, nowMs: now });
      expect(b).toEqual(a);
      s = a.next;
      c = b.next;
    }
    expect(client.groupIdOf(2, 3)).toBe(server.groupIdOf(2, 3));
  });
});
