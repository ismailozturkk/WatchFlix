# T0.2 — Açık uçlar (2026-10-25)

> Rehber: `docs/planlama/YAYIN_ONCESI_TEST_REHBERI.md` › T0.2. Kaynaklar: hafıza notları, `git log`, `firebase functions:list` / `firestore:indexes`, `eas build:list`, canlı site ile `website/` karşılaştırması.
> Bu rapor T3'ün (cihaz) ve T8'in (yayın kapısı) girdisidir.

## Özet

- **Kod:** her şey commit'li (`868fcb9` + `25000b9`), ağaç temiz. Hafızadaki "commit yok / commit edilmedi" notlarının hepsi eskidi.
- **Sunucu:** Firestore kuralları, indeksler ve web sitesi **yayındakiyle birebir aynı**. Fonksiyonlarda 2 kesin ve 7 belirsiz fark vardı; dokuzu da 25 Eki'de yeniden yayınlandı (bölüm 2.3).
- **Gizlilik:** kökteki `email` / `birthDate` göçü bitmedi; gizlilik metni bu verinin "yalnızca sizde" olduğunu söylüyor (bölüm 2.4, **Yüksek**).
- **Build:** Play'deki son mağaza build'i **1.4.6 (24 Eyl)**. iPhone'daki son build 1.4.8 (18 Eki). Kapalı test ve iOS doğrulaması için yeni build şart (bölüm 3).
- **Cihazda görülmemiş:** 14–25 Ekim arasındaki işlerin neredeyse tamamı (bölüm 1, ~45 kalem).

---

## 1. Cihazda doğrulanacaklar (T3'ün girdisi)

Kaynak: hafıza notlarındaki "cihazda görülmedi" işaretleri. **A** = Android emülatörde ajan deneyebilir, **i** = iPhone gerekir, **P** = Play sürümü / gerçek hesap gerekir. Emülatörde zaten doğrulananlar en altta.

### Keşif ve detay
- [ ] Film+Dizi tek sekme, `MediaTypeSwitch`, yanındaki arama düğmesi (A i)
- [ ] Raf başlıkları (19 raf, ortak `SectionHeader`), Dünya Turu rafı, Takip ettiklerinin yaklaşanları (A i)
- [ ] Ne izlesem? (Filtreli Keşif) + Şaşırt beni + yaş sınırı rozeti (A i)
- [ ] Yaklaşan Filmler süzgeci: hazır aralık, ay, özel aralık, sinemada/dijitalde, tür, dil, sıralama (A i)
- [ ] Arama başlığı yenilemesi (cam bölmeli kontrol + keşif çipleri) (A i)
- [ ] Ayar değişince ana ekranın yenilenmesi (yetişkin içerik, platformlar, poster kalitesi) (A)
- [ ] **Özel afiş ve arka plan:** seç, varsayılana dön, kütüphane/liste/profilde görünmesi; Free'de önizlemeli yükseltme sayfası; arkadaş profilinde arkadaşın seçimi (A i, arkadaş için iki hesap)
- [ ] Fragman sayfası, galeri, TV bölüm grafiği ekranı (geri tuşunun yeri) (A i)

### Kütüphane, liste, hatırlatıcı
- [ ] Kütüphane sekmesi; Ayarlar'ın Profil dişlisinden açılması (A i)
- [ ] Liste poster kartı, Sırala ve filtrele sayfası, giriş animasyonu (A i)
- [ ] Ne izlesem? seçicisi (izleme listesi) (A)
- [ ] Profilde görünen listeler ekranı + Listelerim başlığındaki kilit (A)
- [ ] Günlük 1440 dk sınırı (toplu eklemede geriye yayılma) + Hesabı Sıfırla + basılı tut onayı (A)
- [ ] Hatırlatıcı zil rozeti, "Yayınlandı" hızlı silme + Geri Al (A)
- [ ] Takvim: telefona ekle/sil Geri Al, Takvim izni sayfası (A i)
- [ ] Widget'lar ve Ayarlar > Widget'lar önizlemesi (A i)
- [ ] Notlar: masonry ızgara, sekme/arama, yeni madde üstte (A)
- [ ] Yerel öncelikli veri: çevrimdışı not/hatırlatıcı → çevrimiçi senkron (A)

