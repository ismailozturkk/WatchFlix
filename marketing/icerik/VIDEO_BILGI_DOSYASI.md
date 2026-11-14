# Video bilgi dosyası

Son güncelleme: **2 Kasım 2026**

Tanıtım videoları bu dosyaya göre hazırlanır. Yeni özellik, karar veya sahne isteği buraya yazılır. Hikâye ve hareket yöntemi için önce [VIDEO_URETIM_PROMPTU.md](VIDEO_URETIM_PROMPTU.md) okunur.
Hesap bilgisi ve parola bu dosyaya **yazılmaz**.

## Ana mesaj

seelogd yalnızca izleme kaydı değildir. **Film ve diziyi arkadaşlarınla birlikte yaşadığın sosyal bir yerdir.**
Video bunu göstermeli: takip temeldir; arkadaşlar, sohbet, gruplar, Film Kulübü, CineSwipe, turnuva ve oyunlar asıl çekiciliktir.

Bu vurgu kullanıcının 2 Kasım isteğidir. Önceki stratejideki "önce takip" önerisi videonun odağı için geçerli değildir; plan sınırları yine dürüstçe gösterilir.

## Özellik listesi (kullanıcının sırası)

Plan bilgisi `utils/premiumFeatures.js` kaynaklıdır. Ekran adı kayıt sırasında aranacak yeri gösterir.

| # | Özellik | Videoda ne gösterilir | Ekran | Plan |
|---|---|---|---|---|
| 1 | Film ve dizi keşfi | Trendler, en iyiler, Oscar & Emmy, Dünya Turu rafları | Film & Dizi sekmesi | Free açık |
| 2 | Paylaşımlar | Gönderi akışı, beğeni, yorum | Eğlence sekmesi | Plan sınırı kodda bu listede görülmedi; doğrulanacak |
| 3 | Aylık turnuva | Ayın türü, eleme ağacı | `TournamentScreen` | Free izler, oy Premium |
| 4 | seelogd Top 100 | Oyla yükselen afiş ızgarası | `Top100Screen` | Free görür; oy Premium 10, Max 20 |
| 5 | Oyunlar | Sahne tahmini, Poster Bulmaca, hızlı oyunlar, lig | `GameHubScreen` | Free kapalı; Premium 20/gün, Max sınırsız |
| 6 | Profil ve avatar | Avatar, halesi, dört favori, kimlik | `ProfileScreen`, `EditProfileScreen` | Kimlik rozeti Premium |
| 7 | Özelleştirme | Tema, yazı tipi, simge, ambiyans, ekran bölümleri | `PersonalizationScreen`, `CustomThemeScreen` | 15 hazır tema (3 aile × 5 ton) Free; stüdyo, tüm yazı tipleri ve simge Premium |
| 8 | Rozetler | Rozet vitrini, nadirlikler | `WatchBadgesScreen` | Plan sınırı bu listede yok |
| 9 | Arkadaş profili ve uyum | Zevk uyumu yüzdesi, ortak izlenenler | `FriendProfileScreen` | Free 2 arkadaş |
| 10 | Sayısal ve tarihsel kayıt | Toplam süre, grafikler, gün gün geçmiş | `TvStatisticsScreen`, `MovieStatisticsScreen` | Bu listede sınır yok |
| 11 | Not ve hatırlatma | Yapım notu, not defteri, takvim, hatırlatıcı | `NotesScreen`, `RemindersScreen`, `CalendarScreen` | Sınırlar planlara göre; nota hatırlatıcı kurmak Premium |
| 12 | Wrapped arşivi | Yıl özeti, geçmiş yıllar | `WrappedScreen` | Free bu yıl, Premium 5 yıl, Max tümü |
| 13 | Listeler | Kapak düzenleri, özel ve ortak listeler | `ListsScreen`, `SharedListScreen` | Özel 1/25/sınırsız, ortak 2/10/sınırsız |
| 14 | CineSwipe | Kaydırma, eşleşme, canlı veya sırayla oda | `CineSwipeScreen` | Free kapalı; Premium 10 oda/gün, Max sınırsız |
| 15 | Arkadaş ekleme | Arama, istek | `SearchFriendsScreen`, `FriendRequestsScreen` | Free 2, Premium 150, Max sınırsız |
| 16 | Mesajlaşma | Sohbet, film kartı paylaşımı, alıntı | `MessagesScreen`, `ChatScreen` | Bu listede sınır yok |
| 17 | Grup kurma | Grup sohbeti, roller, anket | `CreateGroupScreen`, `GroupsListScreen` | Kurma 1/10/sınırsız |
| 18 | Film Kulübü | Oylama, tur, izleyenlere açık tartışma | `FilmClubScreen` | Kurmak Premium, katılmak serbest |

