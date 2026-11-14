# seelogd sosyal medya: 1. hafta — günlük plan

Tek hedef: **beta kaydı** ve **hangi kancanın tuttuğunu öğrenmek**.
Neden bu sıra, neden bu içerik: [../analiz/KANAL_VE_DONUSUM_ANALIZI.md](../analiz/KANAL_VE_DONUSUM_ANALIZI.md).

Durum: **Gün 0 bitti (6 Kas: hesaplar, logo, banner, bio). Gün 1 = 7 Kasım 2026.**
Beş hesapta her gün paylaşım var. Paylaşımı kullanıcı yapar; her gönderi yayından önce onaylanır.

## Haftanın mantığı

Yedi gün, yedi ayrı kanca. Hepsi aynı çağrı ve aynı ölçümle gidiyor, böylece fark içerikten gelir.
Kanca kademeleri (A en yüksek niyet): takip **A** → karar verememe **B** → keşif **B** → sosyal **B** →
istatistik **B** → oyun **C** → kişiselleştirme **C**.

Wrapped bu haftada **yok**: yeni kullanıcının Wrapped'ı boş ve asıl dalgası Aralık ilk haftası.
Oyunlar haftada yalnız bir kez: Free planda kapalı, her gün anlatılırsa gelen kişi kaydolup göremez.

## Her gün yapılacak dört şey

| # | İş | Süre | Bu neden var |
|---|---|---|---|
| 1 | Günün videosu: TikTok + Instagram Reels | 10 dk | Sıfır takipçiyle tek erişim kaynağı |
| 2 | Günün statik gönderisi: X / Threads / IG | 10 dk | Profile bakan kişiyi ikna eder |
| 3 | **Yorum turu: 10 yorum** | 30 dk | Erişimi büyük hesaplardan ödünç alır |
| 4 | Yanıtlar (ilk 1 saat) + `PAYLASIM_KAYDI.csv` satırı | 15 dk | İlk saat yanıtı erişimi artırır |

**Yorum turu** planın en kolay atlanan, en çok getiren parçası: film ve dizi konuşan büyük hesapların
altına, tanıtım yapmadan, konuya gerçekten katkı veren 10 yorum. Uygulama adı geçmez; insanlar profil adına tıklar.
Yorum yapılacak yerler: X'te film/dizi hesaplarının güncel gönderileri, Threads'te aynı konu,
Instagram'da film sayfalarının Reels yorumları.

## Saat (varsayım, denenecek)

Kitle İngilizce konuşan, ağırlıkla Avrupa ve ABD. İki yuva: **13:00** ve **21:00** (TR saati).
Video 21:00, statik gönderi 13:00. Gün 3 ve 6 akşamı hangi yuvanın daha iyi gittiğine bakılır.

## Bağlantılar — platform başına ayrı

`?utm_source=` eklenince hangi platformun kaç ziyaret getirdiği `/admin` panelinde `refs` içinde görünür.
Kısa bağlantı kullanılmaz, aksi hâlde ölçüm kaybolur.

| Platform | Bağlantı |
|---|---|
| X | `https://seelogd.com/?utm_source=x#beta` |
| Instagram (bio) | `https://seelogd.com/?utm_source=instagram#beta` |
| Threads (bio) | `https://seelogd.com/?utm_source=threads#beta` |
| TikTok (bio) | `https://seelogd.com/?utm_source=tiktok#beta` |
| Reddit | `https://seelogd.com/?utm_source=reddit#beta` |

## Dosya kökleri

| Kısaltma | Klasör |
|---|---|
| `POST/` | `../sosyal-medya/cikti/en/iphone-seti/post/` |
| `VID/` | `../sosyal-medya/cikti/en/iphone-seti/video/` (iPhone ekranı, müzikli, 15–17 sn) |
| `SERI/` | `../sosyal-medya/cikti/en/video/ozellik-serisi/` (Android ekranı, kinetik yazı, 17 sn) |

