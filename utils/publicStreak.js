import { streakFlameState } from "./streakFlame";

const count = (value) => Math.max(0, Math.floor(Number(value) || 0));

// Users/{uid} receives only what the public flame needs, never the private ledger.
export function publicStreakFromSeriler(seriler) {
  const state = streakFlameState(seriler);
  if (!state.visible) return null;
  const flame = seriler.alev;
  const pending = flame?.bekleyen;
  return {
    v: 1,
    alev: {
      seri: count(flame.seri),
      buHaftaGun: state.week.days,
      buHaftaKutulari: state.week.boxes,
      buHaftaBasarili: state.week.won,
      bekleyen: pending ? {
        korunanSeri: count(pending.korunanSeri),
        kalkan: Boolean(pending.kalkan),
      } : null,
    },
  };
}

export function readPublicStreak(value) {
  if (value?.v !== 1 || !value.alev || typeof value.alev !== "object") return null;
  const flame = value.alev;
  if (!Number.isSafeInteger(flame.seri) || flame.seri < 0
      || !Number.isSafeInteger(flame.buHaftaGun) || flame.buHaftaGun > 7 || flame.buHaftaGun < 0
      || !Array.isArray(flame.buHaftaKutulari) || flame.buHaftaKutulari.length !== 7
      || !flame.buHaftaKutulari.every((day) => typeof day === "boolean")
      || typeof flame.buHaftaBasarili !== "boolean") return null;
  const pending = flame.bekleyen;
  if (pending != null && (!Number.isSafeInteger(pending.korunanSeri)
      || pending.korunanSeri < 0 || typeof pending.kalkan !== "boolean")) return null;
  const seriler = { alev: flame };
  return streakFlameState(seriler).visible ? seriler : null;
}
