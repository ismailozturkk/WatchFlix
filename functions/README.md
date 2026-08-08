# Seelogd Cloud Functions — Push Bildirim + Gemini Proxy Sunucusu

1. **Push bildirim:** uygulama kapalı/arka plandayken bile sosyal bildirimleri
   (beğeni, yorum, mention, arkadaşlık, mesaj) push olarak gönderir.
2. **`callGemini` (callable):** AI sohbet proxy'si — Gemini API anahtarı YALNIZ
   burada durur (Secret Manager), kullanıcı başına günlük kota uygular
   (free 5 / premium 100, `AiUsage/{uid}` sayacı). Yayın blokeri çözümü:
   `docs/planlama/YAYIN_VE_GELIR_YOL_HARITASI.md` §1.2 madde 1.

## Gemini proxy kurulumu (Faz 0 — ZORUNLU)

```bash
# 1) Google AI Studio'dan YENİ bir Gemini anahtarı üret.
# 2) ESKİ anahtarı (EXPO_PUBLIC_GEMINI_API_KEY ile dağıtılmış olanı) İPTAL ET.
# 3) Yeni anahtarı yalnız sunucu secret'ına koy:
firebase functions:secrets:set GEMINI_API_KEY
# 4) Deploy:
firebase deploy --only functions
```

Notlar:
- İstemci artık `.env`'deki `EXPO_PUBLIC_GEMINI_API_KEY`'i KULLANMAZ; satırı
  `.env`'den silebilirsin (eski anahtarın iptali yine de şart — eski APK'larda gömülü).
- App Check (Play Integrity) istemcide kurulunca `functions/index.js` içindeki
  `enforceAppCheck: false` → `true` yapılmalı (Faz 0 Hafta 2).
- Kota sabitleri: `AI_DAILY_LIMIT_FREE` / `AI_DAILY_LIMIT_PREMIUM`
  (`functions/index.js`). Premium tespiti `Users/{uid}.entitlements.premium`
  alanından — Faz 1'de RevenueCat webhook'u bu alanı dolduracak.

## Mimari

```
İstemci: Users/{uid}/notifications/{notifId} dökümanı oluşturur
            │  (createSocialNotification — zaten mevcut)
            ▼
Cloud Function: onSocialNotificationCreated (Firestore trigger)
            │  alıcının Users/{uid}.expoPushToken('s)'ını okur
            ▼
Expo Push API → kullanıcının cihazı (arka planda da)
```

## Kurulum (tek seferlik)

1. **Blaze planına geç** (Functions Spark'ta deploy edilemez):
   Firebase Console → ⚙️ → Usage and billing → Modify plan → Blaze.
   (Küçük projede ücretsiz kota içinde kalır, maliyet ~0.)

2. **Firebase CLI** (global, bir kez):
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

3. **Bağımlılıkları kur:**
   ```bash
   cd functions
   npm install
   ```

## Deploy

Proje kökünden (yalnızca functions; rules/hosting'e dokunmaz):
```bash
firebase deploy --only functions
```

## Test

1. EAS dev/standalone build ile uygulamayı aç (Expo Go push token üretmez).
2. İzin ver → `Users/{uid}.expoPushToken` Firestore'da dolmalı.
3. Başka bir hesapla o kullanıcının gönderisini beğen / yorum yap / mesaj at.
4. Uygulamayı **tamamen kapat** → bildirim push olarak gelmeli.
5. Loglar: `firebase functions:log` veya Console → Functions → Logs.

## Bilinen sınırlar / gelecek iş

- **Tür-bazlı ayarlar sunucuda görünmez.** Cihazdaki `notificationSettings`
  (postLikesEnabled vb.) AsyncStorage'da → arka plan push tüm türler için gider.
  Tür bazlı kontrol istersen, ayarları `Users/{uid}.notificationSettings` olarak
  Firestore'a da yaz ve bu Function'da kontrol et.
- **Dil:** metinler şu an TR. Çok dilli istersen `Users/{uid}.language` yaz ve
  `buildContent`'i ona göre dallandır.
- **Foreground çakışması:** uygulama açıkken hem yerel (`presentNow`) hem push
  görünüp çift bildirim olabilir. Backend yayına alınınca istemcideki foreground
  sosyal gösterimi kaldırmak istenebilir.
