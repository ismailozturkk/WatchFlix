package com.smlztrk.seelogd.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.smlztrk.seelogd.MainActivity
import com.smlztrk.seelogd.R
import org.json.JSONArray
import java.util.Calendar

/**
 * Kaydırılabilir hatırlatma widget'ı. Liste satırları RemoteViewsService
 * (ReminderWidgetRemoteViewsService) tarafından üretilir; provider yalnız
 * başlığı bağlar, adaptörü kurar ve tıklama şablonunu tanımlar.
 */
class ReminderWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    appWidgetIds.forEach { widgetId ->
      updateWidget(context, appWidgetManager, widgetId)
    }
  }

  companion object {
    const val PREFS_NAME = "seelogd_reminder_widget"
    const val KEY_ITEMS = "items"
    const val KEY_LANGUAGE = "language"

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, ReminderWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(component)
      ids.forEach { updateWidget(context, manager, it) }
      // Liste satırlarının (poster/geri sayım) yeniden üretilmesini tetikle.
      manager.notifyAppWidgetViewDataChanged(ids, R.id.reminder_widget_list)
    }

    private fun updateWidget(
      context: Context,
      manager: AppWidgetManager,
      widgetId: Int,
    ) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val language = prefs.getString(KEY_LANGUAGE, "tr") ?: "tr"
      val isTurkish = language.startsWith("tr")
      val preferences = WidgetPreferences.load(context)
      val count = countUpcoming(
        prefs.getString(KEY_ITEMS, "[]") ?: "[]",
        preferences,
      )

      val views = RemoteViews(context.packageName, R.layout.reminder_widget)
      val appearance = preferences.reminderAppearance
      WidgetThemeViews.tintBackground(
        views,
        R.id.reminder_widget_root,
        appearance.background,
      )
      views.setViewVisibility(
        R.id.reminder_widget_logo,
        if (preferences.reminderShowTitle) View.VISIBLE else View.GONE,
      )
      views.setViewVisibility(
        R.id.reminder_widget_title,
        if (preferences.reminderShowTitle) View.VISIBLE else View.GONE,
      )
      views.setTextViewText(
        R.id.reminder_widget_title,
        if (isTurkish) "Yaklaşanlar" else "Coming Up",
      )
      views.setTextColor(R.id.reminder_widget_title, appearance.text)
      views.setTextViewText(
        R.id.reminder_widget_count,
        if (isTurkish) "$count hatırlatma" else "$count reminders",
      )
      views.setTextColor(R.id.reminder_widget_count, appearance.accent)
      views.setTextViewText(
        R.id.reminder_widget_empty_text,
        if (isTurkish) "Yaklaşan film veya bölüm yok" else "No upcoming movies or episodes",
      )
      views.setTextColor(R.id.reminder_widget_empty_text, appearance.muted)

      // Liste adaptörü — servise widgetId'yi veri olarak koy ki her örnek
      // kendi adaptörünü alsın (RemoteViews adapter cache'i buna dayanır).
      val serviceIntent = Intent(context, ReminderWidgetRemoteViewsService::class.java).apply {
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        data = Uri.parse("seelogd-widget://$widgetId")
      }
      views.setRemoteAdapter(R.id.reminder_widget_list, serviceIntent)
      views.setEmptyView(R.id.reminder_widget_list, R.id.reminder_widget_empty)

      // Tüm satırlar aynı ekrana (seelogd://reminders) gider; template + her
      // satırdaki fill-in intent koleksiyon tıklama desenidir.
      val openIntent = Intent(context, MainActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        data = Uri.parse("seelogd://reminders")
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val template = PendingIntent.getActivity(
        context,
        4201,
        openIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
      )
      views.setPendingIntentTemplate(R.id.reminder_widget_list, template)

      manager.updateAppWidget(widgetId, views)
      manager.notifyAppWidgetViewDataChanged(widgetId, R.id.reminder_widget_list)
    }

    private fun countUpcoming(
      raw: String,
      preferences: WidgetPreferences,
    ): Int = try {
      val array = JSONArray(raw)
      val start = startOfToday()
      var n = 0
      for (i in 0 until array.length()) {
        val obj = array.optJSONObject(i) ?: continue
        val type = obj.optString("type")
        val typeMatches =
          preferences.reminderContent == "all" ||
            preferences.reminderContent == type
        if (typeMatches && obj.optLong("dateEpoch", -1L) >= start) n++
      }
      n.coerceAtMost(preferences.reminderMaxItems)
    } catch (_: Exception) {
      0
    }

    private fun startOfToday(): Long = Calendar.getInstance().run {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      timeInMillis
    }
  }
}
