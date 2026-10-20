package com.smlztrk.seelogd.widget

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * JS → "Listelerim" widget'ı köprüsü. Sözleşme services/listsWidgetService.js
 * ile aynı: updateLists(payload, language) / clearLists().
 */
class ListsWidgetModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {

  override fun getName(): String = "ListsWidgetModule"

  @ReactMethod
  fun updateLists(payload: String, language: String, promise: Promise) {
    try {
      context
        .getSharedPreferences(ListsWidgetProvider.PREFS_NAME, 0)
        .edit()
        .putString(ListsWidgetProvider.KEY_LISTS, payload)
        .putString(ListsWidgetProvider.KEY_LANGUAGE, language)
        .apply()
      ListsWidgetProvider.refreshAll(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("LISTS_WIDGET_UPDATE_FAILED", error)
    }
  }

  @ReactMethod
  fun clearLists(promise: Promise) {
    try {
      context
        .getSharedPreferences(ListsWidgetProvider.PREFS_NAME, 0)
        .edit()
        .remove(ListsWidgetProvider.KEY_LISTS)
        .apply()
      ListsWidgetProvider.refreshAll(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("LISTS_WIDGET_CLEAR_FAILED", error)
    }
  }

  @ReactMethod
  fun updatePreferences(payload: String, promise: Promise) {
    try {
      WidgetPreferences.save(context, payload)
      ListsWidgetProvider.refreshAll(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("LISTS_WIDGET_PREFERENCES_FAILED", error)
    }
  }
}