### Sosyal ve sohbet
- [ ] Sohbet mesajı push'u sunucudan (uygulama kapalıyken, DM + grup) (P i) — fonksiyonlar yayında, istemci tarafı yeni build/OTA ile gidecek
- [ ] Okundu işareti, eski mesaj sayfalama, alıntı (reply) (A)
- [ ] Grup okunmamış sayacı (A)
- [ ] Sohbete paylaş (liste, CineMatch cevabı, Hub içerikleri), Görünümümü paylaş (alıcı canlı uygular + Geri Al), davet sonucu sohbete (düello kartı, CineSwipe eşleşmesi) (A, iki hesap)
- [ ] Arkadaşlıktan çıkarınca 1-1 sohbetin silinmesi (A, iki hesap)
- [ ] Bildirimler: Tümünü okundu işaretle (A)
- [ ] Zevk uyumu + Birlikte izleyelim (A, iki hesap)

### Eğlence ve oyun
- [ ] Sinema Bingosu, günlük düello, Önce hangisi?, Günün Sorusu (A)
- [ ] Oyun alanı sadeleştirmesi (`GameSetupSheet`, Oyun Merkezi), Poster Bulmaca yazısız afiş (A)
- [ ] CineSwipe ekranı, Hub vitrin kartları, Turnuva kupa sayfası, Hub Wrapped şeridi + tam ekran Wrapped (A i)

