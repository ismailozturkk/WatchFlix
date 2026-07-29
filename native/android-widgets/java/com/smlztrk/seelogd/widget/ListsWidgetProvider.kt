package com.smlztrk.seelogd.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import com.smlztrk.seelogd.MainActivity
import com.smlztrk.seelogd.R
import org.json.JSONArray
import org.json.JSONObject

/**
 * "Listelerim" widget'ı — üstte liste seçici, altta 3 sütunlu kaydırılabilir
 * poster ızgarası.
 *
 * SEÇİCİ NEDEN OK TUŞLARI: RemoteViews'te Spinner/ScrollView yok; bir ana ekran
 * widget'ı yalnız ListView/GridView/StackView/AdapterViewFlipper barındırabilir
 * ve o tek koleksiyon zaten posterler için kullanılıyor. Bu yüzden seçim,
 * başlıktaki ‹ › düğmeleriyle listeler arasında dolaşarak yapılır; seçim her
 * widget ÖRNEĞİ için ayrı saklanır (aynı anda iki farklı liste eklenebilsin).
 *
 * Izgara satırlarını ListsWidgetRemoteViewsService üretir; provider yalnız
 * başlığı bağlar, adaptörü kurar ve tıklama şablonunu tanımlar.
 */
class ListsWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    appWidgetIds.forEach { widgetId ->
      updateWidget(context, appWidgetManager, widgetId)
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action != ACTION_CYCLE) return

    val widgetId = intent.getIntExtra(
      AppWidgetManager.EXTRA_APPWIDGET_ID,
      AppWidgetManager.INVALID_APPWIDGET_ID,
    )
    if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return

    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val total = parseLists(prefs.getString(KEY_LISTS, "[]") ?: "[]").length()
    if (total <= 0) return

    val delta = intent.getIntExtra(EXTRA_DELTA, 1)
    val current = prefs.getInt(selectionKey(widgetId), 0)
    // Mod aritmetiği: baştan geriye gidince sona sarar (Kotlin'de % negatif
    // kalan verebildiği için + total).
    val next = ((current + delta) % total + total) % total
    prefs.edit().putInt(selectionKey(widgetId), next).apply()

    val manager = AppWidgetManager.getInstance(context)
    updateWidget(context, manager, widgetId)
    manager.notifyAppWidgetViewDataChanged(widgetId, R.id.lists_widget_grid)
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    // Widget kaldırılınca örnek başına seçim de gitsin; aksi halde prefs
    // silinmeyen anahtarlarla büyür ve yeni widget eski indeksi devralabilir.
    val editor = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
    appWidgetIds.forEach { editor.remove(selectionKey(it)) }
    editor.apply()
  }

  companion object {
    const val PREFS_NAME = "seelogd_lists_widget"
    const val KEY_LISTS = "lists"
    const val KEY_LANGUAGE = "language"
    const val ACTION_CYCLE = "com.smlztrk.seelogd.widget.LISTS_CYCLE"
    const val EXTRA_DELTA = "delta"

    fun selectionKey(widgetId: Int): String = "selection_$widgetId"

    /** Seçili indeksi liste sayısına göre güvene alır (liste silinmiş olabilir). */
    fun selectedIndex(context: Context, widgetId: Int, total: Int): Int {
      if (total <= 0) return 0
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      return prefs.getInt(selectionKey(widgetId), 0).coerceIn(0, total - 1)
    }

    fun parseLists(raw: String): JSONArray = try {
      JSONArray(raw)
    } catch (_: Exception) {
      JSONArray()
    }

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, ListsWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(component)
      ids.forEach { updateWidget(context, manager, it) }
      manager.notifyAppWidgetViewDataChanged(ids, R.id.lists_widget_grid)
    }

    private fun updateWidget(
      context: Context,
      manager: AppWidgetManager,
      widgetId: Int,
    ) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val isTurkish = (prefs.getString(KEY_LANGUAGE, "tr") ?: "tr").startsWith("tr")
      val lists = parseLists(prefs.getString(KEY_LISTS, "[]") ?: "[]")
      val total = lists.length()
      val index = selectedIndex(context, widgetId, total)
      val selected: JSONObject? = if (total > 0) lists.optJSONObject(index) else null

      val views = RemoteViews(context.packageName, R.layout.lists_widget)

      val accent = parseColor(selected?.optString("accent"), ACCENT_DEFAULT)
      views.setTextViewText(
        R.id.lists_widget_title,
        selected?.optString("name")?.takeIf { it.isNotBlank() }
          ?: if (isTurkish) "Listelerim" else "My Lists",
      )
      views.setTextViewText(
        R.id.lists_widget_count,
        selected?.optInt("count", 0)?.toString() ?: "0",
      )
      views.setTextColor(R.id.lists_widget_count, accent)
      views.setInt(R.id.lists_widget_icon, "setColorFilter", accent)
      views.setImageViewResource(
        R.id.lists_widget_icon,
        iconRes(selected?.optString("icon")),
      )

      // Seçici konumu: "2 / 5". Tek liste varsa (ya da hiç yoksa) oklar
      // anlamsız — gizlenir.
      views.setTextViewText(
        R.id.lists_widget_position,
        if (total > 0) "${index + 1}/$total" else "0/0",
      )
      val navVisibility = if (total > 1) android.view.View.VISIBLE else android.view.View.GONE
      views.setViewVisibility(R.id.lists_widget_prev, navVisibility)
      views.setViewVisibility(R.id.lists_widget_next, navVisibility)
      views.setViewVisibility(R.id.lists_widget_position, navVisibility)

      views.setOnClickPendingIntent(
        R.id.lists_widget_prev,
        cycleIntent(context, widgetId, -1),
      )
      views.setOnClickPendingIntent(
        R.id.lists_widget_next,
        cycleIntent(context, widgetId, 1),
      )

      views.setTextViewText(
        R.id.lists_widget_empty_text,
        if (isTurkish) "Bu listede henüz içerik yok" else "Nothing in this list yet",
      )

      // Izgara adaptörü — servise widgetId'yi veri olarak koy ki her örnek
      // kendi adaptörünü alsın (RemoteViews adapter cache'i buna dayanır).
      val serviceIntent = Intent(context, ListsWidgetRemoteViewsService::class.java).apply {
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        data = Uri.parse("seelogd-lists-widget://$widgetId")
      }
      views.setRemoteAdapter(R.id.lists_widget_grid, serviceIntent)
      views.setEmptyView(R.id.lists_widget_grid, R.id.lists_widget_empty)

      // Poster tıklaması → o listenin ekranı. Template + hücre başına fill-in
      // intent koleksiyon tıklama desenidir; hedef yolu satır üretirken konur.
      val template = PendingIntent.getActivity(
        context,
        4301,
        Intent(context, MainActivity::class.java).apply {
          action = Intent.ACTION_VIEW
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
      )
      views.setPendingIntentTemplate(R.id.lists_widget_grid, template)

      // Başlığa dokunmak seçili listeyi açar; liste yoksa tüm listeler ekranı.
      val headerUri = selected?.optString("key")?.takeIf { it.isNotBlank() }
        ?.let { "seelogd://lists/$it" } ?: "seelogd://lists"
      views.setOnClickPendingIntent(
        R.id.lists_widget_header,
        PendingIntent.getActivity(
          context,
          4302,
          Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(headerUri)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
          },
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        ),
      )

      manager.updateAppWidget(widgetId, views)
      manager.notifyAppWidgetViewDataChanged(widgetId, R.id.lists_widget_grid)
    }

    private fun cycleIntent(context: Context, widgetId: Int, delta: Int): PendingIntent {
      val intent = Intent(context, ListsWidgetProvider::class.java).apply {
        action = ACTION_CYCLE
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        putExtra(EXTRA_DELTA, delta)
        // requestCode tek başına PendingIntent'leri ayırmaya YETMEZ: extras
        // eşitlik karşılaştırmasına girmez. Farklı data URI'si olmadan ‹ ve ›
        // aynı PendingIntent'i paylaşır ve ikisi de son yönü uygular.
        data = Uri.parse("seelogd-lists-cycle://$widgetId/$delta")
      }
      return PendingIntent.getBroadcast(
        context,
        widgetId * 10 + (if (delta > 0) 1 else 0),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    private const val ACCENT_DEFAULT = 0xFF6C63FF.toInt()

    fun parseColor(value: String?, fallback: Int): Int = try {
      if (value.isNullOrBlank()) fallback else Color.parseColor(value)
    } catch (_: Exception) {
      fallback
    }

    /** JS tarafındaki Ionicons adlarını (utils/listAppearance.js) drawable'a çevirir. */
    fun iconRes(icon: String?): Int = when (icon) {
      "film" -> R.drawable.reminder_widget_ic_movie
      "tv" -> R.drawable.reminder_widget_ic_tv
      "heart" -> R.drawable.lists_widget_ic_heart
      "bookmark" -> R.drawable.lists_widget_ic_bookmark
      else -> R.drawable.lists_widget_ic_list
    }
  }
}
