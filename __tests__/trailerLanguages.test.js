import {
  buildTrailerLanguageOrder,
  normalizeTrailerLanguageCode,
  trailerLanguageOf,
} from "../utils/trailerLanguages";

describe("trailer language ordering", () => {
  test("puts original first, English second and app language third", () => {
    expect(
      buildTrailerLanguageOrder({
        originalLanguage: "de",
        appLanguage: "tr",
        selectedLanguage: "de",
      }),
    ).toEqual(["de", "en", "tr"]);
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

  test("keeps a manually selected language after the three quick choices", () => {
    expect(
      buildTrailerLanguageOrder({
        originalLanguage: "ja",
        appLanguage: "tr",
        selectedLanguage: "de",
      }),
    ).toEqual(["ja", "en", "tr", "de"]);
  });

  test("keeps an otherwise unsupported ISO language selectable", () => {
    expect(normalizeTrailerLanguageCode("fa-IR")).toBe("fa");
    expect(trailerLanguageOf("fa")).toEqual({ code: "fa", region: "fa", label: "FA" });
  });
});
