// Film / Dizi ana ekranı raf başlığı (components/home/SectionHeader) + çip rayı / segment
// (components/home/SectionChips). Gerçek çizim (renk, gölge, kaydırma) cihazda doğrulanır; burada davranış
// kilitlenir: kimlik tablosundan simge/alt başlık gelmesi, "Tümü" eylemi, erişilebilirlik, çipin ve
// segmentin seçili durumu.
import React from "react";
import { act, create } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockLanguage = "tr";
const mockTheme = {
  primary: "#101010",
  secondary: "#202020",
  border: "#333333",
  accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#cccccc", between: "#aaaaaa", muted: "#888888" },
};

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  FlatList: "FlatList",
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLanguage }) }));
// Gerçek i18n paketi ağır; varsayılan metni döndürmek yeterli (anahtarlar ayrı testlerde doğrulanır).
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));

const SectionHeader = require("../components/home/SectionHeader").default;
const { SectionBadge, SectionIconAction } = require("../components/home/SectionHeader");
const { SectionChipRail, SectionSegmented } = require("../components/home/SectionChips");

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const textOf = (node) =>
  [node.children]
    .flat()
    .map((child) => (typeof child === "string" ? child : textOf(child)))
    .join("");
const texts = (tree) => tree.root.findAllByType("Text").map(textOf);

let warn;
beforeEach(() => {
  mockLanguage = "tr";
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => warn.mockRestore());

describe("SectionHeader — kimlik", () => {
  it("`section` verilince simge ve alt başlık tablodan gelir; başlık çağıranın metnidir", () => {
    const tree = render(<SectionHeader section="onTheAir" mediaType="tv" title="Bu Hafta Yayında" />);
    expect(texts(tree)).toEqual(["Bu Hafta Yayında", "Bu hafta yeni bölümü yayınlananlar"]);
    expect(tree.root.findAllByType("Ionicons").map((n) => n.props.name)).toEqual(["radio"]);
  });

  it("dil değişince alt başlık o dilde; bilinmeyen dil İngilizce", () => {
    mockLanguage = "es";
    expect(texts(render(<SectionHeader section="nowPlaying" mediaType="movie" title="X" />))[1]).toBe(
      "En cines ahora mismo",
    );
    mockLanguage = "fr";
    expect(texts(render(<SectionHeader section="nowPlaying" mediaType="movie" title="X" />))[1]).toBe(
      "In cinemas right now",
    );
  });

  it("açık `subtitle` tablodakini ezer; `title` verilmezse tablodaki (Türler) kullanılır", () => {
    const tree = render(<SectionHeader section="genres" mediaType="movie" subtitle="Aksiyon, Dram" />);
    expect(texts(tree)).toEqual(["Türler", "Aksiyon, Dram"]);
  });

  it("alt başlık bilinmiyorsa bile satır yer tutar (yükleme/yüklenmiş yükseklik sabit)", () => {
    const tree = render(<SectionHeader section="followedPeople" mediaType="movie" title="Başlık" subtitle=" " />);
    expect(texts(tree)).toEqual(["Başlık", " "]);
  });

  it("ödül rafı altın tonlu simge kutusu çizer", () => {
    const tree = render(<SectionHeader section="oscar" mediaType="movie" title="Oscar" />);
    const icon = tree.root.findByType("Ionicons");
    expect(icon.props.name).toBe("trophy");
    expect(icon.props.color).toBe("#F2B705");
  });

  it("`leading` ikon kutusunun yerine geçer (koleksiyon geri düğmesi)", () => {
    const tree = render(
      <SectionHeader
        section="collection"
        mediaType="movie"
        title="Seri"
        subtitle="3 film"
        leading={<Pressable testID="geri" />}
      />,
    );
    expect(tree.root.findAllByType("Ionicons")).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "geri" }).length).toBeGreaterThan(0);
  });
});

