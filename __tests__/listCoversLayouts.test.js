import React from "react";
import { act, create } from "react-test-renderer";
import ListCovers, {
  getNaturalCoverWidth,
  getSizingStyle,
  LAYOUT_COUNT_VARIANTS,
  LIST_LAYOUT,
} from "../components/lists/ListCovers";
import { get, set, Keys } from "../services/storage";

// Liste kapak düzenleri: 3/5 seçimi ve yeni düzenler kart genişliğini
// DEĞİŞTİRMEZ (kullanıcı kuralı: düzenler arası yatay boyut aynı), 5'li büyük
// kapakta afişler aynı yükseklikte daralır (kırpılır, uzamaz). Görsel ince
// ayar cihazda bakılır.

// Afiş köşesi (Ayarlar > Poster görünümü) burada sınanmıyor: taban köşe aynen döner.
jest.mock("../hooks/usePosterCorner", () => () => (base) => base);
jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  FlatList: "FlatList",
  Animated: { Value: function Value() {}, View: "AnimatedView" },
  StyleSheet: { create: (s) => s, absoluteFill: { position: "absolute" }, hairlineWidth: 1 },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  Platform: { OS: "ios" },
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("../hooks/usePosterUri", () => ({
  __esModule: true,
  default: () => (_type, _id, path) => (path ? `https://img.test${path}` : null),
}));
const theme = { primary: "#111", secondary: "#222", border: "#333" };
const items = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, type: "movie", imagePath: `/p${i}.jpg` }));

