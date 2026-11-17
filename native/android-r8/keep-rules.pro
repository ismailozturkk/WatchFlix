# Seelogd'a özgü R8 koruma kuralları.
# plugins/withAndroidR8.js bu dosyayı prebuild'de android/app/proguard-rules.pro içine ekler.
# Rehber: docs/planlama/R8_ETKINLESTIRME_UYGULAMA_REHBERI.md
#
# KURAL: buraya global "-dont..." bayrakları ve "-keep class **" gibi geniş kurallar
# YAZILMAZ — Play'in %25 optimizasyon/karartma/küçültme eşiklerini düşürür.
# Her kuralın gerekçesi yazılır (__tests__/androidR8Plugin.test.js denetler).

# Alternatif simge takma adları MainActivity'nin sınıf adından türetiliyor
# (native/android-widgets/.../AppIconRes.kt, modules/app-icon AppIconModule.kt).
# Ad karartılırsa simge değişimi ve widget simgesi sessizce bozulur.
-keepnames class com.smlztrk.seelogd.MainActivity

# Ana ekran widget'ları: sistem provider/service sınıflarını manifest adıyla başlatır,
# hata uygulama içinde görünmez. Savunma amaçlı; ~1.600 satır, ölçülebilir maliyeti yok.
-keep class com.smlztrk.seelogd.widget.** { *; }
