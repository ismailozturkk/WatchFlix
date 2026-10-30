// __tests__/chainShareMessage.test.js
//
// Film Zinciri meydan okuması: sohbet şeması (utils/chatShare: chainShare) ve kart (components/chat/
// SharedChainMessage). Ana kural: kart bulmacayı ve SAYILARI taşır, zincirin halkalarını ASLA (spoiler).

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  PixelRatio: { get: () => 2 },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: ({ children, ...props }) => require("react").createElement("Gradient", props, children) }));
jest.mock("../components/common/GlassPressable", () => ({
  __esModule: true,
  default: ({ children, style, ...props }) => require("react").createElement("Press", props, children),
}));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u2" } }) }));
let mockAllowed = true;
const mockUpsell = jest.fn();
jest.mock("../hooks/usePremiumGate", () => ({
  usePremiumGate: (id) => ({ allows: () => (id === "film_chain" ? mockAllowed : true), showUpsell: mockUpsell }),
}));

const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, set } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const {
  SHARE_KIND,
  buildChainShare,
  buildShareMessage,
  chainSharePoints,
  sanitizeShare,
  sharePreview,
  shareMessageText,
  shareThumb,
} = require("../utils/chatShare");
const { replyGlyph } = require("../utils/chatReply");
const { FILM_CHAIN_PUZZLES } = require("../data/filmChainPuzzles");
const { chainPoints } = require("../utils/filmChain");
const { FILM_CHAIN_COPY } = require("../utils/filmChainCopy");
const SharedChainMessage = require("../components/chat/SharedChainMessage").default;

global.IS_REACT_ACT_ENVIRONMENT = true;
const copy = FILM_CHAIN_COPY.tr;
const real = FILM_CHAIN_PUZZLES[0];
const daily = { ...real, number: 4, dayKey: "2026-11-02" };

describe("şema", () => {
  test("günlük sonuç: bulmaca + sayılar + puan; çözüm zinciri gövdede yok", () => {
    const share = buildChainShare({ puzzle: daily, links: 3, mode: "daily", host: "Ali" });
    expect(share).toEqual({
      v: 1,
      type: "chain",
      puzzleId: real.id,
      mode: "daily",
      dayKey: "2026-11-02",
      number: 4,
      start: { id: real.start.id, name: real.start.name, profilePath: real.start.profilePath },
      target: { id: real.target.id, name: real.target.name, profilePath: real.target.profilePath },
      par: real.par,
      links: 3,
      gaveUp: false,
      points: chainPoints(3, real.par),
      host: "Ali",
    });
    const body = JSON.stringify(share);
    real.solution.slice(1, -1).forEach((node) => expect(body).not.toContain(node.name || node.title));
  });

  test("serbest modda gün/numara taşınmaz; pes etmek 0 puan", () => {
    const share = buildChainShare({ puzzle: daily, links: 5, gaveUp: true, mode: "free" });
    expect(share).toMatchObject({ mode: "free", links: 0, gaveUp: true, points: 0 });
    expect(share.number).toBeUndefined();
    expect(share.dayKey).toBeUndefined();
    expect(share.host).toBeUndefined();
  });

  test("puan gönderenden alınmaz, yeniden hesaplanır; çekirdekle birebir", () => {
    expect(sanitizeShare({ ...buildChainShare({ puzzle: real, links: 2 }), points: 999 }).points).toBe(chainPoints(2, real.par));
    for (let par = 1; par <= 6; par += 1) {
      for (let links = 0; links <= 6; links += 1) {
        expect(chainSharePoints(links, par, false)).toBe(chainPoints(links, par, false));
      }
      expect(chainSharePoints(3, par, true)).toBe(0);
    }
  });

  test.each([
    ["kimliksiz bulmaca", { puzzleId: "x" }],
    ["aynı başlangıç/hedef", { target: real.start }],
    ["geçersiz par", { par: 0 }],
    ["fazla halka", { links: 7 }],
    ["halkasız çözüm", { links: 0 }],
    ["adsız kişi", { start: { id: 5, name: "" } }],
  ])("bozuk gövde reddedilir: %s", (_, patch) => {
    const base = buildChainShare({ puzzle: real, links: 2 });
    expect(sanitizeShare({ ...base, ...patch })).toBeNull();
  });

  test("profil yolu yalnız TMDB biçiminde", () => {
    const share = sanitizeShare({
      ...buildChainShare({ puzzle: real, links: 2 }),
      start: { id: 9, name: "A", profilePath: "https://evil/x.jpg" },
    });
    expect(share.start.profilePath).toBeNull();
  });

  test("mesaj: tür, gelen kutusu satırı (rota + film sayısı), küçük resim yok, alıntı simgesi", () => {
    const message = buildShareMessage(buildChainShare({ puzzle: real, links: 2 }));
    expect(message.kind).toBe(SHARE_KIND.CHAIN);
    expect(message.kind).toBe("chainShare");
    expect(message.text.startsWith("🔗 ")).toBe(true);
    expect(message.text).toContain(real.start.name);
    expect(message.text).toContain(real.target.name);
    expect(message.text.endsWith("🎬🎬")).toBe(true);
    expect(sharePreview(message.share)).toContain("→");
    expect(shareThumb(message.share)).toBeNull();
    expect(shareMessageText(buildChainShare({ puzzle: real, gaveUp: true }))).not.toContain("🎬");
    expect(replyGlyph("chain")).toBe("git-network");
  });
});

