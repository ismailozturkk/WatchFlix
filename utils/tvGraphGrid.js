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
