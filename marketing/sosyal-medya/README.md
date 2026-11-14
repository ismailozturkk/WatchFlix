# seelogd sosyal medya görselleri (TR + EN)

Pazarlama planı ve hesap bilgileri için: [../README.md](../README.md). Görsellerin durumu: [../icerik/GORSEL_ENVANTERI.md](../icerik/GORSEL_ENVANTERI.md).

## Klasör düzeni

```
sosyal-medya/
├─ cikti/                      ← HAZIR PNG'LER (paylaşılacak dosyalar)
│  ├─ ortak/                   seelogd-profil-ikonu.png (yazısız, iki dilde aynı)
│  ├─ tr/
│  │  ├─ banner/               seelogd-tr-banner-x.png
│  │  ├─ post/                 seelogd-tr-post-01-tanitim.png … post-08-premium.png
│  │  └─ hikaye/               seelogd-tr-hikaye-01-tanitim.png
│  └─ en/
│     ├─ banner/               seelogd-en-banner-x.png
│     ├─ post/                 seelogd-en-post-01-intro.png … post-11-history.png
│     └─ story/                seelogd-en-story-01-intro.png
├─ kaynak/                     ← düzenlenen her şey
│  ├─ base.css                 ortak stil (renkler, cam kartlar, telefon çerçevesi)
│  ├─ metinler/tr.json         Türkçe metinler
│  ├─ metinler/en.json         İngilizce metinler (anahtarlar tr.json ile aynı)
│  ├─ img/logo/                S işareti + uygulama simgesi
│  ├─ img/afisler/             arka plan afişleri (TMDB)
│  ├─ img/ekranlar/tr/         uygulama ekran görüntüleri (profilde e-posta boyandı)
│  ├─ img/ekranlar/en/         İngilizce ekranlar (eksik olanın yerine tr/ kullanılır)
│  └─ _html/                   üretilen ara HTML'ler (elle düzenleme, her seferinde yenilenir)
└─ uret.py                     HTML'leri kurar ve PNG'ye çevirir
```

Dosya adları dil ön ekiyle (`seelogd-tr-…`, `seelogd-en-…`) başlar; klasörden çıkarılsa da karışmaz.
Numara iki dilde aynı içeriği gösterir: `tr/post-03` = `en/post-03`.

## Yeniden üretmek

```bash
python uret.py              # hepsi (TR + EN + profil ikonu)
python uret.py en           # yalnız İngilizce
python uret.py tr post-05   # Türkçe 5. post
```

Chrome gerekir (varsayılan yol `C:\Program Files\Google\Chrome\Application\chrome.exe`, `CHROME` ortam
değişkeniyle değiştirilebilir).

- **Metin değiştirmek:** `kaynak/metinler/<dil>.json` → `python uret.py`.
- **İngilizce ekran görüntüsü eklemek:** uygulamayı İngilizceye alıp aynı ekranları çek, `kaynak/img/ekranlar/en/`
  içine **aynı adlarla** koy (`dizi-trend.jpg`, `kutuphane.jpg` …). `profil.jpg` için e-posta satırını gizlemeyi unutma.
  İngilizce ekranlar eklendi; profilde e-posta + doğrulama uyarısı, zevk uyumunda gerçek ismin geçtiği
  "Leaning" satırı çıkarıldı. Bir dilde olmayan ekranın yerine geçecek ekran `uret.py` → `SCREEN_ALIAS`.
- **Yeni dil:** `metinler/<dil>.json` ekle, `uret.py` içinde `LANGS` ve `SLUGS`'a dili yaz.

## İçerik

| No | TR | EN | Ekranlar |
|---|---|---|---|
| 01 | Film ve dizi hayatın, tek bir yerde. | Your movie & TV life, all in one place. | Trend Diziler, Kütüphane, Wrapped |
| 02 | Sıradaki favorin bir kaydırma uzakta. | Your next favourite is one swipe away. | En İyi Diziler, Oscar & Seri Filmler |
| 03 | “Ne izlesem?” diye düşünme. Sor. | “What to watch?” Don't wonder. Ask. | CineMatch menü + Ruh haline göre bul |
| 04 | Sinemayı oyuna çevir. | Turn movies into a game. | Oyunlar, Turnuva, Sinema Bingosu |
| 05 | Arkadaşlarınla birlikte izle. | Watch it with friends. | Paylaşımlar + CineSwipe |
| 06 | Kaldığın yeri asla unutma. | Never lose your place. | Kütüphane, Notlar & Wrapped |
| 07 | Her dakikan sayılıyor. | Every minute counts. | Profil, Etkinliklerim |
| 08 | Ücretsiz başla. Sınırları kaldır. | Start free. Remove the limits. | (plan kartları) |
| 09 | — (yalnız EN) | The community's Top 100. | Günün Sorusu + Top 100 |
| 10 | — (yalnız EN) | Watch more, unlock more. | Rozetlerim + Öne çıkan rozetler |
| 11 | — (yalnız EN) | Your history, day by day. | Dizi istatistikleri + İzleme istatistikleri |

