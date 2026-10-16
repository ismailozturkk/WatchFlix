package com.smlztrk.seelogd.widget

import java.util.Locale

/**
 * Widget'ların dil kararı. JS tarafı uygulama dil kodunu ("tr" | "en" | "es" …)
 * SharedPreferences'a yazar (services/*WidgetService.js → updateX(payload, language)).
 *
 * KURAL (utils/appLanguages.js ile AYNI): bilinmeyen dil → İNGİLİZCE. Kayıt yoksa
 * eski davranış korunur ("tr"). YENİ DİL: [SUPPORTED]'a kodu ekle ve her pick(...)
 * çağrısına metni ver; iOS tarafı targets/reminder-widget/shared.swift'te aynı yapıda.
 */
object WidgetLanguage {
  private val SUPPORTED = setOf("tr", "es")

  fun of(raw: String?): String {
    val base = (raw ?: "tr").trim().lowercase(Locale.ROOT).substringBefore('-').substringBefore('_')
    return if (base in SUPPORTED) base else "en"
  }

  fun pick(lang: String, tr: String, en: String, es: String): String =
    when (lang) {
      "tr" -> tr
      "es" -> es
      else -> en
    }

  fun locale(lang: String): Locale =
    when (lang) {
      "tr" -> Locale("tr")
      "es" -> Locale("es")
      else -> Locale.ENGLISH
    }
}
