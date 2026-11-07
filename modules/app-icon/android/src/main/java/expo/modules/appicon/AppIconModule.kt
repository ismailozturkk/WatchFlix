package expo.modules.appicon

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Seelogd — uygulama simgesi değiştirme köprüsü (Android).
//
// Model (plugins/withAlternateAppIcons.js üretir): MainActivity HER ZAMAN
// etkindir (derin bağlantılar + widget'lar ona bağlı); başlatıcıda görünen
// simge, aralarından TAM BİRİ etkin olan `activity-alias` bileşenlerinden
// gelir: `.MainActivityDefault`, `.MainActivityGlass`, ...
//
// Hazır `expo-alternate-app-icons` paketi bu modeli kullanmıyor: simge
// değişince MainActivity'yi devre dışı bırakıyor, bu da seelogd:// bağlantılarını
// ve widget'ların `Intent(context, MainActivity)` çağrılarını öldürüyor.
//
// Sözleşme (iOS modülüyle aynı): ad "Default" varsayılan simgedir; `names`
// JS kataloğundaki TÜM adlardır (utils/appIcons.js).
private const val DEFAULT_NAME = "Default"
private const val ALIAS_PREFIX = "MainActivity"

class AppIconModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SeelogdAppIcon")

    // Alias'lar manifestte yoksa (plugin'siz üretilmiş bir geliştirme build'i)
    // özellik kapalı sayılır; JS ayar kartını gizler.
    AsyncFunction("isSupportedAsync") {
      isSupported()
    }

    // `names` içinden bu yapının manifestinde alias'ı OLANLAR. Katalog (JS, OTA ile
    // gelir) binary'den önce büyüyebilir; JS yalnız bunları seçtirir ve gönderir.
    AsyncFunction("getAvailableNamesAsync") { names: List<String> ->
      names.filter { aliasExists(it) }
    }

    AsyncFunction("getAppIconNameAsync") { names: List<String> ->
      currentIconName(names)
    }

    AsyncFunction("setAppIconNameAsync") { name: String, names: List<String> ->
      applyIcon(name, names)
    }
  }

  // Alias sınıf adı = MainActivity'nin paketi + "MainActivity<Ad>". Paketi
  // çalışan activity'nin SINIFINDAN al: namespace ile applicationId farklı
  // olsaydı bile (ComponentName sınıf için namespace'i ister) doğru çıkar.
  private fun aliasComponent(name: String): ComponentName {
    val activityClass = appContext.currentActivity?.javaClass?.name
    val classPackage = activityClass?.substringBeforeLast('.', context.packageName)
      ?: context.packageName
    return ComponentName(context.packageName, "$classPackage.$ALIAS_PREFIX$name")
  }

  private fun aliasExists(name: String): Boolean {
    return try {
      context.packageManager.getActivityInfo(
        aliasComponent(name),
        PackageManager.MATCH_DISABLED_COMPONENTS
      )
      true
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }
  }

  private fun isSupported(): Boolean = aliasExists(DEFAULT_NAME)

  private fun currentIconName(names: List<String>): String {
    val pm = context.packageManager
    for (name in names) {
      val state = try {
        pm.getComponentEnabledSetting(aliasComponent(name))
      } catch (e: IllegalArgumentException) {
        PackageManager.COMPONENT_ENABLED_STATE_DEFAULT
      }
      if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) return name
    }
    // Hiçbiri AÇIKÇA etkinleştirilmemiş: manifest varsayılanı (Default etkin).
    return DEFAULT_NAME
  }

  private fun applyIcon(name: String, names: List<String>): String {
    if (!names.contains(name)) {
      throw CodedException("ERR_APP_ICON_UNKNOWN", "Bilinmeyen simge: $name", null)
    }
    if (!isSupported()) {
      throw CodedException(
        "ERR_APP_ICON_UNSUPPORTED",
        "Bu yapı alternatif simgeleri içermiyor (withAlternateAppIcons plugin'i eksik).",
        null
      )
    }
    if (!aliasExists(name)) {
      throw CodedException("ERR_APP_ICON_UNAVAILABLE", "Bu yapıda \"$name\" simgesi yok.", null)
    }
    val pm = context.packageManager
    // ÖNCE hedefi etkinleştir, sonra diğerlerini kapat: her an en az bir
    // başlatıcı girişi kalsın. DONT_KILL_APP: uygulama açık kalır; başlatıcı
    // simgeyi birkaç saniye içinde, kimi üreticiler uygulamayı kapatarak
    // yeniler (Android'in belgelenmiş davranışı).
    pm.setComponentEnabledSetting(
      aliasComponent(name),
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
      PackageManager.DONT_KILL_APP
    )
    for (other in names) {
      if (other == name) continue
      // Bu yapıda olmayan alias'ı kapatmaya çalışmak IllegalArgumentException
      // fırlatır ve hedef zaten açılmışken tüm değişimi hata diye düşürürdü.
      try {
        pm.setComponentEnabledSetting(
          aliasComponent(other),
          PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
          PackageManager.DONT_KILL_APP
        )
      } catch (e: IllegalArgumentException) {
        continue
      }
    }
    return name
  }
}
