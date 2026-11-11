// services/devLab.js — Geliştirici Laboratuvarı'nın seri simülatörü.
import {
  DEV_STREAK_MAX_DAYS,
  buildDevSeriler,
  getDevStreak,
  resetDevLab,
  setDevStreak,
} from "../services/devLab";
import { streakFlameState } from "../utils/streakFlame";
import { TOURNAMENT_DEV_PRESETS, findTournamentDevPreset } from "../utils/tournamentDevPresets";
import { DEV_BADGE_CELEBRATIONS } from "../utils/devLabSamples";
import { baslikOdulu } from "../components/badges/badgeMeta";

const realDev = global.__DEV__;
afterEach(() => {
  global.__DEV__ = realDev;
  resetDevLab();
});

describe("devLab seri simülatörü", () => {
  test("ayar sınırlara kırpılır, varsayılan kapalı", () => {
    global.__DEV__ = true;
    expect(getDevStreak().enabled).toBe(false);
    setDevStreak({ enabled: true, weeks: 5000, weekDays: 12, shields: 9, status: "bozuk", repairHave: 7 });
    const s = getDevStreak();
    expect(s).toMatchObject({ enabled: true, weeks: DEV_STREAK_MAX_DAYS, weekDays: 7, shields: 3, status: "lit", repairHave: 3 });
    setDevStreak((p) => ({ weeks: p.weeks - 2000 }));
    expect(getDevStreak().weeks).toBe(0);
  });

  test("release'de yazma yok sayılır, okuma kapalı döner", () => {
    global.__DEV__ = true;
    setDevStreak({ enabled: true, weeks: 40 });
    global.__DEV__ = false;
    expect(getDevStreak().enabled).toBe(false);
    setDevStreak({ enabled: true, weeks: 99 });
    global.__DEV__ = true;
    expect(getDevStreak().weeks).toBe(40); // release yazması etki etmedi
  });

  test("sahte seri, profildeki alevle aynı hesaptan geçer (her durum)", () => {
    const lit = streakFlameState(buildDevSeriler({ weeks: 6, status: "lit", shields: 1 }));
    expect(lit).toMatchObject({ visible: true, weeks: 6, status: "lit" });
    expect(lit.level.tier).toBe(1);

    const risk = streakFlameState(buildDevSeriler({ weeks: 10, status: "risk" }));
    expect(risk).toMatchObject({ weeks: 10, status: "risk", dimmed: true });

    const repair = streakFlameState(buildDevSeriler({ weeks: 20, status: "repair", repairHave: 2 }));
    expect(repair).toMatchObject({ weeks: 20, status: "repair" });
    expect(repair.protection.repairHave).toBe(2);

    const shield = streakFlameState(buildDevSeriler({ weeks: 15, status: "shield", shields: 0 }));
    expect(shield).toMatchObject({ weeks: 15, status: "shield" });

    const paused = streakFlameState(buildDevSeriler({ weeks: 8, status: "paused" }));
    expect(paused).toMatchObject({ weeks: 8, status: "paused", paused: true });

    expect(streakFlameState(buildDevSeriler({ weeks: 0 })).visible).toBe(false);
    expect(streakFlameState(buildDevSeriler({ weeks: 5, record: 100 })).record).toBe(100);
  });
});

describe("turnuva dev ön ayarları", () => {
  test("seçimden sonuca sıralı, 'Gerçek' saati bırakır", () => {
    expect(TOURNAMENT_DEV_PRESETS[0]).toMatchObject({ key: "real", offset: null });
    const offsets = TOURNAMENT_DEV_PRESETS.slice(1).map((p) => p.offset);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    expect(findTournamentDevPreset("final")).toMatchObject({ tab: 4 });
    expect(findTournamentDevPreset("yok")).toBeNull();
  });
});

describe("rozet kutlaması örnekleri", () => {
  test("her örnek gerçek bir kutlamaya çözülür (sessiz kalan düğme yok)", () => {
    for (const sample of DEV_BADGE_CELEBRATIONS) {
      const k = sample.kutlama();
      const ok = Boolean(baslikOdulu(k.rozetler, "tr")) || k.perdeAtladi || k.makaraAtladi;
      expect([sample.label, ok]).toEqual([sample.label, true]);
    }
  });

  test("nadirlik örnekleri doğru nadirliği, '3 birden' en nadiri + ek sayıyı gösterir", () => {
    const efsanevi = DEV_BADGE_CELEBRATIONS.find((s) => s.label === "Efsanevi").kutlama();
    expect(baslikOdulu(efsanevi.rozetler, "tr").gorunum.rarity).toBe("legendary");
    const uc = baslikOdulu(DEV_BADGE_CELEBRATIONS.find((s) => s.label === "3 birden (+2)").kutlama().rozetler, "tr");
    expect(uc).toMatchObject({ ek: 2, gorunum: { rarity: "legendary" } });
  });
});
