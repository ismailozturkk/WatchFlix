// Free kullanıcının her ekranın üstünde gördüğü "Premium'a geç" şeridi
// (components/premium/PremiumTopBanner.js + PremiumTopBannerLayout.js). Gerçek çizim (akan
// degrade, ışık süpürmesi) cihazda doğrulanır; burada kurallar kilitlenir: kime / hangi
// rotada gösterilir, Premium'da kalkar, şerit içeriğin ÜSTÜNDE yüzer ve gövdenin üst güvenli
// alanı şeridin taştığı kadar büyür (pencere değerleri korunur), yerel SafeAreaView kökleri
// sarmalayıcıdan geçer, ve App.js bağı.
import fs from "fs";
import path from "path";
import React, { useContext } from "react";
import { act, create } from "react-test-renderer";
import { PREMIUM_PLAN } from "../utils/premium";
import {
  PREMIUM_TOP_BANNER_COLORS,
  PREMIUM_TOP_BANNER_HIDDEN_ROUTES,
  premiumTopBannerAccessibilityLabel,
  premiumTopBannerCopy,
  premiumTopBannerFlowGeometry,
  premiumTopBannerFlowStops,
  premiumTopBannerOverlap,
  shouldShowPremiumTopBanner,
} from "../utils/premiumTopBanner";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockPlan = "free";
let mockLoading = false;
let mockUser = { uid: "u1" };
const mockNavigate = jest.fn();
const mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };

jest.mock("react-native", () => {
  const value = () => ({ interpolate: () => 0, setValue: () => {} });
  const anim = () => ({ start: () => {}, stop: () => {} });
  return {
    Animated: {
      View: "AnimatedView",
      Value: function Value() {
        return value();
      },
      loop: anim,
      sequence: anim,
      delay: anim,
      timing: anim,
      spring: anim,
    },
    Easing: { inOut: () => () => 0, quad: () => 0, linear: () => 0 },
    Pressable: "Pressable",
    Platform: { OS: "ios" },
    StatusBar: "StatusBar",
    StyleSheet: {
      create: (s) => s,
      flatten: (s) => Object.assign({}, ...[].concat(s).flat(Infinity).filter(Boolean)),
      absoluteFill: {},
      hairlineWidth: 0.5,
    },
    Text: "Text",
    View: "View",
  };
});
jest.mock("react-native-safe-area-context", () => {
  const { createContext, useContext } = require("react");
  const SafeAreaInsetsContext = createContext(null);
  return {
    SafeAreaInsetsContext,
    SafeAreaView: "NativeSafeAreaView",
    useSafeAreaInsets: () => useContext(SafeAreaInsetsContext) || mockInsets,
  };
});
jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("@components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("@hooks/useReduceMotion", () => ({ __esModule: true, default: () => false }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: { primary: "#101010" } }),
}));
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, needsProfileCompletion: false }),
}));
jest.mock("../context/PremiumContext", () => ({
  usePremium: () => ({ plan: mockPlan, loading: mockLoading }),
}));

const PremiumTopBannerLayout = require("../components/premium/PremiumTopBannerLayout").default;
const {
  usePremiumBannerOverlap,
  useWindowSafeAreaInsets,
} = require("../context/ScreenInsetsContext");
const { SafeAreaInsetsContext } = require("react-native-safe-area-context");

let seen = null;
function Probe() {
  seen = {
    body: useContext(SafeAreaInsetsContext),
    window: useWindowSafeAreaInsets(),
    overlap: usePremiumBannerOverlap(),
  };
  return null;
}

function render(routeName = "TabScreen") {
  let tree;
  act(() => {
    tree = create(
      <PremiumTopBannerLayout routeName={routeName}>
        <Probe />
      </PremiumTopBannerLayout>,
    );
  });
  return tree;
}

beforeEach(() => {
  mockPlan = "free";
  mockLoading = false;
  mockUser = { uid: "u1" };
  mockNavigate.mockClear();
  seen = null;
});

