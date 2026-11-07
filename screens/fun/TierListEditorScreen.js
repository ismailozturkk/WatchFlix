// screens/fun/TierListEditorScreen.js
//
// Tier list düzenleyici (rota parametresi `id`; belge docs/ozellikler/TIER_LIST.md).
//
// Etkileşim: sürükle-bırak yerine DOKUN-SEÇ / DOKUN-YERLEŞTİR (kaydırmayla çakışmaz, tek elle olur):
//   • afişe dokun                 → seçilir (halka; altta seçim çubuğu)
//   • seçiliyken kademeye dokun   → kademenin sonuna
//   • seçiliyken başka afişe dokun → onun ÖNÜNE (ikisi de havuzdaysa yalnız seçim değişir)
//   • aynı afişe yeniden dokun    → seçim kalkar
//   • seçim çubuğu: öne / arkaya (kendi satırında), havuza al, ayrıntı, tablodan çıkar
//   • etiket hücresi              → kademe sayfası (ad, renk, taşı, ekle, sil)
// Her değişiklik anında kaydedilir (hooks/useTierLists; taslak yok).
//
// Paylaşım: başlıktaki düğme → TierListShareSheet → sayfa kapandıktan sonra hooks/useTierListShare (görsel /
// galeri / sohbet; Tablolarım'daki "…" menüsüyle ortak).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassIconButton from "@components/common/GlassIconButton";
import GlassTextInput from "@components/common/GlassTextInput";
import GlassTouchable from "@components/common/GlassTouchable";
import TierBoard, { TierPoster } from "@components/tierList/TierBoard";
import TierEditSheet from "@components/tierList/TierEditSheet";
import TierListAddSheet from "@components/tierList/TierListAddSheet";
import TierListShareSheet from "@components/tierList/TierListShareSheet";
import { toast } from "@components/AppToast";
import { GameScreenShell } from "../game/GameScreenShell";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import usePosterUri from "@hooks/usePosterUri";
import useTierLists from "@hooks/useTierLists";
import useTierListShare from "@hooks/useTierListShare";
import { triggerHaptic } from "@services/hapticsService";
import {
  POOL,
  TIER_LIMITS,
  addMedia,
  addTier,
  locateMedia,
  moveTier,
  placeMedia,
  removeMedia,
  removeTier,
  renameTierList,
  shiftMedia,
  tierBoardRows,
  tierListCounts,
  updateTier,
} from "@utils/tierList";
import { getTierListCopy } from "@utils/tierListCopy";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";
import { upperText } from "@utils/i18nText";

const POOL_W = 46;
const POOL_H = 69;

