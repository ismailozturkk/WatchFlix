// hooks/useEmailVerification + hooks/useCooldown — profildeki "e-posta doğrulanmadı" uyarısı.
//   • odağa gelince ve uygulama öne dönünce user.reload(): doğrulandıysa uyarı kalkar (eskiden bayat
//     kalıyordu, kullanıcı doğruladığı hâlde "doğrulanmadı" görüyordu)
//   • tekrar gönder: 60 sn bekleme, bekleme sürerken ikinci istek gitmez, hata türüne göre metin
//   • zaten doğrulanmışsa e-posta gitmez; çok fazla deneme düğmeyi de kilitler

import React from "react";
import { act, create } from "react-test-renderer";

const mockFocusCallbacks = [];
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    useFocusEffect: (callback) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});
const mockAppStateListeners = [];
jest.mock("react-native", () => ({
  AppState: {
    addEventListener: (_event, listener) => {
      mockAppStateListeners.push(listener);
      return { remove: () => mockAppStateListeners.splice(mockAppStateListeners.indexOf(listener), 1) };
    },
  },
}));
jest.mock("@components/AppToast", () => ({ __esModule: true, default: { show: jest.fn() } }));
const mockSendVerification = jest.fn();
jest.mock("../services/authEmail", () => {
  const actual = jest.requireActual("../utils/authEmailCopy");
  return {
    sendVerificationEmail: (...args) => mockSendVerification(...args),
    authEmailErrorMessage: (error, language) => `ERR:${error.code}:${language}`,
    fillAuthEmailText: actual.fillAuthEmailText,
  };
});