## Yayın kuralları

- Her gönderi yayından önce onaylanır.
- Yalnız doğrulanmış özellik anlatılır. Kullanıcı sayısı veya "en popüler" gibi veriye dayanmayan iddia yok.
- **TV Time içe aktarma vaat edilmez**, ürün desteklemiyor. Eski TV Time kullanıcısına söylenen tek şey:
  "Letterboxd ve IMDb geçmişini getirebilirsin."
- Ücretli özellik metinde yazılır: CineSwipe, oyunlar, turnuva oyu, tema/yazı tipi/simge/ambiyans Premium;
  CineMatch Free'de günde 3; takip, Wrapped, rozetler, istatistik Free.
- "Sample account" yazan görsellerde "benim sayım/benim yılım" denmez.
- Ücretli öne çıkarma yok: tüm görsellerde telifli TMDB afişleri var.
- Reddit'te her gün tanıtım yapılmaz (aşağıda ayrı bölüm).

## Profilde sabitlenen tanıtım videosu

`VID/seelogd-en-iphone-11-hero.mp4` (44,4 sn): uygulamanın dokuz önemli özelliğini gerçek ekranlarla, tam ve kırpılmadan gösterir; kancada gerçek afiş duvarı. Müziksiz sürüm `...-11-hero-sessiz.mp4`. (Koddan çizili, telifsiz sürüm `...-10-pro.mp4` ücretli reklam için yedekte.) Beş hesabın hepsinde **profile sabitlenir** ve orada kalır; günlük videolar bunun yerine geçmez. Instagram'da Reels olarak paylaşılıp profile sabitlenir, X'te gönderi sabitlenir, TikTok'ta videoya "sabitle" uygulanır, Threads'te sabitlenir, Reddit'te profil gönderisi olarak kalır. Platform metinleri: [SABIT_VIDEO_METINLERI.md](SABIT_VIDEO_METINLERI.md).

Ortak metin:

```text
Everything you watch, in one app.

Track every episode, find what to watch, ask CineMatch, share it in the chat, play with friends and see your year in numbers.

Free to start. Beta is open on Android and iOS:
https://seelogd.com/?utm_source=<platform>#beta
```

`<platform>` her hesapta kendi değeriyle değiştirilir (x, instagram, threads, tiktok, reddit).

## Haftanın tablosu

| Gün | Kanca | Video (TikTok + Reels) | X | Threads | Instagram | Reddit |
|---|---|---|---|---|---|---|
| 1 | Takip **A** | `VID/08-track` | `POST/p01-intro` (sabitle) | Soru: takip uygulaması | `POST/p01-intro` (ızgara 1) | Test çağrısı · r/alphaandbetausers |
| 2 | Karar verememe **B** | `VID/04-cinematch` | TV Time sorusu | Soru: ruh hâli | Reels | Yalnız yorum |
| 3 | Keşif **B** | `VID/06-discover` | `POST/p07-discover` | Soru: yarım kalan dizi | Reels | Test çağrısı · r/betatests |
| 4 | Sosyal **B** | `VID/03-swipe` | Letterboxd sorusu | `POST/p03-chat` | Reels | Kurucu hikâyesi · r/SideProject |
| 5 | İstatistik **B** | `VID/05-graph` | `POST/p06-graph` | Soru: zirve/dip sezon | `POST/p09-stats` (ızgara 2) | Yalnız yorum |
| 6 | Oyun **C** | `SERI/04-games` | Soru: film bilgisi | Soru: tek kare | Reels | Test çağrısı · r/TestMyApp |
| 7 | Kişiselleştirme **C** | `VID/07-yours` | Hafta özeti | Soru: ne eksik | `POST/p08-yours` (ızgara 3) | Geri bildirim özeti (koşullu) |

