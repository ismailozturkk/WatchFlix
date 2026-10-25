// __tests__/listVisibility.test.js
//
// "Profilinde görünen listeler" çekirdeği (utils/listVisibility.js) + ekran bağları.
// Kural FriendProfileScreen ile aynı olmalı: liste YALNIZ `true` ise profilde çizilir;
// listeler profil görünürlüğünden geniş bir kitleye açılamaz.

const fs = require("fs");
const path = require("path");
const {
  buildListVisibilityRows,
  bulkVisibilityChanges,
  effectiveListAudience,
  isListShown,
  normalizeListVisible,
  summarizeListVisibility,
} = require("../utils/listVisibility");
const { LIST_VISIBILITY_COPY, getListVisibilityCopy } = require("../screens/tabs/profile/listVisibilityCopy");

const ROOT = path.join(__dirname, "..");
const oku = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("normalizeListVisible", () => {
  test("harita olduğu gibi (kopya) döner", () => {
    const raw = { favorites: true, Korku: false };
    const map = normalizeListVisible(raw);
    expect(map).toEqual(raw);
    expect(map).not.toBe(raw);
  });

  test("eski dizi biçimi haritaya çevrilir", () => {
    expect(normalizeListVisible([{ favorites: true }, { watchList: false }, null])).toEqual({
      favorites: true,
      watchList: false,
    });
  });

  test("boş/geçersiz değer boş harita", () => {
    for (const raw of [undefined, null, "x", 3]) expect(normalizeListVisible(raw)).toEqual({});
  });
});

describe("isListShown", () => {
  test("yalnız açıkça true gösterilir (FriendProfileScreen ile aynı)", () => {
    const map = { a: true, b: false, c: "true", d: 1 };
    expect(["a", "b", "c", "d", "yok"].map((n) => isListShown(map, n))).toEqual([true, false, false, false, false]);
  });
});

describe("buildListVisibilityRows", () => {
  const lists = {
    Zeta: [{ id: 1 }],
    watchedTv: [{ id: 2 }, { id: 3 }],
    favorites: [],
    Alfa: [],
    watchList: [{ id: 4 }],
    watchedMovies: [{ id: 5 }],
    bozuk: "dizi değil",
  };

  test("dört öntanımlı sabit sırada, ardından özel listeler ada göre; dizi olmayan atlanır", () => {
    const rows = buildListVisibilityRows(lists, {}, "tr");
    expect(rows.map((r) => r.name)).toEqual(["favorites", "watchList", "watchedMovies", "watchedTv", "Alfa", "Zeta"]);
  });

  test("sayı, durum ve öntanımlı işareti", () => {
    const rows = buildListVisibilityRows(lists, { watchedTv: true, Zeta: true, Alfa: false }, "tr");
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName.watchedTv).toEqual({ name: "watchedTv", count: 2, shown: true, predefined: true });
    expect(byName.Zeta).toEqual({ name: "Zeta", count: 1, shown: true, predefined: false });
    expect(byName.Alfa.shown).toBe(false);
    expect(byName.favorites.shown).toBe(false);
  });

  test("noktalı liste adı tek anahtar kalır", () => {
    const rows = buildListVisibilityRows({ "S.W.A.T.": [{ id: 1 }] }, { "S.W.A.T.": true }, "tr");
    expect(rows).toEqual([{ name: "S.W.A.T.", count: 1, shown: true, predefined: false }]);
  });

  test("liste verisi yokken boş", () => {
    expect(buildListVisibilityRows(undefined, {}, "tr")).toEqual([]);
  });
});

describe("özet ve toplu değişiklik", () => {
  const rows = [
    { name: "a", count: 1, shown: true },
    { name: "b", count: 0, shown: false },
    { name: "c", count: 4, shown: true },
  ];

  test("açık sayısı", () => {
    expect(summarizeListVisibility(rows)).toEqual({ shown: 2, total: 3 });
  });

  test("toplu aç/kapat yalnız değişenleri yazar", () => {
    expect(bulkVisibilityChanges(rows, true)).toEqual({ b: true });
    expect(bulkVisibilityChanges(rows, false)).toEqual({ a: false, c: false });
  });
});

