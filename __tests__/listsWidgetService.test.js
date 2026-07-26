jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "android" },
}));

import {
  buildListsWidgetPayload,
  MAX_LISTS,
  MAX_POSTERS,
} from "../services/listsWidgetService";

const LABELS = {
  watchedMovies: "İzlenen Filmler",
  watchedTvSeries: "İzlenen Diziler",
  favorite: "Favoriler",
  watchList: "İzlenecekler",
};

const item = (id, extra = {}) => ({ id, imagePath: `/p${id}.jpg`, ...extra });

describe("buildListsWidgetPayload", () => {
  test("korunan listeler profil rayıyla aynı sırada, özel listeler alfabetik", () => {
    const payload = buildListsWidgetPayload(
      [
        ["favorites", [item(1)]],
        ["zeta", [item(2)]],
        ["watchedMovies", [item(3)]],
        ["alfa", [item(4)]],
        ["watchedTv", [item(5)]],
        ["watchList", [item(6)]],
      ],
      LABELS,
    );

    expect(payload.map((list) => list.key)).toEqual([
      "watchedTv",
      "watchedMovies",
      "watchList",
      "favorites",
      "alfa",
      "zeta",
    ]);
  });

  test("korunan liste adları, aksan ve ikon eşlemesi", () => {
    const [favorites] = buildListsWidgetPayload([["favorites", []]], LABELS);
    expect(favorites).toMatchObject({
      key: "favorites",
      name: "Favoriler",
      accent: "#f87171",
      icon: "heart",
      count: 0,
      posters: [],
    });
  });

  test("özel liste kendi adını, varsayılan aksanı ve ikonu alır", () => {
    const [custom] = buildListsWidgetPayload([["Kult Filmler", []]], LABELS);
    expect(custom).toMatchObject({
      key: "Kult Filmler",
      name: "Kult Filmler",
      accent: "#fbbf24",
      icon: "list",
    });
  });

  test("posterler listOrder sırasına göre ve tam TMDB URL'i olarak gelir", () => {
    const [list] = buildListsWidgetPayload(
      [
        [
          "watchList",
          [
            item(1, { listOrder: 2 }),
            item(2, { listOrder: 0 }),
            item(3, { listOrder: 1 }),
          ],
        ],
      ],
      LABELS,
    );

    expect(list.posters).toEqual([
      "https://image.tmdb.org/t/p/w342/p2.jpg",
      "https://image.tmdb.org/t/p/w342/p3.jpg",
      "https://image.tmdb.org/t/p/w342/p1.jpg",
    ]);
  });

  test("görseli olmayan öğe posterlerden düşer ama sayıya dahil kalır", () => {
    const [list] = buildListsWidgetPayload(
      [["favorites", [item(1), { id: 2 }, item(3)]]],
      LABELS,
    );
    expect(list.count).toBe(3);
    expect(list.posters).toHaveLength(2);
  });

  test("liste ve poster sayısı üst sınırlarla kırpılır", () => {
    const many = Array.from({ length: MAX_POSTERS + 10 }, (_, i) => item(i));
    const lists = Array.from({ length: MAX_LISTS + 5 }, (_, i) => [
      `liste-${String(i).padStart(2, "0")}`,
      many,
    ]);

    const payload = buildListsWidgetPayload(lists, LABELS);
    expect(payload).toHaveLength(MAX_LISTS);
    expect(payload[0].posters).toHaveLength(MAX_POSTERS);
    // Kırpma sayıyı bozmamalı — widget "36" değil gerçek toplamı göstermeli.
    expect(payload[0].count).toBe(MAX_POSTERS + 10);
  });

  test("bozuk girdilerde boş dizi döner, patlamaz", () => {
    expect(buildListsWidgetPayload(null, LABELS)).toEqual([]);
    expect(buildListsWidgetPayload(undefined, LABELS)).toEqual([]);
    expect(buildListsWidgetPayload([], LABELS)).toEqual([]);
  });

  test("etiket yoksa Türkçe varsayılana düşer", () => {
    const [list] = buildListsWidgetPayload([["watchedTv", []]], undefined);
    expect(list.name).toBe("İzlenen Diziler");
  });
});
