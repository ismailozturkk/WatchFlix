// Notlar: not metni ve yapılacak maddesi için plana bağlı HARF sınırı.
// Kayıt (utils/premiumFeatures.js: note_length, todo_item_length) → saf yardımcı
// (utils/noteTextLimits.js) → editör (NoteEditorSheet): sınıra yazarak dayanınca
// yükseltme sayfası bir kez açılır, eski uzun metin kırpılmaz, "Premium'a geç"
// önce notu kaydeder.
import React from "react";
import { act, create } from "react-test-renderer";
import { PREMIUM_PLAN } from "../utils/premium";
import {
  buildLimitCopy,
  canUseFeature,
  formatFeatureValue,
  getFeatureLimit,
  nextPlanFor,
} from "../utils/premiumFeatures";
import { buildUpsellContent } from "../utils/premiumUpsellContent";
import { buildUsageRow } from "../utils/premiumUsageModel";
import {
  NOTE_TEXT_FEATURES,
  isAtTextLimit,
  noteTextLimitsFor,
  reachedTextLimit,
  textInputMaxLength,
} from "../utils/noteTextLimits";

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name) => React.forwardRef((props, ref) => React.createElement(name, { ...props, ref }, props.children));
  return {
    View: host("View"), Text: host("Text"), TextInput: host("TextInput"), ScrollView: host("ScrollView"),
    TouchableOpacity: host("TouchableOpacity"),
    StyleSheet: { create: (s) => s, hairlineWidth: 1, absoluteFill: {} },
    Keyboard: { dismiss: jest.fn() },
  };
});
let mockScopedHost;
jest.mock("@components/premium/PremiumUpsellSheet", () => ({
  PremiumUpsellHost: (props) => {
    mockScopedHost = props;
    return null;
  },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("@components/common/BottomSheetModal", () => ({ __esModule: true, default: ({ children, visible }) => (visible ? children : null) }));
jest.mock("@components/modals/DatePickerModal", () => () => null);
jest.mock("@components/premium/PremiumPill", () => "PremiumPill");
jest.mock("@components/AppAlert", () => ({ appAlert: jest.fn() }));
const mockToast = { success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@components/AppToast", () => ({ toast: mockToast }));
jest.mock("../components/common/GlassTouchable", () => "GlassTouchable");
jest.mock("../components/common/GlassBox", () => "GlassBox");
jest.mock("../utils/liquidGlass", () => ({ GLASS_PRESS_ROOM: 4 }));
jest.mock("../services/noteTodoDraftService", () => ({
  getNoteTodoDraft: () => null, removeNoteTodoDraft: jest.fn(), saveNoteTodoDraft: jest.fn(), todoDraftKey: (id) => id || "new",
}));

const { FREE, PREMIUM, UNLIMITED: MAX } = PREMIUM_PLAN;

describe("kayıt: harf sınırları", () => {
  // 29 Ekim kullanıcı kararı; tablo bilerek düz yazılı (sayı değişirse burası kırılır).
  test("kullanıcı kararı: not 500 · 2.000 · 20.000, madde 180 · 360 · 1.000", () => {
    expect([FREE, PREMIUM, MAX].map((plan) => getFeatureLimit("note_length", plan))).toEqual([500, 2000, 20000]);
    expect([FREE, PREMIUM, MAX].map((plan) => getFeatureLimit("todo_item_length", plan))).toEqual([180, 360, 1000]);
  });

  test("Max'te de sayı var (sınırsız vaat edilmez), üst plan yok", () => {
    expect(nextPlanFor("note_length", FREE)).toBe(PREMIUM);
    expect(nextPlanFor("note_length", PREMIUM)).toBe(MAX);
    expect(nextPlanFor("note_length", MAX)).toBe(null);
    expect(formatFeatureValue("note_length", MAX, "tr")).toBe("20.000 karakter");
  });

  test("karşılaştırma değeri dilin basamak biçiminde", () => {
    expect(formatFeatureValue("note_length", FREE, "tr")).toBe("500 karakter");
    expect(formatFeatureValue("note_length", PREMIUM, "en")).toBe("2,000 characters");
    expect(formatFeatureValue("note_length", PREMIUM, "de")).toBe("2.000 Zeichen");
    expect(formatFeatureValue("todo_item_length", FREE, "tr")).toBe("180 karakter");
    expect(formatFeatureValue("todo_item_length", MAX, "tr")).toBe("1.000 karakter");
  });

  test("limit cümlesi planın tavanını ve üst planları söyler", () => {
    expect(buildLimitCopy("note_length", FREE, "tr").message).toBe(
      "Free planında bir not en fazla 500 karakter olabilir. Premium ile 2.000, Premium Max ile 20.000.",
    );
    expect(buildLimitCopy("todo_item_length", PREMIUM, "en").message).toBe(
      "On Premium, a to-do item can be up to 360 characters long. With Premium Max: 1,000.",
    );
  });

  test("kapı: o anki uzunluk sınırın altındaysa serbest", () => {
    expect(canUseFeature("note_length", FREE, 499)).toBe(true);
    expect(canUseFeature("note_length", FREE, 500)).toBe(false);
    expect(canUseFeature("note_length", PREMIUM, 500)).toBe(true);
  });

  test("Kullanım ekranında sayaç değil plan değeri (tek kaydın tavanı)", () => {
    const row = buildUsageRow("note_length", FREE, { note_length: 400 }, new Date(2026, 9, 29), "tr");
    expect(row).toMatchObject({ state: "included", used: null, valueLabel: "500 karakter" });
  });

  test("yükseltme sayfası: başlık, metnin uzunluğuyla gösterge, plan sütunları, güvence notu", () => {
    const c = buildUpsellContent("note_length", FREE, "tr", { used: 500 });
    expect(c.title).toBe("Not uzunluk sınırına ulaştın");
    expect(c.meter).toMatchObject({ used: 500, cap: 500, ratio: 1, unit: "karakter" });
    expect(c.tiers.map((tier) => [tier.main, tier.sub])).toEqual([
      ["500", "karakter"],
      ["2.000", "karakter"],
      ["20.000", "karakter"],
    ]);
    expect(c.targetPlan).toBe(PREMIUM);
    expect(c.note).toMatch(/kısaltılmaz/);
    expect(buildUpsellContent("todo_item_length", FREE, "en", { used: 180 }).title).toBe(
      "You've reached the item length limit",
    );
  });
});

describe("utils/noteTextLimits", () => {
  test("planın sınırları, yükseltilebilirlik ve hedef planın adı", () => {
    expect(noteTextLimitsFor(FREE)).toEqual({
      content: { featureId: NOTE_TEXT_FEATURES.content, limit: 500, canUpgrade: true, upgradePlanName: "Premium" },
      todoItem: { featureId: NOTE_TEXT_FEATURES.todoItem, limit: 180, canUpgrade: true, upgradePlanName: "Premium" },
    });
    expect(noteTextLimitsFor(PREMIUM).content).toMatchObject({ limit: 2000, upgradePlanName: "Premium Max" });
    expect(noteTextLimitsFor(MAX).content).toMatchObject({ limit: 20000, canUpgrade: false, upgradePlanName: null });
  });

  test("maxLength sınırdan uzun eski metni kırpmaz: yalnız kısalabilir", () => {
    expect(textInputMaxLength(100, "kısa")).toBe(100);
    expect(textInputMaxLength(100, "x".repeat(140))).toBe(140);
    expect(textInputMaxLength(Infinity, "x")).toBeUndefined();
  });

  test("sınıra YENİ dayanma yalnız alttan gelince sayılır", () => {
    expect(isAtTextLimit(5, "12345")).toBe(true);
    expect(reachedTextLimit(5, "1234", "12345")).toBe(true);
    expect(reachedTextLimit(5, "", "123456789")).toBe(true); // yapıştırma
    expect(reachedTextLimit(5, "12345", "12345")).toBe(false);
    expect(reachedTextLimit(5, "1234567", "123456")).toBe(false); // eski uzun metin kısalıyor
  });
});

// ── Editör ──────────────────────────────────────────────────────────────────

const NoteEditorSheet = require("../screens/tabs/profile/notes/NoteEditorSheet").default;
const { Keyboard } = require("react-native");

const mockTheme = {
  primary: "#111111", secondary: "#222222", border: "#333333", accent: "#8888ff",
  text: { primary: "#ffffff", secondary: "#aaaaaa", muted: "#777777" }, colors: { orange: "#ff7c25", red: "#ff3232" },
};
const colorPairs = [{ color: "#3b82f6", background: "#10203a" }];

global.IS_REACT_ACT_ENVIRONMENT = true;
beforeAll(() => require("../translations").default.changeLanguage("tr"));
let renderer;
let errorSpy;

beforeEach(() => {
  jest.clearAllMocks();
  mockScopedHost = null;
  const original = console.error;
  errorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (!String(message).includes("react-test-renderer is deprecated")) original(message, ...args);
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
});

const renderEditor = (props = {}) => {
  const handlers = {
    onSave: jest.fn().mockResolvedValue(true),
    onTextLimit: jest.fn(),
    onUpgrade: jest.fn(),
  };
  act(() => {
    renderer = create(
      <NoteEditorSheet visible defaultType="note" theme={mockTheme} colorPairs={colorPairs} language="tr"
        onClose={jest.fn()} textLimits={noteTextLimitsFor(FREE)} {...handlers} {...props} />,
    );
  });
  return handlers;
};
const contentInput = () => renderer.root.findAll((n) => n.type === "TextInput" && n.props.multiline)[0];
const typeContent = (text) => act(() => contentInput().props.onChangeText(text));
const todoAddInput = () => renderer.root.findAll((n) => n.type === "TextInput" && n.props.onSubmitEditing && !n.props.autoFocus)[0];
const upgradeCounter = () =>
  renderer.root.findAll((n) => n.type === "TouchableOpacity" && String(n.props.accessibilityLabel || "").startsWith("500/500"))[0];

describe("editör: harf sınırı", () => {
  test("not metni planın sınırını alır; sınıra yazarak dayanınca yükseltme sayfası BİR kez açılır", () => {
    const { onTextLimit } = renderEditor();
    expect(contentInput().props.maxLength).toBe(500);

    typeContent("x".repeat(499));
    expect(onTextLimit).not.toHaveBeenCalled();
    typeContent("x".repeat(500));
    expect(Keyboard.dismiss).toHaveBeenCalled();
    expect(onTextLimit).toHaveBeenCalledWith("note_length", 500);

    // Silip yeniden dayanmak sayfayı tekrar açmaz; sayaçtaki ✦ açar.
    typeContent("x".repeat(490));
    typeContent("x".repeat(500));
    expect(onTextLimit).toHaveBeenCalledTimes(1);
    act(() => upgradeCounter().props.onPress());
    expect(onTextLimit).toHaveBeenCalledTimes(2);
  });

  test("sınırdan uzun eski not kırpılmaz ve düzenlerken sayfa açılmaz", () => {
    const long = "y".repeat(1500);
    const { onTextLimit } = renderEditor({
      initialNote: { id: "n1", type: "note", title: "", content: long, color: "#3b82f6", todos: [] },
    });
    expect(contentInput().props.maxLength).toBe(1500);
    typeContent(long.slice(0, 1400));
    expect(contentInput().props.maxLength).toBe(1400);
    expect(onTextLimit).not.toHaveBeenCalled();
  });

  test("üst plan yoksa (Max) sayfa açılmaz, sayaç dokunulmaz", () => {
    const { onTextLimit } = renderEditor({ textLimits: noteTextLimitsFor(MAX) });
    expect(contentInput().props.maxLength).toBe(20000);
    typeContent("x".repeat(20000));
    expect(onTextLimit).not.toHaveBeenCalled();
  });

  test("yapılacak maddesi kendi sınırını alır", () => {
    const { onTextLimit } = renderEditor({ defaultType: "todo" });
    expect(todoAddInput().props.maxLength).toBe(180);
    act(() => todoAddInput().props.onChangeText("m".repeat(180)));
    expect(onTextLimit).toHaveBeenCalledWith("todo_item_length", 180);
  });

  test("yükseltme sayfası editörün içinde açılır; 'Premium'a geç' önce yazılanı kaydeder", async () => {
    const { onSave, onUpgrade } = renderEditor();
    expect(mockScopedHost).toMatchObject({ scoped: true, enabled: true });

    typeContent("x".repeat(500));
    await act(async () => {
      await mockScopedHost.onUpgrade("note_length");
    });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ type: "note", content: "x".repeat(500) }));
    expect(onUpgrade).toHaveBeenCalledWith("note_length");
  });

  test("kayıt doğrulamaya takılırsa editör açık kalır (ödeme ekranına geçilmez)", async () => {
    const { onSave, onUpgrade } = renderEditor();
    typeContent("x".repeat(500));
    onSave.mockResolvedValueOnce(false);
    await act(async () => {
      await mockScopedHost.onUpgrade("note_length");
    });
    expect(onUpgrade).not.toHaveBeenCalled();
  });
});
