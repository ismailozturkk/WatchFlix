# Seelogd release candidate commit planı

> İnceleme tarihi: 12 Ağustos 2026
> Başlangıç commit'i: `139bdc9`
> Dal: `checkpoint/oyun-ve-bekleyen-isler-2026-06-26`
> Amaç: mevcut çalışma ağacını veri kaybetmeden incelenebilir ve geri alınabilir commit'lere ayırmak
> Bu belge commit, push, deploy veya mağaza gönderimi yapmaz.

## Uygulama sonucu

Plan 12 Ağustos 2026 tarihinde `codex/release-candidate-1.4.3` dalına uygulandı. Ortak ayar/çeviri sahiplerinin her özellik commit'inde tekrar parçalanmasını önlemek için bunlar tek bir temel commit'te toplandı; kalan davranış paketleri bunun üstüne sırayla işlendi.

| Commit | Konu |
|---|---|
| `e4734a6` | SDK 57 release tabanı |
| `13ffe9e` | Cihaz dili çözümlemesi |
| `8cc086c` | iOS Firebase ve Appetize profili |
| `decc324` | Ortak alert altyapısı |
| `72a8925` | Profil kimliği fan-out kaynakları |
| `4ea2417` | Detaydan sohbete medya gönderme |
| `1970a1d` | Ortak release tercihleri ve çeviriler |
| `62552de` | Liste eylemleri ve ortak liste yönetimi |
| `9a3ad3c` | Arkadaş profili liste kaydetme akışı |
| `ccbeb84` | Arama ve ana ekran keşfi |
| `d5aa9bd` | TMDB başlık fallback zinciri |
| `71dde1c` | Onboarding ve splash sunumu |
| `b55cd7e` | Not/to-do yerel draftları |
| `8830eb4` | CineMatch giriş ve hedefli öneriler |
| `631cef1` | Takvim ve tarih çarkı |
| `055556e` | TV ilerleme ve grafik sunumu |
| `38bc8a9` | Hatırlatıcı ve widget sunumları |
| `34a4d0e` | Trailer ve story sunumu |
| `71124b7` | Ayarlar ekranı yerelleştirmesi |

Bu commit'ler yalnız yerelde oluşturuldu. Push, Firebase deploy, EAS build/update veya mağaza gönderimi yapılmadı.

## Güncel kaynak durumu

- İlk sayımda 109 değiştirilmiş ve 28 izlenmeyen giriş vardı.
- `firebase.js` içindeki davranış taşımayan yanlışlıkla eklenmiş boş ilk satır kaldırıldı; bu dosya artık değişiklik grubuna dahil değil.
- Kalan değişiklikler bağımsız olmayan yaklaşık 16 davranış paketinden oluşuyor.
- Ortak sahipler `context/AppSettingsContext.js`, `services/storage/registry.js`, `translations/tr.json` ve `translations/en.json` birden fazla pakete ait hunk taşıyor. Bu dört dosya topluca bir commit'e atılmamalı; `git add -p` ile ilgili davranışla birlikte ayrılmalı.
- `package.json` ve `package-lock.json` aynı commit'te kalmalı.
- `firestore.rules`, ilgili istemci servisleri ve rules testleri aynı commit'te kalmalı.
- Native widget kaynağı `native/android-widgets/` altındadır. Üretilen `android/` klasörü commit kapsamına alınmamalı.

## Doğrulanan taban

| Kontrol | Sonuç |
|---|---|
| `git diff --check` | Geçti |
| Babel dönüşümü | 118 değiştirilmiş/yeni JS dosyası, 0 hata |
| Jest | 72 suite, 985 test, 0 hata |
| Android Kotlin | `:app:compileDebugKotlin`, başarılı |
| Expo Doctor | 20/20 geçti |
| Android production export | Başarılı; 3.779 modül, 415 asset |

Bu sonuçlar gerçek cihaz görsel davranışını, Firebase deploy'unu, OAuth'u, satın almayı, push teslimini veya widget yenilemeyi kanıtlamaz.

## Önerilen commit sırası

Her adım bir öncekinin üstüne uygulanmalı. Ortak dosyalarda yalnız ilgili hunk stage edilmelidir.

### 1. Build tabanını ve SDK 57 patch sürümlerini hizala

Önerilen mesaj: `chore: sdk 57 release tabanini hizala`

Kapsam:

- `package.json`, `package-lock.json`
- Uygulama/lock sürümünün `1.4.3` olması
- Expo SDK 57 uyumlu patch paketleri
- `runtimeVersion.policy = appVersion` mevcut ayarının korunması

Kabul: `npm ci --dry-run --ignore-scripts`, Expo Doctor ve Android Kotlin derlemesi geçmeli.

