# Seelogd Top 100

Eğlence sekmesinde, Günün Sorusu'nun altında. Film ve dizilerin **karışık** topluluk sıralaması: **en çok oy alan en üstte** (puan ortalaması sıralamaya girmez).

## Sıralama

- Oy = "hype": puansız, tek dokunuşluk destek. Kullanıcı başına yapım başına tek oy; tekrar dokununca geri alınır.
- Uygulama yeni olduğu için TMDB'deki **değerlendirme sayısı** (`vote_count`) da oy sayılır.
- **Hibrit oy = TMDB değerlendirme sayısı + Seelogd oyu × `SEELOGD_VOTE_WEIGHT` (100).** Ağırlık olmasaydı on binlerce TMDB değerlendirmesi yanında Seelogd oyları sırayı oynatamazdı; topluluk büyüdükçe düşürmek tek sabit değişikliği.
- Eşitlikte önce Seelogd oyu, sonra TMDB ortalaması.
- Havuz: `discover/{movie,tv}?sort_by=vote_count.desc`, her türden 5 sayfa (100'er). İki türün ilk 100'ü birleşince TMDB'ye göre karışık ilk 100 kesinleşir; havuz dışında Seelogd oyu alan yapımlar detay ucundan eklenir.
- Çekirdek: `utils/top100.js` (saf, `__tests__/top100.test.js`).

## Premium — aktif oy hakkı

- **Oy hakkı sınırlı** (29 Eki kullanıcı kararı): Free 0 · Premium 10 · Max 20 AKTİF oy (`utils/premiumFeatures.js` → `top100_vote`, COUNT). Herkes her yapıma oy verseydi oy sırayı oynatmazdı; sınır her oyu bir seçime çevirir. Oyu geri almak her planda serbest ve hakkı geri verir.
- Listeyi görmek, aramak, liste olarak kaydetmek ve sohbete göndermek her planda açık.
- Üst kartta "Oy hakkın: 3/10" hapı (dolunca koyu kırmızı). Free'de ya da hak doluyken oy düğmeleri kilit simgesiyle çizilir; dokunuş yazmaz, `usePremiumGate("top100_vote").showUpsell({ used, preview })` standart yükseltme sayfasını açar: Free'de "Top 100'de oy Premium'da", Premium'da hak doluyken "Oy hakkın doldu" + kullanım göstergesi (Max'a yükselt). Sayfada `preview.kind: "vote"` kartı: yapımın afişi (köşede kilit), sırası, oy sayısı ve "Oyun sıralamada +100 sayılır" (`buildVotePreview` → `VotePreviewCard`).
- Plan düşünce verilmiş oylar sayılmaya devam eder; geri alınabilir, yenisi verilemez.
- Ayarlar > Kullanım ve haklar satırı cihazdaki oy kaydından sayar.
- **Sunucu aynası (sayılar AYNI olmalı; `__tests__/top100VotePreview.test.js` korur):** `firestore.rules` `Top100Hype/{key}/votes/{uid}` create, `Users/{uid}.entitlements` planından `hypeVoteLimit()` (0/10/20) okur. Kullanıcının aktif oy sayısı `Top100HypeUsers/{uid}` → `{ used, last }`: yalnız AYNI yazımda `last` yapımına oy verilirken +1, o oy geri alınırken −1 — sayaç oy olmadan düşürülüp hak şişirilemez. Hak sisteminden önce verilmiş oy (hak kaydı yok) sayaca dokunmadan geri alınabilir. `__DEV__` plan simülatörü yalnız istemciyi değiştirir.

## Veri

- `Top100Hype/{movie|tv}_{tmdbId}` → `{ type, id, count }` (herkes okur).
- `Top100Hype/{key}/votes/{uid}` → `{ hype: true }` (yalnız sahibi okur).
- `Top100HypeUsers/{uid}` → `{ used, last }` (aktif oy hakkı sayacı; yalnız sahibi okur).
- Aç/kapa tek transaction (`services/top100Service.setTop100Hype`): oy oluşturulurken yapım sayacı ve hak sayacı +1, silinirken −1; hak doluysa yazmaz (`TOP100_LIMIT_ERROR`). `firestore.rules` eşleşmeyi zorunlu kılar. Emülatör testleri: `__tests__/rules/firestore.rules.test.js` → "Seelogd Top 100 (Top100Hype)".
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
