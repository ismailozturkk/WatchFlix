# T3 — Cihaz kontrol listesi (2026-10-26)

Kaynak: rehberdeki T3 çekirdek akışları (`docs/planlama/YAYIN_ONCESI_TEST_REHBERI.md`) + T0.2 "cihazda doğrulanacaklar" (`docs/test/T0_ACIK_UCLAR_2026-10-25.md` bölüm 1).

**Platform:** **A** = Android emülatör (ajan yürütür) · **i** = iPhone (kullanıcı, 1.4.8 dev build) · **P** = Play sürümü / gerçek Android telefon / gerçek mağaza hesabı · **2H** = iki hesap gerekir (ikinci cihaz ya da emülatörde hesap değiştirme).
**Durum:** `[ ]` denenmedi · `✅` geçti · `❌` bulgu (numarasını `T3_BULGULAR_<tarih>.md`'ye yaz) · `⏸` bu ortamda denenemez (nedenini yaz).

**Ortam uyarıları:**
- iPhone'daki build 18 Eki (`4089c9c`). Sonraki iOS native değişiklikleri (cam yaması, SDK 57 yamaları, de/pt izin metinleri) o build'de yok; **i** satırlarında bunlardan kaynaklanan görüntü bulguları "yeni build bekliyor" diye işaretlenir, hata sayılmaz.
- Emülatör Metro üzerinden çalışma ağacını yükler; commit edilmemiş başka işler (o anki `git status`) de ekrana gelir. Bulgu yazarken commit'i ve çalışma ağacı durumunu not et.
- Hesap verisini değiştiren satırlar (silme, sıfırlama, izledim, arkadaşlık) **yalnız test hesabında** yürütülür. Emülatörde açık olan kullanıcı hesabıyla yapılmaz.
- Plan simülatörü (`__DEV__`) yalnız istemci kapılarını değiştirir. Sunucu kapıları (AI kotası, arkadaşın özel afişi, push) için gerçek plan gerekir: test hesabına promosyon kodu.

**Matris (her alan için en az bir kez):** Android + iOS · tr + en + (es/pt/de'den biri) · açık + koyu tema · Free + Premium + Max · küçük ekran (≤ 360 dp; emülatörde `wm size 720x1280` + `wm density 320`) · çevrimdışı.

---

## 1. Giriş ve hesap

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 1.1 | E-posta kaydı (yetişkin) | Tanıtım → Ücretsiz kaydol → e-posta, şifre, 18+ doğum tarihi → Kaydol | Hesap açılır, doğrulama e-postası uyarısı görünür | A i | [ ] |
| 1.2 | Yaş kapısı: 13 altı | Kayıtta 12 yaşında bir tarih seç → Kaydol | Kayıt reddedilir, anlaşılır mesaj; hesap oluşmaz | A | ❌ B1 |
| 1.3 | Yaş kapısı: 13–17 | 15 yaşında tarihle kaydol → Ayarlar | Kayıt olur; yetişkin içerik satırı hiç çizilmez, aramada yetişkin sonuç yok | A | [ ] |
| 1.4 | E-posta doğrulama | Kayıttan sonra gelen bağlantıyı aç → uygulamaya dön | Doğrulandı durumu yansır (yeniden açmadan ya da yenileyince) | A i | [ ] |
| 1.5 | Şifre sıfırlama | Giriş → Şifremi unuttum → e-posta → bağlantıyla yeni şifre → giriş | Tek giriş ekranı (`authEmail.js`), yeni şifreyle giriş olur | A | [ ] |
| 1.6 | Google girişi | Giriş → Google ile devam → hesap seç | Giriş olur; yeni hesapsa doğum tarihi tamamlama ekranı | P i | [ ] |
| 1.7 | Apple girişi | Giriş → Apple ile devam | Giriş olur; e-posta gizliyse de profil tamamlanır | i | [ ] |
| 1.8 | Çıkış / giriş | Profil → dişli → Çıkış → aynı hesapla giriş | Önceki hesabın verisi çıkışta görünmez; girişte geri gelir | A i | [ ] |
| 1.9 | Hesabı Sıfırla | Ayarlar → Hesap → Hesabı Sıfırla → 2 sn basılı tut | Listeler/izleme/not/rozet sıfırlanır; arkadaşlar, profil, sohbetler kalır; kısa dokunuş onaylamaz | A | [ ] |
| 1.10 | Hesap silme | Ayarlar → Hesap → Hesabı sil → (şifre) → 2,5 sn basılı tut | Çıkış olur; aynı e-postayla yeniden kayıt olur ve eski veri gelmez | A | [ ] |

## 2. Tanıtım ve açılış

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 2.1 | Açılış ekranı | Uygulamayı soğuk aç | Halkalar afişler gelene kadar bekler, takılma yok, logo ortalı | A i | ✅ A |
| 2.2 | Tanıtım: dil + atla | İlk açılış → dil seç → Atla | Seçilen dil hemen uygulanır, giriş/kayıt ekranına geçer | A i | ✅ A |
| 2.3 | Tanıtım: tamamla | Poster duvarı → hikâye adımları → sabit alt çubukla ilerle → bitir | Adımlar sırayla, ilerleme çubuğu doğru; son adım kayda götürür | A i | ✅ A |
| 2.4 | Tanıtım olayları | Tanıtımı DebugView açıkken geç | `onboarding_*` olayları DebugView'da görünür | P | [ ] |
| 2.5 | Paylaş menüsü + simge kısayolu | Tarayıcıdan bir TMDB bağlantısını Seelogd'a paylaş; simgeye uzun bas | Bağlantı ilgili detayı açar; kısayollar doğru ekrana gider | A i | [ ] |

## 3. Keşif

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 3.1 | Film&Dizi sekmesi | Sekmeyi aç → `MediaTypeSwitch` ile Film/Dizi arasında geç | Raflar türe göre değişir; başlıklar ortak `SectionHeader` | A i | ✅ A |
| 3.2 | Raflar | Ana ekranı sonuna kadar kaydır | Dünya Turu çipleri çalışır, takip edilenlerin yaklaşanları var, boş raf yok | A i | ✅ A |
| 3.3 | Arama | Arama düğmesi → film, dizi, kişi bölmeleri → keşif çipleri | Cam bölmeli kontrol + çip satırı; üç türde sonuç | A i | ❌ B5 |
| 3.4 | Ne izlesem? | Ne izlesem? → süzgeç seç → Şaşırt beni | Süzgece uyan öneri; yaş sınırı rozeti; AI kotası düşmez | A i | ✅ A |
| 3.5 | Yaklaşan Filmler süzgeci | Yaklaşanlar → hazır aralık, ay, özel aralık → sinemada/dijitalde → tür/dil/sıralama | Liste her seçimde değişir, sonuç süzgece uyar | A i | [ ] |
| 3.6 | Yetişkin içerik koruması | Ayarlar'da yetişkin içerik kapalı → arama + keşif | Yetişkin sonuç hiçbir yüzeyde yok | A | [ ] |
| 3.7 | Ayar değişince yenilenme | Yetişkin içerik / platformlar / poster kalitesi değiştir → Film&Dizi'ye dön | Ana ekran yeniden yüklenir, yeni ayar uygulanmış | A | [ ] |

## 4. Detay

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 4.1 | Film detayı | Bir filmi aç → oyuncular, benzerler, puanlar | Bölümler yüklenir; dış puanlar (IMDb/RT) gelir ya da sessizce gizlenir | A i | ✅ A |
| 4.2 | Dizi detayı + sezon | Bir diziyi aç → sezon → bölüm | Sezon/bölüm listesi, izleme düğmeleri | A i | ✅ A |
| 4.3 | Fragman + galeri | Fragman düğmesi → sayfayı kapat; galeriyi aç → kaydır → kapat | Alt sayfa kapanışı temiz; galeri yakınlaştırma/kapama | A i | [ ] |
| 4.4 | Bölüm grafiği | Dizi detayı → bölüm grafiği ekranı | Geri düğmesi durum çubuğunun altında, dokunulabilir | A i | ✅ A |
| 4.5 | Oyuncu sayfası | Bir oyuncuya dokun → filmografi → takip et | Sayfa açılır; takip edilenlere eklenir | A i | [ ] |
| 4.6 | Özel afiş (Premium) | Detay → afiş/arka plan seç → kütüphane, liste, profilde bak → varsayılana dön | Seçim her yüzeyde görünür; varsayılana dönünce geri gelir | A i | [ ] |
| 4.7 | Özel afiş (Free) | Free hesapta aynı düğme | Önizlemeli yükseltme sayfası açılır, seçim kaydedilmez | A | [ ] |

## 5. Kütüphane

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 5.1 | İzledim / liste / favori | Bir filmi İzledim, İzleme listesi, Favori yap → Kütüphane | Üç listede de görünür; geri almak kaldırır | A i | ✅ A |
| 5.2 | Bölüm takibi | Bir dizide 3 bölüm işaretle → sezonu tamamla | İlerleme ve "sıradaki" doğru | A i | [ ] |
| 5.3 | Sırala ve filtrele | Kütüphane → listeyi aç → Sırala ve filtrele sayfası | İlk basışta doğal yön; poster kartları ve giriş animasyonu düzgün | A i | [ ] |
| 5.4 | Liste oluştur / paylaş / kopyala | Yeni liste → film ekle → paylaş → arkadaşın listesini kopyala | Liste oluşur; paylaşım kartı; kopya kendi listelerimde | A 2H | [ ] |
| 5.5 | Profilde görünen listeler | Gizlilik → Profilde görünen listeler → birini gizle; Listelerim başlığındaki kilit | Gizlenen liste arkadaş profilinde görünmez | A 2H | [ ] |
| 5.6 | Günlük 1440 dk sınırı | Uzun bir diziyi bugün tümüyle izledim yap | Bölümler geriye doğru günlere yayılır; tek film sığmazsa anlaşılır uyarı | A | [ ] |
| 5.7 | Dört favori | Profil → dört favori seç | Arkadaş profilinde görünür, kendi profilde gösterilmez | A 2H | [ ] |
| 5.8 | Ne izlesem? seçicisi | İzleme listesi → Ne izlesem? | Alt sayfa seçici listeden öneri verir | A | [ ] |

## 6. Hatırlatıcı, takvim, widget

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 6.1 | Hatırlatıcı kur | Yaklaşan bir film → zil → tarih | Afişte zil rozeti; Hatırlatıcılar listesinde | A i | [ ] |
| 6.2 | Bildirim gelir | Yakın tarihli hatırlatıcı kur, uygulamayı kapat | Bildirim zamanında gelir, dokununca detaya gider | A i | [ ] |
| 6.3 | "Yayınlandı" hızlı sil | Yayınlanmış hatırlatıcıyı sil → Geri Al | Onaysız silinir, toast'taki Geri Al geri getirir | A | [ ] |
| 6.4 | Telefon takvimi | Takvime ekle → izin sayfası → izin ver → sil → Geri Al | Etkinlik takvimde oluşur/silinir/geri gelir | A i | [ ] |
| 6.5 | Widget'lar | Ana ekrana widget ekle; Ayarlar → Widget'lar önizlemesi | Widget veri gösterir; önizleme ayarla aynı | A i | [ ] |

## 7. Notlar

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 7.1 | Not ve yapılacaklar | Not ekle; yapılacak listesi → madde ekle | Masonry ızgara düzgün; yeni madde üstte | A i | ✅ A |
| 7.2 | Sekme ve arama | Notlar ↔ Yapılacaklar sekmesi; aramaya yaz | Kayan hap sekme; arama süzer | A | [ ] |
| 7.3 | Free sınırı | Free hesapta 6. notu ekle | Yükseltme sayfası; not eklenmez | A | [ ] |

## 8. Sosyal ve sohbet

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 8.1 | Arkadaş ekle / kabul | A hesabı B'ye istek → B kabul | İkisinde de arkadaş; rozet sayısı güncel | A 2H | ✅ |
| 8.2 | Arkadaşlıktan çıkar | A, B'yi çıkarır | İkisinde de kalkar; 1-1 sohbet silinir | A 2H | ❌ B13 |
| 8.3 | DM + okundu | Mesaj gönder → karşı taraf açar | Okundu işareti yansır; sırası doğru | A 2H | ✅ |
| 8.4 | Eski mesaj sayfalama | 60+ mesajlı sohbette yukarı kaydır | Eski sayfa gelir, konum zıplamaz | A | ⏸ |
| 8.5 | Alıntı (reply) | Mesaja uzun bas → Yanıtla → gönder | Balonda alıntı önizlemesi; dokununca kaynağa gider | A | ✅ |
| 8.6 | Grup sohbeti + sayaç | Grup kur → üye mesaj atar | Okunmamış sayacı artar, açınca sıfırlanır | A 2H | ✅ |
| 8.7 | Sohbete paylaş | Liste / CineMatch cevabı / Hub içeriği → Sohbete gönder | Zengin kart; dokununca içeriği açar | A 2H | ✅ (B16) |
| 8.8 | Görünümümü paylaş | Ayarlar → Görünümümü paylaş → arkadaş bölüm seçip uygular → Geri Al | Ayar canlı uygulanır, Geri Al eski hale döndürür | A 2H | ✅ |
| 8.9 | Davet sonucu sohbete | Düello bitir; CineSwipe eşleşmesi | Sonuç kartı / eşleşme listesi sohbette | A 2H | ⏸ Premium |
| 8.10 | Push (uygulama kapalı) | B uygulamayı kapatır → A DM + grup mesajı atar | B'ye bildirim gelir; dokununca sohbet açılır | P i 2H | ⏸ P |
| 8.11 | Şikâyet + engelle | Kullanıcı profili → Şikâyet et → Engelle | Engellenen mesaj atamaz, listede görünmez | A 2H | ❌ B12 |
| 8.12 | Arkadaşın özel afişi | Premium B bir afiş seçer → A, B'nin profiline bakar | B'nin seçtiği afiş görünür (B Free'ye düşerse varsayılan) | A 2H | ⏸ Premium |
| 8.13 | Zevk uyumu + birlikte izleyelim | Arkadaş profili → Zevk uyumu | Yüzde ve ortak öneriler; liste gizliyse "gizli" der, "boş" demez | A 2H | ⏸ |
| 8.14 | Bildirimler: tümünü okundu | Bildirimler → ✓✓ | Hepsi okunur, rozet sıfırlanır | A | ✅ |
| 8.15 | Sosyal hesaplar | Profili düzenle → sosyal hesap kullanıcı adı → kaydet | Profilde bağlantı doğru adresi açar | A | ⏸ |

## 9. Gönderi ve yorum

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 9.1 | Gönderi oluştur | Paylaş → gönderi yaz → film ekle → paylaş | Akışta görünür; modal temiz kapanır | A i | ✅ |
| 9.2 | Yorum + beğeni | Gönderiye yorum yaz, beğen, beğeniyi geri al | Sayaçlar doğru, tekrar beğeni sayıyı şişirmez | A 2H | ✅ |
| 9.3 | Şikâyet | Başkasının gönderisi → Şikâyet et | Onay; gönderi bu kullanıcıda gizlenir | A 2H | ❌ B15 |

## 10. Eğlence

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 10.1 | Günlük düello | Eğlence → düello oyna → sonuç | Sonuç kartı; aynı gün ikinci kez oynanmaz | A | [ ] |
| 10.2 | Sinema Bingosu | Bingo kartı → kare işaretle | İşaretler kalıcı; satır tamamlanınca kutlama | A | [ ] |
| 10.3 | Önce hangisi? + Günün Sorusu | İkisini de oyna / oy ver | Sonuç ve yüzdeler görünür | A | ✅ A |
| 10.4 | Oyun Merkezi | Oyun seç → `GameSetupSheet` → oyna; Poster Bulmaca | Kurulum sayfası; afişte yazı yok | A | [ ] |
| 10.5 | CineSwipe | Oda kur → arkadaş davet → kaydır → eşleşme | Eşleşme sonucu sohbete gider | A 2H | ⏸ Premium |
| 10.6 | Turnuva | Turnuva aç → oy ver → kupa sayfası | Free yalnız seyirci; kupa metni açık temada okunur | A | [ ] |
| 10.7 | Hub vitrin + Wrapped | Hub kartları → Wrapped şeridi → tam ekran Wrapped | Üst boşluk doğru; Free yalnız bu yıl | A i | [ ] |
| 10.8 | Free kapısı | Free hesapta oyun / CineSwipe | Yükseltme sayfası (limit 0 = kapalı metni) | A | [ ] |

## 11. AI

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 11.1 | AI sohbet | AI düğmesi → soru sor | Cevap gelir; geçmiş bulutta kalır (çıkış/giriş sonrası) | A i | ❌ B9 |
| 11.2 | Kota göstergesi | Free hesapta 3 mesaj gönder | Gösterge 3/3'e iner; 4. mesajda anlaşılır uyarı + yükseltme | A | [ ] |
| 11.3 | Plan yükselince kota | Test hesabına Premium kodu → AI ekranı | Kota yeni plana göre artar (sunucudan) | A | [ ] |
| 11.4 | Detaydan AI eylemi | Film detayı → AI eylem sayfası → bir eylem seç | İlgili soru filmle birlikte gider | A i | ✅ A |

## 12. Premium

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 12.1 | Satın alma | Kapalı test hesabı → Premium → aylık → öde | "Seelogd Premium aktif edildi"; kota ve kapılar açılır | P | [ ] |
| 12.2 | Ödeme alındı ama plan gelmedi | (Webhook gecikmesi) satın al | "Ödemen alındı" bilgisi; yenileyince plan gelir, sahte başarı yok | P | [ ] |
| 12.3 | Premium → Max | Premium hesapta Max'a geç | Plan Max olur; fark doğru | P | [ ] |
| 12.4 | İptal + geri yükleme | Mağazadan iptal; başka cihazda Geri yükle | Dönem sonuna kadar Premium; geri yükleme planı getirir | P | [ ] |
| 12.5 | Davet teklifi (Apple) | iOS'ta davet koduyla satın al, teklif yoksa | "Tam fiyatla devam et" sorusu çıkar | i P | [ ] |
| 12.6 | Kapı sayfaları | Free'de her kilitli özelliğe dokun (simge, kar, ambiyans, pet, oyun, özel afiş, not sınırı) | Hepsi doğru yükseltme sayfasını açar; anahtar açık takılmaz | A | ✅ A |
| 12.7 | Abone çubuğu | Premium hesapta Ayarlar | Çubuk → "Aboneliği yönet" → Kullanım ve haklar | A | [ ] |

## 13. Ayarlar ve kişiselleştirme

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 13.1 | Ayarlara giriş | Profil → dişli | Ayarlar ana ekranı açılır; Debug satırı **yok** (release) | A i | [ ] |
| 13.2 | Tema Stüdyosu | 3 aile × açık/orta/koyu dene; vurgu rengi değiştir | Her ekranda tutarlı; vurgu üstü yazı beyaz | A i | ✅ A |
| 13.3 | Dil değişimi | tr → en → es → pt → de | Tüm ekran metinleri değişir; "Yakında" diller seçilemez | A | ❌ B8 |
| 13.4 | Efektler | Ekran bazında kar/ikon/ambiyans seç | Yalnız seçilen ekranlarda görünür | A | [ ] |
| 13.5 | Bölüm gizle/göster | Bir ekranın bölümlerini gizle | Bölüm kaybolur; geri açınca gelir | A | [ ] |
| 13.6 | Yedekle / geri yükle | Ayarları yedekle → bir ayarı değiştir → geri yükle | Eski ayarlar döner | A | [ ] |
| 13.7 | Kütüphane dışa aktarma | Dışa aktar → JSON, sonra ZIP | Dosya oluşur, paylaş sayfası açılır | A | [ ] |
| 13.8 | Geri bildirim kutusu | Premium: hata bildir; Max: özellik iste; Free: kilit | Gönderilir / yükseltme sayfası | A | [ ] |
| 13.9 | Bildirim izinleri | İzni reddet → ilgili özelliği kullan → sistem ayarlarından aç | Anlaşılır yönlendirme; izin sonrası çalışır | A i | [ ] |
| 13.10 | Profil ve rozetler | Profili düzenle (Kaydet yalnız değişiklikte açık); avatar halesi; rozet ekranı; yıllık hedef | Kaydet doğru zamanda açılır; rozet toast'ı bir kez | A i | ❌ B7 |
| 13.11 | Avatar: Google fotoğrafı | Google hesabıyla girişte fotoğraf kaynağı seç | Taze Google fotosu avatar olur | P | [ ] |

## 14. Dayanıklılık

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 14.1 | Uçak modunda açılış | Uçak modu → soğuk aç | Çökme yok; önbellekten içerik veya anlaşılır çevrimdışı durum | A i | ✅ A |
| 14.2 | Çevrimdışı yaz → senkron | Çevrimdışı izledim + not + hatırlatıcı → ağı aç | Hepsi buluta gider, kaybolmaz, çift kayıt yok | A | ❌ B14 |
| 14.3 | Yazma ortasında öldür | İzledim'e bas, hemen uygulamayı zorla kapat → aç | Kayıt ya tam ya hiç; tutarsız durum yok | A | [ ] |
| 14.4 | Uzun arka plan | Uygulamayı 30+ dk arka planda bırak → dön | Oturum ve sohbet dinleyicileri canlanır, boş ekran yok | A i | [ ] |
| 14.5 | Düşük bellek | `adb shell am send-trim-memory com.smlztrk.seelogd RUNNING_CRITICAL` | Çökme yok; dönüşte ekran yeniden kurulur | A | ✅ A |
| 14.6 | Küçük ekran | 360 dp genişlikte ana akışlar | Taşma, kesik düğme yok | A | [ ] |
| 14.7 | OTA güncellemesi | Önizleme kanalına OTA yayınla → uygulamayı iki kez aç | Yeni JS iner ve uygulanır | P | [ ] |

## 15. iOS'a özgü (yeni iOS build gelince)

| ID | Senaryo | Adımlar | Beklenen | Plt | Durum |
|---|---|---|---|---|---|
| 15.1 | Liquid Glass görünürlüğü | Cam düğmeli ekranları aç, dokunmadan bak | Cam ilk karede görünür | i | ⏸ yeni build |
| 15.2 | Cam çerçevesi ve sekme çubuğu | Sekme çubuğu, ayrık AI düğmesi, cam yüzeyler | Çerçeve yok, %20 ölçek doğru | i | [ ] |
| 15.3 | `SwitchToggle` + klavyede alt sayfa | Ayarlarda anahtarlar; yorum sayfasında klavye aç | Kutu ölçüsü doğru; sayfa klavyeye sığar | i | [ ] |
| 15.4 | Story ekranı + Wrapped | Story oluştur; Wrapped tam ekran | Sayfa olarak açılır; üst boşluk tek kat | i | [ ] |
| 15.5 | Tarih seçici | Kayıtta doğum tarihi | Takvim ızgarası, geri sekme yok | i | [ ] |
| 15.6 | İki Modal sırası | Notlar editöründen yükseltme sayfası; turnuva ağacından paylaş | İkinci sayfa açılır, ekran donmaz | i | [ ] |

---

## T3.3 için parçalar (iPhone, ~15–20 dk)

1. Giriş/tanıtım/açılış: 1.1, 1.4, 1.7, 1.8, 2.1–2.3, 2.5
2. Keşif + detay: 3.1–3.5, 4.1–4.6
3. Kütüphane + hatırlatıcı + notlar: 5.1–5.3, 6.1, 6.2, 6.4, 6.5, 7.1
4. Sosyal (ikinci hesap emülatörde): 8.3, 8.6, 8.10, 9.1
5. Eğlence + AI + ayarlar: 10.7, 11.1, 11.4, 13.1, 13.2, 13.9, 13.10, 14.1, 14.4
6. iOS'a özgü: 15.2–15.6 (15.1 yeni build gelince)

## Önkoşullar

- İki test hesabı (Free) + bir Premium + bir Max test hesabı (promosyon koduyla). Hesap e-postaları ve şifreleri sohbete yazılmaz; seed/örnek yapılandırma dosyasında tutulur.
- Emülatörde dev build kurulu ve Metro 8082'de (hafızadaki "Android emülatörde dev build" notu).
- P satırları için Play kapalı test kanalı ve yeni production AAB (T6 öncesi).
