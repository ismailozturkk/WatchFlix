// __tests__/streakFlame.test.js
//
// HAFTALIK seri ALEVİ (11 Kas): haftada 2 farklı gün = başarılı hafta, profilde
// adın yanında yanan alev. Kademe (utils/streakFlame.js):
//   RENK her 4 haftada · KIVILCIM biçimi her hafta · İHTİŞAM bu haftanın günleri (1..7)
// Haftalık kurallar (esnek hafta, kalkan, mola) __tests__/streakWeekly.test.js'te.

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
jest.mock("../components/SwitchToggle", () => ({ __esModule: true, default: "SwitchToggle" }));
jest.mock("../components/streak/StreakFlameSheet", () => ({ __esModule: true, default: "StreakFlameSheet" }));
jest.mock("../components/common/BottomSheetModal", () => ({ __esModule: true, default: "BottomSheetModal" }));
jest.mock("../components/common/GlassTouchable", () => ({ __esModule: true, default: "GlassTouchable" }));
jest.mock("../components/common/SheetScroll", () => ({ __esModule: true, default: "SheetScroll" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
let mockMotion = true;
jest.mock("../components/streak/useStreakFlameMotion", () => ({ __esModule: true, default: () => mockMotion }));
jest.mock("../hooks/useScreenFocused", () => ({ __esModule: true, default: () => true }));
const mockActions = { takeBreak: jest.fn(), breakBusy: false, reminderOn: true, toggleReminder: jest.fn() };
jest.mock("../hooks/useStreakActions", () => ({ __esModule: true, default: () => mockActions }));

const {
  STREAK_MONTHS,
  MAX_TIER,
  RAINBOW_WEEK,
  SPARK_SHAPES,
  streakLevel,
  nextStreakMilestones,
  streakLook,
  dayStage,
  lookHasEffect,
  streakFlameState,
  streakCelebrationStep,
} = require("../utils/streakFlame");
const { getStreakFlameCopy, streakLevelText } = require("../utils/streakFlameCopy");
const { default: StreakFlame } = require("../components/streak/StreakFlame");
const { default: StreakFlameBadge } = require("../components/streak/StreakFlameBadge");
const Flame = StreakFlame.type || StreakFlame;
const { default: StreakFlameSheet } = jest.requireActual("../components/streak/StreakFlameSheet");

global.IS_REACT_ACT_ENVIRONMENT = true;

// `seriler.alev` (utils/streakWeekly alevHesapla biçimi).
const alev = (seri, ek = {}) => {
  const gun = ek.buHaftaGun ?? 2;
  return {
    alev: {
      seri,
      rekor: seri,
      buHaftaGun: gun,
      buHaftaKutulari: Array.from({ length: 7 }, (_, i) => i < gun),
      buHaftaBasarili: gun >= 2,
      bugunAktif: gun > 0,
      bekleyen: null,
      kalkan: 0,
      kalkanTavani: 3,
      kalkanaKalan: 4,
      mola: { aktif: false, buHafta: false, hakVar: true, gecenHafta: false },
      sonYama: null,
      esik: 2,
      telafiEsigi: 4,
      ...ek,
    },
  };
};
const bekleyen = (ek = {}) => ({ hafta: 0, gerekli: 4, mevcut: 1, kalkan: false, korunanSeri: 10, ...ek });

describe("kademe: renk 4 haftada, kıvılcım her hafta", () => {
  test("renk kademesi ve kıvılcım biçimi", () => {
    expect(streakLevel(1)).toMatchObject({ weeks: 1, tier: 0, weekInTier: 1, sparkStage: 0 });
    expect(streakLevel(4)).toMatchObject({ tier: 0, weekInTier: 4, sparkStage: 3 });
    expect(streakLevel(5)).toMatchObject({ tier: 1, weekInTier: 1, sparkStage: 0 });
    expect(streakLevel(49).tier).toBe(MAX_TIER);
    expect(streakLevel(500).tier).toBe(MAX_TIER);
    for (const bozuk of [-5, NaN, null, undefined, "x"]) expect(streakLevel(bozuk).weeks).toBe(0);
  });

  test("kıvılcım biçimi her hafta değişir", () => {
    for (let w = 1; w < 30; w++) {
      expect(streakLook(w + 1).spark.shape).not.toBe(streakLook(w).spark.shape);
    }
    expect(SPARK_SHAPES).toEqual(["ember", "star", "diamond", "flake"]);
  });

  test("palet: 1–4 turuncu, 5 kızıl … 49+ Efsane", () => {
    expect(streakLook(4).palette.id).toBe("orange");
    expect(streakLook(5).palette.id).toBe("crimson");
    expect(streakLook(49).palette.id).toBe("legendary");
    expect(STREAK_MONTHS).toHaveLength(MAX_TIER + 1);
  });

  test("sonraki renk kademesi", () => {
    expect(nextStreakMilestones(3)).toMatchObject({ tierAt: 5, weeksToTier: 2 });
    expect(nextStreakMilestones(5)).toMatchObject({ tierAt: 9, weeksToTier: 4 });
    expect(nextStreakMilestones(60)).toMatchObject({ tierAt: null, nextPalette: null });
  });

  test("ihtişam (gün): 1 tek alev … 7 yıldızlar; boy hiç küçülmeden büyür", () => {
    expect(dayStage(0)).toBe(1);
    expect(dayStage(9)).toBe(7);
    const look = (d) => streakLook(3, d);
    expect([1, 2, 3, 4].map((d) => look(d).layers)).toEqual([1, 2, 3, 3]);
    expect(look(3).effects).toEqual([]);
    expect(look(4).effects).toEqual(["sparks"]);
    expect(look(5).effects).toEqual(["sparks", "flurry"]);
    expect(look(6).effects).toEqual(["sparks", "flurry", "corona"]);
    expect(look(7).effects).toEqual(["sparks", "flurry", "corona", "sparkles"]);
    for (let d = 1; d < 7; d++) {
      expect(look(d + 1).growth).toBeGreaterThan(look(d).growth);
      expect(look(d + 1).heat).toBeGreaterThan(look(d).heat);
    }
  });

  test("gökkuşağı yalnız 52. haftadan sonra; mola gri ve efektsiz renk", () => {
    expect(lookHasEffect(streakLook(RAINBOW_WEEK - 1, 7), "rainbow")).toBe(false);
    expect(lookHasEffect(streakLook(RAINBOW_WEEK, 2), "rainbow")).toBe(true);
    const molada = streakLook(RAINBOW_WEEK, 1, { paused: true });
    expect(molada.palette.id).toBe("paused");
    expect(molada.paused).toBe(true);
    expect(lookHasEffect(molada, "rainbow")).toBe(false);
  });

  test("kıvılcım sayısı renk kademesiyle artar", () => {
    expect(streakLook(40, 4).spark.count).toBeGreaterThan(streakLook(1, 4).spark.count);
  });
});

describe("streakFlameState", () => {
  test("veri yok → görünmez", () => {
    expect(streakFlameState(null).visible).toBe(false);
    expect(streakFlameState({}).weeks).toBe(0);
    expect(streakFlameState(alev(0)).visible).toBe(false);
  });

  test("bu hafta kazanıldı: yanık", () => {
    const s = streakFlameState(alev(5, { buHaftaGun: 3 }));
    expect(s).toMatchObject({ visible: true, weeks: 5, status: "lit", dimmed: false });
    expect(s.week).toMatchObject({ days: 3, need: 2, won: true });
    expect(s.look.stage).toBe(3);
  });

  test("bu hafta henüz 2 gün yok → risk (sönük)", () => {
    expect(streakFlameState(alev(4, { buHaftaGun: 1 }))).toMatchObject({ status: "risk", dimmed: true });
  });

  test("geçen hafta kaçtı, kalkan yok → repair; sayı kurtarılacak seri", () => {
    const s = streakFlameState(alev(0, { buHaftaGun: 1, bekleyen: bekleyen() }));
    expect(s).toMatchObject({ visible: true, weeks: 10, status: "repair" });
    expect(s.protection).toMatchObject({ repairNeed: 4, repairHave: 1 });
  });

  test("kalkan var → shield; bu hafta kazanıldıysa kesin: lit, sayı +2, kalkan harcanmış", () => {
    const k = { bekleyen: bekleyen({ kalkan: true }), kalkan: 2 };
    expect(streakFlameState(alev(0, { ...k, buHaftaGun: 1 })).status).toBe("shield");
    const s = streakFlameState(alev(0, { ...k, buHaftaGun: 2 }));
    expect(s).toMatchObject({ status: "lit", weeks: 12, dimmed: false });
    expect(s.protection.shields).toBe(1);
  });

  test("mola aktif → paused (gri), seri sayısı korunur", () => {
    const s = streakFlameState(alev(7, { buHaftaGun: 0, mola: { aktif: true, buHafta: true, hakVar: false } }));
    expect(s).toMatchObject({ visible: true, weeks: 7, status: "paused", paused: true });
    expect(s.look.palette.id).toBe("paused");
    expect(s.protection.canBreak).toBe(false);
  });

  test("rekor", () => {
    expect(streakFlameState(alev(8, { rekor: 40 })).record).toBe(40);
    expect(streakFlameState(alev(50, { rekor: 3 })).record).toBe(50);
  });
});

describe("kutlama adımı", () => {
  const v2 = (seviye, yama = "") => ({ v: 2, seviye, yama });

  test("eski (günlük) kayıt sessizce benimsenir", () => {
    const r = streakCelebrationStep({ seviye: 9, yama: "" }, alev(3));
    expect(r.celebrate).toBeNull();
    expect(r.store).toEqual(v2(3));
  });

  test("hiç kayıt yokken alev yanarsa ilk yanış kutlanır", () => {
    expect(streakCelebrationStep(null, alev(1)).celebrate.kind).toBe("lit");
    expect(streakCelebrationStep(null, alev(0)).celebrate).toBeNull();
  });

  test("yeni hafta / yeni renk / ilk yanış", () => {
    expect(streakCelebrationStep(v2(-1), alev(1)).celebrate.kind).toBe("lit");
    expect(streakCelebrationStep(v2(1), alev(2)).celebrate.kind).toBe("week");
    expect(streakCelebrationStep(v2(4), alev(5)).celebrate.kind).toBe("tier");
    expect(streakCelebrationStep(v2(3), alev(3))).toEqual({ celebrate: null, patch: null, store: null });
  });

  test("telafi/kalkan bir kez duyurulur", () => {
    const s = alev(6, { sonYama: { hafta: 1, gun: "2026-11-02", tur: "telafi" } });
    const r = streakCelebrationStep(v2(6), s);
    expect(r.patch).toMatchObject({ tur: "telafi", gun: "2026-11-02" });
    expect(streakCelebrationStep(r.store, s)).toEqual({ celebrate: null, patch: null, store: null });
  });
});

describe("metinler", () => {
  test("hafta metni", () => {
    expect(streakLevelText(getStreakFlameCopy("tr"), streakLevel(9))).toBe("9 hafta");
    expect(streakLevelText(getStreakFlameCopy("en"), streakLevel(1))).toBe("1 week");
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
const count = (root, type, pred = () => true) => root.findAllByType(type).filter(pred).length;
const STAR = "M10 0 C11";
// Alev katmanı yolları 100×128 kutusunda; kıvılcım/yıldız yolları "M10 0" ile başlar.
const flameLayers = (root) => count(root, "Path", (n) => !n.props.d.startsWith("M10 0"));
const sparkles = (root) => count(root, "Path", (n) => n.props.d.startsWith(STAR));
const rainbow = (root) => count(root, "Stop", (n) => n.props.stopColor === "#00E676");
const roundEmbers = (root) =>
  root.findAllByType("AnimatedView").filter((n) => [].concat(n.props.style).flat().some((s) => s && s.shadowRadius)).length;

describe("StreakFlame", () => {
  const draw = (weeks, days, props = {}) => render(<StreakFlame look={streakLook(weeks, days)} size={120} {...props} />);

  test("ihtişam katman sayısını belirler: 1 → 2 → 3; dinlenme pozu opak", () => {
    expect(flameLayers(draw(1, 1))).toBe(1);
    unmount();
    expect(flameLayers(draw(1, 2))).toBe(2);
    unmount();
    const root = draw(1, 3);
    expect(flameLayers(root)).toBe(3);
    const kok = root.findAllByType("View")[0];
    expect([].concat(kok.props.style).flat().find((s) => s && "opacity" in s).opacity).toBe(1);
  });

  test("4. gün kıvılcım, 5 uçuşan kıvılcımlar, 6 taç, 7 yıldızlar", () => {
    let root = draw(1, 4); // 1. hafta: yuvarlak kor kıvılcımı
    const kivilcim = roundEmbers(root);
    expect(kivilcim).toBeGreaterThan(0);
    unmount();
    root = draw(1, 5);
    expect(roundEmbers(root)).toBe(kivilcim + 6); // + 6 uçuşan minik kıvılcım
    unmount();
    root = draw(2, 5); // yıldız biçimli haftada da uçuşanlar yuvarlak kalır
    expect(roundEmbers(root)).toBe(6);
    unmount();
    root = draw(1, 6);
    expect(flameLayers(root)).toBe(4); // taç: arkada ikinci alev
    expect(sparkles(root)).toBe(0);
    unmount();
    expect(sparkles(draw(1, 7))).toBeGreaterThan(0);
  });

  test("kıvılcım biçimi haftaya göre: 2. hafta yıldız yolu çizer", () => {
    const root = draw(2, 4);
    expect(roundEmbers(root)).toBe(0);
    expect(sparkles(root)).toBeGreaterThan(0);
  });

  test("52. hafta gökkuşağı; hareket kapalıyken kıvılcım yok", () => {
    expect(rainbow(draw(RAINBOW_WEEK, 2))).toBeGreaterThan(0);
    unmount();
    expect(roundEmbers(draw(1, 7, { animated: false }))).toBe(0);
  });

  test("mola: gri ve efektsiz", () => {
    const root = render(<StreakFlame look={streakLook(RAINBOW_WEEK, 7, { paused: true })} size={120} dimmed />);
    expect([roundEmbers(root), sparkles(root), rainbow(root)]).toEqual([0, 0, 0]);
    expect(count(root, "RadialGradient")).toBe(0);
  });
});

describe("StreakFlameBadge", () => {
  const theme = { text: { primary: "#fff", secondary: "#bbb", muted: "#888" } };

  test("seri yokken hiçbir şey çizmez", () => {
    act(() => { renderer = create(<StreakFlameBadge seriler={alev(0)} theme={theme} language="tr" />); });
    expect(renderer.toJSON()).toBeNull();
  });

  test("önce hafta sayısı, sonra alev; erişilebilir ad", () => {
    const root = render(<StreakFlameBadge seriler={alev(12, { buHaftaGun: 4 })} theme={theme} language="tr" />);
    const pill = root.findByProps({ testID: "profile-streak-flame" });
    expect(pill.props.accessibilityLabel).toBe("12 haftalık izleme serisi, bu hafta kazanıldı. Ayrıntılar");
    expect(root.findAllByType("Text")[0].props.children).toBe("12");
    expect(root.findByType(Flame).props.look.effects).toEqual(["sparks"]);
    expect(root.findAllByType("Icon")).toHaveLength(0);
  });

  test("risk: sönük, ⌛ ve bu haftanın x/2 ilerlemesi", () => {
    const root = render(<StreakFlameBadge seriler={alev(6, { buHaftaGun: 1 })} theme={theme} language="tr" />);
    expect(root.findByType(Flame).props.dimmed).toBe(true);
    expect(root.findByType("Icon").props.name).toBe("hourglass");
    expect(root.findAllByType("Text").map((t) => t.props.children)).toEqual(["6", "1/2"]);
  });

  test("telafi: kurtarılacak seri, 🩹 ve x/4", () => {
    const root = render(<StreakFlameBadge seriler={alev(0, { buHaftaGun: 1, bekleyen: bekleyen() })} theme={theme} language="tr" />);
    expect(root.findAllByType("Text").map((t) => t.props.children)).toEqual(["10", "1/4"]);
    expect(root.findByType("Icon").props.name).toBe("bandage");
  });

  test("mola: ⏸", () => {
    const root = render(<StreakFlameBadge seriler={alev(3, { buHaftaGun: 0, mola: { aktif: true, buHafta: true, hakVar: false } })} theme={theme} language="tr" />);
    expect(root.findByType("Icon").props.name).toBe("pause-circle");
  });

  test("dokununca ayrıntı açılır; mola ve hatırlatıcı eylemleri sayfaya geçer", () => {
    const root = render(<StreakFlameBadge seriler={alev(9)} theme={theme} language="tr" />);
    act(() => root.findByProps({ testID: "profile-streak-flame" }).props.onPress());
    const sheet = root.findByType("StreakFlameSheet");
    expect(sheet.props.visible).toBe(true);
    expect(sheet.props.onTakeBreak).toBe(mockActions.takeBreak);
    expect(sheet.props.onToggleReminder).toBe(mockActions.toggleReminder);
    expect(root.findByType(Flame).props.animated).toBe(false);
  });
});

describe("StreakFlameSheet", () => {
  const theme = {
    secondary: "#1b1b1b", border: "#333", accent: "#38f",
    text: { primary: "#fff", secondary: "#bbb", muted: "#888" },
  };
  const metin = (root) => root.findAllByType("Text").map((n) => [].concat(n.props.children).join("")).join(" | ");
  const open = (s, props = {}, language = "tr") =>
    render(
      <StreakFlameSheet
        visible
        onClose={jest.fn()}
        state={streakFlameState(s)}
        theme={theme}
        language={language}
        onTakeBreak={jest.fn()}
        onToggleReminder={jest.fn()}
        {...props}
      />,
    );

  test("hafta, renk · kıvılcım, ihtişam, sonraki renk, rekor, 13 basamak", () => {
    const root = open(alev(6, { buHaftaGun: 3, rekor: 20 }));
    const t = metin(root);
    expect(t).toContain("haftalık seri");
    expect(t).toContain("Kızıl Alev · Yıldız kıvılcımı");
    expect(t).toContain("3/7 · Üç katman");
    expect(t).toContain("Pembe Alev için 3 hafta");
    expect(t).toContain("Rekorun: 20 hafta");
    expect(t).toContain("Bu haftayı kazandın (3/7 gün)");
    const alevler = root.findAllByType(Flame);
    expect(alevler).toHaveLength(1 + STREAK_MONTHS.length);
    expect(alevler.filter((a) => a.props.locked)).toHaveLength(MAX_TIER - 1);
  });

  test("risk ve telafi metinleri", () => {
    expect(metin(open(alev(2, { buHaftaGun: 1 })))).toContain("Bu hafta 1/2 gün");
    unmount();
    const t = metin(open(alev(0, { buHaftaGun: 2, bekleyen: bekleyen({ mevcut: 2 }) })));
    expect(t).toContain("bu hafta 4 farklı gün işaretle (2/4)");
    expect(t).toContain("Geçen haftayı mola say");
  });

  test("mola düğmesi bu haftaya mola verir; hak bittiyse düğme yok", () => {
    const onTakeBreak = jest.fn();
    let root = open(alev(4, { buHaftaGun: 1 }), { onTakeBreak });
    act(() => root.findByProps({ testID: "streak-break-button" }).props.onPress());
    expect(onTakeBreak).toHaveBeenCalled();
    unmount();
    root = open(alev(4, { mola: { aktif: false, buHafta: false, hakVar: false } }));
    expect(root.findAllByProps({ testID: "streak-break-button" })).toHaveLength(0);
    expect(metin(root)).toContain("Bu ayki molanı kullandın");
  });

  test("hatırlatıcı anahtarı", () => {
    const onToggleReminder = jest.fn();
    const root = open(alev(4), { reminderOn: false, onToggleReminder });
    const sw = root.findByProps({ testID: "streak-reminder-toggle" });
    expect(sw.props.value).toBe(false);
    act(() => sw.props.onValueChange(true));
    expect(onToggleReminder).toHaveBeenCalled();
  });

  test("bilgi paneli haftalık kuralları anlatır", () => {
    const root = open(alev(4));
    act(() => root.findByProps({ testID: "streak-info-toggle" }).props.onPress());
    const t = metin(root);
    expect(t).toContain("en az 2 farklı gün");
    expect(t).toContain("ertesi hafta 4 farklı gün");
    expect(t).toContain("Her 4 başarılı haftada 1 kalkan");
    expect(t).toContain("Her ay 1 hafta mola");
  });

  test("zirvede en yüksek renk metni, gradyan yok", () => {
    const root = open(alev(60), {}, "de");
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
  });

  test("kutlama ve hatırlatma uygulama genelinde koşar", () => {
    const src = oku("context", "WatchProgressContext.js");
    expect(src).toMatch(/useStreakCelebration\(deger\)/);
    expect(src).toMatch(/useStreakReminder\(deger\)/);
  });

  test("defter: haftalık alev, sunucu saati ve bulut eşitlemesi", () => {
    const src = oku("utils", "watchBadgeLedger.js");
    expect(src).toMatch(/alevIlerlet\(/);
    expect(src).toMatch(/streakBridge\.simdi\(\)/);
    expect(src).toMatch(/bulutaGonder\(uid/);
    expect(oku("App.js")).toMatch(/startStreakRuntime\(\)/);
  });
});
