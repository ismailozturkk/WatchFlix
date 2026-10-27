// Sohbet "#" aramasının sıralama çekirdeği (utils/chatMediaSearch).
import {
  chatSearchKey,
  countByType,
  isSearchableQuery,
  parseSearchQuery,
  rankChatSearchResults,
  resultMeta,
} from "../utils/chatMediaSearch";

const movie = (id, title, extra = {}) => ({
  id,
  media_type: "movie",
  title,
  poster_path: "/p" + id + ".jpg",
  popularity: 10,
  vote_count: 100,
  ...extra,
});

describe("parseSearchQuery", () => {
  it("sondaki yılı ayırır", () => {
    expect(parseSearchQuery("matrix 1999")).toMatchObject({ text: "matrix", year: 1999 });
    expect(parseSearchQuery("  Dune   (2021) ")).toMatchObject({ text: "Dune", year: 2021 });
  });

  it("yalnız yıldan oluşan başlığa dokunmaz", () => {
    expect(parseSearchQuery("1917")).toMatchObject({ text: "1917", year: null });
    expect(parseSearchQuery("2012")).toMatchObject({ text: "2012", year: null });
  });
});

describe("isSearchableQuery / chatSearchKey", () => {
  it("en az iki anlamlı karakter ister", () => {
    expect(isSearchableQuery("a")).toBe(false);
    expect(isSearchableQuery(" ! ")).toBe(false);
    expect(isSearchableQuery("up")).toBe(true);
  });

  it("anahtar kategori + katlanmış sorgu", () => {
    expect(chatSearchKey(null, "  İnter ")).toBe(chatSearchKey(null, "inter"));
    expect(chatSearchKey("tv", "x")).not.toBe(chatSearchKey("movie", "x"));
  });
});

describe("rankChatSearchResults", () => {
  it("tek oyla 10 puan alan bilinmez kayıt aranan eserin önüne geçmez", () => {
    const ranked = rankChatSearchResults(
      [
        movie(1, "Dune Drifter", { vote_average: 10, vote_count: 1, popularity: 0.6 }),
        movie(2, "Dune", { vote_average: 7.8, vote_count: 12000, popularity: 120 }),
        movie(3, "Dune: Part Two", { vote_average: 8.2, vote_count: 6000, popularity: 300 }),
        movie(4, "Dune", { vote_average: 6.3, vote_count: 2500, popularity: 25 }),
      ],
      "dune",
    );
    expect(ranked.map((r) => r.id)).toEqual([2, 3, 4, 1]);
  });

  it("tam eşleşme, aynı bilinirlikteki başlangıç eşleşmesinin önünde", () => {
    const ranked = rankChatSearchResults(
      [movie(1, "Up in the Air"), movie(2, "Up")],
      "up",
    );
    expect(ranked[0].id).toBe(2);
  });

  it("yazılan yıl eşleşen sürümü öne alır", () => {
    const ranked = rankChatSearchResults(
      [
        movie(1, "Dune", { release_date: "2021-09-15", popularity: 120, vote_count: 12000 }),
        movie(2, "Dune", { release_date: "1984-12-14", popularity: 25, vote_count: 2500 }),
      ],
      "dune 1984",
    );
    expect(ranked[0].id).toBe(2);
  });

  it("afişsiz kayıtlar sona itilir", () => {
    const ranked = rankChatSearchResults(
      [movie(1, "Alien", { poster_path: null }), movie(2, "Aliens", { popularity: 5, vote_count: 10 })],
      "alien",
    );
    expect(ranked.map((r) => r.id)).toEqual([2, 1]);
  });

  it("orijinal adla da eşleşir (çeviri başlığı farklıyken)", () => {
    const ranked = rankChatSearchResults(
      [
        movie(1, "Başka Bir Film", { popularity: 40 }),
        movie(2, "Ruhların Kaçışı", { original_title: "Spirited Away", popularity: 30 }),
      ],
      "spirited away",
    );
    expect(ranked[0].id).toBe(2);
  });

  it("desteklenmeyen tipi eler, tekrarı tekilleştirir, kategori tipini yazar", () => {
    const ranked = rankChatSearchResults(
      [
        { id: 5, name: "X", media_type: "collection" },
        { id: 7, name: "Breaking Bad", poster_path: "/b.jpg" },
        { id: 7, name: "Breaking Bad", poster_path: "/b.jpg" },
      ],
      "breaking",
      { type: "tv" },
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ id: 7, media_type: "tv" });
  });

  it("aynı id'li film ve dizi ayrı eserdir", () => {
    const ranked = rankChatSearchResults(
      [movie(9, "Fargo"), { id: 9, media_type: "tv", name: "Fargo", poster_path: "/f.jpg" }],
      "fargo",
    );
    expect(ranked).toHaveLength(2);
  });
});

describe("resultMeta / countByType", () => {
  it("dizi/filmde yıl, kişide bölüm", () => {
    expect(resultMeta({ media_type: "tv", first_air_date: "2008-01-20" })).toMatchObject({ mediaType: "tv", year: 2008 });
    expect(resultMeta({ media_type: "person", known_for_department: "Directing" })).toMatchObject({
      mediaType: "person",
      department: "Directing",
    });
    // Sohbete yazılan payload'da dizi tarihi de release_date alanında.
    expect(resultMeta({ media_type: "tv", release_date: "2019-05-01" }).year).toBe(2019);
  });

  it("tip dağılımını sayar", () => {
    expect(countByType([{ media_type: "movie" }, { media_type: "tv" }, { media_type: "tv" }])).toEqual({
      movie: 1,
      tv: 2,
      person: 0,
    });
  });
});
