// __tests__/streakFlame.test.js
//
// Günlük seri ALEVİ: art arda 3+ gün işaretleyince profilde adın yanında yanan alev.
// Kademe saat gibi iç içe üç sayaçtır (utils/streakFlame.js):
//   AY (her 30 gün) → renk · HAFTA (ay içinde 7·14·21·28) → efekt · GÜN → ısı + boy
// Koruma (telafi / kalkan) kararları __tests__/streakProtection.test.js'te.

import React from "react";
import fs from "fs";
import path from "path";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, flatten: (s) => s, absoluteFill: { position: "absolute" } },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
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
  STREAK_MONTHS,
  STREAK_MONTH_IDS,
  MAX_MONTH_TIER,
  streakLevel,
  nextStreakMilestones,
  streakLook,
  streakPalette,
  lookHasEffect,
  streakFlameGrowth,
  streakFlameState,
  streakCelebrationStep,
} = require("../utils/streakFlame");
const { STREAK_FLAME_COPY, getStreakFlameCopy, streakLevelText } = require("../utils/streakFlameCopy");
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
  kalkan: 0,
  telafiHazir: true,
  telafiYenilenme: 0,
  bekleyen: null,
  sonYama: null,
  ...extra,
});
const bekleyen = (ek = {}) => ({
  gun: "2026-07-14", telafi: true, kalkan: false, gerekli: 2, mevcut: 1, korunanSeri: 10, ...ek,
});