describe("kurallar", () => {
  test("yalnız oturumu açık Free kullanıcıda, yükleme bitince", () => {
    const base = { plan: PREMIUM_PLAN.FREE, routeName: "TabScreen", signedIn: true };
    expect(shouldShowPremiumTopBanner(base)).toBe(true);
    expect(shouldShowPremiumTopBanner({ ...base, plan: PREMIUM_PLAN.PREMIUM })).toBe(false);
    expect(shouldShowPremiumTopBanner({ ...base, plan: PREMIUM_PLAN.UNLIMITED })).toBe(false);
    expect(shouldShowPremiumTopBanner({ ...base, signedIn: false })).toBe(false);
    expect(shouldShowPremiumTopBanner({ ...base, loading: true })).toBe(false);
  });

  test("ödeme, oturum ve tam ekran rotalarında gizli", () => {
    for (const route of ["PremiumScreen", "LoginScreen", "ChatScreen", "WrappedScreen", "UnifiedSearch"]) {
      expect(PREMIUM_TOP_BANNER_HIDDEN_ROUTES.has(route)).toBe(true);
      expect(
        shouldShowPremiumTopBanner({ plan: PREMIUM_PLAN.FREE, routeName: route, signedIn: true }),
      ).toBe(false);
    }
  });

  test("gizlenen her rota App.js'de kayıtlı (yazım hatası sessizce şerit göstermesin)", () => {
    const app = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
    for (const route of PREMIUM_TOP_BANNER_HIDDEN_ROUTES) {
      expect(app).toContain(`name="${route}"`);
    }
  });

  test("akan degrade dikişsiz: katman 3 genişlik, periyot 1,5 genişlik, desen başa döner", () => {
    const stops = premiumTopBannerFlowStops();
    expect(stops[0]).toBe(stops[stops.length - 1]);
    expect(stops).toHaveLength(PREMIUM_TOP_BANNER_COLORS.length * 2 + 1);
    expect(premiumTopBannerFlowGeometry(200)).toEqual({ layerWidth: 600, period: 300 });
  });

  test("metinler beş dilde, bilinmeyen dil İngilizce", () => {
    for (const lang of ["tr", "en", "es", "pt", "de"]) {
      const copy = premiumTopBannerCopy(lang);
      expect(copy.title).toBeTruthy();
      expect(copy.subtitle).toBeTruthy();
      expect(copy.cta).toBeTruthy();
    }
    expect(premiumTopBannerCopy("tr").title).toBe("Premium'a geç");
    expect(premiumTopBannerCopy("xx")).toEqual(premiumTopBannerCopy("en"));
    expect(premiumTopBannerAccessibilityLabel("tr")).toContain("planları gör");
  });
});

