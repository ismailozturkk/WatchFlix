// Part 23.1: gercek/calisan birim test altyapisi.
// Bu repoda jest-expo/react-native-testing-library veya bir Firestore
// emulator/test-renderer altyapisi YOKTUR; bu nedenle yalnizca saf JS
// modulleri (RN/Firebase importu olmayan) test edilir. UI bilesenleri ve
// Firestore'a bagli kod bu config ile test edilmez (bkz. Part 23 not).
module.exports = {
  testEnvironment: "node",
  // Cam sarmalayıcılarının import zincirini hafifleten ortak taklitler (jest.setup.js).
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/__tests__/**/*.test.js"],
  // __tests__/helpers/* test degil, yardimci modul.
  // __tests__/rules/* calisan bir Firestore emulatoru ister; `npm test`
  // emulatorsuz kosabilmeli (bkz. jest.rules.config.js + `npm run test:rules`).
  testPathIgnorePatterns: [
    "/node_modules/",
    "/__tests__/helpers/",
    "/__tests__/rules/",
  ],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  // Yerel splash kataloğu gibi saf metadata modülleri statik görsel require
  // eder. Node/Jest ikili dosyayı JS gibi açmaya çalışmasın.
  moduleNameMapper: {
    "\\.(jpg|jpeg|png|webp)$": "<rootDir>/__mocks__/fileMock.js",
  },
  // SDK 57 ile babel-preset-expo, `process.env.X` okumalarini derleme aninda
  // `expo/virtual/env` modulunden okunacak sekilde yeniden yaziyor. O dosya ESM
  // ("export const env = ...") ve jest node_modules'u varsayilan olarak
  // donusturmedigi icin `process.env` kullanan her saf modul
  // "SyntaxError: Unexpected token 'export'" ile patliyordu.
  // Yalniz expo paketi istisna tutuldu; kalan node_modules donusturulmuyor
  // (bkz. yukaridaki not: burada RN/Firebase bagimli kod test edilmiyor).
  // `react-native` de dönüştürülür: __tests__/splashPosterWave.render.test.js GERÇEK
  // Animated düğüm sınıflarını (Flow tipli kaynak) yükler. Yalnız gerçekten require
  // edilen dosyalar dönüştürülür; react-native'i tümden taklit eden testler etkilenmez.
  transformIgnorePatterns: ["node_modules/(?!(expo|react-native|@react-native)/)"],
  // `__DEV__` normalde Metro tarafından tanımlanır; jest'te yok. Test edilen
  // saf modüller bile artık (analytics/crash raporlama sarmalayıcıları
  // üzerinden) bu bayrağı okuyabiliyor — tanımsız kalırsa ReferenceError.
  // `false` seçildi: geliştirme günlükleri test çıktısını kirletmesin.
  globals: { __DEV__: false },
};
