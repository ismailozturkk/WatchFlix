// utils/ratingGame.js
//
// "Hangisinin puanı daha yüksek?" (hızlı oyun `rating`) SAF çekirdeği. RN/Firebase importu YOK.
//
// OYUN: iki yapım yan yana ve iki puan da gizli. Oyuncu doğrudan puanı daha yüksek olan afişe dokunur. Cevaptan
// sonra iki puan birlikte açılır. Bilemezse oyun biter (tek can: QUICK_GAME_META.rating.lives). Skor = art arda
// doğru sayısı (seri). Her tur bağımsız bir çifttir; eski "ikinci yapımı sonraki tura taşı" zinciri yoktur.
//
// ADİL KARŞILAŞTIRMA: ekranda puan TEK ONDALIKLA görünür (7.8). Karşılaştırma da bu yuvarlanmış değerle yapılır ve
// iki puan arasında en az RATING_MIN_GAP (0.1) fark olmayan çift HİÇ seçilmez — oyuncu "eşit"i göremeyeceği bir
// soruyla karşılaşmaz. (Yine de eşit gelirse `judgeRatingAnswer` iki afişi de doğru sayar.)
//
// İÇERİK: Sahne Tahmin'in başlık havuzu (services/quickGamePool). Soru olabilecek yapım: yılı + afişi var, puanı var
// ve en az RATING_MIN_VOTES oy almış (az oylu yapımın ortalaması oynaktır ve yapım bilinmez). Yeni yapım bilindiklik
// ağırlığıyla seçilir (utils/gameSelection.recognitionWeight: oy sayısı × popülerlik). Yetişkin içerik izni yoksa
// (`allowAdult` = utils/ageGate.adultContentAllowed(), çağıran geçirir) `adult` işaretli yapım hiç gelmez.
//
// ZORLUK seriyle yükselir: iki puan arasındaki en küçük fark 1.5 puandan 0.1'e iner. Uygun yapım kalmazsa fark
// kademeli gevşetilir (asla 0.1'in altına değil); oyun "çift çıkmadığı için" bitmez.

import { isUsable, keyOfItem } from "./olderGame";
import { recognitionWeight } from "./gameSelection";

export const RATING_MIN_VOTES = 300;
/** İki puan arasındaki mutlak en küçük fark (tek ondalık): eşit puanlı çift olmaz. */
export const RATING_MIN_GAP = 0.1;
export const RATING_HIGHER = "higher";
export const RATING_LOWER = "lower";

const round1 = (value) => Math.round(value * 10) / 10;

/** Ekranda görünen puan (tek ondalık); puansız/bozuk değerde 0. */
export function ratingOf(item) {
  const value = Number(item?.voteAverage);
  return Number.isFinite(value) && value > 0 ? round1(Math.min(10, value)) : 0;
}

const votesOf = (item) => Math.max(0, Number(item?.voteCount) || 0);

/** Soru olabilecek yapım mı (kullanılabilir + puanlı + yeterli oy + yetişkin süzgeci)? */
export function isRatingCandidate(item, { maxYear, allowAdult = false } = {}) {
  if (!isUsable(item, maxYear)) return false;
  if (!allowAdult && item.adult === true) return false;
  return ratingOf(item) > 0 && votesOf(item) >= RATING_MIN_VOTES;
}

/** Seri → iki puan arasında istenen EN KÜÇÜK fark. */
export function gapForStreak(streak) {
  const s = Math.max(0, Math.trunc(Number(streak)) || 0);
  if (s < 3) return 1.5;
  if (s < 6) return 1;
  if (s < 10) return 0.6;
  if (s < 15) return 0.3;
  return RATING_MIN_GAP;
}

/** İki puanın farkı (kayan nokta gürültüsü olmadan, tek ondalıkta). */
const gapOf = (a, b) => round1(Math.abs(ratingOf(a) - ratingOf(b)));

