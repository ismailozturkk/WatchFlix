// Profil hikaye kartı × dört favori (bileşen düzeyi).
//
// 15 Eki: "Profili paylaş" kartına dört favori (4 film / 4 dizi / 4 oyuncu)
// eklendi: İçerik'te anahtar + kategori seçimi, Düzen'de yeni "Seçki" düzeni; eski
// düzenlerde favoriler POSTER ALANININ yerine geçer. Burada kilitlenen şey: hangi
// düzende neyin çizildiği, favori yokken/kapalıyken kartın eskisi gibi kalması,
// Seçki'nin favorisiz çizilememesi (Vitrin'e düşer) ve görselsiz öğenin kartı
// bozmaması. Gerçek yerleşim/renk cihazda doğrulanır; dikey bütçe için
// utils/profileStoryCard testlerine bak (planPicksLayout).
import React from "react";
import { act, create } from "react-test-renderer";
import ProfileStoryCard from "../components/storyShare/ProfileStoryCard";
import { makeCardFavorites, makeCardProps, textOf } from "./helpers/storyCardFixtures";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => style,
    absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
    hairlineWidth: 1,
  },
}));
// Babel eklentisi `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: "Svg",
  Defs: "Defs",
  Line: "Line",
  RadialGradient: "RadialGradient",
  Rect: "Rect",
  Stop: "Stop",
}));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("../components/badges/AppBadge", () => ({ __esModule: true, default: "AppBadge" }));
jest.mock("../components/common/UserAvatar", () => ({ __esModule: true, default: "UserAvatar" }));
jest.mock("../hooks/useAppLogo", () => ({ __esModule: true, default: () => ({ logo: "logo" }) }));
// Kart yalnız iki palet işlevini kullanır; WrappedShareCard'ın ağır bağımlılık
// zincirini yüklememek için gerçek paletlerle taklit edilir.
jest.mock("../components/wrapped/WrappedShareCard", () => {
  const { resolveWrappedPalette } = jest.requireActual("../utils/wrappedCard");
  return {
    getWrappedCardPalette: resolveWrappedPalette,
    foregroundForPalette: (palette) => palette?.onAccent || "#FFFFFF",
  };
});

function render(props) {
  let tree;
  act(() => {
    tree = create(<ProfileStoryCard {...props} />);
  });
  return tree;
}

const unmount = (tree) => act(() => tree.unmount());

const imageUris = (tree) =>
  tree.root
    .findAll((node) => node.type === "Image")
    .map((node) => node.props.source?.uri)
    .filter((uri) => typeof uri === "string" && uri.includes("img.test"));

const iconNames = (tree) =>
  tree.root.findAll((node) => node.type === "AppIcon").map((node) => node.props.name);

const isListPoster = (uri) => /\/p\d+\.jpg$/.test(uri);
const isFavoriteImage = (uri) => /\/(movies|shows|people)\d+\.jpg$/.test(uri);

const LAYOUTS = ["showcase", "identity", "wall", "minimal", "picks"];

describe("favoriler verilmediğinde kart eskisi gibi", () => {
  for (const layout of ["showcase", "identity", "wall", "minimal"]) {
    test(`${layout}: yalnız liste posterleri, favori başlığı yok`, () => {
      const tree = render(makeCardProps({ options: { layout }, favorites: null }));
      const uris = imageUris(tree);
      expect(uris.length).toBeGreaterThan(0);
      expect(uris.every(isListPoster)).toBe(true);
      expect(textOf(tree.toJSON())).not.toContain("DÖRT FAVORİM");
      unmount(tree);
    });
  }

  test("boş favori nesnesi de 'yok' sayılır", () => {
    const tree = render(makeCardProps({ options: { layout: "showcase" }, favorites: { count: 0, groups: [] } }));
    expect(imageUris(tree).every(isListPoster)).toBe(true);
    unmount(tree);
  });

  test("Seçki seçili ama favori yok → Vitrin çizilir, çökmez", () => {
    const tree = render(makeCardProps({ options: { layout: "picks" }, favorites: null }));
    const texts = textOf(tree.toJSON());
    expect(texts).toContain("FAVORİLERİM"); // Vitrin'in poster başlığı
    expect(texts).not.toContain("DÖRT FAVORİM");
    expect(imageUris(tree).every(isListPoster)).toBe(true);
    unmount(tree);
  });
});

