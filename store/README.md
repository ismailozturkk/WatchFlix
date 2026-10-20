# Mağaza (Play Store) varlıkları

> **DURUM: TASLAK** — metinler "seelogd" adı üzerine yazıldı; marka taraması /
> ad kararı (yol haritası Bölüm 6, karar 1) kesinleşmeden Play Console'a girme.

## Dizin yapısı

```
store/
  play/
    tr-TR/   title.txt, short-description.txt, full-description.txt
    en-US/   title.txt, short-description.txt, full-description.txt
```

## Play karakter limitleri

| Alan            | Limit     | Dosya                  |
| --------------- | --------- | ---------------------- |
| Uygulama adı    | 30 krk    | title.txt              |
| Kısa açıklama   | 80 krk    | short-description.txt  |
| Tam açıklama    | 4000 krk  | full-description.txt   |

## Gerekli görseller (henüz yok)

- **Feature graphic**: 1024×500 PNG/JPG (zorunlu)
- **Telefon ekran görüntüleri**: en az 2, önerilen 4–8 (16:9 veya 9:16,
  her kenar 320–3840 px) — TR ve EN ayrı setler önerilir
- **Mağaza ikonu**: 512×512 PNG (app.json'daki adaptive icon'dan üretilebilir)
- (Opsiyonel) 30 sn tanıtım videosu — YouTube linki

## Console tarafında metinlerle birlikte girilecekler

- Gizlilik politikası URL'si: `https://seelogd.com/privacy.html` (deploy edilmiş olmalı!)
- Hesap silme URL'si: `https://seelogd.com/delete-account.html` (Data Safety formunda)
- Data Safety formu: Firebase (Auth/Firestore/Analytics), Sentry (crash),
  RevenueCat (satın alma), Advertising ID (Firebase Analytics ekler) beyan edilecek
- İçerik derecelendirme (IARC): UGC var (sohbet/yorum/gönderi) → "evet" +
  raporlama/engelleme mekanizmaları gösterilecek
