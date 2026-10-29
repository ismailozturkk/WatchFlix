// utils/streakFlame.js
//
// GÜNLÜK SERİ ALEVİ — art arda en az 3 gün bir şey işaretleyince profilde adın
// yanında yanan alev (Snapchat'teki 🔥 sayacı gibi). Bu modül yalnız KARARLARI
// verir: alev görünsün mü, hangi kademede, nasıl görünsün, durumu ne (yandı / risk /
// telafi bekliyor / kalkan koruyor), sonraki kademeye kaç gün var. Çizim
// components/streak/StreakFlame.js'te.
//
// KAYNAK: `useWatchProgress().seriler` (utils/watchActivity.js serileriHesapla).
// Gün listesi kullanıcının SEÇTİĞİ izleme tarihinden değil, cihaz saatiyle gerçek
// işaretleme anından ve NET yeni içerikten üretilir. Telafi ve kalkan kararları da
// orada (seriKorumasiniIlerlet); bu modül onları yalnız okur.
//
// KADEME HİYERARŞİSİ — saat gibi iç içe üç sayaç:
//   AY   (her 30 gün)  → alevin RENGİ. 13 renk: ilk ay turuncu … 12. ay Efsane.
//   HAFTA (ay içinde her 7 gün: 7·14·21·28) → yeni EFEKT (kor → hale → yıldız → taç).
//   GÜN  (hafta içinde her gün) → alevin ISISI: titreme enerjisi ve parıltı artar,
//        boyu da hiç küçülmeden her gün biraz büyür.
// Seri sayısı bu üçünün toplamıdır: 47 gün = 1 ay + 2 hafta + 3 gün.
// Yeni ay kademesinde haftalık efektler baştan sayılır (oyunlardaki lig + kademe
// gibi), ama ay ilerledikçe efektlerin bir kısmı KALICI olur (MONTH_BASE): yüksek
// aylar her hafta daha zengin başlar.
//
// SAF MODÜL: React / React Native importu YOKTUR (jest'te doğrudan koşar).

import { KALKAN_TAVANI, KORUMA_MIN_SERI, TELAFI_ESIGI } from "./watchActivity";

/** Alevin yandığı en kısa seri. Altında hiçbir şey gösterilmez. */
export const STREAK_MIN_DAYS = KORUMA_MIN_SERI;
export const DAYS_PER_WEEK = 7;
export const DAYS_PER_MONTH = 30;
/** Bir ay içinde ulaşılan en yüksek hafta kademesi (7·14·21·28). */
export const WEEKS_PER_MONTH = 4;
/** Rengi olan en yüksek ay kademesi; ötesi Efsane'de kalır. */
export const MAX_MONTH_TIER = 12;

/** Efektler, çizim sırasıyla. */
export const STREAK_EFFECTS = Object.freeze(["embers", "halo", "sparkles", "corona", "rainbow"]);

// Ay paletleri. Dış alevin ALT tonu her zaman daha koyu: alev aşağıda yoğun, uçta
// açık okunur. `text`: açık ve koyu temada okunabilen sayı/etiket rengi.
const P = (id, outer, mid, core, glow, ember, text) =>
  Object.freeze({ id, outer: Object.freeze(outer), mid: Object.freeze(mid), core: Object.freeze(core), glow, ember, text });

export const STREAK_MONTHS = Object.freeze([
  P("orange", ["#FF3D00", "#FF8A00"], ["#FF6D00", "#FFB300"], ["#FFD54F", "#FFF8E1"], "#FF6D00", "#FFB74D", "#F06A00"),
  P("crimson", ["#C62828", "#FF3D3D"], ["#FF1744", "#FF8A80"], ["#FFCDD2", "#FFF5F5"], "#FF1744", "#FF8A80", "#E53935"),
  P("pink", ["#E91E63", "#FF4D8D"], ["#FF2E88", "#FF8FB8"], ["#FFC1DC", "#FFF5FA"], "#FF2D95", "#FF9AC8", "#E8307F"),
  P("violet", ["#7B1FA2", "#C04DFF"], ["#B04DFF", "#E0A8FF"], ["#F3DEFF", "#FFFFFF"], "#B04DFF", "#E1B3FF", "#9C3FE0"),
  P("indigo", ["#3D2DB8", "#6C63FF"], ["#5C6BFF", "#A5B0FF"], ["#DDE2FF", "#FFFFFF"], "#5C6BFF", "#B3BCFF", "#5A5FE6"),
  P("blue", ["#1E4FD8", "#3D8BFF"], ["#00A2FF", "#5FD3FF"], ["#B9F0FF", "#FFFFFF"], "#1E90FF", "#7FDBFF", "#2A7FE8"),
  P("turquoise", ["#00838F", "#00C2D6"], ["#00D4E0", "#7FF3F5"], ["#C8FBFC", "#FFFFFF"], "#00C8D8", "#8CF5F7", "#00A3B4"),
  P("emerald", ["#00873E", "#00C853"], ["#22E07A", "#9CF5C2"], ["#D3FBE4", "#FFFFFF"], "#00D46A", "#A5F7C8", "#0FA65A"),
  P("sunset", ["#E0245E", "#FF7A2F"], ["#FF5E62", "#FFB36B"], ["#FFE0C2", "#FFFFFF"], "#FF5E62", "#FFC07A", "#F0504F"),
  P("aurora", ["#00A884", "#7C4DFF"], ["#1DE9B6", "#B388FF"], ["#E0FFF6", "#FFFFFF"], "#3DDCB0", "#B9F6E4", "#14A88A"),
  P("cosmic", ["#3D00B8", "#FF2D95"], ["#7C3AED", "#FF7AC6"], ["#F5D9FF", "#FFFFFF"], "#9D3BFF", "#FFD54F", "#8B3BF0"),
  P("platinum", ["#6E7F96", "#B8C7DA"], ["#9FB3CC", "#E3ECF5"], ["#F4F8FC", "#FFFFFF"], "#AFC6E8", "#FFFFFF", "#5F7590"),
  P("legendary", ["#FF6F00", "#FFC400"], ["#FFB300", "#FFE57F"], ["#FFF8D6", "#FFFFFF"], "#FFC400", "#FFF59D", "#D99A00"),
]);

