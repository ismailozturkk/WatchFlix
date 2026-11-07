// components/feed/PostTierListBlock.js
//
// Paylaşımlardaki TIER LIST gönderisinin tablosu (post.tierList — services/postsService.js anlık görüntüsü).
// Sohbet balonuyla aynı koyu TierMaker zemini (components/chat/SharedTierListMessage.js): kademe başına renkli etiket +
// ilk afişler + "+N". Dokununca tam görünüm (TierListPreviewSheet); başkasının gönderisinde "Kopyasını düzenle" →
// izleyicide yeni tablo, düzenleyiciye sayfa tamamen kapandıktan sonra geçilir. Akış kartı ve gönderi detayı kullanır.

import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLanguage } from "../../context/LanguageContext";
import useTierLists from "../../hooks/useTierLists";
import { buildTmdbUrl } from "../../utils/tmdbImageUtils";
import { getTierListCopy } from "../../utils/tierListCopy";
import { TIER_LIMITS } from "../../utils/tierList";
import { toast } from "../AppToast";
import GlassPressable from "../common/GlassPressable";
import TierListPreviewSheet from "../tierList/TierListPreviewSheet";
import TierMiniPreview from "../tierList/TierMiniPreview";

const BG = "#1A1A17";

function PostTierListBlock({ tierList, authorName, canCopy = false, theme, maxRows = 6, compact = false, style }) {
  const { language } = useLanguage();
  const navigation = useNavigation();
  const copy = getTierListCopy(language);
  const { importShare } = useTierLists();
  const [open, setOpen] = useState(false);
  const pendingId = useRef(null);

  const posterUriOf = useCallback((media, width) => buildTmdbUrl(media.poster_path, "poster", width), []);
  // Önizleme sayfası sohbet gövdesi şeklini bekler: gönderen = gönderinin yazarı.
  const share = useMemo(() => (tierList ? { ...tierList, host: authorName || "" } : null), [tierList, authorName]);

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

  if (!share || !Array.isArray(share.tiers)) return null;
  return (
    <>
      <GlassPressable
        glass={false}
        accessibilityRole="button"
        accessibilityLabel={`${copy.chatKicker}: ${share.title || copy.untitled}. ${copy.chatOpen}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.card, compact && styles.compact, pressed && styles.pressed, style]}
        testID="post-tier-list"
      >
        <TierMiniPreview
          tiers={share.tiers}
          posterUriOf={posterUriOf}
          maxRows={maxRows}
          maxPosters={compact ? 8 : 12}
          tone="onColor"
          moreLabel={copy.moreTiers}
        />
        <View style={styles.footer}>
          <View style={styles.tile}>
            <Ionicons name="podium" size={11} color="#1A1A1A" />
          </View>
          <Text numberOfLines={1} style={styles.count}>
            {copy.cardCount(share.total)}
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
        canCopy={canCopy}
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

export default memo(PostTierListBlock);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 10,
    gap: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: BG,
  },
  compact: { borderRadius: 10, padding: 8, gap: 6 },
  pressed: { opacity: 0.88 },
  footer: { flexDirection: "row", alignItems: "center", gap: 7 },
  tile: { width: 20, height: 20, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#FFBF7F" },
  count: { flex: 1, color: "rgba(255,255,255,0.75)", fontSize: 11.5, fontWeight: "800" },
  open: { flexDirection: "row", alignItems: "center", gap: 2 },
  openText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
});
