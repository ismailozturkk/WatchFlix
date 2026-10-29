// __tests__/streakFlame.test.js
//
// Günlük seri ALEVİ: art arda 3+ gün işaretleyince profilde adın yanında yanan,
// 3 gün → 1 hafta → 1 ay → 100 gün → 1 yıl kademelerinde rengi değişip daha
// gösterişli olan alev (utils/streakFlame.js + components/streak/*).

import React from "react";
import fs from "fs";
import path from "path";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, flatten: (s) => s, absoluteFill: { position: "absolute" } },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
}));
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const AnimatedView = (props) => React.createElement("AnimatedView", props, props.children);
  return {
    __esModule: true,
    default: { View: AnimatedView, createAnimatedComponent: (C) => C },
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => fn(),
    withRepeat: (a) => a,
    withTiming: (v) => v,
    withSpring: (v) => v,
    withSequence: (...a) => a[a.length - 1],
    cancelAnimation: jest.fn(),
    Easing: { linear: (t) => t },
  };
});
jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: "Svg",
  Circle: "Circle",
  Defs: "Defs",
  LinearGradient: "SvgLinearGradient",
  Path: "Path",
  RadialGradient: "RadialGradient",
  Stop: "Stop",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/streak/StreakFlameSheet", () => ({ __esModule: true, default: "StreakFlameSheet" }));