### 2. Cihaz dili ve başlangıç dili çözümlemesini sabitle

Önerilen mesaj: `fix: cihaz dili baslangic cozumlemesini saglamlastir`

Kapsam:

- `utils/deviceLanguage.js`, `translations/index.js`
- `__tests__/deviceLanguage.test.js`
- Bu davranışa ait `translations/tr.json` ve `translations/en.json` hunk'ları

Kabul: kayıtlı dil cihaz dilinden üstün olmalı; onboarding manuel dil seçici eklememeli.

### 3. iOS Firebase ve Appetize simulator yapılandırmasını ekle

Önerilen mesaj: `build: ios firebase ve appetize simulator profilini ekle`

Kapsam:

- `GoogleService-Info.plist`, `app.json`, `eas.json`
- `plugins/withRNFirebaseCocoaPods.js`
- Eski `modules/reminder-widget/ios/ReminderWidget.podspec` silinmesi
- Yeni `modules/reminder-widget/ios/SeelogdReminderWidgetBridge.podspec`

Kabul: plist geçerli olmalı, config plugin idempotent kalmalı ve Appetize profili yalnız simulator/Firebase `12.14.0` sabitlemesini taşımalı. Bu commit App Store imzasını tamamlamaz; `ios.appleTeamId` hâlâ ayrı bloktur.

### 4. Ortak modern alert ve modal geçişlerini birleştir

Önerilen mesaj: `feat: ortak alert ve onay modal yapisini modernlestir`

Kapsam:

- `components/AppAlert.js`, `App.js` içindeki host hunk'ı
- `components/chat/GroupInfoModal.js`
- `components/modals/CreatePostModal.js`, `CreateSharedListModal.js`
- İlgili profil/ayar ekranı alert hunk'ları ve çeviriler

Kabul: alert kuyruğu, destructive/cancel davranışı ve modal kapanış sırası korunmalı. Blur, safe-area ve modal geçişi cihazda doğrulanmalı.

### 5. Profil kimliğini bütün denormalize yüzeylere yay

Önerilen mesaj: `feat: profil kimligini tum sosyal yuzeylere yay`

Kapsam:

- `functions/profileIdentity.js`, `functions/index.js` içindeki profil fan-out hunk'ları
- `services/profilePropagation.js`, `services/userService.js`
- `services/postsService.js`, `services/groupsService.js`
- `components/Comment.js`, `PostCommentSheetModal.js`
- Chat/grup/liste kimlik snapshot hunk'ları
- `firestore.indexes.json`
- `__tests__/profileIdentity.test.js`, `userProfileCreate.test.js`

Kabul: isim, kullanıcı adı ve avatar için schema'ya özel patch testleri geçmeli. Functions ve index deploy edilmeden canlı davranış tamamlandı sayılmamalı.

### 6. Detay ekranından mevcut sohbet şemasıyla medya gönder

Önerilen mesaj: `feat: detaydan arkadasa ve gruba medya gonder`

Kapsam:

- `components/chat/NewConversationSheet.js`, `ChatCreateFab.js`
- `screens/movie/MovieDetail.js`, `screens/tv/TvShowsDetails.js`
- `screens/chat/ChatScreen.js`, `MessagesScreen.js`, `GroupsListScreen.js`
- `services/listQuickAdd.js` içindeki ilgili yardımcı hunk'lar

Kabul: birebir ve grup sohbeti mevcut tekli `media` alanını kullanmalı; `initialMediaKey` yalnız bir kez tüketilmeli. İki gerçek hesapla cihaz testi gerekir.

### 7. Liste eylemlerini, sıralamayı ve poster bilgi ayarlarını ortaklaştır

Önerilen mesaj: `feat: liste eylemleri ve poster bilgilerini ortaklastir`

Kapsam:

- `components/lists/ListItemActionsSheet.js`, `ListPosterInfoControls.js`, `GlobalSearchResults.js`
- `screens/lists/ListsScreen.js`, `ListsViewScreen.js`, `SharedListScreen.js`
- `services/listItemsService.js`, `sharedListsService.js`, `listQuickAdd.js`
- `context/ListStatusContext.js`
- `firestore.rules` ve `__tests__/rules/firestore.rules.test.js` içindeki reorder hunk'ları
- `AppSettingsContext`, storage registry ve çevirilerdeki `listPosterInfo` hunk'ları

Kabul: kişisel ve ortak listelerde tek uzun-bas eylem sheet'i kullanılmalı; ortak liste update'i yalnız negatif olmayan `listOrder` alanını değiştirebilmeli. Rules testleri gerçek emulator ile ayrıca geçmelidir.

