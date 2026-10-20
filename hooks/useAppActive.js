// hooks/useAppActive.js
//
// Uygulama ön planda mı? Sürekli dönen animasyonları (sprite pet, Lottie FAB)
// arka plana geçince durdurmak için. Arka planda dönen bir animasyon ekrana
// çizilmez ama zamanlayıcısı/JS işi çalışmaya devam eder — pil ve ısınma
// maliyeti ödenip karşılığında hiçbir şey görünmez.
import { useEffect, useState } from "react";
import { AppState } from "react-native";

export default function useAppActive() {
  const [active, setActive] = useState(
    () => AppState.currentState !== "background" && AppState.currentState !== "inactive",
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      setActive(next === "active");
    });
    return () => sub.remove();
  }, []);

  return active;
}
