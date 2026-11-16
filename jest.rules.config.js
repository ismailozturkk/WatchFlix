// Firestore KURAL testleri — ayrı config, çünkü çalışan bir Firestore
// emülatörü ister ve `npm test` (saf JS birim testleri) emülatörsüz çalışmak
// zorunda. Çalıştırma: `npm run test:rules` — firebase CLI emülatörü açıp
// jest'i bu config ile koşturur ve sonra kapatır.
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/rules/**/*.test.js"],
  // `.claude/` altındaki oturum worktree'leri aynı emülatöre paralel yazıp
  // birbirinin verisini siliyordu (sahte FAIL).
  testPathIgnorePatterns: ["/node_modules/", "/\\.claude/"],
  modulePathIgnorePatterns: ["<rootDir>/\\.claude/"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  // Emülatöre yazan testler saf mantık testlerinden yavaş; varsayılan 5 sn
  // ilk bağlantıda (JVM ısınması) yetmiyor.
  testTimeout: 30000,
  // E-posta doğrulama kapısı: test kullanıcıları varsayılan olarak doğrulanmış.
  setupFiles: ["<rootDir>/__tests__/rulesSetup/verifiedTokenDefault.js"],
};
