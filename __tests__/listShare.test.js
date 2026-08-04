import {
  describeSaveTarget,
  listItemToMedia,
  MAX_LIST_NAME_LENGTH,
  mediaToListItem,
  resolveListName,
  RESERVED_LIST_NAMES,
  sharedListToItems,
  tmdbPathFromPoster,
} from "../utils/listShare";

describe("poster yolu çözümü", () => {
  test("tam TMDB URL'inden yolu geri çıkarır", () => {
    expect(tmdbPathFromPoster("https://image.tmdb.org/t/p/w500/abc.jpg")).toBe("/abc.jpg");
    expect(tmdbPathFromPoster("https://image.tmdb.org/t/p/original/xy_z.png")).toBe("/xy_z.png");
  });

  test("zaten yol olan değeri olduğu gibi bırakır", () => {
    expect(tmdbPathFromPoster("/abc.jpg")).toBe("/abc.jpg");
  });

  test("tanımadığı kaynağa null döner", () => {
    expect(tmdbPathFromPoster("https://baska.site/poster.jpg")).toBeNull();
    expect(tmdbPathFromPoster("")).toBeNull();
    expect(tmdbPathFromPoster(null)).toBeNull();
    expect(tmdbPathFromPoster(42)).toBeNull();
  });
});

describe("liste öğesi ↔ paylaşım medyası", () => {
  test("profil öğesi composer medyasına dönüşür", () => {
    expect(
      listItemToMedia({
        id: 12,
        type: "tv",
        name: "Dizi",
        imagePath: "/poster.jpg",
        genres: ["Dram", "Suç"],
      }),
    ).toEqual({
      id: 12,
      media_type: "tv",
      type: "tv",
      title: "Dizi",
      name: "Dizi",
      poster_path: "/poster.jpg",
      genres: ["Dram", "Suç"],
      genre_ids: [],
      minutes: null,
      episodeMinutes: null,
      episodeCount: null,
      seasonCount: null,
      totalMinutes: null,
      factsAt: null,
    });
  });

  test("bilinmeyen tip filme düşer, kimliksiz öğe elenir", () => {
    expect(listItemToMedia({ id: 1, type: "kitap" }).media_type).toBe("movie");
    expect(listItemToMedia({ name: "kimliksiz" })).toBeNull();
    expect(listItemToMedia(null)).toBeNull();
  });

  test("tipi olmayan eski dizi kaydı listeden gelen tipe düşer", () => {
    expect(listItemToMedia({ id: 3, name: "Eski dizi" }, { fallbackType: "tv" }).media_type)
      .toBe("tv");
    // Kaydın kendi tipi varsa fallback ezmez.
    expect(listItemToMedia({ id: 3, type: "movie" }, { fallbackType: "tv" }).media_type)
      .toBe("movie");
  });

  test("yeni paylaşımda poster_path doğrudan, eskisinde URL'den okunur", () => {
    expect(
      mediaToListItem({ id: 5, type: "movie", title: "Film", poster_path: "/p.jpg" }).imagePath,
    ).toBe("/p.jpg");
    expect(
      mediaToListItem({
        id: 5,
        type: "movie",
        title: "Film",
        poster: "https://image.tmdb.org/t/p/w500/eski.jpg",
      }).imagePath,
    ).toBe("/eski.jpg");
  });

  test("gidiş-dönüş dönüşümü alanları korur", () => {
    const item = {
      id: 7,
      type: "movie",
      name: "Film",
      imagePath: "/p.jpg",
      dateAdded: null,
      genres: ["Komedi"],
    };
    expect(mediaToListItem(listItemToMedia(item))).toEqual(item);
  });

  test("FİLM gidiş-dönüşü süreyi ve türleri korur", () => {
    const item = {
      id: 550,
      type: "movie",
      name: "Film",
      imagePath: "/p.jpg",
      dateAdded: null,
      genres: ["Dram"],
      minutes: 136,
    };
    expect(mediaToListItem(listItemToMedia(item))).toEqual(item);
  });

  test("DİZİ gidiş-dönüşünde toplam süre türetilir", () => {
    const media = listItemToMedia({
      id: 1399,
      type: "tv",
      name: "Dizi",
      imagePath: "/p.jpg",
      genres: ["Dram"],
      episodeMinutes: 45,
      episodeCount: 62,
      seasonCount: 5,
    });
    const item = mediaToListItem(media);
    expect(item).toMatchObject({
      episodeMinutes: 45,
      episodeCount: 62,
      seasonCount: 5,
      totalMinutes: 2790,
    });
  });

  test("süresiz öğede minutes ANAHTARI hiç oluşmaz", () => {
    const item = mediaToListItem({ id: 1, type: "movie", title: "Film" });
    expect("minutes" in item).toBe(false);
    expect("totalMinutes" in item).toBe(false);
  });

  test("tip sızması yok: filme dizi alanları, diziye minutes yazılmaz", () => {
    const movie = mediaToListItem({
      id: 1,
      type: "movie",
      minutes: 100,
      episodeMinutes: 45,
      episodeCount: 10,
      seasonCount: 2,
    });
    expect(movie.minutes).toBe(100);
    expect("episodeMinutes" in movie).toBe(false);
    expect("seasonCount" in movie).toBe(false);
    expect("totalMinutes" in movie).toBe(false);

    const show = mediaToListItem({ id: 2, type: "tv", minutes: 100, episodeMinutes: 45, episodeCount: 4 });
    expect("minutes" in show).toBe(false);
    expect(show.totalMinutes).toBe(180);
  });

  test("genreMap verilince tür id'leri kaydedenin dilinde ada çevrilir", () => {
    const withMap = mediaToListItem(
      { id: 3, type: "movie", genre_ids: [18, 80, 999] },
      { genreMap: { 18: "Dram", 80: "Suç" } },
    );
    expect(withMap.genres).toEqual(["Dram", "Suç"]);
    // Harita yoksa mevcut davranış korunur: tür adı üretilmez.
    expect(mediaToListItem({ id: 3, type: "movie", genre_ids: [18] }).genres).toEqual([]);
    // Ada sahip paylaşımda harita devreye girmez.
    expect(
      mediaToListItem({ id: 3, type: "movie", genres: ["Gerilim"], genre_ids: [18] }, { genreMap: { 18: "Dram" } })
        .genres,
    ).toEqual(["Gerilim"]);
  });
});

