// __tests__/accountEmailCard.test.js
//
// Ayarlar > Hesap bilgileri'ndeki "Hesap" kartı: e-posta + doğrulama çipi, katılma
// tarihi; doğrulanmamışsa "tekrar gönder" düğmeli uyarı kutusu (11 Kas, profilden taşındı).

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  ActivityIndicator: "Spinner",
  Pressable: "Pressable",
  View: "View",
  Text: "Text",
}));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../theme/colors", () => ({ alpha: (c) => c }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../components/profile/EditProfileKit", () => ({
  FormSection: ({ children }) => children,
}));

const { default: AccountEmailCard, formatAccountJoinDate } = require("../components/profile/AccountEmailCard");

global.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  accent: "#3388ff", border: "#333333",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};

let renderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
});
const render = (props) => {
  act(() => {
    renderer = create(<AccountEmailCard theme={theme} language="tr" {...props} />);
  });
  return renderer.root;
};
const byId = (root, id) => root.findAllByProps({ testID: id }).filter((n) => typeof n.type === "string");

describe("AccountEmailCard", () => {
  test("doğrulanmış: mavi çip, uyarı yok", () => {
    const root = render({ email: "a@b.co", verified: true, joinedAt: "1700000000000" });
    expect(byId(root, "account-email-verified")).toHaveLength(1);
    expect(byId(root, "account-email-warning")).toHaveLength(0);
  });

  test("doğrulanmamış: kırmızı çip + uyarı + bağlı 'tekrar gönder'", () => {
    const onPress = jest.fn();
    const root = render({
      email: "a@b.co",
      verified: false,
      joinedAt: "1700000000000",
      verifyHint: "Bağlantıyla doğrula",
      resend: { label: "Tekrar gönder", onPress },
    });
    expect(byId(root, "account-email-unverified")).toHaveLength(1);
    expect(byId(root, "account-email-warning")).toHaveLength(1);
    const button = byId(root, "account-verify-resend")[0];
    expect(button.props.disabled).toBe(false);
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("bekleme sürerken düğme kapalı", () => {
    const root = render({ email: "a@b.co", verified: false, resend: { label: "30 sn", onPress: jest.fn(), disabled: true } });
    expect(byId(root, "account-verify-resend")[0].props.disabled).toBe(true);
  });

  test("katılma tarihi: ms dizgesi ve tarih dizgesi okunur, geçersizse null", () => {
    expect(formatAccountJoinDate("1700000000000", "en")).toMatch(/2023/);
    expect(formatAccountJoinDate("Tue, 14 Nov 2023 22:13:20 GMT", "en")).toMatch(/2023/);
    expect(formatAccountJoinDate("abc", "en")).toBeNull();
    expect(formatAccountJoinDate(null, "en")).toBeNull();
  });
});
