// screens/tabs/settings/backupCopy.js
//
// "Ayarları Yedekle" ekranının metinleri (yerel tr/en çifti; iki dilin anahtar
// eşitliği __tests__/backupCopy.test.js'te bekçilenir). Hata kodları
// services/settingsBackupFiles.js + utils/settingsBackup.js sözleşmesindendir.

const tr = {
  title: "Ayarları Yedekle",

  heroTitle: "Ayarların tek dosyada",
  heroText:
    "Tema, özel temalar, yazı tipi, efektler, düzen, bildirim ve widget tercihlerin yedeklenir. Yeni bir cihaza ya da temiz bir kuruluma geri yükleyebilirsin.",

  sectionIncluded: "Neler dahil",
  groupAppearance: "Görünüm",
  groupAppearanceSub: "Tema, özel temalar, yazı tipi, efektler, arka planlar",
  groupLayout: "Poster ve liste düzeni",
  groupLayoutSub: "Sütunlar, köşeler, rozetler, görünüm tercihleri",
  groupContent: "Dil ve içerik",
  groupContentSub: "Dil, platformlar, türler, görsel kalitesi",
  groupNotifications: "Bildirim ve titreşim",
  groupNotificationsSub: "Bildirim türleri ve titreşim",
  groupData: "Veri indirme",
  groupDataSub: "Çevrimdışı veri tercihleri",
  groupWidgets: "Widget'lar",
  groupWidgetsSub: "Widget görünümü ve içerik seçimleri",
  groupSharing: "Paylaşım kartları",
  groupSharingSub: "Hikâye ve Wrapped kartı son seçimleri",
  groupPet: "Pet",
  groupPetSub: "Açık/kapalı, boyut ve konum",
  customized: "{n} özelleştirilmiş",
  allDefault: "Varsayılan",
  themeCount: "{n} özel tema",
  themeCountOne: "1 özel tema",
  notIncluded:
    "Dahil değil: hesap bilgileri, şifreler, uygulama simgesi, önbellek, bildirim izinleri ve abonelik durumu.",

  sectionExport: "Dışa aktar",
  exportFile: "Dosya olarak kaydet",
  exportFileSub: "Dosyalara kaydet ya da paylaş · {name}",
  exportClipboard: "Panoya kopyala",
  exportClipboardSub: "Metin olarak; mesajla göndermek için",
  exported: "Yedek hazır",
  copied: "Yedek panoya kopyalandı",

  sectionImport: "İçe aktar",
  importFile: "Dosyadan içe aktar",
  importFileSub: "Bir Seelogd ayar yedeği seç",
  importClipboard: "Panodan içe aktar",
  importClipboardSub: "Kopyaladığın yedek metnini kullan",
  nothingToImport: "Bu yedekte uygulanacak ayar yok",

  sectionRestore: "Geri al",
  restoreTitle: "Son içe aktarmayı geri al",
  restoreSub: "{date} öncesindeki ayarlarına dön",
  restoreConfirmTitle: "Önceki ayarlara dönülsün mü?",
  restoreConfirmBody:
    "Son içe aktarmanın getirdiği ayarlar ve özel temalar kaldırılır. Uygulama yeniden başlar.",
  restoreAction: "Geri al",
  restored: "Önceki ayarlar geri yüklendi",

  sheetTitle: "Yedek bulundu",
  sheetFile: "Dosya",
  sheetWillApply: "{n} ayar uygulanacak",
  sheetWillApplyOne: "1 ayar uygulanacak",
  sheetGroupLine: "{n} ayar",
  sheetGroupLineOne: "1 ayar",
  sheetThemes: "Özel temalar",
  sheetThemesNew: "{n} yeni",
  sheetThemesUpdated: "{n} güncellenecek",
  sheetThemesKept: "{n} mevcut temana dokunulmaz",
  sheetThemesKeptOne: "1 mevcut temana dokunulmaz",
  warnInvalid: "{n} ayar geçersiz olduğu için atlanacak",
  warnInvalidOne: "1 ayar geçersiz olduğu için atlanacak",
  warnThemeMissing: "Yedekteki seçili tema bulunamadığı için varsayılan tema kullanılacak",
  warnThemesDropped: "{n} özel tema geçersiz ya da çok fazla olduğu için eklenmeyecek",
  warnThemesDroppedOne: "1 özel tema geçersiz ya da çok fazla olduğu için eklenmeyecek",
  restartNote:
    "Uygulama yeniden başlatılır. Şu anki ayarların, geri almak istersen saklanır.",
  confirm: "İçe aktar",
  cancel: "Vazgeç",
  applying: "Uygulanıyor…",

  imported: "Ayarlar içe aktarıldı",
  importedPartial: "{n} ayar uygulanamadı",
  importedPartialOne: "1 ayar uygulanamadı",
  manualRestartTitle: "Yeniden başlat",
  manualRestartBody:
    "Ayarlar kaydedildi. Hepsinin etkinleşmesi için uygulamayı kapatıp yeniden aç.",

  errEmpty: "İçinde yedek bulunamadı",
  errNotBackup: "Bu, bir Seelogd ayar yedeği değil",
  errTooNew: "Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Önce uygulamayı güncelle.",
  errTooLarge: "Dosya çok büyük",
  errReadFailed: "Dosya okunamadı",
  errWriteFailed: "Yedek dosyası oluşturulamadı",
  errSharing: "Bu cihazda paylaşım kullanılamıyor. Panoya kopyalamayı dene.",
  errClipboard: "Panoya erişilemedi",

  platformIos: "iOS",
  platformAndroid: "Android",
};