## Videoda doğru anlatım

| Konu | Doğru ifade |
|---|---|
| Oyunlar ve CineSwipe | Üzerinde görünür şekilde "Premium" yazar |
| Film Kulübü | "Start a club with Premium", katılım serbest |
| Turnuva ve Top 100 | Herkes görür, oy vermek Premium |
| Örnek sayılar | "Sample account" notu; kullanıcı başarısı gibi sunulmaz |
| Yayın durumu | "Join the beta", "Out now" değil |
| Kullanıcı sayısı | Sayı veya "binlerce kullanıcı" yok |

## Kayıt kuralları

- Kayıtlar test hesabıyla ve emülatörde alınır. Giriş bilgisi kullanıcıya aittir.
- Test hesabının verisini değiştiren düğmelere basılmaz: mesaj gönderme, paylaşım, oy, izledim, silme ve satın alma yok.
- Gerçek kişilerin adı, e-postası veya özel mesajı görünen kare kullanılmaz ya da gizlenir.
- Uygulama dili İngilizce olmalı; Türkçe kalan tür adları envantere yazılır.
- Afişler telifli olduğundan bu video yalnız organik paylaşım içindir.

## Sürümler

| Dosya | Süre | Odak | Durum |
|---|---|---|---|
| `seelogd-en-video-01-intro.mp4` | 22 sn | Takip, CineMatch, Wrapped | Kullanıcı kapsamı dar buldu |
| `seelogd-en-video-02-features.mp4` | ~57 sn | 17 sahne; sosyal bölüm girişten hemen sonra | Kullanıcı akıcı bulmadı; yerine 03 |
| `seelogd-en-video-03-launch.mp4` | 46,5 sn | Tek telefonlu, animasyonlu tam tanıtım; sosyal bölüm önde | Kullanıcı kesik ve hızlı buldu; yerine 04 |
| `seelogd-en-video-04-launch.mp4` | 92 sn | 17 sahne, her biri vuruşta başlar; kelime vuruşları, renk alanları, hareketli şekiller, gömülü özgün müzik | Kullanıcı başarılı buldu; yerine daha kısa hikâyeli 05 |
| `seelogd-en-video-05-launch.mp4` | 45,5 sn | Sorun ve çözüm hikâyesi; seslendirme (Kokoro `af_heart`), özgün müzik, efekt, altyazı; arayüz çizimi, özgün afişler | Kullanıcı gerçek arayüz istedi; yerine 06 |
| `seelogd-en-video-06-launch.mp4` | 56,5 sn | Gerçek ekranlar; alan öne çıkma animasyonu; dört birleşik bölüm; seslendirme, müzik, efekt, altyazı | Güncel. Android görüntüleri; iPhone görselleri gelince değişecek. Marka "see logged" okunuyor, onay bekliyor |

## Kayıt durumu (2 Kas)

