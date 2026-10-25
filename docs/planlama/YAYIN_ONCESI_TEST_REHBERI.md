# YAYIN ÖNCESİ TEST REHBERİ — CLAUDE CODE İÇİN

> Başlangıç: 2026-10-25 · sürüm 1.4.9 · `master` = `868fcb9` (release dalıyla aynı).
> Amaç: yayından önceki son aşamayı (hata kontrolü, özellik denemeleri, yük, sızma, kullanıcı ve A/B testleri) adım adım, oturumlar arasında kaybolmadan yürütmek.
> Kardeş doküman: `docs/planlama/YAYIN_ONCESI_AI_GOREV_PLANI.md` (kod blokerleri ve panel işleri). Bu dosya yalnız **test ve doğrulama** işini kapsar.
> Durum işaretleri: `[ ]` yapılmadı · `[~]` devam ediyor · `[x]` bitti. Görev bitince işaretle, yanına tarih ve tek satır sonuç düş.

---

## 0. UYGULAYICI TALİMATLARI (her oturumda önce bunu oku)

1. **Sıra:** T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8. T1 ile T2 aynı gün paralel yürüyebilir. T6 (kapalı test) takvime bağlı olduğu için T3 biter bitmez başlatılır; T4–T5 onunla paralel ilerler.
2. **Bir görev = bir oturum.** Oturumun başında bu dosyayı ve ilgili görevi oku; bitince işaretle. Uzun görevleri (T3, T5) alt başlık alt başlık ayrı oturumlara böl.
3. **Canlı proje tek:** `movieandtv-2832a` (`.firebaserc`). **Yük testi ve sızma testi CANLIYA YAPILMAZ.** Önce emülatör, gerekirse T0.3'teki ayrı staging projesi. Canlı veriye yalnız okuma amaçlı ve kullanıcı onayıyla dokunulur.
4. **Onay isteyen işler** (kullanıcı "evet" demeden çalıştırma): `firebase deploy`, `eas build`, `eas update`, `eas submit`, staging projesi açmak, ücretli servis veya araç kurmak, kapalı test davetini göndermek, Play/App Store/RevenueCat panel işlemleri.
5. **Bulgu kaydı:** her test fazı bulgularını `docs/test/` altına yazar (klasör ilk bulguda açılır). Dosya adı: `docs/test/<FAZ>_<KONU>_<YYYY-MM-DD>.md`. Bulgu biçimi:

   ```
   ### [ŞİDDET] Kısa başlık
   - Nerede: dosya:satır veya ekran adı
   - Nasıl tekrarlanır: 1-2-3
   - Beklenen / Gerçekleşen:
   - Durum: açık | düzeltildi (commit) | bilerek bırakıldı (gerekçe)
   ```

   Şiddet: **Kritik** (veri sızıntısı, veri kaybı, ödeme, çökme döngüsü) · **Yüksek** (ana akış bozuk) · **Orta** (yan akış bozuk, kötü görünüm) · **Düşük** (kozmetik). Kritik ve Yüksek yayını durdurur (bkz. T8).
