const {
  sortNotes,
  foldText,
  matchesQuery,
  todoStats,
  filterTodoNotes,
  dueStatus,
  dateOffsetISO,
  parseISODate,
  countWords,
  isNoteEmpty,
  buildNoteColorPairs,
  segmentWidth,
  badgeLabel,
  tabDirection,
  TAB_BAR_PADDING,
  wrappedLineCount,
  estimateGridCardHeight,
  splitIntoColumns,
} = require("../utils/notesView");

describe("sortNotes", () => {
  test("sabitlenenler önde, her grup en yeni oluşturulandan eskiye", () => {
    const notes = [
      { id: "a", createdAt: 100 },
      { id: "b", createdAt: 300, pinned: true },
      { id: "c", createdAt: 200 },
      { id: "d", createdAt: 50, pinned: true },
    ];
    expect(sortNotes(notes).map((n) => n.id)).toEqual(["b", "d", "c", "a"]);
  });

  test("düzenleme sırayı bozmaz: updatedAt yenilense de createdAt belirler", () => {
    const notes = [
      { id: "eski", createdAt: 10, updatedAt: 9999 },
      { id: "yeni", createdAt: 500, updatedAt: 500 },
    ];
    expect(sortNotes(notes).map((n) => n.id)).toEqual(["yeni", "eski"]);
  });

  test("createdAt yoksa updatedAt'e düşer; eşitlikte girdi sırası korunur", () => {
    const notes = [
      { id: "x", createdAt: 10 },
      { id: "y", createdAt: 10 },
      { id: "z", updatedAt: 99 },
    ];
    expect(sortNotes(notes).map((n) => n.id)).toEqual(["z", "x", "y"]);
  });

  test("girdiyi değiştirmez; dizi olmayan girdi boş döner", () => {
    const notes = [{ id: "a", updatedAt: 1 }, { id: "b", updatedAt: 2 }];
    const copy = [...notes];
    sortNotes(notes);
    expect(notes).toEqual(copy);
    expect(sortNotes(null)).toEqual([]);
  });
});

describe("arama", () => {
  test("foldText: büyük/küçük harf, i/ı/İ/I ve aksanlar yok sayılır", () => {
    expect(foldText("ISIK")).toBe(foldText("ışık"));
    expect(foldText("İstanbul")).toBe(foldText("istanbul"));
    expect(foldText("Çalışma ÖĞÜT")).toBe(foldText("calisma ogut"));
  });

  test("başlık, içerik, film notu metni ve todo maddelerinde arar", () => {
    expect(matchesQuery({ title: "Market listesi" }, "market")).toBe(true);
    expect(matchesQuery({ content: "Yarın doktora git" }, "DOKTORA")).toBe(true);
    expect(matchesQuery({ text: "Final sahnesi muhteşemdi" }, "muhtesem")).toBe(true);
    expect(matchesQuery({ todos: [{ text: "Süt al" }, { text: "Ekmek" }] }, "ekmek")).toBe(true);
    expect(matchesQuery({ title: "Market" }, "otomobil")).toBe(false);
  });

  test("birden çok kelime: hepsi geçmeli, sıra önemsiz", () => {
    const note = { title: "Hafta sonu planı", content: "Sinema ve yürüyüş" };
    expect(matchesQuery(note, "sinema plan")).toBe(true);
    expect(matchesQuery(note, "sinema tiyatro")).toBe(false);
  });

  test("boş sorgu her notu eşler; boş not hiçbir kelimeyle eşleşmez", () => {
    expect(matchesQuery({ title: "x" }, "   ")).toBe(true);
    expect(matchesQuery({}, "a")).toBe(false);
  });
});

describe("todoStats / filterTodoNotes", () => {
  const mk = (...done) => ({ type: "todo", todos: done.map((d, i) => ({ id: String(i), text: "m", done: d })) });

  test("sayılar ve ilerleme", () => {
    expect(todoStats(mk(true, false, true, false))).toEqual({
      total: 4,
      done: 2,
      pending: 2,
      progress: 0.5,
      complete: false,
    });
  });

  test("maddesiz not tamamlanmış sayılmaz (0 / 0 ≠ bitti)", () => {
    expect(todoStats({ type: "todo", todos: [] }).complete).toBe(false);
    expect(todoStats(null).total).toBe(0);
  });

  test("süzgeç: devam eden / biten / hepsi", () => {
    const all = [mk(true, true), mk(true, false), mk(false), { type: "todo", todos: [] }];
    expect(filterTodoNotes(all, "done")).toHaveLength(1);
    expect(filterTodoNotes(all, "active")).toHaveLength(3);
    expect(filterTodoNotes(all, "all")).toHaveLength(4);
  });
});