/** Bilindiklik ağırlıklı tek seçim (rng ile, tekrarlanabilir). */
export function weightedPick(list, rng = Math.random) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const weights = list.map((item) => Math.max(1e-6, recognitionWeight(item)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < list.length; i += 1) {
    roll -= weights[i];
    if (roll < 0) return list[i];
  }
  return list[list.length - 1];
}

/**
 * İkinci puan birinciye göre: "higher" | "lower" | "equal" (görünen, tek ondalıklı puanla).
 */
export function compareRatings(first, second) {
  const a = ratingOf(first);
  const b = ratingOf(second);
  if (b > a) return RATING_HIGHER;
  if (b < a) return RATING_LOWER;
  return "equal";
}

/**
 * Cevap değerlendirmesi. Seçim "higher/lower" değil doğrudan afişin `keyOfItem` anahtarıdır.
 * Eşit puan (normalde hiç seçilmez) iki afişte de doğru sayılır.
 * @returns {{ correct: boolean, correctKey: string }}
 */
export function judgeRatingAnswer(question, chosenKey) {
  const [first, second] = question?.items || [];
  if (!first || !second) return { correct: false, correctKey: null };
  const firstKey = keyOfItem(first);
  const secondKey = keyOfItem(second);
  const verdict = compareRatings(first, second);
  if (verdict === "equal") {
    const correct = chosenKey === firstKey || chosenKey === secondKey;
    return { correct, correctKey: correct ? chosenKey : firstKey };
  }
  const correctKey = verdict === RATING_HIGHER ? secondKey : firstKey;
  return { correct: chosenKey === correctKey, correctKey };
}

/**
 * Bir soru kurar.
 *
 * @param {object} p
 * @param {Array}  p.pool
 * @param {number} [p.streak]     şu anki seri (zorluk)
 * @param {Set<string>} [p.recent] yakın zamanda sorulmuş yapımlar (yeni yapım bunlardan seçilmez, yetmezse seçilir)
 * @param {() => number} [p.rng]
 * @param {number} [p.maxYear]
 * @param {boolean} [p.allowAdult] utils/ageGate.adultContentAllowed()
 * @returns {object|null} soru; havuzda iki uygun yapım yoksa null
 */
export function buildRatingQuestion({ pool, streak = 0, recent = new Set(), rng = Math.random, maxYear, allowAdult = false } = {}) {
  const candidates = (Array.isArray(pool) ? pool : []).filter((item) => isRatingCandidate(item, { maxYear, allowAdult }));
  if (candidates.length < 2) return null;
  const fresh = candidates.filter((item) => !recent.has(keyOfItem(item)));
  const base = fresh.length >= 2 ? fresh : candidates;

  const target = gapForStreak(streak);
  const steps = [...new Set([target, target * 0.6, target * 0.3, RATING_MIN_GAP].map((g) => Math.max(RATING_MIN_GAP, round1(g))))];
  for (const gap of steps) {
    // Birkaç ilk yapım denenir (uç puanlı bir yapımın eşi çıkmayabilir).
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const first = weightedPick(base, rng);
      const firstKey = keyOfItem(first);
      const fits = (item) => keyOfItem(item) !== firstKey && gapOf(first, item) >= gap - 1e-9;
      const pickFrom = base.filter(fits);
      const second = weightedPick(pickFrom.length ? pickFrom : candidates.filter(fits), rng);
      if (!second) continue;
      const verdict = compareRatings(first, second);
      if (verdict === "equal") continue; // gap ≥ 0.1 olduğu için olmaz; savunma
      const correctKey = verdict === RATING_HIGHER ? keyOfItem(second) : firstKey;
      return {
        gameId: "rating",
        layout: "rating",
        items: [first, second],
        showTitle: true,
        options: [first, second].map((item) => ({ key: keyOfItem(item) })),
        correctKey,
        facts: { ratings: [ratingOf(first), ratingOf(second)] },
      };
    }
  }
  return null;
}