Aralık'a saklananlar: `VID/01-wrapped`, `POST/p02-wrapped`, `SERI/08-yours`.
Yedekler: `POST/p04-swipe`, `p05-cinematch`, `SERI/01-friends`, `02-chat`, `03-swipe`, `05-vote`, `06-discover`, `07-track`.

---

# Gün 1 · Kanca: "Hangi bölümde kalmıştım?" (A)

Haftanın en yüksek niyetli kancası. Bu videoyla gelen kişi zaten çözüm arıyor ve takip Free planda açık,
yani vaat ile deneyim uyuşuyor.

Video 7 Kasım'da bu kanca için üretildi: iPhone ekranları, İngilizce arayüz, test adı yok.
Eski `SERI/07-track` yedekte kalıyor (Android ekranı, test adları görünüyor).

## Video · TikTok + Instagram Reels — `VID/seelogd-en-iphone-08-track.mp4`

18,0 sn, 1080×1920, lo-fi müzik gömülü. Kurgu: kaldığın bölüm sorusu → Ongoing Shows → sezon bölümleri → listeler ve hatırlatıcı.

TikTok:

```text
POV: you forgot which episode you were on. Again. Your shows, down to the episode, with lists and reminders. Tracking is free. #tvshows #bingewatching #movietracker #movietok
```

Instagram Reels:

```text
Never lose your place again.

Every episode you've watched, lists with poster covers and reminders for what's coming. Tracking is free in seelogd.

Beta is open on Android and iOS. Link in bio.

#tvshows #watchlist #movietracker #bingewatching #seelogd
```

## X — `POST/p01-intro.png` · paylaştıktan sonra profilde sabitle

```text
seelogd is your movie & TV life in one app.

Track every episode, find what to watch, share lists with friends and get a recap of your year.

We're looking for beta testers on Android and iOS before launch:
https://seelogd.com/?utm_source=x#beta
```

## Threads — görselsiz

```text
Which app do you use to track what you watch, and what does it get wrong?

We're building seelogd and want to hear it before launch.
```

## Instagram — `POST/p01-intro.png` · ızgaranın ilk karesi

```text
Your movie & TV life, all in one place.

Track every episode, find what to watch, share lists with friends and get a recap of your year.

Beta is open on Android and iOS. Link in bio.

#movies #tvshows #watchlist #movietracker #seelogd
```

## Reddit — r/alphaandbetausers

**Paylaşmadan önce o topluluğun kurallarını oku.** Geliştirici olduğunu söylemek şart.

Başlık:

```text
[Android/iOS] Looking for testers: seelogd, a movie & TV tracker
```

Metin:

```text
I'm the solo developer of seelogd, an app for tracking movies and shows with friends, lists, games and a yearly recap. It's free to start, with optional paid plans.

I'm looking for testers before launch, especially people who use Letterboxd, Trakt or similar apps.

Sign up: https://seelogd.com/?utm_source=reddit#beta

Choose your platform and leave your email, and I'll send an invite as spots open. On Android, use your Play Store Google account email. On iOS, use your Apple ID email.

Any feedback on bugs, confusing screens or missing features is welcome.
```

---

# Gün 2 · Kanca: "Karar verememek" (B)

X'teki soru bugün kancanın A kademesinden: eski TV Time kullanıcısı hâlâ yer arıyor. Soru olarak sorulur,
tanıtım olarak değil; cevap verenlere tek tek yanıt yazılır.

## Video · TikTok + Reels — `VID/seelogd-en-iphone-04-cinematch.mp4`

TikTok:

```text
Eternal Sunshine or Vanilla Sky? Ask CineMatch and get pros, cons and a verdict. Free plan: 3 asks a day. #whattowatch #movietok #movies #cinephile
```

Instagram Reels:

```text
"What should I watch?" Don't wonder. Ask.

Tell CineMatch your mood, your time and who you're watching with, and get a straight answer with pros and cons.

Free plan: 3 asks a day. Beta is open. Link in bio.

#whattowatch #movienight #movies #tvshows #seelogd
```

