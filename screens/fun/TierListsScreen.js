// screens/fun/TierListsScreen.js
//
// Tier listlerim (Eğlence > Tier list kartı; belge docs/ozellikler/TIER_LIST.md).
//
//   • Üstte "Yeni tier list" → oluşturma sayfası (başlık + şablon) → düzenleyici (sayfa kapandıktan sonra).
//   • Tablolar en son düzenlenen önce: başlık, sıralanan/toplam, kademe sayısı, düzenleme tarihi + mini önizleme
//     (en çok 6 kademe, satıra sığan en çok 12 afiş).
//   • Kartın "…" düğmesi: akışta paylaş · sohbete gönder · görsel olarak paylaş · galeriye kaydet (hooks/useTierListShare; iş menü
//     kapandıktan SONRA) · kopyasını oluştur · sil (onay sayfanın içinde, iki adımlı düğme).
//   `route.params.create` → oluşturma sayfası açık gelir (Eğlence kartında hiç tablo yokken; paylaşım penceresinin
//   "Yeni tier list oluştur" düğmesi).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassIconButton from "@components/common/GlassIconButton";
import GlassTouchable from "@components/common/GlassTouchable";
import { formatTarih } from "@components/badges/badgeFormat";
import TierListCreateSheet from "@components/tierList/TierListCreateSheet";
import TierMiniPreview from "@components/tierList/TierMiniPreview";
import { SheetButton, TierSheet } from "@components/tierList/tierSheetKit";
import { toast } from "@components/AppToast";
import { GameScreenShell } from "../game/GameScreenShell";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import usePosterUri from "@hooks/usePosterUri";
import useTierLists from "@hooks/useTierLists";
import useTierListShare from "@hooks/useTierListShare";
import { TIER_LIMITS, tierListCounts, tierListShareView } from "@utils/tierList";
import { getTierListCopy } from "@utils/tierListCopy";

