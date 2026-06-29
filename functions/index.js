// functions/index.js
//
// WatchFlix push bildirim sunucusu (Cloud Functions v2 + Expo Push API).
//
// Akış:
//   1) İstemci bir sosyal bildirim yazınca → Users/{uid}/notifications/{notifId}
//      dökümanı oluşur (alıcı = path'teki {uid}).
//   2) Bu trigger tetiklenir; alıcının Users/{uid} dökümanından Expo push
//      token(lar)ını okur.
//   3) Expo Push API'ye gönderir (uygulama kapalı/arka planda olsa bile bildirim).
//   4) "DeviceNotRegistered" dönen ölü token'ları kullanıcı dökümanından temizler.
//
// NOT: Cihazdaki tür-bazlı bildirim ayarları (postLikesEnabled vb.) AsyncStorage'da
// tutulur → sunucu göremez. Bu yüzden arka plan push TÜM sosyal türler için gider.
// Tür bazlı kontrolü arka planda da istersen, ayarları Firestore'a (ör.
// Users/{uid}.notificationSettings) yansıtmamız gerekir (bkz. README altındaki not).

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { Expo } = require("expo-server-sdk");

admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

// Aynı anda çok fazla instance açıp maliyeti şişirmemek için tavan.
setGlobalOptions({ maxInstances: 10 });

// notification.type → başlık/gövde (TR varsayılan; istemci i18n'iyle uyumlu metinler).
function buildContent(n) {
  const name = n.fromName || "Birisi";
  switch (n.type) {
    case "friend_request":
      return { title: "Arkadaşlık İsteği", body: `${name} sana arkadaşlık isteği gönderdi` };
    case "friend_accepted":
      return { title: "Arkadaşlık", body: `${name} arkadaşlık isteğini kabul etti` };
    case "post_like":
      return { title: "Beğeni", body: `${name} gönderini beğendi` };
    case "post_comment":
      return { title: "Yorum", body: `${name} gönderine yorum yaptı` };
    case "comment_reply":
      return { title: "Yorum", body: `${name} yorumuna yanıt verdi` };
    case "mention":
      return { title: "Bahsetme", body: `${name} senden bahsetti` };
    case "message":
      return { title: name, body: n.text || `${name} sana mesaj gönderdi` };
    default:
      return { title: "Bildirim", body: name };
  }
}

exports.onSocialNotificationCreated = onDocumentCreated(
  "Users/{uid}/notifications/{notifId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const n = snap.data() || {};
    const recipientUid = event.params.uid;
    const notifId = event.params.notifId;

    // Alıcının token'larını oku.
    let userData;
    try {
      const userSnap = await db.doc(`Users/${recipientUid}`).get();
      if (!userSnap.exists) return;
      userData = userSnap.data() || {};
    } catch (e) {
      console.error("Kullanıcı dökümanı okunamadı:", e);
      return;
    }

    // Tür-bazlı ayar kontrolü. İstemci Users/{uid}.notificationSettings'e yansıtır.
    // Ayar yoksa/alan tanımsızsa → GÖNDER (eski kullanıcıları susturmamak için);
    // yalnızca açıkça false ise atla. İstemci foreground filtresiyle tutarlı.
    const ns = userData.notificationSettings || {};
    if (ns.enabled === false) {
      console.log(`Bildirimler kapalı (master): ${recipientUid}`);
      return;
    }
    const TYPE_SETTING_KEY = {
      friend_request: "friendRequestsEnabled",
      friend_accepted: "friendAcceptedEnabled",
      post_like: "postLikesEnabled",
      post_comment: "postCommentsEnabled",
      comment_reply: "postCommentsEnabled",
      mention: "mentionsEnabled",
      message: "messagesEnabled",
    };
    const settingKey = TYPE_SETTING_KEY[n.type];
    if (settingKey && ns[settingKey] === false) {
      console.log(`Tür kapalı (${n.type}): ${recipientUid}`);
      return;
    }

    // expoPushToken (tek) + expoPushTokens (dizi) → birleştir, tekille, geçerli olanları al.
    const tokenSet = new Set();
    if (userData.expoPushToken) tokenSet.add(userData.expoPushToken);
    if (Array.isArray(userData.expoPushTokens)) {
      userData.expoPushTokens.forEach((t) => t && tokenSet.add(t));
    }
    const tokens = [...tokenSet].filter((t) => Expo.isExpoPushToken(t));
    if (tokens.length === 0) {
      console.log(`Geçerli Expo push token yok: ${recipientUid}`);
      return;
    }

    const { title, body } = buildContent(n);
    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      channelId: "social", // istemcideki Android kanalıyla aynı
      priority: "high",
      data: {
        kind: "social",
        type: n.type || "",
        notifId,
        postId: n.postId || null,
        fromUid: n.fromUid || null,
      },
    }));

    // Gönder (chunk'lı) + ölü token tespiti.
    const deadTokens = [];
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          if (
            ticket.status === "error" &&
            ticket.details &&
            ticket.details.error === "DeviceNotRegistered"
          ) {
            deadTokens.push(chunk[i].to);
          }
        });
      } catch (e) {
        console.error("Expo push gönderim hatası:", e);
      }
    }

    // Uygulaması silinmiş/çıkış yapılmış cihazların token'larını temizle.
    if (deadTokens.length) {
      try {
        await db.doc(`Users/${recipientUid}`).update({
          expoPushTokens: admin.firestore.FieldValue.arrayRemove(...deadTokens),
        });
      } catch (e) {
        console.error("Ölü token temizliği hatası:", e);
      }
    }

    console.log(
      `Push gönderildi → ${recipientUid} | tür: ${n.type} | cihaz: ${tokens.length} | ölü: ${deadTokens.length}`,
    );
  },
);
