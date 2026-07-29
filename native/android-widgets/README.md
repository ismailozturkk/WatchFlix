# Android ana ekran widget'ları (native kaynak)

Seelogd'un üç Android widget'ının native kaynağı buradadır; `android/` dizini
repoda tutulmaz (CNG). [plugins/withAndroidWidgets.js](../../plugins/withAndroidWidgets.js)
her `expo prebuild`'de (yerel + EAS bulut) bu dosyaları üretilen projeye enjekte eder:

- **java/com/smlztrk/seelogd/widget/** — 9 Kotlin dosyası: `Reminder`/`Lists`/`Stats`
  üçlüsünün provider + RemoteViewsService + JS köprü modülleri ve `SeelogdWidgetPackage`
  (plugin bunu MainApplication'a kaydeder).
- **res/xml/** — appwidget-provider tanımları (boyutlar, önizleme, 30 dk update peryodu)
- **res/layout/**, **res/drawable/** — widget arayüzleri ve önizlemeleri
- **res/values/widget_strings.xml** — manifest label + açıklama string'leri

JS tarafı: [services/widgetBridge.js](../../services/widgetBridge.js) →
`NativeModules.{Reminder,Lists,Stats}WidgetModule`; veri `SharedPreferences`
üzerinden taşınır, besleyenler `ProfileStatsContext` ve `ProfileRemindersContext`.

Dikkat:

- Kotlin kodu ve `LISTS_CYCLE` broadcast action'ı `com.smlztrk.seelogd` paket adına
  gömülü — paket adı değişirse buradaki kaynaklar da güncellenmeli (plugin bu durumda
  bilerek hata fırlatır).
- iOS karşılığı ayrı düzendedir: `targets/reminder-widget/` + `@bacons/apple-targets`.
