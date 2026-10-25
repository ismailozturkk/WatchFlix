# T2 — Otomatik davranış testleri (2026-10-25)

> Rehber: `docs/planlama/YAYIN_ONCESI_TEST_REHBERI.md` › T2. Başlangıç commit'i `bb50d94`.
> Durum: **T2.1, T2.2, T2.3 bitti.** Kural düzeltmeleri 25 Eki'de yayına alındı.

## Özet

| Görev | Sonuç |
|---|---|
| T2.2 Kural kapsam matrisi | 69 kural yolundan 46'sı testlerde hiç geçmiyordu (bir kısmı servis testleriyle dolaylı denendi). Güvenlik açısından önemli boşluklar için 23 yeni kural testi. **2 gerçek açık bulundu ve düzeltildi** (aşağıda). Kural testleri 267 → **290** |
| T2.3 Callable sözleşme testleri | Yeni `functions/callables.integration.test.js` (10 test): oturumsuz ret, girdi doğrulama, taze kimlik, AI kotası (eşzamanlı dahil), OMDb önbelleği ve hız sınırı, Google kimliği, abonelik eşitleme. Entegrasyon testleri 22 → **32**, hepsi yeşil |
| T2.1 Ekran duman testi | 84 ekran × 3 dil (tr/en/es), dil başına ~2.380 işleyici tetiklendi. **Gerçek hata bulunmadı**; tek çizim hatası ve bir anahtar uyarısı düzenek/veri kaynaklı ya da düşük (aşağıda). Düzenek geçicidir, repodan silindi |

**Yayın notu:** iki kural düzeltmesi 25 Eki'de `firebase deploy --only firestore:rules` ile **yayına alındı** ("released rules … Deploy complete!"). Canlıda önceden yazılmış sahte arkadaş kaydı olup olmadığını `functions/scripts/auditFriendships.js` (salt okuma) gösterir; servis hesabı anahtarı gerektirdiği için henüz çalıştırılmadı.

---

## Bulunan açıklar (T2.2)

### [Yüksek] Herkes kendini başkasının arkadaşı yapıp "yalnız arkadaşlar" listelerini okuyabiliyordu — DÜZELTİLDİ, 25 Eki yayında
- **Nerede:** `firestore.rules` → `match /Users/{uid}/friends/{friendUid}` (`create`). `canReadLists` bu alt koleksiyondaki kayda bakıyor.
- **Nasıl:** oturum açmış herhangi biri `Users/{kurban}/friends/{kendisi}` belgesini oluşturabiliyordu (kural: `request.auth.uid == friendUid` yeterliydi). Ardından kurbanın listeleri "yalnız arkadaşlar" olsa da izleme geçmişi, favorileri, özel listeleri ve özel afişleri okunabiliyordu.
- **Kanıt:** `__tests__/rules/friendshipGate.test.js` — düzeltmeden önce 3 test düşüyordu (sahte kayıt yazılabiliyor, kendi gelen kutusuna sahte istekle de yazılabiliyor, liste okunabiliyor).
- **Düzeltme:** karşı tarafın listesine çapraz oluşturma yalnız, liste sahibinin bu kişiye gönderdiği istek varken: `exists(Users/{uid}/sentRequests/{uid}_{friendUid})`. Bu kaydı yalnız istek gönderen yazabilir (taklit edilemez); kabul batch'i isteği silse de `exists()` yazım öncesi durumu okur.
- **Bozulmadığı doğrulandı:** istek gönder → kabul et (gerçek `sendFriendRequest` / `acceptFriendRequest` servisleri), profil yayılımı (`update`), arkadaşlıktan çıkma (`delete`), sahibin kendi listesine eklemesi.
- **Yan etki:** Haziran 2026 öncesi istemcilerin `sentRequests` yazmadan gönderdiği bekleyen istekler artık kabul edilemez (yalnız eski iç test hesapları; yeniden gönderilmeleri gerekir).
- **Açık soru (T5):** canlıda daha önce bu yolla yazılmış sahte arkadaş kaydı var mı? `functions/scripts/auditFriendships.js` karşılıksız `friends` kayıtlarını salt okuma ile listeler (servis hesabı anahtarı ister; çalıştırma adımları dosyanın başında). Hiçbir şey silmez.

