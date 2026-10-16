// utils/calendarPermissionPlan.js
//
// Ayarlar > İzinlerim > Takvim sayfasında HANGİ bloğun görüneceğine karar verir.
// Saf fonksiyon: izin durumu + Seelogd'un takvime yazdığı etkinlik sayısı girer,
// görünüm planı çıkar (görünüm kendisi components/permissions/CalendarPermissionSheet).
//
// KURALLAR:
//   • İzin yokken "geri çek" gösterilmez — geri çekilecek bir şey yok; yerine
//     izni isteme (ya da kalıcı reddedildiyse sistem ayarlarına gitme) düğmesi var.
//   • Mobil işletim sistemi uygulamanın kendi iznini program ile geri almasına izin
//     VERMEZ. "Geri çek" bu yüzden sistem ayarlarını açar; asıl uygulama içi
//     geri alma, eklenen etkinlikleri kaldırmaktır.
//   • İzin kapalıyken Seelogd, daha önce eklediği etkinlikleri silemez
//     (removeAllEventsFromPhoneCalendar `blocked` döner). Etkinlik varken izin
//     yoksa kullanıcıya bu açıkça söylenir; izin açıkken de kapatmadan ÖNCE
//     etkinlikleri kaldırması önerilir.

/**
 * @param {object} input
 * @param {string} [input.status]        "granted" | "denied" | "undetermined"
 * @param {boolean} [input.canAskAgain]  false = sistem diyaloğu bir daha açılmaz
 * @param {number} [input.savedCount]    Seelogd'un eklediği etkinlik sayısı
 */
export function planCalendarPermissionSheet({ status, canAskAgain, savedCount } = {}) {
  const granted = status === "granted";
  const count = Number.isFinite(savedCount) && savedCount > 0 ? Math.floor(savedCount) : 0;
  const askable = canAskAgain !== false;

  return {
    granted,
    count,
    // İzin yokken tek ana eylem: sor ya da (sorulamıyorsa) sistem ayarlarına git.
    primaryAction: granted ? null : askable ? "request" : "openSettings",
    showDeniedHint: !granted && !askable,
    // İzin yok ama telefonda Seelogd etkinlikleri duruyor: kaldırılamaz durumda.
    showOrphanWarning: !granted && count > 0,
    showCount: granted && count > 0,
    showEmpty: granted && count === 0,
    canRemove: granted && count > 0,
    showRevoke: granted,
    // Kapatmadan önce temizlemeyi öner (izin kapanınca silme imkânı gider).
    showRevokeAdvice: granted && count > 0,
  };
}
