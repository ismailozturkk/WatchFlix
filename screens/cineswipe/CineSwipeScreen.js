// screens/cineswipe/CineSwipeScreen.js
//
// CineSwipe ("Birlikte Ne İzlesek?") 2.0 ana oyun ve eşleşme ekranı.
// Solo modda zengin kategori/tür filtreleme, kesintisiz sonsuz deste ve çoklu Beğeni Sepeti;
// Duo modda yapılandırılabilir oda kurulumu, beklemede iptal butonu ve tüm eşleşmeler sonuç galerisi sunar.

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Share,
  Dimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import AppIcon from "../../components/AppIcon";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { alpha } from "../../theme/colors";
import {
  fetchSwipeDeck,
  createCineRoom,
  joinCineRoom,
  recordSwipe,
  subscribeToCineRoom,
  deleteCineRoom,
  assertCineRoomAvailable,
  summarizeCineRoom,
  cineVotesFor,
  cineMediaKey,
} from "../../services/cineswipe/cineswipeService";
import { persistCineResults } from "../../services/cineswipe/cineResultsStore";
import { Keys, get } from "../../services/storage";
import { addToList } from "../../services/listItemsService";
import { writeImportedItems } from "../../services/import/importWriter";
import { createSharedList, addItemToSharedList } from "../../services/sharedListsService";
import SwipeCard from "../../components/cineswipe/SwipeCard";
import CineMatchModal from "../../components/cineswipe/CineMatchModal";
import CineFilterSheet from "../../components/cineswipe/CineFilterSheet";
import CineLikedBasketModal from "../../components/cineswipe/CineLikedBasketModal";
import CineRoomConfigModal from "../../components/cineswipe/CineRoomConfigModal";
import CineDuoResultsModal from "../../components/cineswipe/CineDuoResultsModal";
import { triggerHaptic } from "../../services/hapticsService";
import Toast from "react-native-toast-message";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function CineSwipeScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const resultText = t.cineRoomResults;
  const joinText = t.cineRoomJoin;
  const [joinError, setJoinError] = useState(null);
  const [joining, setJoining] = useState(false);
  const joinAttempt = useRef(0);
  const joinBusy = useRef(false);
  const codeInputRef = useRef(null);
  const deckRequest = useRef(0);
  const roomSession = useRef(0);
  const swipeBusy = useRef(false);
  const finishedRoom = useRef(null);
  const [savingSwipe, setSavingSwipe] = useState(false);
  const [swipeError, setSwipeError] = useState(false);
  const [cardRevision, setCardRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [cleanupError, setCleanupError] = useState(false);
  const [lastResult, setLastResult] = useState(() => user?.uid ? get(Keys.cineLastResult, { uid: user.uid }) : null);
  useEffect(() => () => { joinAttempt.current += 1; roomSession.current += 1; }, []);

  const resetRoom = useCallback(() => {
    roomSession.current += 1;
    finishedRoom.current = null;
    swipeBusy.current = false;
    setSavingSwipe(false);
    setSwipeError(false);
    setResult(null);
    setCleanupError(false);
    setRoomId(null);
    setRoomCode("");
    setRoomState("idle");
    setCurrentRoomData(null);
    setPartnerName(null);
    setAllMatches([]);
    setMatchedMedia(null);
    setShowMatchModal(false);
    setShowDuoResults(false);
    setCurrentIndex(0);
    setHistory([]);
  }, []);
  useEffect(() => {
    joinAttempt.current += 1;
    joinBusy.current = false;
    setJoining(false);
    setLastResult(user?.uid ? get(Keys.cineLastResult, { uid: user.uid }) : null);
    resetRoom();
  }, [user?.uid, resetRoom]);

  const showRoomError = useCallback((error) => {
    resetRoom();
    setMode("duo");
    setLoadingDeck(false);
    setJoinError(error?.code?.replace(/^firestore\//, "") || "unknown");
  }, [resetRoom]);
  const returnToHub = () => {
    joinAttempt.current += 1;
    resetRoom();
    navigation.navigate("TabScreen", { initialTab: "share" });
  };
  const initialMode = route?.params?.initialMode || "solo";

  const [mode, setMode] = useState(initialMode); // "solo" | "duo"
  const [deck, setDeck] = useState([]);
  const [loadingDeck, setLoadingDeck] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  // Solo Filtreleme Ayarları
  const [category, setCategory] = useState("trending");
  const [mediaType, setMediaType] = useState("movie");
  const [genreId, setGenreId] = useState(null);

  // Solo Beğenilenler Sepeti
  const [likedBasket, setLikedBasket] = useState([]);

  // Modallar
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showLikedBasket, setShowLikedBasket] = useState(false);
  const [showRoomConfig, setShowRoomConfig] = useState(false);
  const [showDuoResults, setShowDuoResults] = useState(false);

  // Duo Oda Durumları
  const [roomState, setRoomState] = useState("idle"); // "idle" | "created" | "playing" | "finished"
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [partnerName, setPartnerName] = useState(null);
  const [currentRoomData, setCurrentRoomData] = useState(null);
  const [allMatches, setAllMatches] = useState([]);

  // Eşleşme Spotlight Modalı
  const [matchedMedia, setMatchedMedia] = useState(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

  // Desteyi Yükle
  const loadDeck = useCallback(
    async (customCategory = category, customMediaType = mediaType, customGenre = genreId) => {
      const request = ++deckRequest.current;
      setLoadingDeck(true);
      setPage(1);
      const items = await fetchSwipeDeck({
        language: "tr-TR",
        category: customCategory,
        mediaType: customMediaType,
        genreId: customGenre,
        page: 1,
        userId: user?.uid || null,
      });
      if (request !== deckRequest.current) return;
      setDeck(items);
      setCurrentIndex(0);
      setHistory([]);
      setLoadingDeck(false);
    },
    [category, mediaType, genreId, user?.uid]
  );

  useEffect(() => {
    if (mode === "solo" && roomState === "idle") loadDeck();
  }, [loadDeck, mode, roomState]);

  // Sonsuz Kaydırma: Deste azaldıkça sonraki sayfayı çek
  const checkNextPage = async (nextIndex) => {
    if (mode !== "solo" || category === "watchlist" || isFetchingNextPage) return;
    if (nextIndex >= deck.length - 4) {
      setIsFetchingNextPage(true);
      try {
        const nextPage = page + 1;
        const nextItems = await fetchSwipeDeck({
          language: "tr-TR",
          category,
          mediaType,
          genreId,
          page: nextPage,
          userId: user?.uid || null,
        });
        if (nextItems && nextItems.length > 0) {
          setPage(nextPage);
          setDeck((prev) => [...prev, ...nextItems]);
        }
      } catch (e) {
        // sessizce geç
      } finally {
        setIsFetchingNextPage(false);
      }
    }
  };

  const receiveResults = useCallback(async (rId, roomData) => {
    const summary = summarizeCineRoom(roomData);
    if (finishedRoom.current === rId) return;
    if (!summary.complete) { showRoomError({ code: "room-expired" }); return; }
    finishedRoom.current = rId;
    const finalResult = {
      roomId: rId, summary,
      room: { hostUid: roomData.hostUid, guestUid: roomData.guestUid,
        hostName: roomData.hostName || "", guestName: roomData.guestName || "",
        hostAvatar: roomData.hostAvatar || null, guestAvatar: roomData.guestAvatar || null },
    };
    setResult(finalResult);
    setCurrentRoomData(finalResult.room);
    setAllMatches(summary.matches);
    setRoomState("finished");
    setShowDuoResults(true);
    setRoomId(null); // Detach before expected server deletion; keep the local result.
    setSavingSwipe(false);
    triggerHaptic("notification");
    const session = roomSession.current;
    try {
      const saved = await persistCineResults(finalResult, user.uid);
      if (session === roomSession.current) { setLastResult(saved); setCleanupError(false); }
    } catch (error) {
      if (session === roomSession.current) {
        setLastResult(get(Keys.cineLastResult, { uid: user.uid }));
        setCleanupError(true);
      }
    }
  }, [user?.uid, showRoomError]);

  const retryResultSave = async () => {
    if (!result || !user?.uid) return;
    const session = roomSession.current;
    try {
      const saved = await persistCineResults(result, user.uid);
      if (session === roomSession.current) { setLastResult(saved); setCleanupError(false); }
    } catch (error) {
      if (session === roomSession.current) {
        setLastResult(get(Keys.cineLastResult, { uid: user.uid }));
        setCleanupError(true);
      }
    }
  };

  // Final results open once, only after both participants finish every card.
  useEffect(() => {
    if (!roomId) return;
    let active = true;
    const unsub = subscribeToCineRoom(roomId, (roomData) => {
      if (!active || finishedRoom.current === roomId) return;
      try { assertCineRoomAvailable(roomData, user?.uid); }
      catch (error) { showRoomError(error); return; }
      if (roomData.status === "finished") {
        receiveResults(roomId, roomData);
        return;
      }
      setCurrentRoomData(roomData);
      if (roomData.status === "active") {
        setRoomState("playing");
        setPartnerName(roomData.hostUid === user?.uid ? roomData.guestName : roomData.hostName);
      }
    }, (error) => {
      if (active && finishedRoom.current !== roomId) showRoomError(error);
    });
    return () => { active = false; unsub(); };
  }, [roomId, user?.uid, receiveResults, showRoomError]);

  const handleDuoSwipe = async (media, direction) => {
    if (swipeBusy.current || !roomId || !user?.uid || roomState !== "playing" || !media) return;
    if (cineMediaKey(media) !== cineMediaKey(deck[currentIndex] || {})) return;
    swipeBusy.current = true;
    setSavingSwipe(true);
    setSwipeError(false);
    const session = roomSession.current;
    try {
      const { roomData } = await recordSwipe(roomId, user.uid, media, direction);
      if (session !== roomSession.current) return;
      setCurrentIndex((index) => index + 1);
      if (roomData.status === "finished") receiveResults(roomId, roomData);
    } catch (error) {
      if (session !== roomSession.current || finishedRoom.current) return;
      if (["permission-denied", "unauthenticated", "room-deleted", "room-expired"].includes(error?.code?.replace(/^firestore\//, ""))) {
        showRoomError(error);
      } else {
        setSwipeError(true);
        setCardRevision((value) => value + 1); // Return the animated card after a failed write.
      }
    } finally {
      if (session === roomSession.current) {
        swipeBusy.current = false;
        setSavingSwipe(false);
      }
    }
  };

  // Sağa Kaydırma (Beğen)
  const handleSwipeRight = async (media) => {
    if (mode === "duo") return handleDuoSwipe(media, "like");
    const nextIdx = currentIndex + 1;
    setHistory((prev) => [...prev, { media, direction: "like", index: currentIndex }]);
    setCurrentIndex(nextIdx);

    // Beğeni Sepetine Ekle (Solo)
    setLikedBasket((prev) => {
      if (prev.some((m) => String(m.id) === String(media.id))) return prev;
      return [...prev, media];
    });

    checkNextPage(nextIdx);


  };

  // Sola Kaydırma (Pas)
  const handleSwipeLeft = async (media) => {
    if (mode === "duo") return handleDuoSwipe(media, "pass");
    const nextIdx = currentIndex + 1;
    setHistory((prev) => [...prev, { media, direction: "pass", index: currentIndex }]);
    setCurrentIndex(nextIdx);

    checkNextPage(nextIdx);


  };

  // Son Hareketi Geri Al
  const handleUndo = () => {
    if (mode !== "solo" || history.length === 0 || currentIndex === 0) return;
    triggerHaptic("selection");
    const lastAction = history[history.length - 1];
    if (lastAction?.direction === "like") {
      setLikedBasket((prev) => prev.filter((m) => String(m.id) !== String(lastAction.media?.id)));
    }
    setHistory((prev) => prev.slice(0, -1));
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  // Filtreleri Uygula
  const handleApplyFilters = ({ category: cat, mediaType: mType, genreId: gId }) => {
    setCategory(cat);
    setMediaType(mType);
    setGenreId(gId);
    loadDeck(cat, mType, gId);
  };

  // Duo Oda Kurulumunu Başlat
  const handleOpenRoomConfig = () => {
    if (!user) {
      Toast.show({ type: "info", text1: "Oda kurmak için giriş yapmalısınız." });
      return;
    }
    triggerHaptic("selection");
    setShowRoomConfig(true);
  };

  // Oda Yapılandırmasını Onayla & Kur
  const handleConfirmCreateRoom = async (config) => {
    if (joinBusy.current) return;
    joinBusy.current = true;
    setJoining(true);
    setJoinError(null);
    deckRequest.current += 1;
    resetRoom();
    const session = roomSession.current;
    setLoadingDeck(true);
    try {
      const freshDeck = [];
      const seen = new Set();
      const target = config.targetCardsCount || 20;
      for (let page = 1; freshDeck.length < target && page <= 5; page += 1) {
        const items = await fetchSwipeDeck({
          language: language === "tr" ? "tr-TR" : "en-US",
          category: config.category || "trending", mediaType: "all", page, userId: user?.uid,
        });
        if (!items.length) break;
        for (const item of items) {
          if (!seen.has(cineMediaKey(item))) { freshDeck.push(item); seen.add(cineMediaKey(item)); }
        }
        if (config.category === "watchlist") break;
      }

      if (session !== roomSession.current) return;
      const { roomId: rId, roomCode: rCode } = await createCineRoom(user, freshDeck, config);
      if (session !== roomSession.current) {
        await deleteCineRoom(rId);
        return;
      }
      setRoomId(rId);
      setRoomCode(rCode);
      setDeck(freshDeck.slice(0, config.targetCardsCount || 20));
      setRoomState("created");
      triggerHaptic("notification");
    } catch (e) {
      if (session === roomSession.current) showRoomError(e);
    } finally {
      joinBusy.current = false;
      setJoining(false);
      setLoadingDeck(false);
    }
  };

  // Beklemedeki Odayı İptal Et
  const handleCancelRoom = async () => {
    if (!roomId) return;
    try { await deleteCineRoom(roomId); resetRoom(); }
    catch (error) { showRoomError(error); }
  };

  // Odaya Katıl
  const handleJoinRoom = async () => {
    if (joinBusy.current) return;
    joinBusy.current = true;
    const attempt = ++joinAttempt.current;
    deckRequest.current += 1;
    setJoining(true);
    setJoinError(null);
    try {
      const { roomId: rId, roomData } = await joinCineRoom(inputCode, user);
      if (attempt !== joinAttempt.current) return;
      resetRoom();
      setRoomId(rId);
      setRoomCode(roomData.roomCode || inputCode.trim());
      setDeck(roomData.deck || []);
      const nextIndex = (roomData.deck || []).findIndex((media) => !cineVotesFor(roomData, media)[user.uid]);
      setCurrentIndex(nextIndex < 0 ? (roomData.deck || []).length : nextIndex);
      setLoadingDeck(false);
      setPartnerName(roomData.hostUid === user.uid ? roomData.guestName : roomData.hostName);
      setRoomState(roomData.status === "waiting" ? "created" : "playing");
      triggerHaptic("notification");
    } catch (error) {
      if (attempt === joinAttempt.current) showRoomError(error);
    } finally {
      joinBusy.current = false;
      if (attempt === joinAttempt.current) setJoining(false);
    }
  };

  // Oda Kodunu Paylaş
  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Seelogd'da bu akşam ne izleyeceğimizi seçiyoruz! Oda Kodum: ${roomCode}`,
      });
    } catch (e) {
      // sessizce geç
    }
  };

  // İzleme Listesine Tek Ekle
  const handleAddToWatchlist = async (media) => {
    if (!user?.uid || !media) return;
    try {
      await addToList(user.uid, "watchList", {
        id: media.id,
        type: media.mediaType || "movie",
        name: media.title || media.name,
        imagePath: media.poster_path,
        minutes: null,
        genres: [],
      });
      Toast.show({ type: "success", text1: "İzleme listesine eklendi!" });
    } catch (e) {
      Toast.show({ type: "error", text1: "Listeye eklenemedi." });
    }
  };

  // Toplu İzleme Listesine Ekle
  const handleAddAllToWatchlist = async (items) => {
    if (!user?.uid || !items || items.length === 0) return;
    try {
      const formatted = items.map((it) => ({
        ...it,
        targetList: "watchList",
      }));
      await writeImportedItems(user.uid, formatted);
      Toast.show({
        type: "success",
        text1: "Tümü İçe Aktarıldı!",
        text2: `${items.length} film izleme listenize eklendi.`,
      });
    } catch (e) {
      Toast.show({ type: "error", text1: "Toplu ekleme başarısız oldu." });
    }
  };

  // Solo: Kişisel Özel Liste Oluştur
  const handleSaveAsPersonalCustomList = async (items) => {
    if (!user?.uid || !items || items.length === 0) return;
    try {
      const dateStr = new Date().toLocaleDateString("tr-TR");
      const listName = `CineSwipe (${dateStr})`;
      const docRef = doc(db, "Lists", user.uid);
      const userRef = doc(db, "Users", user.uid);

      const normalizedItems = items.map((it) => ({
        id: it.id,
        type: it.mediaType || "movie",
        name: it.title || it.name || "Film",
        imagePath: it.poster_path || null,
        minutes: null,
        genres: [],
        dateAdded: new Date().toISOString().slice(0, 10),
      }));

      const listEntry = {
        listId: `cine_${Date.now()}`,
        name: listName,
        createdAt: new Date().toISOString(),
      };

      const batch = writeBatch(db);
      batch.set(docRef, { [listName]: normalizedItems }, { merge: true });
      batch.set(userRef, { listVisible: { [listName]: true } }, { merge: true });
      await batch.commit();

      Toast.show({
        type: "success",
        text1: "Özel Liste Oluşturuldu! 📑",
        text2: `"${listName}" listenize ${items.length} içerik kaydedildi.`,
      });
    } catch (e) {
      Toast.show({ type: "error", text1: "Özel liste oluşturulamadı: " + e.message });
    }
  };

  // Duo: Ortak Liste Oluştur
  const handleSaveAsSharedList = async (items) => {
    if (!user?.uid || !items || items.length === 0) return;
    try {
      const partnerDisplayName = partnerName || "Arkadaş";
      const listName = `CineSwipe (${partnerDisplayName} & ${user.displayName || "Ben"})`;

      // Partner arkadaş nesnesi
      const isHost = currentRoomData?.hostUid === user.uid;
      const partnerUid = isHost ? currentRoomData?.guestUid : currentRoomData?.hostUid;
      const partnerAvatar = isHost ? currentRoomData?.guestAvatar : currentRoomData?.hostAvatar;

      const friends = partnerUid
        ? [
            {
              uid: partnerUid,
              name: partnerDisplayName,
              username: partnerDisplayName,
              avatarIndex: typeof partnerAvatar === "number" ? partnerAvatar : 0,
              canAdd: true,
              canRemove: true,
              canReorder: true,
            },
          ]
        : [];

      const listId = await createSharedList({
        owner: user,
        name: listName,
        friends,
      });

      for (const it of items) {
        await addItemToSharedList({
          listId,
          user,
          item: {
            id: it.id,
            type: it.mediaType || "movie",
            name: it.title || it.name || "Film",
            imagePath: it.poster_path || null,
            genres: [],
          },
        });
      }

      Toast.show({
        type: "success",
        text1: "Ortak Liste Oluşturuldu! 👥",
        text2: `"${listName}" listesi arkadaşınızla paylaşıldı.`,
      });
    } catch (e) {
      Toast.show({ type: "error", text1: "Ortak liste oluşturulamadı: " + e.message });
    }
  };

  // Sepetten 2. Tur Oyna (Final Turu)
  const handlePlaySecondRound = (basketItems) => {
    setDeck([...basketItems]);
    setCurrentIndex(0);
    setHistory([]);
    setLikedBasket([]);
    Toast.show({
      type: "success",
      text1: "2. Tur Başladı! 🎬",
      text2: "Yalnızca beğendiğiniz filmlerle eleme yapıyorsunuz.",
    });
  };

  // Detay Sayfasını Aç
  const handleViewDetails = (media) => {
    const routeName = media.mediaType === "tv" ? "TvShowDetailsScreen" : "MovieDetailsScreen";
    navigation.navigate(routeName, {
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
  };

  const progress = currentRoomData ? summarizeCineRoom(currentRoomData) : null;
  const partnerProgress = currentRoomData?.hostUid === user?.uid ? progress?.guest : progress?.host;
  const visibleCards = deck.slice(currentIndex, currentIndex + 3).reverse();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary || "#141414" }]}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <AppIcon family="Ionicons" name="chevron-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={[styles.screenTitle, { color: theme.text.primary }]}>CineSwipe</Text>
          <Text style={[styles.screenSubtitle, { color: theme.text.secondary }]}>
            {mode === "solo"
              ? "Bugün Ne İzlesem?"
              : partnerName
              ? `${partnerName} ile Eşleşme`
              : "Birlikte Ne İzlesek?"}
          </Text>
        </View>

        {/* Right Header Action Hub */}
        <View style={styles.rightActions}>
          {mode === "solo" && (
            <>
              {/* Liked Basket Badge Button */}
              <TouchableOpacity
                style={[
                  styles.basketBtn,
                  { backgroundColor: alpha("#FF3B5C", likedBasket.length > 0 ? 0.2 : 0.08) },
                ]}
                onPress={() => {
                  triggerHaptic("selection");
                  setShowLikedBasket(true);
                }}
              >
                <AppIcon family="Ionicons" name="heart" size={16} color="#FF3B5C" />
                <Text style={[styles.basketCount, { color: "#FF3B5C" }]}>
                  {likedBasket.length}
                </Text>
              </TouchableOpacity>

              {/* Filter Button */}
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic("selection");
                  setShowFilterSheet(true);
                }}
                style={styles.filterBtn}
              >
                <AppIcon family="Ionicons" name="options-outline" size={20} color={theme.accent || "#138DF0"} />
              </TouchableOpacity>
            </>
          )}

          {mode === "duo" && roomState === "finished" && (
            <TouchableOpacity
              style={[styles.basketBtn, { backgroundColor: alpha("#FFD700", 0.18) }]}
              onPress={() => {
                triggerHaptic("selection");
                setShowDuoResults(true);
              }}
            >
              <AppIcon family="Ionicons" name="trophy-outline" size={16} color="#FFD700" />
              <Text style={[styles.basketCount, { color: "#FFD700" }]}>
                {allMatches.length}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mode Selector */}
      {roomState === "idle" && !joining && (
        <View style={[styles.modeToggle, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.6) }]}>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              mode === "solo" && [styles.modeBtnActive, { backgroundColor: theme.accent || "#138DF0" }],
            ]}
            onPress={() => {
              triggerHaptic("selection");
              setMode("solo");
            }}
          >
            <AppIcon family="Ionicons" name="person" size={16} color={mode === "solo" ? "#FFF" : theme.text.secondary} />
            <Text style={[styles.modeText, { color: mode === "solo" ? "#FFF" : theme.text.secondary }]}>
              Solo Keşif
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeBtn,
              mode === "duo" && [styles.modeBtnActive, { backgroundColor: theme.accent || "#138DF0" }],
            ]}
            onPress={() => {
              triggerHaptic("selection");
              setMode("duo");
            }}
          >
            <AppIcon family="Ionicons" name="people" size={16} color={mode === "duo" ? "#FFF" : theme.text.secondary} />
            <Text style={[styles.modeText, { color: mode === "duo" ? "#FFF" : theme.text.secondary }]}>
              Duo Eşleşme
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Duo Mode Setup Screen */}
      {mode === "duo" && roomState === "idle" && (
        <ScrollView contentContainerStyle={styles.duoSetupCard} keyboardShouldPersistTaps="handled">
          <AppIcon family="MaterialCommunityIcons" name="cards-playing-heart-multiple-outline" size={54} color={theme.accent} />
          <Text style={[styles.duoSetupTitle, { color: theme.text.primary }]}>Birlikte Ne İzleyeceğinizi Bulun!</Text>
          <Text style={[styles.duoSetupDesc, { color: theme.text.secondary }]}>
            Kart sayısını ve kategori türünü seçerek oda kurun veya arkadaşınızın kodunu girin. İkiniz de aynı filmi beğendiğinizde eşleşme yakalarsınız!
          </Text>

          <TouchableOpacity
            style={[styles.duoActionBtn, { backgroundColor: theme.accent || "#138DF0" }]}
            disabled={joining}
            onPress={handleOpenRoomConfig}
          >
            <AppIcon family="Ionicons" name="add-circle-outline" size={20} color="#FFF" />
            <Text style={styles.duoActionBtnText}>Yeni Oda Kur & Ayarla</Text>
          </TouchableOpacity>

          <View style={styles.orDivider}>
            <View style={[styles.orLine, { backgroundColor: theme.border || "#444" }]} />
            <Text style={[styles.orText, { color: theme.text.secondary }]}>VEYA</Text>
            <View style={[styles.orLine, { backgroundColor: theme.border || "#444" }]} />
          </View>

          <View style={styles.joinRow}>
            <TextInput
              style={[styles.codeInput, { color: theme.text.primary, borderColor: theme.border || "#555" }]}
              ref={codeInputRef}
              editable={!joining}
              accessibilityLabel={joinText.placeholder}
              placeholder={joinText.placeholder}
              placeholderTextColor={theme.text.secondary}
              value={inputCode}
              onChangeText={(value) => { setInputCode(value); setJoinError(null); }}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.joinBtn, { backgroundColor: alpha(theme.secondary || "#333", 0.9) }]}
              disabled={joining}
              accessibilityState={{ busy: joining, disabled: joining }}
              onPress={handleJoinRoom}
            >
              <Text style={[styles.joinBtnText, { color: theme.text.primary }]}>{joining ? joinText.joining : joinText.join}</Text>
            </TouchableOpacity>
          </View>
          {joinError && (
            <View accessibilityLiveRegion="polite" style={{ width: "100%", gap: 12 }}>
              <Text style={[styles.duoSetupTitle, { color: theme.text.primary }]}>{joinText.title}</Text>
              <Text style={[styles.duoSetupDesc, { color: theme.text.secondary }]}>{joinText[joinError] || joinText.unknown}</Text>
              <TouchableOpacity style={styles.joinBtn} onPress={() => {
                setJoinError(null);
                setInputCode("");
                codeInputRef.current?.focus();
              }}>
                <Text style={{ color: theme.accent }}>{joinText.retry}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.joinBtn} onPress={returnToHub}>
                <Text style={{ color: theme.accent }}>{joinText.hub}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {mode === "duo" && roomState === "idle" && lastResult && (
        <TouchableOpacity style={styles.joinBtn} onPress={() => {
          setResult(lastResult);
          setCleanupError(!!lastResult.receiptPending);
          setCurrentRoomData(lastResult.room);
          setAllMatches(lastResult.summary.matches);
          setPartnerName(lastResult.room.hostUid === user?.uid ? lastResult.room.guestName : lastResult.room.hostName);
          setRoomState("finished");
          setShowDuoResults(true);
        }}>
          <Text style={{ color: theme.accent }}>{resultText.lastResult}</Text>
        </TouchableOpacity>
      )}

      {mode === "duo" && roomState === "finished" && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{resultText.title}</Text>
          <TouchableOpacity style={styles.joinBtn} onPress={() => setShowDuoResults(true)}>
            <Text style={{ color: theme.accent }}>{resultText.showResults}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.joinBtn} onPress={() => { resetRoom(); setInputCode(""); }}>
            <Text style={{ color: theme.accent }}>{resultText.newRoom}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.joinBtn} onPress={returnToHub}>
            <Text style={{ color: theme.accent }}>{joinText.hub}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Duo Room Waiting Screen */}
      {mode === "duo" && roomState === "created" && (
        <View style={styles.waitingContainer}>
          <View style={[styles.codeBadge, { backgroundColor: alpha(theme.accent, 0.16), borderColor: theme.accent }]}>
            <Text style={[styles.codeLabel, { color: theme.text.secondary }]}>ODA KODUNUZ</Text>
            <Text style={[styles.codeValue, { color: theme.accent }]}>{roomCode}</Text>
          </View>

          <ActivityIndicator size="large" color={theme.accent} style={{ marginVertical: 20 }} />
          <Text style={[styles.waitingTitle, { color: theme.text.primary }]}>Arkadaşınız Bekleniyor...</Text>
          <Text style={[styles.waitingDesc, { color: theme.text.secondary }]}>
            Bu kodu arkadaşınızla paylaşın. Arkadaşınız katıldığında kartlar aynı anda açılacaktır.
          </Text>

          <View style={styles.waitingActionsRow}>
            <TouchableOpacity
              style={[styles.shareCodeBtn, { backgroundColor: theme.accent || "#138DF0" }]}
              onPress={handleShareCode}
            >
              <AppIcon family="Ionicons" name="share-social-outline" size={18} color="#FFF" />
              <Text style={styles.shareCodeBtnText}>Kodu Paylaş</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelRoomBtn, { backgroundColor: alpha("#FF3B30", 0.15), borderColor: alpha("#FF3B30", 0.4) }]}
              onPress={handleCancelRoom}
            >
              <AppIcon family="Ionicons" name="close-circle-outline" size={18} color="#FF3B30" />
              <Text style={styles.cancelRoomText}>Odayı İptal Et</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Swipe Arena (Solo or Duo Playing) */}
      {(mode === "solo" || roomState === "playing") && (
        <View style={styles.arena}>
          {loadingDeck ? (
            <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 100 }} />
          ) : mode === "duo" && currentIndex >= deck.length ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator color={theme.accent} size="large" />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{resultText.waitingTitle}</Text>
              <Text style={[styles.emptyDesc, { color: theme.text.secondary }]}>{resultText.waitingBody}</Text>
              <Text style={{ color: theme.text.secondary }}>{partnerName}: {partnerProgress?.reviewed || 0}/{deck.length}</Text>
            </View>
          ) : currentIndex >= deck.length ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: alpha(theme.accent, 0.15) }]}>
                <AppIcon family="Ionicons" name="checkmark-done-circle-outline" size={54} color={theme.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>Bu Deste Tamamlandı!</Text>
              <Text style={[styles.emptyDesc, { color: theme.text.secondary }]}>
                {likedBasket.length > 0
                  ? `Toplam ${likedBasket.length} içerik beğendiniz. Beğenilenler sepetinden rastgele seçim yapabilir veya yeni deste yükleyebilirsiniz.`
                  : "Farklı tür veya kategoriler seçerek keşfetmeye devam edebilirsiniz."}
              </Text>

              <View style={styles.emptyActionsRow}>
                {likedBasket.length > 0 && (
                  <TouchableOpacity
                    style={[styles.emptyActionBtn, { backgroundColor: "#FF3B5C" }]}
                    onPress={() => setShowLikedBasket(true)}
                  >
                    <AppIcon family="Ionicons" name="heart" size={18} color="#FFF" />
                    <Text style={styles.emptyActionBtnText}>Beğendiklerimi Gör ({likedBasket.length})</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.emptyActionBtn, { backgroundColor: theme.accent || "#138DF0" }]}
                  onPress={() => loadDeck()}
                >
                  <AppIcon family="Ionicons" name="refresh-outline" size={18} color="#FFF" />
                  <Text style={styles.emptyActionBtnText}>Yeni Deste Yükle</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.cardStack}>
              {visibleCards.map((media, i) => {
                const isTop = i === visibleCards.length - 1;
                return (
                  <SwipeCard
                    key={`${cineMediaKey(media)}_${mode === "duo" ? cardRevision : 0}`}
                    disabled={mode === "duo" && savingSwipe}
                    media={media}
                    isTop={isTop}
                    onSwipeLeft={handleSwipeLeft}
                    onSwipeRight={handleSwipeRight}
                    theme={theme}
                  />
                );
              })}
            </View>
          )}

          {mode === "duo" && (
            <Text accessibilityLiveRegion="polite" style={[styles.emptyDesc, { color: theme.text.secondary }]}>
              {swipeError ? resultText.voteError : savingSwipe ? resultText.saving : `${currentIndex}/${deck.length}`}
            </Text>
          )}
          {/* Bottom Action Controls */}
          {!loadingDeck && currentIndex < deck.length && (
            <View style={styles.controlsRow}>
              {/* Pass Button */}
              <TouchableOpacity
                style={[styles.controlBtn, styles.passBtn]}
                disabled={savingSwipe}
                onPress={() => handleSwipeLeft(deck[currentIndex])}
                activeOpacity={0.8}
              >
                <AppIcon family="Ionicons" name="close" size={30} color="#FF3232" />
              </TouchableOpacity>

              {/* Undo is local-only and available in Solo. */}
              {mode === "solo" && <TouchableOpacity
                style={[styles.controlBtn, styles.undoBtn, { backgroundColor: alpha(theme.secondary || "#333", 0.7) }]}
                onPress={handleUndo}
                disabled={history.length === 0}
                activeOpacity={0.8}
              >
                <AppIcon
                  family="Ionicons"
                  name="arrow-undo"
                  size={22}
                  color={history.length > 0 ? theme.text.primary : theme.text.secondary}
                />
              </TouchableOpacity>}

              {/* Like Button */}
              <TouchableOpacity
                style={[styles.controlBtn, styles.likeBtn]}
                disabled={savingSwipe}
                onPress={() => handleSwipeRight(deck[currentIndex])}
                activeOpacity={0.8}
              >
                <AppIcon family="Ionicons" name="heart" size={30} color="#64FF64" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Solo Filtreleme Alt Sayfası */}
      <CineFilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        currentCategory={category}
        currentMediaType={mediaType}
        currentGenreId={genreId}
        onApplyFilters={handleApplyFilters}
      />

      {/* Solo Beğenilenler Sepeti Modalı */}
      <CineLikedBasketModal
        visible={showLikedBasket}
        onClose={() => setShowLikedBasket(false)}
        likedItems={likedBasket}
        onRandomPick={(picked) => {
          setMatchedMedia(picked);
          setShowMatchModal(true);
        }}
        onPlaySecondRound={handlePlaySecondRound}
        onSaveAsCustomList={handleSaveAsPersonalCustomList}
        onAddAllToWatchlist={handleAddAllToWatchlist}
        onClearBasket={() => setLikedBasket([])}
      />

      {/* Duo Oda Kurulum Ayarları Modalı */}
      <CineRoomConfigModal
        visible={showRoomConfig}
        onClose={() => setShowRoomConfig(false)}
        onConfirmCreate={handleConfirmCreateRoom}
      />

      {/* Duo Eşleşme Sonuç Galerisi Modalı */}
      <CineDuoResultsModal
        visible={showDuoResults && roomState === "finished"}
        summary={result?.summary}
        isHost={currentRoomData?.hostUid === user?.uid}
        cleanupError={cleanupError}
        onRetrySave={retryResultSave}
        onClose={() => setShowDuoResults(false)}
        matches={allMatches}
        partnerName={partnerName}
        onSelectMedia={handleViewDetails}
        onAddAllToWatchlist={handleAddAllToWatchlist}
        onSaveAsSharedList={handleSaveAsSharedList}
      />

      {/* CineMatch Spotlight Modalı */}
      <CineMatchModal
        visible={mode === "solo" && showMatchModal}
        matchedMedia={matchedMedia}
        partnerName={partnerName}
        onClose={() => setShowMatchModal(false)}
        onViewDetails={handleViewDetails}
        onAddToWatchlist={handleAddToWatchlist}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    alignItems: "center",
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 11,
    fontWeight: "600",
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  basketBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  basketCount: {
    fontSize: 12,
    fontWeight: "800",
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  modeToggle: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 14,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  modeBtnActive: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  duoSetupCard: {
    margin: 20,
    padding: 24,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    gap: 12,
  },
  duoSetupTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  duoSetupDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  duoActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 48,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  duoActionBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 12,
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 11,
    fontWeight: "700",
  },
  joinRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  codeInput: {
    flex: 1,
    height: 46,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  joinBtn: {
    paddingHorizontal: 22,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtnText: {
    fontSize: 14,
    fontWeight: "800",
  },
  waitingContainer: {
    margin: 20,
    padding: 24,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
  },
  codeBadge: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 4,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  waitingDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  waitingActionsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  shareCodeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 14,
    gap: 8,
  },
  shareCodeBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
  cancelRoomBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  cancelRoomText: {
    color: "#FF3B30",
    fontSize: 13,
    fontWeight: "800",
  },
  arena: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardStack: {
    flex: 1,
    width: SCREEN_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    paddingBottom: 24,
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  passBtn: {
    backgroundColor: "rgba(255, 50, 50, 0.15)",
    borderWidth: 2,
    borderColor: "#FF3232",
  },
  undoBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  likeBtn: {
    backgroundColor: "rgba(100, 255, 100, 0.15)",
    borderWidth: 2,
    borderColor: "#64FF64",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    gap: 12,
  },
  emptyIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyActionsRow: {
    gap: 10,
    width: "100%",
    marginTop: 12,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 14,
    gap: 8,
  },
  emptyActionBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
