package com.smlztrk.seelogd.widget

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import com.smlztrk.seelogd.MainActivity
import com.smlztrk.seelogd.R

/**
 * Widget başlıklarındaki marka simgesi: kullanıcının SEÇTİĞİ uygulama simgesi.
 *
 * Simge modeli (plugins/withAlternateAppIcons.js + modules/app-icon): MainActivity
 * hep etkindir; başlatıcıda görünen simge, `.MainActivityDefault` ve alternatif
 * alias'ları (`.MainActivityGlass`, ...) arasında TAM BİRİNİN etkin olmasından gelir.
 * Alternatiflerin simge kaynakları `res/mipmap-*` altında `icon_alt_<ad>`
 * adıyla üretilir. Layout'taki sabit `@mipmap/ic_launcher` yalnız varsayılandır;
 * burası etkin alias'a bakıp doğru kaynağı verir (provider'lar RemoteViews'a basar).
 *
 * ALTERNATES, JS kataloğuyla (utils/appIcons.js) aynı olmak zorunda — yeni bir
 * simge eklenirse buraya da satır eklenir (__tests__/appIcons.test.js bunu doğrular).
 */
object AppIconRes {
  private val ALTERNATES = listOf(
    "Glass" to "icon_alt_glass",
  )

  fun launcherIcon(context: Context): Int {
    val pm = context.packageManager
    val activityClass = MainActivity::class.java.name
    for ((alias, resourceName) in ALTERNATES) {
      val state = try {
        pm.getComponentEnabledSetting(ComponentName(context.packageName, "$activityClass$alias"))
      } catch (e: IllegalArgumentException) {
        // Alias bu yapıda yok (plugin'siz build): varsayılan simgeye düş.
        continue
      }
      if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
        val id = context.resources.getIdentifier(resourceName, "mipmap", context.packageName)
        if (id != 0) return id
      }
    }
    return R.mipmap.ic_launcher
  }
}
