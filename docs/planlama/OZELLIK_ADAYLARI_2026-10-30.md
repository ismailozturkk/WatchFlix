# Seelogd — Özellik Adayları (30 Ekim 2026)

> Kapsam: Eğlence, Kütüphane ve Profil/Sosyal alanları için yeni özellik fikirleri.
> Kaynak: kod taraması + internet araştırması (Reddit r/Letterboxd, change.org dilekçeleri, TV Time / Framed /
> rakip uygulama sayfaları). Kaynaklar kullanıcı isteğine dair **işaret**tir, ölçülmüş veri değil.
> Bu bir **seçim listesidir**: seçilen madde kendi `docs/ozellikler/` belgesini alır.
> Önceki aday listesi: `GELISTIRME_ONERI_ADAYLARI_2026-10-17.md` (oradakilerin çoğu yapıldı).

**Sütun anlamları:** Efor = Düşük / Orta / Yüksek (kaba tahmin). Build = yeni native build gerekir mi.
Deploy = Cloud Functions veya Firestore rules deploy'u gerekir mi. "Kodda" = taramada bulunan mevcut parça.

---

## 0. Araştırmanın kısa özeti

| Bulgu | Kaynak | Seelogd için anlamı |
|---|---|---|
| Letterboxd'da **dizi takibi yok** — en çok istenenlerden | Reddit, uygulama denetimleri | Seelogd'da var → pazarlamada öne çıkar |
| **Başlığa özel, gizli not** isteniyor | change.org dilekçesi, eklenti panoları | K2 |
| **Tekrar izleme** düzgün sayılmıyor, "#rewatch" etiketiyle idare ediliyor | Reddit, Product Hunt | K1 |
| Günlük **takvim** görünümünde değil | Reddit | K1 |
| Liste kurmak zahmetli (tek tek arama), elle sıralama kalıcı değil | Reddit | K7, K8 |
| Platforma ve zevke göre öneri, ayarlanabilir arkadaş bildirimi | Reddit, analiz yazıları | K4, P8 |
| TV Time'ın sevilenleri: bölüm başına **spoiler'sız yorum**, **duygu tepkisi**, **favori karakter oyu**, "öncekileri de işaretle" | TV Time incelemeleri, istek panoları | K9, K10, P7 |
| TV Time'ın kapanacağı konuşuluyor (resmî kaynak doğrulanmadı) | Wikipedia zaman çizelgesi, dilekçe | G1 |
| Rakipler: grup anketiyle seçim, aylık ortak izleme kulübü, arkadaş "zevk ligi" | CineBond, REGO, The Backlot, Film League | E7, E2 |
| Topluluk meydan okumaları (52 haftada 52 film, Criterion Challenge) Letterboxd'da yalnız elle tutulan listeler | Letterboxd listeleri | E4 |
| Günlük film oyunları (Framed, Titleshot, Poster): seri + istatistik + paylaşılabilir sonuç | Framed haberleri | E1 |

---

## 1. Eğlence

### E1 · Günlük Kare Avı (Framed tarzı) — ✅ YAPILDI 30 Eki → `docs/ozellikler/GUNUN_KARESI.md` ("Günün Karesi")
- **Ne yapar:** Her gün herkes için aynı tek film. Önce zor bir sahne karesi gösterilir; her yanlış tahminde yeni,
  daha tanıdık bir kare açılır (6 hak). Değişken: kareler yerine ipucu dizisi — yıl → tür → yönetmen → oyuncu → bulanık afiş.
- **Akış:** Eğlence → "Bugünün Karesi" kartı → tahmin kutusu (otomatik tamamlama) → sonuç ekranı →
  🟩🟨⬛ kutucuklu sonucu sohbete / Hikâye'ye / dışarı paylaş.
- **Neden:** Herkes aynı bulmacayı çözer → konuşma ve paylaşım doğar; günlük açılma sebebi.
- **Kodda:** `services/sceneGameService.js` (sahne görseli seçimi, `utils/dailyChallenge` ile günlük tohum, seri),
  Bulanık Afiş oyunu, liderlik altyapısı. **Yeni olan:** kademeli açılma, 6 hak, emoji sonuç kartı.
- **Efor:** Düşük–Orta · Build: Hayır · Deploy: Hayır (günlük skor tablosu istenirse rules)
- **Premium fikri:** Geçmiş günlerin arşivini oynamak Premium.

