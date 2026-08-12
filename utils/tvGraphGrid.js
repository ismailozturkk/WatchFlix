export const TV_GRAPH_GAP_RATIO = 2 / 50;

export function buildTvGraphGrid(size) {
  return Object.freeze({
    ...size,
    margin: +(Number(size?.cell || 0) * TV_GRAPH_GAP_RATIO).toFixed(2),
  });
}

export const TV_GRAPH_GRID_SIZES = Object.freeze({
  default: buildTvGraphGrid({
    cell: 50,
    radius: 8,
    rating: 14,
    label: 8,
    labelOffset: 3,
    headerFont: 10,
    dot: 24,
  }),
  compact: buildTvGraphGrid({
    cell: 36,
    radius: 6,
    rating: 11,
    label: 6.5,
    labelOffset: 2,
    headerFont: 9,
    dot: 18,
  }),
});
