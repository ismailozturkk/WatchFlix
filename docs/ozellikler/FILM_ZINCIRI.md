# Film Zinciri (Six Degrees)

Kaynak: `docs/planlama/OZELLIK_ADAYLARI_2026-10-30.md` → **E3**. 30 Ekim 2026'da planlandı ve kodlandı.

> "Tom Hanks'ten Zendaya'ya ulaş." Oyuncu → film → oyuncu adımlarıyla zincir kur; en kısa zincir en yüksek puanı alır.

## Özet

| | |
|---|---|
| Yer | Eğlence → Oyunlar → "Hızlı oyunlar" rayının BAŞI (kart: "Film Zinciri") |
| Rota | `FilmChainScreen` (parametre `mode`: `"daily"` varsayılan · `"free"`) |
| Modlar | **Günlük** (herkese aynı çift, gün TR 00:00'da döner) · **Serbest** (hazır çiftlerden rastgele, sınırsız) |
| Premium | **Premium + Max** (30 Eki kararı; registry `film_chain`, ACCESS). Free: ray kartı "Premium", sohbet kartı görünür ama "Zinciri kur" yükseltme açar. |
| Build / Deploy | Hayır / Hayır — TMDB okumaları önbellekli, kayıt cihaz-yerel (`Keys.filmChain`). |

## Oyun kuralları

1. Ekranın üstünde **başlangıç** ve **hedef** oyuncu, aralarında "en kısa: N film".
2. Zincirin son halkası oyuncuysa → o oyuncunun **filmleri** listelenir; film seç.
3. Son halka filmse → o filmin **oyuncu kadrosu** listelenir; oyuncu seç.
4. Seçilen oyuncu hedefse zincir tamamlanır.
5. **Geri al** son halkayı siler (sınırsız, ceza yok — puanı yalnız son zincirin uzunluğu belirler).
6. Aynı film / oyuncu zincirde iki kez kullanılamaz (listeden düşer).
7. En çok **6 film** (Six Degrees). 6. filmden sonra hedef gelmediyse yeni film eklenemez; geri alınır.
8. **Pes et** → bizim önceden bulduğumuz en kısa zincir gösterilir; puan 0, günlük "çözülemedi" sayılır.

### Kenar kuralı (oyun ile önceden hesaplama AYNI olmalı)

`utils/filmChainRules.js` (saf, içe aktarmasız; hem uygulama hem `scripts/` kullanır):

- **Film sayılır:** yetişkin değil, çıkmış (tarihli, bugünden önce), belgesel (tür 99) değil, `vote_count ≥ 100`.
- **Rol sayılır:** oyuncu (cast) kaydı, `order < 25` (ilk 25 isim), karakter "Himself/Herself/Self" değil.
- Oyuncunun film listesi popülerliğe göre, kadro TMDB sırasına göre.

Neden eşik: belgesel / talk-show "kendisi" kayıtları herkesi 1 adımda birbirine bağlar; oy eşiği tanınmayan
filmleri eler ve önceden hesaplamayı makul tutar. Kural değişirse **bulmacalar yeniden üretilmeli** (par kayar).

## Puan

`par` = önceden hesaplanan EN KISA zincirin film sayısı (doğrulanmış en küçük değer, bkz. aşağı). `L` = oyuncunun zinciri.

| Durum | Puan | Yıldız |
|---|---|---|
| L = par | 100 | ★★★ "Kusursuz" |
| L = par + 1 | 75 | ★★ |
| L = par + 2 | 50 | ★ |
| daha uzun | max(10, 100 − 25·(L−par)) | ★ |
| Pes et | 0 | — |

## Günlük bulmaca nasıl seçilir

**Önceden hesaplanmış** (adayda önerildiği gibi): `scripts/build-film-chain-puzzles.mjs` bilinen ~50 oyuncu
havuzundan çiftler kurar, TMDB'den film/kadro verisini çekip kenar kuralıyla **en kısa yolu** bulur:

- `par 1` (ortak film) → çok kolay, alınmaz.
- `par 2`: A'nın filmlerinin kadrosu ∩ B'nin filmlerinin kadrosu ≠ ∅ → **kesin en kısa** (1 olmadığı biliniyor).
- `par 3`: 2 olmadığı kanıtlanır, ardından iki taraftaki en popüler ortak-oyuncuların film listeleri kesiştirilir;
  bulunursa kesin en kısa 3. Bulunamazsa çift atılır.
- Her çözüm oyundaki yönde (A'nın filmleri → kadro → …) yeniden doğrulanır; tutmayan çift atılır.

**30 Eki üretimi:** havuz 119 oyuncu (güncel Hollywood + klasik/uluslararası; Cem Yılmaz, Haluk Bilginer,
Kemal Sunal, Şener Şen, Tarık Akan dahil). 7 bin çiftin dağılımı: par 1 = 835 (atıldı), par 2 = 4979, par 3 = 942,
3'te bulunamayan = 265 (atıldı). Listeye 240 bulmaca alındı: 160 × par 2, 80 × par 3 (her üçüncü gün zor).
Yaklaşık 2,8 bin TMDB isteği; disk önbelleğiyle ikinci çalıştırma saniyeler sürer. Havuzdaki yanlış kimlik
(Lily James, Michelle Yeoh) TMDB adı tutmadığı için aramayla düzeltildi. Arşiv görüntüsü rolleri ("archive footage")
sayılmaz — yoksa Ingrid Bergman eski kesitlerle 1980'lerin filmine bağlanıyordu.

Çıktı `data/filmChainPuzzles.js` (üretilmiş dosya, elle düzenlenmez; bulmaca başına tek satır, ~200 KB).
240 gün sonra liste baştan döner — o güne dek script yeni havuzla yeniden çalıştırılmalı (`CHAIN_EPOCH_DAY` DEĞİŞMEZ,
yalnız liste uzar; mevcut günlerin bulmacası değişmesin diye yeni bulmacalar listenin SONUNA eklenmeli). Günlük = `puzzles[gün numarası % N]`,
gün numarası `CHAIN_EPOCH_DAY`'den sayılır (paylaşımdaki "#12"). Herkes aynı listeyle aynı günü görür; TMDB verisi
sonradan değişse de çift ve par sabit kalır (oyun sırasında liste güncel TMDB'den gelir, par nadiren kayabilir —
oyuncu par'dan kısa bulursa 100 puan + "par'ı geçtin" der, hata sayılmaz).

## Kayıt

`Keys.filmChain` (cihaz-yerel, `keepOnLogout`):
`{ plays, solved, perfect, gaveUp, bestStreak, days: { "<gün>": { puzzleId, links, par, points, gaveUp, path } } }`
— son 60 gün tutulur. Seri = bugün/dün dahil kesintisiz çözülen günler.

## Arkadaşa meydan okuma (sohbet kartı) — 30 Eki, 2. tur

Sonuç ekranındaki **Arkadaşına meydan oku** → `ShareToChatSheet` → sohbete `chainShare` kartı
(`utils/chatShare.buildChainShare`, balon `components/chat/SharedChainMessage.js`).

- **Taşınan:** bulmaca kimliği, başlangıç/hedef (ad + foto), en kısa (par), gönderenin film sayısı, pes etti mi,
  ad; günlükse gün + numara. Puan alıcıda film sayısı ve par'dan YENİDEN hesaplanır (gönderenin yazdığı alınmaz).
- **Taşınmayan (spoiler):** zincirin ara oyuncu ve filmleri. Testler gövdede ara halka adının/kimliğinin geçmediğini
  denetler.
- **Alıcı:** oynamadıysa "Zinciri kur" → günlük + bugünse `{ mode: "daily" }`, değilse `{ mode: "free", puzzleId }`
  (aynı bulmaca). Oynadıysa "Sen / Arkadaşın" puan kıyası + Kazandın / Geride kaldın / Berabere. Bulmaca bu
  sürümde yoksa güncelleme notu. Gönderen kartında eylem yok.
- Kıyas için bulmaca başına İLK sonuç `Keys.filmChain.results[puzzleId]`'de (son 120).
- Gelen kutusu satırı: `🔗 Film Zinciri · A → B · 🎬🎬` (çeviri anahtarı `autoI18n.paylas_zincir_onizleme`).

## Klavye

Arama kutusu açılınca liste klavyenin altında kalıyordu. Pano `useKeyboardInset` ile klavyenin örttüğü kadar alttan
boşluk alır (Android pencereyi zaten küçülttüyse çift eklenmez); klavye açıkken mod anahtarı, büyük rota kartı,
Geri al / Pes et ve seçici başlığı gizlenir, yerine tek satırlık rota şeridi (`A → B · 1/2`) gelir.

## Sonuç ekranı (yeniden tasarım)

Turkuaz gradyan kahraman kart (puan, yıldızlar, karar: kusursuz / "N film uzun" / par altı, A → B şeridi, seri),
üç sayı kutusu (film · oyuncu · en kısa), birincil **Arkadaşına meydan oku** + "zincir gizli kalır" notu, Paylaş /
Yeni zincir, "Senin zincirin" dikey zaman çizelgesi (oyuncu foto + film afiş/yıl, hedef altın), en kısa zinciri
göster, Kapat.

## Paylaşım

Sonuç kartında **Paylaş** (sistem paylaşım sayfası) — emoji özet:

```
Seelogd Film Zinciri #12
Tom Hanks → Zendaya
🎬🎬🎬 3 film · en kısa 2
⭐⭐
```

Sohbet dışı paylaşım içindir; sohbet içi meydan okuma yukarıda. Günlük liderlik tablosu **sonraki adım** (rules ister).

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/filmChainRules.js` | Kenar kuralı (film/rol süzgeci). İçe aktarmasız; script de kullanır. |
| `utils/filmChain.js` | Saf çekirdek: bulmaca seçimi, zincir adımları, puan/yıldız, kayıt, seri, paylaşım metni. |
| `utils/filmChainCopy.js` | 5 dil metin. |
| `data/filmChainPuzzles.js` | Üretilmiş bulmaca listesi. |
| `scripts/build-film-chain-puzzles.mjs` | Bulmaca üretici (TMDB, disk önbellekli). |
| `services/filmChainService.js` | `/person/{id}/movie_credits`, `/movie/{id}/credits` (önbellekli, 7 gün). |
| `hooks/useFilmChain.js` | Durum makinesi + kayıt. |
| `screens/game/FilmChainScreen.js` | Ekran. |
| `components/game/QuickGamesGrid.js`, `GamePreviews.js` | Ray kartı + önizleme. |

## Testler

- `__tests__/filmChain.test.js` — kenar kuralı, ÜRETİLMİŞ her bulmacanın bütünlüğü (çözüm par uzunlukta,
  başlangıç→hedef, sıralı, tekrarsız), günlük seçim/numara, zincir adımları, puan, kayıt/seri, paylaşım, 5 dil şekli
  ve "her metin anahtarı kullanılıyor". Kural dosyasının içe aktarmasız kaldığını da denetler.
- `__tests__/filmChainScreen.test.js` — ekran + kanca + gerçek depo: en kısa yol 100 puan, geri al, arama, pes et +
  yeniden açılışta sonuç, paylaşım metni, hata/tekrar dene, serbest mod.
- `__tests__/chainShareMessage.test.js` — sohbet şeması (spoiler yok, puan yeniden hesap, bozuk gövde) ve kart
  durumları (oyna → doğru rota, kıyas, giden, bilinmeyen bulmaca). Ekran testinde klavye boşluğu + meydan okuma.
- `quickGameScreen.test.js` / `gameSetupFlow.test.js` — rayın başında Film Zinciri kartı ve rotası.
- Pozitif kontrol: tekrar kuralı kaldırılınca çekirdek testi kırıldı.

## Sonraki adımlar (yapılmadı)

- Arkadaşla aynı günü kıyaslayan tablo (rules deploy ister). Alıcı bitirince sonucun otomatik sohbete dönmesi.
- Liste 240 günde biter: script'i yeni oyuncularla çalıştırıp bulmacaları SONA ekleyen bir `--append` modu.

## Cihazda henüz görülmedi

Jest yeşil (410 takım). Klavye boşluğu pozitif kontrolle doğrulandı (boşluk kaldırılınca test kırıldı). Cihazda / web önizlemede doğrulanmadı: uzun kadro listesinin kaydırma performansı, küçük
ekranda (320 pt) başlangıç–hedef kartı ve zincir şeridinin sığması, klavye açıkken listenin alanı, iOS 26 cam
arama kutusu ve segment anahtarı, paylaşım sayfası metni, klavye boşluğunun iOS/Android'de gerçek yüksekliği, sohbet kartının 260 pt genişlikte uzun adlarla sığması. Türkçe film adları TMDB'den dile göre gelir; çözüm
zinciri (Pes et) İngilizce başlıklıdır.
