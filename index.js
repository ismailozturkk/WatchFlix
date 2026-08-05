import "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { registerRootComponent } from "expo";
import { applyStyleSheetCompat } from "./utils/styleSheetCompat";
import App from "./App";

// RN 0.85'te kaldırılan StyleSheet.absoluteFillObject'i geri koyar. Güncellenmeyen
// üçüncü parti paketler (circular-progress-indicator, calendars/Timeline) bu alanı
// hâlâ okuyor ve yokken mutlak konumlandırmayı kaybediyorlar. Ayrıntı ve gerekçe:
// utils/styleSheetCompat.js. Paketler alanı render sırasında okuduğu için
// registerRootComponent'ten önce çalışması yeterli.
applyStyleSheetCompat(StyleSheet);

// Sadece registerRootComponent kullanın
registerRootComponent(App);
