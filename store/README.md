# Mağaza (Play Store) varlıkları

> **DURUM (15 Kas 2026):** Metinler, ikon ve feature graphic güncel (Lens markası).
> **Ekran görüntüleri ESKİ** (29 Tem, eski arayüz + eski "S" logo) — yeniden çekilecek.

## Dizin yapısı

```
store/
  play/
    tr-TR/   title.txt, short-description.txt, full-description.txt
    en-US/   title.txt, short-description.txt, full-description.txt
  assets/
    play-icon-512.png              ← assets/icon_default/icon.png'den (Lens)
    feature-graphic-tr.png / -en   ← python store/uret-feature-graphic.py
    screenshots/tr-TR/             ← ESKİ, yenilenecek
  uret-feature-graphic.py
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
- **Telefon ekran görüntüleri**: en az 2, önerilen 4–8, 9:16 (1080×1920). TR ve EN ayrı set.

## Console tarafında metinlerle birlikte girilecekler

- Gizlilik politikası URL'si: `https://seelogd.com/privacy.html`
- Hesap silme URL'si: `https://seelogd.com/delete-account.html` (Data Safety formunda)
- Data Safety formu: `docs/kurulum/PLAY_DATA_SAFETY.md`
- İçerik derecelendirme (IARC): UGC var (sohbet/yorum/gönderi) → "evet" +
  raporlama/engelleme mekanizmaları gösterilecek
