// services/appReload.js
//
// Uygulamayı JS katmanından yeniden yükler (açılışta senkron okunan ayarların
// yeniden kurulması için). Üç durum:
//   • release / EAS build      → expo-updates `reloadAsync`
//   • geliştirme build'i       → `reloadAsync` fırlatır, DevSettings.reload'a düşülür
//   • ikisi de yoksa           → false döner; çağıran kullanıcıya "uygulamayı kapatıp
//                                yeniden aç" der (ayarlar zaten diskte).

export async function reloadApp() {
  try {
    // eslint-disable-next-line global-require
    const Updates = require("expo-updates");
    if (Updates?.reloadAsync) {
      await Updates.reloadAsync();
      return true;
    }
  } catch {
    // güncelleme modülü kapalı/yok: sıradaki yolu dene
  }
  try {
    // eslint-disable-next-line global-require
    const { DevSettings } = require("react-native");
    if (DevSettings?.reload) {
      DevSettings.reload();
      return true;
    }
  } catch {
    // yok
  }
  return false;
}
