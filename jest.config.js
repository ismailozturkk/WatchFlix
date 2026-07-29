// Part 23.1: gercek/calisan birim test altyapisi.
// Bu repoda jest-expo/react-native-testing-library veya bir Firestore
// emulator/test-renderer altyapisi YOKTUR; bu nedenle yalnizca saf JS
// modulleri (RN/Firebase importu olmayan) test edilir. UI bilesenleri ve
// Firestore'a bagli kod bu config ile test edilmez (bkz. Part 23 not).
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  // `__DEV__` normalde Metro tarafından tanımlanır; jest'te yok. Test edilen
  // saf modüller bile artık (analytics/crash raporlama sarmalayıcıları
  // üzerinden) bu bayrağı okuyabiliyor — tanımsız kalırsa ReferenceError.
  // `false` seçildi: geliştirme günlükleri test çıktısını kirletmesin.
  globals: { __DEV__: false },
};
