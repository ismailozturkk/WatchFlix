# Streaming Uygunluk Bildirimleri — Kurulum / Deploy Kılavuzu

> Kullanıcının **izleme listesindeki** bir yapım, **abone olduğu bir platforma**
> eklenince push bildirimi gönderir. Örn: *"Dune: Part Two — 📺 Netflix
> platformunda izlenebilir"*.
>
> Durum: Kod tamam + saf diff mantığı jest ile test edildi. **Backend deploy ve
> gerçek push bu Windows ortamında çalıştırılamadı**; aşağıdaki adımlarla
> Firebase'e deploy edilip doğrulanmalı.

## Mimari (veri akışı)

```
İstemci (opt-in):
  Ayarlar > Bildirimler > "Yayına gelince bildir" toggle  → notificationSettings.streamingEnabled
  Ayarlar > Platform üyeliklerim (zaten var)              → streamingProviderIds
        │  DeviceNotificationsContext mirror'ı Users/{uid}'e yazar:
        ▼
  Users/{uid} = {
    notificationSettings.streamingEnabled: true,
    streamingProviders: { ids: [8, 337, ...], region: "TR" },
    expoPushToken(s), notificationLanguage
  }

Backend (günlük 18:00, Europe/Istanbul):
  dailyStreamingAvailability
    → streamingEnabled==true kullanıcılar
    → her biri için Lists/{uid}/watchList
    → TMDB watch/providers (region) — çalışma-içi cache ile dedupe
    → ProviderWatch/{uid} snapshot ile diff (streamingDiff.js)
    → yeni gelen (abone olunan) sağlayıcı için Expo push
    → snapshot güncelle
```

## Bu değişiklikte eklenenler

| Dosya | Görev |
|---|---|
| `functions/streamingDiff.js` | Saf diff mantığı (sağlayıcı çıkarımı + "yeni gelen" hesabı) — test'li |
| `functions/index.js` | `dailyStreamingAvailability` zamanlanmış fonksiyon + TMDB_API_KEY secret |
| `__tests__/streamingDiff.test.js` | Diff mantığı birim testleri (8 test) |
| `context/AppSettingsContext.js` | `streamingEnabled` bildirim ayarı (varsayılan kapalı) |
| `context/DeviceNotificationsContext.js` | Firestore mirror + bildirim tıklama yönlendirmesi |
| `screens/tabs/settings/ReminderNotificationsScreen.js` | "Yayına gelince bildir" toggle'ı |
| `translations/{tr,en}.json` | Toggle metinleri |
| `firestore.rules` | `ProviderWatch/{uid}` (sahibi okur, yalnız sunucu yazar) |

## Ön koşul: TMDB v4 token

TMDB hesabı → Settings → API → **API Read Access Token** (v4, uzun JWT). Bu,
istemcideki `EXPO_PUBLIC_API_KEY` ile aynı token olabilir.

## Deploy adımları

```bash
# 1) TMDB token'ını Cloud Functions secret'ı olarak ekle
firebase functions:secrets:set TMDB_API_KEY
# (açılan girişe v4 Read Access Token'ı yapıştır)

# 2) Fonksiyonları deploy et (yeni zamanlanmış fonksiyon dahil)
cd functions && npm install && cd ..
firebase deploy --only functions:dailyStreamingAvailability

# 3) Firestore kurallarını deploy et (ProviderWatch)
firebase deploy --only firestore:rules
```

Deploy sırasında Cloud Functions v2, `onSchedule` için otomatik bir **Cloud
Scheduler** işi oluşturur (Cloud Scheduler API'sinin projede açık olması gerekir;
Firebase konsolu genellikle sorar/açar). Zamanlama: **her gün 18:00 (TR saati)**.

## Kullanıcının yapması gerekenler (uygulama içinde)

1. Ayarlar > Bildirimler > **"Yayına gelince bildir"** toggle'ını aç.
2. Ayarlar > **Platform üyeliklerim**'den abone olduğu servisleri seç (bu ekran
   zaten vardı; `streamingProviderIds`).
3. İzleme listesine (watchList) yapım ekle.

## Nasıl çalışır (diff mantığı)

- İlk çalışmada her başlık için **baseline** kaydedilir → bildirim YOK (kullanıcı
  listeye eklediğinde zaten var olan sağlayıcılar "yeni" sayılmaz, spam önlenir).
- Sonraki çalışmalarda: bir sağlayıcı **yoktan → var** olduysa VE kullanıcı o
  sağlayıcıya aboneyse VE daha önce bildirilmediyse → push.
- Bir sağlayıcı listeden düşerse `notified`'dan çıkar (tekrar gelirse yeniden bildirilir).
- Yalnız **flatrate + free + ads** (abonelik/ücretsiz) sayılır; **rent/buy hariç**.

## Doğrulama

```bash
# Zamanı beklemeden elle tetikle (deploy sonrası):
gcloud scheduler jobs run firebase-schedule-dailyStreamingAvailability-us-central1

# Logları izle:
firebase functions:log --only dailyStreamingAvailability
# Beklenen: "[streaming] tamam — kullanıcı: N, bildirilen başlık: M, ..."
```

Uçtan uca test: bir test hesabında toggle'ı aç, bir servis seç (ör. Netflix), o
serviste **olmayan** ama yakında gelecek bir filmi watchList'e ekle. İlk çalışma
baseline kurar; film o servise geldikten sonraki çalışmada push gelir. (Hızlı
test için: watchList'e bir film ekleyip ilk çalışmayı yaptır, sonra
`ProviderWatch/{uid}` içindeki o başlığın `a` dizisinden bir sağlayıcıyı elle
silip tekrar çalıştır → o sağlayıcı "yeni gelmiş" gibi bildirilir.)

## Maliyet / ölçeklenme notları

- **Çalışma-içi cache**: aynı (bölge|tür|id) için TMDB bir kez çekilir → popüler
  başlıklar kullanıcılar arasında tekrar sorgulanmaz.
- Kullanıcı başına en çok `STREAM_MAX_WATCHLIST_PER_USER = 100` başlık işlenir.
- Tek çalışmada en çok `STREAM_MAX_USERS = 3000` kullanıcı; `timeoutSeconds: 540`.
- Kullanıcı sayısı büyürse: kullanıcıyı uid hash'ine göre parçalayıp (shard)
  birden çok zamanlamaya bölmek veya Cloud Tasks fan-out'u önerilir.
- TMDB limiti (~50 req/s) sıralı işleyişte rahatça altında kalınır.

## Bilinen sınırlar

- **"Yakında kalkacak" (expiring) bildirimi yok** — TMDB kalkış tarihi vermez;
  yalnız "artık geldi" (yoktan→var) desteklenir.
- Bölge kullanıcının uygulama diline bağlı (`tr→TR`, `en→US`). Ayrı bir "ülke"
  seçici ileride eklenebilir.
- Backend deploy + gerçek push **Windows'ta doğrulanamadı**; yukarıdaki adımlarla
  Firebase'de test edilmeli.
