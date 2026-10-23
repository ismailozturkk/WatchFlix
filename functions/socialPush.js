"use strict";

// functions/socialPush.js
//
// Sosyal push'un hazırlanıp gönderilmesi — iki tetikleyicinin ORTAK yolu:
//   • onSocialNotificationCreated: Users/{uid}/notifications/{id} (beğeni, yorum,
//     istek, davet ve ESKİ istemcilerin mesaj bildirimleri),
//   • onDirectMessageCreated / onGroupMessageCreated: mesaj belgesinin kendisi.
//
// NEDEN MESAJ TETİKLEYİCİSİ: eskiden gönderenin telefonu her alıcı için ayrı bir
// bildirim belgesi yazıyor ve alıcının KÖK Users belgesindeki unreadNotifsCount'u
// artırıyordu (grupta mesaj başına 2×(üye−1) yazım). Kök belge yazımı
// onUserProfileUpdated'ı boşuna tetikliyor, o belgeyi dinleyen herkese yeniden
// okutuyordu; gönderen uygulamayı yarıda kapatırsa bazı üyelere bildirim hiç
// gitmiyordu. Artık istemci yalnız mesajı yazar (`push: "server"` işaretiyle);
// dağıtım burada, alıcı başına SIFIR Firestore yazımıyla yapılır ve tüm alıcıların
// push'ları birlikte, 100'lük Expo isteklerinde gider.
//
// GEÇİŞ: işaretsiz mesaj (eski istemci) burada YOK SAYILIR — o sürümler bildirim
// belgesi yazmaya devam ettiğinden push'u onSocialNotificationCreated gönderir;
// ikisi birden çalışsa çift bildirim olurdu. İşaret istemcide utils/chatPush.js.
//
// Bağımlılıklar dışarıdan verilir (createSocialPush) — socialPush.test.js sahte
// Firestore/RTDB/Expo ile sınar.

const { badgeForPush, sumUnreadMessages, chatIdForMessage } = require("./appBadge");
const { isRecipientViewingChat } = require("./chatPresence");

/** İstemcideki utils/chatPush.js SERVER_PUSH ile AYNI değer. */
const SERVER_PUSH_MARKER = "server";

// Tür → Users/{uid}.notificationSettings anahtarı. Ayar yoksa/tanımsızsa GÖNDER
// (eski kullanıcıları susturmamak için); yalnız açıkça false ise atla.
const TYPE_SETTING_KEY = {
  friend_request: "friendRequestsEnabled",
  friend_accepted: "friendAcceptedEnabled",
  post_like: "postLikesEnabled",
  post_comment: "postCommentsEnabled",
  comment_reply: "postCommentsEnabled",
  mention: "mentionsEnabled",
  message: "messagesEnabled",
  cineswipe_invite: "messagesEnabled",
  game_challenge: "messagesEnabled",
};

// Expo, bir istekte birden çok projenin (ör. eski geliştirme build'i + yeni build)
// token'ı varsa İSTEĞİN TAMAMINI bu kodla reddeder; `details` = { proje: [token] }.
// 22 Eki günlüklerinde görüldü: o kullanıcıya hiçbir cihazından push gitmiyordu.
// Alıcılar tek istekte toplandığından bölünmezse bir grubun tamamı push'suz kalırdı.
const MIXED_PROJECTS_ERROR = "PUSH_TOO_MANY_EXPERIENCE_IDS";

/**
 * Karışık proje hatasındaki `details`e göre mesajları proje gruplarına böler.
 * `details`te geçmeyen token'lar kendi grubunda toplanır.
 */
