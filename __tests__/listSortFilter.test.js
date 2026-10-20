// __tests__/listSortFilter.test.js
// "Sırala ve filtrele" sayfasının saf kararları (utils/listSortFilter) + metin tabloları.

const {
  SORT_DEFAULT_DIR,
  collapseChips,
  countActiveFilters,
  nextSort,
  radiusKeyOf,
} = require("../utils/listSortFilter");
const { LIST_SORT_FILTER_COPY, fillSortFilterCopy } = require("../utils/listSortFilterCopy");

describe("nextSort", () => {
  it("liste sırasına basmak yönü sıfırlar", () => {
    expect(nextSort({ key: "name", dir: "asc" }, "default")).toEqual({ key: "default", dir: "desc" });
  });

  it("seçili düğmeye yeniden basmak yönü çevirir", () => {
    expect(nextSort({ key: "name", dir: "asc" }, "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextSort({ key: "name", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
  });

  it("başka düğme kendi doğal yönüyle başlar (ad A→Z, tarih/süre büyükten küçüğe)", () => {
    // Eskiden yön eldeki değerde kalıyordu: "İsim"e basınca Z→A gelirdi.
    expect(nextSort({ key: "default", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
    expect(nextSort({ key: "name", dir: "asc" }, "dateAdded")).toEqual({ key: "dateAdded", dir: "desc" });
    expect(nextSort({ key: "default", dir: "desc" }, "minutes")).toEqual({ key: "minutes", dir: "desc" });
    expect(nextSort({ key: "default", dir: "desc" }, "newest")).toEqual({ key: "newest", dir: "desc" });
    expect(SORT_DEFAULT_DIR.name).toBe("asc");
  });

  it("bilinmeyen anahtar / eksik durum güvenli", () => {
    expect(nextSort(undefined, "name")).toEqual({ key: "name", dir: "asc" });
    expect(nextSort({ key: "default" }, "yok")).toEqual({ key: "yok", dir: "desc" });
  });
});

describe("collapseChips", () => {
  const genres = Array.from({ length: 14 }, (_, i) => `T${i + 1}`);

  it("az çipte hiçbir şey gizlenmez", () => {
    expect(collapseChips(genres.slice(0, 8), [])).toEqual({ visible: genres.slice(0, 8), hiddenCount: 0 });
    expect(collapseChips([], [])).toEqual({ visible: [], hiddenCount: 0 });
    expect(collapseChips(undefined)).toEqual({ visible: [], hiddenCount: 0 });
  });

  it("çok çipte ilk 8 görünür, kalan sayı bildirilir", () => {
    const { visible, hiddenCount } = collapseChips(genres, []);
    expect(visible).toEqual(genres.slice(0, 8));
    expect(hiddenCount).toBe(6);
  });

  it("SEÇİLİ çip gizli bölgede olsa bile görünür kalır", () => {
    const { visible, hiddenCount } = collapseChips(genres, ["T12"]);
    expect(visible).toContain("T12");
    expect(visible).toHaveLength(9);
    expect(hiddenCount).toBe(5);
  });

  it("genişletilince hepsi görünür", () => {
    expect(collapseChips(genres, [], { expanded: true })).toEqual({ visible: genres, hiddenCount: 0 });
  });

  it("sınır ayarlanabilir", () => {
    expect(collapseChips(genres, [], { limit: 4 }).visible).toHaveLength(4);
  });
});

describe("countActiveFilters / radiusKeyOf", () => {
  it("yalnız süzgeçleri sayar", () => {
    expect(countActiveFilters({})).toBe(0);
    expect(
      countActiveFilters({ typeFilter: "movie", dateRange: "30", genres: ["Dram"], platformOnly: true, memberFilter: "u1" }),
    ).toBe(5);
    expect(countActiveFilters({ typeFilter: "all", dateRange: "all", genres: [], platformOnly: false, memberFilter: "all" })).toBe(0);
  });

  it("köşe yarıçapı en yakın seçeneğe oturur", () => {
    expect(radiusKeyOf(2)).toBe(2);
    expect(radiusKeyOf(10)).toBe(10);
    expect(radiusKeyOf(20)).toBe(20);
    expect(radiusKeyOf(12)).toBe(10);
    expect(radiusKeyOf(17)).toBe(20);
    expect(radiusKeyOf(undefined)).toBe(10);
    expect(radiusKeyOf("x")).toBe(10);
  });
});

describe("metinler", () => {
  it("her dilde tüm anahtarlar dolu ve yer tutucular var", () => {
    for (const copy of Object.values(LIST_SORT_FILTER_COPY)) {
      for (const key of ["title", "results", "showResults", "reset", "close", "sort", "asc", "desc", "view", "columns", "corners", "posterInfo", "moreChips", "lessChips"]) {
        expect(typeof copy[key]).toBe("string");
        expect(copy[key].length).toBeGreaterThan(0);
      }
      expect(copy.results).toContain("{n}");
      expect(copy.showResults).toContain("{n}");
      expect(copy.moreChips).toContain("{n}");
      for (const r of [2, 10, 20]) expect(copy.radius[r].length).toBeGreaterThan(0);
      for (const c of [3, 4]) expect(copy.columnsOption[c].length).toBeGreaterThan(0);
    }
  });

  it("fillSortFilterCopy doldurur", () => {
    expect(fillSortFilterCopy(LIST_SORT_FILTER_COPY.tr.showResults, 12)).toBe("12 sonuç göster");
    expect(fillSortFilterCopy(LIST_SORT_FILTER_COPY.en.moreChips, 4)).toBe("+4 more");
  });
});