describe("dört favori açıkken poster alanının yerini alır", () => {
  const favorites = makeCardFavorites();

  for (const layout of ["showcase", "identity", "minimal"]) {
    test(`${layout}: şerit — kategori etiketleri var, liste posteri yok`, () => {
      const tree = render(makeCardProps({ options: { layout }, favorites }));
      const texts = textOf(tree.toJSON());
      expect(texts).toEqual(expect.arrayContaining(["FİLMLER", "DİZİLER", "OYUNCULAR"]));
      const uris = imageUris(tree);
      expect(uris.some(isListPoster)).toBe(false);
      expect(uris.filter(isFavoriteImage)).toHaveLength(12);
      unmount(tree);
    });
  }

  test("Vitrin: bölüm başlığı 'DÖRT FAVORİM', eski 'FAVORİLERİM' başlığı yok", () => {
    const tree = render(makeCardProps({ options: { layout: "showcase" }, favorites }));
    const texts = textOf(tree.toJSON());
    expect(texts).toContain("DÖRT FAVORİM");
    expect(texts).not.toContain("FAVORİLERİM");
    unmount(tree);
  });

  test("Duvar: kolaj hücreleri favori afişleriyle dolar (liste posteri yok)", () => {
    const tree = render(makeCardProps({ options: { layout: "wall" }, favorites }));
    const uris = imageUris(tree);
    expect(uris.length).toBe(12); // 4x3 hücre
    expect(uris.every(isFavoriteImage)).toBe(true);
    unmount(tree);
  });

  test("Duvar: az favori döngüyle hücreleri doldurur", () => {
    const tree = render(makeCardProps({ options: { layout: "wall" }, favorites: makeCardFavorites({ movies: 2 }) }));
    const uris = imageUris(tree);
    expect(uris).toHaveLength(12);
    expect(new Set(uris).size).toBe(2);
    unmount(tree);
  });

  test("Duvar: yalnız görselsiz favori → kolaj çizilmez, kart yine çökmez", () => {
    const tree = render(
      makeCardProps({
        options: { layout: "wall" },
        favorites: makeCardFavorites({ movies: 3 }, { noImage: ["movies"] }),
      }),
    );
    expect(imageUris(tree)).toHaveLength(0);
    unmount(tree);
  });

  test("anahtar kapalıyken liste posterleri geri gelir; Seçki Vitrin'e düşer", () => {
    for (const layout of LAYOUTS) {
      const tree = render(makeCardProps({ options: { layout, showFavorites: false }, favorites }));
      const uris = imageUris(tree);
      expect({ layout, favoriteImages: uris.filter(isFavoriteImage).length }).toEqual({ layout, favoriteImages: 0 });
      expect(uris.every(isListPoster)).toBe(true);
      expect(textOf(tree.toJSON())).not.toContain("DÖRT FAVORİM");
      unmount(tree);
    }
  });

  test("Poster anahtarı kapalıyken de favoriler görünür (ayrı anahtar)", () => {
    const tree = render(makeCardProps({ options: { layout: "showcase", showPosters: false }, favorites }));
    expect(imageUris(tree).filter(isFavoriteImage)).toHaveLength(12);
    unmount(tree);
  });

  test("kategori süzgeci: yalnız verilen gruplar çizilir", () => {
    const tree = render(
      makeCardProps({ options: { layout: "showcase" }, favorites: makeCardFavorites({ shows: 3 }) }),
    );
    const texts = textOf(tree.toJSON());
    expect(texts).toContain("DİZİLER");
    expect(texts).not.toContain("FİLMLER");
    expect(texts).not.toContain("OYUNCULAR");
    expect(imageUris(tree)).toHaveLength(3);
    unmount(tree);
  });

  test("görseli olmayan favori tür simgeli yer tutucu çizer, Image yok", () => {
    const tree = render(
      makeCardProps({
        options: { layout: "showcase" },
        favorites: makeCardFavorites({ people: 2 }, { noImage: ["people"] }),
      }),
    );
    expect(imageUris(tree)).toHaveLength(0);
    expect(iconNames(tree).filter((name) => name === "person-outline").length).toBeGreaterThanOrEqual(3);
    unmount(tree);
  });
});

