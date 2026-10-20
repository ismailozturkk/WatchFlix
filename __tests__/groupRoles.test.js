import {
  canManageGroup,
  groupAdminIds,
  groupRoleOf,
  isGroupAdmin,
  isGroupCreator,
  sortMembersByRole,
} from "../utils/groupRoles";

const group = {
  createdBy: "owner",
  // Eski gruplarda kurucu admins içinde bulunabilir; yardımcı bunu ayırmalı.
  admins: ["owner", "admin", "admin"],
};

describe("group role hierarchy", () => {
  test("creator is a distinct higher role", () => {
    expect(isGroupCreator(group, "owner")).toBe(true);
    expect(isGroupAdmin(group, "owner")).toBe(false);
    expect(groupRoleOf(group, "owner")).toBe("creator");
    expect(groupAdminIds(group)).toEqual(["admin"]);
  });

  test("creator and admins can manage the group", () => {
    expect(canManageGroup(group, "owner")).toBe(true);
    expect(canManageGroup(group, "admin")).toBe(true);
    expect(canManageGroup(group, "member")).toBe(false);
  });

  test("members are ordered creator, admins, then regular members", () => {
    const members = [
      { uid: "member", displayName: "Zeynep" },
      { uid: "admin", displayName: "Ayşe" },
      { uid: "owner", displayName: "Mehmet" },
      { uid: "member2", displayName: "Ali" },
    ];
    expect(sortMembersByRole(members, group).map((item) => item.uid)).toEqual([
      "owner",
      "admin",
      "member2",
      "member",
    ]);
  });
});
