// __tests__/detailHeroStage.test.js
//
// Film ve dizi detay sayfalarındaki arka plan posteri yuvası (DetailHeroStage):
//   • Ortada 16:9 net poster,
//   • Üstte (bildirim/durum çubuğu alanı) posterin dikey yansımalı bulanık devamı,
//   • Altta (bilgi başlığının hemen üstü/arkası) posterin dikey yansımalı bulanık devamı,
//   • Bilgi başlığı (infoHeader) yalnız alt ambiyans şeridini örter; ortadaki posteri kapatmaz.

const fs = require("fs");
const path = require("path");
const React = require("react");

jest.mock("react-native", () => ({
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  Platform: { OS: "ios", Version: 18 },
  StyleSheet: {
    create: (s) => s,
    absoluteFillObject: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
  },
  View: "View",
  Image: "Image",
  TouchableOpacity: "TouchableOpacity",
}));

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

const DetailHeroStageModule = require("../components/detail/DetailHeroStage");
const DetailHeroStage = DetailHeroStageModule.default;
const { computeDetailHeroMetrics } = DetailHeroStageModule;

function collectNodes(node, predicate, out = []) {
  if (!node || typeof node !== "object") return out;
  if (predicate(node)) out.push(node);
  const children = node.props?.children;
  if (Array.isArray(children)) {
    children.forEach((c) => collectNodes(c, predicate, out));
  } else if (children) {
    collectNodes(children, predicate, out);
  }
  return out;
}

function renderTree(element) {
  if (!element || typeof element !== "object") return element;
  const type = element.type;
  if (typeof type === "function") {
    return renderTree(type(element.props));
  }
  if (type && typeof type === "object" && typeof type.type === "function") {
    return renderTree(type.type(element.props));
  }
  const children = element.props?.children;
  if (!children) return element;
  return {
    ...element,
    props: {
      ...element.props,
      children: Array.isArray(children)
        ? children.map(renderTree)
        : renderTree(children),
    },
  };
}

const DARK_THEME = {
  primary: "#0E1015",
  secondary: "#171A22",
  border: "#2A2F3D",
  text: { primary: "#FFFFFF", muted: "#8B93A7" },
};

describe("computeDetailHeroMetrics", () => {
  test("üst ve alt bulanık şeritleri kompakt tutar ve bilgi başlığını hafifçe içeriğe bindirir", () => {
    const m = computeDetailHeroMetrics({ width: 390, topInset: 48 });

    expect(m.backdropHeight).toBe(Math.round(390 * (9 / 16)));
    // Üst ambiyans şeridi kompakt tutulur
    expect(m.topAmbientHeight).toBeGreaterThanOrEqual(20);
    expect(m.topAmbientHeight).toBeLessThanOrEqual(48);
    // Alt ambiyans şeridi kısadır; bilgi başlığı alt ambiyansın üstünden
    // posterin alt kısmına hafifçe biner (infoHeaderOverlap > bottomAmbientHeight).
    expect(m.bottomAmbientHeight).toBeGreaterThan(0);
    expect(m.infoHeaderOverlap).toBeGreaterThan(m.bottomAmbientHeight);
    expect(m.stageHeight).toBe(
      m.topAmbientHeight + m.backdropHeight + m.bottomAmbientHeight,
    );
  });

  test("topInset 0 veya geçersiz olduğunda bile güvenli bir üst ambiyans payı bırakır", () => {
    const m0 = computeDetailHeroMetrics({ width: 360, topInset: 0 });
    expect(m0.topAmbientHeight).toBeGreaterThanOrEqual(20);

    const mInvalid = computeDetailHeroMetrics({ width: -10, topInset: NaN });
    expect(mInvalid.backdropHeight).toBeGreaterThan(0);
    expect(mInvalid.stageHeight).toBe(
      mInvalid.topAmbientHeight +
        mInvalid.backdropHeight +
        mInvalid.bottomAmbientHeight,
    );
  });
});