describe("effectiveListAudience", () => {
  test("profil listelerden darsa profil kazanır", () => {
    expect(effectiveListAudience({ profile: "friends", lists: "public" })).toEqual({
      audience: "friends",
      limitedByProfile: true,
    });
    expect(effectiveListAudience({ profile: "private", lists: "friends" })).toEqual({
      audience: "private",
      limitedByProfile: true,
    });
  });

  test("listeler daha darsa ya da eşitse liste ayarı geçerli", () => {
    expect(effectiveListAudience({ profile: "public", lists: "friends" })).toEqual({
      audience: "friends",
      limitedByProfile: false,
    });
    expect(effectiveListAudience({ profile: "private", lists: "private" })).toEqual({
      audience: "private",
      limitedByProfile: false,
    });
  });

  test("eksik/bilinmeyen değer varsayılan (herkese açık)", () => {
    expect(effectiveListAudience(undefined)).toEqual({ audience: "public", limitedByProfile: false });
    expect(effectiveListAudience({ profile: "zz", lists: "friends" }).audience).toBe("friends");
  });

  test("daraltılmış her kitlenin açıklaması var (ekran metni boş kalmasın)", () => {
    for (const dil of Object.keys(LIST_VISIBILITY_COPY)) {
      const kopya = LIST_VISIBILITY_COPY[dil];
      for (const profile of ["public", "friends", "private"]) {
        for (const lists of ["public", "friends", "private"]) {
          const { audience, limitedByProfile } = effectiveListAudience({ profile, lists });
          const metin = limitedByProfile ? kopya.limitedNote[audience] : kopya.audienceNote[audience];
          expect({ dil, profile, lists, dolu: typeof metin === "string" && metin.length > 0 }).toEqual({
            dil,
            profile,
            lists,
            dolu: true,
          });
        }
      }
    }
  });
});

describe("metin", () => {
  test("bilinmeyen dil İngilizceye düşer", () => {
    expect(getListVisibilityCopy("fr")).toBe(LIST_VISIBILITY_COPY.en);
    expect(getListVisibilityCopy("tr")).toBe(LIST_VISIBILITY_COPY.tr);
  });

  test("İngilizce tekil/çoğul", () => {
    const en = LIST_VISIBILITY_COPY.en;
    expect(en.shownSub(1)).toMatch(/^1 title /);
    expect(en.shownSub(3)).toMatch(/^3 titles /);
    expect(en.rowSub(1, 1)).toBe("1 of 1 list shown");
  });
});

describe("ekran bağları", () => {
  test("ekran App.js'te kayıtlı ve Gizlilik ayarlarından açılıyor", () => {
    expect(oku("App.js")).toMatch(/name="ListVisibilityScreen"[\s\S]{0,200}ListVisibilityScreen"\)\.default/);
    expect(oku("screens/tabs/profile/PrivacySettingsScreen.js")).toContain('navigate?.("ListVisibilityScreen")');
  });

  test("Listelerim kartlarında yazısız göz anahtarı geri gelmedi", () => {
    const src = oku("screens/lists/ListsViewScreen.js");
    expect(src).not.toMatch(/onVisibilityToggle|eye-off-outline/);
  });

  test("Listelerim başlığındaki kilit düğmesi doğrudan bu ekrana gider, adı okunur", () => {
    const src = oku("screens/lists/ListsViewScreen.js");
    const dugme = src.match(/<GlassIconButton[\s\S]*?testID="lists-privacy-button"[\s\S]*?\/>/);
    expect(dugme).not.toBeNull();
    expect(dugme[0]).toContain('navigation.navigate("ListVisibilityScreen")');
    expect(dugme[0]).toContain("accessibilityLabel={getListVisibilityCopy(language).rowTitle}");
  });
});