### 8. Arkadaş profilindeki ortak liste grid ve kaydetme akışını ekle

Önerilen mesaj: `feat: arkadas profilinde ortak liste kaydetme akisi ekle`

Kapsam:

- `screens/tabs/profile/FriendProfileScreen.js`
- `components/SharedListsSection.js`
- Yeni kullanıcı için `listVisible` varsayılanları
- İlgili çeviri ve görünürlük hunk'ları

Kabul: boş listeler gösterilmemeli, 3/4 kolon geçişi gerçek FlatList yeniden kurulumu yapmalı ve sheet-to-modal geçişi iOS cihazda test edilmeli.

### 9. Arama açılışını, görünüm tercihini ve poster hızlı eylemlerini tamamla

Önerilen mesaj: `feat: arama yuzeyi ve poster hizli eylemlerini tamamla`

Kapsam:

- `components/home/DiscoverSearchButton.js`
- `screens/tabs/SearchScreen.js`, `MovieScreen.js`, `TvShowScreen.js`
- `screens/search/MovieSearch.js`, `TvShowSearch.js`
- Kartların long-press hunk'ları
- Storage registry'deki `searchResultsViewMode` ve ilgili test/çeviriler

Kabul: row/grid tercihi kalıcı olmalı, arama animasyonu gerçek ölçüm noktasından başlamalı ve normal poster dokunuşu navigasyonu bozulmamalı.

### 10. Ana ekran keşif raylarını ve açılış snapshot cache'ini iyileştir

Önerilen mesaj: `feat: ana ekran kesif raylarini ve acilis cacheini iyilestir`

Kapsam:

- `components/DiscoveryMediaRail.js`, `components/Skeleton.js`
- `hooks/useRailPosterStyle.js`
- `context/MovieContex.js`, `TvShowContex.js`
- `utils/apiCache.js`, `__tests__/apiCacheSwr.test.js`
- Ana ekran başlıkları/provider metinleri ve poster spacing hunk'ları

Kabul: çevrimdışı veri indirme kapalıyken yalnız açıkça işaretli başlangıç snapshot'ı kalıcı olmalı; normal katalog cache'i RAM ile sınırlı kalmalı.

### 11. TMDB başlık fallback zincirini merkezileştir

Önerilen mesaj: `feat: tmdb baslik dil fallback zincirini merkezilestir`

Kapsam:

- `utils/tmdbTitleFallback.js`, `App.js` kurulum hunk'ı
- `context/LanguageContext.js`, `services/tmdbLookup.js`
- `__tests__/tmdbTitleFallback.test.js`

Kabul: uygulama dili → İngilizce → özgün başlık sırası korunmalı; sonuçlar filtrelenmemeli veya yeniden sıralanmamalı.

### 12. Onboarding tercihlerini ve üç halkalı splash'i kalıcılaştır

Önerilen mesaj: `feat: onboarding tercihleri ve splash sunumunu yenile`

Kapsam:

- `screens/onboarding/OnboardingScreen.js`
- `utils/onboardingPreferences.js`, testi
- `components/SplashPosterWave.js`, `data/splashPosterCatalog.js`
- `assets/splash-posters/`, Jest file mock ve splash testi
- `AppSettingsContext`, storage registry ve çevirilerdeki onboarding hunk'ları
- Login ekranındaki Seelogd marka düzeltmesi

Kabul: tercihlerin yerel kalıcılığı çalışmalı, dil otomatik çözülmeli ve splash halka sayısı en fazla üç olmalı. Animasyon cihazda doğrulanmalı.

### 13. Not/to-do editörüne kullanıcı kapsamlı yerel draft ekle

Önerilen mesaj: `feat: not ve todo editorune yerel draft ekle`

Kapsam:

- `screens/tabs/profile/NotesScreen.js`
- `context/ProfileNotesContext.js`
- `services/noteTodoDraftService.js`, `utils/todoOrder.js`
- İki ilgili test
- Storage registry ve çevirilerdeki draft hunk'ları

Kabul: draft yalnız başarılı açık `Kaydet` sonrasında silinmeli; yeni ve mevcut not anahtarları kullanıcı kapsamında ayrılmalı.

### 14. CineMatch girişini ve hedefli öneri akışını sağlamlaştır

Önerilen mesaj: `feat: cinematch girisi ve hedefli onerileri saglamlastir`

Kapsam:

- `screens/chat/AIChatScreen.js`, `components/modals/ChatModal.js`
- `components/pet/PetCompanion.js`, `context/PetContext.js`
- `services/aiCineService.js`, `aiCineStore.js`, `aiConversationsStore.js`
- `__tests__/aiCineService.test.js`
- Onboarding tür tercihlerinin AI prompt'una bağlanan hunk'ları