## X — görselsiz · TV Time sorusu

```text
TV Time shut down in July. Where did everyone go?

Still looking for the people who never found a replacement they liked.
```

Cevap gelirse yanıt olarak (kopyala-yapıştır değil, tek tek uyarlanır):

```text
We're building seelogd for exactly this: episode tracking, lists and friends in one place. No TV Time import, but you can bring your Letterboxd or IMDb history. Beta is open if you want to try it: https://seelogd.com/?utm_source=x#beta
```

## Threads — görselsiz

```text
Describe your mood in three words and we'll tell you what kind of movie you need tonight.

This is what CineMatch does inside seelogd. Beta link in profile.
```

Gelen yanıtları tek tek, elle cevapla. Bu gönderinin amacı konuşma başlatmak.

## Instagram — Reels dışında statik gönderi yok

Bugün ızgaraya post girmez; Reels ve story yeter. Grid sırası bozulmasın.

## Reddit — tanıtım yok, yalnız yorum

Hiçbir yere bağlantı atma. r/movies, r/television veya r/Letterboxd içinde 2-3 gerçek yorum yaz.
Amaç hesabın yalnız tanıtım yapan hesap görünmemesi.

---

# Gün 3 · Kanca: "Keşif" (B)

Akşam karar ölçümü günü: `/admin` `refs`, platform istatistikleri ve Firebase sayıları okunur,
analiz dosyasındaki karar tablosu uygulanır.

## Video · TikTok + Reels — `VID/seelogd-en-iphone-06-discover.mp4`

TikTok:

```text
Tonight's pick is already out there: trending now, all-time greats and a world tour of cinema. #whattowatch #movietok #movies #kdrama
```

Instagram Reels:

```text
Tonight's pick is already out there.

Trending now, the top rated shows and a world tour of TV from Korea to France.

Beta is open. Link in bio.

#whattowatch #kdrama #tvshows #movies #seelogd
```

## X — `POST/p07-discover.png`

```text
Still scrolling three apps to decide what to watch?

Trending now, all-time greats and a world tour of cinema, in one place.

Beta is open: https://seelogd.com/?utm_source=x#beta
```

## Threads — görselsiz

```text
What's the one show you keep meaning to finish and never do?

Mine's been sitting at season 2 for two years.
```

## Instagram — Reels + story

## Reddit — r/betatests

Başlık:

```text
Looking for beta testers: movie & TV tracker with lists, friends and a yearly recap (Android/iOS)
```

Metin:

```text
I've been building seelogd on my own for about a year. It tracks what you watch, suggests what to put on, lets you share lists and chat with friends, and gives you a yearly recap.

Free to start, paid plans are optional. Beta is open on both platforms: https://seelogd.com/?utm_source=reddit#beta

Leave the email tied to your Play Store or Apple ID and I'll send an invite as spots open.

What I most need right now: anything confusing on first open, and features you'd expect that aren't there.
```

---

# Gün 4 · Kanca: "Sosyal, film gecesi" (B)

## Video · TikTok + Reels — `VID/seelogd-en-iphone-03-swipe.mp4`

TikTok:

```text
Can't pick a movie together? Swipe until you match. CineSwipe is part of seelogd Premium. #movienight #movietok #movies
```

Instagram Reels:

```text
Can't decide? Swipe together.

You and your friend swipe through titles until you both like the same one. That's a match, and that's what you're watching.

CineSwipe is part of seelogd Premium. Beta is open. Link in bio.

#movienight #movies #tvshows #seelogd
```

## X — görselsiz · Letterboxd sorusu

```text
Letterboxd people: what do you use for TV shows?

Genuinely asking. Everyone seems to run two apps and hate it.
```

Yanıt olarak (tek tek uyarlanır):