6. **Hata bulununca:** önce bulguyu yaz, sonra düzelt. Düzeltmeye mümkünse onu yakalayan bir test ekle (saf mantık `utils/`, testi `__tests__/`). Her düzeltme ayrı commit; commit stili mevcut geçmişe uyar (Türkçe, `fix(alan): ...`).
7. **Ajanın yapamadıkları:** Play Console'u süremez (yerleşik tarayıcıda engelli); kullanıcının fiziksel telefonunu süremez; iOS'u Windows'ta derleyemez. Bu adımlarda ajan kontrol listesini hazırlar, kullanıcı uygular ve ekran görüntüsü gönderir, ajan sonucu kaydeder.
8. **Test hesapları:** gerçek kişisel hesaplar ve gerçek şifreler kullanılmaz. Test kullanıcıları yalnız emülatörde veya staging'de üretilir; canlıdaki test hesapları kullanıcının kendi açtıklarıdır. Kart bilgisi, gerçek ödeme ve CAPTCHA işleri kullanıcıdadır.
9. **DOKUNMA listesi** kardeş dokümandaki gibidir (`enforceAppCheck: false`, `purgeMigratedAsyncStorage`, çift Firebase SDK, kökteki `.npmrc`, `include_adult`, yeni önbellek deposu yok). Test sırasında bunları "düzeltme".
10. **Native değişiklik disiplini:** test sırasında bir native paket eklenirse (ör. T7'deki Remote Config) `app.json` `version` artar, yeni build şarttır. Saf JS düzeltmeleri OTA ile gidebilir.

### Claude Code'da işe yarayan araçlar

| Araç | Ne için | Not |
|---|---|---|
| `/code-review high` | Son yayından bu yana değişen kodda hata avı | T1. Bulguları doğrula, körü körüne uygulama. |
| `/security-review` | Daldaki değişikliklerin güvenlik incelemesi | T5. Kural ve fonksiyon dosyalarında özellikle. |
| Plan modu | Büyük test altyapısı (T4 betikleri, T7 deney katmanı) | Önce plan, sonra kod. |
| Alt ajan (Explore) | Geniş tarama: "hangi koleksiyonun kural testi yok" | Sonucu dosyaya yaz, sohbette bırakma. |
| Yerleşik tarayıcı | Web sitesi, Firebase/Sentry panolarını okuma | Play Console engelli. |
| Expo MCP (bağlıysa) | `build_list`, `build_logs`, `playstore_crashes`, `testflight_crashes`, `observe_metrics` | T6 çökme ve metrik takibi. |
| `/loop` veya zamanlanmış görev | Kapalı testte günlük çökme/geri bildirim özeti | T6. Yalnız okur, rapor yazar; düzeltmeyi ayrı oturum yapar. |

---

## FAZ T0 — HAZIRLIK VE TABAN ÇİZGİSİ

### [x] T0.1 — Tüm otomatik testleri koştur, tabanı kaydet (2026-10-25)

> **Sonuç:** hepsi yeşil, bulgu yok → `docs/test/T0_TABAN_2026-10-25.md`. `868fcb9` üzerinde: birim 349/6782, kural 267, fonksiyon birim 78 (+19 entegrasyon emülatörde 19/19), `expo-doctor` 21/21.

**Adımlar:**
1. `git status` temiz olmalı; `git log -1` = test edilen commit. Rapora yaz.
2. Birim testleri: `npm test`. 2026-10-25 tabanı: **349 suite / 6782 test yeşil**.
3. Kural testleri (Java 21 gerekir; makinenin varsayılanı 17):
   ```bash
   export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" && export PATH="$JAVA_HOME/bin:$PATH" && npm run test:rules
   ```
   2026-10-25 tabanı: **267 test yeşil**.
4. Fonksiyon testleri: `cd functions && npm test` (Node `--test`). Emülatörsüz 19 entegrasyon testi atlanır; onlar kural testleri bittikten sonra (aynı port) şu komutla koşar:
   ```bash
   export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" && export PATH="$JAVA_HOME/bin:$PATH" && npx firebase emulators:exec --only firestore,auth "cd functions && node --test --test-concurrency=1 accountPurge.integration.test.js referral.integration.test.js"
   ```
5. `npx expo-doctor` → 21/21 kontrol geçmeli.
6. `npm run ai:eval` taban testine **girmez**: gerçek modelleri çağıran ücretli bir model karşılaştırmasıdır (`scripts/ai-eval/README.md`). AI istemleri değiştiyse yalnız PLAN kipinde maliyetini gör, gerçek koşuyu kullanıcı onaylar.

**Kabul:** sayılar raporda, kırmızı test yok. Kırmızı varsa önce o düzeltilir.

### [~] T0.2 — "Cihazda görülmedi" ve "deploy edilmedi" listesini çıkar (2026-10-25, kararlar bekliyor)

> **Sonuç:** `docs/test/T0_ACIK_UCLAR_2026-10-25.md`. Kurallar, indeksler, RTDB ve hosting yayındakiyle aynı. Fonksiyonlarda 2 kesin (hesap silme, `PosterChoices`) + 7 belirsiz (davet/ödeme, `118f38d` sonrası) fark → dokuzu 25 Eki'de onayla yeniden yayınlandı, webhook duman testi ve günlükler temiz. Gizlilik göçü (kök `email`/`birthDate`) bitmedi, gizlilik metniyle çelişiyor (Yüksek). Play'deki son build 1.4.6, iPhone'daki 1.4.8: ikisi için yeni build şart. ~45 kalem cihazda görülmedi. Kullanıcı kararları alınınca `[x]`.

**Bağlam:** son haftalarda birçok özellik yalnız testle doğrulandı; bazı sunucu değişiklikleri yayında değil.

**Adımlar:**
1. Hafıza dizinindeki notları ve `git log` mesajlarını tara: "cihazda görülmedi", "deploy EDİLMEDİ", "yeni build şart", "commit yok" geçen her kalemi tek listeye topla.
2. Yayındaki kural dosyasını repodakiyle karşılaştır (Firebase Console > Firestore > Rules geçmişi; kullanıcıdan ekran görüntüsü veya `firebase` CLI ile son yayın zamanı). Fonksiyonlar için: değişen fonksiyonları `git log -- functions/` ile bul, son deploy tarihiyle karşılaştır. 2026-10-25'te bilinen açık: `functions/accountPurge.js` içindeki `PosterChoices` kökü deploy edilmedi (istemci yedeği belgeyi siliyor).
3. Çıktı: `docs/test/T0_ACIK_UCLAR_<tarih>.md` — üç bölüm: **cihazda doğrulanacaklar** (T3'ün girdisi), **deploy bekleyenler** (T8 kapısı), **yeni native build isteyenler** (iOS'taki cam yaması, simge kısayolları, sekme ölçeği vb.).

**Kabul:** liste kullanıcıya gösterildi; deploy kalemleri için kullanıcı kararı alındı.

### [ ] T0.3 — Staging projesi kararı (KULLANICI KARARI)

**Bağlam:** emülatör kural ve mantık testleri için yeterli, ama gerçek gecikme, soğuk başlangıç, kota ve maliyet ölçümü vermez. Yük testi ve sızma testinin canlı ayağı için ayrı bir Firebase projesi gerekir.

**Seçenekler:**
- **A (önerilen):** `seelogd-staging` adında ayrı Blaze projesi + **bütçe uyarısı** (ör. 10 USD). Kurallar, indeksler ve fonksiyonlar oraya deploy edilir; uygulama staging'e `EXPO_PUBLIC_*` ortam değişkeniyle bağlanan ayrı bir EAS profiliyle derlenir.
- **B:** staging yok; yük testi emülatörde sayım (okuma/yazma adedi) düzeyinde kalır, sızma testi emülatör + canlıya yalnız salt-okuma ve oturumsuz denemelerle sınırlanır.

**Ajanın işi:** seçenekleri ve maliyeti anlat, karar al. A seçilirse kurulum adımlarını yaz (proje açma ve faturalandırma kullanıcıda), sonra `firebase use --add` ile takma ad ekle. `.firebaserc`'ye `staging` takma adı girer, `default` canlı kalır.

**Kabul:** karar bu görevin altına yazıldı.

---

## FAZ T1 — STATİK HATA KONTROLÜ (ajan tek başına yapar)

### [x] T1.1 — Kod incelemesi (2026-10-25; fonksiyonlar yayında, istemci build/OTA bekliyor)

> **Durum:** `docs/test/T1_KOD_INCELEME_2026-10-25.md`. Aralık `391014b`→`ede86e2` (903 dosya) risk sırasıyla 5 alanda incelendi: sunucu+kurallar 9, veri katmanı 2, ödeme 2 (+1 ürün notu), giriş/hesap 0, sohbet 1 bulgu. Kritik yok. Düzeltildi: 2.1, 3.1, 3.2, 5.1 (istemci) ve 1.1, 1.3, 1.4, 1.7 (fonksiyonlar, 25 Eki tüm fonksiyonlarla yayına alındı) + fonksiyon bağımlılıkları (0 açık). Bilerek bırakılanlar raporun "Düzeltme durumu" tablosunda.

**Adımlar:**
1. Son mağaza build'inin commit'ini bul (`eas build:list --platform android --limit 5`, commit alanı). İnceleme aralığı: o commit → `HEAD`.
2. `/code-review high` çalıştır. Aralık büyükse alana göre böl: sohbet ve sosyal, kütüphane ve listeler, Premium ve ödeme, Hub ve oyunlar, ayarlar ve hesap.
3. Her bulguyu kodda doğrula; yanlış alarmları ele. Doğrulananları `docs/test/T1_KOD_INCELEME_<tarih>.md`'ye yaz, Kritik ve Yüksekleri hemen düzelt.

### [x] T1.2 — Mekanik taramalar (2026-10-25)

> **Sonuç:** `docs/test/T1_MEKANIK_TARAMA_2026-10-25.md`. **Yüksek, düzeltildi:** Ayarlar'daki "Debug" satırı release'de görünüyordu → `__DEV__` kapısı + bekçi test (`devToolsReleaseGate`). Açık: fonksiyon bağımlılıklarında 15 yamalı açık (`npm audit fix` + tüm fonksiyonların deploy'u önerisi), uygulamada `axios` yükseltmesi, 372 sessiz catch'ten kullanıcı akışındakiler T1.1'e. Tip taraması ve sır taraması temiz.

Her biri ayrı madde olarak rapora:
- **Import ve export:** `__tests__/moduleImports.test.js` `npm test` içinde koşuyor; yeşilse tamam.
- **Tip taraması:** geçici `tsconfig` ile `checkJs`, çıktıyı yalnız TS2304/2551/2305/2554 kodlarına süz (gerisi `createContext()` gürültüsü). Geçici dosyaları sil.
- **Dil:** 5 dil (tr/en/es/pt/de) için yetim anahtar ve kopya bekçileri `npm test` içinde. Ek olarak koddaki ham Türkçe metin taraması: `i18nText` veya kopya tablosu dışından ekrana giden Türkçe karakterli dizgiler.
- **Bağımlılık açıkları:** `npm audit --omit=dev` ve `cd functions && npm audit --omit=dev`. Yalnız üretim bağımlılıkları; Kritik/Yüksek olanları yükseltme planına yaz (yükseltmenin native etkisi varsa `version` kuralı).
- **Sır taraması:** `git grep` ile özel anahtar kalıpları (`-----BEGIN`, `private_key`, `sk_`, `AIza` dışı sunucu anahtarları). `GoogleService-Info.plist`, `google-services.json` ve Firebase web anahtarı istemciye açık olması normal değerlerdir; bulgu sayılmaz. Kökteki `.jks` dosyasının git'te izlenip izlenmediğini kontrol et (`git ls-files "*.jks"`); izleniyorsa **Kritik**.
- **Sessiz catch'ler:** `catch {}` veya yalnız `console.log` yapan bloklar; kullanıcı akışını etkileyenler `captureError`'a bağlanmalı (kardeş dokümandaki D4).

**Kabul:** rapor yazıldı, Kritik/Yüksek kalmadı.

---

## FAZ T2 — OTOMATİK DAVRANIŞ TESTLERİ

### [ ] T2.1 — Ekran duman testi (geçici harness)

**Bağlam:** repoda RN render altyapısı yok. 4 Ekim'de 113 ekranı dolu veriyle render edip tüm `onPress` işleyicilerini tetikleyen geçici bir jest harness'i kuruldu ve gerçek hatalar yakaladı. Yöntem hafızadaki "UI smoke render yöntemi" notunda.

**Adımlar:**
1. Harness'i `zz_smoke_tmp/` + `jest.smoke.tmp.config.js` olarak yeniden kur (`resolver` değil `moduleNameMapper`; firebase taklidi bellek-içi DB, `undefined` alan yazımlarını reddeder).
2. Varyantlar: tr/en × açık/koyu tema × Free/Premium (plan taklidi).
3. Pozitif kontrolle harness'in hata yakaladığını kanıtla.
4. Yakalanan hataları rapora yaz, düzelt. **Harness'i sil** (repoda kalmaz).

**Kanıtlamadıkları:** animasyon, görsel düzen, native modül, gerçek ağ ve kural davranışı.

### [ ] T2.2 — Kural kapsam matrisi

**Adımlar:**
1. `firestore.rules`'taki her `match` bloğunu ve `database.rules.json` köklerini (`presence`, `chatMeta`) listele.
2. Her koleksiyon için `__tests__/rules/` altında şu dört kimlikle test var mı bak: **oturumsuz**, **sahibi**, **başka kullanıcı**, **arkadaş** (arkadaşlığa bağlı koleksiyonlarda). Eksikleri tablo olarak rapora yaz.
3. Öncelik sırasıyla eksik testleri yaz: kişisel veri (`Users/*/private`, `Notes`, `MediaNotes`, `AiConversations`, `Reminders`), mesajlaşma (`chats`, `groups`), ödeme ve kota (`AiUsage`, `RevenueCatWebhookEvents`, `PromoCodes`, `Referral*`), UGC (`Posts`, `*Comment`, `ContentReports`).

**Kabul:** matriste "test yok" hücresi kalmadı ya da gerekçesi yazıldı; `npm run test:rules` yeşil.

### [ ] T2.3 — Callable fonksiyon sözleşme testleri (emülatör)

**Adımlar:**
1. `firebase emulators:exec --only auth,firestore,functions "<test komutu>"` ile fonksiyonları emülatörde ayağa kaldıran bir test dosyası yaz (`functions/*.integration.test.js` deseni).
2. Her `onCall` için en az: oturumsuz çağrı reddedilir; geçersiz girdi `invalid-argument`; başka kullanıcının adına iş yapılamaz; mutlu yol çalışır. Liste: `syncPremiumStatus`, `getReferralOverview`, `redeemCode`, `claimReferralReward`, `deleteAccountData`, `checkGoogleSignInEligibility`, `checkAppleSignInEligibility`, `revokeAppleAuthorization`, `callGemini`, `getExternalRatings`. Dış servis çağıranlarda (Gemini, OMDb, Google tokeninfo, RevenueCat) ağ taklit edilir; gerçek anahtar kullanılmaz.
3. `revenueCatWebhook` (HTTP): POST dışı → 405, yetki başlığı yok veya yanlış → 401, bozuk gövde → 400.

**Kabul:** testler yeşil, `functions` için emülatör komutu bu görevin altına yazıldı.

---

## FAZ T3 — ÖZELLİK DENEMELERİ (cihazda)

**Ortamlar:**
- **Android:** ajan, emülatörde (Pixel_8a, x86_64 debug APK, Metro 8082) `adb` ile ekran görüntüsü alıp dokunarak kendi deneyebilir. Kurulum hafızadaki "Android emülatörde dev build" notunda. Emülatördeki hesap verisini değiştiren düğmelere dokunmadan önce test hesabına geçildiğinden emin ol.
- **iOS:** kullanıcının telefonu, EAS development build. Ajan kontrol listesini verir, kullanıcı uygular ve ekran görüntüsü yollar.
- **Gerçek Android telefon + Play sürümü:** satın alma, Google girişi, push ve widget'lar ancak burada tam doğrulanır.

**Matris (her senaryo için en az bir kez):** Android + iOS · tr + en (bir de es/pt/de'den biri) · açık + koyu · Free + Premium + Max · küçük ekran (≤ 360 dp) · çevrimdışı.
Plan simülatörü (`__DEV__`) yalnız istemci kapılarını değiştirir; sunucu kapıları (AI kotası, arkadaşın özel afişi) için gerçek plan gerekir (test kullanıcılarına promosyon kodu).

### [ ] T3.1 — Kontrol listesini üret

**Adımlar:** T0.2'deki "cihazda doğrulanacaklar" listesi + aşağıdaki çekirdek akışlardan `docs/test/T3_CIHAZ_KONTROL_LISTESI.md` üret. Her satır: senaryo, adımlar, beklenen sonuç, platform, durum kutusu. Satırlar 2–5 adımı geçmesin.

**Çekirdek akışlar:**
1. **Giriş ve hesap:** e-posta kaydı (yaş kapısı, 13 yaş altı red), e-posta doğrulama, Google girişi, Apple girişi (iOS), şifre sıfırlama, çıkış/giriş, Hesabı Sıfırla, hesap silme (sonra aynı e-postayla yeniden kayıt).
2. **Tanıtım:** dil seçimi, atla, tamamla; `onboarding_*` olaylarının gittiği (DebugView).
3. **Keşif:** Film&Dizi sekmesi rafları, arama (film/dizi/kişi), Ne izlesem?, Yaklaşan Filmler süzgeci, Dünya Turu, yetişkin içerik koruması.
4. **Detay:** film/dizi detayı, fragman, galeri, **özel afiş ve arka plan seçimi** (Premium: seç, varsayılana dön; Free: yükseltme sayfası önizlemeli), bölüm grafiği, oyuncu sayfası.
5. **Kütüphane:** izledim/izleme listesi/favori, bölüm takibi, sırala-filtrele, liste oluştur/paylaş/kopyala, profilde görünen listeler, günlük 1440 dk sınırı, dört favori.
6. **Hatırlatıcı ve takvim:** hatırlatıcı kur, bildirim gelir, telefon takvimine ekle/geri al, widget'lar (Android + iOS).
7. **Notlar:** not, yapılacaklar, masonry, arama.
8. **Sosyal:** arkadaş ekle/kabul/çıkar (sohbet silinir), DM, grup sohbeti, okundu işareti, eski mesaj sayfalama, alıntı, sohbete paylaş, ayar paylaşımı, push (uygulama kapalıyken), rozet sayısı, şikâyet et + engelle, arkadaş profilinde **arkadaşın seçtiği afiş**.
9. **Gönderi ve yorum:** gönderi oluştur, yorum, beğeni, şikâyet.
10. **Eğlence:** günlük düello, Bingo, Önce hangisi, Günün Sorusu, CineSwipe (davet + eşleşme sonucu sohbete), turnuva, oyunlar.
11. **AI:** sohbet, kota göstergesi, kota dolunca uyarı, plan yükselince kota artışı.
12. **Premium:** satın alma (Play kapalı test hesabı), Premium → Max yükseltme, iptal, geri yükleme, her Premium kapısının yükseltme sayfası, abone çubuğu.
13. **Ayarlar:** tema stüdyosu, dil değişimi (5 dil), efektler, bölüm gizle/göster, yedekle/geri yükle, kütüphane dışa aktarma, geri bildirim kutusu, bildirim izinleri.
14. **Dayanıklılık:** uçak modunda açılış, çevrimdışı izledim → çevrimiçi senkron, uygulamayı yazma ortasında öldürme, düşük bellek, uzun süre arka planda kalıp dönme, OTA güncellemesinin inmesi.

### [ ] T3.2 — Android emülatör turu (ajan)

Listenin Android satırlarını emülatörde yürüt, her satıra ekran görüntüsü yolu veya kısa sonuç yaz. Bulgular `docs/test/T3_BULGULAR_<tarih>.md`'ye.

### [ ] T3.3 — iOS ve gerçek cihaz turu (kullanıcı + ajan)

Ajan listeyi 15–20 dakikalık parçalara böler; kullanıcı her parçayı uygulayıp ekran görüntüsü gönderir; ajan sonucu işler ve bulguları düzeltir.

**Kabul:** listedeki her satır geçti veya bulgusu yazıldı; Kritik/Yüksek bulgu kalmadı.

---

## FAZ T4 — YÜK TESTİ

**Hedef ölçek:** 10.000 kayıtlı kullanıcı, ~2.000 günlük aktif, en yoğun saatte ~300 eşzamanlı. Sayılar kullanıcıyla teyit edilir; farklıysa aşağıdaki hedefler orantılanır.

**Neyi ölçüyoruz, neyi değil:** TMDB çağrıları istemciden doğrudan gidiyor (her cihaz kendi IP'si), backend yükü değil; onlar için yalnız istemci tarafı önbellek ve hız sınırı davranışı kontrol edilir. Backend yükü = Firestore okuma/yazma, Cloud Functions, RTDB presence, push gönderimi, Gemini proxy.

### [ ] T4.1 — Maliyet modeli (emülatörde sayım)

**Adımlar:**
1. Tipik oturumları tanımla: (a) açılış + Film&Dizi sekmesi, (b) kütüphaneye 3 kayıt, (c) 10 mesajlık DM, (d) 30 kişilik grupta 10 mesaj, (e) arkadaş profili açma, (f) 3 AI mesajı.
2. Uygulamayı emülatöre bağlayıp (veya T2.1 harness'indeki bellek-içi DB'nin sayaçlarıyla) her oturumun okuma, yazma ve fonksiyon çağrısı adedini say.
3. Günlük aktif başına maliyet tablosu çıkar, 2.000 DAU'ya ölçekle; Firestore, Functions, RTDB ve Gemini ücretlerini güncel fiyatlarla hesapla (fiyatları resmi sayfadan doğrula, ezberden yazma).
4. Bilinen sıcak noktaları ayrıca ölç: grup belgesinin üye sayısıyla büyüyen yazımları (hafızadaki "Sohbet ölçek değerlendirmesi" notu), grup mesajı push fan-out'u, `onTournamentVoteWritten`, `onUserProfileUpdated` profil yayılımı.

**Çıktı:** `docs/test/T4_MALIYET_MODELI_<tarih>.md`. **Kabul:** DAU başına maliyet ve en pahalı 3 akış belli.

### [ ] T4.2 — Yük betikleri (staging; T0.3 = A ise)

**Adımlar:**
1. Plan modunda `scripts/load/` tasarla: firebase-admin ile staging'de N test kullanıcısı ve gerçekçi veri tohumlayan betik; client SDK ile oturum açıp senaryoları koşturan sanal kullanıcılar (Node, eşzamanlılık parametreli). Hazır araç gerekirse k6 veya Artillery (kurulum kullanıcı onayıyla).
2. Kademeli yük: 10 → 50 → 150 → 300 eşzamanlı sanal kullanıcı, her kademe 5–10 dakika. Kademe arasında hata oranı ve gecikmeye bak; eşik aşılırsa dur.
3. Ölç: callable fonksiyonların p50/p95 gecikmesi ve soğuk başlangıçları, Firestore yazım çakışmaları (`ABORTED`, sıcak belge), RTDB eşzamanlı bağlantı, zamanlanmış işlerin (`dailyStreamingAvailability`, `weeklyReleaseDigest`) 10.000 kullanıcıyla süresi ve zaman aşımı payı.
4. Test bitince staging'deki tohum veriyi temizle; bütçe panosunu kontrol et.

**Kesin kurallar:** yalnız staging projesi; canlı proje kimliği betiklerde **reddedilir** (betik başında proje kimliği kontrolü). Gemini, OMDb ve RevenueCat gibi dış servisleri yük altında çağırma: staging'de bu fonksiyonlar taklit yanıta bağlanır ya da senaryodan çıkarılır (hem maliyet hem sağlayıcı kuralları).

**Kabul eşikleri (öneri, kullanıcıyla teyit):** 300 eşzamanlıda callable p95 < 1,5 sn (soğuk başlangıç hariç), hata oranı < %0,5, sıcak belge kaynaklı `ABORTED` yok, zamanlanmış işler zaman aşımının yarısından kısa.

### [ ] T4.3 — Sonuçlara göre ayar

Olası düzeltmeler: sık çağrılan fonksiyonlara `minInstances: 1` (maliyetini yaz), grup belgesini bölme, fan-out'u sunucuya taşıma, indeks eksikleri, istemci önbellek süreleri. Her değişiklik ayrı commit, deploy onaylı.

---

## FAZ T5 — SIZMA TESTİ (yalnız kendi uygulamamız)

**Kapsam:** Seelogd uygulaması, kendi Firebase projeleri (önce emülatör, sonra staging), kendi Cloud Functions'ımız. **Kapsam dışı:** TMDB, Google, Apple, RevenueCat, Sentry, OMDb gibi üçüncü taraf servislere yönelik her deneme; canlı projeye yoğun istek; başka kullanıcıların gerçek verisi. Çerçeve: OWASP MASVS (mobil) + Firebase güvenlik kontrol listesi.

### [ ] T5.1 — Tehdit modeli

`docs/test/T5_TEHDIT_MODELI.md`: korunacak varlıklar (e-posta ve doğum tarihi `Users/*/private`, push token'ları, DM ve grup mesajları, notlar, AI geçmişi, Premium hakları, AI kotası, promosyon kodları) × saldırgan profilleri (oturumsuz, oturumlu yabancı, arkadaş, engellenmiş kullanıcı, kendi hakkını yükseltmek isteyen kullanıcı). Her hücre için "hangi kural veya fonksiyon korur" sütunu.

### [ ] T5.2 — Firestore ve RTDB kuralları

T2.2 matrisine **kötüye kullanım** testleri ekle (emülatörde, `@firebase/rules-unit-testing`):
- Kendi `Users` belgesine `entitlements`, `premium`, rozet veya sayaç alanı yazarak hak yükseltme.
- Başkasının listesine, notuna, hatırlatıcısına, `PosterChoices` belgesine yazma veya okuma.
- Katılımcısı olmadığı sohbetin mesajlarını okuma; gruba kendini ekleme; başkası adına mesaj (`senderId` sahteciliği).
- Engellenmiş kullanıcının mesaj veya yorum atabilmesi.
- `Usernames` okumasının açık olması (`read: if true`): kullanıcı adı listelenebiliyor mu, sızan bilgi yalnız uid mi? Risk kabul mü, kısma mı (kardeş dokümandaki D6), karar yaz.
- Boyut ve şekil sınırları: devasa alan, beklenmeyen anahtar, tür değişimi.
- RTDB `presence` ve `chatMeta`: başkasının durumunu yazma.

### [ ] T5.3 — Cloud Functions

T2.3 testlerinin üstüne, her fonksiyon için şu soruları cevapla ve test et:
- **Yetki:** istekteki uid yerine `request.auth.uid` mi kullanılıyor? Başkası adına hesap silme, kod kullanma, ödül alma mümkün mü?
- **`redeemCode`:** kod tahmini için hız sınırı var mı? Aynı kodu iki kez veya iki hesapla kullanma, kendi davet koduyla ödül alma.
- **`callGemini`:** `systemInstruction` istemciden geliyor; kota içinde de olsa uygulama dışı amaçla kullanılabilir. Risk değerlendirmesi yaz; öneri: sunucuda sabit yönerge şablonları, istemci yalnız şablon kimliği gönderir. Kota sayacında yarış (eşzamanlı çağrılarla tavanı aşma) emülatörde dene.
- **`revenueCatWebhook`:** yetki başlığı karşılaştırması sabit zamanlı mı; aynı olayın tekrar gönderimi (idempotency, `RevenueCatWebhookEvents`) güvenli mi.
- **`check*SignInEligibility`:** e-posta numaralandırmaya kapı açıyor mu (yalnız token sahibinin kendi e-postası sorgulanabiliyor olmalı).
- **App Check kapalı:** bilinen ve planlı (D1). Rapor bunu "kabul edilmiş risk, yayın sonrası kademeli açılacak" diye kaydeder; staging'de `enforceAppCheck: true` ile bir tur deneyip istemcinin kırılmadığını doğrulamak faydalı.

### [ ] T5.4 — İstemci ve paket

- Üretim APK'sını aç (`apktool` veya `unzip`), JS paketinde sunucu sırrı ara: yalnız beklenen açık değerler olmalı (Firebase web anahtarı, TMDB anahtarı, Sentry DSN, RevenueCat açık anahtarı). Gemini, OMDb veya servis hesabı anahtarı bulunursa **Kritik**.
- Statik tarama: MobSF ile APK taraması (kullanıcının makinesinde, yerel Docker; yükleme gerektiren çevrimiçi tarayıcılara APK gönderme). Bulguları ayıkla: Expo ve RN kaynaklı genel uyarılar çoğunlukla yanlış alarm.
- Cihazda saklanan veri: MMKV `auth` deposu şifresiz (kardeş dokümandaki D2) — riski kaydet. `adb backup` ve `allowBackup` durumunu kontrol et.
- Derin bağlantılar: `seelogd://` ve paylaş menüsü girdileri doğrulanmadan ekrana veya ağa gidiyor mu; uzun veya bozuk parametreyle çökme var mı.
- Günlükler: üretim build'inde `console.log` ile kişisel veri basılıyor mu; Sentry olaylarında e-posta veya mesaj metni gidiyor mu; Analytics parametrelerinde serbest metin var mı (tasarım gereği olmamalı).
- Ağ: tüm uçlar HTTPS; Android `usesCleartextTraffic` kapalı.

### [ ] T5.5 — Rapor ve kapanış

`/security-review` ile kural ve fonksiyon değişikliklerini son kez tara. `docs/test/T5_SIZMA_RAPORU_<tarih>.md`: her bulgu şiddet, kanıt (test adı), durum. Kritik/Yüksek düzeltilmeden T8 geçilmez; kabul edilen riskler (App Check, `Usernames`) gerekçesiyle listelenir.

---

## FAZ T6 — KULLANICI TESTİ (Play kapalı testi)

**Bağlam:** hesap türü Personal → Play üretime çıkmak için **en az 12 testçinin 14 gün kesintisiz** kapalı testte kalması şart; sayaç testçiler uygulamayı kurunca başlar. 14–15 kişi davet et.

### [ ] T6.1 — Hazırlık (ajan)

- Davet metni (TR + EN): katılım linki, ne beklendiği, süre, geri bildirim yolu. **Gönderim kullanıcıda.**
- Görev senaryoları (5–7 görev, her biri 2–3 dakika): kayıt ol ve 3 film ekle, bir arkadaşla mesajlaş, liste oluşturup paylaş, AI'ya öneri sor, hatırlatıcı kur, bir oyun oyna, Premium sayfasına bak. Her görevin sonunda tek soru: "Zorlandığın bir yer oldu mu?"
- Kısa anket (test sonunda): SUS'un 10 sorusu (TR çevirisi) + 3 açık soru (en çok neyi sevdin, neyi sevmedin, neyi beklerdin).
- Testçilere Premium denemesi: promosyon kodları (hafızadaki "Arkadaş daveti + promosyon kodu" notu), kod listesi kullanıcıda.

### [ ] T6.2 — Günlük takip döngüsü (14 gün)

Günde bir kez (istenirse `/loop` veya zamanlanmış görevle) ajan yalnız **okur ve özetler**:
1. Çökmeler: Sentry + Play Android vitals (Expo MCP `playstore_crashes` bağlıysa). Hedef: çökmesiz kullanıcı oranı ≥ %99,5, ANR ≤ %0,47.
2. Uygulama içi geri bildirim (`Feedback` koleksiyonu): okuma canlı veriye dokunduğu için ilk seferde kullanıcı onayı alınır.
3. Huni (Firebase Analytics): `sign_up` → `onboarding_completed` → `first_content_tracked` → 2. gün dönüşü; `premium_gate_hit` → `premium_upsell_action` → `paywall_view` → `purchase`.
4. Çıktı: `docs/test/T6_GUNLUK_<tarih>.md` (o günün yeni bulguları, öncelik sırası). Düzeltmeyi ayrı oturum yapar; saf JS düzeltmeleri onayla OTA (`eas update --channel production`), native olanlar sonraki build'e.

**Kesin kural:** 14 gün boyunca testçi çıkarma, kanalı durdurma, uygulamayı yayından kaldırma yok (sayaç sıfırlanır).

### [ ] T6.3 — Kapanış raporu

Anket sonuçları (SUS ortalaması; 68 üstü kabul edilebilir), en sık 5 şikâyet, huni oranları, çökme oranı, düzeltilenler ve ertelenenler. Play'e üretim başvurusundaki "test sırasında ne öğrendiniz" sorularının taslağı da buradan çıkar.

---

## FAZ T7 — A/B TESTİ

**Gerçekçi beklenti:** A/B sonucu anlamlı olmak için yeterli kullanıcı ister. Kabaca (α = 0,05, güç %80):
- Tanıtım tamamlama %60 → %66 gibi büyük bir farkı görmek için **varyant başına ~1.000 kullanıcı**.
- Ödeme dönüşümü %5 → %6 gibi küçük bir farkı görmek için **varyant başına ~8.000 kullanıcı**.

Yani 12–15 kişilik kapalı testte A/B **yapılmaz**; yapılırsa sonuç gürültüdür. Doğru sıra: **altyapıyı yayın build'ine koy, deneyleri yayından sonra trafik geldikçe aç.** Altyapı native modül istiyorsa yayından sonra eklemek yeni build ve güncelleme beklemek demek; o yüzden karar yayından önce verilmeli.

### [ ] T7.1 — Altyapı kararı (KULLANICI KARARI)

- **A (önerilen): Firebase Remote Config + Firebase A/B Testing.** Analytics zaten `@react-native-firebase` ile kurulu; A/B Testing paneli hedefleme, istatistik ve kazanan seçimini hazır yapar. Gerekli: `@react-native-firebase/remote-config` native paketi → `app.json` `version` artışı + yeni build. Yayın build'inden önce eklenmeli.
- **B: hafif, native'siz.** uid'den deterministik kova (saf fonksiyon, `utils/`), deney tanımı Firestore'da tek belge (`AppConfig` altında), maruz kalma olayı `experiment_exposure`. İstatistik elle (BigQuery dışa aktarımı veya Analytics karşılaştırmaları). Native build gerektirmez ama analiz yükü bizde.

### [ ] T7.2 — Deney katmanı (karar sonrası, plan modunda)

1. Tek giriş noktası: `services/experiments.js` (sağlayıcıyı saklar) + saf varyant çözümü `utils/experiments.js` + testleri. Çağrı yerleri yalnız `useExperiment("deney_kimligi")` görür; varsayılan değer her zaman mevcut davranış (ağ yoksa veya deney kapalıysa uygulama bugünkü gibi çalışır).
2. Maruz kalma olayı yalnız kullanıcı varyantı **gördüğünde** gider (ekran açılınca değil, ilgili öğe çizilince).
3. `__DEV__`'de varyant zorlama (plan simülatörü gibi), release'de kapalı.
4. Bekçi test: deney kimlikleri tek kayıt dosyasında; kayıtta olmayan kimlik kullanılamaz.

### [ ] T7.3 — İlk deney adayları (yayından sonra, trafik eşiği aşılınca)

| Deney | Birincil metrik | Koruyucu metrik |
|---|---|---|
| Tanıtım adım sayısı (kısa/uzun) | `onboarding_completed` oranı | 7. gün dönüşü |
| Yükseltme sayfası başlığı ve önizleme | `premium_upsell_action` = upgrade | iptal/iade oranı |
| Ödeme ekranında varsayılan plan (aylık/yıllık) | `purchase` | 30 gün iptal |
| İlk içerik ekleme ipucu | `first_content_tracked` | 1. gün dönüşü |

**Kurallar:** her deneyin hipotezi, birincil metriği, süresi (en az 2 tam hafta) ve durma koşulu başlamadan yazılır. Fiyat deneyi istemcide yapılmaz (mağaza kurallarına aykırı); fiyat farkı ancak mağazadaki ürün ve teklif yapılandırmasıyla denenir. Karanlık desen (gizli iptal, sahte geri sayım, yanıltıcı indirim) yok.

---

## FAZ T8 — YAYIN KAPISI (GO / NO-GO)

Ajan aşağıdaki listeyi tek tek doğrular, kanıtını (komut çıktısı, rapor yolu, ekran görüntüsü) yanına yazar ve kullanıcıya sunar. Karar kullanıcının.

- [ ] `npm test`, `npm run test:rules`, `functions` testleri yeşil; sayılar T0 tabanından düşük değil.
- [ ] T1, T3, T5 raporlarında açık Kritik/Yüksek bulgu yok; kabul edilen riskler gerekçeli.
- [ ] Yayındaki `firestore.rules`, `database.rules.json` ve fonksiyonlar repodaki hâliyle aynı (T0.2 listesi kapandı).
- [ ] Kapalı test: 12+ testçi × 14 gün tamam; çökmesiz kullanıcı ≥ %99,5.
- [ ] Yük testi eşikleri geçti veya bilinen sınırlar yazıldı; GCP **bütçe uyarısı** canlı projede kurulu (kullanıcı işi).
- [ ] Firestore yedekleme: zamanlanmış dışa aktarma veya PITR açık (kullanıcı kararı, maliyetiyle).
- [ ] `app.json` `version` ve EAS `versionCode` doğru; native değişiklik varsa `version` artırılmış; `runtimeVersion` politikasıyla OTA uyumlu.
- [ ] Mağaza: liste metinleri, görseller, Data Safety, içerik derecelendirmesi, gizlilik politikası URL'si (kardeş dokümanın C maddeleri).
- [ ] Geri dönüş planı yazılı: Play **aşamalı yayın** (%10 → %50 → %100, her adımda 24–48 saat vitals kontrolü), sorunlu OTA için önceki güncellemeye dönüş (`eas update:republish` veya `eas update:rollback`), fonksiyon için önceki commit'ten yeniden deploy.
- [ ] Yayın günü izleme: ilk 72 saat günde iki kez çökme, hata ve geri bildirim özeti (T6.2 döngüsü yeniden kullanılır).

---

## EK A — HER FAZ İÇİN CLAUDE CODE'A VERİLECEK İSTEM

Yeni bir oturum açıp aşağıdakini yapıştırmak yeterli; oturum bu dosyayı okuyup ilgili görevden ilerler.

```
docs/planlama/YAYIN_ONCESI_TEST_REHBERI.md dosyasının 0. bölümünü ve <GÖREV KODU, ör. T2.2> görevini oku.
Görevi adım adım uygula. Bulguları docs/test/ altına rehberdeki biçimde yaz.
Deploy, build, panel işi veya ücretli araç gerekiyorsa dur ve bana sor.
Bitince görevi [x] işaretle, tarihi ve tek satır sonucu yaz.
```

Bulgu düzeltme oturumu için:

```
docs/test/<RAPOR DOSYASI> içindeki açık Kritik ve Yüksek bulguları sırayla düzelt.
Her düzeltmeye mümkünse onu yakalayan bir test ekle, npm test ile doğrula, ayrı commit at.
Bulgunun durumunu "düzeltildi (commit)" olarak güncelle.
```

## EK B — HIZLI KOMUTLAR

```bash
npm test
```

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" && export PATH="$JAVA_HOME/bin:$PATH" && npm run test:rules
```

```bash
cd functions && npm test
```

```bash
npx expo-doctor
```

```bash
npm audit --omit=dev
```
