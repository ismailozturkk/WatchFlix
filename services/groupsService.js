// services/groupsService.js
//
// Grup mesajlaşma altyapısı. Gruplar `groups/{groupId}` dokümanında, mesajlar
// `groups/{groupId}/messages` alt-koleksiyonunda. 1-1 sohbetten farkı: chatId
// uid'lerden türetilemez (çok üye) → array-contains üyelik modeli + denormalize
// memberInfo (ad/avatar) gösterim için.
//
// Mesaj GÖNDERME/ANKET OYU ChatScreen içinde (ref'leri orada) yapılır; burada
// grup yaşam döngüsü + yardımcılar var.

import { db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteField,
  runTransaction,
} from "firebase/firestore";

// ─── Üye baloncuk rengi (uid'den deterministik) ──────────────────────────────
// Grup sohbetinde her gönderenin baloncuğu/adı tutarlı bir renk alır.
const MEMBER_COLORS = [
  "#6C63FF",
  "#FF8A65",
  "#4FC3F7",
  "#81C784",
  "#BA68C8",
  "#FFD54F",
  "#F06292",
  "#4DB6AC",
  "#7986CB",
  "#A1887F",
  "#9575CD",
  "#4FC1A6",
];

export function memberColor(uid) {
  if (!uid) return MEMBER_COLORS[0];
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return MEMBER_COLORS[h % MEMBER_COLORS.length];
}

// ─── Grup oluştur ────────────────────────────────────────────────────────────
/**
 * @param {object} p
 * @param {string}   p.name
 * @param {string}   p.color       grup avatar rengi
 * @param {number}   p.avatarIndex iconBacground görselinin 0-based index'i
 * @param {string[]} p.members     uid listesi (oluşturan dahil)
 * @param {object}   p.memberInfo  { uid: { name, avatarIndex } }
 * @param {string}   p.createdBy   uid
 * @returns {Promise<string>} groupId
 */
export async function createGroup({
  name,
  color,
  avatarIndex,
  members,
  memberInfo,
  createdBy,
}) {
  const ref = await addDoc(collection(db, "groups"), {
    name: (name || "").trim() || "Grup",
    color: color || memberColor(createdBy),
    avatarIndex: Number.isInteger(avatarIndex) ? avatarIndex : 0,
    members,
    memberInfo: memberInfo || {},
    // Kurucu ayrı ve daha üst bir roldür; admins yalnız atanmış yöneticileri tutar.
    admins: [],
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: null,
  });
  return ref.id;
}

// ─── Kullanıcının gruplarını dinle (liste ekranı) ────────────────────────────
export function subscribeUserGroups(uid, callback) {
  if (!uid) return () => {};
  // array-contains + orderBy composite index gerektirir; istemcide sıralayarak
  // ekstra index kurulumundan kaçınıyoruz.
  const q = query(
    collection(db, "groups"),
    where("members", "array-contains", uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort(
        (a, b) =>
          (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0)
      );
      callback(list);
    },
    (err) => __DEV__ && console.warn("subscribeUserGroups:", err.message)
  );
}

// ─── Tek grubu dinle (sohbet ekranı header + üyeler) ─────────────────────────
export function subscribeGroup(groupId, callback) {
  if (!groupId) return () => {};
  return onSnapshot(
    doc(db, "groups", groupId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => __DEV__ && console.warn("subscribeGroup:", err.message)
  );
}

// ─── Üye yönetimi ───────────────────────────────────────────────────────────
// Yetki kontrolünün asıl kaynağı firestore.rules'tır; bu yardımcılar yalnızca
// üyelik alanlarını atomik FieldValue işlemleriyle günceller.
export async function addGroupMember(groupId, member) {
  if (!groupId || !member?.uid) throw new Error("Geçersiz grup veya üye");
  await updateDoc(doc(db, "groups", groupId), {
    members: arrayUnion(member.uid),
    [`memberInfo.${member.uid}`]: {
      name: member.displayName || member.name || "",
      avatarIndex: member.avatarIndex ?? 0,
    },
    updatedAt: serverTimestamp(),
  });
}

export async function removeGroupMember(groupId, uid) {
  if (!groupId || !uid) throw new Error("Geçersiz grup veya üye");
  await updateDoc(doc(db, "groups", groupId), {
    members: arrayRemove(uid),
    admins: arrayRemove(uid),
    [`memberInfo.${uid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateGroupAvatar(groupId, avatarIndex) {
  if (!groupId || !Number.isInteger(avatarIndex) || avatarIndex < 0) {
    throw new Error("Geçersiz grup veya avatar");
  }
  await updateDoc(doc(db, "groups", groupId), {
    avatarIndex,
    updatedAt: serverTimestamp(),
  });
}

// Yöneticiyi yalnız kurucu atayabilir/kaldırabilir. Firestore transaction aynı
// anda yapılan üye/rol değişikliklerinde kayıp güncellemeyi önler ve eski
// gruplarda admins içine yazılmış kurucuyu da normalize eder.
export async function setGroupAdminRole(groupId, uid, shouldBeAdmin) {
  if (!groupId || !uid) throw new Error("Geçersiz grup veya üye");
  const groupRef = doc(db, "groups", groupId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(groupRef);
    if (!snap.exists()) throw new Error("Grup bulunamadı");

    const data = snap.data();
    if (uid === data.createdBy) throw new Error("Kurucunun rolü değiştirilemez");
    if (!Array.isArray(data.members) || !data.members.includes(uid)) {
      throw new Error("Kullanıcı grup üyesi değil");
    }

    const current = Array.isArray(data.admins) ? data.admins : [];
    const normalized = current.filter((id) => id && id !== data.createdBy && id !== uid);
    const admins = shouldBeAdmin ? [...normalized, uid] : normalized;
    transaction.update(groupRef, { admins, updatedAt: serverTimestamp() });
  });
}

// ─── Anket oyu toggle yardımcı (saf) ─────────────────────────────────────────
// Mevcut votes map + kullanıcı + seçenek → yeni oy değeri (aynı seçeneğe tekrar
// basınca oyu geri çeker). updateDoc({ ["poll.votes."+uid]: <dönen> }) ile yazılır.
export function nextVote(currentVotes, uid, optionId) {
  const cur = currentVotes?.[uid];
  return cur === optionId ? null : optionId; // null → oyu sil (deleteField)
}