export const STREAK_MONTH_IDS = Object.freeze(STREAK_MONTHS.map((p) => p.id));

/** Ay kademesinin paleti (0 = ilk ay). 12'nin ötesi Efsane'de kalır. */
export const streakPalette = (month) =>
  STREAK_MONTHS[Math.max(0, Math.min(MAX_MONTH_TIER, Math.floor(Number(month) || 0)))];

// Hafta kademesinin (ay içinde 0..4) getirdiği efektler.
const WEEK_EFFECTS = Object.freeze([
  [],
  ["embers"],
  ["embers", "halo"],
  ["embers", "halo", "sparkles"],
  ["embers", "halo", "sparkles", "corona"],
]);

// Ay kademesiyle KALICI olan efektler: yüksek aylar her haftaya daha zengin başlar.
const monthBaseEffects = (month) => [
  month >= 1 && "embers",
  month >= 2 && "halo",
  month >= 3 && "sparkles",
  month >= 6 && "corona",
  month >= MAX_MONTH_TIER && "rainbow",
].filter(Boolean);

const toDays = (value) => Math.max(0, Math.floor(Number(value) || 0));

/**
 * Seri uzunluğu → iç içe kademe. `index` monoton artar (ay × 5 + hafta) ve
 * kutlamanın "yeni kademeye çıktı mı" ölçüsüdür.
 */
export function streakLevel(days) {
  const n = toDays(days);
  const month = Math.floor(n / DAYS_PER_MONTH);
  const rest = n - month * DAYS_PER_MONTH;
  const week = Math.min(WEEKS_PER_MONTH, Math.floor(rest / DAYS_PER_WEEK));
  const day = rest - week * DAYS_PER_WEEK;
  return { days: n, month, week, day, index: month * (WEEKS_PER_MONTH + 1) + week };
}

/** Sonraki hafta ve ay kademeleri (gün sayısı ve kaç gün kaldığı). */
export function nextStreakMilestones(days) {
  const { month, week } = streakLevel(days);
  const n = toDays(days);
  const monthAt = (month + 1) * DAYS_PER_MONTH;
  const weekAt = week < WEEKS_PER_MONTH ? month * DAYS_PER_MONTH + (week + 1) * DAYS_PER_WEEK : null;
  return {
    weekAt,
    daysToWeek: weekAt === null ? null : weekAt - n,
    monthAt,
    daysToMonth: monthAt - n,
    nextPalette: month >= MAX_MONTH_TIER ? null : streakPalette(month + 1),
  };
}

// Alevin boyu seri uzadıkça HER GÜN biraz büyür; kademe atlayınca küçülmez.
// Logaritmik: ilk günler gözle görülür büyür, ilk yıldan sonra büyüme durur.
// 3 gün → 0.78, 7 → ~0.82, 30 → ~0.89, 90 → ~0.93, 360+ → 1.
const GROWTH_MIN = 0.78;
const GROWTH_FULL = MAX_MONTH_TIER * DAYS_PER_MONTH;
const GROWTH_SPAN = Math.log(GROWTH_FULL / STREAK_MIN_DAYS);
export function streakFlameGrowth(days) {
  const n = toDays(days);
  if (n <= STREAK_MIN_DAYS) return GROWTH_MIN;
  const ratio = Math.min(1, Math.log(n / STREAK_MIN_DAYS) / GROWTH_SPAN);
  return Math.round((GROWTH_MIN + (1 - GROWTH_MIN) * ratio) * 1000) / 1000;
}

/**
 * Seri uzunluğu → alevin görünüşü: palet (ay), efektler (hafta + ayın kalıcıları),
 * ısı (gün), boy (toplam). Çizim bu nesneyi olduğu gibi kullanır.
 */
