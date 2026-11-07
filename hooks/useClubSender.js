// hooks/useClubSender.js
//
// Film Kulübü yazımlarında (sohbet duyurusu, tartışma mesajı) gönderen kimliği. ChatScreen'in grup
// `senderFields`'ıyla AYNI kaynaklar: ad/kullanıcı adı UserProfileContext'ten, avatar ProfileUiContext.myAvatar'dan.

import { useMemo } from "react";
import { getAuth } from "firebase/auth";
import { useProfileUi } from "@context/ProfileUiContext";
import { useUserProfile } from "@context/UserProfileContext";
import { avatarSnapshot } from "@utils/avatarPhotos";

export default function useClubSender() {
  const currentUser = getAuth().currentUser;
  const { myAvatar } = useProfileUi();
  const { displayName, username } = useUserProfile();
  const snapshot = avatarSnapshot(myAvatar);
  const uid = currentUser?.uid || null;
  const name = displayName || currentUser?.displayName || "";
  return useMemo(
    () => ({
      uid,
      name,
      username: username || "",
      avatarIndex: snapshot.avatarIndex,
      photoURL: snapshot.photoURL,
    }),
    [uid, name, username, snapshot.avatarIndex, snapshot.photoURL],
  );
}
