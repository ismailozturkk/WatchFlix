// utils/profileViewer.js
//
// Profil ekranında (screens/tabs/profile/FriendProfileScreen.js) İZLEYİCİYE göre
// neyin görüneceğinin saf kararları. Gizlilik kuralları tek yerde: "Profilini
// gör" önizlemesi (kendi profilini bir arkadaşın gözünden) ile gerçek arkadaş
// görünümü AYNI kuraldan geçer, önizleme hiçbir zaman arkadaşın gördüğünden
// fazlasını ya da azını göstermez.

// Rota parametresi `preview`: profil sahibi kendi profiline hangi gözle bakıyor.
export const PROFILE_PREVIEW = Object.freeze({ FRIEND: "friend" });

/**
 * İzleyici ile profil sahibi arasındaki ilişki.
 *  - isSelf: kendi profilin (Mesaj / arkadaşlık / ⋯ / zevk uyumu çizilmez)
 *  - previewAsFriend: kendi profilin + arkadaş önizlemesi istendi
 *  - viewerIsFriend: gizlilik kurallarında izleyici arkadaş sayılır mı
 * `preview` yalnız kendi profilinde etkilidir: başkasının uid'iyle gelen
 * önizleme parametresi gizliliği açamaz.
 */
export function resolveProfileViewer({
  viewerUid,
  profileUid,
  isFriend = false,
  preview = null,
} = {}) {
  const isSelf = !!viewerUid && viewerUid === profileUid;
  const previewAsFriend = isSelf && preview === PROFILE_PREVIEW.FRIEND;
  return {
    isSelf,
    previewAsFriend,
    viewerIsFriend: previewAsFriend || !!isFriend,
  };
}

const allows = (level, viewerIsFriend) =>
  level === "public" || (level === "friends" && viewerIsFriend);

/**
 * Users/{uid}.privacy (DEFAULT_PRIVACY ile birleşmiş) → görünür bölümler.
 * `profileLoaded` false iken gizlilik BİLİNMİYOR: listeler ve sosyal hesaplar
 * kapalı kalır (aksi hâlde kısıtlı profilde dinleyici permission-denied alır).
 */
export function resolveProfileAccess(
  privacy,
  { viewerIsFriend = false, profileLoaded = true } = {},
) {
  const p = privacy || {};
  const canViewProfile = allows(p.profile, viewerIsFriend);
  return {
    canViewProfile,
    canViewLists: profileLoaded && canViewProfile && allows(p.lists, viewerIsFriend),
    canViewSocialLinks:
      profileLoaded && canViewProfile && allows(p.socialLinks, viewerIsFriend),
    showPresenceText:
      p.onlineStatus === "everyone" || (p.onlineStatus === "friends" && viewerIsFriend),
  };
}
