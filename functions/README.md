# WatchFlix Cloud Functions — Push Bildirim Sunucusu

Uygulama kapalı/arka plandayken bile sosyal bildirimleri (beğeni, yorum, mention,
arkadaşlık, mesaj) push olarak gönderir. İstemcide kayıtlı Expo push token'larını
kullanır → **istemci tarafında kod değişikliği gerekmez.**

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
