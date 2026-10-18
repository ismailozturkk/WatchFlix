// __tests__/profileIdentityBlockGoal.test.js
//
// Profil kimlik bloğundaki eylem satırı: [Düzenle] [Paylaş] [Yıllık hedef halkası].
// Üç düğmeyle sütun daralır (360 pt'te "Düzenle"ye ~70 px kalır); bu yüzden "Düzenle"
// kendi ölçülen genişliğine göre simgesini bırakır ve satır sarılabilir. Düzenin gerçek
// ölçüsü (Yoga) burada değil, davranış bağlantısı burada sınanır.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, flatten: (s) => s },
  Pressable: "Pressable",
  View: "View",
  Text: "Text",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/common/GlassIconButton", () => ({ __esModule: true, default: "GlassButton" }));
jest.mock("../components/badges/IdentityBadgesRow", () => ({ __esModule: true, default: "Badges" }));
jest.mock("../components/profile/YearlyGoalButton", () => ({ __esModule: true, default: "GoalButton" }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));

const ProfileIdentityBlock = require("../components/profile/ProfileIdentityBlock").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  primary: "#111111", secondary: "#1b1b1b", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
const baseProps = {
  theme, language: "tr", displayName: "Ada", username: "ada", badges: [], email: "", emailVerified: true,
  verifyHint: "", joinedAt: null, onEdit: jest.fn(), onShare: jest.fn(),
};

let renderer;
let warn;
beforeEach(() => {
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

const render = (props = {}) => {
  act(() => { renderer = create(<ProfileIdentityBlock {...baseProps} {...props} />); });
};
const editButton = () => renderer.root.findAll((n) => n.type === "Pressable" && n.props.accessibilityLabel === "Profili Düzenle")[0];
const layout = (width) => act(() => editButton().props.onLayout({ nativeEvent: { layout: { width, height: 36 } } }));
const editIcons = () => editButton().findAllByType("Icon");
const actionsRow = () => {
  const edit = editButton();
  return edit.parent;
};
const childTypes = () => actionsRow().children.map((c) => (typeof c === "string" ? c : c.type));

describe("eylem satırı", () => {
  test("showGoal açıkken sıra: Düzenle, Paylaş, hedef halkası", () => {
    render({ showGoal: true });
    expect(childTypes()).toEqual(["Pressable", "GlassButton", "GoalButton"]);
  });

  test("showGoal kapalıyken (varsayılan) hedef düğmesi YOK", () => {
    render();
    expect(childTypes()).toEqual(["Pressable", "GlassButton"]);
    render({ showGoal: false });
    expect(renderer.root.findAllByType("GoalButton")).toHaveLength(0);
  });

  test("satır sarılabilir; Düzenle esnek taban + asgari genişlikle (flex:1 DEĞİL)", () => {
    render({ showGoal: true });
    const row = actionsRow().props.style;
    expect(row.flexWrap).toBe("wrap");
    const edit = editButton().props.style({ pressed: false });
    const style = Object.assign({}, ...[].concat(edit).flat().filter(Boolean));
    // flexBasis 0 (flex:1) sarmayı tetiklemez; açık taban şart.
    expect(style.flex).toBeUndefined();
    expect(style.flexGrow).toBe(1);
    expect(style.flexBasis).toBe(62);
    expect(style.minWidth).toBe(62);
  });
});

describe("Düzenle simgesi darlıkta bırakılır", () => {
  test("ilk ölçüme kadar simge yok (dar ekranda önce çizilip kaybolmasın)", () => {
    render({ showGoal: true });
    expect(editIcons()).toHaveLength(0);
  });

  test.each([62, 70, 85, 95])("%i px: yalnız etiket", (width) => {
    render({ showGoal: true });
    layout(width);
    expect(editIcons()).toHaveLength(0);
    expect(editButton().findAllByType("Text")).toHaveLength(1);
  });

  test.each([96, 100, 144, 210])("%i px: simge + etiket", (width) => {
    render({ showGoal: true });
    layout(width);
    expect(editIcons()).toHaveLength(1);
  });

  test("genişlik değişince simge geri gelir / gider", () => {
    render({ showGoal: true });
    layout(150);
    expect(editIcons()).toHaveLength(1);
    layout(70);
    expect(editIcons()).toHaveLength(0);
    layout(150);
    expect(editIcons()).toHaveLength(1);
  });

  test("etiket her genişlikte durur (dokunma hedefinin adı kaybolmaz)", () => {
    render({ showGoal: true });
    layout(70);
    expect(editButton().findAllByType("Text")[0].props.children).toBe("Düzenle");
    expect(editButton().props.accessibilityRole).toBe("button");
  });

  test("Düzenle ve Paylaş işleyicileri hâlâ bağlı", () => {
    const onEdit = jest.fn();
    const onShare = jest.fn();
    render({ showGoal: true, onEdit, onShare });
    act(() => editButton().props.onPress());
    act(() => renderer.root.findByType("GlassButton").props.onPress());
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
