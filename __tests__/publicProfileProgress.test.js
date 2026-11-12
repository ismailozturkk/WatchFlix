import { profileAvatarProgress } from "../utils/profileAvatarProgress";
import { publicStreakFromSeriler, readPublicStreak } from "../utils/publicStreak";
import { streakFlameState } from "../utils/streakFlame";

describe("shared avatar level", () => {
  it("moves the ring and palette together at each 10,080 minute boundary", () => {
    const before = profileAvatarProgress(10079);
    const after = profileAvatarProgress(10080);
    expect(before.rankLevel).toBe(0);
    expect(before.progress).toBe(99);
    expect(after.rankLevel).toBe(1);
    expect(after.progress).toBe(0);
    expect(after.borderColor).not.toBe(before.borderColor);
  });
});

describe("public streak projection", () => {
  const boxes = [true, false, true, false, false, false, false];
  const source = { alev: {
    seri: 3, rekor: 8, buHaftaGun: 2, buHaftaKutulari: boxes,
    buHaftaBasarili: true, bugunAktif: true, kalkan: 2,
    bekleyen: null, sonYama: { gun: "2026-11-01" },
  }, ozelGunler: ["2026-11-10"] };

  it("preserves the visible flame without publishing the private ledger", () => {
    const publicValue = publicStreakFromSeriler(source);
    expect(publicValue).toEqual({ v: 1, alev: {
      seri: 3, buHaftaGun: 2, buHaftaKutulari: boxes,
      buHaftaBasarili: true, bekleyen: null,
    } });
    const restored = readPublicStreak(publicValue);
    expect(streakFlameState(restored).weeks).toBe(streakFlameState(source).weeks);
    expect(streakFlameState(restored).week.boxes).toEqual(boxes);
  });

  it("keeps rescue status and clears an extinguished flame", () => {
    const pending = { alev: { ...source.alev, seri: 0, buHaftaBasarili: false,
      bekleyen: { korunanSeri: 4, kalkan: false, hafta: 123, gerekli: 4, mevcut: 1 } } };
    const restored = readPublicStreak(publicStreakFromSeriler(pending));
    expect(streakFlameState(restored).status).toBe("repair");
    expect(streakFlameState(restored).weeks).toBe(4);
    expect(publicStreakFromSeriler({ alev: { seri: 0 } })).toBeNull();
  });

  it("reflects risk and shield changes in the public view", () => {
    const risk = { alev: { ...source.alev, buHaftaBasarili: false, buHaftaGun: 1 } };
    const shield = { alev: { ...risk.alev,
      bekleyen: { korunanSeri: 3, kalkan: true, gerekli: 4, mevcut: 1 } } };
    expect(streakFlameState(readPublicStreak(publicStreakFromSeriler(risk))).status).toBe("risk");
    expect(streakFlameState(readPublicStreak(publicStreakFromSeriler(shield))).status).toBe("shield");
  });

  it("ignores invalid public data", () => {
    expect(readPublicStreak({ v: 1, alev: { ...source.alev, buHaftaKutulari: [true] } })).toBeNull();
  });
});
