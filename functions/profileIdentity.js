// Profil kimligi icin saf diff/patch ureticisi.
// Cloud Function tarafindaki fan-out hedefleri ayni alan degisimi kurallarini
// paylassin ve yalniz gercekten degisen alanlari yazsin diye ayri tutulur.

function normalizeIdentity(profile = {}) {
  return {
    displayName:
      typeof profile.displayName === "string" ? profile.displayName.trim() : "",
    username:
      typeof profile.username === "string" ? profile.username.trim() : "",
    avatarIndex:
      typeof profile.avatarIndex === "number" ? profile.avatarIndex : 0,
  };
}

function buildProfileIdentityChanges(beforeProfile = {}, afterProfile = {}) {
  const before = normalizeIdentity(beforeProfile);
  const after = normalizeIdentity(afterProfile);
  return {
    before,
    after,
    nameChanged: before.displayName !== after.displayName,
    usernameChanged: before.username !== after.username,
    avatarChanged: before.avatarIndex !== after.avatarIndex,
  };
}

function mappedPatch(changes, mapping) {
  const patch = {};
  if (changes.nameChanged && mapping.displayName) {
    patch[mapping.displayName] = changes.after.displayName;
  }
  if (changes.usernameChanged && mapping.username) {
    patch[mapping.username] = changes.after.username;
  }
  if (changes.avatarChanged && mapping.avatarIndex) {
    patch[mapping.avatarIndex] = changes.after.avatarIndex;
  }
  return patch;
}

function hasPatch(patch) {
  return Object.keys(patch || {}).length > 0;
}

module.exports = {
  normalizeIdentity,
  buildProfileIdentityChanges,
  mappedPatch,
  hasPatch,
};