### [Orta] Gönderi sahibi yazar alanını değiştirip gönderiyi başkasının adına geçirebiliyordu — DÜZELTİLDİ, 25 Eki yayında
- **Nerede:** `firestore.rules` → `match /Posts/{postId}` (`update`, sahibi dalı).
- **Nasıl:** sahibi güncellemede `authorId`'yi başka bir uid'e çevirebiliyordu; gönderi o kişinin yazdığı gibi görünürdü.
- **Kanıt ve düzeltme:** `__tests__/rules/coverageGaps.test.js` (düzeltmeden önce düşüyordu); sahibi dalına `request.resource.data.authorId == resource.data.authorId` eklendi. İstemcide `authorId` güncelleyen bir yol yok (taramayla doğrulandı).

### Testle belgelenen ama düzeltilmeyen zayıflıklar (T5'e)
- **Beğeni/yorum sayacı şişirme (Düşük):** herhangi bir kullanıcı gönderinin `likesCount`'unu beğeni belgesi olmadan, her yazımda ±1 olmak üzere tekrar tekrar değiştirebilir. Kural sayacı beğeni belgesine bağlamıyor (`existsAfter(likes/{uid})` ile bağlanabilir).
- **Skor tablosu güveni (Orta, bilinen):** `GameLeaderboards/*/entries/{uid}`'ye sahibi istediği skoru yazabilir; oyunlar istemcide oynandığı için sunucu doğrulaması yok. En azından skor üst sınırı/tipi kurala eklenebilir.
- **Gelen kutusu kaydı (Düşük):** `Users/{uid}/conversations/{otherUid}`'ye karşı taraf şekil denetimi olmadan yazabiliyor ve engellenmiş kullanıcı için `notBlocked` denetimi yok.
- **Bekleme listesi (Düşük):** `waitlist/{docId}` herkese `get` ile açık; belge kimliği e-postaysa bir e-postanın listede olup olmadığı sorgulanabilir. `meta/waitlist` sayacı oturumsuz artırılabilir (sitedeki gösterge şişirilebilir).

## Kapsam matrisi (T2.2) — yeni testlerden sonra

Doğrudan kural testi olan yollar (önceden de olanlar: `Users`, `Users/private`, `chats`, `groups`, `groupInbox`, `PosterChoices`, `DailyPolls`, `Feedback`, `Ratings`, `ContentReports`, `MovieComment`/`TvComment`, `SharedLists`, `notifications`, `PromoCodes/redemptions`, `Referrals`). Servis testleriyle dolaylı denenenler: `Lists` (kütüphane), `Notes`/`MediaNotes`/`Reminders`/`AiConversations` (userData), `Posts`/ayna koleksiyonları (Hesabı Sıfırla), `friends`/`conversations` (arkadaşlıktan çıkma).

Bu turda eklenenler (`friendshipGate.test.js` 7 test, `coverageGaps.test.js` 16 test):
- `friends` çapraz yazımı · `AiUsage` · `RevenueCatWebhookEvents` · `ReferralCodes` · `ReferralAccounts` · `PromoCodes` · `AppConfig` · `Usernames`
- `Posts`, `Posts/likes`, `Posts/comments` · `PostReports`
- `blocked` · `friendRequests` · `sentRequests` · `conversations` · `Presence`
- `GameLeaderboards/entries` · `UserStats` · `SceneGameHistory` · `myRatings` · `bookmarks`

Hâlâ doğrudan testi olmayanlar (düşük risk; sahibine özel ya da salt okunur): `tournaments/*` (oy/havuz), `tournamentWinners`, `CineRooms`, `chats|groups/pins`, `ProviderWatch`, `SceneGame`, `gameProfile|gameStats|gameSessions`, `followers|following`, `likedPosts`, `myComments`, `waitlist`, `meta/waitlist`.

## Callable sözleşme testleri (T2.3)

`functions/callables.integration.test.js` — dış servisler `global.fetch` ile taklit, gerçek anahtar yok:

| Test | Kanıtladığı |
|---|---|
| Oturumsuz çağrılar | 7 callable `unauthenticated`; hiçbir dış servise gidilmiyor |
| `deleteAccountData` | 1 saatlik belirteçle `unauthenticated`, bilinmeyen aşamayla `invalid-argument`; veri silinmiyor |
| `callGemini` girdi | geçersiz mod, 4000+ karakter, boş sistem talimatı Gemini'ye gitmeden reddediliyor |
| `callGemini` kota | Free 3/gün sunucuda; 4. çağrı `resource-exhausted` |
| `callGemini` eşzamanlı | 6 paralel çağrıdan tam 3'ü geçiyor (transaction) |
| `callGemini` plan | istemcinin gönderdiği plan yok sayılıyor, sunucudaki entitlements okunuyor |
| `getExternalRatings` | kimlik doğrulama; geçici hata önbelleğe girmiyor, kesin "yok" giriyor (T1.1 düzeltmesi 1.3) |
| `getExternalRatings` hız | kullanıcı başına dakikada 60 çağrı, 61. reddediliyor |
| `checkGoogleSignInEligibility` | kısa belirteç `invalid-argument`, yanlış kitle `unauthenticated` |
| `syncPremiumStatus` | profil şartı, RevenueCat hatasında `unavailable`, başarıda `storeSubscribed` yazımı, kısma |

