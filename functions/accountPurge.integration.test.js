// Hesap silme (sunucu) — GERÇEK Firestore (emülatör) üzerinde uçtan uca.
//
// `npm test` içinde ATLANIR (emülatör yoksa); çalıştırmak için kökten:
//   export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" PATH="$JAVA_HOME/bin:$PATH"
//   npx firebase emulators:exec --only firestore --project demo-purge \
//     "node --test functions/accountPurge.integration.test.js"
//
// Kanıtladığı: kullanıcının HER izi gider (kuralların istemciye kapattıkları dahil:
// başkasının gönderisindeki beğeni, günlük liderlik, turnuva oyu, başkalarının gelen
// kutusundaki bildirim, geri bildirim, davet kayıtları, adı bilinmeyen alt koleksiyonlar)
// ve BAŞKALARININ verisi yerinde kalır, sayaçlar tutarlı düşer.

const test = require("node:test");
const assert = require("node:assert/strict");

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const skip = emulator ? false : "FIRESTORE_EMULATOR_HOST yok (emülatör gerekir)";

let db;
let purgeAccountData;
let PURGE_PHASES;
const ME = "me_uid";
const FRIEND = "friend_uid";
const OTHER = "other_uid";

async function exists(path) {
  return (await db.doc(path).get()).exists;
}
async function listIds(path) {
  return (await db.collection(path).get()).docs.map((d) => d.id).sort();
}

