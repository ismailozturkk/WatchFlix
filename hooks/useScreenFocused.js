// hooks/useScreenFocused.js
//
// Bulunduğu ekran şu an odakta mı? Sürekli dönen dekor (kar, ambiyans arka planı)
// odaktan çıkınca durdurulur: görünmeyen ekranın animasyonu boşuna çalışmasın.
//
// useIsFocused yerine manuel abonelik: useIsFocused navigator dışında (modal,
// portal vb.) throw ediyor. Burada context yoksa ekran hep "odakta" sayılır,
// yani hook her yerde güvenle kullanılabilir.

import { useContext, useEffect, useState } from "react";
import { NavigationContext } from "@react-navigation/native";

export default function useScreenFocused() {
  const navigation = useContext(NavigationContext);
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

  return focused;
}
