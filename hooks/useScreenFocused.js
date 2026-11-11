// hooks/useScreenFocused.js
//
// Bulunduğu ekran şu an odakta mı? Sürekli dönen dekor (kar, ambiyans arka planı)
// odaktan çıkınca durdurulur: görünmeyen ekranın animasyonu boşuna çalışmasın.
//
// useIsFocused yerine manuel abonelik: useIsFocused navigator dışında (modal,
// portal vb.) throw ediyor. Burada context yoksa ekran hep "odakta" sayılır,
// yani hook her yerde güvenle kullanılabilir.
//
// Kök sekmeler: sekme değişimi navigasyon açısından blur DEĞİL (hepsi aynı kök
// rotada). Sekme kabuğunun TabActiveContext'i de hesaba katılır; aksi halde
// gizli sekmelerin atmosfer tuvali / alevi / döngüleri dönmeye devam eder.

import { useContext, useEffect, useState } from "react";
import { NavigationContext } from "@react-navigation/native";
import { TabActiveContext } from "../context/TabActiveContext";

// Test ortamında @react-navigation/native kısmi taklit edilebiliyor; bağlam
// yoksa "navigator dışı" gibi davran (modül sabiti: kanca sırası değişmez).
const NAV_CONTEXT = NavigationContext || TabActiveContext;
const HAS_NAV_CONTEXT = Boolean(NavigationContext);

export default function useScreenFocused() {
  const navContextValue = useContext(NAV_CONTEXT);
  const navigation = HAS_NAV_CONTEXT ? navContextValue : null;
  const tabActive = useContext(TabActiveContext);
  const [focused, setFocused] = useState(
    () => navigation?.isFocused?.() ?? true,
  );

  useEffect(() => {
    if (!navigation) return undefined;
    setFocused(navigation.isFocused());
    const unsubFocus = navigation.addListener("focus", () => setFocused(true));
    const unsubBlur = navigation.addListener("blur", () => setFocused(false));
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  return focused && tabActive;
}
