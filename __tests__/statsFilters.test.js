// __tests__/statsFilters.test.js
//
// Film / Dizi istatistik filtre penceresinin saf mantığı (utils/statsFilters).
// Asıl risk: tarih seçimi artık yıl / ay / gün olabilir ve bölüm filtresi bir
// ÖNEK karşılaştırması — "2025-03" seçiliyken "2025-031" ya da "2025-1" gibi
// yakın dizgeler yanlışlıkla içeri girmemeli.

const {
  matchesDateFilter,
  dateFilterParent,
  countByDate,
  buildDateTree,
  monthNames,
  describeDateFilter,
  normalizeGenres,
  planGenreChips,
} = require("../utils/statsFilters");

describe("matchesDateFilter", () => {
  it("seçim yoksa her bölüm geçer", () => {
    expect(matchesDateFilter("2025-03-14", null)).toBe(true);
    expect(matchesDateFilter("", null)).toBe(true);
    expect(matchesDateFilter("2025-03-14", undefined)).toBe(true);
  });

  it("yıl / ay / gün öneki eşleşir", () => {
    expect(matchesDateFilter("2025-03-14", "2025")).toBe(true);
    expect(matchesDateFilter("2025-03-14", "2025-03")).toBe(true);
    expect(matchesDateFilter("2025-03-14", "2025-03-14")).toBe(true);
  });

  it("başka yıl / ay / gün eşleşmez", () => {
    expect(matchesDateFilter("2024-03-14", "2025")).toBe(false);
    expect(matchesDateFilter("2025-04-14", "2025-03")).toBe(false);
    expect(matchesDateFilter("2025-03-15", "2025-03-14")).toBe(false);
  });

  it("yarım sınırda yakalanmaz (2025-1 ≠ 2025-10, 202 ≠ 2025)", () => {
    expect(matchesDateFilter("2025-10-02", "2025-1")).toBe(false);
    expect(matchesDateFilter("2025-03-14", "202")).toBe(false);
  });

  it("tarihsiz ('Eski Kayıtlar') bölüm hiçbir aralığa girmez", () => {
    expect(matchesDateFilter("", "2025")).toBe(false);
    expect(matchesDateFilter(undefined, "2025")).toBe(false);
  });
});

describe("dateFilterParent", () => {
  it("gün → ay → yıl → null", () => {
    expect(dateFilterParent("2025-03-14")).toBe("2025-03");
    expect(dateFilterParent("2025-03")).toBe("2025");
    expect(dateFilterParent("2025")).toBeNull();
    expect(dateFilterParent(null)).toBeNull();
  });
});

describe("countByDate", () => {
  it("gün başına öğe sayısını verir, boş başlığı atlar", () => {
    expect(
      countByDate([
        { title: "2025-03-14", data: [1, 2, 3] },
        { title: "2025-03-15", data: [1] },
        { title: "", data: [1, 2] },
        { title: "2025-03-14", data: [4] },
      ]),
    ).toEqual({ "2025-03-14": 4, "2025-03-15": 1 });
    expect(countByDate(undefined)).toEqual({});
  });
});