describe("DetailHeroStage çizimi", () => {
  test("görsel varken ortada net poster, üstte ve altta bulanık ambiyans devamı çizer", () => {
    const onPress = jest.fn();
    const tree = renderTree(
      React.createElement(DetailHeroStage, {
        uri: "https://image.tmdb.org/t/p/w780/sample.jpg",
        theme: DARK_THEME,
        topInset: 48,
        width: 390,
        onPress,
      }),
    );

    const byTestId = (id) =>
      collectNodes(tree, (n) => n.props?.testID === id)[0];

    const stage = byTestId("detail-hero-stage");
    const ambientBase = byTestId("detail-hero-ambient-base");
    const ambientTop = byTestId("detail-hero-ambient-top");
    const ambientBottom = byTestId("detail-hero-ambient-bottom");
    const centerSlot = byTestId("detail-hero-center-slot");
    const backdropImage = byTestId("detail-hero-backdrop-image");
    const touch = byTestId("detail-hero-backdrop-touch");

    expect(stage).toBeTruthy();
    expect(ambientBase).toBeTruthy();
    expect(ambientTop).toBeTruthy();
    expect(ambientBottom).toBeTruthy();
    expect(centerSlot).toBeTruthy();
    expect(backdropImage).toBeTruthy();

    // Ortadaki ana poster bulanıklaştırılmaz; üst/alt ambiyans katmanları bulanıktır.
    expect(backdropImage.props.blurRadius).toBeUndefined();
    expect(ambientBase.props.blurRadius).toBeGreaterThan(0);

    const topMirrorImg = collectNodes(
      ambientTop,
      (n) => n.type === "Image",
    )[0];
    const bottomMirrorImg = collectNodes(
      ambientBottom,
      (n) => n.type === "Image",
    )[0];
    expect(topMirrorImg.props.blurRadius).toBeGreaterThan(0);
    expect(bottomMirrorImg.props.blurRadius).toBeGreaterThan(0);

    touch.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("görsel yokken yer tutucu ikonu orta yuvada gösterir", () => {
    const tree = renderTree(
      React.createElement(DetailHeroStage, {
        uri: null,
        theme: DARK_THEME,
        topInset: 44,
        width: 390,
        placeholderIcon: "tv-outline",
      }),
    );

    const placeholder = collectNodes(
      tree,
      (n) => n.props?.testID === "detail-hero-placeholder",
    )[0];
    expect(placeholder).toBeTruthy();
  });

  test("MovieDetail, TvShowsDetails, SeasonDetails ve EpisodeDetails ortak DetailHeroStage yuvasını kullanır", () => {
    for (const rel of [
      ["screens", "movie", "MovieDetail.js"],
      ["screens", "tv", "TvShowsDetails.js"],
      ["screens", "tv", "SeasonDetails.js"],
      ["screens", "tv", "EpisodeDetails.js"],
    ]) {
      const src = fs.readFileSync(path.join(__dirname, "..", ...rel), "utf8");
      expect(src).toMatch(/<DetailHeroStage\b/);
    }
  });

  test("özel imageHeight ve çocuk rozetlerle (sezon/bölüm) doğru çalışır", () => {
    const m = computeDetailHeroMetrics({
      width: 390,
      topInset: 44,
      imageHeight: 480,
    });
    expect(m.backdropHeight).toBe(480);
    expect(m.contentOverlap).toBeGreaterThan(0);

    const tree = renderTree(
      React.createElement(
        DetailHeroStage,
        {
          uri: "https://image.tmdb.org/t/p/w500/season.jpg",
          theme: DARK_THEME,
          topInset: 44,
          width: 390,
          imageHeight: 480,
        },
        React.createElement("View", { testID: "season-badge" }),
      ),
    );
    const badge = collectNodes(
      tree,
      (n) => n.props?.testID === "season-badge",
    )[0];
    expect(badge).toBeTruthy();
  });
});