### E2 · Haftalık Lig
- **Ne yapar:** Kullanıcılar her pazartesi 20–30 kişilik gruplara düşer. Oyun puanı, izleme, oy ve görevlerden
  haftalık XP toplanır. Pazar gecesi ilk 5 üst lige, son 5 alt lige geçer (Bronz → Gümüş → Altın → Elmas → Efsane).
- **Akış:** Eğlence üstünde lig şeridi ("Altın Lig · 7. sıra · 2 gün kaldı") → lig tablosu → hafta sonu sonuç kartı.
- **Neden:** Her hafta sıfırlanan rekabet; "düşmeyeyim" diye geri gelme. Duolingo'nun kanıtlanmış modeli.
- **Kodda:** liderlik tabloları ve "Genel = sıra puanı" (`GameLeaderboardScreen`), puan doğrulama (`utils/gameScoring`).
  **Yeni olan:** grup ataması ve hafta sonu terfi işi (zamanlanmış function).
- **Efor:** Orta–Yüksek · Build: Hayır · Deploy: **Evet** (functions + rules)
- **Dikkat:** Hile koruması — XP yalnız sunucuda doğrulanan olaylardan.

### E3 · Film Zinciri (Six Degrees)
> **Yapıldı (30 Eki 2026)** → `docs/ozellikler/FILM_ZINCIRI.md`. 240 önceden hesaplanmış bulmaca (par 2/3, kesin en
> kısa), günlük + serbest mod, Eğlence > Hızlı oyunlar rayının başında. Cihazda görülmedi, commit yok.
- **Ne yapar:** "Tom Hanks'ten Zendaya'ya ulaş." Oyuncu → film → oyuncu adımlarıyla zincir kurulur; en kısa zincir
  en yüksek puanı alır. Günlük sabit bulmaca + serbest mod.
- **Neden:** Sinema bilgisini sınayan, farklı türde bir oyun; arkadaşla aynı bulmacayı kıyaslama.
- **Kodda:** `ActorViewScreen` kişi `movie_credits` / `tv_credits` çekiyor. **Yeni olan:** oyun ekranı, en kısa
  yol hesabı (önceden hesaplanmış günlük çift önerilir).
- **Efor:** Orta · Build: Hayır · Deploy: Hayır

### E4 · Meydan Okumalar (Challenges)
- **Ne yapar:** Hazır, süreli görevler: "52 haftada 52 film", "Her on yıldan bir film", "10 ülkenin sineması",
  "Bir yönetmenin tüm filmleri", "Ekim: 13 korku filmi". İlerleme çubuğu, bitirince rozet. Arkadaşla ortak katılım.
- **Akış:** Eğlence → Meydan okumalar → katıl → ilerleme izlemeden otomatik dolar → profilde rozet.
- **Neden:** Letterboxd'da bu yalnız elle tutulan listelerle yapılıyor; yerleşik hâli fark yaratır.
- **Kodda:** rozet defteri v3, `watchBadgeCatalog`, yıllık hedef ilerleme hesabı.
- **Efor:** Orta · Build: Hayır · Deploy: Hayır (yerel); ortak katılım için rules
- **Premium fikri:** Kendi meydan okumanı oluşturup arkadaşlara açmak.

### E5 · Sezon Etkinlikleri
- **Ne yapar:** Takvime bağlı süreli etkinlikler: Cadılar Bayramı korku maratonu, Yılbaşı filmleri, Oscar haftası,
  Sevgililer Günü. Her birine özel Bingo kartı, süreli rozet, tema/ikon süslemesi.
- **Neden:** Yılda birkaç kez herkesi aynı anda geri çağıran an; "kaçırmayayım" etkisi.
- **Kodda:** Bingo, rozet sistemi, ekran bazında efekt seçimi (kar/ikon/ambiyans).
- **Efor:** Orta (ilk etkinlik), sonrakiler Düşük · Build: Hayır · Deploy: Hayır (uzaktan etkinlik takvimi istenirse Firestore belgesi)

### E6 · Arkadaş Görevleri
- **Ne yapar:** Haftalık ikili/grup görevleri: "Ali ile ortak 3 film izleyin", "Bir düello kazan", "Bir arkadaşına
  öneri gönder, o da izlesin". Ödül: rozet, seri kalkanı ya da lig XP'si.
