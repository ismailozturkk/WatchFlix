# Seelogd Firestore Database Şeması & Ağaç (Graph) Yapısı

Bu doküman, Seelogd uygulamasının tüm Firestore koleksiyonlarını, alt koleksiyonlarını (subcollections), her bir alanın kesin veri tipini (`string`, `int`, `number`, `boolean`, `timestamp`, `map`, `array<string>`, `array<object>`) ve **ağaç üzerinde birebir örnek değerleri / son yazma hallerini** eksiksiz olarak detaylandırır.

---

## 1. Tam Kapsamlı ASCII Hiyerarşi & Ağaç (Graph) Yapısı (Alanlar ve Örnek Veriler)

```text
Firestore Root
│
├── 📂 Users/{uid} (Örn: "usr_abc123xyz789")
│   │   ├── uid: string = "usr_abc123xyz789"
│   │   ├── username: string = "ismail_oz"
│   │   ├── usernameLower: string = "ismail_oz"
│   │   ├── displayName: string = "İsmail Öztürk"
│   │   ├── bio: string = "Sinema tutkunu, bilim kurgu ve gerilim hayranı 🎬🍿"
│   │   ├── avatarIndex: int = 12
│   │   │                                        // e-posta + doğum tarihi KÖKTE DEĞİL: private/account (kök belge tüm oturumlulara okunur)
│   │   ├── _schemaVersion: int = 2
│   │   ├── friendsCount: int (counter) = 42
│   │   ├── postsCount: int (counter) = 15
│   │   ├── followersCount: int (counter) = 88
│   │   ├── followingCount: int (counter) = 64
│   │   ├── pendingRequestsInCount: int (counter) = 2
│   │   ├── pendingRequestsOutCount: int (counter) = 1
│   │   ├── unreadNotifsCount: int (counter) = 3
│   │   ├── mediaCommentCount: int (counter) = 27
│   │   ├── isOnline: boolean = true
│   │   ├── lastActiveAt: timestamp = 2026-08-21T03:00:00Z
│   │   ├── lastSeen: timestamp = 2026-08-21T02:45:00Z
│   │   ├── privacy: map = {
│   │   │     profile: "public",
│   │   │     lists: "friends",
│   │   │     posts: "public",
│   │   │     onlineStatus: "everyone"
│   │   │   }
│   │   ├── listVisible: map = {
│   │   │     watchedMovies: true,
│   │   │     watchedTv: true,
│   │   │     watchList: true,
│   │   │     favorites: true
│   │   │   }
│   │   ├── fourFavorites: map = {            // "Dört favori": profil vitrini. Alan YOKSA = hiç seçilmedi
│   │   │     movies: [ { id: 27205, title: "Inception", image: "/ljsZ...jpg", year: "2010" } ],   // en fazla 4
│   │   │     shows:  [ { id: 1396,  title: "Breaking Bad", image: "/ggF...jpg", year: "2008" } ], // en fazla 4
│   │   │     people: [ { id: 2524,  title: "Tom Hardy",    image: "/yVG...jpg" } ]                // en fazla 4 (title = ad)
│   │   │   }                                  // sıra = seçilme sırası; kural: kategori başına ≤ 4 (firestore.rules → fourFavoritesOk)
│   │   │                                      // YAZAN: Profili Düzenle (Kaydet) veya tanıtımdan taşıma (services/fourFavoritesService.adoptPendingFavorites)
│   │   │                                      // OKUYAN: arkadaş profili + kendi profil kartı (privacy.profile'a tabi), Film/Dizi sekmesi "Favorilerine Göre" rayı, AI bağlamı
│   │   │                                      // Boş yapı ({movies:[],shows:[],people:[]}) "hepsini kaldırdı" demek; alanı SİLME — tanıtım kopyası geri sızar
│   │   ├── notificationSettings: map = {
│   │   │     streamingEnabled: true,
│   │   │     sound: true,
│   │   │     friendRequests: true
│   │   │   }
│   │   ├── entitlements: map = {
│   │   │     premium: true,
│   │   │     premiumUnlimited: false,
│   │   │     premiumPlan: "pro_monthly",
│   │   │     premiumProductId: "com.smlztrk.seelogd.pro.monthly",
│   │   │     premiumStore: "app_store",
│   │   │     premiumExpiresAt: 2026-09-21T00:00:00Z,
│   │   │     premiumSyncedAt: 2026-08-21T02:30:00Z,
│   │   │     premiumSource: "revenuecat"
│   │   │   }
│   │   ├── createdAt: timestamp = 2026-01-15T10:20:30Z
│   │   └── updatedAt: timestamp = 2026-08-21T03:00:00Z
│   │
│   ├── 📁 friends/{friendUid} (Örn: "usr_friend456")
│   │       ├── friendUid: string = "usr_friend456"
│   │       ├── friendName: string = "Ahmet Yılmaz"
│   │       ├── friendUsername: string = "ahmet_y"
│   │       ├── friendAvatarIndex: int = 5
│   │       └── friendsSince: timestamp = 2026-03-10T14:20:00Z
│   │
│   ├── 📁 friendRequests/{requestId} (Örn: "usr_from789_usr_abc123xyz789")
│   │       ├── fromUid: string = "usr_from789"
│   │       ├── fromName: string = "Caner Demir"
│   │       ├── fromUsername: string = "caner_d"
│   │       ├── fromAvatarIndex: int = 8
│   │       ├── status: string = "pending" | "accepted" | "declined"
│   │       ├── seen: boolean = false
│   │       ├── message: string = "Selam, filmler hakkında konuşalım!"
│   │       └── createdAt: timestamp = 2026-08-20T19:30:00Z
│   │
│   ├── 📁 sentRequests/{requestId} (Örn: "usr_abc123xyz789_usr_target999")
│   │       ├── toUid: string = "usr_target999"
│   │       ├── toName: string = "Elif Kaya"
│   │       ├── toUsername: string = "elif_k"
│   │       ├── toAvatarIndex: int = 14
│   │       ├── status: string = "pending"
│   │       └── createdAt: timestamp = 2026-08-21T01:10:00Z
│   │
│   ├── 📁 blocked/{blockedUid} (Örn: "usr_troll404")
│   │       ├── blockedAt: timestamp = 2026-07-04T11:20:00Z
│   │       └── reason: string = "spam_and_harassment"
│   │
│   ├── 📁 notifications/{notifId} (Örn: "notif_998877")
│   │       ├── type: string = "message" | "friend_request" | "post_like" | "post_comment" | "comment_reply" | "mention" | "cineswipe_invite" | "game_challenge" | ...
│   │       ├── fromUid: string = "usr_friend456"
│   │       ├── fromName: string = "Ahmet Yılmaz"
│   │       ├── fromAvatarIndex: int = 5
│   │       ├── postId: string = "post_interstellar_review"
│   │       ├── text: string = "Ahmet Yılmaz gönderini beğendi."
│   │       ├── inviteCode?: string = "123456" (CineSwipe daveti)
│   │       ├── dayKey?: string = "2026-10-22" (günlük düello daveti)
│   │       ├── response?: "accepted" | "declined" (alıcı bir kez yazar; eksikse beklemede)
│   │       ├── read: boolean = false
│   │       └── createdAt: timestamp = 2026-08-21T02:15:00Z
│   │
│   ├── 📁 following/{targetUid} (Örn: "usr_sinemaci_mert")
│   │       └── followedAt: timestamp = 2026-04-12T15:00:00Z
│   │
│   ├── 📁 followers/{followerUid} (Örn: "usr_film_gurmesi")
│   │       └── followedAt: timestamp = 2026-05-01T09:30:00Z
│   │
│   ├── 📁 likedPosts/{postId} (Örn: "post_oppenheimer_analysis_2026")
│   │       └── likedAt: timestamp = 2026-08-17T16:20:00Z
│   │
│   ├── 📁 bookmarks/{postId} (Örn: "post_best_scifi_list_2026")
│   │       └── bookmarkedAt: timestamp = 2026-08-18T11:45:00Z
│   │
│   ├── 📁 myRatings/{mediaKey} (Örn: "movie_157336")
│   │       ├── mediaType: string = "movie"
│   │       ├── mediaId: int = 157336
│   │       ├── title: string = "Interstellar"
│   │       ├── posterPath: string = "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"
│   │       ├── rating: number = 9.5
│   │       └── updatedAt: timestamp = 2026-08-19T21:40:00Z
│   │
│   ├── 📁 myComments/{commentId} (Örn: "comm_got_s8e3_review")
│   │       ├── commentId: string = "comm_got_s8e3_review"
│   │       ├── collectionName: string = "TvComment"
│   │       ├── mediaId: string = "1399"
│   │       ├── mediaTitle: string = "Game of Thrones"
│   │       ├── mediaPoster: string = "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg"
│   │       ├── text: string = "3. bölümdeki gece savaşı görsel olarak çok karanlıktı ama müzikler harikaydı!"
│   │       └── timestamp: timestamp = 2026-08-18T20:30:00Z
│   │
│   ├── 📁 conversations/{otherUid} (Örn: "usr_friend456")
│   │       ├── otherUid: string = "usr_friend456"
│   │       ├── otherName: string = "Ahmet Yılmaz"
│   │       ├── otherAvatarIndex: int = 5
│   │       ├── lastMessage: string = "Dune 2'yi izledin mi? Muazzamdı!"
│   │       ├── unreadCount: int = 0
│   │       └── timestamp: timestamp = 2026-08-21T02:50:00Z
│   │
│   ├── 📁 groupInbox/{groupId} (Örn: "grp_sinema_kulubu_2026") — grup okunmamış sayacı
│   │       └── unread: int = 2
│   │             (gönderen, mesajla AYNI batch'te diğer üyeler için increment(1)
│   │              yazar — kural yalnız TAM +1'e izin verir; üye sohbeti görünürken
│   │              kendi kaydını 0 yapar. 1-1'deki conversations.unreadCount'un karşılığı)
│   │
│   ├── 📁 private/{docId} (Örn: "push" | "account" | "entitlements") — YALNIZ sahibi okur
│   │       ├── [push]    expoPushTokens: array<string> = [ "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" ]
│   │       ├── [push]    updatedAt: timestamp = 2026-08-21T01:00:00Z
│   │       ├── [account] email: string = "ismail@example.com"
│   │       ├── [account] birthDate: string = "1998-05-14"   // "YYYY-MM-DD"; BİR KEZ yazılır (kural), yaş kapısı buradan türer
│   │       └── [account] updatedAt: timestamp               // göç: docs/mimari/KULLANICI_OZEL_ALAN_GOCU.md
│   │
│   ├── 📁 gameProfile/summary
│   │       ├── totalXp: int = 4850
│   │       ├── level: int = 14
│   │       ├── weeklyStreak: int = 5
│   │       ├── totalSessions: int = 38
│   │       ├── totalCorrect: int = 182
│   │       ├── totalWrong: int = 26
│   │       ├── achievementsCount: int = 7
│   │       ├── lastPlayedAt: string = "2026-08-20T22:10:00.000Z"
│   │       └── schemaVersion: int = 1
│   │
│   ├── 📁 gameStats/{gameId} (Örn: "scene")
│   │       ├── bestScoresByMode: map = { classic_normal: 2450, classic_hard: 1800, time_normal: 1650 }
│   │       ├── bestStreak: int = 9
│   │       ├── totalSessions: int = 38
│   │       ├── totalQuestions: int = 208
│   │       ├── totalCorrect: int = 182
│   │       ├── totalWrong: int = 26
│   │       ├── totalAnswerTimeMs: int = 124000
│   │       ├── jokerUsage: int = 14
│   │       ├── sourceStats: map = { popular: 28, top_rated: 10 }
│   │       ├── difficultyStats: map = { normal: 30, hard: 8 }
│   │       ├── updatedAt: string = "2026-08-20T22:10:00.000Z"
│   │       └── schemaVersion: int = 1
│   │
│   └── 📁 gameSessions/{sessionId} (Örn: "sess_scene_1724200000")
│           ├── gameId: string = "scene"
│           ├── modeId: string = "classic"
│           ├── difficultyId: string = "normal"
│           ├── sourceId: string = "popular"
│           ├── startedAt: string = "2026-08-20T22:05:00.000Z"
│           ├── completedAt: string = "2026-08-20T22:10:00.000Z"
│           ├── status: string = "completed"
│           ├── score: int = 1450
│           ├── correctCount: int = 9
│           ├── wrongCount: int = 1
│           ├── averageAnswerMs: int = 3400
│           ├── bestStreak: int = 6
│           ├── jokerUsage: int = 1
│           ├── gameVersion: int = 1
│           ├── resultHash: string = "sess_scene_1724200000"
│           └── schemaVersion: int = 1
│
├── 📂 chats/{chatId} (Örn: "usr_abc123_usr_friend456")
│   │   ├── participants: array<string> = [ "usr_abc123", "usr_friend456" ]
│   │   │     (EN ÜST düzey; okundu işaretiyle birlikte yazılır, hesap silme
│   │   │      `array-contains` ile bulur. Belge mesaj başına YAZILMAZ.)
│   │   ├── readAt: map<uid, timestamp> = { usr_abc123: 2026-08-21T02:50:00Z }
│   │   │     (o kişinin GÖRDÜĞÜ en yeni gelen mesajın zamanı; mavi tik bundan
│   │   │      türetilir — utils/chatReceipts.js. Sohbeti açmak tek yazım.)
│   │   └── information: map   ← ESKİ istemciler mesaj başına yazar; okunmaz.
│   │
│   ├── 📁 messages/{msgId} (Örn: "msg_chat_101")
│   │       ├── senderId: string = "usr_abc123"
│   │       ├── text: string = "Dune 2'yi izledin mi? Muazzamdı!"
│   │       ├── timestamp: timestamp = 2026-08-21T02:50:00Z
│   │       ├── status: string = "sent"   (yeni istemci başka durum YAZMAZ; eski
│   │       │     istemcilerin "delivered"/"seen" yazımları okunmaya devam eder)
│   │       ├── push: string = "server"   (sunucu push'u dağıtır — functions/socialPush.js)
│   │       ├── deliveredAt: timestamp   ← yalnız eski istemciler
│   │       ├── edited: boolean = false
│   │       ├── clientId: string = "msg_local_1724208600000_123"
│   │       ├── kind: string = "text" | "media" | "poll"
│   │       └── replyTo: map | null = null
│   │
│   └── 📁 pins/{pinId} (Örn: "msg_chat_101")
│           ├── messageId: string = "msg_chat_101"
│           ├── senderId: string = "usr_friend456"
│           ├── senderName: string = "Ahmet Yılmaz"
│           ├── preview: string = "Hafta sonu sinema buluşması saat 19:00'da Kadıköy'de."
│           ├── kind: string = "text"
│           ├── pinnedBy: string = "usr_abc123"
│           ├── pinnedByName: string = "İsmail Öztürk"
│           └── pinnedAt: timestamp = 2026-08-20T18:00:00Z
│
├── 📂 groups/{groupId} (Örn: "grp_sinema_kulubu_2026")
│   │   ├── name: string = "Kült Sinema Kulübü"
│   │   ├── color: string = "#6C63FF"
│   │   ├── avatarIndex: int = 3
│   │   ├── members: array<string> = [ "usr_abc123", "usr_friend456", "usr_caner789" ]
│   │   ├── memberInfo: map = {
│   │   │     usr_abc123: { name: "İsmail Öztürk", username: "ismail_oz", avatarIndex: 12 },
│   │   │     usr_friend456: { name: "Ahmet Yılmaz", username: "ahmet_y", avatarIndex: 5 },
│   │   │     usr_caner789: { name: "Caner Demir", username: "caner_d", avatarIndex: 8 }
│   │   │   }
│   │   ├── admins: array<string> = [ "usr_friend456" ]
│   │   ├── createdBy: string = "usr_abc123"
│   │   ├── lastMessage: string = "Bu haftanın filmini seçelim:"
│   │   ├── unread: map<uid, int> = { usr_friend456: 2 }   ← ESKİ istemciler; yeni
│   │   │     istemci yazmaz/okumaz. Sayaç artık Users/{uid}/groupInbox/{groupId}'de
│   │   │     (her sıfırlama grup belgesini tüm üyelere yeniden gönderiyordu).
│   │   │     Üye tavanı: 50 (utils/groupLimits.js + firestore.rules groupSizeOk).
│   │   ├── createdAt: timestamp = 2026-03-01T15:30:00Z
│   │   └── updatedAt: timestamp = 2026-08-21T02:00:00Z
│   │
│   ├── 📁 messages/{msgId} (Örn: "msg_grp_poll_202")
│   │       ├── senderId: string = "usr_abc123"
│   │       ├── senderName: string = "İsmail Öztürk"
│   │       ├── senderUsername: string = "ismail_oz"
│   │       ├── senderAvatarIndex: int = 12
│   │       ├── senderPhotoURL: string | null = null
│   │       ├── text: string = "Bu haftanın filmini seçelim:"
│   │       ├── timestamp: timestamp = 2026-08-21T02:00:00Z
│   │       ├── status: string = "sent"
│   │       ├── kind: string = "poll"
│   │       └── poll: map = {
│   │             question: "Bu haftanın filmi ne olsun?",
│   │             options: [ "Blade Runner 2049", "Arrival", "Interstellar" ],
│   │             votes: { usr_abc123: 0, usr_friend456: 1, usr_caner789: 0 }
│   │           }
│   │
│   └── 📁 pins/{pinId} (Örn: "msg_grp_pin_303")
│           ├── messageId: string = "msg_grp_pin_303"
│           ├── senderId: string = "usr_abc123"
│           ├── senderName: string = "İsmail Öztürk"
│           ├── preview: string = "Grup kuralları: Spoiler içeren paylaşımlarda uyarı zorunludur."
│           ├── kind: string = "text"
│           ├── pinnedBy: string = "usr_abc123"
│           ├── pinnedByName: string = "İsmail Öztürk"
│           └── pinnedAt: timestamp = 2026-03-01T16:00:00Z
│
├── 📂 Lists/{uid} (Örn: "usr_abc123")
│   │   └── customLists: array<object> = [
│   │         { listId: "list_mind_bending_scifi", name: "Akıl Yakan Bilim Kurgular", order: 0, createdAt: "2026-04-10T11:00:00.000Z" }
│   │       ]
│   │
│   ├── 📁 favorites/{type_id} (Örn: "movie_157336")
│   │       ├── id: int = 157336
│   │       ├── type: string = "movie"
│   │       ├── name: string = "Interstellar"
│   │       ├── imagePath: string = "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"
│   │       ├── dateAdded: string = "2026-02-14T20:00:00.000Z"
│   │       ├── minutes: int = 169
│   │       ├── genres: array<int> = [ 18, 878 ]
│   │       └── listOrder: int = 0
│   │
│   ├── 📁 watchList/{type_id} (Örn: "movie_872585")
│   │       ├── id: int = 872585
│   │       ├── type: string = "movie"
│   │       ├── name: string = "Oppenheimer"
│   │       ├── imagePath: string = "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg"
│   │       ├── dateAdded: string = "2026-07-20T10:00:00.000Z"
│   │       ├── minutes: int = 180
│   │       ├── genres: array<int> = [ 18, 36 ]
│   │       └── listOrder: int = 1
│   │
│   ├── 📁 watchedMovies/{type_id} (Örn: "movie_157336")
│   │       ├── id: int = 157336
│   │       ├── type: string = "movie"
│   │       ├── name: string = "Interstellar"
│   │       ├── imagePath: string = "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"
│   │       ├── dateAdded: string = "2026-02-14T20:00:00.000Z"
│   │       ├── minutes: int = 169
│   │       ├── genres: array<int> = [ 18, 878 ]
│   │       ├── listOrder: int = 1
│   │       └── watchEvents: array<object> = [
│   │             { id: "we_1707940800000", watchedAt: "2026-02-14T20:00:00.000Z", scope: "movie", recordedAt: "2026-02-14T20:00:00.000Z" },
│   │             { id: "we_1723500000000", watchedAt: "2026-08-12T21:30:00.000Z", scope: "movie", recordedAt: "2026-08-12T21:30:00.000Z" }
│   │           ]
│   │
│   ├── 📁 watchedTv/{type_id} (Örn: "tv_1399")
│   │       ├── id: int = 1399
│   │       ├── type: string = "tv"
│   │       ├── name: string = "Game of Thrones"
│   │       ├── imagePath: string = "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg"
│   │       ├── addedShowDate: string = "2026-01-20T10:00:00.000Z"
│   │       ├── genres: array<int> = [ 10765, 18, 10759 ]
│   │       ├── showEpisodeCount: int = 73
│   │       ├── showSeasonCount: int = 8
│   │       ├── watchedSeasonCount: int = 8
│   │       ├── watchedEpisodeCount: int = 73
│   │       ├── totalMinutes: int = 4380
│   │       ├── listOrder: int = 2
│   │       ├── watchEvents: array<object> = [
│   │       │     { id: "we_tv_got_full", watchedAt: "2026-05-01T00:00:00.000Z", scope: "show", episodeCount: 73, seasonCount: 8, minutes: 4380, recordedAt: "2026-05-01T00:00:00.000Z" }
│   │       │   ]
│   │       │   // Günlük 1440 dk sınırı yüzünden günlere bölünen toplu işaretlemede (docs/mimari/LISTE_IZLEME_ALTYAPISI.md)
│   │       │   // her gün ayrı olay: aynı batchId, part (1..parts) ve parts; yalnız SON parça scope "show"/"season" taşır, öncekiler "episode".
│   │       └── seasons: array<object> = [
│   │             {
│   │               seasonNumber: 1,
│   │               seasonPosterPath: "/zwaj4egrhnXOBIit1tyb4Sbt39V.jpg",
│   │               episodes: [
│   │                 { episodeNumber: 1, episodeName: "Winter Is Coming", episodePosterPath: "/9A8T6cK78PZtQeB6Q5TjXQ.jpg", episodeMinutes: 62, episodeRatings: 8.9, episodeWatchTime: "2026-01-20T11:00:00.000Z" }
│   │               ]
│   │             }
│   │           ]
│   │
│   └── 📁 customItems/{listId__type_id} (Örn: "list_mind_bending_scifi__movie_603")
│           ├── listId: string = "list_mind_bending_scifi"
│           ├── id: int = 603
│           ├── type: string = "movie"
│           ├── name: string = "The Matrix"
│           ├── imagePath: string = "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"
│           ├── dateAdded: string = "2026-04-10T11:05:00.000Z"
│           ├── minutes: int = 136
│           ├── genres: array<int> = [ 28, 878 ]
│           └── listOrder: int = 0
│
├── 📂 SharedLists/{listId} (Örn: "sh_list_maraton_2026")
│   │   ├── name: string = "Hafta Sonu Film Maratonu"
│   │   ├── ownerId: string = "usr_abc123"
│   │   ├── ownerName: string = "İsmail Öztürk"
│   │   ├── ownerUsername: string = "ismail_oz"
│   │   ├── memberIds: array<string> = [ "usr_abc123", "usr_friend456" ]
│   │   ├── members: map = {
│   │   │     usr_abc123: { name: "İsmail Öztürk", username: "ismail_oz", avatarIndex: 12, canAdd: true, canRemove: true, canReorder: true, addedAt: 1724200000000 },
│   │   │     usr_friend456: { name: "Ahmet Yılmaz", username: "ahmet_y", avatarIndex: 5, canAdd: true, canRemove: false, canReorder: true, addedAt: 1724200100000 }
│   │   │   }
│   │   ├── createdAt: timestamp = 2026-08-15T14:00:00Z
│   │   └── updatedAt: timestamp = 2026-08-20T19:00:00Z
│   │
│   └── 📁 items/{itemKey} (Örn: "movie_27205")
│           ├── id: int = 27205
│           ├── type: string = "movie"
│           ├── name: string = "Inception"
│           ├── imagePath: string = "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg"
│           ├── minutes: int = 148
│           ├── genres: array<int> = [ 28, 878, 12 ]
│           ├── dateAdded: string = "2026-08-15T14:10:00.000Z"
│           ├── listOrder: int = 0
│           ├── addedBy: string = "usr_friend456"
│           ├── addedByName: string = "Ahmet Yılmaz"
│           ├── addedByAvatarIndex: int = 5
│           └── addedAt: int (ms) = 1724200200000
│
├── 📂 MovieComment/{movieId} (Örn: "550")
│   └── 📁 comments/{commentId} (Örn: "comm_fightclub_01")
│       │   ├── userId: string = "usr_abc123"
│       │   ├── username: string = "İsmail Öztürk"
│       │   ├── userHandle: string = "ismail_oz"
│       │   ├── avatarIndex: int = 12
│       │   ├── authorPhotoURL: string | null = null
│       │   ├── text: string = "Fincher'ın anlatımı ve filmin alt metni muhteşem."
│       │   ├── isSpoiler: false
│       │   ├── parentId: null
│       │   ├── likeCount: int (counter) = 28
│       │   ├── likedBy: map = { usr_friend456: true, usr_caner789: true }
│       │   ├── replyCount: int (counter) = 3
│       │   └── timestamp: timestamp = 2026-08-10T14:00:00Z
│       │
│       └── 📁 replies/{replyId} (Örn: "rep_fightclub_01_01")
│               ├── userId: string = "usr_friend456"
│               ├── username: string = "Ahmet Yılmaz"
│               ├── userHandle: string = "ahmet_y"
│               ├── avatarIndex: int = 5
│               ├── authorPhotoURL: string | null = null
│               ├── text: string = "Özellikle son sahnedeki Where Is My Mind şarkısı unutulmaz."
│               ├── isSpoiler: true
│               ├── parentId: string = "comm_fightclub_01"
│               ├── likeCount: int (counter) = 6
│               ├── likedBy: map = { usr_abc123: true }
│               └── timestamp: timestamp = 2026-08-10T14:30:00Z
│
├── 📂 TvComment/{tvId} (Örn: "1399")
│   └── 📁 comments/{commentId} (Örn: "comm_got_s8e3_review")
│       │   ├── userId: string = "usr_abc123"
│       │   ├── username: string = "İsmail Öztürk"
│       │   ├── userHandle: string = "ismail_oz"
│       │   ├── avatarIndex: int = 12
│       │   ├── authorPhotoURL: string | null = null
│       │   ├── text: string = "3. bölümdeki gece savaşı görsel olarak çok karanlıktı ama müzikler harikaydı!"
│       │   ├── isSpoiler: boolean = true
│       │   ├── parentId: null
│       │   ├── likeCount: int (counter) = 14
│       │   ├── likedBy: map = { usr_friend456: true, usr_caner789: true }
│       │   ├── replyCount: int (counter) = 1
│       │   ├── timestamp: timestamp = 2026-08-18T20:30:00Z
│       │   ├── scope: string = "episode" | "season" | "show"
│       │   ├── seasonNumber: int = 8
│       │   ├── episodeNumber: int = 3
│       │   ├── scopeKey: string = "s8e3"
│       │   └── scopeTitle: string = "The Long Night"
│       │
│       └── 📁 replies/{replyId} (Örn: "rep_got_s8e3_01")
│               ├── userId: string = "usr_friend456"
│               ├── username: string = "Ahmet Yılmaz"
│               ├── userHandle: string = "ahmet_y"
│               ├── avatarIndex: int = 5
│               ├── authorPhotoURL: string | null = null
│               ├── text: string = "Ramin Djawadi'nin 'The Night King' parçası efsaneydi."
│               ├── isSpoiler: boolean = false
│               ├── parentId: string = "comm_got_s8e3_review"
│               ├── likeCount: int (counter) = 4
│               ├── likedBy: map = { usr_abc123: true }
│               ├── timestamp: timestamp = 2026-08-18T21:00:00Z
│               ├── scope: string = "episode"
│               ├── seasonNumber: int = 8
│               ├── episodeNumber: int = 3
│               ├── scopeKey: string = "s8e3"
│               └── scopeTitle: string = "The Long Night"
│
├── 📂 Ratings/{mediaKey} (Örn: "movie_157336")
│   │   ├── mediaType: string = "movie" | "tv"
│   │   ├── mediaId: int = 157336
│   │   ├── count: int = 1420
│   │   ├── sum: number = 12780.0
│   │   └── updatedAt: timestamp = 2026-08-21T01:15:00Z
│   │
│   └── 📁 userRatings/{uid} (Örn: "usr_abc123")
│           ├── rating: number = 9.5
│           └── updatedAt: timestamp = 2026-08-19T21:40:00Z
│
├── 📂 Posts/{postId} (Örn: "post_oppenheimer_analysis_2026")
│   │   ├── authorId: string = "usr_abc123"
│   │   ├── authorName: string = "İsmail Öztürk"
│   │   ├── authorAvatarIndex: int = 12
│   │   ├── type: string = "review" | "list" | "text" | "poll"
│   │   ├── title: string = "Oppenheimer: Sinematik Bir Başyapıt"
│   │   ├── content: string = "Nolan'ın ses kurgusu ve biyografi anlatımı mükemmel dengelenmiş. Cillian Murphy'nin oyunculuğu olağanüstü."
│   │   ├── mediaList: array<object> = [
│   │   │     { id: 872585, type: "movie", title: "Oppenheimer", poster: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", year: "2023" }
│   │   │   ]
│   │   ├── userRating: int = 5
│   │   ├── hasSpoiler: boolean = false
│   │   ├── visibility: string = "public" | "followers"
│   │   ├── likesCount: int (counter) = 38
│   │   ├── commentsCount: int (counter) = 6
│   │   ├── createdAt: timestamp = 2026-08-17T16:00:00Z
│   │   └── updatedAt: timestamp = 2026-08-17T16:00:00Z
│   │
│   ├── 📁 likes/{userId} (Örn: "usr_friend456")
│   │       ├── userId: string = "usr_friend456"
│   │       └── likedAt: timestamp = 2026-08-17T16:20:00Z
│   │
│   └── 📁 comments/{commentId} (Örn: "post_comm_01")
│           ├── authorId: string = "usr_friend456"
│           ├── authorName: string = "Ahmet Yılmaz"
│           ├── authorAvatarIndex: int = 5
│           ├── text: string = "Özellikle Trinity testi sahnesindeki sessizlik anı tüyleri diken diken ediyordu!"
│           ├── parentId: string | null = null
│           ├── likesCount: int (counter) = 5
│           ├── likedBy: map = { usr_abc123: true }
│           └── createdAt: timestamp = 2026-08-17T16:45:00Z
│
├── 📂 tournaments/{periodId} (Örn: "2026-08")
│   │   ├── periodId: string = "2026-08"
│   │   ├── monthIndex: int = 7
│   │   ├── year: int = 2026
│   │   ├── theme: string = "Bilim Kurgu Başyapıtları"
│   │   ├── themeEn: string = "Sci-Fi Masterpieces"
│   │   ├── mediaType: string = "movie"
│   │   ├── genreId: int = 878
│   │   ├── startAtMs: int = 1722470400000
│   │   ├── poolSize: int = 64
│   │   ├── nominees: array<object> = [
│   │   │     { seed: 1, id: 157336, title: "Interstellar", posterPath: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", mediaType: "movie", popularity: 185.4, voteAverage: 8.4, year: "2014" },
│   │   │     { seed: 2, id: 27205, title: "Inception", posterPath: "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg", mediaType: "movie", popularity: 142.1, voteAverage: 8.3, year: "2010" }
│   │   │   ]
│   │   ├── createdBy: string = "usr_abc123"
│   │   └── createdAt: timestamp = 2026-08-01T00:05:00Z
│   │
│   ├── 📁 votes/{voterUid} (Örn: "usr_abc123")
│   │       ├── uid: string = "usr_abc123"
│   │       ├── noms: map = { 157336: true }
│   │       ├── picks: map = { r32_1: "a", r32_2: "b", r16_1: "a" }
│   │       ├── lastKey: string = "r16_1"
│   │       └── updatedAt: timestamp = 2026-08-10T14:00:00Z
│   │
│   ├── 📁 pool/{tmdbId} (Örn: "603")
│   │       ├── title: string = "The Matrix"
│   │       ├── posterPath: string = "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"
│   │       ├── mediaType: string = "movie"
│   │       ├── popularity: number = 98.6
│   │       ├── voteAverage: number = 8.2
│   │       ├── year: string = "1999"
│   │       ├── addedBy: string = "usr_caner789"
│   │       └── addedAt: timestamp = 2026-08-03T18:20:00Z
│   │
│   └── 📁 agg/tallies
│           ├── noms: map = { 157336: 48, 27205: 41, 603: 29 }
│           ├── picks: map = { r32_1: { a: 120, b: 35 }, r32_2: { a: 95, b: 60 } }
│           └── voters: int = 155
│
├── 📂 tournamentWinners/{periodId} (Örn: "2026-07")
│       ├── periodId: string = "2026-07"
│       ├── theme: string = "Efsane Gerilim Filmleri"
│       ├── winner: map = { id: 680, title: "Pulp Fiction", posterPath: "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg", mediaType: "movie", seed: 1, totalVotes: 412 }
│       ├── runnerUp: map = { id: 807, title: "Se7en", posterPath: "/6yoghtyTpznpBik8EngEmJskVUO.jpg", mediaType: "movie", seed: 3, totalVotes: 389 }
│       ├── semiFinalists: array<object> = [
│       │     { id: 274, title: "The Silence of the Lambs", posterPath: "/uS9m8OBk1A8eM9I042bx8XXpqAq.jpg", mediaType: "movie", seed: 2, totalVotes: 290 }
│       │   ]
│       └── archivedAt: timestamp = 2026-08-01T00:00:00Z
│
├── 📂 CineRooms/{roomId} (Örn: "room_749215_1724200000")
│       ├── roomId: string = "room_749215_1724200000"
│       ├── roomCode: string = "749215"
│       ├── hostUid: string = "usr_abc123"
│       ├── hostName: string = "İsmail Öztürk"
│       ├── hostAvatar: string | null = null
│       ├── guestUid: string = "usr_friend456"
│       ├── guestName: string = "Ahmet Yılmaz"
│       ├── guestAvatar: string | null = null
│       ├── status: string = "active" | "waiting" | "finished"
│       ├── targetCount: int = 20
│       ├── category: string = "trending"
│       ├── deck: array<object> = [
│       │     { id: 157336, title: "Interstellar", original_title: "Interstellar", mediaType: "movie", poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", backdrop_path: "/xJHokMbljvjADYdit5fK5VQsXEG.jpg", release_date: "2014-11-05", vote_average: 8.4, overview: "İnsanlığın geleceği tehlikedeyken kaşifler yeni bir gezegen arar." }
│       │   ]
│       ├── swipes: map = { 157336: { usr_abc123: "like", usr_friend456: "like" } }
│       ├── matches: array<object> = [
│       │     { id: 157336, title: "Interstellar", poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg" }
│       │   ]
│       └── createdAt: timestamp = 2026-08-21T01:30:00Z
│
├── 📂 GameLeaderboards/{boardId} (Örn: "scene_classic_normal")
│   └── 📁 entries/{uid} (Örn: "usr_abc123")
│           ├── uid: string = "usr_abc123"
│           ├── displayNameSnapshot: string = "İsmail Öztürk"
│           ├── avatarIndexSnapshot: int = 12
│           ├── score: int = 2450
│           ├── correctCount: int = 15
│           ├── totalAnswerMs: int = 42000
│           ├── jokerCount: int = 2
│           ├── achievedAt: string = "2026-08-20T22:10:00.000Z"
│           ├── verified: boolean = false
│           ├── gameVersion: int = 1
│           └── schemaVersion: int = 1
│
├── 📂 SceneGame/{uid} (Örn: "usr_abc123")
│       ├── score: int = 1450
│       ├── bestScore: int = 2450
│       ├── bestScoresByMode: map = { classic_normal: 2450, classic_hard: 1800, time_normal: 1650 }
│       ├── bestStreak: int = 9
│       ├── totalCorrect: int = 182
│       ├── totalWrong: int = 26
│       ├── totalPlayed: int = 38
│       ├── totalXp: int = 4850
│       ├── totalJokersUsed: int = 14
│       ├── lastPlayedAt: string = "2026-08-20T22:10:00.000Z"
│       ├── lastModeId: string = "classic"
│       ├── lastDifficultyId: string = "normal"
│       └── updatedAt: string = "2026-08-20T22:10:00.000Z"
│
├── 📂 SceneGameHistory/{uid} (Örn: "usr_abc123")
│       ├── historyBySource: map = {
│       │     popular: [ 157336, 27205, 603, 872585, 680 ],
│       │     top_rated: [ 278, 238, 424, 129 ]
│       │   }
│       └── updatedAt: string = "2026-08-20T22:10:00.000Z"
│
├── 📂 Notes/{uid} (Örn: "usr_abc123")
│   └── 📁 items/{noteId} (Örn: "note_maraton_plani")
│           ├── id: string = "note_maraton_plani"
│           ├── type: string = "todo" | "note"
│           ├── title: string = "Nolan Maratonu İzleme Sırası"
│           ├── content: string = ""
│           ├── todos: array<object> = [
│           │     { id: "td_1", text: "Memento (2000)", done: true },
│           │     { id: "td_2", text: "The Prestige (2006)", done: true },
│           │     { id: "td_3", text: "Inception (2010)", done: false },
│           │     { id: "td_4", text: "Interstellar (2014)", done: false }
│           │   ]
│           ├── color: string = "#6C63FF"
│           ├── backgroundColor: string = "#1E1E2E"
│           ├── scheduledDate: string = "2026-08-25"
│           ├── scheduledTime: string|null = "14:30"   (yerel "HH:MM"; yoksa 09:00 — utils/noteReminders.js)
│           ├── createdAt: int (ms) = 1724000000000
│           └── updatedAt: int (ms) = 1724100000000
│
├── 📂 Reminders/{uid} (Örn: "usr_abc123")
│   ├── 📁 movies/{movieId} (Örn: "1022789")
│   │       ├── movieId: int = 1022789
│   │       ├── movieTitle: string = "Inside Out 2"
│   │       ├── moviePosterPath: string = "/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg"
│   │       ├── movieReleaseDate: string = "2026-09-15"
│   │       └── addedAt: int (ms) = 1724200000000
│   │
│   └── 📁 tvShows/{showId} (Örn: "94997")
│       │   ├── showId: int = 94997
│       │   ├── showName: string = "House of the Dragon"
│       │   └── showPosterPath: string = "/1X4h40fcB4WWUmIBK0auT4zRBAV.jpg"
│       │
│       └── 📁 episodes/{episodeId} (Örn: "94997-2-1")
│               ├── episodeId: string = "94997-2-1"
│               ├── showId: int = 94997
│               ├── showName: string = "House of the Dragon"
│               ├── showPosterPath: string = "/1X4h40fcB4WWUmIBK0auT4zRBAV.jpg"
│               ├── seasonNumber: int = 2
│               ├── seasonPosterPath: string = "/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg"
│               ├── episodeNumber: int = 1
│               ├── episodeName: string = "A Son for a Son"
│               ├── episodeAirDate: string = "2026-08-30"
│               ├── episodeOverview: string = "Rhaenyra ve Daemon intikam planları yaparken King's Landing'de gerilim tırmanır."
│               └── episodeStillPath: string = "/b95p88NlY19R1e8Q0d6K21Xw.jpg"
│
├── 📂 AiUsage/{uid} (Örn: "usr_abc123")
│       ├── dailyKey: string = "2026-08-21"
│       ├── dailyCount: int = 4
│       ├── monthKey: string = "2026-08"
│       ├── monthlyCount: int = 42
│       ├── plan: string = "premium" | "free" | "unlimited"
│       ├── dailyLimit: int = 20
│       ├── monthlyLimit: int = 300
│       ├── date: string = "2026-08-21"
│       ├── count: int = 4
│       ├── limit: int = 20
│       └── updatedAt: timestamp = 2026-08-21T02:40:00Z
│
├── 📂 ProviderWatch/{uid} (Örn: "usr_abc123")
│       ├── region: string = "TR"
│       ├── items: map = {
│       │     movie_157336: { a: [ 8, 119 ], n: [ 8 ] },
│       │     tv_1399: { a: [ 384 ], n: [ 384 ] }
│       │   }
│       └── updatedAt: timestamp = 2026-08-20T18:00:00Z
│
├── 📂 AppConfig/{docId} (Örn: "oscar")
│       ├── totalYears: int = 57
│       ├── updatedAt: int (ms) = 1724000000000
│       └── items: array<object> = [
│             {
│               year: 2024,
│               ceremony: "96th Academy Awards",
│               categories: {
│                 best_picture: {
│                   winner: { id: 872585, title: "Oppenheimer", posterPath: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" },
│                   nominees: [ { id: 466420, title: "Killers of the Flower Moon" }, { id: 792307, title: "Poor Things" } ]
│                 }
│               }
│             }
│           ]
│
├── 📂 Usernames/{usernameLower} (Örn: "ismail_oz")
│       ├── uid: string = "usr_abc123"
│       └── reservedAt: timestamp = 2026-01-15T10:20:30Z
│
├── 📂 PostReports/{reportId} (Örn: "rep_post_101")
│       ├── postId: string = "post_spam_link_123"
│       ├── postAuthorId: string = "usr_troll404"
│       ├── reporterId: string = "usr_abc123"
│       ├── reason: string = "spam_advertising"
│       └── createdAt: timestamp = 2026-08-21T00:30:00Z
│
├── 📂 ContentReports/{reportId} (Örn: "rep_comm_202")
│       ├── type: string = "comment" | "message" | "user"
│       ├── targetPath: string = "MovieComment/550/comments/comm_hate_speech_789"
│       ├── targetPreview: string = "Burada uygunsuz ve hakaret içeren bir metin vardı..."
│       ├── targetUserId: string = "usr_troll404"
│       ├── reporterId: string = "usr_abc123"
│       ├── reason: string = "harassment"
│       └── createdAt: timestamp = 2026-08-21T01:00:00Z
│
├── 📂 waitlist/{emailHash} (Örn: "aXNtYWlsQGV4YW1wbGUuY29t")
│       ├── email: string = "ismail@example.com"
│       ├── queueNo: int = 1420
│       ├── source: string = "landing"
│       └── createdAt: timestamp = 2026-08-01T12:00:00Z
│
├── 📂 meta/{docId} (Örn: "waitlist")
│       └── count: int = 1420
│
├── 📂 Presence/{uid} (Örn: "usr_abc123")
│       ├── isOnline: boolean = true
│       ├── lastActiveAt: timestamp = 2026-08-21T03:00:00Z
│       └── lastSeen: timestamp = 2026-08-21T02:45:00Z
│
├── 📂 RevenueCatWebhookEvents/{eventKey} (Örn: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
│       ├── eventId: string = "evt_rc_9988776655"
│       ├── type: string = "INITIAL_PURCHASE"
│       ├── appUserId: string = "usr_abc123"
│       └── processedAt: timestamp = 2026-08-21T02:30:00Z
│
└── 📂 UserStats/{uid} (Örn: "usr_abc123")
        ├── movieCount: int = 142
        ├── totalMovieMinutes: int = 18450
        ├── tvCount: int = 18
        ├── totalTvMinutes: int = 24300
        └── genreCounts: map = { 28: 45, 878: 68, 18: 52 }
```

