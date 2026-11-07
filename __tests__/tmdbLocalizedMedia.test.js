// Detay ekranı dil önceliği: seçili dil → İngilizce → TMDB varsayılanı (özgün/birincil).
const { localizeMediaDetails, pickLocalizedImagePath } = require("../utils/tmdbLocalizedMedia");
const { tmdbImageLanguageOrderOf, tmdbImageLanguagesOf } = require("../utils/appLanguages");

const img = (file_path, iso_639_1, vote_average = 5) => ({ file_path, iso_639_1, vote_average });

describe("pickLocalizedImagePath", () => {
  const images = [img("/en-low.jpg", "en", 3), img("/en-high.jpg", "en", 8), img("/ko.jpg", "ko", 9), img("/none.jpg", null, 10)];

  test("seçili dil varsa en beğenilen görseli", () => {
    expect(pickLocalizedImagePath([...images, img("/tr.jpg", "tr", 1)], ["tr", "en"], "/d.jpg")).toBe("/tr.jpg");
  });

  test("seçili dil yoksa İngilizcenin en beğenileni", () => {
    expect(pickLocalizedImagePath(images, ["tr", "en"], "/d.jpg")).toBe("/en-high.jpg");
  });

  test("ikisi de yoksa varsayılan; dilsiz görsel varsayılanın önüne geçmez", () => {
    expect(pickLocalizedImagePath([img("/ko.jpg", "ko"), img("/none.jpg", null)], ["tr", "en"], "/d.jpg")).toBe("/d.jpg");
    expect(pickLocalizedImagePath(undefined, ["tr", "en"], "/d.jpg")).toBe("/d.jpg");
  });
});

describe("localizeMediaDetails", () => {
  const translations = (rows) => ({ translations: rows.map(([iso_639_1, data]) => ({ iso_639_1, data })) });

  test("afiş ve arka plan öncelikle çözülür, girdi değişmez", () => {
    const details = {
      title: "T", poster_path: "/d.jpg", backdrop_path: "/db.jpg",
      images: { posters: [img("/en.jpg", "en")], backdrops: [img("/tr-b.jpg", "tr")] },
    };
    const out = localizeMediaDetails(details, "tr");
    expect(out.poster_path).toBe("/en.jpg");
    expect(out.backdrop_path).toBe("/tr-b.jpg");
    expect(details.poster_path).toBe("/d.jpg");
  });

  test("seçili dilde ad yoksa İngilizce ad (dizi: name)", () => {
    const out = localizeMediaDetails({
      name: "오징어 게임", original_name: "오징어 게임", original_language: "ko",
      translations: translations([["en", { name: "Squid Game" }], ["tr", { name: "" }]]),
    }, "tr");
    expect(out.name).toBe("Squid Game");
  });

  test("seçili dilde ad varsa TMDB adına dokunulmaz (film: title)", () => {
    const out = localizeMediaDetails({
      title: "Başlangıç", original_title: "Inception", original_language: "en",
      translations: translations([["tr", { title: "Başlangıç" }], ["en", { title: "Inception" }]]),
    }, "tr");
    expect(out.title).toBe("Başlangıç");
  });

  test("seçili dil özgün dilse çeviri aranmaz; İngilizcesi de yoksa TMDB adı kalır", () => {
    expect(localizeMediaDetails({
      title: "Eşkıya", original_title: "Eşkıya", original_language: "tr",
      translations: translations([["en", { title: "The Bandit" }]]),
    }, "tr").title).toBe("Eşkıya");
    expect(localizeMediaDetails({
      title: "기생충", original_title: "기생충", original_language: "ko", translations: translations([]),
    }, "tr").title).toBe("기생충");
  });

  test("boş girdi", () => {
    expect(localizeMediaDetails(null, "tr")).toBeNull();
  });
});

describe("görsel dil sırası", () => {
  test("seçili dil → İngilizce → özgün dil → dilsiz", () => {
    expect(tmdbImageLanguageOrderOf("tr", "ko")).toBe("tr,en,ko,null");
    expect(tmdbImageLanguageOrderOf("en", "ko")).toBe("en,ko,null");
    expect(tmdbImageLanguageOrderOf("tr")).toBe("tr,en,null");
  });

  test("özgün dil zaten listedeyse yinelenmez; İngilizcede Türkçe araya girmez", () => {
    expect(tmdbImageLanguagesOf("tr", "en")).toEqual(["tr", "en"]);
    expect(tmdbImageLanguagesOf("en")).toEqual(["en"]);
  });
});