describe("kart", () => {
  let renderer;
  let errorSpy;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    __resetStores();
    __resetAllMMKV();
    __resetStoreCaches();
    mockNavigate.mockClear();
    mockUpsell.mockClear();
    mockAllowed = true;
    const original = console.error;
    errorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
      if (String(message).includes("react-test-renderer is deprecated")) return;
      original(message, ...args);
    });
  });
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = null;
    errorSpy.mockRestore();
    jest.useRealTimers();
  });

  const mount = (share, isOutgoing = false) => {
    act(() => {
      renderer = create(<SharedChainMessage share={share} isOutgoing={isOutgoing} />);
    });
  };
  const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
  const has = (value) => texts().includes(value);
  const playButton = () => renderer.root.findAllByType("Press")[0];

  test("gelen + oynanmamış: rota, en kısa, gönderenin sonucu ve 'Zinciri kur'", () => {
    const share = sanitizeShare(buildChainShare({ puzzle: daily, links: 3, mode: "daily", host: "Ali" }));
    mount(share);
    expect(has(copy.chatInvite("Ali"))).toBe(true);
    expect(has(`${copy.title.toLocaleUpperCase()} · #4`)).toBe(true);
    expect(has(real.start.name)).toBe(true);
    expect(has(real.target.name)).toBe(true);
    expect(has(`${copy.statPar} ${real.par}`)).toBe(true);
    expect(has(String(share.points))).toBe(true);
    expect(has(copy.chatHostSolved(3, 4))).toBe(true);
    expect(has(copy.chatPlay)).toBe(true);
    // Zincirin ara halkaları kartta yok.
    real.solution.slice(1, -1).forEach((node) => expect(has(node.name || node.title)).toBe(false));
  });

  test("bugünün günlüğü → günlük modda açar; eski gün ya da serbest → o bulmaca serbest modda", () => {
    mount(sanitizeShare(buildChainShare({ puzzle: daily, links: 3, mode: "daily" })));
    act(() => playButton().props.onPress());
    expect(mockNavigate).toHaveBeenLastCalledWith("FilmChainScreen", { mode: "daily" });
    act(() => renderer.unmount());
    mount(sanitizeShare(buildChainShare({ puzzle: { ...daily, dayKey: "2026-10-31" }, links: 3, mode: "daily" })));
    act(() => playButton().props.onPress());
    expect(mockNavigate).toHaveBeenLastCalledWith("FilmChainScreen", { mode: "free", puzzleId: real.id });
  });

  test("Free alıcı kartı ve sonucu görür; 'Zinciri kur' Premium etiketli, yükseltme açar, ekrana gitmez", () => {
    mockAllowed = false;
    mount(sanitizeShare(buildChainShare({ puzzle: real, links: 2, host: "Ali" })));
    expect(has(copy.chatHostSolved(2, 3))).toBe(true);
    expect(has("Premium")).toBe(true);
    act(() => playButton().props.onPress());
    expect(mockUpsell).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("alıcı oynadıysa: iki puan yan yana ve karar", () => {
    set(Keys.filmChain, { plays: 1, solved: 1, results: { [real.id]: { links: real.par, points: 100, gaveUp: false } } }, { uid: "u2" });
    mount(sanitizeShare(buildChainShare({ puzzle: real, links: real.par + 1, host: "Ali" })));
    expect(has(copy.chatYou)).toBe(true);
    expect(has("Ali")).toBe(true);
    expect(has(copy.chatWin)).toBe(true);
    expect(has(copy.chatPlay)).toBe(false);
  });

  test("berabere ve geride kalma", () => {
    set(Keys.filmChain, { results: { [real.id]: { links: 0, points: 0, gaveUp: true } } }, { uid: "u2" });
    mount(sanitizeShare(buildChainShare({ puzzle: real, links: real.par })));
    expect(has(copy.chatLose)).toBe(true);
    expect(has(copy.chatMineGaveUp)).toBe(true);
    act(() => renderer.unmount());
    set(Keys.filmChain, { results: { [real.id]: { links: real.par, points: 100, gaveUp: false } } }, { uid: "u2" });
    mount(sanitizeShare(buildChainShare({ puzzle: real, links: real.par })));
    expect(has(copy.chatTie)).toBe(true);
  });

  test("giden kart eylemsiz; bu sürümde olmayan bulmacada güncelleme notu", () => {
    mount(sanitizeShare(buildChainShare({ puzzle: real, links: 2 })), true);
    expect(has(copy.chatWaiting)).toBe(true);
    expect(renderer.root.findAllByType("Press")).toHaveLength(0);
    act(() => renderer.unmount());
    mount(sanitizeShare(buildChainShare({ puzzle: { ...real, id: "999999-888888" }, links: 2 })));
    expect(has(copy.chatUnknown)).toBe(true);
    expect(renderer.root.findAllByType("Press")).toHaveLength(0);
  });
});
