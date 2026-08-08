// __tests__/helpers/storageTestKit.js
//
// MMKV geçişinden sonra servisler tercihlerini AÇILIŞTA SENKRON okuyor. Testin
// "diskte şu kayıt varmış gibi davran" demesi için modül YÜKLENMEDEN ÖNCE
// depoyu tohumlaması gerekiyor; bu yardımcı o sırayı tek yerde tutuyor.
//
// Eskiden her test dosyası kendi kısmi `jest.mock("@react-native-async-storage/…")`
// taklidini yazıyordu (dördü de farklı yüzeyle). Artık MMKV taklidi kök
// __mocks__ klasöründen otomatik geliyor, burada yalnız tohumlama var.

/**
 * Modül kayıt defterini sıfırlar, depoyu verilen değerlerle doldurur ve
 * ardından modülü yükler.
 *
 * @param {(keys: object) => Array<[object, any]>} seed
 *        `Keys` alır, `[descriptor, value]` çiftleri döner.
 * @param {() => any} load  Tohumlamadan SONRA çalıştırılacak require.
 */
function withSeededStorage(seed, load) {
  const storage = require("../../services/storage");
  if (seed) {
    for (const [descriptor, value, options] of seed(storage.Keys)) {
      storage.set(descriptor, value, options);
    }
  }
  return load();
}

module.exports = { withSeededStorage };
