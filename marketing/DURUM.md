# Pazarlama durumu

Son güncelleme: **11 Kasım 2026**

## Şu anki aşama

**Yayın öncesi.** Tek hedef beta ve bekleme listesi kaydı toplamak. Uygulama herkese açık yayında değil: 1.5.0 mağazalara test olarak yüklendi (1 Kasım). Sitede mağaza bağlantıları boş, bu yüzden beta ve bekleme listesi formları açık.

## Hesaplar

| Platform | Durum | Kullanıcı adı | Takipçi | Dosya |
|---|---|---|---|---|
| Reddit | Açık (kullanıcı bildirdi) | u/seelogd | Bilinmiyor | [reddit.md](hesaplar/reddit.md) |
| Instagram | Açık (kullanıcı bildirdi) | @seelogd | Bilinmiyor | [instagram.md](hesaplar/instagram.md) |
| X | Açık (kullanıcı bildirdi) | @seelogd | Bilinmiyor | [x.md](hesaplar/x.md) |
| Threads | Açık (kullanıcı bildirdi) | @seelogd | Bilinmiyor | [threads.md](hesaplar/threads.md) |
| TikTok | Açık (kullanıcı bildirdi) | @seelogd | Bilinmiyor | [tiktok.md](hesaplar/tiktok.md) |

## Bekleyen kararlar

| Karar | Öneri | Neden önemli |
|---|---|---|
| Sitedeki sayaca eklenen 1.071 sıfırlansın mı? | Evet | Gösterilen sayı gerçek kayıt sayısı değil |
| Oyunlar Free planda tamamen kapalı mı kalacak? | Küçük bir ücretsiz deneme düşünülmeli | Pazarlamanın en çekici kısmı Free kullanıcıya kapalı |
| Free 2 arkadaş sınırı kalsın mı? | Yayın verisiyle yeniden bakılmalı | Davet ve sosyal yayılmayı sınırlar |
| Testçilere Premium kodu verilecek mi? | Sınırlı sayıda, evet | Aksi hâlde testçiler oyunları deneyemez |
| Ana dil İngilizce mi kalacak? | Şimdilik evet, Türkçe ayrı dalga | Görseller ve beta çağrısı İngilizce; Türkçe için 3 post eksik |

## Yayından önce kapanması gerekenler

Ayrıntılar: [HAZIRLIK_DENETIMI_2026-11-02.md](analiz/HAZIRLIK_DENETIMI_2026-11-02.md)

- [ ] TMDB ticari lisans yazışması (kullanıcıda)
- [ ] "Seelogd" marka taraması: yol haritasında tamamlandı işareti yok
- [ ] iOS satın alma paketlerinin görünmesi (App Store Connect)
- [ ] Sitedeki bekleme sayacı kararı
- [ ] Siteye ziyaret ölçümü ve kanal bilgisi
- [x] TikTok hesabının açılması ve kullanıcı adının yazılması (6 Kas: @seelogd; beş platformun hepsi açık)
- [x] Lens profil resmi ve bannerların hesaplara yüklenmesi (6 Kas: kullanıcı yüklemeyi yaptığını bildirdi). Hepsi `sosyal-medya/cikti/en/iphone-seti/profil-banner/` içinde:
  - Instagram, Threads, TikTok, X, Reddit profil resmi: `profil-1080-koyu.png`
  - X kapağı: `x-kapak-1500x500.png`
  - Reddit banner: `reddit-banner-1920x384.png`
  - Instagram öne çıkan kapakları: `ig-one-cikan-*.png` (ilk hikâyeler paylaşılınca)