- **Neden:** Sosyal bağı oyunlaştırır; uygulamaya arkadaş çekme sebebi.
- **Kodda:** düello, CineSwipe, sohbete gönder, seri kalkanı.
- **Efor:** Orta · Build: Hayır · Deploy: Evet (karşılıklı ilerleme için)

### E7 · Film Kulübü
- **Ne yapar:** Arkadaş grubu kulüp kurar. Her hafta (ya da ay) oylamayla bir film seçilir; herkes izleyince
  spoiler'sız tartışma odası açılır; kulübün izlediklerinden ortak bir arşiv ve kulüp istatistiği oluşur.
- **Akış:** Grup sohbeti → "Kulüp yap" → haftanın filmi oylaması → izleyenler işaretlenir → tartışma açılır.
- **Neden:** The Backlot / Film League gibi uygulamaların çekirdeği; düzenli tekrar eden sosyal ritüel.
- **Kodda:** grup sohbetleri, medya anketi (`PollMessage` type "media"), grup okunmamış sayacı.
- **Efor:** Orta–Yüksek · Build: Hayır · Deploy: **Evet** (rules)

### E8 · Ödül Tahmin Ligi
- **Ne yapar:** Oscar / Emmy adaylarına kategori kategori tahmin; tören gecesi sonuçlar girilince puanlanır;
  arkadaş ve genel sıralama, "Kahin" rozeti.
- **Neden:** Yılın en büyük sinema anında uygulamayı açtırır.
- **Kodda:** Oscar/Emmy yıl seçici (`AwardYearSheet`), ödül verisi ekranları.
- **Efor:** Orta · Build: Hayır · Deploy: Evet (tahmin kilidi + sonuç)

### E9 · Puanını Tahmin Et
- **Ne yapar:** "Ayşe bu filme kaç verdi?" ya da "Seelogd ortalaması kaç?" — yakınlığa göre puan.
- **Neden:** Arkadaş verisini oyuna çevirir; zevk uyumunu eğlenceli kılar.
- **Kodda:** arkadaş puanları, zevk uyumu gizlilik kuralları (`canReadLists`).
- **Efor:** Düşük–Orta · Build: Hayır · Deploy: Hayır
- **Dikkat:** Yalnız puanlarını görmeye izin veren arkadaşlar.

