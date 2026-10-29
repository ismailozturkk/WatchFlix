// components/streak/useStreakFlameMotion.js
//
// Alev oynasın mı? Yalnız ekran odaktayken, uygulama öndeyken ve sistemin
// "Hareketi Azalt" ayarı kapalıyken. Görünmeyen bir alevin saati boşuna dönmesin
// (bkz. AmbientBackground useAmbientPlaying — aynı üç koşul).

import useAppActive from "@hooks/useAppActive";
import useReduceMotion from "@hooks/useReduceMotion";
import useScreenFocused from "@hooks/useScreenFocused";

export default function useStreakFlameMotion() {
  const focused = useScreenFocused();
  const appActive = useAppActive();
  const reduceMotion = useReduceMotion();
  return focused && appActive && !reduceMotion;
}
