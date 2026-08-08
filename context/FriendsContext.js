// context/FriendsContext.js
//
// Arkadaşlar + gelen/gönderilen istekler için merkezi state.
// Realtime listener'lar burada yaşar — UI ekranları doğrudan Firestore'a
// bakmaz, sadece bu context'i tüketir.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Toast from "react-native-toast-message";
import { useAuth } from "./AuthContext";
import {
  subscribeToFriends,
  subscribeToIncomingRequests,
  subscribeToOutgoingRequests,
  subscribeToBlocked,
  sendFriendRequest as sendReq,
  acceptFriendRequest as acceptReq,
  declineFriendRequest as declineReq,
  cancelFriendRequest as cancelReq,
  unfriend as unfriendApi,
  blockUser as blockApi,
  unblockUser as unblockApi,
  checkRelationship as checkRel,
} from "../services/friendsService";
import { useUserProfile } from "./UserProfileContext";
import { getUserProfile } from "../services/userService";
import { i18nText } from "../utils/i18nText";
import useStartupGate from "../hooks/useStartupGate";


const FriendsContext = createContext();
export const useFriends = () => useContext(FriendsContext);

export function FriendsProvider({ children }) {
  const { user } = useAuth();
  const { profile: myProfile } = useUserProfile();
  const uid = user?.uid;

  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Açılış yolundaki hiçbir ekran bu context'i okumuyor (sekmeler + ilk
  // raylar); 3 listener'ı splash sonrası pencerenin dışına ertele. Kademeler
  // için bkz. hooks/useStartupGate.js.
  const startupReady = useStartupGate(3000);

  // ── Realtime listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (!startupReady) return undefined;
    if (!uid) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setBlockedUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let mounted = true;
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount++;
      if (loadedCount >= 3 && mounted) setLoading(false);
    };

    const unsubFriends = subscribeToFriends(uid, (list) => {
      setFriends(list);
      markLoaded();
    });
    const unsubIn = subscribeToIncomingRequests(uid, (list) => {
      setIncomingRequests(list);
      markLoaded();
    });
    const unsubOut = subscribeToOutgoingRequests(uid, (list) => {
      setOutgoingRequests(list);
      markLoaded();
    });
    // markLoaded ÇAĞIRMIYOR: `loading` üç listener'ın sayacına bağlı ve
    // ekranlar onu "arkadaş verisi hazır" anlamında kullanıyor. Engel listesi
    // ayrı bir yüzey (süzgeç) besliyor; sayaca katarsak eşik 3'te kalır ve
    // loading hiç kapanmaz.
    const unsubBlocked = subscribeToBlocked(uid, setBlockedUsers);

    return () => {
      mounted = false;
      unsubFriends();
      unsubIn();
      unsubOut();
      unsubBlocked();
    };
  }, [uid, startupReady]);

  // ── Derived helpers ──────────────────────────────────────────────────────
  const friendUidSet = useMemo(
    () => new Set(friends.map((f) => f.friendUid || f.id)),
    [friends],
  );
  const incomingUidSet = useMemo(
    () => new Set(incomingRequests.map((r) => r.fromUid)),
    [incomingRequests],
  );
  const outgoingUidSet = useMemo(
    () => new Set(outgoingRequests.map((r) => r.toUid)),
    [outgoingRequests],
  );

  // Engel süzgeçlerinin tek kaynağı. Set olarak veriliyor: feed/yorum/arama
  // listeleri her öğe için sorguluyor, dizide arama O(n×m) olurdu.
  const blockedUidSet = useMemo(
    () => new Set(blockedUsers.map((b) => b.uid)),
    [blockedUsers],
  );

  const isFriend = useCallback((targetUid) => friendUidSet.has(targetUid), [friendUidSet]);
  const isBlocked = useCallback(
    (targetUid) => !!targetUid && blockedUidSet.has(targetUid),
    [blockedUidSet],
  );
  const hasIncomingFrom = useCallback(
    (targetUid) => incomingUidSet.has(targetUid),
    [incomingUidSet],
  );
  const hasOutgoingTo = useCallback(
    (targetUid) => outgoingUidSet.has(targetUid),
    [outgoingUidSet],
  );

  // ── Actions ──────────────────────────────────────────────────────────────
  const sendRequest = useCallback(
    async (targetUid) => {
      if (!myProfile?.uid) return;
      if (targetUid === myProfile.uid) return;
      try {
        const targetProfile = await getUserProfile(targetUid);
        if (!targetProfile) throw new Error(i18nText("autoI18n.kullanici_bulunamadi_2", "Kullanıcı bulunamadı"));
        await sendReq(myProfile, targetProfile);
        Toast.show({ type: "success", text1: i18nText("autoI18n.istek_gonderildi_2", "İstek gönderildi") });
      } catch (e) {
        Toast.show({ type: "error", text1: e.message });
      }
    },
    [myProfile],
  );

  const acceptRequest = useCallback(
    async (fromUid) => {
      if (!myProfile?.uid) return;
      try {
        const fromProfile = await getUserProfile(fromUid);
        if (!fromProfile) throw new Error(i18nText("autoI18n.kullanici_bulunamadi_2", "Kullanıcı bulunamadı"));
        await acceptReq(myProfile, fromProfile);
        Toast.show({ type: "success", text1: i18nText("autoI18n.arkadas_olarak_eklendi", "Arkadaş olarak eklendi") });
      } catch (e) {
        Toast.show({ type: "error", text1: e.message });
      }
    },
    [myProfile],
  );

  const declineRequest = useCallback(
    async (fromUid) => {
      if (!uid) return;
      try {
        await declineReq(uid, fromUid);
      } catch (e) {
        Toast.show({ type: "error", text1: e.message });
      }
    },
    [uid],
  );

  const cancelRequest = useCallback(
    async (toUid) => {
      if (!uid) return;
      try {
        await cancelReq(uid, toUid);
      } catch (e) {
        Toast.show({ type: "error", text1: e.message });
      }
    },
    [uid],
  );

  const removeFriend = useCallback(
    async (friendUid) => {
      if (!uid) return;
      try {
        await unfriendApi(uid, friendUid);
        Toast.show({ type: "success", text1: i18nText("autoI18n.arkadasliktan_cikarildi", "Arkadaşlıktan çıkarıldı") });
      } catch (e) {
        Toast.show({ type: "error", text1: e.message });
      }
    },
    [uid],
  );

  const block = useCallback(
    async (targetUid) => {
      if (!myProfile?.uid) return;
      try {
        await blockApi(myProfile, targetUid);
        Toast.show({ type: "success", text1: i18nText("autoI18n.kullanici_engellendi", "Kullanıcı engellendi") });
      } catch (e) {
        Toast.show({ type: "error", text1: e.message });
      }
    },
    [myProfile],
  );

  const unblock = useCallback(
    async (targetUid) => {
      if (!uid) return;
      try {
        await unblockApi(uid, targetUid);
        Toast.show({ type: "success", text1: i18nText("autoI18n.engel_kaldirildi", "Engel kaldırıldı") });
      } catch (e) {
        Toast.show({ type: "error", text1: e.message });
      }
    },
    [uid],
  );

  const checkRelationship = useCallback(
    async (targetUid) => checkRel(uid, targetUid),
    [uid],
  );

  const value = useMemo(
    () => ({
      // state
      friends,
      incomingRequests,
      outgoingRequests,
      blockedUsers,
      loading,
      // derived
      isFriend,
      hasIncomingFrom,
      hasOutgoingTo,
      blockedUidSet,
      isBlocked,
      // actions
      sendRequest,
      acceptRequest,
      declineRequest,
      cancelRequest,
      removeFriend,
      block,
      unblock,
      checkRelationship,
    }),
    [
      friends,
      incomingRequests,
      outgoingRequests,
      blockedUsers,
      loading,
      isFriend,
      hasIncomingFrom,
      hasOutgoingTo,
      blockedUidSet,
      isBlocked,
      sendRequest,
      acceptRequest,
      declineRequest,
      cancelRequest,
      removeFriend,
      block,
      unblock,
      checkRelationship,
    ],
  );

  return (
    <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>
  );
}