### E10 · Replik Tahmini
- **Ne yapar:** Ünlü bir replikten filmi bul (çoktan seçmeli veya yazarak).
- **Neden:** Farklı bilgi türü; kısa ve paylaşılabilir.
- **Kodda:** oyun kayıt sistemi (`screens/game/gameRegistry.js`). **Yeni olan:** replik veri seti (elle hazırlanmalı;
  TMDB'de yok). Müzik tahmini lisans yüzünden önerilmez.
- **Efor:** Orta (veri hazırlığı) · Build: Hayır · Deploy: Hayır

### E11 · Anket sonucunu listeye bağla (küçük ek)
- **Ne yapar:** Sohbetteki medya anketinin kazananı tek dokunuşla "İzleneceklere ekle" ya da CineSwipe odası başlat;
  ankete bitiş süresi.
- **Kodda:** medya anketi **zaten var** (`components/chat/PollMessage.js`). Bu yalnız kapanış adımı.
- **Efor:** Düşük · Build: Hayır · Deploy: Hayır

---

## 2. Kütüphane

### K1 · İzleme Günlüğü (Diary)
- **Ne yapar:** Her izleme ayrı bir kayıt: tarih, o anki puan, **nerede** (sinema / Netflix / TV / uçak…),
  **kiminle** (arkadaş seçici), kısa not, isteğe bağlı bilet/anı fotoğrafı. Takvim görünümü (ay ızgarasında afişler),
  "3. izleyişin" etiketi.
- **İstatistik ekleri:** "Bu yıl 14 kez sinemaya gittin", "En çok birlikte izlediğin kişi", platform dağılımı.
- **Neden:** Letterboxd'ın en çok eleştirilen boşlukları (tekrar izleme, takvim, nerede). Letterboxd'dan gelen
  kullanıcıyı tutar; içe aktarmayla doğal uyum.
- **Kodda:** `watchEvents` / `watchCount` (içe aktarma birleştirmesi), `RewatchHighlights` (istatistik),
  `MediaQuickActionsSheet` tekrar izleme dalı, istatistik gün yığını. **Yeni olan:** nerede/kiminle alanları,
  takvim ekranı, foto.
- **Efor:** Orta · Build: Hayır · Deploy: Foto için Storage rules
- **Premium fikri:** Foto ekleme ve ayrıntılı günlük istatistiği.

### K2 · Başlığa Özel Gizli Not
- **Ne yapar:** Her film/diziye yalnız senin gördüğün not ("Ali önerdi", "Sonu kafa karıştırıcı", "Altyazılı izle").
  Detay ekranında not alanı, liste kartında küçük not simgesi, notlarda arama.
- **Neden:** Letterboxd'da yok; dilekçesi ve eklentileri var. Küçük iş, sık kullanılır.
- **Kodda:** Notlar ekranı ayrı ve genel; başlığa bağlı not alanı bulunamadı. Yerel-öncelikli veri katmanı hazır.
- **Efor:** Düşük · Build: Hayır · Deploy: Hayır (yerel); bulut eşitleme istenirse rules

### K3 · Akıllı Listeler
- **Ne yapar:** Kurala göre kendiliğinden dolan listeler: "Puanım ≥ 8 olan 90'lar filmleri", "2 saatten kısa
  izleneceklerim", "Platformlarımda olanlar", "Takip ettiğim yönetmenlerin filmleri".
- **Neden:** Elle bakım gerektirmeyen, hep güncel listeler.
- **Kodda:** `ListSortFilterSheet`, platform süzgeci, takip edilen kişiler. **Yeni olan:** kural kaydı + liste türü.
- **Efor:** Düşük–Orta · Build: Hayır · Deploy: Hayır

### K4 · "Bu akşam ne var?"
- **Ne yapar:** Süre (≤ 90 dk), ruh hali, kiminle, platform seçilir; **yalnız kendi izleme listenden** 3 öneri gelir.
  "Hiçbiri" → sonraki üçlü.
- **Neden:** "Ne izlesem?" tüm TMDB'yi tarar; bu, kişinin biriktirdiği listeyi eritir. Seçim yorgunluğuna çözüm.
- **Kodda:** `utils/watchPicker`, platform süzgeci (ProviderWatch), CineMatch vibe seçici.
- **Efor:** Düşük · Build: Hayır · Deploy: Hayır

### K5 · Ortak Liste
- **Ne yapar:** Bir ya da daha çok arkadaşla birlikte düzenlenen liste ("Ali ile izlenecekler", "Ev filmleri").
  Kim eklediği görünür; izleyen işaretler.
- **Neden:** Çiftler ve arkadaş grupları için en doğal sosyal liste.
- **Kodda:** liste paylaşımı ve sohbet liste kartı var; çok yazarlı liste yok.
- **Efor:** Orta–Yüksek · Build: Hayır · Deploy: **Evet** (rules)
- **Premium fikri:** Free 1 ortak liste, Premium sınırsız.

### K6 · Birikim Ayıklama
- **Ne yapar:** "Bu 12 film 1 yıldan uzun süredir izleme listende." Kart kart hızlı karar: İzle / Sil / Ertele
  (kaydırarak, CineSwipe hissiyle).
- **Neden:** Şişen izleme listesi kullanıcıyı küstürür; ayda bir sağlıklı hatırlatma.
- **Kodda:** liste ekleme tarihleri, `libraryActions` yazma kapısı.
- **Efor:** Düşük · Build: Hayır · Deploy: Hayır

### K7 · Toplu Liste Kurma
- **Ne yapar:** Film adları (alt alta) yapıştırılır → hepsi TMDB'de eşleştirilir → belirsizler için seçim → listeye ekle.
  Aramada çoklu seçim modu.
- **Neden:** Letterboxd'ın sık şikâyeti: her filmi tek tek aramak.
- **Kodda:** içe aktarma eşleştirme/analiz adımı (`services/import/*`) yeniden kullanılabilir.
- **Efor:** Düşük–Orta · Build: Hayır · Deploy: Hayır

### K8 · Kalıcı Elle Sıralama
- **Ne yapar:** Özel listede sürükle-bırak; sıra kaydedilir ve paylaşımda/sohbet kartında da korunur
  ("Benim Top 10'um").
- **Kodda:** **Doğrulanmalı** — mevcut sıralama seçeneklerinde "elle" var mı bakılmadı.
- **Efor:** Düşük–Orta · Build: Hayır · Deploy: Hayır

### K9 · Bölüm Tepkisi + Bölümün Yıldızı
- **Ne yapar:** Bölüm izlenince 😱 😭 😂 🔥 😴 tepkisi ve "bölümün yıldızı" (oyuncu kadrosundan) oyu.
  Bölüm sayfasında topluluk dağılımı; dizi sonunda "Senin dizi özetin" (en çok güldüğün bölüm vb.).
- **Neden:** TV Time'ın en sevilen yanı; dizi tarafındaki avantajı büyütür.
- **Kodda:** bölüm grafiği ekranı (`TvGraphScreen`), bölüm izleme akışı.
- **Efor:** Orta · Build: Hayır · Deploy: Evet (topluluk sayımı için)

### K10 · "Öncekileri de işaretle"
- **Ne yapar:** 5. bölüm işaretlenince "1–4'ü de izledim olarak işaretleyeyim mi?" sorusu.
- **Kodda:** **Doğrulanmalı** — sezon toplu işaretleme var, bu sorunun olup olmadığına bakılmadı.
- **Efor:** Düşük · Build: Hayır · Deploy: Hayır

---

## 3. Profil ve Sosyal

### P1 · Sinema Kişiliği (Zevk DNA'sı)
- **Ne yapar:** İzleme geçmişinden arketip: "Gece Yarısı Gerilimcisi 🌙", "Klasik Avcısı", "Dünya Gezgini".
  Yanında tür, dönem, ülke, süre eğilimleri. Ayda bir yenilenir, değişince bildirim.
- **Neden:** Paylaşılabilir kimlik kartı → organik büyüme; "bu ay ne oldum?" merakı.
- **Kodda:** `useProfileStats`, `badgeInsights`, profil paylaş kartı düzenleri, Wrapped paletleri.
- **Efor:** Orta · Build: Hayır · Deploy: Hayır

### P2 · Profil Vitrini
- **Ne yapar:** Kullanıcı profilinde görünecek blokları seçer ve sıralar: dört favori, öne çıkan liste,
  son puanlar, rozet rafı, şu an izlediği dizi, sinema kişiliği.
- **Kodda:** dört favori, "Profilde görünen listeler", bölüm gizle/göster çekirdeği.
- **Efor:** Orta · Build: Hayır · Deploy: Rules (yeni alan okunacaksa)

### P3 · "Şu An İzliyorum" Durumu
- **Ne yapar:** "📺 The Bear S3E4" durumu profilde ve arkadaş listesinde görünür; birkaç saat sonra kendiliğinden düşer.
  Arkadaş tek dokunuşla tepki/yorum bırakır.
- **Kodda:** presence mimarisi (soket başına bağlantı).
- **Efor:** Düşük–Orta · Build: Hayır · Deploy: Muhtemelen rules
- **Dikkat:** Varsayılan kapalı ya da açık? Gizlilik kararı gerekir.

### P4 · Zaman Tüneli + "Geçen Yıl Bugün"
- **Ne yapar:** Yıl yıl: en çok izlenen tür, yılın favorisi, ilk izlenen film, toplam süre. Bildirim:
  "Geçen yıl bugün Interstellar'ı izlemiştin ⭐9".
- **Kodda:** istatistik tarih süzgeci (`matchesDateFilter`), Wrapped.
- **Efor:** Düşük–Orta · Build: Hayır · Deploy: Hayır (yerel bildirim)

### P5 · Arkadaş Karşılaştırma (genişletme)
- **Ne yapar:** Mevcut zevk uyumuna ekler: yan yana istatistik (süre, tür), ortak sevilenler,
  **"en çok ayrıştığınız film"** (biri 10, öbürü 3), paylaşılabilir kıyas kartı.
- **Kodda:** zevk uyumu + birlikte izleyelim **zaten var** (`TasteMatchCard`). Bu bir genişletme.
- **Efor:** Düşük–Orta · Build: Hayır · Deploy: Hayır

### P6 · Yabancı Profillerde Uyum Yüzdesi
- **Ne yapar:** Arkadaş olmayan profilde "%82 uyumlusunuz" → arkadaş isteği gönderme sebebi.
- **Kodda:** zevk uyumu hesabı; yabancı profilin görünür verisine bağlı.
- **Efor:** Düşük · Build: Hayır · Deploy: Belki rules
- **Dikkat:** Gizlilik — yalnız herkese açık listeler kullanılmalı.

### P7 · Otomatik Spoiler Kalkanı
- **Ne yapar:** İzlemediğin film/bölüme ait yorum, paylaşım ve sohbet kartları **kendiliğinden** bulanık gelir
  (yazarın işaretlemesine gerek kalmadan). "Yine de göster" dokunuşu.
- **Kodda:** **elle** spoiler işareti zaten var (`components/Comment.js` `isSpoiler`, sohbet `ComposerBlur`).
  Yeni olan: izleme durumuna göre otomatik karar.
- **Efor:** Orta · Build: Hayır · Deploy: Hayır

### P8 · Kişi Bazlı Bildirim Ayarı
- **Ne yapar:** "Ali'nin puanlarını bildir, izleme listesini bildirme" gibi arkadaş başına ayar; "yakın arkadaşlar" grubu.
- **Kodda:** `SocialNotificationsScreen` genel türleri yönetiyor; kişi bazlı yok.
- **Efor:** Orta · Build: Hayır · Deploy: **Evet** (sunucu push süzgeci `socialPush.js`)

### P9 · "Çevren Bunu Sevdi" Rafı
- **Ne yapar:** Birden çok arkadaşın yüksek puanladığı ama senin izlemediğin başlıklar; keşifte ve profilde raf.
- **Kodda:** arkadaş puanları, raf başlık sistemi (`homeSectionCopy`).
- **Efor:** Orta · Build: Hayır · Deploy: Belki (sunucuda toplamak daha ucuz)

### P10 · Haftalık Özet Bildirimi
- **Ne yapar:** Pazar akşamı: "Bu hafta 4 film · seri 12 gün · Ali seni ligde geçti · yeni bölüm: X".
  Dokununca küçük özet ekranı.
- **Kodda:** yerel bildirimler, seri alevi, istatistikler.
- **Efor:** Düşük · Build: Hayır · Deploy: Hayır (yerel); lig verisi için E2'ye bağlı

---

## 4. Büyüme

### G1 · TV Time Göç Sihirbazı
- **Ne yapar:** TV Time dışa aktarma dosyasını okuyup dizi/bölüm geçmişini, puanları ve listeleri aktarır;
  mağaza ve sitede "TV Time'dan geliyorsan" sayfası.
- **Neden:** TV Time kapanıyorsa kullanıcıları yeni ev arıyor (kapanış **doğrulanmalı**).
- **Kodda:** Letterboxd/IMDb içe aktarma altyapısı (analiz adımı, sürdürülebilir iş, kaynak etiketleri).
- **Efor:** Orta · Build: Hayır · Deploy: Hayır

---

## 5. Zaten var olduğu için listeden çıkarılanlar

| Fikir | Neden çıkarıldı |
|---|---|
| Yorumlara yanıt + @etiket | Yorum yanıtları (`parentId`, `replyCount`) ve gönderide etiketleme zaten var |
| Grup anketiyle film seçme | Sohbette medya anketi var; yalnız E11 kapanış adımı kaldı |
| Zevk uyumu + birlikte izleyelim | 18 Eki'de yapıldı; P5 genişletmesi kaldı |
| Bulanık afiş / sahne tahmini oyunu | Var; E1 bunların günlük "kademeli" hâli |

---

## 6. Hızlı seçim tablosu

| Kod | Özellik | Alan | Efor | Deploy | Etki |
|---|---|---|---|---|---|
| E1 | Günlük Kare Avı | Eğlence | Düşük–Orta | Hayır | ⭐⭐⭐ günlük açılma + paylaşım |
| E2 | Haftalık Lig | Eğlence | Orta–Yüksek | Evet | ⭐⭐⭐ haftalık bağlılık |
| E3 | Film Zinciri ✅ | Eğlence | Orta | Hayır | ⭐⭐ |
| E4 | Meydan Okumalar | Eğlence | Orta | Hayır | ⭐⭐⭐ |
| E5 | Sezon Etkinlikleri | Eğlence | Orta | Hayır | ⭐⭐ |
| E6 | Arkadaş Görevleri | Eğlence | Orta | Evet | ⭐⭐ |
| E7 | Film Kulübü | Eğlence | Orta–Yüksek | Evet | ⭐⭐⭐ sosyal ritüel |
| E8 | Ödül Tahmin Ligi | Eğlence | Orta | Evet | ⭐⭐ sezonluk |
| E9 | Puanını Tahmin Et | Eğlence | Düşük–Orta | Hayır | ⭐⭐ |
| E10 | Replik Tahmini | Eğlence | Orta | Hayır | ⭐ |
| E11 | Anket → listeye | Eğlence | Düşük | Hayır | ⭐ |
| K1 | İzleme Günlüğü | Kütüphane | Orta | Storage | ⭐⭐⭐ Letterboxd'ın boşluğu |
| K2 | Başlığa özel not | Kütüphane | Düşük | Hayır | ⭐⭐ çok istenen |
| K3 | Akıllı Listeler | Kütüphane | Düşük–Orta | Hayır | ⭐⭐ |
| K4 | Bu akşam ne var? | Kütüphane | Düşük | Hayır | ⭐⭐ |
| K5 | Ortak Liste | Kütüphane | Orta–Yüksek | Evet | ⭐⭐⭐ çiftler/gruplar |
| K6 | Birikim Ayıklama | Kütüphane | Düşük | Hayır | ⭐⭐ |
| K7 | Toplu Liste Kurma | Kütüphane | Düşük–Orta | Hayır | ⭐⭐ |
| K8 | Kalıcı Elle Sıralama | Kütüphane | Düşük–Orta | Hayır | ⭐⭐ (doğrulanmalı) |
| K9 | Bölüm Tepkisi + Yıldızı | Kütüphane | Orta | Evet | ⭐⭐⭐ dizi avantajı |
| K10 | Öncekileri işaretle | Kütüphane | Düşük | Hayır | ⭐ (doğrulanmalı) |
| P1 | Sinema Kişiliği | Profil | Orta | Hayır | ⭐⭐⭐ paylaşılabilir |
| P2 | Profil Vitrini | Profil | Orta | Rules | ⭐⭐ |
| P3 | Şu An İzliyorum | Profil | Düşük–Orta | Rules | ⭐⭐ |
| P4 | Zaman Tüneli | Profil | Düşük–Orta | Hayır | ⭐⭐ |
| P5 | Arkadaş Karşılaştırma+ | Profil | Düşük–Orta | Hayır | ⭐⭐ |
| P6 | Yabancıda uyum yüzdesi | Profil | Düşük | Belki | ⭐⭐ |
| P7 | Otomatik Spoiler Kalkanı | Sosyal | Orta | Hayır | ⭐⭐⭐ |
| P8 | Kişi bazlı bildirim | Sosyal | Orta | Evet | ⭐⭐ |
| P9 | Çevren bunu sevdi | Sosyal | Orta | Belki | ⭐⭐ |
| P10 | Haftalık Özet | Sosyal | Düşük | Hayır | ⭐⭐ |
| G1 | TV Time Göçü | Büyüme | Orta | Hayır | ⭐⭐⭐ (kapanış doğrulanırsa) |

**Önerilen ilk dalga (düşük efor, yüksek etki):** E1, K2, K4, K6, P10 — hepsi deploy gerektirmez.
**İkinci dalga (büyük kazanç):** K1, E4, P1, P7.
**Sunucu işi isteyen büyükler:** E2, E7, K5, K9.

---

## Kaynaklar
- r/Letterboxd — "What feature does Letterboxd need" (Ocak 2025)
- change.org — "Add private notes for films on Letterboxd"; "Save TV Time from closure"
- Enhancer for Letterboxd geri bildirim panosu; Moviebase "previous TV Time user" önerileri
- mein-mmo.de — TV Time tanıtımı (spoiler'sız yorum, tepki, favori karakter)
- Tom's Guide / PC Gamer — Framed; Playlin — Framed / Titleshot / Poster
- App Store — CineBond, REGO, The Backlot, Marquee Matinee (Film League); Simkl watch party dokümanı
- Letterboxd kullanıcı listeleri — 52 film / Criterion Challenge
