// __tests__/profileIdentityBlockGoal.test.js
//
// Profil kimlik bloğundaki eylem satırı: hepsi İKON düğmesi —
// [Düzenle] [Bildirimler] [Ayarlar] [Paylaş] [Yıllık hedef halkası].
// Beş düğme de alt satıra İNMEZ (flexWrap: "nowrap"); sütun genişliğine göre
// düğme boyu ve aralık duyarlı (responsive) ölçeklenerek yatay alana tam sığar.

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

const {
  default: ProfileIdentityBlock,
  resolveActionRowLayout,
} = require("../components/profile/ProfileIdentityBlock");

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
  jest.clearAllMocks();
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
const editButton = () => renderer.root.findByProps({ testID: "profile-edit-button" });
const actionsRow = () => editButton().parent;
const flatStyle = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
const childTypes = () => actionsRow().children.map((c) => (typeof c === "string" ? c : c.type));
const NotifStub = () => <GlassNotif />;
const GlassNotif = () => null;

describe("eylem satırı", () => {
  test("Düzenle bir İKON düğmesidir (etiketli hap değil) ve erişilebilir adı durur", () => {
    render();
    expect(editButton().type).toBe("GlassButton");
    expect(editButton().props.icon).toBe("create-outline");
    expect(editButton().props.size).toBe(36);
    expect(editButton().props.accessibilityLabel).toBe("Profili Düzenle");
    expect(renderer.root.findAllByType("Pressable")).toHaveLength(0);
  });

  test("sıra: Düzenle, Bildirimler, Ayarlar, Paylaş, hedef halkası", () => {
    render({ showGoal: true, notificationsAction: <NotifStub />, onSettings: jest.fn(), settingsLabel: "Ayarlar" });
    expect(childTypes()).toEqual(["GlassButton", NotifStub, "GlassButton", "GlassButton", "GoalButton"]);
    const labels = actionsRow()
      .children.filter((c) => c.type === "GlassButton")
      .map((c) => c.props.testID ?? c.props.accessibilityLabel);
    expect(labels).toEqual(["profile-edit-button", "profile-settings-button", "Paylaş"]);
  });

  test("bildirim girişi verilmezse yer tutmaz; hedef kapalıyken halka yok", () => {
    render();
    expect(childTypes()).toEqual(["GlassButton", "GlassButton"]);
    expect(renderer.root.findAllByType("GoalButton")).toHaveLength(0);
  });

  test("satır tek yatay satırda kalır (nowrap) ve genişliğe göre tüm düğmeleri ölçekler", () => {
    render({ showGoal: true, notificationsAction: <NotifStub />, onSettings: jest.fn(), settingsLabel: "Ayarlar" });
    const row = flatStyle(actionsRow().props.style);
    expect(row.flexWrap).toBe("nowrap");
    expect(row.flexDirection).toBe("row");
    expect(row.width).toBe("100%");

    // 360 pt ekran (sütun genişliği 158 px): 5 düğme + 4 boşluk tam 158 px'e sığar.
    act(() => {
      actionsRow().props.onLayout({ nativeEvent: { layout: { width: 158, height: 36 } } });
    });
    const updatedRow = flatStyle(actionsRow().props.style);
    const size = editButton().props.size;
    expect(size).toBe(28);
    expect(updatedRow.gap).toBe(4.5);
    expect(5 * size + 4 * updatedRow.gap).toBeLessThanOrEqual(158);
    expect(renderer.root.findByType("GoalButton").props.size).toBe(size);
    expect(renderer.root.findByType(NotifStub).props.size).toBe(size);
  });

  test.each([135, 158, 173, 188, 191, 210, 228])(
    "%i px sütunda 5 düğme yatay genişliği aşmadan sığar",
    (width) => {
      const layout = resolveActionRowLayout(width, 5);
      expect(layout.size).toBeGreaterThanOrEqual(22);
      expect(layout.size).toBeLessThanOrEqual(38);
      expect(5 * layout.size + 4 * layout.gap).toBeLessThanOrEqual(width);
    },
  );

  test("Düzenle ve Paylaş işleyicileri bağlı", () => {
    const onEdit = jest.fn();
    const onShare = jest.fn();
    render({ showGoal: true, onEdit, onShare });
    act(() => editButton().props.onPress());
    const share = renderer.root
      .findAllByType("GlassButton")
      .find((n) => n.props.accessibilityLabel === "Paylaş");
    act(() => share.props.onPress());
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  test("Ayarlar dişlisi eylem satırında (adın yanında DEĞİL) ve işleyicisi bağlı", () => {
    const onSettings = jest.fn();
    render({ onSettings, settingsLabel: "Ayarlar" });
    const gear = renderer.root.findByProps({ testID: "profile-settings-button" });
    expect(gear.parent).toBe(actionsRow());
    expect(gear.props.size).toBe(36);
    expect(gear.props.accessibilityLabel).toBe("Ayarlar");
    act(() => gear.props.onPress());
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  test("onSettings yoksa dişli çizilmez", () => {
    render();
    expect(renderer.root.findAllByProps({ testID: "profile-settings-button" })).toHaveLength(0);
  });

  describe("e-posta doğrulama uyarısı", () => {
    const resend = () => renderer.root.findByProps({ testID: "profile-verify-resend" });

    test("uyarı metni var ama eylem verilmediyse 'tekrar gönder' çizilmez", () => {
      render({ email: "a@b.co", emailVerified: false, verifyHint: "E-postanı doğrula" });
      expect(renderer.root.findAllByProps({ testID: "profile-verify-resend" })).toHaveLength(0);
    });

    test("eylem etiketiyle çizilir ve dokunuşu bağlıdır", () => {
      const onPress = jest.fn();
      render({ email: "a@b.co", emailVerified: false, verifyHint: "E-postanı doğrula", verifyAction: { label: "Tekrar gönder", onPress } });
      expect(resend().props.accessibilityLabel).toBe("Tekrar gönder");
      expect(resend().props.accessibilityRole).toBe("button");
      expect(resend().props.disabled).toBe(false);
      act(() => resend().props.onPress());
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    test("bekleme sürerken (disabled) ve gönderilirken (busy) dokunuş kapalı", () => {
      render({ email: "a@b.co", emailVerified: false, verifyHint: "x", verifyAction: { label: "30 sn", onPress: jest.fn(), disabled: true } });
      expect(resend().props.disabled).toBe(true);
      expect(resend().props.accessibilityState).toEqual({ disabled: true, busy: false });
      act(() => renderer.unmount());
      render({ email: "a@b.co", emailVerified: false, verifyHint: "x", verifyAction: { label: "...", onPress: jest.fn(), busy: true } });
      expect(resend().props.disabled).toBe(true);
      expect(resend().props.accessibilityState).toEqual({ disabled: false, busy: true });
    });

    test("uyarı metni yoksa (doğrulanmış) eylem de çizilmez", () => {
      render({ email: "a@b.co", emailVerified: true, verifyHint: "", verifyAction: { label: "Tekrar gönder", onPress: jest.fn() } });
      expect(renderer.root.findAllByProps({ testID: "profile-verify-resend" })).toHaveLength(0);
    });
  });
});