describe("Seçki düzeni", () => {
  const favorites = makeCardFavorites();

  test("başlık, kategori etiketleri ve favori adları çizilir", () => {
    const tree = render(makeCardProps({ options: { layout: "picks" }, favorites }));
    const texts = textOf(tree.toJSON());
    expect(texts).toContain("DÖRT FAVORİM");
    expect(texts).toEqual(expect.arrayContaining(["FİLMLER", "DİZİLER", "OYUNCULAR"]));
    // Yer varken ad satırı açık: her favorinin adı kartta.
    expect(texts).toEqual(expect.arrayContaining(["movies 1", "shows 4", "people 2"]));
    expect(imageUris(tree).filter(isFavoriteImage)).toHaveLength(12);
    unmount(tree);
  });

  test("diğer modüller de çizilir: kimlik, istatistik, Perde, tür, seri, rozet, altbilgi", () => {
    const tree = render(
      makeCardProps({ options: { layout: "picks", note: "Kısa bir not" }, favorites }),
    );
    const texts = textOf(tree.toJSON());
    expect(texts).toEqual(
      expect.arrayContaining(["Ayşe Yılmaz", "FİLM", "DİZİ", "BÖLÜM", "SAAT", "PERDE 9", "Dram", "SERİ", "İzlediklerini sen de kaydet"]),
    );
    const flat = texts.join("");
    expect(flat).toContain("@ayse");
    expect(flat).toContain("Kısa bir not");
    expect(flat).toContain("24/81");
    unmount(tree);
  });

  test("liste posteri çizilmez (poster alanını favoriler doldurur)", () => {
    const tree = render(makeCardProps({ options: { layout: "picks" }, favorites }));
    expect(imageUris(tree).some(isListPoster)).toBe(false);
    unmount(tree);
  });

  test("anahtarlar bölümleri gizler (istatistik / Perde / tür / seri / rozet)", () => {
    const tree = render(
      makeCardProps({
        options: { layout: "picks", showStats: false, showPerde: false, showGenres: false, showStreak: false, showBadges: false },
        favorites,
      }),
    );
    const texts = textOf(tree.toJSON());
    expect(texts).toContain("DÖRT FAVORİM");
    for (const gone of ["FİLM", "PERDE 9", "Dram", "SERİ", "REKOR"]) expect(texts).not.toContain(gone);
    unmount(tree);
  });

  test("tek kategori: etiket rafın üstünde, kart yine çizilir", () => {
    const tree = render(
      makeCardProps({ options: { layout: "picks" }, favorites: makeCardFavorites({ people: 3 }) }),
    );
    const texts = textOf(tree.toJSON());
    expect(texts).toContain("OYUNCULAR");
    expect(texts).not.toContain("FİLMLER");
    expect(imageUris(tree)).toHaveLength(3);
    unmount(tree);
  });

  test("en kalabalık kart (hepsi açık + not) çökmeden çizilir; adlar bütçeye göre düşebilir", () => {
    const tree = render(
      makeCardProps({
        options: { layout: "picks", note: "İki satıra yayılacak kadar uzun bir not yazıyorum bu kartın en kalabalık hâlini denemek için" },
        favorites,
      }),
    );
    const texts = textOf(tree.toJSON());
    expect(texts).toContain("DÖRT FAVORİM");
    expect(imageUris(tree).filter(isFavoriteImage)).toHaveLength(12);
    unmount(tree);
  });

  test("bütçe darken ad satırı kalkar, posterler yine çizilir", () => {
    const tree = render(
      makeCardProps({
        options: { layout: "picks", note: "İki satıra yayılacak kadar uzun bir not yazıyorum bu kartın en kalabalık hâlini denemek için" },
        favorites,
      }),
    );
    // Hepsi açık + not + 3 kategori → planlayıcı adları kapatır (bkz. utils testi).
    expect(textOf(tree.toJSON())).not.toContain("movies 1");
    unmount(tree);
  });

  test("EN dilinde de çizilir", () => {
    const tree = render(
      makeCardProps({
        language: "en",
        options: { layout: "picks" },
        favorites: makeCardFavorites({ movies: 4 }),
        str: { ...makeCardProps().str, favTitle: "MY FOUR FAVORITES" },
      }),
    );
    expect(textOf(tree.toJSON())).toContain("MY FOUR FAVORITES");
    unmount(tree);
  });
});

describe("tüm düzenler × tüm temalar çökmeden çizilir (favorili)", () => {
  test("5 düzen × 7 tema × 2 zemin", () => {
    const favorites = makeCardFavorites();
    for (const layout of LAYOUTS) {
      for (const themeId of ["signature", "sunset", "ocean", "forest", "gold", "noir", "rank"]) {
        for (const background of ["glow", "clean"]) {
          const tree = render(makeCardProps({ options: { layout, themeId, background }, favorites }));
          expect(tree.toJSON()).toBeTruthy();
          unmount(tree);
        }
      }
    }
  });
});
