# Seelogd — Project Context

> Yeni bir geliştirici / AI ajanı için tek dosyalık genel bağlam. Hızlı orijinte oluş için.
> Detaylı şema: [`FIRESTORE_SCHEMA.txt`](./FIRESTORE_SCHEMA.txt).
> Güvenlik kuralları: [`firestore.rules`](./firestore.rules).

---

## 🎬 Proje nedir?

**Seelogd** — kullanıcıların film/dizi izleme geçmişini takip eden, sosyal özelliklerle (arkadaş, paylaşım, beğeni, bildirim) zenginleştirilmiş bir React Native mobil uygulaması. TMDB API'sinden içerik çeker, Firebase Firestore'da kullanıcı verisini tutar.

**Hedef kitle:** Türk + İngiliz dilini konuşan film/dizi tutkunları.

---

## 🛠 Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Runtime | React Native 0.81.5 + Expo SDK ~54 |
| UI | React 19.1, react-navigation 7, expo-image, expo-blur, expo-linear-gradient, react-native-reanimated |
| Auth | Firebase Auth + Google Sign-in |
| DB | Firebase Firestore (Modular SDK v11.7) |
| External API | TMDB (The Movie Database) |
| Local cache | AsyncStorage (memory+disk TTL cache `utils/apiCache.js`) |
| i18n | i18next + react-i18next (`translations/tr.json`, `translations/en.json`) |
| Test | Manuel (otomasyon yok) |

---

## 📂 Klasör Yapısı

```
Seelogd/
├── App.js                       # Root component, Provider hiyerarşisi, Stack navigator
├── firebase.js                  # Firebase initApp
├── firestore.rules              # Security rules (v2 şema)
├── FIRESTORE_SCHEMA.txt         # Detaylı şema dokümantasyonu
├── PROJECT_CONTEXT.md           # Bu dosya
│
├── context/                     # Tüm global state buradan
│   ├── AuthContext.js
│   ├── AppSettingsContext.js   # Theme/Lang/Snow/Avatar… 10 ayrı context
│   ├── UserProfileContext.js   # Users/{uid} realtime + migration
│   ├── FriendsContext.js       # Arkadaşlar + req/sent listenerlar
│   ├── NotificationsContext.js # Bildirim listesi
│   ├── PostsContext.js         # Sosyal feed
│   ├── ProfileStatsContext.js  # İzleme istatistikleri
│   ├── ProfileUiContext.js     # Avatar + UI ayarları
│   ├── TvShowContex.js, MovieContex.js, CalendarContext.js …
│
├── services/                    # Firestore CRUD katmanı — UI Firestore'a doğrudan değmez
│   ├── userService.js          # Profil + Usernames reservation + migration
│   ├── friendsService.js       # request/accept/decline/cancel/unfriend/block — atomic batch
│   ├── presenceService.js      # Presence/{uid} heartbeat (60sn) + AppState
│   ├── notificationsService.js # subscribe/markRead/markAll/delete
│   └── postsService.js         # Posts CRUD + likes + comments + bookmarks + follow
│
├── screens/
│   ├── auth/                   # Login/Register/Forgot
│   ├── tabs/                   # Tab bar ekranları
│   │   ├── TvShowScreen.js, MovieScreen.js
│   │   ├── ShareContentScreen.js
│   │   ├── SettingsScreen.js, SearchScreen.js, ProfileScreen.js
│   │   └── profile/            # Profil alt ekranları
│   │       ├── FriendsListScreen.js
│   │       ├── FriendRequestsScreen.js
│   │       ├── PrivacySettingsScreen.js
│   │       ├── MovieStatisticsScreen.js
│   │       └── TvStatisticsScreen.js   ← AKTİF
│   ├── tv/                     # TV alt ekranları (NOT: TvStatisticsScreen burada DEĞİL,
│   │                             eskiden duplicate vardı, silindi)
│   ├── movie/, search/, actor/
│   └── ChatScreen.js, CalendarScreen.js, ListsScreen.js, ListsViewScreen.js
│
├── components/
│   ├── profile/
│   │   └── StatsComponents.js  # HeroCard, FilterBar, SectionHeader, PosterCard, EmptyState
│   ├── CreatePostModal.js
│   ├── Comment.js, CommentSheetModal.js
│   ├── Skeleton.js, ErrorBoundary.js …
│
├── utils/
│   ├── apiCache.js             # AsyncStorage TTL cache (TMDB için)
│   ├── avatars.js              # 56 avatar require() + getAvatarSource + clampAvatarIndex
│   └── tmdbImageUtils.js
│
├── translations/
│   ├── tr.json
│   └── en.json
│
├── assets/avatar/0.png … 55.png
└── LottieJson/, theme/, modules/
```

