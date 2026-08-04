// components/lists/GlobalSearchResults.js
//
// Liste ekranındaki "Tüm içerikler" kipinin sonuç paneli: TMDB'de bulunan film
// ve dizileri satır satır gösterir; sağdaki düğme eseri AÇIK OLAN listeye ekler.
//
// Satıra basmak detay ekranına gider, düğme eklemeyi yapar — iki eylem
// ayrılmıştır ki "bakmak" ile "eklemek" karışmasın. Zaten listede olan eser
// için düğme yerine tik gösterilir: bu ekranda silme YOKTUR, sonuç listesinden
// yanlışlıkla kaldırma diye bir şey olmasın.

import React, { memo, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import PosterImage from "@components/PosterImage";
import Skeleton from "@components/Skeleton";
import { i18nText } from "@utils/i18nText";
import { GLOBAL_SEARCH_MIN_CHARS, listRequiresWatchDate } from "@utils/listSearch";

const POSTER_W = 46;
const POSTER_H = 69;

const LoadingRows = () => (
  <View style={{ gap: 10 }}>
    {[0, 1, 2, 3, 4].map((i) => (
      <View key={i} style={styles.skeletonRow}>
        <Skeleton width={POSTER_W} height={POSTER_H} style={{ borderRadius: 8 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="70%" height={14} style={{ borderRadius: 6 }} />
          <Skeleton width="40%" height={11} style={{ borderRadius: 6 }} />
        </View>
      </View>
    ))}
  </View>
);

const ResultRow = memo(function ResultRow({
  item,
  theme,
  accent,
  added,
  adding,
  addIcon,
  onAdd,
  onOpen,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onOpen(item)}
      style={[
        styles.row,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <PosterImage
        path={item.poster_path}
        type={item.type}
        size={200}
        style={styles.poster}
      />

      <View style={styles.info}>
        <Text
          numberOfLines={2}
          style={[styles.title, { color: theme.text.primary }]}
        >
          {item.title || i18nText("autoI18n.isimsiz", "İsimsiz")}
        </Text>
        <View style={styles.metaRow}>
          <View
            style={[
              styles.typeChip,
              {
                backgroundColor:
                  item.type === "tv"
                    ? theme.notesColor.greenBackground
                    : theme.notesColor.blueBackground,
              },
            ]}
          >
            <Text allowFontScaling={false} style={styles.typeChipText}>
              {item.type === "tv"
                ? i18nText("autoI18n.dizi", "Dizi")
                : i18nText("autoI18n.film", "Film")}
            </Text>
          </View>
          {item.year ? (
            <Text style={[styles.meta, { color: theme.text.muted }]}>
              {item.year}
            </Text>
          ) : null}
          {item.rating > 0 ? (
            <Text style={[styles.meta, { color: theme.text.muted }]}>
              {"★ "}
              {item.rating.toFixed(1)}
            </Text>
          ) : null}
        </View>
      </View>

      {added ? (
        <View
          style={[
            styles.actionBtn,
            {
              backgroundColor: (theme.colors?.green || "#29b864") + "22",
              borderColor: (theme.colors?.green || "#29b864") + "66",
            },
          ]}
        >
          <Feather
            name="check"
            size={18}
            color={theme.colors?.green || "#29b864"}
          />
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={adding}
          onPress={() => onAdd(item)}
          hitSlop={8}
          style={[
            styles.actionBtn,
            { backgroundColor: accent + "22", borderColor: accent + "66" },
          ]}
        >
          {adding ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Feather name={addIcon} size={18} color={accent} />
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

function GlobalSearchResults({
  theme,
  accent,
  listName,
  query,
  results,
  suggestions,
  loading,
  error,
  existingKeys,
  addingKey,
  onAdd,
  onOpen,
}) {
  const trimmed = String(query || "").trim();
  const isSearching = trimmed.length >= GLOBAL_SEARCH_MIN_CHARS;
  const data = isSearching ? results : suggestions;
  // İzlenenler listelerinde "ekleme" bir izleme kaydıdır — ikon da onu söylesin.
  const addIcon = listRequiresWatchDate(listName) ? "eye" : "plus";

  const renderItem = useCallback(
    ({ item }) => (
      <ResultRow
        item={item}
        theme={theme}
        accent={accent}
        added={existingKeys.has(item.key)}
        adding={addingKey === item.key}
        addIcon={addIcon}
        onAdd={onAdd}
        onOpen={onOpen}
      />
    ),
    [theme, accent, existingKeys, addingKey, addIcon, onAdd, onOpen],
  );

  const header = (
    <View style={styles.headerRow}>
      <Text style={[styles.headerLabel, { color: theme.text.muted }]}>
        {isSearching
          ? i18nText("autoI18n.n_sonuc", "{{count}} sonuç", {
              count: data.length,
            })
          : i18nText("autoI18n.oneriler_upper", "ÖNERİLER")}
      </Text>
      <Text style={[styles.headerHint, { color: theme.text.muted }]}>
        {listRequiresWatchDate(listName)
          ? i18nText("autoI18n.isaretlemek_icin_dokun", "İşaretlemek için dokun")
          : i18nText("autoI18n.eklemek_icin_dokun", "Eklemek için dokun")}
      </Text>
    </View>
  );

  // ELEMENT olarak veriliyor, bileşen olarak değil: her render'da yeni bir
  // bileşen TİPİ üretmek listeyi baştan bağlar ve iskelet animasyonu her tuşta
  // sıfırlanır.
  const renderEmpty = () => {
    if (loading) return <LoadingRows />;
    if (error) {
      return (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={34} color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.muted }]}>
            {i18nText(
              "autoI18n.arama_yapilamadi",
              "Arama yapılamadı, bağlantını kontrol et.",
            )}
          </Text>
        </View>
      );
    }
    if (!isSearching) {
      return (
        <View style={styles.center}>
          <Ionicons name="planet-outline" size={34} color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.muted }]}>
            {i18nText(
              "autoI18n.global_arama_ipucu",
              "Listeye eklemek istediğin içeriği aramaya başla.",
            )}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <Ionicons name="search-outline" size={34} color={theme.text.muted} />
        <Text style={[styles.emptyText, { color: theme.text.muted }]}>
          {i18nText("autoI18n.sonuc_bulunamadi", "Sonuç bulunamadı.")}
        </Text>
      </View>
    );
  };

  return (
    <FlatList
      style={styles.list}
      data={loading && data.length === 0 ? [] : data}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      ListHeaderComponent={data.length > 0 ? header : null}
      ListEmptyComponent={renderEmpty()}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      initialNumToRender={8}
      windowSize={7}
      removeClippedSubviews={false}
    />
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: "stretch", flex: 1 },
  content: { paddingHorizontal: 12, paddingBottom: 40, gap: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  headerLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  headerHint: { fontSize: 10, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  poster: { width: POSTER_W, height: POSTER_H, borderRadius: 8 },
  info: { flex: 1, gap: 6 },
  title: { fontSize: 14, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  typeChipText: { fontSize: 9, fontWeight: "800", color: "#fff" },
  meta: { fontSize: 11, fontWeight: "600" },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8 },
  center: { alignItems: "center", justifyContent: "center", paddingTop: 48, gap: 10 },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 30,
    lineHeight: 19,
  },
});

export default memo(GlobalSearchResults);
