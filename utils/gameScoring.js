// utils/gameScoring.js
//
// Oyun puanlama, joker cezasi ve XP/seviye yardimcilari (Part 11).
// Saf fonksiyonlardir; React veya Firestore bagimliligi yoktur, bu sayede
// birim testlerle dogrulanabilir (Part 23.1).

/* ── Puanlama (11.1) ──────────────────────────────────────────────────────── */
export const SCORE_BASE = 100;
export const SCORE_TIME_BONUS_MAX = 50;
export const SCORE_STREAK_BONUS_MAX = 50;
export const SCORE_STREAK_BONUS_STEP = 10; // her seri +10 (en fazla 50)

export const JOKER_PENALTY_FIFTY = 0.25; // %50 joker -> sorunun puaninda %25 azalma
export const JOKER_PENALTY_IMAGE = 0.15; // gorsel degistirme -> %15 azalma

/**
 * Tek bir dogru cevabin puanini hesaplar (Part 11.1):
 *   (base + timeBonus + streakBonus) * difficultyMultiplier - jokerPenalty
 * Joker cezasi, sorunun puanindan yuzde olarak dusulur.
 */
export function computeQuestionScore({
  timeLeft = 0,
  questionSeconds = 0,
  isSessionTimer = false,
  streakBefore = 0,
  difficultyMultiplier = 1,
  usedFifty = false,
  usedImage = false,
} = {}) {
  // Session (Zamana Karsi) modunda soru basina sure olmadigi icin time bonus yok.
  const timeBonus =
    isSessionTimer || questionSeconds <= 0
      ? 0
      : Math.round(
          SCORE_TIME_BONUS_MAX * Math.max(0, Math.min(1, timeLeft / questionSeconds)),
        );
  const streakBonus = Math.min(
    SCORE_STREAK_BONUS_MAX,
    Math.max(0, streakBefore) * SCORE_STREAK_BONUS_STEP,
  );
  const raw = (SCORE_BASE + timeBonus + streakBonus) * (difficultyMultiplier || 1);
  const penaltyFactor =
    1 - (usedFifty ? JOKER_PENALTY_FIFTY : 0) - (usedImage ? JOKER_PENALTY_IMAGE : 0);
  return Math.max(0, Math.round(raw * penaltyFactor));
}

/* ── XP (11.3) ────────────────────────────────────────────────────────────── */
// XP skordan bagimsizdir; kalici oyuncu ilerlemesi icindir ve liderlik
// tablosunu etkilemez.
export const XP_PER_CORRECT = 10;
export const XP_GAME_COMPLETION = 25;
export const XP_PER_STREAK_MILESTONE = 10;
export const XP_STREAK_MILESTONE_SIZE = 5;
export const XP_PER_ACHIEVEMENT = 50;

/**
 * Bir oturumda kazanilan XP'yi hesaplar (Part 11.3).
 * Kaynaklar: dogru cevap, oyun tamamlama, seri. Basarim/gunluk gorev XP'si
 * ilgili sistemler (Part 15 / 8.4) eklendiginde achievementsUnlocked ile gelir.
 */
export function computeSessionXp({
  correctCount = 0,
  bestStreak = 0,
  outcome = null,
  achievementsUnlocked = 0,
} = {}) {
  const correctXp = Math.max(0, correctCount) * XP_PER_CORRECT;
  const completionXp = outcome === "completed" ? XP_GAME_COMPLETION : 0;
  const streakXp =
    Math.floor(Math.max(0, bestStreak) / XP_STREAK_MILESTONE_SIZE) *
    XP_PER_STREAK_MILESTONE;
  const achievementXp = Math.max(0, achievementsUnlocked) * XP_PER_ACHIEVEMENT;
  return correctXp + completionXp + streakXp + achievementXp;
}

/* ── Skor Guvenligi (Part 17.3) ───────────────────────────────────────────── */
// Backend olmadigi icin global tablo "dogrulanmamis" kabul edilir (17.3).
// Bu yardimcilar, istemci tarafinda acikca imkansiz skorlari elemek icin
// kabaca bir teorik tavan hesaplar. Amac mukemmel hile tespiti degil; bariz
// degistirilmis/bozuk degerleri reddetmektir.

