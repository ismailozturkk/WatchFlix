// hooks/useTierListShare.js
//
// Tier list paylaşımı — düzenleyicinin paylaş düğmesi ve Tablolarım'daki "…" menüsü ortak kullanır.
//
//   const { share, busy, host } = useTierListShare({ copy, posterUriOf });
//   share(list, "image" | "gallery" | "chat" | "feed")
//   {host}   ekrana bir kez konur: sohbet alıcı sayfası + ekran dışındaki yakalama kartı
//
//   görsel / galeri → TierListShareCard ekran dışında çizilir, afişler yüklenince (en çok 4 sn) 1080 px yakalanır
//   sohbet          → utils/chatShare.buildTierListShare → ShareToChatSheet → ChatScreen mesajı kendisi yazar
//   akış            → aynı gövdeyle Paylaşımlar ekranı; CreatePostModal "Tier list" türünde, tablo seçili açılır
//                     (ShareContentScreen `composePost` — film detayındaki "inceleme yaz" ile aynı yol)
// Kademeye yerleşmiş yapım yoksa paylaşılmaz (uyarı). share() açık bir Modal KAPANDIKTAN sonra çağrılmalı
// (iOS iki Modal kuralı: sistem paylaşım / izin penceresi ve sohbet sayfası Modal üstüne sunulamaz).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import ShareToChatSheet from "@components/chat/ShareToChatSheet";
import TierListShareCard, { SHARE_CARD_W } from "@components/tierList/TierListShareCard";
import { toast } from "@components/AppToast";
import { useAuth } from "@context/AuthContext";
import { saveStoryToGallery, toShareableUri } from "@services/storyShare/storyShareService";
import { buildTierListShare } from "@utils/chatShare";
import { tierListCounts, tierListShareView } from "@utils/tierList";

const CAPTURE_W = 1080;
const CAPTURE_TIMEOUT_MS = 4000;

export default function useTierListShare({ copy, posterUriOf }) {
  const { user } = useAuth() || {};
  const navigation = useNavigation();
  const [chatShare, setChatShare] = useState(null);
  const [capture, setCapture] = useState(null); // { mode: "image" | "gallery", view, ready, size }
  const busyRef = useRef(false);
  const cardRef = useRef(null);
  busyRef.current = !!capture;

  const share = useCallback(
    (list, choice) => {
      if (!choice || !list || busyRef.current) return;
      if (!tierListCounts(list).ranked) {
        toast.info(copy.shareNothing);
        return;
      }
      const view = tierListShareView(list);
      if (choice === "chat") {
        setChatShare(buildTierListShare({ ...view, host: user?.displayName?.split(" ")[0] || "" }));
        return;
      }
      if (choice === "feed") {
        const tierList = buildTierListShare(view);
        if (!tierList) return;
        navigation.navigate("ShareContentScreen", {
          composePost: {
            composeKey: `tierlist-${list.id}-${Date.now()}`,
            postType: "tierlist",
            title: (tierList.title || "").slice(0, 100),
            content: "",
            tierList,
            tierListId: list.id,
          },
        });
        return;
      }
      toast.info(copy.preparing);
      busyRef.current = true;
      setCapture({ mode: choice, view, ready: false, size: null });
    },
    [copy, user, navigation],
  );

  const onCardReady = useCallback(() => setCapture((prev) => (prev && !prev.ready ? { ...prev, ready: true } : prev)), []);
  const onCardLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setCapture((prev) => (prev ? { ...prev, size: { width, height } } : prev));
  }, []);

  // Afişler takılırsa yine yakala (yer tutucuyla).
  useEffect(() => {
    if (!capture || capture.ready) return undefined;
    const timer = setTimeout(onCardReady, CAPTURE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [capture, onCardReady]);

  useEffect(() => {
    if (!capture?.ready || !capture.size) return;
    const { mode, size } = capture;
    let alive = true;
    (async () => {
      try {
        const uri = await captureRef(cardRef, {
          format: "png",
          quality: 1,
          result: "tmpfile",
          width: CAPTURE_W,
          height: Math.round((CAPTURE_W * size.height) / size.width),
        });
        if (mode === "gallery") {
          await saveStoryToGallery(uri);
          toast.success(copy.saved);
        } else {
          if (!(await Sharing.isAvailableAsync())) throw new Error(copy.shareFailed);
          await Sharing.shareAsync(toShareableUri(uri), { mimeType: "image/png", dialogTitle: copy.dialogTitle, UTI: "public.png" });
        }
      } catch (error) {
        toast.error(copy.shareFailed, error?.message);
      } finally {
        if (alive) setCapture(null);
      }
    })();
    return () => {
      alive = false;
    };
    // capture nesnesi her adımda yenilenir; yalnız hazır + ölçülü olunca bir kez çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture?.ready, capture?.size]);

  const host = (
    <>
      <ShareToChatSheet visible={!!chatShare} share={chatShare} onClose={() => setChatShare(null)} onSent={() => setChatShare(null)} />
      {capture ? (
        <View style={styles.captureHost} pointerEvents="none">
          <TierListShareCard ref={cardRef} view={capture.view} posterUriOf={posterUriOf} copy={copy} onReady={onCardReady} onLayout={onCardLayout} />
        </View>
      ) : null}
    </>
  );

  return { share, busy: !!capture, host };
}

const styles = StyleSheet.create({
  captureHost: { position: "absolute", left: -9999, top: 0, width: SHARE_CARD_W },
});
