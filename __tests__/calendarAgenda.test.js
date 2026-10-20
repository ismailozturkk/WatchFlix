import {
  countEventsInMonth,
  dayDiff,
  formatEpisodeCode,
  monthKeyOf,
  toLocalDateStr,
  urgencyTone,
} from "../utils/calendarAgenda";

describe("toLocalDateStr", () => {
  it("yerel gün bileşenlerini kullanır (UTC'ye kaymaz)", () => {
    // Yerel gece yarısı: toISOString UTC+ dilimlerinde bir önceki günü verirdi.
    expect(toLocalDateStr(new Date(2026, 9, 1, 0, 30))).toBe("2026-10-01");
    expect(toLocalDateStr(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("dayDiff", () => {
  it("gün farkını işaretli verir", () => {
    expect(dayDiff("2026-10-02", "2026-10-02")).toBe(0);
    expect(dayDiff("2026-10-03", "2026-10-02")).toBe(1);
    expect(dayDiff("2026-10-01", "2026-10-02")).toBe(-1);
    expect(dayDiff("2026-11-02", "2026-10-02")).toBe(31);
  });

  it("DST geçişinde bile tam gün döner", () => {
    // Avrupa DST başlangıcı: arada 23 saatlik gün var.
    expect(dayDiff("2026-03-30", "2026-03-28")).toBe(2);
    expect(dayDiff("2026-10-26", "2026-10-24")).toBe(2);
  });

  it("geçersiz girdide null", () => {
    expect(dayDiff("", "2026-10-02")).toBeNull();
    expect(dayDiff("2026-10-02", undefined)).toBeNull();
    expect(dayDiff("abc", "2026-10-02")).toBeNull();
  });
});

describe("urgencyTone", () => {
  it.each([
    [-5, "past"],
    [0, "today"],
    [1, "soon"],
    [3, "soon"],
    [4, "week"],
    [7, "week"],
    [8, "normal"],
    [null, "normal"],
  ])("diff %p → %s", (diff, tone) => {
    expect(urgencyTone(diff)).toBe(tone);
  });
});

describe("monthKeyOf", () => {
  it("yıl-ay önekini çıkarır", () => {
    expect(monthKeyOf("2026-10-14")).toBe("2026-10");
    expect(monthKeyOf("2026-10")).toBe("2026-10");
  });
  it("geçersizde boş dizgi", () => {
    expect(monthKeyOf("")).toBe("");
    expect(monthKeyOf(null)).toBe("");
    expect(monthKeyOf("garip")).toBe("");
  });
});

describe("countEventsInMonth", () => {
  const notes = {
    "2026-10-03": [{ id: 1 }, { id: 2 }],
    "2026-11-01": [{ id: 3 }],
  };
  const reminders = {
    "2026-10-03": [
      { type: "movie", id: 10 },
      { type: "tv", id: 20 },
    ],
    "2026-10-20": [{ type: "tv", id: 21 }],
    "2026-09-30": [{ type: "movie", id: 11 }],
  };

  it("yalnız verilen aydaki etkinlikleri türe göre sayar", () => {
    expect(countEventsInMonth(notes, reminders, "2026-10")).toEqual({
      note: 2,
      movie: 1,
      tv: 2,
      total: 5,
    });
  });

  it("boş ay ve boş girdiler sıfır döner", () => {
    expect(countEventsInMonth(notes, reminders, "2027-01").total).toBe(0);
    expect(countEventsInMonth(undefined, undefined, "2026-10").total).toBe(0);
    expect(countEventsInMonth(notes, reminders, "").total).toBe(0);
  });

  it("türü bilinmeyen hatırlatıcıyı saymaz", () => {
    const odd = { "2026-10-05": [{ type: "podcast" }, null] };
    expect(countEventsInMonth({}, odd, "2026-10").total).toBe(0);
  });
});

describe("formatEpisodeCode", () => {
  it("dile göre B/E harfi kullanır", () => {
    expect(formatEpisodeCode(1, 3, "tr")).toBe("S1B3");
    expect(formatEpisodeCode(2, 10, "en")).toBe("S2E10");
  });
  it("eksik bilgide boş dizgi", () => {
    expect(formatEpisodeCode(null, 3, "tr")).toBe("");
    expect(formatEpisodeCode(1, undefined, "tr")).toBe("");
  });
});
