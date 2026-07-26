package com.smlztrk.seelogd.widget

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
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * Kaydırılabilir hatırlatma listesini besleyen koleksiyon servisi. Her satırı
 * getViewAt() üretir; poster bitmap'i arka planda (bu iş parçacığı zaten
 * arka planda çalışır) indirilir ve LruCache'lenir. RemoteViews URL yükleyemez,
 * bu yüzden posteri elle çekip yuvarlatıp setImageViewBitmap ile veririz.
 */
class ReminderWidgetRemoteViewsService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
    ReminderRemoteViewsFactory(applicationContext)
}

private data class WidgetItem(
  val id: String,
  val type: String,
  val title: String,
  val subtitle: String,
  val poster: String,
  val dateEpoch: Long,
)

private class ReminderRemoteViewsFactory(
  private val context: Context,
) : RemoteViewsService.RemoteViewsFactory {

  private var items: List<WidgetItem> = emptyList()
  private var isTurkish: Boolean = true

  override fun onCreate() { /* veri onDataSetChanged'de yüklenir */ }

  override fun onDataSetChanged() {
    val prefs = context.getSharedPreferences(
      ReminderWidgetProvider.PREFS_NAME,
      Context.MODE_PRIVATE,
    )
    isTurkish = (prefs.getString(ReminderWidgetProvider.KEY_LANGUAGE, "tr") ?: "tr").startsWith("tr")
    items = parseItems(prefs.getString(ReminderWidgetProvider.KEY_ITEMS, "[]") ?: "[]")
      .filter { it.dateEpoch >= startOfToday() }
      .sortedBy { it.dateEpoch }
  }

  override fun onDestroy() { items = emptyList() }

  override fun getCount(): Int = items.size

  override fun getViewAt(position: Int): RemoteViews {
    val rv = RemoteViews(context.packageName, R.layout.reminder_widget_item)
    val item = items.getOrNull(position) ?: return rv

    val isMovie = item.type == "movie"

    // Poster: indir + yuvarlat. Başarısızsa tip ikonlu gradyan rozet göster.
    val bitmap = loadPoster(item.poster)
    if (bitmap != null) {
      rv.setViewVisibility(R.id.reminder_widget_item_poster, View.VISIBLE)
      rv.setViewVisibility(R.id.reminder_widget_item_badge, View.GONE)
      rv.setImageViewBitmap(R.id.reminder_widget_item_poster, bitmap)
    } else {
      rv.setViewVisibility(R.id.reminder_widget_item_poster, View.GONE)
      rv.setViewVisibility(R.id.reminder_widget_item_badge, View.VISIBLE)
      rv.setImageViewResource(
        R.id.reminder_widget_item_badge,
        if (isMovie) R.drawable.reminder_widget_ic_movie else R.drawable.reminder_widget_ic_tv,
      )
      rv.setInt(
        R.id.reminder_widget_item_badge,
        "setBackgroundResource",
        if (isMovie) R.drawable.reminder_widget_movie_badge
        else R.drawable.reminder_widget_tv_badge,
      )
    }

    rv.setTextViewText(R.id.reminder_widget_item_title, item.title)

    val typeLabel = when {
      isMovie && isTurkish -> "Film"
      isMovie -> "Movie"
      isTurkish -> "Dizi"
      else -> "TV"
    }
    val meta = listOf(typeLabel, item.subtitle).filter { it.isNotBlank() }.joinToString("  •  ")
    rv.setTextViewText(R.id.reminder_widget_item_meta, meta)

    val isToday = startOfDay(item.dateEpoch) == startOfToday()
    rv.setTextViewText(R.id.reminder_widget_item_when, countdown(item.dateEpoch))
    rv.setTextColor(
      R.id.reminder_widget_item_when,
      if (isToday) COUNTDOWN_TODAY else COUNTDOWN_DEFAULT,
    )
    rv.setTextViewText(R.id.reminder_widget_item_date, shortDate(item.dateEpoch))
    rv.setInt(
      R.id.reminder_widget_item_root,
      "setBackgroundResource",
      if (isToday) R.drawable.reminder_widget_row_bg_today
      else R.drawable.reminder_widget_row_bg,
    )

    // Tıklama: template provider'da; buradan sadece doldurma intent'i verilir.
    val fillIn = Intent().apply { putExtra("reminderId", item.id) }
    rv.setOnClickFillInIntent(R.id.reminder_widget_item_root, fillIn)

    return rv
  }

  override fun getLoadingView(): RemoteViews? = null
  override fun getViewTypeCount(): Int = 1
  override fun getItemId(position: Int): Long = items.getOrNull(position)?.id?.hashCode()?.toLong() ?: position.toLong()
  override fun hasStableIds(): Boolean = true

  // ── Poster indirme + yuvarlatma (LruCache'li) ──────────────────────────────
  private fun loadPoster(url: String): Bitmap? {
    if (url.isBlank()) return null
    cache.get(url)?.let { return it }
    return try {
      val conn = (URL(url).openConnection() as HttpURLConnection).apply {
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

  private fun countdown(epoch: Long): String {
    val diff = TimeUnit.MILLISECONDS.toDays(startOfDay(epoch) - startOfToday())
    return when (diff) {
      0L -> if (isTurkish) "Bugün" else "Today"
      1L -> if (isTurkish) "Yarın" else "Tomorrow"
      else -> if (isTurkish) "$diff gün" else "$diff days"
    }
  }

  private fun shortDate(epoch: Long): String {
    val locale = if (isTurkish) Locale("tr") else Locale.ENGLISH
    return SimpleDateFormat("d MMM", locale).format(Date(epoch))
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

  private fun parseItems(raw: String): List<WidgetItem> = try {
    val array = JSONArray(raw)
    buildList {
      for (index in 0 until array.length()) {
        val obj = array.optJSONObject(index) ?: continue
        val epoch = obj.optLong("dateEpoch", -1L)
        if (epoch <= 0L) continue
        add(
          WidgetItem(
            id = obj.optString("id"),
            type = obj.optString("type"),
            title = obj.optString("title"),
            subtitle = obj.optString("subtitle"),
            poster = obj.optString("poster"),
            dateEpoch = epoch,
          ),
        )
      }
    }
  } catch (_: Exception) {
    emptyList()
  }

  companion object {
    private val COUNTDOWN_TODAY = Color.parseColor("#DDD9FF")
    private val COUNTDOWN_DEFAULT = Color.parseColor("#C9C7FF")
    // 34x50dp @ ~3x → poster hedef pikselleri (net görünüm için sabit).
    private const val POSTER_W_PX = 108
    private const val POSTER_H_PX = 156
    private const val CORNER_PX = 20f
    // En fazla 20 öğe var; 30'luk sayı-tabanlı cache tümünü tutar
    // (~30 × 108×156×4B ≈ 2 MB) ve yenilemede tekrar indirmeyi önler.
    private val cache = LruCache<String, Bitmap>(30)
  }
}
