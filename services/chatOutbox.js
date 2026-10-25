// services/chatOutbox.js
//
// Bir paylaşım kartını ChatScreen AÇIK DEĞİLKEN var olan bir sohbete yazar: kabul edilen davetin
// sonucu (günlük düello skorları, CineSwipe ortak eşleşmeleri) davetin geldiği sohbete düşer.
//
// Yazımlar ChatScreen.postMessage + queueThreadWrites ile AYNI şemada ve tek atomik batch'te:
//   1-1  : chats/{chatId}/messages + iki tarafın Users/{uid}/conversations girişi
//          (+ alıcının unreadCount'u)
//   grup : groups/{id}/messages + groups/{id}.lastMessage/updatedAt + diğer üyelerin groupInbox sayacı
// Mesaj `push: "server"` işaretini taşır (utils/chatPush.js): bildirimini sunucu dağıtır.
// Şema değişirse İKİ yer birlikte güncellenmeli — ChatScreen kendi gönderim yolunu kullanıyor.
//
// Kural değişikliği gerekmez: mesajı yazan kendi uid'ini koyar, giriş/sayaç yazımları ChatScreen'in
// zaten yaptığı yazımlar (firestore.rules → chats/messages, conversations, groupInbox).

import { collection, doc, getDoc, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { buildShareMessage } from "../utils/chatShare";
import { prepareOutgoingMessage } from "../utils/chatPush";
import { queueGroupUnreadIncrements } from "./groupsService";

/** 1-1 sohbet kimliği: ChatScreen'deki sıralı uid birleşimiyle AYNI. */
export const directChatId = (a, b) => (a > b ? `${a}_${b}` : `${b}_${a}`);

const definedOnly = (fields) =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

/**
 * @param {object} p
 * @param {{uid:string, displayName?:string, username?:string, avatarIndex?:number, photoURL?:string|null}} p.sender
 * @param {{friendUid:string, friendName?:string}|{groupId:string}} p.chat  utils/importantInvites.chatTargetOf
 * @param {object} p.share  utils/chatShare gövdesi
 * @returns {Promise<{chatId:string}>}
 * @throws "invalid-share" | "no-chat" | "not-a-member" ya da Firestore hatası
 */
export async function postShareToChat({ sender, chat, share }) {
  const fields = buildShareMessage(share);
  if (!sender?.uid || !fields) throw new Error("invalid-share");
  const previewText = fields.text;
  const senderName = sender.displayName || "";
  const base = { ...fields, senderId: sender.uid, timestamp: serverTimestamp(), status: "sent" };
  const batch = writeBatch(db);

  if (chat?.groupId) {
    const groupRef = doc(db, "groups", chat.groupId);
    const snapshot = await getDoc(groupRef);
    const members = snapshot.exists() ? snapshot.data()?.members : null;
    if (!Array.isArray(members) || !members.includes(sender.uid)) throw new Error("not-a-member");
    const { message } = prepareOutgoingMessage({
      ...base,
      ...definedOnly({
        senderName,
        senderUsername: sender.username || "",
        senderAvatarIndex: sender.avatarIndex,
        senderPhotoURL: sender.photoURL,
      }),
    });
    batch.set(doc(collection(db, "groups", chat.groupId, "messages")), message);
    batch.set(
      groupRef,
      {
        lastMessage: {
          text: previewText,
          senderId: sender.uid,
          senderName,
          senderUsername: sender.username || "",
          time: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    queueGroupUnreadIncrements(batch, chat.groupId, members, sender.uid);
    await batch.commit();
    return { chatId: chat.groupId };
  }

  const friendUid = chat?.friendUid;
  if (!friendUid || friendUid === sender.uid) throw new Error("no-chat");
  const chatId = directChatId(sender.uid, friendUid);
  const { message } = prepareOutgoingMessage(base);
  batch.set(doc(collection(db, "chats", chatId, "messages")), message);
  // Kendi girişimde karşı tarafın kimliği zaten var (sohbet bu davetle açıldı); merge yalnız özeti tazeler.
  batch.set(
    doc(db, "Users", sender.uid, "conversations", friendUid),
    {
      withUid: friendUid,
      ...(chat.friendName ? { withName: chat.friendName } : {}),
      lastText: previewText,
      lastTime: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    doc(db, "Users", friendUid, "conversations", sender.uid),
    {
      withUid: sender.uid,
      withName: senderName,
      withUsername: sender.username || "",
      ...(typeof sender.avatarIndex === "number" ? { withAvatarIndex: sender.avatarIndex } : {}),
      lastText: previewText,
      lastTime: serverTimestamp(),
      unreadCount: increment(1),
    },
    { merge: true },
  );
  await batch.commit();
  return { chatId };
}
