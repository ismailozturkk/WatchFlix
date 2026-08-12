const {
  buildProfileIdentityChanges,
  mappedPatch,
  hasPatch,
} = require("../functions/profileIdentity");

describe("profile identity fan-out patches", () => {
  test("name, username and avatar are mapped to each target schema", () => {
    const changes = buildProfileIdentityChanges(
      { displayName: "Eski", username: "eski", avatarIndex: 1 },
      { displayName: "Yeni", username: "yeni", avatarIndex: 7 },
    );

    expect(
      mappedPatch(changes, {
        displayName: "friendName",
        username: "friendUsername",
        avatarIndex: "friendAvatarIndex",
      }),
    ).toEqual({
      friendName: "Yeni",
      friendUsername: "yeni",
      friendAvatarIndex: 7,
    });
  });

  test("unchanged fields are not written", () => {
    const changes = buildProfileIdentityChanges(
      { displayName: "Aynı", username: "once", avatarIndex: 3 },
      { displayName: "Aynı", username: "sonra", avatarIndex: 3 },
    );
    const patch = mappedPatch(changes, {
      displayName: "name",
      username: "username",
      avatarIndex: "avatarIndex",
    });

    expect(patch).toEqual({ username: "sonra" });
    expect(hasPatch(patch)).toBe(true);
    expect(hasPatch(mappedPatch(changes, { displayName: "name" }))).toBe(false);
  });

  test("identity values are trimmed and invalid legacy values get safe defaults", () => {
    const changes = buildProfileIdentityChanges(
      { displayName: null, username: null, avatarIndex: null },
      { displayName: "  Ada  ", username: "  ada_1 ", avatarIndex: 4 },
    );

    expect(changes.after).toEqual({
      displayName: "Ada",
      username: "ada_1",
      avatarIndex: 4,
    });
  });
});
