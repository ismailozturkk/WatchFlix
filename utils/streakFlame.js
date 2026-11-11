// utils/streakFlame.js
//
// HAFTALIK SERİ ALEVİ — profilde adın yanında yanan 🔥. Bu modül yalnız KARARLARI
// verir: alev görünsün mü, hangi kademede, nasıl görünsün, durumu ne (yandı / risk /
// telafi / kalkan / mola). Çizim components/streak/StreakFlame.js'te.
//
// KAYNAK: `useWatchProgress().seriler.alev` (utils/streakWeekly.js alevHesapla).
// Seri BAŞARILI HAFTA sayar (haftada en az 2 farklı gün); kurallar orada.
//
// KADEME HİYERARŞİSİ (11 Kas):
//   RENK   (her 4 başarılı hafta) → 13 palet: 1–4. hafta turuncu … 49. hafta Efsane;
//          52. haftadan sonra dönen gökkuşağı halkası.
//   KIVILCIM (HER hafta)          → kıvılcımın BİÇİMİ haftadan haftaya değişir
//          (kor → yıldız → elmas → kar tanesi, sonra yeni renkte yeniden), sayısı da
//          renk kademesiyle artar.
//   İHTİŞAM (bu haftanın günleri) → haftada kaç FARKLI gün işaretlediysen alev o kadar
//          görkemli: 1 gün tek alev dili (en küçük) · 2 iki katman · 3 üç katman ·
//          4 kıvılcımlar · 5 uçuşan minik kıvılcımlar · 6 taç · 7 yıldız ışıltısı.
//          Boy da büyür.
// Yeni hafta başında ihtişam 1'den yeniden başlar; renk ve kıvılcım kalıcıdır.
//
// SAF MODÜL: React / React Native importu YOKTUR (jest'te doğrudan koşar).

import { HAFTA_ESIGI, KALKAN_TAVANI_HAFTA, TELAFI_GUN_ESIGI } from "./streakWeekly";

/** Alevin göründüğü en kısa seri (başarılı hafta). */
export const STREAK_MIN_WEEKS = 1;
export const DAYS_PER_WEEK = 7;
/** Bir renk kademesi kaç hafta sürer. */
export const WEEKS_PER_TIER = 4;
/** Rengi olan en yüksek kademe; ötesi Efsane'de kalır. */
export const MAX_TIER = 12;
/** Gökkuşağı halkasının açıldığı hafta (13 renk × 4 hafta = bir yıl). */
export const RAINBOW_WEEK = (MAX_TIER + 1) * WEEKS_PER_TIER;

/** Efektler, çizim sırasıyla. */
export const STREAK_EFFECTS = Object.freeze(["sparks", "flurry", "corona", "sparkles", "rainbow"]);

/** Kıvılcım biçimleri: her başarılı hafta bir sonrakine geçer (döngü). */
export const SPARK_SHAPES = Object.freeze(["ember", "star", "diamond", "flake"]);

// Paletler. Dış alevin ALT tonu her zaman daha koyu: alev aşağıda yoğun, uçta açık
// okunur. `text`: açık ve koyu temada okunabilen sayı/etiket rengi.
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

/** Mola: alev griye döner (seri durur, kaybolmaz). */
export const PAUSED_PALETTE = P(
  "paused", ["#5B5F69", "#8A8F9B"], ["#7A7F8B", "#A9AEB8"], ["#C4C7CE", "#E6E8EC"], "#9AA0AC", "#C9CDD4", "#8A909C",
);

export const STREAK_MONTH_IDS = Object.freeze(STREAK_MONTHS.map((p) => p.id));

/** Renk kademesinin paleti (0 = ilk). 12'nin ötesi Efsane'de kalır. */
export const streakPalette = (tier) =>
  STREAK_MONTHS[Math.max(0, Math.min(MAX_TIER, Math.floor(Number(tier) || 0)))];

const toInt = (value) => Math.max(0, Math.floor(Number(value) || 0));

/**
 * Başarılı hafta sayısı → kademe. `index` monoton artar (= hafta) ve kutlamanın
 * "yeni kademeye çıktı mı" ölçüsüdür.
 *   tier       renk kademesi (0..12): (hafta − 1) / 4
 *   sparkStage kıvılcım biçimi (0..3): her hafta bir sonraki
 *   weekInTier renk kademesi içindeki hafta (1..4)
 */
export function streakLevel(weeks) {
  const n = toInt(weeks);
  const k = Math.max(0, n - 1);
  const tier = Math.min(MAX_TIER, Math.floor(k / WEEKS_PER_TIER));
  return {
    weeks: n,
    tier,
    weekInTier: n === 0 ? 0 : (k % WEEKS_PER_TIER) + 1,
    sparkStage: k % SPARK_SHAPES.length,
    index: n,
  };
}

