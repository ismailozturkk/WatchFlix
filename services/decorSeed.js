// services/decorSeed.js
//
// Arka plan deseninin tohumu: ikon yerleşimi ve ambiyans renkleri bundan
// türer (bkz. utils/decorLayout.js). İlk ihtiyaçta rastgele üretilir, MMKV'ye
// yazılır; sonra her ekranda ve her açılışta aynı desen çizilir. Ayar
// yedeğine girer → yeni cihaza geri yüklenince aynı desen gelir.

import { useEffect } from "react";
import { Keys, get, set, useStored } from "./storage";
import { isValidSeed, newDecorSeed } from "../utils/decorLayout";

// Kayıt yoksa oturum içinde tek bir aday kullanılır; ilk effect onu yazar.
// Render sırasında depoya YAZILMAZ (abonelere render içinde bildirim gitmesin).
let sessionSeed = 0;

/** Senkron tohum okuma (render içinde güvenli, yazmaz). */
export function getDecorSeed() {
  const stored = get(Keys.decorSeed);
  if (isValidSeed(stored)) return stored;
  if (!sessionSeed) sessionSeed = newDecorSeed();
  return sessionSeed;
}

/** Tepkisel tohum: "Yeniden oluştur" sonrası tüm ekranlar yeni deseni çizer. */
export function useDecorSeed() {
  const stored = useStored(Keys.decorSeed);
  const seed = isValidSeed(stored) ? stored : getDecorSeed();
  useEffect(() => {
    if (!isValidSeed(get(Keys.decorSeed))) set(Keys.decorSeed, seed);
  }, [seed]);
  return seed;
}

/** Yeni desen: yeni tohum yazılır, abone olan her katman yeniden çizer. */
export function reshuffleDecorSeed() {
  let next = newDecorSeed();
  const current = get(Keys.decorSeed);
  if (next === current) next = newDecorSeed();
  sessionSeed = next;
  set(Keys.decorSeed, next);
  return next;
}