---

## 2. Varlıklar Arası İlişkiler & Anahtar Türetme Tablosu

| Varlık / Koleksiyon | Anahtar Biçimi (Doc ID) | Türetim Mantığı | İlişkili Olduğu Varlıklar |
| :--- | :--- | :--- | :--- |
| `Users` | `{uid}` | Firebase Auth UID | Tüm kişisel verilerin ana kökü |
| `Usernames` | `{usernameLower}` | `username.toLowerCase()` | `Users/{uid}` |
| `chats` | `{chatId}` | `[uid1, uid2].sort().join('_')` | 2 x `Users/{uid}` |
| `groups` | `{groupId}` | Auto ID | N x `Users/{uid}` (`members`) |
| `SharedLists` | `{listId}` | Auto ID | 1 x `Users/{ownerId}`, N x `Users/{memberIds}` |
| `Lists (items)` | `${type}_${id}` | Örn: `movie_550` veya `tv_1399` | `Lists/{uid}`, TMDB |
| `Lists (custom)` | `${listId}__${type}_${id}` | Özel liste ID + Medya ID | `Lists/{uid}` |
| `Ratings` | `${mediaType}_${mediaId}` | Örn: `movie_550` | `Ratings/.../userRatings/{uid}`, TMDB |
| `MovieComment` | `{movieId}` | TMDB Movie ID | `MovieComment/.../comments/{commentId}` |
| `TvComment` | `{tvId}` | TMDB TV ID | `TvComment/.../comments/{commentId}` |
| `tournaments` | `{periodId}` | `YYYY-MM` (örn: `2026-08`) | `tournaments/.../votes/{uid}`, `pool/{tmdbId}` |
| `tournamentWinners`| `{periodId}` | `YYYY-MM` | `tournaments/{periodId}` |
| `CineRooms` | `room_${code}_${ms}`| 6 haneli kod + Timestamp | `hostUid`, `guestUid` (`Users`) |
| `GameLeaderboards`| `scene_${mode}_${difficulty}` | Örn: `scene_classic_normal` | `entries/{uid}` (`Users`) |
| `ProviderWatch` | `{uid}` | Auth UID | `Lists/{uid}/watchList` |
| `AiUsage` | `{uid}` | Auth UID | `Users/{uid}.entitlements` |

