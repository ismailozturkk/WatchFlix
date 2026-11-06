// hooks/useHapticPrefs.js
//
// Titreşim tercihlerini (`{ enabled, level, intensity, categories }`) okur ve
// depodaki anahtarlar değişince yeniden çizer. Yazma servis fonksiyonlarıyla
// yapılır (setHapticLevel …); ana anahtar AppSettingsContext üzerinden yazılır ki
// "açınca önizleme titreşimi" kuralı tek yerde kalsın.

import { useEffect, useState } from "react";
import { getHapticPrefs, subscribeHapticPrefs } from "../services/hapticsService";

export default function useHapticPrefs() {
  const [prefs, setPrefs] = useState(getHapticPrefs);
  useEffect(() => {
    // Abone olmadan önceki değişiklik kaçmasın diye bir kez tazele.
    setPrefs(getHapticPrefs());
    return subscribeHapticPrefs(() => setPrefs(getHapticPrefs()));
  }, []);
  return prefs;
}
