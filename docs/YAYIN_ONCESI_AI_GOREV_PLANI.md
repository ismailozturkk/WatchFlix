# YAYIN ÖNCESİ GÖREV PLANI — AI UYGULAYICI İÇİN

> Kaynak: 2026-08-08 tam yayın denetimi (güvenlik + mağaza uyumu + kod sağlığı + i18n taramaları, `npm test`, `expo-doctor`).
> Hedef: Google Play kapalı testine (24 Ağustos 2026) kod tarafında hazır olmak; Play TR yayını 21–25 Eylül 2026 (`docs/YAYIN_VE_GELIR_YOL_HARITASI.md`).
> Durum işaretleri: `[ ]` yapılmadı · `[~]` devam ediyor · `[x]` bitti — görev bitince işaretle ve yanına tarih düş.

---

## 0. UYGULAYICI TALİMATLARI (her oturumda önce bunu oku)

1. **Görevler bağımsız oturumlarda yapılabilir.** Önerilen sıra: A1 → B2 → B3 → B1 → B6 → B4 → B5 → B7 → B8 → B9 → B10. (B2/B3 kural işleri birlikte tek deploy'a girer.)
2. **Satır numaraları 2026-08-08 anlık görüntüsüne aittir.** Koda başlamadan önce satıra güvenme; verilen çapa (anchor) metnini Grep ile ara.
3. **Her görevin sonunda `npm test` çalıştır.** Beklenen taban: 59 suite / 908 test yeşil. Yeni davranış eklediysen test de ekle (saf mantık `utils/` içinde, testi `__tests__/` içinde — mevcut desen: `__tests__/ageGate.test.js`).
4. **Commit stili:** mevcut geçmişe uy — küçük harf, Türkçe, ASCII (ör. `fix: yorum create kurallarina userId baglama`). Tema başına ayrı commit; dev-gürültüsünü commit'e karıştırma.
5. **Kod yorumları Türkçe** yazılır (mevcut gelenek). Yorum yalnız koddan okunamayan kısıtı anlatır.
6. **i18n kuralı:** her yeni kullanıcı metni `i18nText("autoI18n.anahtar", "Türkçe fallback")` ile yazılır ve anahtar **hem** `translations/tr.json` **hem** `translations/en.json`'a eklenir. Sadece birine ekleme; B6'daki bekçi testi bunu yakalayacak.
7. **Alt sayfa/sheet eklerken** projenin `BottomSheetModal` geleneğini kullan (blur yerinde solar, sayfa kayar); RN `Modal` ile yeni tam ekran katman açma. Blur kullanacaksan blur bileşeni `BlurTargetView`'ın **kardeşi** olmalı, içinde değil.
8. **Native değişiklik disiplini (OTA):** `runtimeVersion.policy = appVersion`. Paket ekleme/çıkarma, config plugin veya manifest değişikliği yaptıysan `app.json` içindeki `version`'ı **artır** — yoksa yeni JS, eski native'e OTA ile düşüp çökertir. Yalnız JS değiştiyse `version` sabit kalır.
9. **Deploy'lar kullanıcı onayı ister.** `firebase deploy`, `eas build`, `eas update`, Play/RevenueCat panel işlemleri: değişikliği hazırla, komutu öner, kullanıcı "evet" demeden çalıştırma.
10. **DOKUNMA listesi (bilerek böyle, "düzeltme"):**
    - `functions/index.js` içindeki `enforceAppCheck: false` — yayın sonrası aşamalı açılacak (bkz. D1). Erken açılırsa sahadaki eski build'ler kırılır.
    - `purgeMigratedAsyncStorage()` çağrılmıyor — bilerek bir sürüm bekliyor; `@react-native-async-storage` bağımlılığı da bu yüzden duruyor.
    - Çift Firebase SDK (web `firebase` + `@react-native-firebase/{app,analytics,app-check}`) bilinçli bir ayrım; birleştirme deneme.
    - Kökteki `.npmrc` (`legacy-peer-deps`) EAS build'i ayakta tutuyor; silme.
    - `include_adult` parametresini hiçbir çağrı yerine elle yazma; izin kararı `utils/ageGate.js → adultContentAllowed()` + `utils/tmdbAdultGuard.js` interceptor'ında.
    - Firestore verisi için yeni önbellek deposu açma; `cacheStore` + `cacheKeys` kullan ("Verileri indir" bağı kopmasın).

---

## FAZ A — DAL TOPARLAMA

### [x] GÖREV A1 — Bekleyen işi commit'le, master ile birleşmeyi öner (2026-08-08)

> **Sonuç:** ağaç temiz, 59 suite / 908 test yeşil, altı tema ayrı commit'te:
> `d166ed2` yaş kapısı + yetişkin süzgeci · `1573468` yorum alt sayfası ·
> `96b0e39` "benzerler" rayı · `d3f3adc` sohbet giriş çubuğu ·
> `8e1d4bd` TV grafik ızgara boşluğu · `1320ecb` bu doküman.
> Plandaki "MMKV kayıt eklemesi" teması ayrı çıkmadı: `registry.js`'teki tek
> değişiklik `ageRestricted` anahtarıydı, yaş kapısı commit'ine girdi. Buna
> karşılık planda olmayan iki tema çıktı (sohbet composer'ı — ChatScreen'in
> yanında iki `AIChatScreen` kopyası da; TV grafik ızgarası).
> **Bekleyen:** master'a birleştirme + push — kullanıcı onayı bekliyor.

**Bağlam:** `checkpoint/oyun-ve-bekleyen-isler-2026-06-26` dalı master'dan 60 commit ileride ve 29 dosya + 5 yeni dosya commit'lenmemiş. İçerik denetlendi: yarım iş değil, biten işlerin commit'i atılmamış.

**Adımlar:**
1. `git status` ile listeyi doğrula; beş temaya ayır ve **ayrı commit'ler** at:
   - Yaş kapısı + TMDB yetişkin süzgeci: `utils/ageGate.js`, `utils/tmdbAdultGuard.js`, `components/auth/BirthDateField.js`, iki test dosyası, `RegisterScreen`/`GoogleProfileCompletionScreen`/`EditProfileScreen`, `AppSettingsContext`, `UserProfileContext`, `translations/*`, `App.js`, servis dosyalarındaki `include_adult` temizlikleri.
   - Yorum sheet z-katman düzeltmesi: `components/Comment.js`, `components/comments/CommentScopeSheet.js`, `components/modals/CommentSheetModal.js`, `components/modals/PostCommentSheetModal.js`.
   - "Benzerler" rayının kaldırılması: `screens/movie/MovieDetail.js`, `screens/tv/TvShowsDetails.js` (yalnız bu temaya ait hunk'lar).
   - Chat input ortalama: `screens/chat/ChatScreen.js`.
   - MMKV kayıt eklemesi: `services/storage/registry.js` ve kalan dosyalar.
   Dosyalar temalar arasında çakışıyorsa `git add -p` ile hunk seçerek ayır; ayrışmıyorsa iki temayı tek commit'te birleştirip mesajda belirt.
2. `npm test` → yeşilse commit'leri at.
3. Kullanıcıya master'a birleştirme + push önerisi sun (**onaysız push yapma**). Sürüm build'i bu daldan değil, birleştirilmiş master'dan kesilmeli.

**Kabul:** `git status` temiz; testler yeşil; her commit tek temayı anlatıyor.

---

## FAZ B — KOD BLOKERLERİ

### [x] GÖREV B1 — Çift `AIChatScreen`'i tek bileşende birleştir (2026-08-08)

> **Sonuç:** `672bcf1`. Tek dosya kaldı (`screens/chat/AIChatScreen.js`, +83 satır);
> `screens/AIChatScreen.js` silindi (-942). Üç giriş noktası da aynı bileşeni kullanıyor
> (`ChatModal`, `MovieDetail`, `TvShowsDetails`). Prop imzası aynı kaldığı için JSX'e
> dokunulmadı. `npm test` 59/908 yeşil.
>
> **i18n adımı gerekmedi:** taşınan blokta (startPromptChat + iki efekt) kullanıcıya
> görünen metin yok; ham Türkçe fallback'ler zaten silinen kopyadaydı. `AICineChat`
> anahtarlarının tamamının iki pakette de bulunduğu ayrıca doğrulandı — koddaki
> `t?.AICineChat?.X || "..."` fallback'leri erişilemez durumda.
>
> **⚠ MANUEL DOĞRULAMA (dev build'de yapılmalı, kod tarafı bitti):**
> 1. Film detayı → "AI'ya sor" → panel açılır, başlık satırında **kota göstergesi** yazar
>    (eskiden bu akışta "Film & dizi asistanı" yazıyordu).
> 2. `initialPrompt` ilk mesaj olarak kendiliğinden gider; baloncukta yapım kartı iliştirilmiş
>    görünür ve balonda ham yönerge değil kısa metin yazar.
> 3. Panel kapatılıp **aynı yapım için** tekrar "AI'ya sor" → sohbet yeniden başlar
>    (initialPromptRef sıfırlaması bunun içindi).
> 4. Dizi detayında aynısı; FAB/pet akışı bozulmamış olmalı.

**Bağlam:** İki canlı kopya var ve ayrışmış durumda:
- `screens/chat/AIChatScreen.js` → giriş noktası `components/modals/ChatModal.js` ("`ChatModal.js:66`", pet/FAB akışı). Kota UI'sı var (`AI_PLAN_LIMITS`, `usePremium`, `quotaText`), tamamı `i18nText` sarılı. Prop'ları `{ visible, onClose, fabOrigin }`.
- `screens/AIChatScreen.js` → giriş noktaları `screens/movie/MovieDetail.js` ve `screens/tv/TvShowsDetails.js` (`../AIChatScreen` import'u, "bu yapım hakkında sor" akışı). `initialPrompt` / `initialDisplay` / `initialAttachment` / `startPromptChat` var; **kota UI'sı yok**, ham Türkçe fallback'ler var (ör. `"Ne izleyeceğine birlikte karar verelim"`).

**Adımlar:**
1. `screens/chat/AIChatScreen.js`'i temel al. `screens/AIChatScreen.js`'ten SADECE `initialPrompt`/`initialDisplay`/`initialAttachment` prop'larını ve `startPromptChat` akışını taşı (iki dosya arasında `git diff --no-index` ile farkı çıkar; ~217 satır).
2. Taşınan akıştaki Türkçe metinleri `i18nText` + çift pakete anahtar ile yerelleştir.
3. `MovieDetail.js` ve `TvShowsDetails.js` import'larını `screens/chat/AIChatScreen`'e çevir; prop geçişlerini yeni imzaya uyarla.
4. `screens/AIChatScreen.js`'i **sil**. `Grep "screens/AIChatScreen"` ve `Grep "\.\./AIChatScreen"` → 0 sonuç olmalı.
5. Manuel doğrulama notu bırak: film detayından "AI'ya sor" → sohbet açılır, başlık kota göstergesini basar, `initialPrompt` ilk mesaj olarak gider.

**Kabul:** tek dosya kaldı; iki giriş noktası da çalışıyor; kota göstergesi her iki akışta görünür; EN'de Türkçe metin kalmadı; testler yeşil.

### [x] GÖREV B2 — Firestore kural düzeltmeleri (4 açık + birthDate kilidi) (2026-08-08, DEPLOY EDİLDİ)

> **Sonuç:** dört açık da kapandı — `226db20` (kurallar + istemci), `ee1980b` (28 emülatör testi).
> `npm run test:rules` ile koşuyor (Firestore emülatörü + **JDK 21+** ister; JAVA_HOME 17'yi
> gösteriyorsa firebase-tools 15 başlamaz). `npm test` tabanı değişmedi: 59/908.
>
> **Plandan iki sapma:**
> 1. **DM `delete` gönderene bağlanmadı, üye bazında kaldı.** Planın 3. adımı update+delete'i
>    `senderId`e bağlıyordu; hesap silme purge'u (`services/accountService.js`) sohbeti
>    boşaltırken karşı tarafın mesajlarını da siliyor — bağlansaydı silinen hesabın sohbetleri
>    asla temizlenemez, kişisel veri artığı kalırdı. Gerekçe kurala yazıldı; D7 (sunucu
>    süpürücüsü) gelince gönderen şartına inecek.
> 2. **DM `update` "yalnız gönderen" olamazdı.** Üç meşru güncellemenin ikisi karşı tarafın
>    dokümanına dokunuyor (alıcı "seen" makbuzu yazıyor, anket oyu karşı tarafın mesajına
>    gidiyor). Alan bazlı ayrım yapıldı — planın naif hâli DM'leri kırardı.
>
> **Ratings** planın önerdiği "±1 / 0-10 aralığı" yerine daha sıkı kuruldu: yazım kullanıcının
> kendi oy dokümanının aynı commit'teki değişimiyle `getAfter` üzerinden birebir doğrulanıyor.
> Karşılığı: agregatı bozuk kalmış bir doküman olursa o içerik puanlanamaz (konsoldan onarılır).
>
> **Deploy:** B3 ile birlikte yapıldı (2026-08-08) — önce functions, sonra `firestore:rules`.
> Kurallar hatasız derlendi ve yayına alındı.

**Bağlam:** Kurallar genelde sağlam (varsayılan-red, sayaç ±1 kısıtları, chat üyeliği düzeltilmiş) ama dört yazma açığı var. Hepsi `firestore.rules` içinde; mevcut yardımcılar `counterOk()` (~satır 18) ve `isChatMember()` (~satır 25) desen olarak kullanılabilir.

**Adımlar:**
1. **Yorum create'lerine kimlik bağla.** ~375, 383, 393, 401 satırlarındaki dört `allow create: if isSignedIn();` kuralına (film/dizi yorum koleksiyonları) şunu ekle: `&& request.resource.data.userId == request.auth.uid`. Referans doğru örnek: Posts create kuralı (`authorId == request.auth.uid`, ~satır 428).
2. **`/Ratings/{mediaKey}` agregatını kısıtla.** ~satır 415 `allow create, update: if isSignedIn();` → alan listesi + delta kısıtı: `count` ve `sum` yalnız kullanıcının kendi `userRatings/{uid}` yazımıyla tutarlı artabilsin (Posts'taki `counterOk()` yaklaşımı; pratik çözüm: create'te `count == 1`, update'te `count == resource.data.count + 1 || count == resource.data.count - 1 || count == resource.data.count` ve `sum` değişimini 0–10 aralığıyla sınırla).
3. **DM mesajlarına gönderen bağla.** ~satır 532 `allow read, write: if isChatMember(chatId);` → parçala: `read` aynı; `create`'e `request.resource.data.senderId == request.auth.uid`; `update`/`delete`'e `resource.data.senderId == request.auth.uid`. Pins bloğu (~536-550) desen olarak zaten doğru.
4. **`birthDate` kilidi.** `Users/{uid}` update kuralına (~satır 174 bloğu): `birthDate` bir kez yazıldıktan sonra değiştirilemesin — `!("birthDate" in resource.data) || request.resource.data.birthDate == resource.data.birthDate`. (Boş/eski hesaplar ilk kez yazabilir; sonrası kilit. `EditProfileScreen`'deki doğum tarihi alanını da "doluysa salt-okunur" yap ve kullanıcıya destek e-postası yolunu göster.)
5. Mümkünse `@firebase/rules-unit-testing` ile 4 vakayı kapsayan emülatör testi yaz (opsiyonel ama önerilir; yoksa değişimin manuel matrisini PR açıklamasına yaz).
6. **Deploy'u kullanıcı onayıyla yap:** `firebase deploy --only firestore:rules`.

**Kabul:** dört açık kapandı; mevcut meşru akışlar (yorum yazma, puanlama, DM) bozulmadı; kurallar deploy edildi (onay sonrası).

### [x] GÖREV B3 — Expo push token'larını gizli alt koleksiyona taşı (2026-08-08, DEPLOY EDİLDİ)

> **Sonuç:** `48c281a`. Token'lar `Users/{uid}/private/push`'ta; kural + istemci göçü +
> iki sunucu tüketicisi fallback'li. 5 kural testi daha eklendi (toplam 33 yeşil).
>
> **Planın üstüne çıkan üç şey:**
> 1. **Hesap silme purge'una `private` alt koleksiyonu eklendi** (`services/accountService.js`).
>    Planda yoktu; olmasa hesap silindikten sonra token artığı kalır ve o cihaza bildirim
>    gitmeye devam ederdi — hesap silme uyumluluğunu deler.
> 2. **`dailyStreamingAvailability`'de sıra değişti:** sağlayıcı kontrolü token okumasının
>    önüne alındı. Token artık ayrı doküman = her kullanıcı için ekstra okuma, bu fonksiyon
>    da her gün tüm kullanıcıları geziyor.
> 3. `pushNotificationsService` başlığındaki bayat "backend yok" yorumu düzeltildi —
>    **B9 adım 3 bu yüzden zaten yapılmış durumda.**
>
> **Fallback'in kaldırılacağı sürüm:** `app.json version` 1.5.0 (yani 1.4.x sahadan düşünce).
> `functions/index.js` içinde "GEÇİŞ" olarak işaretli bloklar + kök dokümana yazan ölü token
> temizliği silinecek.
>
> **Deploy (2026-08-08, sırasıyla yapıldı):**
> 1. ✅ `firebase deploy --only functions` — 8 fonksiyon güncellendi (fallback'li sunucu önce
>    gitti, sahadaki eski istemciler bozulmadı).
> 2. ✅ `firebase deploy --only firestore:rules` — B2 + B3 kuralları birlikte.
> 3. ⏳ İstemci sürümü / OTA — sürüm build'i kesildiğinde.
>
> **Kalan uyarı:** deploy çıktısı `firebase-functions` sürümünün eskidiğini bildirdi
> (`npm install --save firebase-functions@latest`). Bu görevin kapsamında değil, B10'un
> bağımlılık eşitleme adımına bakılabilir.

**Bağlam:** `services/pushNotificationsService.js` (~193-202) token'ı `Users/{uid}.expoPushToken` + `expoPushTokens`'a yazıyor; `Users` ise tüm oturumlulara okunur → herhangi bir kullanıcı tüm token'ları dökebilir ve Expo push ucu üzerinden herkese sahte bildirim atabilir.

**Adımlar:**
1. Yeni yol: `Users/{uid}/private/push` dokümanı (`expoPushToken`, `expoPushTokens`, `updatedAt`). `firestore.rules`'a ekle: `match /Users/{uid}/private/{docId} { allow read, write: if request.auth != null && request.auth.uid == uid; }`.
2. İstemci: `pushNotificationsService` yazımını yeni yola çevir; başarılı yazım sonrası eski alanları `deleteField()` ile `Users/{uid}`'den temizle (kendi kendini göç ettirme).
3. Sunucu: `functions/index.js` içindeki iki tüketiciyi güncelle — `onSocialNotificationCreated` (~616) ve `dailyStreamingAvailability` (~1180). **Geçiş sırası:** functions önce YENİ yolu okusun, boşsa ESKİ alana düşsün (fallback); tüm istemciler güncellenene dek fallback kalsın (Admin SDK kural tanımaz, sorun çıkmaz). Fallback'in kaldırılacağı sürümü yorumla işaretle.
4. Deploy sırası (kullanıcı onayıyla): önce functions (fallback'li), sonra rules, sonra istemci sürümü/OTA.

**Kabul:** yeni token'lar `private/push`'a yazılıyor; `Users` dokümanında token kalmıyor (aktif kullanıcılarda kendiliğinden temizleniyor); push bildirimleri iki fonksiyondan da gitmeye devam ediyor.

### [ ] GÖREV B4 — Şikâyet Et + Engelle: UI ve filtreleme (Apple 1.2 / Play UGC) (~2-3 gün, en büyük parça)

**Bağlam:** Şikâyet yalnız gönderilerde var (`services/postsService.js → reportPost`, `PostReports` koleksiyonu). Yorum ve DM/grup mesajı için şikâyet yolu YOK (`components/Comment.js` ~359: menü yalnız `isOwn`'da). Engelleme servis+context'te hazır (`services/friendsService.js → blockUser/unblockUser/getBlockedUsers`, `context/FriendsContext.js` ~186-209 `block/unblock`) ama **hiçbir ekran kullanmıyor ve hiçbir akış filtrelemiyor**.

**Adımlar:**
1. **Veri:** genel `ContentReports` koleksiyonu: `{ type: 'comment'|'message'|'user', targetPath, targetPreview (ilk ~200 krk), targetUserId, reporterId, reason, createdAt }`. Kural, `PostReports` deseninin aynısı (~495): `create` yalnız `reporterId == request.auth.uid`; `read/update/delete: if false`. `PostReports`'a dokunma.
2. **Servis:** `services/reportService.js` → `reportComment(...)`, `reportMessage(...)`, `reportUser(...)`; hepsi `ContentReports`'a yazar. Saf doğrulama (tip/uzunluk) ayrı fonksiyonda, testli.
3. **Yorum UI:** `Comment.js`'te `...` menüsünü `isOwn` DEĞİLKEN de göster; seçenekler: "Şikâyet et" (sebep seçimli `BottomSheetModal`) + "Kullanıcıyı engelle". Şikâyet sonrası toast.
4. **Mesaj UI:** `screens/chat/ChatScreen.js` uzun-basma eylem sayfasına (~2690-2745, mevcut Edit/Delete/Pin/Copy) karşı tarafın mesajları için "Şikâyet et" ve "Kullanıcıyı engelle" ekle.
5. **Profil UI:** `screens/tabs/profile/FriendProfileScreen.js`'e "Engelle/Engeli kaldır" (onay diyaloglu) + "Şikâyet et" ekle; context'ten `block/unblock`'u destructure et (~310-318'deki listeye).
6. **Filtreleme (engelin etkisi):** `FriendsContext`'ten engellenen uid set'ini al ve şu yüzeylerde süz: feed gönderileri (`context/PostsContext.js`), yorum listeleri (`Comment.js` render), sohbet listesi + yeni DM başlatma engeli, arama sonuçları (`SearchFriendsScreen`). Süzme istemci tarafında yeterli (mağaza şartı "kullanıcı görmesin"; sunucu kuralı şart değil).
7. **Engellenenler listesi:** Ayarlar → Gizlilik altına basit "Engellenen kullanıcılar" ekranı (`getBlockedUsers` + engel kaldır) — App Review'da gösterilebilir olması için.
8. i18n: tüm yeni metinler çift pakete.

**Kabul:** başka kullanıcının yorumunda/mesajında/profilinde şikâyet + engelle erişilebilir; engellenen kullanıcının gönderi/yorum/mesajı görünmez ve yenisi başlatılamaz; engel listesi ekrandan yönetilebilir; `ContentReports` create-only; testler yeşil.

### [ ] GÖREV B5 — Yasal bağlantılar: paywall + kayıt ekranları (~2 saat)

**Bağlam:** Yasal URL'ler uygulamada tek yerde: `screens/tabs/settings/AboutAppScreen.js` (~42). Apple 3.1.2: abonelik satın alma noktasında Kullanım Koşulları (EULA) + Gizlilik linki zorunlu. Kayıtta ne link ne onay ifadesi var; gizlilik politikası KVKK/GDPR metni olarak yazılmış ama kayıtta hiç görünmüyor.

**Adımlar:**
1. URL'leri `utils/legalLinks.js`'e çıkar (`https://seelogd.com/privacy.html`, `terms.html`, `delete-account.html`); `AboutAppScreen` buradan okusun.
2. `screens/premium/PremiumScreen.js`: yenileme açıklamasının (~1597-1601) altına iki dokunulabilir link ("Kullanım Koşulları" · "Gizlilik Politikası") — `expo-web-browser` ile aç (paket kurulu).
3. `RegisterScreen.js` ve `GoogleProfileCompletionScreen.js`: kayıt butonunun üstüne "Kayıt olarak Kullanım Koşulları'nı ve Gizlilik Politikası'nı kabul etmiş olursun" satırı, iki kelime link. (Onay kutusu şart değil; metin + link yeterli. KVKK açık rıza gerektiren opsiyonel işlemler — ör. pazarlama — eklenirse o zaman ayrı kutu.)
4. RevenueCat panelindeki hazır paywall'un footer linkleri panelden ayrıca doğrulanacak → FAZ C'ye not düşüldü (C2).
5. i18n: yeni metinler çift pakete.

**Kabul:** paywall'da ve iki kayıt ekranında çalışan linkler; EN+TR; testler yeşil.

### [ ] GÖREV B6 — EN yerelleştirme onarımı: 87 yetim anahtar + cihaz dili + ham metinler (~1-2 gün)

**Bağlam:** Çeviri dosyaları eşit (2102/2102) ama koddan çağrılan **87 anahtar iki pakette de yok**; `fallbackLng: "tr"` + `i18nText(key, türkçeFallback)` deseni yüzünden bunlar EN kullanıcıya sessizce Türkçe basıyor. En kötüler: `WidgetSettingsScreen` (36 — `copy()` sarmalayıcısı `` `autoI18n.${key}` `` şablonuyla çağırıyor), `PosterSettingsScreen` (14), `PersonalizationScreen` (8). Ayrıca cihaz dili hiç algılanmıyor (varsayılan `tr`, `services/storage/registry.js` ~59) — her yabancı kullanıcı uygulamayı Türkçe açıyor.

**Adımlar:**
1. **Bekçi testi yaz (kalıcı çözüm):** `__tests__/i18nKeys.test.js` — kaynak ağacını (`screens/ components/ context/ services/ utils/ App.js`) tarar, şu desenlerden anahtar çıkarır: `i18nText("autoI18n.X"`, `t("autoI18n.X"` ve `WidgetSettingsScreen`'deki `copy("X"` (şablon `autoI18n.${key}` sarmalayıcısı — dosyaya özel kural). Çıkan her anahtar `tr.json` VE `en.json`'da yoksa test kırmızı; eksik listesi mesajda. (İskele: `fs.readdirSync` + regex; Jest node ortamında çalışır.)
2. Testin ilk çıktısındaki eksik listesini (≈87) iki pakete ekle — TR değeri koddaki fallback'ten, EN değeri çevirisinden. Çeviriler mevcut `en.json` üslubuyla (kısa, düz) yazılır.
3. **Ham metin düzeltmeleri:**
   - `components/modals/MediaQuickActionsSheet.js` ~549: `` `${kindLabel} ${listLabel(listType)} listesine eklendi!` `` → 8 satır üstteki `media_removed_from_list` deseninin aynısı (`autoI18n.media_added_to_list`, `{{media}} {{list}}` interpolasyonlu, çift pakete).
   - `screens/story/StoryDraftsScreen.js` ~62: `autoI18n.taslak_sil_onay` fallback'i bozuk (`"\\"`) — gerçek onay metni + çift paket anahtarı.
   - Kullanıcıya ham hata basan 4 toast: `App.js` ~261, `screens/movie/MovieDetail.js` ~373, `screens/lists/ListsScreen.js` ~420, `context/PostsContext.js` ~401 → genel "İşlem tamamlanamadı" anahtarı + `captureError(e)` ile Sentry'ye ham hata.
   - `services/dataDownloader.js` ~561: `onProgress?.(1, "Tamam")` → mevcut `autoI18n.tamam` anahtarını kullan.
4. **Cihaz dili algılama:** `npx expo install expo-localization` → `translations/index.js`'teki detector'da MMKV'de kayıtlı dil YOKSA `getLocales()[0].languageCode === "tr" ? "tr" : "en"` kullan; ilk seçim MMKV'ye yazılsın (tek-sahip yazım kuralına uy: yazan `AppSettingsContext` kalsın, detector yalnız okusun + ilk açılış değerini üretsin). **Native paket eklendi → `app.json version`'ı artır (talimat 8).** `fallbackLng: "tr"` kalabilir — bekçi testi varken eksik anahtar sınıfı zaten build'de yakalanıyor.
5. `npm test` — bekçi testi dahil yeşil olana kadar eksikleri kapat.

**Kabul:** bekçi testi var ve yeşil (0 yetim anahtar); EN'de bilinen Türkçe sızıntı ekranları (WidgetSettings/PosterSettings/Personalization/Settings) İngilizce; yeni cihazda ilk açılış dili cihaz dilinden; `version` artırıldı.

### [ ] GÖREV B7 — Asgari kayıt yaşı (~2 saat) — ⚠️ ÖNCE KULLANICI KARARI

**Bağlam:** Doğum tarihi zorunlu ama yaş sınırı yok — `RegisterScreen.js` ~95'te "18 altı kaydı engellemez" bilinçli notu var. DM'li/UGC'li uygulamada asgari yaş olmadan IARC ve Play hedef-kitle beyanı tutarsız kalır (COPPA riski).

**Adımlar:**
1. **Kullanıcıya sor: asgari yaş kaç? (öneri: 13).** Karar gelmeden kod yazma; karar mağaza formlarına da girecek.
2. `utils/ageGate.js`'e `MIN_REGISTER_AGE` + `canRegister(birthDate, now)` (saf) ekle; `__tests__/ageGate.test.js`'e sınır vakaları (tam bugün 13, bir gün eksik, artık yıl).
3. `RegisterScreen.js` `canSubmit` (~92-101) ve `GoogleProfileCompletionScreen.js`'e bağla; reddedilen kullanıcıya nazik, suçlamayan metin (çift paket). Google-tamamlama reddinde oluşan yarım hesabı temizle (mevcut yetim-hesap temizliği desenini kullan, `RegisterScreen.js` ~254-256).
4. `birthDate` değiştirilemezliği B2 adım 4'te kurala bağlandı — bu görevle birlikte doğrulanmış olur.

**Kabul:** sınır altı doğum tarihi iki kayıt yolunda da kaydı tamamlayamıyor; testler yeşil; karar değeri bu dosyaya not edildi.

### [ ] GÖREV B8 — Android izin bloğu temizliği (~30 dk)

**Bağlam:** `app.json` ~29-40 çelişkili: `permissions` içinde `READ_EXTERNAL_STORAGE` + `WRITE_EXTERNAL_STORAGE` istenmiş, `blockedPermissions` içinde `WRITE_EXTERNAL_STORAGE` yeniden engellenmiş. Story kaydetme için gerçek ihtiyaç: `READ_MEDIA_IMAGES` + `READ_MEDIA_VISUAL_USER_SELECTED`.

**Adımlar:**
1. `permissions` dizisini `["android.permission.READ_MEDIA_IMAGES", "android.permission.READ_MEDIA_VISUAL_USER_SELECTED"]`'e indir; `blockedPermissions` aynen kalsın (RECORD_AUDIO/AUDIO/VIDEO engelleri doğru).
2. Manifest değişti → `version` artır (talimat 8; B6 ile aynı sürüme binebilir).
3. Doğrulama: `npx expo prebuild -p android --clean` sonrası üretilen `android/app/src/main/AndroidManifest.xml`'de eski izinlerin olmadığını Grep'le kontrol et; sonuçları raporla (prebuild çıktısı gitignore'da, commit'e girmez).
4. Story kaydetme akışını (görsel galeriye kaydet) manuel test listesine ekle.

**Kabul:** manifest'te yalnız gerekli medya izinleri; story kaydetme çalışıyor.

### [ ] GÖREV B9 — Bildirim izni ön-açıklama ekranı (priming) (~2-3 saat)

**Bağlam:** `context/DeviceNotificationsContext.js` ~198-218: açılıştan ~4.2 sn sonra sistem izni habersiz isteniyor — iOS'ta tek seferlik hakkı yakar, App Review'da yorum konusu. `components/NotificationPermissionNotice.js` yalnız RET SONRASI bilgilendirme; ön-açıklama değil.

**Adımlar:**
1. Auto-ask effect'ini kaldır; yerine tek seferlik ön-açıklama sheet'i: küçük `BottomSheetModal` (talimat 7) — "Hatırlatıcıların ve arkadaş etkinliği bildirimlerin için izin gerekiyor" + "İzin ver" / "Şimdi değil". "İzin ver" → `requestPermission()`; "Şimdi değil" → `settings` deposunda bayrak, bir daha otomatik sorma (Ayarlar'dan hep açılabilir).
2. Gösterim zamanı: açılışta değil, ilk anlamlı bağlamda (ör. ilk hatırlatıcı kurma denemesi VEYA onboarding'in bildirim adımı — `OnboardingScreen` zaten varsa oraya bağla; yoksa startup gecikmeli gösterimi bağlamlı tetiğe çevir).
3. Bayat yorumu düzelt: `services/pushNotificationsService.js` ~12-13 "backend yok → push gelmez" → uzak push CANLI (`functions/index.js`: `onSocialNotificationCreated`, `dailyStreamingAvailability`). Data Safety formu bu yoruma göre DOLDURULMASIN notu zaten FAZ C'de.
4. i18n çift paket; `npm test`.

**Kabul:** sistem izni yalnız kullanıcı "İzin ver" dedikten sonra isteniyor; ret sonrası akış (mevcut notice) bozulmadı.

### [ ] GÖREV B10 — Küçük temizlikler (~1 saat)

1. **Sürüm dizeleri teke insin:** kaynak `app.json` (`1.4.1`). `package.json` `version`'ı `1.4.1` yap. `screens/tabs/settings/AboutAppScreen.js` ~38'deki sabit `"v1.21.1"` → `expo-constants` ile `Constants.expoConfig?.version` okumasına çevir (destek e-postası konusu da düzelecek).
2. **Ölü blok:** `screens/navigation/TabScreenNavigator.js` ~322 `{false && activeTab !== "settings" && (...)}` bloğunu tamamen sil.
3. **`.env` temizliği:** dosya sonundaki bozuk artık satırları (`1`…`16` gibi) sil. **Değerleri asla ekrana/loga basma**; yalnız satır yapısını düzelt. `.env.example` ile değişken adlarının eşleştiğini doğrula.
4. **Bağımlılık eşitleme:** sürüm build'i kesilmeden önce `npx expo install --check` ile 5 yama uyuşmazlığını kapat (expo, expo-file-system, expo-image-picker, expo-notifications, expo-sharing) → `npm test`.

**Kabul:** üç sürüm kaynağı tek; ölü blok yok; expo-doctor 20/20 (sürüm kontrolü dahil).

---

## FAZ C — İNSAN GEREKTİREN İŞLER (AI çalıştıramaz; taslak/hazırlık yapabilir)

> Bu kalemler panel/hesap işlemi ister. AI'nın rolü: taslak metin, kontrol listesi, hatırlatma.

- **[ ] C1 — Marka kararı:** "Seelogd" için TÜRKPATENT + EUIPO + USPTO + iki mağazada ad taraması → AD KARARI. Mağaza metinleri (`store/play/`) bu karara kilitli. *(AI: tarama sonuç özetini derleyebilir, alternatif ad listesi çıkarabilir.)*
- **[ ] C2 — Play ürünleri + RevenueCat panel:** Play Console'da abonelik IAP'leri (Pro/Unlimited, TR+global fiyat) → RevenueCat panelinde Play service credentials → Integrations→Webhooks'a fonksiyon URL'si + `Authorization` değeri → paneldeki hazır paywall'un footer'ında Koşullar/Gizlilik linklerinin açık olduğunun teyidi (B5'in panel ayağı).
- **[ ] C3 — Kapalı test kullanıcıları:** 12+ kişi kesinleşsin; 14 gün sayacı 24 Ağustos'ta başlamalı.
- **[ ] C4 — Mağaza görselleri:** feature graphic 1024×500, telefon ekran görüntüleri (TR ve EN ayrı setler, ilk 3 kritik), 512×512 ikon. *(AI: ekran görüntüsü çerçeve/başlık metinlerini `store/play/` altına taslaklayabilir; ham görüntüler `store/raw-screenshots/`'ta.)*
- **[ ] C5 — Data Safety + IARC formları:** beyanlar — Firebase (Auth/Firestore/Analytics), Sentry (crash), RevenueCat (satın alma), Advertising ID, **uzak push CANLI**, UGC (sohbet/yorum/gönderi) VAR + şikâyet/engelleme mekanizmaları (B4 tamamlanmış olmalı). *(AI: soru-cevap taslağı çıkarabilir.)*
- **[ ] C6 — Eski Gemini anahtarının iptal teyidi:** AI Studio'da eski anahtar + komut satırına yanlışlıkla yazılan ara anahtarın silindiğinin teyidi (yol haritası Faz 0 kalıntısı).
- **[ ] C7 — Website `mark.todo` alanları:** `website/privacy.html` ve `terms.html` içindeki veri sorumlusu kimliği/ülkesi ve yetkili mahkeme alanları — kullanıcıdan bilgi alınıp doldurulacak, sonra `firebase deploy --only hosting` (onaylı).
- **[ ] C8 — TMDB ticari kullanım yazışması:** *(AI: e-posta taslağı yazabilir; gönderim kullanıcıda.)*

---

## FAZ D — YAYIN SONRASI / SÜRÜM N+1 (şimdi YAPMA, sırası gelince)

- **[ ] D1 — App Check zorlaması (sıra kritik):** ① yeni build tüm kullanıcılara dağılsın → ② Firebase Console → App Check metriklerinde "verified" istek oranı ~%100 olsun → ③ `functions/index.js` `enforceAppCheck: true` (+ `checkGoogleSignInEligibility`'ye de App Check opsiyonu) + deploy → ④ Console'dan Firestore/RTDB enforcement. Erken açılırsa eski build'ler kırılır.
- **[ ] D2 — MMKV `auth` deposuna `encryptionKey`:** anahtarı `expo-secure-store`'dan tohumla (`services/storage/instances.js` ~97-106); mevcut düz veriyi tek seferlik yeniden şifreleme göçüyle taşı.
- **[ ] D3 — Çevrimdışı banner:** `ConnectivityContext` hazır ve mount'lu, tek tüketicisi var — köke bir banner bileşeni bağla.
- **[ ] D4 — Sessiz catch'lere `captureError`:** `services/tmdbLookup.js` (2), `services/dataDownloader.js` (4), `services/postsService.js` (9), `services/userService.js` (1).
- **[ ] D5 — Küfür/kelime filtresi** (Apple 1.2 "filtreleme" ayağını güçlendirir) + `ContentReports` için basit iç moderasyon görünümü.
- **[ ] D6 — `Usernames` koleksiyonunun `read: if true` kuralını kıs** (varlık kontrolü oturum şartına inebilir).
- **[ ] D7 — Hesap silme sunucu süpürücüsü:** `auth.onDelete` tetikli fonksiyon — istemci `safe()` sarmalayıcısının yuttuğu artıkları temizler (purge zaten idempotent).
- **[ ] D8 — Paylaşımlı cihaz penceresi:** `uid` değişince profil çözülene dek `ageRestricted = true` iyimser başlangıcı (`context/UserProfileContext.js` ~147-160 notu).
- **[ ] D9 — `purgeMigratedAsyncStorage()` aç + `@react-native-async-storage`'ı kaldır** (MMKV göçünden bir sürüm sonra; native değişiklik → `version` artır).
- **[ ] D10 — README güncelle** (hâlâ SDK 54 / Expo Go diyor; doğrulama development build ile).
- **[ ] D11 — Gemini güvenlik eşiği kararı:** `functions/index.js` ~500-505 dört kategori `BLOCK_ONLY_HIGH` — reşit olmayan kullanıcılar varken en azından `SEXUALLY_EXPLICIT` için `BLOCK_MEDIUM_AND_ABOVE` değerlendir (kullanıcı kararı).

---

## EK — HIZLI DOĞRULAMA KOMUTLARI

```bash
npm test
```

```bash
npx expo-doctor
```

```bash
git status
```

- Yetim i18n anahtarı kontrolü: B6'daki bekçi testi (`npm test` içinde).
- Kural değişikliği sonrası: yorum yaz/puan ver/DM at akışlarını dev build'de elle doğrula.
- Sürüm kesmeden önce: FAZ B'nin tamamı `[x]`, `expo-doctor` 20/20, master'da temiz ağaç.
