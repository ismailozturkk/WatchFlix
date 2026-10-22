// screens/cineswipe/CineSwipeScreen.js
//
// CineSwipe ("Birlikte Ne İzlesek?") ana ekranı. Burada yalnız ORKESTRASYON var:
//   • Solo deste durumu  → hooks/useCineSoloDeck (soloReducer + ağ),
//   • deste / filtre / oda mantığı → services/cineswipe/*,
//   • görünüm → components/cineswipe/*.
//
// Solo ↔ Duo geçişi solo desteyi ve sepeti korur. Duo'da oy sırası yerel
// (`roomIndex`); oy yazılana kadar ilerlemez, yazma hatasında kart geri döner.
// Odadan çıkış (geri tuşu / kaydırma / başlık oku) onay ister: bekleyen oda
// kapatılır, oynanan oda yarım bırakılır.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import Toast from "@components/AppToast";
import AppIcon from "../../components/AppIcon";
import GlassCloseButton from "../../components/common/GlassCloseButton";
import CineActionBar from "../../components/cineswipe/CineActionBar";
import CineCardStack from "../../components/cineswipe/CineCardStack";
import CineDuoLobby from "../../components/cineswipe/CineDuoLobby";
import CineDuoProgress from "../../components/cineswipe/CineDuoProgress";
import CineDuoResultsModal from "../../components/cineswipe/CineDuoResultsModal";
import CineEmptyState from "../../components/cineswipe/CineEmptyState";
import CineFilterSheet from "../../components/cineswipe/CineFilterSheet";
import CineLikedBasketModal from "../../components/cineswipe/CineLikedBasketModal";
import CineMatchModal from "../../components/cineswipe/CineMatchModal";
import CineRoomConfigModal from "../../components/cineswipe/CineRoomConfigModal";
import CineSegmented from "../../components/cineswipe/CineSegmented";
import CineWaitingRoom from "../../components/cineswipe/CineWaitingRoom";
import PressableScale from "../../components/cineswipe/PressableScale";
import { cineColors } from "../../components/cineswipe/cineTheme";
import { describeFilters } from "../../components/cineswipe/filterLabels";
import useCineCopy from "../../components/cineswipe/useCineCopy";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useListStatusContext } from "../../context/ListStatusContext";
import { useSharedLists } from "../../context/SharedListsContext";
import { useTheme } from "../../context/ThemeContext";
import useCineSoloDeck from "../../hooks/useCineSoloDeck";
import { usePremiumDailyGate, usePremiumGate } from "../../hooks/usePremiumGate";
import usePremiumScreenGuard from "../../hooks/usePremiumScreenGuard";
import { alpha } from "../../theme/colors";
import {
  assertCineRoomAvailable,
  cineMediaKey,
  cineVotesFor,
  createCineRoom,
  deleteCineRoom,
  fetchRoomDeck,
  joinCineRoom,
  recordSwipe,
  subscribeToCineRoom,
  summarizeCineRoom,
} from "../../services/cineswipe/cineswipeService";
import { persistCineResults } from "../../services/cineswipe/cineResultsStore";
import ShareToChatSheet from "../../components/chat/ShareToChatSheet";
import { buildCineRoomShare, chatParamsForShare } from "../../utils/chatShare";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import {
  basketListName,
  extractRoomCode,
  fillText,
  normalizeWatchlistItem,
  shuffleCards,
  tmdbLanguage,
  toListItem,
} from "../../services/cineswipe/deckModel";
import { triggerHaptic } from "../../services/hapticsService";
import { addItemsToCustomRootList } from "../../services/listItemsService";
import { addManyToMembership, setListMembership } from "../../services/libraryActions";
import { addItemToSharedList, createSharedList } from "../../services/sharedListsService";
import { Keys, get, subscribe } from "../../services/storage";

const IDLE_ROOM = { state: "idle", id: null };

