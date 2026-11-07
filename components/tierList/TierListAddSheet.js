// components/tierList/TierListAddSheet.js
//
// Tabloya içerik ekleme: İzlediklerim · Favoriler · İzleyeceklerim · Ara (TMDB film + dizi). Çoklu seçim; seçilenler
// "Ekle" ile havuza düşer. Tabloda olan yapım işaretli ve seçilemez; kalan yer (`capacity`) dolunca seçim durur.
//
// Kaynak listeler ListStatusContext'ten (yeni dinleyici açmaz). Uzun listede ilk 90 afiş çizilir; gerisi süzgeçle
// bulunur (sayfa bir ScrollView: binlerce afişi birden çizmesin). Arama 300 ms duraksayınca gider.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassSegmentedControl from "@components/common/GlassSegmentedControl";
import GlassTextInput from "@components/common/GlassTextInput";
import GlassTouchable from "@components/common/GlassTouchable";
import { useApiSettings } from "@context/AppSettingsContext";
import { useListStatusContext } from "@context/ListStatusContext";
import usePosterUri from "@hooks/usePosterUri";
import { searchTop100 } from "@services/top100Service";
import { foldText } from "@utils/listSearch";
import { mediaKeyOf, pickerItemsOf, tierMediaOf } from "@utils/tierList";
import { TierPoster } from "./TierBoard";
import { SheetButton, TierSheet } from "./tierSheetKit";
import { SEARCH_DEBOUNCE_MS } from "../../utils/searchDebounce";

const SOURCES = ["watched", "favorites", "watchlist", "search"];
const VISIBLE_MAX = 90;
const COLUMNS = 4;
const GAP = 8;
const SIDE = 18;