```text
That's the gap we're building for: films and episode-level TV in one place, and you can import your Letterboxd history. Beta: https://seelogd.com/?utm_source=x#beta
```

## Threads — `POST/p03-chat.png`

Görseldeki hesaplar örnek hesaplar, görselin üstünde yazıyor.

```text
Movie night starts in the chat.

Send tier lists, duels and episode graphs to your friends, then argue about them. (Games are part of Premium.)

Beta link in profile.
```

## Instagram — Reels + story

## Reddit — r/SideProject

Kurucu hikâyesi. Tanıtım değil, süreç anlatımı; bağlantı sonda ve tek.

Başlık:

```text
I built a movie & TV tracker because every app I tried stopped at "watched"
```

Metin:

```text
I kept lists in three different apps and still forgot which episode I was on, so I started building my own. A year later it has lists, episode tracking, friend profiles with a taste match, chat, a yearly recap and a pile of small things I wanted for myself.

The part I didn't expect to be hardest: making "what should we watch tonight" actually work for two people instead of one.

It's in beta on Android and iOS before launch, free to start: https://seelogd.com/?utm_source=reddit#beta

Happy to answer anything about the stack or how long each part took.
```

---

# Gün 5 · Kanca: "İstatistik, bölüm grafiği" (B)

## Video · TikTok + Reels — `VID/seelogd-en-iphone-05-graph.mp4`

TikTok:

```text
Every episode of a show, rated, on one screen. Find the peak, skip the dip. #tvshows #bingewatching #movietok #seelogd
```

Instagram Reels:

```text
Every episode, rated.

The whole show on one screen: the season it peaked, and the one everyone tells you to skip.

Beta is open. Link in bio.

#tvshows #bingewatching #tvtracker #seelogd
```

## X — `POST/p06-graph.png`

```text
Every episode of a show, rated, on one screen.

Find the season it peaked, and the one everyone tells you to skip.

Beta is open: https://seelogd.com/?utm_source=x#beta
```

## Threads — görselsiz

```text
Pick a show you love. Which season is its peak, and which one is the dip?
```

## Instagram — `POST/p09-stats.png` · ızgaranın ikinci karesi

Görselde "Sample account" yazıyor; bu sayılar senin değil.

```text
Your taste, in numbers.

Minutes watched, top genres, your day-by-day history and 158 badges to unlock. Stats are free in seelogd.

Beta is open. Link in bio.

#movies #tvshows #movietracker #seelogd
```

## Reddit — tanıtım yok, yalnız yorum

"What should I watch" türü başlıklara gerçek öneri yaz. Bağlantı yok, uygulama adı geçmesin.

---

# Gün 6 · Kanca: "Oyun" (C) — haftada tek kez

Etkileşimi yüksek, kayıt niyeti düşük ve oyunlar Free planda kapalı. Bu yüzden haftada bir kez ve
"Premium" her metinde yazılı. Akşam ikinci karar ölçümü yapılır.

## Video · TikTok + Reels — `SERI/seelogd-en-feature-04-games.mp4`

TikTok:

```text
Think you know movies? Name the film from a single frame and climb the weekly league. Games are part of Premium. #moviequiz #movietrivia #movietok #cinephile
```

Instagram Reels:

```text
Movie nerd? Prove it.

Name the film from a single frame, take today's 10-scene challenge and climb the weekly league.

Games are part of seelogd Premium. Beta is open. Link in bio.

#moviequiz #movietrivia #cinephile #movies #seelogd
```

## X — görselsiz

```text
How good are you really? One frame, one guess, no hints.

If you got it from the first second, you're the audience we're building for.
```

## Threads — görselsiz

```text
One frame. One guess. How many movies could you name from a single still?
```

## Instagram — Reels + story

## Reddit — r/TestMyApp

Başlık:

```text
[Android/iOS] seelogd — movie & TV tracker, looking for testers and honest feedback
```

Metin:

```text
seelogd is a movie and TV tracker: episode tracking, lists, friend profiles with a taste match, chat, games and a yearly recap. Solo developer, free to start.

Beta: https://seelogd.com/?utm_source=reddit#beta

I'd rather hear what's broken than what's nice. Specifically: first-open confusion, anything slow, and whether the free plan feels usable on its own.
```

---

# Gün 7 · Kanca: "Kişiselleştirme" (C) + hafta kapanışı

## Video · TikTok + Reels — `VID/seelogd-en-iphone-07-yours.mp4`

TikTok:

```text
Make it yours: themes, fonts, app icons and ambience. Personalization is part of seelogd Premium. #appaesthetic #movietok #seelogd
```

Instagram Reels:

```text
Make it yours.

Themes, fonts, app icons and ambience, so the app looks like you and not like everyone else.

Personalization is part of seelogd Premium. Beta is open. Link in bio.

#appaesthetic #movies #tvshows #seelogd
```

## X — hafta özeti

Sayı yazılacaksa **gerçek** sayı yazılır; yoksa sayı hiç geçmez.

```text
First week of showing seelogd to people is done.

Thanks to everyone who signed up for the beta and told us what's missing. Both are still open:
https://seelogd.com/?utm_source=x#beta
```

## Threads — görselsiz

```text
If you tried seelogd this week: what's the one thing you'd change first?

Short answers welcome. We're reading all of them.
```

## Instagram — `POST/p08-yours.png` · ızgaranın üçüncü karesi

```text
Make it yours.

Themes, fonts, app icons and ambience, so the app looks like you and not like everyone else.

Themes, fonts, icons and ambience are part of Premium. Beta is open. Link in bio.

#appaesthetic #movies #tvshows #seelogd
```

## Reddit — koşullu

Yalnız ilk gönderilerde gerçek yorum geldiyse, kurallar izin veriyorsa ve gerçek geri bildirimle
doldurularak paylaşılır. Yorum gelmediyse atlanır.

```text
Thanks for the feedback on seelogd. Here's what changed:

- [gerçek değişiklik]
- [gerçek değişiklik]

Testing is still open if you'd like to try it: https://seelogd.com/?utm_source=reddit#beta
```

---

## Reddit neden her gün tanıtım değil

Diğer dört platformda günlük paylaşım normal. Reddit'te değil: yeni bir hesabın her gün aynı uygulamayı
anlatması spam sayılır, gönderi silinir ve hesap engellenebilir. Hafta şöyle kurulu:

- 3 test çağrısı, üç ayrı toplulukta, üç ayrı metinle (Gün 1, 3, 6).
- 1 kurucu hikâyesi, geri bildirim topluluğunda (Gün 4).
- 2 gün yalnız yorum, bağlantısız (Gün 2, 5).
- 1 koşullu özet (Gün 7).

Her gönderi öncesi o topluluğun kuralları ayrıca okunur; bazıları karma veya hesap yaşı şartı koyuyor.
Şart karşılanmıyorsa o gün yorum gününe çevrilir.

## Hafta sonu ölçümü

| Ölçüm | Nereden | 1. hafta |
|---|---|---|
| Site ziyareti | `/admin`, günlük toplam | |
| Platform başına ziyaret | `/admin` → `refs` (`utm:x`, `utm:tiktok` …) | |
| Yeni beta kaydı | Firebase Console, `betaTesters` | |
| Yeni bekleme listesi kaydı | Firebase Console, `waitlist` | |
| En çok izlenen video | TikTok ve Reels istatistikleri | |
| En çok erişen statik gönderi | Platform istatistikleri | |
| Gelen geri bildirim | Yorumlar ve DM | |

Hafta sonunda şu cümle yazılabilmeli: **"En çok X kancası tuttu, en çok kayıt Y kanalından geldi."**
Yazılamıyorsa ölçüm eksik kurulmuş demektir.
