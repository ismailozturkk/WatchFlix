# Günün Karesi (E1 · Framed tarzı günlük oyun)

Kaynak: `docs/planlama/OZELLIK_ADAYLARI_2026-10-30.md` → E1. Plan + uygulama 30 Ekim 2026.

## Ne

Her gün **herkes için aynı tek film**. Önce az bilinen bir sahne karesi gelir; her yanlış tahminde (ya da "Geç"te)
yeni, daha tanıdık bir kare açılır. **6 kare / 6 hak.** Açılmış karelere geri dönülebilir. Sonuç kutucuklarla
paylaşılır:

```
Seelogd · Günün Karesi #3
🎬 🟥 ⬜ 🟥 🟩 ⬛ ⬛
```

🟥 yanlış tahmin · ⬜ geçildi · 🟩 bildin · ⬛ kullanılmadı. (Aday belgesindeki 🟨 "yakın" kutusu YOK: "yakın"ın
ölçüsü — aynı seri / aynı yönetmen — ek TMDB isteği ister ve tartışmalı olur; Framed da kullanmıyor.)

## Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Kapsam | Yalnız **film** | Dizilerin sahne kareleri bölümler arası karışık ve az; Framed da film. |
| Plan | **Premium** (30 Eki kararı; ilk sürümde Free'ye açıktı) | Registry `daily_frame` (ACCESS, `play`). Free kartı ve sohbet kartını görür; oynamak yükseltme açar. Kapılar: `ProfileGamesModule` (`frameLocked`), `DailyFrameScreen` (`usePremiumScreenGuard`, kilitliyken bulmaca yüklenmez), `SharedFrameMessage` ("Oyna"). |
| Arşiv | Geçmiş günlerin arşivi — **2. faz**, bu sürümde yok | Önce çekirdek oyun cihazda görülsün. |
| Gün sınırı | `utils/dailyChallenge.dayKeyOf` (TR 00:00, herkese aynı) | Günlük Meydan Okuma ile aynı gün. |
| Kayıt | **Cihaz-yerel** (`Keys.dailyFrame`), çıkışta silinmez | Deploy yok. Seri/dağılım bu cihazda. |
| Liderlik | Yok | Tahmin sayısı tek ölçü; tablo istenirse 2. faz (rules). |
| Sohbet | Yeni kart türü `frameShare` | Sonucu ve "sen de oyna"yı taşır, **cevabı asla taşımaz**. |
| Dışarı | RN `Share` ile düz metin (emoji satırı) | Native build gerekmez. |
| Hikâye kartı | 2. faz | Story tuvaline yeni düzen ayrı iş. |

Build: **Hayır** · Deploy: **Hayır** (rules / functions değişmez; sohbet mesaj türleri kuralda listelenmiyor).

## Bulmacanın seçimi (herkese aynı, tekrarsız)

1. **Gün numarası** `n = puzzleNumberOf(dayKey)` (ilk gün `FRAME_EPOCH_DAY` = #1).
2. **Yuva**: `slot = (FRAME_STRIDE × n + FRAME_OFFSET) mod FRAME_SLOTS` — `FRAME_SLOTS = 400` (TMDB `movie/top_rated`
   ilk 20 sayfası × 20), `FRAME_STRIDE` 400 ile aralarında asal → **400 gün boyunca aynı yuva iki kez gelmez**
   ve ardışık günler listenin farklı yerlerine düşer (bir gün 1990'lar dramı, ertesi gün animasyon…).
   Rastgele hash seçimi 30 günde ~%66 olasılıkla bir filmi tekrar ederdi; bu yüzden permütasyon.
3. Yuva → `page = slot / 20 + 1`, sayfa içi sıra. Sayfa **kimliğe göre** sıralanır (TMDB'nin sayfa içi sırası puanla
   gün içinde oynayabilir).
4. Aday filmin dilsiz (`include_image_language=null`) sahne kareleri çekilir (`fetchTitleImages`, mevcut önbellek).
   **En az 6 nitelikli kare** yoksa aynı sayfanın sıradaki filmine geçilir (en çok `FRAME_PROBE_MAX`); ilk uygun
   film günün bulmacasıdır. Hiçbiri yoksa sonraki sayfa.
5. Seçim **dilden bağımsız** (sayfa + kimlik + görseller dilsiz); yalnız başlık metni dile göre gelir.
6. Bulmaca cihazda o gün için önbelleklenir (`cachedRead`, anahtar gün + dil) → gün içinde TMDB oynasa da oyun
   ortasında kare değişmez; çevrimdışı da açılır.

**Bilinen sınır:** TMDB "en iyi" sıralaması günler içinde kayarsa iki cihaz aynı gün farklı sayfa içeriği görebilir
(çok nadir; Günlük Meydan Okuma'yla aynı güven modeli). Sunucuda sabit bulmaca istenirse 2. faz: zamanlanmış
function günün kimliğini `DailyFrame/{dayKey}`e yazar.

## Kare sırası (zor → kolay)

`selectFrames(backdrops)` (saf): nitelik süzgeci (dilsiz, en-boy 1.6–2.0, genişlik ≥ 1280; yetmezse ≥ 780).
TMDB görsel listesi oy sırasıdır (baştakiler en ikonik). 6 kare listeye **eşit aralıkla** yayılır ve
**sondan başa** gösterilir: 1. kare listenin sonundan (en az bilinen), 6. kare listenin başı (en tanınır).
Rastgelelik yok → herkeste aynı.

## İpuçları (kareye ek)

| Açık kare | Ek ipucu çipi |
|---|---|
| 1–2 | Yalnız kare |
| 3 | Türler (ilk 2) |
| 4 | + Yıl ("1999") |
| 5 | + Yönetmen (en çok 2; TMDB `credits`ten, bulmaca kurulurken bir kez çekilir — alınamazsa çip çıkmaz) |
| 6 | + Baş harf ("M…"; baştaki tırnak / parantez atlanır, `initialOf`) |

## Sonuç ekranı

Bitince kare görüntüleyicinin yerine: büyük kare + karar rozeti ("3/6 · Bildin" / "X/6 · Bilemedin") + cevap (afiş, ad,
yıl · yönetmen; dokununca film sayfası), kutucuklar, paylaş / sohbete gönder, kalan süre. Altında **Adım adım**: altı
satır, her birinde kare küçük resmi, o karede açılan ipucu ("+ Tür"), yapılan tahmin (afiş + ad + yıl) ve durumu
(Yanlış / Geçildi / Doğru / Kullanılmadı); satıra dokununca kare üstte büyür. En altta istatistik + dağılım kartı.
Tahmin kaydı bu yüzden yıl ve afiş yolunu da tutar (`guessEntry`; eski kayıtlarda yoksa yalnız ad).

## Sohbet kartı

Kendi koyu çivit kartı: numara, gönderen, büyük skor ("2/6") + karar, kare numaralı altı kutu. Alıcı bugün oynamadıysa
kartın içinde doğrudan **Oyna** düğmesi; yarıda bıraktıysa **Devam et**; bitirdiyse "Sen" satırında kendi skoru ve
kutucukları. Gün geçtiyse "kapandı". Gönderen eylem görmez.

## Tahmin

- Arama kutusu (otomatik tamamlama): TMDB `search/movie`, 300 ms bekleme, en çok 8 sonuç, afiş + yıl
  (aynı adlı yapımlar ayırt edilsin). Yetişkin içerik sonuçta görünmez (`adult` elenir; `include_adult` YAZILMAZ).
- Karşılaştırma `movie_<id>` ile → dilden bağımsız.
- Aynı filmi iki kez tahmin etmek hak yemez (kutu "zaten denedin" der).
- **Geç** düğmesi bir hak harcar, sıradaki kareyi açar.

## Seri ve istatistik

`{ played, won, streak, bestStreak, lastDay, lastWinDay, dist: [6 sayı] }`.
Seri = **ardışık kazanılan günler** (kaybedilen ya da oynanmayan gün seriyi bitirir; görünürde
`effectiveStreak` ile süzülür). Sonuç ekranında 1–6 dağılım çubuğu (Wordle gibi), bugünkü satır vurgulu.

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/dailyFrame.js` | **Saf çekirdek**: gün no, yuva permütasyonu, kare seçimi, ipucu basamakları, tahmin uygulama, seri/istatistik, emoji/paylaşım metni, depo normalizasyonu. |
| `utils/dailyFrameCopy.js` | Metinler (tr/en/es/pt/de). `copyTablesSpanish.test` dengesi. |
| `services/dailyFrameService.js` | Bulmacayı kur (top_rated sayfası + `fetchTitleImages`), günlük önbellek, film araması. |
| `hooks/useDailyFrame.js` | Durum: loading → playing → won/lost \| error; depo yazımı, ölçüm. |
| `screens/game/DailyFrameScreen.js` | Oyun ekranı: kare görüntüleyici + kare sekmeleri, ipucu çipleri, 6 tahmin satırı, arama, Geç, sonuç paneli (cevap, emoji, dağılım, paylaş, geri sayım). |
| `components/game/DailyFrameCard.js` | Eğlence → Oyunlar modülünün başında kart (Free'de kilitli, "Premium" yazar). |
| `components/chat/SharedFrameMessage.js` | Sohbet kartı (`frameShare`): numara, kutucuklar, alıcıya "Sen de oyna" (yalnız aynı gün). |
| `utils/chatShare.js`, `utils/chatReply.js`, `components/chat/MessageBubble.js` | Yeni paylaşım türü. |
| `services/storage/registry.js` | `Keys.dailyFrame` (son 30 gün + istatistik). |
| `utils/analyticsEvents.js` | `DAILY_FRAME_STARTED`, `DAILY_FRAME_FINISHED {won, guesses}`, `DAILY_FRAME_SHARED {target}`. |
| `App.js` | Rota `DailyFrameScreen`. |

## Test

`__tests__/dailyFrame.test.js` (çekirdek: permütasyon tekrarsızlığı 400 gün, kare sırası, tahmin/geç, seri kırılması,
emoji metni), `chatShareMessages`/chatShare frame bölümü (gövde temizleme, cevap alanı taşınmaz),
`dailyFrameService.test.js` (6 kare yoksa sonraki aday, dil bağımsız seçim), ekran duman testi.

## 2. faz (bu sürümde YOK)

- Geçmiş günler arşivi (Premium).
- Hikâye (Story) paylaşım kartı.
- Arkadaş sonuçları / günlük tablo (rules).
- Sunucuda sabitlenmiş günlük bulmaca (function).

## Uygulama notları (30 Eki)

- Kart Oyunlar modülünün başında (`ProfileGamesModule`), kilit şeridinden bağımsız. Ayrı bir Hub bölümü (bölüm
  gizle/göster kaydı) AÇILMADI: Oyunlar bölümü gizlenirse kart da gizlenir.
- Renk çivit (`#6366F1`); Film Zinciri (E3, paralel iş) camgöbeği kullandığı için ayrıştırıldı.
- `DailyFrameScreen` yüzen bildirim ve Premium şeridi listelerinde (oyun ekranı, tam alan).
- Sohbet kartı alıcının kendi bugünkü kutucuklarını yanında gösterir; gün geçtiyse "kapandı".
- Testler: `__tests__/dailyFrame.test.js` (25: çekirdek + servis + sohbet gövdesi), `__tests__/dailyFrameScreen.test.js`
  (5: ekran + kart + sohbet kartı, gerçek depo). Pozitif kontrol yapıldı (tekrar tahmin kuralı kaldırılınca test düşüyor).

## Cihazda görülmedi

- Gerçek TMDB'de yuvaların ne kadarının 6 dilsiz kareyi karşıladığı ölçülmedi (yetmezse `FRAME_PROBE_MAX` / nitelik
  süzgeci). 1. karenin "yeterince zor" olup olmadığı gerçek veride bakılmalı.
- Kare 16:9 genişliği, 320 pt telefonda sonuç paneli (dört metrik yan yana), iOS 26 cam arama kutusu.
- Klavye açıkken sonuç listesinin görünürlüğü (ScrollView `keyboardShouldPersistTaps`).
