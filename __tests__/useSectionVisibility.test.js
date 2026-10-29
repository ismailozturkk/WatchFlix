// __tests__/useSectionVisibility.test.js
//
// Bölüm görünürlüğü kancası + yazıcılar, GERÇEK depoyla (bellek-içi MMKV taklidi).
// Önemli olan: ayar sayfasında bir anahtara basınca arkada duran ekranın (bu kancayı
// kullanan) anında güncellenmesi, hızlı art arda yazımların birbirini ezmemesi ve
// bozuk kaydın ekranı bozmaması.

import React from "react";
import { act, create } from "react-test-renderer";

const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get, getStore, has, physicalKey } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const useScreenSections = require("../hooks/useSectionVisibility").default;
const {
  resetSectionVisibility,
  setScreenSectionsShown,
  setSectionShown,
} = require("../hooks/useSectionVisibility");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
const seen = {};

function Probe({ screen, name = screen }) {
  seen[name] = useScreenSections(screen);
  return null;
}
function mount(...screens) {
  act(() => {
    renderer = create(
      <>
        {screens.map((screen) => (
          <Probe key={screen} screen={screen} />
        ))}
      </>,
    );
  });
}

beforeEach(() => {
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  Object.keys(seen).forEach((key) => delete seen[key]);
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  warn.mockRestore();
});

describe("useScreenSections", () => {
  test("kayıt yokken her bölüm görünür", () => {
    mount("library");
    expect(seen.library.isVisible("notes")).toBe(true);
    expect(seen.library.hiddenCount).toBe(0);
    expect(seen.library.allHidden).toBe(false);
  });

  test("bir bölümü gizlemek AÇIK ekranı anında günceller, öteki ekrana dokunmaz", () => {
    mount("library", "hub");
    act(() => {
      expect(setSectionShown("library", "notes", false)).toBe(true);
    });
    expect(seen.library.isVisible("notes")).toBe(false);
    expect(seen.library.isVisible("lists")).toBe(true);
    expect(seen.library.hiddenCount).toBe(1);
    expect(seen.hub.hiddenCount).toBe(0);
    expect(seen.hub.isVisible("games")).toBe(true);
  });

  test("tekrar göstermek geri alır ve anahtar silinir (boş nesne depoda dolaşmaz)", () => {
    mount("library");
    act(() => { setSectionShown("library", "notes", false); });
    expect(has(Keys.sectionVisibility)).toBe(true);
    act(() => { setSectionShown("library", "notes", true); });
    expect(seen.library.isVisible("notes")).toBe(true);
    expect(has(Keys.sectionVisibility)).toBe(false);
    expect(get(Keys.sectionVisibility)).toBeNull();
  });

  test("hızlı art arda iki yazım birbirini ezmez (son kayıttan okur)", () => {
    mount("profile");
    act(() => {
      setSectionShown("profile", "activity", false);
      setSectionShown("profile", "stats", false);
      setSectionShown("profile", "badges", false);
    });
    expect(seen.profile.hidden.profile).toEqual(["badges", "stats", "activity"]);
    expect(seen.profile.hiddenCount).toBe(3);
  });

  test("filter: gizli rafları eler, hiçbiri gizli değilse aynı diziyi döner", () => {
    mount("movie");
    const raflar = [{ key: "trends" }, { key: "worldTour" }];
    expect(seen.movie.filter(raflar)).toBe(raflar);
    act(() => { setSectionShown("movie", "worldTour", false); });
    expect(seen.movie.filter(raflar)).toEqual([{ key: "trends" }]);
  });

  test("Film ve Dizi'nin aynı adlı rafı BAĞIMSIZ (trends)", () => {
    mount("tv", "movie");
    act(() => { setSectionShown("tv", "trends", false); });
    expect(seen.tv.isVisible("trends")).toBe(false);
    expect(seen.movie.isVisible("trends")).toBe(true);
  });

  test("ekranın tüm bölümleri gizlenince allHidden true; geri açılınca false", () => {
    mount("hub");
    act(() => { setScreenSectionsShown("hub", false); });
    expect(seen.hub.allHidden).toBe(true);
    expect(seen.hub.hiddenCount).toBe(7);
    act(() => { setSectionShown("hub", "games", true); });
    expect(seen.hub.allHidden).toBe(false);
    act(() => { setScreenSectionsShown("hub", true); });
    expect(seen.hub.hiddenCount).toBe(0);
  });

  test("Kütüphane'de allHidden eski tek anahtarlı bölümü (Sıradaki) saymaz", () => {
    mount("library");
    act(() => { setScreenSectionsShown("library", false); });
    expect(seen.library.allHidden).toBe(true);
    // 5 bölümden 4'ü bu kayıtta saklanır; "nextUp" TV rafıyla ortak ayarda (showOngoingTvShows).
    expect(seen.library.hiddenCount).toBe(4);
    expect(seen.library.hidden.library).toEqual(["lists", "reminders", "notes", "wrapped"]);
  });

  test("Dizi'de allHidden eski tek anahtarlı bölümü (Devam Edenler) saymaz", () => {
    mount("tv");
    act(() => { setScreenSectionsShown("tv", false); });
    expect(seen.tv.allHidden).toBe(true);
    // 14 bölümden 13'ü bu kayıtta saklanır, "ongoing" kendi ayarında.
    expect(seen.tv.hiddenCount).toBe(13);
  });

  test("resetSectionVisibility her şeyi geri açar", () => {
    mount("library", "movie");
    act(() => {
      setSectionShown("library", "notes", false);
      setSectionShown("movie", "worldTour", false);
    });
    act(() => { expect(resetSectionVisibility()).toBe(true); });
    expect(seen.library.hiddenCount).toBe(0);
    expect(seen.movie.hiddenCount).toBe(0);
    expect(has(Keys.sectionVisibility)).toBe(false);
  });

  test("hook sonucu, kayıt değişmedikçe AYNI nesne kalır (memo'lu çocuklar yeniden çizilmez)", () => {
    mount("profile");
    const ilk = seen.profile;
    act(() => { renderer.update(<><Probe key="profile" screen="profile" /></>); });
    expect(seen.profile).toBe(ilk);
  });

  test("bilinmeyen ekran/bölüm yazımı depoyu değiştirmez", () => {
    mount("profile");
    act(() => {
      setSectionShown("yok", "notes", false);
      setSectionShown("profile", "yok", false);
      setSectionShown("tv", "ongoing", false);
      setSectionShown("library", "nextUp", false);
      // Profil'den Kütüphane'ye taşınan bölüm artık Profil'in değil.
      setSectionShown("profile", "notes", false);
    });
    expect(has(Keys.sectionVisibility)).toBe(false);
    expect(seen.profile.hiddenCount).toBe(0);
  });
});

