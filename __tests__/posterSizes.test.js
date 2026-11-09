// Raf poster boyutu üç kademe (Varsayılan · Küçük · Daha küçük) — utils/posterSizes tek kaynak.
const fs = require("fs");
const path = require("path");
const {
  POSTER_SIZES,
  isPosterSize,
  posterSizeScale,
  posterBadgeScale,
  railPosterWidth,
  detailRailItemWidth,
} = require("../utils/posterSizes");

const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

describe("posterSizes", () => {
  it("üç kademe, eski iki değer korunur", () => {
    expect(POSTER_SIZES).toEqual(["normal", "small", "xsmall"]);
    expect(isPosterSize("xsmall")).toBe(true);
    expect(isPosterSize("tiny")).toBe(false);
  });

  it("çarpanlar küçükten küçüğe iner; eski Küçük ×0.85 aynı", () => {
    expect(posterSizeScale("normal")).toBe(1);
    expect(posterSizeScale("small")).toBe(0.85);
    expect(posterSizeScale("xsmall")).toBeLessThan(0.85);
    expect(posterSizeScale(undefined)).toBe(1);
    expect(posterBadgeScale("small")).toBe(0.82);
    expect(posterBadgeScale("xsmall")).toBeLessThan(0.82);
  });

  it("raf ve detay genişlikleri ayarı izler", () => {
    expect(railPosterWidth(400, "normal")).toBe(160);
    expect(railPosterWidth(400, "small")).toBeCloseTo(136);
    expect(detailRailItemWidth(400, "normal")).toBe(152);
    expect(detailRailItemWidth(400, "xsmall")).toBeLessThan(detailRailItemWidth(400, "small"));
  });

  it("registry ve context elle yazılmış süzgeç kullanmaz (yeni kademe yutulmasın)", () => {
    expect(read("services/storage/registry.js")).toMatch(/oneOf\(\.\.\.POSTER_SIZES\)/);
    const ctx = read("context/AppSettingsContext.js");
    expect(ctx).toMatch(/if \(!isPosterSize\(size\)\) return;/);
    expect(ctx).not.toMatch(/size !== "small"/);
  });

  it("detay sayfası Önerilen/Seri rafları ve oyuncu filmografisi boyutu izler", () => {
    expect(read("screens/movie/MovieDetail.js")).toMatch(/detailRailItemWidth\(width, railPosterSize\)/);
    expect(read("screens/tv/TvShowsDetails.js")).toMatch(/detailRailItemWidth\(width, railPosterSize\)/);
    expect(read("screens/actor/ActorViewScreen.js")).toMatch(/posterSizeScale\(railPosterSize\)/);
  });
});
