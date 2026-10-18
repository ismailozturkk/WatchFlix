export const TV_GRAPH_GAP_RATIO = 2 / 50;

export function buildTvGraphGrid(size) {
  return Object.freeze({
    ...size,
    margin: +(Number(size?.cell || 0) * TV_GRAPH_GAP_RATIO).toFixed(2),
  });
}

export const TV_GRAPH_GRID_SIZES = Object.freeze({
  default: buildTvGraphGrid({
    showAxes: false,
    colorOnly: false,
    cell: 44,
    radius: 7,
    rating: 12.5,
    label: 7,
    labelOffset: 2.5,
    headerFont: 9,
    dot: 20,
  }),
  compact: buildTvGraphGrid({
    showAxes: false,
    colorOnly: false,
    cell: 30,
    radius: 5,
    rating: 9.5,
    label: 5.5,
    labelOffset: 1.5,
    headerFont: 8,
    dot: 15,
  }),
  heatmap: buildTvGraphGrid({
    showAxes: true,
    colorOnly: true,
    cell: 20,
    radius: 5,
    headerFont: 8,
  }),
});

/**
 * Izgaranın ölçüleri. Satır = bir bölüm numarası (tüm sezonlar yan yana), sütun = sezon.
 * Satır yüksekliği SABİT (hücre + iki yandaki boşluk) olduğundan liste `getItemLayout`
 * ile hiçbir satırı ölçmeden pencerelenebilir.
 *
 * @param {{cell:number, margin:number, showAxes?:boolean}} grid
 * @param {number} maxEpisodes en uzun sezonun bölüm sayısı
 * @param {number} seasonCount sezon (sütun) sayısı
 */
export function tvGraphMetrics(grid, maxEpisodes, seasonCount) {
  const colWidth = grid.cell + grid.margin * 2;
  const rowLabelWidth = grid.showAxes
    ? Math.max(30, 12 + String(maxEpisodes).length * 6)
    : 0;
  return {
    colWidth,
    rowHeight: colWidth,
    rowLabelWidth,
    contentWidth: rowLabelWidth + seasonCount * colWidth,
  };
}

/**
 * Seçili bölüm bu satırdaysa sezon numarasını, değilse null döner. Satır bileşeni yalnız bu
 * değeri alır; böylece bir bölüme dokununca sadece eski ve yeni seçili satır yeniden çizilir,
 * diğer yüzlerce satır `memo` ile atlanır.
 *
 * @param {{season:number, index:number}|null} selected
 */
export function tvGraphRowSelection(selected, rowIndex) {
  return selected && selected.index === rowIndex ? selected.season : null;
}

/** `FlatList.getItemLayout` — sabit satır yüksekliği. */
export function tvGraphRowLayout(rowHeight) {
  return (_data, index) => ({
    length: rowHeight,
    offset: rowHeight * index,
    index,
  });
}

/**
 * Ekranı dolduran satır sayısı (+ pay). `initialNumToRender` için: ilk karede yalnız
 * görünen satırlar çizilsin, geri kalanı pencere doldursun.
 */
export function tvGraphInitialRows(viewportHeight, rowHeight, rowCount) {
  if (!(rowHeight > 0) || !(rowCount > 0)) return 0;
  const visible = Math.ceil(Math.max(0, viewportHeight) / rowHeight) + 3;
  return Math.min(rowCount, Math.max(visible, 8));
}