describe("bozuk kayıt", () => {
  test("çözülemeyen JSON ekranı bozmaz: hepsi görünür", () => {
    getStore(Keys.sectionVisibility.store).set(physicalKey(Keys.sectionVisibility), "{bozuk json");
    mount("library");
    expect(seen.library.isVisible("notes")).toBe(true);
    expect(seen.library.hiddenCount).toBe(0);
    expect(get(Keys.sectionVisibility)).toBeNull();
  });

  test("dizi olarak yazılmış kayıt (elle bozulmuş) yok sayılır", () => {
    getStore(Keys.sectionVisibility.store).set(physicalKey(Keys.sectionVisibility), JSON.stringify(["notes"]));
    mount("library");
    expect(seen.library.isVisible("notes")).toBe(true);
  });

  test("içinde bilinmeyen kimlik olan kayıt bilinenleri korur, bilinmeyeni atar", () => {
    getStore(Keys.sectionVisibility.store).set(
      physicalKey(Keys.sectionVisibility),
      JSON.stringify({ library: ["notes", "gelecekte-eklenen"], baskaEkran: ["x"] }),
    );
    mount("library");
    expect(seen.library.hidden.library).toEqual(["notes"]);
    expect(seen.library.isVisible("notes")).toBe(false);
  });

  test("Kütüphane öncesi kayıt: Profil'de gizli Notlar, Kütüphane'de gizli kalır (geri görünmez)", () => {
    getStore(Keys.sectionVisibility.store).set(
      physicalKey(Keys.sectionVisibility),
      JSON.stringify({ profile: ["notes", "stats"] }),
    );
    mount("library", "profile");
    expect(seen.library.isVisible("notes")).toBe(false);
    expect(seen.profile.isVisible("stats")).toBe(false);
    expect(seen.profile.hidden.profile).toEqual(["stats"]);
    // Kütüphane'de yeniden açınca kayıt, taşınmış (temiz) hâliyle yazılır.
    act(() => { setSectionShown("library", "notes", true); });
    expect(seen.library.isVisible("notes")).toBe(true);
    expect(get(Keys.sectionVisibility)).toEqual({ tv: [], movie: [], hub: [], library: [], profile: ["stats"] });
  });
});
