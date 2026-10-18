// Değerlendirme betiğini jest üzerinden çalıştırır: uygulamanın istem kurucuları
// (services/aiCineService vb.) ESM + babel gerektirdiği için ana jest altyapısını
// yeniden kullanıyoruz. `npm test` bu dosyayı ÇALIŞTIRMAZ (testMatch farklı).
const path = require("path");
const base = require("../../jest.config.js");

module.exports = {
  ...base,
  rootDir: path.resolve(__dirname, "../.."),
  testMatch: ["<rootDir>/scripts/ai-eval/run.eval.js"],
  testPathIgnorePatterns: ["/node_modules/"],
  testTimeout: 6 * 60 * 60 * 1000,
  // Gerçek ağ çağrıları: konsol çıktısı gecikmeden görünsün.
  verbose: false,
};
