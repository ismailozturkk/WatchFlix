package com.smlztrk.seelogd.widget

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * JS → "İstatistikler" widget'ı köprüsü. Sözleşme services/statsWidgetService.js
 * ile aynı: updateStats(payload, language) / clearStats().
 */
class StatsWidgetModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {

  override fun getName(): String = "StatsWidgetModule"

  @ReactMethod
  fun updateStats(payload: String, language: String, promise: Promise) {
    try {
      context
        .getSharedPreferences(StatsWidgetProvider.PREFS_NAME, 0)
        .edit()
        .putString(StatsWidgetProvider.KEY_STATS, payload)
        .putString(StatsWidgetProvider.KEY_LANGUAGE, language)
        .apply()
      StatsWidgetProvider.refreshAll(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("STATS_WIDGET_UPDATE_FAILED", error)
    }
  }

  @ReactMethod
  fun clearStats(promise: Promise) {
    try {
      context
        .getSharedPreferences(StatsWidgetProvider.PREFS_NAME, 0)
        .edit()
        .remove(StatsWidgetProvider.KEY_STATS)
        .apply()
      StatsWidgetProvider.refreshAll(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("STATS_WIDGET_CLEAR_FAILED", error)
    }
  }
}
