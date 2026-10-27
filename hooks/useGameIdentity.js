// hooks/useGameIdentity.js
//
// Liderlik tablosuna yazılan oyuncu kimliği: profildeki ad + avatar anlık kopyası (SceneGuessGameScreen'deki
// gameIdentity ile aynı kural — Auth kullanıcısının tazelenmeyen adı/fotoğrafı değil). Girişsizse null.

import { useMemo } from "react";
import { useAuth } from "@context/AuthContext";
import { useUserProfile } from "@context/UserProfileContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { avatarSnapshot } from "@utils/avatarPhotos";

export default function useGameIdentity() {
  const { user } = useAuth() || {};
  const { displayName } = useUserProfile() || {};
  const { myAvatar } = useProfileUi() || {};
  return useMemo(() => {
    if (!user) return null;
    return { displayName: displayName || user.displayName || "", ...avatarSnapshot(myAvatar) };
  }, [user, displayName, myAvatar]);
}
