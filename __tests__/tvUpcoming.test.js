// __tests__/tvUpcoming.test.js
//
// "Yaklaşan Diziler" sorgusunun saf çekirdeği (utils/tvUpcoming.js): her aralık doğru pencereye,
// sıralama hep popülerliğe, `include_adult` hiç yazılmaz (ayarı tmdbAdultGuard uygular).

import {
  DEFAULT_TV_UPCOMING_RANGE,
  TMDB_DISCOVER_TV,
  TV_UPCOMING_RANGES,
  buildTvUpcomingParams,
  buildTvUpcomingUrl,
  normalizeTvUpcomingRange,
  tvUpcomingQuerySignature,
} from "../utils/tvUpcoming";

// 29 Eki 2026 öğlen: pencere yarından (30 Eki) başlar.
const NOW = new Date(2026, 9, 29, 12, 0, 0);
const params = (range, extra = {}) => buildTvUpcomingParams({ range, language: "tr-TR", now: NOW, ...extra });

describe("tvUpcoming", () => {
  test("çipler filmlerin hazır aralıklarıyla aynı; varsayılan 3 ay", () => {
    expect(TV_UPCOMING_RANGES).toEqual(["7d", "1m", "3m", "6m", "1y", "all"]);
    expect(DEFAULT_TV_UPCOMING_RANGE).toBe("3m");
    expect(normalizeTvUpcomingRange("1y")).toBe("1y");
    expect(normalizeTvUpcomingRange("calendarMonth")).toBe("3m");
    expect(normalizeTvUpcomingRange(undefined)).toBe("3m");
  });

  test.each([
    ["7d", "2026-11-06"],
    ["1m", "2026-11-30"],
    ["3m", "2027-01-30"],
    ["6m", "2027-04-30"],
    ["1y", "2027-10-30"],
  ])("%s → yarından %s'e kadar ilk yayın", (range, lte) => {
    const p = params(range);
    expect(p["first_air_date.gte"]).toBe("2026-10-30");
    expect(p["first_air_date.lte"]).toBe(lte);
    expect(p.sort_by).toBe("popularity.desc");
    expect(p.include_null_first_air_dates).toBe("false");
  });

  test("Tümü: üst sınır yok; bilinmeyen aralık varsayılana düşer", () => {
    expect(params("all")).not.toHaveProperty("first_air_date.lte");
    expect(params("bozuk")["first_air_date.lte"]).toBe(params("3m")["first_air_date.lte"]);
  });

  test("URL discover/tv; include_adult ve bölge yazılmaz", () => {
    const url = buildTvUpcomingUrl({ range: "1m", language: "tr-TR", now: NOW, page: 2 });
    expect(url.startsWith(`${TMDB_DISCOVER_TV}?`)).toBe(true);
    expect(url).toContain("page=2");
    expect(url).toContain("language=tr-TR");
    expect(url).not.toContain("include_adult");
    expect(url).not.toContain("region");
  });

  test("sayfa geçersizse 1; imza sayfadan bağımsız, aralık ve dile bağlı", () => {
    expect(params("1m", { page: 0 }).page).toBe(1);
    expect(params("1m", { page: "x" }).page).toBe(1);
    const sig = (range, language = "tr-TR") => tvUpcomingQuerySignature({ range, language, now: NOW });
    expect(sig("1m")).toBe(tvUpcomingQuerySignature({ range: "1m", language: "tr-TR", now: NOW, page: 5 }));
    expect(sig("1m")).not.toContain("page=");
    expect(sig("1m")).not.toBe(sig("3m"));
    expect(sig("1m")).not.toBe(sig("1m", "en-US"));
  });
});
