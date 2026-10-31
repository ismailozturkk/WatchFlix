import fs from "fs";
import path from "path";
import {
  PROFILE_PREVIEW,
  resolveProfileAccess,
  resolveProfileViewer,
} from "../utils/profileViewer";

const ME = "me-uid";
const OTHER = "other-uid";

describe("resolveProfileViewer", () => {
  it("başkasının profili: arkadaşlık bayrağı olduğu gibi geçer", () => {
    expect(resolveProfileViewer({ viewerUid: ME, profileUid: OTHER, isFriend: true })).toEqual({
      isSelf: false,
      previewAsFriend: false,
      viewerIsFriend: true,
    });
    expect(
      resolveProfileViewer({ viewerUid: ME, profileUid: OTHER, isFriend: false }).viewerIsFriend,
    ).toBe(false);
  });

  it("kendi profilin önizlemesiz: arkadaş sayılmazsın (eski davranış)", () => {
    expect(resolveProfileViewer({ viewerUid: ME, profileUid: ME })).toEqual({
      isSelf: true,
      previewAsFriend: false,
      viewerIsFriend: false,
    });
  });

  it("kendi profilin + arkadaş önizlemesi: izleyici arkadaş sayılır", () => {
    expect(
      resolveProfileViewer({ viewerUid: ME, profileUid: ME, preview: PROFILE_PREVIEW.FRIEND }),
    ).toEqual({ isSelf: true, previewAsFriend: true, viewerIsFriend: true });
  });

  it("önizleme parametresi başkasının profilinde gizliliği AÇAMAZ", () => {
    const v = resolveProfileViewer({
      viewerUid: ME,
      profileUid: OTHER,
      isFriend: false,
      preview: PROFILE_PREVIEW.FRIEND,
    });
    expect(v.previewAsFriend).toBe(false);
    expect(v.viewerIsFriend).toBe(false);
  });

  it("oturum yokken kimse kendi profilinde sayılmaz", () => {
    const v = resolveProfileViewer({ viewerUid: null, profileUid: null, preview: "friend" });
    expect(v.isSelf).toBe(false);
    expect(v.previewAsFriend).toBe(false);
  });
});

describe("resolveProfileAccess", () => {
  const friendsOnly = {
    profile: "friends",
    lists: "friends",
    socialLinks: "friends",
    onlineStatus: "friends",
  };

  it("arkadaşa açık bölümler arkadaşa (ve arkadaş önizlemesine) görünür", () => {
    expect(resolveProfileAccess(friendsOnly, { viewerIsFriend: true })).toEqual({
      canViewProfile: true,
      canViewLists: true,
      canViewSocialLinks: true,
    });
  });

  it("arkadaşa açık bölümler yabancıya kapalı", () => {
    expect(resolveProfileAccess(friendsOnly, { viewerIsFriend: false })).toEqual({
      canViewProfile: false,
      canViewLists: false,
      canViewSocialLinks: false,
    });
  });

  it("gizli seçilen bölüm arkadaşa da kapalı: önizleme fazlasını göstermez", () => {
    const access = resolveProfileAccess(
      { profile: "public", lists: "private", socialLinks: "private", onlineStatus: "none" },
      { viewerIsFriend: true },
    );
    expect(access).toEqual({
      canViewProfile: true,
      canViewLists: false,
      canViewSocialLinks: false,
    });
  });

  it("profil gizliyse listeler ve sosyal hesaplar da kapalı", () => {
    const access = resolveProfileAccess(
      { profile: "private", lists: "public", socialLinks: "public", onlineStatus: "everyone" },
      { viewerIsFriend: true },
    );
    expect(access.canViewProfile).toBe(false);
    expect(access.canViewLists).toBe(false);
    expect(access.canViewSocialLinks).toBe(false);
  });

  it("profil belgesi gelmeden listeler/sosyal hesaplar açılmaz", () => {
    const access = resolveProfileAccess(
      { profile: "public", lists: "public", socialLinks: "public", onlineStatus: "everyone" },
      { viewerIsFriend: false, profileLoaded: false },
    );
    expect(access.canViewProfile).toBe(true);
    expect(access.canViewLists).toBe(false);
    expect(access.canViewSocialLinks).toBe(false);
  });
});

describe("Profilini gör bağlantısı", () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

  it("profil ekranı avatar önizlemesine önizleme parametresiyle düğme verir", () => {
    const src = read("screens/tabs/ProfileScreen.js");
    expect(src).toMatch(/action=\{viewOwnProfileAction\}/);
    expect(src).toMatch(/preview: PROFILE_PREVIEW\.FRIEND/);
    expect(src).toMatch(/"FriendProfileScreen"/);
  });

  it("arkadaş profili gizliliği önizleme kararından okur", () => {
    const src = read("screens/tabs/profile/FriendProfileScreen.js");
    expect(src).toMatch(/resolveProfileViewer\(/);
    expect(src).toMatch(/resolveProfileAccess\(/);
    // Gizlilik kararı doğrudan `friend` bayrağına dönmesin (önizleme arkadaşı sayılmaz olurdu).
    expect(src).not.toMatch(/=== "friends" && friend\b/);
  });

  it("çeviriler beş dilde var", () => {
    for (const lang of ["tr", "en", "es", "pt", "de"]) {
      const auto = JSON.parse(read(`translations/${lang}.json`)).autoI18n;
      for (const key of ["profilini_gor", "profil_onizleme_baslik", "profil_onizleme_aciklama"]) {
        expect(typeof auto[key]).toBe("string");
        expect(auto[key].length).toBeGreaterThan(0);
      }
    }
  });
});
