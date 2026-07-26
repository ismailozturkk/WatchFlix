package com.smlztrk.seelogd.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import android.util.LruCache
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.smlztrk.seelogd.R

/**
 * "Listelerim" ızgarasını besleyen koleksiyon servisi. Her hücre bir posterdir;
 * bitmap arka planda (bu iş parçacığı zaten arka planda çalışır) indirilir,
 * 2:3'e kırpılır, köşeleri yuvarlanır ve LruCache'lenir. RemoteViews URL
 * yükleyemediği için bu iş elle yapılır.
 *
 * Her widget ÖRNEĞİ kendi seçili listesini gösterir; hangi liste olduğu
 * onDataSetChanged'de widgetId üzerinden okunur.
 */
class ListsWidgetRemoteViewsService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
    val widgetId = intent.getIntExtra(
      AppWidgetManager.EXTRA_APPWIDGET_ID,
      AppWidgetManager.INVALID_APPWIDGET_ID,
    )
    return ListsRemoteViewsFactory(applicationContext, widgetId)
  }
}

private class ListsRemoteViewsFactory(
  private val context: Context,
  private val widgetId: Int,
) : RemoteViewsService.RemoteViewsFactory {

  private var posters: List<String> = emptyList()
  private var listKey: String = ""
  private var accent: Int = DEFAULT_ACCENT

  override fun onCreate() { /* veri onDataSetChanged'de yüklenir */ }

  override fun onDataSetChanged() {
    val prefs = context.getSharedPreferences(
      ListsWidgetProvider.PREFS_NAME,
      Context.MODE_PRIVATE,
    )
    val lists = ListsWidgetProvider.parseLists(
      prefs.getString(ListsWidgetProvider.KEY_LISTS, "[]") ?: "[]",
    )
    val index = ListsWidgetProvider.selectedIndex(context, widgetId, lists.length())
    val selected = lists.optJSONObject(index)

    listKey = selected?.optString("key") ?: ""
    accent = ListsWidgetProvider.parseColor(selected?.optString("accent"), DEFAULT_ACCENT)

    val array = selected?.optJSONArray("posters")
    posters = if (array == null) {
      emptyList()
    } else {
      buildList {
        for (i in 0 until array.length()) {
          val url = array.optString(i)
          if (!url.isNullOrBlank()) add(url)
        }
      }
    }
  }

  override fun onDestroy() { posters = emptyList() }

  override fun getCount(): Int = posters.size

  override fun getViewAt(position: Int): RemoteViews {
    val rv = RemoteViews(context.packageName, R.layout.lists_widget_item)
    val url = posters.getOrNull(position) ?: return rv

    val bitmap = loadPoster(url)
    if (bitmap != null) {
      rv.setViewVisibility(R.id.lists_widget_item_poster, View.VISIBLE)
      rv.setViewVisibility(R.id.lists_widget_item_placeholder, View.GONE)
      rv.setImageViewBitmap(R.id.lists_widget_item_poster, bitmap)
    } else {
      // İndirme başarısız (çevrimdışı / 404): listenin aksanıyla boyanmış
      // yer tutucu, boş kare yerine.
      rv.setViewVisibility(R.id.lists_widget_item_poster, View.GONE)
      rv.setViewVisibility(R.id.lists_widget_item_placeholder, View.VISIBLE)
      rv.setInt(R.id.lists_widget_item_placeholder, "setColorFilter", accent)
    }

    // Tıklama: template provider'da; buradan yalnız hedef yolu verilir.
    val fillIn = Intent().apply {
      if (listKey.isNotBlank()) {
        data = android.net.Uri.parse("seelogd://lists/$listKey")
      } else {
        data = android.net.Uri.parse("seelogd://lists")
      }
    }
    rv.setOnClickFillInIntent(R.id.lists_widget_item_root, fillIn)

    return rv
  }

  override fun getLoadingView(): RemoteViews? = null
  override fun getViewTypeCount(): Int = 1
  override fun getItemId(position: Int): Long =
    posters.getOrNull(position)?.hashCode()?.toLong() ?: position.toLong()
  override fun hasStableIds(): Boolean = true

  // ── Poster indirme + yuvarlatma ────────────────────────────────────────────
  private fun loadPoster(url: String): Bitmap? {
    cache.get(url)?.let { return it }
    return try {
      val conn = (java.net.URL(url).openConnection() as java.net.HttpURLConnection).apply {
        connectTimeout = 6000
        readTimeout = 6000
        instanceFollowRedirects = true
      }
      conn.inputStream.use { stream ->
        val raw = BitmapFactory.decodeStream(stream) ?: return null
        val rounded = roundedCrop(raw, POSTER_W_PX, POSTER_H_PX, CORNER_PX)
        if (rounded !== raw) raw.recycle()
        cache.put(url, rounded)
        rounded
      }
    } catch (_: Exception) {
      null
    }
  }

  // 2:3 hedefe center-crop + köşe yuvarlatma.
  private fun roundedCrop(src: Bitmap, targetW: Int, targetH: Int, radius: Float): Bitmap {
    val srcRatio = src.width.toFloat() / src.height
    val dstRatio = targetW.toFloat() / targetH
    val crop = if (srcRatio > dstRatio) {
      val w = (src.height * dstRatio).toInt()
      Rect((src.width - w) / 2, 0, (src.width - w) / 2 + w, src.height)
    } else {
      val h = (src.width / dstRatio).toInt()
      Rect(0, (src.height - h) / 2, src.width, (src.height - h) / 2 + h)
    }
    val out = Bitmap.createBitmap(targetW, targetH, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val dst = RectF(0f, 0f, targetW.toFloat(), targetH.toFloat())
    paint.color = Color.parseColor("#1F2233")
    canvas.drawRoundRect(dst, radius, radius, paint)
    paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
    canvas.drawBitmap(src, crop, dst, paint)
    return out
  }

  companion object {
    private const val DEFAULT_ACCENT = 0xFF6C63FF.toInt()

    // Izgara hücresi ~90dp genişlik; 198×297 px yaklaşık 2× yoğunluk demek ve
    // hücre başına ~235 KB tutar. Bir RemoteViews nesnesi binder üzerinden
    // geçerken 1 MB sınırına takılabildiği için hücre başına tek bitmap ve bu
    // boy bilinçli seçildi.
    private const val POSTER_W_PX = 198
    private const val POSTER_H_PX = 297
    private const val CORNER_PX = 22f

    // Bayt tabanlı cache: sabit sayı yerine bütçe, çünkü tek hücre ~235 KB.
    // 8 MB ≈ 34 poster — görünür alan artı kaydırma tamponu için yeterli;
    // taşanlar yeniden indirilir.
    private val cache = object : LruCache<String, Bitmap>(8 * 1024 * 1024) {
      override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount
    }
  }
}
