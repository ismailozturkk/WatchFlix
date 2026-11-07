// components/chat/SharedTierListMessage.js
//
// Sohbette paylaşılan TIER LIST (mesaj kind: "tierListShare", gövde utils/chatShare.buildTierListShare).
// Koyu TierMaker zemini (gelen/giden aynı): başlık + gönderen, kademe başına renkli etiket + ilk afişler + "+N".
// Dokununca tam görünüm sayfası (components/tierList/TierListPreviewSheet); GELEN balonda sayfada "Kopyasını düzenle"
// → alıcıda yeni tablo, düzenleyici sayfa kapandıktan sonra açılır. Metinler İZLEYİCİNİN dilinde.

import React, { memo, useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import useTierLists from "../../hooks/useTierLists";
import { buildTmdbUrl } from "../../utils/tmdbImageUtils";
import { getTierListCopy } from "../../utils/tierListCopy";
import { TIER_LIMITS } from "../../utils/tierList";
import { toast } from "../AppToast";
import GlassPressable from "../common/GlassPressable";
import TierListPreviewSheet from "../tierList/TierListPreviewSheet";
import TierMiniPreview from "../tierList/TierMiniPreview";

const BG = "#1A1A17";
const CARD_WIDTH = 260;

function SharedTierListMessage({ share, isOutgoing = false, cardWidth = CARD_WIDTH }) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const copy = getTierListCopy(language);
  const { importShare } = useTierLists();
  const [open, setOpen] = useState(false);
  const pendingId = useRef(null);

  const posterUriOf = useCallback((media, width) => buildTmdbUrl(media.poster_path, "poster", width), []);

  const onCopy = () => {
    const id = importShare(share);
    if (!id) {
      toast.info(copy.limitReached(TIER_LIMITS.lists));
      return;
    }
    toast.success(copy.previewCopied);
    pendingId.current = id;
    setOpen(false);
  };

  return (
    <>
      <GlassPressable
        glass={false}
        accessibilityRole="button"
        accessibilityLabel={`${copy.chatKicker}: ${share.title || copy.untitled}. ${copy.chatOpen}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.pressed]}
        testID="tier-share-bubble"
      >
        <View style={styles.header}>
          <View style={styles.tile}>
            <Ionicons name="podium" size={15} color="#1A1A1A" />
          </View>
          <View style={styles.headerCopy}>
            <Text allowFontScaling={false} numberOfLines={1} style={styles.kicker}>
              {copy.chatKicker}
            </Text>
            <Text numberOfLines={1} style={styles.title}>
              {share.title || copy.untitled}
            </Text>
          </View>
        </View>

        <TierMiniPreview
          tiers={share.tiers}
          posterUriOf={posterUriOf}
          maxRows={5}
          maxPosters={12}
          tone="onColor"
          moreLabel={copy.moreTiers}
        />

        <View style={styles.footer}>
          <Text numberOfLines={1} style={styles.from}>
            {`${copy.chatFrom(isOutgoing ? "" : share.host)} · ${copy.cardCount(share.total)}`}
          </Text>
          <View style={styles.open}>
            <Text allowFontScaling={false} style={styles.openText}>
              {copy.chatOpen}
            </Text>
            <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
          </View>
        </View>
      </GlassPressable>

      <TierListPreviewSheet
        visible={open}
        share={share}
        copy={copy}
        theme={theme}
        canCopy={!isOutgoing}
        onClose={() => setOpen(false)}
        onCopy={onCopy}
        onDismissed={() => {
          const id = pendingId.current;
          pendingId.current = null;
          if (id) navigation.navigate("TierListEditorScreen", { id });
        }}
      />
    </>
  );
}

export default memo(SharedTierListMessage);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignSelf: "flex-start",
    borderRadius: 18,
    padding: 12,
    gap: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: BG,
    marginBottom: 2,
  },
  pressed: { opacity: 0.88 },
  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  tile: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#FFBF7F" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  title: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "900", marginTop: 1 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  from: { flex: 1, color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: "700" },
  open: { flexDirection: "row", alignItems: "center", gap: 2 },
  openText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
});
