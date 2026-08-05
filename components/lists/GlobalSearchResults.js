// components/lists/GlobalSearchResults.js
//
// Liste ekranındaki "Tüm içerikler" kipinin sonuç paneli: TMDB'de bulunan film
// ve dizileri satır satır gösterir; sağdaki düğme eseri AÇIK OLAN listeye ekler.
//
// Satıra basmak detay ekranına gider, düğme eklemeyi yapar — iki eylem
// ayrılmıştır ki "bakmak" ile "eklemek" karışmasın. Zaten listede olan eser
// için düğme yerine tik gösterilir: bu ekranda silme YOKTUR, sonuç listesinden
// yanlışlıkla kaldırma diye bir şey olmasın.
//
// YAPI NOTU — satır İÇ İÇE Touchable DEĞİL, iki KARDEŞ dokunma alanıdır:
// solda "detayı aç", sağda "ekle". İç içe olduğu sürece (a) ekran okuyucu dış
// Touchable'ı tek bir öğe olarak sunduğu için ekleme düğmesine hiç
// odaklanılamıyordu, (b) ekleme sürerken spinner'a ya da "zaten listede"
// tikine basmak dokunuşu dış satıra düşürüp detay ekranını açıyordu.

import React, { memo, useCallback, useMemo } from "react";
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
import { useListLayoutSettings } from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import { readableOn } from "@utils/colorUtils";
import { GLOBAL_SEARCH_MIN_CHARS, listRequiresWatchDate } from "@utils/listSearch";

const POSTER_W = 46;
const POSTER_H = 69;

const EMPTY_SET = new Set();
const EMPTY_ARRAY = [];

// MovieSearch/TvShowSearch ile AYNI eşikler — puan rengi uygulama genelinde
// aynı anlamı taşısın (bkz. screens/search/MovieSearch.js).
const ratingBaseColor = (rating) => {
  if (rating >= 8) return "#29b864";
  if (rating >= 6) return "#f5c518";
  if (rating >= 4) return "#ff6400";
  return "#e33";
};

// Tip cipi, puan hapi ve "eklendi" tiki ANLAM rengi tasiyor; bu renkler
// uygulamanin bazi temalarinda (ozellikle acik zeminli light/green ve
// kullanicinin kendi urettigi temalarda) okunmuyordu. readableOn tonu koruyup
// yalniz parlakligi zeminden uzaklastirir — bkz. utils/colorUtils.js.