| Özellik | Görüntü | Not |
|---|---|---|
| Keşif, istatistik, listeler, hatırlatıcı, not, avatar, yazı tipi, efekt, rozet, Wrapped, oyun, CineSwipe, turnuva, Top 100 | Emülatör kaydı | Plan simülatörüyle (Max) çekildi, gerçek satın alma yok |
| Paylaşımlar | Ekran görüntüsü | Altındaki gerçek kullanıcı gönderisi karartıldı |
| Zevk uyumu | Eski ekran görüntüsü | `Sample account` notlu |
| Arkadaş arama, arkadaş profili, zevk uyumu, sohbet, grup | Emülatör kaydı | `Üç Kişi` ve mevcut `Kino Team` test verisi |
| Film Kulübü | Kurulum ekranı | Kurmak sunucuda gerçek Premium ister; simülatör yetmez. Tur, oylama ve tartışma çekilemedi |

Test hesabına eklenen örnek veri: 70 film, 14 dizi, 8 izleme listesi, 3 liste, 1 not, Avengers: Doomsday hatırlatıcısı, 1 Frame of the Day cevabı, `Üç Kişi` sohbetine 1 mesaj ve Dune kartı, `Friday Movie Night` grubu. Aktarım dosyaları emülatörün `Download` klasöründe.

Bu kayıtlarda kullanılmaması gerekenler: profil üst kısmı (e-posta, doğrulama uyarısı, simüle "Premium Max"), Ayarlar'ın üstü (geliştirme kartı), turnuva üst satırı (geliştirme sekmeleri).

## Hareket kuralları (03 ve sonrası)

Kullanıcı 01'in akıcılığını 02'den üstün buldu. [motion-graphics-skills](https://github.com/charlie947/motion-graphics-skills) (MIT) tarifleri de esas alındı.

- Her kare yalnız zamandan hesaplanır (`seek(t)`), 60 fps üretilip 30 fps'e harmanlanır.
- Telefon kesilmez, videonun sonuna kadar tek nesnedir. Sahne geçişi yerine ekran içi itme ve kart uçuşu vardır.
- Kaydırma ekran kaydıyla değil, birleştirilmiş uzun ekranın kodla kaydırılmasıyla yapılır.
- Kartlar ekrandan gerçek görüntü kesilerek çıkar; arayüz elle çizilmez. (05'te çizim denendi; kullanıcı 06 için yine gerçek arayüz istedi.)
- Başlık maskeden yükselir, başlıkta daktilo efekti yok. Her vuruşun düzeni farklıdır.
- Sayılar gerçek test hesabından gelir ve "Sample account" notu taşır. Çağrı en az 3 saniye kalır.

## Kullanıcı notları

Yeni istekler buraya tarihle eklenir.

- 3 Kas: Gerçek ekranlardaki özel alanlar doğrudan kullanılsın, sesli anlatılıp animasyonlansın; alanlar birleştirilip zaman kazanılsın (örnek: Eğlence bölümü tek anlatım). 06 bu yüzden kuruldu.

- 3 Kas: Dört Reels örnek verildi; çok animasyonlu, güzel arayüzlü, seslendirmeli ve müzikli video isteniyor. 04 başarılı bulundu. Üretim yöntemi: [VIDEO_URETIM_PROMPTU.md](VIDEO_URETIM_PROMPTU.md).

- 3 Kas: 03'te bazı yerler kesik ve eksik, bazı yerler çok hızlı. Ritmik müzik ve bol animasyon isteniyor; örnek: https://youtube.com/shorts/XySN2V8Y7B8 (yalnız tarz örneği, müziği kullanılmadı). 04 bu yüzden kuruldu. iPhone görselleri sonra gelecek.

- 3 Kas: 03 beğenildi. Sıradaki sürümde arayüz iPhone olacak, görselleri kullanıcı atacak, müzik seçilecek. Liste: [IPHONE_CEKIM_LISTESI.md](IPHONE_CEKIM_LISTESI.md).

- 2 Kas: 02 akıcı değil; animasyonlu özellik yazıları ve etkileşimler eksik. 03 bu yüzden baştan kuruldu.

- 2 Kas: Video çok az özellik gösteriyor; yukarıdaki liste kapsansın. Asıl amaç arkadaş ekleme, mesajlaşma, grup ve Film Kulübü.
