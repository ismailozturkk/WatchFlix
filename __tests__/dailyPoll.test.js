// __tests__/dailyPoll.test.js
//
// Günün Sorusu: soru bankası bütünlüğü, günün sorusunun seçimi, yüzdeler, cihaz-yerel oy kaydı (saf çekirdek) +
// kart ve kanca (gerçek depo, taklit sunucu servisi).

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassPressable", () => mockHost("GlassPressable"));
jest.mock("../components/hub/HubCard", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children }) => React.createElement("Card", null, children),
    GlassPill: ({ text }) => React.createElement("Text", { testID: "pill" }, text),
    HubArrow: () => null,
    HubSendButton: () => null,
  };
});

const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: { DAILY_POLL_VOTED: "daily_poll_voted" },
  trackEvent: (...args) => mockTrack(...args),
}));
const mockHaptic = jest.fn();
jest.mock("../services/hapticsService", () => ({ triggerHaptic: (...args) => mockHaptic(...args) }));
let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
let mockUser = { uid: "u1" };
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));

const mockCast = jest.fn();
const mockCounts = jest.fn();
const mockMyVote = jest.fn();
jest.mock("../services/dailyPollService", () => ({
  castPollVote: (...args) => mockCast(...args),
  fetchPollCounts: (...args) => mockCounts(...args),
  fetchMyPollVote: (...args) => mockMyVote(...args),
}));

const fs = require("fs");
const path = require("path");
const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const { DAILY_POLL_QUESTIONS } = require("../data/dailyPollQuestions");
const {
  POLL_HISTORY_DAYS, POLL_MIN_VOTES_FOR_PERCENT, dayNumberOf, localizeQuestion, normalizePollHistory, pollShares,
  pollStreak, questionForDay, recordPollVote, toStoredPollHistory, withMyVote,
} = require("../utils/dailyPoll");
const { POLL_COPY } = require("../utils/dailyPollCopy");
const DailyPollWidget = require("../components/hub/DailyPollWidget").default;

global.IS_REACT_ACT_ENVIRONMENT = true;
const LANGS = ["tr", "en", "es", "pt", "de"];
const TODAY = "2026-10-21"; // TR günü (12:00 +03)

describe("soru bankası", () => {
  test("yeterli soru, kimlikler benzersiz ve kalıcı biçimde (küçük harf + alt çizgi)", () => {
    expect(DAILY_POLL_QUESTIONS.length).toBeGreaterThanOrEqual(30);
    const ids = DAILY_POLL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z][a-z0-9_]*$/));
  });

  test("her soru beş dilde [soru, A, B] dolu; seçenekler birbirinden farklı ve kısa", () => {
    for (const q of DAILY_POLL_QUESTIONS) {
      for (const lang of LANGS) {
        const entry = q[lang];
        expect(Array.isArray(entry) && entry.length === 3).toBe(true);
        const [prompt, a, b] = entry;
        [prompt, a, b].forEach((text) => {
          expect(typeof text).toBe("string");
          expect(text.trim()).toBe(text);
          expect(text.length).toBeGreaterThan(1);
        });
        expect(a).not.toBe(b);
        // Kartta iki satıra sığmalı (düğme metni).
        expect(a.length).toBeLessThanOrEqual(30);
        expect(b.length).toBeLessThanOrEqual(30);
        expect(prompt.length).toBeLessThanOrEqual(48);
      }
    }
  });

  test("beş dilde tekrar eden soru metni yok (kopyala-yapıştır hatasını yakalar)", () => {
    for (const lang of LANGS) {
      const prompts = DAILY_POLL_QUESTIONS.map((q) => q[lang][0]);
      expect(new Set(prompts).size).toBe(prompts.length);
    }
  });
});

describe("günün sorusu seçimi", () => {
  test("aynı gün → aynı soru; bütün bir döngüde her soru tam bir kez (tekrar yok)", () => {
    const seen = [];
    for (let i = 0; i < DAILY_POLL_QUESTIONS.length; i += 1) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      expect(questionForDay(day)).toBe(questionForDay(day));
      seen.push(questionForDay(day).id);
    }
    expect(new Set(seen).size).toBe(DAILY_POLL_QUESTIONS.length);
  });

  test("döngü başa sarar; ardışık günler farklı soru", () => {
    const n = DAILY_POLL_QUESTIONS.length;
    const dayAt = (i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    expect(questionForDay(dayAt(0)).id).toBe(questionForDay(dayAt(n)).id);
    expect(questionForDay(dayAt(3)).id).not.toBe(questionForDay(dayAt(4)).id);
    // 2026 öncesi (negatif gün numarası) da çalışır.
    expect(questionForDay("2025-06-01")).toBeTruthy();
  });

  test("geçersiz gün anahtarı → null", () => {
    expect(questionForDay("bugun")).toBeNull();
    expect(questionForDay(null)).toBeNull();
    expect(dayNumberOf("2026-01-01")).toBe(0);
    expect(dayNumberOf("2026-01-02")).toBe(1);
    expect(dayNumberOf("2025-12-31")).toBe(-1);
  });

  test("dil: seçilen dil, bilinmeyen dil İngilizce", () => {
    const q = DAILY_POLL_QUESTIONS[0];
    expect(localizeQuestion(q, "tr")).toEqual({ id: q.id, prompt: q.tr[0], a: q.tr[1], b: q.tr[2] });
    expect(localizeQuestion(q, "de").a).toBe(q.de[1]);
    expect(localizeQuestion(q, "zz").prompt).toBe(q.en[0]);
    expect(localizeQuestion(null, "tr")).toBeNull();
  });
});

