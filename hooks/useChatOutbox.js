// hooks/useChatOutbox.js
//
// services/chatOutbox.postShareToChat'in gönderen kimliğini ChatScreen'deki kaynaklardan kurar
// (görünen ad / kullanıcı adı: UserProfileContext, avatar: ProfileUiContext.myAvatar).
//
// 1-1 hedefte arkadaşlık bitmişse ya da kişi engellenmişse YAZMAZ: arkadaşlıktan çıkarma sohbeti
// siliyor, otomatik bir sonuç kartı o sohbeti yeniden açmamalı. Arkadaş listesi yüklenirken karar
// verilemediği için engel yalnız yüklenmiş listeye göre uygulanır.

import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useFriends } from "../context/FriendsContext";
import { useProfileUi } from "../context/ProfileUiContext";
import { useUserProfile } from "../context/UserProfileContext";
import { postShareToChat } from "../services/chatOutbox";
import { avatarSnapshot } from "../utils/avatarPhotos";

export default function useChatOutbox() {
  const { user } = useAuth() || {};
  const { displayName, username } = useUserProfile() || {};
  const { myAvatar } = useProfileUi() || {};
  const { isFriend, isBlocked, loading: friendsLoading } = useFriends() || {};

  return useCallback(
    async (chat, share) => {
      const friendUid = chat?.friendUid;
      if (friendUid && (isBlocked?.(friendUid) || (!friendsLoading && isFriend && !isFriend(friendUid)))) {
        throw new Error("not-friends");
      }
      const snapshot = avatarSnapshot(myAvatar);
      return postShareToChat({
        sender: {
          uid: user?.uid,
          displayName: displayName || user?.displayName || "",
          username: username || "",
          avatarIndex: snapshot.avatarIndex,
          photoURL: snapshot.photoURL,
        },
        chat,
        share,
      });
    },
    [user?.uid, user?.displayName, displayName, username, myAvatar, isFriend, isBlocked, friendsLoading],
  );
}
