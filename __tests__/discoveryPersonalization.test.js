import {
  mergeProviderResults,
  resolveGenreIds,
} from "../utils/discoveryPersonalization";

describe("discovery personalization", () => {
  test("resolves stored Turkish or English genre names to stable TMDB ids", () => {
    const tr = [{ id: 28, name: "Aksiyon" }, { id: 18, name: "Dram" }];
    const en = [{ id: 28, name: "Action" }, { id: 35, name: "Comedy" }];

    expect(resolveGenreIds(["Aksiyon", "Drama", "Comedy"], tr, en)).toEqual([
      28,
      35,
    ]);
    expect(resolveGenreIds(["AKSİYON", "Dram"], tr, en)).toEqual([28, 18]);
  });

  test("merges hybrid provider results and keeps every matching provider", () => {
    const merged = mergeProviderResults([
      {
        providerId: 8,
        results: [
          { id: 1, popularity: 40 },
          { id: 2, popularity: 20 },
        ],
      },
      {
        providerId: 337,
        results: [
          { id: 1, popularity: 40 },
          { id: 3, popularity: 60 },
        ],
      },
    ]);

    expect(merged.map((item) => item.id)).toEqual([3, 1, 2]);
    expect(merged.find((item) => item.id === 1)._subscriptionProviderIds).toEqual([
      8,
      337,
    ]);
  });
});