- [x] Sabit tanıtım videosu (`seelogd-en-iphone-11-hero.mp4`) beş hesapta paylaşılıp profile sabitlendi (9 Kas; kullanıcı 11 Kas'ta bildirdi, platform bazında doğrulanmadı)

## Yakın takvim

| Tarih | Olay | Not |
|---|---|---|
| 7 Kas → kaydı | **Hafta 1 Gün 1** | Gün 0 (hesap, logo, banner, bio) 6 Kas'ta, sabit video 9 Kas'ta bitti. Gün 1 gönderileri 11 Kas itibarıyla paylaşılmadı. Günlük plan: beş hesap × yedi gün. [HAFTA_01.md](takvim/HAFTA_01.md) |
| ~20 Kasım | Mağaza yayını için son güvenli tarih (öneri) | Wrapped'tan önce inceleme ve kademeli açılış payı |
| Aralık ilk haftası | Wrapped kampanyası | Yılın en güçlü organik fırsatı |

## Son işlemler

| Tarih | İşlem |
|---|---|
| 9 Kas | Sabit video `seelogd-en-iphone-11-hero.mp4` beş hesapta paylaşıldı ve profile sabitlendi (kullanıcı bildirdi). `olcum/PAYLASIM_KAYDI.csv` ilk satırları; erişim sayıları henüz yok |
| 7 Kas | Sabitlenen tanıtım yeniden yazıldı (kullanıcı: müzik tutmuyor, içerik kesik): `seelogd-en-iphone-10-pro.mp4` — arayüz artık ekran görüntüsü değil, HTML/CSS çizimi; telifli afiş yok (reklam addayı), 44,4 sn, yeni `drive` müzik türü, müziksiz sürüm de var. Ses dinlenmedi, paylaşılmadı |
| 7 Kas | Kullanıcı: gerçek afiş ve birebir uygulama arayüzü istedi → `seelogd-en-iphone-11-hero.mp4`: gerçek ekran görüntüleri ve kayıtlar telefon çerçevesinde tam (kırpma yok), gerçek afiş duvarı; yalnız organik (telif). Sabitlenen video adayı artık bu; 10-pro reklam yedeği. Kasa ölçüsü düzeltildi (ekran taşıyordu). **Kullanıcı onayladı: beş hesapta sabitlenecek.** Paylaşılmadı |
| 7 Kas | **Kaza:** `kaynak/iphone-seti/video.html` bir yazma hatasıyla boşaldı (Claude'un betiti dosyayı açıp kodlama hatasıyla düştü); git'te olmadığı için yedek yoktu. Dosya yeniden kuruldu, on klibin de süresi eskisiyle aynı çıktı; yalnız 03 (swipe) klibinin kapanış bölümü yeniden yazıldı, o klip yeniden üretilirse görüntü birebir aynı olmayabilir (mevcut MP4 duruyor) |
| 7 Kas | Profillere sabitlenecek tanıtım videosu üretildi: `seelogd-en-iphone-09-full.mp4` (52,4 sn, dokuz özellik, iPhone ekranları, elektronik 100 BPM, -14,0 LUFS). Kaynakta 09. klip. Sürüm 2'de simge bölümü kaldırıldı, bölüm grafiği eklendi, CineSwipe ve turnuva kırpmaları düzeltildi. Ses dinlenmedi, paylaşılmadı |
| 7 Kas | 08-track videosu kullanıcı geri bildirimiyle yenilendi: kesik/kaymış kart kırpmaları ortalandı (kütüphane kartları, liste kartı), müzik synthpop yerine lo-fi 84 BPM, ücretsiz plan etiketi yalnız takip bölümünde gösteriliyor. 18,0 sn, -14,0 LUFS. **Kullanıcı onayladı**, paylaşılmadı. Ses dinlenmedi |
| 7 Kas | Hafta 1 Gün 1 için yeni video üretildi: `seelogd-en-iphone-08-track.mp4` (17,3 sn, iPhone ekranları, synthpop müzik, -13,8 LUFS). Analizdeki en güçlü kanca artık temiz videoyla gidiyor; eski `SERI/07-track` yedeğe alındı. Ses dinlenmedi, paylaşılmadı |
| 7 Kas | Günlük plan analize bağlandı (`analiz/KANAL_VE_DONUSUM_ANALIZI.md`): huni hesabı, kanca kademeleri, günlük emek dağılımı, üç günde bir karar kuralı. Wrapped Aralık'a alındı, oyun haftada tek güne indi, her platforma `utm_source` bağlantısı verildi. **Bulgu:** site beacon'ı `utm_source`'u zaten kaydediyor, kanal ölçümü `/admin` panelinden okunabilir |
| 7 Kas | `takvim/HAFTA_01.md` günlük plana çevrildi: beş hesaba yedi gün, 35 paylaşım slotu, hepsi hazır metin + dosya yolu. Reddit günlük tanıtım yerine 4 gönderi + 2 katılım günü + 1 koşullu özet. Hiçbiri paylaşılmadı |
| 6 Kas | TikTok hesabı açıldı (@seelogd). Beş platformun bio, görünen ad ve bağlantı metinleri karakter sınırlarına göre hazırlandı; TikTok için 80 karaktere sığan iki sürüm yazıldı |
| 6 Kas | Kullanıcı Lens profil resmini ve bannerları hesaplara yükledi (kullanıcı bildirdi; hangi platformların tamamlandığı doğrulanmadı). Gün 1 metinleri kullanıcıya sohbette iletildi |
| 6 Kas | **Hafta 1 başlatıldı.** `takvim/HAFTA_01.md` iPhone setine göre yeniden yazıldı: Gün 0 profil/bio kurulum listesi, 7 günlük takvim, her gönderi için hazır İngilizce metin ve dosya yolu. TikTok yoksa videolar yalnız Reels olarak gider. Hiçbir şey paylaşılmadı; paylaşım ve yükleme kullanıcıda |
| 6 Kas | iPhone seti üretildi (`sosyal-medya/cikti/en/iphone-seti/`): 7 müzikli video, 9 post, Lens profil/banner + IG öne çıkan kapakları. Kullanıcı Lens logosunu ve bannerları **hesaplarda kullanmayı onayladı**; yükleme kullanıcıda. Postlar paylaşılmadı |
| 3 Kas | Lens için yıldızların dönüp birleştiği 6,4 sn sesli logo animasyonu üretildi (`marka/yeni-logo/lens/animasyon/seelogd-logo-yildiz-*`); ses dinlenmedi |
| 3 Kas | Kullanıcı Lens logosunu seçti. Tam set üretildi (`marka/yeni-logo/lens/`): SVG/PNG, iOS/Android/favicon simgeleri, profil, X kapağı, logo animasyonu, marka sayfası. Uygulamaya ve hesaplara uygulanmadı, marka taraması yapılmadı |
| 3 Kas | Mevcut simgeden bağımsız üç yeni logo konsepti çizildi (Gördüm, İmge, Lens; `marka/yeni-logo/`) |
| 3 Kas | Gerçek ekranlarla 56,5 saniyelik seslendirmeli video üretildi (`seelogd-en-video-06-launch.mp4`), paylaşılmadı |
| 3 Kas | Prompt'a göre 45,5 saniyelik seslendirmeli, müzikli video üretildi (`seelogd-en-video-05-launch.mp4`), paylaşılmadı |
| 3 Kas | Kullanıcı geri bildirimiyle 92 saniyelik ritmik tanıtım videosu kuruldu (`seelogd-en-video-04-launch.mp4`), özgün müzik gömülü, paylaşılmadı; iPhone görselleri bekleniyor |
| 2 Kas | Kullanıcı isteğiyle tek telefonlu, animasyonlu 46,5 saniyelik tanıtım videosu kuruldu (`seelogd-en-video-03-launch.mp4`), paylaşılmadı |
| 2 Kas | Emülatörde kayıtla 57 saniyelik özellik videosu üretildi (`seelogd-en-video-02-features.mp4`), sosyal bölüm öne alındı; Film Kulübü yalnız kurulum ekranı, paylaşılmadı |
| 2 Kas | 22 saniyelik İngilizce dikey tanıtım videosu üretildi (`seelogd-en-video-01-intro.mp4`), henüz paylaşılmadı |
| 2 Kas | Reddit, Instagram, X ve Threads kullanıcı adları yazıldı (`seelogd`) |
| 2 Kas | Klasör düzenlendi, analiz ve hesap dosyaları oluşturuldu |
| 2 Kas | `post-08` premium görselindeki hatalı iddialar düzeltildi (TR ve EN) |