describe("pollShares", () => {
  test("yüzdeler toplamı 100; eşik altında showPercent false", () => {
    expect(pollShares({ a: 0, b: 0 })).toBeNull();
    expect(pollShares(null)).toBeNull();
    const small = pollShares({ a: 2, b: 1 });
    expect(small).toMatchObject({ total: 3, showPercent: false });
    expect(small.percentA + small.percentB).toBe(100);
    const enough = pollShares({ a: 3, b: 2 });
    expect(enough).toMatchObject({ total: POLL_MIN_VOTES_FOR_PERCENT, showPercent: true, percentA: 60, percentB: 40 });
    const odd = pollShares({ a: 1, b: 2 + 5 });
    expect(odd.percentA + odd.percentB).toBe(100);
  });

  test("bozuk sayaç güvenli; benim oyum eklenir", () => {
    expect(pollShares({ a: "x", b: -4 })).toBeNull();
    expect(pollShares({ a: 7.9, b: 2 })).toMatchObject({ a: 7, b: 2 });
    expect(withMyVote({ a: 1, b: 1 }, "a")).toEqual({ a: 2, b: 1 });
    expect(withMyVote({ a: 1, b: 1 }, "b")).toEqual({ a: 1, b: 2 });
    expect(withMyVote(null, "a")).toEqual({ a: 1, b: 0 });
    expect(withMyVote({ a: 1, b: 1 }, "zz")).toEqual({ a: 1, b: 1 });
  });
});

describe("yerel oy kaydı", () => {
  test("bozuk kayıt güvenli; geçersiz gün ve seçim atılır; son 14 gün tutulur", () => {
    expect(normalizePollHistory(null)).toEqual({});
    expect(normalizePollHistory([])).toEqual({});
    expect(normalizePollHistory({ bozuk: { choice: "a" }, [TODAY]: { choice: "c" } })).toEqual({});
    expect(normalizePollHistory({ [TODAY]: { choice: "a", synced: "evet" } })).toEqual({ [TODAY]: { choice: "a", synced: false } });
    let history = {};
    for (let i = 0; i < 30; i += 1) {
      history = recordPollVote(history, new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), "a", true);
    }
    expect(Object.keys(history)).toHaveLength(POLL_HISTORY_DAYS);
  });

  test("ilk oy kalıcı: aynı gün ikinci kayıt seçimi DEĞİŞTİRMEZ, yalnız 'senkron' bayrağı yükselir", () => {
    const first = recordPollVote({}, TODAY, "a", false);
    expect(first[TODAY]).toEqual({ choice: "a", synced: false });
    expect(recordPollVote(first, TODAY, "b", false)).toBe(first); // değişmedi
    const synced = recordPollVote(first, TODAY, "b", true);
    expect(synced[TODAY]).toEqual({ choice: "a", synced: true });
    expect(recordPollVote(synced, TODAY, "a", false)).toBe(synced);
    expect(recordPollVote({}, "bozuk", "a")).toEqual({});
    expect(recordPollVote({}, TODAY, "x")).toEqual({});
  });

  test("seri: ardışık günler; bugün oy yoksa dünden geriye; boşluk seriyi böler", () => {
    const day = (d) => `2026-10-${String(d).padStart(2, "0")}`;
    const h = (days) => days.reduce((acc, d) => recordPollVote(acc, day(d), "a", true), {});
    expect(pollStreak(h([19, 20, 21]), day(21))).toBe(3);
    expect(pollStreak(h([19, 20]), day(21))).toBe(2); // bugün henüz oy yok
    expect(pollStreak(h([18, 20, 21]), day(21))).toBe(2); // 19 boş
    expect(pollStreak(h([]), day(21))).toBe(0);
    expect(pollStreak(h([30]), "bozuk")).toBe(0);
    // Ay sınırı
    expect(pollStreak({ "2026-09-30": { choice: "a", synced: true }, "2026-10-01": { choice: "b", synced: true } }, "2026-10-01")).toBe(2);
  });

  test("boş kayıtta null saklama", () => {
    expect(toStoredPollHistory({})).toBeNull();
    expect(toStoredPollHistory({ [TODAY]: { choice: "a", synced: true } })).toEqual({ [TODAY]: { choice: "a", synced: true } });
  });
});

