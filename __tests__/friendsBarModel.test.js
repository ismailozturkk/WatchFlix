// Arkadaş şeridi modeli: rozet yalnız EYLEM bekleyen sayılar için; bilgi sayısı
// (arkadaş sayısı) rozet olmaz, "Arkadaşlar" karosunda ikonun yerinde düz rakam olur.

import fs from "fs";
import path from "path";
import {
  BADGE_CAP,
  FRIEND_COUNT_CAP,
  buildFriendsBarModel,
  formatBadge,
  formatFriendCount,
} from "../utils/friendsBarModel";

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

// Arkadaşlar karosunda sayı İKONUN YERİNDE durur; 0 iken ikon kalır (boş durumda
// "0" yazmak yerine ikon "arkadaş ekle" çağrısını taşır).
describe("formatFriendCount", () => {
  test("0 / geçersiz değer boş metin: çağıran ikonu çizer", () => {
    expect(formatFriendCount(0)).toBe("");
    expect(formatFriendCount(-2)).toBe("");
    expect(formatFriendCount(NaN)).toBe("");
    expect(formatFriendCount(undefined)).toBe("");
  });

  test("1..999 sayıyı olduğu gibi yazar", () => {
    expect(formatFriendCount(1)).toBe("1");
    expect(formatFriendCount(24)).toBe("24");
    expect(formatFriendCount(FRIEND_COUNT_CAP)).toBe("999");
  });

  test("karoya sığması için 999 üstü 999+ olur", () => {
    expect(formatFriendCount(1000)).toBe("999+");
    expect(formatFriendCount(54321)).toBe("999+");
  });
});

describe("buildFriendsBarModel", () => {
  test("arkadaş sayısı ASLA rozet olmaz, count olarak döner", () => {
    const m = buildFriendsBarModel({ friendCount: 24 });
    expect(m.friends.badge).toBe(0);
    expect(m.friends.count).toBe(24);
  });

  test("okunmamış mesaj ve gelen istek rozet olur", () => {
    const m = buildFriendsBarModel({ unreadMessages: 3, incomingRequests: 2 });
    expect(m.messages.badge).toBe(3);
    expect(m.requests.badge).toBe(2);
  });

  test("Ara ve Arkadaşlar hiçbir koşulda rozet taşımaz", () => {
    const m = buildFriendsBarModel({ friendCount: 50, unreadMessages: 9, incomingRequests: 9 });
    expect(m.search.badge).toBe(0);
    expect(m.friends.badge).toBe(0);
  });

  test("hiçbir bekleyen yoksa rozet yok", () => {
    const m = buildFriendsBarModel({});
    expect(m.search.badge).toBe(0);
    expect(m.friends.badge).toBe(0);
    expect(m.friends.count).toBe(0);
    expect(m.messages.badge).toBe(0);
    expect(m.requests.badge).toBe(0);
  });

  test("argümansız çağrı ve bozuk sayılar çökmez", () => {
    expect(() => buildFriendsBarModel()).not.toThrow();
    const m = buildFriendsBarModel({
      friendCount: -5,
      unreadMessages: NaN,
      incomingRequests: undefined,
    });
    expect(m.friends.count).toBe(0);
    expect(m.messages.badge).toBe(0);
    expect(m.requests.badge).toBe(0);
  });

  test("gönderilen istek sayısı şeride taşınmaz (kompakt şerit, eylem istemiyor)", () => {
    const m = buildFriendsBarModel({ incomingRequests: 0, outgoingRequests: 4 });
    expect(m.requests.badge).toBe(0);
    expect(JSON.stringify(m)).not.toContain("4");
  });
});

// ── Bileşen ↔ çeviri paketleri ────────────────────────────────────────────
// Şerit yalnız mevcut ortak anahtarları kullanır; bir etiket anahtarı silinirse
// ya da yazımı değişirse şerit sessizce Türkçe yedek metne düşer.
describe("FriendsActionBar etiketleri", () => {
  const KOK = path.join(__dirname, "..");
  const kaynak = fs.readFileSync(path.join(KOK, "components", "profile", "FriendsActionBar.js"), "utf8");
  const tr = JSON.parse(fs.readFileSync(path.join(KOK, "translations", "tr.json"), "utf8"));
  const en = JSON.parse(fs.readFileSync(path.join(KOK, "translations", "en.json"), "utf8"));
  const anahtarlar = [...kaynak.matchAll(/i18nText\(\s*"autoI18n\.([A-Za-z0-9_]+)"/g)].map((m) => m[1]);

  test("dört sekme etiketinin dördü de çeviri anahtarıyla çizilir", () => {
    expect(new Set(anahtarlar)).toEqual(new Set(["ara_2", "arkadaslar", "mesajlar", "istekler"]));
  });

  test("etiket anahtarları tr ve en paketlerinde var", () => {
    for (const ad of anahtarlar) {
      expect(typeof tr.autoI18n[ad]).toBe("string");
      expect(typeof en.autoI18n[ad]).toBe("string");
    }
  });

  test("kaldırılan bilgi satırı çevirileri artık paketlerde ölü metin olarak durmaz", () => {
    for (const bundle of [tr, en]) {
      const kalan = Object.keys(bundle.autoI18n).filter((k) => k.startsWith("friendsbar_"));
      expect(kalan).toEqual([]);
    }
  });
});