// Yerel gün anahtarı (formatTarih "YYYY-MM-DD" ister).
const pad = (n) => String(n).padStart(2, "0");
const dayKeyOf = (ms) => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export default function TierListsScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getTierListCopy(language);
  const posterUri = usePosterUri();
  const { lists, canCreate, create, duplicate, remove } = useTierLists();

  const [creating, setCreating] = useState(!!route?.params?.create && canCreate);
  const [menuId, setMenuId] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pendingOpen = useRef(null);
  const pendingShare = useRef(null);

  useEffect(() => {
    if (route?.params?.create && canCreate) setCreating(true);
    // Yalnız parametre değişince (Eğlence kartından yeniden gelinince).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.create]);

  const posterUriOf = useCallback((media, width) => posterUri(media.media_type, media.id, media.poster_path, width), [posterUri]);
  const openEditor = useCallback((id) => navigation.navigate("TierListEditorScreen", { id }), [navigation]);
  const { share, busy: sharing, host: shareHost } = useTierListShare({ copy, posterUriOf });

  const startCreate = () => {
    if (!canCreate) {
      toast.info(copy.limitReached(TIER_LIMITS.lists));
      return;
    }
    setCreating(true);
  };

  const onCreate = (input) => {
    const id = create(input);
    if (!id) {
      toast.info(copy.limitReached(TIER_LIMITS.lists));
      return;
    }
    pendingOpen.current = id;
    setCreating(false);
  };

  const openMenu = (id) => {
    setMenuId(id);
    setConfirming(false);
    pendingShare.current = null;
    setMenuVisible(true);
  };
  const onShare = (choice) => {
    pendingShare.current = choice;
    setMenuVisible(false);
  };
  const onMenuDismissed = () => {
    const choice = pendingShare.current;
    pendingShare.current = null;
    if (choice) share(lists.find((list) => list.id === menuId), choice);
    setMenuId(null);
  };
  const onDuplicate = () => {
    const id = duplicate(menuId, copy.copySuffix);
    if (!id) toast.info(copy.limitReached(TIER_LIMITS.lists));
    setMenuVisible(false);
  };
  const onDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    remove(menuId);
    setMenuVisible(false);
  };
  const menuList = lists.find((list) => list.id === menuId);

  return (
    <GameScreenShell navigation={navigation} title={copy.screenTitle} subtitle={copy.screenSub}>
      <GlassTouchable
        onPress={startCreate}
        accessibilityRole="button"
        accessibilityLabel={copy.create}
        testID="tier-create"
        style={[styles.createButton, { backgroundColor: theme.accent }]}
      >
        <AppIcon family="Ionicons" name="add-circle" size={20} color="#FFFFFF" />
        <Text style={styles.createText}>{copy.create}</Text>
      </GlassTouchable>

      {lists.length ? (
        <View style={styles.stack}>
          {lists.map((list) => {
            const counts = tierListCounts(list);
            return (
              <GlassTouchable
                key={list.id}
                glass={false}
                activeOpacity={0.8}
                onPress={() => openEditor(list.id)}
                accessibilityRole="button"
                accessibilityLabel={`${list.title || copy.untitled}, ${copy.counts(counts.ranked, counts.total)}`}
                testID={`tier-list-${list.id}`}
                style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}
              >
                <View style={styles.cardHead}>
                  <View style={styles.cardCopy}>
                    <Text style={[styles.cardTitle, { color: theme.text.primary }]} numberOfLines={1}>
                      {list.title || copy.untitled}
                    </Text>
                    <Text style={[styles.cardSub, { color: theme.text.muted }]} numberOfLines={1}>
                      {`${copy.counts(counts.ranked, counts.total)} · ${copy.tierCount(counts.tiers)} · ${copy.edited(formatTarih(dayKeyOf(list.updatedAt), language))}`}
                    </Text>
                  </View>
                  <GlassIconButton
                    size={34}
                    fallbackRadius={12}
                    fallbackStyle={{ backgroundColor: theme.between }}
                    accessibilityLabel={copy.more}
                    onPress={() => openMenu(list.id)}
                  >
                    <AppIcon family="Ionicons" name="ellipsis-horizontal" size={18} color={theme.text.secondary} />
                  </GlassIconButton>
                </View>
                <TierMiniPreview tiers={tierListShareView(list).tiers} posterUriOf={posterUriOf} moreLabel={copy.moreTiers} />
              </GlassTouchable>
            );
          })}
        </View>
      ) : (
        <View style={[styles.empty, { borderColor: theme.border, backgroundColor: theme.secondary }]}>
          <View style={styles.emptyStrip}>
            {["#FF7F7F", "#FFBF7F", "#FFFF7F", "#7FFF7F", "#7FBFFF"].map((color) => (
              <View key={color} style={[styles.emptyCell, { backgroundColor: color }]} />
            ))}
          </View>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>{copy.empty}</Text>
        </View>
      )}

      <TierListCreateSheet
        visible={creating}
        copy={copy}
        theme={theme}
        onClose={() => setCreating(false)}
        onCreate={onCreate}
        onDismissed={() => {
          const id = pendingOpen.current;
          pendingOpen.current = null;
          if (id) openEditor(id);
        }}
      />

      <TierSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onDismissed={onMenuDismissed}
        theme={theme}
        title={menuList?.title || copy.untitled}
      >
        <View style={styles.menu}>
          <SheetButton theme={theme} tone="secondary" label={copy.shareFeed} icon="newspaper-outline" disabled={sharing} onPress={() => onShare("feed")} />
          <SheetButton theme={theme} tone="secondary" label={copy.shareChat} icon="paper-plane-outline" disabled={sharing} onPress={() => onShare("chat")} />
          <SheetButton theme={theme} tone="secondary" label={copy.shareImage} icon="share-social-outline" disabled={sharing} onPress={() => onShare("image")} />
          <SheetButton theme={theme} tone="secondary" label={copy.saveImage} icon="download-outline" disabled={sharing} onPress={() => onShare("gallery")} />
          <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
          <SheetButton theme={theme} tone="secondary" label={copy.duplicate} icon="copy-outline" onPress={onDuplicate} />
          <SheetButton
            theme={theme}
            tone={confirming ? "danger" : "secondary"}
            label={confirming ? copy.deleteTitle : copy.delete}
            icon="trash-outline"
            onPress={onDelete}
          />
          {confirming ? <Text style={[styles.menuNote, { color: theme.text.muted }]}>{copy.deleteMessage}</Text> : null}
        </View>
      </TierSheet>
      {shareHost}
    </GameScreenShell>
  );
}

const styles = StyleSheet.create({
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 16,
    marginTop: 6,
    marginBottom: 18,
  },
  createText: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "900" },
  stack: { gap: 12 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  cardSub: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  empty: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12, alignItems: "center" },
  emptyStrip: { flexDirection: "row", gap: 4 },
  emptyCell: { width: 30, height: 30, borderRadius: 8 },
  emptyText: { fontSize: 13.5, lineHeight: 19, textAlign: "center" },
  menu: { gap: 8 },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  menuNote: { fontSize: 12, fontWeight: "600", marginLeft: 4 },
});