describe("paylaşımdan liste kurma", () => {
  const media = (id, extra = {}) => ({ id, type: "movie", title: `F${id}`, ...extra });

  test("aynı eser iki kez geçse de tek kaydedilir", () => {
    const items = sharedListToItems([media(1), media(2), media(1)]);
    expect(items.map((item) => item.id)).toEqual([1, 2]);
  });

  test("aynı id farklı tipteyse ayrı kalır", () => {
    const items = sharedListToItems([media(1), { id: 1, type: "tv", title: "Dizi" }]);
    expect(items).toHaveLength(2);
  });

  test("tavanı aşan kuyruk atılır ve sıra korunur", () => {
    const source = Array.from({ length: 8 }, (_, index) => media(index + 1));
    const items = sharedListToItems(source, { limit: 3 });
    expect(items.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  test("bozuk girdi çökmez", () => {
    expect(sharedListToItems()).toEqual([]);
    expect(sharedListToItems([null, undefined, {}, media(9)])).toHaveLength(1);
  });

  test("izleme tarihi taşınmaz — kaydetmek izlemek değildir", () => {
    expect(sharedListToItems([media(1)])[0].dateAdded).toBeNull();
  });
});

describe("liste adı çözümü", () => {
  test("boştaki ad olduğu gibi kullanılır", () => {
    expect(resolveListName("Yaz Filmleri", ["favorites"])).toBe("Yaz Filmleri");
  });

  test("dolu ad numaralanır", () => {
    expect(resolveListName("Yaz", ["Yaz"])).toBe("Yaz (2)");
    expect(resolveListName("Yaz", ["Yaz", "Yaz (2)", "Yaz (3)"])).toBe("Yaz (4)");
  });

  test("öntanımlı alan adları dolu sayılır", () => {
    RESERVED_LIST_NAMES.forEach((reserved) => {
      expect(resolveListName(reserved, [])).toBe(`${reserved} (2)`);
    });
  });

  test("boş ve boşluktan ibaret ad reddedilir", () => {
    expect(resolveListName("   ", [])).toBeNull();
    expect(resolveListName("", [])).toBeNull();
    expect(resolveListName(null, [])).toBeNull();
  });

  test("uzun ad kırpılır, numaralı hâli de sınırı aşmaz", () => {
    const long = "x".repeat(MAX_LIST_NAME_LENGTH + 20);
    const first = resolveListName(long, []);
    expect(first).toHaveLength(MAX_LIST_NAME_LENGTH);
    const second = resolveListName(long, [first]);
    expect(second.length).toBeLessThanOrEqual(MAX_LIST_NAME_LENGTH);
    expect(second.endsWith(" (2)")).toBe(true);
  });
});

describe("kaydetme sayfasının durumu", () => {
  test("çakışma yoksa uyarı yok", () => {
    expect(describeSaveTarget("Yeni", ["Eski"], 3)).toEqual({
      resolvedName: "Yeni",
      renamed: false,
      canSave: true,
    });
  });

  test("çakışmada yeniden adlandırma önceden bildirilir", () => {
    const target = describeSaveTarget("Yaz", ["Yaz"], 3);
    expect(target.resolvedName).toBe("Yaz (2)");
    expect(target.renamed).toBe(true);
    expect(target.canSave).toBe(true);
  });

  test("boş ad ya da boş liste kaydedilemez", () => {
    expect(describeSaveTarget("", [], 3).canSave).toBe(false);
    expect(describeSaveTarget("Yeni", [], 0).canSave).toBe(false);
  });
});
