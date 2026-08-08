// __tests__/watchState.test.js
//
// "İzlendi" kapısı — asıl kapatılan boşluk BOŞ TARİH. Eskiden yalnız ileri
// tarihli içerik engelleniyor, tarihi hiç olmayan (TMDB'de henüz girilmemiş)
// yapımlar "sorun yok" tarafına düşüp izleme kaydı yazabiliyordu; izleme süresi,
// rozet ve Wrapped hesapları da bundan besleniyor. Bu test o boşluğun geri
// gelmesini engeller.
import {
  assertWatchable,
  canMarkWatched,
  getReleaseState,
  RELEASE_STATE,
  WATCH_BLOCKED,
} from "../utils/watchState";

const gecmis = "2001-05-10";
const ileri = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().slice(0, 10);
};

describe("getReleaseState", () => {
  test("geçmiş tarih yayınlandı, ileri tarih planlı sayılır", () => {
    expect(getReleaseState(gecmis)).toBe(RELEASE_STATE.RELEASED);
    expect(getReleaseState(ileri())).toBe(RELEASE_STATE.SCHEDULED);
  });

  test("tarih yok/geçersizse bilinmiyor — 'sorun yok' DEĞİL", () => {
    expect(getReleaseState("")).toBe(RELEASE_STATE.UNKNOWN);
    expect(getReleaseState(null)).toBe(RELEASE_STATE.UNKNOWN);
    expect(getReleaseState(undefined)).toBe(RELEASE_STATE.UNKNOWN);
    expect(getReleaseState("-")).toBe(RELEASE_STATE.UNKNOWN);
  });

  test("tarih yokken TMDB durumu yayınlandı diyorsa kilit açılır", () => {
    expect(getReleaseState("", "Released")).toBe(RELEASE_STATE.RELEASED);
    expect(getReleaseState("", "Ended")).toBe(RELEASE_STATE.RELEASED);
    expect(getReleaseState("", "returning series")).toBe(RELEASE_STATE.RELEASED);
  });

  test("yayınlanmamış durumlar tarihi kurtarmaz", () => {
    for (const status of ["Planned", "In Production", "Post Production", "Rumored", "Canceled"]) {
      expect(getReleaseState("", status)).toBe(RELEASE_STATE.UNKNOWN);
    }
  });

  test("tarih varsa durum alanı sonucu DEĞİŞTİRMEZ", () => {
    // Vizyon tarihi ileride ama TMDB durumu "Released" kalmış olabilir.
    expect(getReleaseState(ileri(), "Released")).toBe(RELEASE_STATE.SCHEDULED);
  });
});

describe("canMarkWatched / assertWatchable", () => {
  test("yalnız yayınlanmış içerik işaretlenebilir", () => {
    expect(canMarkWatched(gecmis)).toBe(true);
    expect(canMarkWatched(ileri())).toBe(false);
    expect(canMarkWatched("")).toBe(false);
  });

  test("engel gerekçesi error.code ile taşınır", () => {
    expect(() => assertWatchable(gecmis)).not.toThrow();

    expect.assertions(3);
    try {
      assertWatchable(ileri());
    } catch (error) {
      expect(error.code).toBe(WATCH_BLOCKED.UNRELEASED);
    }
    try {
      assertWatchable("");
    } catch (error) {
      expect(error.code).toBe(WATCH_BLOCKED.UNKNOWN_DATE);
    }
  });
});
