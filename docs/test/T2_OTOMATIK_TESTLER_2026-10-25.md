# T2 — Otomatik davranış testleri (2026-10-25)

> Rehber: `docs/planlama/YAYIN_ONCESI_TEST_REHBERI.md` › T2. Başlangıç commit'i `bb50d94`.
> Durum: **T2.2 ve T2.3 bitti**, T2.1 (geçici ekran duman harness'i) sırada.

## Özet

| Görev | Sonuç |
|---|---|
| T2.2 Kural kapsam matrisi | 69 kural yolundan 46'sı testlerde hiç geçmiyordu (bir kısmı servis testleriyle dolaylı denendi). Güvenlik açısından önemli boşluklar için 23 yeni kural testi. **2 gerçek açık bulundu ve düzeltildi** (aşağıda). Kural testleri 267 → **290** |
| T2.3 Callable sözleşme testleri | Yeni `functions/callables.integration.test.js` (10 test): oturumsuz ret, girdi doğrulama, taze kimlik, AI kotası (eşzamanlı dahil), OMDb önbelleği ve hız sınırı, Google kimliği, abonelik eşitleme. Entegrasyon testleri 22 → **32**, hepsi yeşil |
| T2.1 Ekran duman testi | ⏳ sırada |

**Yayın notu:** iki kural düzeltmesi `firestore.rules`'ta; **canlıya alınmadıkça açıklar canlıda duruyor**. Deploy kullanıcı onayı bekliyor.

---

## Bulunan açıklar (T2.2)

### [Yüksek] Herkes kendini başkasının arkadaşı yapıp "yalnız arkadaşlar" listelerini okuyabiliyordu — DÜZELTİLDİ (kuralda), deploy bekliyor
- **Nerede:** `firestore.rules` → `match /Users/{uid}/friends/{friendUid}` (`create`). `canReadLists` bu alt koleksiyondaki kayda bakıyor.
- **Nasıl:** oturum açmış herhangi biri `Users/{kurban}/friends/{kendisi}` belgesini oluşturabiliyordu (kural: `request.auth.uid == friendUid` yeterliydi). Ardından kurbanın listeleri "yalnız arkadaşlar" olsa da izleme geçmişi, favorileri, özel listeleri ve özel afişleri okunabiliyordu.
- **Kanıt:** `__tests__/rules/friendshipGate.test.js` — düzeltmeden önce 3 test düşüyordu (sahte kayıt yazılabiliyor, kendi gelen kutusuna sahte istekle de yazılabiliyor, liste okunabiliyor).
- **Düzeltme:** karşı tarafın listesine çapraz oluşturma yalnız, liste sahibinin bu kişiye gönderdiği istek varken: `exists(Users/{uid}/sentRequests/{uid}_{friendUid})`. Bu kaydı yalnız istek gönderen yazabilir (taklit edilemez); kabul batch'i isteği silse de `exists()` yazım öncesi durumu okur.
- **Bozulmadığı doğrulandı:** istek gönder → kabul et (gerçek `sendFriendRequest` / `acceptFriendRequest` servisleri), profil yayılımı (`update`), arkadaşlıktan çıkma (`delete`), sahibin kendi listesine eklemesi.
- **Yan etki:** Haziran 2026 öncesi istemcilerin `sentRequests` yazmadan gönderdiği bekleyen istekler artık kabul edilemez (yalnız eski iç test hesapları; yeniden gönderilmeleri gerekir).
- **Açık soru (T5):** canlıda daha önce bu yolla yazılmış sahte arkadaş kaydı var mı? Karşılıklı olmayan `friends` kayıtları yönetici betiğiyle aranabilir (canlı veri okur, onay ister).

### [Orta] Gönderi sahibi yazar alanını değiştirip gönderiyi başkasının adına geçirebiliyordu — DÜZELTİLDİ (kuralda), deploy bekliyor
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

## Doğrulama

Uygulama 351 suite / 6789 test · kurallar 10 suite / 290 test · fonksiyon birim 79 · fonksiyon entegrasyon 32/32 — hepsi yeşil.