const en = {
  title: "Back Up Settings",

  heroTitle: "Your settings in one file",
  heroText:
    "Your theme, custom themes, font, effects, layout, notification and widget preferences are saved together. Restore them on a new device or a clean install.",

  sectionIncluded: "What's included",
  groupAppearance: "Appearance",
  groupAppearanceSub: "Theme, custom themes, font, effects, backgrounds",
  groupLayout: "Poster and list layout",
  groupLayoutSub: "Columns, corners, badges, view preferences",
  groupContent: "Language and content",
  groupContentSub: "Language, platforms, genres, image quality",
  groupNotifications: "Notifications and haptics",
  groupNotificationsSub: "Notification types and haptics",
  groupData: "Data download",
  groupDataSub: "Offline data preferences",
  groupWidgets: "Widgets",
  groupWidgetsSub: "Widget look and content choices",
  groupSharing: "Share cards",
  groupSharingSub: "Last story and Wrapped card choices",
  groupPet: "Pet",
  groupPetSub: "On/off, size and position",
  customized: "{n} customized",
  allDefault: "Default",
  themeCount: "{n} custom themes",
  themeCountOne: "1 custom theme",
  notIncluded:
    "Not included: account details, passwords, app icon, cache, notification permissions and subscription status.",

  sectionExport: "Export",
  exportFile: "Save as a file",
  exportFileSub: "Save to Files or share · {name}",
  exportClipboard: "Copy to clipboard",
  exportClipboardSub: "As text, to send in a message",
  exported: "Backup ready",
  copied: "Backup copied to the clipboard",

  sectionImport: "Import",
  importFile: "Import from a file",
  importFileSub: "Pick a Seelogd settings backup",
  importClipboard: "Import from the clipboard",
  importClipboardSub: "Use backup text you copied",
  nothingToImport: "This backup has no settings to apply",

  sectionRestore: "Undo",
  restoreTitle: "Undo the last import",
  restoreSub: "Go back to your settings from before {date}",
  restoreConfirmTitle: "Go back to your previous settings?",
  restoreConfirmBody:
    "Settings and custom themes brought in by the last import are removed. The app restarts.",
  restoreAction: "Undo",
  restored: "Previous settings restored",

  sheetTitle: "Backup found",
  sheetFile: "File",
  sheetWillApply: "{n} settings will be applied",
  sheetWillApplyOne: "1 setting will be applied",
  sheetGroupLine: "{n} settings",
  sheetGroupLineOne: "1 setting",
  sheetThemes: "Custom themes",
  sheetThemesNew: "{n} new",
  sheetThemesUpdated: "{n} updated",
  sheetThemesKept: "{n} of your current themes stay untouched",
  sheetThemesKeptOne: "1 of your current themes stays untouched",
  warnInvalid: "{n} settings are invalid and will be skipped",
  warnInvalidOne: "1 setting is invalid and will be skipped",
  warnThemeMissing: "The backup's selected theme wasn't found, so the default theme will be used",
  warnThemesDropped: "{n} custom themes are invalid or over the limit and won't be added",
  warnThemesDroppedOne: "1 custom theme is invalid or over the limit and won't be added",
  restartNote: "The app restarts. Your current settings are kept in case you want to undo.",
  confirm: "Import",
  cancel: "Cancel",
  applying: "Applying…",

  imported: "Settings imported",
  importedPartial: "{n} settings couldn't be applied",
  importedPartialOne: "1 setting couldn't be applied",
  manualRestartTitle: "Restart",
  manualRestartBody: "Settings are saved. Close and reopen the app for all of them to take effect.",

  errEmpty: "No backup found inside",
  errNotBackup: "This isn't a Seelogd settings backup",
  errTooNew: "This backup was made with a newer version of the app. Update the app first.",
  errTooLarge: "The file is too large",
  errReadFailed: "The file couldn't be read",
  errWriteFailed: "The backup file couldn't be created",
  errSharing: "Sharing isn't available on this device. Try copying to the clipboard.",
  errClipboard: "Couldn't access the clipboard",

  platformIos: "iOS",
  platformAndroid: "Android",
};

export const BACKUP_COPY = { tr, en };

export const getBackupCopy = (isEn) => (isEn ? en : tr);

/** "{n}" gibi yer tutucuları doldurur. */
export const fill = (text, values = {}) =>
  String(text).replace(/\{(\w+)\}/g, (_, k) => (k in values ? String(values[k]) : `{${k}}`));

/**
 * Tekil/çoğul: n === 1 ve `<anahtar>One` varsa onu, yoksa `<anahtar>`ı doldurur
 * ("1 custom themes" gibi İngilizce hatalarını önler; Türkçede iki biçim aynı).
 */
export const count = (copy, key, n) =>
  fill(n === 1 && copy[`${key}One`] ? copy[`${key}One`] : copy[key], { n });

const cap = (id) => id.charAt(0).toUpperCase() + id.slice(1);

export const groupTitle = (copy, id) => copy[`group${cap(id)}`] || id;
export const groupSub = (copy, id) => copy[`group${cap(id)}Sub`] || "";

/** Hizmet hata kodu → kullanıcı metni. */
export function errorMessage(copy, code) {
  switch (code) {
    case "empty":
      return copy.errEmpty;
    case "not-json":
    case "not-backup":
      return copy.errNotBackup;
    case "too-new":
      return copy.errTooNew;
    case "too-large":
      return copy.errTooLarge;
    case "write-failed":
      return copy.errWriteFailed;
    case "sharing-unavailable":
      return copy.errSharing;
    case "clipboard-failed":
      return copy.errClipboard;
    default:
      return copy.errReadFailed;
  }
}

export const platformName = (copy, platform) =>
  platform === "ios" ? copy.platformIos : platform === "android" ? copy.platformAndroid : "";