/** Sonraki renk kademesi: kaçıncı haftada, kaç hafta kaldı, hangi palet. */
export function nextStreakMilestones(weeks) {
  const n = toInt(weeks);
  const { tier } = streakLevel(n);
  if (tier >= MAX_TIER) return { tierAt: null, weeksToTier: null, nextPalette: null };
  const tierAt = (tier + 1) * WEEKS_PER_TIER + 1;
  return { tierAt, weeksToTier: tierAt - n, nextPalette: streakPalette(tier + 1) };
}

// Günlük ihtişam kademesinin (1..7) getirdikleri.
const STAGE_EFFECTS = Object.freeze([
  [],
  [],
  [],
  [],
  ["sparks"],
  ["sparks", "flurry"],
  ["sparks", "flurry", "corona"],
  ["sparks", "flurry", "corona", "sparkles"],
]);

/** Bu haftanın farklı gün sayısı → ihtişam kademesi (1..7). */
export const dayStage = (days) => Math.max(1, Math.min(DAYS_PER_WEEK, toInt(days)));

// Boy: ihtişamla büyür (1 gün en küçük), uzun seride çok hafif bir taban artışı.
const stageGrowth = (stage, weeks) => {
  const base = 0.7 + 0.05 * (stage - 1); // 1 → 0.70 … 7 → 1.00
  const bonus = Math.min(0.04, Math.log1p(toInt(weeks)) * 0.01);
  return Math.round(Math.min(1.04, base + bonus) * 1000) / 1000;
};

/**
 * Hafta sayısı + bu haftanın gün sayısı → alevin görünüşü. Çizim bu nesneyi olduğu
 * gibi kullanır.
 *   palette   renk (4 haftada bir; mola → gri)
 *   stage     ihtişam (1..7)
 *   layers    alev katmanı sayısı (1..3)
 *   effects   ihtişamın getirdiği efektler (+ 52. haftadan sonra gökkuşağı)
 *   spark     { shape, count } — biçim her hafta değişir, sayı renkle artar
 *   heat      titreme enerjisi, growth boy
 */
export function streakLook(weeks, days = DAYS_PER_WEEK, { paused = false } = {}) {
  const level = streakLevel(weeks);
  const stage = dayStage(days);
  const effects = new Set(STAGE_EFFECTS[stage]);
  if (level.weeks >= RAINBOW_WEEK && !paused) effects.add("rainbow");
  return {
    palette: paused ? PAUSED_PALETTE : streakPalette(level.tier),
    stage,
    layers: Math.min(3, stage),
    effects: STREAK_EFFECTS.filter((e) => effects.has(e)),
    spark: {
      shape: SPARK_SHAPES[level.sparkStage],
      count: Math.min(7, 3 + Math.floor(level.tier / 2) + (stage >= 6 ? 1 : 0)),
    },
    heat: paused ? 0.45 : Math.round((0.78 + 0.06 * (stage - 1)) * 100) / 100,
    intensity: Math.min(4, Math.floor(level.tier / 3)),
    growth: stageGrowth(stage, level.weeks),
    paused,
  };
}

/** Görünüşün efekti var mı. */
export const lookHasEffect = (look, effect) => Boolean(look?.effects?.includes(effect));

/**
 * Durum:
 *   "lit"    bu hafta 2 farklı güne ulaştı — hafta kazanıldı
 *   "risk"   seri canlı, bu hafta henüz 2 gün yok
 *   "repair" geçen hafta kaçtı; bu hafta 4 gün işaretlersen kurtulur (kalkan yok)
 *   "shield" geçen hafta kaçtı; telafi edilmezse hafta sonunda kalkan koruyacak
 *   "paused" mola: alev gri, seri durdu (yeniden işaretleyince renk döner)
 */
function statusOf(alev) {
  if (alev?.mola?.aktif) return "paused";
  const bekleyen = alev?.bekleyen;
  // Kalkan geçen haftayı hafta sonunda her durumda kapatacak ve bu hafta zaten
  // kazanıldı: sonuç kesin, alev yanar.
  if (bekleyen?.kalkan && alev?.buHaftaBasarili) return "lit";
  if (bekleyen) return bekleyen.kalkan ? "shield" : "repair";
  return alev?.buHaftaBasarili ? "lit" : "risk";
}

/**
 * `seriler` → alevin tüm görünür durumu. Seri yoksa `visible: false` döner ve çağıran
 * HİÇBİR ŞEY çizmez. Telafi/kalkan beklerken sayı KURTARILACAK seridir; kalkan
 * beklerken bu hafta zaten kazanıldıysa sonuç kesindir (kalkan geçen haftayı kapatır):
 * sayı kurtarılan + 2 gösterilir, kalkan harcanmış sayılır.
 */
