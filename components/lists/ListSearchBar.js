// components/lists/ListSearchBar.js
//
// Liste ekranının arama başlığı: arama kutusu + KİP SEÇİCİ + sırala/filtrele
// düğmesi.
//
// Eskiden bu satır yalnız "öğe sayısı > 12" ise çiziliyordu; 12'nin altındaki
// listelerde arama da sıralama/filtre de yoktu ve boş listeye içerik eklemenin
// ekran içinden hiçbir yolu bulunmuyordu. Artık HER ZAMAN görünür ve iki kip
// sunar:
//
//   • Bu listede → ekrandaki öğeleri süzer
//   • Tüm içerikler → TMDB'de arar, sonuç bu listeye eklenebilir
//
// Sorgu metni İKİ KİPTE DE aynıdır (tek `query` prop'u): "inter" yazıp kip
// değiştiren kullanıcı metnini yeniden yazmak zorunda kalmasın.

import React, { memo, useRef } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import { i18nText } from "@utils/i18nText";
import { LIST_SEARCH_MODE, listAcceptedTypes } from "@utils/listSearch";

const placeholderFor = (mode, listName) => {
  if (mode === LIST_SEARCH_MODE.IN_LIST) {
    return i18nText("autoI18n.liste_icinde_ara", "Bu listede ara...");
  }
  const types = listAcceptedTypes(listName);
  if (types.length === 1) {
    return types[0] === "tv"
      ? i18nText("autoI18n.dizi_ara_ekle", "Eklemek için dizi ara...")
      : i18nText("autoI18n.film_ara_ekle", "Eklemek için film ara...");
  }
  return i18nText("autoI18n.film_dizi_ara_ekle", "Eklemek için film veya dizi ara...");
};

function ModeButton({ active, accent, theme, icon, label, count, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.modeBtn,
        active && { backgroundColor: accent },
      ]}
    >
      <Ionicons
        name={icon}
        size={14}
        color={active ? "#fff" : theme.text.muted}
      />
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={[
          styles.modeText,
          { color: active ? "#fff" : theme.text.muted },
        ]}
      >
        {label}
      </Text>
      {count != null ? (
        <View
          style={[
            styles.modeCount,
            {
              backgroundColor: active ? "rgba(255,255,255,0.22)" : theme.primary,
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            style={[
              styles.modeCountText,
              { color: active ? "#fff" : theme.text.muted },
            ]}
          >
            {count > 999 ? "999+" : count}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function ListSearchBar({
  theme,
  accent,
  listName,
  mode,
  onModeChange,
  query,
  onQueryChange,
  onOpenFilters,
  activeFilterCount = 0,
  filtering = false,
  inListCount,
  globalCount,
  globalLoading = false,
}) {
  const isGlobal = mode === LIST_SEARCH_MODE.GLOBAL;
  const inputRef = useRef(null);

  // Kipi ELLE değiştiren kullanıcı doğrudan yazmaya başlayabilsin. Odak yalnız
  // burada veriliyor — boş listede kipin kendiliğinden global açılması (bkz.
  // ListsScreen) klavyeyi ekran açılışında zorlamasın.
  const selectMode = (next) => {
    onModeChange(next);
    if (next === LIST_SEARCH_MODE.GLOBAL) inputRef.current?.focus();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: theme.secondary,
              borderColor: isGlobal ? accent + "66" : theme.border,
            },
          ]}
        >
          <Ionicons
            name={isGlobal ? "globe-outline" : "search"}
            size={17}
            color={isGlobal ? accent : theme.text.muted}
          />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: theme.text.primary }]}
            placeholder={placeholderFor(mode, listName)}
            placeholderTextColor={theme.text.muted}
            value={query}
            onChangeText={onQueryChange}
            maxLength={80}
            autoCorrect={false}
            returnKeyType="search"
          />
          {globalLoading ? (
            <ActivityIndicator size="small" color={accent} />
          ) : query.length > 0 ? (
            <TouchableOpacity onPress={() => onQueryChange("")} hitSlop={10}>
              <Ionicons
                name="close-circle"
                size={17}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onOpenFilters}
          style={[
            styles.filterBtn,
            {
              backgroundColor: theme.secondary,
              borderColor: activeFilterCount > 0 ? accent : theme.border,
            },
          ]}
        >
          {filtering ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Feather name="sliders" size={18} color={theme.text.primary} />
          )}
          {!filtering && activeFilterCount > 0 ? (
            <View style={[styles.filterDot, { backgroundColor: accent }]}>
              <Text allowFontScaling={false} style={styles.filterDotText}>
                {activeFilterCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.modeRow,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        <ModeButton
          active={!isGlobal}
          accent={accent}
          theme={theme}
          icon="albums-outline"
          label={i18nText("autoI18n.bu_listede", "Bu listede")}
          count={inListCount}
          onPress={() => selectMode(LIST_SEARCH_MODE.IN_LIST)}
        />
        <ModeButton
          active={isGlobal}
          accent={accent}
          theme={theme}
          icon="planet-outline"
          label={i18nText("autoI18n.tum_icerikler", "Tüm içerikler")}
          count={isGlobal ? globalCount : null}
          onPress={() => selectMode(LIST_SEARCH_MODE.GLOBAL)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "95%", alignSelf: "center", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  inputWrap: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 8,
  },
  input: { flex: 1, height: "100%", padding: 0, fontSize: 14 },
  filterBtn: {
    width: 44,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterDotText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  modeBtn: {
    flex: 1,
    height: 30,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  modeText: { fontSize: 12, fontWeight: "700" },
  modeCount: {
    minWidth: 18,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  modeCountText: { fontSize: 10, fontWeight: "800" },
});

export default memo(ListSearchBar);