const LoadingRows = ({ theme }) => (
  <View style={{ gap: 8 }}>
    {[0, 1, 2, 3, 4].map((i) => (
      <View
        key={i}
        style={[
          styles.skeletonRow,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
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
  actionColor,
  added,
  adding,
  addIcon,
  addLabel,
  genreMap,
  showRating,
  showYear,
  onAdd,
  onOpen,
}) {
  const isTv = item.type === "tv";
  const typeLabel = isTv
    ? i18nText("autoI18n.dizi", "Dizi")
    : i18nText("autoI18n.film", "Film");

  // Tür adı listeye ek bir ağ isteği getirmez: genreMap zaten ListsScreen'de
  // kurulu düz bir tablo. Bilinmeyen id undefined döneceği için filter(Boolean).
  const genre = genreMap
    ? (item.genre_ids || []).map((id) => genreMap[id]).filter(Boolean)[0]
    : null;
  const metaText = [showYear ? item.year : null, genre].filter(Boolean).join(" · ");

  const typeColor = readableOn(
    isTv ? theme.notesColor.green : theme.notesColor.blue,
    theme.secondary,
  );
  const ratingColor = readableOn(ratingBaseColor(item.rating), theme.secondary);
  const okColor = readableOn(theme.colors?.green || "#29b864", theme.secondary);

  const title = item.title || i18nText("autoI18n.isimsiz", "İsimsiz");

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onOpen(item)}
        style={[styles.main, added && styles.mainAdded]}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${typeLabel}${metaText ? `, ${metaText}` : ""}`}
        accessibilityHint={i18nText(
          "autoI18n.detaylari_acar",
          "Detayları açar",
        )}
      >
        {/* Poster kuyusu: PosterImage'in yer tutucusu theme.secondary zeminli,
            satırın zemini de öyle — kuyu olmadan posteri olmayan içerikte sol
            taraf boş bir delik gibi görünüyordu. */}
        <View style={[styles.posterWell, { backgroundColor: theme.between }]}>
          <PosterImage
            path={item.poster_path}
            type={item.type}
            // Görsel 46px çiziliyor; 200 istemek gereksiz büyük dosya indiriyordu.
            size={POSTER_W}
            style={styles.poster}
          />
        </View>

        <View style={styles.info}>
          <Text
            numberOfLines={2}
            style={[styles.title, { color: theme.text.primary }]}
          >
            {title}
          </Text>
          <View style={styles.metaRow}>
            <View
              style={[
                styles.typeChip,
                { backgroundColor: typeColor + "22", borderColor: typeColor + "66" },
              ]}
            >
              <Text
                maxFontSizeMultiplier={1.2}
                style={[styles.typeChipText, { color: typeColor }]}
              >
                {typeLabel}
              </Text>
            </View>

            {metaText ? (
              <Text
                numberOfLines={1}
                style={[styles.meta, { color: theme.text.muted }]}
              >
                {metaText}
              </Text>
            ) : null}

            {showRating && item.rating > 0 ? (
              <View
                style={[
                  styles.ratingPill,
                  {
                    backgroundColor: ratingColor + "22",
                    borderColor: ratingColor + "66",
                  },
                ]}
              >
                <Text
                  maxFontSizeMultiplier={1.2}
                  style={[styles.ratingText, { color: ratingColor }]}
                >
                  {"★ "}
                  {item.rating.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      {added ? (
        <View
          style={[
            styles.actionBtn,
            { backgroundColor: okColor + "22", borderColor: okColor + "66" },
          ]}
          accessibilityRole="image"
          accessibilityLabel={i18nText(
            "autoI18n.zaten_listede_kisa",
            "Zaten listede",
          )}
        >
          <Feather name="check" size={18} color={okColor} />
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={adding}
          onPress={() => onAdd(item)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          accessibilityState={{ disabled: adding, busy: adding }}
          style={[
            styles.actionBtn,
            {
              backgroundColor: actionColor + "22",
              borderColor: actionColor + "66",
            },
          ]}
        >
          {adding ? (
            <ActivityIndicator size="small" color={actionColor} />
          ) : (
            <Feather name={addIcon} size={18} color={actionColor} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
});

function GlobalSearchResults({
  theme,
  accent,
  listName,
  query,
  results = EMPTY_ARRAY,
  suggestions = EMPTY_ARRAY,
  loading,
  error,
  existingKeys = EMPTY_SET,
  addingKey = null,
  genreMap = null,
  onAdd,
  onOpen,
}) {
  const { posterBadges } = useListLayoutSettings();
  const trimmed = String(query || "").trim();
  const isSearching = trimmed.length >= GLOBAL_SEARCH_MIN_CHARS;
  const data = isSearching ? results : suggestions;
  const isWatchList = listRequiresWatchDate(listName);
  // İzlenenler listelerinde "ekleme" bir izleme kaydıdır — ikon da onu söylesin.
  const addIcon = isWatchList ? "eye" : "plus";
  const addLabel = isWatchList
    ? i18nText("autoI18n.izlendi_isaretle", "İzlendi işaretle")
    : i18nText("autoI18n.listeye_ekle", "Listeye ekle");

  // `accent` ListsScreen'de `theme.between` (bir YÜZEY tonu) olarak
  // hesaplanıyor; gray temada #24262B, satır zemini ise #2A2D33 — yani panelin
  // TEK birincil eylemi hiçbir temada görünmüyordu. Burada gerçek vurgu rengi
  // tercih edilir, prop yalnızca geriye dönük yedek olarak durur.
  const actionColor = theme.accent || accent || "#3B82F6";
  const showRating = posterBadges?.tmdbRating !== false;
  const showYear = posterBadges?.releaseDate !== false;

  const renderItem = useCallback(
    ({ item }) => (
      <ResultRow
        item={item}
        theme={theme}
        actionColor={actionColor}
        added={existingKeys.has(item.key)}
        adding={addingKey === item.key}
        addIcon={addIcon}
        addLabel={addLabel}
        genreMap={genreMap}
        showRating={showRating}
        showYear={showYear}
        onAdd={onAdd}
        onOpen={onOpen}
      />
    ),
    [
      theme,
      actionColor,
      existingKeys,
      addingKey,
      addIcon,
      addLabel,
      genreMap,
      showRating,
      showYear,
      onAdd,
      onOpen,
    ],
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
        {isWatchList
          ? i18nText(
              "autoI18n.isaretlemek_icin_dugme",
              "İşaretlemek için sağdaki düğmeye dokun",
            )
          : i18nText(
              "autoI18n.eklemek_icin_dugme",
              "Eklemek için sağdaki düğmeye dokun",
            )}
      </Text>
    </View>
  );

  // ELEMENT olarak veriliyor, bileşen olarak değil: her render'da yeni bir
  // bileşen TİPİ üretmek listeyi baştan bağlar ve iskelet animasyonu her tuşta
  // sıfırlanır. useMemo ile element kimliği de gereksiz yere değişmesin.
  const empty = useMemo(() => {
    if (loading) return <LoadingRows theme={theme} />;
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
  }, [loading, error, isSearching, theme]);

  return (
    <FlatList
      style={styles.list}
      data={loading && data.length === 0 ? EMPTY_ARRAY : data}
      keyExtractor={keyOf}
      renderItem={renderItem}
      ListHeaderComponent={data.length > 0 ? header : null}
      ListEmptyComponent={empty}
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

const keyOf = (item) => item.key;

const styles = StyleSheet.create({
  list: { alignSelf: "stretch", flex: 1 },
  content: { paddingHorizontal: 12, paddingBottom: 40, gap: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingBottom: 4,
    gap: 8,
  },
  headerLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  headerHint: { fontSize: 10, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  // Sol dokunma alanı: poster + bilgi. Sağdaki eylem düğmesiyle KARDEŞ.
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  // Zaten listede olan eser soluklaşır — "eklendi" bilgisi salt renkle değil,
  // satırın bütününde okunur olsun (renk körlüğü için de tek kanal yetmez).
  mainAdded: { opacity: 0.55 },
  posterWell: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 8,
    overflow: "hidden",
  },
  poster: { width: "100%", height: "100%" },
  info: { flex: 1, gap: 5 },
  title: { fontSize: 14, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  typeChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    flexShrink: 0,
  },
  typeChipText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  meta: { fontSize: 11, fontWeight: "600", flexShrink: 1 },
  ratingPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    flexShrink: 0,
  },
  ratingText: { fontSize: 10, fontWeight: "800" },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  center: { alignItems: "center", justifyContent: "center", paddingTop: 48, gap: 10 },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 30,
    lineHeight: 19,
  },
});

export default memo(GlobalSearchResults);
