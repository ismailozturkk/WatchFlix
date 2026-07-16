package com.smlztrk.Watchify.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.smlztrk.Watchify.MainActivity
import com.smlztrk.Watchify.R
import org.json.JSONArray
import java.util.Calendar
import java.util.concurrent.TimeUnit

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
    const val PREFS_NAME = "watchify_reminder_widget"
    const val KEY_ITEMS = "items"
    const val KEY_LANGUAGE = "language"

    private data class ReminderItem(
      val id: String,
      val type: String,
      val title: String,
      val subtitle: String,
      val dateEpoch: Long,
    )

    private data class RowViews(
      val row: Int,
      val badge: Int,
      val title: Int,
      val meta: Int,
    )

    private val ROW_VIEWS = listOf(
      RowViews(
        R.id.reminder_widget_row_1,
        R.id.reminder_widget_badge_1,
        R.id.reminder_widget_name_1,
        R.id.reminder_widget_meta_1,
      ),
      RowViews(
        R.id.reminder_widget_row_2,
        R.id.reminder_widget_badge_2,
        R.id.reminder_widget_name_2,
        R.id.reminder_widget_meta_2,
      ),
      RowViews(
        R.id.reminder_widget_row_3,
        R.id.reminder_widget_badge_3,
        R.id.reminder_widget_name_3,
        R.id.reminder_widget_meta_3,
      ),
      RowViews(
        R.id.reminder_widget_row_4,
        R.id.reminder_widget_badge_4,
        R.id.reminder_widget_name_4,
        R.id.reminder_widget_meta_4,
      ),
    )

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, ReminderWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(component)
      ids.forEach { updateWidget(context, manager, it) }
    }

    private fun updateWidget(
      context: Context,
      manager: AppWidgetManager,
      widgetId: Int,
    ) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val language = prefs.getString(KEY_LANGUAGE, "tr") ?: "tr"
      val isTurkish = language.startsWith("tr")
      val items = parseItems(prefs.getString(KEY_ITEMS, "[]") ?: "[]")
        .filter { it.dateEpoch >= startOfToday() }
        .sortedBy { it.dateEpoch }

      val views = RemoteViews(context.packageName, R.layout.reminder_widget)
      views.setTextViewText(
        R.id.reminder_widget_title,
        if (isTurkish) "Yaklaşanlar" else "Coming Up",
      )
      views.setTextViewText(
        R.id.reminder_widget_count,
        if (isTurkish) "${items.size} hatırlatma" else "${items.size} reminders",
      )

      val isEmpty = items.isEmpty()
      views.setViewVisibility(
        R.id.reminder_widget_empty,
        if (isEmpty) View.VISIBLE else View.GONE,
      )
      views.setTextViewText(
        R.id.reminder_widget_empty,
        if (isTurkish) "Yaklaşan film veya bölüm yok" else "No upcoming movies or episodes",
      )

      val openIntent = Intent(context, MainActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        data = Uri.parse("watchify://reminders")
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val openPendingIntent = PendingIntent.getActivity(
        context,
        4201,
        openIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      views.setOnClickPendingIntent(R.id.reminder_widget_root, openPendingIntent)

      ROW_VIEWS.forEachIndexed { index, row ->
        bindRow(views, items.getOrNull(index), row.row, row.badge, row.title, row.meta, isTurkish)
        views.setOnClickPendingIntent(row.row, openPendingIntent)
      }

      val overflow = items.size - ROW_VIEWS.size
      views.setViewVisibility(
        R.id.reminder_widget_more,
        if (overflow > 0) View.VISIBLE else View.GONE,
      )
      if (overflow > 0) {
        views.setTextViewText(
          R.id.reminder_widget_more,
          if (isTurkish) "+$overflow daha" else "+$overflow more",
        )
      }

      manager.updateAppWidget(widgetId, views)
    }

    private fun bindRow(
      views: RemoteViews,
      item: ReminderItem?,
      rowId: Int,
      badgeId: Int,
      titleId: Int,
      metaId: Int,
      isTurkish: Boolean,
    ) {
      views.setViewVisibility(rowId, if (item == null) View.GONE else View.VISIBLE)
      if (item == null) return

      val isMovie = item.type == "movie"
      views.setTextViewText(badgeId, if (isMovie) "F" else "D")
      views.setInt(
        badgeId,
        "setBackgroundResource",
        if (isMovie) R.drawable.reminder_widget_movie_badge
        else R.drawable.reminder_widget_tv_badge,
      )
      views.setTextViewText(titleId, item.title)

      val typeLabel = when {
        isMovie && isTurkish -> "Film"
        isMovie -> "Movie"
        isTurkish -> "Dizi"
        else -> "TV"
      }
      val parts = listOf(typeLabel, item.subtitle, countdown(item.dateEpoch, isTurkish))
        .filter { it.isNotBlank() }
      views.setTextViewText(metaId, parts.joinToString("  •  "))
    }

    private fun countdown(epoch: Long, isTurkish: Boolean): String {
      val diff = TimeUnit.MILLISECONDS.toDays(startOfDay(epoch) - startOfToday())
      return when (diff) {
        0L -> if (isTurkish) "Bugün" else "Today"
        1L -> if (isTurkish) "Yarın" else "Tomorrow"
        else -> if (isTurkish) "$diff gün" else "$diff days"
      }
    }

    private fun startOfToday(): Long = startOfDay(System.currentTimeMillis())

    private fun startOfDay(epoch: Long): Long = Calendar.getInstance().run {
      timeInMillis = epoch
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      timeInMillis
    }

    private fun parseItems(raw: String): List<ReminderItem> = try {
      val array = JSONArray(raw)
      buildList {
        for (index in 0 until array.length()) {
          val item = array.optJSONObject(index) ?: continue
          val epoch = item.optLong("dateEpoch", -1L)
          if (epoch <= 0L) continue
          add(
            ReminderItem(
              id = item.optString("id"),
              type = item.optString("type"),
              title = item.optString("title"),
              subtitle = item.optString("subtitle"),
              dateEpoch = epoch,
            ),
          )
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }
}