describe("SectionHeader — eylem", () => {
  it("`onPressAction` yoksa düğme çizilmez", () => {
    const tree = render(<SectionHeader section="fromFavorites" mediaType="tv" title="Favoriler" />);
    expect(tree.root.findAllByType("Pressable")).toHaveLength(0);
  });

  it("'Tümü' düğmesi basılınca işleyiciyi çağırır; erişilebilirlik etiketi hangi rafın tümü olduğunu söyler", () => {
    const onPress = jest.fn();
    const tree = render(<SectionHeader section="trends" mediaType="movie" title="Trend Filmler" onPressAction={onPress} />);
    const button = tree.root.findByType("Pressable");
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).toBe("Tümünü Gör: Trend Filmler");
    expect(texts(tree)).toContain("Tümü");
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("'Tümü' etiketi dile göre: İngilizce 'See all', İspanyolca 'Ver todo'", () => {
    mockLanguage = "en";
    expect(texts(render(<SectionHeader section="trends" mediaType="movie" title="X" onPressAction={() => {}} />))).toContain("See all");
    mockLanguage = "es";
    expect(texts(render(<SectionHeader section="trends" mediaType="movie" title="X" onPressAction={() => {}} />))).toContain("Ver todo");
  });

  it("`actionLabel` sayıyı taşıyabilir (Devam Edenler: Tümü (12))", () => {
    const tree = render(
      <SectionHeader section="ongoing" mediaType="tv" title="Devam Edenler" actionLabel="Tümü (12)" onPressAction={() => {}} />,
    );
    expect(texts(tree)).toContain("Tümü (12)");
  });

  it("rozet başlığın yanında, sayı olarak görünür", () => {
    const tree = render(
      <SectionHeader
        section="ongoing"
        mediaType="tv"
        title="Devam Edenler"
        badge={<SectionBadge icon="play-skip-forward" text={4} />}
      />,
    );
    expect(texts(tree)).toContain("4");
  });

  it("simge-yalnız eylem erişilebilirlik etiketi taşır ve basılınca çağrılır", () => {
    const onPress = jest.fn();
    const tree = render(<SectionIconAction icon="calendar-outline" onPress={onPress} accessibilityLabel="Takvime ekle" />);
    const button = tree.root.findByType("Pressable");
    expect(button.props.accessibilityLabel).toBe("Takvime ekle");
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uzun başlıkta `titleLines` metne aktarılır; varsayılan tek satır", () => {
    const one = render(<SectionHeader section="trends" mediaType="tv" title="A" />);
    expect(one.root.findAllByType("Text")[0].props.numberOfLines).toBe(1);
    const two = render(<SectionHeader section="followedPeople" mediaType="tv" title="B" titleLines={2} />);
    expect(two.root.findAllByType("Text")[0].props.numberOfLines).toBe(2);
  });
});

describe("SectionChips", () => {
  it("SectionChipRail her öğe için renderChip çağırır ve seçim değişince yeniden çizilsin diye extraData taşır", () => {
    const renderChip = jest.fn((item) => <Pressable key={item} testID={`chip-${item}`} />);
    const tree = render(
      <SectionChipRail data={["day", "week"]} keyExtractor={(i) => i} renderChip={renderChip} extraData="day" />,
    );
    const list = tree.root.findByType("FlatList");
    expect(list.props.horizontal).toBe(true);
    expect(list.props.extraData).toBe("day");
    const rendered = list.props.renderItem({ item: "week", index: 1 });
    expect(rendered.props.testID).toBe("chip-week");
    expect(renderChip).toHaveBeenCalledWith("week", 1);
  });

  it("SectionSegmented: seçili seçenek `selected` durumunda, diğerine basınca onChange(key)", () => {
    const onChange = jest.fn();
    const tree = render(
      <SectionSegmented
        options={[
          { key: "category", label: "Kategori" },
          { key: "year", label: "Yıl" },
        ]}
        value="category"
        onChange={onChange}
      />,
    );
    const [first, second] = tree.root.findAllByType("Pressable");
    expect(first.props.accessibilityState).toEqual({ selected: true });
    expect(second.props.accessibilityState).toEqual({ selected: false });
    act(() => second.props.onPress());
    expect(onChange).toHaveBeenCalledWith("year");
  });
});

// Pressable yalnız testlerde "leading" için kullanılıyor.
function Pressable(props) {
  return React.createElement("Pressable", props);
}
