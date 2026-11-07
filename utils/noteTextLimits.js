// utils/noteTextLimits.js
//
// Notlar düzenleyicisinin HARF sınırları — not metni ve yapılacak maddesi, plana
// göre. Sayılar premium kaydında (utils/premiumFeatures.js: note_length,
// todo_item_length); burası yalnız editörün sorduğu üç soruyu cevaplar. Saf modül.
//
// Sınır yalnız BÜYÜMEYİ durdurur: plan düşünce (abonelik bitti) sınırdan uzun kalan
// eski bir not/madde kısaltılmaz — silinebilir, uzatılamaz. Kayıt kuralıyla aynı:
// "mevcut notlarını düzenlemek her zaman serbest".

import { getPremiumPlanDisplayName } from "./premium";
import { getFeatureLimit, nextPlanFor } from "./premiumFeatures";

export const NOTE_TEXT_FEATURES = Object.freeze({
  content: "note_length",
  todoItem: "todo_item_length",
});

const entryFor = (featureId, plan) => {
  const next = nextPlanFor(featureId, plan);
  return {
    featureId,
    limit: getFeatureLimit(featureId, plan),
    canUpgrade: Boolean(next),
    upgradePlanName: next ? getPremiumPlanDisplayName(next) : null,
  };
};

/**
 * Planın editör sınırları.
 * @returns {{ content: Entry, todoItem: Entry }}
 *   Entry = { featureId, limit, canUpgrade, upgradePlanName }
 */
export function noteTextLimitsFor(plan) {
  return {
    content: entryFor(NOTE_TEXT_FEATURES.content, plan),
    todoItem: entryFor(NOTE_TEXT_FEATURES.todoItem, plan),
  };
}

const lengthOf = (value) => String(value ?? "").length;

/**
 * TextInput `maxLength`: sınırdan UZUN mevcut metin kırpılmasın diye o anki uzunluk
 * tabandır (Android'in uzunluk filtresi programla verilen metni de keser; kırpılan
 * metin kaydedilince eski notun sonu kaybolurdu). Böylece uzun metin yalnız kısalır.
 */
export function textInputMaxLength(limit, value) {
  if (!Number.isFinite(limit)) return undefined;
  return Math.max(limit, lengthOf(value));
}

/** Metin sınıra dayandı mı (eski bir kayıtta aştı mı)? */
export function isAtTextLimit(limit, value) {
  return Number.isFinite(limit) && lengthOf(value) >= limit;
}

/**
 * Yazarken sınıra YENİ mi dayanıldı? Yükseltme sayfası yalnız bu geçişte açılır;
 * zaten sınırı aşan eski bir metni düzenlemek hiç sayfa açmaz.
 */
export function reachedTextLimit(limit, previous, next) {
  return !isAtTextLimit(limit, previous) && isAtTextLimit(limit, next);
}
