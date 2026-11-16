// ZORUNLU GÜNCELLEME — utils/forceUpdate.js (saf kararlar + metinler),
// services/forceUpdate.js (AppConfig/minVersion okuyucu, saatlik önbellek),
// screens/ForceUpdateScreen.js (mağazayı açar).

import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockOpenURL = jest.fn();
jest.mock("react-native", () => {
  const React = require("react");
  const el = (name) => ({ children, ...props }) => React.createElement(name, props, children);
  return {
    Linking: { openURL: (...a) => mockOpenURL(...a) },
    ScrollView: el("ScrollView"),
    StatusBar: el("StatusBar"),
    StyleSheet: { create: (s) => s },
    Text: el("Text"),
    View: el("View"),
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock("../components/ScreenDecor", () => () => null);
jest.mock("../components/common/GlassTouchable", () => {
  const React = require("react");
  return ({ children, ...props }) => React.createElement("GlassTouchable", props, children);
});
jest.mock("@components/AppToast", () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { primary: "#000", secondary: "#111", border: "#222", accent: "#f0f", text: { primary: "#fff", muted: "#999" } },
  }),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../utils/colorUtils", () => ({ isLightSurface: () => false }));
jest.mock("../theme/colors", () => ({ alpha: (c) => c }));

const mockGetDoc = jest.fn();
jest.mock("firebase/firestore", () => ({
  doc: (_db, ...path) => path.join("/"),
  getDoc: (...a) => mockGetDoc(...a),
}));
jest.mock("../firebase", () => ({ db: {} }));
const mockCache = new Map();
jest.mock("../utils/apiCache", () => ({
  getCachedValue: (key) => mockCache.get(key) ?? null,
  setCachedValue: (key, value) => mockCache.set(key, value),
}));

const Toast = require("@components/AppToast").default;
const {
  compareVersions,
  isUpdateRequired,
  requiredVersionFor,
  storeLinksFor,
  FORCE_UPDATE_COPY,
} = require("../utils/forceUpdate");
const { fetchMinVersionConfig } = require("../services/forceUpdate");
const ForceUpdateScreen = require("../screens/ForceUpdateScreen").default;

beforeEach(() => {
  jest.clearAllMocks();
  mockCache.clear();
});

describe("sürüm karşılaştırma", () => {
  test("parça parça sayısal; eksik parça 0", () => {
    expect(compareVersions("1.5.1", "1.5.2")).toBe(-1);
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.5", "1.5.0")).toBe(0);
    expect(compareVersions("v2.0.0", "1.99.99")).toBe(1);
    expect(compareVersions("1.5.2-beta", "1.5.2")).toBe(0);
  });
  test("anlaşılmayan sürüm → null", () => {
    expect(compareVersions("abc", "1.0.0")).toBeNull();
    expect(compareVersions(null, "1.0.0")).toBeNull();
    expect(compareVersions("1.0.0", undefined)).toBeNull();
  });
});

describe("isUpdateRequired (güvenli yöne düşer)", () => {
  test("yüklü sürüm eskiyse true, eşit/yeniyse false", () => {
    const config = { ios: "1.5.2", android: "1.5.2" };
    expect(isUpdateRequired("1.5.1", config, "android")).toBe(true);
    expect(isUpdateRequired("1.5.2", config, "ios")).toBe(false);
    expect(isUpdateRequired("1.6.0", config, "ios")).toBe(false);
  });
  test("platform alanı `all`'u ezer", () => {
    const config = { all: "2.0.0", ios: "1.5.0" };
    expect(requiredVersionFor(config, "ios")).toBe("1.5.0");
    expect(requiredVersionFor(config, "android")).toBe("2.0.0");
    expect(isUpdateRequired("1.6.0", config, "ios")).toBe(false);
    expect(isUpdateRequired("1.6.0", config, "android")).toBe(true);
  });
  test("belge yok / boş / bozuk / sürüm bilinmiyor → engel yok", () => {
    expect(isUpdateRequired("1.0.0", null, "ios")).toBe(false);
    expect(isUpdateRequired("1.0.0", {}, "ios")).toBe(false);
    expect(isUpdateRequired("1.0.0", { ios: 152 }, "ios")).toBe(false);
    expect(isUpdateRequired("1.0.0", { ios: "yarın" }, "ios")).toBe(false);
    expect(isUpdateRequired(null, { ios: "9.9.9" }, "ios")).toBe(false);
  });
});

describe("mağaza bağlantıları", () => {
  test("varsayılan: mağaza şeması + web yedeği", () => {
    expect(storeLinksFor({}, "android")).toEqual({
      primary: "market://details?id=com.smlztrk.seelogd",
      fallback: "https://play.google.com/store/apps/details?id=com.smlztrk.seelogd",
    });
    expect(storeLinksFor(null, "ios").fallback).toBe("https://apps.apple.com/app/id6801549169");
  });
  test("ayardaki https bağlantısı (ör. TestFlight) ikisinin yerine geçer; https olmayan yok sayılır", () => {
    const tf = "https://testflight.apple.com/join/abc";
    expect(storeLinksFor({ url: { ios: tf } }, "ios")).toEqual({ primary: tf, fallback: tf });
    expect(storeLinksFor({ url: { ios: "javascript:alert(1)" } }, "ios").primary).toMatch(/^itms-apps:/);
  });
});

test("8 dilde aynı anahtarlar dolu", () => {
  const keys = Object.keys(FORCE_UPDATE_COPY.tr).sort();
  expect(Object.keys(FORCE_UPDATE_COPY).sort()).toEqual(["de", "en", "es", "fr", "it", "ja", "pt", "tr"]);
  for (const [lang, copy] of Object.entries(FORCE_UPDATE_COPY)) {
    expect([lang, Object.keys(copy).sort()]).toEqual([lang, keys]);
    for (const key of keys) expect([lang, key, copy[key].trim().length > 0]).toEqual([lang, key, true]);
    expect(copy.versions).toContain("{current}");
    expect(copy.versions).toContain("{required}");
  }
});

describe("fetchMinVersionConfig", () => {
  test("AppConfig/minVersion okunur ve önbelleğe yazılır; ikinci çağrı ağa gitmez", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ all: "1.5.2" }) });
    await expect(fetchMinVersionConfig()).resolves.toEqual({ all: "1.5.2" });
    expect(mockGetDoc).toHaveBeenCalledWith("AppConfig/minVersion");
    await expect(fetchMinVersionConfig()).resolves.toEqual({ all: "1.5.2" });
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });
  test("belge yoksa {} (engel yok, yine önbelleklenir)", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    await expect(fetchMinVersionConfig()).resolves.toEqual({});
  });
  test("okunamazsa null", async () => {
    mockGetDoc.mockRejectedValue(new Error("unavailable"));
    await expect(fetchMinVersionConfig()).resolves.toBeNull();
  });
});