---

## 🧬 Provider Hiyerarşisi (App.js)

```
ErrorBoundary
└─ GestureHandlerRootView
   └─ SafeAreaProvider
      └─ AppSettingsProvider              # Theme + Language + Snow + Avatar + ImageQuality + Api
         └─ LanguageProvider              # legacy alias (sadece t / language)
            └─ ThemeProvider              # legacy alias
               └─ SnowProvider
                  └─ AuthProvider         # user + initialRoute + loading
                     └─ UserProfileProvider     # Users/{uid} realtime + migration
                        └─ FriendsProvider      # friends + requests listener
                           └─ NotificationsProvider
                              └─ ListStatusProvider
                                 └─ ProfileStatsProvider
                                    └─ ProfileNotesProvider
                                       └─ ProfileRemindersProvider
                                          └─ ProfileUiProvider     # Avatar UI state
                                             └─ PostsProvider     # Sosyal feed
                                                └─ TvShowProvider
                                                   └─ AppContent  # NavigationContainer
```

**Tab-local providers:** `MovieProvider`, `CalendarProvider` — `TabScreenNavigator.js` içinde tab başına sarmalı (her tab girişinde re-init olmaz çünkü tab mount stable).

---

## 🗄 Firestore Şeması (v2 özeti)

> Tam detay: [FIRESTORE_SCHEMA.txt](./FIRESTORE_SCHEMA.txt)

