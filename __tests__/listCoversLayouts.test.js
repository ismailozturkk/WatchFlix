import React from "react";
import { act, create } from "react-test-renderer";
import ListCovers, {
  getNaturalCoverWidth,
  getSizingStyle,
  LAYOUT_COUNT_VARIANTS,
  LIST_LAYOUT,
  createScatterLayout,
  coverZ,
  scatterColumns,
  dvdShelfLayout,
  SCATTER_COLUMNS,
  SCATTER_COLUMN_SPILL,
  SCATTER_MAX_OVERLAP,
  SCATTER_TARGET_OVERLAP,
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
  Animated: {
    Value: class Value { stopAnimation() {} },
    View: "AnimatedView",
    timing: () => ({ start: (done) => done?.({ finished: true }) }),
  },
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

const render = (gridStyle, width = 184, height = 112, direction = "right") => {
  let tree;
  act(() => {
    tree = create(
      <ListCovers items={items} gridStyle={gridStyle} width={width} height={height} theme={theme} direction={direction} />,
    );
  });
  return tree;
};
const flat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe("ListCovers düzenleri", () => {
  it("yeni düzenler büyük kapağın kart ölçüsünü alır", () => {
    expect(getSizingStyle(LIST_LAYOUT.BIG_5)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.FILMSTRIP)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.SHOWCASE)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.POLAROID)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.DIAGONAL)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.WALL)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.FOCUS)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.SCATTER)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.FLOW)).toBe(LIST_LAYOUT.BIG);
    expect(getSizingStyle(LIST_LAYOUT.STACK_3)).toBe(LIST_LAYOUT.STACK);
    expect(getNaturalCoverWidth(LIST_LAYOUT.STACK_3, 112)).toBe(getNaturalCoverWidth(LIST_LAYOUT.STACK, 112));
    expect(getNaturalCoverWidth(LIST_LAYOUT.BIG_5, 112)).toBeNull();
    expect(getNaturalCoverWidth(LIST_LAYOUT.FOCUS, 112)).toBeNull();
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
    // Arkaya doğru KÜÇÜLMEZ: beş afiş de aynı boyda, bloğun tam yüksekliğinde.
    expect(new Set(showcase.map((s) => s.height))).toEqual(new Set([112]));
    expect(new Set(showcase.map((s) => s.width)).size).toBe(1);
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

  it("Odak ve Dağınık afişleri kart alanında çizer", () => {
    const focus = render(LIST_LAYOUT.FOCUS).root.findAllByType("Image");
    expect(focus).toHaveLength(3);
    expect(focus.map((i) => i.props.source.uri)).toEqual([
      "https://img.test/p1.jpg", "https://img.test/p0.jpg", "https://img.test/p2.jpg",
    ]);
    expect(flat(focus[1].props.style).height).toBe(112);
    expect(flat(focus[0].props.style).height).toBeLessThan(112);

    const scatter = render(LIST_LAYOUT.SCATTER).root;
    expect(scatter.findAllByType("Image")).toHaveLength(5);
    const frames = scatter.findAllByType("View")
      .map((v) => flat(v.props.style))
      .filter((s) => s.position === "absolute" && s.zIndex != null);
    expect(frames).toHaveLength(5);
    frames.forEach((s) => {
      expect(s.left).toBeGreaterThanOrEqual(0);
      expect(s.left + s.width).toBeLessThanOrEqual(184);
      expect(s.top).toBeGreaterThanOrEqual(0);
      expect(s.top + s.height).toBeLessThanOrEqual(112);
    });
    const again = render(LIST_LAYOUT.SCATTER).root.findAllByType("View")
      .map((v) => flat(v.props.style))
      .filter((s) => s.position === "absolute" && s.zIndex != null);
    expect(again.map((s) => [s.left, s.top, s.transform])).toEqual(
      frames.map((s) => [s.left, s.top, s.transform]),
    );
    expect(createScatterLayout(184, 112, () => 0).map((s) => s.column).sort()).toEqual([0, 1, 2, 3, 4]);
    expect(createScatterLayout(184, 112, () => 0).map((s) => s.column))
      .not.toEqual(createScatterLayout(184, 112, () => 0.99).map((s) => s.column));
  });

  it("Dağınık: 5 sütun, kartı dolduran afişler, en çok %50 üst üste (tipik ~%20)", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const overlap = (a, b) =>
      Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
      Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
    const tops = new Set();
    const ratios = [];
    for (const [w, h] of [[184, 112], [150, 100], [240, 112]]) {
      const { centerStart, colW, spill } = scatterColumns(w, h);
      for (let n = 0; n < 400; n++) {
        const rects = createScatterLayout(w, h, rnd);
        expect(rects).toHaveLength(5);
        expect(rects.map((r) => r.column).sort()).toEqual([0, 1, 2, 3, 4]);
        expect(rects.map((r) => r.z).sort()).toEqual([1, 2, 3, 4, 5]);
        rects.forEach((r) => {
          // Kartı boş bırakmaz: afiş blok yüksekliğinin büyük kısmını kaplar.
          expect(r.height).toBeGreaterThanOrEqual((h - 14) * 0.5);
          const center = r.left + r.width / 2;
          // Ortası kendi sütununda (± %10); kart kenarında yalnız içeri itilebilir.
          const start = centerStart + r.column * colW;
          expect(spill).toBeCloseTo(colW * SCATTER_COLUMN_SPILL, 9);
          if (r.left > 7.001) expect(center).toBeGreaterThanOrEqual(start - spill - 0.001);
          if (r.left + r.width < w - 7.001) expect(center).toBeLessThanOrEqual(start + colW + spill + 0.001);
          expect(r.left).toBeGreaterThanOrEqual(0);
          expect(r.left + r.width).toBeLessThanOrEqual(w);
          expect(r.top).toBeGreaterThanOrEqual(0);
          expect(r.top + r.height).toBeLessThanOrEqual(h);
          expect(Math.abs(r.angle)).toBeLessThanOrEqual(9);
          tops.add(Math.round(r.top));
        });
        for (let i = 0; i < 5; i++) {
          for (let j = i + 1; j < 5; j++) {
            const area = Math.min(rects[i].width * rects[i].height, rects[j].width * rects[j].height);
            const ratio = overlap(rects[i], rects[j]) / area;
            expect(ratio).toBeLessThanOrEqual(SCATTER_MAX_OVERLAP + 1e-9);
            if (ratio > 0) ratios.push(ratio);
          }
        }
      }
    }
    // Tipik binme küçük kalır (ortanca ~%23), tavana nadiren yaklaşılır; dikeyde serbest.
    ratios.sort((a, b) => a - b);
    expect(ratios[Math.floor(ratios.length * 0.5)]).toBeLessThanOrEqual(0.26);
    expect(ratios[Math.floor(ratios.length * 0.9)]).toBeLessThanOrEqual(0.4);
    expect(tops.size).toBeGreaterThan(20);
  });

  it("DVD Kutuları: üç kutu, ilk afiş ortada, sırt solda / açılan kenar sağda, zamanlayıcı yok", () => {
    jest.useFakeTimers();
    const tree = render(LIST_LAYOUT.FLOW);
    const byId = (id) => tree.root.findAll((n) => n.type === "View" && n.props.testID === id);
    const fronts = byId("dvd-front");
    expect(fronts).toHaveLength(3);
    expect(byId("dvd-spine").length).toBeGreaterThanOrEqual(1);
    expect(byId("dvd-edge")).toHaveLength(1);
    const frontUri = (n) => n.findAllByType("Image")[0].props.source.uri;
    // Soldan sağa: ordered[1], ordered[0] (orta, en önde), ordered[2].
    const sorted = [...fronts].sort((x, y) => flat(x.props.style).left - flat(y.props.style).left);
    expect(sorted.map(frontUri)).toEqual(["https://img.test/p1.jpg", "https://img.test/p0.jpg", "https://img.test/p2.jpg"]);
    expect(Math.max(...fronts.map((n) => flat(n.props.style).zIndex))).toBe(flat(sorted[1].props.style).zIndex);
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it("DVD rafı her kart boyunda bloğa sığar; yüzler ortak kenarda döner", () => {
    // Ekrandaki izdüşüm (RN rotateY + perspective, başlangıç noktası ortak kenar).
    const projX = (x, deg, P) => {
      const a = (deg * Math.PI) / 180;
      return (x * Math.cos(a)) / (1 + (x * Math.sin(a)) / P);
    };
    for (const [w, h] of [[184, 112], [150, 100], [240, 112], [120, 90]]) {
      const shelf = dvdShelfLayout(w, h);
      expect(shelf).toHaveLength(3);
      shelf.forEach(({ front, side, edgeX, W, D, P, H, top, spanLeft, span }) => {
        expect(top).toBeGreaterThanOrEqual(0);
        expect(top + H).toBeLessThanOrEqual(h);
        // Ön ve yan yüz aynı kenarda, karşılıklı başlangıç noktalarıyla döner.
        if (side.kind === "spine") {
          expect(front.origin).toBe("left");
          expect(front.left).toBeCloseTo(edgeX, 6);
          expect(side.origin).toBe("right");
          expect(side.left + side.width).toBeCloseTo(edgeX, 6);
          expect(edgeX + projX(-D, side.rotate, P)).toBeCloseTo(spanLeft, 6);
          expect(edgeX + projX(W, front.rotate, P)).toBeCloseTo(spanLeft + span, 6);
        } else {
          expect(front.origin).toBe("right");
          expect(front.left + front.width).toBeCloseTo(edgeX, 6);
          expect(side.origin).toBe("left");
          expect(side.left).toBeCloseTo(edgeX, 6);
          expect(edgeX + projX(-W, front.rotate, P)).toBeCloseTo(spanLeft, 6);
          expect(edgeX + projX(D, side.rotate, P)).toBeCloseTo(spanLeft + span, 6);
        }
        // Yan yüz ön yüze dik: açılar 90° farklı.
        expect(Math.abs(front.rotate - side.rotate)).toBeCloseTo(90, 6);
        expect(spanLeft).toBeGreaterThanOrEqual(0);
        expect(spanLeft + span).toBeLessThanOrEqual(w + 0.001);
      });
      // Kutular üst üste binmez.
      const spans = shelf.map((c) => [c.spanLeft, c.spanLeft + c.span]).sort((x, y) => x[0] - y[0]);
      expect(spans[0][1]).toBeLessThanOrEqual(spans[1][0] + 0.001);
      expect(spans[1][1]).toBeLessThanOrEqual(spans[2][0] + 0.001);
    }
  });

  it("Vitrin, Diyagonal ve Afiş Duvarı solda ve sağda ters yönlenir", () => {
    const showcaseX = (direction) => render(LIST_LAYOUT.SHOWCASE, 184, 112, direction).root
      .findAllByType("View").map((v) => flat(v.props.style))
      .filter((s) => s.position === "absolute" && s.zIndex != null)
      .reduce((a, b) => (b.zIndex > a.zIndex ? b : a)).left;
    expect(showcaseX("right")).toBe(0);
    expect(showcaseX("left")).toBeGreaterThan(0);

    const diagonal = (direction) => render(LIST_LAYOUT.DIAGONAL, 184, 112, direction).root;
    expect(diagonal("right").findAllByType("Image")[0].props.source.uri).toBe("https://img.test/p0.jpg");
    expect(diagonal("left").findAllByType("Image")[0].props.source.uri).toBe("https://img.test/p4.jpg");
    const firstSliceSkew = (direction) => diagonal(direction).findAllByType("View")
      .map((v) => flat(v.props.style))
      .find((s) => s.position === "absolute" && s.transform?.some((t) => t.skewX)).transform[0].skewX;
    expect(firstSliceSkew("right")).toBe("-12deg");
    expect(firstSliceSkew("left")).toBe("12deg");

    const wallRotate = (direction) => render(LIST_LAYOUT.WALL, 184, 112, direction).root
      .findAllByType("View").map((v) => flat(v.props.style))
      .find((s) => s.transform?.some((t) => t.rotate)).transform[0].rotate;
    expect(wallRotate("right")).toBe("-14deg");
    expect(wallRotate("left")).toBe("14deg");
  });

  it("üst üste binen düzenlerde afişli yuva her zaman boş yuvaların üstünde", () => {
    // 2 içerik (biri afişsiz) + kalan boş yuvalar: boş kutu afişin üstüne çıkmamalı.
    const few = [
      { id: 1, type: "movie", imagePath: "/a.jpg", listOrder: 0 },
      { id: 2, type: "movie", listOrder: 1 },
      { id: 3, type: "movie", imagePath: "/c.jpg", listOrder: 2 },
    ];
    const layouts = [LIST_LAYOUT.SCATTER, LIST_LAYOUT.POLAROID, LIST_LAYOUT.SHOWCASE, LIST_LAYOUT.STACK, LIST_LAYOUT.STACK_3];
    for (const gridStyle of layouts) {
      for (const list of [few.slice(0, 2), few]) {
        let tree;
        act(() => {
          tree = create(<ListCovers items={list} gridStyle={gridStyle} width={184} height={112} theme={theme} />);
        });
        const frames = tree.root
          .findAllByType("View")
          .filter((v) => flat(v.props.style).zIndex != null)
          .map((v) => ({ z: flat(v.props.style).zIndex, poster: v.findAllByType("Image").length > 0 }));
        const posters = frames.filter((f) => f.poster).map((f) => f.z);
        const empties = frames.filter((f) => !f.poster).map((f) => f.z);
        expect(posters.length).toBeGreaterThan(0);
        expect(empties.length).toBeGreaterThan(0);
        expect(Math.min(...posters)).toBeGreaterThan(Math.max(...empties));
      }
    }
    expect(coverZ({ imagePath: "/x.jpg" }, 1)).toBeGreaterThan(coverZ(undefined, 5));
  });

  it("aileler 3/5 kimliklerini taşır ve ayar 1–14'ü kabul eder", () => {
    expect(LAYOUT_COUNT_VARIANTS.big).toEqual({ 3: 1, 5: 5 });
    expect(LAYOUT_COUNT_VARIANTS.stack).toEqual({ 3: 6, 5: 4 });
    for (const v of Object.values(LIST_LAYOUT)) {
      expect(set(Keys.listGridStyle, v)).toBe(true);
      expect(get(Keys.listGridStyle)).toBe(v);
    }
    expect(set(Keys.listGridStyle, 15)).toBe(false);
    expect(set(Keys.listLayoutDirections, { 8: "left", 10: "right", 11: "left" })).toBe(true);
    expect(get(Keys.listLayoutDirections)[8]).toBe("left");
    expect(set(Keys.listLayoutDirections, { 8: "up", 10: "right", 11: "left" })).toBe(false);
  });
});