function splitByProject(messages, details) {
  const projectOf = new Map();
  for (const [project, tokens] of Object.entries(details || {})) {
    for (const token of Array.isArray(tokens) ? tokens : []) projectOf.set(token, project);
  }
  const groups = new Map();
  for (const m of messages) {
    const key = projectOf.has(m.to) ? `p:${projectOf.get(m.to)}` : "?";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  return [...groups.values()];
}

/** Bu mesajın push'unu sunucu mu dağıtacak (yeni istemci işareti)? */
function shouldServerPush(message) {
  return (
    message?.push === SERVER_PUSH_MARKER &&
    typeof message.senderId === "string" &&
    message.senderId.length > 0
  );
}

/**
 * 1-1 sohbet kimliğinden ("uidA_uidB") gönderenin karşısındaki kişi. Gönderen
 * sohbetin tarafı değilse ya da kimlik bozuksa null (kural zaten engeller).
 */
function directRecipient(chatId, senderUid) {
  const parts = String(chatId || "").split("_");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (parts[0] === parts[1] || !parts.includes(senderUid)) return null;
  return parts[0] === senderUid ? parts[1] : parts[0];
}

/** Grup mesajının alıcıları: gönderen DIŞINDAKİ benzersiz, boş olmayan üyeler. */
function groupRecipients(members, senderUid) {
  const out = [];
  const seen = new Set();
  for (const uid of Array.isArray(members) ? members : []) {
    if (typeof uid !== "string" || !uid || uid === senderUid || seen.has(uid)) continue;
    seen.add(uid);
    out.push(uid);
  }
  return out;
}

/**
 * Mesajdan bildirim nesnesi (buildContent'in beklediği şekil; eski istemcinin
 * yazdığı bildirim belgesiyle aynı alanlar ve aynı kırpma sınırları).
 */
function buildMessageNotification({ senderUid, senderName, text, groupId, groupName }) {
  return {
    type: "message",
    fromUid: senderUid,
    fromName: senderName || "",
    ...(text ? { text: String(text).slice(0, 140) } : {}),
    ...(groupId ? { groupId: String(groupId) } : {}),
    ...(groupId && groupName ? { groupName: String(groupName).slice(0, 80) } : {}),
  };
}

/**
 * @param {object} deps
 * @param {*} deps.db              firebase-admin Firestore
 * @param {*} [deps.rtdb]          firebase-admin Database (yoksa inChat atlanır)
 * @param {*} deps.expo            expo-server-sdk Expo örneği
 * @param {(n: object, lang: string) => {title: string, body: string}} deps.buildContent
 * @param {(value: any) => string} deps.pickNotificationLang
 * @param {(uid: string, userData: object) => Promise<{tokens: string[], priv: object}>} deps.loadPushTokens
 * @param {(uid: string, userData: object, priv: object, dead: string[]) => Promise<void>} deps.clearDeadPushTokens
 * @param {Pick<Console, "log" | "warn" | "error">} [deps.log]
 */
function createSocialPush({
  db,
  rtdb,
  expo,
  buildContent,
  pickNotificationLang,
  loadPushTokens,
  clearDeadPushTokens,
  log = console,
}) {
  /**
   * Bir alıcı için push'u HAZIRLAR (göndermez). Gönderilmeyecekse null.
   * @param {string} recipientUid
   * @param {object} n  bildirim (type, fromUid, fromName, text, groupId, …)
   * @param {object} [opts]
   * @param {string|null} [opts.notifId]     bildirim belgesi (eski yol)
   * @param {string|null} [opts.messageId]   mesaj belgesi (sunucu yolu)
   * @param {boolean} [opts.checkBlocked]    alıcı göndereni engellediyse atla
   *   (bildirim belgesi yolunda bunu kural `notBlocked` yapıyordu)
   * @param {boolean} [opts.remoteOnly]      yerel kopyası OLMAYAN push: istemci
   *   ön planda da gösterir (utils/notificationPresentation.js)
   */
  async function prepare(recipientUid, n, opts = {}) {
    const { notifId = null, messageId = null, checkBlocked = false, remoteOnly = false } = opts;
    if (!recipientUid || !n) return null;

    let userData;
    try {
      const userSnap = await db.doc(`Users/${recipientUid}`).get();
      if (!userSnap.exists) return null;
      userData = userSnap.data() || {};
    } catch (e) {
      log.error("Kullanıcı dökümanı okunamadı:", e);
      return null;
    }

    // Tür-bazlı ayar kontrolü. İstemci Users/{uid}.notificationSettings'e yansıtır.
    const ns = userData.notificationSettings || {};
    if (ns.enabled === false) {
      log.log(`Bildirimler kapalı (master): ${recipientUid}`);
      return null;
    }
    const settingKey = TYPE_SETTING_KEY[n.type];
    if (settingKey && ns[settingKey] === false) {
      log.log(`Tür kapalı (${n.type}): ${recipientUid}`);
      return null;
    }

    if (checkBlocked && n.fromUid) {
      try {
        const blocked = await db.doc(`Users/${recipientUid}/blocked/${n.fromUid}`).get();
        if (blocked.exists) {
          log.log(`Gönderen engelli, push atlandı: ${recipientUid}`);
          return null;
        }
      } catch (e) {
        // Engel okunamadıysa göndermemek, engellenmiş birinin bildirimini
        // iletmekten iyidir.
        log.warn("Engel kontrolü başarısız (push atlandı):", e.message);
        return null;
      }
    }

    // Alıcı, gönderenle olan bu 1-1 sohbeti tam o an ekranda açık tutuyorsa
    // push gereksiz. Yalnız 1-1: gruplarda inChat izlenmiyor (istemcinin ön plan
    // süzgeci etkin sohbeti yine bastırır). Bayrak yalnız alıcının bağlantısı
    // canlıysa geçerli (bkz. chatPresence.js).
    if (rtdb && n.type === "message" && !n.groupId && n.fromUid) {
      const pairId =
        n.fromUid > recipientUid ? `${n.fromUid}_${recipientUid}` : `${recipientUid}_${n.fromUid}`;
      try {
        if (await isRecipientViewingChat(rtdb, pairId, recipientUid)) {
          log.log(`Alıcı sohbette, push atlandı: ${recipientUid}`);
          return null;
        }
      } catch (e) {
        log.warn("inChat kontrolü başarısız (push yine de gönderilecek):", e.message);
      }
    }

    const { tokens, priv } = await loadPushTokens(recipientUid, userData);
    if (tokens.length === 0) {
      log.log(`Geçerli Expo push token yok: ${recipientUid}`);
      return null;
    }

    const lang = pickNotificationLang(userData.notificationLanguage);
    const { title, body } = buildContent(n, lang);

    // Uygulama simgesi rozeti (iOS): MUTLAK sayı. Tanım: okunmamış 1-1 mesajlar
    // + bekleyen gelen istekler (bkz. appBadge.js). Sorgu başarısızsa `badge`
    // yazılmaz — OS mevcut sayıyı korur, yanlış sayı yazmaktan iyidir.
    let badge = null;
    try {
      const [convSnap, requestsAgg] = await Promise.all([
        db
          .collection(`Users/${recipientUid}/conversations`)
          .where("unreadCount", ">", 0)
          .select("unreadCount")
          .get(),
        db
          .collection(`Users/${recipientUid}/friendRequests`)
          .where("status", "==", "pending")
          .count()
          .get(),
      ]);
      badge = badgeForPush(n, {
        unreadMessages: sumUnreadMessages(convSnap.docs),
        pendingRequests: requestsAgg.data().count,
      });
    } catch (e) {
      log.warn("Rozet sayısı hesaplanamadı (badge atlanıyor):", e.message);
    }

    const chatId = chatIdForMessage(n, recipientUid);
    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      channelId: "social", // istemcideki Android kanalıyla aynı
      priority: "high",
      ...(badge !== null ? { badge } : {}),
      data: {
        kind: "social",
        type: n.type || "",
        notifId,
        postId: n.postId || null,
        fromUid: n.fromUid || null,
        fromName: n.fromName || null,
        groupId: n.groupId || null,
        groupName: n.groupName || null,
        inviteCode: n.inviteCode || null,
        dayKey: n.dayKey || null,
        // İstemci bununla "kullanıcı bu sohbeti izliyor mu" kararını verir ve
        // sohbet açılınca çekmecedeki bildirimleri temizler.
        chatId,
        ...(messageId ? { messageId } : {}),
        ...(remoteOnly ? { remoteOnly: true } : {}),
      },
    }));

    return { recipientUid, userData, priv, type: n.type, badge, messages };
  }

  /**
   * Hazırlanmış push'ları gönderir: tüm alıcıların mesajları birlikte, Expo'nun
   * 100'lük parçalarında. Ölü token'lar sahibinin kaydından temizlenir.
   */
  async function send(preparedList) {
    const list = (preparedList || []).filter(Boolean);
    if (list.length === 0) return { sent: 0, dead: 0 };

    const all = [];
    const owners = new Map(); // token → hazırlık indeksleri (aynı cihaz iki hesapta olabilir)
    list.forEach((p, idx) => {
      for (const m of p.messages) {
        all.push(m);
        if (!owners.has(m.to)) owners.set(m.to, new Set());
        owners.get(m.to).add(idx);
      }
    });

    const deadByOwner = list.map(() => []);
    const sendChunk = async (chunk, allowSplit) => {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
            const token = chunk[i].to;
            for (const idx of owners.get(token) || []) deadByOwner[idx].push(token);
          }
        });
      } catch (e) {
        if (allowSplit && e?.code === MIXED_PROJECTS_ERROR) {
          const groups = splitByProject(chunk, e.details);
          if (groups.length > 1) {
            log.warn(`Karışık Expo projesi: istek ${groups.length} parçaya bölündü`);
            for (const group of groups) await sendChunk(group, false);
            return;
          }
        }
        log.error("Expo push gönderim hatası:", e);
      }
    };
    for (const chunk of expo.chunkPushNotifications(all)) await sendChunk(chunk, true);

    await Promise.all(
      list.map((p, idx) =>
        clearDeadPushTokens(p.recipientUid, p.userData, p.priv, deadByOwner[idx]),
      ),
    );

    list.forEach((p, idx) => {
      log.log(
        `Push gönderildi → ${p.recipientUid} | tür: ${p.type} | cihaz: ${p.messages.length} | ölü: ${deadByOwner[idx].length} | rozet: ${p.badge ?? "-"}`,
      );
    });
    return { sent: all.length, dead: deadByOwner.reduce((s, d) => s + d.length, 0) };
  }

  /**
   * Yeni mesaj belgesinden push dağıtımı. `chatId` (1-1) ya da `groupId` (grup).
   * İşaretsiz (eski istemci) mesaj yok sayılır — bkz. dosya başı.
   */
  async function deliverMessagePush({ message, messageId = null, chatId = null, groupId = null }) {
    if (!shouldServerPush(message)) return { skipped: "unmarked" };
    const senderUid = message.senderId;

    let recipients;
    let groupName = "";
    if (groupId) {
      const groupSnap = await db.doc(`groups/${groupId}`).get();
      if (!groupSnap.exists) return { skipped: "no-group" };
      const group = groupSnap.data() || {};
      const members = Array.isArray(group.members) ? group.members : [];
      if (!members.includes(senderUid)) return { skipped: "not-member" };
      recipients = groupRecipients(members, senderUid);
      groupName = group.name || "";
    } else {
      const other = directRecipient(chatId, senderUid);
      recipients = other ? [other] : [];
    }
    if (recipients.length === 0) return { skipped: "no-recipient" };

    // Gönderen adı KÖK belgeden: mesajdaki senderName istemcinin yazdığıdır
    // (grupta var, 1-1'de yok); okunamazsa ona düşülür.
    let senderName = typeof message.senderName === "string" ? message.senderName : "";
    try {
      const senderSnap = await db.doc(`Users/${senderUid}`).get();
      if (senderSnap.exists) senderName = senderSnap.data()?.displayName || senderName;
    } catch (e) {
      log.warn("Gönderen adı okunamadı:", e.message);
    }

    const n = buildMessageNotification({
      senderUid,
      senderName,
      text: message.text,
      groupId,
      groupName,
    });
    const prepared = await Promise.all(
      recipients.map((uid) =>
        prepare(uid, n, { messageId, checkBlocked: true, remoteOnly: true }).catch((e) => {
          log.error(`Push hazırlanamadı (${uid}):`, e);
          return null;
        }),
      ),
    );
    return send(prepared);
  }

  return { prepare, send, deliverMessagePush };
}

module.exports = {
  SERVER_PUSH_MARKER,
  TYPE_SETTING_KEY,
  MIXED_PROJECTS_ERROR,
  splitByProject,
  shouldServerPush,
  directRecipient,
  groupRecipients,
  buildMessageNotification,
  createSocialPush,
};