Çalıştırma (Firestore + Auth emülatörü, sırayla):

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" && export PATH="$JAVA_HOME/bin:$PATH" && npx firebase emulators:exec --only firestore,auth --project demo-referral "cd functions && node --test --test-concurrency=1 accountPurge.integration.test.js referral.integration.test.js callables.integration.test.js"
```

## Ekran duman testi (T2.1)

**Yöntem:** geçici jest düzeneği (hafızadaki "UI smoke render" yöntemi, yeniden kuruldu). Ekranlar `App.js`'te başvurulan tüm ekran modülleri + `screens/tabs/*` (84 ekran). Her ekran **gerçek sağlayıcı yığınıyla** (App.js sırası, 29 sağlayıcı + `UserDataSyncHost`) çizilir; Firestore bellek-içi taklit (gerçek şemayla tohumlanmış: profil, arkadaş, istek, bildirim, sohbet, grup, kütüphane, dizi bölümleri, not, hatırlatıcı, gönderi, ortak liste), TMDB üst küme yanıtı, callable'ların gerçek yanıt şekli. Çizimden sonra host düğümlerdeki her `on*` işleyicisi sahte olayla tetiklenir (ekran başına en çok 160, iki geçiş). Senkron/asenkron hatalar, işlenmeyen ret, `console.error` toplanır.

**Kanıt (pozitif kontrol):** kasten senkron ve asenkron hata atan bir kontrol ekranı her koşuda iki hatayla yakalandı; düzenek hatayı görüyor.

| Varyant | Ekran | İşleyici | Çizim hatası | İşleyici hatası | Asenkron hata |
|---|---|---|---|---|---|
| tr | 84 | 2.386 | 1 (düzenek) | 0 | 0 |
| en | 84 | 2.372 | 1 (düzenek) | 0 | 0 |
| es | 84 | 2.376 | 1 (düzenek) | 0 | 0 |

**Ayıklanan bulgular:**
- `screens/tabs/MovieScreen` tek başına çizilemiyor (`useMovie()` boş): **düzenek kaynaklı** — ekran yalnız `DiscoverScreen` içindeki `MovieProvider` altında açılıyor, `DiscoverScreen` sorunsuz çiziliyor.
- `SwipeView` (sohbet modalı) altında, işleyiciler tetiklendikten sonra bir düğme satırında yinelenen `-` anahtarı uyarısı. Kaynak dosya taramayla bulunamadı; büyük olasılıkla taklit verinin boş alanlarından. **Düşük**, T3'te cihazda sohbet modalında bakılacak.
- İlk koşuda görünen diğer hatalar (sezon açıklamasının `onTextLayout`'u, `requestAnimationFrame`, davet ekranının boş callable yanıtı, TV grafiğinde yinelenen anahtar, sekme kabuğunda `AccessibilityInfo`) **düzenek eksiği** çıktı; düzenek gerçekçi hâle getirilince hepsi kayboldu.

**Kanıtlamadıkları:** gerçek animasyon ve görsel düzen, native modül davranışı, gerçek ağ ve kural davranışı (kurallar T2.2'de), ölçüm bekleyen bileşenler. Bunlar T3 (cihaz) işi.

**Düzenek dersleri** (yeniden kurulacaksa): `jest.setup.js` yerine kendi kurulum dosyası (oradaki fabrika taklitleri evrensel taklitle aynı yola düşüp hepsini ezer); `expo-file-system/legacy` alt yolu ayrıca eşlenmeli; tohum veri servis başlıklarındaki şemadan (`listItemsService.js`, `watchedTvService.js`); sezon istekleri sezona ait bölüm numarası dönmeli; `requestAnimationFrame` ve `AccessibilityInfo`'nun iOS fonksiyonları taklitte olmalı; işleyici ağacı değiştirince bayat düğüm atlanmalı.

## Doğrulama

Uygulama 351 suite / 6789 test · kurallar 10 suite / 290 test · fonksiyon birim 79 · fonksiyon entegrasyon 32/32 — hepsi yeşil.
