// Firestore KURAL testleri — ayrı config, çünkü çalışan bir Firestore
// emülatörü ister ve `npm test` (saf JS birim testleri) emülatörsüz çalışmak
// zorunda. Çalıştırma: `npm run test:rules` — firebase CLI emülatörü açıp
// jest'i bu config ile koşturur ve sonra kapatır.
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/rules/**/*.test.js"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  // Emülatöre yazan testler saf mantık testlerinden yavaş; varsayılan 5 sn
  // ilk bağlantıda (JVM ısınması) yetmiyor.
  testTimeout: 30000,
};