export function streakLook(days) {
  const level = streakLevel(days);
  const set = new Set([...WEEK_EFFECTS[level.week], ...monthBaseEffects(level.month)]);
  return {
    palette: streakPalette(level.month),
    effects: STREAK_EFFECTS.filter((e) => set.has(e)),
    // Günlük kademe: haftanın her günü alev biraz daha harlı titrer ve parlar.
    heat: Math.round((0.82 + 0.05 * level.day) * 100) / 100,
    // Hafta kademesi efektlerin YOĞUNLUĞUNU da artırır (daha çok kor, yıldız).
    intensity: level.week,
    growth: streakFlameGrowth(level.days),
  };
}

/** Görünüşün efekti var mı (ör. "embers", "halo", "sparkles", "corona", "rainbow"). */
export const lookHasEffect = (look, effect) => Boolean(look?.effects?.includes(effect));

/**
 * Seri durumu:
 *   "lit"    bugün işaretlendi
 *   "risk"   seri canlı, bugün henüz bir şey yok (gün bitince kopar ya da korunur)
 *   "repair" dün kaçtı; bugün 2 içerikle telafi edilebilir
 *   "shield" dün kaçtı; telafi hakkı yok ama gün sonunda kalkan koruyacak
 */
function statusOf(seriler) {
  const bekleyen = seriler?.bekleyen;
  if (bekleyen && bekleyen.telafi) return "repair";
  if (bekleyen && bekleyen.kalkan) return "shield";
  return seriler?.bugunAktif ? "lit" : "risk";
}

/**
 * `seriler` → alevin tüm görünür durumu. Seri yoksa / 3 günün altındaysa
 * `visible: false` döner ve çağıran HİÇBİR ŞEY çizmez.
 *
 * Telafi/kalkan beklerken gösterilen sayı KURTARILACAK seridir (dünkü kopuştan
 * önceki kısım): kullanıcı neyi kaybetmek üzere olduğunu görür.
 */
export function streakFlameState(seriler) {
  const status = statusOf(seriler);
  const pending = status === "repair" || status === "shield";
  const days = pending ? toDays(seriler?.bekleyen?.korunanSeri) : toDays(seriler?.gunSerisi);
  const level = streakLevel(days);
  const look = streakLook(days);
  const next = nextStreakMilestones(days);
  const record = Math.max(days, toDays(seriler?.rekorGun));
  const shields = Math.min(KALKAN_TAVANI, toDays(seriler?.kalkan));
  return {
    visible: days >= STREAK_MIN_DAYS,
    days,
    record,
    status,
    level,
    look,
    next,
    // Ay içi ilerleme (0..1) ve hafta içi gün (0..6) — sayfadaki çubuklar.
    monthProgress: Math.round(((days - level.month * DAYS_PER_MONTH) / DAYS_PER_MONTH) * 1000) / 1000,
    litToday: Boolean(seriler?.bugunAktif),
    dimmed: status !== "lit",
    protection: {
      shields,
      shieldMax: KALKAN_TAVANI,
      repairReady: seriler?.telafiHazir !== false,
      repairIn: toDays(seriler?.telafiYenilenme),
      repairNeed: toDays(seriler?.bekleyen?.gerekli) || TELAFI_ESIGI,
      repairHave: toDays(seriler?.bekleyen?.mevcut),
    },
  };
}

/**
 * Kutlama kararı (saf): önceki kayıt + güncel seri → ne gösterilecek, ne yazılacak.
 *   stored: { seviye: number (-1 = alev yok), yama: string ("" = yok) }
 *   celebrate: { kind: "lit"|"week"|"month", state } — yeni kademe
 *   patch: { tur: "telafi"|"kalkan", gun, state } — seri kurtarıldı / korundu
 *   store: yeni kayıt (değişmiyorsa null)
 * Seri sönünce kayıt sessizce düşer; alev yeniden yanınca yine kutlanır.
 */
export function streakCelebrationStep(stored, seriler) {
  const prev = Number.isFinite(Number(stored?.seviye)) ? Math.floor(Number(stored.seviye)) : -1;
  const prevPatch = typeof stored?.yama === "string" ? stored.yama : "";
  const state = streakFlameState(seriler);
  const seviye = state.visible ? state.level.index : -1;
  const sonYama = seriler?.sonYama && typeof seriler.sonYama.gun === "string" ? seriler.sonYama : null;
  const yama = sonYama ? sonYama.gun : prevPatch;

  let celebrate = null;
  if (seviye > prev) {
    const prevMonth = prev < 0 ? -1 : Math.floor(prev / (WEEKS_PER_MONTH + 1));
    let kind = "week";
    if (prev < 0 && state.level.index === 0) kind = "lit";
    else if (state.level.month > 0 && state.level.month > prevMonth) kind = "month";
    celebrate = { kind, state };
  }
  const patch = sonYama && sonYama.gun !== prevPatch && state.visible
    ? { tur: sonYama.tur, gun: sonYama.gun, state }
    : null;

  const store = seviye !== prev || yama !== prevPatch ? { seviye, yama } : null;
  return { celebrate, patch, store };
}
