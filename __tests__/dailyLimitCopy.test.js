// Günlük izleme sınırı metinleri (utils/dailyLimitCopy.js) ve hata metnine bağlanması
// (utils/libraryErrorText.js): kullanıcı ham kimlik, "undefined" ya da doldurulmamış
// {yer tutucu} görmemeli; dil tabloda yoksa İngilizceye düşmeli.

jest.mock("@components/AppToast", () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock("../services/crashReporting", () => ({ captureError: jest.fn() }));
jest.mock("../translations", () => ({ __esModule: true, default: { language: "tr", t: (_k, o) => o?.defaultValue } }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_k, fallback) => fallback }));

const Toast = require("@components/AppToast").default;
const { captureError } = require("../services/crashReporting");
const copyModule = require("../utils/dailyLimitCopy");
const { LibraryError, LIBRARY_ERROR } = require("../utils/libraryCore");
const { libraryErrorMessage, showLibraryError, showWatchSpreadNotice } = require("../utils/libraryErrorText");

const { DAILY_LIMIT_COPY, dailyLimitMessage, dailySpreadNotice, formatMinutes, formatDay } = copyModule;
const LANGUAGES = ["tr", "en", "es", "pt", "de"];

beforeEach(() => jest.clearAllMocks());

describe("formatMinutes", () => {
  const copy = DAILY_LIMIT_COPY.tr;
  it("saat ve dakikayı birleştirir", () => {
    expect(formatMinutes(200, copy)).toBe("3 sa 20 dk");
    expect(formatMinutes(120, copy)).toBe("2 sa");
    expect(formatMinutes(45, copy)).toBe("45 dk");
    expect(formatMinutes(0, copy)).toBe("0 dk");
    expect(formatMinutes(-5, copy)).toBe("0 dk");
    expect(formatMinutes(undefined, copy)).toBe("0 dk");
  });
});

describe("formatDay", () => {
  it("geçerli günü okunur yazar, geçersizi olduğu gibi bırakır", () => {
    expect(formatDay("2026-10-22", "en")).toMatch(/2026/);
    expect(formatDay("bozuk", "en")).toBe("bozuk");
    expect(formatDay(null, "en")).toBe("");
  });
});

describe.each(LANGUAGES)("%s mesajları", (language) => {
  const placeholder = /\{[a-z]+\}/;

  it("dolu gün: gün, kalan ve istenen süre yazılır; yer tutucu kalmaz", () => {
    const text = dailyLimitMessage({ reason: "full", day: "2026-10-22", remaining: 200, requested: 300 }, language);
    expect(text).not.toMatch(placeholder);
    expect(text).toMatch(/2026/);
    expect(text).not.toMatch(/undefined|NaN/);
  });

  it("gün tamamen doluysa 'kalan' cümlesi kurulmaz", () => {
    const text = dailyLimitMessage({ reason: "full", day: "2026-10-22", remaining: 0, requested: 30 }, language);
    expect(text).not.toMatch(placeholder);
    expect(text).toBe(
      DAILY_LIMIT_COPY[language].fullNone.replace("{day}", formatDay("2026-10-22", language)),
    );
  });

  it("yayılma sınırı aşıldı: süre ve gün sayısı yazılır", () => {
    const text = dailyLimitMessage({ reason: "span", requested: 5000, days: 366 }, language);
    expect(text).not.toMatch(placeholder);
    expect(text).toContain("366");
  });

  it("yayılma bildirimi: başlık + aralık", () => {
    const notice = dailySpreadNotice({ days: 4, startDate: "2026-02-07", endDate: "2026-02-10" }, language);
    expect(notice.title).toBe(DAILY_LIMIT_COPY[language].spreadTitle);
    expect(notice.body).not.toMatch(placeholder);
    expect(notice.body).toContain("4");
  });
});

describe("dailySpreadNotice", () => {
  it("yayılma yoksa bildirim yok", () => {
    expect(dailySpreadNotice(null, "tr")).toBeNull();
    expect(dailySpreadNotice({ days: 1, startDate: "2026-02-10", endDate: "2026-02-10" }, "tr")).toBeNull();
  });
  it("bilinmeyen dil İngilizceye düşer", () => {
    const notice = dailySpreadNotice({ days: 2, startDate: "2026-02-09", endDate: "2026-02-10" }, "xx");
    expect(notice.title).toBe(DAILY_LIMIT_COPY.en.spreadTitle);
  });
});

describe("libraryErrorText bağlantısı", () => {
  const limitError = (details) => new LibraryError(LIBRARY_ERROR.DAILY_LIMIT, "x", { details });

  it("DAILY_LIMIT kodu günlük sınır metnine çevrilir (genel 'işlem tamamlanamadı' DEĞİL)", () => {
    const text = libraryErrorMessage(limitError({ reason: "full", day: "2026-10-22", remaining: 60, requested: 90 }));
    expect(text).toMatch(/24 saat/);
    expect(text).not.toBe("İşlem tamamlanamadı");
  });

  it("beklenen bir sonuçtur: hata raporlanmaz, toast gösterilir", () => {
    showLibraryError(limitError({ reason: "full", day: "2026-10-22", remaining: 0, requested: 10 }), { source: "t" });
    expect(captureError).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  it("showWatchSpreadNotice yayılmayı bilgi olarak gösterir; yayılma yoksa false döner", () => {
    expect(showWatchSpreadNotice({ spread: null })).toBe(false);
    expect(showWatchSpreadNotice(undefined)).toBe(false);
    expect(Toast.show).not.toHaveBeenCalled();
    expect(showWatchSpreadNotice({ spread: { days: 3, startDate: "2026-02-08", endDate: "2026-02-10" } })).toBe(true);
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "info", text1: expect.any(String), text2: expect.any(String) }));
  });
});