jest.mock("../components/common/BottomSheetModal", () => ({ __esModule: true, default: "BottomSheetModal" }));
jest.mock("../components/common/GlassTouchable", () => ({ __esModule: true, default: "GlassTouchable" }));
jest.mock("../components/common/SheetScroll", () => ({ __esModule: true, default: "SheetScroll" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
let mockMotion = true;
jest.mock("../components/streak/useStreakFlameMotion", () => ({ __esModule: true, default: () => mockMotion }));

const {
  STREAK_MIN_DAYS,
  STREAK_TIERS,
  STREAK_TIER_IDS,
  streakTierFor,
  nextStreakTier,
  streakFlameGrowth,
  streakFlameState,
  streakTierById,
  tierHasEffect,
  streakCelebrationStep,
} = require("../utils/streakFlame");
const { STREAK_FLAME_COPY, getStreakFlameCopy } = require("../utils/streakFlameCopy");
const { default: StreakFlame } = require("../components/streak/StreakFlame");
const { default: StreakFlameBadge } = require("../components/streak/StreakFlameBadge");
// memo sarmalının içindeki gerçek bileşen (test ağacında bu tip görünür).
const Flame = StreakFlame.type || StreakFlame;
const { default: StreakFlameSheet } = jest.requireActual("../components/streak/StreakFlameSheet");

global.IS_REACT_ACT_ENVIRONMENT = true;

const seri = (gunSerisi, extra = {}) => ({
  gunSerisi,
  haftaSerisi: 1,
  rekorGun: gunSerisi,
  rekorHafta: 1,
  haftaKutulari: [true, true, true, false, false, false, false],
  bugunAktif: true,
  aktifGunSayisi: gunSerisi,
  ...extra,
});

describe("kademeler", () => {
  test("alev 3. günde yanar; altında kademe yok", () => {
    expect(STREAK_MIN_DAYS).toBe(3);
    for (const n of [0, 1, 2, -5, NaN, null, undefined, "x"]) expect(streakTierFor(n)).toBeNull();
    expect(streakTierFor(3).id).toBe("spark");
  });

  test("eşikler: 3 gün · 1 hafta · 1 ay · 100 gün · 1 yıl", () => {
    const beklenen = {
      3: "spark", 6: "spark",
      7: "week", 29: "week",
      30: "month", 99: "month",
      100: "century", 364: "century",
      365: "year", 1200: "year",
    };
    for (const [n, id] of Object.entries(beklenen)) expect(streakTierFor(Number(n)).id).toBe(id);
    expect(STREAK_TIERS.map((t) => t.min)).toEqual([3, 7, 30, 100, 365]);
  });

  test("her kademenin rengi farklı", () => {
    const renkler = STREAK_TIERS.map((t) => t.glow);
    expect(new Set(renkler).size).toBe(STREAK_TIERS.length);
    for (const t of STREAK_TIERS) {
      for (const k of ["outer", "mid", "core"]) {
        expect(t[k]).toHaveLength(2);
        t[k].forEach((c) => expect(c).toMatch(/^#[0-9A-F]{6}$/i));
      }
    }
  });

  test("efektler birikimli: üst kademe alttakilerin hepsini ve fazlasını taşır", () => {
    for (let i = 1; i < STREAK_TIERS.length; i++) {
      const once = STREAK_TIERS[i - 1].effects;
      const simdi = STREAK_TIERS[i].effects;
      expect(simdi).toEqual(expect.arrayContaining([...once]));
      expect(simdi.length).toBeGreaterThan(once.length);
    }
    expect(tierHasEffect(streakTierById("week"), "embers")).toBe(true);
    expect(tierHasEffect(streakTierById("spark"), "embers")).toBe(false);
    expect(tierHasEffect(streakTierById("year"), "rainbow")).toBe(true);
    expect(streakTierById("yok").id).toBe("spark");
  });

  test("sonraki kademe", () => {
    expect(nextStreakTier(0).id).toBe("spark");
    expect(nextStreakTier(3).id).toBe("week");
    expect(nextStreakTier(29).id).toBe("month");
    expect(nextStreakTier(365)).toBeNull();
  });
});

describe("alev her gün biraz büyür", () => {
  test("büyüme hiç düşmez (kademe atlayınca da) ve 0,78–1 aralığında kalır", () => {
    let once = 0;
    for (let n = 3; n <= 800; n++) {
      const g = streakFlameGrowth(n);
      expect(g).toBeGreaterThanOrEqual(once);
      expect(g).toBeGreaterThanOrEqual(0.78);
      expect(g).toBeLessThanOrEqual(1);
      once = g;
    }
    expect(streakFlameGrowth(4)).toBeGreaterThan(streakFlameGrowth(3));
    expect(streakFlameGrowth(8)).toBeGreaterThan(streakFlameGrowth(7));
    expect(streakFlameGrowth(365)).toBe(1);
  });
});

describe("streakFlameState", () => {
  test("veri yok / 3 günün altı → görünmez", () => {
    expect(streakFlameState(null).visible).toBe(false);
    expect(streakFlameState(seri(2)).visible).toBe(false);
    expect(streakFlameState(seri(2)).daysToNext).toBe(1);
  });

  test("bugün işaretlendi: yanık, risk yok; sonraki kademeye kalan gün ve ilerleme", () => {
    const s = streakFlameState(seri(5));
    expect(s).toMatchObject({ visible: true, days: 5, atRisk: false, litToday: true, daysToNext: 2 });
    expect(s.tier.id).toBe("spark");
    expect(s.next.id).toBe("week");
    expect(s.progress).toBeCloseTo(0.5, 3);
  });

  test("bugün henüz işaretleme yok → sönmek üzere (⌛)", () => {
    const s = streakFlameState(seri(12, { bugunAktif: false }));
    expect(s.visible).toBe(true);
    expect(s.atRisk).toBe(true);
  });

  test("zirvede sonraki yok, ilerleme dolu; rekor mevcut seriden küçük olamaz", () => {
    const s = streakFlameState(seri(400, { rekorGun: 10 }));
    expect(s.next).toBeNull();
    expect(s.progress).toBe(1);
    expect(s.record).toBe(400);
    expect(streakFlameState(seri(8, { rekorGun: 40 })).record).toBe(40);
  });
});

describe("kademe kutlaması", () => {
  test("ilk kez yanınca kıvılcım kutlanır, aynı kademede tekrar kutlanmaz", () => {
    const ilk = streakCelebrationStep(-1, seri(3));
    expect(ilk.store).toBe(0);
    expect(ilk.celebrate.tier.id).toBe("spark");
    expect(streakCelebrationStep(0, seri(6))).toEqual({ celebrate: null, store: null });
  });

  test("1 hafta ve 1 ay kutlanır", () => {
    expect(streakCelebrationStep(0, seri(7)).celebrate.tier.id).toBe("week");
    expect(streakCelebrationStep(1, seri(30)).celebrate.tier.id).toBe("month");
  });

  test("seri sönünce kayıt sessizce düşer, yeniden yanınca yine kutlanır", () => {
    expect(streakCelebrationStep(2, seri(0))).toEqual({ celebrate: null, store: -1 });
    expect(streakCelebrationStep(-1, seri(1))).toEqual({ celebrate: null, store: null });
    expect(streakCelebrationStep(-1, seri(3)).celebrate.tier.id).toBe("spark");
  });

  test("bozuk kayıt -1 sayılır", () => {
    expect(streakCelebrationStep("cop", seri(3)).store).toBe(0);
    expect(streakCelebrationStep(undefined, seri(0))).toEqual({ celebrate: null, store: null });
  });
});

describe("metinler", () => {
  test("her kademenin her dilde adı ve eşik etiketi var", () => {
    for (const [dil, tablo] of Object.entries(STREAK_FLAME_COPY)) {
      expect(Object.keys(tablo.tiers).sort()).toEqual([...STREAK_TIER_IDS].sort());
      expect(Object.keys(tablo.milestones).sort()).toEqual([...STREAK_TIER_IDS].sort());
      for (const id of STREAK_TIER_IDS) {
        expect(tablo.tiers[id].trim()).not.toBe("");
        expect(tablo.milestones[id].trim()).not.toBe("");
      }
      expect(tablo.celebrateTitle("X")).toContain("X");
      expect(dil).toMatch(/^(tr|en|es|pt|de)$/);
    }
    expect(getStreakFlameCopy("fr")).toBe(STREAK_FLAME_COPY.en);
  });
});

// ── Çizim ───────────────────────────────────────────────────────────────────

let renderer;
let errorSpy;
beforeEach(() => {
  mockMotion = true;
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
});

const render = (el) => {
  act(() => { renderer = create(el); });
  return renderer.root;
};
// Efekt katmanlarını çizdikleri SVG öğesinden tanı.
const count = (root, type, pred = () => true) => root.findAllByType(type).filter(pred).length;
const embers = (root) =>
  root.findAllByType("AnimatedView").filter((n) => [].concat(n.props.style).flat().some((s) => s && s.shadowRadius)).length;
const rainbow = (root) => count(root, "Stop", (n) => n.props.stopColor === "#00E676");
const halos = (root) => count(root, "Circle", (n) => n.props.fill === "none" && typeof n.props.stroke === "string" && !n.props.stroke.startsWith("url("));
const sparkles = (root) => count(root, "Path", (n) => n.props.d.startsWith("M10 0"));

describe("StreakFlame", () => {
  test("her kademe üç alev katmanı çizer ve dinlenme pozu görünür (opaklık 1)", () => {
    for (const id of STREAK_TIER_IDS) {
      const root = render(<StreakFlame tier={id} size={120} />);
      expect(count(root, "Path", (n) => !n.props.d.startsWith("M10 0"))).toBe(3);
      const kok = root.findAllByType("View")[0];
      expect([].concat(kok.props.style).flat().find((s) => s && "opacity" in s).opacity).toBe(1);
      act(() => renderer.unmount());
      renderer = null;
    }
  });

  test("kademe yükseldikçe efekt eklenir: kor → hale → pırıltı → gökkuşağı", () => {
    const r = (id) => render(<StreakFlame tier={id} size={120} />);
    let root = r("spark");
    expect([embers(root), halos(root), sparkles(root), rainbow(root)]).toEqual([0, 0, 0, 0]);
    act(() => renderer.unmount());
    root = r("week");
    expect([embers(root), halos(root), sparkles(root), rainbow(root)]).toEqual([5, 0, 0, 0]);
    act(() => renderer.unmount());
    root = r("month");
    expect([embers(root), halos(root), sparkles(root), rainbow(root)]).toEqual([5, 2, 0, 0]);
    act(() => renderer.unmount());
    root = r("century");
    expect([embers(root), halos(root), sparkles(root), rainbow(root)]).toEqual([5, 2, 4, 0]);
    act(() => renderer.unmount());
    root = r("year");
    expect([embers(root), halos(root), sparkles(root)]).toEqual([5, 2, 4]);
    expect(rainbow(root)).toBeGreaterThan(0);
  });

  test("küçük boyda efektler seyrek (2 kor, 2 pırıltı)", () => {
    const root = render(<StreakFlame tier="century" size={20} />);
    expect(embers(root)).toBe(2);
    expect(sparkles(root)).toBe(2);
  });

  test("hareket kapalıyken (Hareketi Azalt) korlar çizilmez; alev yine görünür", () => {
    const root = render(<StreakFlame tier="year" size={120} animated={false} />);
    expect(embers(root)).toBe(0);
    expect(count(root, "Path", (n) => !n.props.d.startsWith("M10 0"))).toBe(3);
  });

  test("kilitli kademe gri ve efektsiz", () => {
    const root = render(<StreakFlame tier="year" size={30} locked />);
    expect([embers(root), halos(root), sparkles(root), rainbow(root)]).toEqual([0, 0, 0, 0]);
    expect(count(root, "RadialGradient")).toBe(0);
  });
});

describe("StreakFlameBadge", () => {
  const theme = { text: { primary: "#fff", secondary: "#bbb", muted: "#888" } };

  test("3 günün altında hiçbir şey çizmez", () => {
    act(() => { renderer = create(<StreakFlameBadge seriler={seri(2)} theme={theme} language="tr" />); });
    expect(renderer.toJSON()).toBeNull();
  });

  test("önce sayı, sonra alev; erişilebilir ad seriyi söyler", () => {
    const root = render(<StreakFlameBadge seriler={seri(12)} theme={theme} language="tr" />);
    const pill = root.findByProps({ testID: "profile-streak-flame" });
    expect(pill.props.accessibilityLabel).toBe("12 günlük izleme serisi. Ayrıntılar");
    const cocuklar = pill.children.map((c) => (typeof c === "string" ? c : c.type));
    expect(cocuklar[0]).toBe("Text");
    expect(cocuklar[1]).toBe(Flame);
    expect(root.findByType("Text").props.children).toBe("12");
    expect(root.findByType(Flame).props.tier.id).toBe("week");
    expect(root.findAllByType("Icon")).toHaveLength(0);
  });

  test("bugün işaretleme yoksa alev solar ve ⌛ çıkar", () => {
    const root = render(<StreakFlameBadge seriler={seri(40, { bugunAktif: false })} theme={theme} language="en" />);
    expect(root.findByType(Flame).props.dimmed).toBe(true);
    expect(root.findByType("Icon").props.name).toBe("hourglass");
    expect(root.findByProps({ testID: "profile-streak-flame" }).props.accessibilityLabel).toMatch(/goes out/);
  });

  test("dokununca ayrıntı sayfası açılır ve rozetin alevi durur", () => {
    const root = render(<StreakFlameBadge seriler={seri(9)} theme={theme} language="tr" />);
    expect(root.findByType("StreakFlameSheet").props.visible).toBe(false);
    act(() => root.findByProps({ testID: "profile-streak-flame" }).props.onPress());
    expect(root.findByType("StreakFlameSheet").props.visible).toBe(true);
    expect(root.findByType(Flame).props.animated).toBe(false);
  });
});

describe("StreakFlameSheet", () => {
  const theme = {
    secondary: "#1b1b1b", border: "#333", accent: "#38f",
    text: { primary: "#fff", secondary: "#bbb", muted: "#888" },
  };
  const metin = (root) => root.findAllByType("Text").map((n) => [].concat(n.props.children).join("")).join(" | ");

  test("seri, kademe, sonraki kademeye kalan gün ve beş basamaklı merdiven", () => {
    const state = streakFlameState(seri(12, { rekorGun: 20 }));
    const root = render(<StreakFlameSheet visible onClose={jest.fn()} state={state} theme={theme} language="tr" />);
    const t = metin(root);
    expect(t).toContain("12");
    expect(t).toContain("Haftalık Alev");
    expect(t).toContain("Aylık Alev için 18 gün kaldı");
    expect(t).toContain("Rekorun: 20 gün");
    expect(t).toContain("Bugünü yaktın");
    // Büyük alev + 5 basamak; ulaşılmamış üç basamak kilitli.
    const alevler = root.findAllByType(Flame);
    expect(alevler).toHaveLength(6);
    expect(alevler.filter((a) => a.props.locked).map((a) => a.props.tier.id)).toEqual(["month", "century", "year"]);
  });

  test("sönmek üzereyken uyarı; zirvede 'en yüksek alev' metni", () => {
    let root = render(
      <StreakFlameSheet visible onClose={jest.fn()} state={streakFlameState(seri(5, { bugunAktif: false }))} theme={theme} language="en" />,
    );
    expect(metin(root)).toContain("You haven't logged anything today");
    act(() => renderer.unmount());
    root = render(<StreakFlameSheet visible onClose={jest.fn()} state={streakFlameState(seri(500))} theme={theme} language="de" />);
    expect(metin(root)).toContain("höchste Flamme");
    expect(root.findAllByType("LinearGradient")).toHaveLength(0);
  });
});

describe("bağlantılar (bekçi)", () => {
  const oku = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

  test("profil: alev adın yanında ve 'streak' bölümüyle gizlenebilir", () => {
    const src = oku("screens", "tabs", "ProfileScreen.js");
    expect(src).toMatch(/showSection\("streak"\)/);
    expect(src).toMatch(/nameAccessory=\{streakBadge\}/);
    expect(oku("components", "profile", "ProfileIdentityBlock.js")).toMatch(/\{nameAccessory\}/);
  });

  test("kademe kutlaması uygulama genelinde (profil açılmasa da) koşar", () => {
    expect(oku("context", "WatchProgressContext.js")).toMatch(/useStreakCelebration\(deger\)/);
  });
});
