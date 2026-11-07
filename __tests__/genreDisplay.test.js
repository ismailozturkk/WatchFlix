// __tests__/genreDisplay.test.js
//
// Saklı tür adı (eklendiği andaki TMDB dili) ekranda kullanıcının diline çevrilir.
// İngilizce arayüzde "Aksiyon • Suç • Bilim-Kurgu" görünmesi bu testin hatasıydı.
const { localizeGenreName, localizeGenreList } = require("../utils/genreDisplay");
const { countGenres } = require("../utils/watchHistory");
const { buildYearlyRecap } = require("../utils/wrapped");

describe("localizeGenreName", () => {
  test("Türkçe TMDB adları İngilizceye döner", () => {
    expect(localizeGenreName("Aksiyon", "en")).toBe("Action");
    expect(localizeGenreName("Suç", "en")).toBe("Crime");
    expect(localizeGenreName("Bilim-Kurgu", "en")).toBe("Sci-Fi");
    expect(localizeGenreName("Dram", "en")).toBe("Drama");
    expect(localizeGenreName("Animasyon", "en")).toBe("Animation");
  });

  test("bileşik dizi türleri bileşik kalır", () => {
    expect(localizeGenreName("Aksiyon & Macera", "en")).toBe("Action & Adventure");
    expect(localizeGenreName("Bilim Kurgu & Fantazi", "en")).toBe("Sci-Fi & Fantasy");
    expect(localizeGenreName("Savaş & Politik", "en")).toBe("War & Politics");
    expect(localizeGenreName("Sci-Fi & Fantasy", "tr")).toBe("Bilim Kurgu & Fantazi");
  });

  test("genreCanon'un başka kovaya kattığı türler kendi adıyla görünür", () => {
    expect(localizeGenreName("Pembe Dizi", "en")).toBe("Soap");
    expect(localizeGenreName("Kids", "tr")).toBe("Çocuk");
    expect(localizeGenreName("News", "de")).toBe("Nachrichten");
  });

  test("diller arası ve aynı dil", () => {
    expect(localizeGenreName("Comedy", "tr")).toBe("Komedi");
    expect(localizeGenreName("Komödie", "es")).toBe("Comedia");
    expect(localizeGenreName("Dram", "tr")).toBe("Dram");
  });

  test("tanınmayan ad ve boş girdi olduğu gibi döner", () => {
    expect(localizeGenreName("Vikingler", "en")).toBe("Vikingler");
    expect(localizeGenreName("", "en")).toBe("");
    expect(localizeGenreName(undefined, "en")).toBeUndefined();
  });

  test("liste: çeviriden sonra aynı ada düşenler tekilleşir", () => {
    expect(localizeGenreList(["Dram", "Drama", "Suç"], "en")).toEqual(["Drama", "Crime"]);
    expect(localizeGenreList(null, "en")).toEqual([]);
  });
});

describe("sayımlar kullanıcının dilinde birleşir", () => {
  test("countGenres: dil verilince Dram + Drama tek satır", () => {
    const grouped = [{ data: [{ genres: ["Dram", "Suç"] }, { genres: ["Drama"] }] }];
    expect(countGenres(grouped, "en")).toEqual([
      { name: "Drama", count: 2 },
      { name: "Crime", count: 1 },
    ]);
    // Dil verilmezse eski davranış: ham ad.
    expect(countGenres(grouped).map((g) => g.name)).toEqual(["Dram", "Drama", "Suç"]);
  });

  test("Wrapped türleri çevrilir, kişilik ham addan bulunur", () => {
    const movies = [
      { id: 1, dateAdded: "2026-03-01", minutes: 100, genres: ["Aksiyon"] },
      { id: 2, dateAdded: "2026-03-02", minutes: 100, genres: ["Action"] },
    ];
    const en = buildYearlyRecap({ movies, episodes: [], year: 2026, language: "en" });
    expect(en.topGenres[0]).toEqual({ genre: "Action", count: 2 });
    const de = buildYearlyRecap({ movies, episodes: [], year: 2026, language: "de" });
    expect(de.personality.key).toBe("action");
  });
});