async function seed() {
  const set = (path, data) => db.doc(path).set(data);

  // Profiller + sayaçlar
  await set(`Users/${ME}`, { usernameLower: "memyself", friendsCount: 1 });
  await set(`Users/${FRIEND}`, {
    usernameLower: "friendly",
    friendsCount: 1,
    followersCount: 1,
    followingCount: 1,
    pendingRequestsOutCount: 1,
    pendingRequestsInCount: 1,
  });
  await set(`Users/${OTHER}`, { usernameLower: "other", friendsCount: 5 });
  await set(`Usernames/memyself`, { uid: ME });
  await set(`Usernames/friendly`, { uid: FRIEND });

  // Kendi alt koleksiyonları — biri HİÇ bilinmeyen bir ad (recursiveDelete kanıtı).
  await set(`Users/${ME}/friends/${FRIEND}`, { uid: FRIEND });
  await set(`Users/${FRIEND}/friends/${ME}`, { uid: ME });
  await set(`Users/${ME}/followers/${FRIEND}`, {});
  await set(`Users/${FRIEND}/following/${ME}`, {});
  await set(`Users/${ME}/following/${FRIEND}`, {});
  await set(`Users/${FRIEND}/followers/${ME}`, {});
  await set(`Users/${ME}/friendRequests/${FRIEND}_${ME}`, { fromUid: FRIEND, status: "pending" });
  await set(`Users/${FRIEND}/sentRequests/${FRIEND}_${ME}`, { toUid: ME, status: "pending" });
  await set(`Users/${ME}/sentRequests/${ME}_${FRIEND}`, { toUid: FRIEND, status: "pending" });
  await set(`Users/${FRIEND}/friendRequests/${ME}_${FRIEND}`, { fromUid: ME, status: "pending" });
  await set(`Users/${ME}/private/push`, { token: "x" });
  await set(`Users/${ME}/private/entitlements`, { plan: "premium" });
  await set(`Users/${ME}/gameStats/g1`, { n: 1 });
  await set(`Users/${ME}/brandNewUnknownSubcollection/a`, { n: 1 });
  await set(`Users/${ME}/conversations/${FRIEND}`, {});
  await set(`Users/${FRIEND}/conversations/${ME}`, {});

  // Başkalarının gelen kutusundaki bildirimlerim + onların bana bıraktığı
  await set(`Users/${FRIEND}/notifications/n1`, { fromUid: ME });
  await set(`Users/${OTHER}/notifications/n2`, { fromUid: ME });
  await set(`Users/${FRIEND}/notifications/keep`, { fromUid: OTHER });
  await set(`Users/${ME}/notifications/mine`, { fromUid: FRIEND });

  // Gönderiler: kendi postum (alt ağaçla), başkasının postuna yorum + beğeni
  await set(`Posts/p_mine`, { authorId: ME, likesCount: 1, commentsCount: 1 });
  await set(`Posts/p_mine/likes/${FRIEND}`, { userId: FRIEND });
  await set(`Posts/p_mine/comments/c1`, { authorId: FRIEND });
  await set(`Posts/p_other`, { authorId: OTHER, likesCount: 3, commentsCount: 4 });
  await set(`Posts/p_other/likes/${ME}`, { userId: ME });
  await set(`Posts/p_other/likes/${FRIEND}`, { userId: FRIEND });
  await set(`Users/${ME}/likedPosts/p_other`, {});
  await set(`Posts/p_other/comments/mc`, { authorId: ME });
  await set(`Posts/p_other/comments/mc_reply`, { authorId: OTHER, parentId: "mc" });
  await set(`Posts/p_other/comments/keepc`, { authorId: OTHER });
  await set(`Users/${ME}/myComments/mc`, { kind: "post", targetId: "p_other" });

  // Film yorumları: yorumum (başkasının yanıtı altında), başkasının yorumuna yanıtım
  await set(`MovieComment/603/comments/mm`, { userId: ME });
  await set(`MovieComment/603/comments/mm/replies/r_other`, { userId: OTHER });
  await set(`MovieComment/603/comments/theirs`, { userId: OTHER, replyCount: 2 });
  await set(`MovieComment/603/comments/theirs/replies/r_me`, { userId: ME });
  await set(`MovieComment/603/comments/theirs/replies/r_keep`, { userId: OTHER });
  await set(`Users/${ME}/myComments/mm`, { kind: "movie", targetId: 603 });
  await set(`Users/${ME}/myComments/r_me`, {
    kind: "movie",
    targetId: 603,
    parentId: "theirs",
  });

  // Puanlar
  await set(`Ratings/movie_603`, { count: 2, sum: 15 });
  await set(`Ratings/movie_603/userRatings/${ME}`, { rating: 8 });
  await set(`Ratings/movie_603/userRatings/${OTHER}`, { rating: 7 });
  await set(`Users/${ME}/myRatings/movie_603`, { mediaType: "movie", mediaId: 603 });

  // Kişisel kökler (Lists'in iç içe, bilinmeyen alt koleksiyonuyla)
  await set(`Lists/${ME}`, { a: 1 });
  await set(`Lists/${ME}/watchedTv/tv_1/seasons/s1`, { a: 1 });
  await set(`Lists/${ME}/wrapped/2025`, { a: 1 });
  await set(`Lists/${ME}/someFutureList/x`, { a: 1 });
  await set(`Notes/${ME}/items/n`, {});
  await set(`MediaNotes/${ME}/items/n`, {});
  await set(`AiConversations/${ME}/items/n`, {});
  await set(`PosterChoices/${ME}`, { id: "all", choices: { movie_1: "/a.jpg" } });
  await set(`Reminders/${ME}/tvShows/9/episodes/e1`, {});
  await set(`Reminders/${ME}/movies/m1`, {});
  await set(`UserStats/${ME}`, {});
  await set(`SceneGame/${ME}`, {});
  await set(`SceneGameHistory/${ME}`, {});
  await set(`Presence/${ME}`, {});
  await set(`AiUsage/${ME}`, {});
  await set(`ProviderWatch/${ME}`, {});
  await set(`Lists/${OTHER}`, { keep: true });

  // Liderlik (günlük tahta dahil), turnuva oyu, oda
  await set(`GameLeaderboards/scene_daily_2026-10-20/entries/${ME}`, { uid: ME, score: 5 });
  await set(`GameLeaderboards/scene_classic_easy/entries/${ME}`, { uid: ME, score: 9 });
  await set(`GameLeaderboards/scene_daily_2026-10-20/entries/${OTHER}`, { uid: OTHER, score: 7 });
  await set(`tournaments/2026-10`, { createdBy: OTHER });
  await set(`tournaments/2026-10/votes/${ME}`, { uid: ME });
  await set(`tournaments/2026-10/votes/${OTHER}`, { uid: OTHER });
  await set(`CineRooms/room_host`, { hostUid: ME });
  await set(`CineRooms/room_guest`, { hostUid: OTHER, guestUid: ME });
  await set(`CineRooms/room_other`, { hostUid: OTHER });

  // Sohbetler / gruplar / ortak listeler
  await set(`chats/${ME}_${FRIEND}`, { participants: [ME, FRIEND] });
  await set(`chats/${ME}_${FRIEND}/messages/m1`, { senderId: ME });
  await set(`chats/${ME}_${FRIEND}/pins/p1`, {});
  await set(`chats/${OTHER}_${FRIEND}`, { participants: [OTHER, FRIEND] });
  await set(`groups/g_shared`, {
    members: [ME, FRIEND],
    admins: [ME],
    createdBy: ME,
    memberInfo: { [ME]: {}, [FRIEND]: {} },
  });
  await set(`groups/g_shared/messages/gm1`, { senderId: ME });
  await set(`groups/g_shared/messages/gm2`, { senderId: FRIEND });
  await set(`groups/g_alone`, { members: [ME], admins: [ME], createdBy: ME });
  await set(`groups/g_alone/messages/x`, { senderId: ME });
  await set(`groups/g_left`, { members: [FRIEND], createdBy: FRIEND });
  await set(`groups/g_left/messages/old`, { senderId: ME });
  await set(`SharedLists/sl_mine`, { ownerId: ME, memberIds: [ME, FRIEND], members: {} });
  await set(`SharedLists/sl_mine/items/i1`, { addedBy: FRIEND });
  await set(`SharedLists/sl_theirs`, {
    ownerId: FRIEND,
    memberIds: [FRIEND, ME],
    members: { [ME]: { canAdd: true }, [FRIEND]: {} },
  });
  await set(`SharedLists/sl_theirs/items/mine`, { addedBy: ME });
  await set(`SharedLists/sl_theirs/items/theirs`, { addedBy: FRIEND });

  // Geri bildirim / şikayet / davet / promosyon
  await set(`Feedback/f1`, { uid: ME, text: "hi" });
  await set(`Feedback/f2`, { uid: OTHER, text: "keep" });
  await set(`PostReports/r1`, { reporterId: ME, postId: "p_other" });
  await set(`ContentReports/cr1`, { reporterId: ME, targetUserId: OTHER });
  await set(`ContentReports/cr2`, { reporterId: OTHER, targetUserId: ME });
  await set(`ReferralAccounts/${ME}`, { code: "ABC123" });
  await set(`ReferralCodes/ABC123`, { ownerUid: ME });
  await set(`Referrals/${ME}`, { inviterUid: FRIEND });
  await set(`Referrals/${FRIEND}`, { inviterUid: ME });
  await set(`Referrals/${OTHER}`, { inviterUid: FRIEND });
  await set(`PromoCodes/WELCOME`, { max: 10 });
  await set(`PromoCodes/WELCOME/redemptions/${ME}`, {});
  await set(`PromoCodes/WELCOME/redemptions/${OTHER}`, {});
}

