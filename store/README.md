# Mağaza (Play Store) varlıkları

> **DURUM (15 Kas 2026):** Metinler, ikon, feature graphic ve 8 ekran görüntüsü (TR + EN) güncel.
> Ekranlar iPhone'dan, İngilizce arayüzle çekildi; TR sette yalnız başlıklar Türkçe.

## Dizin yapısı

```
store/
  play/
    tr-TR/   title.txt, short-description.txt, full-description.txt
    en-US/   title.txt, short-description.txt, full-description.txt
  assets/
    play-icon-512.png              ← assets/icon_default/icon.png'den (Lens)
    feature-graphic-tr.png / -en   ← python store/uret-feature-graphic.py
    screenshots/{tr-TR,en-US}/     ← python store/uret-ekran-goruntuleri.py
  raw-screenshots/ios-en/          ← kaynak iPhone ekranları (1206×2622)
  uret-feature-graphic.py
  uret-ekran-goruntuleri.py        ← başlıklar ve kırpma bu dosyada
```

Kurallar: ad metin içinde küçük harfle **seelogd** (marketing/marka/MARKA_REHBERI.md).
Plan, limit veya dil değişirse metni koddan doğrula: `utils/premiumFeatures.js`,
`utils/premium.js` (AI kotası), `utils/appLanguages.js`.

## Play karakter limitleri

| Alan            | Limit     | Dosya                  |
| --------------- | --------- | ---------------------- |
| Uygulama adı    | 30 krk    | title.txt              |
| Kısa açıklama   | 80 krk    | short-description.txt  |
| Tam açıklama    | 4000 krk  | full-description.txt   |

## Görseller

- **Mağaza ikonu**: 512×512 PNG ✅
- **Feature graphic**: 1024×500 ✅ (TR + EN)
- **Telefon ekran görüntüleri**: 8 adet, 1080×1920 ✅ (TR + EN). iPhone oranı Play'in 2:1 sınırını
  aştığı için ekranlar telefon çerçevesi içinde marka zemini üzerine yerleştirildi; saat/pil gizlendi.

## Console tarafında metinlerle birlikte girilecekler

- Gizlilik politikası URL'si: `https://seelogd.com/privacy.html`
- Hesap silme URL'si: `https://seelogd.com/delete-account.html` (Data Safety formunda)
- Data Safety formu: `docs/kurulum/PLAY_DATA_SAFETY.md`
- İçerik derecelendirme (IARC): UGC var (sohbet/yorum/gönderi) → "evet" +
  raporlama/engelleme mekanizmaları gösterilecek
