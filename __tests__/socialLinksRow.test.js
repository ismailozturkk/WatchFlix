// Sosyal hesap şeridi TEK SATIRDA kalır: genişliğe göre boşluk daralır, gerekirse düğmeler küçülür.

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, flatten: (s) => (Array.isArray(s) ? Object.assign({}, ...s.flat(9).filter(Boolean)) : s) },
  View: "View",
  Linking: { openURL: jest.fn() },
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("@expo/vector-icons/FontAwesome6", () => ({ __esModule: true, default: "BrandIcon" }));
jest.mock("../components/common/GlassPressable", () => ({ __esModule: true, default: "Chip" }));

const React = require("react");
const { create, act } = require("react-test-renderer");
const { SOCIAL_PLATFORMS, SOCIAL_CHIP_MAX, SOCIAL_CHIP_MIN, socialChipLayout } = require("../utils/socialLinks");
const SocialLinksRow = require("../components/profile/SocialLinksRow").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

describe("socialChipLayout", () => {
  const total = (width, n) => {
    const { size, gap } = socialChipLayout(width, n);
    return size * n + gap * (n - 1);
  };

  test("geniş ekranda varsayılan 40 pt ve 8 pt boşluk", () => {
    expect(socialChipLayout(500, 8)).toEqual({ size: SOCIAL_CHIP_MAX, gap: 8, icon: 18 });
  });

  test("360 pt ekranda sekiz platform tek satıra sığar (boşluk 8, düğme küçülür)", () => {
    const { size, gap } = socialChipLayout(328, 8);
    expect(gap).toBe(8);
    expect(size).toBe(34);
    expect(total(328, 8)).toBeLessThanOrEqual(328);
  });

  test("320 pt ekranda önce boşluk daralır, düğme rahat boyda kalır", () => {
    const { size, gap } = socialChipLayout(288, 8);
    expect(gap).toBe(4);
    expect(size).toBeGreaterThanOrEqual(30);
    expect(total(288, 8)).toBeLessThanOrEqual(288);
  });

  test.each([8, 5, 3, 1])("%i düğme için çeşitli genişliklerde HİÇBİR ZAMAN taşmaz", (n) => {
    for (let width = 240; width <= 700; width += 7) {
      const { size, gap } = socialChipLayout(width, n);
      expect(size).toBeGreaterThanOrEqual(SOCIAL_CHIP_MIN);
      expect(size).toBeLessThanOrEqual(SOCIAL_CHIP_MAX);
      if (width >= SOCIAL_CHIP_MIN * n + 4 * (n - 1)) expect(size * n + gap * (n - 1)).toBeLessThanOrEqual(width);
    }
  });

  test("ölçülmemiş / geçersiz genişlikte güvenli varsayılan", () => {
    for (const bad of [0, -5, NaN, undefined, null]) {
      const { size } = socialChipLayout(bad, 8);
      expect(size).toBeGreaterThanOrEqual(SOCIAL_CHIP_MIN);
      expect(size).toBeLessThanOrEqual(SOCIAL_CHIP_MAX);
    }
    expect(socialChipLayout(300, 0).size).toBeGreaterThan(0);
  });
});

describe("SocialLinksRow", () => {
  const theme = { text: { primary: "#ffffff" } };
  const all = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, "seelogd"]));
  let renderer;
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = null;
  });
  const render = (props) => act(() => { renderer = create(<SocialLinksRow theme={theme} language="tr" {...props} />); });
  const rowOf = () => renderer.root.findAllByType("View")[0];
  const layout = (width) => act(() => rowOf().props.onLayout({ nativeEvent: { layout: { width, height: 40 } } }));
  const chips = () => renderer.root.findAllByType("Chip");
  const flat = (node) => Object.assign({}, ...[].concat(node.props.style({ pressed: false })).flat(9).filter(Boolean));

  test("satır sarılmaz (nowrap) ve her dolu hesap bir düğmedir", () => {
    render({ links: all });
    expect(chips()).toHaveLength(SOCIAL_PLATFORMS.length);
    const style = Object.assign({}, ...[].concat(rowOf().props.style).flat(9).filter(Boolean));
    expect(style.flexWrap).toBe("nowrap");
    expect(style.flexDirection).toBe("row");
  });

  test("ölçülen genişliğe göre düğme boyu ve boşluk uygulanır; hepsi aynı boyda", () => {
    render({ links: all });
    layout(328);
    const sizes = chips().map((c) => flat(c).width);
    expect(new Set(sizes).size).toBe(1);
    expect(sizes[0]).toBe(34);
    expect(flat(chips()[0]).height).toBe(34);
    expect(Object.assign({}, ...[].concat(rowOf().props.style).flat(9).filter(Boolean)).gap).toBe(8);
  });

  test("şeridin kendi yan boşluğu ölçülen genişlikten düşülür", () => {
    render({ links: all, style: { paddingHorizontal: 16 } });
    layout(360); // dış genişlik; içerik 328
    expect(flat(chips()[0]).width).toBe(34);
  });

  test("dar ekranda küçülür, geniş ekranda 40'a çıkar", () => {
    render({ links: all });
    layout(288);
    const narrow = flat(chips()[0]).width;
    layout(600);
    const wide = flat(chips()[0]).width;
    expect(narrow).toBeLessThan(wide);
    expect(wide).toBe(40);
  });

  test("tek hesapta büyük kalır; adres kurulamayan hesap sayılmaz; boşsa hiçbir şey çizmez", () => {
    render({ links: { instagram: "seelogd" } });
    layout(328);
    expect(chips()).toHaveLength(1);
    expect(flat(chips()[0]).width).toBe(40);
    act(() => renderer.update(<SocialLinksRow theme={theme} language="tr" links={{ instagram: "../kötü" }} />));
    expect(renderer.toJSON()).toBeNull();
    act(() => renderer.update(<SocialLinksRow theme={theme} language="tr" links={{}} />));
    expect(renderer.toJSON()).toBeNull();
  });
});