const render = (gridStyle, width = 184, height = 112) => {
  let tree;
  act(() => {
    tree = create(
      <ListCovers items={items} gridStyle={gridStyle} width={width} height={height} theme={theme} />,
    );
  });
  return tree;
};
const flat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe("ListCovers düzenleri", () => {
  it("5–8 boyut hesabında eşinin ölçüsünü alır", () => {
    expect(getSizingStyle(LIST_LAYOUT.BIG_5)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.FILMSTRIP)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.SHOWCASE)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.POLAROID)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.DIAGONAL)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.WALL)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.STACK_3)).toBe(LIST_LAYOUT.STACK);
    expect(getNaturalCoverWidth(LIST_LAYOUT.STACK_3, 112)).toBe(getNaturalCoverWidth(LIST_LAYOUT.STACK, 112));
    expect(getNaturalCoverWidth(LIST_LAYOUT.BIG_5, 112)).toBeNull();
  });

  it("5'li büyük kapak: 5 afiş, aynı yükseklik, blok genişliği 3'lüyle aynı", () => {
    const imgs3 = render(LIST_LAYOUT.BIG).root.findAllByType("Image");
    const imgs5 = render(LIST_LAYOUT.BIG_5).root.findAllByType("Image");
    expect(imgs3).toHaveLength(3);
    expect(imgs5).toHaveLength(5);
    const w5 = flat(imgs5[0].props.style).width;
    expect(flat(imgs5[0].props.style).height).toBe(112);
    // 5 afiş + 4 boşluk = 3 afiş + 2 boşluk = verilen genişlik
    expect(w5 * 5 + 2 * 4).toBeCloseTo(flat(imgs3[0].props.style).width * 3 + 2 * 2);
    // Kırpma expo-image'ın varsayılan `cover`ına kalır — contentFit verilmez.
    imgs5.forEach((img) => expect(img.props.contentFit).toBeUndefined());
  });

  it("3'lü yığın: 3 afiş, arka çift 5'lideki en dış konumda", () => {
    const tx = (tree) =>
      tree.root
        .findAllByType("View")
        .map((v) => flat(v.props.style))
        .filter((s) => s.position === "absolute" && s.transform)
        .map((s) => s.transform.find((t) => "translateX" in t).translateX);
    const three = tx(render(LIST_LAYOUT.STACK_3, 175));
    const five = tx(render(LIST_LAYOUT.STACK, 175));
    expect(three).toHaveLength(3);
    expect(five).toHaveLength(5);
    expect(Math.max(...three)).toBe(Math.max(...five));
  });

  it("Film Şeridi 3 kare, Vitrin 5 afiş çizer ve bloğa sığar", () => {
    expect(render(LIST_LAYOUT.FILMSTRIP).root.findAllByType("Image")).toHaveLength(3);
    const showcase = render(LIST_LAYOUT.SHOWCASE).root
      .findAllByType("View")
      .map((v) => flat(v.props.style))
      .filter((s) => s.position === "absolute" && s.left != null);
    expect(showcase).toHaveLength(5);
    showcase.forEach((s) => expect(s.left + s.width).toBeLessThanOrEqual(184 + 0.001));
  });

  it("Polaroid 3 dönük çerçeve, ortadaki ilk afiş en üstte", () => {
    const frames = render(LIST_LAYOUT.POLAROID).root
      .findAllByType("View")
      .map((v) => flat(v.props.style))
      .filter((s) => s.position === "absolute" && s.transform);
    expect(frames).toHaveLength(3);
    const top = frames.reduce((a, b) => (b.zIndex > a.zIndex ? b : a));
    expect(top.left).toBeGreaterThan(frames[0].left);
    expect(top.left).toBeLessThan(frames[2].left);
    const imgs = render(LIST_LAYOUT.POLAROID).root.findAllByType("Image");
    expect(imgs.map((i) => i.props.source.uri)).toEqual(["https://img.test/p1.jpg", "https://img.test/p0.jpg", "https://img.test/p2.jpg"]);
  });

  it("Diyagonal 5 eğik dilim, iki dış dilim bloğun kenarını aşar (kenar boşluğu kalmaz)", () => {
    const slices = render(LIST_LAYOUT.DIAGONAL).root
      .findAllByType("View")
      .map((v) => flat(v.props.style))
      .filter((s) => s.position === "absolute" && s.top === 0 && s.transform);
    expect(slices).toHaveLength(5);
    const extra = 112 * Math.tan((12 * Math.PI) / 180);
    // Eğim kenarı ±extra/2 kaydırır: sol kenar ≤ 0, sağ kenar ≥ genişlik kalmalı.
    expect(slices[0].left + extra / 2).toBeLessThanOrEqual(0.001);
    expect(slices[4].left + slices[4].width - extra / 2).toBeGreaterThanOrEqual(184 - 0.001);
  });

  it("Afiş Duvarı: yatık duvar bloğu örter; kısa listede kalan kutular aynı boyda boş kalır", () => {
    const short = [{ id: 1, type: "movie", imagePath: "/a.jpg" }, { id: 2, type: "movie", imagePath: "/b.jpg" }];
    let tree;
    act(() => {
      tree = create(<ListCovers items={short} gridStyle={LIST_LAYOUT.WALL} width={184} height={112} theme={theme} />);
    });
    // Tekrar YOK: yalnız iki afiş çizilir.
    const imgs = tree.root.findAllByType("Image");
    expect(imgs.map((i) => i.props.source.uri).sort()).toEqual(["https://img.test/a.jpg", "https://img.test/b.jpg"]);
    const views = tree.root.findAllByType("View").map((v) => flat(v.props.style));
    const imgSize = flat(imgs[0].props.style);
    const placeholders = views.filter(
      (s) => s.backgroundColor === theme.primary && s.width === imgSize.width && s.height === imgSize.height,
    );
    expect(placeholders.length).toBeGreaterThan(8);
    // 4 sütun
    const wall = views.find((s) => s.position === "absolute" && s.transform);
    const rad = (14 * Math.PI) / 180;
    expect(wall.width).toBeGreaterThanOrEqual(184 * Math.cos(rad) + 112 * Math.sin(rad));
    expect(wall.height).toBeGreaterThanOrEqual(184 * Math.sin(rad) + 112 * Math.cos(rad));
    const wallNode = tree.root.findAllByType("View").find((v) => flat(v.props.style) === wall || flat(v.props.style).transform === wall.transform);
    expect(wallNode.children.length).toBe(4);
  });

  it("paketli yerel afiş (seçici örnekleri) TMDB adresi beklemeden çizilir", () => {
    const local = [{ id: 1, type: "movie", localSource: 42, listOrder: 0 }];
    let tree;
    act(() => {
      tree = create(<ListCovers items={local} gridStyle={LIST_LAYOUT.BIG} width={184} height={112} theme={theme} />);
    });
    const imgs = tree.root.findAllByType("Image");
    expect(imgs).toHaveLength(1);
    expect(imgs[0].props.source).toBe(42);
  });

  it("aileler 3/5 kimliklerini taşır ve ayar 1–11'i kabul eder", () => {
    expect(LAYOUT_COUNT_VARIANTS.big).toEqual({ 3: 1, 5: 5 });
    expect(LAYOUT_COUNT_VARIANTS.stack).toEqual({ 3: 6, 5: 4 });
    for (const v of Object.values(LIST_LAYOUT)) {
      expect(set(Keys.listGridStyle, v)).toBe(true);
      expect(get(Keys.listGridStyle)).toBe(v);
    }
    expect(set(Keys.listGridStyle, 12)).toBe(false);
  });
});