test.before(async () => {
  if (skip) return;
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-purge";
  const { initializeApp } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
  ({ purgeAccountData, PURGE_PHASES } = require("./accountPurge"));
  await seed();
});

test("sunucu silmesi tüm izleri götürür, başkalarının verisini ve sayaçları korur", { skip }, async () => {
  const warnings = [];
  // İstemcinin yaptığı gibi: aşamalar TEK TEK, sırayla (ilerleme çubuğu bunu çizer).
  const failed = [];
  for (const phase of PURGE_PHASES) {
    const result = await purgeAccountData(
      { db, rtdb: null, warn: (m) => warnings.push(m) },
      ME,
      { phase },
    );
    failed.push(...result.failed);
  }
  assert.deepEqual(failed, [], warnings.join("\n"));

  // Kökler ve bilinmeyen alt koleksiyonlar
  for (const path of [
    `Users/${ME}`,
    `Users/${ME}/private/push`,
    `Users/${ME}/private/entitlements`,
    `Users/${ME}/gameStats/g1`,
    `Users/${ME}/brandNewUnknownSubcollection/a`,
    `Users/${ME}/notifications/mine`,
    `Lists/${ME}`,
    `Lists/${ME}/watchedTv/tv_1/seasons/s1`,
    `Lists/${ME}/wrapped/2025`,
    `Lists/${ME}/someFutureList/x`,
    `Notes/${ME}/items/n`,
    `MediaNotes/${ME}/items/n`,
    `AiConversations/${ME}/items/n`,
    `PosterChoices/${ME}`,
    `Reminders/${ME}/tvShows/9/episodes/e1`,
    `Reminders/${ME}/movies/m1`,
    `UserStats/${ME}`,
    `SceneGame/${ME}`,
    `SceneGameHistory/${ME}`,
    `Presence/${ME}`,
    `AiUsage/${ME}`,
    `ProviderWatch/${ME}`,
    `Usernames/memyself`,
  ]) {
    assert.equal(await exists(path), false, `${path} silinmeliydi`);
  }
  assert.equal(await exists(`Lists/${OTHER}`), true);
  assert.equal(await exists(`Usernames/friendly`), true);

  // Karşılıklı izler + sayaçlar
  assert.equal(await exists(`Users/${FRIEND}/friends/${ME}`), false);
  assert.equal(await exists(`Users/${FRIEND}/following/${ME}`), false);
  assert.equal(await exists(`Users/${FRIEND}/followers/${ME}`), false);
  assert.equal(await exists(`Users/${FRIEND}/sentRequests/${FRIEND}_${ME}`), false);
  assert.equal(await exists(`Users/${FRIEND}/friendRequests/${ME}_${FRIEND}`), false);
  assert.equal(await exists(`Users/${FRIEND}/conversations/${ME}`), false);
  const friend = (await db.doc(`Users/${FRIEND}`).get()).data();
  assert.equal(friend.friendsCount, 0);
  assert.equal(friend.followingCount, 0);
  assert.equal(friend.followersCount, 0);
  assert.equal(friend.pendingRequestsOutCount, 0);
  assert.equal(friend.pendingRequestsInCount, 0);
  assert.equal((await db.doc(`Users/${OTHER}`).get()).data().friendsCount, 5);

  // Başkalarının gelen kutusundaki bildirimlerim
  assert.deepEqual(await listIds(`Users/${FRIEND}/notifications`), ["keep"]);
  assert.deepEqual(await listIds(`Users/${OTHER}/notifications`), []);

  // Gönderiler: kendi postum alt ağaçla gider; başkasının postundaki beğeni/yorum izlerim gider
  assert.equal(await exists(`Posts/p_mine`), false);
  assert.equal(await exists(`Posts/p_mine/likes/${FRIEND}`), false);
  assert.equal(await exists(`Posts/p_mine/comments/c1`), false);
  assert.deepEqual(await listIds(`Posts/p_other/likes`), [FRIEND]);
  assert.deepEqual(await listIds(`Posts/p_other/comments`), ["keepc"]);
  const pOther = (await db.doc(`Posts/p_other`).get()).data();
  assert.equal(pOther.likesCount, 2);
  assert.equal(pOther.commentsCount, 2); // 4 − (yorumum + onun yanıtı)

  // Medya yorumları
  assert.equal(await exists(`MovieComment/603/comments/mm`), false);
  assert.equal(await exists(`MovieComment/603/comments/mm/replies/r_other`), false);
  assert.deepEqual(await listIds(`MovieComment/603/comments/theirs/replies`), ["r_keep"]);
  assert.equal((await db.doc(`MovieComment/603/comments/theirs`).get()).data().replyCount, 1);

  // Puan agregatı
  assert.equal(await exists(`Ratings/movie_603/userRatings/${ME}`), false);
  assert.equal(await exists(`Ratings/movie_603/userRatings/${OTHER}`), true);
  const agg = (await db.doc(`Ratings/movie_603`).get()).data();
  assert.equal(agg.count, 1);
  assert.equal(agg.sum, 7);

  // Liderlik, turnuva, odalar
  assert.deepEqual(await listIds(`GameLeaderboards/scene_daily_2026-10-20/entries`), [OTHER]);
  assert.equal(await exists(`GameLeaderboards/scene_classic_easy/entries/${ME}`), false);
  assert.deepEqual(await listIds(`tournaments/2026-10/votes`), [OTHER]);
  assert.equal(await exists(`tournaments/2026-10`), true);
  assert.deepEqual(await listIds(`CineRooms`), ["room_other"]);

  // Sohbetler
  assert.equal(await exists(`chats/${ME}_${FRIEND}`), false);
  assert.equal(await exists(`chats/${ME}_${FRIEND}/messages/m1`), false);
  assert.equal(await exists(`chats/${ME}_${FRIEND}/pins/p1`), false);
  assert.equal(await exists(`chats/${OTHER}_${FRIEND}`), true);

  // Gruplar: devir + mesajlar; yalnız bendeki grup tamamen gider; ayrıldığım gruptaki eski mesajım gider
  const shared = (await db.doc(`groups/g_shared`).get()).data();
  assert.deepEqual(shared.members, [FRIEND]);
  assert.equal(shared.createdBy, FRIEND);
  assert.equal(shared.admins.includes(ME), false);
  assert.equal(shared.memberInfo[ME], undefined);
  assert.deepEqual(await listIds(`groups/g_shared/messages`), ["gm2"]);
  assert.equal(await exists(`groups/g_alone`), false);
  assert.equal(await exists(`groups/g_alone/messages/x`), false);
  assert.deepEqual(await listIds(`groups/g_left/messages`), []);

  // Ortak listeler
  assert.equal(await exists(`SharedLists/sl_mine`), false);
  assert.equal(await exists(`SharedLists/sl_mine/items/i1`), false);
  const slTheirs = (await db.doc(`SharedLists/sl_theirs`).get()).data();
  assert.deepEqual(slTheirs.memberIds, [FRIEND]);
  assert.equal(slTheirs.members[ME], undefined);
  assert.deepEqual(await listIds(`SharedLists/sl_theirs/items`), ["theirs"]);

  // Geri bildirim, şikayet, davet, promosyon
  assert.deepEqual(await listIds(`Feedback`), ["f2"]);
  assert.equal((await db.doc(`PostReports/r1`).get()).data().reporterId, "deleted-user");
  assert.equal((await db.doc(`ContentReports/cr1`).get()).data().reporterId, "deleted-user");
  assert.equal(await exists(`ContentReports/cr2`), false);
  assert.equal(await exists(`ReferralAccounts/${ME}`), false);
  assert.equal(await exists(`ReferralCodes/ABC123`), false);
  assert.deepEqual(await listIds(`Referrals`), [OTHER]);
  assert.deepEqual(await listIds(`PromoCodes/WELCOME/redemptions`), [OTHER]);
});

test("ikinci çalıştırma idempotent (Auth onDelete süpürmesi)", { skip }, async () => {
  const result = await purgeAccountData({ db, rtdb: null, warn: () => {} }, ME);
  assert.deepEqual(result.failed, []);
  // Presence gibi geri yazılmış bir belge ikinci geçişte temizlenir.
  await db.doc(`Presence/${ME}`).set({ resurrected: true });
  await db.doc(`Users/${ME}`).set({ resurrected: true });
  const again = await purgeAccountData({ db, rtdb: null, warn: () => {} }, ME);
  assert.deepEqual(again.failed, []);
  assert.equal((await db.doc(`Presence/${ME}`).get()).exists, false);
  assert.equal((await db.doc(`Users/${ME}`).get()).exists, false);
});

test("bilinmeyen aşama reddedilir; aşama listesi 'profile' ile biter", { skip }, async () => {
  await assert.rejects(() => purgeAccountData({ db }, ME, { phase: "nope" }));
  assert.equal(PURGE_PHASES[PURGE_PHASES.length - 1], "profile");
});

test("uid olmadan çalışmaz", { skip }, async () => {
  await assert.rejects(() => purgeAccountData({ db }, ""));
});