/**
 * Bir mod+zorluk kombinasyonu icin oturumun ulasabilecegi kabaca teorik
 * maksimum skoru hesaplar. Klasik modda soru sayisi sabittir (questionCount);
 * sure/seri tabanli modlarda (Zamana Karsi, Hayatta Kalma) soru sayisi
 * onceden bilinemedigi icin guvenli/genis bir tavan kullanilir.
 *
 * Tek soru ust siniri: (base + timeBonusMax + streakBonusMax) * difficultyMultiplier
 * Joker cezasi dusulmedi (cezasiz en yuksek ihtimal taban alinir).
 */
export function computeMaxPossibleScore({
  modeQuestionCount = null,
  difficultyMultiplier = 1,
  timerType = "per_question",
  totalSeconds = 0,
  minQuestionSeconds = 8,
} = {}) {
  const perQuestionMax =
    (SCORE_BASE + SCORE_TIME_BONUS_MAX + SCORE_STREAK_BONUS_MAX) *
    (difficultyMultiplier || 1);

  if (timerType === "session") {
    // Zamana Karsi: en iyi durumda her soru en hizli sekilde (anlik) cevaplanir.
    // Soru basina gercekci bir minimum sure (2 sn) varsayip ust sinir cikarilir.
    const estimatedMaxQuestions = Math.max(
      1,
      Math.ceil((Number(totalSeconds) || 60) / 2),
    );
    return Math.ceil(perQuestionMax * estimatedMaxQuestions);
  }

  if (modeQuestionCount) {
    return Math.ceil(perQuestionMax * modeQuestionCount);
  }

  // Hayatta Kalma gibi acik-uctu modlarda cok genis (ama sonsuz olmayan) bir
  // tavan kullanilir: 200 soruluk bir oturum gercekci ust sinir kabul edilir.
  const SURVIVAL_SAFETY_QUESTION_CAP = 200;
  return Math.ceil(perQuestionMax * SURVIVAL_SAFETY_QUESTION_CAP);
}

/**
 * Bir oturum sonucunu kaydetmeden once temel anomali kontrolleri yapar
 * (Part 17.3). Backend dogrulamasi olmadigindan bunlar kesin guvenlik degil,
 * bariz bozuk/degistirilmis veriyi reddetmek icindir.
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateSessionResult({
  score = 0,
  totalCorrect = 0,
  totalWrong = 0,
  bestStreak = 0,
  modeQuestionCount = null,
  difficultyMultiplier = 1,
  timerType = "per_question",
  totalSeconds = 0,
} = {}) {
  if (score < 0 || totalCorrect < 0 || totalWrong < 0 || bestStreak < 0) {
    return { ok: false, reason: "negative_value" };
  }

  const totalAnswered = totalCorrect + totalWrong;
  // Klasik modda toplam cevap sayisi soru sayisini gecemez.
  if (modeQuestionCount && totalAnswered > modeQuestionCount) {
    return { ok: false, reason: "too_many_answers" };
  }
  // Dogru sayisi, cevaplanan soru sayisini hicbir zaman gecemez.
  if (totalCorrect > totalAnswered) {
    return { ok: false, reason: "correct_exceeds_answered" };
  }
  // En iyi seri, toplam dogru sayisini gecemez.
  if (bestStreak > totalCorrect) {
    return { ok: false, reason: "streak_exceeds_correct" };
  }

  const maxScore = computeMaxPossibleScore({
    modeQuestionCount,
    difficultyMultiplier,
    timerType,
    totalSeconds,
  });
  if (score > maxScore) {
    return { ok: false, reason: "score_exceeds_theoretical_max" };
  }

  return { ok: true };
}

/* ── Seviye (11.3 / 15.1) ─────────────────────────────────────────────────── */
// Ucgensel egri: N -> N+1 gecisi 100*N XP ister.
// Seviye L'ye ulasmak icin gereken toplam XP: 100 * (L-1) * L / 2.
export function xpForLevel(level) {
  const l = Math.max(1, Math.floor(level));
  return (100 * (l - 1) * l) / 2;
}

/**
 * Toplam XP'den seviye ve seviye ilerlemesini hesaplar.
 */
export function computeLevel(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const currentBase = xpForLevel(level);
  const span = xpForLevel(level + 1) - currentBase;
  const intoLevel = xp - currentBase;
  return {
    level,
    totalXp: xp,
    currentLevelXp: intoLevel,
    nextLevelXp: span,
    progress: span > 0 ? Math.max(0, Math.min(1, intoLevel / span)) : 0,
  };
}
