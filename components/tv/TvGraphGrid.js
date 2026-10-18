// components/tv/TvGraphGrid.js
//
// Dizi "Bölüm Puan Grafiği" ızgarası (screens/tv/TvGraphDetailScreen.js).
// Sütun = sezon, satır = bölüm numarası; hücre rengi bölüm puanından gelir.
//
// PERFORMANS: eskiden TÜM hücreler (uzun dizilerde 500–800) ilk karede mount
// ediliyordu ve her biri bir TouchableOpacity (hücre başına Animated.Value) idi.
// Şimdi:
//   • Dikey eksen bir FlatList: yalnız görünen satırlar (+ küçük pencere) bellekte.
//     Satır yüksekliği sabit olduğundan `getItemLayout` ile hiçbir satır ölçülmez.
//   • Hücre = Pressable (animasyon değeri yok), satır = `memo`.
//   • Seçim satıra yalnız "bu satırda seçili sezon" olarak iner (tvGraphRowSelection):
//     bir bölüme dokununca eski ve yeni seçili iki satır yeniden çizilir, kalanı atlanır.
//   • Erişilebilirlik etiketinin üç çevirisi hücre başına değil, bir kez çözülür.
//
// YERLEŞİM: yatay ScrollView > (sezon başlığı + dikey FlatList). İç dikey liste için
// kesin bir yükseklik gerekir; yatay ScrollView içeriğinin çapraz eksende uzayacağına
// güvenmek yerine görüntü alanı `onLayout` ile ölçülüp açık yükseklik verilir.
import React, { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getRatingColors } from "../../utils/ratingColors";
import {
  tvGraphInitialRows,
  tvGraphMetrics,
  tvGraphRowLayout,
  tvGraphRowSelection,
} from "../../utils/tvGraphGrid";

const SELECTED_BORDER = "#fff";
const keyExtractor = (rowIndex) => String(rowIndex);
const LIST_FOOTER = <View style={{ height: 32 }} />;

