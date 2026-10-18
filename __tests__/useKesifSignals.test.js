// __tests__/useKesifSignals.test.js
//
// hooks/useKesifSignals — Keşif rozetlerinin HAZIR OLMA ölçütleri ve referans kararlılığı.
// Hook'un kendisi React + bağlamlar ister; burada bağlamlar/motor SAHTE (mutable durum),
// hook GERÇEK ve react-test-renderer ile render edilir. Saf mantık
// (utils/kesifSignals.js) __tests__/kesifBadges.test.js'te; bu dosya "hangi durumda hangi
// kaynak hazır sayılır" kararını kilitler — yanlış "hazır" = eski kullanıcıya sahte kutlama.

const React = require("react");
const TestRenderer = require("react-test-renderer");

// react-test-renderer'ın act() uyarısı bu bayrak olmadan her çağrıda console.error basar.
global.IS_REACT_ACT_ENVIRONMENT = true;

// ── Sahte dünya ─────────────────────────────────────────────────────────────
const dunya = {};
const sifirla = () => {
  Object.assign(dunya, {
    user: { uid: "u1" },
    domains: {
      notes: { ready: true, lists: { items: [] } },
      mediaNotes: { ready: true, lists: { items: [] } },
      reminders: { ready: true, lists: { movies: [], episodes: [] } },
      aiConversations: { ready: true, lists: { items: [] } },
    },
    friends: { loading: false, friends: [] },
    listStatus: {
      loading: false, watchedTvLoaded: true,
      otherListKeys: [], favoritesItems: [], watchListItems: [],
    },
    shared: { loading: false, sharedLists: [] },
    profile: { loading: false, profile: { uid: "u1", postsCount: 0, bio: "", fourFavorites: undefined } },
  });
};

jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: dunya.user }) }));
jest.mock("../context/FriendsContext", () => ({ useFriends: () => dunya.friends }));
jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: () => dunya.listStatus }));
jest.mock("../context/SharedListsContext", () => ({ useSharedLists: () => dunya.shared }));
jest.mock("../context/UserProfileContext", () => ({ useUserProfile: () => dunya.profile }));
jest.mock("../hooks/useUserDataDomain", () => ({
  __esModule: true,
  default: (domain) => dunya.domains[domain.name],
}));
jest.mock("../services/userData", () => ({
  notesDomain: { name: "notes" },
  mediaNotesDomain: { name: "mediaNotes" },
  remindersDomain: { name: "reminders" },
  aiConversationsDomain: { name: "aiConversations" },
}));

const useKesifSignals = require("../hooks/useKesifSignals").default;
const { KESIF_KAYNAKLARI } = require("../utils/kesifSignals");

/** Hook'u render eder; `oku()` her çağrıda GÜNCEL dönüşü verir, `yenile()` yeniden çizer. */
function kur() {
  let sonuc;
  function Prob() {
    sonuc = useKesifSignals();
    return null;
  }
  let agac;
  TestRenderer.act(() => { agac = TestRenderer.create(React.createElement(Prob)); });
  return {
    oku: () => sonuc,
    yenile: () => TestRenderer.act(() => { agac.update(React.createElement(Prob)); }),
    sok: () => TestRenderer.act(() => { agac.unmount(); }),
  };
}

beforeEach(sifirla);

// react-test-renderer her create() çağrısında "deprecated" uyarısı basıyor; repoda
// başka bir hook render aracı yok (bkz. jest.config.js notu). Yalnız o uyarı susturulur.
let hataSpy;
beforeAll(() => {
  const gercek = console.error;
  hataSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (typeof args[0] === "string" && args[0].includes("react-test-renderer is deprecated")) return;
    gercek(...args);
  });
});
afterAll(() => hataSpy.mockRestore());

