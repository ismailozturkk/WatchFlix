// Part 23.1: gercek/calisan birim test altyapisi.
// Bu repoda jest-expo/react-native-testing-library veya bir Firestore
// emulator/test-renderer altyapisi YOKTUR; bu nedenle yalnizca saf JS
// modulleri (RN/Firebase importu olmayan) test edilir. UI bilesenleri ve
// Firestore'a bagli kod bu config ile test edilmez (bkz. Part 23 not).
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  // __tests__/helpers/* test degil, yardimci modul.
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/helpers/"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  // SDK 57 ile babel-preset-expo, `process.env.X` okumalarini derleme aninda
  // `expo/virtual/env` modulunden okunacak sekilde yeniden yaziyor. O dosya ESM
  // ("export const env = ...") ve jest node_modules'u varsayilan olarak
  // donusturmedigi icin `process.env` kullanan her saf modul
  // "SyntaxError: Unexpected token 'export'" ile patliyordu.
  // Yalniz expo paketi istisna tutuldu; kalan node_modules donusturulmuyor
  // (bkz. yukaridaki not: burada RN/Firebase bagimli kod test edilmiyor).
  transformIgnorePatterns: ["node_modules/(?!(expo)/)"],
  // `__DEV__` normalde Metro tarafından tanımlanır; jest'te yok. Test edilen
  // saf modüller bile artık (analytics/crash raporlama sarmalayıcıları
  // üzerinden) bu bayrağı okuyabiliyor — tanımsız kalırsa ReferenceError.
  // `false` seçildi: geliştirme günlükleri test çıktısını kirletmesin.
  globals: { __DEV__: false },
};