export default function CineSwipeScreen({ route, navigation }) {
  const { theme } = useTheme();
  const colors = useMemo(() => cineColors(theme), [theme]);
  const copy = useCineCopy();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const uid = user?.uid || null;
  const resultText = t.cineRoomResults;
  const joinText = t.cineRoomJoin;

  // Sohbetteki CineSwipe davetinden gelindiyse (utils/chatShare.shareRoute) oda
  // kodu kutuya HAZIR yazılır; katılmak için "Katıl"a basmak alıcıya kalır.
  const inviteCode = extractRoomCode(route?.params?.inviteCode || "");
  const [mode, setMode] = useState(
    route?.params?.initialMode === "duo" || inviteCode || route?.params?.together ? "duo" : "solo",
  );

  // ── Solo ───────────────────────────────────────────────────────────────────
  const solo = useCineSoloDeck({ enabled: mode === "solo", language, userId: uid });
  const { state: soloState, view } = solo;
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showLikedBasket, setShowLikedBasket] = useState(false);
  const [matchedMedia, setMatchedMedia] = useState(null);
  const [matchIsWinner, setMatchIsWinner] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const announcedWinner = useRef(null);

  // ── Duo ────────────────────────────────────────────────────────────────────
  const [roomState, setRoomState] = useState("idle"); // idle | created | playing | finished
  const [roomId, setRoomId] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [roomMeta, setRoomMeta] = useState(null);
  const [roomDeck, setRoomDeck] = useState([]);
  const [roomIndex, setRoomIndex] = useState(0);
  const [inputCode, setInputCode] = useState(inviteCode);
  const [partnerName, setPartnerName] = useState(null);
  const [currentRoomData, setCurrentRoomData] = useState(null);
  const [allMatches, setAllMatches] = useState([]);
  const [result, setResult] = useState(null);
  const [lastResult, setLastResult] = useState(() => (uid ? get(Keys.cineLastResult, { uid }) : null));
  const [cleanupError, setCleanupError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [savingSwipe, setSavingSwipe] = useState(false);
  const [swipeError, setSwipeError] = useState(false);
  const [cardRevision, setCardRevision] = useState(0);
  const [showRoomConfig, setShowRoomConfig] = useState(false);
  const [showDuoResults, setShowDuoResults] = useState(false);
  const [sharedState, setSharedState] = useState("idle");
  const [watchlistState, setWatchlistState] = useState("idle");

  const codeInputRef = useRef(null);
  const stackRef = useRef(null);
  const joinAttempt = useRef(0);
  const joinBusy = useRef(false);
  const autoJoinCode = useRef(null);
  const roomSession = useRef(0);
  const swipeBusy = useRef(false);
  const finishedRoom = useRef(null);
  const roomRef = useRef(IDLE_ROOM); // geri tuşu dinleyicisi için güncel oda durumu
  roomRef.current = roomState === "created" || roomState === "playing" ? { state: roomState, id: roomId } : IDLE_ROOM;

  // Premium hakları: oda KURMA ve tek başına kaydırma günlük; sonuçları yeni
  // özel/ortak listeye kaydetmek liste limitlerine tabi. Odaya katılmak ve
  // odadaki ortak kaydırmalar serbest (işi başlatan sayılır).
  // CineSwipe Premium'da: Hub kartı Free'de zaten yükseltme sayfasını açar; bu,
  // ekrana başka bir yoldan ulaşılırsa ikinci kapıdır (bkz. hooks/usePremiumScreenGuard).
  usePremiumScreenGuard("cineswipe_swipes", navigation);
  const roomsGate = usePremiumDailyGate("cineswipe_rooms");
  const swipesGate = usePremiumDailyGate("cineswipe_swipes");
  const customListsGate = usePremiumGate("custom_lists");
  const sharedListsGate = usePremiumGate("shared_lists");
  const { otherListKeys = [] } = useListStatusContext() || {};
  const { sharedLists = [] } = useSharedLists() || {};

  useEffect(
    () => () => {
      joinAttempt.current += 1;
      roomSession.current += 1;
    },
    [],
  );

  const resetRoom = useCallback(() => {
    roomSession.current += 1;
    finishedRoom.current = null;
    swipeBusy.current = false;
    roomRef.current = IDLE_ROOM;
    setSavingSwipe(false);
    setSwipeError(false);
    setResult(null);
    setCleanupError(false);
    setRoomId(null);
    setRoomCode("");
    setRoomMeta(null);
    setRoomState("idle");
    setCurrentRoomData(null);
    setPartnerName(null);
    setAllMatches([]);
    setRoomDeck([]);
    setRoomIndex(0);
    setShowDuoResults(false);
    setSharedState("idle");
    setWatchlistState("idle");
  }, []);

  // Hesap değişince oda ve son sonuç sıfırlanır (solo deste kendi kancasında yenilenir).
  // Son sonuç başka yerden silinirse (hesap sıfırlama) ekran eski sonucu göstermesin.
  useEffect(() => {
    if (!uid) return undefined;
    return subscribe(Keys.cineLastResult, () => setLastResult(get(Keys.cineLastResult, { uid })), { uid });
  }, [uid]);

  useEffect(() => {
    joinAttempt.current += 1;
    joinBusy.current = false;
    autoJoinCode.current = null;
    setJoining(false);
    setLastResult(uid ? get(Keys.cineLastResult, { uid }) : null);
    resetRoom();
  }, [uid, resetRoom]);

  const showRoomError = useCallback(
    (error) => {
      resetRoom();
      setMode("duo");
      setJoinError(error?.code?.replace(/^firestore\//, "") || "unknown");
    },
    [resetRoom],
  );

  const returnToHub = () => {
    joinAttempt.current += 1;
    resetRoom();
    navigation.navigate("TabScreen", { initialTab: "share" });
  };

  // ── Odadan çıkış onayı ─────────────────────────────────────────────────────
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        const { state, id } = roomRef.current;
        if (state === "idle") return;
        event.preventDefault();
        Alert.alert(
          copy.leave.title,
          state === "created" ? copy.leave.bodyWaiting : copy.leave.bodyPlaying,
          [
            { text: copy.leave.stay, style: "cancel" },
            {
              text: copy.leave.confirm,
              style: "destructive",
              onPress: () => {
                if (state === "created" && id) {
                  // Kendi silmemiz: dinleyicinin "oda silindi" hatası arayüzü bozmasın.
                  finishedRoom.current = id;
                  deleteCineRoom(id).catch(() => {});
                }
                roomRef.current = IDLE_ROOM;
                navigation.dispatch(event.data.action);
              },
            },
          ],
        );
      }),
    [navigation, copy],
  );

  // ── Ortak yardımcılar ──────────────────────────────────────────────────────
  const openDetails = useCallback(
    (media) => {
      if (!media) return;
      navigation.navigate(media.mediaType === "tv" ? "TvShowDetailsScreen" : "MovieDetailsScreen", {
        movieId: media.id,
        tvShowId: media.id,
        media: {
          id: media.id,
          type: media.mediaType || "movie",
          title: media.title,
          name: media.name,
          poster_path: media.poster_path,
        },
      });
    },
    [navigation],
  );

  /** CineMatchModal "Eklendi ✓" göstersin diye başarıyı döndürür. */
  const addOneToWatchlist = useCallback(
    async (media) => {
      if (!uid || !media) return false;
      try {
        await setListMembership({
          uid,
          listKey: "watchList",
          item: toListItem(media),
          desired: true,
        });
        return true;
      } catch (error) {
        Toast.show({ type: "error", text1: copy.toasts.watchlistError });
        return false;
      }
    },
    [uid, copy],
  );

  const addManyToWatchlist = useCallback(
    async (items) => {
      if (!uid || !items?.length) return false;
      try {
        // Eskiden içe aktarma yazıcısından geçiyordu: eser başına transaction +
        // tüm yorumları okuma + sonunda profil istatistiğini BÜTÜN listeleri
        // tarayarak yeniden hesaplama. Sepeti izlenecekler listesine eklemek için
        // 100'lük parçalar hâlinde tek transaction yeter.
        await addManyToMembership({
          uid,
          listKey: "watchList",
          items: items.map((item) => toListItem(item)),
        });
        Toast.show({
          type: "success",
          text1: copy.toasts.watchlistBulkTitle,
          text2: fillText(copy.toasts.watchlistBulkBody, { n: items.length }),
        });
        return true;
      } catch (error) {
        Toast.show({ type: "error", text1: copy.toasts.watchlistError });
        return false;
      }
    },
    [uid, copy],
  );

  // ── Solo ───────────────────────────────────────────────────────────────────
  const swipesAllowedSolo = swipesGate.allows(swipesGate.used);
  const isSoloLoading = soloState.status === "loading" || view.waitingMore;
  const soloCards = soloState.status === "ready" ? soloState.deck.slice(soloState.index, soloState.index + 3) : [];

  const handleSoloSwipe = (direction, media) => {
    // Üstteki kart ile durum makinesinin kartı ayrışırsa oy sayılmaz.
    if (!view.current || cineMediaKey(media) !== cineMediaKey(view.current)) return;
    if (!swipesGate.tryConsume()) {
      setCardRevision((value) => value + 1); // Hak bitti: kart ortaya döner.
      return;
    }
    solo.swipe(direction);
  };

  const handleUndo = () => {
    if (!view.canUndo) return;
    triggerHaptic("selection");
    solo.undo();
    swipesGate.refund(); // Geri alınan kart yeniden kaydırılacak: hakkı iade et.
  };

  const openMatch = (media, winner = false) => {
    setMatchedMedia(media);
    setMatchIsWinner(winner);
    setShowMatchModal(true);
  };

  const handleReroll = () => {
    const pool = soloState.basket.filter((item) => cineMediaKey(item) !== cineMediaKey(matchedMedia));
    if (pool.length) setMatchedMedia(pool[Math.floor(Math.random() * pool.length)]);
  };

  const startSecondRound = (items) => {
    solo.startFinal(shuffleCards(items));
    Toast.show({ type: "success", text1: copy.solo.finalStartedTitle, text2: copy.solo.finalStartedBody });
  };

  const saveBasketAsList = async (items) => {
    if (!uid || !items?.length) return;
    const name = basketListName();
    // Aynı günün listesi varsa ona eklenir (yeni liste açılmaz, limit dışı).
    if (!otherListKeys.includes(name) && !customListsGate.check(otherListKeys.length)) return;
    try {
      const outcome = await addItemsToCustomRootList(uid, name, items.map((item) => toListItem(item)));
      if (outcome.added === 0) {
        Toast.show({ type: "info", text1: fillText(copy.toasts.listNothingNew, { name }) });
      } else {
        Toast.show({
          type: "success",
          text1: copy.toasts.listSavedTitle,
          text2: fillText(copy.toasts.listSavedBody, { name, n: outcome.added }),
        });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1:
          error?.code === "list-name-conflict"
            ? fillText(copy.toasts.listConflict, { name })
            : copy.toasts.listError,
      });
    }
  };

  // 2. tur sonunda tek içerik kalırsa kazanan sayfası kendiliğinden açılır (bir kez).
  const winnerKey = view.winner ? `${soloState.requestId}_${cineMediaKey(view.winner)}` : null;
  useEffect(() => {
    if (!winnerKey || mode !== "solo" || announcedWinner.current === winnerKey) return;
    announcedWinner.current = winnerKey;
    setMatchedMedia(view.winner);
    setMatchIsWinner(true);
    setShowMatchModal(true);
  }, [winnerKey, mode, view.winner]);

  // ── Duo: oda yaşam döngüsü ─────────────────────────────────────────────────
  const receiveResults = useCallback(
    async (rId, roomData) => {
      const summary = summarizeCineRoom(roomData);
      if (finishedRoom.current === rId) return;
      if (!summary.complete) {
        showRoomError({ code: "room-expired" });
        return;
      }
      finishedRoom.current = rId;
      const finalResult = {
        roomId: rId,
        summary,
        room: {
          hostUid: roomData.hostUid,
          guestUid: roomData.guestUid,
          hostName: roomData.hostName || "",
          guestName: roomData.guestName || "",
          hostAvatar: roomData.hostAvatar || null,
          guestAvatar: roomData.guestAvatar || null,
        },
      };
      setResult(finalResult);
      setCurrentRoomData(finalResult.room);
      setAllMatches(summary.matches);
      setRoomState("finished");
      setShowDuoResults(true);
      setRoomId(null); // Beklenen sunucu silmesinden önce ayrıl; yerel sonuç kalır.
      setSavingSwipe(false);
      triggerHaptic("notification");
      const session = roomSession.current;
      try {
        const saved = await persistCineResults(finalResult, uid);
        if (session === roomSession.current) {
          setLastResult(saved);
          setCleanupError(false);
        }
      } catch (error) {
        if (session === roomSession.current) {
          setLastResult(get(Keys.cineLastResult, { uid }));
          setCleanupError(true);
        }
      }
    },
    [uid, showRoomError],
  );

  const retryResultSave = async () => {
    if (!result || !uid) return;
    const session = roomSession.current;
    try {
      const saved = await persistCineResults(result, uid);
      if (session === roomSession.current) {
        setLastResult(saved);
        setCleanupError(false);
      }
    } catch (error) {
      if (session === roomSession.current) {
        setLastResult(get(Keys.cineLastResult, { uid }));
        setCleanupError(true);
      }
    }
  };

  // Sonuç yalnız iki katılımcı da tüm kartları bitirince, bir kez açılır.
  useEffect(() => {
    if (!roomId) return undefined;
    let active = true;
    const unsubscribe = subscribeToCineRoom(
      roomId,
      (roomData) => {
        if (!active || finishedRoom.current === roomId) return;
        try {
          assertCineRoomAvailable(roomData, uid);
        } catch (error) {
          showRoomError(error);
          return;
        }
        if (roomData.status === "finished") {
          receiveResults(roomId, roomData);
          return;
        }
        setCurrentRoomData(roomData);
        if (roomData.status === "active") {
          setRoomState("playing");
          setPartnerName(roomData.hostUid === uid ? roomData.guestName : roomData.hostName);
        }
      },
      (error) => {
        if (active && finishedRoom.current !== roomId) showRoomError(error);
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [roomId, uid, receiveResults, showRoomError]);

  const handleOpenRoomConfig = () => {
    if (!user) {
      Toast.show({ type: "info", text1: copy.toasts.needLogin });
      return;
    }
    // Günlük oda kurma hakkı; harcama oda gerçekten kurulunca.
    if (!roomsGate.check()) return;
    triggerHaptic("selection");
    setShowRoomConfig(true);
  };

  // `presetDeck`: hazır deste (arkadaş profilinden "Birlikte izleyelim"); verilmezse TMDB'den toplanır.
  // Oda kurulursa { code, count } döner (çağıran daveti gönderebilsin), aksi halde undefined.
  const handleConfirmCreateRoom = async (config, presetDeck = null) => {
    if (joinBusy.current) return;
    joinBusy.current = true;
    setJoining(true);
    setJoinError(null);
    resetRoom();
    const session = roomSession.current;
    try {
      const freshDeck = presetDeck?.length
        ? presetDeck
        : await fetchRoomDeck(config, { language: tmdbLanguage(language), userId: uid });
      if (session !== roomSession.current) return;
      const { roomId: newId, roomCode: newCode } = await createCineRoom(user, freshDeck, config);
      if (session !== roomSession.current) {
        await deleteCineRoom(newId).catch(() => {});
        return;
      }
      setRoomId(newId);
      setRoomCode(newCode);
      setRoomDeck(freshDeck);
      setRoomIndex(0);
      setRoomMeta({
        count: freshDeck.length,
        category: config.category,
        mediaType: config.mediaType,
        genreId: config.genreId ?? null,
      });
      setRoomState("created");
      roomsGate.consume();
      triggerHaptic("notification");
      return { code: newCode, count: freshDeck.length };
    } catch (error) {
      if (session === roomSession.current) showRoomError(error);
    } finally {
      joinBusy.current = false;
      setJoining(false);
    }
  };

  // ── Arkadaş profilinden "Birlikte izleyelim" ──────────────────────────────
  // Rota parametresi `together: { deck, friend }` ile gelinirse oda BİR KEZ otomatik kurulur (günlük oda hakkı
  // aynı kapıdan geçer) ve davet kartı o arkadaşın sohbetine gönderilir. Kurulum başarısızsa kullanıcı
  // normal duo ekranında kalır (hata mesajı showRoomError'dan). Davet sohbet ekranını açar; geri dönünce
  // bekleme odası burada durur.
  const together = route?.params?.together || null;
  const togetherStarted = useRef(false);
  const screenAlive = useRef(true);
  useEffect(() => {
    screenAlive.current = true;
    return () => {
      screenAlive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!together || !uid || togetherStarted.current || roomState !== "idle") return;
    const deck = (together.deck || []).map((entry) => normalizeWatchlistItem(entry)).filter(Boolean);
    if (!together.friend?.uid || deck.length === 0) return;
    togetherStarted.current = true;
    if (!roomsGate.check()) return;
    handleConfirmCreateRoom({ targetCardsCount: deck.length, category: "together", mediaType: "all" }, deck).then(
      (created) => {
        if (!created || !screenAlive.current) return;
        const params = chatParamsForShare(
          { uid: together.friend.uid, name: together.friend.name, avatarIndex: together.friend.avatarIndex },
          buildCineRoomShare({ code: created.code, host: user?.displayName || "", count: created.count }),
        );
        if (!params) return;
        trackEvent(ANALYTICS_EVENTS.TOGETHER_ROOM_INVITED, { cards: created.count });
        navigation.navigate("ChatScreen", params);
      },
    );
    // Tek seferlik: ref koruması var; oda durumu ve kapı değişince yeniden tetiklenmesin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [together, uid]);

  const handleCancelRoom = async () => {
    if (!roomId) return;
    finishedRoom.current = roomId; // Kendi silmemiz: "oda silindi" hatası gösterilmesin.
    try {
      await deleteCineRoom(roomId);
      resetRoom();
    } catch (error) {
      finishedRoom.current = null;
      showRoomError(error);
    }
  };

  const handleJoinRoom = async (candidate) => {
    const code = typeof candidate === "string" ? candidate : inputCode;
    if (joinBusy.current) return;
    joinBusy.current = true;
    const attempt = ++joinAttempt.current;
    setJoining(true);
    setJoinError(null);
    try {
      const { roomId: joinedId, roomData } = await joinCineRoom(code, user);
      if (attempt !== joinAttempt.current) return;
      resetRoom();
      const cards = roomData.deck || [];
      const nextIndex = cards.findIndex((media) => !cineVotesFor(roomData, media)[uid]);
      setRoomId(joinedId);
      setRoomCode(roomData.roomCode || code.trim());
      setRoomDeck(cards);
      setRoomIndex(nextIndex < 0 ? cards.length : nextIndex);
      setRoomMeta({
        count: cards.length,
        category: roomData.category || "trending",
        mediaType: roomData.mediaType || "all",
        genreId: roomData.genreId ?? null,
      });
      setPartnerName(roomData.hostUid === uid ? roomData.guestName : roomData.hostName);
      setRoomState(roomData.status === "waiting" ? "created" : "playing");
      triggerHaptic("notification");
    } catch (error) {
      if (attempt === joinAttempt.current) showRoomError(error);
    } finally {
      joinBusy.current = false;
      if (attempt === joinAttempt.current) setJoining(false);
    }
  };

  useEffect(() => {
    if (!route?.params?.autoJoin || !inviteCode || !uid || autoJoinCode.current === inviteCode) return;
    autoJoinCode.current = inviteCode;
    setInputCode(inviteCode);
    handleJoinRoom(inviteCode);
    // One join attempt per accepted code; a failed attempt remains retryable in the room UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.autoJoin, inviteCode, uid]);

  const handleDuoSwipe = async (direction, media) => {
    if (swipeBusy.current || !roomId || !uid || roomState !== "playing" || !media) return;
    if (cineMediaKey(media) !== cineMediaKey(roomDeck[roomIndex] || {})) return;
    swipeBusy.current = true;
    setSavingSwipe(true);
    setSwipeError(false);
    const session = roomSession.current;
    try {
      const { roomData } = await recordSwipe(roomId, uid, media, direction);
      if (session !== roomSession.current) return;
      setRoomIndex((index) => index + 1);
      if (roomData.status === "finished") receiveResults(roomId, roomData);
    } catch (error) {
      if (session !== roomSession.current || finishedRoom.current) return;
      if (["permission-denied", "unauthenticated", "room-deleted", "room-expired"].includes(error?.code?.replace(/^firestore\//, ""))) {
        showRoomError(error);
      } else {
        setSwipeError(true);
        setCardRevision((value) => value + 1); // Yazma hatası: animasyonlu kart geri döner.
      }
    } finally {
      if (session === roomSession.current) {
        swipeBusy.current = false;
        setSavingSwipe(false);
      }
    }
  };

  const handleSwipe = (direction, media) => {
    if (mode === "duo") handleDuoSwipe(direction, media);
    else handleSoloSwipe(direction, media);
  };

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(roomCode);
      triggerHaptic("selection");
      Toast.show({ type: "success", text1: copy.toasts.codeCopied });
    } catch (error) {
      // Pano kullanılamıyorsa paylaşım yolu hâlâ açık.
    }
  };

  // Bekleme odasındaki kodu arkadaşa/gruba sohbette davet kartı olarak gönder.
  const [inviteShare, setInviteShare] = useState(null);
  const handleSendInvite = () => {
    const share = buildCineRoomShare({
      code: roomCode,
      host: user?.displayName || "",
      count: roomMeta?.count,
    });
    if (share) setInviteShare(share);
  };

  const handleShareCode = async () => {
    try {
      await Share.share({ message: fillText(copy.room.shareMessage, { code: roomCode }) });
    } catch (error) {
      // Paylaşım sayfası kapatıldı.
    }
  };

  const handlePasteCode = async () => {
    let code = "";
    try {
      code = extractRoomCode(await Clipboard.getStringAsync());
    } catch (error) {
      code = "";
    }
    if (code) {
      setInputCode(code);
      setJoinError(null);
    } else {
      Toast.show({ type: "info", text1: copy.toasts.pasteEmpty });
    }
  };

  const openLastResult = () => {
    if (!lastResult?.room || !lastResult?.summary) return;
    setResult(lastResult);
    setCleanupError(!!lastResult.receiptPending);
    setCurrentRoomData(lastResult.room);
    setAllMatches(lastResult.summary.matches);
    setPartnerName(lastResult.room.hostUid === uid ? lastResult.room.guestName : lastResult.room.hostName);
    setSharedState("idle");
    setWatchlistState("idle");
    setRoomState("finished");
    setShowDuoResults(true);
  };

  // Duo sonucu: izleme listesine toplu ekleme ve ortak liste (durumlu düğmeler).
  const addMatchesToWatchlist = async (items) => {
    if (watchlistState !== "idle") return;
    setWatchlistState("saving");
    const ok = await addManyToWatchlist(items);
    setWatchlistState(ok ? "done" : "idle");
  };

  const saveMatchesAsSharedList = async (items) => {
    if (!uid || !items?.length || sharedState !== "idle") return;
    const ownedSharedLists = sharedLists.filter((list) => list.ownerId === uid).length;
    if (!sharedListsGate.check(ownedSharedLists, { onUpgrade: () => setShowDuoResults(false) })) return;
    setSharedState("saving");
    try {
      const partnerLabel = partnerName || copy.results.friend;
      const listName = fillText(copy.results.listName, {
        a: partnerLabel,
        b: user.displayName || copy.results.me,
      });
      const isHost = currentRoomData?.hostUid === uid;
      const partnerUid = isHost ? currentRoomData?.guestUid : currentRoomData?.hostUid;
      const partnerAvatar = isHost ? currentRoomData?.guestAvatar : currentRoomData?.hostAvatar;
      const friends = partnerUid
        ? [
            {
              uid: partnerUid,
              name: partnerLabel,
              username: partnerLabel,
              avatarIndex: typeof partnerAvatar === "number" ? partnerAvatar : 0,
              canAdd: true,
              canRemove: true,
              canReorder: true,
            },
          ]
        : [];
      const listId = await createSharedList({ owner: user, name: listName, friends });
      for (const item of items) {
        await addItemToSharedList({
          listId,
          user,
          item: {
            id: item.id,
            type: item.mediaType === "tv" ? "tv" : "movie",
            name: item.title || item.name || "",
            imagePath: item.poster_path || null,
            genres: [],
          },
        });
      }
      setSharedState("done");
    } catch (error) {
      setSharedState("idle");
      Toast.show({ type: "error", text1: copy.results.sharedError });
    }
  };

  // ── Görünüm ────────────────────────────────────────────────────────────────
  const duoCards = roomDeck.slice(roomIndex, roomIndex + 3);
  const duoUpcoming = roomDeck.slice(roomIndex + 1, roomIndex + 7);
  const progress = roomState === "playing" && currentRoomData ? summarizeCineRoom(currentRoomData) : null;
  const partnerProgress = currentRoomData?.hostUid === uid ? progress?.guest : progress?.host;
  const isHost = currentRoomData?.hostUid === uid;
  const duoStatusText = swipeError ? resultText.voteError : savingSwipe ? resultText.saving : "";

  const waitingSummary = roomMeta
    ? fillText(copy.room.summary, {
        count: roomMeta.count,
        filters: describeFilters(roomMeta, copy)
          .map((part) => part.label)
          .join(" · "),
      })
    : "";

  const subtitle =
    mode === "solo"
      ? copy.header.solo
      : partnerName
        ? fillText(copy.header.duoWith, { name: partnerName })
        : copy.header.duo;

  const modeOptions = [
    { id: "solo", icon: "person", label: copy.modes.solo },
    { id: "duo", icon: "people", label: copy.modes.duo },
  ];

  const openFilters = () => {
    triggerHaptic("selection");
    setShowFilterSheet(true);
  };

  const openBasket = () => {
    triggerHaptic("selection");
    setShowLikedBasket(true);
  };

  const centered = (node) => <View style={styles.center}>{node}</View>;

  const renderSolo = () => {
    const watchlistSource = solo.filters.category === "watchlist";
    const basketCount = soloState.basket.length;
    const restartAction = {
      key: "restart",
      icon: "refresh",
      label: copy.solo.restart,
      onPress: () => solo.reload({ clearSeen: true }),
    };

    if (soloState.status === "error") {
      return centered(
        <CineEmptyState
          icon="cloud-offline-outline"
          tint={colors.pass}
          title={copy.solo.errorTitle}
          body={copy.solo.errorBody}
          colors={colors}
          actions={[{ key: "retry", icon: "refresh", label: copy.solo.retry, onPress: () => solo.reload() }]}
        />,
      );
    }

    if (view.noResults) {
      return centered(
        <CineEmptyState
          icon={watchlistSource ? "bookmark-outline" : "film-outline"}
          title={watchlistSource ? copy.solo.watchlistEmptyTitle : copy.solo.noResultsTitle}
          body={watchlistSource ? copy.solo.watchlistEmptyBody : copy.solo.noResultsBody}
          colors={colors}
          actions={[
            { key: "filters", icon: "options-outline", label: copy.solo.changeFilters, onPress: openFilters },
            {
              key: "reset",
              icon: "refresh",
              label: copy.solo.resetFilters,
              variant: "secondary",
              onPress: () => solo.resetFilters(),
            },
          ]}
        />,
      );
    }

    if (view.moreError) {
      return centered(
        <CineEmptyState
          icon="cloud-offline-outline"
          tint={colors.pass}
          title={copy.solo.moreErrorTitle}
          body={copy.solo.moreErrorBody}
          colors={colors}
          actions={[{ key: "retry", icon: "refresh", label: copy.solo.retry, onPress: solo.retryMore }]}
        />,
      );
    }

    if (view.finalOver) {
      if (view.winner) {
        return centered(
          <CineEmptyState
            icon="trophy"
            tint={colors.gold}
            title={copy.solo.winnerTitle}
            body={copy.solo.winnerBody}
            colors={colors}
            actions={[
              { key: "winner", icon: "trophy-outline", label: copy.solo.showWinner, tint: colors.gold, onPress: () => openMatch(view.winner, true) },
              { ...restartAction, variant: "secondary" },
            ]}
          />,
        );
      }
      if (basketCount > 1) {
        return centered(
          <CineEmptyState
            icon="heart"
            tint={colors.heart}
            title={copy.solo.finalOverTitle}
            body={fillText(copy.solo.finalOverBody, { n: basketCount })}
            colors={colors}
            actions={[
              { key: "basket", icon: "heart", label: fillText(copy.solo.viewBasket, { n: basketCount }), tint: colors.heart, onPress: openBasket },
              { ...restartAction, variant: "secondary" },
            ]}
          />,
        );
      }
      return centered(
        <CineEmptyState
          icon="heart-dislike-outline"
          title={copy.solo.finalNoneTitle}
          body={copy.solo.finalNoneBody}
          colors={colors}
          actions={[restartAction]}
        />,
      );
    }

    if (view.finished) {
      return centered(
        <CineEmptyState
          icon="checkmark-done-circle-outline"
          title={copy.solo.doneTitle}
          body={basketCount > 0 ? fillText(copy.solo.doneBodyLikes, { n: basketCount }) : copy.solo.doneBodyNone}
          colors={colors}
          actions={[
            ...(basketCount > 0
              ? [{ key: "basket", icon: "heart", label: fillText(copy.solo.viewBasket, { n: basketCount }), tint: colors.heart, onPress: openBasket }]
              : []),
            restartAction,
            { key: "filters", icon: "options-outline", label: copy.solo.changeFilters, variant: "secondary", onPress: openFilters },
          ]}
        />,
      );
    }

    return (
      <View style={styles.flex}>
        {soloState.round === 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
          >
            {describeFilters(solo.filters, copy).map((part) => (
              <PressableScale
                key={part.key}
                accessibilityRole="button"
                accessibilityLabel={copy.openFilters}
                onPress={openFilters}
                style={[styles.chip, { backgroundColor: alpha(colors.accent, 0.13), borderColor: alpha(colors.accent, 0.3) }]}
              >
                <AppIcon family="Ionicons" name={part.icon} size={14} color={colors.accent} />
                <Text style={[styles.chipText, { color: colors.accent }]} numberOfLines={1}>
                  {part.label}
                </Text>
              </PressableScale>
            ))}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={copy.openFilters}
              onPress={openFilters}
              style={[styles.chip, { backgroundColor: alpha(colors.surface, 0.7), borderColor: colors.border }]}
            >
              <AppIcon family="Ionicons" name="options-outline" size={15} color={colors.textSecondary} />
            </PressableScale>
          </ScrollView>
        ) : (
          <View style={[styles.roundChip, { backgroundColor: alpha(colors.heart, 0.14), borderColor: alpha(colors.heart, 0.35) }]}>
            <AppIcon family="Ionicons" name="repeat" size={14} color={colors.heart} />
            <Text style={[styles.roundChipText, { color: colors.heart }]}>
              {fillText(copy.solo.roundChip, { n: soloState.round, count: Math.max(0, view.remaining) })}
            </Text>
          </View>
        )}

        <CineCardStack
          ref={stackRef}
          cards={soloCards}
          revision={cardRevision}
          loading={isSoloLoading}
          swipesAllowed={swipesAllowedSolo}
          upcoming={view.upcoming}
          onSwipe={handleSwipe}
          onBlocked={() => swipesGate.check()}
          onOpenDetails={openDetails}
          copy={copy}
          colors={colors}
        />
        <CineActionBar
          showUndo
          canUndo={view.canUndo}
          disabled={!view.current}
          onPass={() => stackRef.current?.swipe("pass")}
          onLike={() => stackRef.current?.swipe("like")}
          onUndo={handleUndo}
          onInfo={() => openDetails(view.current)}
          copy={copy}
          colors={colors}
        />
      </View>
    );
  };

  const renderDuo = () => {
    if (roomState === "idle") {
      return (
        <CineDuoLobby
          copy={copy}
          joinText={joinText}
          resultText={resultText}
          colors={colors}
          joining={joining}
          inputCode={inputCode}
          onChangeCode={(value) => {
            setInputCode(value);
            setJoinError(null);
          }}
          inputRef={codeInputRef}
          onCreate={handleOpenRoomConfig}
          onJoin={handleJoinRoom}
          onPaste={handlePasteCode}
          joinError={joinError}
          onRetryJoin={() => {
            setJoinError(null);
            setInputCode("");
            codeInputRef.current?.focus();
          }}
          onHub={returnToHub}
          hasLastResult={!!lastResult}
          onOpenLastResult={openLastResult}
        />
      );
    }

    if (roomState === "created") {
      return (
        <CineWaitingRoom
          roomCode={roomCode}
          summary={waitingSummary}
          onCopy={handleCopyCode}
          onShare={handleShareCode}
          onSendToChat={handleSendInvite}
          onCancel={handleCancelRoom}
          copy={copy}
          colors={colors}
        />
      );
    }

    if (roomState === "finished") {
      return centered(
        <CineEmptyState
          icon="trophy"
          tint={colors.gold}
          title={resultText.title}
          body={resultText.subtitle}
          colors={colors}
          actions={[
            { key: "results", icon: "trophy-outline", label: resultText.showResults, tint: colors.gold, onPress: () => setShowDuoResults(true) },
            {
              key: "new",
              icon: "add-circle-outline",
              label: resultText.newRoom,
              variant: "secondary",
              onPress: () => {
                resetRoom();
                setInputCode("");
              },
            },
            { key: "hub", icon: "home-outline", label: joinText.hub, variant: "secondary", onPress: returnToHub },
          ]}
        />,
      );
    }

    // playing
    const progressBar = (
      <CineDuoProgress
        youCount={roomIndex}
        partnerCount={partnerProgress?.reviewed || 0}
        total={roomDeck.length}
        partnerName={partnerName}
        statusText={duoStatusText}
        copy={copy}
        colors={colors}
      />
    );

    if (roomIndex >= roomDeck.length) {
      return (
        <View style={styles.flex}>
          {progressBar}
          {centered(<CineEmptyState loading title={resultText.waitingTitle} body={resultText.waitingBody} colors={colors} />)}
        </View>
      );
    }

    return (
      <View style={styles.flex}>
        {progressBar}
        <CineCardStack
          ref={stackRef}
          cards={duoCards}
          revision={cardRevision}
          disabled={savingSwipe}
          upcoming={duoUpcoming}
          onSwipe={handleSwipe}
          onOpenDetails={openDetails}
          copy={copy}
          colors={colors}
        />
        <CineActionBar
          showUndo={false}
          canUndo={false}
          disabled={savingSwipe}
          onPass={() => stackRef.current?.swipe("pass")}
          onLike={() => stackRef.current?.swipe("like")}
          onUndo={() => {}}
          onInfo={() => openDetails(roomDeck[roomIndex])}
          copy={copy}
          colors={colors}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: alpha(colors.text, 0.08) }]}>
        <View style={[styles.side, styles.sideStart]}>
          <GlassCloseButton
            icon="chevron-back"
            size={40}
            fallbackRadius={20}
            iconSize={22}
            color={colors.text}
            backgroundColor={alpha(colors.text, 0.07)}
            hitSlop={10}
            accessibilityLabel={copy.back}
            onPress={() => navigation.goBack()}
          />
        </View>

        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        </View>

        <View style={[styles.side, styles.sideEnd]}>
          {mode === "solo" ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={copy.openBasket}
              onPress={openBasket}
              style={[styles.pill, { backgroundColor: alpha(colors.heart, soloState.basket.length > 0 ? 0.2 : 0.1) }]}
            >
              <AppIcon family="Ionicons" name="heart" size={16} color={colors.heart} />
              <Text style={[styles.pillText, { color: colors.heart }]}>{soloState.basket.length}</Text>
            </PressableScale>
          ) : roomState === "finished" ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={resultText.showResults}
              onPress={() => {
                triggerHaptic("selection");
                setShowDuoResults(true);
              }}
              style={[styles.pill, { backgroundColor: alpha(colors.gold, 0.18) }]}
            >
              <AppIcon family="Ionicons" name="trophy-outline" size={16} color={colors.gold} />
              <Text style={[styles.pillText, { color: colors.gold }]}>{allMatches.length}</Text>
            </PressableScale>
          ) : null}
        </View>
      </View>

      {roomState === "idle" && !joining ? (
        <CineSegmented
          options={modeOptions}
          value={mode}
          onChange={setMode}
          colors={colors}
          style={styles.segment}
        />
      ) : null}

      <View style={styles.flex}>{mode === "solo" ? renderSolo() : renderDuo()}</View>

      <CineFilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        filters={solo.filters}
        onApply={solo.applyFilters}
      />

      <CineLikedBasketModal
        visible={showLikedBasket}
        onClose={() => setShowLikedBasket(false)}
        items={soloState.basket}
        onRandomPick={(picked) => openMatch(picked, false)}
        onSecondRound={startSecondRound}
        onSaveList={saveBasketAsList}
        onAddWatchlist={addManyToWatchlist}
        onClear={solo.clearBasket}
        onRemove={(media) => solo.removeFromBasket(cineMediaKey(media))}
        onOpenDetails={openDetails}
      />

      <CineRoomConfigModal
        visible={showRoomConfig}
        onClose={() => setShowRoomConfig(false)}
        onConfirmCreate={handleConfirmCreateRoom}
      />

      <CineDuoResultsModal
        visible={showDuoResults && roomState === "finished"}
        onClose={() => setShowDuoResults(false)}
        summary={result?.summary}
        isHost={isHost}
        cleanupError={cleanupError}
        onRetrySave={retryResultSave}
        matches={allMatches}
        partnerName={partnerName}
        onSelectMedia={openDetails}
        onAddAllToWatchlist={addMatchesToWatchlist}
        onSaveAsSharedList={saveMatchesAsSharedList}
        sharedState={sharedState}
        watchlistState={watchlistState}
      />

      <CineMatchModal
        visible={mode === "solo" && showMatchModal}
        matchedMedia={matchedMedia}
        isWinner={matchIsWinner}
        onClose={() => setShowMatchModal(false)}
        onViewDetails={openDetails}
        onAddToWatchlist={addOneToWatchlist}
        onReroll={!matchIsWinner && soloState.basket.length > 1 ? handleReroll : undefined}
      />

      <ShareToChatSheet
        visible={inviteShare != null}
        share={inviteShare}
        onClose={() => setInviteShare(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: {
    width: 76,
    flexDirection: "row",
    alignItems: "center",
  },
  sideStart: {
    justifyContent: "flex-start",
  },
  sideEnd: {
    justifyContent: "flex-end",
  },
  titleWrap: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 1,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "900",
  },
  segment: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chips: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "800",
    maxWidth: 190,
  },
  roundChip: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 14,
    marginVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  roundChipText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
});
