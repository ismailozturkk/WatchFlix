// screens/auth/ForgotPasswordScreen — şifre sıfırlama e-postası gönderme.
// Ekranın BAĞLANTISI test edilir (görsel parçalar ana makine bileşeni olarak taklit edilir):
//   • adres otomatik tamamlamanın bıraktığı boşluklardan temizlenir (yazarken)
//   • gönderim services/authEmail.sendResetEmail'e uygulama diliyle gider
//   • hata türüne göre metin (eskiden hepsi "Geçersiz e posta adresi")
//   • başarıdan sonra 60 sn bekleme: düğme kapanır, etikette geri sayım; çok fazla denemede de kilit
//   • geçersiz adreste düğme kapalı ve istek gitmez

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  KeyboardAvoidingView: "Keyboard", Platform: { OS: "android" }, ScrollView: "Scroll",
  StatusBar: "StatusBar", Text: "Text", View: "View",
  StyleSheet: { create: (s) => s, absoluteFill: {}, hairlineWidth: 1 },
}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("@services/hapticsService", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
}));
jest.mock("@components/AppToast", () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock("../components/ScreenDecor", () => ({ __esModule: true, default: "Decor" }));
jest.mock("../components/auth/EmailSuffixRow", () => ({ __esModule: true, default: "SuffixRow" }));
jest.mock("../components/auth/AuthKit", () => {
  const React = require("react");
  const pass = (name) => ({ children, ...props }) => React.createElement(name, props, children);
  return {
    AUTH_SUCCESS: "#2ecc71", authColumn: {},
    AuthBackButton: "BackButton", AuthBackdrop: "Backdrop", AuthBadge: pass("Badge"), AuthCard: pass("Card"),
    AuthField: "Field", AuthFooterLink: "FooterLink", AuthHero: "Hero", AuthPrimaryButton: "PrimaryButton",
    AuthSecondaryButton: "SecondaryButton", Reveal: ({ children }) => children,
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../theme/colors", () => ({ alpha: (c, a) => `${c}@${a}` }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_k, fallback) => fallback }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      primary: "#111", secondary: "#222", between: "#333", border: "#444", accent: "#38f",
      text: { primary: "#fff", secondary: "#bbb", muted: "#888" },
    },
  }),
}));
let mockLanguage = "tr";
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({
    language: mockLanguage,
    t: { ForgotPasswordScreen: { email: "E-posta", send: "Gönder", loginButton: "Giriş yap", forgotPasswordToast: " adresine gönderildi" } },
  }),
}));
const mockSendReset = jest.fn();
jest.mock("../services/authEmail", () => {
  const real = jest.requireActual("../utils/authEmailCopy");
  return {
    sendResetEmail: (...args) => mockSendReset(...args),
    authEmailErrorMessage: (error, language) => `ERR:${error.code}:${language}`,
    cleanEmail: (v) => String(v ?? "").replace(/\s+/g, ""),
  };
});

const Toast = require("@components/AppToast").default;
const ForgotPasswordScreen = require("../screens/auth/ForgotPasswordScreen").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let navigation;
const field = () => renderer.root.findByType("Field");
const sendButton = () => renderer.root.findByType("PrimaryButton");
const typeEmail = (value) => act(() => field().props.onChangeText(value));
const press = async () => { await act(async () => { await sendButton().props.onPress(); }); };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockLanguage = "tr";
  navigation = { navigate: jest.fn() };
  mockSendReset.mockImplementation(async (email) => email.replace(/\s+/g, ""));
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = null;
  jest.useRealTimers();
  console.error.mockRestore();
});

async function render() {
  await act(async () => { renderer = create(React.createElement(ForgotPasswordScreen, { navigation })); });
}

describe("ForgotPasswordScreen", () => {
  it("geçersiz adreste düğme kapalı ve istek gitmez", async () => {
    await render();
    await typeEmail("ada");
    expect(sendButton().props.enabled).toBe(false);
    await press();
    expect(mockSendReset).not.toHaveBeenCalled();
  });

  it("yazarken adresten boşlukları temizler (otomatik tamamlama)", async () => {
    await render();
    await typeEmail("  ada@example.com ");
    expect(field().props.value).toBe("ada@example.com");
    expect(sendButton().props.enabled).toBe(true);
  });

  it("uygulama diliyle gönderir; başarıda 'gönderildi' durumuna geçer", async () => {
    mockLanguage = "de";
    await render();
    await typeEmail("ada@example.com");
    await press();
    expect(mockSendReset).toHaveBeenCalledWith("ada@example.com", { language: "de" });
    expect(Toast.show).toHaveBeenCalledWith({ type: "success", text1: "ada@example.com adresine gönderildi" });
    expect(renderer.root.findAllByType("Field")).toHaveLength(0); // başarı kartı
  });

  it("başarıdan sonra 60 sn bekleme: 'Tekrar gönder' formunda düğme kapalı, etikette geri sayım", async () => {
    await render();
    await typeEmail("ada@example.com");
    await press();
    // Başarı kartındaki "Tekrar gönder" formu açar.
    await act(async () => { renderer.root.findByType("SecondaryButton").props.onPress(); });
    expect(sendButton().props.enabled).toBe(false);
    expect(sendButton().props.label).toBe("Gönder (60)");
    mockSendReset.mockClear();
    await press();
    expect(mockSendReset).not.toHaveBeenCalled();

    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(sendButton().props.enabled).toBe(true);
    expect(sendButton().props.label).toBe("Gönder");
  });

  it("hata türüne göre metin gösterir (genel 'geçersiz e-posta' DEĞİL)", async () => {
    await render();
    await typeEmail("ada@example.com");
    mockSendReset.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "offline" }));
    await press();
    expect(Toast.show).toHaveBeenCalledWith({ type: "error", text1: "ERR:offline:tr" });
    expect(sendButton().props.enabled).toBe(true); // çevrimdışıda bekleme yok
    expect(renderer.root.findAllByType("Field")).toHaveLength(1); // form açık kaldı
  });

  it("çok fazla deneme düğmeyi 60 sn kilitler", async () => {
    await render();
    await typeEmail("ada@example.com");
    mockSendReset.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "too-many-requests" }));
    await press();
    expect(sendButton().props.enabled).toBe(false);
    expect(sendButton().props.label).toBe("Gönder (60)");
  });

  it("çift dokunuş tek istek üretir", async () => {
    await render();
    await typeEmail("ada@example.com");
    let release;
    mockSendReset.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve("ada@example.com"); }));
    let first;
    await act(async () => { first = sendButton().props.onPress(); });
    await act(async () => { await sendButton().props.onPress(); });
    expect(mockSendReset).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
  });
});
