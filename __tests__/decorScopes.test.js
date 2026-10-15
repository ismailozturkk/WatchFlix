// __tests__/decorScopes.test.js
//
// "Hangi efekt hangi ekranlarda" kararı: saf mantık + KAPSAM BEKÇİSİ.
//
// Bekçinin sebebi: her ekran <ScreenDecor scope="…" /> ile bir gruba bağlanır.
// Gruba bağlanmayı unutan (ya da elle <IconBacground/> kuran) yeni bir ekran,
// kullanıcının "bu efekt şu grupta kapalı" seçimini SESSİZCE yok sayar — hata
// vermez, yalnız ayar ekranı yalan söyler. Bu test o sınıfı build zamanına çeker.

const fs = require("fs");
const path = require("path");

const {
  DECOR_EFFECTS,
  DECOR_SCOPES,
  DECOR_SCOPE_IDS,
  countHiddenDecor,
  decorScopeSupports,
  decorScopesFor,
  decorVisibility,
  isDecorCustomized,
  isDecorEffectEverywhere,
  isDecorEffectNowhere,
  isDecorVisible,
  normalizeDecorScopes,
  setDecorEffectVisible,
  setDecorVisible,
} = require("../utils/decorScopes");

describe("normalizeDecorScopes", () => {
  test("boş / bozuk / eski kayıt her efekt her yerde açık demektir", () => {
    const bos = { snow: [], icon: [], ambient: [] };
    expect(normalizeDecorScopes(null)).toEqual(bos);
    expect(normalizeDecorScopes(undefined)).toEqual(bos);
    expect(normalizeDecorScopes("x")).toEqual(bos);
    expect(normalizeDecorScopes([])).toEqual(bos);
    expect(normalizeDecorScopes({})).toEqual(bos);
    expect(normalizeDecorScopes({ snow: "chat" })).toEqual(bos);
  });

  test("bilinmeyen efekt/grup atılır, tekrar silinir, sıra kanonik olur", () => {
    const n = normalizeDecorScopes({
      snow: ["chat", "yok", "home", "chat", 7, null],
      icon: ["settings"],
      sahte: ["home"],
    });
    expect(n.snow).toEqual(["home", "chat"]); // DECOR_SCOPES sırası
    expect(n.icon).toEqual(["settings"]);
    expect(n.ambient).toEqual([]);
    expect(n).not.toHaveProperty("sahte");
  });

  test("girdiyi DEĞİŞTİRMEZ ve her seferinde yeni nesne döner", () => {
    const girdi = Object.freeze({ snow: Object.freeze(["chat"]) });
    const a = normalizeDecorScopes(girdi);
    const b = normalizeDecorScopes(girdi);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe("görünürlük", () => {
  const hidden = { snow: ["chat"], icon: [], ambient: ["home", "details"] };

  test("gizli çift görünmez, diğerleri görünür", () => {
    expect(isDecorVisible(hidden, "snow", "chat")).toBe(false);
    expect(isDecorVisible(hidden, "snow", "home")).toBe(true);
    expect(isDecorVisible(hidden, "icon", "chat")).toBe(true);
    expect(isDecorVisible(hidden, "ambient", "details")).toBe(false);
  });

  test("scope verilmemişse süzgeç YOK", () => {
    for (const effect of DECOR_EFFECTS) {
      expect(isDecorVisible(hidden, effect, undefined)).toBe(true);
      expect(isDecorVisible(hidden, effect, null)).toBe(true);
    }
  });

  test("bozuk gizli listesi çökmez, görünür sayılır", () => {
    expect(isDecorVisible(null, "snow", "chat")).toBe(true);
    expect(isDecorVisible({}, "snow", "chat")).toBe(true);
    expect(isDecorVisible({ snow: "chat" }, "snow", "chat")).toBe(true);
  });

  test("decorVisibility üç efekti döner; effects süzgeci kalanı kapatır", () => {
    expect(decorVisibility(hidden, "chat")).toEqual({
      snow: false,
      icon: true,
      ambient: true,
    });
    expect(decorVisibility(hidden, "chat", ["icon"])).toEqual({
      snow: false,
      icon: true,
      ambient: false,
    });
    // Yalnız ikon isteyen ekran, ikonun gizli olduğu grupta hiçbir şey çizmez.
    expect(decorVisibility({ icon: ["details"] }, "details", ["icon"])).toEqual({
      snow: false,
      icon: false,
      ambient: false,
    });
  });
});

describe("değiştiriciler", () => {
  test("setDecorVisible: kapatır, geri açar, tekrar kapatmak çoğaltmaz", () => {
    let h = normalizeDecorScopes(null);
    h = setDecorVisible(h, "snow", "chat", false);
    expect(h.snow).toEqual(["chat"]);
    h = setDecorVisible(h, "snow", "chat", false);
    expect(h.snow).toEqual(["chat"]);
    h = setDecorVisible(h, "snow", "chat", true);
    expect(h.snow).toEqual([]);
  });

  test("setDecorVisible: efektler birbirini etkilemez, bilinmeyen çift yok sayılır", () => {
    const h = setDecorVisible(null, "icon", "lists", false);
    expect(h).toEqual({ snow: [], icon: ["lists"], ambient: [] });
    expect(setDecorVisible(h, "yok", "lists", false)).toEqual(h);
    expect(setDecorVisible(h, "snow", "yok", false)).toEqual(h);
  });

  test("setDecorEffectVisible: bir efekti tüm gruplarda açar/kapatır", () => {
    const kapali = setDecorEffectVisible(null, "ambient", false);
    expect(kapali.ambient).toEqual([...DECOR_SCOPE_IDS]);
    expect(kapali.snow).toEqual([]);
    expect(isDecorEffectNowhere(kapali, "ambient")).toBe(true);
    const acik = setDecorEffectVisible(kapali, "ambient", true);
    expect(isDecorEffectEverywhere(acik, "ambient")).toBe(true);
  });

  test("özet: özel mi, kaç çift gizli", () => {
    expect(isDecorCustomized(null)).toBe(false);
    expect(countHiddenDecor(null)).toBe(0);
    const h = setDecorVisible(setDecorVisible(null, "snow", "chat", false), "icon", "home", false);
    expect(isDecorCustomized(h)).toBe(true);
    expect(countHiddenDecor(h)).toBe(2);
  });

  test("kullanıcı örneği: ana ekranda kar, sohbette ikon, liste+detayda ambiyans", () => {
    // Her şeyi kapat, sonra istenenleri aç.
    let h = null;
    for (const e of DECOR_EFFECTS) h = setDecorEffectVisible(h, e, false);
    h = setDecorVisible(h, "snow", "home", true);
    h = setDecorVisible(h, "icon", "chat", true);
    h = setDecorVisible(h, "ambient", "lists", true);
    h = setDecorVisible(h, "ambient", "details", true);

    expect(decorVisibility(h, "home")).toEqual({ snow: true, icon: false, ambient: false });
    expect(decorVisibility(h, "chat")).toEqual({ snow: false, icon: true, ambient: false });
    expect(decorVisibility(h, "lists")).toEqual({ snow: false, icon: false, ambient: true });
    expect(decorVisibility(h, "details")).toEqual({ snow: false, icon: false, ambient: true });
    expect(decorVisibility(h, "profile")).toEqual({ snow: false, icon: false, ambient: false });
  });
});

describe("grup tablosu", () => {
  test("kimlikler benzersiz ve her grubun bir simgesi var", () => {
    expect(new Set(DECOR_SCOPE_IDS).size).toBe(DECOR_SCOPES.length);
    for (const s of DECOR_SCOPES) {
      expect(s.id).toMatch(/^[a-z]+$/);
      expect(typeof s.icon).toBe("string");
      expect(s.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("destek tablosu (Sohbet içi: kar yok)", () => {
  test("her grubun destek listesi dolu ve yalnız bilinen efektlerden oluşur", () => {
    for (const s of DECOR_SCOPES) {
      expect(s.effects.length).toBeGreaterThan(0);
      for (const e of s.effects) expect(DECOR_EFFECTS).toContain(e);
    }
  });

  test("conversation ikon + ambiyans destekler, kar desteklemez; diğerleri hepsini", () => {
    expect(decorScopeSupports("conversation", "icon")).toBe(true);
    expect(decorScopeSupports("conversation", "ambient")).toBe(true);
    expect(decorScopeSupports("conversation", "snow")).toBe(false);
    for (const id of DECOR_SCOPE_IDS.filter((x) => x !== "conversation")) {
      for (const e of DECOR_EFFECTS) expect(decorScopeSupports(id, e)).toBe(true);
    }
    expect(decorScopeSupports("yok", "snow")).toBe(false);
    expect(decorScopesFor("snow")).not.toContain("conversation");
    expect(decorScopesFor("ambient")).toContain("conversation");
  });

  test("grup desteklemiyorsa efekt ASLA görünmez (seçim boş olsa bile)", () => {
    expect(decorVisibility(null, "conversation")).toEqual({
      snow: false,
      icon: true,
      ambient: true,
    });
  });

  test("ambiyans Sohbet içi'nde ayrı açılıp kapanır (liste ekranlarından bağımsız)", () => {
    const h = setDecorVisible(null, "ambient", "conversation", false);
    expect(decorVisibility(h, "conversation").ambient).toBe(false);
    expect(decorVisibility(h, "conversation").icon).toBe(true);
    expect(decorVisibility(h, "chat").ambient).toBe(true);
    const geri = setDecorVisible(h, "ambient", "conversation", true);
    expect(decorVisibility(geri, "conversation").ambient).toBe(true);
  });

  test("desteklenmeyen çift yazılamaz ve bozuk kayıttan atılır", () => {
    expect(setDecorVisible(null, "snow", "conversation", false)).toEqual({
      snow: [],
      icon: [],
      ambient: [],
    });
    expect(normalizeDecorScopes({ snow: ["conversation", "chat"] }).snow).toEqual(["chat"]);
  });

  test("toplu kapatma yalnız destekleyen gruplara yazar; Nowhere/Everywhere tutarlı", () => {
    const kapali = setDecorEffectVisible(null, "snow", false);
    expect(kapali.snow).toEqual(decorScopesFor("snow"));
    expect(kapali.snow).not.toContain("conversation");
    // Kar her destekleyen grupta kapalı → "hiçbir yerde"; conversation yüzünden
    // "karışık"a düşmemeli.
    expect(isDecorEffectNowhere(kapali, "snow")).toBe(true);
    expect(isDecorEffectEverywhere(setDecorEffectVisible(kapali, "snow", true), "snow")).toBe(true);
    // Ambiyans tüm gruplarda (conversation dahil) kapanır.
    expect(setDecorEffectVisible(null, "ambient", false).ambient).toContain("conversation");
  });
});

describe("kalıcı kayıt (Keys.decorScopes)", () => {
  // MMKV taklidi kök __mocks__ klasöründen otomatik gelir (bkz. storage.test.js).
  const { __resetAllMMKV } = require("react-native-mmkv");
  const { Keys, get, set } = require("../services/storage");
  const { __resetStoreCaches } = require("../services/storage/store");
  const { __resetStores } = require("../services/storage/instances");

  beforeEach(() => {
    __resetStores();
    __resetAllMMKV();
    __resetStoreCaches();
  });

  test("kayıt yoksa normalize sonucu 'her yerde'", () => {
    expect(normalizeDecorScopes(get(Keys.decorScopes))).toEqual({
      snow: [],
      icon: [],
      ambient: [],
    });
  });

  test("yazılan tercih gidiş-dönüşte aynen gelir", () => {
    const hidden = setDecorVisible(setDecorVisible(null, "snow", "chat", false), "ambient", "home", false);
    expect(set(Keys.decorScopes, hidden)).toBe(true);
    expect(normalizeDecorScopes(get(Keys.decorScopes))).toEqual(hidden);
  });

  test("düz nesne olmayan değer reddedilir (dizi/dizge depoya girmez)", () => {
    expect(set(Keys.decorScopes, ["chat"])).toBe(false);
    expect(set(Keys.decorScopes, "chat")).toBe(false);
    expect(isDecorCustomized(get(Keys.decorScopes))).toBe(false);
  });
});

// ── Kapsam bekçisi ───────────────────────────────────────────────────────────

const KOK = path.join(__dirname, "..");
const TARANAN = ["screens", "components"];

const jsDosyalari = (klasor, toplam = []) => {
  if (!fs.existsSync(klasor)) return toplam;
  for (const girdi of fs.readdirSync(klasor, { withFileTypes: true })) {
    const yol = path.join(klasor, girdi.name);
    if (girdi.isDirectory()) {
      if (girdi.name !== "node_modules") jsDosyalari(yol, toplam);
    } else if (/\.jsx?$/.test(girdi.name)) {
      toplam.push(yol);
    }
  }
  return toplam;
};

const KAYNAKLAR = [
  ...TARANAN.flatMap((k) => jsDosyalari(path.join(KOK, k))),
  path.join(KOK, "App.js"),
].map((dosya) => ({
  dosya: path.relative(KOK, dosya).replace(/\\/g, "/"),
  // Yorum satırlarını at: açıklamalar `<ScreenDecor />` örneği içeriyor.
  satirlar: fs
    .readFileSync(dosya, "utf8")
    .split(/\r?\n/)
    .filter((s) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(s)),
}));

const jsx = (ad) =>
  KAYNAKLAR.flatMap(({ dosya, satirlar }) =>
    satirlar
      .join("\n")
      .split(new RegExp(`<${ad}(?=[\\s/>])`))
      .slice(1)
      .map((parca) => ({ dosya, oznitelikler: parca.slice(0, parca.search(/\/>|>/)) })),
  );

describe("kapsam bekçisi", () => {
  const decorlar = jsx("ScreenDecor");

  test("her <ScreenDecor> BİLİNEN bir gruba bağlı", () => {
    expect(decorlar.length).toBeGreaterThan(30);
    const sorunlar = [];
    for (const { dosya, oznitelikler } of decorlar) {
      const m = oznitelikler.match(/\bscope=(?:"([^"]+)"|\{"([^"]+)"\})/);
      const id = m && (m[1] || m[2]);
      if (!id) sorunlar.push(`${dosya}: scope yok`);
      else if (!DECOR_SCOPE_IDS.includes(id)) sorunlar.push(`${dosya}: bilinmeyen grup "${id}"`);
    }
    expect(sorunlar).toEqual([]);
  });

  test("her grubun en az bir ekranı var (ayar ekranında boş satır olmasın)", () => {
    const kullanilan = new Set(
      decorlar
        .map(({ oznitelikler }) => oznitelikler.match(/\bscope="([^"]+)"/))
        .filter(Boolean)
        .map((m) => m[1]),
    );
    expect(DECOR_SCOPE_IDS.filter((id) => !kullanilan.has(id))).toEqual([]);
  });

  test("efektler ScreenDecor'u BYPASS ederek elle kurulmuyor", () => {
    // Elle kurulan <IconBacground/>, <ScreenSnow/>, <AmbientBackground/> grup
    // süzgecini atlar. İstisna: tanıtım ekranı (oturum öncesi, poster fonu
    // üstüne özel katmanlı) yalnız genel ikon anahtarına uyar — bilinçli.
    const IZINLI = new Set(["components/ScreenDecor.js", "screens/onboarding/OnboardingScreen.js"]);
    const ihlaller = ["IconBacground", "ScreenSnow", "AmbientBackground"].flatMap((ad) =>
      jsx(ad)
        .filter(({ dosya }) => !IZINLI.has(dosya))
        .map(({ dosya }) => `${dosya}: <${ad}> elle kurulmuş`),
    );
    expect(ihlaller).toEqual([]);
  });
});
