// __tests__/posterCorners.test.js
//
// Poster köşe kademeleri (utils/posterCorners): beş kademe, eski üç değer korunur,
// en yakın kademe / alanlar arası eşleme / döngü ve registry doğrulaması tek kaynaktan.

import {
  POSTER_CORNER_LEVELS,
  POSTER_CORNER_SCALES,
  nextPosterCorner,
  posterCornerIndex,
  trendPosterRadius,
  detailPosterRadius,
  posterCornerFactor,
  scalePosterCorner,
  posterCornerLevel,
  posterCornerValueAt,
} from "../utils/posterCorners";
import fs from "fs";
import path from "path";
import { Keys } from "../services/storage/registry";

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

describe("posterCorners", () => {
  test("beş kademe, köşeliden yuvarlağa artan; eski kayıtlı değerler hâlâ geçerli kademe", () => {
    expect(POSTER_CORNER_LEVELS).toEqual(["sharp", "subtle", "normal", "soft", "round"]);
    for (const values of Object.values(POSTER_CORNER_SCALES)) {
      expect(values).toHaveLength(5);
      expect([...values].sort((a, b) => a - b)).toEqual([...values]);
    }
    // 1.5.0 ve öncesinin üç kademesi: aynı adlarla kalır (göç yok).
    expect([2, 10, 20].map((v) => posterCornerLevel("grid", v))).toEqual(["sharp", "normal", "round"]);
    expect([4, 15, 24].map((v) => posterCornerLevel("rail", v))).toEqual(["sharp", "normal", "soft"]);
  });

  test("en yakın kademe; sayı olmayan değer 'normal'", () => {
    expect(posterCornerIndex("grid", 12)).toBe(2);
    expect(posterCornerIndex("grid", 17)).toBe(3);
    expect(posterCornerIndex("grid", 99)).toBe(4);
    expect(posterCornerIndex("rail", 0)).toBe(0);
    expect(posterCornerIndex("grid", undefined)).toBe(2);
    expect(posterCornerIndex("grid", "x")).toBe(2);
  });

  test("aynı kademe diğer alana kendi ölçeğinden çevrilir", () => {
    expect(posterCornerValueAt("rail", posterCornerIndex("grid", 20))).toBe(32);
    expect(posterCornerValueAt("grid", posterCornerIndex("rail", 9))).toBe(6);
    expect(posterCornerValueAt("grid", 9)).toBe(20); // sınıra kırpılır
  });

  test("tek düğmeli seçici: sıradaki kademe, sonuncudan sonra başa döner", () => {
    expect(nextPosterCorner("grid", 2)).toBe(6);
    expect(nextPosterCorner("grid", 15)).toBe(20);
    expect(nextPosterCorner("grid", 20)).toBe(2);
  });

  test("registry yalnız bu beş değeri kabul eder", () => {
    for (const [key, scale] of [
      ["listsPosterRadius", "grid"],
      ["seeAllPosterRadius", "grid"],
      ["railPosterRadius", "rail"],
      ["funPosterRadius", "grid"],
      ["libraryPosterRadius", "grid"],
    ]) {
      POSTER_CORNER_SCALES[scale].forEach((v) => expect(Keys[key].validate(v)).toBe(true));
      expect(Keys[key].validate(7)).toBe(false);
      expect(Keys[key].validate(999)).toBe(false);
    }
  });

  test("ayar kaydedicisi beş değeri de kabul eder (eski üçlü 'n !== 2 && …' süzgeci yeni kademeleri yutuyordu)", () => {
    const src = read("context/AppSettingsContext.js");
    for (const name of ["changeListsPosterRadius", "changeSeeAllPosterRadius", "changeRailPosterRadius"]) {
      const body = src.match(new RegExp(String.raw`const ${name} = useCallback\(\(n\) => \{([\s\S]*?)\}, \[\]\);`));
      expect(body).not.toBeNull();
      expect(body[1]).toMatch(/POSTER_CORNER_SCALES\.(grid|rail)\.includes\(n\)/);
      expect(body[1]).not.toMatch(/n !== \d/);
    }
  });

  test("Trendler kartı raf köşesini izler; varsayılanda eski 25", () => {
    expect(trendPosterRadius(15)).toBe(25);
    expect(trendPosterRadius(4)).toBe(7);
    expect(trendPosterRadius(32)).toBe(53);
    expect(trendPosterRadius(undefined)).toBe(25);
    for (const file of ["screens/movie/MovieTrends.js", "screens/tv/TvShowsTrends.js"]) {
      const src = read(file);
      expect(src).toMatch(/borderRadius: cardRadius/);
      expect(src).not.toMatch(/borderRadius: 25/);
    }
  });

  test("detay sayfası posterleri (ana poster + Önerilen/Seri rafı) raf köşesini izler; varsayılanda eski 14", () => {
    expect(detailPosterRadius(15)).toBe(14);
    expect(detailPosterRadius(4)).toBe(4);
    expect(detailPosterRadius(32)).toBe(30);
    for (const file of ["screens/movie/MovieDetail.js", "screens/tv/TvShowsDetails.js"]) {
      const src = read(file);
      expect(src).toMatch(/styles\.poster, \{ borderRadius: mainPosterRadius/);
      expect(src).toMatch(/styles\.noPoster, \{ borderRadius: mainPosterRadius/);
      expect(src).toMatch(/styles\.railPoster, \{ borderRadius: posterRadius/);
    }
  });

  test("göreli alanlar: Normal her yüzeyi kendi köşesinde bırakır, diğer kademeler oranla", () => {
    expect(posterCornerFactor(10)).toBe(1);
    expect(posterCornerFactor(undefined)).toBe(1);
    expect(posterCornerFactor(2)).toBe(0.2);
    expect(scalePosterCorner(18, 10)).toBe(18);
    expect(scalePosterCorner(8, 20)).toBe(16);
    expect(scalePosterCorner(6, 2)).toBe(1); // 1.2 → yarım noktaya
    expect(scalePosterCorner(3, 15)).toBe(4.5);
    expect(Keys.funPosterRadius.default).toBe(10);
    expect(Keys.libraryPosterRadius.default).toBe(10);
  });
});