export default function TierListEditorScreen({ navigation, route }) {
  const id = route?.params?.id;
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getTierListCopy(language);
  const posterUri = usePosterUri();
  const { getList, update } = useTierLists();
  const list = getList(id);

  const [selectedKey, setSelectedKey] = useState(null);
  const [title, setTitle] = useState(list?.title || "");
  const [addVisible, setAddVisible] = useState(false);
  const [editTierId, setEditTierId] = useState(null);
  const [tierSheetVisible, setTierSheetVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  // Seçili yapım silinir / tablo değişirse seçim düşer.
  useEffect(() => {
    if (selectedKey && (!list || !list.media[selectedKey])) setSelectedKey(null);
  }, [list, selectedKey]);

  const change = useCallback((fn) => update(id, fn), [update, id]);
  const posterUriOf = useCallback((media, width) => posterUri(media.media_type, media.id, media.poster_path, width), [posterUri]);
  const rows = useMemo(() => (list ? tierBoardRows(list) : []), [list]);
  const counts = list ? tierListCounts(list) : { ranked: 0, pool: 0, total: 0, tiers: 0 };
  const selectedMedia = selectedKey && list ? list.media[selectedKey] : null;
  const { share, busy: sharing, host: shareHost } = useTierListShare({ copy, posterUriOf });

  // ── Dokun-seç / dokun-yerleştir ──
  const placeSelected = (target, beforeKey) => {
    change((current, now) => placeMedia(current, selectedKey, target, beforeKey, now));
    triggerHaptic("drop");
    setSelectedKey(null);
  };
  // Afişi "kaldırınca" sürükleme başlangıcı hissi; yerleştirince bırakma.
  const pickUp = (key) => {
    triggerHaptic("dragStart");
    setSelectedKey(key);
  };
  const onPressItem = (key, target) => {
    if (!selectedKey) return pickUp(key);
    if (selectedKey === key) return setSelectedKey(null);
    const from = locateMedia(list, selectedKey);
    if (from?.target === POOL && target === POOL) return pickUp(key);
    return placeSelected(target, key);
  };
  const onPressTier = (tierId) => {
    if (selectedKey) placeSelected(tierId, null);
  };
  const onPressLabel = (tierId) => {
    setSelectedKey(null);
    setEditTierId(tierId);
    setTierSheetVisible(true);
  };

  const commitTitle = () => {
    if (list && title.trim() !== list.title) change((current, now) => renameTierList(current, title, now));
  };

  const onAdd = (medias) => {
    let added = 0;
    change((current, now) => {
      const result = addMedia(current, medias, now);
      added = result.added;
      return result.list;
    });
    if (added) toast.success(copy.added(added));
    setAddVisible(false);
  };

  if (!list) {
    return (
      <GameScreenShell navigation={navigation} title={copy.screenTitle}>
        <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.empty}</Text>
      </GameScreenShell>
    );
  }

  const editTier = list.tiers.find((tier) => tier.id === editTierId) || null;
  const editIndex = list.tiers.findIndex((tier) => tier.id === editTierId);
  const selectedAt = selectedKey ? locateMedia(list, selectedKey) : null;
  const selectedRow = selectedAt ? (selectedAt.target === POOL ? list.pool : list.tiers.find((t) => t.id === selectedAt.target)?.items || []) : [];

  const footer = (
    <View style={styles.footer}>
      {selectedMedia ? (
        <View style={styles.selection}>
          <Text style={[styles.selectionTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {copy.selected(selectedMedia.title)}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.actions}>
            <ActionChip theme={theme} icon="chevron-back" label={copy.earlier} disabled={!selectedAt || selectedAt.index === 0} onPress={() => change((c, now) => shiftMedia(c, selectedKey, -1, now))} />
            <ActionChip theme={theme} icon="chevron-forward" label={copy.later} disabled={!selectedAt || selectedAt.index >= selectedRow.length - 1} onPress={() => change((c, now) => shiftMedia(c, selectedKey, 1, now))} />
            {selectedAt?.target !== POOL ? (
              <ActionChip theme={theme} icon="arrow-down-circle-outline" label={copy.toPool} onPress={() => placeSelected(POOL, null)} testID="tier-to-pool" />
            ) : null}
            <ActionChip
              theme={theme}
              icon="information-circle-outline"
              label={copy.details}
              onPress={() => navigation.navigate(selectedMedia.media_type === "tv" ? "TvShowsDetails" : "MovieDetails", { id: selectedMedia.id })}
            />
            <ActionChip
              theme={theme}
              icon="trash-outline"
              label={copy.removeItem}
              danger
              onPress={() => {
                change((c, now) => removeMedia(c, selectedKey, now));
                setSelectedKey(null);
              }}
              testID="tier-remove"
            />
            <ActionChip theme={theme} icon="close" label={copy.deselect} onPress={() => setSelectedKey(null)} />
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.poolHead}>
        <Text style={[styles.poolTitle, { color: theme.text.muted }]}>{`${upperText(copy.poolTitle)} · ${counts.pool}`}</Text>
        <GlassTouchable
          onPress={() => setAddVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={copy.addContent}
          testID="tier-add"
          style={[styles.addChip, { backgroundColor: theme.accent }]}
        >
          <AppIcon family="Ionicons" name="add" size={16} color="#FFFFFF" />
          <Text style={styles.addChipText}>{copy.addContent}</Text>
        </GlassTouchable>
      </View>
      {list.pool.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.pool}>
          {list.pool.map((key) => {
            const media = list.media[key];
            return (
              <GlassTouchable
                key={key}
                glass={false}
                activeOpacity={0.75}
                onPress={() => onPressItem(key, POOL)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedKey === key }}
                accessibilityLabel={media.title}
                testID={`tier-pool-${key}`}
              >
                <TierPoster media={media} uri={posterUriOf(media, POOL_W)} width={POOL_W} height={POOL_H} selected={selectedKey === key} accent={theme.accent} />
              </GlassTouchable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={[styles.poolEmpty, { color: theme.text.muted }]}>{counts.total ? copy.poolEmpty : copy.boardEmpty}</Text>
      )}
    </View>
  );

  return (
    <GameScreenShell
      navigation={navigation}
      title={list.title || copy.untitled}
      subtitle={`${copy.counts(counts.ranked, counts.total)} · ${copy.tierCount(counts.tiers)}`}
      onBack={() => {
        commitTitle();
        navigation.goBack();
      }}
      headerRight={
        <GlassIconButton
          size={40}
          fallbackStyle={{ backgroundColor: theme.secondary }}
          accessibilityLabel={copy.share}
          onPress={() => {
            commitTitle();
            setSelectedKey(null);
            setShareVisible(true);
          }}
          disabled={sharing}
        >
          <AppIcon family="Ionicons" name="share-outline" size={20} color={theme.text.primary} />
        </GlassIconButton>
      }
      footer={footer}
    >
      <GlassTextInput
        value={title}
        onChangeText={setTitle}
        onBlur={commitTitle}
        onSubmitEditing={commitTitle}
        maxLength={TIER_LIMITS.title}
        placeholder={copy.editorTitlePlaceholder}
        placeholderTextColor={theme.text.muted}
        returnKeyType="done"
        style={[styles.titleInput, { backgroundColor: theme.secondary, borderColor: theme.border, color: theme.text.primary }]}
        accessibilityLabel={copy.titleLabel}
        testID="tier-title"
      />
      <Text style={[styles.hint, { color: theme.text.muted }]}>{selectedKey ? copy.hintPlace : copy.hintPick}</Text>
      <TierBoard
        tiers={rows}
        posterUriOf={posterUriOf}
        editable
        selectedKey={selectedKey}
        theme={theme}
        onPressItem={onPressItem}
        onPressTier={onPressTier}
        onPressLabel={onPressLabel}
      />

      <TierListAddSheet
        visible={addVisible}
        copy={copy}
        theme={theme}
        language={language}
        existing={new Set(Object.keys(list.media))}
        capacity={TIER_LIMITS.items - counts.total}
        onClose={() => setAddVisible(false)}
        onAdd={onAdd}
      />
      <TierEditSheet
        visible={tierSheetVisible}
        tier={editTier}
        index={editIndex}
        count={list.tiers.length}
        copy={copy}
        theme={theme}
        onClose={() => setTierSheetVisible(false)}
        onDismissed={() => setEditTierId(null)}
        onChange={(patch) => change((c, now) => updateTier(c, editTierId, patch, now))}
        onMove={(delta) => change((c, now) => moveTier(c, editTierId, delta, now))}
        onAddBelow={() => change((c, now) => addTier(c, { afterId: editTierId }, now))}
        onDelete={() => {
          change((c, now) => removeTier(c, editTierId, now));
          setTierSheetVisible(false);
        }}
      />
      <TierListShareSheet
        visible={shareVisible}
        copy={copy}
        theme={theme}
        onClose={() => setShareVisible(false)}
        onDismissed={(choice) => share(list, choice)}
      />
      {shareHost}
    </GameScreenShell>
  );
}

function ActionChip({ theme, icon, label, onPress, disabled, danger, testID }) {
  const color = disabled ? theme.text.muted : danger ? "#E5484D" : theme.text.primary;
  return (
    <GlassTouchable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      // Devre dışı görünüm opaklıkla DEĞİL soluk içerik rengiyle (cam yüzeye opacity verilmez, bkz. GlassSurface).
      style={[styles.chip, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <AppIcon family="Ionicons" name={icon} size={15} color={color} />
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </GlassTouchable>
  );
}

const styles = StyleSheet.create({
  titleInput: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 17, fontWeight: "800" },
  hint: { fontSize: 12.5, fontWeight: "600", lineHeight: 17, marginLeft: 2 },
  footer: { gap: 8 },
  selection: { gap: 6 },
  selectionTitle: { fontSize: 13, fontWeight: "800" },
  // Cam düğmeli yatay satır: basma büyümesi kırpılmasın (dolgu + eşit negatif dış boşluk, yerleşim değişmez).
  rail: { marginVertical: -GLASS_PRESS_ROOM },
  actions: { gap: 6, paddingRight: 4, paddingVertical: GLASS_PRESS_ROOM },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 11, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 12.5, fontWeight: "800" },
  poolHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  poolTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  addChip: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 12, borderRadius: 12 },
  addChipText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" },
  pool: { gap: 6, paddingVertical: GLASS_PRESS_ROOM, minHeight: POOL_H + GLASS_PRESS_ROOM * 2 },
  poolEmpty: { fontSize: 12.5, fontWeight: "600", lineHeight: 17, paddingVertical: 8 },
});
