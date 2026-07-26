package com.smlztrk.seelogd.widget

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Üç ana ekran widget'ının JS köprülerini kaydeder:
 * Yaklaşanlar (Reminder), Listelerim (Lists), İstatistikler (Stats).
 *
 * Autolink edilemez (yerel klasik modüller) — MainApplication.getPackages()
 * içinde elle eklenir.
 */
class SeelogdWidgetPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext,
  ): List<NativeModule> = listOf(
    ReminderWidgetModule(reactContext),
    ListsWidgetModule(reactContext),
    StatsWidgetModule(reactContext),
  )

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