describe("kart", () => {
  let renderer;
  let warn;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-21T12:00:00+03:00"));
    __resetStores();
    __resetAllMMKV();
    __resetStoreCaches();
    [mockTrack, mockHaptic, mockCast, mockCounts, mockMyVote].forEach((fn) => fn.mockReset());
    mockMyVote.mockResolvedValue(null);
    mockCounts.mockResolvedValue(null);
    mockLang = "tr";
    mockUser = { uid: "u1" };
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
    jest.useRealTimers();
  });

  const question = () => localizeQuestion(questionForDay(TODAY), mockLang);
  const mount = async () => { await act(async () => { renderer = create(<DailyPollWidget />); }); };
  const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
  const has = (value) => texts().includes(value);
  const optionButtons = () => renderer.root.findAllByType("GlassPressable");
  const stored = () => get(Keys.dailyPoll, { uid: "u1" });

  test("oy yokken soru ve iki seçenek görünür; sayaç OKUNMAZ (önyargı yok)", async () => {
    await mount();
    const q = question();
    expect(has(q.prompt)).toBe(true);
    expect(has(q.a)).toBe(true);
    expect(has(q.b)).toBe(true);
    expect(has(POLL_COPY.tr.hint)).toBe(true);
    expect(mockCounts).not.toHaveBeenCalled();
    expect(mockMyVote).toHaveBeenCalledWith("u1", TODAY); // başka cihazdaki oy sorulur
  });

  test("oy ver: yerel kayıt, transaction, sonuç yüzdeleri, seçim işaretli, ölçüm", async () => {
    mockCast.mockResolvedValue({ choice: "a", counts: { a: 7, b: 3 }, alreadyVoted: false });
    await mount();
    await act(async () => { optionButtons()[0].props.onPress(); });
    expect(mockCast).toHaveBeenCalledWith({ uid: "u1", dayKey: TODAY, choice: "a" });
    expect(stored()).toEqual({ [TODAY]: { choice: "a", synced: true } });
    expect(has("70%")).toBe(true);
    expect(has("30%")).toBe(true);
    expect(has(POLL_COPY.tr.votes(10))).toBe(true);
    expect(renderer.root.findAllByType("Icon").some((n) => n.props.name === "checkmark-circle")).toBe(true);
    expect(mockTrack).toHaveBeenCalledWith("daily_poll_voted", { question_id: question().id, synced: true, source: "hub" });
    expect(mockHaptic).toHaveBeenCalledWith("selection");
    // Oy verildikten sonra düğmeler kilitli: ikinci dokunuş yeni yazım başlatmaz.
    expect(optionButtons().every((n) => n.props.disabled)).toBe(true);
    expect(optionButtons().every((n) => n.props.glass === false)).toBe(true);
    expect(has(POLL_COPY.tr.youPicked)).toBe(true);
  });

  test("aynı karede çift dokunuş tek yazım başlatır; önceden senkron oyda sayaç yüklenirken sahte 'ilk oy' yanıp sönmez", async () => {
    let resolveCast;
    mockCast.mockImplementation(() => new Promise((r) => { resolveCast = r; }));
    await mount();
    act(() => {
      optionButtons()[0].props.onPress();
      optionButtons()[0].props.onPress();
    });
    expect(mockCast).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveCast({ choice: "a", counts: { a: 6, b: 4 }, alreadyVoted: false });
    });
    expect(has("60%")).toBe(true);

    act(() => renderer.unmount());
    renderer = null;
    let resolveCounts;
    mockCounts.mockImplementation(() => new Promise((r) => { resolveCounts = r; }));
    await mount();
    // Sayaç henüz gelmedi: "İlk oy verenlerdensin" yanıp sönmemeli.
    expect(texts().some((t) => t.includes(POLL_COPY.tr.firstVoter))).toBe(false);
    await act(async () => {
      resolveCounts({ a: 6, b: 4 });
    });
    expect(has("60%")).toBe(true);
  });

  test("az oy: yüzde yok, 'ilk oy verenlerdensin'; çok az değilse 'sonuçlar belirir'", async () => {
    mockCast.mockResolvedValue({ choice: "b", counts: { a: 0, b: 1 }, alreadyVoted: false });
    await mount();
    await act(async () => { optionButtons()[1].props.onPress(); });
    expect(texts().some((t) => t.includes("%"))).toBe(false);
    expect(texts().some((t) => t.includes(POLL_COPY.tr.firstVoter))).toBe(true);
    act(() => renderer.unmount());
    renderer = null;
    __resetStores();
    __resetAllMMKV();
    __resetStoreCaches();
    mockCast.mockResolvedValue({ choice: "a", counts: { a: 2, b: 1 }, alreadyVoted: false });
    await mount();
    await act(async () => { optionButtons()[0].props.onPress(); });
    expect(texts().some((t) => t.includes(POLL_COPY.tr.fewVotes))).toBe(true);
  });

  test("sunucu yazamazsa (çevrimdışı / kurallar yayında değil): oy yerelde kalır, 'beklemede' yazar, çökmez", async () => {
    mockCast.mockRejectedValue(new Error("permission-denied"));
    await mount();
    await act(async () => { optionButtons()[0].props.onPress(); });
    expect(stored()).toEqual({ [TODAY]: { choice: "a", synced: false } });
    expect(has(POLL_COPY.tr.pendingSync)).toBe(true);
    expect(mockTrack).toHaveBeenCalledWith("daily_poll_voted", expect.objectContaining({ synced: false }));
    expect(texts().some((t) => t.includes("%"))).toBe(false);
  });

  test("bekleyen oy sonraki açılışta TEK KEZ yeniden denenir ve başarılıysa senkronlanır", async () => {
    mockCast.mockRejectedValueOnce(new Error("ağ"));
    await mount();
    await act(async () => { optionButtons()[1].props.onPress(); });
    expect(mockCast).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
    renderer = null;

    mockCast.mockResolvedValue({ choice: "b", counts: { a: 4, b: 6 }, alreadyVoted: false });
    await mount();
    expect(mockCast).toHaveBeenCalledTimes(2); // yeniden deneme
    expect(mockCast).toHaveBeenLastCalledWith({ uid: "u1", dayKey: TODAY, choice: "b" });
    expect(stored()[TODAY]).toEqual({ choice: "b", synced: true });
    expect(has("60%")).toBe(true);
  });

  test("başka cihazdan verilmiş oy sunucudan geri gelir ve sonuçlar gösterilir", async () => {
    mockMyVote.mockResolvedValue("b");
    mockCounts.mockResolvedValue({ a: 10, b: 30 });
    await mount();
    expect(stored()).toEqual({ [TODAY]: { choice: "b", synced: true } });
    expect(has("25%")).toBe(true);
    expect(has("75%")).toBe(true);
  });

  test("zaten senkron oy: açılışta yalnız sayaç okunur, yeniden yazım YOK", async () => {
    mockCounts.mockResolvedValue({ a: 5, b: 5 });
    await act(async () => {
      require("../services/storage").set(Keys.dailyPoll, { [TODAY]: { choice: "a", synced: true } }, { uid: "u1" });
    });
    await mount();
    expect(mockCast).not.toHaveBeenCalled();
    expect(mockCounts).toHaveBeenCalledWith(TODAY);
    expect(has("50%")).toBe(true);
  });

  test("girişsiz kullanıcıda hiçbir şey yazılmaz; oy düğmeleri çizilir ama ağ çağrısı yok", async () => {
    mockUser = null;
    await mount();
    await act(async () => { optionButtons()[0].props.onPress(); });
    expect(mockCast).not.toHaveBeenCalled();
    expect(get(Keys.dailyPoll, { uid: "u1" })).toBeNull();
  });

  test("beş dilde soru ve metin çizilir", async () => {
    for (const lang of LANGS) {
      mockLang = lang;
      await mount();
      expect(has(question().prompt)).toBe(true);
      expect(has(POLL_COPY[lang].hint)).toBe(true);
      expect(texts().some((t) => /undefined|NaN/.test(t))).toBe(false);
      act(() => renderer.unmount());
      renderer = null;
    }
  });
});

describe("kaynak bekçileri", () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

  test("metin tablosundaki her anahtar kullanılıyor", () => {
    const used = read("components/hub/DailyPollWidget.js");
    const unused = Object.keys(POLL_COPY.tr).filter((key) => !new RegExp(`copy\\.${key}\\b`).test(used));
    expect(unused).toEqual([]);
  });

  test("kart Eğlence'ye bağlı; kural, koleksiyon adı ve servis aynı adı kullanır", () => {
    expect(read("screens/tabs/HubScreen.js")).toMatch(/show\("poll"\)/);
    expect(read("services/dailyPollService.js")).toMatch(/"DailyPolls"/);
    expect(read("firestore.rules")).toMatch(/match \/DailyPolls\/\{dayKey\}/);
    // Simge adı Ionicons'ta var mı: kart yalnız şunları kullanır.
    const glyphs = JSON.parse(read("node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"));
    ["help-circle", "flame", "checkmark-circle", "help-circle-outline"].forEach((name) => expect(glyphs[name]).toBeDefined());
  });
});
