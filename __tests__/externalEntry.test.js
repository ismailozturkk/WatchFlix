// __tests__/externalEntry.test.js
// Paylaş menüsü + simge kısayolları kararları (utils/externalEntry) ve App.js'teki ekran adlarıyla uyum.

const fs = require("fs");
const path = require("path");
const {
  QUICK_ACTIONS,
  buildQuickActionItems,
  hasShareableText,
  linkFromShareIntent,
  routeForQuickAction,
  shareIntentKey,
  wrapGetStateFromPath,
} = require("../utils/externalEntry");
const { EXTERNAL_ENTRY_COPY } = require("../utils/externalEntryCopy");

describe("linkFromShareIntent", () => {
  it("tarayıcı paylaşımındaki webUrl'den IMDb kimliğini çıkarır", () => {
    expect(
      linkFromShareIntent({ webUrl: "https://www.imdb.com/title/tt0133093/?ref_=nv", text: null }),
    ).toEqual({ source: "imdb", imdbId: "tt0133093" });
  });

  it("uygulama paylaşımında metnin içindeki bağlantıyı bulur", () => {
    expect(
      linkFromShareIntent({ webUrl: null, text: "Şuna bak! https://www.themoviedb.org/tv/1399-got harika" }),
    ).toEqual({ source: "tmdb", type: "tv", id: 1399 });
  });

  it("webUrl tanınmazsa metne bakar", () => {
    expect(
      linkFromShareIntent({
        webUrl: "https://example.com/x",
        text: "https://www.themoviedb.org/movie/603-the-matrix",
      }),
    ).toEqual({ source: "tmdb", type: "movie", id: 603 });
  });

  it("film olmayan bağlantı / boş paylaşım null döner", () => {
    expect(linkFromShareIntent({ webUrl: "https://letterboxd.com/film/x/", text: null })).toBeNull();
    expect(linkFromShareIntent({ webUrl: null, text: null })).toBeNull();
    expect(linkFromShareIntent(null)).toBeNull();
  });
});

describe("hasShareableText / shareIntentKey", () => {
  it("yalnız dosya paylaşımı işlenecek metin sayılmaz", () => {
    expect(hasShareableText({ webUrl: null, text: null, files: [{ path: "/x.jpg" }] })).toBe(false);
    expect(hasShareableText({ webUrl: "  ", text: "" })).toBe(false);
    expect(hasShareableText({ webUrl: "https://a.b", text: null })).toBe(true);
    expect(hasShareableText({ webUrl: null, text: "merhaba" })).toBe(true);
    expect(hasShareableText(undefined)).toBe(false);
  });

  it("anahtar webUrl ve metinden türer", () => {
    expect(shareIntentKey({ webUrl: "u", text: "t" })).toBe("u|t");
    expect(shareIntentKey(null)).toBe("");
  });
});

describe("kısayollar", () => {
  it("kimlikler tekil ve en çok 4 (Android sınırı)", () => {
    const ids = QUICK_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(4);
  });

  it("bilinmeyen kimlik null, bilinen kimlik ekran adı verir", () => {
    expect(routeForQuickAction("yok")).toBeNull();
    expect(routeForQuickAction("reminders")).toEqual({ name: "RemindersScreen", params: undefined });
    expect(routeForQuickAction("search").name).toBe("UnifiedSearch");
  });

  it("her kısayolun ekran adı App.js'teki bir Stack.Screen'dir", () => {
    const app = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
    for (const action of QUICK_ACTIONS) {
      expect(app).toContain(`name="${action.route}"`);
    }
  });

  it("öğe listesi iOS'ta SF simgesi, Android'de simgesiz; başlık copy'den", () => {
    const ios = buildQuickActionItems(EXTERNAL_ENTRY_COPY.tr, "ios");
    const android = buildQuickActionItems(EXTERNAL_ENTRY_COPY.tr, "android");
    expect(ios[0]).toMatchObject({ id: "search", title: "Ara", icon: "symbol:magnifyingglass" });
    expect(android.every((i) => i.icon === null)).toBe(true);
    // Başlık eksikse kimlik düşer (boş başlıklı kısayol sistemde hata verir).
    expect(buildQuickActionItems({}, "ios")[0].title).toBe("search");
  });

  it("her dilde tüm kısayol başlıkları dolu ve kısa", () => {
    for (const [lang, copy] of Object.entries(EXTERNAL_ENTRY_COPY)) {
      for (const action of QUICK_ACTIONS) {
        expect(typeof copy[action.id]).toBe("string");
        expect(copy[action.id].length).toBeGreaterThan(0);
        expect(copy[action.id].length).toBeLessThanOrEqual(25);
      }
      expect(lang).toBeTruthy();
    }
  });
});

describe("wrapGetStateFromPath", () => {
  it("share-intent adresini ekran eşlemesine sokmaz, diğerlerini devreder", () => {
    const inner = jest.fn(() => "state");
    const wrapped = wrapGetStateFromPath(inner);
    expect(wrapped("dataUrl=seelogdShareKey#weburl", {})).toBeUndefined();
    expect(inner).not.toHaveBeenCalled();
    expect(wrapped("reminders", { a: 1 })).toBe("state");
    expect(inner).toHaveBeenCalledWith("reminders", { a: 1 });
  });
});