export default function TierListAddSheet({ visible, copy, theme, language, existing, capacity, onClose, onDismissed, onAdd }) {
  const { width } = useWindowDimensions();
  const posterUri = usePosterUri();
  const { API_KEY } = useApiSettings();
  const { watchedMoviesItems, watchedTvMap, favoritesItems, watchListItems } = useListStatusContext() || {};
  const [source, setSource] = useState("watched");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => new Map());
  const [search, setSearch] = useState({ status: "idle", items: [] });
  const requestRef = useRef(0);

  useEffect(() => {
    if (visible) {
      setPicked(new Map());
      setQuery("");
      setSearch({ status: "idle", items: [] });
    }
  }, [visible]);

  const pools = useMemo(
    () => ({
      watched: pickerItemsOf([watchedMoviesItems, Object.values(watchedTvMap || {})], ["movie", "tv"]),
      favorites: pickerItemsOf([favoritesItems]),
      watchlist: pickerItemsOf([watchListItems]),
    }),
    [watchedMoviesItems, watchedTvMap, favoritesItems, watchListItems],
  );

  // TMDB araması (yalnız "Ara" sekmesinde, en az iki harf, duraksayınca).
  const trimmed = query.trim();
  useEffect(() => {
    if (source !== "search" || !visible) return undefined;
    if (foldText(trimmed).replace(/\s/g, "").length < 2 || !API_KEY) {
      setSearch({ status: "idle", items: [] });
      return undefined;
    }
    const ticket = ++requestRef.current;
    setSearch((prev) => ({ ...prev, status: "loading" }));
    const timer = setTimeout(() => {
      searchTop100(API_KEY, language, trimmed)
        .then((results) => {
          if (ticket !== requestRef.current) return;
          const items = results
            .map((raw) => tierMediaOf(raw))
            .filter(Boolean)
            .map((media) => ({ key: mediaKeyOf(media.media_type, media.id), media }));
          setSearch({ status: "done", items });
        })
        .catch(() => ticket === requestRef.current && setSearch({ status: "error", items: [] }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [source, trimmed, API_KEY, language, visible]);

  const items = useMemo(() => {
    if (source === "search") return search.items;
    const needle = foldText(trimmed);
    const all = pools[source] || [];
    const filtered = needle ? all.filter(({ media }) => foldText(media.title).includes(needle)) : all;
    return filtered.slice(0, VISIBLE_MAX);
  }, [source, search.items, pools, trimmed]);

  const left = Math.max(0, capacity - picked.size);
  const toggle = ({ key, media }) => {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else if (left > 0) next.set(key, media);
      return next;
    });
  };

  const cell = Math.floor((width - SIDE * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  const posterH = Math.round(cell * 1.5);
  const sourceOptions = SOURCES.map((id) => ({ value: id, label: copy.sources[id] }));

  let status = null;
  if (source === "search") {
    if (search.status === "loading") status = <ActivityIndicator color={theme.accent} style={styles.status} />;
    else if (search.status === "error") status = <Text style={[styles.statusText, { color: theme.text.muted }]}>{copy.searchError}</Text>;
    else if (search.status === "idle") status = <Text style={[styles.statusText, { color: theme.text.muted }]}>{copy.searchHint}</Text>;
    else if (!items.length) status = <Text style={[styles.statusText, { color: theme.text.muted }]}>{copy.noResults}</Text>;
  } else if (!items.length) {
    status = <Text style={[styles.statusText, { color: theme.text.muted }]}>{trimmed ? copy.noResults : copy.sourceEmpty}</Text>;
  }

  return (
    <TierSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      theme={theme}
      title={copy.addTitle}
      subtitle={capacity > 0 ? copy.capLeft(left) : copy.capFull(capacity)}
      footer={
        <SheetButton
          theme={theme}
          label={copy.addAction(picked.size)}
          icon="add"
          disabled={!picked.size}
          onPress={() => onAdd([...picked.values()])}
        />
      }
    >
      <GlassSegmentedControl options={sourceOptions} value={source} onChange={setSource} accessibilityLabel={copy.addTitle} testIDPrefix="tier-source" />
      <GlassTextInput
        value={query}
        onChangeText={setQuery}
        placeholder={source === "search" ? copy.searchPlaceholder : copy.filterPlaceholder}
        placeholderTextColor={theme.text.muted}
        returnKeyType="search"
        autoCorrect={false}
        style={[styles.input, { backgroundColor: theme.between, borderColor: theme.border, color: theme.text.primary }]}
        accessibilityLabel={source === "search" ? copy.searchPlaceholder : copy.filterPlaceholder}
        testID="tier-add-query"
      />
      {status}
      <View style={styles.grid}>
        {items.map((entry) => {
          const inList = existing.has(entry.key);
          const selected = picked.has(entry.key);
          return (
            <GlassTouchable
              key={entry.key}
              glass={false}
              activeOpacity={0.75}
              disabled={inList}
              onPress={() => toggle(entry)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected || inList, disabled: inList }}
              accessibilityLabel={inList ? `${entry.media.title}, ${copy.inList}` : entry.media.title}
              testID={`tier-pick-${entry.key}`}
              style={{ width: cell }}
            >
              <TierPoster
                media={entry.media}
                uri={posterUri(entry.media.media_type, entry.media.id, entry.media.poster_path, cell)}
                width={cell}
                height={posterH}
                selected={selected}
                accent={theme.accent}
                dim={inList}
              />
              {selected || inList ? (
                <View style={[styles.check, { backgroundColor: inList ? theme.text.muted : theme.accent }]}>
                  <AppIcon family="Ionicons" name="checkmark" size={14} color="#FFFFFF" />
                </View>
              ) : null}
              <Text style={[styles.caption, { color: theme.text.secondary }]} numberOfLines={1}>
                {entry.media.title}
              </Text>
            </GlassTouchable>
          );
        })}
      </View>
    </TierSheet>
  );
}

const styles = StyleSheet.create({
  input: { height: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 15, fontWeight: "600", marginTop: 10 },
  status: { marginTop: 18 },
  statusText: { fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, marginTop: 12 },
  check: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  caption: { fontSize: 11, fontWeight: "600", marginTop: 4 },
});