describe("buildDateTree", () => {
  const dates = [
    "2025-03-14",
    "2024-12-31",
    "2025-03-02",
    "2025-11-05",
    "2025-03-14", // tekrar
    "bozuk",
    "2025-13-01", // geçersiz ay
    "2025-02-00", // geçersiz gün
  ];
  const counts = { "2025-03-14": 3, "2025-03-02": 1, "2025-11-05": 2, "2024-12-31": 5 };

  it("yıllar yeniden eskiye, aylar ve günler artan sırada", () => {
    const tree = buildDateTree(dates, counts);
    expect(tree.map((y) => y.key)).toEqual(["2025", "2024"]);
    expect(tree[0].months.map((m) => m.key)).toEqual(["2025-03", "2025-11"]);
    expect(tree[0].months[0].days.map((d) => d.day)).toEqual([2, 14]);
  });

  it("sayaçlar günden aya, aydan yıla toplanır; tekrar iki kez sayılmaz", () => {
    const tree = buildDateTree(dates, counts);
    expect(tree[0].months[0].count).toBe(4);
    expect(tree[0].count).toBe(6);
    expect(tree[1].count).toBe(5);
  });

  it("geçersiz tarihler ağaca girmez", () => {
    const keys = buildDateTree(dates, counts).flatMap((y) =>
      y.months.flatMap((m) => m.days.map((d) => d.key)),
    );
    expect(keys.sort()).toEqual(
      ["2024-12-31", "2025-03-02", "2025-03-14", "2025-11-05"].sort(),
    );
  });

  it("sayaç verilmezse her gün 1 sayılır", () => {
    const tree = buildDateTree(["2025-03-14", "2025-03-15"]);
    expect(tree[0].count).toBe(2);
    expect(tree[0].months[0].days.map((d) => d.count)).toEqual([1, 1]);
  });

  it("boş / eksik girdide patlamaz", () => {
    expect(buildDateTree()).toEqual([]);
    expect(buildDateTree(null, null)).toEqual([]);
  });

  it("yüzlerce gün tek geçişte gruplanır (yıllarca kullanım)", () => {
    const many = [];
    for (let year = 2018; year <= 2025; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        for (let day = 1; day <= 28; day += 3) {
          many.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
        }
      }
    }
    const tree = buildDateTree(many);
    expect(tree).toHaveLength(8);
    expect(tree[0].months).toHaveLength(12);
    // Pencerede en çok 8 yıl çipi + 12 ay + ≤10 gün görünür (>900 çip yerine).
    expect(tree[0].months[0].days.length).toBeLessThanOrEqual(10);
  });
});

describe("monthNames / describeDateFilter", () => {
  it("12 ay adı döner, ilk harf büyük, sondaki nokta yok", () => {
    for (const locale of ["tr-TR", "en-US", "es-ES", "pt-BR"]) {
      const names = monthNames(locale, "short");
      expect(names).toHaveLength(12);
      names.forEach((name) => {
        expect(name.length).toBeGreaterThan(0);
        expect(name.endsWith(".")).toBe(false);
        expect(name.charAt(0)).toBe(name.charAt(0).toLocaleUpperCase(locale));
      });
    }
  });

  it("yıl olduğu gibi, ay 'Ay Yıl', gün formatlayıcıya gider", () => {
    expect(describeDateFilter(null)).toBe("");
    expect(describeDateFilter("2025")).toBe("2025");
    const month = describeDateFilter("2025-03", { locale: "en-US" });
    expect(month).toMatch(/March/);
    expect(month).toMatch(/2025/);
    expect(describeDateFilter("2025-03-14", { formatDay: (d) => `<${d}>` })).toBe("<2025-03-14>");
    expect(describeDateFilter("2025-03-14")).toBe("2025-03-14");
  });
});

describe("planGenreChips", () => {
  const genres = Array.from({ length: 14 }, (_, i) => ({ name: `T${i}`, count: 100 - i }));

  it("az türde hepsi görünür, katlama düğmesi yok", () => {
    const plan = planGenreChips(genres.slice(0, 6), null, false, 8);
    expect(plan.visible).toHaveLength(6);
    expect(plan.hiddenCount).toBe(0);
    expect(plan.canCollapse).toBe(false);
  });

  it("çok türde ilk 8 görünür, kalanı sayılır", () => {
    const plan = planGenreChips(genres, null, false, 8);
    expect(plan.visible.map((g) => g.name)).toEqual(genres.slice(0, 8).map((g) => g.name));
    expect(plan.hiddenCount).toBe(6);
  });

  it("seçili tür sıra dışı olsa da görünür kalır", () => {
    const plan = planGenreChips(genres, "T12", false, 8);
    expect(plan.visible.map((g) => g.name)).toContain("T12");
    expect(plan.hiddenCount).toBe(5);
  });

  it("açılınca hepsi görünür ve geri katlanabilir", () => {
    const plan = planGenreChips(genres, null, true, 8);
    expect(plan.visible).toHaveLength(14);
    expect(plan.hiddenCount).toBe(0);
    expect(plan.canCollapse).toBe(true);
  });

  it("düz ad dizisi de kabul edilir (sayaçsız)", () => {
    expect(normalizeGenres(["Dram", "", null, { name: "Komedi", count: 3 }])).toEqual([
      { name: "Dram", count: null },
      { name: "Komedi", count: 3 },
    ]);
  });
});
