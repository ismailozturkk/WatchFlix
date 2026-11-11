// Hassas içerik kategorileri: varsayılan gizli, yaş kapısı, sezgisel eşleşme ve
// /discover dışlama parametreleri (utils/sensitiveContent.js + tmdbAdultGuard).

import axios from "axios";
import { Keys, set, getStore } from "../services/storage";
import {
  contentFilterKeyOf,
  discoverExclusionParams,
  dropSensitiveItems,
  hiddenFromFilterKey,
  hiddenSensitiveCategories,
  isSensitiveItem,
} from "../utils/sensitiveContent";
import { installTmdbAdultGuard } from "../utils/tmdbAdultGuard";
import { syncAgeRestriction } from "../utils/ageGate";
import { contentScoped, dropSensitive } from "../utils/homeContentSettings";

installTmdbAdultGuard();
const [reqHandler] = axios.interceptors.request.handlers.filter(Boolean);
const [resHandler] = axios.interceptors.response.handlers.filter(Boolean);

beforeEach(() => {
  getStore("settings").clearAll();
  getStore("session").clearAll();
});

const ALL = ["adult", "drugs", "gore", "war"];

describe("varsayılanlar ve yaş kapısı", () => {
  test("hepsi varsayılan gizli", () => {
    expect(hiddenSensitiveCategories()).toEqual(ALL);
  });

  test("açılan kategori gizli listeden çıkar", () => {
    set(Keys.sensitiveWar, true);
    set(Keys.adultContent, true);
    expect(hiddenSensitiveCategories()).toEqual(["drugs", "gore"]);
  });

  test("18 altı hesapta ayar açık olsa da hepsi gizli", () => {
    set(Keys.sensitiveWar, true);
    set(Keys.sensitiveDrugs, true);
    syncAgeRestriction("2015-01-01");
    expect(hiddenSensitiveCategories()).toEqual(ALL);
  });
});

describe("kayıt eşleşmesi", () => {
  test("savaş türü (film ve dizi)", () => {
    expect(isSensitiveItem({ id: 1, genre_ids: [18, 10752] }, ["war"])).toBe(true);
    expect(isSensitiveItem({ id: 2, genre_ids: [10768] }, ["war"])).toBe(true);
    expect(isSensitiveItem({ id: 3, genre_ids: [18] }, ["war"])).toBe(false);
  });

  test("uyuşturucu — beş dilde özet", () => {
    const h = ["drugs"];
    expect(isSensitiveItem({ overview: "A chemistry teacher turns to cooking meth." }, h)).toBe(true);
    expect(isSensitiveItem({ overview: "Genç bir adam uyuşturucu kaçakçılığına bulaşır." }, h)).toBe(true);
    expect(isSensitiveItem({ overview: "Un policía contra un cártel." }, h)).toBe(true);
    expect(isSensitiveItem({ overview: "Ein Ermittler jagt ein Kartell." }, h)).toBe(true);
    expect(isSensitiveItem({ overview: "Two friends go on a road trip." }, h)).toBe(false);
  });

  test("kelime içinde geçen eşleşmez", () => {
    // "drug" → "drugstore" değil; "gore" → "Gorey/Gorell" değil
    expect(isSensitiveItem({ overview: "A drugstore clerk falls in love." }, ["drugs"])).toBe(false);
    expect(isSensitiveItem({ overview: "Mr. Goreham opens a bakery." }, ["gore"])).toBe(false);
  });

  test("kan ve vahşet", () => {
    expect(isSensitiveItem({ overview: "Kasabada kanlı bir katliam yaşanır." }, ["gore"])).toBe(true);
    expect(isSensitiveItem({ overview: "A gruesome slasher stalks campers." }, ["gore"])).toBe(true);
  });

  test("yetişkin bayrağı medya olmayan kayıtlarda da", () => {
    expect(isSensitiveItem({ adult: true, name: "x" }, ["adult"])).toBe(true);
  });

  test("video/anahtar kelime kayıtları süzülmez", () => {
    expect(isSensitiveItem({ id: "v", name: "Drug deal scene", key: "abc", site: "YouTube" }, ["drugs"])).toBe(false);
  });

  test("dropSensitiveItems kimliği korur", () => {
    const list = [{ id: 1, overview: "A love story." }];
    expect(dropSensitiveItems(list, ALL)).toBe(list);
  });
});

