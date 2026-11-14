// hooks/useRatingScale.js — Ayarlar > Kişiselleştirme'deki puan ölçeği ("ten" | "five").
// Saklanan puanlar hep 0-10; bu yalnız giriş/gösterim tercihidir (utils/ratingScale).
import { Keys, set, useStored } from "../services/storage";
import { DEFAULT_RATING_SCALE, isRatingScale } from "../utils/ratingScale";

export default function useRatingScale() {
  const raw = useStored(Keys.ratingScale);
  return isRatingScale(raw) ? raw : DEFAULT_RATING_SCALE;
}

export function setRatingScale(scale) {
  if (!isRatingScale(scale)) return;
  set(Keys.ratingScale, scale);
}