export function streakFlameState(seriler) {
  const alev = seriler?.alev || null;
  const status = statusOf(alev);
  const bekleyen = alev?.bekleyen || null;
  const settled = Boolean(bekleyen?.kalkan && alev?.buHaftaBasarili);
  const weeks = settled
    ? toInt(bekleyen.korunanSeri) + 2
    : bekleyen ? toInt(bekleyen.korunanSeri) : toInt(alev?.seri);
  const daysThisWeek = Math.min(DAYS_PER_WEEK, toInt(alev?.buHaftaGun));
  const paused = status === "paused";
  const level = streakLevel(weeks);
  const look = streakLook(weeks, daysThisWeek, { paused });
  const next = nextStreakMilestones(weeks);
  const need = toInt(alev?.esik) || HAFTA_ESIGI;
  const shields = Math.min(KALKAN_TAVANI_HAFTA, Math.max(0, toInt(alev?.kalkan) - (settled ? 1 : 0)));
  return {
    visible: weeks >= STREAK_MIN_WEEKS,
    weeks,
    // Eski adla da okunabilsin (hikâye kartı, geliştirici laboratuvarı).
    days: weeks,
    record: Math.max(weeks, toInt(alev?.rekor)),
    status,
    level,
    look,
    next,
    week: {
      days: daysThisWeek,
      need,
      won: Boolean(alev?.buHaftaBasarili),
      boxes: Array.isArray(alev?.buHaftaKutulari) && alev.buHaftaKutulari.length === 7
        ? alev.buHaftaKutulari.map(Boolean)
        : Array(7).fill(false),
    },
    tierProgress: level.weekInTier / WEEKS_PER_TIER,
    litToday: Boolean(alev?.bugunAktif),
    dimmed: status !== "lit",
    paused,
    protection: {
      shields,
      shieldMax: KALKAN_TAVANI_HAFTA,
      weeksToShield: Math.max(1, toInt(alev?.kalkanaKalan) || 4),
      repairNeed: toInt(bekleyen?.gerekli) || TELAFI_GUN_ESIGI,
      repairHave: toInt(bekleyen?.mevcut),
      breakAvailable: alev?.mola?.hakVar !== false,
      breakThisWeek: Boolean(alev?.mola?.buHafta),
      breakLastWeek: Boolean(alev?.mola?.gecenHafta),
      // Mola verilebilir mi: hak var ve (seri var ya da geçen hafta karar bekliyor).
      canBreak: alev?.mola?.hakVar !== false && !alev?.mola?.buHafta && (weeks >= 1),
    },
  };
}

// Kutlama kaydının biçim sürümü. Günlük seriden (ay×5+hafta) kalan eski kayıt
// sessizce benimsenir: güncellemeden sonra sahte "yeni kademe" tostu çıkmasın.
const KAYIT_SURUM = 2;

/**
 * Kutlama kararı (saf): önceki kayıt + güncel seri → ne gösterilecek, ne yazılacak.
 *   stored: { v: 2, seviye: number (-1 = alev yok), yama: string ("" = yok) }
 *   celebrate: { kind: "lit"|"week"|"tier", state } — yeni hafta / renk
 *   patch: { tur: "telafi"|"kalkan", gun, state } — seri kurtarıldı / korundu
 *   store: yeni kayıt (değişmiyorsa null)
 */
export function streakCelebrationStep(stored, seriler) {
  const state = streakFlameState(seriler);
  const seviye = state.visible ? state.level.index : -1;
  const sonYama = seriler?.alev?.sonYama && typeof seriler.alev.sonYama.gun === "string" ? seriler.alev.sonYama : null;
  const eski = !stored || typeof stored !== "object" || stored.v !== KAYIT_SURUM;
  if (eski) {
    // İlk kez (ya da eski biçim): durumu sessizce benimse. Hiç kayıt yoksa ve alev
    // yanıyorsa bu GERÇEK ilk yanıştır → kutlanır.
    const ilk = !stored && seviye >= 1;
    return {
      celebrate: ilk ? { kind: "lit", state } : null,
      patch: null,
      store: { v: KAYIT_SURUM, seviye, yama: sonYama ? sonYama.gun : "" },
    };
  }
  const prev = Number.isFinite(Number(stored.seviye)) ? Math.floor(Number(stored.seviye)) : -1;
  const prevPatch = typeof stored.yama === "string" ? stored.yama : "";
  const yama = sonYama ? sonYama.gun : prevPatch;

  let celebrate = null;
  if (seviye > prev && seviye >= 1) {
    let kind = "week";
    if (prev < 1) kind = "lit";
    else if (streakLevel(seviye).tier > streakLevel(Math.max(prev, 1)).tier) kind = "tier";
    celebrate = { kind, state };
  }
  const patch = sonYama && sonYama.gun !== prevPatch && state.visible
    ? { tur: sonYama.tur, gun: sonYama.gun, state }
    : null;

  const store = seviye !== prev || yama !== prevPatch ? { v: KAYIT_SURUM, seviye, yama } : null;
  return { celebrate, patch, store };
}
