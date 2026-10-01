// Arkadaş şeridi modeli: rozet yalnız EYLEM bekleyen sayılar için, bilgi sayıları
// caption olarak (bildirim rozeti gibi görünmesin).

import { BADGE_CAP, buildFriendsBarModel, formatBadge } from "../utils/friendsBarModel";

describe("formatBadge", () => {
  test("0 ve geçersiz değer rozet üretmez", () => {
    expect(formatBadge(0)).toBe("");
    expect(formatBadge(-3)).toBe("");
    expect(formatBadge(NaN)).toBe("");
    expect(formatBadge(undefined)).toBe("");
  });

  test("1..99 sayıyı olduğu gibi yazar", () => {
    expect(formatBadge(1)).toBe("1");
    expect(formatBadge(42)).toBe("42");
    expect(formatBadge(BADGE_CAP)).toBe("99");
  });

  test("99'un üstü 99+ olur", () => {
    expect(formatBadge(100)).toBe("99+");
    expect(formatBadge(12345)).toBe("99+");
  });
});

describe("buildFriendsBarModel", () => {
  test("arkadaş sayısı ASLA rozet olmaz, caption olur", () => {
    const m = buildFriendsBarModel({ friendCount: 24 });
    expect(m.friends.badge).toBe(0);
    expect(m.friends.caption).toEqual({ key: "friendsMany", count: 24 });
  });

  test("tek arkadaş ayrı anahtar (İngilizce çoğul için), sıfır ayrı anahtar", () => {
    expect(buildFriendsBarModel({ friendCount: 1 }).friends.caption).toEqual({
      key: "friendsOne",
      count: 1,
    });
    expect(buildFriendsBarModel({ friendCount: 0 }).friends.caption).toEqual({
      key: "friendsNone",
    });
  });

  test("okunmamış mesaj ve gelen istek rozet olur", () => {
    const m = buildFriendsBarModel({ unreadMessages: 3, incomingRequests: 2 });
    expect(m.messages.badge).toBe(3);
    expect(m.requests.badge).toBe(2);
  });

  test("GÖNDERİLEN istek rozet olmaz, caption olur", () => {
    const m = buildFriendsBarModel({ incomingRequests: 0, outgoingRequests: 4 });
    expect(m.requests.badge).toBe(0);
    expect(m.requests.caption).toEqual({ key: "requestsSent", count: 4 });
  });

  test("gelen ve giden birlikte: rozet gelen, caption giden", () => {
    const m = buildFriendsBarModel({ incomingRequests: 1, outgoingRequests: 2 });
    expect(m.requests.badge).toBe(1);
    expect(m.requests.caption).toEqual({ key: "requestsSent", count: 2 });
  });

  test("hiçbir bekleyen yoksa rozet yok, sakin caption'lar", () => {
    const m = buildFriendsBarModel({});
    expect(m.search.badge).toBe(0);
    expect(m.friends.badge).toBe(0);
    expect(m.messages.badge).toBe(0);
    expect(m.requests.badge).toBe(0);
    expect(m.search.caption).toEqual({ key: "searchHint" });
    expect(m.messages.caption).toEqual({ key: "messagesIdle" });
    expect(m.requests.caption).toEqual({ key: "requestsIdle" });
  });

  test("argümansız çağrı ve bozuk sayılar çökmez", () => {
    expect(() => buildFriendsBarModel()).not.toThrow();
    const m = buildFriendsBarModel({
      friendCount: -5,
      unreadMessages: NaN,
      incomingRequests: undefined,
      outgoingRequests: "x",
    });
    expect(m.friends.caption).toEqual({ key: "friendsNone" });
    expect(m.messages.badge).toBe(0);
    expect(m.requests.badge).toBe(0);
    expect(m.requests.caption).toEqual({ key: "requestsIdle" });
  });
});

// ── Bileşen ↔ model ↔ çeviri paketleri ────────────────────────────────────
// Model caption'ı bir ANAHTAR olarak döner; metni bileşen üretir. Anahtar adı
// iki tarafta ayrışırsa kart sessizce boş caption basar; çeviri iki pakette de
// yoksa EN kullanıcı Türkçe görür. i18nKeys testi bu dosyadaki sabit tabloyu
// (`i18nText` çağrısı dışı) göremediği için burada ayrıca doğrulanır.
describe("FriendsActionBar caption tablosu", () => {
  const fs = require("fs");
  const path = require("path");
  const kaynak = fs.readFileSync(
    path.join(__dirname, "..", "components", "profile", "FriendsActionBar.js"),
    "utf8",
  );
  const girisler = [...kaynak.matchAll(/^ {2}(\w+): \["(autoI18n\.[A-Za-z0-9_]+)"/gm)];
  const tr = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "translations", "tr.json"), "utf8"),
  );
  const en = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "translations", "en.json"), "utf8"),
  );

  test("modelin döndürebileceği her caption anahtarı tabloda var", () => {
    const tablo = new Set(girisler.map((g) => g[1]));
    const modelAnahtarlari = new Set();
    for (const girdi of [
      { friendCount: 0 },
      { friendCount: 1 },
      { friendCount: 5, outgoingRequests: 2 },
      {},
    ]) {
      for (const bolum of Object.values(buildFriendsBarModel(girdi))) {
        modelAnahtarlari.add(bolum.caption.key);
      }
    }
    for (const anahtar of modelAnahtarlari) {
      expect(tablo.has(anahtar)).toBe(true);
    }
  });

  test("tablodaki her çeviri anahtarı tr ve en paketlerinde var", () => {
    expect(girisler.length).toBeGreaterThanOrEqual(7);
    for (const [, , anahtar] of girisler) {
      const ad = anahtar.replace("autoI18n.", "");
      expect(typeof tr.autoI18n[ad]).toBe("string");
      expect(typeof en.autoI18n[ad]).toBe("string");
    }
  });
});
