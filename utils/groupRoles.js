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
