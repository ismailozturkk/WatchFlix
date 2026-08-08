// utils/notificationPriming.js
//
// "Bildirim izni ön-açıklama sayfasını ŞİMDİ açalım mı?" kararı. Tek yer.
//
// NEDEN ÖN-AÇIKLAMA VAR: sistem izin diyaloğu iOS'ta hesap/cihaz başına BİR KEZ
// açılır. Kullanıcı neden sorulduğunu bilmeden "İzin verme" derse o hak yanar ve
// tek dönüş yolu OS ayarları olur. Bu yüzden sistem diyaloğundan önce kendi
// sayfamızı gösteriyoruz: oradaki "Şimdi değil" hiçbir hakkı yakmaz, sistem
// diyaloğu ancak kullanıcı "İzin ver" dedikten sonra açılır.
//
// KALDIRILAN DAVRANIŞ: eskiden açılıştan ~4.2 sn sonra izin habersiz
// isteniyordu (DeviceNotificationsContext'teki "auto-ask" effect'i). Kullanıcı
// hangi bağlamda sorulduğunu göremediği için reddediyor, ardından hatırlatmalar
// sessizce HİÇ zamanlanmıyordu — ayarlarda her şey açık göründüğü hâlde.

/**
 * Bir alt sayfanın kapanışı ile ön-açıklama sayfasının açılışı arasındaki nefes
 * payı; sistem izin diyaloğunun açılışında da aynısı kullanılıyor.
 *
 * BottomSheetModal'ın çıkış animasyonu ≈260 ms sürüyor ve o süre boyunca sayfa
 * hâlâ çiziliyor. Üstüne ikinci bir Modal (ya da native izin uyarısı) bindirmek
 * iOS'ta kapanışı yarıda kesip ekranı dokunulamaz bırakabiliyor.
 */
export const PRIME_HANDOFF_MS = 280;

/**
 * Ön-açıklama sayfası açılmalı mı?
 *
 * Dört kapının HEPSİ geçilmeli. Sıra önemli değil, hepsi "hayır" tarafına
 * çalışıyor:
 *
 *   alreadyPrimed        Sayfa TEK SEFERLİK. Bir kez gösterilip sonuçlandıysa
 *                        (ister "İzin ver" ister "Şimdi değil") bir daha
 *                        kendiliğinden açılmaz; kullanıcı Ayarlar'daki
 *                        NotificationPermissionNotice satırından her zaman
 *                        açabilir. Aksi hâlde Android'de ilk ret kalıcı
 *                        olmadığı için sayfa her hatırlatıcıda geri gelirdi.
 *
 *   notificationsEnabled Uygulama içi ana anahtar kapalıysa OS izni istemek
 *                        kendi kendiyle çelişir.
 *
 *   status === granted   İzin zaten var, sorulacak bir şey yok.
 *
 *   canAskAgain          false ise sistem diyaloğu ARTIK AÇILMAZ; sayfayı
 *                        göstermek çalışmayan bir "İzin ver" düğmesi sunmak
 *                        olurdu. Bu durumda doğru yüzey ayarlardaki uyarı
 *                        satırı (kullanıcıyı OS ayarlarına götürüyor).
 *                        Değer eksikse (undefined) de göstermiyoruz — ölü
 *                        düğme riskini almaktansa hiç sormamak yeğ.
 *
 * @param {object} params
 * @param {string} [params.status] expo-notifications izin durumu
 * @param {boolean} [params.canAskAgain] sistem diyaloğu hâlâ açılabilir mi
 * @param {boolean} [params.alreadyPrimed] sayfa daha önce gösterildi mi
 * @param {boolean} [params.notificationsEnabled] uygulama içi ana anahtar
 * @returns {boolean}
 */
export function shouldPrimeNotifications({
  status,
  canAskAgain,
  alreadyPrimed,
  notificationsEnabled,
} = {}) {
  if (alreadyPrimed) return false;
  // Ana anahtar varsayılan olarak AÇIK; yalnız açıkça false ise kapalı say
  // (ayarlar henüz yüklenmemişken undefined geliyor).
  if (notificationsEnabled === false) return false;
  if (status === "granted") return false;
  if (!canAskAgain) return false;
  return true;
}
