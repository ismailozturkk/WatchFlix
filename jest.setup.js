// Ortak jest kurulumu (jest.config.js → setupFiles). Yalnız "yerine geçen" cam
// sarmalayıcılarının (components/common/Glass{Touchable,Pressable,Box,TextInput})
// import zincirini hafif tutar: bu bileşenler düğme/alan olan HER yerde import
// edildiği için, react-native'i kendi başına taklit eden bileşen testleri
// expo-blur (ESM) ve expo-modules-core'u çekmesin.
//
// Varsayılan: cam KAPALI → sarmalayıcılar eski bileşeni (TouchableOpacity,
// Pressable, View, TextInput) aynen çizer. Cam yolunu sınayan testler
// (glassWrappers, glassField, glassSurface…) kendi jest.mock'larıyla bunun
// üstüne yazar.
jest.mock("expo-blur", () => ({
  BlurView: "BlurView",
  BlurTargetView: "BlurTargetView",
}));

// GlassSurface'ın Android buzlu cam parlaması degrade kullanır; paket ESM.
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));

jest.mock("./services/liquidGlass", () => ({
  liquidGlassSupported: false,
  NativeGlassView: null,
  useLiquidGlass: () => false,
  useGlassMode: () => "off",
  useGlassShape: () => false,
}));

// Cam sarmalayıcıları, cam KAPALIYKEN eski bileşenle birebir aynıdır (araya View
// girmez, prop'lar aynen geçer). Tüketici testleri yapıya bakar (testID sayımı,
// ebeveyn zinciri, düğüm türü) ve araya giren bileşen katmanını görmemeli; bu
// yüzden varsayılan olarak doğrudan eski bileşene eşlenirler. Sarmalayıcıların
// KENDİ davranışı __tests__/glassWrappers.test.js'te (jest.unmock ile) sınanır.
// `react-native` BİLEREK tembel okunur: her test dosyası onu kendi taklidiyle
// değiştiriyor, fabrika ilk import anında çalışınca o taklidi görür.
jest.mock("./components/common/GlassTouchable", () => ({
  __esModule: true,
  get default() {
    return require("react-native").TouchableOpacity;
  },
}));
jest.mock("./components/common/GlassPressable", () => ({
  __esModule: true,
  get default() {
    return require("react-native").Pressable;
  },
}));
jest.mock("./components/common/GlassBox", () => ({
  __esModule: true,
  get default() {
    return require("react-native").View;
  },
}));
jest.mock("./components/common/GlassTextInput", () => ({
  __esModule: true,
  get default() {
    return require("react-native").TextInput;
  },
}));

// Marka ikonları (profil sosyal hesap şeridi): paket ESM; testte düz bileşen yeter.
jest.mock("@expo/vector-icons/FontAwesome6", () => ({ __esModule: true, default: "FontAwesome6" }));
