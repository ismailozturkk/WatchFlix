// components/toast/ScreenToastHost.js
//
// iOS'ta `presentation: "fullScreenModal" | "transparentModal"` ile açılan ekranlar kökün ÜSTÜNE
// ayrı bir pencere koyar; kökteki toast arkada kalır (bkz. ToastHost.js). Bu ekranlar kendi
// host'unu taşır — ama yalnız ODAKTAYKEN kayıtlıdır: üstüne başka bir ekran itilince host
// bırakılır, yoksa toast ekranın altında kalan bu host'ta çizilip görünmezdi.
//
//   <View style={styles.root}> ... <ScreenToastHost /> </View>

import React from "react";
import { useIsFocused } from "@react-navigation/native";
import ToastHost from "./ToastHost";

export default function ScreenToastHost() {
  const focused = useIsFocused();
  return <ToastHost scoped enabled={focused} />;
}
