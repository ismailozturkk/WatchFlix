import { readableTextOn } from "@utils/colorUtils";
import { alpha } from "@theme/colors";
// components/lists/ListSearchBar.js
//
// Liste ekranının arama başlığı: TEK satırda arama kutusu + KİP SEÇİCİ (iki simge) + sırala/filtrele
// düğmesi. Kip düğmeleri eskiden kutunun altında etiketli iki geniş düğmeydi; artık yalnız simge.
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
import GlassField from "@components/common/GlassField";
import GlassIconButton from "@components/common/GlassIconButton";
import { useGlassScheme } from "@components/common/GlassSurface";
import GlassTouchable from "../common/GlassTouchable";

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

// Yalnız simge: ad ve (varsa) sayı erişilebilirlik etiketine gider, ekranda yer kaplamaz.
function ModeButton({ active, accent, theme, icon, label, count, onPress }) {
  const foreground = readableTextOn(accent);
  const spoken = count != null ? `${label}, ${count > 999 ? "999+" : count}` : label;
  return (
    <GlassTouchable
      activeOpacity={0.85}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ selected: active }}
      style={[styles.modeBtn, active && { backgroundColor: accent }]}
    >
      <Ionicons name={icon} size={18} color={active ? foreground : theme.text.muted} />
    </GlassTouchable>
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
  const scheme = useGlassScheme();

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
        {/* iOS 26+: hap biçimli Liquid Glass (Tüm içerikler kipinde vurgu tonlu);
            diğer yerlerde eski kutu. */}
        <GlassField
          height={42}
          focused={isGlobal}
          accent={accent}
          fallbackStyle={[
            styles.inputBox,
            {
              backgroundColor: theme.secondary,
              borderColor: isGlobal ? accent + "66" : theme.border,
            },
          ]}
          style={styles.inputWrap}
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
            keyboardAppearance={scheme}
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
        </GlassField>

        {/* Kip seçici: yalnız simge, arama kutusu ile filtre düğmesi ARASINDA. */}
        <View style={[styles.modeRow, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
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

        {/* Filtre düğmesi: iOS 26+'da cam daire (etkin filtre sayısı camın DIŞINDA
            rozet olarak durur); diğer yerlerde eski kutu. */}
        <GlassIconButton
          size={42}
          hitSlop={4}
          onPress={onOpenFilters}
          tint={activeFilterCount > 0 ? alpha(accent, 0.28) : undefined}
          accessibilityLabel={i18nText("autoI18n.filtrele", "Filtrele")}
          fallbackStyle={{
            backgroundColor: theme.secondary,
            borderColor: activeFilterCount > 0 ? accent : theme.border,
            borderWidth: 1,
          }}
          overlay={
            !filtering && activeFilterCount > 0 ? (
              <View pointerEvents="none" style={[styles.filterDot, { backgroundColor: accent }]}>
                <Text allowFontScaling={false} style={[styles.filterDotText, { color: readableTextOn(accent) }]}>
                  {activeFilterCount}
                </Text>
              </View>
            ) : null
          }
        >
          {filtering ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Feather name="sliders" size={18} color={theme.text.primary} />
          )}
        </GlassIconButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "95%", alignSelf: "center", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  // Yerleşim iki yolda da geçerli; köşe/çerçeve yalnız eski kutuda (cam kendi
  // şeklini çizer).
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 8,
  },
  inputBox: { borderRadius: 12, borderWidth: 1 },
  input: { flex: 1, height: "100%", padding: 0, fontSize: 14 },
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
  // Arama kutusu (42 pt) ile aynı yükseklikte iki simgelik kapsül.
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
  },
  modeBtn: {
    width: 34,
    height: "100%",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default memo(ListSearchBar);
