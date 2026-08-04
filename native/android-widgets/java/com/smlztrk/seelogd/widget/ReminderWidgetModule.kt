package com.smlztrk.seelogd.widget

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ReminderWidgetModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {

  override fun getName(): String = "ReminderWidgetModule"

  @ReactMethod
  fun updateReminders(payload: String, language: String, promise: Promise) {
    try {
      context
        .getSharedPreferences(ReminderWidgetProvider.PREFS_NAME, 0)
        .edit()
        .putString(ReminderWidgetProvider.KEY_ITEMS, payload)
        .putString(ReminderWidgetProvider.KEY_LANGUAGE, language)
        .apply()
      ReminderWidgetProvider.refreshAll(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("REMINDER_WIDGET_UPDATE_FAILED", error)
    }
  }

  @ReactMethod
  fun clearReminders(promise: Promise) {
    try {
      context
        .getSharedPreferences(ReminderWidgetProvider.PREFS_NAME, 0)
        .edit()
        .remove(ReminderWidgetProvider.KEY_ITEMS)
        .apply()
      ReminderWidgetProvider.refreshAll(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("REMINDER_WIDGET_CLEAR_FAILED", error)
    }
  }

  @ReactMethod
  fun updatePreferences(payload: String, promise: Promise) {
    try {
      WidgetPreferences.save(context, payload)
      ReminderWidgetProvider.refreshAll(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("REMINDER_WIDGET_PREFERENCES_FAILED", error)
    }
  }
}