describe("imza ve kapsam", () => {
  test("contentFilterKeyOf / hiddenFromFilterKey", () => {
    expect(contentFilterKeyOf({})).toBe("");
    expect(contentFilterKeyOf({ war: true, adult: true })).toBe("adult,war");
    expect(hiddenFromFilterKey("adult,war")).toEqual(["drugs", "gore"]);
    expect(hiddenFromFilterKey("")).toEqual(ALL);
  });

  test("contentScoped varsayılanda eski anahtarı korur", () => {
    expect(contentScoped("k", "")).toBe("k");
    expect(contentScoped("k", "adult")).toBe("k~a");
    expect(contentScoped("k", "adult,war")).toBe("k~adult.war");
  });

  test("dropSensitive imzadan süzer", () => {
    const list = [{ id: 1, genre_ids: [10752] }, { id: 2, genre_ids: [35] }];
    expect(dropSensitive(list, "").map((i) => i.id)).toEqual([2]);
    expect(dropSensitive(list, "war")).toBe(list);
  });
});

describe("discover dışlama parametreleri", () => {
  test("film: anahtar kelime + savaş türü, mevcut değerle birleşir", () => {
    const out = discoverExclusionParams(
      "https://api.themoviedb.org/3/discover/movie",
      { without_genres: "99" },
      ["drugs", "war"],
    );
    expect(out.without_keywords.split(",")).toContain("1803");
    expect(out.without_genres).toBe("99,10752");
  });

  test("dizi savaş türü 10768", () => {
    const out = discoverExclusionParams("https://api.themoviedb.org/3/discover/tv", {}, ["war"]);
    expect(out).toEqual({ without_genres: "10768" });
  });

  test("discover dışı uçta parametre yok", () => {
    expect(discoverExclusionParams("https://api.themoviedb.org/3/search/movie", {}, ALL)).toBeNull();
  });
});

describe("guard entegrasyonu", () => {
  test("discover isteğine varsayılan dışlamalar eklenir", () => {
    const config = reqHandler.fulfilled({
      url: "https://api.themoviedb.org/3/discover/movie",
      params: { page: 1 },
    });
    expect(config.params.without_genres).toBe("10752");
    expect(config.params.without_keywords).toMatch(/10292/);
  });

  test("URL'e gömülü without_genres params'a taşınıp birleşir", () => {
    const config = reqHandler.fulfilled({
      url: "https://api.themoviedb.org/3/discover/tv?without_genres=16&page=2",
    });
    expect(config.url).toBe("https://api.themoviedb.org/3/discover/tv?page=2&include_adult=false".replace("&include_adult=false", ""));
    expect(config.params.without_genres).toBe("16,10768");
  });

  test("tüm kategoriler açıkken dışlama yok", () => {
    ALL.forEach((c) =>
      set(Keys[{ adult: "adultContent", drugs: "sensitiveDrugs", gore: "sensitiveGore", war: "sensitiveWar" }[c]], true),
    );
    const config = reqHandler.fulfilled({ url: "https://api.themoviedb.org/3/discover/movie", params: {} });
    expect(config.params.without_genres).toBeUndefined();
    expect(config.params.without_keywords).toBeUndefined();
  });

  test("trending cevabından savaş ve uyuşturucu kayıtları elenir", () => {
    const response = resHandler.fulfilled({
      config: { url: "https://api.themoviedb.org/3/trending/movie/week" },
      data: {
        results: [
          { id: 1, genre_ids: [10752], overview: "" },
          { id: 2, genre_ids: [80], overview: "A cartel boss rises." },
          { id: 3, genre_ids: [35], overview: "A family comedy." },
        ],
      },
    });
    expect(response.data.results.map((i) => i.id)).toEqual([3]);
  });
});