### Profil, ayarlar, kişiselleştirme
- [ ] Dört favori, yıllık hedef halkası, avatar halesi, Profili Düzenle yeniden tasarımı (A i)
- [ ] Avatar seçimi + bağlı Google hesabı fotoğrafı senkronu (P: Google hesabı)
- [ ] Sosyal hesap bağlantıları (A)
- [ ] Rozet kataloğu v3 (154 rozet), rozet toast'ı, rozet ekranı (A)
- [ ] Tema aileleri + üç ton, Tema Stüdyosu (A i)
- [ ] Ambiyans arka planı, ekran bazında efekt seçimi, ekran bölümleri gizle/göster (A)
- [ ] Ayarları yedekle/geri yükle, kütüphane dışa aktarma (JSON + ZIP) (A)
- [ ] Toast sistemi (Modal içi host'lar dahil) (A i)
- [ ] Dil: es / pt / de ekranları ve "Yakında" diller (A)

### Giriş, tanıtım, açılış
- [ ] Tanıtım akışı yeniden tasarımı (A i)
- [ ] Açılış ekranı (kalite kademeleri, logo 288) (A i — logo için yeni build)
- [ ] E-posta doğrulama / şifre sıfırlama tek giriş (`authEmail.js`) (A)
- [ ] Paylaş menüsünden bağlantı açma + simge uzun basma kısayolları (A i)

### iOS'a özgü (iPhone + yeni build şart)
- [ ] Cam (Liquid Glass) dokunana kadar görünmüyordu → `expo-glass-effect` yaması (bölüm 3)
- [ ] Camda çerçeve yok, durum rengi tona geçti
- [ ] Sekme çubuğu %20 ölçek (`tab-bar-scale`), ayrık AI düğmesi
- [ ] `SwitchToggle` kutusu (63×28 tahmini), klavye açılınca alt sayfa sığdırma
- [ ] Story ekranı (sayfa olarak), Wrapped tam ekran üst boşluk
- [ ] Tarih seçici (takvim ızgarası) — Android'de doğrulandı, iOS görülmedi
- [ ] Telefon takvimi (`expo-calendar` 57 nesne API'si)

### Zaten doğrulananlar (tekrar gerekmez, regresyon turunda bakılır)
- Tarih seçici takvim ızgarası, Android buzlu cam — Android emülatörde (23 Eki)
- Premium satın alma → webhook → kota, Premium→Max, iptal — Android cihazda (19 Eyl)
- Premium ve Max promosyon kodları — cihazda (21 Eki)
- Google girişi Play sürümünde (24 Eyl)

---

## 2. Yayın (deploy) durumu

| Parça | Durum | Kanıt |
|---|---|---|
| `firestore.rules` | ✅ yayındakiyle aynı | 23 Eki deploy'undan (`d49193d`) bu yana tek fark `PosterChoices` bloğu; o blok 25 Eki'de yayınlandı |
| `firestore.indexes.json` | ✅ aynı | `firebase firestore:indexes`: 11/11 indeks, 13/13 alan istisnası eşleşti |
| `database.rules.json` (RTDB) | ✅ değişmedi | son değişiklik 3 Eki (`03228da`), presence notunda deploy edildi |
| Hosting (seelogd.com) | ✅ aynı | `website/` altındaki 21 dosyanın hepsi canlı siteyle bayt bayt aynı. Hafızadaki "hosting deploy yok" notları eskidi |
| Cloud Functions | ✅ 9 fonksiyon 25 Eki'de yeniden yayınlandı | aşağıda (2.3) |

### 2.1 Kesin: yayında eski kod

| Fonksiyon | Fark | Etki |
|---|---|---|
| `deleteAccountData` | `accountPurge.js` → `PosterChoices` kökü (`868fcb9`) | Düşük: istemci yedeği belgeyi siliyor |
| `purgeOnAuthUserDeleted` | aynı | Orta: kullanıcı konsoldan veya Auth tarafında silinirse `PosterChoices/{uid}` artık kalır |

### 2.2 Belirsiz: deploy zamanı doğrulanamadı

`firebase functions:list` güncelleme zamanı vermiyor; yalnız kaynak özeti (hash) var. 24 fonksiyon 12 farklı özetle yayında, yani farklı günlerde, farklı kaynak hâllerinden gitmişler.

- `118f38d` (21 Eki, Max promosyon kodu) `writeEntitlements` ve `referral.js`'i değiştirdi. Not "Max promosyon deploy edildi, cihazda çalıştı" diyor ama hangi fonksiyonların gittiğini yazmıyor. Özet grupları `redeemCode` + `claimReferralReward` ile `getReferralOverview` + `cleanupReferralOnUserDeleted`'ın **ayrı zamanlarda** gittiğini gösteriyor.
- Belirsiz 7 fonksiyon: `getReferralOverview`, `cleanupReferralOnUserDeleted`, `redeemCode`, `claimReferralReward`, `expirePromoGrants`, `syncPremiumStatus`, `revenueCatWebhook`.
- Diğerleri güncel: 23 Eki'de 5 bildirim fonksiyonu `d786e11`'den yayına alındı (commit mesajında yazıyor). En eski özet grubundaki 7 fonksiyona (CineRoom temizliği, turnuva, profil güncelleme, giriş uygunluk kontrolleri) 15 Eki'deki tam deploy'dan sonra dokunan bir değişiklik yok (dil eklemeleri yalnız `STRINGS` ve `STREAM_STRINGS`'i değiştirdi; bunları kullananlar 23 Eki'de yeniden gitti).

**Öneri (onay bekliyor):** 2 kesin + 7 belirsiz fonksiyonu tek komutla yeniden yayınla. Kod bugün testten geçti (davet 15/15, hesap silme 4/4 emülatörde). Tam `--only functions` değil, liste:

```bash
export FUNCTIONS_DISCOVERY_TIMEOUT=60 && npx firebase deploy --only functions:deleteAccountData,functions:purgeOnAuthUserDeleted,functions:getReferralOverview,functions:cleanupReferralOnUserDeleted,functions:redeemCode,functions:claimReferralReward,functions:expirePromoGrants,functions:syncPremiumStatus,functions:revenueCatWebhook
```

### 2.3 Yapılan deploy (2026-10-25, kullanıcı onayıyla)

- Yukarıdaki komut `868fcb9` + `25000b9` kaynağıyla çalıştı; 9 fonksiyonun hepsi "Successful update operation", "Deploy complete!".
- Duman testi: `revenueCatWebhook` GET → 405, yetkisiz POST → 401.
- Deploy sonrası günlük taraması: 9 fonksiyonda hata/uyarı yok (yalnız deploy'un kendi denetim kaydı).
- **Özet (hash) kuralı doğrulandı:** gizli anahtarı olmayan ve aynı anda giden fonksiyonlar aynı özeti taşıyor (deploy sonrası `deleteAccountData`, davet fonksiyonları vb. 5'i tek özette). Yani özet = kaynak + gizli anahtar sürümleri; bölge etkilemiyor. Buna göre en eski özet grubundaki 7 fonksiyon (`cleanupDeliveredCineRoom`, `cleanupExpiredCineRooms`, `onTournamentVoteWritten`, `archiveTournamentWinners`, `onUserProfileUpdated`, `check*SignInEligibility`) **eski bir kaynak hâlinden** çalışıyor. Davranışları değişmedi (2.2'deki analiz), ama T8'de "yayındaki = repo" kesinliği istenirse bu 7'si de yeniden yayınlanır. Dikkat: `cleanupDeliveredCineRoom` `retry: true` olduğu için `--force` ister.
- **25 Eki ikinci deploy:** T1.1 düzeltmeleri + bağımlılık güncellemesiyle **24 fonksiyonun tamamı** `--force` ile yayına alındı (`d58811e`); gizli anahtarsız 15 fonksiyon tek özette, eski kaynaktan çalışan 7 fonksiyon kalemi kapandı.
- Yan bulgu (Düşük, T1'e): CLI "`firebase-functions` sürümü eski" uyarısı veriyor. Yükseltme ayrı iş, testle birlikte.

### 2.4 Gizlilik göçü bitmedi (Yüksek)

16 Ekim planı: kök `Users/{uid}` belgesi oturum açmış herkese okunur; `email` ve `birthDate` oradan `Users/{uid}/private/account`'a taşınıyor (`docs/mimari/KULLANICI_OZEL_ALAN_GOCU.md`).

- Yapılan: kurallar yayında (`legacyRootAccountWrites()` = `true`, eski istemci yazabiliyor). Yeni istemci her girişte kendi belgesini tembel göçle taşıyor.
- Yapılmayan: toplu göç betiği (`functions/scripts/migrateAccountPrivate.js --apply`) ve Aşama 3 (anahtar `false` + kural deploy).
- **Çelişki:** canlı gizlilik metni (`website/privacy.html:272`) e-posta ve doğum tarihini "Yalnızca siz" başlığı altında sayıyor. Uygulamayı yeni sürümle hiç açmamış hesaplarda bu iki alan hâlâ kökte ve kendi istemcisini yazan oturumlu bir kullanıcı tarafından okunabilir durumda.
- Kaç hesabın etkilendiği bilinmiyor: ölçmek için betiğin kuru çalışması gerekir (canlı veriyi okur, servis hesabı ister; yerel `sa.json` 21 Eki'de silindi).
- **Önerilen sıra:** 1.4.9 build'i testçilere dağıtılsın → betik kuru çalışma → `--apply` → Aşama 3 → kural deploy. Not: kökten silme, kök `birthDate` okuyan eski sürümlerde yaş kapısını kaldırır; o yüzden önce yeni sürüm.
- Bu kalem T5 sızma raporuna da girecek.

---

## 3. Yeni native build isteyenler

| Platform | Son build | Durum |
|---|---|---|
| Android mağaza (Play) | **1.4.6 / versionCode 4**, `391014b`, 24 Eyl | Bir ay geride. Kapalı testçiler bunu alır. **Kapalı test (T6) öncesi yeni production AAB şart.** |
| Android önizleme (APK) | 1.4.9, `d786e11`, 23 Eki | Android native'i güncel: sonraki tek native değişiklik (`868fcb9`) yalnız iOS cam yaması |
| iOS mağaza | 1.4.8 / build 15, `964a6ed`, 14 Eki | TestFlight/App Store tarafı kurulmadı |
| iOS geliştirme (iPhone'daki) | 1.4.8, `4089c9c`, 18 Eki | Aşağıdaki değişiklikler eksik → **yeni development build şart** |

iPhone'daki build'den sonra gelen native değişiklikler:
- `868fcb9`: `patches/expo-glass-effect+57.0.4.patch` (cam dokunana kadar görünmüyordu)
- `299e798`: Expo paketleri SDK 57 yama sürümlerine
- `6654c51`: `expo-image-picker` kaldırıldı (Android'de CAMERA izni düşer)
- `3ac3365`, `10db3b9`: Almanca ve Portekizce native metinler (izin metinleri, widget'lar)
- `ae38de1`: sürüm 1.4.9

Sürüm notu: `app.json` 1.4.9 hiçbir mağaza build'ine girmedi, yani bir sonraki production build için sürüm artışı **gerekmez** (`runtimeVersion` = `appVersion`). 1.4.9 önizleme APK'ları yalnız iç test kanalında.

Komutlar (onay ister, kuyruk ~10–15 dk):

```bash
npx eas build --profile development --platform ios
```

```bash
npx eas build --profile production --platform android
```

---

## 4. Test için önkoşul panel işleri (kardeş plandan)

- Play kapalı test kanalı + 12+ testçinin kurulumu (C2-8): 14 günlük sayaç ancak testçiler kurunca başlar.
- App Check Play Integrity kaydı (C2-11): T5'te `enforceAppCheck` denemesinin önkoşulu.
- Data Safety formu (C2-14) ve mağaza varlıklarının yüklenmesi (C2-13).

## Kararlar (kullanıcı)

- [x] 2.2: 9 fonksiyonun yeniden yayını — 25 Eki yapıldı (2.3)
- [ ] 2.4: gizlilik göçünün sırası ve servis hesabı ile kuru çalışma
- [~] 3: build'ler — 25 Eki: Android önizleme APK'sı başlatıldı (`7e918a58`, `e675082`; kullanıcı APK istedi). iOS build alınmayacak: aylık iOS derleme kotası doldu, telefondaki 1.4.8 development build kullanılacak → iOS'a özgü native düzeltmeler (cam yaması, SDK 57 yamaları) kota yenilenene kadar cihazda doğrulanamaz. Play kapalı testi için production AAB hâlâ gerekli (T6 öncesi).
