const {
  buildTvGraphGrid,
  TV_GRAPH_GAP_RATIO,
  TV_GRAPH_GRID_SIZES,
} = require("../utils/tvGraphGrid");

test("keeps episode-cell gaps proportional at every scale", () => {
  expect(TV_GRAPH_GRID_SIZES.default.margin).toBe(1.76);
  expect(TV_GRAPH_GRID_SIZES.compact.margin).toBe(1.2);
  expect(TV_GRAPH_GRID_SIZES.heatmap.margin).toBe(0.8);
  expect(TV_GRAPH_GRID_SIZES.default.margin / TV_GRAPH_GRID_SIZES.default.cell)
    .toBe(TV_GRAPH_GAP_RATIO);
  expect(TV_GRAPH_GRID_SIZES.compact.margin / TV_GRAPH_GRID_SIZES.compact.cell)
    .toBe(TV_GRAPH_GAP_RATIO);
  expect(buildTvGraphGrid({ cell: 75 }).margin).toBe(3);
});

test("only the smallest view moves cell labels to the axes", () => {
  const { default: large, compact, heatmap } = TV_GRAPH_GRID_SIZES;
  expect(large.cell).toBeGreaterThan(compact.cell);
  expect(compact.cell).toBeGreaterThan(heatmap.cell);
  for (const grid of [large, compact]) {
    expect(grid.showAxes).toBe(false);
    expect(grid.colorOnly).toBe(false);
  }
  expect(heatmap.showAxes).toBe(true);
  expect(heatmap.colorOnly).toBe(true);
  expect(heatmap.margin / heatmap.cell).toBe(TV_GRAPH_GAP_RATIO);
});

const {
  tvGraphInitialRows,
  tvGraphMetrics,
  tvGraphRowLayout,
  tvGraphRowSelection,
} = require("../utils/tvGraphGrid");

test("row height is the column width, so the list can use fixed-height layout", () => {
  const { default: large, heatmap } = TV_GRAPH_GRID_SIZES;
  const metrics = tvGraphMetrics(large, 24, 5);
  expect(metrics.colWidth).toBeCloseTo(44 + 1.76 * 2);
  expect(metrics.rowHeight).toBe(metrics.colWidth);
  expect(metrics.rowLabelWidth).toBe(0);
  expect(metrics.contentWidth).toBeCloseTo(5 * metrics.colWidth);

  // Isı haritasında bölüm numarası sütunu rakam sayısıyla genişler ama 30'un altına inmez.
  expect(tvGraphMetrics(heatmap, 9, 3).rowLabelWidth).toBe(30);
  expect(tvGraphMetrics(heatmap, 1200, 3).rowLabelWidth).toBe(12 + 4 * 6);
  expect(tvGraphMetrics(heatmap, 9, 3).contentWidth).toBe(30 + 3 * metricsCol(heatmap));
});

function metricsCol(grid) {
  return grid.cell + grid.margin * 2;
}

test("row layout offsets are index times the fixed row height", () => {
  const layout = tvGraphRowLayout(47.5);
  expect(layout(null, 0)).toEqual({ length: 47.5, offset: 0, index: 0 });
  expect(layout(null, 4)).toEqual({ length: 47.5, offset: 190, index: 4 });
});

test("only the selected row sees the selected season", () => {
  const selected = { season: 3, index: 5 };
  expect(tvGraphRowSelection(selected, 5)).toBe(3);
  expect(tvGraphRowSelection(selected, 4)).toBeNull();
  expect(tvGraphRowSelection(null, 5)).toBeNull();
});

test("initial rows cover the screen with a margin and never exceed the row count", () => {
  expect(tvGraphInitialRows(600, 47.52, 100)).toBe(Math.ceil(600 / 47.52) + 3);
  expect(tvGraphInitialRows(600, 47.52, 5)).toBe(5);
  // Çok kısa görüntü alanında bile alt sınır korunur.
  expect(tvGraphInitialRows(40, 47.52, 100)).toBe(8);
  expect(tvGraphInitialRows(600, 0, 100)).toBe(0);
  expect(tvGraphInitialRows(600, 47.52, 0)).toBe(0);
});
