// __tests__/seasonRuntime.test.js
//
// Sezon detayındaki toplam süre rozeti: bölüm sürelerinin toplamı (utils/seasonRuntime) ve rozetin
// sezon başlığına bağlı olduğu (kaynak bekçisi; ekranın kendisi ağ + çok bağlam ister).

const fs = require("fs");
const path = require("path");
const { seasonRuntime } = require("../utils/seasonRuntime");

describe("seasonRuntime", () => {
  test("bölüm sürelerini toplar", () => {
    expect(seasonRuntime([{ runtime: 45 }, { runtime: 52 }, { runtime: 61.4 }])).toEqual({ minutes: 158, partial: false });
  });

  test("süresi bilinmeyen bölüm toplamı eksik bırakır → partial", () => {
    expect(seasonRuntime([{ runtime: 45 }, { runtime: null }, {}])).toEqual({ minutes: 45, partial: true });
    expect(seasonRuntime([{ runtime: 45 }, { runtime: 0 }])).toEqual({ minutes: 45, partial: true });
  });

  test("hiç süre yoksa ya da liste bozuksa 0 (rozet çizilmez)", () => {
    expect(seasonRuntime([{ runtime: null }, { runtime: "x" }])).toEqual({ minutes: 0, partial: false });
    expect(seasonRuntime([])).toEqual({ minutes: 0, partial: false });
    expect(seasonRuntime(undefined)).toEqual({ minutes: 0, partial: false });
  });

  test("rozet sezon başlığındaki tarih/bölüm satırında, bölüm rozetiyle aynı 'dakika' etiketiyle", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "screens", "tv", "SeasonDetails.js"), "utf8");
    const row = src.slice(src.indexOf("styles.metaRow"), src.indexOf("── Puan"));
    expect(row).toMatch(/seasonTotal\.minutes > 0 &&/);
    expect(row).toMatch(/\{seasonTotal\.partial \? "\+" : ""\} \{t\.time\}/);
    expect(src).toMatch(/const seasonTotal = seasonRuntime\(details\?\.episodes\)/);
  });
});
