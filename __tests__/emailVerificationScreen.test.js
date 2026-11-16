// screens/auth/EmailVerificationScreen — doğrulama kapısı ekranı.
//   • açılır açılmaz sessizce sunucudan denetler (diskten gelen kullanıcı ESKİ emailVerified taşır)
//   • kayıt ekranının gönderdiği e-postanın 60 sn beklemesi burada devam eder
//   • "E-posta gelmedi mi?" bölümünden tekrar gönderilir
//   • oturum geçersizse (hesap silinmiş vb.) oturumu kapatır, kapıda kilitli bırakmaz

import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => {
  const React = require("react");
  const el = (name) => ({ children, ...props }) => React.createElement(name, props, children);
  return {
    ActivityIndicator: el("ActivityIndicator"),
    AppState: { addEventListener: () => ({ remove: () => {} }) },
    ScrollView: el("ScrollView"),
    StatusBar: el("StatusBar"),
    StyleSheet: { create: (s) => s },
    Text: el("Text"),
    TouchableOpacity: el("TouchableOpacity"),
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
const mockSignOut = jest.fn(async () => {});
jest.mock("../firebase", () => ({ auth: {} }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { primary: "#000", secondary: "#111", border: "#222", accent: "#f0f", text: { primary: "#fff", muted: "#999" } },
  }),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../utils/colorUtils", () => ({ isLightSurface: () => false }));
jest.mock("../theme/colors", () => ({ alpha: (c) => c }));
const mockMarkVerified = jest.fn();
let mockUser;
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ pendingVerificationUser: mockUser, markEmailVerified: mockMarkVerified }),
}));
const mockSendVerify = jest.fn();
jest.mock("firebase/auth", () => ({
  signOut: (...a) => mockSignOut(...a),
  sendEmailVerification: (...a) => mockSendVerify(...a),
}));
jest.mock("../translations", () => ({ __esModule: true, default: { language: "tr" } }));

const Toast = require("@components/AppToast").default;
const { markVerificationSent } = require("../services/authEmail");
const { AUTH_EMAIL_COPY } = require("../utils/authEmailCopy");
const EmailVerificationScreen = require("../screens/auth/EmailVerificationScreen").default;

const copy = AUTH_EMAIL_COPY.tr;
const firebaseError = (code) => Object.assign(new Error(code), { code });

const makeUser = (uid, over = {}) => ({
  uid,
  email: "ada@example.com",
  emailVerified: false,
  reload: jest.fn(async () => {}),
  getIdToken: jest.fn(async () => "t"),
  ...over,
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

async function render() {
  let tree;
  await act(async () => {
    tree = create(<EmailVerificationScreen />);
  });
  await flush();
  return tree;
}

const textOf = (node) =>
  node.findAll((n) => n.type === "Text").map((n) => [].concat(n.props.children).join("")).join(" | ");
const resendButton = (tree) =>
  tree.root.findAll((n) => n.type === "GlassTouchable" && n.props.accessibilityLabel === copy.resendVerification)[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockSendVerify.mockResolvedValue(undefined);
});

test("açılışta sessizce denetler; bağlantıya zaten tıklandıysa doğrudan içeri alır", async () => {
  mockUser = makeUser("u-open");
  mockUser.reload.mockImplementation(async () => { mockUser.emailVerified = true; });
  await render();
  expect(mockUser.reload).toHaveBeenCalled();
  expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
  expect(mockMarkVerified).toHaveBeenCalledTimes(1);
});

test("'E-posta gelmedi mi?' bölümü ve tekrar gönder düğmesi görünür", async () => {
  mockUser = makeUser("u-section");
  const tree = await render();
  const text = textOf(tree.root);
  expect(text).toContain(copy.gateNoEmailTitle);
  expect(text).toContain(copy.gateNoEmailHint);
  expect(resendButton(tree).props.disabled).toBe(false);
});

test("tekrar gönder e-postayı yollar ve 60 sn kilitler", async () => {
  mockUser = makeUser("u-resend");
  const tree = await render();
  await act(async () => { await resendButton(tree).props.onPress(); });
  expect(mockSendVerify).toHaveBeenCalledTimes(1);
  expect(resendButton(tree).props.disabled).toBe(true);
  expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
});

test("kayıt ekranı az önce gönderdiyse bekleme kapıda devam eder", async () => {
  mockUser = makeUser("u-cool");
  markVerificationSent("u-cool");
  const tree = await render();
  expect(resendButton(tree).props.disabled).toBe(true);
});

test("oturum geçersizse (hesap silinmiş) kapıda bırakmaz, çıkış yapar", async () => {
  mockUser = makeUser("u-gone");
  mockUser.reload.mockRejectedValue(firebaseError("auth/user-not-found"));
  await render();
  expect(mockSignOut).toHaveBeenCalled();
});
