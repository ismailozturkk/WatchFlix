// Part 23.1: utils/gameScoring.js icin gercek, calisan birim testler.
// Bu dosya React/Firebase importu olmayan saf JS oldugu icin jest
// test-environment "node" ile dogrudan calisabilir (bkz. jest.config.js).
const {
  computeQuestionScore,
  computeSessionXp,
  computeMaxPossibleScore,
  validateSessionResult,
  xpForLevel,
  computeLevel,
} = require("../utils/gameScoring");

describe("computeQuestionScore (Part 11.1)", () => {
  test("normal zorlukta tam sure ve sifir seri ile temel skor uretir", () => {
    const score = computeQuestionScore({
      timeLeft: 12,
      questionSeconds: 12,
      isSessionTimer: false,
      streakBefore: 0,
      difficultyMultiplier: 1.25,
      usedFifty: false,
      usedImage: false,
    });
    // (100 + 50 + 0) * 1.25 = 187.5 -> round edilmis taban skorla ayni olmali
    expect(score).toBe(Math.round((100 + 50 + 0) * 1.25));
  });

  test("sure azaldikca timeBonus duzgun dusurulur", () => {
    const fullTime = computeQuestionScore({ timeLeft: 12, questionSeconds: 12, difficultyMultiplier: 1 });
    const halfTime = computeQuestionScore({ timeLeft: 6, questionSeconds: 12, difficultyMultiplier: 1 });
    const noTime = computeQuestionScore({ timeLeft: 0, questionSeconds: 12, difficultyMultiplier: 1 });
    expect(fullTime).toBeGreaterThan(halfTime);
    expect(halfTime).toBeGreaterThan(noTime);
  });

  test("session timer modunda (Zamana Karsi) timeBonus uygulanmaz", () => {
    const score = computeQuestionScore({
      timeLeft: 999,
      questionSeconds: 0,
      isSessionTimer: true,
      streakBefore: 0,
      difficultyMultiplier: 1,
    });
    expect(score).toBe(100);
  });

  test("seri bonusu en fazla 50 ile sinirlidir (5 adimda +10)", () => {
    const streak3 = computeQuestionScore({ timeLeft: 0, questionSeconds: 1, streakBefore: 3, difficultyMultiplier: 1 });
    const streak10 = computeQuestionScore({ timeLeft: 0, questionSeconds: 1, streakBefore: 10, difficultyMultiplier: 1 });
    const streak100 = computeQuestionScore({ timeLeft: 0, questionSeconds: 1, streakBefore: 100, difficultyMultiplier: 1 });
    expect(streak3).toBe(Math.round((100 + 0 + 30) * 1));
    expect(streak10).toBe(Math.round((100 + 0 + 50) * 1)); // tavan 50'de
    expect(streak100).toBe(streak10); // tavanin ustunde artmaz
  });

  test("%50 joker cezasi puanin yuzde 25'ini dusurur", () => {
    const base = computeQuestionScore({ timeLeft: 0, questionSeconds: 1, difficultyMultiplier: 1 });
    const withFifty = computeQuestionScore({ timeLeft: 0, questionSeconds: 1, difficultyMultiplier: 1, usedFifty: true });
    expect(withFifty).toBe(Math.round(base * 0.75));
  });

  test("gorsel degistirme jokeri puanin yuzde 15'ini dusurur", () => {
    const base = computeQuestionScore({ timeLeft: 0, questionSeconds: 1, difficultyMultiplier: 1 });
    const withImage = computeQuestionScore({ timeLeft: 0, questionSeconds: 1, difficultyMultiplier: 1, usedImage: true });
    expect(withImage).toBe(Math.round(base * 0.85));
  });

  test("her iki joker birlikte kullanilirsa cezalar toplanir", () => {
    const base = computeQuestionScore({ timeLeft: 0, questionSeconds: 1, difficultyMultiplier: 1 });
    const withBoth = computeQuestionScore({
      timeLeft: 0,
      questionSeconds: 1,
      difficultyMultiplier: 1,
      usedFifty: true,
      usedImage: true,
    });
    expect(withBoth).toBe(Math.round(base * (1 - 0.25 - 0.15)));
  });

  test("skor asla negatif olmaz (uc durum koruma)", () => {
    const score = computeQuestionScore({
      timeLeft: 0,
      questionSeconds: 1,
      streakBefore: 0,
      difficultyMultiplier: 0,
      usedFifty: true,
      usedImage: true,
    });
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe("computeSessionXp (Part 11.3)", () => {
  test("dogru cevap basina 10 XP verir", () => {
    expect(computeSessionXp({ correctCount: 5, bestStreak: 0, outcome: null })).toBe(50);
  });

  test("oyun tamamlanirsa 25 XP bonus eklenir", () => {
    const withoutCompletion = computeSessionXp({ correctCount: 5, bestStreak: 0, outcome: "in_progress" });
    const withCompletion = computeSessionXp({ correctCount: 5, bestStreak: 0, outcome: "completed" });
    expect(withCompletion - withoutCompletion).toBe(25);
  });

  test("her 5 seri adiminda +10 XP verir (taban alinir)", () => {
    expect(computeSessionXp({ correctCount: 0, bestStreak: 4, outcome: null })).toBe(0);
    expect(computeSessionXp({ correctCount: 0, bestStreak: 5, outcome: null })).toBe(10);
    expect(computeSessionXp({ correctCount: 0, bestStreak: 12, outcome: null })).toBe(20);
  });

  test("basarim XP'si achievementsUnlocked parametresinden gelir", () => {
    expect(computeSessionXp({ achievementsUnlocked: 2 })).toBe(100);
  });

  test("negatif degerler XP'yi negatif yapmaz", () => {
    expect(computeSessionXp({ correctCount: -5, bestStreak: -10, achievementsUnlocked: -1 })).toBe(0);
  });
});

describe("xpForLevel / computeLevel (Part 11.3 / 15.1)", () => {
  test("seviye 1 icin gereken taban XP sifirdir", () => {
    expect(xpForLevel(1)).toBe(0);
  });

  test("ucgensel egri: seviye N->N+1 100*N XP ister", () => {
    expect(xpForLevel(2) - xpForLevel(1)).toBe(100);
    expect(xpForLevel(3) - xpForLevel(2)).toBe(200);
  });

  test("computeLevel toplam XP'den dogru seviyeyi turetir", () => {
    expect(computeLevel(0).level).toBe(1);
    expect(computeLevel(99).level).toBe(1);
    expect(computeLevel(100).level).toBe(2);
    expect(computeLevel(300).level).toBe(3); // xpForLevel(3) = 300
  });

  test("computeLevel ilerleme oranini 0-1 araliginda dondurur", () => {
    const result = computeLevel(150); // seviye 2 (100'de baslar), span 200
    expect(result.level).toBe(2);
    expect(result.progress).toBeGreaterThanOrEqual(0);
    expect(result.progress).toBeLessThanOrEqual(1);
    expect(result.currentLevelXp).toBe(50);
  });
});

describe("computeMaxPossibleScore / validateSessionResult (Part 17.3)", () => {
  test("Klasik mod (10 soru) icin teorik tavan sabit soru sayisindan turetilir", () => {
    const max = computeMaxPossibleScore({ modeQuestionCount: 10, difficultyMultiplier: 1.25 });
    expect(max).toBe(Math.ceil((100 + 50 + 50) * 1.25 * 10));
  });

  test("negatif skor reddedilir", () => {
    const result = validateSessionResult({ score: -10, totalCorrect: 0, totalWrong: 0, modeQuestionCount: 10 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("negative_value");
  });

  test("soru sayisini asan cevap sayisi reddedilir", () => {
    const result = validateSessionResult({
      score: 100,
      totalCorrect: 8,
      totalWrong: 5,
      modeQuestionCount: 10,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too_many_answers");
  });

  test("totalCorrect, totalCorrect+totalWrong toplamini gecemez (matematiksel olarak negatif-deger kontroluyle ortulur)", () => {
    // Not: totalCorrect > (totalCorrect + totalWrong) kosulu cebirsel olarak
    // totalWrong < 0 ile ozdestir; bu yuzden validateSessionResult'taki
    // "negative_value" kontrolu bu durumu zaten her zaman once yakalar ve
    // "correct_exceeds_answered" kod yolu mevcut girdi semasinda pratikte
    // erisilemezdir. Bu test bunu acikca dogrular (yanlis pozitif/negatif
    // test yazmak yerine gercek davranisi belgelemek tercih edildi).
    const result = validateSessionResult({
      score: 100,
      totalCorrect: 6,
      totalWrong: -1,
      modeQuestionCount: 10,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("negative_value");
  });

  test("dogru sayisini asan en iyi seri reddedilir", () => {
    const result = validateSessionResult({
      score: 100,
      totalCorrect: 3,
      totalWrong: 1,
      bestStreak: 5,
      modeQuestionCount: 10,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("streak_exceeds_correct");
  });

  test("teorik tavani asan skor reddedilir", () => {
    const result = validateSessionResult({
      score: 999999,
      totalCorrect: 10,
      totalWrong: 0,
      bestStreak: 10,
      modeQuestionCount: 10,
      difficultyMultiplier: 1.25,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("score_exceeds_theoretical_max");
  });

  test("normal/makul bir Klasik oturumu kabul edilir", () => {
    const result = validateSessionResult({
      score: 1200,
      totalCorrect: 9,
      totalWrong: 1,
      bestStreak: 9,
      modeQuestionCount: 10,
      difficultyMultiplier: 1.25,
    });
    expect(result.ok).toBe(true);
  });
});