describe("hatırlatıcı tarihi", () => {
  const NOW = new Date(2026, 9, 2, 15, 30); // 2 Ekim 2026, öğleden sonra

  test("dueStatus: geçmiş / bugün / yarın / bu hafta / uzak", () => {
    expect(dueStatus("2026-10-01", NOW)).toEqual({ state: "overdue", days: -1 });
    expect(dueStatus("2026-10-02", NOW)).toEqual({ state: "today", days: 0 });
    expect(dueStatus("2026-10-03", NOW)).toEqual({ state: "tomorrow", days: 1 });
    expect(dueStatus("2026-10-09", NOW)).toEqual({ state: "soon", days: 7 });
    expect(dueStatus("2026-10-10", NOW)).toEqual({ state: "later", days: 8 });
  });

  test("saat önemsiz: gün sınırı yereldir", () => {
    expect(dueStatus("2026-10-02", new Date(2026, 9, 2, 0, 0, 1)).state).toBe("today");
    expect(dueStatus("2026-10-02", new Date(2026, 9, 2, 23, 59, 59)).state).toBe("today");
  });

  test("bozuk girdi null", () => {
    expect(dueStatus("yarın", NOW)).toBeNull();
    expect(dueStatus(null, NOW)).toBeNull();
    expect(parseISODate("2026-13")).toBeNull();
  });

  test("dateOffsetISO: ay/yıl taşması ve sıfır dolgusu", () => {
    expect(dateOffsetISO(0, NOW)).toBe("2026-10-02");
    expect(dateOffsetISO(1, NOW)).toBe("2026-10-03");
    expect(dateOffsetISO(7, NOW)).toBe("2026-10-09");
    expect(dateOffsetISO(30, new Date(2026, 11, 20))).toBe("2027-01-19");
    expect(dateOffsetISO(1, new Date(2026, 0, 5))).toBe("2026-01-06");
  });
});

describe("countWords / isNoteEmpty", () => {
  test("kelime sayısı", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  merhaba   dünya \n yeni satır ")).toBe(4);
    expect(countWords(null)).toBe(0);
  });

  test("not: başlık da içerik de yoksa boş", () => {
    expect(isNoteEmpty({ type: "note", title: "  ", content: "\n" })).toBe(true);
    expect(isNoteEmpty({ type: "note", title: "T", content: "" })).toBe(false);
    expect(isNoteEmpty({ type: "note", title: "", content: "x" })).toBe(false);
  });

  test("todo: başlık da dolu madde de yoksa boş", () => {
    expect(isNoteEmpty({ type: "todo", title: "", todos: [{ text: "  " }] })).toBe(true);
    expect(isNoteEmpty({ type: "todo", title: "", todos: [{ text: "süt" }] })).toBe(false);
    expect(isNoteEmpty({ type: "todo", title: "Liste", todos: [] })).toBe(false);
  });

  test("null girdi boş sayılır", () => {
    expect(isNoteEmpty(null)).toBe(true);
  });
});

describe("buildNoteColorPairs", () => {
  const palette = {
    blue: "#b", blueBackground: "#bb",
    green: "#g", greenBackground: "#gb",
    red: "#r", redBackground: "#rb",
    orange: "#o", orangeBackground: "#ob",
    yellow: "#y", yellowBackground: "#yb",
    purple: "#p", purpleBackground: "#pb",
    pink: "#k", pinkBackground: "#kb",
    aqua: "#a", aquaBackground: "#ab",
    teal: "#t", tealBackground: "#tb",
  };

  test("dokuz rengi her biri kendi zemin tonuyla eşleştirir", () => {
    const pairs = buildNoteColorPairs(palette);
    expect(pairs).toHaveLength(9);
    expect(pairs[0]).toEqual({ color: "#b", background: "#bb" });
    expect(pairs[8]).toEqual({ color: "#t", background: "#tb" });
    pairs.forEach((pair) => expect(pair.color).toBeTruthy());
  });

  test("renk seçicinin sırası sabit: mavi ilk, camgöbeği/teal son", () => {
    expect(buildNoteColorPairs(palette).map((p) => p.color)).toEqual([
      "#b", "#g", "#r", "#o", "#y", "#p", "#k", "#a", "#t",
    ]);
  });
});

describe("sekme çubuğu geometrisi", () => {
  test("segmentWidth: dolgu ve çerçeve düşülüp sekme sayısına bölünür", () => {
    // 343 pt çubuk, 4+4 dolgu, 3 sekme → (343 - 8) / 3
    expect(segmentWidth(343, 3)).toBeCloseTo((343 - TAB_BAR_PADDING * 2) / 3, 5);
    expect(segmentWidth(343, 3, 0.5)).toBeCloseTo((343 - TAB_BAR_PADDING * 2 - 1) / 3, 5);
  });

  test("segmentWidth: ölçülmemiş / geçersiz girdide 0 (hap çizilmez)", () => {
    expect(segmentWidth(0, 3)).toBe(0);
    expect(segmentWidth(undefined, 3)).toBe(0);
    expect(segmentWidth(300, 0)).toBe(0);
    expect(segmentWidth(4, 3)).toBe(0);
  });

  test("badgeLabel: 99'a kadar sayı, üstü 99+ (rozet genişlemez)", () => {
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(99)).toBe("99");
    expect(badgeLabel(100)).toBe("99+");
    expect(badgeLabel(2500)).toBe("99+");
  });

  test("tabDirection: ilerlerken +1, geri dönerken -1, bilinmeyende +1", () => {
    const order = ["note", "todo", "media"];
    expect(tabDirection(order, "note", "todo")).toBe(1);
    expect(tabDirection(order, "note", "media")).toBe(1);
    expect(tabDirection(order, "media", "todo")).toBe(-1);
    expect(tabDirection(order, "todo", "note")).toBe(-1);
    expect(tabDirection(order, "todo", "todo")).toBe(1);
    expect(tabDirection(order, "x", "todo")).toBe(1);
  });
});