describe("iç içe kademe: ay · hafta · gün", () => {
  test("alev 3. günde yanar", () => {
    expect(STREAK_MIN_DAYS).toBe(3);
    expect(streakFlameState(seri(2)).visible).toBe(false);
    expect(streakFlameState(seri(3)).visible).toBe(true);
  });

  test("seri = ay + hafta + gün (47 = 1 ay 2 hafta 3 gün)", () => {
    const beklenen = {
      3: [0, 0, 3], 6: [0, 0, 6], 7: [0, 1, 0], 13: [0, 1, 6], 14: [0, 2, 0],
      28: [0, 4, 0], 29: [0, 4, 1], 30: [1, 0, 0], 47: [1, 2, 3], 365: [12, 0, 5],
    };
    for (const [n, [month, week, day]] of Object.entries(beklenen)) {
      expect(streakLevel(Number(n))).toMatchObject({ days: Number(n), month, week, day });
    }
    for (const bozuk of [-5, NaN, null, undefined, "x"]) expect(streakLevel(bozuk).days).toBe(0);
  });

  test("kademe indeksi hiç düşmez; her hafta ve ay kademesinde artar", () => {
    let once = streakLevel(3).index;
    for (let n = 4; n <= 800; n++) {
      const { index } = streakLevel(n);
      const r = n % 30;
      const yeniKademe = r === 0 || (r % 7 === 0 && r <= 28);
      if (yeniKademe) expect(index).toBe(once + 1);
      else expect(index).toBe(once);
      once = index;
    }
  });

  test("13 ay rengi, hepsi farklı; 12. aydan sonrası Efsane'de kalır", () => {
    expect(STREAK_MONTHS).toHaveLength(MAX_MONTH_TIER + 1);
    expect(new Set(STREAK_MONTHS.map((p) => p.glow)).size).toBe(STREAK_MONTHS.length);
    for (const p of STREAK_MONTHS) {
      for (const k of ["outer", "mid", "core"]) {
        expect(p[k]).toHaveLength(2);
        p[k].forEach((c) => expect(c).toMatch(/^#[0-9A-F]{6}$/i));
      }
    }
    expect(streakPalette(0).id).toBe("orange");
    expect(streakPalette(1).id).toBe("crimson");
    expect(streakPalette(40).id).toBe("legendary");
    expect(streakLook(29).palette.id).toBe("orange");
    expect(streakLook(30).palette.id).toBe("crimson");
  });

  test("hafta kademesi efekt ekler: kor → hale → yıldız → taç", () => {
    expect(streakLook(3).effects).toEqual([]);
    expect(streakLook(7).effects).toEqual(["embers"]);
    expect(streakLook(14).effects).toEqual(["embers", "halo"]);
    expect(streakLook(21).effects).toEqual(["embers", "halo", "sparkles"]);
    expect(streakLook(28).effects).toEqual(["embers", "halo", "sparkles", "corona"]);
    expect(streakLook(21).intensity).toBe(3);
  });

  test("yeni ayda efektler baştan sayılır ama yüksek aylar daha zengin başlar", () => {
    expect(streakLook(30).effects).toEqual(["embers"]);
    expect(streakLook(60).effects).toEqual(["embers", "halo"]);
    expect(streakLook(90).effects).toEqual(["embers", "halo", "sparkles"]);
    expect(streakLook(180).effects).toEqual(["embers", "halo", "sparkles", "corona"]);
    expect(streakLook(360).effects).toContain("rainbow");
    expect(lookHasEffect(streakLook(359), "rainbow")).toBe(false);
    // Aynı hafta kademesinde üst ay asla daha yoksul değildir.
    for (let ay = 1; ay <= MAX_MONTH_TIER; ay++) {
      for (let h = 0; h <= 4; h++) {
        const ust = streakLook(ay * 30 + h * 7).effects;
        expect(ust).toEqual(expect.arrayContaining(streakLook((ay - 1) * 30 + h * 7).effects));
      }
    }
  });

  test("gün kademesi: hafta içinde her gün alev daha harlı (ısı)", () => {
    for (let n = 7; n < 13; n++) expect(streakLook(n + 1).heat).toBeGreaterThan(streakLook(n).heat);
    // Yeni hafta: ısı yeni efektle baştan başlar.
    expect(streakLook(14).heat).toBeLessThan(streakLook(13).heat);
  });

  test("sonraki hafta ve ay kademesi", () => {
    expect(nextStreakMilestones(5)).toMatchObject({ weekAt: 7, daysToWeek: 2, monthAt: 30, daysToMonth: 25 });
    expect(nextStreakMilestones(5).nextPalette.id).toBe("crimson");
    // Ayın 28–29. günü: bu ayda yeni hafta yok, sıradaki ay.
    expect(nextStreakMilestones(29)).toMatchObject({ weekAt: null, daysToWeek: null, daysToMonth: 1 });
    expect(nextStreakMilestones(47)).toMatchObject({ weekAt: 51, daysToWeek: 4, monthAt: 60 });
    expect(nextStreakMilestones(400).nextPalette).toBeNull();
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
    expect(streakFlameGrowth(360)).toBe(1);
  });
});

describe("streakFlameState", () => {
  test("veri yok → görünmez", () => {
    expect(streakFlameState(null).visible).toBe(false);
    expect(streakFlameState(undefined).days).toBe(0);
  });

  test("bugün işaretlendi: yanık; ay içi ilerleme", () => {
    const s = streakFlameState(seri(5));
    expect(s).toMatchObject({ visible: true, days: 5, status: "lit", litToday: true, dimmed: false });
    expect(s.monthProgress).toBeCloseTo(5 / 30, 3);
  });

  test("bugün henüz işaretleme yok → risk (sönük)", () => {
    expect(streakFlameState(seri(12, { bugunAktif: false }))).toMatchObject({
      visible: true, status: "risk", dimmed: true,
    });
  });

  test("dün kaçtı + telafi hakkı → repair; gösterilen sayı KURTARILACAK seri", () => {
    const s = streakFlameState(seri(1, { bekleyen: bekleyen() }));
    expect(s).toMatchObject({ visible: true, days: 10, status: "repair", dimmed: true });
    expect(s.protection).toMatchObject({ repairNeed: 2, repairHave: 1 });
  });

  test("telafi hakkı yok ama kalkan var → shield", () => {
    const s = streakFlameState(seri(0, { bekleyen: bekleyen({ telafi: false, kalkan: true }), kalkan: 1 }));
    expect(s.status).toBe("shield");
    expect(s.protection.shields).toBe(1);
  });

  test("koruma alanları: kalkan tavanı, telafi bekleme süresi", () => {
    const s = streakFlameState(seri(40, { kalkan: 9, telafiHazir: false, telafiYenilenme: 3 }));
    expect(s.protection).toMatchObject({ shields: 2, shieldMax: 2, repairReady: false, repairIn: 3 });
  });

  test("rekor mevcut seriden küçük olamaz", () => {
    expect(streakFlameState(seri(400, { rekorGun: 10 })).record).toBe(400);
    expect(streakFlameState(seri(8, { rekorGun: 40 })).record).toBe(40);
  });
});

describe("kademe kutlaması", () => {
  test("ilk kez yanınca kutlanır, aynı kademede tekrar kutlanmaz", () => {
    const ilk = streakCelebrationStep(undefined, seri(3));
    expect(ilk.store).toEqual({ seviye: 0, yama: "" });
    expect(ilk.celebrate.kind).toBe("lit");
    expect(streakCelebrationStep({ seviye: 0, yama: "" }, seri(6))).toEqual({ celebrate: null, patch: null, store: null });
  });

  test("her hafta kademesi ve her ay kutlanır", () => {
    expect(streakCelebrationStep({ seviye: 0 }, seri(7)).celebrate.kind).toBe("week");
    expect(streakCelebrationStep({ seviye: 3 }, seri(28)).celebrate.kind).toBe("week");
    expect(streakCelebrationStep({ seviye: 4 }, seri(30)).celebrate.kind).toBe("month");
    expect(streakCelebrationStep({ seviye: 5 }, seri(37)).celebrate.kind).toBe("week");
    expect(streakCelebrationStep({ seviye: 9 }, seri(60)).celebrate.kind).toBe("month");
  });

  test("seri sönünce kayıt sessizce düşer, yeniden yanınca yine kutlanır", () => {
    expect(streakCelebrationStep({ seviye: 2, yama: "" }, seri(0))).toEqual({
      celebrate: null, patch: null, store: { seviye: -1, yama: "" },
    });
    expect(streakCelebrationStep({ seviye: -1, yama: "" }, seri(1)).store).toBeNull();
    expect(streakCelebrationStep({ seviye: -1, yama: "" }, seri(3)).celebrate.kind).toBe("lit");
  });

  test("telafi/kalkan bir kez bildirilir", () => {
    const s = seri(12, { sonYama: { gun: "2026-07-14", tur: "telafi" } });
    const r = streakCelebrationStep({ seviye: 1, yama: "" }, s);
    expect(r.celebrate).toBeNull();
    expect(r.patch).toMatchObject({ tur: "telafi", gun: "2026-07-14" });
    expect(r.store).toEqual({ seviye: 1, yama: "2026-07-14" });
    expect(streakCelebrationStep(r.store, s)).toEqual({ celebrate: null, patch: null, store: null });
  });

  test("bozuk kayıt -1 sayılır", () => {
    expect(streakCelebrationStep("cop", seri(3)).store).toEqual({ seviye: 0, yama: "" });
    expect(streakCelebrationStep(undefined, seri(0)).store).toBeNull();
  });
});

describe("metinler", () => {
  test("her dilde 13 ay rengi adı var", () => {
    for (const [dil, tablo] of Object.entries(STREAK_FLAME_COPY)) {
      expect(dil).toMatch(/^(tr|en|es|pt|de)$/);
      expect(Object.keys(tablo.palettes).sort()).toEqual([...STREAK_MONTH_IDS].sort());
      for (const id of STREAK_MONTH_IDS) expect(tablo.palettes[id].trim()).not.toBe("");
      expect(tablo.celebrate.monthTitle("X")).toContain("X");
      expect(tablo.status.repair(1, 2)).toContain("2");
    }
    expect(getStreakFlameCopy("fr")).toBe(STREAK_FLAME_COPY.en);
  });

  test("kademe metni sıfır parçaları atlar", () => {
    const tr = getStreakFlameCopy("tr");
    expect(streakLevelText(tr, streakLevel(47))).toBe("1 ay 2 hafta 3 gün");
    expect(streakLevelText(tr, streakLevel(30))).toBe("1 ay");
    expect(streakLevelText(tr, streakLevel(14))).toBe("2 hafta");
    expect(streakLevelText(getStreakFlameCopy("en"), streakLevel(38))).toBe("1 month 1 week 1 day");
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
const unmount = () => {
  act(() => renderer.unmount());
  renderer = null;
};
// Efekt katmanlarını çizdikleri SVG öğesinden tanı.
const count = (root, type, pred = () => true) => root.findAllByType(type).filter(pred).length;
const embers = (root) =>
  root.findAllByType("AnimatedView").filter((n) => [].concat(n.props.style).flat().some((s) => s && s.shadowRadius)).length;
const rainbow = (root) => count(root, "Stop", (n) => n.props.stopColor === "#00E676");
const halos = (root) => count(root, "Circle", (n) => n.props.fill === "none" && typeof n.props.stroke === "string" && !n.props.stroke.startsWith("url("));
const sparkles = (root) => count(root, "Path", (n) => n.props.d.startsWith("M10 0"));
const flameLayers = (root) => count(root, "Path", (n) => !n.props.d.startsWith("M10 0"));

describe("StreakFlame", () => {
  const draw = (days, props = {}) => render(<StreakFlame look={streakLook(days)} size={120} {...props} />);

  test("her ay rengi üç alev katmanı çizer ve dinlenme pozu görünür (opaklık 1)", () => {
    for (let ay = 0; ay <= MAX_MONTH_TIER; ay++) {
      const root = draw(ay * 30 + 3);
      expect(flameLayers(root)).toBeGreaterThanOrEqual(3);
      const kok = root.findAllByType("View")[0];
      expect([].concat(kok.props.style).flat().find((s) => s && "opacity" in s).opacity).toBe(1);
      unmount();
    }
  });

  test("hafta kademesiyle efekt eklenir: kor → hale → yıldız → taç; 12. ayda gökkuşağı", () => {
    const olc = (root) => [embers(root), halos(root), sparkles(root), flameLayers(root), rainbow(root)];
    expect(olc(draw(3))).toEqual([0, 0, 0, 3, 0]);
    unmount();
    expect(olc(draw(7))).toEqual([4, 0, 0, 3, 0]);
    unmount();
    expect(olc(draw(14))).toEqual([5, 2, 0, 3, 0]);
    unmount();
    expect(olc(draw(21))).toEqual([6, 2, 5, 3, 0]);
    unmount();
    // Taç: alevin arkasında ikinci, büyük alev (dördüncü katman).
    expect(olc(draw(28))).toEqual([7, 2, 6, 4, 0]);
    unmount();
    expect(rainbow(draw(360))).toBeGreaterThan(0);
  });

  test("küçük boyda efektler seyrek", () => {
    const root = draw(28, { size: 20 });
    expect(embers(root)).toBe(4);
    expect(sparkles(root)).toBe(2);
  });

  test("hareket kapalıyken (Hareketi Azalt) korlar çizilmez; alev yine görünür", () => {
    const root = draw(360, { animated: false });
    expect(embers(root)).toBe(0);
    expect(flameLayers(root)).toBeGreaterThanOrEqual(3);
  });

  test("kilitli kademe gri ve efektsiz", () => {
    const root = draw(360, { size: 30, locked: true });
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
    expect(root.findByType(Flame).props.look.effects).toEqual(["embers"]);
    expect(root.findAllByType("Icon")).toHaveLength(0);
  });

  test("bugün işaretleme yoksa alev solar ve ⌛ çıkar", () => {
    const root = render(<StreakFlameBadge seriler={seri(40, { bugunAktif: false })} theme={theme} language="en" />);
    expect(root.findByType(Flame).props.dimmed).toBe(true);
    expect(root.findByType("Icon").props.name).toBe("hourglass");
    expect(root.findByProps({ testID: "profile-streak-flame" }).props.accessibilityLabel).toMatch(/nothing logged today/);
  });

  test("telafi beklerken kurtarılacak seri ve 🩹 gösterilir", () => {
    const root = render(<StreakFlameBadge seriler={seri(1, { bekleyen: bekleyen() })} theme={theme} language="tr" />);
    expect(root.findByType("Text").props.children).toBe("10");
    expect(root.findByType("Icon").props.name).toBe("bandage");
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
  const open = (s, language = "tr") =>
    render(<StreakFlameSheet visible onClose={jest.fn()} state={streakFlameState(s)} theme={theme} language={language} />);

  test("seri, renk + kademe, sonraki hafta/ay, rekor ve 13 basamaklı ay merdiveni", () => {
    const root = open(seri(12, { rekorGun: 20 }));
    const t = metin(root);
    expect(t).toContain("12");
    expect(t).toContain("Turuncu Alev · 1 hafta 5 gün");
    expect(t).toContain("Yeni hafta kademesine 2 gün");
    expect(t).toContain("Kızıl Alev için 18 gün");
    expect(t).toContain("Rekorun: 20 gün");
    expect(t).toContain("Bugünü yaktın");
    // Büyük alev + 13 basamak; ulaşılmamış 12 ay kilitli.
    const alevler = root.findAllByType(Flame);
    expect(alevler).toHaveLength(1 + STREAK_MONTHS.length);
    expect(alevler.filter((a) => a.props.locked)).toHaveLength(MAX_MONTH_TIER);
  });

  test("koruma: telafi ilerlemesi, bekleme süresi ve kalkanlar", () => {
    let t = metin(open(seri(1, { bekleyen: bekleyen(), kalkan: 1 })));
    expect(t).toContain("bugün 2 içerik işaretle (1/2)");
    expect(t).toContain("Hazır");
    expect(t).toContain("1/2");
    unmount();
    t = metin(open(seri(20, { telafiHazir: false, telafiYenilenme: 3 })));
    expect(t).toContain("3 gün sonra");
    expect(t).toContain("0/2");
  });

  test("sönmek üzereyken uyarı; zirvede 'en yüksek renk' metni", () => {
    let root = open(seri(5, { bugunAktif: false }), "en");
    expect(metin(root)).toContain("You haven't logged anything today");
    unmount();
    root = open(seri(500), "de");
    expect(metin(root)).toContain("höchste Farbe");
    expect(root.findAllByType("LinearGradient")).toHaveLength(0);
  });
});

describe("bağlantılar (bekçi)", () => {
  const oku = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

  test("profil: alev kimlik rozetlerinin yanında ve 'streak' bölümüyle gizlenebilir", () => {
    const src = oku("screens", "tabs", "ProfileScreen.js");
    expect(src).toMatch(/showSection\("streak"\)/);
    expect(src).toMatch(/badgeAccessory=\{streakBadge\}/);
    expect(oku("components", "profile", "ProfileIdentityBlock.js")).toMatch(/trailing=\{badgeAccessory\}/);
    // Rozet yoksa (Free) satır yalnız aleviyle çizilir.
    expect(oku("components", "badges", "IdentityBadgesRow.js")).toMatch(/!badges\?\.length && !trailing/);
  });

  test("kademe kutlaması uygulama genelinde (profil açılmasa da) koşar", () => {
    expect(oku("context", "WatchProgressContext.js")).toMatch(/useStreakCelebration\(deger\)/);
  });

  test("defter mutabakatı seri korumasını işler ve 04:00 seri gününü kullanır", () => {
    const src = oku("utils", "watchBadgeLedger.js");
    expect(src).toMatch(/seriKorumasiniIlerlet\(/);
    expect(src).toMatch(/bugun: seriGunu/);
  });
});