EN 02–05 ekran düzeni Türkçeden farklı (EN çekimlerine göre): 02 Yaklaşan Filmler, 03 tek tam CineMatch ekranı,
04 turnuva + bingo kartı, 05 aktivite + zevk uyumu. 09–11 için Türkçe ekran çekilince `SLUGS`'a `tr` eklenir.

Boyutlar: post 1080×1350 · hikâye/story 1080×1920 · banner 1500×500 (X) · profil ikonu 1080×1080.

## Video

`cikti/en/video/seelogd-en-video-01-intro.mp4`: 22 sn, 1080×1920. Metin ve zamanlama `kaynak/video/tanitim-en.html` içinde; `kaynak/video/render.cjs` kare kare üretir (Chrome, puppeteer-core ve ffmpeg gerekir, kullanım dosyanın başında).

## Hazır açıklama metinleri

| No | TR | EN |
|---|---|---|
| 01 | İzlediğin her film, her bölüm, her puan — tek bir yerde 🎬 Takip et, keşfet, arkadaşlarınla paylaş. Ücretsiz başla, bağlantı profilde. | Every movie, every episode, every rating — all in one place 🎬 Track, discover and share with friends. Start free, link in bio. |
| 02 | Sıradaki favorin bir kaydırma uzakta 🍿 Favorilerine göre öneriler, Oscar & Emmy kazananları ve Kore'den Türkiye'ye Dünya Turu. | Your next favourite is one swipe away 🍿 Picks based on your favourites, Oscar & Emmy winners and a World Tour from Korea to Türkiye. |
| 03 | "Ne izlesem?" diye 40 dakika kaydırmaya son. CineMatch'e ruh halini, süreni ve kiminle izleyeceğini söyle ✦ | No more scrolling for 40 minutes. Tell CineMatch your mood, your time and who you're watching with ✦ |
| 04 | Sinemayı oyuna çevir 🎮 Sahne tahmini, poster bulmaca, aylık turnuva ve sinema bingosu. Bugünün 10 sahnesinde kaç puan alırsın? | Turn movies into a game 🎮 Guess the scene, poster puzzles, a monthly tournament and movie bingo. How many of today's 10 scenes can you get? |
| 05 | Film gecesi kararı artık kavga değil. Paylaş, sohbet et, CineSwipe'ta kaydırıp eşleşin ❤ Kimi etiketliyorsun? | Movie night, no more arguments. Share, chat and swipe in CineSwipe until you match ❤ Who are you tagging? |
| 06 | Kaldığın bölümü bir daha asla unutma. Devam edenler, listeler, notlar ve vizyon hatırlatıcıları tek ekranda. | Never forget which episode you're on. Shows in progress, lists, notes and release reminders on one screen. |
| 07 | Bu yıl kaç dakikanı ekrana verdin? 👀 seelogd her dakikayı sayar, rozet kazandırır, sonunda Wrapped hazırlar. | How many minutes did you give the screen this year? 👀 seelogd counts them all, hands out badges and wraps up your year. |
| 08 | Çekirdek her zaman ücretsiz. Daha fazla arkadaş, oyun, tema ve AI istersen Premium seni bekliyor ⭐ | The core is always free. Want more friends, games, themes and AI? Premium has you covered ⭐ |
| 09 | — | The 100 most-voted movies and shows, ranked by the community 🏆 Cast your vote and push your favourites up. |
| 10 | — | 158 badges, five rarities, one showcase 🏅 What's the first one you'll unlock? |
| 11 | — | Every episode, every minute, day by day 📅 Your whole watch history — searchable and filterable. |

Etiket önerisi — TR: `#film #dizi #filmönerisi #diziönerisi #seelogd` · EN: `#movies #tvshows #whattowatch #movienight #seelogd`

## Notlar

- Afişler TMDB kaynaklı stüdyo görselleri. Organik paylaşımda yaygın, ama **ücretli reklamda** (Meta/TikTok Ads)
  reklam onayında sorun çıkarabilir.
- Uygulama henüz mağazada değil; görsellerde "App Store'da" gibi ifade yok, "Bağlantı profilde / Link in bio" var.
- Ekranlardaki sayılar (634 saat, 383 saat, 37.066 dk…) test hesaplarının gerçek verisi.
- İngilizce uygulamada hâlâ Türkçe kalan yerler var: tür adları (Aksiyon, Suç, Dram…), Eğlence sekmesindeki
  Paylaşımlar ve CineSwipe kartları ("Birlikte Ne İzlesek?", "Yeni"). Bu kartlar EN görsellere konmadı.
