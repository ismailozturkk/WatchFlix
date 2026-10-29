# Seelogd Top 100

Eğlence sekmesinde, Günün Sorusu'nun altında. Film ve dizilerin **karışık** topluluk sıralaması.

## Sıralama

- Varsayılan liste: TMDB'nin en çok oylanan film + dizileri (`discover … sort_by=vote_count.desc`, 3 sayfa) ve en yüksek puanlılar (`top_rated`, 1 sayfa).
- Seelogd kullanıcısı 1–10 puan verir. Puan **TMDB oylamasına eklenir**:
  - TMDB ortalaması, ağırlığı `20 × log10(oy sayısı + 1)` (en çok 100) olan bir ön oy kütlesi sayılır.
  - Birleşik ortalama = (TMDB ort. × ağırlık + Seelogd toplamı) / (ağırlık + Seelogd oy sayısı).
  - Sıra puanı = Bayes ağırlıklı puan (25 sanal oyla 7,0'a çekim): tek bir 10 oyu az oylu yapımı zirveye taşımaz.
- Aramadan oy verilen, havuzda olmayan yapım da yarışa girer (Seelogd oyu olan yapım 300 TMDB oyu alt sınırından muaftır).
- Çekirdek: `utils/top100.js` (saf, `__tests__/top100.test.js`).

## Veri

- `Top100/{movie|tv}_{tmdbId}` → `{ type, id, sum, count }` (herkes okur).
- `Top100/{key}/votes/{uid}` → `{ score }` (yalnız sahibi okur).
- Yazım tek transaction (`services/top100Service.castTop100Vote`); `firestore.rules` sayaç ile oyun birlikte ve tutarlı yazılmasını zorunlu kılar. Oy değiştirilebilir, silinemez. Emülatör testleri: `__tests__/rules/firestore.rules.test.js` → "Seelogd Top 100".
- Kendi oylarının cihaz kopyası: `Keys.top100Votes`.

## Arayüz

- Kart: `components/hub/Top100Widget.js` (ilk üç kürsü). Bölüm kimliği `top100` (Ayarlar > Ekran bölümleri).
- Ekran: `screens/fun/Top100Screen.js` — arama, Tümü/Film/Dizi süzgeci, satırda "Oy ver" / kendi puanın.
- `components/top100/Top100VoteSheet.js` (1–10), `Top100CountSheet.js` (İlk 20 · 50 · 70 · 100).
- "Liste olarak kaydet" → `SaveSharedListModal`; "Sohbete gönder" → `ShareToChatSheet` (`listShare`). İkinci sayfa sayım sayfasının `onDismissed`'ında açılır.
- Metinler: `utils/top100Copy.js` (tr/en/es/pt/de).
- Afişler özel afiş çözücüsünden geçmez (ortak sıralama; turnuva gibi).