---

## 3. Ek (21 Ekim 2026): yukarıdaki ağaca SONRADAN eklenen koleksiyonlar + hesap silme eşlemesi

Ağaç (bölüm 1) 15 Ekim öncesini anlatır; sonrasında eklenenler aşağıdadır. Kurallar: `firestore.rules`; hesap silme: `functions/accountPurge.js`.

| Yol | Alanlar (özet) | Kim yazar / okur | Hesap silmede |
|---|---|---|---|
| `Users/{uid}/socialLinks/links` | `{ links: { instagram, x, tiktok, youtube, twitch, letterboxd, snapchat, threads }, updatedAt }` — yalnız KULLANICI ADI | sahibi yazar (`socialLinksDocumentOk`); okuma `Users/{uid}.privacy.socialLinks` ('public' \| 'friends' \| 'private') kuralına tabi. `privacy.showSocialLinksOnOwnProfile` yalnız sahibin kendi profil sekmesindeki şeridi gizler | `user-tree` (profil aşaması) |
| `Users/{uid}.socialLinks` (eski) | aynı harita — kökte herkese açık eski kopya; sahibinin uygulaması açılınca alt belgeye taşınır ve silinir (`migrateRootSocialLinks`) | yalnız `privacy.socialLinks == 'public'` iken yazılabilir (`socialLinksOk`) | `user-tree` |
| `Users/{uid}/private/{account,push,entitlements}` | e-posta + doğum tarihi / push jetonu / plan ayrıntısı | yalnız sahibi (entitlements'ı yalnız sunucu yazar) | `user-tree` |
| `MediaNotes/{uid}/items/{id}` | film/dizi sayfasına bağlı notlar | sahibi (yerel-öncelikli, `services/userData`) | `root MediaNotes` |
| `AiConversations/{uid}/items/{id}` | CineMatch sohbet geçmişi | sahibi | `root AiConversations` |
| `PosterChoices/{uid}` (TEK belge, 25 Eki) | `{ id: "all", choices: { "movie_603": "/x.jpg" } (afiş), backdrops: { "movie_603": "/b.jpg" } (arka plan), updatedAt }` — harita başına en çok 500 seçim; yalnız TMDB yolu | sahibi yazar (yerel-öncelikli, `services/userData`; Premium kapısı istemcide); okuma `canReadLists` ile aynı (arkadaş profili sahibin afişini görür, yalnız sahibin `entitlements` planı izin verirse çizilir) | `root PosterChoices` |
| `Feedback/{id}` | `uid, kind, category, severity, title, message, status, language, createdAt` (+ isteğe bağlı `appVersion, platform, osVersion, deviceModel`; `reply` konsoldan) | sahibi create + kendi kaydını okur; durum/yanıt konsoldan | `feedback` (chats… `records` aşaması) |
| `ReferralAccounts/{uid}`, `ReferralCodes/{code}`, `Referrals/{inviteeUid}` | davet kodu, biriken aylar, davet bağı (`inviterUid`) | YALNIZ Cloud Functions (kurallar kapalı) | `referral` (`records`) |
| `PromoCodes/{code}` + `redemptions/{uid}` | promosyon kodu, plan (Premium / Premium Max), kullanım | YALNIZ Cloud Functions | `promo-redemptions` (`records`) |
| `GameLeaderboards/scene_daily_{gün}/entries/{uid}` | günlük meydan okuma girdisi (`uid, score, correctCount, …`) | sahibi | `sweep-leaderboard-entries` (`games`) |
| `tournaments/{dönem}/votes/{uid}` | `noms`, `picks` | sahibi create; silme kural gereği KAPALI | `tournament-votes` (`games`, Admin ile) |
| `CineRooms/{id}` | `hostUid`, `guestUid`, deste, oylar | taraflar; sonuç teslimi/24 saatte sunucu siler | `cine-rooms` (`games`) |
| `ContentReports/{id}`, `PostReports/{id}` | `reporterId`, `targetUserId`… | yalnız create | `reporterId → "deleted-user"`; hakkımdaki `ContentReports` silinir |

### Hesap silme akışı (özet)

`deleteAccount()` (istemci) → `deleteAccountData` callable'ı **7 aşamayla**, sırayla: `social → comments → content → chats → games → records → profile`
(`profile` EN SON: aynaları — `myComments`, `likedPosts`, `myRatings`, `conversations` — taşıyan `Users/{uid}` ağacını siler). Sonra `deleteUser`;
Auth kullanıcısı silinince `purgeOnAuthUserDeleted` bir kez daha süpürür. Sunucuya ulaşılamazsa `services/accountService.js` istemci yedeği
(kurallara tabi) çalışır. Yeni koleksiyon eklenince: `accountPurge.js` + `accountPurge.integration.test.js` + `website/delete-account.html` + bu tablo.
