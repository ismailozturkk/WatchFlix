export const isGroupCreator = (group, uid) =>
  Boolean(uid && group?.createdBy === uid);

export const groupAdminIds = (group) => {
  const creatorId = group?.createdBy;
  const admins = Array.isArray(group?.admins) ? group.admins : [];
  return [...new Set(admins.filter((uid) => uid && uid !== creatorId))];
};

export const isGroupAdmin = (group, uid) =>
  Boolean(uid && groupAdminIds(group).includes(uid));

export const canManageGroup = (group, uid) =>
  isGroupCreator(group, uid) || isGroupAdmin(group, uid);

export const groupRoleOf = (group, uid) => {
  if (isGroupCreator(group, uid)) return "creator";
  if (isGroupAdmin(group, uid)) return "admin";
  return "member";
};

export const sortMembersByRole = (members, group) => {
  const rank = { creator: 0, admin: 1, member: 2 };
  return [...members].sort((a, b) => {
    const roleDiff = rank[groupRoleOf(group, a.uid)] - rank[groupRoleOf(group, b.uid)];
    if (roleDiff !== 0) return roleDiff;
    return String(a.displayName || "").localeCompare(String(b.displayName || ""), "tr");
  });
};

// ── Mesaj yetkileri ──────────────────────────────────────────────────────────
// Hiyerarşi: kurucu > yönetici > üye. firestore.rules groups/{id}/messages ve
// pins silme kuralları AYNI tabloyu uygular (__tests__/groupMessagePermissions).
//   • Herkes kendi mesajını siler.
//   • Kurucu herkesin mesajını siler.
//   • Yönetici yalnız sıradan üyelerin mesajını siler; kurucunun ve diğer
//     yöneticilerin mesajlarına dokunamaz (üye çıkarma kuralıyla aynı sınır).
export const canDeleteGroupMessage = (group, actorUid, senderUid) => {
  if (!actorUid || !senderUid) return false;
  if (actorUid === senderUid) return true;
  if (isGroupCreator(group, actorUid)) return true;
  return isGroupAdmin(group, actorUid) && groupRoleOf(group, senderUid) === "member";
};

// "Yalnız yöneticiler mesaj gönderebilir" ayarı (groups/{id}.adminsOnlyMessages).
export const isAdminsOnlyGroup = (group) => group?.adminsOnlyMessages === true;

export const canSendGroupMessage = (group, uid) =>
  Boolean(uid) && (!isAdminsOnlyGroup(group) || canManageGroup(group, uid));
