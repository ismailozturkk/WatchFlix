# Seelogd Top 100

Eğlence sekmesinde, Günün Sorusu'nun altında. Film ve dizilerin **karışık** topluluk sıralaması: **en çok oy alan en üstte** (puan ortalaması sıralamaya girmez).

## Sıralama

- Oy = "hype": puansız, tek dokunuşluk destek. Kullanıcı başına yapım başına tek oy; tekrar dokununca geri alınır.
- Uygulama yeni olduğu için TMDB'deki **değerlendirme sayısı** (`vote_count`) da oy sayılır.
- **Hibrit oy = TMDB değerlendirme sayısı + Seelogd oyu × `SEELOGD_VOTE_WEIGHT` (100).** Ağırlık olmasaydı on binlerce TMDB değerlendirmesi yanında Seelogd oyları sırayı oynatamazdı; topluluk büyüdükçe düşürmek tek sabit değişikliği.
- Eşitlikte önce Seelogd oyu, sonra TMDB ortalaması.
- Havuz: `discover/{movie,tv}?sort_by=vote_count.desc`, her türden 5 sayfa (100'er). İki türün ilk 100'ü birleşince TMDB'ye göre karışık ilk 100 kesinleşir; havuz dışında Seelogd oyu alan yapımlar detay ucundan eklenir.
- Çekirdek: `utils/top100.js` (saf, `__tests__/top100.test.js`).

## Veri

- `Top100Hype/{movie|tv}_{tmdbId}` → `{ type, id, count }` (herkes okur).
- `Top100Hype/{key}/votes/{uid}` → `{ hype: true }` (yalnız sahibi okur).
- Aç/kapa tek transaction (`services/top100Service.setTop100Hype`): oy oluşturulurken sayaç +1, silinirken −1. `firestore.rules` eşleşmeyi zorunlu kılar. Emülatör testleri: `__tests__/rules/firestore.rules.test.js` → "Seelogd Top 100 (Top100Hype)".
- İlk sürümün puanlı `Top100` koleksiyonu kapatıldı (kural yok → erişilemez).
- Kendi oylarının cihaz kopyası: `Keys.top100Hype` (`top100_hype:`); eski `top100_votes:` bilerek okunmaz.

## Arayüz

- Kart: `components/hub/Top100Widget.js` (ilk üç kürsü + oy sayıları). Bölüm kimliği `top100` (Ayarlar > Ekran bölümleri).
- Ekran: `screens/fun/Top100Screen.js` — **4'lü afiş ızgarası**; her afişte sıra rozeti (ilk üç madalya rengi), başlık, hibrit oy sayısı ve "Oy ver" / "Oyladın" düğmesi. Arama, Tümü/Film/Dizi süzgeci.
- Üst kart yalnız başlık, ünlem düğmesi ve "Liste olarak kaydet" / "Sohbete gönder"i taşır; ayrıntılı açıklama ünlem düğmesiyle açılan `components/top100/Top100InfoSheet.js`'te (`infoSections`).
- Toplam Seelogd oyu `MIN_SHOWN_TOTAL_VOTES` (100) altındayken ekran ve Eğlence kartında gösterilmez (`showsTotalVotes`).
- `components/top100/Top100CountSheet.js` (İlk 20 · 50 · 70 · 100) → `SaveSharedListModal` / `ShareToChatSheet` (`listShare`). İkinci sayfa sayım sayfasının `onDismissed`'ında açılır.
- Metinler: `utils/top100Copy.js` (tr/en/es/pt/de; sayılar dilin basamak ayracıyla).
- Afişler özel afiş çözücüsünden geçmez (ortak sıralama; turnuva gibi).