describe("ForceUpdateScreen", () => {
  const links = { primary: "market://details?id=x", fallback: "https://play.google.com/x" };
  const render = async () => {
    let tree;
    await act(async () => {
      tree = create(<ForceUpdateScreen current="1.5.1" minimum="1.5.2" links={links} />);
    });
    return tree;
  };
  const button = (tree) => tree.root.findAll((n) => n.type === "GlassTouchable")[0];
  const textOf = (tree) =>
    tree.root.findAll((n) => n.type === "Text").map((n) => [].concat(n.props.children).join("")).join(" | ");

  test("sürümleri gösterir, düğme mağaza şemasını açar", async () => {
    mockOpenURL.mockResolvedValue(true);
    const tree = await render();
    expect(textOf(tree)).toContain("Yüklü sürüm 1.5.1 · gereken en az 1.5.2");
    await act(async () => { await button(tree).props.onPress(); });
    expect(mockOpenURL).toHaveBeenCalledWith(links.primary);
    expect(mockOpenURL).toHaveBeenCalledTimes(1);
  });
  test("şema açılamazsa web yedeği; o da olmazsa hata bildirimi", async () => {
    mockOpenURL.mockRejectedValueOnce(new Error("no store")).mockResolvedValueOnce(true);
    let tree = await render();
    await act(async () => { await button(tree).props.onPress(); });
    expect(mockOpenURL).toHaveBeenLastCalledWith(links.fallback);
    expect(Toast.show).not.toHaveBeenCalled();

    mockOpenURL.mockRejectedValue(new Error("nothing"));
    tree = await render();
    await act(async () => { await button(tree).props.onPress(); });
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
});
