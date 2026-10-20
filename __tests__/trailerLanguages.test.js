import {
  buildTrailerLanguageOrder,
  normalizeTrailerLanguageCode,
  trailerLanguageOf,
} from "../utils/trailerLanguages";

describe("trailer language ordering", () => {
  test("puts app/selected language first, English second and original language third", () => {
    expect(
      buildTrailerLanguageOrder({
        originalLanguage: "de",
        appLanguage: "tr",
        selectedLanguage: "tr",
      }),
    ).toEqual(["tr", "en", "de"]);
  });

  test("deduplicates the original and app language", () => {
    expect(
      buildTrailerLanguageOrder({
        originalLanguage: "en-US",
        appLanguage: "en",
        selectedLanguage: "fr",
      }),
    ).toEqual(["en", "fr"]);
  });

  test("handles Turkish app with English movie correctly", () => {
    expect(
      buildTrailerLanguageOrder({
        originalLanguage: "en",
        appLanguage: "tr",
        selectedLanguage: "tr",
      }),
    ).toEqual(["tr", "en"]);
  });

  test("handles Turkish app with Turkish movie correctly", () => {
    expect(
      buildTrailerLanguageOrder({
        originalLanguage: "tr",
        appLanguage: "tr",
        selectedLanguage: "tr",
      }),
    ).toEqual(["tr", "en"]);
  });

  test("handles English app with foreign movie correctly", () => {
    expect(
      buildTrailerLanguageOrder({
        originalLanguage: "ko",
        appLanguage: "en",
        selectedLanguage: "en",
      }),
    ).toEqual(["en", "ko"]);
  });

  test("keeps a manually selected language after the primary choices", () => {
    expect(
      buildTrailerLanguageOrder({
        originalLanguage: "ja",
        appLanguage: "tr",
        selectedLanguage: "de",
      }),
    ).toEqual(["tr", "en", "ja", "de"]);
  });

  test("keeps an otherwise unsupported ISO language selectable", () => {
    expect(normalizeTrailerLanguageCode("fa-IR")).toBe("fa");
    expect(trailerLanguageOf("fa")).toEqual({ code: "fa", region: "fa", label: "FA" });
  });
});