### Kullanıcı kimliği
- `Users/{uid}` — profil, sayaçlar, privacy, listVisible
- `Usernames/{usernameLower}` — username uniqueness reservation (transaction)
- `Presence/{uid}` — online status, lastActiveAt, lastSeen (heartbeat hedefi — Users dokümanını re-render fan-out'tan korur)

### Sosyal
- `Users/{uid}/friends/{friendUid}`
- `Users/{uid}/friendRequests/{requestId}` — gelen istekler (requestId = `${fromUid}_${toUid}`)
- `Users/{uid}/sentRequests/{requestId}` — gönderilen (dual-write)
- `Users/{uid}/blocked/{blockedUid}`
- `Users/{uid}/following/{targetUid}` / `Users/{uid}/followers/{followerUid}`
- `Users/{uid}/notifications/{notifId}` — friend_request, friend_accepted, post_like, post_comment, comment_reply, mention

### Posts (sosyal feed)
- `Posts/{postId}` — type, title, content, mediaList, likesCount, commentsCount, authorAvatarIndex (snapshot)
- `Posts/{postId}/likes/{userId}`
- `Posts/{postId}/comments/{commentId}`
- `Users/{uid}/likedPosts/{postId}` — kullanıcının beğeni Set'i (tek seferde fetch)
- `Users/{uid}/bookmarks/{postId}`

### İçerik takibi (legacy + migration)
- `Lists/{uid}` — root doc (legacy: watchedMovies[], watchedTv[] arrays)
- `Lists/{uid}/watchedMovies/{movieId}` — yeni subcollection
- `Lists/{uid}/watchedTv/{showId}` — yeni subcollection
- `Notes/{uid}/items/{noteId}` (FAZ 6 sonrası)
- `Reminders/{uid}/movies/{movieId}` ve `tvShows/{showId}/episodes/{episodeId}` (FAZ 7)
- `UserStats/{uid}` — eski format, kullanım azalıyor

### Chat
- `chats/{chatId}` — chatId pattern: `uid1_uid2`
- `chats/{chatId}/messages/{msgId}`

### Yorumlar (TMDB içeriğine)
- `MovieComment/{movieId}/comments/{commentId}` + `/replies/{replyId}`

---

## 🎨 Önemli Mimari Kararlar (WHY)

### 1. Avatar = index (0-55), URL değil
[`utils/avatars.js`](./utils/avatars.js) — 56 require asset. Firestore'da `avatarIndex: number` saklanır:
- 3 byte yazma (URL ~80 byte)
- Yerel `require()` → CDN trafiği yok, anında render
- Snapshot pattern — eski postlarda eski avatar görünmeye devam eder
- Universal `getAvatarSource(idx)` + `clampAvatarIndex(idx)` (NaN/eski veri için güvenlik ağı)

### 2. Presence ayrı koleksiyonda
[`services/presenceService.js`](./services/presenceService.js):
- Heartbeat (60 sn) `Presence/{uid}`'e yazar — `Users/{uid}` stabil kalır
- Aksi halde Users üzerinde her 60 sn listener fan-out olurdu (UserProfile + Friends + tüm tüketiciler re-render)
- `isOnlineEffective(presence)` 2 dakika stale window — crash sonrası "sonsuz online" engellenir
- Privacy katmanı: `isOnlineVisible(presence, privacy)` UI tarafında

### 3. Username uniqueness — runTransaction
[`userService.createUserProfile`](./services/userService.js):
- `Usernames/{usernameLower}` doc'u atomic rezerve + `Users/{uid}` aynı transaction'da yazılır
- 2 kullanıcı aynı anda "ahmet" alamaz
- Username değişimi de transaction (eski rezervasyon sil + yeni yaz)

### 4. Schema migration (v1 → v2)
`UserProfileContext` her login sonrası `migrateUserIfNeeded(uid)` çağırır:
- `usernameLower`, counters, privacy map, listVisible map, avatarIndex, `_schemaVersion: 2`
- Eski `friends[]` array → `/friends/{uid}` subcollection
- Idempotent — defalarca çağrılabilir
- Eski alanlar **silinmedi** (geriye uyumluluk için), yeni kod sadece subcollection okur

### 5. Atomic friend akışları — writeBatch
Tüm `friendsService` fonksiyonları (`sendFriendRequest`, `acceptFriendRequest`, vs.) tek `writeBatch`:
- Her iki tarafın subcollection'larına yazma
- Counter increment/decrement
- Notification ekleme
- Hepsi atomic — kısmi yazma yok

### 6. Realtime listener disiplini
- **Ucuz:** Tek doküman (own profile, own posts feed ilk sayfa)
- **Pahalı:** Liste içinde N adet listener (arkadaş listesi presence'i)

Kural: Liste ekranlarında `getDoc/getDocs` + manuel refresh; tek-öğe ekranlarda `onSnapshot`. PostsContext realtime SADECE "all" filtresinde aktif.

### 7. UI re-render optimizasyonları
14 TV/Movie section ekranında yapılan refactor:
- Item component **parent dışına** alındı + `React.memo`
- `useListStatus`, `getTmdbUrl`, `theme` props olarak geçirildi
- `source={{ uri }}` `useMemo` ile sarıldı
- `<Image>` üzerinde `recyclingKey` + `cachePolicy="memory-disk"`
- Parent'ta `getScaleValue`/`onPressIn`/`onPressOut` `useCallback([])` ile stable

### 8. `updatedAt` sadece gerçek profil değişiminde
- `userService.updateUserProfile`, `changeUsername`, `updatePrivacy` → yazar (anlamlı)
- Counter akışları (friend req/like/comment) → YAZMAZ (Users listener fan-out'unu önler)
- `Posts/{postId}.updatedAt` kalır (kendi alanı, problem değil)

### 9. Section-içi lazy fetch
`TvShowProvider`/`MovieProvider`: `activeSections` Set. Section component mount olunca `activateTvSection("trends")` → context useEffect tetiklenir → fetch. Kullanıcı section'a kaydırmazsa API çağrısı yapılmaz.

### 10. Composer/Modal'lar service layer'a bağlı
`CreatePostModal.onSubmit` → `PostsContext.submitPost` → `postsService.createPost`. UI Firestore'a doğrudan değmez.

---

## 🛡 Security Rules Özeti

> Tam: [`firestore.rules`](./firestore.rules)

| Pattern | Yetki |
|---------|-------|
| Sahibi yazar (`isOwner`) | Users, Notes, Reminders, UserStats, blocked, bookmarks, likedPosts |
| Counter güncelleme cross-write | Users (sadece `friendsCount`, `unreadNotifsCount`, vs. `onlyUpdating()`) |
| Friend req — sender yazar, alıcı/sender silebilir | friendRequests, sentRequests |
| Public + author write | Posts (counter alanları cross-write) |
| Engelli kullanıcı istek atamaz | `notBlocked(uid)` helper |
| Chat — UID chatId'de geçerse | `chatId.matches('.*' + uid + '.*')` |

---

## 🧰 Common Patterns

### Translation
```jsx
const { t } = useLanguage();
<Text>{t.SearchScreen.searchMovies}</Text>  // nested key kullan
// Legacy top-level `t.searchMovies` da var ama yeni kodda nested key tercih
```

### Avatar
```jsx
import { getAvatarSource, clampAvatarIndex } from "../utils/avatars";

// Local resource
<Image source={getAvatarSource(user.avatarIndex)} />

// Firestore yazma
authorAvatarIndex: clampAvatarIndex(payload.authorAvatarIndex),
```

### Service çağrısı
```js
// UI'dan
const { submitPost } = usePosts();
await submitPost({ type, title, content, mediaList, authorAvatarIndex });

// Context'ten service'e proxy
await PostsApi.createPost(user, payload);
```

### TMDB image URL
```jsx
const { getTmdbUrl } = useImageQualitySettings();
<Image source={{ uri: getTmdbUrl(item.poster_path, "poster", 200) }} />
// width=200 → Firestore image quality preset ile en uygun w185/w342'yi seçer
```

### Section lazy fetch
```jsx
// Section component
useEffect(() => { activateTvSection("genres"); }, [activateTvSection]);
// Context içinde
useEffect(() => {
  if (!activeSections.genres) return;
  fetchTvByGenres();
}, [activeSections.genres, language, pageGenres, selectedGenres]);
```

---

## ✅ Tamamlanan Büyük İşler (Kronolojik)

| Aşama | İş |
|-------|-----|
| Performance phases 6/7/12 | Notes/Reminders subcollection migration, Chat/Comment listener leak fix |
| Section refactor (14 dosya) | TV/Movie section'larında inline component → `React.memo` dışarı taşıma, source `useMemo`, `recyclingKey` |
| Posts (sosyal feed) | `postsService` + `PostsContext` + `ShareContentScreen` UI + `CreatePostModal` bağlantı |
| Avatar index | `utils/avatars.js`, Firestore'da sadece index, snapshot pattern |
| User foundation v2 | `userService` (Usernames transaction), `UserProfileContext` (migration), shared 56 avatar util |
| Presence ayrı koleksiyon | `services/presenceService.js`, heartbeat 60sn, `Presence/{uid}` |
| Friends backend | `friendsService` (8 batch akış), `FriendsContext`, blocked sistemi |
| Friends UI refactor | `SearchFriendsScreen`/`FriendRequestsScreen`/`FriendsListScreen` legacy dual-read kaldırıldı |
| Notifications | `notificationsService` + `NotificationsContext` |
| Security rules v2 | Posts + Users alt koleksiyonları + Usernames + Presence + counter only-updating |
| Privacy Settings | `PrivacySettingsScreen` UI |
| Schema doc | `FIRESTORE_SCHEMA.txt` v2 yazıldı |
| Stats UI modernize | `components/profile/StatsComponents.js` (HeroCard 3-sütun + FilterBar + SectionHeader + PosterCard) |
| `updatedAt` temizliği | Counter akışlarından kaldırıldı, sadece profil değişiminde yazılır |
| Duplicate `TvStatisticsScreen` | `screens/tv/` versiyonu silindi, `screens/tabs/profile/` aktif |
| HSL alpha bug | `withAlpha()` helper — `rankColor + "33"` → `withAlpha(color, 0.2)` |

---

## ⚠️ Bilinen Tech Debt / Sonraki Hamleler

### Yüksek öncelik
- **TV stats `flatEpisodesTv` boş gözükebilir** — Subcollection geçişi sonrası show-level docta `seasons[]` array yok. Episode-level subcollection (`Lists/{uid}/watchedTv/{showId}/episodes/{epId}`) okunmalı, ama büyük migration gerekir.
- **`ProfileStatsContext` 3 listener karmaşası** — root-doc + 2 subcollection `setListItems`'i çakışan şekilde günceller. Migration teyidi sonrası root-doc listener kaldırılmalı.
- **Eski `Users/{uid}.friends[]`/`friendRequests{}`/`avatar` alanları** — yeni kod okumaz ama silmedik. Cloud Function veya manuel script ile cleanup.
- **PostsContext "following" feed pagination** — şimdilik kapalı (`hasMore = false`).

### Orta öncelik
- **Hardcoded TR text** — Stats ekranlarında "Daha fazla", "Toplam izlenme", "Eski Kayıtlar" vb. `translations/` taşınmalı.
- **`scaleValues` memory** — `ProfileStatsContext`'te eski Animated.Value'lar temizlenmiyor.
- **Comments UI** — Posts'a yorum yazma ekranı yok. `postsService.addComment` hazır.
- **PostDetailScreen** — Yok. Post'a tıklayınca detay+yorumlar açılmalı.
- **NotificationsScreen** — `useNotifications` hazır ama UI ekranı yok.
- **Following sistemi UI** — `toggleFollow` hazır, başka kullanıcı profil ekranı yok.

### Düşük öncelik
- **TabScreen.js ölü kopya** — App.js sadece `TabScreenNavigator` kullanıyor.
- **Çoklu çevirisi olmayan stringler** — Stats hardcoded Türkçe.
- **Native Share API** — `share-social` butonu sembolik.

---

## 🧪 Manuel Test Akışları

### Setup
1. `.env`'de `EXPO_PUBLIC_API_KEY` (TMDB) ve `EXPO_PUBLIC_FIREBASE_API_KEY` ayarlı olmalı.
2. Firestore Console → Rules sekmesine `firestore.rules` içeriği publish.
3. Compound indexler için uygulamayı çalıştır → hata linklerine tıkla:
   - `Posts: visibility (Asc), createdAt (Desc)`
   - `Posts: type (Asc), visibility (Asc), createdAt (Desc)`
   - `Posts: authorId (Asc), createdAt (Desc)`
   - `friendRequests` (subcoll): `status (Asc), createdAt (Desc)`
   - `sentRequests` (subcoll): `status (Asc), createdAt (Desc)`
4. `usernameLower` Single-field index Firestore otomatik oluşturur.

### Smoke tests
| Akış | Beklenen |
|------|----------|
| Yeni kayıt | `Users/{uid}._schemaVersion: 2` + `Usernames/{lower}` doc oluşur |
| Aynı username 2. hesap | "Bu kullanıcı adı zaten alınmış" hatası |
| Eski kullanıcı login | Migration sessiz çalışır, eksik alanlar dolar |
| Friend req gönder | Her iki tarafta doc + counter ±1 + alıcıda notification |
| Accept | `/friends/{}` her iki tarafta, request silinir, sender'a `friend_accepted` notif |
| Block | Arkadaşlık silinir, requestler temizlenir |
| Avatar değiştir | AsyncStorage + Firestore senkron, sonraki post'larda yeni avatar |
| Post oluştur | `Posts/{}` + `Users/{uid}.postsCount++` |
| Like | Optimistic UI + `Posts/{id}/likes/{uid}` + count |
| Presence | App background → `isOnline: false`, 60sn'de bir foreground'da heartbeat |
| Search username | `usernameLower` prefix sorgusu → case-insensitive sonuç |
| Stats hero card | 1/2/3 sütun esnek + expand toggle + rank rozeti dinamik renk |

---

## 🚨 Sık Karşılaşılan Hatalar

| Hata | Sebep | Çözüm |
|------|-------|-------|
| `Missing or insufficient permissions` | Rules publish edilmemiş veya kural yanlış | `firestore.rules`'u tekrar publish |
| `The query requires an index` | Compound index yok | Konsola gelen linke tıkla → Create |
| `Property 'getTmdbUrl' doesn't exist` | `useImageQualitySettings()` hook scope'undan parent dışı component'e leak — props olarak geç |
| `Rendered more hooks than during the previous render` | `useCallback`/`useMemo` early return'den SONRA çağrılmış — yukarı taşı |
| Image flicker (ilk yüklemede) | Inline component definition + source `{ uri }` her render'da yeni — parent dışı `memo` + `useMemo(source)` + `recyclingKey` |

---

## 📞 Yardımcı dokümanlar

- [`FIRESTORE_SCHEMA.txt`](./FIRESTORE_SCHEMA.txt) — tam veri modeli
- [`firestore.rules`](./firestore.rules) — güvenlik kuralları
- [`README.md`](./README.md) — public proje açıklaması
- `memory-bank/` — proje hafızası (eski sistem; bu dosya onun üst seti)
- `PERFORMANS_GUNCELLEME_ADIMLARI.txt`, `MASTER_GOREV_LISTESI.txt` — planlama notları
