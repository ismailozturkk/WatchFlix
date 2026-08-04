package com.smlztrk.seelogd.widget

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONObject

data class WidgetAppearance(
  val themeId: String,
  val background: Int,
  val surface: Int,
  val surfaceAlt: Int,
  val border: Int,
  val text: Int,
  val secondaryText: Int,
  val muted: Int,
  val accent: Int,
  val bold: Int,
)

/**
 * Üç widget'ın bağımsız görünüm ve içerik tercihleri. JS her widget için
 * tema paletinin çözülmüş renklerini gönderir; özel tema daha sonra silinse
 * bile ana ekran görünümü aynı kalır.
 */
data class WidgetPreferences(
  val reminderAppearance: WidgetAppearance = PURPLE_APPEARANCE,
  val reminderCompact: Boolean = false,
  val reminderShowTitle: Boolean = true,
  val reminderContent: String = "all",
  val reminderShowPosters: Boolean = true,
  val reminderShowDates: Boolean = true,
  val reminderMaxItems: Int = 5,
  val listsAppearance: WidgetAppearance = PURPLE_APPEARANCE,
  val listsCompact: Boolean = false,
  val listsShowTitle: Boolean = true,
  val listsShowCount: Boolean = true,
  val listsShowNavigation: Boolean = true,
  val listsMaxPosters: Int = 12,
  val statsAppearance: WidgetAppearance = BLUE_APPEARANCE,
  val statsCompact: Boolean = false,
  val statsShowTitle: Boolean = false,
  val statsShowMovies: Boolean = true,
  val statsShowTv: Boolean = true,
  val statsShowDuration: Boolean = true,
) {
  companion object {
    const val PREFS_NAME = "seelogd_widget_preferences"
    const val KEY_JSON = "preferences"

    private val PURPLE_APPEARANCE = WidgetAppearance(
      themeId = "purple",
      background = 0xFF16131E.toInt(),
      surface = 0xFF211C2E.toInt(),
      surfaceAlt = 0xFF1B1726.toInt(),
      border = 0xFF332C46.toInt(),
      text = 0xFFF4F2F9.toInt(),
      secondaryText = 0xFFCFC9DE.toInt(),
      muted = 0xFF7E7694.toInt(),
      accent = 0xFF8B5CF6.toInt(),
      bold = 0xFF7C3AED.toInt(),
    )

    private val BLUE_APPEARANCE = WidgetAppearance(
      themeId = "blue",
      background = 0xFF141C33.toInt(),
      surface = 0xFF23324B.toInt(),
      surfaceAlt = 0xFF1B2440.toInt(),
      border = 0xFF2A3E63.toInt(),
      text = 0xFFEFF5FA.toInt(),
      secondaryText = 0xFF8BAFD0.toInt(),
      muted = 0xFF5F7694.toInt(),
      accent = 0xFF4C8DFF.toInt(),
      bold = 0xFF2D6BDF.toInt(),
    )

    fun save(context: Context, raw: String) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_JSON, raw)
        .apply()
    }

    fun load(context: Context): WidgetPreferences {
      val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getString(KEY_JSON, null)
        ?: return WidgetPreferences()
      return try {
        val root = JSONObject(raw)
        val reminders = root.optJSONObject("reminders") ?: JSONObject()
        val lists = root.optJSONObject("lists") ?: JSONObject()
        val stats = root.optJSONObject("stats") ?: JSONObject()
        val legacy = legacyAppearance(root)
        WidgetPreferences(
          reminderAppearance = parseAppearance(
            reminders.optJSONObject("appearance"),
            legacy ?: PURPLE_APPEARANCE,
          ),
          reminderCompact = density(reminders, root),
          reminderShowTitle = boolean(reminders, "showTitle", root.optBoolean("showTitle", true)),
          reminderContent = reminders.optString("content", "all")
            .takeIf { it in setOf("all", "movie", "tv") } ?: "all",
          reminderShowPosters = reminders.optBoolean("showPosters", true),
          reminderShowDates = reminders.optBoolean("showDates", true),
          reminderMaxItems = reminders.optInt("maxItems", 5)
            .takeIf { it in setOf(3, 5, 8) } ?: 5,
          listsAppearance = parseAppearance(
            lists.optJSONObject("appearance"),
            legacy ?: PURPLE_APPEARANCE,
          ),
          listsCompact = density(lists, root),
          listsShowTitle = boolean(lists, "showTitle", root.optBoolean("showTitle", true)),
          listsShowCount = lists.optBoolean("showCount", true),
          listsShowNavigation = lists.optBoolean("showNavigation", true),
          listsMaxPosters = lists.optInt("maxPosters", 12)
            .takeIf { it in setOf(6, 12, 18) } ?: 12,
          statsAppearance = parseAppearance(
            stats.optJSONObject("appearance"),
            legacy ?: BLUE_APPEARANCE,
          ),
          statsCompact = density(stats, root),
          statsShowTitle = boolean(stats, "showTitle", root.optBoolean("showTitle", false)),
          statsShowMovies = stats.optBoolean("showMovies", true),
          statsShowTv = stats.optBoolean("showTv", true),
          statsShowDuration = stats.optBoolean("showDuration", true),
        )
      } catch (_: Exception) {
        WidgetPreferences()
      }
    }

    private fun density(section: JSONObject, root: JSONObject): Boolean =
      section.optString("density", root.optString("density", "comfortable")) == "compact"

    private fun boolean(
      section: JSONObject,
      key: String,
      fallback: Boolean,
    ): Boolean = if (section.has(key)) section.optBoolean(key, fallback) else fallback

    private fun parseAppearance(
      raw: JSONObject?,
      fallback: WidgetAppearance,
    ): WidgetAppearance {
      if (raw == null) return fallback
      return WidgetAppearance(
        themeId = raw.optString("themeId", fallback.themeId),
        background = parseColor(raw.optString("background"), fallback.background),
        surface = parseColor(raw.optString("surface"), fallback.surface),
        surfaceAlt = parseColor(raw.optString("surfaceAlt"), fallback.surfaceAlt),
        border = parseColor(raw.optString("border"), fallback.border),
        text = parseColor(raw.optString("text"), fallback.text),
        secondaryText = parseColor(raw.optString("secondaryText"), fallback.secondaryText),
        muted = parseColor(raw.optString("muted"), fallback.muted),
        accent = parseColor(raw.optString("accent"), fallback.accent),
        bold = parseColor(raw.optString("bold"), fallback.bold),
      )
    }

    private fun legacyAppearance(root: JSONObject): WidgetAppearance? {
      if (!root.has("background") && !root.has("accent")) return null
      val fallback = PURPLE_APPEARANCE
      val background = when (root.optString("background", "midnight")) {
        "amoled" -> Color.BLACK
        "plum" -> 0xFF21142E.toInt()
        else -> 0xFF0B0E16.toInt()
      }
      val accent = parseColor(root.optString("accent"), fallback.accent)
      return fallback.copy(
        themeId = "legacy",
        background = background,
        accent = accent,
        bold = accent,
      )
    }

    private fun parseColor(value: String?, fallback: Int): Int = try {
      if (value.isNullOrBlank()) fallback else Color.parseColor(value)
    } catch (_: Exception) {
      fallback
    }
  }
}

object WidgetThemeViews {
  fun tintBackground(views: RemoteViews, viewId: Int, color: Int) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      views.setColorStateList(viewId, "setBackgroundTintList", ColorStateList.valueOf(color))
    } else {
      views.setInt(viewId, "setBackgroundColor", color)
    }
  }
}
