import "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { registerRootComponent } from "expo";
import { applyStyleSheetCompat } from "./utils/styleSheetCompat";

// RN 0.85'te kaldırılan StyleSheet.absoluteFillObject'i geri koyar. Güncellenmeyen
// üçüncü parti paketler (circular-progress-indicator, calendars/Timeline) bu alanı
// hâlâ okuyor ve yokken mutlak konumlandırmayı kaybediyorlar. Ayrıntı ve gerekçe:
// utils/styleSheetCompat.js. Paketler alanı render sırasında okuduğu için
// registerRootComponent'ten önce çalışması yeterli.
applyStyleSheetCompat(StyleSheet);

// Sadece registerRootComponent kullanın
// Native tab-bar QA uses an isolated fixture and never authenticates or writes
// backend data. Release builds always register the real application.
const RootComponent = __DEV__ && process.env.EXPO_PUBLIC_TAB_BAR_QA === "1"
  ? require("./screens/development/TabBarQaScreen").default
  : require("./App").default;
registerRootComponent(RootComponent);