const Toast = require("@components/AppToast").default;
const useEmailVerification = require("../hooks/useEmailVerification").default;
const useCooldown = require("../hooks/useCooldown").default;
const { AUTH_EMAIL_COPY } = require("../utils/authEmailCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let last;
function Probe({ user, language = "tr" }) {
  last = useEmailVerification(user, language);
  return null;
}
const mount = async (user, language) => {
  await act(async () => { renderer = create(React.createElement(Probe, { user, language })); });
};
const fakeUser = (over = {}) => ({
  email: "ada@example.com",
  emailVerified: false,
  reload: jest.fn(async () => {}),
  ...over,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockAppStateListeners.length = 0;
  mockSendVerification.mockResolvedValue({ sent: true, alreadyVerified: false });
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = null;
  jest.useRealTimers();
  console.error.mockRestore();
});

describe("tazeleme", () => {
  it("ekran odağa gelince kullanıcıyı tazeler; doğrulanmışsa uyarı kalkar ve bir kez bildirir", async () => {
    const user = fakeUser({
      reload: jest.fn(async function reload() { user.emailVerified = true; }),
    });
    await mount(user);
    expect(user.reload).toHaveBeenCalledTimes(1);
    expect(last.verified).toBe(true);
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "success", text1: AUTH_EMAIL_COPY.tr.nowVerified }));
  });

  it("doğrulanmamış kalırsa uyarı durur, bildirim yok", async () => {
    const user = fakeUser();
    await mount(user);
    expect(last.verified).toBe(false);
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("uygulama öne dönünce yeniden tazeler (kullanıcı bağlantıya e-posta uygulamasında tıkladı)", async () => {
    const user = fakeUser();
    await mount(user);
    expect(user.reload).toHaveBeenCalledTimes(1);
    user.reload.mockImplementation(async () => { user.emailVerified = true; });
    await act(async () => { mockAppStateListeners.forEach((listener) => listener("active")); });
    expect(user.reload).toHaveBeenCalledTimes(2);
    expect(last.verified).toBe(true);
  });

  it("arka plana geçişte tazelemez; zaten doğrulanmışta hiç ağa çıkmaz", async () => {
    const verified = fakeUser({ emailVerified: true });
    await mount(verified);
    await act(async () => { mockAppStateListeners.forEach((listener) => listener("active")); });
    expect(verified.reload).not.toHaveBeenCalled();

    await act(async () => renderer.unmount());
    const user = fakeUser();
    await mount(user);
    await act(async () => { mockAppStateListeners.forEach((listener) => listener("background")); });
    expect(user.reload).toHaveBeenCalledTimes(1); // yalnız odaktaki ilk tazeleme
  });

  it("çevrimdışı (reload düşer) sessizce geçer", async () => {
    const user = fakeUser({ reload: jest.fn(async () => { throw new Error("offline"); }) });
    await mount(user);
    expect(last.verified).toBe(false);
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("kullanıcı yoksa (çıkış anı) hiçbir şey yapmaz", async () => {
    await mount(null);
    expect(last.verified).toBe(false);
  });
});

describe("tekrar gönder", () => {
  it("gönderir, 60 sn bekletir; bekleme sürerken ikinci istek GİTMEZ", async () => {
    const user = fakeUser();
    await mount(user);
    expect(last.resendLabel).toBe(AUTH_EMAIL_COPY.tr.resendVerification);

    await act(async () => { await last.resend(); });
    expect(mockSendVerification).toHaveBeenCalledTimes(1);
    expect(mockSendVerification).toHaveBeenCalledWith(user, { language: "tr" });
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", text1: expect.stringContaining("ada@example.com") }),
    );
    expect(last.cooldown).toBe(60);
    expect(last.resendLabel).toBe(AUTH_EMAIL_COPY.tr.resendWait.replace("{n}", "60"));

    await act(async () => { await last.resend(); });
    expect(mockSendVerification).toHaveBeenCalledTimes(1);

    await act(async () => { jest.advanceTimersByTime(30000); });
    expect(last.cooldown).toBe(30);
    await act(async () => { jest.advanceTimersByTime(30000); });
    expect(last.cooldown).toBe(0);
    expect(last.resendLabel).toBe(AUTH_EMAIL_COPY.tr.resendVerification);

    await act(async () => { await last.resend(); });
    expect(mockSendVerification).toHaveBeenCalledTimes(2);
  });

  it("metinler uygulama dilinde", async () => {
    await mount(fakeUser(), "de");
    expect(last.resendLabel).toBe(AUTH_EMAIL_COPY.de.resendVerification);
    await act(async () => { await last.resend(); });
    expect(mockSendVerification).toHaveBeenCalledWith(expect.anything(), { language: "de" });
    expect(last.resendLabel).toBe(AUTH_EMAIL_COPY.de.resendWait.replace("{n}", "60"));
  });

  it("e-posta zaten doğrulanmışsa gönderilmez, bekleme başlamaz, uyarı kalkar", async () => {
    const user = fakeUser();
    await mount(user);
    mockSendVerification.mockResolvedValueOnce({ sent: false, alreadyVerified: true });
    user.emailVerified = true;
    await act(async () => { await last.resend(); });
    expect(last.cooldown).toBe(0);
    expect(last.verified).toBe(true);
  });

  it("hata: türüne göre metin gösterir; çevrimdışıda bekleme YOK, çok fazla denemede VAR", async () => {
    await mount(fakeUser());
    mockSendVerification.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "offline" }));
    await act(async () => { await last.resend(); });
    expect(Toast.show).toHaveBeenCalledWith({ type: "error", text1: "ERR:offline:tr" });
    expect(last.cooldown).toBe(0);

    mockSendVerification.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "too-many-requests" }));
    await act(async () => { await last.resend(); });
    expect(last.cooldown).toBe(60);
  });

  it("gönderim sürerken çift dokunuş tek istek üretir", async () => {
    await mount(fakeUser());
    let release;
    mockSendVerification.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ sent: true }); }));
    let first;
    await act(async () => { first = last.resend(); });
    expect(last.sending).toBe(true);
    await act(async () => { await last.resend(); });
    expect(mockSendVerification).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
    expect(last.sending).toBe(false);
  });
});

describe("useCooldown", () => {
  function Timer() {
    last = useCooldown();
    return null;
  }
  it("sayar, 0'da durur; yeniden başlatılabilir; unmount'ta zamanlayıcı kalmaz", async () => {
    await act(async () => { renderer = create(React.createElement(Timer)); });
    await act(async () => { last.start(3); });
    expect(last.remaining).toBe(3);
    expect(last.active).toBe(true);
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(last.remaining).toBe(0);
    expect(last.active).toBe(false);
    await act(async () => { last.start(0); });
    expect(last.remaining).toBe(0);
    // Unmount: çalışan aralık temizlenmeli (sızan zamanlayıcı kalmamalı).
    const setSpy = jest.spyOn(global, "setInterval");
    const clearSpy = jest.spyOn(global, "clearInterval");
    await act(async () => { last.start(5); });
    const intervalId = setSpy.mock.results[0].value;
    await act(async () => renderer.unmount());
    renderer = null;
    expect(clearSpy).toHaveBeenCalledWith(intervalId);
  });
});