describe("yerleşim", () => {
  test("Free: şerit yüzer, ödeme ekranını açar; gövdenin üst boşluğu şerit kadar büyür", () => {
    const tree = render();
    const banner = tree.root.findByProps({ testID: "premium-top-banner" });
    act(() => banner.props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith("PremiumScreen", { source: "top_banner" });
    const overlap = premiumTopBannerOverlap(47);
    expect(seen.overlap).toBe(overlap);
    expect(seen.body.top).toBe(47 + overlap);
    expect(seen.body.bottom).toBe(34);
    expect(seen.window.top).toBe(47);
  });

  test("şerit gövdeden SONRA, mutlak konumda çizilir (içeriği itmez, üstünde kalır)", () => {
    const tree = render();
    const root = tree.root.findByProps({ testID: "premium-top-banner" });
    let wrap = root.parent;
    while (wrap && wrap.props.pointerEvents !== "box-none") wrap = wrap.parent;
    const flat = Object.assign({}, ...[].concat(wrap.props.style));
    expect(flat.position).toBe("absolute");
    expect(flat.top).toBe(0);
    expect(flat.paddingTop).toBe(47 + 8);
  });

  test("Premium olunca şerit kalkar, gövde gerçek boşluğa döner", () => {
    mockPlan = "premium";
    const tree = render();
    expect(tree.root.findAllByProps({ testID: "premium-top-banner" })).toHaveLength(0);
    expect(seen.body.top).toBe(47);
    expect(seen.overlap).toBe(0);
  });

  test("gizli rotada şerit yok", () => {
    const tree = render("PremiumScreen");
    expect(tree.root.findAllByProps({ testID: "premium-top-banner" })).toHaveLength(0);
    expect(seen.body.top).toBe(47);
  });

  test("plan değişince ekran yeniden kurulmaz (ağaç şekli sabit)", () => {
    let mounts = 0;
    function Counter() {
      React.useEffect(() => {
        mounts += 1;
      }, []);
      return null;
    }
    let tree;
    act(() => {
      tree = create(
        <PremiumTopBannerLayout routeName="TabScreen">
          <Counter />
        </PremiumTopBannerLayout>,
      );
    });
    mockPlan = "premium";
    act(() => {
      tree.update(
        <PremiumTopBannerLayout routeName="TabScreen">
          <Counter />
        </PremiumTopBannerLayout>,
      );
    });
    expect(tree.root.findAllByProps({ testID: "premium-top-banner" })).toHaveLength(0);
    expect(mounts).toBe(1);
  });
});

describe("bağlar", () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

  test("kök stack her ekranı şerit yerleşimiyle sarar", () => {
    expect(read("App.js")).toMatch(/screenLayout=\{\(\{ route, children \}\) => \(\s*<PremiumTopBannerLayout routeName=\{route\.name\}>/);
  });

  test("pencere kenarına çizilen içerik gerçek üst boşluğu okur", () => {
    for (const rel of [
      "components/modals/CommentSheetModal.js",
      "components/modals/ImageGalleryModal.js",
      "components/modals/PostCommentSheetModal.js",
      "components/chat/SharedListSheet.js",
      "components/settingsShare/SettingsShareSheetFrame.js",
      "components/storyShare/ProfileStoryModal.js",
      "components/toast/ToastHost.js",
    ]) {
      const src = read(rel);
      expect(src).toContain("useWindowSafeAreaInsets()");
      expect(src).not.toContain("useSafeAreaInsets()");
    }
  });

  // Yerel SafeAreaView şeridi görmez (konumdan okur): üst kenarı kullanan her ekran kökü
  // sarmalayıcıdan geçmeli. Yeni ekran asıl bileşenle eklenirse burası kırılır.
  test("ekranlarda üst kenarlı SafeAreaView yalnız ScreenSafeAreaView'dan gelir", () => {
    const walk = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
        d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith(".js") ? [path.join(dir, d.name)] : [],
      );
    const root = path.join(__dirname, "..");
    // Gizli rotalar (şerit hiç çizilmez) ve yalnız alt kenarlı sayfa içi kullanımlar hariç.
    const allowed = new Set([
      "screens/cineswipe/CineSwipeScreen.js",
      "screens/tabs/UsageDebugScreen.js",
      "screens/game/GameLeaderboardScreen.js",
      "screens/tabs/settings/BackupSettingsScreen.js",
    ]);
    const offenders = walk(path.join(root, "screens"))
      .map((abs) => [path.relative(root, abs).split(path.sep).join("/"), fs.readFileSync(abs, "utf8")])
      .filter(([rel, src]) => !allowed.has(rel))
      .filter(([, src]) => /import\s*\{[^}]*\bSafeAreaView\b[^}]*\}\s*from\s*"react-native-safe-area-context"/.test(src))
      .filter(([, src]) => /<SafeAreaView\b/.test(src))
      .map(([rel]) => rel);
    expect(offenders).toEqual([]);
  });
});

describe("ScreenSafeAreaView", () => {
  const { PremiumBannerOverlapContext } = require("../context/ScreenInsetsContext");

  function renderSafe(overlap, props) {
    const ScreenSafeAreaView = require("../components/common/ScreenSafeAreaView").default;
    let tree;
    act(() => {
      tree = create(
        <PremiumBannerOverlapContext.Provider value={overlap}>
          <ScreenSafeAreaView {...props} />
        </PremiumBannerOverlapContext.Provider>,
      );
    });
    const node = tree.root.findByType("NativeSafeAreaView");
    return Object.assign({}, ...[].concat(node.props.style).flat().filter(Boolean));
  }

  test("şerit varken üst kenara fazlalık eklenir (mevcut dolgu korunur)", () => {
    expect(renderSafe(50, { style: { flex: 1, paddingTop: 4 }, edges: ["top"] }).paddingTop).toBe(54);
    expect(renderSafe(50, { style: { flex: 1 }, edges: undefined }).paddingTop).toBe(50);
  });

  test("yalnız alt kenar ya da şerit yok → dokunulmaz", () => {
    expect(renderSafe(50, { style: { flex: 1 }, edges: ["bottom"] }).paddingTop).toBeUndefined();
    expect(renderSafe(0, { style: { flex: 1 }, edges: ["top"] }).paddingTop).toBeUndefined();
  });
});

describe("taşma hesabı", () => {
  test("şerit yüksekliği + paylar; Android'de durum çubuğu güvenli alandan büyükse fark eklenir", () => {
    expect(premiumTopBannerOverlap(47)).toBe(8 + 36 + 2);
    expect(premiumTopBannerOverlap(24, 30)).toBe(6 + 8 + 36 + 2);
  });
});