Kabul: ilk dokunuş lazy modal mount sırasında kaybolmamalı, film/dizi hedefi cevapta zorlanmalı ve standart/CineMatch geçmişleri ayrı kalmalı. AI kart navigasyonu cihazda ayrıca kontrol edilmeli.

### 15. Takvim ve ortak tarih çarkı kararlılığını ekle

Önerilen mesaj: `fix: takvim ve tarih carki kararliligini tamamla`

Kapsam:

- `components/modals/DatePickerModal.js`
- `screens/calendar/CalendarScreen.js`
- İlgili tarih çarkı testleri

Kabul: min/max dışı değer scroll verisine girmemeli, merkez değer sürükleme sırasında seçilmeli ve hızlı fling fiziksel cihazda doğrulanmalı.

### 16. TV ilerleme, hatırlatıcı ve widget sunumlarını tamamla

Önerilen mesaj: `feat: tv ilerleme ve widget sunumlarini tamamla`

Kapsam:

- `components/tv/WatchProgressBar.js`, `UpNextRailCard.js`
- `screens/tv/SeasonDetails.js`, `TvGraphDetailScreen.js`, `TvOngoingSection.js`
- `utils/tvGraphGrid.js` ve testi
- `screens/tabs/profile/RemindersPreviewButton.js`, `StatisticsSection.js`
- `screens/tabs/settings/ReminderNotificationsScreen.js`, `WidgetSettingsScreen.js`
- Widget servisleri, tercihleri, native Kotlin/XML kaynakları ve testleri
- Storage/AppSettings/çeviri içindeki reminder limit hunk'ları

Kabul: profil hatırlatıcı limiti yalnız gelecekteki içerik için üst sınır olmalı; widget veri şeması değişmemeli. Native compile geçmeli, gerçek launcher/widget yenilemesi cihazda doğrulanmalı.

### 17. Trailer, story ve sohbet sunum detaylarını bitir

Önerilen mesaj: `feat: trailer story ve sohbet sunumunu iyilestir`

Kapsam:

- `components/video/TrailerSection.js`, `utils/trailerLanguages.js` ve testi
- `screens/story/StoryShareScreen.js`, `components/storyShare/StoryActionBar.js`
- Chat listesi ikon/başlık/safe-area sunum hunk'ları
- İlgili çeviriler

Kabul: fragman dilleri kullanıcı tercihine uymalı; story paylaşım ve chat modal geometrisi Android/iOS cihazda gözle doğrulanmalı.

### 18. Release hazırlık raporunu ekle

Önerilen mesaj: `docs: release hazirlik denetimini kaydet`

Kapsam:

- `docs/planlama/YAYIN_HAZIRLIK_DURUM_RAPORU_2026-08-10.md`
- Bu commit planı

Bu doküman commit'i davranış commit'lerinden sonra gelmeli; böylece raporun işaret ettiği source durumu sabit olur.

## Stage ve doğrulama kuralı

Her commit için:

1. Önce yalnız ilgili dosya/hunk'ları stage et.
2. `git diff --cached --check` çalıştır.
3. `git diff --cached --stat` ve `git diff --cached` ile kapsamı tekrar oku.
4. İlgili odak testini çalıştır.
5. Ortak dosyada sonraki davranışa ait hunk'ın yanlışlıkla stage edilmediğini doğrula.
6. Commit sonrasında en azından `git status --short` ile kalan yığını kontrol et.

Tüm davranış commit'leri tamamlandıktan sonra toplu kapı:

```powershell
git diff --check
npm test -- --runInBand --watch=false
npx expo-doctor
$env:NODE_ENV='production'; npx expo export --platform android --output-dir "$env:TEMP\seelogd-rc-android"
Push-Location android
.\gradlew.bat :app:compileDebugKotlin --no-daemon
Pop-Location
```

Firestore rules testi mevcut script düzeltilene kadar yalnız exit code ile kabul edilmemelidir. Emulator başlangıcı ve gerçek test özeti görünmelidir.

## Commit öncesi kullanıcı onayı gereken noktalar

- Bu plan commit oluşturma yetkisi vermez; commit ve yeni dal kullanıcı onayıyla yapılmalı.
- `firebase deploy`, EAS build/update, push veya mağaza submit yapılmamalı.
- Profil fan-out commit'i Functions ve Firestore index deploy'u gerektirir; deploy edilmeden yalnız kaynak hazırdır.
- iOS simulator commit'i Apple Team ID, gerçek cihaz imzası, TestFlight veya App Store hazırlığının tamamlandığı anlamına gelmez.
- Rules, premium vaatleri, Android izin/gizlilik ve App Check ayrı yayın blokları olarak kalır.
