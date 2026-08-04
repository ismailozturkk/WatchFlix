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
import org.json.JSONObject

/**
 * "İstatistikler" widget'ı — profildeki istatistik bölümünün (StatisticsSection)
 * ana ekran karşılığı: film kartı, toplam süre şeridi, dizi kartı.
 *
 * Koleksiyon YOK: tüm içerik sabit sayıda TextView. i18n ve sayı biçimlendirme
 * JS tarafında bitmiştir (services/statsWidgetService.js); burada yalnız hazır
 * metinler bağlanır. Bu yüzden dil değişince payload yeniden gönderilmelidir.
 */
class StatsWidgetProvider : AppWidgetProvider() {

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
    const val PREFS_NAME = "seelogd_stats_widget"
    const val KEY_STATS = "stats"
    const val KEY_LANGUAGE = "language"

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, StatsWidgetProvider::class.java)
      manager.getAppWidgetIds(component).forEach { updateWidget(context, manager, it) }
    }

    private fun updateWidget(
      context: Context,
      manager: AppWidgetManager,
      widgetId: Int,
    ) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val isTurkish = (prefs.getString(KEY_LANGUAGE, "tr") ?: "tr").startsWith("tr")
      val stats = parse(prefs.getString(KEY_STATS, "") ?: "")
      val preferences = WidgetPreferences.load(context)
      val appearance = preferences.statsAppearance

      val views = RemoteViews(context.packageName, R.layout.stats_widget)
      WidgetThemeViews.tintBackground(
        views,
        R.id.stats_widget_root,
        appearance.background,
      )
      listOf(
        R.id.stats_widget_movie_card,
        R.id.stats_widget_tv_card,
      ).forEach { WidgetThemeViews.tintBackground(views, it, appearance.surface) }
      listOf(
        R.id.stats_widget_movie_count_panel,
        R.id.stats_widget_movie_time_panel,
        R.id.stats_widget_tv_count_panel,
        R.id.stats_widget_tv_time_panel,
        R.id.stats_widget_duration_strip,
      ).forEach { WidgetThemeViews.tintBackground(views, it, appearance.surfaceAlt) }
      views.setViewVisibility(
        R.id.stats_widget_logo,
        if (preferences.statsShowTitle) View.VISIBLE else View.GONE,
      )
      views.setViewVisibility(
        R.id.stats_widget_title,
        if (preferences.statsShowTitle) View.VISIBLE else View.GONE,
      )
      views.setViewVisibility(
        R.id.stats_widget_movie_card,
        if (preferences.statsShowMovies) View.VISIBLE else View.GONE,
      )
      views.setViewVisibility(
        R.id.stats_widget_tv_card,
        if (preferences.statsShowTv) View.VISIBLE else View.GONE,
      )
      views.setViewVisibility(
        R.id.stats_widget_duration_strip,
        if (preferences.statsShowDuration) View.VISIBLE else View.GONE,
      )

      views.setTextViewText(
        R.id.stats_widget_title,
        stats?.optString("title")?.takeIf { it.isNotBlank() }
          ?: if (isTurkish) "İstatistikler" else "Statistics",
      )
      views.setTextColor(R.id.stats_widget_title, appearance.text)

      // ── Film kartı ──────────────────────────────────────────────────────
      val movie = stats?.optJSONObject("movie")
      views.setTextViewText(R.id.stats_widget_movie_count, movie?.optString("count") ?: "0")
      views.setTextViewText(R.id.stats_widget_movie_count_label, movie?.optString("countLabel") ?: "")
      views.setTextColor(R.id.stats_widget_movie_count, appearance.text)
      views.setTextColor(R.id.stats_widget_movie_count_label, appearance.muted)
      bindTime(views, movie?.optJSONObject("time"), MOVIE_TIME_IDS)

      // ── Dizi kartı ──────────────────────────────────────────────────────
      val tv = stats?.optJSONObject("tv")
      views.setTextViewText(R.id.stats_widget_tv_count, tv?.optString("showCount") ?: "0")
      views.setTextViewText(R.id.stats_widget_tv_count_label, tv?.optString("showCountLabel") ?: "")
      views.setTextViewText(R.id.stats_widget_episode_count, tv?.optString("episodeCount") ?: "0")
      views.setTextViewText(R.id.stats_widget_episode_count_label, tv?.optString("episodeCountLabel") ?: "")
      views.setTextColor(R.id.stats_widget_tv_count, appearance.text)
      views.setTextColor(R.id.stats_widget_episode_count, appearance.text)
      views.setTextColor(R.id.stats_widget_tv_count_label, appearance.muted)
      views.setTextColor(R.id.stats_widget_episode_count_label, appearance.muted)
      bindTime(views, tv?.optJSONObject("time"), TV_TIME_IDS)

      // ── Toplam süre şeridi ──────────────────────────────────────────────
      val duration = stats?.optJSONObject("duration")
      views.setTextViewText(R.id.stats_widget_total_value, duration?.optString("totalText") ?: "0")
      views.setTextColor(R.id.stats_widget_total_value, appearance.accent)
      views.setTextViewText(R.id.stats_widget_total_label, duration?.optString("totalLabel") ?: "")
      views.setTextViewText(R.id.stats_widget_movie_value, duration?.optString("movieText") ?: "0")
      views.setTextViewText(R.id.stats_widget_movie_label, duration?.optString("movieLabel") ?: "")
      views.setTextViewText(R.id.stats_widget_tv_value, duration?.optString("tvText") ?: "0")
      views.setTextViewText(R.id.stats_widget_tv_label, duration?.optString("tvLabel") ?: "")
      // Aksan renkleri profildeki türetilmiş rank renkleriyle aynı (payload'dan).
      views.setTextColor(
        R.id.stats_widget_movie_value,
        appearance.accent,
      )
      views.setTextColor(
        R.id.stats_widget_tv_value,
        appearance.bold,
      )
      listOf(
        R.id.stats_widget_total_label,
        R.id.stats_widget_movie_label,
        R.id.stats_widget_tv_label,
      ).forEach { views.setTextColor(it, appearance.muted) }

      // ── Birim etiketleri (Yıl / Ay / Gün / Saat / Dakika) ────────────────
      val units = stats?.optJSONObject("units")
      UNIT_KEYS.forEachIndexed { index, key ->
        val label = units?.optString(key) ?: ""
        views.setTextViewText(MOVIE_UNIT_IDS[index], label)
        views.setTextViewText(TV_UNIT_IDS[index], label)
        views.setTextColor(MOVIE_UNIT_IDS[index], appearance.muted)
        views.setTextColor(TV_UNIT_IDS[index], appearance.muted)
        views.setTextColor(MOVIE_TIME_IDS[index], appearance.text)
        views.setTextColor(TV_TIME_IDS[index], appearance.text)
      }

      val density = context.resources.displayMetrics.density
      val horizontal = ((if (preferences.statsCompact) 8 else 12) * density).toInt()
      val vertical = ((if (preferences.statsCompact) 7 else 11) * density).toInt()
      views.setViewPadding(
        R.id.stats_widget_root,
        horizontal,
        vertical,
        horizontal,
        vertical,
      )

      // ── Dokunma hedefleri — profildeki kartlarla aynı ekranlar ───────────
      views.setOnClickPendingIntent(
        R.id.stats_widget_movie_card,
        deepLink(context, 4401, "seelogd://stats/movies"),
      )
      views.setOnClickPendingIntent(
        R.id.stats_widget_tv_card,
        deepLink(context, 4402, "seelogd://stats/tv"),
      )

      manager.updateAppWidget(widgetId, views)
    }

    private fun bindTime(views: RemoteViews, time: JSONObject?, ids: IntArray) {
      UNIT_KEYS.forEachIndexed { index, key ->
        views.setTextViewText(ids[index], (time?.optInt(key, 0) ?: 0).toString())
      }
    }

    private fun deepLink(context: Context, requestCode: Int, uri: String): PendingIntent =
      PendingIntent.getActivity(
        context,
        requestCode,
        Intent(context, MainActivity::class.java).apply {
          action = Intent.ACTION_VIEW
          data = Uri.parse(uri)
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    private fun parse(raw: String): JSONObject? = try {
      if (raw.isBlank()) null else JSONObject(raw)
    } catch (_: Exception) {
      null
    }

    private val UNIT_KEYS = arrayOf("years", "months", "days", "hours", "minutes")

    private val MOVIE_TIME_IDS = intArrayOf(
      R.id.stats_widget_movie_years,
      R.id.stats_widget_movie_months,
      R.id.stats_widget_movie_days,
      R.id.stats_widget_movie_hours,
      R.id.stats_widget_movie_minutes,
    )
    private val MOVIE_UNIT_IDS = intArrayOf(
      R.id.stats_widget_movie_years_label,
      R.id.stats_widget_movie_months_label,
      R.id.stats_widget_movie_days_label,
      R.id.stats_widget_movie_hours_label,
      R.id.stats_widget_movie_minutes_label,
    )
    private val TV_TIME_IDS = intArrayOf(
      R.id.stats_widget_tv_years,
      R.id.stats_widget_tv_months,
      R.id.stats_widget_tv_days,
      R.id.stats_widget_tv_hours,
      R.id.stats_widget_tv_minutes,
    )
    private val TV_UNIT_IDS = intArrayOf(
      R.id.stats_widget_tv_years_label,
      R.id.stats_widget_tv_months_label,
      R.id.stats_widget_tv_days_label,
      R.id.stats_widget_tv_hours_label,
      R.id.stats_widget_tv_minutes_label,
    )
  }
}