describe("hazır olma ölçütleri", () => {
  test("her şey yüklü ve boş: 8 kaynağın hepsi hazır, sayılar 0", () => {
    const h = kur();
    const { sayilar, hazir } = h.oku();
    expect(KESIF_KAYNAKLARI.every((k) => hazir[k] === true)).toBe(true);
    expect(Object.values(sayilar).every((v) => v === 0)).toBe(true);
    expect(Object.keys(sayilar)).toHaveLength(13);
    h.sok();
  });

  test("oturum yok: hiçbir kaynak hazır değil", () => {
    dunya.user = null;
    const h = kur();
    expect(Object.values(h.oku().hazir).every((v) => v === false)).toBe(true);
    expect(h.oku().sayilar).toEqual({});
    h.sok();
  });

  test.each([
    ["notes", "notlar"],
    ["mediaNotes", "medyaNotlari"],
    ["reminders", "hatirlaticilar"],
    ["aiConversations", "yapayZeka"],
  ])("yerel motor %s: ready=false → %s hazır DEĞİL (tek seferlik indirme sürüyor)", (alan, kaynak) => {
    dunya.domains[alan] = { ...dunya.domains[alan], ready: false };
    const h = kur();
    expect(h.oku().hazir[kaynak]).toBe(false);
    // diğerleri etkilenmez
    expect(KESIF_KAYNAKLARI.filter((k) => h.oku().hazir[k] === false)).toEqual([kaynak]);
    h.sok();
  });

  test("arkadaşlar: loading iken hazır değil; yüklenince hazır ve sayı yansır", () => {
    dunya.friends = { loading: true, friends: [] };
    const h = kur();
    expect(h.oku().hazir.arkadaslar).toBe(false);
    expect(h.oku().sayilar.arkadas).toBeUndefined();
    dunya.friends = { loading: false, friends: [{ id: "a" }] };
    h.yenile();
    expect(h.oku().hazir.arkadaslar).toBe(true);
    expect(h.oku().sayilar.arkadas).toBe(1);
    h.sok();
  });

  test("listeler: kök belge loading'i kapatsa bile watchedTvLoaded gelene kadar HAZIR DEĞİL", () => {
    // ListStatusContext kök snapshot'ta loading=false yapar, eksik listeleri (favori/izleme
    // listesi) sonradan indirir. O ara "hazır, 0 favori" demek sahte kutlama üretirdi.
    dunya.listStatus = { ...dunya.listStatus, loading: false, watchedTvLoaded: false };
    const h = kur();
    expect(h.oku().hazir.listeler).toBe(false);
    dunya.listStatus = {
      ...dunya.listStatus, watchedTvLoaded: true,
      favoritesItems: [{ id: 1 }], watchListItems: [{ id: 2 }, { id: 3 }], otherListKeys: ["Yaz"],
    };
    h.yenile();
    expect(h.oku().hazir.listeler).toBe(true);
    expect(h.oku().sayilar).toMatchObject({ favori: 1, izlemeListesi: 2, ozelListe: 1 });
    h.sok();
  });

  test("ortak listeler: loading iken değil; üyelik sayılır", () => {
    dunya.shared = { loading: true, sharedLists: [] };
    const h = kur();
    expect(h.oku().hazir.ortakListeler).toBe(false);
    dunya.shared = { loading: false, sharedLists: [{ id: "l1" }] };
    h.yenile();
    expect(h.oku().hazir.ortakListeler).toBe(true);
    expect(h.oku().sayilar.ortakListe).toBe(1);
    h.sok();
  });

  test("profil: başka hesabın profili ya da loading iken hazır DEĞİL", () => {
    dunya.profile = { loading: false, profile: { uid: "baskasi", postsCount: 9, bio: "merhaba" } };
    const h = kur();
    expect(h.oku().hazir.profil).toBe(false);          // eski hesabın verisi sızmaz
    expect(h.oku().sayilar.gonderi).toBeUndefined();
    dunya.profile = { loading: true, profile: { uid: "u1", postsCount: 2, bio: "x" } };
    h.yenile();
    expect(h.oku().hazir.profil).toBe(false);
    dunya.profile = { loading: false, profile: null };
    h.yenile();
    expect(h.oku().hazir.profil).toBe(false);
    dunya.profile = { loading: false, profile: { uid: "u1", postsCount: 2, bio: "x" } };
    h.yenile();
    expect(h.oku().hazir.profil).toBe(true);
    expect(h.oku().sayilar).toMatchObject({ gonderi: 2, biyografi: 1 });
    h.sok();
  });

  test("dört favori: film+dizi+oyuncu toplamı; bozuk giriş sayılmaz", () => {
    const giris = (id) => ({ id, title: `T${id}`, image: `/a${id}.jpg` });
    dunya.profile = {
      loading: false,
      profile: {
        uid: "u1",
        fourFavorites: { movies: [giris(1), giris(2)], shows: [giris(3)], people: [{ id: -5, title: "" }] },
      },
    };
    const h = kur();
    expect(h.oku().sayilar.dortFavori).toBe(3);
    h.sok();
  });

  test("bağlam hiç yoksa (ağaç dışı render) atmaz ve ilgili kaynaklar hazır DEĞİL", () => {
    dunya.friends = undefined;
    dunya.listStatus = undefined;
    dunya.shared = undefined;
    dunya.profile = undefined;
    let h;
    expect(() => { h = kur(); }).not.toThrow();
    const { hazir } = h.oku();
    expect([hazir.arkadaslar, hazir.listeler, hazir.ortakListeler, hazir.profil]).toEqual([false, false, false, false]);
    expect([hazir.notlar, hazir.medyaNotlari, hazir.hatirlaticilar, hazir.yapayZeka]).toEqual([true, true, true, true]);
    h.sok();
  });
});

describe("referans kararlılığı", () => {
  test("not METNİ düzenlenip liste yeni dizi olunca bile dönüş AYNI referans (tüketiciler yeniden çizilmez)", () => {
    dunya.domains.notes = { ready: true, lists: { items: [{ id: "a", type: "note", content: "ilk" }] } };
    const h = kur();
    const ilk = h.oku();
    dunya.domains.notes = { ready: true, lists: { items: [{ id: "a", type: "note", content: "düzenlendi" }] } };
    h.yenile();
    expect(h.oku()).toBe(ilk);
    h.sok();
  });

  test("6. not yazılsa da referans değişmez (sayı KESIF_TAVAN'da kırpılı)", () => {
    const not = (i) => ({ id: `n${i}`, type: "note" });
    dunya.domains.notes = { ready: true, lists: { items: [1, 2, 3, 4, 5].map(not) } };
    const h = kur();
    const bes = h.oku();
    dunya.domains.notes = { ready: true, lists: { items: [1, 2, 3, 4, 5, 6].map(not) } };
    h.yenile();
    expect(h.oku()).toBe(bes);
    h.sok();
  });

  test("ilk not / hazırlık değişimi YENİ referans üretir", () => {
    const h = kur();
    const bos = h.oku();
    dunya.domains.notes = { ready: true, lists: { items: [{ id: "a", type: "note" }] } };
    h.yenile();
    expect(h.oku()).not.toBe(bos);
    expect(h.oku().sayilar.not).toBe(1);
    const birNot = h.oku();
    dunya.domains.notes = { ready: false, lists: { items: [] } };   // çıkış-giriş: indirme
    h.yenile();
    expect(h.oku()).not.toBe(birNot);
    expect(h.oku().hazir.notlar).toBe(false);
    h.sok();
  });
});