// ─── Bölüm hücresi ────────────────────────────────────────────────────────────
const EpisodeCell = memo(function EpisodeCell({
  episode,
  seasonNumber,
  episodeIndex,
  isSelected,
  onPress,
  borderColor,
  grid,
  a11y,
}) {
  const { bg, text } = getRatingColors(episode.vote_average);
  const rating = episode.vote_average ? episode.vote_average.toFixed(1) : "N/A";

  // Koordinatlar hücrenin kendi içinde bağlanır — ızgara `onPress`e her render'da
  // yeni bir arrow geçirmek zorunda kalmaz ve memo tutar.
  const handlePress = useCallback(
    () => onPress(seasonNumber, episodeIndex),
    [onPress, seasonNumber, episodeIndex],
  );

  const base = useMemo(
    () => ({
      width: grid.cell,
      height: grid.cell,
      margin: grid.margin,
      borderRadius: grid.radius,
      backgroundColor: bg,
      borderWidth: 1.5,
      borderColor: isSelected ? SELECTED_BORDER : borderColor,
      transform: [{ scale: isSelected ? 1.08 : 1 }],
    }),
    [grid, bg, isSelected, borderColor],
  );
  const pressedStyle = useMemo(() => [styles.cell, base, styles.pressed], [base]);
  const idleStyle = useMemo(() => [styles.cell, base], [base]);

  const labelStyles = useMemo(
    () =>
      grid.colorOnly
        ? null
        : {
            season: [
              styles.cellSeasonLabel,
              {
                color: text,
                fontSize: grid.label,
                top: grid.labelOffset,
                left: grid.labelOffset + 1,
              },
            ],
            rating: [styles.cellRating, { color: text, fontSize: grid.rating }],
            episode: [
              styles.cellEpisodeLabel,
              {
                color: text,
                fontSize: grid.label,
                bottom: grid.labelOffset,
                right: grid.labelOffset + 1,
              },
            ],
          },
    [grid, text],
  );

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${a11y.season} ${seasonNumber}, ${a11y.episode} ${episodeIndex + 1}, ${a11y.rating} ${rating}`}
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => (pressed ? pressedStyle : idleStyle)}
    >
      {labelStyles ? (
        <>
          <Text style={labelStyles.season}>S{seasonNumber}</Text>
          <Text style={labelStyles.rating}>{rating}</Text>
          <Text style={labelStyles.episode}>E{episodeIndex + 1}</Text>
        </>
      ) : null}
    </Pressable>
  );
});

// Kısa sezonun bitişinden sonraki boş hücre.
const EmptyCell = memo(function EmptyCell({ grid }) {
  const style = useMemo(
    () => [styles.emptyCell, { width: grid.cell, height: grid.cell, margin: grid.margin }],
    [grid],
  );
  const dotStyle = useMemo(() => [styles.emptyCellDot, { fontSize: grid.dot }], [grid]);
  return (
    <View style={style}>
      {grid.colorOnly ? null : <Text style={dotStyle}>·</Text>}
    </View>
  );
});

// ─── Satır ────────────────────────────────────────────────────────────────────
const EpisodeRow = memo(function EpisodeRow({
  rowIndex,
  seasons,
  grid,
  metrics,
  selectedSeason,
  onPress,
  borderColor,
  headerColor,
  labels,
}) {
  const headerStyle = useMemo(
    () => [
      styles.episodeHeader,
      { width: metrics.rowLabelWidth, height: metrics.colWidth },
    ],
    [metrics],
  );
  const axisTextStyle = useMemo(
    () => [styles.axisText, { fontSize: grid.headerFont, color: headerColor }],
    [grid, headerColor],
  );

  return (
    <View style={[styles.row, { height: metrics.rowHeight }]}>
      {grid.showAxes ? (
        <View style={headerStyle}>
          <Text numberOfLines={1} style={axisTextStyle}>
            {labels.episodeLetter}
            {rowIndex + 1}
          </Text>
        </View>
      ) : null}
      {seasons.map((season) => {
        const episode = season.episodes[rowIndex];
        return episode ? (
          <EpisodeCell
            key={season.season_number}
            episode={episode}
            seasonNumber={season.season_number}
            episodeIndex={rowIndex}
            grid={grid}
            isSelected={selectedSeason === season.season_number}
            onPress={onPress}
            borderColor={borderColor}
            a11y={labels}
          />
        ) : (
          <EmptyCell key={season.season_number} grid={grid} />
        );
      })}
    </View>
  );
});

// ─── Sezon başlık satırı (yalnız ısı haritasında) ─────────────────────────────
const SeasonHeader = memo(function SeasonHeader({ seasons, grid, metrics, headerColor, labels }) {
  const cellStyle = useMemo(() => [styles.seasonHeader, { width: metrics.colWidth }], [metrics]);
  const textStyle = useMemo(
    () => [styles.axisText, { fontSize: grid.headerFont, color: headerColor }],
    [grid, headerColor],
  );
  return (
    <View style={[styles.row, { marginBottom: grid.margin * 2 }]}>
      <View style={{ width: metrics.rowLabelWidth }} />
      {seasons.map((season) => (
        <View key={season.season_number} style={cellStyle}>
          <Text style={textStyle}>
            {labels.seasonLetter}
            {season.season_number}
          </Text>
        </View>
      ))}
    </View>
  );
});

// ─── Izgara ───────────────────────────────────────────────────────────────────
/**
 * @param {object} props
 * @param {Array}  props.seasons       TMDB sezonları (`episodes` dolu)
 * @param {object} props.grid          TV_GRAPH_GRID_SIZES girdisi
 * @param {string} props.gridKey       ızgara kipi anahtarı — kip değişince liste sıfırdan kurulur
 * @param {{season:number,index:number}|null} props.selected
 * @param {(season:number, index:number)=>void} props.onPress   KARARLI olmalı (useCallback)
 * @param {string} props.borderColor   hücre çerçevesi (ekran zemini)
 * @param {string} props.headerColor   eksen yazısı
 * @param {{season:string,episode:string,rating:string,seasonLetter:string,episodeLetter:string}} props.labels  KARARLI olmalı
 */
function TvGraphGrid({ seasons, grid, gridKey, selected, onPress, borderColor, headerColor, labels }) {
  const [viewportHeight, setViewportHeight] = useState(0);
  const onViewportLayout = useCallback((event) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setViewportHeight((prev) => (prev === next ? prev : next));
  }, []);

  const maxEpisodes = useMemo(
    () => seasons.reduce((max, season) => Math.max(max, season.episodes.length), 0),
    [seasons],
  );
  const metrics = useMemo(
    () => tvGraphMetrics(grid, maxEpisodes, seasons.length),
    [grid, maxEpisodes, seasons.length],
  );
  const rows = useMemo(() => Array.from({ length: maxEpisodes }, (_, index) => index), [maxEpisodes]);
  const getItemLayout = useMemo(() => tvGraphRowLayout(metrics.rowHeight), [metrics.rowHeight]);

  const renderItem = useCallback(
    ({ item }) => (
      <EpisodeRow
        rowIndex={item}
        seasons={seasons}
        grid={grid}
        metrics={metrics}
        selectedSeason={tvGraphRowSelection(selected, item)}
        onPress={onPress}
        borderColor={borderColor}
        headerColor={headerColor}
        labels={labels}
      />
    ),
    [seasons, grid, metrics, selected, onPress, borderColor, headerColor, labels],
  );

  const initialNumToRender = tvGraphInitialRows(viewportHeight, metrics.rowHeight, rows.length);

  return (
    <View style={styles.viewport} onLayout={onViewportLayout}>
      {viewportHeight > 0 && seasons.length > 0 ? (
        <ScrollView
          horizontal
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          style={{ height: viewportHeight }}
          contentContainerStyle={styles.horizontalContent}
        >
          <View style={{ width: metrics.contentWidth, height: viewportHeight }}>
            <View style={styles.topGap} />
            {grid.showAxes ? (
              <SeasonHeader
                seasons={seasons}
                grid={grid}
                metrics={metrics}
                headerColor={headerColor}
                labels={labels}
              />
            ) : null}
            <FlatList
              key={gridKey}
              style={styles.list}
              data={rows}
              extraData={selected}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              getItemLayout={getItemLayout}
              ListFooterComponent={LIST_FOOTER}
              initialNumToRender={initialNumToRender}
              maxToRenderPerBatch={8}
              updateCellsBatchingPeriod={30}
              windowSize={7}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            />
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

export default memo(TvGraphGrid);
export { EpisodeCell, EpisodeRow, SeasonHeader, TvGraphGrid };

const styles = StyleSheet.create({
  // Üst kaptan dikey boşluğu alır; ölçülen yükseklik iç listeye açık yükseklik olarak iner.
  viewport: { flex: 1 },
  horizontalContent: { paddingHorizontal: 12 },
  topGap: { height: 10 },
  list: { flex: 1 },

  row: { flexDirection: "row", alignItems: "center" },
  seasonHeader: { paddingVertical: 2, alignItems: "center" },
  episodeHeader: { justifyContent: "center", alignItems: "flex-end", paddingRight: 5 },
  axisText: { fontWeight: "700", letterSpacing: 0.5 },

  cell: { justifyContent: "center", alignItems: "center", overflow: "hidden" },
  pressed: { opacity: 0.75 },
  cellSeasonLabel: { position: "absolute", opacity: 0.55, fontWeight: "700" },
  cellRating: { fontWeight: "800" },
  cellEpisodeLabel: { position: "absolute", opacity: 0.55, fontWeight: "700" },

  emptyCell: { justifyContent: "center", alignItems: "center" },
  emptyCellDot: { color: "rgba(255,255,255,0.15)" },
});
